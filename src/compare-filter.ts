// Filtering and sorting for the Compare tab. Pure functions, so the rules can be tested.

import type { LatLon } from './astro/frame';
import { SOUTH_POLE_GRID, demPixel } from './astro/horizon';
import type { Summary } from './astro/windows';
import type { Site } from './sites';

export type SourceFilter = 'all' | 'lls' | 'mine' | 'pin';
export type HemiFilter = 'all' | 's' | 'n';
export type SortKey = 'added' | 'sun' | 'earth' | 'both' | 'sunH' | 'earthH' | 'dark' | 'nolink';

export interface Filters {
  source: SourceFilter;
  hemi: HemiFilter;
  terrainOnly: boolean;
  sort: SortKey;
  /** Minimum share in view, 0 to 100, or null for no limit. */
  minSun: number | null;
  minEarth: number | null;
  minBoth: number | null;
  /** Maximum longest stretch without, hours, or null for no limit. */
  maxDarkH: number | null;
  maxNoLinkH: number | null;
  /** Latitude range, degrees north (south negative). */
  latFrom: number | null;
  latTo: number | null;
  /** Longitude range, degrees east 0 to 360. A range from 350 to 10 wraps through 0. */
  lonFrom: number | null;
  lonTo: number | null;
}

export const NO_FILTERS: Filters = {
  source: 'all',
  hemi: 'all',
  terrainOnly: false,
  sort: 'added',
  minSun: null,
  minEarth: null,
  minBoth: null,
  maxDarkH: null,
  maxNoLinkH: null,
  latFrom: null,
  latTo: null,
  lonFrom: null,
  lonTo: null,
};

/**
 * True when the south-pole terrain grid covers a site, so its horizon is real terrain. The grid is
 * square, so its corners reach a little further north than 80°S. Ask the grid rather than a latitude.
 */
export const hasTerrain = (s: LatLon) => demPixel(SOUTH_POLE_GRID, s) !== null;

/** Filters that depend only on where a site is. Used for the site list as well as the table. */
export function siteMatches(s: Site, f: Filters): boolean {
  if (f.source === 'lls' && !(s.group === 'pole' || s.group === 'elsewhere')) return false;
  if (f.source === 'mine' && s.group !== 'mine') return false;
  if (f.source === 'pin' && s.group !== 'custom') return false;
  if (f.hemi === 's' && s.lat >= 0) return false;
  if (f.hemi === 'n' && s.lat < 0) return false;
  if (f.terrainOnly && !hasTerrain(s)) return false;
  if (f.latFrom !== null && s.lat < Math.min(f.latFrom, f.latTo ?? f.latFrom)) return false;
  if (f.latTo !== null && s.lat > Math.max(f.latTo, f.latFrom ?? f.latTo)) return false;
  if (f.lonFrom !== null || f.lonTo !== null) {
    const lon = ((s.lon % 360) + 360) % 360;
    // 360 stays 360 so that "0 to 360" means the whole way round.
    const norm = (v: number) => (v >= 360 ? 360 : ((v % 360) + 360) % 360);
    const from = f.lonFrom === null ? 0 : norm(f.lonFrom);
    const to = f.lonTo === null ? 360 : norm(f.lonTo);
    const inside = from <= to ? lon >= from && lon <= to : lon >= from || lon <= to;
    if (!inside) return false;
  }
  return true;
}

/** Filters that need the computed summary: shares in view and the longest gaps. */
export function summaryMatches(sum: Summary, f: Filters): boolean {
  if (f.minSun !== null && sum.sun * 100 < f.minSun) return false;
  if (f.minEarth !== null && sum.earth * 100 < f.minEarth) return false;
  if (f.minBoth !== null && sum.both * 100 < f.minBoth) return false;
  if (f.maxDarkH !== null && sum.longestDarkH > f.maxDarkH) return false;
  if (f.maxNoLinkH !== null && sum.longestNoLinkH > f.maxNoLinkH) return false;
  return true;
}

/** Comparator for a sort key. Ties keep the order the scenarios were added. */
export function sorter(key: SortKey, spanH: number): (a: { sum: Summary; i: number }, b: { sum: Summary; i: number }) => number {
  const by: Record<SortKey, (s: Summary) => number> = {
    added: () => 0,
    sun: (s) => -s.sun,
    earth: (s) => -s.earth,
    both: (s) => -s.both,
    sunH: (s) => -s.sun * spanH,
    earthH: (s) => -s.earth * spanH,
    dark: (s) => s.longestDarkH,
    nolink: (s) => s.longestNoLinkH,
  };
  return (a, b) => by[key](a.sum) - by[key](b.sum) || a.i - b.i;
}

/** How many filters differ from none, for the "n filters on" count. Sorting is not a filter. */
export function activeCount(f: Filters): number {
  return (Object.keys(NO_FILTERS) as (keyof Filters)[]).filter((k) => k !== 'sort' && f[k] !== NO_FILTERS[k]).length;
}

const FILTER_KEY = 'selene-compare-filters';

/** Filters are remembered per browser, like the open disclosures. */
export function loadFilters(): Filters {
  try {
    const raw = JSON.parse(localStorage.getItem(FILTER_KEY) ?? 'null') as Partial<Filters> | null;
    if (!raw || typeof raw !== 'object') return { ...NO_FILTERS };
    const f = { ...NO_FILTERS };
    for (const k of Object.keys(NO_FILTERS) as (keyof Filters)[]) {
      const v = raw[k];
      if (v === undefined) continue;
      if (typeof v === typeof NO_FILTERS[k] || (NO_FILTERS[k] === null && (v === null || typeof v === 'number'))) (f as Record<string, unknown>)[k] = v;
    }
    return f;
  } catch {
    return { ...NO_FILTERS };
  }
}

export function storeFilters(f: Filters): void {
  try {
    localStorage.setItem(FILTER_KEY, JSON.stringify(f));
  } catch {
    // Not remembered this time.
  }
}
