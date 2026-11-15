# Selene's Compass

**A lunar landing site navigator.** Pick a place on the Moon and a date, and Selene's Compass shows where the Sun and Earth sit against the real horizon, how long solar power and a direct radio link to Earth will last, and how another site or date compares.

Selene is the Titan goddess of the Moon in Greek myth. A compass is for finding your way.

Built for the 2026 NASA Space Apps Challenge, "Lunar Landing Site Navigator". This is an independent project and is not endorsed by NASA.

## What it does

- **Choose a site** on a 3D Moon lit from the Sun's real direction, on a top-down map of the south pole, from a catalogue of past and candidate landing sites, or by typing coordinates.
- **See a year at a glance.** A stacked plot draws one line per lunar day, showing how far the Sun (or Earth) stands above the terrain.
- **Analyse a site.** Stand on the surface and look at the real skyline with the Sun and Earth at their true positions and sizes, Earth showing its real face and phase. Press Play to watch them move along the horizon. A timeline shows when each is in view over the next 29.5 days, and a simple calculator estimates solar power and the battery needed to ride through the longest dark spell.
- **Compare scenarios.** Pin any mix of sites and landing dates and read them side by side on one scale. Filter them by catalogue, hemisphere, terrain, latitude and longitude range, or minimum time in view, and sort by any column. The whole state lives in the page address, so a scenario can be shared as a link.
- **Save your own sites.** Drop a pin anywhere, save it as MY 01, MY 02 and so on, and give it a name. Saved sites, filters and open sections are kept in the browser's local storage only. There is no server, no account, and nothing is uploaded.

## How it works

- Sun and Earth positions come from the [Astronomy Engine](https://github.com/cosinekitty/astronomy) library. The Moon's orientation uses the IAU rotation model as coded in that library, so libration is included.
- The horizon is traced through NASA LOLA elevation data in 720 directions around the site, out to 400 km, allowing for the Moon's curvature.
- The Sun and Earth are treated as discs, so terrain can hide part of one.
- Everything is calculated in the browser. There is no server.

The About tab in the app gives every formula the code runs, the checks below, and each source with what was taken from it.

## How it was checked

`npm test` runs these checks.

| Check | Result |
|---|---|
| Sun and Earth direction against JPL Horizons, every 6 hours for 30 days from 14 March 2027, at 89.45°S 222.69°E and at the Apollo 11 site | Largest difference 0.0023° for the Sun, 0.0028° for Earth |
| Average illumination 2 m above ground, hourly from 1 January 2017 to 1 January 2037, at the four south-pole locations in Table 2 of Gläser et al. (2018) | Two within 2.5 percentage points of the published value, two 7 to 11 points lower (see below) |
| The same at LLS 01, the highest cell of this tool's grid about 180 m from Gläser et al.'s Connecting Ridge C1 | 88.7%, against 88.0% published for C1 |
| Floor of Shackleton crater over 2027 | Permanent shadow: no Sun and no Earth |
| Which way Earth is turned in the sky view, against the library's own Moon-overhead calculation on four dates | Within 1° |

The two locations that come out lower sit on crests that Gläser et al. describe as only twenty to forty metres wide. This tool's grid is 240 m, so a point on such a crest can land on the slope beside it. The full comparison, with the published and computed figures side by side, is on the About tab and in `src/checks.ts`. The JPL Horizons tables used are saved in `tests/fixtures/`.

## Sources

Each of these was read in full for the About page unless marked otherwise.

- **NASA LRO LOLA south-pole elevation grid LDEM_80S_80M**, product version 2.0, PDS Geosciences Node. Used for the horizon and the south-pole map, averaged to 240 m.
- **CGI Moon Kit**, NASA's Scientific Visualization Studio, visualizer Ernie Wright (STC), [item 4720](https://svs.gsfc.nasa.gov/4720/). Colour and elevation maps used for the globe.
- **Blue Marble: A Seamless Image Mosaic of the Earth**, NASA/Goddard Space Flight Center Scientific Visualization Studio. The Blue Marble Next Generation data is courtesy of Reto Stockli (NASA/GSFC) and NASA's Earth Observatory. [Item 2915](https://svs.gsfc.nasa.gov/2915/). Used to draw Earth in the sky view.
- **JPL Horizons**, NASA Jet Propulsion Laboratory. Used to check results.
- **IAU 2015 Resolution B3** ([arXiv:1510.07674](https://arxiv.org/abs/1510.07674)). The Sun's radius and the 1361 W/m² nominal solar irradiance.
- Gläser, P., Oberst, J., Neumann, G. A., Mazarico, E., Speyerer, E. J. and Robinson, M. S. (2018). Illumination conditions at the lunar poles: Implications for future exploration. *Planetary and Space Science* 162, 170–178. Read from the accepted manuscript on [NASA NTRS](https://ntrs.nasa.gov/citations/20170007365).
- Mazarico, E. et al. (2011). Illumination conditions of the lunar polar regions using LOLA topography. *Icarus* 211, 1066–1081. **Not read directly.** Cited only as Gläser et al. (2018) describe it.
- **Astronomy Engine** 2.1.19 by Don Cross and **three.js** 0.187, both MIT licensed. Astronomy Engine's own code and documentation were read. The book and IAU report they cite were not.
- Typefaces: Public Sans and Marcellus SC, SIL Open Font Licence 1.1.

## Use of AI

The code in this repository was written with AI assistance (Claude, by Anthropic), directed by the author. No AI-generated images, audio or video are used. The Moon and Earth imagery and the terrain are NASA data, and every figure the app shows is calculated from that data. The grain and small craters on the ground in the sky view are drawn by ordinary code as a texture and do not show real features.

## Run it

Needs Node.js 20 or newer.

```
npm install
npm start        # runs the site in the background at http://localhost:5173/
npm run status   # says whether it is running
npm stop         # stops it
npm test         # run the checks
npm run build    # writes the static site to dist/
```

`npm start` keeps running after the terminal is closed, and `npm restart` stops and starts it in one go. `npm stop` only ends this project's own server. If another program holds the port, it says so and leaves it alone. To run the site in the terminal instead, use `npm run dev` and press Ctrl+C to stop.

The processed data the site needs is already in `public/data/`. To rebuild it from the NASA originals, download these four files into `data-raw/` and run `npm run data`:

- `https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_80s_80m.img`
- `https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_4k.tif`
- `https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_16_uint.tif`
- `https://svs.gsfc.nasa.gov/vis/a000000/a002900/a002915/bluemarble-2048.png`

## Deploy to Cloudflare Pages

Connect the repository in Cloudflare Pages and set:

- Build command: `npm run build`
- Build output directory: `dist`

The site is fully static, so the free plan is enough.

## Licence

See [LICENSE](LICENSE).
