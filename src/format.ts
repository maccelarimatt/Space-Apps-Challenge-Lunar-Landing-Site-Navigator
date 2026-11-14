import type { LatLon } from './astro/frame';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n: number) => String(n).padStart(2, '0');

/** "4 d 07 h", "31 h" or "12 min". */
export function duration(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60_000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} d ${pad(hours % 24)} h`;
}

export function hours(h: number): string {
  return duration(h * 3_600_000);
}

export const percent = (f: number) => `${Math.round(f * 100)}%`;

/** "14 Mar 2027" in UTC. */
export function dateUTC(ms: number, withYear = true): string {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${withYear ? ` ${d.getUTCFullYear()}` : ''}`;
}

/** "14 Mar 2027, 06:00 UTC". */
export function dateTimeUTC(ms: number): string {
  const d = new Date(ms);
  return `${dateUTC(ms)}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

export const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const isoTime = (ms: number) => new Date(ms).toISOString().slice(11, 16);

export function latText(lat: number): string {
  return `${Math.abs(lat).toFixed(2)}° ${lat < 0 ? 'S' : 'N'}`;
}

export function lonText(lon: number): string {
  return `${(((lon % 360) + 360) % 360).toFixed(2)}° E`;
}

export const coords = (p: LatLon) => `${latText(p.lat)}, ${lonText(p.lon)}`;

/** Signed degrees with one decimal and a real minus sign. */
export function degrees(v: number, digits = 1): string {
  const s = Math.abs(v).toFixed(digits);
  return `${v < 0 && +s !== 0 ? '−' : ''}${s}°`;
}

export function bearing(az: number): string {
  return `${String(Math.round(((az % 360) + 360) % 360) % 360).padStart(3, '0')}°`;
}

export function metres(m: number): string {
  const r = Math.round(m);
  const s = Math.abs(r).toLocaleString('en-US').replace(/,/g, ' ');
  return `${r < 0 ? '−' : '+'}${s} m`;
}
