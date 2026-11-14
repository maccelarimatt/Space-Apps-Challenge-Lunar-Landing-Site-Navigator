// Visibility of the Sun and Earth from a site over time: samples, events and summary figures.

import {
  SYNODIC_MONTH_DAYS,
  discFractionAbove,
  moonState,
  skyFromSite,
  type LatLon,
  type MoonState,
  type SkyPosition,
} from './frame';
import { horizonAt, type Horizon } from './horizon';

export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;
export const LUNAR_DAY_MS = SYNODIC_MONTH_DAYS * DAY_MS;

export interface BodyView extends SkyPosition {
  /** Horizon elevation in the body's direction, degrees. */
  horizon: number;
  /** Height of the disc centre above the horizon, degrees. */
  clearance: number;
  /** Share of the disc above the horizon, 0 to 1. */
  fraction: number;
}

export interface SiteView {
  timeMs: number;
  sun: BodyView;
  earth: BodyView;
}

// Sun and Earth vectors depend only on time, so every site and scenario can share them.
const stateCache = new Map<number, MoonState>();
function cachedState(timeMs: number): MoonState {
  let s = stateCache.get(timeMs);
  if (!s) {
    if (stateCache.size > 60_000) stateCache.clear();
    s = moonState(timeMs);
    stateCache.set(timeMs, s);
  }
  return s;
}

function bodyView(pos: SkyPosition, horizon: Horizon): BodyView {
  const h = horizonAt(horizon, pos.az);
  const clearance = pos.el - h;
  return { ...pos, horizon: h, clearance, fraction: discFractionAbove(clearance, pos.radius) };
}

/** What the sky looks like from a site at one instant. */
export function viewAt(site: LatLon, horizon: Horizon, timeMs: number): SiteView {
  const sky = skyFromSite(cachedState(timeMs), site, horizon.heightM);
  return { timeMs, sun: bodyView(sky.sun, horizon), earth: bodyView(sky.earth, horizon) };
}

export interface Series {
  startMs: number;
  stepMs: number;
  count: number;
  sunFraction: Float32Array;
  earthFraction: Float32Array;
  /** Height of the Sun's upper edge above the horizon, degrees (negative when hidden). */
  sunTop: Float32Array;
  earthTop: Float32Array;
  sunAz: Float32Array;
  sunEl: Float32Array;
  earthAz: Float32Array;
  earthEl: Float32Array;
}

/** Evenly spaced samples. Start times are snapped to the step so cached states are reused. */
export function sampleSeries(site: LatLon, horizon: Horizon, startMs: number, endMs: number, stepMs: number): Series {
  const start = Math.floor(startMs / stepMs) * stepMs;
  const count = Math.max(2, Math.ceil((endMs - start) / stepMs) + 1);
  const s: Series = {
    startMs: start,
    stepMs,
    count,
    sunFraction: new Float32Array(count),
    earthFraction: new Float32Array(count),
    sunTop: new Float32Array(count),
    earthTop: new Float32Array(count),
    sunAz: new Float32Array(count),
    sunEl: new Float32Array(count),
    earthAz: new Float32Array(count),
    earthEl: new Float32Array(count),
  };
  for (let i = 0; i < count; i++) {
    const v = viewAt(site, horizon, start + i * stepMs);
    s.sunFraction[i] = v.sun.fraction;
    s.earthFraction[i] = v.earth.fraction;
    s.sunTop[i] = v.sun.clearance + v.sun.radius;
    s.earthTop[i] = v.earth.clearance + v.earth.radius;
    s.sunAz[i] = v.sun.az;
    s.sunEl[i] = v.sun.el;
    s.earthAz[i] = v.earth.az;
    s.earthEl[i] = v.earth.el;
  }
  return s;
}

/** A body counts as "in view" when more than half of its disc is above the horizon. */
export const IN_VIEW = 0.5;

export interface Summary {
  /** Share of the period with the Sun in view, 0 to 1. */
  sun: number;
  earth: number;
  both: number;
  /** Longest unbroken stretch with the Sun out of view, hours. */
  longestDarkH: number;
  /** Longest unbroken stretch without Earth in view, hours. */
  longestNoLinkH: number;
  /** Longest unbroken stretch with both in view, hours. */
  longestBothH: number;
}

function longestRun(count: number, stepMs: number, test: (i: number) => boolean): number {
  let best = 0;
  let run = 0;
  for (let i = 0; i < count; i++) {
    run = test(i) ? run + 1 : 0;
    if (run > best) best = run;
  }
  return (best * stepMs) / HOUR_MS;
}

export function summarise(s: Series): Summary {
  let sun = 0;
  let earth = 0;
  let both = 0;
  for (let i = 0; i < s.count; i++) {
    const a = s.sunFraction[i] > IN_VIEW;
    const b = s.earthFraction[i] > IN_VIEW;
    if (a) sun++;
    if (b) earth++;
    if (a && b) both++;
  }
  return {
    sun: sun / s.count,
    earth: earth / s.count,
    both: both / s.count,
    longestDarkH: longestRun(s.count, s.stepMs, (i) => s.sunFraction[i] <= IN_VIEW),
    longestNoLinkH: longestRun(s.count, s.stepMs, (i) => s.earthFraction[i] <= IN_VIEW),
    longestBothH: longestRun(s.count, s.stepMs, (i) => s.sunFraction[i] > IN_VIEW && s.earthFraction[i] > IN_VIEW),
  };
}

/** Sample range [start, end) of the longest stretch with a body out of view, or null if there is none. */
export function longestGap(s: Series, body: 'sun' | 'earth'): { start: number; end: number } | null {
  const f = body === 'sun' ? s.sunFraction : s.earthFraction;
  let best: { start: number; end: number } | null = null;
  let start = -1;
  for (let i = 0; i <= s.count; i++) {
    const out = i < s.count && f[i] <= IN_VIEW;
    if (out && start < 0) start = i;
    if (!out && start >= 0) {
      if (!best || i - start > best.end - best.start) best = { start, end: i };
      start = -1;
    }
  }
  return best;
}

export interface NextChange {
  /** True when any part of the disc shows now. */
  visibleNow: boolean;
  /** When the disc next disappears entirely (if visible) or next appears (if hidden); null if not within the search span. */
  atMs: number | null;
}

/**
 * Next time a body's disc fully sets or first rises, searched in 30-minute
 * steps and refined to about a minute.
 */
export function nextChange(
  site: LatLon,
  horizon: Horizon,
  body: 'sun' | 'earth',
  fromMs: number,
  spanDays = 60,
): NextChange {
  const frac = (t: number) => viewAt(site, horizon, t)[body].fraction;
  const visibleNow = frac(fromMs) > 0;
  const step = 30 * 60_000;
  // Walk on the shared 30-minute grid so the Sun/Earth states come from the cache.
  let prev = fromMs;
  let t = Math.ceil((fromMs + 1) / step) * step;
  const end = fromMs + spanDays * DAY_MS;
  for (; t <= end; prev = t, t += step) {
    if (frac(t) > 0 !== visibleNow) {
      let lo = prev;
      let hi = t;
      while (hi - lo > 60_000) {
        const mid = (lo + hi) / 2;
        if (frac(mid) > 0 === visibleNow) lo = mid;
        else hi = mid;
      }
      return { visibleNow, atMs: hi };
    }
  }
  return { visibleNow, atMs: null };
}

/** Start of the mean lunar day (synodic month) containing a time, and its index. */
export function lunarDayOf(timeMs: number): { index: number; startMs: number } {
  // Reference new moon: 2000-01-06 18:14 UTC.
  const epoch = Date.UTC(2000, 0, 6, 18, 14);
  const index = Math.floor((timeMs - epoch) / LUNAR_DAY_MS);
  return { index, startMs: epoch + index * LUNAR_DAY_MS };
}
