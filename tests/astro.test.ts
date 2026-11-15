import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Libration, MakeTime } from 'astronomy-engine';
import { discFractionAbove, moonState, skyFromSite, subPoint } from '../src/astro/frame';

interface Row {
  timeMs: number;
  az: number;
  el: number;
  diamArcsec: number;
}

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/** Parse the $$SOE ... $$EOE block of a JPL Horizons observer table saved as CSV. */
function readHorizons(name: string): Row[] {
  const text = readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
  const body = text.slice(text.indexOf('$$SOE') + 5, text.indexOf('$$EOE'));
  return body
    .split('\n')
    .map((line) => line.split(',').map((c) => c.trim()))
    .filter((c) => c.length >= 6 && c[0])
    .map((c) => {
      const [, y, mon, d, hh, mm] = /(\d{4})-(\w{3})-(\d{2}) (\d{2}):(\d{2})/.exec(c[0])!;
      return {
        timeMs: Date.UTC(+y, MONTHS[mon], +d, +hh, +mm),
        az: +c[3],
        el: +c[4],
        diamArcsec: +c[5],
      };
    });
}

const SITES = {
  shackleton: { lat: -89.45, lon: 222.69 },
  apollo11: { lat: 0.674, lon: 23.473 },
};

function worstError(file: string, site: { lat: number; lon: number }, body: 'sun' | 'earth') {
  let worst = 0;
  let worstDiam = 0;
  const rows = readHorizons(file);
  expect(rows.length).toBeGreaterThan(100);
  for (const row of rows) {
    const sky = skyFromSite(moonState(row.timeMs), site)[body];
    // Compare as an angle on the sky so azimuth error is not inflated near the zenith.
    const dAz = (((sky.az - row.az + 540) % 360) - 180) * Math.cos((row.el * Math.PI) / 180);
    const dEl = sky.el - row.el;
    worst = Math.max(worst, Math.hypot(dAz, dEl));
    worstDiam = Math.max(worstDiam, Math.abs(sky.radius * 2 * 3600 - row.diamArcsec));
  }
  return { worst, worstDiam };
}

describe('Sun and Earth positions agree with JPL Horizons', () => {
  const cases: [string, keyof typeof SITES, 'sun' | 'earth'][] = [
    ['horizons_sun_shackleton.txt', 'shackleton', 'sun'],
    ['horizons_earth_shackleton.txt', 'shackleton', 'earth'],
    ['horizons_sun_apollo11.txt', 'apollo11', 'sun'],
    ['horizons_earth_apollo11.txt', 'apollo11', 'earth'],
  ];
  for (const [file, site, body] of cases) {
    it(`${body} from ${site} within 0.01° over 30 days`, () => {
      const { worst, worstDiam } = worstError(file, SITES[site], body);
      console.log(`${body} @ ${site}: worst sky error ${worst.toFixed(4)}°, worst diameter error ${worstDiam.toFixed(2)}"`);
      expect(worst).toBeLessThan(0.01);
      expect(worstDiam).toBeLessThan(5);
    });
  }
});

describe('Moon-fixed frame', () => {
  it('puts the sub-Earth point where the library libration model does', () => {
    for (const iso of ['2027-03-14T06:00:00Z', '2026-11-14T00:00:00Z', '2030-07-01T12:00:00Z']) {
      const ms = Date.parse(iso);
      const lib = Libration(MakeTime(new Date(ms)));
      const sub = subPoint(moonState(ms).earth);
      expect(Math.abs(sub.lat - lib.elat)).toBeLessThan(0.05);
      expect(Math.abs(sub.lon - lib.elon)).toBeLessThan(0.05);
    }
  });
});

describe('discFractionAbove', () => {
  it('handles the limits and the half-way point', () => {
    expect(discFractionAbove(1, 1)).toBe(1);
    expect(discFractionAbove(-1, 1)).toBe(0);
    expect(discFractionAbove(0, 0.27)).toBeCloseTo(0.5, 10);
    expect(discFractionAbove(0.135, 0.27)).toBeGreaterThan(0.5);
  });
});

describe('Earth orientation for the sky view', () => {
  // An independent route: stand on Earth at the point the drawing code says is
  // beneath the Moon, and ask the library how high the Moon is there. It should be overhead.
  // One degree is allowed: Earth is drawn about a hundred pixels wide at most, so that is under a pixel.
  it('puts the Moon overhead at the sub-lunar point', async () => {
    const { Body, Equator, Horizon, Observer } = await import('astronomy-engine');
    const { subLunarPoint } = await import('../src/astro/frame');
    for (const iso of ['2026-11-15T07:00:00Z', '2027-03-14T06:00:00Z', '2027-08-02T19:30:00Z', '2030-01-20T12:00:00Z']) {
      const t = Date.parse(iso);
      const p = subLunarPoint(t);
      const observer = new Observer(p.lat, p.lon, 0);
      const eq = Equator(Body.Moon, new Date(t), observer, true, true);
      const hor = Horizon(new Date(t), observer, eq.ra, eq.dec);
      expect(hor.altitude).toBeGreaterThan(89);
    }
  });
});
