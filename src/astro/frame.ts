// Where the Sun and Earth are, as seen from a point on the Moon.
//
// Positions come from the astronomy-engine library (truncated VSOP87 / ELP
// series). The Moon's orientation comes from its IAU rotation model, which
// tracks the Mean Earth / Polar Axis frame used by LRO data products to within
// a few thousandths of a degree. Results are checked against JPL Horizons in
// tests/astro.test.ts.

import { Body, GeoMoon, GeoVector, MakeTime, RotationAxis } from 'astronomy-engine';

export const MOON_RADIUS_KM = 1737.4;
export const SUN_RADIUS_KM = 695_700;
export const EARTH_RADIUS_KM = 6378.137;
export const AU_KM = 149_597_870.7;
export const SYNODIC_MONTH_DAYS = 29.530588853;

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export type Vec3 = [number, number, number];

export interface LatLon {
  /** Degrees, north positive. */
  lat: number;
  /** Degrees, east positive. */
  lon: number;
}

export interface MoonState {
  timeMs: number;
  /** Moon centre to Sun centre in the Moon-fixed frame, km. */
  sun: Vec3;
  /** Moon centre to Earth centre in the Moon-fixed frame, km. */
  earth: Vec3;
}

export interface SkyPosition {
  /** Degrees clockwise from north. */
  az: number;
  /** Degrees above the local horizontal plane (centre of the disc). */
  el: number;
  /** Angular radius of the disc, degrees. */
  radius: number;
  distanceKm: number;
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/**
 * A body's own axes in J2000 equatorial coordinates, from its IAU rotation model:
 * x through 0°N 0°E, y through 0°N 90°E, z through the north pole.
 */
function bodyAxes(body: Body, time: ReturnType<typeof MakeTime>): { x: Vec3; y: Vec3; z: Vec3 } {
  const axis = RotationAxis(body, time);
  const ra = axis.ra * 15 * D2R;
  const dec = axis.dec * D2R;
  const spin = axis.spin * D2R;
  const north: Vec3 = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
  const node: Vec3 = [-Math.sin(ra), Math.cos(ra), 0];
  const m = cross(north, node);
  const cs = Math.cos(spin);
  const sn = Math.sin(spin);
  const x: Vec3 = [cs * node[0] + sn * m[0], cs * node[1] + sn * m[1], cs * node[2] + sn * m[2]];
  return { x, y: cross(north, x), z: north };
}

/**
 * Which way Earth is turned, as seen from a site on the Moon: Earth's own axes
 * (x through 0°N 0°E, y through 0°N 90°E, z through its north pole) given as
 * [east, north, up] components at the site. Used to draw Earth's real face.
 */
export function earthAxesAtSite(timeMs: number, site: LatLon): { x: Vec3; y: Vec3; z: Vec3 } {
  const time = MakeTime(new Date(timeMs));
  const moon = bodyAxes(Body.Moon, time);
  const earth = bodyAxes(Body.Earth, time);
  const { east, north, up } = localAxes(site);
  const local = (v: Vec3): Vec3 => {
    const fixed: Vec3 = [dot(v, moon.x), dot(v, moon.y), dot(v, moon.z)];
    return [dot(fixed, east), dot(fixed, north), dot(fixed, up)];
  };
  return { x: local(earth.x), y: local(earth.y), z: local(earth.z) };
}

/** The point on Earth directly beneath the Moon. Checks the Earth orientation used for drawing. */
export function subLunarPoint(timeMs: number): LatLon {
  const time = MakeTime(new Date(timeMs));
  const moon = GeoMoon(time);
  const earth = bodyAxes(Body.Earth, time);
  return subPoint([dot([moon.x, moon.y, moon.z], earth.x), dot([moon.x, moon.y, moon.z], earth.y), dot([moon.x, moon.y, moon.z], earth.z)]);
}

/** Sun and Earth vectors in the Moon-fixed frame (x through 0°N 0°E, z through the north pole). */
export function moonState(timeMs: number): MoonState {
  const time = MakeTime(new Date(timeMs));
  const moon = GeoMoon(time);
  const sun = GeoVector(Body.Sun, time, true);
  const { x: xAxis, y: yAxis, z: north } = bodyAxes(Body.Moon, time);

  const toFixed = (v: Vec3): Vec3 => [dot(v, xAxis) * AU_KM, dot(v, yAxis) * AU_KM, dot(v, north) * AU_KM];

  return {
    timeMs,
    sun: toFixed([sun.x - moon.x, sun.y - moon.y, sun.z - moon.z]),
    earth: toFixed([-moon.x, -moon.y, -moon.z]),
  };
}

/** Point on the Moon directly beneath a body. */
export function subPoint(v: Vec3): LatLon {
  const r = Math.hypot(v[0], v[1], v[2]);
  return { lat: Math.asin(v[2] / r) * R2D, lon: Math.atan2(v[1], v[0]) * R2D };
}

/** Unit vector from the Moon's centre through a surface point, Moon-fixed frame. */
export function surfaceNormal(site: LatLon): Vec3 {
  const lat = site.lat * D2R;
  const lon = site.lon * D2R;
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
}

/** Local east and north unit vectors at a surface point. */
export function localAxes(site: LatLon): { east: Vec3; north: Vec3; up: Vec3 } {
  const lat = site.lat * D2R;
  const lon = site.lon * D2R;
  return {
    east: [-Math.sin(lon), Math.cos(lon), 0],
    north: [-Math.sin(lat) * Math.cos(lon), -Math.sin(lat) * Math.sin(lon), Math.cos(lat)],
    up: surfaceNormal(site),
  };
}

function skyPosition(body: Vec3, bodyRadiusKm: number, site: LatLon, heightKm: number): SkyPosition {
  const { east, north, up } = localAxes(site);
  const r = MOON_RADIUS_KM + heightKm;
  const d: Vec3 = [body[0] - up[0] * r, body[1] - up[1] * r, body[2] - up[2] * r];
  const dist = Math.hypot(d[0], d[1], d[2]);
  const e = dot(d, east);
  const n = dot(d, north);
  const u = dot(d, up);
  let az = Math.atan2(e, n) * R2D;
  if (az < 0) az += 360;
  return {
    az,
    el: Math.asin(u / dist) * R2D,
    radius: Math.asin(bodyRadiusKm / dist) * R2D,
    distanceKm: dist,
  };
}

/** Sun and Earth as seen from a site. Height is metres above the 1737.4 km reference sphere. */
export function skyFromSite(state: MoonState, site: LatLon, heightM = 0): { sun: SkyPosition; earth: SkyPosition } {
  const h = heightM / 1000;
  return {
    sun: skyPosition(state.sun, SUN_RADIUS_KM, site, h),
    earth: skyPosition(state.earth, EARTH_RADIUS_KM, site, h),
  };
}

/**
 * Share of a disc that shows above a level horizon line.
 * `clearance` is the height of the disc centre above the horizon, in the same
 * unit as `radius`.
 */
export function discFractionAbove(clearance: number, radius: number): number {
  const x = clearance / radius;
  if (x >= 1) return 1;
  if (x <= -1) return 0;
  return 1 - (Math.acos(x) - x * Math.sqrt(1 - x * x)) / Math.PI;
}
