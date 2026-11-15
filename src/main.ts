import '@fontsource/public-sans/400.css';
import '@fontsource/public-sans/600.css';
import '@fontsource/public-sans/700.css';
import '@fontsource/marcellus-sc/400.css';
import './styles.css';

import { earthAxesAtSite, moonState } from './astro/frame';
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
import { coords, dateTimeUTC, dateUTC, degrees, duration, esc, hours, isoDate, isoTime, metres, percent } from './format';
import {
  NO_FILTERS,
  activeCount,
  loadFilters,
  siteMatches,
  sorter,
  storeFilters,
  summaryMatches,
  hasTerrain,
  type Filters,
} from './compare-filter';
import { MAX_MY_SITES, cleanName, loadMySites, makeMySite, nextNumber, storageKey, storeMySites } from './mysites';
import { aboutHtml, drawComparison, drawSkyline, wireAbout } from './about';
import { SITES, catalogueNo, customSite, siteKey, siteTitle, type Site } from './sites';
import { createGlobe, type GlobeApi } from './views/globe';
import { lanesHeight, lanesMarkup, type LaneKind } from './views/lanes';
import { createPolarMap, type MapApi } from './views/polarmap';
import { createRidge, type RidgeRow } from './views/ridge';
import { createSky, type SkyApi } from './views/skyview';
import { createStrip } from './views/strip';

type Tab = 'choose' | 'analyse' | 'compare' | 'about';
type Flag = 'time' | 'site' | 'tab' | 'view' | 'body' | 'rig' | 'compare' | 'dem' | 'play' | 'mine' | 'filter';

interface Scenario {
  site: Site;
  timeMs: number;
}

const TEN_MIN = 600_000;
const MAX_SCENARIOS = 24;
const SOLAR_CONSTANT = 1361; // W/m² at the Moon's distance from the Sun

const nowMs = () => Math.round(Date.now() / TEN_MIN) * TEN_MIN;

/** True while the date follows the clock; false once the visitor (or a link) picks a date. */
let followNow = true;

const state = {
  timeMs: nowMs(),
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
const inGrid = (site: Site) => hasTerrain(site);

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

/** Sites this visitor saved. They live in this browser's storage only (see mysites.ts). */
let mySites: Site[] = loadMySites();

/** Compare filters, remembered per browser. */
let filters: Filters = loadFilters();

function allSites(): Site[] {
  return state.site.group === 'custom' ? [...SITES, ...mySites, state.site] : [...SITES, ...mySites];
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

function setTime(ms: number, follow = false) {
  setPlaying(false);
  followNow = follow;
  set({ timeMs: Math.round(ms / TEN_MIN) * TEN_MIN }, 'time');
}

// While following the clock, step forward with it.
setInterval(() => {
  if (followNow && nowMs() !== state.timeMs) setTime(Date.now(), true);
}, 30_000);

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
  $('now').setAttribute('aria-pressed', String(followNow));
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
      <span class="no">${site.group === 'custom' ? '' : catalogueNo(site)}</span><span class="nm">${esc(site.name)}</span>
      <span class="code" aria-hidden="true"><i class="sun ${fillClass(v.sun.fraction)}"></i><i class="earth ${fillClass(v.earth.fraction)}"></i><i class="both ${fillClass(both)}"></i></span>
      <span class="vh">Sun ${fillWord(v.sun.fraction)}, Earth ${fillWord(v.earth.fraction)}</span>
    </button></li>`;
  };
  const mine = mySites;
  const pole = allSites().filter((s) => s.group === 'pole' || (s.group === 'custom' && inGrid(s)));
  const rest = allSites().filter((s) => s.group === 'elsewhere' || (s.group === 'custom' && !inGrid(s)));
  $('list-mine').innerHTML = mine.map(row).join('');
  $('mine-block').hidden = !mine.length;
  $('list-pole').innerHTML = pole.map(row).join('');
  $('list-else').innerHTML = rest.map(row).join('');
  $('h-pole').hidden = $('list-pole').hidden = !pole.length;
  $('h-else').hidden = $('list-else').hidden = !rest.length;
}

/** Save, rename and remove, under the site name. */
function renderMineTools() {
  const s = state.site;
  $('rename').hidden = true;
  $('s-name').hidden = false;
  const el = $('mine-tools');
  el.hidden = false;
  el.innerHTML =
    s.group === 'custom'
      ? '<button type="button" data-mine="save">Save to My sites</button><span>Kept in this browser only.</span>'
      : s.group === 'mine'
        ? '<button type="button" data-mine="rename">Rename</button><button type="button" data-mine="remove">Remove from My sites</button>'
        : '';
}

function renderHead() {
  const s = state.site;
  $('s-no').textContent = catalogueNo(s);
  $('s-no').classList.toggle('custom', s.group === 'custom');
  // A custom site has no name of its own, so its coordinates stand in for one.
  $('s-name').textContent = s.group === 'custom' ? coords(s) : s.name;
  const elev =
    horizon.source === 'terrain' ? `, ground ${metres(horizon.groundM)}` : '';
  $('s-ll').textContent = `${coords(s)}${elev}`;
  // The line under the name says what the place is, and carries anything that is
  // going wrong. Where the numbers come from sits behind "Site details".
  let note = s.note;
  let detail = s.detail ?? '';
  if (horizon.source === 'sphere') {
    if (!inGrid(s)) detail += ' Outside the south-pole terrain grid, so the horizon is a smooth sphere.';
    else note += demError ? ' Terrain data could not be loaded, so a smooth horizon is used.' : ' Loading terrain…';
  } else if (s.lat > -81.5) {
    detail += ' Close to the edge of the terrain grid: hills further north are not included.';
  }
  $('s-note').textContent = note;
  $('s-detail').textContent = detail.trim();
  $('s-detail').hidden = !detail;
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

/** What each body being in view, or hidden, means for the lander. */
const MEANS = {
  Sun: { has: 'of sunlight', lacks: 'of darkness' },
  Earth: { has: 'of direct radio link', lacks: 'without a radio link' },
};

function bodyFig(name: 'Sun' | 'Earth', change: { visibleNow: boolean; atMs: number | null }, b: BodyView): string {
  const wait = change.atMs === null ? 'Over 60 d' : duration(change.atMs - state.timeMs);
  const never = change.atMs === null;
  // Elevation of the disc centre above the level, and of the skyline beneath it. The gap between them is what
  // decides power and radio, and the elevation alone sets how steeply sunlight strikes a flat panel.
  const angle = `<span class="fig-el" title="Elevation of the ${name}’s centre above the level horizon, and of the terrain skyline in the same direction"><span><b>${degrees(b.el)}</b> elevation</span> <span>skyline ${degrees(b.horizon)}</span></span>`;
  return change.visibleNow
    ? `<div class="fig ${name.toLowerCase()}"><dt>${name} in view</dt><dd><strong>${wait}</strong><em>${MEANS[name].has}${never ? ', and it does not set in that time' : ' until it sets'}</em>${angle}</dd></div>`
    : `<div class="fig ${name.toLowerCase()} off"><dt>${name} hidden</dt><dd><strong>${wait}</strong><em>${MEANS[name].lacks}${never ? ', and it does not rise in that time' : ' until it rises'}</em>${angle}</dd></div>`;
}

/** Where a body sits against the terrain at the chosen time, for "Site details". */
function geometry(name: string, b: BodyView): string {
  const top = b.clearance + b.radius;
  if (b.fraction <= 0.001) return `${name}: hidden, top edge ${degrees(-top)} below the terrain.`;
  return `${name}: ${b.fraction < 0.999 ? 'partly hidden' : 'whole disc in view'}, top edge ${degrees(top)} above the terrain.`;
}

function renderFigs() {
  const sun = nextChange(state.site, horizon, 'sun', state.timeMs);
  const earth = nextChange(state.site, horizon, 'earth', state.timeMs);
  const sum = summarise(series);
  $('figs').innerHTML =
    bodyFig('Sun', sun, view.sun) +
    bodyFig('Earth', earth, view.earth) +
    `<div class="fig both"><dt>Both in view</dt><dd><strong>${percent(sum.both)}</strong><em>of the 29.5 days after ${dateUTC(state.timeMs, false)}</em></dd></div>`;
  $('s-geom').textContent = `${geometry('Sun', view.sun)} ${geometry('Earth', view.earth)}`;
}

function renderRidge() {
  computeRidge();
  const name = state.body === 'sun' ? 'Sun' : 'Earth';
  $('ridge-hint').textContent = `One line per lunar day (29.5 Earth days). Height is how far the ${name}’s top edge stands above the terrain. A flat line means it is hidden.`;
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
  const brief = $('power-brief');
  if (peak < state.needW) {
    el.textContent = `Even in full Sun this panel makes ${watts(peak)}, less than the ${watts(state.needW)} you need. Try a larger panel.`;
    brief.textContent = 'panel too small';
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
  brief.textContent = `${watts(state.needW)} covered ${percent(share)} of the time`;
}

function renderSky() {
  $('sky-when').textContent = dateTimeUTC(state.timeMs);
  if (!sky) return;
  sky.setScene(horizon, view, series, earthAxesAtSite(state.timeMs, state.site));
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

// --- Site picker (Compare) -------------------------------------------------------
// A different job from choosing: several sites at once, each toggled in or out
// of the comparison at the landing date in the top bar.

const atLanding = (site: Site) => state.compare.findIndex((c) => siteKey(c.site) === siteKey(site) && c.timeMs === state.timeMs);

function pickerSites(): [string, Site[]][] {
  const shown = allSites().filter((s) => siteMatches(s, filters));
  return (
    [
      ['My sites', shown.filter((s) => s.group === 'mine')],
      ['South pole, real terrain', shown.filter((s) => s.group === 'pole')],
      ['Elsewhere, smooth horizon', shown.filter((s) => s.group === 'elsewhere')],
      ['Unsaved pin', shown.filter((s) => s.group === 'custom')],
    ] as [string, Site[]][]
  ).filter(([, list]) => list.length);
}

function renderPicker() {
  $('picker-when').textContent = `Landing ${dateTimeUTC(state.timeMs)}. Change the date in the top bar.`;
  const groups = pickerSites();
  const tile = (site: Site) => {
    const v = viewAt(site, horizonFor(site), state.timeMs);
    const both = Math.min(v.sun.fraction, v.earth.fraction);
    const on = atLanding(site) >= 0;
    const others = state.compare.filter((c) => siteKey(c.site) === siteKey(site) && c.timeMs !== state.timeMs).length;
    return `<li><button type="button" class="pick" data-key="${siteKey(site)}" aria-pressed="${on}" title="${esc(site.name)}">
      <span class="pick-no">${site.group === 'custom' ? 'Pin' : catalogueNo(site)}</span>
      <svg class="pick-tick" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5l2.6 2.6L10 3" /></svg>
      <span class="pick-nm">${esc(site.name)}</span>
      <span class="pick-ll">${coords(site)}${others ? ` · also on ${others} other date${others > 1 ? 's' : ''}` : ''}</span>
      <span class="code" aria-hidden="true"><i class="sun ${fillClass(v.sun.fraction)}"></i><i class="earth ${fillClass(v.earth.fraction)}"></i><i class="both ${fillClass(both)}"></i></span>
      <span class="vh">${on ? 'In the comparison' : 'Not in the comparison'}. Sun ${fillWord(v.sun.fraction)}, Earth ${fillWord(v.earth.fraction)}.</span>
    </button></li>`;
  };
  // Redrawing replaces the tiles, so keep keyboard focus on the one that had it.
  const focused = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('#picker .pick')?.dataset.key;
  $('picker').innerHTML = groups.length
    ? groups.map(([title, list]) => `<h3>${title}</h3><ul class="pick-grid">${list.map(tile).join('')}</ul>`).join('')
    : '<p class="empty">No sites match the filters.</p>';
  if (focused) $('picker').querySelector<HTMLElement>(`.pick[data-key="${focused}"]`)?.focus({ preventScroll: true });
  const shown = groups.flatMap(([, l]) => l);
  ($('pick-all') as HTMLButtonElement).disabled = shown.every((s) => atLanding(s) >= 0);
  ($('pick-none') as HTMLButtonElement).disabled = !shown.some((s) => atLanding(s) >= 0);
}

function togglePick(site: Site) {
  const i = atLanding(site);
  if (i >= 0) {
    state.compare = state.compare.filter((_, j) => j !== i);
    statusText = `Removed ${site.group === 'custom' ? 'the pin' : catalogueNo(site)} from the comparison.`;
    invalidate('compare');
  } else addScenario(site);
}

$('picker').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.pick');
  const site = b && allSites().find((s) => siteKey(s) === b.dataset.key);
  if (site) togglePick(site);
});
$('pick-all').addEventListener('click', () => {
  const add = pickerSites()
    .flatMap(([, l]) => l)
    .filter((s) => atLanding(s) < 0);
  const room = MAX_SCENARIOS - state.compare.length;
  add.slice(0, room).forEach((_, k) => fresh.add(state.compare.length + k));
  state.compare = [...state.compare, ...add.slice(0, room).map((site) => ({ site, timeMs: state.timeMs }))];
  statusText =
    add.length > room ? `Added ${room}. Compare holds ${MAX_SCENARIOS} scenarios, so ${add.length - room} were left out.` : `Added ${add.length} sites.`;
  invalidate('compare');
});
$('pick-none').addEventListener('click', () => {
  const keys = new Set(pickerSites().flatMap(([, l]) => l.map(siteKey)));
  const before = state.compare.length;
  state.compare = state.compare.filter((c) => !(keys.has(siteKey(c.site)) && c.timeMs === state.timeMs));
  statusText = `Removed ${before - state.compare.length} from the comparison.`;
  invalidate('compare');
});

/** "Showing 3 of 7", the Clear button, and how many of the extra filters are on. */
function renderFilterCount(shown: number, total: number) {
  const n = activeCount(filters);
  $('f-count').textContent = total && n ? `Showing ${shown} of ${total} scenarios.` : '';
  $('f-clear').hidden = !n;
  const extra = (['minSun', 'minEarth', 'minBoth', 'maxDarkH', 'maxNoLinkH', 'latFrom', 'latTo', 'lonFrom', 'lonTo'] as const).filter((k) => filters[k] !== null).length;
  $('f-more-count').textContent = extra ? `${extra} on` : '';
}

/** Scenarios added since the table was last drawn, by index in state.compare. */
const fresh = new Set<number>();
/** Wide screens show the table beside the sites, so a new row can be scrolled to without losing the list. */
const sideBySide = matchMedia('(min-width: 1180px)');

function renderCompare() {
  const body = $('cmp-body');
  const added = new Set(fresh);
  fresh.clear();
  if (!state.compare.length) {
    renderFilterCount(0, 0);
    body.innerHTML = `<p class="empty">Nothing to compare yet. Tick sites in the <b>Sites</b> list, or use <b>Add to compare</b> on the Choose site and Analyse tabs.</p>`;
    return;
  }
  const all = state.compare.map((sc, i) => {
    const s = scenarioSeries(sc);
    const sum = summarise(s);
    return { sc, s, sum, i };
  });
  const spanH = state.spanDays * 24;
  const rows = all.filter((r) => siteMatches(r.sc.site, filters) && summaryMatches(r.sum, filters)).sort(sorter(filters.sort, spanH));
  renderFilterCount(rows.length, all.length);
  if (!rows.length) {
    body.innerHTML = `<p class="empty">None of the ${all.length} scenarios match these filters. Loosen them, or use <b>Clear filters</b> above to see them all.</p>`;
    return;
  }
  const best = Math.max(...rows.map((r) => r.sum.both));
  // The column the table is sorted by is marked, so the order can be read at a glance.
  const col = { added: '', sun: 'sun', sunH: 'sun', earth: 'earth', earthH: 'earth', both: 'both', dark: 'dark', nolink: 'nolink' }[filters.sort];
  const mark = (c: string, dir = 'descending') => (c === col ? ` sorted" aria-sort="${dir}` : '');
  const hrs = (share: number) => `<span class="sub">${Math.round(share * spanH)} h</span>`;
  body.innerHTML = `<table class="cmp">
    <thead><tr>
      <th scope="col">Site</th><th scope="col">Landing (UTC)</th>
      <th scope="col" class="lanes-col">Days after landing<span class="cmp-axis" id="cmp-axis"></span></th>
      <th scope="col" class="num${mark('sun')}"><button type="button" class="th-sort" data-sort="sun">Sun</button></th><th scope="col" class="num${mark('earth')}"><button type="button" class="th-sort" data-sort="earth">Earth</button></th><th scope="col" class="num${mark('both')}"><button type="button" class="th-sort" data-sort="both">Both</button></th>
      <th scope="col" class="num${mark('dark', 'ascending')}"><button type="button" class="th-sort" data-sort="dark"><span class="gap-key"></span>Longest without Sun</button></th><th scope="col" class="num${mark('nolink', 'ascending')}"><button type="button" class="th-sort" data-sort="nolink"><span class="gap-key"></span>Longest without Earth</button></th><th scope="col"><span class="vh">Remove</span></th>
    </tr></thead>
    <tbody>${rows
      .map(
        ({ sc, sum, i }) => `<tr${added.has(i) ? ' class="fresh"' : ''}>
        <th scope="row"><button type="button" class="cmp-open" data-open="${i}"><span class="no">${sc.site.group === 'custom' ? '' : catalogueNo(sc.site)}</span>${esc(sc.site.name)}<span class="ll">${coords(sc.site)}</span></button></th>
        <td class="when-cell">${dateTimeUTC(sc.timeMs).replace(' UTC', '').replace(', ', '<span class="sub">')}</span></td>
        <td class="lanes-col"><div class="cmp-lanes" data-row="${i}"></div></td>
        <td class="num${col === 'sun' ? ' sorted' : ''}">${percent(sum.sun)}${hrs(sum.sun)}</td><td class="num${col === 'earth' ? ' sorted' : ''}">${percent(sum.earth)}${hrs(sum.earth)}</td>
        <td class="num${sum.both === best && rows.length > 1 ? ' best' : ''}${col === 'both' ? ' sorted' : ''}">${percent(sum.both)}${sum.both === best && rows.length > 1 ? '<span class="tag">most</span>' : hrs(sum.both)}</td>
        <td class="num${col === 'dark' ? ' sorted' : ''}">${stretch(sum.longestDarkH)}</td><td class="num${col === 'nolink' ? ' sorted' : ''}">${stretch(sum.longestNoLinkH)}</td>
        <td><button type="button" class="cmp-x" data-remove="${i}" aria-label="Remove ${esc(siteTitle(sc.site))} on ${dateUTC(sc.timeMs)}">Remove</button></td>
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

  // Bring a just-added row into view. On a phone the table sits above the list, so leave the scroll alone there.
  const first = body.querySelector('tr.fresh');
  if (first && sideBySide.matches) first.scrollIntoView({ block: 'nearest' });
}

// --- About -------------------------------------------------------------------

/** The About page's live figures: LLS 01's real skyline, and the comparison chart. */
function renderAbout() {
  drawComparison($('about-compare'));
  if (!dem) {
    if (demError) $('about-skyline').innerHTML = '<p class="fig-wait">Terrain data could not be loaded, so this figure is unavailable.</p>';
    return;
  }
  const site = SITES[0];
  const h = computeHorizon(dem, site, 2);
  const start = Math.round(Date.now() / HOUR_MS) * HOUR_MS;
  const track = sampleSeries(site, h, start, start + LUNAR_DAY_MS, HOUR_MS);
  drawSkyline($('about-skyline'), h, track, viewAt(site, h, start));
}

// --- Flush -------------------------------------------------------------------

let lastSiteKey = '';
let statusText = '';

/** Point the sky view at whichever body is in view, the Sun first. */
function faceBody(which?: 'sun' | 'earth') {
  facing = which ?? (view.sun.fraction > 0 || view.earth.fraction === 0 ? 'sun' : 'earth');
  const b = view[facing];
  // Frame both the body and the skyline beneath it: tight at the pole, wide where the body rides high.
  const top = Math.max(b.el + b.radius, b.horizon);
  const bottom = Math.min(b.el - b.radius, b.horizon);
  sky?.look(b.az, (top + bottom) / 2, Math.max(7, Math.min(60, (top - bottom + 3) * 1.7)));
  sky?.hold(b.el);
  following = true;
  followRef = Math.max(b.el, b.horizon);
}

// --- Play --------------------------------------------------------------------
// Runs the clock forward so the Sun and Earth can be watched moving along the
// skyline. The sky is redrawn every frame; the heavier panels catch up a few
// times a second.

const PLAY_HOURS_PER_SECOND = 12;
let playing = false;
let playMs = 0;
let playLast = 0;
let playFull = 0;
let facing: 'sun' | 'earth' = 'sun';
/** True while the view keeps the chosen body in frame; dragging the sky lets go. */
let following = true;
/** Height of whatever the view was last aimed at: the body, or the skyline hiding it. */
let followRef = 0;

/** Keep the body being watched where it was in the frame as it moves. */
function followBody() {
  if (!sky || !following) return;
  const b = view[facing];
  const ref = Math.max(b.el, b.horizon);
  sky.look(b.az, sky.pitch + ref - followRef);
  sky.hold(b.el);
  followRef = ref;
}

function setPlaying(on: boolean) {
  if (on === playing) return;
  playing = on;
  const b = $('play');
  b.setAttribute('aria-pressed', String(on));
  b.querySelector('span')!.textContent = on ? 'Pause' : 'Play';
  if (on) {
    followNow = false;
    playMs = state.timeMs;
    playLast = performance.now();
    faceBody(facing);
    requestAnimationFrame(playFrame);
  } else {
    invalidate('time');
  }
}

function playFrame(now: number) {
  if (!playing) return;
  playMs += Math.min(now - playLast, 100) * PLAY_HOURS_PER_SECOND * 3600;
  playLast = now;
  state.timeMs = Math.round(playMs / TEN_MIN) * TEN_MIN;
  if (now - playFull > 400) {
    playFull = now;
    invalidate('time');
  } else {
    invalidate('play');
  }
  requestAnimationFrame(playFrame);
}

function flush() {
  const f = new Set(pending);
  pending.clear();
  const has = (...flags: Flag[]) => flags.some((x) => f.has(x));

  horizon = horizonFor(state.site);
  view = viewAt(state.site, horizon, state.timeMs);

  // A frame of Play on its own: move the clock, the status blocks and the sky, nothing else.
  if (f.size === 1 && f.has('play') && state.tab === 'analyse') {
    renderBar();
    renderHeadCode();
    $('sky-when').textContent = dateTimeUTC(state.timeMs);
    sky?.setBodies(view, earthAxesAtSite(state.timeMs, state.site));
    followBody();
    return;
  }
  if (state.tab !== 'analyse') setPlaying(false);
  if (has('time', 'site', 'rig', 'dem') || !series) {
    series = sampleSeries(state.site, horizon, state.timeMs, state.timeMs + LUNAR_DAY_MS, 30 * 60_000);
  }

  renderBar();
  if (has('tab', 'view')) renderStageView();
  if (has('time', 'site', 'dem', 'rig', 'mine')) renderList();
  if (has('site', 'dem', 'rig', 'mine')) renderHead();
  if (has('site', 'mine')) renderMineTools();
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
      sky = createSky($('sky'), `${import.meta.env.BASE_URL}data/earth-1k.jpg`, (az, fov) => strip.setLook(az, fov));
      sky?.setGuides($('paths').getAttribute('aria-pressed') === 'true');
      if (!sky) $('sky').innerHTML = '<p class="fallback">This browser could not start 3D graphics. The horizon strip below shows the same sky.</p>';
    }
    sky?.setActive(true);
    if (has('time', 'site', 'dem', 'rig', 'tab')) {
      renderSky();
      renderLanes();
      renderGaps();
      renderPower();
    }
    if (has('tab', 'site', 'dem') && sky) {
      // A new site, or terrain arriving, changes what is in view: aim again.
      faceBody();
    } else if (playing) {
      followBody();
    }
  } else {
    sky?.setActive(false);
  }
  if (has('mine')) renderStageSites();
  if (state.tab === 'compare' && has('compare', 'tab', 'dem', 'rig', 'filter', 'mine', 'time', 'site')) renderPicker();
  if (state.tab === 'compare' && has('compare', 'tab', 'dem', 'rig', 'filter', 'mine')) renderCompare();
  if (state.tab === 'about' && has('tab', 'dem')) renderAbout();
  if (has('time', 'site', 'tab', 'compare', 'view')) writeHash();
  $('go').textContent = state.tab === 'analyse' ? 'Back to the Moon' : 'Analyse this site';
  $('status').textContent = statusText;
  $('cmp-status').textContent = statusText;
  statusText = '';
}

// --- URL ---------------------------------------------------------------------

function findSite(lat: number, lon: number): Site {
  const near = (s: Site) => Math.abs(s.lat - lat) < 1e-3 && Math.abs(s.lon - (((lon % 360) + 360) % 360)) < 1e-3;
  return SITES.find(near) ?? mySites.find(near) ?? customSite(lat, lon);
}

let hashTimer = 0;
function writeHash() {
  clearTimeout(hashTimer);
  hashTimer = window.setTimeout(() => {
    const p = new URLSearchParams();
    p.set('site', `${state.site.lat.toFixed(4)},${state.site.lon.toFixed(4)}`);
    // A link made while following the clock opens on the reader's own "now".
    if (!followNow) p.set('t', new Date(state.timeMs).toISOString().slice(0, 16));
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
  // Only a well-formed date counts. Chrome reads a missing one ("null:00Z") as 1 Jan 2000.
  const when = p.get('t') ?? '';
  const t = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when) ? Date.parse(`${when}:00Z`) : NaN;
  followNow = !Number.isFinite(t);
  state.timeMs = followNow ? nowMs() : Math.round(t / TEN_MIN) * TEN_MIN;
  const tab = p.get('tab');
  if (tab === 'analyse' || tab === 'compare' || tab === 'about') state.tab = tab;
  // Links made before the Method tab was renamed still open it.
  if (tab === 'method') state.tab = 'about';
  if (p.get('view') === 'map') state.view = 'map';
  const cmp = p.get('cmp');
  if (cmp) {
    state.compare = cmp
      .split(';')
      .map((c) => c.split(',').map(Number))
      .filter((c) => c.length === 3 && c.every(Number.isFinite))
      .slice(0, MAX_SCENARIOS)
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
$('now').addEventListener('click', () => setTime(Date.now(), true));

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

function addScenario(site = state.site) {
  const dup = state.compare.some((c) => siteKey(c.site) === siteKey(site) && c.timeMs === state.timeMs);
  const name = site.no ? catalogueNo(site) : 'The custom site';
  if (dup) statusText = `${name} on that date is already in Compare. Change the date to add it again.`;
  else if (state.compare.length >= MAX_SCENARIOS) statusText = `Compare holds ${MAX_SCENARIOS} scenarios. Remove one first.`;
  else {
    fresh.add(state.compare.length);
    state.compare = [...state.compare, { site, timeMs: state.timeMs }];
    statusText = `Added ${site.no ? name : 'the custom site'} on ${dateUTC(state.timeMs)} to Compare.`;
  }
  invalidate('compare');
}
$('add').addEventListener('click', () => addScenario());

// --- My sites ------------------------------------------------------------------

/** Puts a new version of a site everywhere the old one appears: on screen and in Compare. */
function swapSite(key: string, next: Site) {
  if (siteKey(state.site) === key) state.site = next;
  state.compare = state.compare.map((c) => (siteKey(c.site) === key ? { ...c, site: next } : c));
}

/** The name field serves two jobs: naming a pin as it is saved, and renaming a saved site. */
let nameMode: 'save' | 'rename' = 'rename';

function saveSite(name: string) {
  const s = state.site;
  if (mySites.length >= MAX_MY_SITES) {
    statusText = `My sites holds ${MAX_MY_SITES}. Remove one first.`;
    invalidate('mine');
    return;
  }
  const no = nextNumber(mySites);
  const site = makeMySite(no, name, s.lat, s.lon);
  if (!storeMySites([...mySites, site])) {
    statusText = 'This browser would not save the site. Its storage may be turned off or full.';
    invalidate('mine');
    return;
  }
  mySites = [...mySites, site];
  swapSite(siteKey(s), site);
  statusText = `Saved “${site.name}” as ${catalogueNo(site)}. Only this browser keeps it.`;
  invalidate('mine', 'site');
}

function startName(mode: 'save' | 'rename') {
  if (mode === 'rename' && state.site.group !== 'mine') return;
  nameMode = mode;
  const input = $<HTMLInputElement>('rename-input');
  input.value = mode === 'rename' ? state.site.name : '';
  $('rename-ok').textContent = mode === 'save' ? 'Save site' : 'Save name';
  $('rename-label').textContent = mode === 'save' ? 'Name for this site' : 'New name for this site';
  $('rename-err').hidden = true;
  $('s-name').hidden = true;
  $('mine-tools').hidden = true;
  $('rename').hidden = false;
  input.focus();
  input.select();
}

function finishRename(save: boolean) {
  const s = state.site;
  const name = cleanName($<HTMLInputElement>('rename-input').value);
  if (save && !name) {
    $('rename-err').textContent = nameMode === 'save' ? 'Give the site a name to save it.' : 'A saved site needs a name.';
    $('rename-err').hidden = false;
    $('rename-input').focus();
    return;
  }
  if (save && nameMode === 'save' && s.group === 'custom') {
    saveSite(name);
    return;
  }
  if (save && s.group === 'mine' && name !== s.name) {
    const next = { ...s, name };
    const list = mySites.map((m) => (m.no === s.no ? next : m));
    if (storeMySites(list)) {
      mySites = list;
      swapSite(siteKey(s), next);
      statusText = `Renamed ${catalogueNo(next)}.`;
    } else {
      statusText = 'This browser would not save the new name. Its storage may be turned off or full.';
    }
  }
  invalidate('mine');
}

let removeTimer = 0;
function removeSite(button: HTMLButtonElement) {
  // Two clicks, so a stray one does not lose a saved site.
  if (!button.dataset.armed) {
    button.dataset.armed = '1';
    button.textContent = 'Click again to remove';
    clearTimeout(removeTimer);
    removeTimer = window.setTimeout(() => invalidate('mine'), 4000);
    return;
  }
  clearTimeout(removeTimer);
  const s = state.site;
  const list = mySites.filter((m) => m.no !== s.no);
  if (!storeMySites(list)) {
    statusText = 'This browser would not update My sites. Its storage may be turned off.';
    invalidate('mine');
    return;
  }
  mySites = list;
  swapSite(siteKey(s), customSite(s.lat, s.lon));
  statusText = `Removed ${catalogueNo(s)} from My sites. It stays on screen as a custom site.`;
  invalidate('mine', 'site');
}

$('mine-tools').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-mine]');
  if (b?.dataset.mine === 'save') startName('save');
  else if (b?.dataset.mine === 'rename') startName('rename');
  else if (b?.dataset.mine === 'remove') removeSite(b);
});
$<HTMLFormElement>('rename').addEventListener('submit', (e) => {
  e.preventDefault();
  finishRename(true);
});
$('rename-cancel').addEventListener('click', () => finishRename(false));
$('rename-input').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') finishRename(false);
});

// Another tab changed My sites: pick up the new list and names.
window.addEventListener('storage', (e) => {
  if (e.key !== storageKey) return;
  mySites = loadMySites();
  const refresh = (s: Site) =>
    s.group === 'mine' || s.group === 'custom'
      ? mySites.find((m) => siteKey(m) === siteKey(s)) ?? (s.group === 'mine' ? customSite(s.lat, s.lon) : s)
      : s;
  state.site = refresh(state.site);
  state.compare = state.compare.map((c) => ({ ...c, site: refresh(c.site) }));
  invalidate('mine', 'site');
});

// --- Compare filters -----------------------------------------------------------

const fv = <T extends HTMLElement = HTMLInputElement>(id: string) => $<T>(id);
const RANGE_NUMBERS = ['latFrom', 'latTo', 'lonFrom', 'lonTo'] as const;
/** Sliders: the end that means "no limit" is 0 for a minimum and the top for a maximum. */
const SLIDERS = { minSun: 'min', minEarth: 'min', minBoth: 'min', maxDarkH: 'max', maxNoLinkH: 'max' } as const;
const segValue = (id: string) => fv(id).querySelector<HTMLElement>('[aria-pressed="true"]')?.dataset.v ?? 'all';

function readFilterForm(): Filters {
  const f: Filters = {
    ...NO_FILTERS,
    source: segValue('f-source') as Filters['source'],
    hemi: segValue('f-hemi') as Filters['hemi'],
    terrainOnly: fv('f-terrain').getAttribute('aria-pressed') === 'true',
    sort: fv<HTMLSelectElement>('f-sort').value as Filters['sort'],
  };
  for (const k of RANGE_NUMBERS) {
    const raw = fv(`f-${k}`).value.trim();
    f[k] = raw === '' || !Number.isFinite(Number(raw)) ? null : Number(raw);
  }
  for (const [k, end] of Object.entries(SLIDERS) as [keyof typeof SLIDERS, 'min' | 'max'][]) {
    const el = fv(`f-${k}`);
    const v = Number(el.value);
    f[k] = end === 'min' ? (v > 0 ? v : null) : v < Number(el.max) ? v : null;
  }
  return f;
}

/** The value beside each slider: "any" at the no-limit end. */
function writeSliderLabels() {
  for (const [k, end] of Object.entries(SLIDERS) as [keyof typeof SLIDERS, 'min' | 'max'][]) {
    const v = filters[k];
    fv(`o-${k}`).textContent = v === null ? 'any' : end === 'min' ? `${v}%` : v === 0 ? '0 h' : hours(v);
  }
}

function writeFilterForm() {
  for (const id of ['f-source', 'f-hemi'] as const) {
    const v = id === 'f-source' ? filters.source : filters.hemi;
    fv(id).querySelectorAll<HTMLElement>('[data-v]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
  }
  fv('f-terrain').setAttribute('aria-pressed', String(filters.terrainOnly));
  fv<HTMLSelectElement>('f-sort').value = filters.sort;
  for (const k of RANGE_NUMBERS) fv(`f-${k}`).value = filters[k] === null ? '' : String(filters[k]);
  for (const [k, end] of Object.entries(SLIDERS) as [keyof typeof SLIDERS, 'min' | 'max'][]) {
    const el = fv(`f-${k}`);
    el.value = String(filters[k] ?? (end === 'min' ? 0 : el.max));
  }
  writeSliderLabels();
}

const onFilter = () => {
  filters = readFilterForm();
  writeSliderLabels();
  storeFilters(filters);
  invalidate('filter');
};
$('filters').addEventListener('input', onFilter);
$('filters').addEventListener('change', onFilter);
$('filters').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!b) return;
  if (b.dataset.v) {
    b.parentElement!.querySelectorAll('[data-v]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    onFilter();
  } else if (b.id === 'f-terrain') {
    b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
    onFilter();
  }
});
// The sort sits above the table, outside the filter form.
$('f-sort').addEventListener('change', onFilter);
$<HTMLFormElement>('filters').addEventListener('submit', (e) => e.preventDefault());
$('f-clear').addEventListener('click', () => {
  // Clearing keeps the chosen order: sorting is not a filter.
  filters = { ...NO_FILTERS, sort: filters.sort };
  writeFilterForm();
  storeFilters(filters);
  invalidate('filter');
});

$('cmp-body').addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const sortBy = t.closest<HTMLButtonElement>('[data-sort]');
  if (sortBy) {
    fv<HTMLSelectElement>('f-sort').value = filters.sort === sortBy.dataset.sort ? 'added' : sortBy.dataset.sort!;
    onFilter();
    return;
  }
  const open = t.closest<HTMLButtonElement>('[data-open]');
  const remove = t.closest<HTMLButtonElement>('[data-remove]');
  if (open) {
    const sc = state.compare[Number(open.dataset.open)];
    followNow = false;
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
$('play').addEventListener('click', () => setPlaying(!playing));
$('paths').addEventListener('click', () => {
  const on = $('paths').getAttribute('aria-pressed') !== 'true';
  $('paths').setAttribute('aria-pressed', String(on));
  sky?.setGuides(on);
});
// Taking hold of the sky stops it from following the Sun or Earth.
$('sky').addEventListener('pointerdown', () => (following = false));
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
onWidth($('about'), () => {
  if (state.tab === 'about') renderAbout();
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

// --- Disclosures -------------------------------------------------------------
// The detail sections start closed. Whatever a visitor opens stays open on their next visit.

const OPEN_KEY = 'lls-open';
const disclosures = [...document.querySelectorAll<HTMLDetailsElement>('details.more')];
try {
  const open: unknown = JSON.parse(localStorage.getItem(OPEN_KEY) ?? '[]');
  if (Array.isArray(open)) disclosures.forEach((d) => (d.open = open.includes(d.id)));
} catch {
  // Storage is blocked or holds something else: everything starts closed.
}
disclosures.forEach((d) =>
  d.addEventListener('toggle', () => {
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(disclosures.filter((x) => x.open).map((x) => x.id)));
    } catch {
      // Not remembered this time.
    }
  }),
);

// --- Start -------------------------------------------------------------------

writeFilterForm();
$('about').innerHTML = aboutHtml;
wireAbout($('about'));
$<HTMLSelectElement>('span').value = String(state.spanDays);
readHash();
lastSiteKey = siteKey(state.site);
globe?.flyTo(state.site, false);
invalidate('site', 'time', 'tab', 'view', 'compare', 'body', 'rig');
