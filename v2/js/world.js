// The 3D world: one renderer, a soft-lit scene and an isometric camera that one finger turns round.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class World {
  constructor(host) {
    this.host = host;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = 'stage-canvas';
    host.appendChild(renderer.domElement);
    this.renderer = renderer;
    this.canvas = renderer.domElement;

    const scene = new THREE.Scene();
    scene.background = skyTexture();
    this.scene = scene;

    // Soft daylight: a big bright sky and a warm sun from the west, so shadows fall where we can see them.
    scene.add(new THREE.HemisphereLight('#ffffff', '#d9d3c5', 1.35));
    const sun = new THREE.DirectionalLight('#fff4e2', 2.1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 3;
    const sc = sun.shadow.camera;
    sc.left = -14; sc.right = 14; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 80;
    scene.add(sun, sun.target);
    this.sun = sun;
    this.setSunFocus(10, 8);

    // Isometric camera.
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
    this.camera.position.set(30, 32, 30);
    this.controls = new OrbitControls(this.camera, this.canvas);
    const c = this.controls;
    c.enableDamping = true; c.dampingFactor = 0.12;
    c.minPolarAngle = 0.62; c.maxPolarAngle = 1.12;
    c.minZoom = 0.6; c.maxZoom = 6;
    c.screenSpacePanning = false;
    c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    c.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    this.halfH = 7;

    this.updaters = new Set();
    this.clock = new THREE.Clock();
    this.running = false;
    this._loop = this._loop.bind(this);
    new ResizeObserver(() => this.resize()).observe(host);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.stop(); else this.start(); });
    this.resize();
  }

  setSunFocus(x, z) {
    const dir = new THREE.Vector3(-0.62, 1.05, 0.55).normalize();
    this.sun.target.position.set(x, 0, z);
    this.sun.position.set(x, 0, z).addScaledVector(dir, 40);
    this.sun.target.updateMatrixWorld();
  }

  resize() {
    const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1;
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    const a = w / h, cam = this.camera;
    cam.left = -this.halfH * a; cam.right = this.halfH * a; cam.top = this.halfH; cam.bottom = -this.halfH;
    cam.updateProjectionMatrix();
  }

  // Look at a point from the isometric angle (keeps the current turn of the board).
  frame(x, z, zoom, instant = false) {
    const c = this.controls, cam = this.camera;
    const off = cam.position.clone().sub(c.target);
    const t0 = c.target.clone(), z0 = cam.zoom, t1 = new THREE.Vector3(x, 0, z);
    if (instant) { c.target.copy(t1); cam.position.copy(t1).add(off); cam.zoom = zoom; cam.updateProjectionMatrix(); c.update(); return; }
    let t = 0;
    const fn = dt => {
      t = Math.min(1, t + dt / 0.6);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      c.target.lerpVectors(t0, t1, e);
      cam.position.copy(c.target).add(off);
      cam.zoom = z0 + (zoom - z0) * e; cam.updateProjectionMatrix();
      if (t >= 1) this.updaters.delete(fn);
    };
    this.updaters.add(fn);
  }

  // Turn the board a quarter at a time (buttons), smoothly.
  turn(sign) {
    const c = this.controls, cam = this.camera;
    const off = cam.position.clone().sub(c.target);
    const a0 = Math.atan2(off.x, off.z), r = Math.hypot(off.x, off.z), y = off.y;
    const a1 = Math.round((a0 + sign * Math.PI / 2) / (Math.PI / 4)) * (Math.PI / 4);
    let t = 0;
    const fn = dt => {
      t = Math.min(1, t + dt / 0.45);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const a = a0 + (a1 - a0) * e;
      cam.position.set(c.target.x + Math.sin(a) * r, c.target.y + y, c.target.z + Math.cos(a) * r);
      if (t >= 1) this.updaters.delete(fn);
    };
    this.updaters.add(fn);
  }

  rayFrom(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const p = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(p, this.camera);
    return ray;
  }
  toScreen(v) {
    const p = v.clone().project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height };
  }

  start() { if (this.running || document.hidden) return; this.running = true; this.clock.getDelta(); requestAnimationFrame(this._loop); }
  stop() { this.running = false; }
  _loop() {
    if (!this.running) return;
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.step(dt);
    requestAnimationFrame(this._loop);
  }
  step(dt) {
    for (const fn of [...this.updaters]) { try { fn(dt); } catch (e) { console.error(e); this.updaters.delete(fn); } }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  // Testing aid: run time forward even when the page is hidden.
  advance(sec) { for (let t = 0; t < sec; t += 1 / 30) this.step(1 / 30); }
}

// A pale sky: paper white at the horizon, the softest blue overhead.
function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#dceef3'); gr.addColorStop(0.6, '#eef4ef'); gr.addColorStop(1, '#f7f4ec');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
