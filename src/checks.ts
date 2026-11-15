// Figures quoted on the About page, kept here so the test suite can recompute
// them (tests/horizon.test.ts) and fail if the page and the model drift apart.

/**
 * Gläser et al. (2018), Table 2: south-pole locations with the highest average
 * illumination two metres above ground, 1 January 2017 to 1 January 2037,
 * sampled hourly, from a 20 m/pixel LOLA terrain model. Read from the accepted
 * manuscript, NASA NTRS 20170007365, page 12.
 *
 * `ours` is this tool at exactly the same coordinates, height and period,
 * hourly, on its 240 m grid:
 * - avg: mean share of the Sun's disc in view (Gläser's "average illumination")
 * - vis: share of hours with any part of the Sun in view ("solar visibility")
 * - shadowH: longest run of hours with no part of the Sun in view
 */
export interface IlluminationCheck {
  label: string;
  lat: number;
  lon: number;
  published: { avg: number; vis: number; shadowH: number };
  ours: { avg: number; vis: number; shadowH: number };
}

export const GLASER_TABLE_2: IlluminationCheck[] = [
  { label: 'Connecting Ridge C1', lat: -89.4398, lon: 222.83, published: { avg: 88.0, vis: 92.1, shadowH: 112 }, ours: { avg: 76.7, vis: 83.0, shadowH: 351 } },
  { label: 'Connecting Ridge C2', lat: -89.313, lon: 245.98, published: { avg: 78.1, vis: 82.0, shadowH: 165 }, ours: { avg: 75.6, vis: 81.9, shadowH: 166 } },
  { label: 'Shackleton S, first point', lat: -89.6866, lon: 197.19, published: { avg: 85.5, vis: 89.4, shadowH: 66 }, ours: { avg: 78.4, vis: 82.7, shadowH: 204 } },
  { label: 'Shackleton S, second point', lat: -89.7815, lon: 204.7, published: { avg: 82.1, vis: 89.8, shadowH: 65 }, ours: { avg: 83.4, vis: 88.0, shadowH: 65 } },
];

/** LLS 01, the highest cell of this tool's grid near Connecting Ridge C1, under the same settings. */
export const CREST_LLS01 = { lat: -89.4455, lon: 222.686, ours: { avg: 88.7, vis: 93.7, shadowH: 147 } };

/** Worst differences from JPL Horizons over 30 days at 6-hour steps (tests/astro.test.ts). */
export const HORIZONS_WORST_DEG = { sun: 0.0023, earth: 0.0028 };
