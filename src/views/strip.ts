// The horizon strip: the full 360° skyline unrolled, with the Sun and Earth and
// the paths they follow over the lunar day. Exact where the 3D view is immersive.

import type { Horizon } from '../astro/horizon';
import { AZ_STEPS } from '../astro/horizon';
import type { Series, SiteView } from '../astro/windows';

const SVG = 'http://www.w3.org/2000/svg';
const PAD_L = 34;
const PAD_B = 20;
const PAD_T = 6;

export interface StripData {
  horizon: Horizon;
  view: SiteView;
  /** Samples across the lunar day, for the Sun and Earth paths. */
  track: Series;
  lookAz: number;
  fovDeg: number;
}

export interface StripApi {
  render(data: StripData): void;
  setLook(az: number, fovDeg: number): void;
}

export function createStrip(host: HTMLElement, onLook: (az: number) => void): StripApi {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'strip');
  svg.setAttribute('role', 'img');
  host.append(svg);
  let data: StripData | null = null;
  let plot = { w: 0, h: 0, lo: -5, hi: 10 };

  const xOf = (az: number) => PAD_L + (az / 360) * plot.w;
  const yOf = (el: number) => PAD_T + ((plot.hi - el) / (plot.hi - plot.lo)) * plot.h;

  function path(az: Float32Array, el: Float32Array): string {
    let d = '';
    for (let i = 0; i < az.length; i++) {
      // Lift the pen when the path wraps past north.
      const jump = i > 0 && Math.abs(az[i] - az[i - 1]) > 180;
      d += `${i && !jump ? 'L' : 'M'}${xOf(az[i]).toFixed(1)} ${yOf(el[i]).toFixed(1)}`;
    }
    return d;
  }

  function bracket(az: number, fov: number): string {
    const half = Math.min(fov, 359) / 2;
    const spans: [number, number][] = [];
    const a = az - half;
    const b = az + half;
    if (a < 0) spans.push([0, b], [a + 360, 360]);
    else if (b > 360) spans.push([a, 360], [0, b - 360]);
    else spans.push([a, b]);
    return spans
      .map(([p, q]) => `<rect class="strip-look" x="${xOf(p).toFixed(1)}" y="${PAD_T}" width="${(xOf(q) - xOf(p)).toFixed(1)}" height="${plot.h}"/>`)
      .join('');
  }

  function draw() {
    if (!data) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w < 120 || h < 60) return;
    const { horizon, view, track } = data;

    let lo = Infinity;
    let hi = -Infinity;
    for (const e of horizon.elevation) {
      if (e < lo) lo = e;
      if (e > hi) hi = e;
    }
    let trackLo = Infinity;
    for (let i = 0; i < track.count; i++) {
      hi = Math.max(hi, track.sunEl[i] + 0.3, track.earthEl[i] + 1);
      trackLo = Math.min(trackLo, track.sunEl[i] - 0.3, track.earthEl[i] - 1);
    }
    // Follow the paths a little way below the skyline, but not all the way to the nadir.
    lo = Math.floor(Math.min(lo, Math.max(trackLo, -10), -1) - 1);
    hi = Math.ceil(Math.max(hi, 1) + 1);
    plot = { w: w - PAD_L - 4, h: h - PAD_B - PAD_T, lo, hi };
    const floor = PAD_T + plot.h;

    // Receding ridgelines, farthest band first so nearer ground covers it.
    let land = '';
    const bands = horizon.layers.length;
    for (let k = bands - 1; k >= 0; k--) {
      const layer = horizon.layers[k];
      let line = '';
      for (let i = 0; i <= AZ_STEPS; i++) {
        line += `${i ? 'L' : 'M'}${xOf((i / AZ_STEPS) * 360).toFixed(1)} ${Math.min(floor + 2, yOf(layer[i % AZ_STEPS])).toFixed(1)}`;
      }
      // Nearest ground lightest, stepping down with distance; every band stays clear of the black sky.
      const far = bands > 1 ? k / (bands - 1) : 0;
      const g = Math.round(44 - far * 18);
      land += `<path class="strip-land" style="fill:rgb(${g} ${g} ${g})" d="${line}L${PAD_L + plot.w} ${floor + 2}L${PAD_L} ${floor + 2}Z"/>`;
      land += `<path class="strip-ridge" d="${line}"/>`;
    }
    // The skyline itself, the upper edge of every band, in full white.
    let top = '';
    for (let i = 0; i <= AZ_STEPS; i++) {
      top += `${i ? 'L' : 'M'}${xOf((i / AZ_STEPS) * 360).toFixed(1)} ${Math.min(floor + 2, yOf(horizon.elevation[i % AZ_STEPS])).toFixed(1)}`;
    }
    land += `<path class="strip-sky" d="${top}"/>`;

    const kx = plot.w / 360;
    const ky = plot.h / (hi - lo);
    const disc = (b: SiteView['sun'], cls: string) =>
      `<ellipse class="${cls}" cx="${xOf(b.az).toFixed(1)}" cy="${yOf(b.el).toFixed(1)}" rx="${Math.max(2.5, b.radius * kx).toFixed(1)}" ry="${Math.max(2.5, b.radius * ky).toFixed(1)}"/>`;
    const tag = (b: SiteView['sun'], name: string, cls: string) => {
      const y = Math.min(yOf(b.el + b.radius), yOf(b.horizon)) - 7;
      const x = xOf(b.az);
      return `<text class="strip-tag ${cls}" x="${x.toFixed(1)}" y="${Math.max(PAD_T + 10, y).toFixed(1)}" text-anchor="${x > w - 70 ? 'end' : x < PAD_L + 40 ? 'start' : 'middle'}">${name}${b.fraction === 0 ? ' (hidden)' : ''}</text>`;
    };

    let grid = '';
    const stepEl = hi - lo > 40 ? 20 : hi - lo > 16 ? 5 : 2;
    for (let e = Math.ceil(lo / stepEl) * stepEl; e <= hi; e += stepEl) {
      grid += `<line class="strip-grid${e === 0 ? ' level' : ''}" x1="${PAD_L}" x2="${PAD_L + plot.w}" y1="${yOf(e).toFixed(1)}" y2="${yOf(e).toFixed(1)}"/>`;
      grid += `<text class="strip-axis" x="${PAD_L - 6}" y="${yOf(e).toFixed(1)}" dy="0.32em" text-anchor="end">${e}°</text>`;
    }
    let compass = '';
    ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'].forEach((c, i) => {
      compass += `<text class="strip-axis" x="${xOf(i * 45).toFixed(1)}" y="${h - 5}" text-anchor="${i === 0 ? 'start' : i === 8 ? 'end' : 'middle'}">${c}</text>`;
    });

    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    svg.innerHTML = `
      <clipPath id="strip-clip"><rect x="${PAD_L}" y="${PAD_T}" width="${plot.w}" height="${plot.h}"/></clipPath>
      ${grid}
      <g clip-path="url(#strip-clip)">
        <path class="strip-track sun" d="${path(track.sunAz, track.sunEl)}"/>
        <path class="strip-track earth" d="${path(track.earthAz, track.earthEl)}"/>
        ${disc(view.sun, 'strip-sun')}
        ${disc(view.earth, 'strip-earth')}
        ${land}
      </g>
      ${tag(view.sun, 'Sun', 'sun')}
      ${tag(view.earth, 'Earth', 'earth')}
      <g class="strip-look-g">${bracket(data.lookAz, data.fovDeg)}</g>
      ${compass}`;
    svg.setAttribute(
      'aria-label',
      'The full 360 degree horizon seen from the site, with the Sun and Earth and their paths over the lunar day. Click to turn the sky view.',
    );
  }

  svg.addEventListener('click', (e) => {
    const r = svg.getBoundingClientRect();
    const az = ((e.clientX - r.left - PAD_L) / plot.w) * 360;
    if (az >= 0 && az <= 360) onLook(az % 360);
  });
  new ResizeObserver(draw).observe(host);

  return {
    render(d) {
      data = d;
      draw();
    },
    setLook(az, fovDeg) {
      if (!data) return;
      data.lookAz = az;
      data.fovDeg = fovDeg;
      const g = svg.querySelector('.strip-look-g');
      if (g) g.innerHTML = bracket(az, fovDeg);
    },
  };
}
