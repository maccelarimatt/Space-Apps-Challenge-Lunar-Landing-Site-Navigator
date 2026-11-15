// Sites a visitor saves. They live only in this browser's localStorage: nothing
// is sent anywhere, so the site stays a plain static page with no server.

import type { Site } from './sites';

const KEY = 'selene-my-sites';
export const MAX_MY_SITES = 50;
export const MAX_NAME = 40;

interface Stored {
  no: number;
  name: string;
  lat: number;
  lon: number;
}

const isStored = (v: unknown): v is Stored => {
  const s = v as Stored;
  return (
    typeof s === 'object' &&
    s !== null &&
    Number.isInteger(s.no) &&
    s.no > 0 &&
    typeof s.name === 'string' &&
    Number.isFinite(s.lat) &&
    Math.abs(s.lat) <= 90 &&
    Number.isFinite(s.lon)
  );
};

const toSite = (s: Stored): Site => ({
  no: s.no,
  name: cleanName(s.name) || `My site ${s.no}`,
  lat: s.lat,
  lon: ((s.lon % 360) + 360) % 360,
  group: 'mine',
  note: 'A site you saved. It is kept in this browser only.',
});

/** Trims a name and caps its length. Shown with textContent or escaped, never as raw HTML. */
export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
}

/** Saved sites, oldest first. Empty if storage is blocked or holds something unexpected. */
export function loadMySites(): Site[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter(isStored).map(toSite) : [];
  } catch {
    return [];
  }
}

/** Writes the list. Returns false when the browser will not store it. */
export function storeMySites(sites: Site[]): boolean {
  const data: Stored[] = sites.map((s) => ({ no: s.no, name: s.name, lat: s.lat, lon: s.lon }));
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** The next number in the MY series. Numbers are never reused, so MY 03 always means the same place. */
export function nextNumber(sites: Site[]): number {
  let seen = 0;
  try {
    seen = Number(localStorage.getItem(`${KEY}-last`)) || 0;
  } catch {
    // Fall back to the highest number in the list.
  }
  const n = Math.max(seen, ...sites.map((s) => s.no), 0) + 1;
  try {
    localStorage.setItem(`${KEY}-last`, String(n));
  } catch {
    // Not remembered: the next save may reuse a number freed by a removal.
  }
  return n;
}

export function makeMySite(no: number, name: string, lat: number, lon: number): Site {
  return toSite({ no, name, lat, lon });
}

/** The storage key, so other tabs can be noticed when they change the list. */
export const storageKey = KEY;
