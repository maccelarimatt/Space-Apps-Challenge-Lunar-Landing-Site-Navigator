import { describe, expect, it } from 'vitest';
import { NO_FILTERS, activeCount, hasTerrain, siteMatches, sorter, summaryMatches, type Filters } from '../src/compare-filter';
import type { Summary } from '../src/astro/windows';
import type { Site } from '../src/sites';

const site = (lat: number, lon: number, group: Site['group'] = 'pole'): Site => ({ no: 1, name: 'x', lat, lon, group, note: '' });
const f = (patch: Partial<Filters>): Filters => ({ ...NO_FILTERS, ...patch });
const sum = (p: Partial<Summary>): Summary => ({ sun: 0, earth: 0, both: 0, longestDarkH: 0, longestNoLinkH: 0, longestBothH: 0, ...p });

describe('Compare filters', () => {
  it('keeps everything with no filters set', () => {
    expect(siteMatches(site(-89, 10), NO_FILTERS)).toBe(true);
    expect(summaryMatches(sum({}), NO_FILTERS)).toBe(true);
    expect(activeCount(NO_FILTERS)).toBe(0);
  });

  it('asks the terrain grid, not a latitude, whether a site has real terrain', () => {
    // The grid is square: its edge is near 80°S on the 0° meridian, but its corners reach about 76°S at 45°E.
    expect(hasTerrain(site(-80.13, 1.44))).toBe(true);
    expect(hasTerrain(site(-79.9, 1))).toBe(false);
    expect(hasTerrain(site(-78, 45))).toBe(true);
    expect(hasTerrain(site(-78, 0))).toBe(false);
    expect(hasTerrain(site(-75, 45))).toBe(false);
    expect(hasTerrain(site(85, 45))).toBe(false);
  });

  it('filters by source, hemisphere and terrain', () => {
    expect(siteMatches(site(-89, 10, 'mine'), f({ source: 'lls' }))).toBe(false);
    expect(siteMatches(site(-89, 10, 'mine'), f({ source: 'mine' }))).toBe(true);
    expect(siteMatches(site(-89, 10, 'custom'), f({ source: 'pin' }))).toBe(true);
    expect(siteMatches(site(20, 30), f({ hemi: 's' }))).toBe(false);
    expect(siteMatches(site(20, 30), f({ hemi: 'n' }))).toBe(true);
    expect(siteMatches(site(-70, 30), f({ terrainOnly: true }))).toBe(false);
    expect(siteMatches(site(-85, 30), f({ terrainOnly: true }))).toBe(true);
  });

  it('accepts a latitude range given either way round', () => {
    expect(siteMatches(site(-85, 0), f({ latFrom: -90, latTo: -80 }))).toBe(true);
    expect(siteMatches(site(-85, 0), f({ latFrom: -80, latTo: -90 }))).toBe(true);
    expect(siteMatches(site(-70, 0), f({ latFrom: -90, latTo: -80 }))).toBe(false);
  });

  it('wraps a longitude range through 0°E', () => {
    const wrap = f({ lonFrom: 350, lonTo: 10 });
    expect(siteMatches(site(-89, 355), wrap)).toBe(true);
    expect(siteMatches(site(-89, 5), wrap)).toBe(true);
    expect(siteMatches(site(-89, 180), wrap)).toBe(false);
    expect(siteMatches(site(-89, 180), f({ lonFrom: 0, lonTo: 360 }))).toBe(true);
  });

  it('applies thresholds to the computed summary', () => {
    expect(summaryMatches(sum({ sun: 0.6 }), f({ minSun: 70 }))).toBe(false);
    expect(summaryMatches(sum({ sun: 0.8 }), f({ minSun: 70 }))).toBe(true);
    expect(summaryMatches(sum({ longestDarkH: 100 }), f({ maxDarkH: 48 }))).toBe(false);
  });

  it('sorts best first and keeps the added order for ties', () => {
    const rows = [
      { i: 0, sum: sum({ sun: 0.5, longestDarkH: 10 }) },
      { i: 1, sum: sum({ sun: 0.9, longestDarkH: 30 }) },
      { i: 2, sum: sum({ sun: 0.5, longestDarkH: 5 }) },
    ];
    expect([...rows].sort(sorter('sun', 336)).map((r) => r.i)).toEqual([1, 0, 2]);
    expect([...rows].sort(sorter('dark', 336)).map((r) => r.i)).toEqual([2, 0, 1]);
  });
});
