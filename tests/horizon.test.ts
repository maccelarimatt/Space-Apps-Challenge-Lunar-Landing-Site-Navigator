import { describe, expect, it } from 'vitest';
import { computeHorizon, demLatLon, demPixel, groundHeight, sphereHorizon } from '../src/astro/horizon';
import { DAY_MS, HOUR_MS, sampleSeries, summarise, viewAt } from '../src/astro/windows';
import { CREST_LLS01, GLASER_TABLE_2 } from '../src/checks';
import { loadDemFromDisk } from './helpers';

const dem = loadDemFromDisk();
const YEAR_START = Date.UTC(2027, 0, 1);

function yearAt(lat: number, lon: number) {
  const site = { lat, lon };
  const horizon = computeHorizon(dem, site, 2);
  return summarise(sampleSeries(site, horizon, YEAR_START, YEAR_START + 365 * DAY_MS, 2 * HOUR_MS));
}

describe.skipIf(!dem)('south-pole terrain (needs npm run data)', () => {
  it('has the grid the right way round', () => {
    // Malapert Massif stands on the Earth-facing side; the same latitude on the far side is low ground.
    expect(groundHeight(dem, { lat: -86, lon: 0 })!).toBeGreaterThan(4000);
    expect(groundHeight(dem, { lat: -86, lon: 180 })!).toBeLessThan(0);
    // Shackleton's floor sits about 2.8 km below the reference sphere.
    expect(groundHeight(dem, { lat: -89.67, lon: 129.78 })!).toBeLessThan(-2500);
  });

  it('round-trips pixel and latitude/longitude', () => {
    const p = demPixel(dem!, { lat: -87.3, lon: 211.5 })!;
    const back = demLatLon(dem!, p.col, p.row);
    expect(back.lat).toBeCloseTo(-87.3, 6);
    expect(back.lon).toBeCloseTo(211.5, 6);
  });

  it('keeps the floor of Shackleton crater in permanent shadow', () => {
    const y = yearAt(-89.67, 129.78);
    expect(y.sun).toBe(0);
    expect(y.earth).toBe(0);
  });

  // The About page quotes these figures. Each one is recomputed here exactly as
  // the page describes it: 2 m above ground, hourly, 1 January 2017 to 1 January 2037.
  const twentyYears = (lat: number, lon: number) => {
    const site = { lat, lon };
    const h = computeHorizon(dem, site, 2);
    let n = 0;
    let sum = 0;
    let any = 0;
    let run = 0;
    let worst = 0;
    for (let t = Date.UTC(2017, 0, 1); t < Date.UTC(2037, 0, 1); t += HOUR_MS) {
      const f = viewAt(site, h, t).sun.fraction;
      n++;
      sum += f;
      if (f > 0) any++;
      run = f > 0 ? 0 : run + 1;
      worst = Math.max(worst, run);
    }
    return { avg: (sum / n) * 100, vis: (any / n) * 100, shadowH: worst };
  };

  for (const c of [...GLASER_TABLE_2, { label: 'LLS 01', ...CREST_LLS01 }]) {
    it(`matches the About page for ${c.label}`, () => {
      const got = twentyYears(c.lat, c.lon);
      expect(got.avg).toBeCloseTo(c.ours.avg, 0);
      expect(got.vis).toBeCloseTo(c.ours.vis, 0);
      expect(Math.abs(got.shadowH - c.ours.shadowH)).toBeLessThanOrEqual(1);
    }, 60_000);
  }

  it('finds the Shackleton to de Gerlache ridge sunlit for most of the year', () => {
    const y = yearAt(-89.4455, 222.686);
    expect(y.sun).toBeGreaterThan(0.85);
    expect(y.sun).toBeLessThan(0.95);
    // At the pole Earth spends about half its time below the horizon.
    expect(y.earth).toBeGreaterThan(0.4);
    expect(y.earth).toBeLessThan(0.6);
  });
});

describe('smooth-sphere fallback', () => {
  it('dips slightly below level for a raised observer', () => {
    const h = sphereHorizon(10);
    expect(h.elevation[0]).toBeLessThan(0);
    expect(h.elevation[0]).toBeGreaterThan(-0.3);
    expect(computeHorizon(null, { lat: 0.67, lon: 23.47 }, 10).source).toBe('sphere');
  });
});
