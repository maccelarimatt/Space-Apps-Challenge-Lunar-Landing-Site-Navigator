// The view from the ground: a panorama of the real skyline with the Sun and
// Earth at their true positions and sizes. Terrain is drawn as a silhouette
// from the computed horizon; its shading is illustrative, the geometry is not.

import {
  BufferGeometry,
  CircleGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  LineLoop,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { AZ_STEPS, horizonAt, type Horizon } from '../astro/horizon';
import type { Series, SiteView } from '../astro/windows';

const D2R = Math.PI / 180;
const TERRAIN_R = 50;
const BODY_R = 80;

/** Direction for an azimuth and elevation in degrees: x east, y up, z south. */
function dir(az: number, el: number, r = 1): Vector3 {
  const a = az * D2R;
  const e = el * D2R;
  return new Vector3(Math.cos(e) * Math.sin(a) * r, Math.sin(e) * r, -Math.cos(e) * Math.cos(a) * r);
}

export interface SkyApi {
  setScene(horizon: Horizon, view: SiteView, track: Series): void;
  /** Turn to an azimuth; optionally set the tilt and the vertical field of view, all in degrees. */
  look(az: number, el?: number, fov?: number): void;
  zoom(factor: number): void;
  setActive(on: boolean): void;
  readonly az: number;
  readonly hfov: number;
}

export function createSky(host: HTMLElement, onLook: (az: number, hfov: number) => void): SkyApi | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0c0c0c);
  const canvas = renderer.domElement;
  canvas.className = 'sky-canvas';
  canvas.setAttribute('role', 'img');
  host.append(canvas);
  const labels = document.createElement('div');
  labels.className = 'sky-labels';
  host.append(labels);

  const scene = new Scene();
  const camera = new PerspectiveCamera(24, 2, 0.1, 400);
  camera.rotation.order = 'YXZ';

  const land = new Group();
  // The level line (0° elevation), dashed like the one on the horizon strip.
  const level = new Line(new BufferGeometry(), new LineDashedMaterial({ color: 0x6a6a6a, dashSize: 0.35, gapSize: 0.45 }));
  {
    const pts: number[] = [];
    for (let i = 0; i <= 1440; i++) pts.push(...dir(i / 4, 0, BODY_R + 20).toArray());
    level.geometry.setAttribute('position', new Float32BufferAttribute(pts, 3));
    level.computeLineDistances();
  }
  const sun = new Mesh(new CircleGeometry(1, 64), new MeshBasicMaterial({ color: 0xffc233 }));
  const earth = new Mesh(new SphereGeometry(1, 48, 24), new MeshLambertMaterial({ color: 0x39a0ed, emissive: 0x0b2940 }));
  const sunLight = new DirectionalLight(0xffffff, 3.4);
  const track = (hex: number) => new Line(new BufferGeometry(), new LineBasicMaterial({ color: hex, transparent: true, opacity: 0.55 }));
  const sunTrack = track(0xffc233);
  const earthTrack = track(0x39a0ed);
  scene.add(level, sunTrack, earthTrack, sun, earth, sunLight, land);

  const mkLabel = (cls: string) => {
    const el = document.createElement('span');
    el.className = cls;
    labels.append(el);
    return el;
  };
  const compass = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].map((c) => {
    const el = mkLabel('sky-compass');
    el.textContent = c;
    return el;
  });
  const sunLabel = mkLabel('sky-body sun');
  const earthLabel = mkLabel('sky-body earth');
  const levelLabel = mkLabel('sky-level');
  levelLabel.textContent = 'level, 0°';

  let yaw = 0; // degrees, azimuth the camera faces
  let pitch = 3;
  let active = false;
  let dirty = true;
  let horizon: Horizon | null = null;
  let view: SiteView | null = null;
  let w = 1;
  let h = 1;

  const hfov = () => 2 * Math.atan(Math.tan((camera.fov * D2R) / 2) * camera.aspect) / D2R;

  const v = new Vector3();
  function place(el: HTMLElement, az: number, elev: number, r: number) {
    v.copy(dir(az, elev, r)).project(camera);
    const behind = v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05;
    el.hidden = behind;
    if (!behind) el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
  }

  function render() {
    camera.rotation.set(pitch * D2R, -yaw * D2R, 0);
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    if (horizon) {
      const drop = camera.fov * 0.055;
      compass.forEach((el, i) => place(el, i * 45, horizonAt(horizon!, i * 45) - drop, TERRAIN_R));
    }
    place(levelLabel, yaw - hfov() * 0.42, camera.fov * 0.022, BODY_R + 20);
    if (view) {
      const lift = camera.fov * 0.05;
      place(sunLabel, view.sun.az, Math.max(view.sun.el + view.sun.radius, view.sun.horizon) + lift, BODY_R);
      place(earthLabel, view.earth.az, Math.max(view.earth.el + view.earth.radius, view.earth.horizon) + lift, BODY_R);
    }
  }

  function resize() {
    w = host.clientWidth;
    h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    dirty = true;
    onLook(yaw, hfov());
  }
  new ResizeObserver(resize).observe(host);

  function frame() {
    if (active && dirty) {
      dirty = false;
      render();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  let drag: { x: number; y: number; yaw: number; pitch: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, yaw, pitch };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const degPerPx = camera.fov / h;
    yaw = (((drag.yaw - (e.clientX - drag.x) * degPerPx) % 360) + 360) % 360;
    pitch = Math.max(-40, Math.min(80, drag.pitch + (e.clientY - drag.y) * degPerPx));
    dirty = true;
    onLook(yaw, hfov());
  });
  const end = () => (drag = null);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  function zoom(factor: number) {
    camera.fov = Math.max(3, Math.min(70, camera.fov * factor));
    camera.updateProjectionMatrix();
    dirty = true;
    onLook(yaw, hfov());
  }
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      zoom(Math.exp(e.deltaY * 0.0012));
    },
    { passive: false },
  );

  function buildTrack(line: Line, az: Float32Array, el: Float32Array) {
    const pts: number[] = [];
    for (let i = 0; i < az.length; i++) pts.push(...dir(az[i], el[i], BODY_R + 6).toArray());
    line.geometry.dispose();
    line.geometry = new BufferGeometry();
    line.geometry.setAttribute('position', new Float32BufferAttribute(pts, 3));
  }

  return {
    setScene(hz, vw, series) {
      horizon = hz;
      view = vw;

      // Terrain as receding ridgelines: one silhouette per distance band, far bands
      // drawn further out so nearer ground hides them, each with a white hairline.
      for (const child of [...land.children]) {
        land.remove(child);
        (child as Mesh).geometry.dispose();
      }
      const n = hz.layers.length;
      hz.layers.forEach((layer, k) => {
        const far = n > 1 ? k / (n - 1) : 0; // 0 nearest, 1 farthest
        const r = TERRAIN_R - (n - 1 - k) * 1.5;
        const pos: number[] = [];
        const edge: number[] = [];
        for (let i = 0; i < AZ_STEPS; i++) {
          const p0 = dir((i / AZ_STEPS) * 360, layer[i], r);
          const p1 = dir(((i + 1) / AZ_STEPS) * 360, layer[(i + 1) % AZ_STEPS], r);
          pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, 0, -r, 0);
          edge.push(p0.x, p0.y, p0.z);
        }
        const fillGeo = new BufferGeometry();
        fillGeo.setAttribute('position', new Float32BufferAttribute(pos, 3));
        // Nearest ground is the lightest grey; each band further out steps down, and all stay clear of the black sky.
        const grey = 0.024 - far * 0.014;
        const fill = new Mesh(fillGeo, new MeshBasicMaterial({ color: new Color().setScalar(grey), side: DoubleSide }));
        const lineGeo = new BufferGeometry();
        lineGeo.setAttribute('position', new Float32BufferAttribute(edge, 3));
        const line = new LineLoop(lineGeo, new LineBasicMaterial({ color: 0xf2f2f2, transparent: true, opacity: 0.32 }));
        land.add(fill, line);
      });
      // The skyline itself, the upper edge of everything, in full white.
      const top: number[] = [];
      const rTop = TERRAIN_R - n * 1.5;
      for (let i = 0; i < AZ_STEPS; i++) top.push(...dir((i / AZ_STEPS) * 360, hz.elevation[i], rTop).toArray());
      const topGeo = new BufferGeometry();
      topGeo.setAttribute('position', new Float32BufferAttribute(top, 3));
      land.add(new LineLoop(topGeo, new LineBasicMaterial({ color: 0xf2f2f2 })));

      const sunDir = dir(vw.sun.az, vw.sun.el);
      sun.position.copy(sunDir).multiplyScalar(BODY_R);
      sun.scale.setScalar(BODY_R * Math.tan(vw.sun.radius * D2R));
      sun.lookAt(0, 0, 0);
      earth.position.copy(dir(vw.earth.az, vw.earth.el, BODY_R));
      earth.scale.setScalar(BODY_R * Math.tan(vw.earth.radius * D2R));
      sunLight.position.copy(sunDir).multiplyScalar(1000);

      buildTrack(sunTrack, series.sunAz, series.sunEl);
      buildTrack(earthTrack, series.earthAz, series.earthEl);

      sunLabel.textContent = vw.sun.fraction === 0 ? 'Sun (hidden)' : 'Sun';
      earthLabel.textContent = vw.earth.fraction === 0 ? 'Earth (hidden)' : 'Earth';
      canvas.setAttribute(
        'aria-label',
        `View from the landing site. Sun ${vw.sun.fraction > 0 ? 'in view' : 'hidden behind terrain'}, Earth ${vw.earth.fraction > 0 ? 'in view' : 'hidden behind terrain'}. Drag to look around, scroll to zoom.`,
      );
      dirty = true;
    },
    look(az, el, fov) {
      yaw = ((az % 360) + 360) % 360;
      if (el !== undefined) pitch = el;
      if (fov !== undefined) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      dirty = true;
      onLook(yaw, hfov());
    },
    zoom,
    setActive(on) {
      active = on;
      if (on) resize();
    },
    get az() {
      return yaw;
    },
    get hfov() {
      return hfov();
    },
  };
}
