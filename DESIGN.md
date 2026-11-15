---
name: Selene’s Compass
description: A matte black catalogue sleeve where white hairlines carry the interface and colour appears only as decoded Sun, Earth and problem data.
colors:
  bg: "#0c0c0c"
  lift: "#181818"
  ink: "#f2f2f2"
  dim: "#a8a8a8"
  line: "#6a6a6a"
  rule: "#3a3a3a"
  rule-soft: "#262626"
  sun: "#ffc233"
  earth: "#39a0ed"
  block: "#ff6b45"
typography:
  display:
    fontFamily: "'Marcellus SC', 'Times New Roman', serif"
    fontSize: "76px"
    fontWeight: 400
    lineHeight: 0.9
    letterSpacing: "0.04em"
  headline:
    fontFamily: "'Marcellus SC', 'Times New Roman', serif"
    fontSize: "52px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.04em"
  figure:
    fontFamily: "'Public Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "'Public Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.45
  prose:
    fontFamily: "'Public Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: "'Public Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "'tnum'"
  secondary:
    fontFamily: "'Public Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.45
  identifier:
    fontFamily: "'Public Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.06em"
  wordmark:
    fontFamily: "'Marcellus SC', 'Times New Roman', serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.2em"
  label:
    fontFamily: "'Marcellus SC', 'Times New Roman', serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0.2em"
  math:
    fontFamily: "'Cambria Math', 'STIX Two Math', 'Latin Modern Math', math"
    fontSize: "19px"
    fontWeight: 400
  label-data:
    fontFamily: "'Marcellus SC', 'Times New Roman', serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0.1em"
rounded:
  none: "0px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  gutter-narrow: "16px"
  gutter: "24px"
  sleeve-inset: "32px"
components:
  button-outline:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "7px 12px"
  button-outline-active:
    backgroundColor: "{colors.lift}"
    textColor: "{colors.ink}"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
    rounded: "{rounded.none}"
    padding: "10px"
  button-icon:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    size: "30px"
  segment:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "5px 14px"
  segment-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.bg}"
    rounded: "{rounded.none}"
    padding: "5px 14px"
  input:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "6px 8px"
  tab:
    textColor: "{colors.dim}"
    typography: "{typography.body}"
    height: "52px"
  tab-current:
    textColor: "{colors.ink}"
  site-row:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "7px 6px"
  site-row-selected:
    backgroundColor: "{colors.lift}"
    textColor: "{colors.ink}"
  code-strip:
    height: "8px"
    width: "30px"
  code-strip-large:
    height: "10px"
    width: "132px"
  figure-readout:
    textColor: "{colors.ink}"
    typography: "{typography.figure}"
    padding: "12px"
---

# Design System: Selene’s Compass

## Overview

**Creative North Star: "The Catalogue Sleeve"**

The interface is a record sleeve for a place: matte black ground, a large engraved catalogue number, and a year at one landing site drawn as a stack of white lines. White hairline is the body ink. Grey carries secondary text. Everything a visitor operates is white, either as an outline or as a solid block.

Colour is not decoration here; it is a key. Yellow is always the Sun, blue is always Earth, vermilion is always a problem. Because colour means something each time it appears, it never sits on a button, a tab, a border or a heading. State is drawn twice, once by hue and once by fill (solid, hatched, empty), so a reading survives colour blindness and greyscale.

The density is that of a working tool: three columns filling one desktop viewport, 13px text, tabular figures, hairline rules between things instead of boxes around them. Nothing glows, nothing floats, and nothing on screen is a figure that was not computed. The system rejects the sci-fi game HUD: no decorative telemetry, no neon, no translucent panels over a full-bleed globe.

**Key Characteristics:**
- Matte black ground with white hairline as ink; one dark theme only.
- Three data hues with fixed meanings, plus white for "both"; no hue on any control.
- State carried by fill as well as hue: solid, hatched, empty.
- Engraved small caps for the catalogue number and tracked labels; a plain grotesque for everything read or operated.
- Square corners on every control and container; circles only for map pins and celestial bodies.
- Hairline rules, no boxes, no cast shadows, no glow.
- One authored motion: ridge lines drawing in left to right.

## Colors

A neutral black-to-white scale with no tint, and three saturated hues that appear only where they decode data.

### Primary
- **Sleeve White** (`ink`): body text, the ridge lines, focus rings, solid primary buttons, the pressed half of a segmented toggle, and the "both in view" data state. It is the system's only interface ink.

### Secondary
- **Sun Yellow** (`sun`): anything that is the Sun. The Sun's block in the status strip, its bars in the window lanes, its bearing on the globe and map, its disc and track in the sky view, and the current lunar day in the ridge plot when the Sun is plotted.
- **Earth Blue** (`earth`): anything that is Earth, in exactly the same places.

### Tertiary
- **Problem Vermilion** (`block`): problems only. The bracket marking the longest stretch out of view, and form error text. It never marks a neutral or positive state.

### Neutral
- **Matte Black** (`bg`): the page ground, control backgrounds, the fill behind each ridge so nearer lines hide farther ones, and the plate behind map chips and scale bars.
- **Lifted Black** (`lift`): the selected and hovered site row, and a pressed button. The only tonal step above the ground.
- **Secondary Grey** (`dim`): secondary text, tracked labels, axis text, unselected tabs.
- **Control Hairline** (`line`): the resting border of buttons and inputs, the dashed level line, list bullets.
- **Rule** (`rule`): structural hairlines: under the top bar, around the figure readout, the baseline under each ridge, empty lane outlines.
- **Soft Rule** (`rule-soft`): row separators inside lists and tables, plot gridlines.

### Named Rules
**The Decoded Colour Rule.** Yellow is the Sun, blue is Earth, vermilion is a problem. A hue appears only on a mark or label that means that thing, and never on a control, a border, a heading or a background.

**The Fill-and-Hue Rule.** Every state is drawn by fill as well as hue: solid means the whole disc is in view, 45-degree hatching means partly hidden, an empty outline means out of view. A state that only changes colour is not finished.

**The White Control Rule.** Anything the visitor operates is white: a hairline outline at rest, solid white with black text when it is the primary action or the pressed option.

## Typography

**Display Font:** Marcellus SC (with Times New Roman, serif)
**Body Font:** Public Sans (with system-ui, -apple-system, Segoe UI, sans-serif)
**Label Font:** Marcellus SC, tracked

**Character:** An engraved small-caps face gives the catalogue number and labels the look of lettering cut into a sleeve; a plain, even grotesque with tabular figures does all the reading and all the numbers. The two never swap jobs.

### Hierarchy
- **Display** (400, 76px, line-height 0.9, 0.04em): the catalogue number of the selected site, once per screen. A point the visitor chose has no number: it reads "Custom site" at 56px (44px at 1280px wide, 40px in short windows), with its coordinates standing in for the site name. Steps to 60px at 1280px wide and below, 52px in short windows, and `clamp(48px, 15vw, 76px)` in the single-column layout.
- **Headline** (400, 52px, line-height 1, 0.04em): the title on the Compare page. 40px in the single-column layout. The About page title is set at Display size (76px), and its section heads at 30px in the same engraved face (26px in the single-column layout).
- **Figure** (Public Sans 600, 22px, line-height 1.2): the three answer figures (Sun, Earth, both).
- **Title** (Public Sans 600, 15px): the site name under the catalogue number.
- **Prose** (Public Sans 400, 14px, line-height 1.6, max 70ch): long-form reading on the About page only. Its lede is 17px. Equations there are native MathML in Cambria Math (falling back to STIX Two Math and Latin Modern Math), 19px on their own lines and 15px in the running text, with bold vectors from the Unicode bold alphabet.
- **Body** (Public Sans 400, 13px, line-height 1.45, tabular figures): default text, controls, table cells. Emphasis is 600; the selected row and best value are 700.
- **Secondary** (Public Sans 400, 12px): hints, captions, axis text, field labels, coordinates. Usually in Secondary Grey.
- **Identifier** (Public Sans 600, 12px, 0.06em): small codes such as the site chip on the globe.
- **Wordmark** (Marcellus SC 400, 16px, 0.2em): the product name in the top bar.
- **Label** (Marcellus SC 400, 13px, 0.2em, Secondary Grey): section headings inside a column. An untracked 12px Public Sans qualifier may follow on the same line.
- **Data label** (Marcellus SC 400, 12px, 0.1em to 0.14em): names attached to a data mark: the figure captions, the Sun and Earth tags in the sky view and horizon strip.

### Named Rules
**The Two Small Sizes Rule.** Below the 14px prose size there are exactly two sizes: 13px for body and 12px for secondary. In the single-column layout both rise together (15px and 13px). Nothing is set smaller than 12px.

**The Legible Identifier Rule.** Small identifiers are set in Public Sans, not the engraved caps, because at 12px the engraved face turns "01" into "OI". Marcellus SC carries a catalogue number only at display size.

**The Cut Caps Rule.** Marcellus SC is already a small-caps face: source text stays in sentence case and is never uppercased with CSS. It is always weight 400 and always tracked (0.04em at display sizes, 0.1em to 0.2em at label sizes).

## Layout

On desktop the body is exactly one viewport tall (100dvh) and does not scroll; each column scrolls on its own if it must. A top bar (52px minimum, hairline beneath) holds the wordmark, four text tabs and the date and time controls. Below it sit three columns: a 264px site list, a fluid stage, and a 520px sleeve for the selected site. The site list belongs to choosing and shows on Choose site only. Compare is one full-width page with its own picker (see Site picker). Analyse gives its column to the sky view (stage and sleeve only), and About is the page alone: a sticky contents list and one 760px reading column, centred, with figures set as plates between two Rules and numbered captions (Fig. 1 to Fig. 4). Its figures follow the same colour rules as the rest of the app: the Sun yellow and Earth blue only where they are the Sun and Earth, white for everything drawn as structure. Sources are listed as a numbered discography (S1, S2, …) with a small-caps label above each part of an entry.

The stage is unframed: the globe or map sits directly on the black ground with no border, panel or card, and its controls are pinned to its corners. The sleeve reads top to bottom as catalogue number, status strip, site name with one plain sentence about the place, the three answer figures, then the plot and the actions. On the Analyse tab the actions follow the figures and the detail sits beneath. The first read is the answer; the working (coordinates and geometry, totals, the power model, coordinate entry) is folded into disclosures that start closed and stay open once a visitor opens them.

Spacing is tight and irregular by purpose rather than a fixed step scale: 6px between adjacent controls, 8px to 12px inside groups, 24px outer gutter, 32px inset on the left of the sleeve, 20px to 24px between sections. Running text is capped between 62ch and 74ch.

Responsive behaviour:
- **1280px and below:** columns become 250px, fluid, 420px; the display number drops to 60px.
- **Short windows (above 980px wide, 820px tall or less):** the ridge plot gives up height (140px minimum instead of 250px), the display number drops to 52px, and the site note clamps to two lines so the readout and actions stay whole.
- **980px and below:** one column and the page scrolls. Order is stage, sleeve, site list. Gutters are 16px, body text is 15px, and the tabs scroll sideways.
- **560px and below:** the three figures stack with soft rules between them, and the date and time fields take a full row above the step buttons.

## Elevation & Depth

The system is flat. There are no cast shadows, no glow, no blur and no translucent panels. Depth is conveyed in three ways only: a single tonal step (Lifted Black) for the selected or hovered row; occlusion in the ridge plot, where each ridge is filled with the ground colour so it hides the lines behind it; and lighting on the Moon itself, which is data (the Sun's real direction), not styling.

### Named Rules
**The Ground Halo Rule.** The only shadow-like device is a halo in the ground colour: a text halo behind map and overhead labels, a ground-coloured stroke behind horizon-strip tags, a 1px ground ring around a pin. Its job is to keep a label readable over imagery or a line. It is never lighter than the ground and never offset.

**The Hairline Rule.** Things are separated by a 1px rule, not enclosed in a box. A border on all four sides is reserved for controls.

## Shapes

Every control and container has square corners (0px radius). Borders are 1px; the emphasised strokes are the selected ridge (2.4px), bearings on the map (1.6px), and brackets (1.5px). Circles belong to things that are round in the world: site pins (a 6px dot, with a 1.5px white ring when selected) and the Sun and Earth discs. The recurring small geometry is the 8px square: the status blocks, the swatch before each figure caption, the overhead markers. The second recurring mark is the three-sided bracket, open at the top, used for the map scale bar in white and for the longest-outage marker in vermilion.

## Components

### Buttons
- **Shape:** square (0px radius), 1px border.
- **Outline (default):** Matte Black fill, Control Hairline border, white text, 7px 12px padding. Hover brightens the border to white over 0.15s; pressed fills with Lifted Black.
- **Primary:** solid Sleeve White with black 600-weight text; hover goes to pure white. One per group. In the paired action row both buttons are 600 weight with 10px padding and share the width equally.
- **Icon:** 30px square outline button holding a 12px stroked SVG (1.4px stroke, no fill).
- **Text button:** no border or fill; underlines on hover (3px offset). Used for a site name that opens that site.
- **Focus:** 2px white outline, 2px offset, on every focusable element.

### Segmented toggle
A white 1px frame around two or more borderless options. The pressed option is solid white with black 600-weight text; the others are white text on black. Padding 5px 14px, or 3px 12px in the small variant used in a section heading row.

A lone toggle button (Now, in the top bar) follows the same rule: solid white with black 600-weight text while it is on, outline while it is off.

### Disclosure
A full-width row under a Rule that opens the detail beneath it. The row is a Label in Sleeve White (not grey, because it is operated), with a drawn 11px plus at the right that becomes a minus when open, in the same 1px strokes as the icon buttons. An optional 12px Secondary Grey result may sit right-aligned before the mark so the row still says something while closed. Hover fills the row with Lifted Black, as on a site row. Disclosures start closed and their open state is remembered per browser. Anything hidden in one must not be the only place an error or a loading state is shown.

### Saved sites
A site the visitor saves joins its own catalogue series, "MY 01", "MY 02", numbered in order and never reused, and is set in the same places and styles as an LLS number. An unsaved pin has no number and reads "Custom site". Under the site name sit small outline buttons (4px 10px, 12px text): "Save to My sites" for a pin, "Rename" and "Remove from My sites" for a saved site. Remove takes a second click to confirm. Saving asks for a name before anything is stored: the name swaps for an empty field ("Name this site") with a solid white "Save site" and an outline "Cancel", and a blank name is refused with a vermilion line beneath. Renaming uses the same field, filled in, with "Save name". Saved sites lead the site list under "My sites" when there are any.

### Filter bar
On Compare, the common filters sit in one row under a Rule: segmented toggles for Show (All, LLS catalogue, My sites, Pins) and Hemisphere (Both, South, North), a lone on/off toggle for Real terrain only, and the Mission length select. The rest fold into a "More filters" disclosure: sliders for the minimum shares in view and the maximum gaps, each with its value (or "any" at the no-limit end) read out in white at the right of its label, and number pairs for the latitude and longitude ranges. A one-line count ("Showing 2 of 5 scenarios.") with an outline "Clear filters" appears only while something is filtered. Sorting sits above the table as one select, and every numeric column header is also a sort button. The sorted column has an underlined header and bold cells.

### Site picker
Compare picks several sites at once, so it does not reuse the single-choice site list. Sites are set as a grid of catalogue tiles (232px minimum, 8px apart, two to a row on a phone), grouped under small-caps headings: My sites, South pole, Elsewhere, and any unsaved pin. Each tile holds the catalogue number, the name, the coordinates and the three-block status strip, with a drawn check box at the top right. Pressed means "in the comparison at the landing date": white border, Lifted Black fill and a solid white box with a black tick. "Add all shown" and "Remove all shown" act on whatever the filters leave visible.

From 1180px wide the picker becomes a 320px column to the right of the table, 32px apart, so a pick and its row are seen together. The column is sticky, scrolls on its own, and its tiles drop to two lines (number and name, then coordinates and status strip). A row just added is lit Lifted Black and fades back over 1.8s (held still under reduced motion), and the table scrolls just far enough to show it. Below 1180px the table comes first and the tile grid follows it.

### Inputs / Fields
- **Style:** Matte Black fill, 1px Control Hairline border, square, 6px 8px padding, 13px text. Border brightens to white on hover.
- **Label:** a 12px Secondary Grey label stacked 3px above the field. Units sit after the field in white.
- **Error:** one line of 12px Problem Vermilion text under the form.

### Navigation
Text tabs in the top bar, 13px, Secondary Grey at rest, white on hover. The current tab is white with a 1px white underline that sits on the bar's bottom rule. No pills, no fills. In the single-column layout the tab row scrolls horizontally.

### Site row
A full-width row: catalogue number in 12px Secondary Grey (46px column), site name, and the 30px status strip at the right. Rows are separated by a Soft Rule. Hover and selection fill the row with Lifted Black; the selected row is 700 weight and its number turns white.

### Status code strip (signature)
Three adjoining blocks, always in the order Sun, Earth, both, 1px apart: yellow, blue, white. Each block is solid (in view), hatched at 45 degrees with a hue outline (partly hidden), or an empty grey outline (out of view). It appears at 30 by 8px in each site row, and at 132 by 10px under the catalogue number.

### Key
Under the site list, the strip is explained one line per meaning: three lines for position and hue (the named block solid, the other two held back at 22% opacity), then three for fill (all three solid, striped, empty). Each line is a 30px strip, a white bold term and a grey phrase short enough to sit on one line in the 264px column. Under the window lanes the same fills are keyed in a single wrapping row, with the vermilion bracket for the longest hidden stretch.

### Figure readout
Three columns between two Rules, divided by vertical Rules. Each holds a Data label preceded by an 8px square in its hue (hollow when the state is off), a 22px figure, and one or two 12px grey lines saying in plain words what the figure means for the lander ("of sunlight until it sets", "without a radio link until it rises"). Angles and other geometry belong in the Site details disclosure, not here.

### Ridge plot (signature)
One white 1.1px line per lunar day, stacked top to bottom, peaks free to climb over the rows above. Each ridge is filled with the ground colour and sits on a Rule baseline; a hidden spell is a gap in the line. The lunar day holding the chosen date is the only coloured line, 2.4px in the hue of the body being plotted, with a dot and tick at the chosen time. Hover shows a dashed grey crosshair and a one-line reading beneath; click moves the date. **Motion:** when the site changes, the lines draw in once from left to right (1.1s, `cubic-bezier(0.16, 1, 0.3, 1)`, each row 40ms after the one above). This is the only entry animation in the system and it is removed under `prefers-reduced-motion`.

### Window lanes
Horizontal bars on a shared time axis, one lane each for Sun, Earth and both, on an empty Rule-outlined bed. Solid, hatched and empty follow the Fill-and-Hue Rule. A vermilion three-sided bracket marks the longest stretch out of view. The same lanes repeat in each row of the Compare table so rows can be read against each other.

### Data table
No outer border and no zebra striping. Header cells are 12px Secondary Grey above a Rule; body rows are separated by Soft Rules with 12px vertical padding; numeric columns are right-aligned. The best value in a column is 700 weight with a small tracked "most" tag beneath.

### Sky view
The view from the ground is a picture, like the globe, not a chart: lit lunar ground under a black sky, the Sun as a yellow disc and Earth with its real face and phase. Its lighting is depiction and follows the Sun's real direction. The Sun carries a tight glare (about three solar radii) that fades as terrain covers it; this is the one place a glow is allowed, because it depicts the Sun, and it never appears on interface. The skyline keeps a single fine white line so the edge that hides the Sun can be read exactly. Guide lines (the level line and the paths over the lunar day) are off until the Paths toggle is pressed. Play runs the clock; while it runs the date is shown in the corner of the picture.

### Stage overlays
Labels over the globe, map and sky are plain text with a ground halo, or sit on a small Matte Black plate with no border. The selected site chip is the only bold label. Graticule lines are white at 32% opacity; Sun and Earth bearings are 1.6px lines in their hues.

## Do's and Don'ts

### Do:
- **Do** keep yellow for the Sun, blue for Earth and vermilion for problems, everywhere, with no exceptions.
- **Do** draw every state with fill as well as hue: solid, 45-degree hatch, empty outline.
- **Do** make every control white: a 1px hairline outline at rest, solid white with black text for the primary action or pressed option.
- **Do** keep corners square (0px) on controls and containers; reserve circles for pins and celestial bodies.
- **Do** separate with 1px rules (Rule for structure, Soft Rule between rows) instead of enclosing in boxes.
- **Do** set text at 13px and secondary text at 12px with tabular figures, and set small identifiers in Public Sans.
- **Do** use Marcellus SC at weight 400, tracked, in sentence-case source, for the catalogue number, page titles and labels only.
- **Do** give labels over imagery a halo or plate in the ground colour so they stay readable.
- **Do** show a 2px white focus outline with 2px offset on every focusable element.

### Don't:
- **Don't** put a data hue on a button, tab, border, heading or background.
- **Don't** signal a state by colour alone, and never by red against green.
- **Don't** add cast shadows, glow, blur, gradients or translucent panels to the interface; this must not read as a sci-fi game HUD. (The Sun's glare inside the sky view is depiction, not interface.)
- **Don't** show decorative telemetry: every figure on screen is computed.
- **Don't** round the corners of controls, wrap sections in cards, or frame the Moon.
- **Don't** introduce a third small text size or set anything below 12px.
- **Don't** set body text, numbers or small identifiers in Marcellus SC, and don't uppercase it with CSS.
- **Don't** animate entry of anything other than the ridge lines, and don't play that under `prefers-reduced-motion`.
- **Don't** add a light theme; the sleeve is black.
