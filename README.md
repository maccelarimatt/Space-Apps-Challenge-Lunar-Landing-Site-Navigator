# Lunar Landing Site Navigator

A web tool for comparing lunar landing sites and dates. Pick a place on the Moon and a date, and it shows where the Sun and Earth sit against the real horizon, how long solar power and a direct radio link to Earth will last, and how another site or date compares.

Built for the 2026 NASA Space Apps Challenge, "Lunar Landing Site Navigator". This is an independent project and is not endorsed by NASA.

## What it does

- **Choose a site** on a 3D Moon lit from the Sun's real direction, on a top-down map of the south pole, from a list of past and candidate landing sites, or by typing coordinates.
- **See a year at a glance.** A stacked plot draws one line per lunar day, showing how far the Sun (or Earth) stands above the terrain.
- **Analyse a site.** Stand on the surface and look at the real skyline with the Sun and Earth at their true positions and sizes. A timeline shows when each is in view over the next 29.5 days, and a simple calculator estimates solar power and the battery needed to ride through the longest dark spell.
- **Compare scenarios.** Pin any mix of sites and landing dates and read them side by side on one scale. The whole state lives in the page address, so a scenario can be shared as a link.

## How it works

- Sun and Earth positions come from the [Astronomy Engine](https://github.com/cosinekitty/astronomy) library; the Moon's orientation uses the IAU rotation model, so libration is included.
- The horizon is traced through NASA LOLA elevation data in 720 directions around the site, out to 400 km, allowing for the Moon's curvature.
- The Sun and Earth are treated as discs, so terrain can hide part of one.
- Everything is calculated in the browser. There is no server.

The Method tab in the app explains this in plain language, with the limits.

## How it was checked

`npm test` runs these checks:

| Check | Result |
|---|---|
| Sun and Earth direction against JPL Horizons, every 6 hours for 30 days, at 89.45°S 222.69°E and at the Apollo 11 site | Largest difference 0.003° |
| Floor of Shackleton crater | Permanent shadow: no Sun and no Earth all year |
| Shackleton to de Gerlache ridge, Sun in view over 2027 | About 90% |
| Earth in view from that ridge over 2027 | About 51% |

The JPL Horizons tables used are saved in `tests/fixtures/`.

## Data and credits

- **NASA LRO / LOLA** gridded elevation, product `LDEM_80S_80M`, from the PDS Geosciences Node. Used for the horizon and the south-pole map, block-averaged to 240 m.
- **NASA Scientific Visualization Studio, CGI Moon Kit**: LRO Camera colour mosaic and LOLA elevation map. Used for the globe.
- **NASA JPL Horizons**: used to check results.
- **Astronomy Engine** by Don Cross and **three.js**, both MIT licensed.
- Typefaces: Public Sans and Marcellus SC, SIL Open Font Licence.

## Use of AI

The code in this repository was written with AI assistance (Claude, by Anthropic), directed by the author. No AI-generated images, audio or video are used. The Moon imagery and terrain are NASA data, and every figure the app shows is calculated from that data.

## Run it

Needs Node.js 20 or newer.

```
npm install
npm run dev      # open the address it prints
npm test         # run the checks
npm run build    # writes the static site to dist/
```

The processed data the site needs is already in `public/data/`. To rebuild it from the NASA originals, download these three files into `data-raw/` and run `npm run data`:

- `https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_80s_80m.img`
- `https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_4k.tif`
- `https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_16_uint.tif`

## Deploy to Cloudflare Pages

Connect the repository in Cloudflare Pages and set:

- Build command: `npm run build`
- Build output directory: `dist`

The site is fully static, so the free plan is enough.

## Licence

See [LICENSE](LICENSE).
