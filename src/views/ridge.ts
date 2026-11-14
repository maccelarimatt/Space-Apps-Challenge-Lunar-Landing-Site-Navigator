// The stacked ridge plot: one line per lunar day, each tracing how far the Sun's
// (or Earth's) upper edge stands above the terrain through that day.

import { dateUTC, degrees } from '../format';
import { DAY_MS, LUNAR_DAY_MS } from '../astro/windows';

export interface RidgeRow {
  /** Start of this lunar day. */
  startMs: number;
  stepMs: number;
  /** Height of the body's upper edge above the horizon at each step, degrees. */
  top: Float32Array;
}

export interface RidgeData {
  rows: RidgeRow[];
  /** Index of the row holding the chosen time. */
  current: number;
  timeMs: number;
  body: 'sun' | 'earth';
  /** Bumped when the site changes, to replay the draw-in. */
  drawKey: string;
}

export interface RidgeApi {
  render(data: RidgeData): void;
}

const SVG = 'http://www.w3.org/2000/svg';
const GUTTER = 50;
const AXIS = 22;

export function createRidge(host: HTMLElement, readout: HTMLElement, onPick: (timeMs: number) => void): RidgeApi {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'ridge');
  svg.setAttribute('role', 'img');
  host.append(svg);

  let data: RidgeData | null = null;
  let lastDrawKey = '';
  let geom = { w: 0, h: 0, gap: 0, top: 0, plotW: 0 };

  function draw() {
    if (!data) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w < 80 || h < 80) return;
    const { rows, current, body } = data;
    const n = rows.length;
    // Peaks are allowed to climb over the three rows above, as on the sleeve this borrows from.
    const gap = (h - AXIS - 8) / (n + 3.2);
    const top = gap * 4.0;
    const plotW = w - GUTTER - 4;
    geom = { w, h, gap, top, plotW };

    let peak = 0.2;
    for (const row of rows) for (const v of row.top) if (v > peak) peak = v;
    const k = (gap * 3.7) / peak;

    const colour = body === 'sun' ? 'var(--sun)' : 'var(--earth)';
    const animate = data.drawKey !== lastDrawKey;
    lastDrawKey = data.drawKey;

    let out = '';
    rows.forEach((row, i) => {
      const base = top + i * gap;
      const count = row.top.length;
      // `outline` is the whole silhouette (used to hide the rows behind); `lit` is
      // only the stretches where the body is in view, so a hidden spell reads as a gap.
      let outline = '';
      let lit = '';
      let pen = false;
      for (let j = 0; j < count; j++) {
        const x = GUTTER + (j / (count - 1)) * plotW;
        const v = row.top[j];
        const p = `${x.toFixed(1)} ${(base - Math.max(0, v) * k).toFixed(1)}`;
        outline += `${j ? 'L' : 'M'}${p}`;
        if (v > 0) {
          lit += `${pen ? 'L' : 'M'}${p}`;
          pen = true;
        } else {
          pen = false;
        }
      }
      const on = i === current;
      out += `<path class="ridge-fill" d="${outline}L${(GUTTER + plotW).toFixed(1)} ${(base + gap).toFixed(1)}L${GUTTER} ${(base + gap).toFixed(1)}Z"/>`;
      out += `<path class="ridge-base" d="M${GUTTER} ${base.toFixed(1)}H${(GUTTER + plotW).toFixed(1)}"/>`;
      if (lit) out += `<path class="ridge-line${on ? ' on' : ''}${animate ? ' draw' : ''}" pathLength="1" style="--i:${i}${on ? `;stroke:${colour}` : ''}" d="${lit}"/>`;
      if (i % 2 === 0 || on) {
        out += `<text class="ridge-date${on ? ' on' : ''}" x="${GUTTER - 8}" y="${base.toFixed(1)}" dy="0.32em" text-anchor="end">${dateUTC(row.startMs, false)}</text>`;
      }
    });

    // Marker for the chosen time on its own line.
    const cur = rows[current];
    if (cur) {
      const f = (data.timeMs - cur.startMs) / LUNAR_DAY_MS;
      const j = Math.max(0, Math.min(cur.top.length - 1, Math.round(f * (cur.top.length - 1))));
      const x = GUTTER + f * plotW;
      const y = top + current * gap - Math.max(0, cur.top[j]) * k;
      out += `<line class="ridge-now" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${(y - 14).toFixed(1)}" y2="${(top + current * gap + 5).toFixed(1)}" style="stroke:${colour}"/>`;
      out += `<circle class="ridge-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" style="fill:${colour}"/>`;
    }

    const axisY = h - 6;
    for (const d of [0, 7, 14, 21, 29.5]) {
      const x = GUTTER + (d / 29.53) * plotW;
      out += `<text class="ridge-axis" x="${x.toFixed(1)}" y="${axisY}" text-anchor="${d === 0 ? 'start' : d > 29 ? 'end' : 'middle'}">${d === 0 ? 'Day 0' : d}</text>`;
    }
    out += `<line class="ridge-hover" y1="${(top - gap * 3.8).toFixed(1)}" y2="${(top + (n - 1) * gap + 4).toFixed(1)}" hidden/>`;

    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    svg.innerHTML = out;
    const name = body === 'sun' ? 'Sun' : 'Earth';
    svg.setAttribute(
      'aria-label',
      `${name} height above the local horizon across ${n} lunar days, from ${dateUTC(rows[0].startMs)} to ${dateUTC(rows[n - 1].startMs + LUNAR_DAY_MS)}. The lunar day holding the chosen date is highlighted.`,
    );
  }

  function locate(e: PointerEvent): { row: RidgeRow; timeMs: number; value: number; x: number } | null {
    if (!data) return null;
    const r = svg.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const f = (x - GUTTER) / geom.plotW;
    if (f < 0 || f > 1) return null;
    const i = Math.max(0, Math.min(data.rows.length - 1, Math.round((y - geom.top) / geom.gap + 0.35)));
    const row = data.rows[i];
    const j = Math.round(f * (row.top.length - 1));
    return { row, timeMs: row.startMs + f * LUNAR_DAY_MS, value: row.top[j], x };
  }

  svg.addEventListener('pointermove', (e) => {
    const hit = locate(e);
    const hair = svg.querySelector<SVGLineElement>('.ridge-hover');
    if (!hit || !data) {
      if (hair) hair.setAttribute('hidden', '');
      readout.textContent = '';
      return;
    }
    if (hair) {
      hair.removeAttribute('hidden');
      hair.setAttribute('x1', hit.x.toFixed(1));
      hair.setAttribute('x2', hit.x.toFixed(1));
    }
    const name = data.body === 'sun' ? 'Sun' : 'Earth';
    const day = ((hit.timeMs - hit.row.startMs) / DAY_MS).toFixed(1);
    readout.textContent =
      hit.value > 0
        ? `${dateUTC(hit.timeMs)}, day ${day}: ${name}’s upper edge ${degrees(hit.value)} above the terrain. Click to go there.`
        : `${dateUTC(hit.timeMs)}, day ${day}: ${name} hidden, ${degrees(-hit.value)} below the terrain. Click to go there.`;
  });
  svg.addEventListener('pointerleave', () => {
    svg.querySelector('.ridge-hover')?.setAttribute('hidden', '');
    readout.textContent = '';
  });
  svg.addEventListener('click', (e) => {
    const hit = locate(e as PointerEvent);
    if (hit) onPick(hit.timeMs);
  });

  new ResizeObserver(draw).observe(host);

  return {
    render(d) {
      data = d;
      draw();
    },
  };
}
