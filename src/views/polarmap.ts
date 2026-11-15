// Top-down map of the south polar cap (80°S to the pole) for choosing an exact spot.
// Polar stereographic, the same projection as the LOLA elevation grid behind it.

import { MOON_RADIUS_KM, localAxes, type LatLon, type Vec3 } from '../astro/frame';
import { SOUTH_POLE_GRID, demLatLon, demPixel } from '../astro/horizon';
import { catalogueNo, siteKey, siteTitle, type Site } from '../sites';

const N = SOUTH_POLE_GRID.size;
const MPP = SOUTH_POLE_GRID.metresPerPixel;
const C = N / 2;
const D2R = Math.PI / 180;

/** Image position (pixels from the top-left corner) of a place, or null outside the map. */
function imagePoint(p: LatLon): { x: number; y: number } | null {
  const px = demPixel(SOUTH_POLE_GRID, p);
  return px ? { x: px.col + 0.5, y: px.row + 0.5 } : null;
}

const ringRadius = (lat: number) => (2 * MOON_RADIUS_KM * 1000 * Math.tan(((90 + lat) * D2R) / 2)) / MPP;

export interface MapApi {
  setBodies(sun: Vec3, earth: Vec3): void;
  setSites(sites: Site[], selected: Site): void;
  centreOn(site: LatLon): void;
  setActive(on: boolean): void;
}

export interface MapOptions {
  onPick(lat: number, lon: number): void;
  onSelect(site: Site): void;
}

export function createPolarMap(host: HTMLElement, opts: MapOptions): MapApi {
  host.innerHTML = `
    <div class="map-layer">
      <img class="relief" src="${import.meta.env.BASE_URL}data/spole-relief.webp" width="${N}" height="${N}" alt="" draggable="false">
      <svg class="grat" viewBox="0 0 ${N} ${N}" width="${N}" height="${N}" aria-hidden="true"></svg>
    </div>
    <div class="map-labels" aria-hidden="true"></div>
    <div class="pins"></div>
    <div class="map-scale" aria-hidden="true"><i></i><span></span></div>
    <p class="map-cursor" aria-hidden="true"></p>
    <p class="map-note" hidden>This site is outside the south-pole map. Switch to Globe to see it.</p>
    <div class="map-zoom">
      <button type="button" data-zoom="1.5" aria-label="Zoom in"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1v10M1 6h10"/></svg></button>
      <button type="button" data-zoom="0.667" aria-label="Zoom out"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 6h10"/></svg></button>
    </div>`;
  host.setAttribute('role', 'application');
  host.setAttribute('aria-label', 'Map of the lunar south pole. Drag to move, scroll to zoom, click to drop a pin.');

  const layer = host.querySelector<HTMLElement>('.map-layer')!;
  const grat = host.querySelector<SVGSVGElement>('.grat')!;
  const pins = host.querySelector<HTMLElement>('.pins')!;
  const note = host.querySelector<HTMLElement>('.map-note')!;

  // Latitude rings and longitude spokes.
  let g = '';
  for (let lat = -88; lat <= -80; lat += 2) g += `<circle cx="${C}" cy="${C}" r="${ringRadius(lat).toFixed(1)}"/>`;
  const rIn = ringRadius(-89.5);
  const rOut = ringRadius(-80);
  for (let lon = 0; lon < 360; lon += 30) {
    const s = Math.sin(lon * D2R);
    const c = Math.cos(lon * D2R);
    g += `<path d="M${(C + rIn * s).toFixed(1)} ${(C - rIn * c).toFixed(1)}L${(C + rOut * s).toFixed(1)} ${(C - rOut * c).toFixed(1)}"/>`;
  }
  grat.innerHTML = `<g class="lines">${g}</g><path class="ray sun"/><path class="ray earth"/>`;

  // Graticule labels live in screen space so they stay the same size at any zoom:
  // latitude on one meridian, longitude on two rings so some are always in view.
  const labelHost = host.querySelector<HTMLElement>('.map-labels')!;
  /** `outer` links an inner-ring longitude label to its twin on the outer ring, so only one shows at a time. */
  const labels: { el: HTMLElement; at: LatLon; outer?: LatLon }[] = [];
  const addLabel = (text: string, at: LatLon, outer?: LatLon) => {
    const el = document.createElement('span');
    el.textContent = text;
    labelHost.append(el);
    labels.push({ el, at, outer });
  };
  // On the 345°E meridian: clear of every catalogued site and of the longitude labels.
  for (let lat = -88; lat <= -82; lat += 2) addLabel(`${-lat}°S`, { lat, lon: 345 });
  // Longitudes on the 83°S ring, and again on the 87°S ring for when the outer ring is off screen.
  for (let lon = 30; lon < 360; lon += 30) {
    addLabel(`${lon}°E`, { lat: -83, lon });
    addLabel(`${lon}°E`, { lat: -87, lon }, { lat: -83, lon });
  }

  const scaleBar = host.querySelector<HTMLElement>('.map-scale i')!;
  const scaleText = host.querySelector<HTMLElement>('.map-scale span')!;
  const cursor = host.querySelector<HTMLElement>('.map-cursor')!;
  const sunRay = grat.querySelector<SVGPathElement>('.ray.sun')!;
  const earthRay = grat.querySelector<SVGPathElement>('.ray.earth')!;

  let scale = 0.3;
  let tx = 0;
  let ty = 0;
  let sites: Site[] = [];
  let selected: Site | null = null;
  let sun: Vec3 = [1, 0, 0];
  let earth: Vec3 = [1, 0, 0];
  let fitted = false;
  const pinEls = new Map<string, HTMLButtonElement>();

  function minScale() {
    return (Math.min(host.clientWidth, host.clientHeight) / N) * 0.9;
  }

  function clamp() {
    scale = Math.max(minScale(), Math.min(4, scale));
    // Keep at least a third of the viewport covered by the map.
    const w = host.clientWidth;
    const h = host.clientHeight;
    tx = Math.min(w * 0.67, Math.max(w * 0.33 - N * scale, tx));
    ty = Math.min(h * 0.67, Math.max(h * 0.33 - N * scale, ty));
  }

  function rays() {
    const draw = (el: SVGPathElement, body: Vec3) => {
      const from = selected && imagePoint(selected);
      if (!selected || !from) {
        el.setAttribute('d', '');
        return;
      }
      // Step half a degree along the surface toward the body and see which way that is on the map.
      const { east, north, up } = localAxes(selected);
      const e = body[0] * east[0] + body[1] * east[1] + body[2] * east[2];
      const n = body[0] * north[0] + body[1] * north[1] + body[2] * north[2];
      const len = Math.hypot(e, n) || 1;
      const a = 0.5 * D2R;
      const p: Vec3 = [0, 1, 2].map(
        (i) => Math.cos(a) * up[i] + (Math.sin(a) * (e * east[i] + n * north[i])) / len,
      ) as Vec3;
      const to = imagePoint({ lat: Math.asin(p[2]) / D2R, lon: Math.atan2(p[1], p[0]) / D2R });
      if (!to) {
        el.setAttribute('d', '');
        return;
      }
      const d = Math.hypot(to.x - from.x, to.y - from.y) || 1;
      const reach = 120 / scale;
      el.setAttribute(
        'd',
        `M${from.x.toFixed(1)} ${from.y.toFixed(1)}l${(((to.x - from.x) / d) * reach).toFixed(1)} ${(((to.y - from.y) / d) * reach).toFixed(1)}`,
      );
    };
    draw(sunRay, sun);
    draw(earthRay, earth);
  }

  type Box = { l: number; t: number; r: number; b: number };
  const hits = (a: Box, b: Box) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  const onScreen = (x: number, y: number) => x >= 0 && y >= 0 && x <= host.clientWidth && y <= host.clientHeight;
  // Label widths never change once drawn, so measure each once rather than on every frame of a drag.
  const widths = new WeakMap<HTMLElement, number>();
  const widthOf = (el: HTMLElement) => {
    let w = widths.get(el);
    if (!w) {
      w = el.offsetWidth;
      if (w) widths.set(el, w);
    }
    return w;
  };

  function apply() {
    clamp();
    layer.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    // Scale bar: the largest round distance that fits in about 140 px. True at the pole.
    const kmPerPx = MPP / 1000 / scale;
    const km = [200, 100, 50, 20, 10, 5, 2, 1].find((d) => d / kmPerPx <= 140) ?? 1;
    scaleBar.style.width = `${km / kmPerPx}px`;
    scaleText.textContent = `${km} km`;

    // Every site on the map gets its number, unless it would sit on top of another label. The selected
    // site goes first, then the rest in catalogue order. A label that does not fit on the right of its
    // pin tries the left. Those still crowded out appear as you zoom in, and on hover.
    const taken: Box[] = [];
    const placed: { el: HTMLButtonElement; x: number; y: number }[] = [];
    for (const site of sites) {
      const el = pinEls.get(siteKey(site));
      if (!el) continue;
      const p = imagePoint(site);
      el.hidden = !p;
      if (!p) continue;
      const x = tx + p.x * scale;
      const y = ty + p.y * scale;
      el.style.transform = `translate(${x}px, ${y}px)`;
      placed.push({ el, x, y });
      taken.push({ l: x - 5, t: y - 5, r: x + 5, b: y + 5 });
    }
    const order = placed.slice().sort((a, b) => Number(b.el.classList.contains('on')) - Number(a.el.classList.contains('on')));
    for (const { el, x, y } of order) {
      const w = widthOf(el.querySelector('b') as HTMLElement);
      const right = { l: x + 18, t: y - 10, r: x + 22 + w, b: y + 10 };
      const left = { l: x - 22 - w, t: y - 10, r: x - 18, b: y + 10 };
      const fits = (box: Box) => onScreen(box.l, box.t) && onScreen(box.r, box.b) && !taken.some((t) => hits(t, box));
      const side = el.classList.contains('on') ? right : fits(right) ? right : fits(left) ? left : null;
      el.classList.toggle('labelled', !!side);
      el.classList.toggle('flip', side === left);
      if (side) taken.push(side);
    }

    // Graticule labels are the quietest layer: they give way to site labels, and a longitude on the
    // inner ring only shows when its twin on the outer ring is off screen.
    for (const { el, at, outer } of labels) {
      const p = imagePoint(at)!;
      const x = tx + p.x * scale;
      const y = ty + p.y * scale;
      el.style.transform = `translate(${x}px, ${y}px)`;
      const o = outer && imagePoint(outer)!;
      const twinShown = !!o && onScreen(tx + o.x * scale, ty + o.y * scale);
      const w = widthOf(el) / 2;
      const box = { l: x - w, t: y - 7, r: x + w, b: y + 7 };
      // Visibility, not display, so the label keeps its size for the next frame's check.
      el.style.visibility = twinShown || taken.some((t) => hits(t, box)) ? 'hidden' : '';
    }

    note.hidden = !selected || !!imagePoint(selected);
    rays();
  }

  function zoomAbout(factor: number, cx: number, cy: number) {
    const next = Math.max(minScale(), Math.min(4, scale * factor));
    tx = cx - ((cx - tx) * next) / scale;
    ty = cy - ((cy - ty) * next) / scale;
    scale = next;
    apply();
  }

  function centre(p: LatLon, zoom?: number) {
    const pt = imagePoint(p) ?? { x: C, y: C };
    if (zoom) scale = zoom;
    clamp();
    tx = host.clientWidth / 2 - pt.x * scale;
    ty = host.clientHeight / 2 - pt.y * scale;
    apply();
  }

  function fit() {
    if (!host.clientWidth) return;
    if (!fitted) {
      fitted = true;
      // Open on the whole map, out to 80°S, so every site on it is in view. Zoom in for the crowded pole.
      centre({ lat: -90, lon: 0 }, Math.max(minScale(), Math.min(host.clientWidth, host.clientHeight) / (ringRadius(-80) * 2 + 24)));
    } else {
      apply();
    }
  }
  new ResizeObserver(fit).observe(host);

  host.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const r = host.getBoundingClientRect();
      zoomAbout(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    },
    { passive: false },
  );

  // The terrain grid is square, and its corners beyond 80°S hold real heights too, so the whole image can be picked.
  const onMap = (x: number, y: number) => x >= 0 && y >= 0 && x <= N && y <= N;

  let drag: { x: number; y: number; tx: number; ty: number; moved: boolean } | null = null;
  host.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    drag = { x: e.clientX, y: e.clientY, tx, ty, moved: false };
    host.setPointerCapture(e.pointerId);
  });
  host.addEventListener('pointermove', (e) => {
    // Live coordinates under the pointer, for placing a pin exactly.
    const r = host.getBoundingClientRect();
    const mx = (e.clientX - r.left - tx) / scale;
    const my = (e.clientY - r.top - ty) / scale;
    if (onMap(mx, my)) {
      const p = demLatLon(SOUTH_POLE_GRID, mx - 0.5, my - 0.5);
      cursor.textContent = `${(-p.lat).toFixed(2)}° S, ${p.lon.toFixed(2)}° E`;
    } else {
      cursor.textContent = '';
    }
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5) drag.moved = true;
    tx = drag.tx + e.clientX - drag.x;
    ty = drag.ty + e.clientY - drag.y;
    apply();
  });
  host.addEventListener('pointerup', (e) => {
    const d = drag;
    drag = null;
    if (!d || d.moved) return;
    const r = host.getBoundingClientRect();
    const x = (e.clientX - r.left - tx) / scale;
    const y = (e.clientY - r.top - ty) / scale;
    if (!onMap(x, y)) return;
    const p = demLatLon(SOUTH_POLE_GRID, x - 0.5, y - 0.5);
    opts.onPick(p.lat, p.lon);
  });
  host.addEventListener('pointercancel', () => (drag = null));
  host.addEventListener('pointerleave', () => (cursor.textContent = ''));

  host.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach((b) =>
    b.addEventListener('click', () => zoomAbout(+b.dataset.zoom!, host.clientWidth / 2, host.clientHeight / 2)),
  );

  return {
    setBodies(s, e) {
      sun = s;
      earth = e;
      rays();
    },
    setSites(list, sel) {
      sites = list;
      selected = sel;
      const wanted = new Set(list.map(siteKey));
      for (const [key, el] of pinEls) {
        if (!wanted.has(key)) {
          el.remove();
          pinEls.delete(key);
        }
      }
      for (const site of list) {
        const key = siteKey(site);
        let el = pinEls.get(key);
        if (!el) {
          el = document.createElement('button');
          el.type = 'button';
          el.className = 'pin';
          el.innerHTML = '<i></i><b></b>';
          el.addEventListener('click', () => opts.onSelect(site));
          pins.append(el);
          pinEls.set(key, el);
        }
        el.querySelector('b')!.textContent = catalogueNo(site);
        el.setAttribute('aria-label', siteTitle(site));
        el.title = site.name;
        el.classList.toggle('on', key === siteKey(sel));
      }
      apply();
    },
    centreOn(site) {
      if (imagePoint(site)) centre(site);
      else apply();
    },
    setActive(on) {
      if (on) fit();
    },
  };
}
