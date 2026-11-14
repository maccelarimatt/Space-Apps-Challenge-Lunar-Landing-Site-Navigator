# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: Vite + TypeScript + Three.js, no UI framework, deployed as a static site on Cloudflare Pages (free tier). Chosen because every calculation can run in the visitor's browser, so there is no server to pay for or keep alive during judging.

## Users

Primary: lunar mission planners (science and engineering teams) who must compare candidate landing sites and dates quickly, usually because a schedule slip or hardware problem has forced them to reconsider the original plan.

Secondary: educators and the public who want to understand why the Moon's south pole is such a hard place to land. When the two audiences conflict, planners win: precision and speed come first.

## Product Purpose

A tool for the 2026 NASA Space Apps Challenge "Lunar Landing Site Navigator". It shows where the Sun and Earth sit relative to the local horizon at a chosen lunar landing site and date, so a planner can judge solar power and direct-to-Earth communication windows, and compare alternatives.

Success: a planner can pick a site and a date and, within seconds, read whether the lander has sunlight and a line of sight to Earth, how long each lasts, and how another site or date compares.

Working title: "Lunar Landing Site Navigator" (placeholder; the owner may rename it).

## Positioning

Existing tools (NASA QuickMap, Moon Trek, JPL Horizons) hold the same information but need expert knowledge and many steps per site and date. This tool answers the one planning question directly and visually, and shows its working against JPL Horizons so the answer can be trusted.

## Operating Context

- Used on a laptop or desktop during mission planning discussions; also opened by hackathon judges from a public link, with no login.
- The flow is: choose a landing site (3D globe or top-down south-pole map, or typed coordinates), then analyse it (sky view from the ground, timeline of Sun and Earth visibility, power estimate), then compare pinned scenarios.
- Judged on five criteria: Impact, Creativity, Validity, Relevance, Presentation.

## Capabilities and Constraints

- Sun and Earth positions come from real ephemeris maths; terrain comes from NASA LRO/LOLA data. At least one NASA data source is mandatory.
- These are landing sites, not launch sites.
- Runs entirely client-side as a static site. Nothing that needs a paid server.
- Keep GPU demands modest so it runs on ordinary laptops.
- Dropped: fuel cost by launch date. On ice: a per-pixel suitability (heat) map. Stretch: surface temperature layer.
- AI assistance must be disclosed in the README and on the site. No NASA logos or mission insignia.
- All content in English.

## Brand Commitments

- Visual first, numbers in supporting panels: the owner wants the interface to explain through what is drawn, not through tables.
- Must not look like a sci-fi game HUD: no decorative telemetry, neon glow, or readouts that look technical but say nothing.

## Evidence on Hand

- Challenge brief: `Challenge/Lunar Landing Site Navigator.txt`.
- Submission guide: `Challenge/NASA Space Apps Challenge.pdf`.
- No testimonials, users, or benchmarks exist. Do not invent any. Accuracy claims must come from checks we actually run (for example against JPL Horizons).

## Product Principles

1. Answer the planner's question first: do I have power, do I have a link to Earth, and for how long?
2. Show Sun and Earth together; the useful window is when both are available.
3. Every number shown must be traceable to real data and stated assumptions.
4. Comparison is the point: a single site and date is only half an answer.
5. A newcomer should understand the picture even if they skip the numbers.

## Accessibility & Inclusion

Good/bad states must not rely on red versus green alone; use hues and shapes that colour-blind users can tell apart.
