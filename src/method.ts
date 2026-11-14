// Text of the Method tab. Every figure quoted here comes from the test suite
// (npm test) or from the data build (npm run data).

export const methodHtml = `
<div class="prose">
  <h1>Method and sources</h1>
  <p class="lede">A lander near the Moon’s south pole needs two things from its sky: the Sun, for power and warmth, and Earth, for a direct radio link. Both sit so close to the horizon there that a ridge a few kilometres away decides whether you have them. This tool works out where each one is against the real terrain, for any place and date.</p>

  <h2>What is calculated</h2>
  <p>For the chosen date the tool finds the direction from the Moon to the Sun and to Earth, turns that into a compass bearing and a height above level ground at the landing site, and compares it with the height of the terrain in that direction. The Sun and Earth are treated as discs, not points, so a ridge can hide part of one. A body counts as “in view” when more than half of its disc is above the terrain.</p>
  <ul>
    <li><b>Sun and Earth positions</b> use the open-source Astronomy Engine library. The Moon’s orientation uses the International Astronomical Union rotation model, so the monthly wobble (libration) that makes Earth bob up and down in a polar sky is included.</li>
    <li><b>The horizon</b> is traced through NASA laser-altimeter elevation data. From the site, the tool looks outward in 720 compass directions (every half degree) for up to 400 km, allowing for the Moon’s curvature, and keeps the steepest angle to any terrain. This follows the approach of Mazarico et al. (2011), who also used a 240 m grid.</li>
    <li><b>No atmosphere</b> means no bending of light and no twilight, so nothing more is needed at the horizon.</li>
    <li><b>Power</b> assumes a panel that turns to face the Sun and receives 1361 W/m² scaled by the share of the Sun’s disc in view. Dust, heat and panel ageing are not included.</li>
  </ul>

  <h2>How it was checked</h2>
  <ul>
    <li><b>Against JPL Horizons.</b> Sun and Earth bearings and heights were compared with NASA JPL’s Horizons system every six hours for 30 days at two sites (89.45°S 222.69°E and the Apollo 11 site). The largest difference was 0.003°, about one hundredth of the Sun’s radius.</li>
    <li><b>Against published illumination studies.</b> For a high point on the rim of Shackleton crater the tool finds the Sun in view for about 87% of 2027; Gläser et al. (2018) report 85.5% for the rim. The ridge between Shackleton and de Gerlache comes out near 90%, among the best-lit places at the pole, and the floor of Shackleton comes out in permanent shadow, as it should.</li>
    <li>These checks run automatically with the project’s tests.</li>
  </ul>

  <h2>Limits you should know about</h2>
  <ul>
    <li>Terrain is sampled every 240 m. Boulders, small craters and the lander’s own tilt are not represented, and a site a few hundred metres off a crest can behave very differently from the crest itself.</li>
    <li>Real terrain covers 80°S to the pole. Elsewhere the horizon is a smooth sphere, which is a fair approximation where the Sun and Earth ride high but not inside craters or valleys.</li>
    <li>Sites between 80°S and about 81.5°S are close to the edge of the grid, so hills further north are missing from their horizon.</li>
    <li>The shading of terrain in the sky view and on the map is illustrative. The outline of the skyline and the positions and sizes of the Sun and Earth are computed.</li>
    <li>The globe keeps a little fill light on the night side so sites can still be picked there.</li>
  </ul>

  <h2>Data and software</h2>
  <ul>
    <li><b>NASA LRO / LOLA</b> gridded elevation, product LDEM_80S_80M, from the Planetary Data System Geosciences Node. Used for the horizon and the south-pole map, averaged to 240 m.</li>
    <li><b>NASA Scientific Visualization Studio, CGI Moon Kit</b>: Lunar Reconnaissance Orbiter Camera colour mosaic and LOLA elevation map. Used for the globe.</li>
    <li><b>NASA JPL Horizons</b>. Used to check the results; not needed to run the tool.</li>
    <li><b>Astronomy Engine</b> by Don Cross (MIT licence) and <b>three.js</b> (MIT licence).</li>
    <li>Typefaces: Public Sans and Marcellus SC (SIL Open Font Licence).</li>
    <li>Site coordinates come from the missions’ published landing locations. The crest sites are the highest point in the elevation grid within a few kilometres of published coordinates.</li>
    <li>The “LLS” numbers are this tool’s own catalogue, used to keep sites apart on screen. They are not official designations.</li>
  </ul>

  <h2>Use of AI</h2>
  <p>The code for this site was written with AI assistance (Claude, by Anthropic), directed by the author. No AI-generated images, audio or video are used: the Moon imagery and terrain are NASA data, and every figure on screen is calculated in your browser.</p>

  <p class="fine">Built for the 2026 NASA Space Apps Challenge, “Lunar Landing Site Navigator”. This is an independent project and is not endorsed by NASA.</p>
</div>`;
