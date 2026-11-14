import '@fontsource/public-sans/400.css';
import '@fontsource/public-sans/600.css';
import '@fontsource/public-sans/700.css';
import '@fontsource/marcellus-sc/400.css';
import './styles.css';

import { moonState } from './astro/frame';
import { SOUTH_POLE_GRID, computeHorizon, loadDem, type Dem, type Horizon } from './astro/horizon';
import {
  DAY_MS,
  HOUR_MS,
  LUNAR_DAY_MS,
  lunarDayOf,
  nextChange,
  sampleSeries,
  summarise,
  viewAt,
  type BodyView,
  type Series,
  type SiteView,
} from './astro/windows';
import { coords, dateTimeUTC, dateUTC, degrees, duration, hours, isoDate, isoTime, metres, percent } from './format';
import { methodHtml } from './method';
import { SITES, catalogueNo, customSite, siteKey, type Site } from './sites';
import { createGlobe, type GlobeApi } from './views/globe';
import { lanesHeight, lanesMarkup, type LaneKind } from './views/lanes';
import { createPolarMap, type MapApi } from './views/polarmap';
import { createRidge, type RidgeRow } from './views/ridge';
import { createSky, type SkyApi } from './views/skyview';
import { createStrip } from './views/strip';

type Tab = 'choose' | 'analyse' | 'compare' | 'method';
type Flag = 'time' | 'site' | 'tab' | 'view' | 'body' | 'rig' | 'compare' | 'dem';

interface Scenario {
  site: Site;
  timeMs: number;
}

const TEN_MIN = 600_000;
const SOLAR_CONSTANT = 1361; // W/m² at the Moon's distance from the Sun

const state = {
  timeMs: Math.round(Date.now() / TEN_MIN) * TEN_MIN,
  site: SITES[0],
  tab: 'choose' as Tab,
  view: 'globe' as 'globe' | 'map',
  body: 'sun' as 'sun' | 'earth',
  mastM: 2,
  areaM2: 4,
  efficiency: 28,
  needW: 300,
  spanDays: 14,
  compare: [] as Scenario[],
};

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const app = $('app');

// ---------------------------------------------------------------------------
// Terrain and horizons

let dem: Dem | null = null;
let demError = false;
const horizons = new Map<string, Horizon>();

function horizonFor(site: Site): Horizon {
  const key = `${siteKey(site)}|${state.mastM}|${dem ? 1 : 0}`;
  let h = horizons.get(key);
  if (!h) {
    if (horizons.size > 200) horizons.clear();
    h = computeHorizon(dem, site, state.mastM);
    horizons.set(key, h);
  }
  return h;
}

/** True when the site sits inside the south-pole terrain grid. */
const inGrid = (site: Site) => site.lat < -80.05;

loadDem(`${import.meta.env.BASE_URL}data/spole-dem-240m.bin`, SOUTH_POLE_GRID.size, SOUTH_POLE_GRID.metresPerPixel)
  .then((d) => {
    dem = d;
    invalidate('dem');
  })
  .catch(() => {
    demError = true;
    invalidate('dem');
  });

// ---------------------------------------------------------------------------
// Update scheduling: collect what changed, redraw once per frame.

const pending = new Set<Flag>();
function invalidate(...flags: Flag[]) {
  const first = pending.size === 0;
  flags.forEach((f) => pending.add(f));
  if (first) requestAnimationFrame(flush);
}

function set(patch: Partial<typeof state>, ...flags: Flag[]) {
  Object.assign(state, patch);
  invalidate(...flags);
}

function allSites(): Site[] {
  return state.site.no === 0 ? [...SITES, state.site] : SITES;
}

// ---------------------------------------------------------------------------
// Views

let globe: GlobeApi | null = null;
let map: MapApi | null = null;
let sky: SkyApi | null = null;

const pick = (lat: number, lon: number) => set({ site: customSite(lat, lon) }, 'site');
const select = (site: Site) => set({ site }, 'site');

globe = createGlobe($('globe'), { onPick: pick, onSelect: select });
if (!globe) {
  $('globe').innerHTML = '<p class="fallback">This browser could not start 3D graphics. The Map view still works.</p>';
  state.view = 'map';
}

const strip = createStrip($('strip'), (az) => sky?.look(az));
const ridge = createRidge($('ridge'), $('ridge-readout'), (timeMs) => setTime(timeMs));

function setTime(ms: number) {
  set({ timeMs: Math.round(ms / TEN_MIN) * TEN_MIN }, 'time');
}

// ---------------------------------------------------------------------------
// Derived data, recomputed in flush()

let horizon: Horizon;
let view: SiteView;
let series: Series;
let ridgeKey = '';
let ridgeRows: RidgeRow[] = [];

function computeRidge() {
  const day = lunarDayOf(state.timeMs);
  const key = `${siteKey(state.site)}|${state.mastM}|${dem ? 1 : 0}|${state.body}|${day.index}`;
  if (key === ridgeKey) return;
  ridgeKey = key;
  const step = 3 * HOUR_MS;
  ridgeRows = [];
  for (let i = -6; i <= 6; i++) {
    const startMs = day.startMs + i * LUNAR_DAY_MS;
    const s = sampleSeries(state.site, horizon, startMs, startMs + LUNAR_DAY_MS, step);
    // sampleSeries snaps to the step grid; report where the samples really start.
    ridgeRows.push({ startMs: s.startMs, stepMs: step, top: state.body === 'sun' ? s.sunTop : s.earthTop });
  }
}

// ---------------------------------------------------------------------------
// Rendering

function renderBar() {
  $<HTMLInputElement>('date').value = isoDate(state.timeMs);
  $<HTMLInputElement>('time').value = isoTime(state.timeMs);
  document.querySelectorAll<HTMLButtonElement>('.tabs button').forEach((b) => {
    if (b.dataset.tab === state.tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  $('cmp-count').textContent = state.compare.length ? `(${state.compare.length})` : '';
  app.dataset.tab = state.tab;
  app.dataset.view = state.view;
}

const fillClass = (f: number) => (f >= 0.999 ? 'full' : f > 0.001 ? 'part' : 'none');
const fillWord = (f: number) => (f >= 0.999 ? 'in view' : f > 0.001 ? 'partly hidden' : 'out of view');

function renderList() {
  const row = (site: Site) => {
    const v = viewAt(site, horizonFor(site), state.timeMs);
    const both = Math.min(v.sun.fraction, v.earth.fraction);
    const on = siteKey(site) === siteKey(state.site);
    return `<li><button type="button" class="site${on ? ' on' : ''}" data-key="${siteKey(site)}"${on ? ' aria-current="true"' : ''}
      title="Sun ${fillWord(v.sun.fraction)}, Earth ${fillWord(v.earth.fraction)}">
      <span class="no">${catalogueNo(site)}</span><span class="nm">${site.name}</span>
      <span class="code" aria-hidden="true"><i class="sun ${fillClass(v.sun.fraction)}"></i><i class="earth ${fillClass(v.earth.fraction)}"></i><i class="both ${fillClass(both)}"></i></span>
      <span class="vh">Sun ${fillWord(v.sun.fraction)}, Earth ${fillWord(v.earth.fraction)}</span>
    </button></li>`;
  };
  const pole = allSites().filter((s) => s.group === 'pole' || (s.group === 'custom' && inGrid(s)));
  const rest = allSites().filter((s) => s.group === 'elsewhere' || (s.group === 'custom' && !inGrid(s)));
  $('list-pole').innerHTML = pole.map(row).join('');
  $('list-else').innerHTML = rest.map(row).join('');
}

function renderHead() {
  const s = state.site;
  $('s-no').textContent = catalogueNo(s);
  $('s-name').textContent = s.name;
  const elev =
    horizon.source === 'terrain' ? `, ground ${metres(horizon.groundM)}` : '';
  $('s-ll').textContent = `${coords(s)}${elev}`;
  let note = s.note;
  if (horizon.source === 'sphere') {
    note += inGrid(s)
      ? demError
        ? ' Terrain data could not be loaded, so a smooth horizon is used.'
        : ' Loading terrain…'
      : ' Outside the south-pole terrain grid, so the horizon is a smooth sphere.';
  } else if (s.lat > -81.5) {
    note += ' Close to the edge of the terrain grid: hills further north are not included.';
  }
  $('s-note').textContent = note;
  // The coordinate fields always show the site on screen, so they can be nudged and re-entered.
  if (coordKey !== siteKey(s)) {
    coordKey = siteKey(s);
    $<HTMLInputElement>('lat').value = String(+s.lat.toFixed(4));
    $<HTMLInputElement>('lon').value = String(+s.lon.toFixed(4));
    $('goto-err').hidden = true;
  }
}
let coordKey = '';

/** The three status blocks under the catalogue number: Sun, Earth, both, at the chosen time. */
function renderHeadCode() {
  const both = Math.min(view.sun.fraction, view.earth.fraction);
  const el = $('s-code');
  el.innerHTML = `<i class="sun ${fillClass(view.sun.fraction)}"></i><i class="earth ${fillClass(view.earth.fraction)}"></i><i class="both ${fillClass(both)}"></i>`;
  el.title = `Sun ${fillWord(view.sun.fraction)}, Earth ${fillWord(view.earth.fraction)}`;
}

function bodyFig(name: string, b: BodyView, change: { visibleNow: boolean; atMs: number | null }): string {
  const top = b.clearance + b.radius;
  const wait = change.atMs === null ? 'Over 60 d' : duration(change.atMs - state.timeMs);
  const never = change.atMs === null;
  return change.visibleNow
    ? `<div class="fig ${name.toLowerCase()}"><dt>${name} in view</dt><dd><strong>${wait}</strong><em>${never ? 'it does not set in that time' : 'until it sets'}; ${b.fraction < 0.999 ? 'partly hidden now' : `top edge ${degrees(top)} above terrain`}</em></dd></div>`
    : `<div class="fig ${name.toLowerCase()} off"><dt>${name} hidden</dt><dd><strong>${wait}</strong><em>${never ? 'it does not rise in that time' : 'until it rises'}; ${degrees(-top)} below terrain now</em></dd></div>`;
}

function renderFigs() {
  const sun = nextChange(state.site, horizon, 'sun', state.timeMs);
  const earth = nextChange(state.site, horizon, 'earth', state.timeMs);
  const sum = summarise(series);
  $('figs').innerHTML =
    bodyFig('Sun', view.sun, sun) +
    bodyFig('Earth', view.earth, earth) +
    `<div class="fig both"><dt>Both in view</dt><dd><strong>${percent(sum.both)}</strong><em>of the 29.5 days after ${dateUTC(state.timeMs, false)}</em></dd></div>`;
}

function renderRidge() {
  computeRidge();
  const name = state.body === 'sun' ? 'Sun' : 'Earth';
  $('ridge-hint').textContent = `One line per lunar day (29.5 Earth days). Height is how far the ${name}’s top edge stands above the terrain; flat means hidden.`;
  ridge.render({
    rows: ridgeRows,
    current: 6,
    timeMs: state.timeMs,
    body: state.body,
    drawKey: `${siteKey(state.site)}|${state.body}|${dem ? 1 : 0}`,
  });
  document.querySelectorAll<HTMLButtonElement>('[data-body]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.body === state.body)));
}

const LANE_KINDS: LaneKind[] = ['sun', 'earth', 'both'];
const LANE_NAMES: Record<LaneKind, string> = { sun: 'Sun', earth: 'Earth', both: 'Both' };

function renderLanes() {
  const host = $('lanes');
  const width = host.clientWidth - 48;
  if (width < 60) return;
  const o = { width, lane: 18, gap: 12, kinds: LANE_KINDS, markGaps: true };
  const h = lanesHeight(o);
  const end = series.startMs + (series.count - 1) * series.stepMs;
  let axis = '';
  for (let d = 0; d <= 28; d += 7) {
    const x = ((state.timeMs + d * DAY_MS - series.startMs) / (end - series.startMs)) * width;
    axis += `<text class="lane-axis" x="${x.toFixed(1)}" y="${h + 16}" text-anchor="${d === 0 ? 'start' : d === 28 ? 'end' : 'middle'}">${dateUTC(state.timeMs + d * DAY_MS, false)}</text>`;
  }
  const names = LANE_KINDS.map((k, i) => `<text class="lane-name" x="-8" y="${i * (o.lane + o.gap) + o.lane / 2}" dy="0.34em" text-anchor="end">${LANE_NAMES[k]}</text>`).join('');
  host.innerHTML = `<svg class="lanes" width="${width + 48}" height="${h + 22}" viewBox="-48 0 ${width + 48} ${h + 22}" role="img"
    aria-label="When the Sun, Earth and both are in view over the 29.5 days after ${dateTimeUTC(state.timeMs)}">${names}${lanesMarkup(series, o)}${axis}</svg>`;
}

function renderGaps() {
  const sum = summarise(series);
  $('gaps').innerHTML = `
    <div><dt>Sun in view</dt><dd>${percent(sum.sun)}</dd></div>
    <div><dt>Earth in view</dt><dd>${percent(sum.earth)}</dd></div>
    <div class="wide"><dt><span class="gap-key"></span>Longest stretch without Sun</dt><dd>${stretch(sum.longestDarkH)}</dd></div>
    <div class="wide"><dt><span class="gap-key"></span>Longest stretch without Earth</dt><dd>${stretch(sum.longestNoLinkH)}</dd></div>
    <div class="wide"><dt>Longest stretch with both</dt><dd>${stretch(sum.longestBothH)}</dd></div>`;
}

// Non-breaking spaces keep a figure and its unit on one line.
const watts = (w: number) => `${Math.round(w).toLocaleString('en-US').replace(/,/g, ' ')} W`;

/** A stretch of hours as text, or "None" when there is no such stretch. */
const stretch = (h: number) => (h === 0 ? 'None' : hours(h));

function renderPower() {
  const peak = SOLAR_CONSTANT * state.areaM2 * (state.efficiency / 100);
  const now = peak * view.sun.fraction;
  const el = $('power');
  if (peak < state.needW) {
    el.textContent = `Even in full Sun this panel makes ${watts(peak)}, less than the ${watts(state.needW)} you need. Try a larger panel.`;
    return;
  }
  let met = 0;
  let run = 0;
  let worst = 0;
  for (let i = 0; i < series.count; i++) {
    if (peak * series.sunFraction[i] >= state.needW) {
      met++;
      run = 0;
    } else {
      run++;
      if (run > worst) worst = run;
    }
  }
  const worstH = (worst * series.stepMs) / HOUR_MS;
  const share = met / series.count;
  const nowText = now > 0 ? `${watts(now)} right now` : 'nothing right now, because the Sun is hidden';
  const battery =
    worstH > 0
      ? ` The longest shortfall lasts ${hours(worstH)}; riding through it at ${watts(state.needW)} takes about ${((state.needW * worstH) / 1000).toFixed(1)} kWh of stored energy.`
      : ' There is no shortfall in this period.';
  el.textContent = `Facing the Sun, this panel makes up to ${watts(peak)}: ${nowText}. It covers your ${watts(state.needW)} for ${percent(share)} of the next 29.5 days.${battery}`;
}

function renderSky() {
  if (!sky) return;
  sky.setScene(horizon, view, series);
  strip.render({ horizon, view, track: series, lookAz: sky.az, fovDeg: sky.hfov });
  $('strip-src').textContent =
    horizon.source === 'terrain' ? 'terrain from LOLA, 240 m grid' : 'smooth sphere, no terrain data here';
}

function renderStage() {
  const st = moonState(state.timeMs);
  globe?.setBodies(st.sun, st.earth);
  map?.setBodies(st.sun, st.earth);
}

function renderStageSites() {
  globe?.setSites(allSites(), state.site);
  map?.setSites(allSites(), state.site);
}

function renderStageView() {
  $('globe').hidden = state.view !== 'globe';
  $('map').hidden = state.view !== 'map';
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
  if (state.view === 'map' && !map) {
    map = createPolarMap($('map'), { onPick: pick, onSelect: select });
    renderStage();
    renderStageSites();
  }
  globe?.setActive(state.tab === 'choose' && state.view === 'globe');
  map?.setActive(state.tab === 'choose' && state.view === 'map');
  $('stage-cap').textContent =
    state.view === 'globe'
      ? 'Imagery from NASA’s Lunar Reconnaissance Orbiter, lit from the Sun’s real direction at the chosen time. Yellow line: toward the Sun. Blue line: toward Earth. Click the Moon to drop a pin.'
      : 'Shaded relief from NASA LOLA elevation data, 80°S to the pole. The shading is fixed and does not show real shadows. Click the map to drop a pin.';
}

// --- Compare -----------------------------------------------------------------

function scenarioSeries(sc: Scenario): Series {
  const span = state.spanDays * DAY_MS;
  const step = Math.max(30 * 60_000, Math.round(span / 700 / (30 * 60_000)) * 30 * 60_000);
  return sampleSeries(sc.site, horizonFor(sc.site), sc.timeMs, sc.timeMs + span, step);
}

function renderCompare() {
  const body = $('cmp-body');
  if (!state.compare.length) {
    body.innerHTML = `<p class="empty">Nothing pinned yet. Choose a site and a date, then use <b>Add to compare</b>. Pin the same site on two dates to see what a schedule slip costs, or two sites on one date to pick between them.</p>`;
    return;
  }
  const rows = state.compare.map((sc, i) => {
    const s = scenarioSeries(sc);
    const sum = summarise(s);
    return { sc, s, sum, i };
  });
  const best = Math.max(...rows.map((r) => r.sum.both));
  body.innerHTML = `<table class="cmp">
    <thead><tr>
      <th scope="col">Site</th><th scope="col">Landing (UTC)</th>
      <th scope="col" class="lanes-col">Days after landing<span class="cmp-axis" id="cmp-axis"></span></th>
      <th scope="col" class="num">Sun</th><th scope="col" class="num">Earth</th><th scope="col" class="num">Both</th>
      <th scope="col" class="num"><span class="gap-key"></span>Longest without Sun</th><th scope="col" class="num"><span class="gap-key"></span>Longest without Earth</th><th scope="col"><span class="vh">Remove</span></th>
    </tr></thead>
    <tbody>${rows
      .map(
        ({ sc, sum, i }) => `<tr>
        <th scope="row"><button type="button" class="cmp-open" data-open="${i}"><span class="no">${catalogueNo(sc.site)}</span>${sc.site.name}<span class="ll">${coords(sc.site)}</span></button></th>
        <td>${dateTimeUTC(sc.timeMs).replace(' UTC', '')}</td>
        <td class="lanes-col"><div class="cmp-lanes" data-row="${i}"></div></td>
        <td class="num">${percent(sum.sun)}</td><td class="num">${percent(sum.earth)}</td>
        <td class="num${sum.both === best && rows.length > 1 ? ' best' : ''}">${percent(sum.both)}${sum.both === best && rows.length > 1 ? '<span class="tag">most</span>' : ''}</td>
        <td class="num">${stretch(sum.longestDarkH)}</td><td class="num">${stretch(sum.longestNoLinkH)}</td>
        <td><button type="button" class="cmp-x" data-remove="${i}" aria-label="Remove ${catalogueNo(sc.site)} on ${dateUTC(sc.timeMs)}">Remove</button></td>
      </tr>`,
      )
      .join('')}</tbody></table>`;

  // Lanes are drawn at their real pixel width so the hatching stays crisp.
  const cell = body.querySelector<HTMLElement>('.cmp-lanes');
  const width = Math.max(120, cell ? cell.clientWidth : 300);
  const o = { width, lane: 13, gap: 8, kinds: LANE_KINDS, markGaps: true };
  const h = lanesHeight(o);
  rows.forEach(({ sc, s, i }) => {
    const host = body.querySelector<HTMLElement>(`.cmp-lanes[data-row="${i}"]`)!;
    host.innerHTML = `<svg width="${width}" height="${h}" viewBox="0 0 ${width} ${h}" role="img" aria-label="Sun, Earth and both in view over ${state.spanDays} days from ${dateUTC(sc.timeMs)}">${lanesMarkup(s, { ...o, fromMs: sc.timeMs, toMs: sc.timeMs + state.spanDays * DAY_MS })}</svg>`;
  });
  const ticks = state.spanDays <= 14 ? [0, 0.25, 0.5, 0.75, 1] : [0, 0.5, 1];
  $('cmp-axis').innerHTML = ticks.map((t) => `<i style="left:${t * 100}%">${Math.round(t * state.spanDays)}</i>`).join('');
}

// --- Flush -------------------------------------------------------------------

let lastSiteKey = '';
let statusText = '';

/** Point the sky view at whichever body is in view, the Sun first. */
function faceBody(which?: 'sun' | 'earth') {
  const b = which ? view[which] : view.sun.fraction > 0 || view.earth.fraction === 0 ? view.sun : view.earth;
  // Frame both the body and the skyline beneath it: tight at the pole, wide where the body rides high.
  const top = Math.max(b.el + b.radius, b.horizon);
  const bottom = Math.min(b.el - b.radius, b.horizon);
  sky?.look(b.az, (top + bottom) / 2, Math.max(7, Math.min(60, (top - bottom + 3) * 1.7)));
}

function flush() {
  const f = new Set(pending);
  pending.clear();
  const has = (...flags: Flag[]) => flags.some((x) => f.has(x));

  horizon = horizonFor(state.site);
  view = viewAt(state.site, horizon, state.timeMs);
  if (has('time', 'site', 'rig', 'dem') || !series) {
    series = sampleSeries(state.site, horizon, state.timeMs, state.timeMs + LUNAR_DAY_MS, 30 * 60_000);
  }

  renderBar();
  if (has('tab', 'view')) renderStageView();
  if (has('time', 'site', 'dem', 'rig')) renderList();
  if (has('site', 'dem', 'rig')) renderHead();
  if (has('time', 'site', 'dem', 'rig')) {
    renderFigs();
    renderHeadCode();
  }
  if (has('time')) renderStage();
  if (has('site')) {
    renderStageSites();
    if (siteKey(state.site) !== lastSiteKey) {
      lastSiteKey = siteKey(state.site);
      globe?.flyTo(state.site);
      map?.centreOn(state.site);
    }
  }

  if (state.tab === 'choose' && has('time', 'site', 'dem', 'rig', 'body', 'tab')) renderRidge();
  if (state.tab === 'analyse') {
    if (!sky) {
      sky = createSky($('sky'), (az, fov) => strip.setLook(az, fov));
      if (!sky) $('sky').innerHTML = '<p class="fallback">This browser could not start 3D graphics. The horizon strip below shows the same sky.</p>';
    }
    sky?.setActive(true);
    if (has('time', 'site', 'dem', 'rig', 'tab')) {
      renderSky();
      renderLanes();
      renderGaps();
      renderPower();
    }
    if (has('tab', 'site') && sky) {
      faceBody();
    } else if (has('dem') && sky) {
      // Terrain arriving changes what is in view; re-aim once.
      faceBody();
    }
  } else {
    sky?.setActive(false);
  }
  if (state.tab === 'compare' && has('compare', 'tab', 'dem', 'rig')) renderCompare();
  if (has('time', 'site', 'tab', 'compare', 'view')) writeHash();
  $('go').textContent = state.tab === 'analyse' ? 'Back to the Moon' : 'Analyse this site';
  $('status').textContent = statusText;
  statusText = '';
}

// --- URL ---------------------------------------------------------------------

function findSite(lat: number, lon: number): Site {
  return SITES.find((s) => Math.abs(s.lat - lat) < 1e-3 && Math.abs(s.lon - lon) < 1e-3) ?? customSite(lat, lon);
}

let hashTimer = 0;
function writeHash() {
  clearTimeout(hashTimer);
  hashTimer = window.setTimeout(() => {
    const p = new URLSearchParams();
    p.set('site', `${state.site.lat.toFixed(4)},${state.site.lon.toFixed(4)}`);
    p.set('t', new Date(state.timeMs).toISOString().slice(0, 16));
    if (state.tab !== 'choose') p.set('tab', state.tab);
    if (state.view !== 'globe') p.set('view', state.view);
    if (state.compare.length) {
      p.set('cmp', state.compare.map((c) => `${c.site.lat.toFixed(4)},${c.site.lon.toFixed(4)},${Math.round(c.timeMs / 60_000)}`).join(';'));
    }
    history.replaceState(null, '', `#${p.toString().replace(/%2C/g, ',').replace(/%3A/g, ':').replace(/%3B/g, ';')}`);
  }, 300);
}

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const site = p.get('site')?.split(',').map(Number);
  if (site && site.length === 2 && site.every(Number.isFinite) && Math.abs(site[0]) <= 90) state.site = findSite(site[0], site[1]);
  const t = Date.parse(`${p.get('t')}:00Z`);
  if (Number.isFinite(t)) state.timeMs = Math.round(t / TEN_MIN) * TEN_MIN;
  const tab = p.get('tab');
  if (tab === 'analyse' || tab === 'compare' || tab === 'method') state.tab = tab;
  if (p.get('view') === 'map') state.view = 'map';
  const cmp = p.get('cmp');
  if (cmp) {
    state.compare = cmp
      .split(';')
      .map((c) => c.split(',').map(Number))
      .filter((c) => c.length === 3 && c.every(Number.isFinite))
      .slice(0, 12)
      .map(([lat, lon, min]) => ({ site: findSite(lat, lon), timeMs: min * 60_000 }));
  }
}

// --- Events ------------------------------------------------------------------

document.querySelector('.tabs')!.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-tab]');
  if (b) set({ tab: b.dataset.tab as Tab }, 'tab');
});

document.querySelector('.stage .seg')!.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-view]');
  if (b) set({ view: b.dataset.view as 'globe' | 'map' }, 'view');
});

document.querySelector('.pane .seg')!.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-body]');
  if (b) set({ body: b.dataset.body as 'sun' | 'earth' }, 'body');
});

const whenForm = $<HTMLFormElement>('when');
function readWhen() {
  const t = Date.parse(`${$<HTMLInputElement>('date').value}T${$<HTMLInputElement>('time').value || '00:00'}:00Z`);
  if (Number.isFinite(t)) setTime(t);
}
whenForm.addEventListener('change', readWhen);
whenForm.addEventListener('submit', (e) => {
  e.preventDefault();
  readWhen();
});
whenForm.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-shift]');
  if (b) setTime(state.timeMs + Number(b.dataset.shift) * DAY_MS);
});
$('now').addEventListener('click', () => setTime(Date.now()));

document.querySelector('.sites')!.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.site');
  if (!b) return;
  const site = allSites().find((s) => siteKey(s) === b.dataset.key);
  if (site) select(site);
});

$<HTMLFormElement>('goto').addEventListener('submit', (e) => {
  e.preventDefault();
  const err = $('goto-err');
  const parse = (raw: string, pos: string, neg: string) => {
    const m = /^\s*([+-−]?\d+(?:[.,]\d+)?)\s*°?\s*([a-z])?\s*$/i.exec(raw);
    if (!m) return NaN;
    let v = Number(m[1].replace('−', '-').replace(',', '.'));
    const letter = m[2]?.toUpperCase();
    if (letter === neg) v = -Math.abs(v);
    else if (letter && letter !== pos) return NaN;
    return v;
  };
  const lat = parse($<HTMLInputElement>('lat').value, 'N', 'S');
  const lon = parse($<HTMLInputElement>('lon').value, 'E', 'W');
  if (!Number.isFinite(lat) || Math.abs(lat) > 90) {
    err.textContent = 'Latitude must be a number from -90 to 90 (south is negative, or add S).';
    err.hidden = false;
    $('lat').focus();
    return;
  }
  if (!Number.isFinite(lon) || Math.abs(lon) > 360) {
    err.textContent = 'Longitude must be a number from -180 to 360, measured east.';
    err.hidden = false;
    $('lon').focus();
    return;
  }
  err.hidden = true;
  pick(lat, lon);
});

$('go').addEventListener('click', () => set({ tab: state.tab === 'analyse' ? 'choose' : 'analyse' }, 'tab'));

function addScenario() {
  const dup = state.compare.some((c) => siteKey(c.site) === siteKey(state.site) && c.timeMs === state.timeMs);
  if (dup) statusText = 'That site and date are already in Compare. Change the date or the site to add another.';
  else if (state.compare.length >= 12) statusText = 'Compare holds 12 scenarios. Remove one first.';
  else {
    state.compare = [...state.compare, { site: state.site, timeMs: state.timeMs }];
    statusText = `Added ${catalogueNo(state.site)} on ${dateUTC(state.timeMs)} to Compare.`;
  }
  invalidate('compare');
}
$('add').addEventListener('click', addScenario);
$('cmp-add').addEventListener('click', addScenario);

$('cmp-body').addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const open = t.closest<HTMLButtonElement>('[data-open]');
  const remove = t.closest<HTMLButtonElement>('[data-remove]');
  if (open) {
    const sc = state.compare[Number(open.dataset.open)];
    set({ site: sc.site, timeMs: sc.timeMs, tab: 'analyse' }, 'site', 'time', 'tab');
  } else if (remove) {
    state.compare = state.compare.filter((_, i) => i !== Number(remove.dataset.remove));
    invalidate('compare');
  }
});

$<HTMLSelectElement>('span').addEventListener('change', (e) => set({ spanDays: Number((e.target as HTMLSelectElement).value) }, 'compare'));

$<HTMLFormElement>('rig').addEventListener('input', () => {
  const num = (id: string, lo: number, hi: number, fallback: number) => {
    const v = Number($<HTMLInputElement>(id).value);
    return Number.isFinite(v) && v >= lo && v <= hi ? v : fallback;
  };
  set(
    {
      mastM: num('mast', 0, 200, state.mastM),
      areaM2: num('area', 0.1, 500, state.areaM2),
      efficiency: num('eff', 1, 50, state.efficiency),
      needW: num('need', 1, 100_000, state.needW),
    },
    'rig',
  );
});
$<HTMLFormElement>('rig').addEventListener('submit', (e) => e.preventDefault());

$('face-sun').addEventListener('click', () => faceBody('sun'));
$('face-earth').addEventListener('click', () => faceBody('earth'));
$('sky-in').addEventListener('click', () => sky?.zoom(0.7));
$('sky-out').addEventListener('click', () => sky?.zoom(1.43));

// Redraw pixel-sized charts when their column changes width (not on every reflow).
function onWidth(el: HTMLElement, fn: () => void) {
  let last = 0;
  new ResizeObserver(() => {
    if (Math.abs(el.clientWidth - last) < 2) return;
    last = el.clientWidth;
    fn();
  }).observe(el);
}
onWidth($('lanes'), () => {
  if (state.tab === 'analyse' && series) renderLanes();
});
onWidth($('cmp-body'), () => {
  if (state.tab === 'compare' && series) renderCompare();
});

$('lanes').addEventListener('click', (e) => {
  const r = $('lanes').getBoundingClientRect();
  const f = (e.clientX - r.left - 48) / (r.width - 48);
  if (f >= 0 && f <= 1) setTime(series.startMs + f * (series.count - 1) * series.stepMs);
});

window.addEventListener('hashchange', () => {
  readHash();
  invalidate('site', 'time', 'tab', 'view', 'compare');
});

// --- Start -------------------------------------------------------------------

$('method').innerHTML = methodHtml;
$<HTMLSelectElement>('span').value = String(state.spanDays);
readHash();
lastSiteKey = siteKey(state.site);
globe?.flyTo(state.site, false);
invalidate('site', 'time', 'tab', 'view', 'compare', 'body', 'rig');
