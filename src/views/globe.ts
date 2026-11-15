// The whole Moon in 3D, lit from the Sun's real direction for the chosen time.
// Renders only when something changes, so an idle page costs the GPU nothing.

import {
  AmbientLight,
  BufferGeometry,
  DirectionalLight,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  SRGBColorSpace,
  Scene,
  SphereGeometry,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { localAxes, surfaceNormal, type LatLon, type Vec3 } from '../astro/frame';
import { catalogueNo, siteKey, siteTitle, type Site } from '../sites';

const DATA = `${import.meta.env.BASE_URL}data/`;
const D2R = Math.PI / 180;

/** Moon-fixed (x: 0°E, y: 90°E, z: north) to three.js (y up). */
const toThree = (v: Vec3) => new Vector3(v[1], v[2], v[0]);

export interface GlobeApi {
  setBodies(sun: Vec3, earth: Vec3): void;
  setSites(sites: Site[], selected: Site): void;
  flyTo(site: LatLon, animate?: boolean): void;
  setActive(on: boolean): void;
}

export interface GlobeOptions {
  onPick(lat: number, lon: number): void;
  onSelect(site: Site): void;
}

export function createGlobe(host: HTMLElement, opts: GlobeOptions): GlobeApi | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const canvas = renderer.domElement;
  canvas.className = 'globe-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'The Moon, lit from the Sun’s direction at the chosen time. Drag to turn, scroll to zoom, click to drop a pin.');
  host.append(canvas);

  const pins = document.createElement('div');
  pins.className = 'pins';
  host.append(pins);

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.05, 50);
  camera.position.set(1.2, -3.9, 1.9);

  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.minDistance = 1.12;
  controls.maxDistance = 6;
  controls.zoomSpeed = 0.7;

  const loader = new TextureLoader();
  const colour = loader.load(`${DATA}moon-color-4k.jpg`, () => (dirty = true));
  colour.colorSpace = SRGBColorSpace;
  colour.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const normal = loader.load(`${DATA}moon-normal-4k.jpg`, () => (dirty = true));
  normal.anisotropy = colour.anisotropy;

  const moon = new Mesh(
    new SphereGeometry(1, 192, 96),
    new MeshStandardMaterial({ map: colour, normalMap: normal, normalScale: new Vector2(1.6, 1.6), roughness: 1, metalness: 0 }),
  );
  // Put longitude 0° (the texture's centre) on +Z, where toThree() puts it.
  moon.rotation.y = -Math.PI / 2;
  scene.add(moon);

  const sunLight = new DirectionalLight(0xffffff, 4.2);
  scene.add(sunLight);
  // A little fill so the night side and polar shadows stay readable for picking sites.
  scene.add(new AmbientLight(0xffffff, 0.14));

  const arc = (colourHex: number) => {
    const line = new Line(new BufferGeometry(), new LineBasicMaterial({ color: colourHex, depthTest: false, transparent: true }));
    line.renderOrder = 2;
    line.visible = false;
    scene.add(line);
    return line;
  };
  const sunArc = arc(0xffc233);
  const earthArc = arc(0x39a0ed);

  let dirty = true;
  let active = true;
  let sites: Site[] = [];
  let selected: Site | null = null;
  let sunDir = new Vector3(1, 0, 0);
  let earthDir = new Vector3(0, 0, 1);
  const pinEls = new Map<string, HTMLButtonElement>();
  const overhead = (cls: string, text: string) => {
    const el = document.createElement('span');
    el.className = `overhead ${cls}`;
    el.textContent = text;
    pins.append(el);
    return el;
  };
  const sunMark = overhead('sun', 'Sun overhead');
  const earthMark = overhead('earth', 'Earth overhead');

  function buildArc(line: Line, from: Vector3, toward: Vector3) {
    // Great-circle path from the site toward the point where the body is overhead.
    const tangent = toward.clone().addScaledVector(from, -toward.dot(from));
    if (tangent.lengthSq() < 1e-9) {
      line.visible = false;
      return;
    }
    tangent.normalize();
    const span = Math.min(Math.acos(Math.max(-1, Math.min(1, from.dot(toward)))), 0.5);
    const pts: number[] = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * span;
      const p = from.clone().multiplyScalar(Math.cos(a)).addScaledVector(tangent, Math.sin(a)).multiplyScalar(1.004);
      pts.push(p.x, p.y, p.z);
    }
    line.geometry.dispose();
    line.geometry = new BufferGeometry();
    line.geometry.setAttribute('position', new Float32BufferAttribute(pts, 3));
    line.visible = true;
  }

  function refreshArcs() {
    if (!selected) return;
    const n = toThree(surfaceNormal(selected));
    buildArc(sunArc, n, sunDir);
    buildArc(earthArc, n, earthDir);
    dirty = true;
  }

  const size = new Vector2();
  const tmp = new Vector3();
  function place(el: HTMLElement, dir: Vector3) {
    // Hide anything on the far side of the globe from the camera.
    const facing = tmp.copy(camera.position).sub(dir).dot(dir) > 0;
    if (!facing) {
      el.hidden = true;
      return;
    }
    tmp.copy(dir).project(camera);
    el.hidden = false;
    el.style.transform = `translate(${((tmp.x + 1) / 2) * size.x}px, ${((1 - tmp.y) / 2) * size.y}px)`;
  }

  function render() {
    renderer.render(scene, camera);
    for (const site of sites) {
      const el = pinEls.get(siteKey(site));
      if (el) place(el, toThree(surfaceNormal(site)));
    }
    place(sunMark, sunDir);
    place(earthMark, earthDir);
  }

  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    size.set(w, h);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Keep the whole disc in view on narrow or short stages.
    camera.fov = w < h ? 30 * Math.min(1.8, h / w) : 30;
    camera.updateProjectionMatrix();
    dirty = true;
  }
  new ResizeObserver(resize).observe(host);

  let fly: { from: Vector3; to: Vector3; start: number; ms: number } | null = null;

  function frame(now: number) {
    if (active) {
      if (fly) {
        const t = Math.min(1, (now - fly.start) / fly.ms);
        const e = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
        const dFrom = fly.from.length();
        const dTo = fly.to.length();
        camera.position
          .copy(fly.from)
          .normalize()
          .lerp(tmp.copy(fly.to).normalize(), e)
          .normalize()
          .multiplyScalar(dFrom + (dTo - dFrom) * e);
        if (t === 1) fly = null;
        dirty = true;
      }
      controls.rotateSpeed = Math.max(0.06, Math.min(1, (camera.position.length() - 1) / 1.6));
      if (controls.update()) dirty = true;
      if (dirty) {
        dirty = false;
        render();
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // A click that is not the end of a drag drops a pin.
  const ray = new Raycaster();
  let down: { x: number; y: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY };
    fly = null;
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
    const rect = canvas.getBoundingClientRect();
    ray.setFromCamera(
      new Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1),
      camera,
    );
    const hit = ray.intersectObject(moon)[0];
    if (!hit) return;
    const p = hit.point.normalize();
    opts.onPick(Math.asin(p.y) / D2R, Math.atan2(p.x, p.z) / D2R);
  });

  return {
    setBodies(sun, earth) {
      sunDir = toThree(sun).normalize();
      earthDir = toThree(earth).normalize();
      sunLight.position.copy(sunDir).multiplyScalar(10);
      refreshArcs();
      dirty = true;
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
        el.classList.toggle('on', siteKey(site) === siteKey(sel));
      }
      refreshArcs();
      dirty = true;
    },
    flyTo(site, animate = true) {
      const n = toThree(surfaceNormal(site));
      // Sit a little toward the equator from straight overhead so "up" on screen is stable near the poles.
      const lean = toThree(localAxes(site).north).multiplyScalar(site.lat < 0 ? 1 : -1);
      const target = n.clone().addScaledVector(lean, 0.18).normalize();
      target.multiplyScalar(camera.position.length());
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!animate || reduce) {
        camera.position.copy(target);
        fly = null;
      } else {
        fly = { from: camera.position.clone(), to: target, start: performance.now(), ms: 900 };
      }
      dirty = true;
    },
    setActive(on) {
      active = on;
      if (on) {
        resize();
        dirty = true;
      }
    },
  };
}
