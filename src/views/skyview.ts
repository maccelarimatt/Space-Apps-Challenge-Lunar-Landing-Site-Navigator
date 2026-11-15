// The view from the ground: the lunar surface under a black sky, with the Sun
// and Earth at their true positions and sizes. The skyline is the computed
// horizon and Earth shows its real face and phase. How brightly the ground is
// lit is illustrative: it follows the Sun's direction, not a shadow calculation.

import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  LineLoop,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Vec3 } from '../astro/frame';
import { AZ_STEPS, horizonAt, type Horizon } from '../astro/horizon';
import type { Series, SiteView } from '../astro/windows';

const D2R = Math.PI / 180;
const TERRAIN_R = 50;
const BODY_R = 80;
/** Ground with no Sun on it: just enough to stand clear of the black sky. Linear light, as are the rest. */
const UNLIT = 0.012;
/** The Sun's glare reaches this many solar radii from its centre. */
const GLARE = 3.2;

/** Earth's own axes as [east, north, up] components at the site. */
export interface EarthAxes {
  x: Vec3;
  y: Vec3;
  z: Vec3;
}

/** Direction for an azimuth and elevation in degrees: x east, y up, z south. */
function dir(az: number, el: number, r = 1): Vector3 {
  const a = az * D2R;
  const e = el * D2R;
  return new Vector3(Math.cos(e) * Math.sin(a) * r, Math.sin(e) * r, -Math.cos(e) * Math.cos(a) * r);
}

/** A soft falloff around the Sun, brightest at the disc's edge and gone by the rim of the square. */
function glareTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const fall = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  fall.addColorStop(0, 'rgba(255, 246, 224, 0.85)');
  fall.addColorStop(1 / GLARE, 'rgba(255, 208, 110, 0.5)');
  fall.addColorStop(0.55, 'rgba(255, 194, 51, 0.12)');
  fall.addColorStop(1, 'rgba(255, 194, 51, 0)');
  g.fillStyle = fall;
  g.fillRect(0, 0, 256, 256);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/**
 * A height map for the ground underfoot: gentle swells, small craters and
 * grain. It is drawn from a fixed seed, repeats in both directions, and stands
 * for the texture of regolith only. None of its craters are real ones.
 */
function regolithTexture(): CanvasTexture {
  const N = 512;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  let seed = 0x9e3779b9;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  g.fillStyle = 'rgb(128 128 128)';
  g.fillRect(0, 0, N, N);
  // Each mark is drawn nine times, once per neighbouring tile, so the edges join.
  const tiled = (x: number, y: number, r: number, paint: (cx: number, cy: number) => void) => {
    for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) if (x + dx > -r && x + dx < N + r && y + dy > -r && y + dy < N + r) paint(x + dx, y + dy);
  };
  for (let i = 0; i < 70; i++) {
    const x = rnd() * N;
    const y = rnd() * N;
    const r = 40 + rnd() * 90;
    const up = rnd() < 0.5;
    tiled(x, y, r, (cx, cy) => {
      const swell = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      swell.addColorStop(0, up ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)');
      swell.addColorStop(1, up ? 'rgba(255,255,255,0)' : 'rgba(0,0,0,0)');
      g.fillStyle = swell;
      g.fillRect(cx - r, cy - r, r * 2, r * 2);
    });
  }
  for (let i = 0; i < 150; i++) {
    const x = rnd() * N;
    const y = rnd() * N;
    const r = 3 + rnd() ** 3 * 34;
    tiled(x, y, r, (cx, cy) => {
      const bowl = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      bowl.addColorStop(0, 'rgba(0,0,0,0.5)');
      bowl.addColorStop(0.62, 'rgba(0,0,0,0.22)');
      bowl.addColorStop(0.8, 'rgba(128,128,128,0)');
      bowl.addColorStop(0.9, 'rgba(255,255,255,0.3)');
      bowl.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = bowl;
      g.fillRect(cx - r, cy - r, r * 2, r * 2);
    });
  }
  const img = g.getImageData(0, 0, N, N);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.max(0, Math.min(255, img.data[i] + (rnd() - 0.5) * 22));
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
  }
  g.putImageData(img, 0, 0);
  const tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  return tex;
}

/**
 * The ground nearest the viewer. Each pixel's line of sight is carried down to
 * a level plane one eye-height below, so the regolith texture shrinks toward
 * the horizon as real ground does, and its bumps are lit from the Sun's side.
 */
function groundMaterial(height: CanvasTexture): ShaderMaterial {
  return new ShaderMaterial({
    side: DoubleSide,
    uniforms: {
      uHeight: { value: height },
      uSun: { value: new Vector2(0, -1) },
      uRelief: { value: 0 },
    },
    vertexShader: `
      attribute vec3 color;
      varying vec3 vColor;
      varying vec3 vDir;
      void main() {
        vColor = color;
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D uHeight;
      uniform vec2 uSun;
      uniform float uRelief;
      varying vec3 vColor;
      varying vec3 vDir;
      float relief(vec2 uv, out float h) {
        const float e = 1.0 / 512.0;
        h = texture2D(uHeight, uv).r;
        vec2 rise = vec2(texture2D(uHeight, uv + vec2(e, 0.0)).r - h, texture2D(uHeight, uv + vec2(0.0, e)).r - h);
        // Ground that climbs toward the Sun has its back to it.
        return dot(rise, uSun);
      }
      void main() {
        vec3 d = normalize(vDir);
        float down = max(-d.y, 0.002);
        vec2 plane = d.xz / down;
        float h1;
        float h2;
        // The fine grain is only drawn close by; stretched toward the horizon it turns into streaks.
        float close = smoothstep(0.06, 0.32, -d.y);
        float slope = relief(plane * 0.11, h1) + 0.6 * close * relief(plane * 0.37 + 0.31, h2);
        float shade = 1.0 - uRelief * clamp(slope * 9.0, -0.9, 0.75);
        float tone = 0.86 + 0.28 * mix(h1, h2, 0.35 * close);
        // Detail fades out toward the horizon, where it would only shimmer.
        float show = smoothstep(0.003, 0.05, -d.y);
        gl_FragColor = vec4(vColor * mix(1.0, shade * tone, show), 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

interface Band {
  mesh: Mesh;
  layer: Float32Array;
  /** 0 for the nearest ground, 1 for the farthest ridge. */
  far: number;
}

export interface SkyApi {
  setScene(horizon: Horizon, view: SiteView, track: Series, earthAxes: EarthAxes): void;
  /** Move the Sun and Earth and relight the ground, without rebuilding the terrain or the paths. */
  setBodies(view: SiteView, earthAxes: EarthAxes): void;
  /** Show or hide the level line and the paths the Sun and Earth follow. */
  setGuides(on: boolean): void;
  /** Turn to an azimuth; optionally set the tilt and the vertical field of view, all in degrees. */
  look(az: number, el?: number, fov?: number): void;
  /** Name the elevation that zooming should hold in place, usually the body being watched. Dragging clears it. */
  hold(el: number): void;
  zoom(factor: number): void;
  setActive(on: boolean): void;
  readonly az: number;
  readonly pitch: number;
  readonly hfov: number;
}

export function createSky(host: HTMLElement, earthMapUrl: string, onLook: (az: number, hfov: number) => void): SkyApi | null {
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
  let bands: Band[] = [];
  const regolith = regolithTexture();
  regolith.anisotropy = 4;
  const nearGround = groundMaterial(regolith);
  const farGround = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const skyline = new LineBasicMaterial({ color: 0xf2f2f2, transparent: true, opacity: 0.5 });

  // Guides, off until asked for: the level line (0° elevation) and the paths over the lunar day.
  const guides = new Group();
  guides.visible = false;
  const level = new Line(new BufferGeometry(), new LineDashedMaterial({ color: 0x6a6a6a, dashSize: 0.35, gapSize: 0.45 }));
  {
    const pts: number[] = [];
    for (let i = 0; i <= 1440; i++) pts.push(...dir(i / 4, 0, BODY_R + 20).toArray());
    level.geometry.setAttribute('position', new Float32BufferAttribute(pts, 3));
    level.computeLineDistances();
  }
  const track = (hex: number) => new Line(new BufferGeometry(), new LineBasicMaterial({ color: hex, transparent: true, opacity: 0.55 }));
  const sunTrack = track(0xffc233);
  const earthTrack = track(0x39a0ed);
  guides.add(level, sunTrack, earthTrack);

  const sun = new Mesh(new CircleGeometry(1, 64), new MeshBasicMaterial({ color: 0xffc233 }));
  const glare = new Mesh(
    new PlaneGeometry(2, 2),
    new MeshBasicMaterial({ map: glareTexture(), transparent: true, blending: AdditiveBlending, depthWrite: false }),
  );

  // Earth starts as a plain blue ball and takes on its real face once the map arrives.
  const earthMat = new MeshLambertMaterial({ color: 0x39a0ed, emissive: 0x0b2940 });
  const earth = new Mesh(new SphereGeometry(1, 64, 32), earthMat);
  new TextureLoader().load(earthMapUrl, (map) => {
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = 4;
    earthMat.map = map;
    earthMat.emissiveMap = map;
    earthMat.color.set(0xffffff);
    // A trace of the night side stays visible so the whole disc can be made out.
    earthMat.emissive.set(0xffffff);
    earthMat.emissiveIntensity = 0.05;
    earthMat.needsUpdate = true;
    dirty = true;
  });
  const sunLight = new DirectionalLight(0xffffff, 8);
  scene.add(guides, sun, glare, earth, sunLight, land);

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
  levelLabel.hidden = true;

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
    if (guides.visible) place(levelLabel, yaw - hfov() * 0.42, camera.fov * 0.022, BODY_R + 20);
    else levelLabel.hidden = true;
    if (view) {
      const lift = camera.fov * 0.05;
      place(sunLabel, view.sun.az, Math.max(view.sun.el + view.sun.radius * GLARE * 0.6, view.sun.horizon) + lift, BODY_R);
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

  let held: number | null = null;
  let drag: { x: number; y: number; yaw: number; pitch: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    held = null;
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
    const before = camera.fov;
    camera.fov = Math.max(3, Math.min(70, camera.fov * factor));
    // Zoom about the held elevation, so the Sun or Earth stays where it was in the frame.
    if (held !== null) pitch = held - (held - pitch) * (camera.fov / before);
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

  /**
   * The ground as overlapping ridges, one per distance band, nearer ones in
   * front. Each is a strip that runs from its crest down a few degrees, then a
   * fan to the point underfoot. Colour is set per vertex in light().
   */
  function buildLand(hz: Horizon) {
    for (const child of [...land.children]) {
      land.remove(child);
      (child as Mesh | LineLoop).geometry.dispose();
    }
    const n = hz.layers.length;
    bands = hz.layers.map((layer, k) => {
      const far = n > 1 ? k / (n - 1) : 0;
      const r = TERRAIN_R - (n - 1 - k) * 1.5;
      const depth = 6 - far * 4.5; // degrees from crest to the foot of the strip
      const pos: number[] = [];
      const index: number[] = [];
      for (let i = 0; i < AZ_STEPS; i++) {
        const az = (i / AZ_STEPS) * 360;
        pos.push(...dir(az, layer[i], r).toArray(), ...dir(az, Math.max(-89, layer[i] - depth), r).toArray());
        const a = i * 2;
        const b = ((i + 1) % AZ_STEPS) * 2;
        index.push(a, b, b + 1, a, b + 1, a + 1, a + 1, b + 1, AZ_STEPS * 2);
      }
      pos.push(0, -r, 0);
      const geo = new BufferGeometry();
      geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new Float32BufferAttribute(new Float32Array(pos.length), 3));
      geo.setIndex(index);
      const mesh = new Mesh(geo, k === 0 ? nearGround : farGround);
      land.add(mesh);
      return { mesh, layer, far };
    });
    // The skyline itself, the upper edge of everything, as one fine line.
    const top: number[] = [];
    const rTop = TERRAIN_R - n * 1.5;
    for (let i = 0; i < AZ_STEPS; i++) top.push(...dir((i / AZ_STEPS) * 360, hz.elevation[i], rTop).toArray());
    const topGeo = new BufferGeometry();
    topGeo.setAttribute('position', new Float32BufferAttribute(top, 3));
    land.add(new LineLoop(topGeo, skyline));
  }

  /**
   * Light the ground from the Sun's side. With the Sun low, ground seen with the
   * Sun behind you is bright and ground toward the Sun shows its shadowed face;
   * with the Sun high the difference fades. Crests catch more light than the
   * slopes below them, which is what separates one ridge from the next.
   */
  function light(vw: SiteView) {
    const lit = vw.sun.fraction;
    const graze = Math.cos(Math.max(0, vw.sun.el) * D2R) ** 2;
    // Bumps throw the strongest relief under a low Sun and almost none at noon.
    nearGround.uniforms.uSun.value.set(Math.sin(vw.sun.az * D2R), -Math.cos(vw.sun.az * D2R));
    nearGround.uniforms.uRelief.value = lit * (0.25 + 0.75 * graze);
    for (const { mesh, far } of bands) {
      const attr = mesh.geometry.getAttribute('color') as Float32BufferAttribute;
      const c = attr.array as Float32Array;
      const foot = 0.72 - far * 0.42; // how much of the crest's light reaches the foot of the strip
      let sum = 0;
      for (let i = 0; i < AZ_STEPS; i++) {
        const away = (1 - Math.cos(((i / AZ_STEPS) * 360 - vw.sun.az) * D2R)) / 2;
        const facing = 0.7 + (away - 0.7) * graze;
        const crest = lit * (0.035 + 0.33 * facing);
        const low = crest * foot;
        sum += low;
        const o = i * 6;
        // Regolith is a slightly warm grey.
        c[o] = UNLIT + crest;
        c[o + 1] = UNLIT + crest * 0.97;
        c[o + 2] = UNLIT + crest * 0.92;
        c[o + 3] = UNLIT + low;
        c[o + 4] = UNLIT + low * 0.97;
        c[o + 5] = UNLIT + low * 0.92;
      }
      const under = sum / AZ_STEPS;
      c[AZ_STEPS * 6] = UNLIT + under;
      c[AZ_STEPS * 6 + 1] = UNLIT + under * 0.97;
      c[AZ_STEPS * 6 + 2] = UNLIT + under * 0.92;
      attr.needsUpdate = true;
    }
  }

  const basis = new Matrix4();
  function setBodies(vw: SiteView, axes: EarthAxes) {
    view = vw;
    const sunDir = dir(vw.sun.az, vw.sun.el);
    const sunSize = BODY_R * Math.tan(vw.sun.radius * D2R);
    sun.position.copy(sunDir).multiplyScalar(BODY_R);
    sun.scale.setScalar(sunSize);
    sun.lookAt(0, 0, 0);
    // The glare sits a touch nearer than the disc so the two never fight, and fades as the Sun is covered.
    glare.position.copy(sunDir).multiplyScalar(BODY_R - 0.5);
    glare.scale.setScalar(sunSize * GLARE);
    glare.lookAt(0, 0, 0);
    glare.visible = vw.sun.fraction > 0;
    (glare.material as MeshBasicMaterial).opacity = vw.sun.fraction;

    earth.position.copy(dir(vw.earth.az, vw.earth.el, BODY_R));
    earth.scale.setScalar(BODY_R * Math.tan(vw.earth.radius * D2R));
    // The sphere's map has 0°E on +x, the north pole on +y and 90°E on -z.
    // Scene axes are east, up, south, so [east, north, up] becomes (e, u, -n).
    const s = (a: Vec3, sign = 1) => new Vector3(a[0] * sign, a[2] * sign, -a[1] * sign);
    earth.quaternion.setFromRotationMatrix(basis.makeBasis(s(axes.x), s(axes.z), s(axes.y, -1)));
    sunLight.position.copy(sunDir).multiplyScalar(1000);

    light(vw);

    sunLabel.textContent = vw.sun.fraction === 0 ? 'Sun (hidden)' : 'Sun';
    earthLabel.textContent = vw.earth.fraction === 0 ? 'Earth (hidden)' : 'Earth';
    canvas.setAttribute(
      'aria-label',
      `View from the landing site. Sun ${vw.sun.fraction > 0 ? 'in view' : 'hidden behind terrain'}, Earth ${vw.earth.fraction > 0 ? 'in view' : 'hidden behind terrain'}. Drag to look around, scroll to zoom.`,
    );
    dirty = true;
  }

  return {
    setScene(hz, vw, series, axes) {
      if (hz !== horizon) {
        horizon = hz;
        buildLand(hz);
      }
      setBodies(vw, axes);
      buildTrack(sunTrack, series.sunAz, series.sunEl);
      buildTrack(earthTrack, series.earthAz, series.earthEl);
    },
    setBodies,
    setGuides(on) {
      guides.visible = on;
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
    hold(el) {
      held = el;
    },
    zoom,
    setActive(on) {
      active = on;
      if (on) resize();
    },
    get az() {
      return yaw;
    },
    get pitch() {
      return pitch;
    },
    get hfov() {
      return hfov();
    },
  };
}
