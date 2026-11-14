import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { Dem } from '../src/astro/horizon';

const BIN = 'public/data/spole-dem-240m.bin';
const META = 'public/data/spole-dem.json';

/** Loads the shipped south-pole grid straight from disk, or null if it has not been built. */
export function loadDemFromDisk(): Dem | null {
  if (!existsSync(BIN) || !existsSync(META)) return null;
  const meta = JSON.parse(readFileSync(META, 'utf8')) as { size: number; metresPerPixel: number };
  const raw = gunzipSync(readFileSync(BIN));
  const heights = new Int16Array(raw.buffer, raw.byteOffset, meta.size * meta.size).slice();
  for (let r = 0; r < meta.size; r++) {
    const o = r * meta.size;
    if (r > 0) heights[o] += heights[o - meta.size];
    for (let c = 1; c < meta.size; c++) heights[o + c] += heights[o + c - 1];
  }
  return { size: meta.size, metresPerPixel: meta.metresPerPixel, heights, edgeLat: -80 };
}
