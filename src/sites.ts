import type { LatLon } from './astro/frame';

export interface Site extends LatLon {
  /** Catalogue number shown as "LLS 01". 0 means a custom pin. */
  no: number;
  name: string;
  group: 'pole' | 'elsewhere' | 'custom' | 'mine';
  /** One line on what the place is. */
  note: string;
  /** Where the coordinates come from, when that needs saying. */
  detail?: string;
}

// Crest sites are the highest point in the 240 m LOLA grid within a few
// kilometres of a reference point, so the pin sits on the ridge itself.
// Mission sites use the coordinates in NASA's NSSDC table (source S12 on the About page).
const NSSDC = 'NASA’s NSSDC Table of Anthropogenic Impacts and Spacecraft on the Moon (source S12)';

export const SITES: Site[] = [
  {
    no: 1,
    name: 'Connecting ridge',
    lat: -89.4455,
    lon: 222.686,
    group: 'pole',
    note: 'Crest between Shackleton and de Gerlache craters, one of the best-lit places near the pole.',
    detail:
      'Highest grid point within 2 km of 89.45°S 222.69°E, the Connecting Ridge point of Mazarico et al. (2011) as listed by Gläser et al. (2018), sources S7 and S8 on the About page.',
  },
  {
    no: 2,
    name: 'Shackleton rim',
    lat: -89.7786,
    lon: 204.274,
    group: 'pole',
    note: 'High point on the rim of Shackleton crater.',
    detail:
      'Highest grid point within 3 km of 89.78°S 204.27°E, the Shackleton point of Mazarico et al. (2011) as listed by Gläser et al. (2018), sources S7 and S8 on the About page.',
  },
  {
    no: 3,
    name: 'de Gerlache rim',
    lat: -88.6663,
    lon: 291.77,
    group: 'pole',
    note: 'High point on the rim of de Gerlache crater.',
    detail:
      'Highest grid point within 4 km of 88.67°S 291.8°E. Two published points on this rim lie inside that search: Point C of Bussey et al. (2010), 88.71°S 291.3°E, and GR1 “de Gerlache Rim” of De Rosa et al. (2012), 88.6952°S 291.7154°E, about 0.9 km from the pin (sources S20 and S21). The IAU Gazetteer gives the crater’s centre as 88.48°S 271.66°E and its diameter as 32.7 km (source S11).',
  },
  {
    no: 4,
    name: 'Ridge at 123.6°E',
    lat: -88.807,
    lon: 123.637,
    group: 'pole',
    note: 'A crest on the far side of Shackleton from the connecting ridge, near the most-illuminated point found by Bussey et al. (2010).',
    detail:
      'Highest grid point within 3 km of 88.74°S 124.5°E, the most-illuminated point in the abstract of Bussey et al. (2010). Their Table 2 gives it as 88.79°S 124.5°E, about 0.8 km from the pin. De Rosa et al. (2012) list SV1 “Shackleton Vicinity” at 88.8247°S 124.1359°E, about 0.6 km from the pin (sources S20 and S21).',
  },
  {
    no: 5,
    name: 'Malapert summit',
    lat: -85.9902,
    lon: 2.092,
    group: 'pole',
    note: 'Top of Mons Malapert, a mountain on the Earth-facing side of the pole, about 5 km above the Moon’s reference sphere in NASA’s LOLA data.',
    detail:
      'Highest grid point within 20 km of 86.0°S 0°E, a point between the Malapert points M1 (86.04°S 2.7°E) and M2 (86.00°S 357.1°E) of Bussey et al. (2010). The pin is about 2 km from M1 and from MP2 “Malapert Peak” of De Rosa et al. (2012), 86.0265°S 2.758°E (sources S20 and S21), and about 8 km from the centre of Mons Malapert in the IAU Gazetteer (source S11). Height from the LOLA grid (source S1).',
  },
  {
    no: 6,
    name: 'Mons Mouton, IM-2',
    lat: -84.7906,
    lon: 29.1957,
    group: 'pole',
    note: 'Where Intuitive Machines’ Athena lander touched down on 6 March 2025.',
    detail: `Coordinates and date from ${NSSDC}, and LROC’s image of the lander (source S13).`,
  },
  {
    no: 7,
    name: 'Nobile rim, VIPER',
    lat: -85.42,
    lon: 31.62,
    group: 'pole',
    note: 'Approximate site for NASA’s VIPER rover near the western edge of Nobile crater. Its delivery is planned for late 2027.',
    detail:
      'NASA chose a landing region near the western edge of Nobile crater in 2021 but published no single point, so this pin is placed by this tool, on Mons Mouton west of the crater (sources S11 and S14). NASA cancelled VIPER in 2024, then in September 2025 selected Blue Origin to deliver it in late 2027, subject to an option NASA has yet to take up (source S14).',
  },
  {
    no: 8,
    name: 'Shackleton floor',
    lat: -89.67,
    lon: 129.78,
    group: 'pole',
    note: 'Inside a permanently shadowed crater: never any Sun, never any Earth.',
    detail:
      'The centre of Shackleton crater as the IAU Gazetteer of Planetary Nomenclature gives it (source S11). Its floor is permanently shadowed (source S15), and this tool’s own check agrees.',
  },
  {
    no: 9,
    name: 'IM-1 Odysseus',
    lat: -80.13,
    lon: 1.44,
    // Just inside the terrain grid, so its horizon is real terrain to the south and missing to the north.
    group: 'pole',
    note: 'Intuitive Machines’ first lander, February 2024, near Malapert A crater.',
    detail: `Coordinates and date from ${NSSDC}, and NASA’s LRO report on the landing (source S13).`,
  },
  {
    no: 10,
    name: 'Chandrayaan-3',
    lat: -69.3741,
    lon: 32.32,
    group: 'elsewhere',
    note: 'India’s Vikram lander and Pragyan rover, August 2023.',
    detail: `Coordinates and date from ${NSSDC}, and LROC’s image of the site. Lander and rover names from ISRO (source S13).`,
  },
  {
    no: 11,
    name: 'Chang’e 4',
    lat: -45.4561,
    lon: 177.5885,
    group: 'elsewhere',
    note: 'China’s far-side lander, January 2019. Earth never rises here, so it talked to Earth through the relay satellite Queqiao.',
    detail: `Coordinates and date from ${NSSDC}. The relay from the China National Space Administration (source S13).`,
  },
  {
    no: 12,
    name: 'Chang’e 6',
    lat: -41.6385,
    lon: 206.0148,
    group: 'elsewhere',
    note: 'China’s far-side sample return, June 2024.',
    detail: `Coordinates and date from ${NSSDC}, and LROC’s image of the lander (source S13).`,
  },
  {
    no: 13,
    name: 'SLIM',
    lat: -13.316,
    lon: 25.251,
    group: 'elsewhere',
    note: 'Japan’s precision lander, January 2024.',
    detail: `Coordinates and date from ${NSSDC}, and LROC’s image of the lander. Its precision-landing aim from JAXA (source S13).`,
  },
  {
    no: 14,
    name: 'Apollo 11',
    lat: 0.67416,
    lon: 23.47314,
    group: 'elsewhere',
    note: 'Tranquility Base, July 1969.',
    detail: `Lunar module coordinates and date from ${NSSDC}. The name Tranquility Base from NASA’s Apollo Lunar Surface Journal (source S13).`,
  },
  {
    no: 15,
    name: 'Blue Ghost M1',
    lat: 18.562,
    lon: 61.81,
    group: 'elsewhere',
    note: 'Firefly Aerospace’s lander in Mare Crisium, March 2025.',
    detail: `Coordinates and date from ${NSSDC}. The site from Firefly Aerospace (source S13).`,
  },
  {
    no: 16,
    name: 'Apollo 17',
    lat: 20.1911,
    lon: 30.7723,
    group: 'elsewhere',
    note: 'Taurus-Littrow valley, December 1972.',
    detail: `Lunar module descent stage coordinates and date from ${NSSDC}. The valley from NASA Science (source S13).`,
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

/**
 * "LLS 05" for the built-in catalogue, "MY 03" for a site the visitor saved, and
 * "Custom site" for an unsaved pin, which never gets a number.
 */
export const catalogueNo = (site: Site) =>
  site.group === 'custom' ? 'Custom site' : `${site.group === 'mine' ? 'MY' : 'LLS'} ${String(site.no).padStart(2, '0')}`;

/** Number and name together, for labels that need both; a custom site is just "Custom site". */
export const siteTitle = (site: Site) => (site.no ? `${catalogueNo(site)} ${site.name}` : 'Custom site');

export const siteKey = (site: LatLon) => `${site.lat.toFixed(4)},${site.lon.toFixed(4)}`;
