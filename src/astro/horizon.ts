// Terrain horizon around a landing site, from NASA LOLA elevation data.
//
// The south-pole elevation grid is a polar stereographic map (true scale at
// the pole) of heights relative to the 1737.4 km sphere. For each compass
// direction we walk outward along the curved surface and keep the steepest
// upward angle to any terrain: that is the horizon in that direction.

import { MOON_RADIUS_KM, localAxes, type LatLon, type Vec3 } from './frame';

const R_M = MOON_RADIUS_KM * 1000;
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/** Geometry of the south-pole grid: enough to convert between pixels and coordinates. */
export interface Grid {
  /** Pixels per side (square grid, pole at the centre). */
  size: number;
  /** Metres per pixel at the pole. */
  metresPerPixel: number;
}

export const SOUTH_POLE_GRID: Grid = { size: 2532, metresPerPixel: 240 };

export interface Dem extends Grid {
  /** Heights in metres above the 1737.4 km sphere, row-major, row 0 at the top (lon 0° points up). */
  heights: Int16Array;
  /** Latitude of the grid edge along the axes, degrees (negative, south). */
  edgeLat: number;
}

export interface Horizon {
  /** Elevation of the horizon in degrees, one entry per azimuth step starting at north, clockwise. */
  elevation: Float32Array;
  /** Distance to the terrain that sets the horizon, km (0 where the smooth sphere sets it). */
  distanceKm: Float32Array;
  /** Site height above the reference sphere, metres (terrain plus mast). */
  heightM: number;
  /** Ground height at the site, metres. */
  groundM: number;
  source: 'terrain' | 'sphere';
  /**
   * The skyline split by distance, nearest band first: the highest terrain
   * within each band of LAYER_EDGES_KM. Used to draw receding ridgelines.
   */
  layers: Float32Array[];
}

export const AZ_STEPS = 720;

/** Distance bands for the layered skyline, km. */
export const LAYER_EDGES_KM = [0, 3, 12, 45, 400];

/** Map coordinates (metres; x toward lon 90°E, y toward lon 0°) of a Moon-fixed unit vector. */
function stereo(p: Vec3): [number, number] {
  const k = (2 * R_M) / (1 - p[2]);
  return [k * p[1], k * p[0]];
}

/** Fractional pixel position of a site in the grid, or null when it falls outside. */
export function demPixel(dem: Grid, site: LatLon): { col: number; row: number } | null {
  const lat = site.lat * D2R;
  const lon = site.lon * D2R;
  const [x, y] = stereo([Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)]);
  const c = (dem.size - 1) / 2;
  const col = c + x / dem.metresPerPixel;
  const row = c - y / dem.metresPerPixel;
  if (col < 0 || row < 0 || col > dem.size - 1 || row > dem.size - 1) return null;
  return { col, row };
}

/** Latitude and longitude under a fractional pixel position. */
export function demLatLon(dem: Grid, col: number, row: number): LatLon {
  const c = (dem.size - 1) / 2;
  const x = (col - c) * dem.metresPerPixel;
  const y = (c - row) * dem.metresPerPixel;
  const r = Math.hypot(x, y);
  const lat = -90 + 2 * Math.atan(r / (2 * R_M)) * R2D;
  let lon = Math.atan2(x, y) * R2D;
  if (lon < 0) lon += 360;
  return { lat, lon };
}

function sample(dem: Dem, col: number, row: number): number {
  const n = dem.size;
  if (col < 0 || row < 0 || col > n - 1 || row > n - 1) return NaN;
  const c0 = Math.min(Math.floor(col), n - 2);
  const r0 = Math.min(Math.floor(row), n - 2);
  const fc = col - c0;
  const fr = row - r0;
  const i = r0 * n + c0;
  const h = dem.heights;
  return (
    h[i] * (1 - fc) * (1 - fr) + h[i + 1] * fc * (1 - fr) + h[i + n] * (1 - fc) * fr + h[i + n + 1] * fc * fr
  );
}

/** Ground height at a site, metres, or null outside the grid. */
export function groundHeight(dem: Dem | null, site: LatLon): number | null {
  if (!dem) return null;
  const p = demPixel(dem, site);
  return p ? sample(dem, p.col, p.row) : null;
}

/** Horizon of a perfectly smooth Moon for an observer `mastM` above it. */
export function sphereHorizon(mastM: number): Horizon {
  const dip = -Math.acos(R_M / (R_M + Math.max(mastM, 0))) * R2D;
  const elevation = new Float32Array(AZ_STEPS).fill(dip);
  return {
    elevation,
    distanceKm: new Float32Array(AZ_STEPS),
    heightM: mastM,
    groundM: 0,
    source: 'sphere',
    layers: [elevation],
  };
}

/**
 * Horizon profile for a site. `mastM` is the observer height above the ground
 * (a solar panel or antenna). Falls back to a smooth sphere outside the grid.
 */
export function computeHorizon(dem: Dem | null, site: LatLon, mastM = 2, maxRangeKm = 400): Horizon {
  const ground = groundHeight(dem, site);
  if (!dem || ground === null || Number.isNaN(ground)) return sphereHorizon(mastM);

  const { east, north, up } = localAxes(site);
  const ro = R_M + ground + mastM;
  const centre = (dem.size - 1) / 2;
  const mpp = dem.metresPerPixel;
  const maxRange = maxRangeKm * 1000;
  const firstStep = mpp * 0.5;
  // Beyond the grid the Moon itself is still there, so the limb of the reference
  // sphere is the lowest the horizon can be. An observer below that sphere (a
  // crater floor) has no such limb; terrain alone sets the horizon.
  const limb = ro > R_M ? -Math.acos(R_M / ro) : -Math.PI / 2;

  const elevation = new Float32Array(AZ_STEPS);
  const distanceKm = new Float32Array(AZ_STEPS);
  const bands = LAYER_EDGES_KM.length - 1;
  const layers = Array.from({ length: bands }, () => new Float32Array(AZ_STEPS).fill(limb * R2D));

  for (let i = 0; i < AZ_STEPS; i++) {
    const az = (i / AZ_STEPS) * 2 * Math.PI;
    const ca = Math.cos(az);
    const sa = Math.sin(az);
    const tx = ca * north[0] + sa * east[0];
    const ty = ca * north[1] + sa * east[1];
    const tz = ca * north[2] + sa * east[2];

    let best = limb;
    let bestD = 0;
    let band = 0;
    for (let d = firstStep; d < maxRange; d += Math.max(firstStep, d * 0.005)) {
      while (band < bands - 1 && d > LAYER_EDGES_KM[band + 1] * 1000) band++;
      const theta = d / R_M;
      const ct = Math.cos(theta);
      const st = Math.sin(theta);
      const px = ct * up[0] + st * tx;
      const py = ct * up[1] + st * ty;
      const pz = ct * up[2] + st * tz;
      const k = (2 * R_M) / (1 - pz) / mpp;
      const h = sample(dem, centre + k * py, centre - k * px);
      if (Number.isNaN(h)) break;
      const rt = R_M + h;
      const el = Math.atan2(rt * ct - ro, rt * st);
      if (el * R2D > layers[band][i]) layers[band][i] = el * R2D;
      if (el > best) {
        best = el;
        bestD = d;
      }
    }
    elevation[i] = best * R2D;
    distanceKm[i] = bestD / 1000;
  }

  return { elevation, distanceKm, heightM: ground + mastM, groundM: ground, source: 'terrain', layers };
}

/** Horizon elevation at any azimuth (degrees), linearly interpolated. */
export function horizonAt(h: Horizon, azDeg: number): number {
  const f = ((((azDeg % 360) + 360) % 360) / 360) * AZ_STEPS;
  const i = Math.floor(f) % AZ_STEPS;
  const j = (i + 1) % AZ_STEPS;
  const t = f - Math.floor(f);
  return h.elevation[i] * (1 - t) + h.elevation[j] * t;
}

/** Load the packed elevation grid: gzip of row-delta-encoded little-endian int16 metres. */
export async function loadDem(url: string, size: number, metresPerPixel: number): Promise<Dem> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Could not load terrain data (${res.status})`);
  const stream = res.body.pipeThrough(new DecompressionStream('gzip'));
  const buf = await new Response(stream).arrayBuffer();
  if (buf.byteLength !== size * size * 2) throw new Error('Terrain data is the wrong size');
  const heights = new Int16Array(buf);
  // Undo the delta coding: each value was stored as the difference from its left neighbour,
  // and the first value of each row as the difference from the row above.
  for (let r = 0; r < size; r++) {
    const o = r * size;
    if (r > 0) heights[o] += heights[o - size];
    for (let c = 1; c < size; c++) heights[o + c] += heights[o + c - 1];
  }
  const edgeLat = -90 + 2 * Math.atan(((size / 2) * metresPerPixel) / (2 * R_M)) * R2D;
  return { size, metresPerPixel, heights, edgeLat };
}
