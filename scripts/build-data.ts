// Turns NASA source files in data-raw/ into the small files the site ships in public/data/.
//
// Sources (download into data-raw/ first; see README):
//   lroc_color_poles_4k.tif   NASA SVS CGI Moon Kit colour map (LRO Camera)
//   ldem_16_uint.tif          NASA SVS CGI Moon Kit elevation map (LRO LOLA), 16 px/degree
//   ldem_80s_80m.img          PDS LOLA gridded south-pole elevation, 80 m/pixel, 80°S to the pole
//
// Run with: npm run data

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import sharp from 'sharp';

const RAW = 'data-raw';
const OUT = 'public/data';
mkdirSync(OUT, { recursive: true });

async function colourMap() {
  const info = await sharp(`${RAW}/lroc_color_poles_4k.tif`)
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(`${OUT}/moon-color-4k.jpg`);
  console.log(`moon-color-4k.jpg ${info.width}x${info.height} ${(info.size / 1e6).toFixed(2)} MB`);
}

/** Tangent-space normal map of the whole Moon from the 16 px/degree elevation grid. */
async function normalMap() {
  const { data, info } = await sharp(`${RAW}/ldem_16_uint.tif`, { limitInputPixels: false })
    .toColourspace('grey16')
    .raw({ depth: 'ushort' })
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const px = new Uint16Array(data.buffer, data.byteOffset, w * h * info.channels);
  const ch = info.channels;
  let lo = 65535;
  let hi = 0;
  for (let i = 0; i < px.length; i += ch) {
    if (px[i] < lo) lo = px[i];
    if (px[i] > hi) hi = px[i];
  }
  // The file stores half-metres; a real Moon spans roughly 20 km of relief.
  if (hi - lo < 20_000) throw new Error(`Elevation TIFF was not read at 16-bit depth (range ${lo}..${hi})`);
  const at = (x: number, y: number) => px[(y * w + ((x + w) % w)) * ch] * 0.5; // half-metres to metres
  const metresPerPixel = (2 * Math.PI * 1_737_400) / w;
  const out = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    const lat = (0.5 - (y + 0.5) / h) * Math.PI;
    const ew = metresPerPixel * Math.max(Math.cos(lat), 0.02);
    const y0 = Math.max(y - 1, 0);
    const y1 = Math.min(y + 1, h - 1);
    for (let x = 0; x < w; x++) {
      const dEast = (at(x + 1, y) - at(x - 1, y)) / (2 * ew);
      const dNorth = (at(x, y0) - at(x, y1)) / ((y1 - y0) * metresPerPixel);
      const inv = 1 / Math.hypot(dEast, dNorth, 1);
      const o = (y * w + x) * 3;
      out[o] = Math.round((-dEast * inv * 0.5 + 0.5) * 255);
      out[o + 1] = Math.round((-dNorth * inv * 0.5 + 0.5) * 255);
      out[o + 2] = Math.round((inv * 0.5 + 0.5) * 255);
    }
  }
  const res = await sharp(out, { raw: { width: w, height: h, channels: 3 } })
    .resize(4096, 2048, { kernel: 'lanczos3' })
    .jpeg({ quality: 88, chromaSubsampling: '4:4:4' })
    .toFile(`${OUT}/moon-normal-4k.jpg`);
  console.log(`moon-normal-4k.jpg ${res.width}x${res.height} ${(res.size / 1e6).toFixed(2)} MB`);
}

/** South-pole elevation grid at 240 m/pixel plus a shaded-relief picture of it. */
async function southPole() {
  const SRC = 7600;
  const F = 3;
  // Trim two pixels from every edge so the grid divides by three and the pole stays dead centre.
  const TRIM = 2;
  const N = (SRC - 2 * TRIM) / F;
  const raw = readFileSync(`${RAW}/ldem_80s_80m.img`);
  if (raw.byteLength !== SRC * SRC * 2) throw new Error('Unexpected size for ldem_80s_80m.img');
  const src = new Int16Array(raw.buffer, raw.byteOffset, SRC * SRC);
  const dem = new Int16Array(N * N);
  let min = Infinity;
  let max = -Infinity;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      let sum = 0;
      for (let dr = 0; dr < F; dr++)
        for (let dc = 0; dc < F; dc++) sum += src[(TRIM + r * F + dr) * SRC + TRIM + c * F + dc];
      const metres = Math.round((sum / (F * F)) * 0.5); // source unit is half a metre
      dem[r * N + c] = metres;
      if (metres < min) min = metres;
      if (metres > max) max = metres;
    }
  }
  console.log(`south pole grid ${N}x${N}, heights ${min} to ${max} m`);

  // Delta-code so gzip sees small numbers: each value minus its left neighbour,
  // first column minus the value above.
  const packed = new Int16Array(N * N);
  for (let r = 0; r < N; r++) {
    const o = r * N;
    packed[o] = r === 0 ? dem[0] : dem[o] - dem[o - N];
    for (let c = 1; c < N; c++) packed[o + c] = dem[o + c] - dem[o + c - 1];
  }
  const gz = gzipSync(Buffer.from(packed.buffer), { level: 9 });
  writeFileSync(`${OUT}/spole-dem-240m.bin`, gz);
  console.log(`spole-dem-240m.bin ${(gz.byteLength / 1e6).toFixed(2)} MB`);

  // Shaded relief: light from the upper left, plus a little height tint so crater floors read darker.
  const MPP = 80 * F;
  const lx = -0.5;
  const ly = 0.5;
  const lz = 0.7071;
  const shade = Buffer.alloc(N * N);
  for (let r = 0; r < N; r++) {
    const r0 = Math.max(r - 1, 0);
    const r1 = Math.min(r + 1, N - 1);
    for (let c = 0; c < N; c++) {
      const c0 = Math.max(c - 1, 0);
      const c1 = Math.min(c + 1, N - 1);
      const dx = ((dem[r * N + c1] - dem[r * N + c0]) / ((c1 - c0) * MPP)) * 2.2;
      const dy = ((dem[r0 * N + c] - dem[r1 * N + c]) / ((r1 - r0) * MPP)) * 2.2;
      const inv = 1 / Math.hypot(dx, dy, 1);
      const lambert = Math.max(0, (-dx * lx - dy * ly + lz) * inv);
      const tint = (dem[r * N + c] - min) / (max - min);
      const v = 0.12 + 0.68 * lambert + 0.14 * tint;
      shade[r * N + c] = Math.max(0, Math.min(255, Math.round(v * 255)));
    }
  }
  const res = await sharp(shade, { raw: { width: N, height: N, channels: 1 } })
    .webp({ quality: 82 })
    .toFile(`${OUT}/spole-relief.webp`);
  console.log(`spole-relief.webp ${res.width}x${res.height} ${(res.size / 1e6).toFixed(2)} MB`);

  writeFileSync(
    `${OUT}/spole-dem.json`,
    JSON.stringify({ size: N, metresPerPixel: MPP, minM: min, maxM: max, source: 'LRO LOLA LDEM_80S_80M (PDS), block-averaged 3x' }),
  );
}

const only = process.argv[2];
if (!only || only === 'colour') await colourMap();
if (!only || only === 'normal') await normalMap();
if (!only || only === 'pole') await southPole();
