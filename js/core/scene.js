// The shared 3D world: one renderer reused by the Studio and every mission (tablets limit WebGL contexts).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

export const CLIP = [];                    // shared clipping planes for the section view
export const clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 100);

let world = null;
if (typeof window !== "undefined") Object.defineProperty(window, "__world", { get: () => world });
export function getWorld() {
  if (!world) world = new World();
  return world;
}

class World {
  constructor() {
    const canvas = document.createElement('canvas');
    canvas.className = 'world-canvas';
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;
    this.renderer = renderer;
    this.canvas = canvas;

    this.labels = new CSS2DRenderer();
    this.labels.domElement.className = 'world-labels';

    const scene = new THREE.Scene();
    this.scene = scene;
    this.cam = new THREE.PerspectiveCamera(42, 1, 0.05, 400);
    this.cam.position.set(34, 22, 58);
    this.ortho = new THREE.OrthographicCamera(-10, 10, 10, -10, -200, 400);
    this.camera = this.cam;

    this.controls = new OrbitControls(this.cam, canvas);
    const c = this.controls;
    c.enableDamping = true;
    c.dampingFactor = 0.12;
    c.minDistance = 3;
    c.maxDistance = 70;
    c.maxPolarAngle = 1.36;
    c.minPolarAngle = 0.12;
    c.rotateSpeed = 0.7;
    c.zoomSpeed = 0.9;
    c.panSpeed = 0.9;
    c.screenSpacePanning = false;
    c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    c.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    c.target.set(18, 0, 28);

    // Light
    this.hemi = new THREE.HemisphereLight(0xe8f2ff, 0x8b7a55, 1.45);
    scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    const sc = sun.shadow.camera;
    sc.left = -24; sc.right = 24; sc.top = 24; sc.bottom = -24; sc.near = 1; sc.far = 140;
    scene.add(sun, sun.target);
    this.sun = sun;
    this.sunT = 0.32;

    this.sky = makeSky();
    scene.add(this.sky);

    this.groups = {};
    for (const g of ['terrain', 'design', 'ghost', 'pupils', 'fx', 'lab']) {
      this.groups[g] = new THREE.Group();
      this.groups[g].name = g;
      scene.add(this.groups[g]);
    }
    this.updaters = new Set();
    this.host = null;
    this.running = false;
    this.clock = new THREE.Clock();
    this.time = 0;
    this.shadowFocus = new THREE.Vector3(18, 0, 28);
    this.shadowSize = 24;
    this.setSun(this.sunT);

    this._ro = new ResizeObserver(() => this.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.stop(); else if (this.host) this.start(); });
    this._loop = this._loop.bind(this);
  }

  attach(host) {
    if (this.host === host) return;
    this.detach();
    this.host = host;
    host.prepend(this.labels.domElement);
    host.prepend(this.canvas);
    this._ro.observe(host);
    this.resize();
    this.start();
  }

  detach() {
    if (!this.host) return;
    this._ro.unobserve(this.host);
    this.canvas.remove();
    this.labels.domElement.remove();
    this.host = null;
    this.stop();
  }

  resize() {
    if (!this.host) return;
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.labels.setSize(w, h);
    this.cam.aspect = w / h;
    this.w = w; this.h = h;
    this.applyShift();
    this.fitOrtho();
  }

  // Shift the picture up by d pixels (so a panel at the bottom does not hide the middle of the view).
  setViewShift(d) { this.viewShift = d; this.applyShift(); }
  applyShift() {
    const d = this.viewShift || 0;
    if (this.baseFov === undefined) this.baseFov = this.cam.fov;
    if (d && this.w) {
      // A taller virtual picture, with a wider lens so nothing looks zoomed in.
      const k = (this.h + 2 * d) / this.h;
      this.cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.baseFov) / 2) * k));
      this.cam.setViewOffset(this.w, this.h + 2 * d, 0, 2 * d, this.w, this.h);
    } else {
      this.cam.fov = this.baseFov;
      this.cam.clearViewOffset();
    }
    this.cam.updateProjectionMatrix();
  }

  // Orthographic camera framing: centre (cx, cy) and half-height in world units.
  setOrthoView(cx, cy, halfH) {
    this.orthoView = { cx, cy, halfH };
    this.fitOrtho();
  }
  fitOrtho() {
    const v = this.orthoView;
    if (!v || !this.host) return;
    const aspect = (this.host.clientWidth || 1) / (this.host.clientHeight || 1);
    const o = this.ortho;
    o.left = -v.halfH * aspect; o.right = v.halfH * aspect; o.top = v.halfH; o.bottom = -v.halfH;
    o.updateProjectionMatrix();
  }

  start() {
    if (this.running || document.hidden) return;
    this.running = true;
    this.clock.getDelta();
    requestAnimationFrame(this._loop);
  }
  stop() { this.running = false; }

  _loop() {
    if (!this.running) return;
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.time += dt;
    for (const fn of this.updaters) {
      try { fn(dt, this.time); } catch (e) { console.error(e); this.updaters.delete(fn); }
    }
    if (this.camera === this.cam && this.controls.enabled) this.controls.update();
    this.render();
    this.watchSpeed(dt);
    requestAnimationFrame(this._loop);
  }

  // If the tablet struggles, step quality down: first fewer pixels, then smaller shadows.
  watchSpeed(dt) {
    const q = this.quality || (this.quality = { level: 0, sum: 0, n: 0 });
    if (q.level >= 2 || dt <= 0 || dt > 0.25) return;
    q.sum += dt; q.n++;
    if (q.sum < 4) return;
    const avg = q.sum / q.n;
    q.sum = 0; q.n = 0;
    if (avg < 1 / 28) return;
    q.level++;
    if (q.level === 1 && this.renderer.getPixelRatio() > 1) { this.renderer.setPixelRatio(1); this.resize(); }
    else { this.sun.shadow.mapSize.set(1024, 1024); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } q.level = 2; }
    console.info('Astra Architect: lowered quality to level', q.level);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }

  // Testing aid: run the world forward by `sec` seconds without waiting for frames (works in hidden tabs).
  advance(sec, step = 1 / 30) {
    for (let t = 0; t < sec; t += step) {
      this.time += step;
      for (const fn of this.updaters) { try { fn(step, this.time); } catch (e) { console.error(e); } }
      if (this.camera === this.cam && this.controls.enabled) this.controls.update();
    }
    this.render();
  }

  // Sun from morning in the east (t = 0) through noon in the south (0.5) to evening in the west (1).
  setSun(t) {
    this.sunT = t;
    const az = Math.PI * t;
    const el = THREE.MathUtils.degToRad(8 + 52 * Math.sin(Math.PI * t));
    const dir = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
    this.sunDir = dir;
    const f = this.shadowFocus;
    this.sun.position.copy(f).addScaledVector(dir, 60);
    this.sun.target.position.copy(f);
    this.sun.target.updateMatrixWorld();
    const warm = 1 - Math.sin(Math.PI * t);                // low sun is warmer
    this.sun.color.setRGB(1, 0.94 - 0.14 * warm, 0.86 - 0.3 * warm);
    this.sun.intensity = 2.0 + 0.9 * Math.sin(Math.PI * t);
    this.sky.material.uniforms.sunDir.value.copy(dir);
    this.sky.material.uniforms.warm.value = warm;
  }

  focusShadows(cx, cz, size) {
    this.shadowFocus.set(cx, 0, cz);
    const s = Math.max(14, Math.min(40, size));
    const sc = this.sun.shadow.camera;
    sc.left = -s; sc.right = s; sc.top = s; sc.bottom = -s;
    sc.updateProjectionMatrix();
    this.setSun(this.sunT);
  }

  // Ray from a screen point (client coordinates) into the scene.
  rayFrom(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    return ray;
  }

  // Screen position (pixels in the host) of a world point.
  toScreen(v) {
    const p = v.clone().project(this.camera);
    return { x: (p.x + 1) / 2 * this.w, y: (1 - p.y) / 2 * this.h, behind: p.z > 1 };
  }

  snapshot(type = 'image/jpeg', q = 0.9) {
    this.render();
    return this.canvas.toDataURL(type, q);
  }
}

function makeSky() {
  const geo = new THREE.SphereGeometry(300, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { sunDir: { value: new THREE.Vector3(0, 1, 0) }, warm: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `varying vec3 vDir; uniform vec3 sunDir; uniform float warm;
      void main(){
        float y = clamp(vDir.y, -0.2, 1.0);
        vec3 zenith = vec3(0.36, 0.62, 0.93);
        vec3 horizon = mix(vec3(0.86, 0.93, 0.98), vec3(1.0, 0.86, 0.70), warm * 0.8);
        vec3 col = mix(horizon, zenith, pow(max(y, 0.0), 0.55));
        col = mix(col, vec3(0.80, 0.86, 0.80), smoothstep(0.0, -0.2, vDir.y));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        col += vec3(1.0, 0.92, 0.75) * (pow(s, 600.0) * 1.5 + pow(s, 12.0) * 0.18 * (0.6 + warm));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = -1;
  m.frustumCulled = false;
  return m;
}
