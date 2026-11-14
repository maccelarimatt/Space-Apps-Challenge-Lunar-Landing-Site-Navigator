import type { LatLon } from './astro/frame';

export interface Site extends LatLon {
  /** Catalogue number shown as "LLS 01". 0 means a custom pin. */
  no: number;
  name: string;
  group: 'pole' | 'elsewhere' | 'custom';
  /** One line on what the place is and where its coordinates come from. */
  note: string;
}

// Crest sites are the highest point in the 240 m LOLA grid within a few
// kilometres of the published coordinates, so the pin sits on the ridge itself.
export const SITES: Site[] = [
  {
    no: 1,
    name: 'Connecting ridge',
    lat: -89.4455,
    lon: 222.686,
    group: 'pole',
    note: 'Crest between Shackleton and de Gerlache craters, one of the best-lit places near the pole. Highest grid point within 2 km of 89.45°S 222.69°E.',
  },
  {
    no: 2,
    name: 'Shackleton rim',
    lat: -89.7786,
    lon: 204.274,
    group: 'pole',
    note: 'High point on the rim of Shackleton crater. Highest grid point within 3 km of 89.78°S 204.27°E.',
  },
  {
    no: 3,
    name: 'de Gerlache rim',
    lat: -88.6663,
    lon: 291.77,
    group: 'pole',
    note: 'High point on the rim of de Gerlache crater. Highest grid point within 4 km of 88.67°S 291.8°E.',
  },
  {
    no: 4,
    name: 'Ridge at 123.6°E',
    lat: -88.807,
    lon: 123.637,
    group: 'pole',
    note: 'A well-lit crest on the far side of Shackleton from the connecting ridge. Highest grid point within 3 km of 88.74°S 124.5°E.',
  },
  {
    no: 5,
    name: 'Malapert summit',
    lat: -85.9902,
    lon: 2.092,
    group: 'pole',
    note: 'A 5 km mountain on the Earth-facing side of the pole. Highest grid point within 20 km of 86.0°S 0°E.',
  },
  {
    no: 6,
    name: 'Mons Mouton, IM-2',
    lat: -84.7906,
    lon: 29.1957,
    group: 'pole',
    note: 'Where Intuitive Machines’ Athena lander touched down on 6 March 2025.',
  },
  {
    no: 7,
    name: 'Nobile rim, VIPER',
    lat: -85.42,
    lon: 31.62,
    group: 'pole',
    note: 'Approximate site planned for NASA’s VIPER rover near the western rim of Nobile crater.',
  },
  {
    no: 8,
    name: 'Shackleton floor',
    lat: -89.67,
    lon: 129.78,
    group: 'pole',
    note: 'Inside a permanently shadowed crater: never any Sun, never any Earth.',
  },
  {
    no: 9,
    name: 'IM-1 Odysseus',
    lat: -80.13,
    lon: 1.44,
    group: 'elsewhere',
    note: 'Intuitive Machines’ first lander, February 2024, near Malapert A crater.',
  },
  {
    no: 10,
    name: 'Chandrayaan-3',
    lat: -69.373,
    lon: 32.319,
    group: 'elsewhere',
    note: 'India’s Vikram lander and Pragyan rover, August 2023.',
  },
  {
    no: 11,
    name: 'Chang’e 4',
    lat: -45.4446,
    lon: 177.5991,
    group: 'elsewhere',
    note: 'China’s far-side lander, January 2019. Earth never rises here, so it needs a relay satellite.',
  },
  {
    no: 12,
    name: 'Chang’e 6',
    lat: -41.6385,
    lon: 206.0148,
    group: 'elsewhere',
    note: 'China’s far-side sample return, June 2024.',
  },
  {
    no: 13,
    name: 'SLIM',
    lat: -13.316,
    lon: 25.251,
    group: 'elsewhere',
    note: 'Japan’s precision lander, January 2024.',
  },
  {
    no: 14,
    name: 'Apollo 11',
    lat: 0.6742,
    lon: 23.4731,
    group: 'elsewhere',
    note: 'Tranquility Base, July 1969.',
  },
  {
    no: 15,
    name: 'Blue Ghost M1',
    lat: 18.562,
    lon: 61.81,
    group: 'elsewhere',
    note: 'Firefly Aerospace’s lander in Mare Crisium, March 2025.',
  },
  {
    no: 16,
    name: 'Apollo 17',
    lat: 20.1908,
    lon: 30.7717,
    group: 'elsewhere',
    note: 'Taurus-Littrow valley, December 1972.',
  },
];

export function customSite(lat: number, lon: number): Site {
  return {
    no: 0,
    name: 'Custom site',
    lat,
    lon: ((lon % 360) + 360) % 360,
    group: 'custom',
    note: 'A point you chose.',
  };
}

export const catalogueNo = (site: Site) => (site.no ? `LLS ${String(site.no).padStart(2, '0')}` : 'LLS 00');

export const siteKey = (site: LatLon) => `${site.lat.toFixed(4)},${site.lon.toFixed(4)}`;
