// The About tab: what the tool is, the exact calculations it runs, how it was
// checked, and every source, with what was read and what was not.
// Figures quoted here come from src/checks.ts, which the test suite recomputes.

import { CREST_LLS01, GLASER_TABLE_2, HORIZONS_WORST_DEG } from './checks';
import type { Horizon } from './astro/horizon';
import type { Series, SiteView } from './astro/windows';

const f1 = (v: number) => v.toFixed(1);

// --- Small MathML helpers ----------------------------------------------------

const mi = (s: string) => `<mi>${s}</mi>`;
const mo = (s: string) => `<mo>${s}</mo>`;
const mn = (s: string) => `<mn>${s}</mn>`;
// MathML Core draws only upright or italic letters, so bold vectors use the Unicode bold alphabet.
const BOLD: Record<string, string> = { d: '𝐝', r: '𝐫', u: '𝐮', n: '𝐧', e: '𝐞' };
const bold = (s: string) => `<mi>${BOLD[s]}</mi>`;
const vec = (s: string) => `<mover accent="true">${bold(s)}<mo>^</mo></mover>`;
const sub = (a: string, b: string) => `<msub>${a}${b}</msub>`;
const frac = (a: string, b: string) => `<mfrac>${a}${b}</mfrac>`;
const row = (...p: string[]) => `<mrow>${p.join('')}</mrow>`;
// A named function followed by the invisible "function application" operator, which gives it its space.
const fn = (name: string) => `<mi>${name}</mi><mo>&#x2061;</mo><mspace width="0.2em"/>`;
const gap = `<mspace width="0.2em"/>`;
const paren = (...p: string[]) => row(mo('('), ...p, mo(')'));
const block = (...p: string[]) => `<math display="block">${row(...p)}</math>`;
const inline = (...p: string[]) => `<math>${row(...p)}</math>`;

const d = bold('d');
const dot = mo('·');

const EQ = {
  d: block(d, mo('='), sub(bold('r'), mi('B')), mo('−'), paren(mi('R'), mo('+'), mi('z')), vec('u')),
  az: block(mi('A'), mo('='), fn('atan2'), paren(d, dot, vec('e'), mo(','), d, dot, vec('n'))),
  el: block(mi('e'), mo('='), fn('arcsin'), frac(row(d, dot, vec('u')), row(mo('|'), d, mo('|')))),
  rho: block(mi('ρ'), mo('='), fn('arcsin'), frac(sub(mi('R'), mi('B')), row(mo('|'), d, mo('|')))),
  theta: block(mi('θ'), mo('='), frac(mi('s'), mi('R'))),
  eps: block(
    mi('ε'),
    paren(mi('s')),
    mo('='),
    fn('atan2'),
    paren(sub(mi('r'), mi('t')), fn('cos'), mi('θ'), mo('−'), sub(mi('r'), mi('o')), mo(','), sub(mi('r'), mi('t')), fn('sin'), mi('θ')),
  ),
  radii: block(
    sub(mi('r'), mi('t')),
    mo('='),
    mi('R'),
    mo('+'),
    mi('z'),
    paren(mi('s')),
    mo(',', ),
    `<mspace width="1.2em"/>`,
    sub(mi('r'), mi('o')),
    mo('='),
    mi('R'),
    mo('+'),
    sub(mi('z'), mn('0')),
    mo('+'),
    mi('m'),
  ),
  H: block(mi('H'), paren(mi('A')), mo('='), `<munder><mo movablelimits="false">max</mo>${row(mi('s'))}</munder>`, mi('ε'), paren(mi('s'))),
  c: block(mi('c'), mo('='), mi('e'), mo('−'), mi('H'), paren(mi('A')), mo(','), `<mspace width="1.2em"/>`, mi('x'), mo('='), frac(mi('c'), mi('ρ'))),
  f: block(
    mi('f'),
    mo('='),
    mn('1'),
    mo('−'),
    frac(row(fn('arccos'), mi('x'), mo('−'), mi('x'), `<msqrt>${mn('1')}${mo('−')}<msup>${mi('x')}${mn('2')}</msup></msqrt>`), mi('π')),
  ),
  view: block(mi('f'), mo('&gt;'), mn('0.5')),
  power: block(mi('P'), paren(mi('t')), mo('='), mi('S'), gap, sub(mi('A'), mi('p')), gap, mi('η'), gap, mi('f'), paren(mi('t'))),
  battery: block(mi('E'), mo('='), sub(mi('P'), mi('need')), gap, sub(mi('T'), mi('short'))),
};

// --- Static diagrams ---------------------------------------------------------

/** Fig. 2: looking out along one compass direction, with the Moon's curve exaggerated. */
function sightlineDiagram(): string {
  const W = 680;
  const H = 200;
  const cx = 300;
  const R = 1200;
  const cy = 120 + R;
  const surf = (x: number) => cy - Math.sqrt(R * R - (x - cx) ** 2);
  // Gentle bumps along the curve, and one ridge at x = 500 that sets the horizon.
  const terrain = (x: number) =>
    surf(x) - 5 * Math.sin(x / 19) ** 2 - 80 * Math.exp(-(((x - 500) / 30) ** 2)) - 18 * Math.exp(-(((x - 330) / 24) ** 2));
  let ground = `M0 ${H}`;
  let sphere = '';
  for (let x = 0; x <= W; x += 4) {
    ground += `L${x} ${terrain(x).toFixed(1)}`;
    sphere += `${x ? 'L' : 'M'}${x} ${surf(x).toFixed(1)}`;
  }
  ground += `L${W} ${H}Z`;
  const ox = 150;
  const foot = terrain(ox);
  const oy = foot - 18;
  const px = 500;
  const py = terrain(px);
  const slope = (oy - py) / (px - ox);
  const arcR = 120;
  const ang = Math.atan(slope);
  let sArc = '';
  for (let x = ox; x <= px; x += 4) sArc += `${x === ox ? 'M' : 'L'}${x} ${(surf(x) + 16).toFixed(1)}`;
  const f = (v: number) => v.toFixed(1);
  return `<svg class="diagram" viewBox="0 0 ${W} ${H}" role="img" aria-label="Side view: an observer on the curved surface looks along one compass direction. The steepest line of sight to any terrain sets the horizon angle H.">
    <path class="dg-ground" d="${ground}"/>
    <path class="dg-sphere" d="${sphere}"/>
    <path class="dg-dist" d="${sArc}"/>
    <line class="dg-level" x1="${ox}" y1="${f(oy)}" x2="${W - 4}" y2="${f(oy)}"/>
    <line class="dg-sight" x1="${ox}" y1="${f(oy)}" x2="${W - 4}" y2="${f(oy - (W - 4 - ox) * slope)}"/>
    <path class="dg-angle" d="M${ox + arcR} ${f(oy)} A${arcR} ${arcR} 0 0 0 ${f(ox + arcR * Math.cos(ang))} ${f(oy - arcR * Math.sin(ang))}"/>
    <line class="dg-mast" x1="${ox}" y1="${f(foot)}" x2="${ox}" y2="${f(oy)}"/>
    <circle class="dg-eye" cx="${ox}" cy="${f(oy)}" r="4"/>
    <circle class="dg-peak" cx="${px}" cy="${f(py)}" r="4"/>
    <text x="${ox}" y="${f(oy - 14)}" text-anchor="middle">observer</text>
    <text x="${ox - 8}" y="${f((foot + oy) / 2 + 4)}" text-anchor="end">m</text>
    <text class="dg-ink" x="${ox + arcR + 8}" y="${f(oy - 5)}">H(A)</text>
    <text x="${px - 12}" y="${f(py - 30)}" text-anchor="end">the terrain that sets the horizon</text>
    <text x="${W - 6}" y="${f(oy + 18)}" text-anchor="end">level at the site</text>
    <text x="${(ox + px) / 2}" y="${f(surf((ox + px) / 2) + 36)}" text-anchor="middle">s</text>
    <text x="14" y="${f(surf(14) + 22)}">reference sphere, R</text>
  </svg>`;
}

/** Fig. 3: a disc behind a straight skyline. Redrawn by the slider. */
export function discDiagram(x: number): string {
  const cx = 170;
  const cy = 110;
  const r = 70;
  const lineY = cy + x * r;
  const k = Math.max(-1, Math.min(1, x));
  const f = 1 - (Math.acos(k) - k * Math.sqrt(1 - k * k)) / Math.PI;
  return `<svg class="diagram disc" viewBox="0 0 520 220" role="img" aria-label="A disc of radius rho with the skyline ${x >= 0 ? 'below' : 'above'} its centre. ${Math.round(f * 100)}% of the disc shows.">
    <defs><clipPath id="dg-above"><rect x="0" y="0" width="520" height="${lineY.toFixed(1)}"/></clipPath></defs>
    <rect class="dg-ground" x="0" y="${lineY.toFixed(1)}" width="520" height="${(220 - lineY).toFixed(1)}"/>
    <circle class="dg-disc-out" cx="${cx}" cy="${cy}" r="${r}"/>
    <circle class="dg-disc" cx="${cx}" cy="${cy}" r="${r}" clip-path="url(#dg-above)"/>
    <line class="dg-skyline" x1="0" y1="${lineY.toFixed(1)}" x2="520" y2="${lineY.toFixed(1)}"/>
    <line class="dg-r" x1="${cx}" y1="${cy}" x2="${cx + r}" y2="${cy}"/>
    <circle class="dg-centre" cx="${cx}" cy="${cy}" r="3"/>
    ${Math.abs(lineY - cy) > 6 ? `<line class="dg-c${lineY > cy ? " on-sun" : ""}" x1="${cx - 22}" y1="${cy}" x2="${cx - 22}" y2="${lineY.toFixed(1)}"/><text x="${cx - 30}" y="${((cy + lineY) / 2 + 4).toFixed(1)}" text-anchor="end" class="${lineY > cy ? "dg-on-sun" : "dg-ink"}">c</text>` : ''}
    <text class="${lineY > cy + 4 ? 'dg-on-sun' : 'dg-ink'}" x="${cx + r / 2}" y="${cy - 8}" text-anchor="middle">ρ</text>
    <text class="dg-big" x="300" y="70">f = ${f.toFixed(2)}</text>
    <text x="300" y="96">x = c / ρ = ${x.toFixed(2)}</text>
    <text x="300" y="122">${f >= 0.999 ? 'Whole disc in view' : f > 0.5 ? 'Counts as in view' : f > 0.001 ? 'Counts as hidden' : 'Fully hidden'}</text>
  </svg>`;
}

// --- Live figures ------------------------------------------------------------

/**
 * Fig. 1: the real skyline around a site with the Sun's and Earth's paths over
 * the next lunar day. Paths are drawn under the ground, so where one dips
 * behind the terrain it disappears, just as the body would.
 */
export function drawSkyline(host: HTMLElement, horizon: Horizon, track: Series, now: SiteView): void {
  const w = host.clientWidth;
  if (w < 200) return;
  const h = Math.round(Math.min(260, Math.max(170, w * 0.28)));
  const padL = 36;
  const padB = 22;
  let lo = Infinity;
  let hi = -Infinity;
  for (const e of horizon.elevation) {
    lo = Math.min(lo, e);
    hi = Math.max(hi, e);
  }
  for (let i = 0; i < track.count; i++) {
    hi = Math.max(hi, track.sunEl[i], track.earthEl[i]);
    lo = Math.min(lo, Math.max(-6, Math.min(track.sunEl[i], track.earthEl[i])));
  }
  lo = Math.floor(lo - 0.5);
  hi = Math.ceil(hi + 0.8);
  const pw = w - padL - 4;
  const ph = h - padB - 6;
  const X = (az: number) => padL + (az / 360) * pw;
  const Y = (el: number) => 6 + ((hi - el) / (hi - lo)) * ph;
  const path = (az: Float32Array, el: Float32Array) => {
    let p = '';
    for (let i = 0; i < az.length; i++) {
      const jump = i > 0 && Math.abs(az[i] - az[i - 1]) > 180;
      p += `${i && !jump ? 'L' : 'M'}${X(az[i]).toFixed(1)} ${Y(el[i]).toFixed(1)}`;
    }
    return p;
  };
  const n = horizon.elevation.length;
  let sky = '';
  for (let i = 0; i <= n; i++) sky += `${i ? 'L' : 'M'}${X((i / n) * 360).toFixed(1)} ${Y(horizon.elevation[i % n]).toFixed(1)}`;
  const floor = 6 + ph;
  let grid = '';
  const step = hi - lo > 12 ? 5 : hi - lo > 5 ? 2 : 1;
  for (let e = Math.ceil(lo / step) * step; e <= hi; e += step) {
    grid += `<line class="sk-grid${e === 0 ? ' level' : ''}" x1="${padL}" x2="${padL + pw}" y1="${Y(e).toFixed(1)}" y2="${Y(e).toFixed(1)}"/>`;
    grid += `<text class="sk-axis" x="${padL - 6}" y="${Y(e).toFixed(1)}" dy="0.32em" text-anchor="end">${e}°</text>`;
  }
  const compass = ['N', 'E', 'S', 'W', 'N']
    .map((c, i) => `<text class="sk-axis" x="${X(i * 90).toFixed(1)}" y="${h - 5}" text-anchor="${i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}">${c}</text>`)
    .join('');
  const radius = (b: SiteView['sun']) => Math.max(4, (b.radius / (hi - lo)) * ph);
  const disc = (b: SiteView['sun'], cls: string) =>
    `<circle class="${cls}" cx="${X(b.az).toFixed(1)}" cy="${Y(b.el).toFixed(1)}" r="${radius(b).toFixed(1)}"/>`;
  // The label sits above whichever is higher, the body or the skyline hiding it.
  const tag = (b: SiteView['sun'], cls: string, name: string) => {
    const x = X(b.az);
    const ty = Math.min(Y(b.el) - radius(b), Y(b.horizon)) - 8;
    return `<text class="sk-tag ${cls}" x="${x.toFixed(1)}" y="${Math.max(16, ty).toFixed(1)}" text-anchor="${x > w - 60 ? 'end' : x < padL + 40 ? 'start' : 'middle'}">${name}${b.fraction === 0 ? ', hidden now' : ', now'}</text>`;
  };
  host.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="The skyline around the site from north round to north, with the paths of the Sun and Earth over the next 29.5 days.">
    <clipPath id="sk-clip"><rect x="${padL}" y="0" width="${pw}" height="${floor}"/></clipPath>
    ${grid}
    <g clip-path="url(#sk-clip)">
      <path class="sk-track sun" d="${path(track.sunAz, track.sunEl)}"/>
      <path class="sk-track earth" d="${path(track.earthAz, track.earthEl)}"/>
      ${disc(now.sun, 'sun')}
      ${disc(now.earth, 'earth')}
      <path class="sk-ground" d="${sky}L${padL + pw} ${floor + 2}L${padL} ${floor + 2}Z"/>
      <path class="sk-line" d="${sky}"/>
    </g>
    ${tag(now.sun, 'sun', 'Sun')}
    ${tag(now.earth, 'earth', 'Earth')}
    ${compass}
  </svg>`;
}

/** The comparison with Gläser et al., Table 2: one row per location, published ring against this tool's dot. */
export function drawComparison(host: HTMLElement): void {
  const w = host.clientWidth;
  if (w < 240) return;
  const labelW = Math.min(200, w * 0.36);
  const padR = 56;
  const rowH = 40;
  const top = 26;
  const lo = 70;
  const hi = 95;
  const X = (v: number) => labelW + ((v - lo) / (hi - lo)) * (w - labelW - padR);
  const h = top + GLASER_TABLE_2.length * rowH + 28;
  let ticks = '';
  for (let v = lo; v <= hi; v += 5) {
    ticks += `<line class="cp-grid" x1="${X(v).toFixed(1)}" x2="${X(v).toFixed(1)}" y1="${top - 8}" y2="${h - 24}"/>`;
    ticks += `<text class="cp-axis" x="${X(v).toFixed(1)}" y="${h - 8}" text-anchor="middle">${v}%</text>`;
  }
  const rows = GLASER_TABLE_2.map((c, i) => {
    const y = top + i * rowH + rowH / 2;
    const a = X(c.published.avg);
    const b = X(c.ours.avg);
    const diff = c.ours.avg - c.published.avg;
    return `<g class="cp-row">
      <text class="cp-label" x="0" y="${y}" dy="0.34em">${c.label}</text>
      <line class="cp-link" x1="${Math.min(a, b).toFixed(1)}" x2="${Math.max(a, b).toFixed(1)}" y1="${y}" y2="${y}"/>
      <circle class="cp-pub" cx="${a.toFixed(1)}" cy="${y}" r="6"><title>${c.label}: Gläser et al. ${f1(c.published.avg)}%</title></circle>
      <circle class="cp-ours" cx="${b.toFixed(1)}" cy="${y}" r="5"><title>${c.label}: this tool ${f1(c.ours.avg)}%</title></circle>
      <text class="cp-diff" x="${w - 4}" y="${y}" dy="0.34em" text-anchor="end">${diff > 0 ? '+' : diff < 0 ? '−' : ''}${f1(Math.abs(diff))}</text>
    </g>`;
  }).join('');
  host.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Average illumination at four locations: published values against this tool. Two agree within 2.5 points, two are 7 to 11 points lower here.">
    ${ticks}
    <text class="cp-axis" x="${w - 4}" y="${top - 12}" text-anchor="end">difference</text>
    ${rows}
  </svg>`;
}

// --- Page ----------------------------------------------------------------------

const cell = (v: number, unit = '') => `<td class="num">${unit === 'h' ? Math.round(v) : f1(v)}${unit === 'h' ? ' h' : '%'}</td>`;

const comparisonRows = GLASER_TABLE_2.map(
  (c) => `<tr>
    <th scope="row">${c.label}<span class="ll">${Math.abs(c.lat).toFixed(4)}° S, ${c.lon.toFixed(2)}° E</span></th>
    ${cell(c.published.avg)}${cell(c.ours.avg)}${cell(c.published.vis)}${cell(c.ours.vis)}${cell(c.published.shadowH, 'h')}${cell(c.ours.shadowH, 'h')}
  </tr>`,
).join('');

const SECTIONS: [string, string][] = [
  ['ab-top', 'Overview'],
  ['ab-how', 'How it works'],
  ['ab-checks', 'How it was checked'],
  ['ab-limits', 'Limits'],
  ['ab-sources', 'Sources'],
  ['ab-data', 'Your data'],
  ['ab-ai', 'Use of AI'],
];

const ref = (id: string) => `<a class="cite" href="#" data-goto="${id}">${id.toUpperCase().replace('-', '')}</a>`;

export const aboutHtml = `
<div class="about-page">
  <nav class="toc" aria-label="On this page">
    <p>On this page</p>
    <ul>${SECTIONS.map(([id, t]) => `<li><button type="button" data-goto="${id}">${t}</button></li>`).join('')}</ul>
  </nav>

  <div class="about-body">
    <header class="about-head" id="ab-top">
      <h1>Selene’s Compass</h1>
      <p class="sub">A lunar landing site navigator</p>
      <p class="lede">A lander near the Moon’s south pole needs two things from its sky. The Sun gives it power and warmth. Earth gives it a direct radio link home. At the pole both sit so close to the horizon that a ridge a few kilometres away decides whether you have them. Selene’s Compass works out where the Sun and Earth are against the real terrain, for any place and date, and how long each one lasts.</p>
      <p class="name-note">Selene is the Titan goddess of the Moon in Greek myth. A compass is for finding your way.</p>
    </header>

    <figure class="plate">
      <div class="sky-fig" id="about-skyline"><p class="fig-wait">Loading terrain…</p></div>
      <figcaption><b>Fig. 1</b> The whole skyline around LLS 01, a ridge between Shackleton and de Gerlache craters, traced from NASA elevation data and read from north round to north. The yellow line is the path the Sun takes over the next 29.5 days and the blue line is Earth’s. Where a path sinks behind the skyline, that body is hidden. Notice how the Sun never rises more than a degree or two.</figcaption>
    </figure>

    <section id="ab-how">
      <h2>How it works</h2>
      <p class="intro">Four steps turn a place and a time into an answer. Each gives the idea in plain words first, then the exact calculation the code runs.</p>

      <div class="step">
        <p class="step-no" aria-hidden="true">1</p>
        <div>
          <h3>Where are the Sun and Earth?</h3>
          <p>For the chosen moment, the tool finds where the Sun and Earth are relative to the Moon. It then turns each into a compass bearing and a height above level ground at the site, and works out how large each disc looks.</p>
          <div class="eq">${EQ.d}${EQ.az}${EQ.el}${EQ.rho}</div>
          <dl class="where">
            <dt>${inline(sub(bold('r'), mi('B')))}</dt><dd>The Sun or Earth, as seen from the Moon’s centre in the Moon’s own frame, from Astronomy Engine ${ref('s-6')}</dd>
            <dt>${inline(mi('R'))}</dt><dd>1737.4 km, the reference radius of the LOLA elevation data ${ref('s-1')}</dd>
            <dt>${inline(mi('z'))}</dt><dd>Height of the panels at the site above that sphere: ground plus mast</dd>
            <dt>${inline(vec('u'), mo(','), vec('n'), mo(','), vec('e'))}</dt><dd>Up, north and east at the site</dd>
            <dt>${inline(mi('A'), mo(','), mi('e'))}</dt><dd>Bearing clockwise from north, and height of the disc’s centre above level</dd>
            <dt>${inline(sub(mi('R'), mi('B')))}</dt><dd>695 700 km for the Sun ${ref('s-5')}, 6378.137 km for Earth ${ref('s-4')}</dd>
            <dt>${inline(mi('ρ'))}</dt><dd>The disc’s angular radius, about 0.27° for the Sun and 0.95° for Earth</dd>
          </dl>
        </div>
      </div>

      <div class="step">
        <p class="step-no" aria-hidden="true">2</p>
        <div>
          <h3>Where is the skyline?</h3>
          <p>From the site the tool looks out in 720 compass directions, one every half degree. Along each it walks outward over the curved Moon for up to 400 km, reading the ground height from NASA’s laser altimeter map. The steepest line of sight to any terrain is the horizon in that direction.</p>
          <figure class="fig-inline">
            <div class="diagram-wrap">${sightlineDiagram()}</div>
            <figcaption><b>Fig. 2</b> One compass direction seen side on. The Moon’s curve is exaggerated. Steps are 120 m apart near the site and widen to 0.5% of the distance beyond 24 km.</figcaption>
          </figure>
          <div class="eq">${EQ.theta}${EQ.radii}${EQ.eps}${EQ.H}</div>
          <dl class="where">
            <dt>${inline(mi('s'))}</dt><dd>Distance along the surface</dd>
            <dt>${inline(mi('z'), paren(mi('s')))}</dt><dd>Ground height there, from LOLA, blended between the four nearest grid cells ${ref('s-1')}</dd>
            <dt>${inline(sub(mi('z'), mn('0')), mo(','), mi('m'))}</dt><dd>Ground height at the site, and the height of the panels above it (2 m unless you change it)</dd>
            <dt>${inline(mi('H'), paren(mi('A')))}</dt><dd>Height of the skyline in direction ${inline(mi('A'))}. It is never lower than the edge of the smooth sphere, ${inline(mo('−'), fn('arccos'), paren(mi('R'), mo('/'), sub(mi('r'), mi('o'))))}</dd>
          </dl>
        </div>
      </div>

      <div class="step">
        <p class="step-no" aria-hidden="true">3</p>
        <div>
          <h3>How much of the disc shows?</h3>
          <p>The Sun and Earth are discs, not points, so a ridge can cover part of one. The tool compares the height of the disc’s centre with the skyline beneath it and works out the share of the disc that is above the line.</p>
          <figure class="fig-inline">
            <div class="diagram-wrap" id="disc-fig">${discDiagram(0.35)}</div>
            <label class="slider">Move the skyline <input type="range" id="disc-x" min="-1.2" max="1.2" step="0.01" value="0.35" /></label>
            <figcaption><b>Fig. 3</b> Drag to raise or lower the skyline across the disc. The shaded part is what the lander sees.</figcaption>
          </figure>
          <div class="eq">${EQ.c}${EQ.f}</div>
          <dl class="where">
            <dt>${inline(mi('c'))}</dt><dd>How far the disc’s centre is above the skyline</dd>
            <dt>${inline(mi('x'))}</dt><dd>That distance in disc radii, held between −1 and 1</dd>
            <dt>${inline(mi('f'))}</dt><dd>Share of the disc in view: 1 is the whole disc, 0.5 is half, 0 is none. The skyline is treated as straight across the width of one disc.</dd>
          </dl>
        </div>
      </div>

      <div class="step">
        <p class="step-no" aria-hidden="true">4</p>
        <div>
          <h3>Windows, power and batteries</h3>
          <p>Repeating steps 1 to 3 every 30 minutes gives the timelines. A body counts as in view while more than half of its disc shows. The countdowns under the site (“until it sets”) run until the last of the disc disappears, found in 30-minute steps and then narrowed to the minute.</p>
          <div class="eq">${EQ.view}${EQ.power}${EQ.battery}</div>
          <dl class="where">
            <dt>${inline(mi('S'))}</dt><dd>1361 W/m², the nominal sunlight at Earth’s average distance from the Sun ${ref('s-5')}. It is used as it stands, without correcting for the Moon’s changing distance from the Sun.</dd>
            <dt>${inline(sub(mi('A'), mi('p')), mo(','), mi('η'))}</dt><dd>Panel area and efficiency, from the lander settings on the Analyse tab. The panel is assumed to turn to face the Sun.</dd>
            <dt>${inline(sub(mi('T'), mi('short')))}</dt><dd>The longest unbroken stretch in the next 29.5 days when the panel makes less than the power needed, ${inline(sub(mi('P'), mi('need')))}</dd>
          </dl>
        </div>
      </div>
    </section>

    <section id="ab-checks">
      <h2>How it was checked</h2>
      <p class="intro">These checks run automatically with the project’s tests, so the figures below are recomputed every time the code changes.</p>

      <h3>Against JPL Horizons</h3>
      <p>NASA JPL’s Horizons system ${ref('s-4')} gave the Sun’s and Earth’s bearing, height and apparent size every 6 hours for 30 days from 14 March 2027, seen from 89.45° S, 222.69° E on the connecting ridge and from the Apollo 11 site. The largest difference from this tool was <b>${HORIZONS_WORST_DEG.sun}°</b> for the Sun and <b>${HORIZONS_WORST_DEG.earth}°</b> for Earth, about one hundredth of the Sun’s radius. The Horizons tables are saved with the code.</p>

      <h3>Against a published illumination study</h3>
      <p>Gläser et al. (2018) ${ref('s-7')} simulated sunlight at the south pole hourly from 1 January 2017 to 1 January 2037 on a 20 m elevation grid. Their Table 2 lists the best-lit spots 2 m above the ground. This tool was run at exactly the same coordinates, height and period on its own 240 m grid.</p>
      <figure class="fig-inline">
        <ul class="cp-key" aria-label="Key">
          <li><i class="cp-key-pub"></i>Gläser et al. (2018), Table 2</li>
          <li><i class="cp-key-ours"></i>This tool</li>
        </ul>
        <div class="cp-host" id="about-compare"></div>
        <figcaption><b>Fig. 4</b> Average illumination, the mean share of the Sun’s disc in view, over the twenty years. The right-hand column is this tool minus the published value, in percentage points.</figcaption>
      </figure>
      <div class="cmp-scroll">
        <table class="ab-table">
          <thead>
            <tr><th scope="col" rowspan="2">Location</th><th scope="colgroup" colspan="2">Average illumination</th><th scope="colgroup" colspan="2">Any part of the Sun in view</th><th scope="colgroup" colspan="2">Longest time in shadow</th></tr>
            <tr><th scope="col" class="num">Published</th><th scope="col" class="num">This tool</th><th scope="col" class="num">Published</th><th scope="col" class="num">This tool</th><th scope="col" class="num">Published</th><th scope="col" class="num">This tool</th></tr>
          </thead>
          <tbody>${comparisonRows}</tbody>
        </table>
      </div>
      <p>Two of the four locations agree within 2.5 points and to the hour on the longest shadow. The other two come out 7 to 11 points lower here. Gläser et al. explain why a coarse grid struggles at these spots. They write that the best-lit locations “form rather thin and elongated structures up to several kilometers along the rims and ridges, whose width however, only reaches twenty to forty meters”. On a 240 m grid a point that sits on such a crest can land on the slope beside it, where nearby ground blocks the low Sun.</p>
      <p>That is why the crest sites in this tool’s catalogue sit on the highest cell of its own grid. LLS 01 is that cell near Connecting Ridge C1, about 180 m from the published point. Run the same way, it gives <b>${f1(CREST_LLS01.ours.avg)}%</b> average illumination, the Sun at least partly in view <b>${f1(CREST_LLS01.ours.vis)}%</b> of the time, and a longest shadow of <b>${CREST_LLS01.ours.shadowH} h</b>, against 88.0%, 92.1% and 112 h published for C1.</p>

      <h3>Sense checks</h3>
      <ul class="plain">
        <li>The floor of Shackleton crater comes out with no Sun and no Earth for the whole of 2027, as a permanently shadowed crater should.</li>
        <li>The way Earth is turned in the sky view is checked by standing on Earth at the point the code says is under the Moon and confirming the Moon is overhead there, within 1°, on four dates.</li>
      </ul>
    </section>

    <section id="ab-limits">
      <h2>Limits</h2>
      <ul class="plain">
        <li>Terrain is sampled every 240 m. Boulders, small craters and the lander’s own tilt are missing, and as the comparison above shows, a site a hundred metres off a crest can behave very differently from the crest itself.</li>
        <li>Real terrain covers 80°S to the pole. Elsewhere the horizon is a smooth sphere. That is fair where the Sun and Earth ride high, but not inside craters or valleys.</li>
        <li>Sites between 80°S and about 81.5°S sit near the edge of the terrain grid, so hills further north are missing from their skyline.</li>
        <li>The power estimate leaves out dust, heat, panel ageing and the Moon’s changing distance from the Sun.</li>
        <li>In the sky view, the skyline and the positions and sizes of the Sun and Earth are computed. Earth shows the face and phase it would really show, without clouds. The brightness of the ground and the small craters and grain underfoot are illustrative, drawn to follow the Sun’s direction. They are not real features or real shadows. The shading on the south-pole map is illustrative too.</li>
        <li>The globe keeps a little light on the Moon’s night side so sites can still be picked there.</li>
      </ul>
    </section>

    <section id="ab-sources">
      <h2>Sources</h2>
      <p class="intro">Every source the tool or this page relies on, what was taken from it, and whether it was read in full while writing this page. Where a source was not read directly, the page says so and only repeats what another, read source states about it.</p>
      <ol class="refs">
        <li id="s-1"><span class="ref-no">S1</span><div>
          <p class="cite-line"><b>NASA Lunar Reconnaissance Orbiter, Lunar Orbiter Laser Altimeter (LOLA). South-pole elevation grid LDEM_80S_80M</b>, product version 2.0, created 15 June 2017 by the LRO LOLA team, NASA Goddard Space Flight Center. Data set LRO-L-LOLA-4-GDR-V1.0, PDS Geosciences Node. <a href="https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/" target="_blank" rel="noopener">pds-geosciences.wustl.edu</a></p>
          <p><span class="tag">Used for</span> The skyline and the south-pole map. Heights from 80°S to the pole on an 80 m grid in polar stereographic projection, relative to a 1737.4 km sphere, stored in half-metre steps. This tool averages them in 3 by 3 blocks to 240 m.</p>
          <p><span class="tag">Checked against</span> The product’s own label file, read in full.</p>
        </div></li>
        <li id="s-2"><span class="ref-no">S2</span><div>
          <p class="cite-line"><b>CGI Moon Kit</b>, NASA’s Scientific Visualization Studio, visualizer Ernie Wright (STC). Item 4720. <a href="https://svs.gsfc.nasa.gov/4720/" target="_blank" rel="noopener">svs.gsfc.nasa.gov/4720</a></p>
          <p><span class="tag">Used for</span> The globe. The colour map lroc_color_poles_4k.tif, which the page describes as adapted from the Lunar Reconnaissance Orbiter Camera’s Hapke Normalized WAC Mosaic, and the elevation map ldem_16_uint.tif from LOLA, used for surface relief.</p>
          <p><span class="tag">Checked against</span> The item’s web page and credit line, read in full.</p>
        </div></li>
        <li id="s-3"><span class="ref-no">S3</span><div>
          <p class="cite-line"><b>Blue Marble: A Seamless Image Mosaic of the Earth</b>, NASA/Goddard Space Flight Center Scientific Visualization Studio. The Blue Marble Next Generation data is courtesy of Reto Stockli (NASA/GSFC) and NASA’s Earth Observatory. Item 2915. <a href="https://svs.gsfc.nasa.gov/2915/" target="_blank" rel="noopener">svs.gsfc.nasa.gov/2915</a></p>
          <p><span class="tag">Used for</span> Earth’s face in the sky view, from bluemarble-2048.png, a cloud-free mosaic.</p>
          <p><span class="tag">Checked against</span> The item’s web page and credit line, read in full.</p>
        </div></li>
        <li id="s-4"><span class="ref-no">S4</span><div>
          <p class="cite-line"><b>JPL Horizons</b>, NASA Jet Propulsion Laboratory, Solar System Dynamics, queried through its API on 14 November 2026. <a href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noopener">ssd.jpl.nasa.gov/horizons</a></p>
          <p><span class="tag">Used for</span> Checking the tool, not running it. Four observer tables of azimuth, elevation and angular diameter from 14 March to 13 April 2027 every 360 minutes. The table headers record the DE441 ephemeris, no atmospheric refraction, the Moon’s Mean Earth/polar axis frame with a 1737.4 km radius, and Earth’s equatorial radius of 6378.137 km, the value this tool uses.</p>
          <p><span class="tag">Checked against</span> The saved tables, read in full. They ship in the code’s test folder.</p>
        </div></li>
        <li id="s-5"><span class="ref-no">S5</span><div>
          <p class="cite-line"><b>IAU 2015 Resolution B3 on recommended nominal conversion constants for selected solar and planetary properties</b>, International Astronomical Union, XXIXth General Assembly. arXiv:1510.07674. <a href="https://arxiv.org/abs/1510.07674" target="_blank" rel="noopener">arxiv.org/abs/1510.07674</a></p>
          <p><span class="tag">Used for</span> The Sun’s radius, 6.957 × 10⁸ m, and the nominal total solar irradiance, 1361 W/m². Its note 4 also gives the astronomical unit as 149 597 870 700 m exactly, which this tool uses to convert distances.</p>
          <p><span class="tag">Checked against</span> The resolution text, read in full.</p>
        </div></li>
        <li id="s-6"><span class="ref-no">S6</span><div>
          <p class="cite-line"><b>Astronomy Engine</b>, version 2.1.19, by Don Cross. MIT licence. <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noopener">github.com/cosinekitty/astronomy</a></p>
          <p><span class="tag">Used for</span> Where the Sun and Earth are, and which way the Moon and Earth are turned. Its code computes Earth’s orbit with the VSOP87 series, its documentation says its Moon position follows Montenbruck and Pfleger’s <i>Astronomy on the Personal Computer</i>, and its Moon orientation follows the IAU Working Group on Cartographic Coordinates and Rotational Elements, citing Table 2 of the 2009 report.</p>
          <p><span class="tag">Checked against</span> The library’s own code and documentation, read directly. The book and the IAU report it cites were not read for this page. The results are checked against JPL Horizons instead ${ref('s-4')}.</p>
        </div></li>
        <li id="s-7"><span class="ref-no">S7</span><div>
          <p class="cite-line">Gläser, P., Oberst, J., Neumann, G. A., Mazarico, E., Speyerer, E. J. and Robinson, M. S. (2018). <b>Illumination conditions at the lunar poles: Implications for future exploration.</b> <i>Planetary and Space Science</i> 162, 170–178. <a href="https://doi.org/10.1016/j.pss.2017.07.006" target="_blank" rel="noopener">doi:10.1016/j.pss.2017.07.006</a></p>
          <p><span class="tag">Used for</span> The comparison in Fig. 4: Tables 1 and 2, their definitions of average illumination and solar visibility, and the quoted width of the best-lit crests.</p>
          <p><span class="tag">Checked against</span> The accepted manuscript, read in full from NASA’s Technical Reports Server, record <a href="https://ntrs.nasa.gov/citations/20170007365" target="_blank" rel="noopener">20170007365</a>.</p>
        </div></li>
        <li id="s-8"><span class="ref-no">S8</span><div>
          <p class="cite-line">Mazarico, E., Neumann, G. A., Smith, D. E., Zuber, M. T. and Torrence, M. H. (2011). <b>Illumination conditions of the lunar polar regions using LOLA topography.</b> <i>Icarus</i> 211, 1066–1081. <a href="https://doi.org/10.1016/j.icarus.2010.10.030" target="_blank" rel="noopener">doi:10.1016/j.icarus.2010.10.030</a></p>
          <p><span class="tag">Used for</span> LLS 01 and LLS 02 are placed near this study’s Connecting Ridge (89.45° S, 222.69° E) and Shackleton (89.78° S, 204.27° E) points, as Gläser et al. list them in their Table 1. Gläser et al. also credit this study with the horizon-map method and note that it used a 240 m grid.</p>
          <p><span class="tag">Checked against</span> <b>Not read directly.</b> Everything here comes from Gläser et al. ${ref('s-7')}.</p>
        </div></li>
        <li id="s-9"><span class="ref-no">S9</span><div>
          <p class="cite-line"><b>three.js</b>, version 0.187, by the three.js authors, MIT licence, for 3D drawing. <b>Public Sans</b> and <b>Marcellus SC</b> typefaces, SIL Open Font Licence 1.1, packaged by Fontsource 5.3.</p>
          <p><span class="tag">Checked against</span> The licence fields of the installed packages.</p>
        </div></li>
      </ol>
      <p>Mission sites in the catalogue are placed at their reported landing coordinates. The other crest sites are the highest cell of the 240 m grid within a few kilometres of the point named in each site’s details. The “LLS” numbers are this tool’s own catalogue and are not official designations.</p>
    </section>

    <section id="ab-data">
      <h2>Your data</h2>
      <p class="intro">Selene’s Compass has no server and no accounts. Every calculation runs in your browser, and the site itself is a set of static files.</p>
      <ul class="plain">
        <li>Sites you save under My sites, the filters you set on Compare and the sections you leave open are kept in this browser’s local storage, on this device only. Nothing is sent anywhere.</li>
        <li>Clearing this site’s data in your browser settings removes them. A private window starts empty and forgets them when it closes.</li>
        <li>A shared link carries places and dates but not names. A site you saved opens for someone else as a custom site at the same coordinates.</li>
      </ul>
    </section>

    <section id="ab-ai">
      <h2>Use of AI</h2>
      <p>The code for this site was written with AI assistance (Claude, by Anthropic), directed by the author. No AI-generated images, audio or video are used. The Moon and Earth imagery and the terrain are NASA data, the grain on the ground in the sky view is drawn by ordinary code, and every figure on screen is calculated in your browser.</p>
      <p class="fine">Built for the 2026 NASA Space Apps Challenge, “Lunar Landing Site Navigator”. This is an independent project and is not endorsed by NASA.</p>
    </section>
  </div>
</div>`;

/** Wires the page's own controls: the contents list, citation links and the Fig. 3 slider. */
export function wireAbout(root: HTMLElement): void {
  root.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-goto]');
    if (!t) return;
    e.preventDefault();
    const target = document.getElementById(t.dataset.goto!);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  });
  const slider = root.querySelector<HTMLInputElement>('#disc-x');
  slider?.addEventListener('input', () => {
    root.querySelector('#disc-fig')!.innerHTML = discDiagram(Number(slider.value));
  });
}

