import { describe, expect, it } from 'vitest';
import { computeHorizon, demLatLon, demPixel, groundHeight, sphereHorizon } from '../src/astro/horizon';
import { DAY_MS, HOUR_MS, sampleSeries, summarise } from '../src/astro/windows';
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

  it('puts a high point on Shackleton’s rim near the published 85.5% illumination', () => {
    // Gläser et al. (2018) report 85.5% for the rim; a 240 m grid and a 2 m mast will not match exactly.
    const y = yearAt(-89.7786, 204.274);
    expect(y.sun).toBeGreaterThan(0.8);
    expect(y.sun).toBeLessThan(0.92);
  });

  it('finds the Shackleton to de Gerlache ridge sunlit for most of the year', () => {
    // Published LOLA studies (Mazarico et al. 2011) put this crest near 90% average illumination.
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
