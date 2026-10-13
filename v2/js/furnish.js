// Room furniture for the inside view and for walking: playful pieces placed loosely round a room, things on and
// against its walls, and a few moving parts. Pieces are drawn into a Bag, which merges everything of one colour into
// one mesh, so a furnished room is only a handful of draw calls. Moving parts are small groups of their own, which
// sitescreen.js animates through userData.wave (a joint swinging to and fro), userData.glide (sliding to and fro) and
// userData.yspin (turning round).
// Sizes: one square is 1; a child stands about 0.17 tall and a table top is at 0.08. In the inside view the walls are
// cut at 0.27, so nothing on a wall goes higher than 0.25.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat } from './shapes.js';
import { wallRuns, openings, runAt, WALL_T } from './plan.js';

export function seededRnd(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const FUN = ['#f7c22e', '#e2457d', '#22b2bf', '#a3d140', '#f28b30', '#7c46a8', '#f5a3c7', '#3d8de0'];
export const pickC = rnd => FUN[Math.floor(rnd() * FUN.length)];
export const TABLE = '#fbfaf6';
const WHITE = '#fbfaf6', PAPER = '#ffffff', WOOD = '#d8b98c', DARK = '#3d405b', STEEL = '#c9ccd3', NAVY = '#2e4a8c', GOLD = '#e8c547', ORANGE = '#f28b30', RED = '#e6463c';
const LEAF = ['#5f9a4c', '#7db45a', '#8fc263'], RAINBOW = ['#e6463c', '#f28b30', '#f7c22e', '#a3d140', '#22b2bf', '#3d8de0', '#7c46a8', '#e2457d'];
const segs = r => Math.max(8, Math.min(24, Math.round(r * 160)));
// A piece's own frame: centred on (x, z), turned rot about the vertical.
const frame = (x, z, rot = 0, y = 0) => new THREE.Matrix4().makeRotationY(rot).setPosition(x, y, z);
const at = (m, x, z) => { const v = new THREE.Vector3(x, 0, z).applyMatrix4(m); return [v.x, v.z]; };
const tri = (pts) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath(); return new THREE.ShapeGeometry(s); };
function star(r, n = 5, inner = 0.45) { const s = new THREE.Shape(); for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2, rr = i % 2 ? r * inner : r; i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } s.closePath(); return s; }

export class Bag {
  constructor() { this.geos = new Map(); this.parts = []; }
  add(col, g) { if (!this.geos.has(col)) this.geos.set(col, []); this.geos.get(col).push(g); return g; }
  // A box centred on (x, y, z).
  box(col, w, h, d, x, y, z) { return this.add(col, new THREE.BoxGeometry(w, h, d).translate(x, y, z)); }
  // A squashed ball resting on y; a round ball centred on y.
  ball(col, r, x, y, z) { const n = r < 0.03 ? 8 : 10; return this.add(col, new THREE.SphereGeometry(r, n, n - 3).scale(1, 0.7, 1).translate(x, y + r * 0.7, z)); }
  sphere(col, r, x, y, z, w = r < 0.02 ? 8 : 12) { return this.add(col, new THREE.SphereGeometry(r, w, Math.max(4, w - 3)).translate(x, y, z)); }
  // An upright cylinder centred on (x, y, z), radius r at the top and r2 at the bottom.
  cyl(col, r, h, x, y, z, r2 = r, seg = segs(Math.max(r, r2))) { return this.add(col, new THREE.CylinderGeometry(r, r2, h, seg).translate(x, y, z)); }
  // A flat shape made in the x-y plane, laid down on the floor at height y.
  floor(col, geo, x, y, z, rot = 0) { return this.add(col, geo.rotateX(-Math.PI / 2).rotateY(rot).translate(x, y, z)); }
  // A flat shape (in plan) pushed up from y0 to y0 + h, with soft edges.
  plan(col, shape, h, x, y0, z, rotY = 0) { return this.add(col, new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1, curveSegments: 14 }).rotateX(-Math.PI / 2).rotateY(rotY).translate(x, y0, z)); }
  // The same with sharp edges (cheaper), for thin boards.
  slab(col, shape, h, x, y0, z, rotY = 0, curve = 14) { return this.add(col, new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: curve }).rotateX(-Math.PI / 2).rotateY(rotY).translate(x, y0, z)); }
  // A flat outline in plan ([x, z] points) pushed straight up from y0 by h.
  prism(col, pts, y0, h) { return this.add(col, new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z))), { depth: h, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, y0, 0)); }
  tube(col, pts, r, n = 48, radial = 8) { return this.add(col, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, r, radial, false)); }
  // Draw something in its own frame (see frame()), then place it.
  within(m, fn) {
    const sub = new Bag(), out = fn(sub);
    for (const [col, list] of sub.geos) for (const g of list) this.add(col, g.applyMatrix4(m));
    for (const p of sub.parts) { const holder = new THREE.Group(); holder.applyMatrix4(m); holder.add(p); this.parts.push(holder); }
    return out;
  }
  part(obj) { this.parts.push(obj); return obj; }
  // Everything of a plain colour becomes one mesh, coloured per vertex (one draw call for the whole room's
  // furniture); water, glowing and two-sided things get a mesh per colour.
  meshes() {
    const out = [], plain = [], c = new THREE.Color();
    for (const [col, list] of this.geos) {
      // (A colour starting with ~ is water: see-through, and it casts no shadow. One starting with * glows; one
      // starting with ^ is seen from both sides, for open shells.)
      const water = col[0] === '~', glow = col[0] === '*', both = col[0] === '^', hex = water || glow || both ? col.slice(1) : col;
      const prepped = list.map(x => { const y = x.index ? x.toNonIndexed() : x; if (y.attributes.uv) y.deleteAttribute('uv'); if (!y.attributes.normal) y.computeVertexNormals(); return y; });
      if (!water && !glow && !both) {
        c.set(hex);
        for (const y of prepped) { const n = y.attributes.position.count, arr = new Float32Array(n * 3); for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; } y.setAttribute('color', new THREE.BufferAttribute(arr, 3)); plain.push(y); }
        continue;
      }
      const g = mergeGeometries(prepped);
      const m = new THREE.Mesh(g, water ? mat(hex, { transparent: true, opacity: 0.42, depthWrite: false }) : glow ? mat(hex, { emissive: hex, emissiveIntensity: 0.6 }) : both ? mat(hex, { side: THREE.DoubleSide }) : mat(hex));
      m.castShadow = m.receiveShadow = !water; if (water) m.renderOrder = 1;
      m.userData.noInk = true;
      out.push(m);
    }
    if (plain.length) { const m = new THREE.Mesh(mergeGeometries(plain), mat('#ffffff', { vertexColors: true })); m.castShadow = m.receiveShadow = true; m.userData.noInk = true; out.push(m); }
    return out;
  }
}
// A moving part: a group holding the meshes of a little bag of its own (more groups can hang off it).
function partGroup(fn, motion) {
  const g = new THREE.Group(), b = new Bag(); fn(b); for (const m of b.meshes()) g.add(m);
  if (motion) Object.assign(g.userData, motion);
  const wv = motion?.wave; if (wv) g.rotation[wv.axis] = wv.base + Math.sin(wv.phase) * wv.amp;      // (posed as on its first frame, for still pictures)
  return g;
}

// ---------- children's pictures ----------
// A child's painting, w × h, centred on (0, cy), its back flat on z = z0 and facing +z: a sheet of paper and a few bold
// shapes. Each shape sits a hair in front of the one before, so none of them flicker.
const SKY = '#cfe8f7';
export function painting(bag, w, h, cy, z0, kind, rnd) {
  let lz = z0 + 0.0032;
  const f = (col, geo, x, y) => { lz += 0.0006; bag.add(col, geo.translate(x, y, lz)); };
  bag.box(kind === 6 ? NAVY : PAPER, w, h, 0.003, 0, cy, z0 + 0.0015);
  const c1 = pickC(rnd), c2 = pickC(rnd), c3 = pickC(rnd), b = cy - h / 2;
  if (kind === 0) {             // a sunny day
    f(SKY, new THREE.PlaneGeometry(w * 0.9, h * 0.46), 0, cy + h * 0.2);
    f('#7db45a', new THREE.CircleGeometry(1, 14, 0, Math.PI).scale(w * 0.45, h * 0.36, 1), -w * 0.04, b + h * 0.05);
    f('#f7c22e', new THREE.CircleGeometry(h * 0.12, 12), w * 0.24, cy + h * 0.24);
  } else if (kind === 1) {      // a rainbow
    [['#e6463c', 0.3, 0.4], ['#f7c22e', 0.2, 0.3], ['#3d8de0', 0.1, 0.2]].forEach(([c, a, z]) => f(c, new THREE.RingGeometry(w * a, w * z, 14, 1, 0, Math.PI), 0, b + h * 0.12));
  } else if (kind === 2) {      // a flower
    f('#5f9a4c', new THREE.PlaneGeometry(w * 0.05, h * 0.46), 0, b + h * 0.27);
    f('#7db45a', new THREE.CircleGeometry(1, 10).scale(w * 0.1, h * 0.05, 1), w * 0.08, b + h * 0.26);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; f(c1, new THREE.CircleGeometry(h * 0.09, 10), Math.cos(a) * h * 0.12, cy + h * 0.14 + Math.sin(a) * h * 0.12); }
    f('#f7c22e', new THREE.CircleGeometry(h * 0.075, 10), 0, cy + h * 0.14);
  } else if (kind === 3) {      // a house in the sun
    f(c1, new THREE.PlaneGeometry(w * 0.44, h * 0.34), 0, b + h * 0.24);
    f(RED, tri([[-w * 0.29, 0], [w * 0.29, 0], [0, h * 0.24]]), 0, b + h * 0.41);
    f(DARK, new THREE.PlaneGeometry(w * 0.1, h * 0.18), w * 0.06, b + h * 0.16);
    f('#f7c22e', new THREE.CircleGeometry(h * 0.1, 12), -w * 0.3, cy + h * 0.3);
  } else if (kind === 4) {      // bold blocks (after Mondrian)
    f(c1, new THREE.PlaneGeometry(w * 0.5, h * 0.55), -w * 0.18, cy + h * 0.15);
    f(c2, new THREE.PlaneGeometry(w * 0.3, h * 0.32), w * 0.26, b + h * 0.24);
    f(c3, new THREE.PlaneGeometry(w * 0.26, h * 0.26), -w * 0.26, b + h * 0.18);
    f(DARK, new THREE.PlaneGeometry(w * 0.9, h * 0.03), 0, cy - h * 0.06);
    f(DARK, new THREE.PlaneGeometry(w * 0.03, h * 0.88), w * 0.08, cy);
  } else if (kind === 5) {      // a rocket blasting off
    f(ORANGE, tri([[-w * 0.07, 0], [w * 0.07, 0], [0, -h * 0.2]]), 0, b + h * 0.3);
    f(c1, tri([[-w * 0.17, 0], [-w * 0.08, 0], [-w * 0.08, h * 0.16]]), 0, b + h * 0.3);
    f(c1, tri([[w * 0.17, 0], [w * 0.08, 0], [w * 0.08, h * 0.16]]), 0, b + h * 0.3);
    f('#dfe3ea', new THREE.PlaneGeometry(w * 0.16, h * 0.4), 0, b + h * 0.5);
    f(RED, tri([[-w * 0.08, 0], [w * 0.08, 0], [0, h * 0.18]]), 0, b + h * 0.7);
    f('#3d8de0', new THREE.CircleGeometry(w * 0.045, 10), 0, b + h * 0.55);
    f('#f7c22e', new THREE.CircleGeometry(w * 0.02, 6), -w * 0.32, cy + h * 0.3); f('#f7c22e', new THREE.CircleGeometry(w * 0.02, 6), w * 0.3, cy + h * 0.1);
  } else {                      // space: a ringed planet, a moon and stars (on navy paper)
    f(c1, new THREE.CircleGeometry(h * 0.2, 16), -w * 0.1, cy - h * 0.02);
    f(GOLD, new THREE.RingGeometry(h * 0.26, h * 0.31, 20).scale(1, 0.35, 1).rotateZ(0.3), -w * 0.1, cy - h * 0.02);
    f('#e8e4da', new THREE.CircleGeometry(h * 0.08, 12), w * 0.3, cy + h * 0.28);
    for (let i = 0; i < 6; i++) f('#ffffff', new THREE.CircleGeometry(h * 0.018, 5), (rnd() - 0.5) * w * 0.85, cy + (rnd() - 0.5) * h * 0.85);
  }
}

// ---------- things on and against the walls ----------
// Each: w = how much wall it takes, h = how tall it is. Things hung on the wall go up at `lift` above the floor, or
// lower (down to `min`) to fit under a window. Things standing against the wall (d = how far they stand out) may
// stand in front of a window whose sill is no more than 0.1 below their top. make(s, rnd, y0) draws it with its
// bottom at y0, in a frame where x runs along the wall, y is up and z comes out of the wall (the wall face is z = 0).
export const WALLS = {
  // A framed picture.
  art: { w: 0.13, h: 0.1, lift: 0.12, min: 0.04, make(s, rnd, y0) {
    const w = 0.09 + rnd() * 0.03, h = 0.07 + rnd() * 0.015, cy = y0 + 0.05;
    s.box(pickC(rnd), w + 0.014, h + 0.014, 0.004, 0, cy, 0.002);
    painting(s, w, h, cy, 0.004, Math.floor(rnd() * 6), rnd);
  } },
  // A space poster (in the observatory).
  poster: { w: 0.12, h: 0.125, lift: 0.1, min: 0.03, make(s, rnd, y0) { const cy = y0 + 0.0625; s.box(WHITE, 0.104, 0.124, 0.003, 0, cy, 0.0015); painting(s, 0.094, 0.114, cy, 0.003, 6, rnd); } },
  // A cork board full of drawings.
  pinboard: { w: 0.17, h: 0.106, lift: 0.115, min: 0.04, make(s, rnd, y0) {
    const cy = y0 + 0.053;
    s.box('#d9b382', 0.16, 0.1, 0.005, 0, cy, 0.0025); s.box(WOOD, 0.168, 0.006, 0.007, 0, cy - 0.05, 0.0035); s.box(WOOD, 0.168, 0.006, 0.007, 0, cy + 0.05, 0.0035);
    for (let i = 0; i < 6; i++) {
      const x = -0.058 + (i % 3) * 0.058 + (rnd() - 0.5) * 0.01, y = cy - 0.023 + Math.floor(i / 3) * 0.045, tilt = (rnd() - 0.5) * 0.25;
      s.add(i % 2 ? PAPER : '#fff4c7', new THREE.PlaneGeometry(0.036, 0.034).rotateZ(tilt).translate(x, y, 0.0056));
      s.add(pickC(rnd), (rnd() < 0.5 ? new THREE.CircleGeometry(0.009, 8) : new THREE.PlaneGeometry(0.022, 0.008)).rotateZ(tilt).translate(x, y + 0.002, 0.0062));
      s.add(RED, new THREE.CircleGeometry(0.0025, 5).translate(x, y + 0.014, 0.0066));
    }
  } },
  // A rainbow strip of squares along the top of the wall.
  frieze: { w: 0.26, h: 0.024, lift: 0.205, min: 0.14, make(s, rnd, y0) { for (let i = 0; i < 10; i++) s.box(RAINBOW[i % RAINBOW.length], 0.022, 0.022, 0.004, -0.117 + i * 0.026, y0 + 0.012, 0.002); } },
  // A pegboard of tools.
  pegboard: { w: 0.18, h: 0.1, lift: 0.11, min: 0.018, make(s, rnd, y0) {
    const cy = y0 + 0.05;
    s.box('#efe3c6', 0.17, 0.1, 0.005, 0, cy, 0.0025);
    const tool = (x, k) => {
      const c = [RED, '#3d8de0', '#f7c22e', ORANGE][k % 4];
      if (k % 4 === 0) { s.box(c, 0.006, 0.05, 0.005, x, cy - 0.015, 0.008); s.box(STEEL, 0.026, 0.01, 0.007, x, cy + 0.013, 0.008); }                  // hammer
      else if (k % 4 === 1) { s.box(STEEL, 0.006, 0.05, 0.004, x, cy, 0.008); s.add(STEEL, new THREE.TorusGeometry(0.008, 0.003, 4, 10).translate(x, cy + 0.028, 0.008)); }   // spanner
      else if (k % 4 === 2) { s.box(c, 0.01, 0.024, 0.008, x, cy - 0.025, 0.009); s.box(STEEL, 0.003, 0.034, 0.003, x, cy + 0.004, 0.008); }      // screwdriver
      else { s.add(STEEL, tri([[-0.012, 0], [0.012, 0], [0.012, 0.05]]).translate(x, cy - 0.02, 0.006)); s.box(c, 0.012, 0.018, 0.006, x + 0.006, cy - 0.028, 0.008); }   // saw
    };
    for (let i = 0; i < 6; i++) tool(-0.068 + i * 0.027, i + Math.floor(rnd() * 4));
  } },
  // Guitars hung on the wall.
  guitars: { w: 0.16, h: 0.14, lift: 0.08, min: 0.025, make(s, rnd, y0) {
    for (let i = 0; i < 3; i++) {
      const x = -0.05 + i * 0.05, c = pickC(rnd), y = y0 + 0.02 + (i % 2) * 0.006;
      s.add(c, new THREE.CylinderGeometry(0.019, 0.019, 0.008, 14).rotateX(Math.PI / 2).translate(x, y, 0.006));
      s.add(c, new THREE.CylinderGeometry(0.014, 0.014, 0.008, 12).rotateX(Math.PI / 2).translate(x, y + 0.026, 0.006));
      s.add(DARK, new THREE.CircleGeometry(0.006, 8).translate(x, y + 0.012, 0.0102));
      s.box(WOOD, 0.006, 0.07, 0.004, x, y + 0.07, 0.006); s.box(DARK, 0.01, 0.016, 0.005, x, y + 0.112, 0.006);
    }
  } },
  // A low shelf of coloured trays (against the wall).
  cubbies: { w: 0.19, h: 0.075, d: 0.045, make(s, rnd) {
    s.box(WHITE, 0.18, 0.066, 0.04, 0, 0.033, 0);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) s.box(pickC(rnd), 0.036, 0.024, 0.006, -0.06 + c * 0.04, 0.018 + r * 0.03, 0.021);
    s.box(pickC(rnd), 0.03, 0.014, 0.022, -0.05, 0.073, -0.002); s.box(pickC(rnd), 0.03, 0.003, 0.022, 0.04, 0.0675, -0.004);
    if (rnd() < 0.6) { s.cyl('#f0e2c0', 0.014, 0.004, 0.0, 0.068, 0, 0.012, 10); s.sphere('~#5ec4e2', 0.019, 0.0, 0.085, 0, 12); s.add(ORANGE, new THREE.SphereGeometry(0.006, 6, 4).scale(1.6, 1, 0.6).translate(0.002, 0.084, 0.003)); s.add(ORANGE, new THREE.ConeGeometry(0.004, 0.006, 4).rotateZ(Math.PI / 2).translate(-0.009, 0.084, 0.003)); }
  } },
  // An upright piano against the wall, with its stool.
  piano: { w: 0.18, h: 0.13, d: 0.11, seat: [[0, 0.035]], make(s, rnd) {
    const body = '#2b2d3a', z0 = -0.055;
    s.box(body, 0.16, 0.13, 0.05, 0, 0.065, z0 + 0.025); s.box(pickC(rnd), 0.162, 0.008, 0.052, 0, 0.126, z0 + 0.025);
    s.box(body, 0.152, 0.012, 0.03, 0, 0.074, z0 + 0.065); s.box(PAPER, 0.144, 0.004, 0.024, 0, 0.082, z0 + 0.066);
    for (let i = 0; i < 10; i++) if (i % 7 !== 2 && i % 7 !== 6) s.box('#1d1f24', 0.006, 0.004, 0.012, -0.063 + i * 0.014, 0.085, z0 + 0.06);
    s.box(PAPER, 0.05, 0.035, 0.003, 0.02, 0.105, z0 + 0.052); s.box(body, 0.006, 0.07, 0.012, -0.073, 0.035, z0 + 0.06); s.box(body, 0.006, 0.07, 0.012, 0.073, 0.035, z0 + 0.06);
    s.cyl(DARK, 0.018, 0.006, 0, 0.047, 0.035); s.cyl(DARK, 0.005, 0.044, 0, 0.022, 0.035, 0.008, 8);
  } },
  // A low bookcase full of books (against the wall).
  books: { w: 0.21, h: 0.16, d: 0.05, make(s, rnd) {
    const W = 0.2, H = 0.16, D = 0.045;
    s.box(WHITE, 0.008, H, D, -W / 2 + 0.004, H / 2, 0); s.box(WHITE, 0.008, H, D, W / 2 - 0.004, H / 2, 0);
    s.box(WHITE, W, 0.006, D, 0, H - 0.003, 0); s.box(WHITE, W, 0.004, D, 0, 0.002, 0); s.box('#e9e4da', W - 0.016, H - 0.01, 0.004, 0, H / 2, -D / 2 + 0.002);
    for (let r = 0; r < 3; r++) {
      const y0 = 0.004 + r * 0.052;
      if (r) s.box(WHITE, W - 0.016, 0.005, D, 0, y0, 0);
      bookRow(s, -W / 2 + 0.01, W / 2 - 0.01, y0 + 0.0025, 0.004, D - 0.012, 0.03, 0.044, rnd);
    }
  } },
  // Wooden climbing bars (against the wall, in a hall).
  wallbars: { w: 0.12, h: 0.25, d: 0.03, make(s) {
    for (const x of [-0.052, 0.052]) s.box(WOOD, 0.012, 0.25, 0.02, x, 0.125, 0);
    for (let i = 0; i < 9; i++) s.add('#e8cfa4', new THREE.CylinderGeometry(0.004, 0.004, 0.1, 6).rotateZ(Math.PI / 2).translate(0, 0.02 + i * 0.026, 0.002));
  } },
  // A sun lounger along the pool-side wall.
  lounger: { w: 0.15, h: 0.06, d: 0.05, seat: [[0.02, 0]], make(s, rnd) {
    const c = pickC(rnd);
    s.box(WHITE, 0.1, 0.008, 0.04, 0.015, 0.03, 0); s.add(WHITE, new THREE.BoxGeometry(0.045, 0.008, 0.04).rotateZ(-0.6).translate(-0.05, 0.043, 0));
    s.box(c, 0.1, 0.006, 0.034, 0.015, 0.037, 0); s.add(c, new THREE.BoxGeometry(0.042, 0.006, 0.034).rotateZ(-0.6).translate(-0.047, 0.05, 0));
    for (const lx of [-0.03, 0.06]) for (const lz of [-0.016, 0.016]) s.box(STEEL, 0.004, 0.026, 0.004, lx, 0.013, lz);
    s.add(PAPER, new THREE.BoxGeometry(0.03, 0.003, 0.03).translate(0.04, 0.0415, 0));
  } },
  // A tall lifeguard chair with a ladder and a ring hanging on it.
  lifeguard: { w: 0.08, h: 0.18, d: 0.07, make(s) {
    for (const lx of [-0.025, 0.025]) { s.box(WHITE, 0.006, 0.13, 0.006, lx, 0.065, -0.022); s.add(WHITE, new THREE.BoxGeometry(0.006, 0.135, 0.006).rotateX(-0.2).translate(lx, 0.065, 0.012)); }
    for (let i = 1; i < 5; i++) s.box(WHITE, 0.05, 0.004, 0.004, 0, i * 0.026, 0.006 + i * 0.0052);
    s.box('#e6463c', 0.06, 0.008, 0.045, 0, 0.13, -0.008); s.box('#e6463c', 0.06, 0.05, 0.008, 0, 0.158, -0.03);
    s.add(PAPER, new THREE.TorusGeometry(0.016, 0.006, 6, 14).translate(0.035, 0.1, 0)); for (let i = 0; i < 4; i++) s.add(RED, new THREE.TorusGeometry(0.016, 0.0062, 6, 3, Math.PI / 4).rotateZ(i * Math.PI / 2).translate(0.035, 0.1, 0));
  } },
  // A stack of kickboards.
  kickboards: { w: 0.07, h: 0.05, d: 0.04, make(s, rnd) { for (let i = 0; i < 6; i++) s.add(RAINBOW[(i * 3 + Math.floor(rnd() * 8)) % 8], new THREE.BoxGeometry(0.05, 0.006, 0.035).rotateY((rnd() - 0.5) * 0.3).translate(0, 0.003 + i * 0.007, 0)); } },
  // A drying rack of paintings (against the wall, in the art room).
  rack: { w: 0.14, h: 0.15, d: 0.06, make(s, rnd) {
    for (const x of [-0.06, 0.06]) { s.box(STEEL, 0.006, 0.15, 0.006, x, 0.075, -0.024); s.box(STEEL, 0.006, 0.15, 0.006, x, 0.075, 0.024); }
    for (let i = 0; i < 6; i++) { const y = 0.02 + i * 0.024; s.box(STEEL, 0.12, 0.002, 0.05, 0, y, 0); s.box(pickC(rnd), 0.1, 0.002, 0.03 + rnd() * 0.012, (rnd() - 0.5) * 0.01, y + 0.002, 0.012); }
  } },
  // The servery in the lunch hall: a counter of hot food behind a glass guard, and a stack of trays.
  servery: { w: 0.3, h: 0.13, d: 0.08, make(s) {
    s.box(WHITE, 0.28, 0.07, 0.07, 0, 0.035, 0); s.box(STEEL, 0.29, 0.006, 0.076, 0, 0.073, 0);
    ['#a3d140', ORANGE, '#f7c22e', RED, '#e9e4da'].forEach((c, i) => s.box(c, 0.042, 0.006, 0.04, -0.104 + i * 0.052, 0.077, -0.008));
    s.box('~#bfe4f3', 0.27, 0.035, 0.003, 0, 0.11, 0.02); for (const x of [-0.13, 0.13]) s.box(STEEL, 0.004, 0.04, 0.004, x, 0.095, 0.02);
    for (let i = 0; i < 6; i++) s.box(ORANGE, 0.05, 0.004, 0.036, 0.17, 0.004 + i * 0.006, 0.01);
  } },
};
// A row of books standing on a shelf from x0 to x1 (in a wall piece's frame), spines facing +z.
function bookRow(s, x0, x1, y0, z0, depth, hMin, hMax, rnd) {
  let x = x0;
  while (x < x1 - 0.006) {
    const t = 0.006 + rnd() * 0.006; if (x + t > x1) break;
    if (rnd() < 0.08) { x += t; continue; }                     // (a gap where a book is out)
    const h = hMin + rnd() * (hMax - hMin);
    s.box(RAINBOW[Math.floor(rnd() * RAINBOW.length)], t * 0.92, h, depth, x + t / 2, y0 + h / 2, z0);
    x += t;
  }
}

// Free stretches of a run of wall [[a, c]], leaving out its sharp corners and the openings given.
function freeStretches(run, ops, corner = 0.075) {
  const blocked = [], n = run.n;
  if (!run.closed) blocked.push([-1, corner], [run.len - corner, run.len + 1]);
  for (let i = 1; i < n.length; i++) if (n[i - 1][0] * n[i][0] + n[i - 1][1] * n[i][1] < 0.85) blocked.push([run.s[i] - corner, run.s[i] + corner]);
  if (run.closed && n[0][0] * n[n.length - 1][0] + n[0][1] * n[n.length - 1][1] < 0.85) blocked.push([-1, corner], [run.len - corner, run.len + 1]);
  for (const o of ops) blocked.push([o.s0 - 0.025, o.s1 + 0.025]);
  blocked.sort((a, b) => a[0] - b[0]);
  const out = []; let at0 = 0;
  for (const [a, b] of blocked) { if (a > at0) out.push([at0, a]); at0 = Math.max(at0, b); }
  if (run.len > at0) out.push([at0, run.len]);
  return out;
}
// Put the wall pieces of a room's plan on its outside walls, clear of doors, windows and each other. Floor-standing
// ones claim their bit of floor in `placed`, so loose furniture keeps away from them.
export function placeWallItems(bag, b, k, plan, rnd, placed, seats) {
  const wanted = plan.filter(([kind, n]) => WALLS[kind] && n > 0);
  if (!wanted.length) return;
  const runs = wallRuns(b, k), ops = openings(b, k, runs), used = runs.map(() => []);
  for (const [kind, count] of wanted) {
    const W = WALLS[kind], spans = [];
    // A window only blocks the wall where the piece can't fit under it (hung low) or stand in front of it.
    const fits = op => (W.d ? W.h <= op.y0 + 0.1 : op.y0 - 0.012 - W.h >= W.min) || op.y0 > (W.d ? W.h : W.lift + W.h);
    runs.forEach((run, ri) => {
      if (!run.outer || run.colonnade) return;
      const block = ops.filter(op => op.run === ri && (op.door || !fits(op)));
      for (const [a, c] of freeStretches(run, block)) if (c - a >= W.w + 0.01) spans.push({ ri, run, a, c });
    });
    for (let n = 0; n < count && spans.length; n++) {
      for (let t = 0; t < 30; t++) {
        const sp = spans[Math.floor(rnd() * spans.length)], u = sp.a + W.w / 2 + 0.005 + rnd() * (sp.c - sp.a - W.w - 0.01);
        if (used[sp.ri].some(([p, q]) => u + W.w / 2 + 0.025 > p && u - W.w / 2 - 0.025 < q)) continue;
        // How high it hangs: at its own height, or low enough to clear the lowest window above this bit of wall.
        let y0 = 0;
        if (!W.d) { y0 = W.lift; for (const op of ops) if (op.run === sp.ri && !op.door && op.s1 > u - W.w / 2 - 0.01 && op.s0 < u + W.w / 2 + 0.01 && op.y0 < y0 + W.h + 0.012) y0 = Math.min(y0, op.y0 - 0.012 - W.h); if (y0 < W.min - 1e-6) continue; }
        const p = runAt(sp.run, u), off = WALL_T + 0.002 + (W.d || 0) / 2, x = p.x - p.nx * off, z = p.z - p.nz * off;
        if (W.d) {
          const r = Math.max(W.w, W.d) / 2;
          if (placed.some(q => Math.hypot(q.x - x, q.z - z) < q.r + r * 0.75)) continue;
          placed.push({ x, z, r: r * 0.8 });
        }
        used[sp.ri].push([u - W.w / 2, u + W.w / 2]);
        // (The piece's z axis points into the room; floor pieces stand with their back to the wall.)
        const m = frame(x, z, Math.atan2(-p.nx, -p.nz));
        bag.within(m, s => W.make(s, rnd, y0));
        if (W.seat) for (const [a, c] of W.seat) seats.push(at(m, a, c));
        break;
      }
    }
  }
}

// ---------- loose furniture ----------
function bean(len, wid) {
  // A bean (kidney) shape: a curved fat capsule.
  const s = new THREE.Shape(), R = len, a0 = -0.55, a1 = 0.55, n = 12, pts = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([Math.sin(a) * R, -Math.cos(a) * R + R]); }
  const outer = pts.map(([x, y]) => [x * (1 + wid / R), y - wid * 0.2]), inner = pts.map(([x, y]) => [x * (1 - wid / R), y + wid]).reverse();
  [...outer, ...inner].forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}
// Things left on a table top (at height y, around (x, z)): pencils in a pot, paper, a book.
function tableClutter(bag, x, z, y, rnd, r = 0.05) {
  const a = rnd() * 6.28, px = x + Math.cos(a) * r * 0.4, pz = z + Math.sin(a) * r * 0.4;
  bag.cyl(pickC(rnd), 0.007, 0.014, px, y + 0.007, pz, 0.007, 8);
  for (let i = 0; i < 3; i++) bag.cyl(RAINBOW[(i * 3 + Math.floor(rnd() * 8)) % 8], 0.0016, 0.022, px + (i - 1) * 0.003, y + 0.016, pz + (i % 2) * 0.002, 0.0016, 4);
  for (let i = 0; i < 2; i++) { const b2 = a + 2 + i * 1.6; bag.add(i ? '#fff4c7' : PAPER, new THREE.BoxGeometry(0.03, 0.0015, 0.038).rotateY(b2).translate(x + Math.cos(b2) * r * 0.45, y + 0.001 + i * 0.0015, z + Math.sin(b2) * r * 0.45)); }
}
function roundTableAt(bag, x, z, rnd, lunch = false) {
  bag.cyl(TABLE, 0.075, 0.012, x, 0.075, z); bag.cyl('#d8d4cc', 0.012, 0.07, x, 0.035, z, 0.012, 8);
  const n = 4 + Math.floor(rnd() * 2), seats = [], off = rnd() * 6;
  for (let i = 0; i < n; i++) {
    const a = off + (i / n) * Math.PI * 2, sx = x + Math.cos(a) * 0.115, sz = z + Math.sin(a) * 0.115;
    bag.cyl(pickC(rnd), 0.022, 0.045, sx, 0.0225, sz); seats.push([sx, sz]);
    if (lunch) { const px = x + Math.cos(a) * 0.05, pz = z + Math.sin(a) * 0.05; bag.cyl(PAPER, 0.016, 0.003, px, 0.0825, pz, 0.014, 12); bag.ball(['#a3d140', ORANGE, '#f7c22e', RED][i % 4], 0.008, px, 0.083, pz); bag.cyl(pickC(rnd), 0.005, 0.014, x + Math.cos(a + 0.45) * 0.055, 0.088, z + Math.sin(a + 0.45) * 0.055, 0.004, 8); }
  }
  if (lunch) { bag.cyl(PAPER, 0.018, 0.012, x, 0.087, z, 0.012, 12); for (let i = 0; i < 3; i++) bag.sphere([RED, '#f7c22e', '#a3d140'][i], 0.008, x + Math.cos(i * 2.1) * 0.007, 0.097, z + Math.sin(i * 2.1) * 0.007); }
  else if (rnd() < 0.8) tableClutter(bag, x, z, 0.081, rnd);
  return seats;
}

// Each piece: r = how much floor it needs; make() draws it and returns where children sit.
export const FEATURES = {
  // A big round fish tank: see-through water on a navy base, sand, seaweed and coral, and fish swimming round.
  tank: { r: 0.12, make(bag, x, z, c, rnd) {
    bag.cyl('#2e4a8c', 0.105, 0.04, x, 0.02, z, 0.11, 24); bag.cyl('#f0e2c0', 0.088, 0.012, x, 0.046, z, 0.088, 20);
    bag.cyl(WATER, 0.095, 0.25, x, 0.165, z, 0.095, 28);
    bag.add('#fbfaf6', new THREE.TorusGeometry(0.095, 0.006, 6, 28).rotateX(Math.PI / 2).translate(x, 0.29, z));
    weedAt(bag, x + 0.03, 0.052, z - 0.02, rnd); coralAt(bag, x - 0.04, 0.052, z + 0.03, rnd);
    for (let k = 0; k < 5; k++) { const a = rnd() * 6.28, rr = 0.03 + rnd() * 0.04; fishAt(bag, x + Math.cos(a) * rr, 0.09 + rnd() * 0.17, z + Math.sin(a) * rr, -Math.sin(a), Math.cos(a), 0.012, FISH_COLS[k % FISH_COLS.length]); }
    if (rnd() < 0.5) {      // a turtle paddling round
      const ta = rnd() * 6.28, tx = x + Math.cos(ta) * 0.035, tz = z + Math.sin(ta) * 0.035, ty = 0.17, dir = ta + Math.PI / 2;
      bag.add('#5f9a4c', new THREE.SphereGeometry(0.022, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.2, 0.55, 1).rotateY(-dir).translate(tx, ty, tz));
      bag.add('#a3d140', new THREE.SphereGeometry(0.0085, 8, 5).translate(Math.cos(dir) * 0.03, 0.002, -Math.sin(dir) * 0.03).translate(tx, ty, tz));
      for (const [fx, fz] of [[0.014, 0.02], [0.014, -0.02], [-0.016, 0.016], [-0.016, -0.016]]) bag.add('#a3d140', new THREE.BoxGeometry(0.016, 0.003, 0.008).rotateY(fz > 0 ? -0.5 : 0.5).translate(fx, 0, fz).rotateY(-dir).translate(tx, ty, tz));
    }
    return [[x + 0.16, z], [x - 0.16, z], [x, z + 0.16]]; } },
  // A tank of jellyfish: pink bells with trailing legs in deeper blue water.
  jelly: { r: 0.12, make(bag, x, z, c, rnd) {
    bag.cyl('#2e4a8c', 0.105, 0.04, x, 0.02, z, 0.11, 24);
    bag.cyl('~#8aa6ee', 0.095, 0.25, x, 0.165, z, 0.095, 28);
    bag.add('#fbfaf6', new THREE.TorusGeometry(0.095, 0.006, 6, 28).rotateX(Math.PI / 2).translate(x, 0.29, z));
    for (let k = 0; k < 4; k++) {
      const a = rnd() * 6.28, rr = rnd() * 0.05, jx = x + Math.cos(a) * rr, jz = z + Math.sin(a) * rr, jy = 0.11 + rnd() * 0.14, s = 0.018 + rnd() * 0.01;
      bag.add('#f5a3c7', new THREE.SphereGeometry(s, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(jx, jy, jz));
      for (let t = 0; t < 4; t++) { const ta = t * Math.PI / 2 + 0.4; bag.cyl('#fbd3e4', 0.0025, s * 2.2, jx + Math.cos(ta) * s * 0.5, jy - s * 1.1, jz + Math.sin(ta) * s * 0.5, 0.0025, 4); }
    }
    return [[x + 0.16, z], [x - 0.16, z]]; } },

  roundTable: { r: 0.13, make: (bag, x, z, c, rnd) => roundTableAt(bag, x, z, rnd) },
  lunchTable: { r: 0.13, make: (bag, x, z, c, rnd) => roundTableAt(bag, x, z, rnd, true) },
  kidney: { r: 0.16, make(bag, x, z, c, rnd) {
    const rot = rnd() * Math.PI * 2;
    bag.plan(TABLE, bean(0.13, 0.05), 0.012, x, 0.075, z, rot);
    const seats = [];
    for (let i = 0; i < 4; i++) { const a = rot + Math.PI + (i - 1.5) * 0.5, sx = x + Math.sin(a) * 0.07, sz = z + Math.cos(a) * 0.07; bag.cyl(pickC(rnd), 0.022, 0.045, sx, 0.0225, sz); seats.push([sx, sz]); }
    tableClutter(bag, x + Math.sin(rot) * 0.02, z + Math.cos(rot) * 0.02, 0.093, rnd, 0.06);
    return seats; } },
  rug: { r: 0.17, make(bag, x, z, c, rnd) {
    const col = pickC(rnd);
    bag.cyl(col, 0.15, 0.006, x, 0.003, z, 0.15, 28); bag.cyl('#ffffff', 0.1, 0.007, x, 0.0035, z, 0.1, 24); bag.cyl(col, 0.05, 0.008, x, 0.004, z, 0.05, 16);
    const seats = [];
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, sx = x + Math.cos(a) * 0.11, sz = z + Math.sin(a) * 0.11; bag.ball(pickC(rnd), 0.022, sx, 0.006, sz); seats.push([sx, sz]); }
    return seats; } },
  mountain: { r: 0.2, make(bag, x, z, c, rnd) {
    // Stepped seats, like a little mountain to climb and sit on (after Rosan Bosch's school "mountains").
    const seats = [], col = pickC(rnd);
    for (let k = 0; k < 3; k++) { const rr = 0.19 - k * 0.055, hh = 0.035 * (k + 1); bag.cyl(k % 2 ? '#fbfaf6' : col, rr, hh, x, hh / 2, z, rr, 24); for (let i = 0; i < 4 - k; i++) { const a = rnd() * 6.28; seats.push([x + Math.cos(a) * (rr - 0.03), z + Math.sin(a) * (rr - 0.03)]); } }
    return seats; } },
  cave: { r: 0.12, make(bag, x, z, c, rnd) {
    // A cosy reading cave: half a dome with a cushion inside.
    const col = pickC(rnd), rot = rnd() * 6.28;
    bag.add(col, new THREE.SphereGeometry(0.11, 14, 8, rot, Math.PI * 1.35, 0, Math.PI / 2).translate(x, 0, z));
    bag.ball('#ffffff', 0.04, x, 0, z);
    return [[x, z]]; } },
  beanbag: { r: 0.06, make(bag, x, z, c, rnd) { bag.ball(pickC(rnd), 0.05, x, 0, z); return [[x, z]]; } },
  plant: { r: 0.05, make(bag, x, z, c, rnd) { bag.cyl('#fbfaf6', 0.028, 0.05, x, 0.025, z, 0.022, 10); bag.sphere(LEAF[Math.floor(rnd() * 3)], 0.05, x, 0.1, z, 10); return []; } },
  tree: { r: 0.16, make(bag, x, z, c, rnd) {
    // An indoor tree with a round bench.
    bag.cyl('#9b7b5c', 0.02, 0.22, x, 0.11, z, 0.026, 8); bag.sphere('#7db45a', 0.1, x, 0.27, z, 12);
    bag.add(pickC(rnd), new THREE.TorusGeometry(0.1, 0.022, 6, 24).rotateX(Math.PI / 2).translate(x, 0.035, z));
    const seats = []; for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.28; seats.push([x + Math.cos(a) * 0.1, z + Math.sin(a) * 0.1]); }
    return seats; } },
  shelf: { r: 0.15, make(bag, x, z, c, rnd) {
    // A curved, open bookshelf: boards, end panels and rows of books you can see from both sides.
    const R = 0.14, D = 0.034, a0 = rnd() * 6.28, span = 2.1, H = 0.17;
    const arc = (r0, r1) => { const s = new THREE.Shape(); s.absarc(0, 0, r1, a0, a0 + span, false); s.absarc(0, 0, r0, a0 + span, a0, true); return s; };
    for (const y of [0, 0.056, 0.112, H - 0.006]) bag.slab(WHITE, arc(R - D, R), 0.006, x, y, z, 0, 16);
    for (const a of [a0, a0 + span]) bag.add(WHITE, new THREE.BoxGeometry(D, H, 0.008).translate(R - D / 2, H / 2, 0).rotateY(a).translate(x, 0, z));
    for (let r = 0; r < 3; r++) {
      let a = a0 + 0.06;
      while (a < a0 + span - 0.06) {
        const t = (0.006 + rnd() * 0.006) / (R - D / 2), h = 0.03 + rnd() * 0.016;
        if (rnd() > 0.07) bag.add(RAINBOW[Math.floor(rnd() * RAINBOW.length)], new THREE.BoxGeometry(D - 0.008, h, t * (R - D / 2) * 0.9).translate(R - D / 2, 0.006 + r * 0.056 + h / 2, 0).rotateY(a + t / 2).translate(x, 0, z));
        a += t;
      }
    }
    return []; } },
  hoop: { r: 0.08, make(bag, x, z) { bag.cyl('#fbfaf6', 0.008, 0.36, x, 0.18, z, 0.008, 6); bag.box('#ffffff', 0.12, 0.08, 0.008, x, 0.36, z); bag.add('#f28b30', new THREE.TorusGeometry(0.035, 0.005, 6, 14).rotateX(Math.PI / 2).translate(x, 0.33, z + 0.04)); return []; } },
  trampoline: { r: 0.16, make(bag, x, z, c, rnd) { bag.cyl('#3d8de0', 0.15, 0.03, x, 0.03, z, 0.15, 24); bag.cyl('#26272d', 0.13, 0.032, x, 0.032, z, 0.13, 24); for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28; bag.cyl(STEEL, 0.005, 0.02, x + Math.cos(a) * 0.14, 0.01, z + Math.sin(a) * 0.14, 0.005, 6); } return []; } },
  // An easel with a painting on it, a jar of brushes on its ledge.
  easel: { r: 0.08, make(bag, x, z, c, rnd) {
    const m = frame(x, z, rnd() * 6.28);
    bag.within(m, s => {
      for (const sx of [-0.035, 0.035]) s.add(WOOD, new THREE.BoxGeometry(0.008, 0.21, 0.008).rotateX(-0.12).rotateZ(sx > 0 ? -0.08 : 0.08).translate(sx, 0.104, 0.012));
      s.add(WOOD, new THREE.BoxGeometry(0.008, 0.2, 0.008).rotateX(0.35).translate(0, 0.095, -0.03));
      s.box(WOOD, 0.1, 0.008, 0.016, 0, 0.1, 0.022);
      painting(s, 0.1, 0.085, 0.152, 0.012, Math.floor(rnd() * 6), rnd);
      s.cyl(pickC(rnd), 0.007, 0.012, 0.03, 0.11, 0.024, 0.007, 8);
    });
    return [at(m, 0, 0.09)]; } },
  stage: { r: 0.2, make(bag, x, z, c, rnd) {
    bag.cyl('#d8b98c', 0.15, 0.04, x, 0.02, z, 0.15, 24);
    bag.box('#26272d', 0.13, 0.06, 0.06, x - 0.04, 0.07, z - 0.04); bag.box('#ffffff', 0.12, 0.008, 0.02, x - 0.04, 0.1, z - 0.015);
    for (let i = 0; i < 6; i++) bag.box('#26272d', 0.006, 0.004, 0.012, x - 0.093 + i * 0.022, 0.105, z - 0.018);
    bag.cyl('#e6463c', 0.035, 0.04, x + 0.06, 0.06, z + 0.02); bag.cyl('#fbfaf6', 0.025, 0.05, x + 0.07, 0.065, z - 0.05);
    bag.cyl(STEEL, 0.003, 0.11, x + 0.02, 0.095, z + 0.08, 0.003, 6); bag.sphere(DARK, 0.007, x + 0.02, 0.152, z + 0.08);
    const seats = []; for (let i = 0; i < 6; i++) { const a = Math.PI * (0.15 + i * 0.14), sx = x + Math.cos(a) * 0.2, sz = z + Math.sin(a) * 0.2; seats.push([sx, sz]); }
    return seats; } },
  yogamat: { r: 0.07, make(bag, x, z, c, rnd) { const rot = rnd() * 6.28; bag.add(pickC(rnd), new THREE.BoxGeometry(0.06, 0.008, 0.15).rotateY(rot).translate(x, 0.004, z)); return [[x, z]]; } },

  // ---- the maker workshop ----
  // A bench with two 3D printers, each printing a little rocket; their print heads slide to and fro.
  printers: { r: 0.14, make(bag, x, z, c, rnd) {
    const m = frame(x, z, rnd() * 6.28), top = 0.078;
    bag.within(m, s => {
      s.box(WOOD, 0.24, 0.012, 0.085, 0, top - 0.006, 0);
      for (const [lx, lz] of [[-0.11, -0.035], [0.11, -0.035], [-0.11, 0.035], [0.11, 0.035]]) s.box('#d8d4cc', 0.01, top - 0.012, 0.01, lx, (top - 0.012) / 2, lz);
      for (const px of [-0.058, 0.058]) {
        const col = pickC(rnd);
        s.box(DARK, 0.066, 0.012, 0.06, px, top + 0.006, 0);
        for (const sx of [-0.029, 0.029]) for (const sz of [-0.025, 0.025]) s.box(DARK, 0.006, 0.08, 0.006, px + sx, top + 0.052, sz);
        for (const sz of [-0.025, 0.025]) s.box(DARK, 0.064, 0.006, 0.006, px, top + 0.092, sz);
        s.box(STEEL, 0.058, 0.004, 0.004, px, top + 0.07, 0);                                       // the rail the head runs on
        s.box(PAPER, 0.046, 0.004, 0.044, px, top + 0.016, 0);                                       // the print bed
        s.cyl(col, 0.006, 0.02, px + 0.004, top + 0.028, 0.004, 0.007, 8); s.cyl(col, 0, 0.012, px + 0.004, top + 0.044, 0.004, 0.006, 8);    // the rocket being printed
        s.add(col, new THREE.CylinderGeometry(0.014, 0.014, 0.01, 12).rotateZ(Math.PI / 2).translate(px, top + 0.109, -0.025));   // the reel of filament, on the back of the frame
        s.cyl(DARK, 0.003, 0.012, px, top + 0.098, -0.025, 0.003, 6);
        s.add('*#7fe0a0', new THREE.PlaneGeometry(0.014, 0.008).translate(px + 0.022, top + 0.006, 0.0305));                    // its little screen
        s.part(partGroup(h => { h.box(ORANGE, 0.014, 0.014, 0.012, 0, 0, 0); h.cyl(STEEL, 0.002, 0.012, 0, -0.012, 0, 0.001, 6); }, { glide: { axis: 'x', base: px, amp: 0.016, speed: 2.2 + rnd(), phase: rnd() * 6 } })).position.set(px, top + 0.062, 0);
      }
    });
    for (const sx of [-0.055, 0.055]) bag.within(m, t => t.cyl(pickC(rnd), 0.02, 0.045, sx, 0.0225, 0.1));
    return [at(m, -0.055, 0.1), at(m, 0.055, 0.1)]; } },
  // A robot arm on a table, sorting coloured blocks: it turns, reaches and lifts.
  robot: { r: 0.12, make(bag, x, z, c, rnd) {
    const m = frame(x, z, rnd() * 6.28), top = 0.078, ph = rnd() * 6;
    bag.within(m, s => {
      s.box(WHITE, 0.2, 0.012, 0.13, 0, top - 0.006, 0);
      for (const [lx, lz] of [[-0.09, -0.055], [0.09, -0.055], [-0.09, 0.055], [0.09, 0.055]]) s.box('#d8d4cc', 0.01, top - 0.012, 0.01, lx, (top - 0.012) / 2, lz);
      s.box('#e9e4da', 0.07, 0.004, 0.07, 0.055, top + 0.002, 0);                                   // the tray of blocks
      for (let i = 0; i < 7; i++) { const bx = 0.035 + (i % 3) * 0.02, bz = -0.022 + Math.floor(i / 3) * 0.022; s.box(RAINBOW[(i * 3) % 8], 0.014, 0.014, 0.014, bx, top + 0.011, bz); }
      s.box(RAINBOW[1], 0.014, 0.014, 0.014, 0.055, top + 0.025, 0);
      s.cyl(DARK, 0.026, 0.012, -0.05, top + 0.006, 0);
      const turret = partGroup(t => { t.cyl(ORANGE, 0.019, 0.026, 0, 0.013, 0); t.add(DARK, new THREE.CylinderGeometry(0.012, 0.012, 0.032, 10).rotateX(Math.PI / 2).translate(0, 0.03, 0)); }, { wave: { axis: 'y', base: 0, amp: 0.8, speed: 0.6, phase: ph } });
      const shoulder = partGroup(t => { t.box(ORANGE, 0.016, 0.08, 0.016, 0, 0.04, 0); t.add(DARK, new THREE.CylinderGeometry(0.01, 0.01, 0.026, 10).rotateX(Math.PI / 2).translate(0, 0.08, 0)); }, { wave: { axis: 'z', base: -0.45, amp: 0.22, speed: 1.2, phase: ph } });
      const elbow = partGroup(t => { t.box(ORANGE, 0.012, 0.066, 0.012, 0, 0.033, 0); t.cyl(DARK, 0.008, 0.012, 0, 0.07, 0); t.box(DARK, 0.004, 0.016, 0.008, -0.006, 0.083, 0); t.box(DARK, 0.004, 0.016, 0.008, 0.006, 0.083, 0); t.box(RAINBOW[5], 0.012, 0.012, 0.012, 0, 0.09, 0); }, { wave: { axis: 'z', base: -1.55, amp: 0.3, speed: 1.2, phase: ph + 0.9 } });
      shoulder.position.y = 0.03; elbow.position.y = 0.08;
      turret.add(shoulder); shoulder.add(elbow); turret.position.set(-0.05, top + 0.012, 0);
      s.part(turret);
    });
    for (const [sx, sz] of [[0.07, 0.11], [-0.07, 0.11], [0.07, -0.11]]) bag.within(m, t => t.cyl(pickC(rnd), 0.02, 0.045, sx, 0.0225, sz));
    return [at(m, 0.07, 0.11), at(m, -0.07, 0.11), at(m, 0.07, -0.11)]; } },
  // A coding mat with a little robot car driving round it.
  rover: { r: 0.1, make(bag, x, z, c, rnd) {
    const rot = rnd() * 6.28;
    for (let i = 0; i < 16; i++) { const u = (i % 4 - 1.5) * 0.042, v = (Math.floor(i / 4) - 1.5) * 0.042; bag.add((i + Math.floor(i / 4)) % 2 ? '#fff4c7' : '#cfe8f7', new THREE.BoxGeometry(0.04, 0.004, 0.04).translate(u, 0.002, v).rotateY(rot).translate(x, 0, z)); }
    const car = partGroup(r => {
      r.box(PAPER, 0.03, 0.016, 0.034, 0, 0.016, 0); r.box(pickC(rnd), 0.026, 0.006, 0.028, 0, 0.027, 0);
      for (const [wx, wz] of [[-0.017, -0.011], [0.017, -0.011], [-0.017, 0.011], [0.017, 0.011]]) r.add(DARK, new THREE.CylinderGeometry(0.008, 0.008, 0.005, 10).rotateZ(Math.PI / 2).translate(wx, 0.008, wz));
      r.sphere(DARK, 0.003, -0.007, 0.02, 0.0175, 6); r.sphere(DARK, 0.003, 0.007, 0.02, 0.0175, 6);
      r.cyl(STEEL, 0.0012, 0.02, 0.008, 0.04, -0.008, 0.0012, 4); r.sphere(RED, 0.004, 0.008, 0.051, -0.008, 6);
    });
    car.position.set(0.05, 0, 0);
    const spin = new THREE.Group(); spin.position.set(x, 0.004, z); spin.rotation.y = rot; spin.userData.yspin = 0.7; spin.add(car);
    bag.part(spin);
    return [[x + Math.cos(rot) * 0.12, z - Math.sin(rot) * 0.12], [x - Math.cos(rot) * 0.12, z + Math.sin(rot) * 0.12]]; } },
  // A woodwork bench: a vice at one end, tools and offcuts on top, a birdhouse being built, a toolbox underneath.
  workbench: { r: 0.15, make(bag, x, z, c, rnd) {
    const m = frame(x, z, rnd() * 6.28), top = 0.078, W = 0.26, D = 0.1, WD = '#c9975f';
    bag.within(m, s => {
      s.box(WD, W, 0.014, D, 0, top - 0.007, 0);
      for (const [lx, lz] of [[-W / 2 + 0.012, -D / 2 + 0.01], [W / 2 - 0.012, -D / 2 + 0.01], [-W / 2 + 0.012, D / 2 - 0.01], [W / 2 - 0.012, D / 2 - 0.01]]) s.box(WD, 0.014, top - 0.014, 0.014, lx, (top - 0.014) / 2, lz);
      s.box(WD, W - 0.03, 0.006, D - 0.02, 0, 0.022, 0);
      s.box(RED, 0.06, 0.03, 0.03, -0.05, 0.04, 0); s.box(DARK, 0.03, 0.004, 0.004, -0.05, 0.058, 0);                     // the toolbox
      for (let i = 0; i < 3; i++) s.box(WOOD, 0.09, 0.006, 0.02, 0.05, 0.028 + i * 0.006, -0.01 + i * 0.004);              // planks
      s.box(DARK, 0.03, 0.02, 0.012, W / 2 - 0.03, top + 0.01, D / 2 - 0.004); s.box(DARK, 0.03, 0.02, 0.008, W / 2 - 0.03, top + 0.01, D / 2 + 0.012);   // the vice
      s.add(STEEL, new THREE.CylinderGeometry(0.002, 0.002, 0.04, 4).rotateZ(Math.PI / 2).translate(W / 2 - 0.03, top + 0.006, D / 2 + 0.02));
      s.box(WOOD, 0.012, 0.006, 0.07, W / 2 - 0.03, top + 0.022, D / 2 - 0.02);                                               // a stick in the vice
      // The birdhouse: walls, a roof and a round hole.
      s.box(WOOD, 0.04, 0.035, 0.035, -0.06, top + 0.0175, -0.01);
      for (const sg of [-1, 1]) s.add(RED, new THREE.BoxGeometry(0.046, 0.004, 0.026).rotateX(sg * 0.7).translate(-0.06, top + 0.044, -0.01 + sg * 0.009));
      s.add(DARK, new THREE.CircleGeometry(0.006, 8).translate(-0.06, top + 0.02, 0.0076));
      s.box(STEEL, 0.026, 0.008, 0.008, 0.02, top + 0.004, 0.02); s.box(RED, 0.004, 0.004, 0.04, 0.02, top + 0.002, 0.04);      // hammer
      s.add(STEEL, tri([[0, 0], [0.05, 0], [0.05, 0.02]]).rotateX(-Math.PI / 2).translate(0.03, top + 0.0012, -0.02)); s.box(ORANGE, 0.016, 0.004, 0.012, 0.024, top + 0.002, -0.026);   // saw
      for (let i = 0; i < 4; i++) s.box('#e8cfa4', 0.02 + rnd() * 0.02, 0.006, 0.012, 0.075 + (rnd() - 0.5) * 0.02, top + 0.003 + i * 0.006, -0.02 + rnd() * 0.02);   // offcuts
      for (const sx of [-0.08, 0, 0.08]) s.cyl(pickC(rnd), 0.02, 0.045, sx, 0.0225, D / 2 + 0.05);
    });
    return [at(m, -0.08, D / 2 + 0.05), at(m, 0, D / 2 + 0.05), at(m, 0.08, D / 2 + 0.05)]; } },
  // A cardboard rocket the children are building.
  cardrocket: { r: 0.06, make(bag, x, z, c, rnd) {
    const CARD = '#c9a574';
    bag.cyl(CARD, 0.03, 0.14, x, 0.07, z, 0.03, 12); bag.cyl(RED, 0, 0.06, x, 0.17, z, 0.03, 12);
    bag.add('#3d8de0', new THREE.CircleGeometry(0.011, 10).translate(0, 0.1, 0.0302).rotateY(rnd() * 6).translate(x, 0, z));
    const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(0.032, 0); fin.lineTo(0, 0.055); fin.closePath();
    for (let i = 0; i < 3; i++) bag.add(CARD, new THREE.ExtrudeGeometry(fin, { depth: 0.004, bevelEnabled: false }).translate(0.027, 0, -0.002).rotateY(i * 2.094 + 0.3).translate(x, 0.004, z));
    bag.box('#e9e4da', 0.03, 0.002, 0.04, x + 0.05, 0.001, z + 0.02);
    return []; } },

  // ---- the art room ----
  // A table covered in paper and paint pots, with brushes in a jar.
  painttable: { r: 0.15, make(bag, x, z, c, rnd) {
    const m = frame(x, z, rnd() * 6.28);
    bag.within(m, s => {
      s.box(TABLE, 0.22, 0.012, 0.13, 0, 0.075, 0); for (const [lx, lz] of [[-0.1, -0.055], [0.1, -0.055], [-0.1, 0.055], [0.1, 0.055]]) s.box('#d8d4cc', 0.01, 0.069, 0.01, lx, 0.0345, lz);
      s.box(PAPER, 0.16, 0.002, 0.09, 0, 0.082, 0);
      for (let i = 0; i < 9; i++) s.add(pickC(rnd), new THREE.CircleGeometry(0.006 + rnd() * 0.012, 8).rotateX(-Math.PI / 2).translate((rnd() - 0.5) * 0.13, 0.0835 + i * 0.0002, (rnd() - 0.5) * 0.07));
      for (let i = 0; i < 6; i++) { s.cyl(PAPER, 0.008, 0.012, -0.075 + i * 0.03, 0.088, -0.055, 0.008, 8); s.cyl(RAINBOW[i], 0.0065, 0.002, -0.075 + i * 0.03, 0.0945, -0.055, 0.0065, 8); }
      s.cyl('~#bfe4f3', 0.01, 0.022, 0.09, 0.093, 0.04, 0.01, 8); for (let i = 0; i < 3; i++) s.add(WOOD, new THREE.CylinderGeometry(0.0015, 0.0015, 0.04, 4).rotateZ((i - 1) * 0.25).translate(0.09 + (i - 1) * 0.003, 0.11, 0.04));
    });
    return [at(m, -0.06, 0.1), at(m, 0.06, 0.1), at(m, -0.06, -0.1), at(m, 0.06, -0.1)]; } },
  // A free-standing display board on feet, with children's paintings on both sides (for rooms with glass walls).
  artwall: { r: 0.11, make(bag, x, z, c, rnd) {
    const m = frame(x, z, rnd() * 6.28);
    bag.within(m, s => {
      s.box(WHITE, 0.2, 0.15, 0.01, 0, 0.115, 0); s.box(pickC(rnd), 0.206, 0.008, 0.014, 0, 0.192, 0);
      for (const fx of [-0.085, 0.085]) { s.box('#d8d4cc', 0.008, 0.04, 0.008, fx, 0.02, 0); s.box('#d8d4cc', 0.012, 0.006, 0.07, fx, 0.003, 0); }
      for (const side of [0, Math.PI]) s.within(new THREE.Matrix4().makeRotationY(side), p => {
        for (const [px, py, pw, ph] of [[-0.045, 0.148, 0.085, 0.062], [0.055, 0.152, 0.065, 0.05], [0.04, 0.08, 0.07, 0.05], [-0.055, 0.078, 0.05, 0.045]]) p.within(new THREE.Matrix4().makeTranslation(px, 0, 0), q => painting(q, pw, ph, py, 0.005, Math.floor(rnd() * 6), rnd));
      });
    });
    return []; } },
  // ---- the music room ----
  // A drum kit: a big drum on its side, two drums on top, a drum and two cymbals on stands, and a stool.
  drums: { r: 0.1, make(bag, x, z, c, rnd) {
    const m = frame(x, z, rnd() * 6.28), col = [RED, '#3d8de0', '#7c46a8', ORANGE][Math.floor(rnd() * 4)];
    bag.within(m, s => {
      s.add(col, new THREE.CylinderGeometry(0.034, 0.034, 0.03, 16).rotateX(Math.PI / 2).translate(0, 0.036, 0.01));
      s.add(PAPER, new THREE.CircleGeometry(0.03, 16).translate(0, 0.036, 0.0251)); s.add(PAPER, new THREE.CircleGeometry(0.03, 16).rotateY(Math.PI).translate(0, 0.036, -0.0051));
      for (const sx of [-0.019, 0.019]) { s.add(col, new THREE.CylinderGeometry(0.015, 0.015, 0.016, 12).rotateX(0.35).translate(sx, 0.08, 0.004)); s.add(PAPER, new THREE.CylinderGeometry(0.0145, 0.0145, 0.002, 12).rotateX(0.35).translate(sx, 0.087, 0.0065)); }
      s.cyl(STEEL, 0.002, 0.065, 0.058, 0.0325, -0.01, 0.002, 4); s.cyl(col, 0.018, 0.012, 0.058, 0.07, -0.01); s.cyl(PAPER, 0.0175, 0.002, 0.058, 0.077, -0.01);
      for (const [cx, cy] of [[-0.06, 0.1], [0.045, 0.115]]) { s.cyl(STEEL, 0.0018, cy, cx, cy / 2, -0.03, 0.0018, 4); s.cyl(GOLD, 0.024, 0.002, cx, cy, -0.03, 0.006, 14); }
      s.cyl(DARK, 0.016, 0.006, 0, 0.045, -0.06); s.cyl(DARK, 0.004, 0.042, 0, 0.021, -0.06, 0.008, 6);
    });
    return [at(m, 0, -0.06)]; } },
  // A xylophone: rainbow bars on a wooden frame, and two beaters.
  xylophone: { r: 0.065, make(bag, x, z, c, rnd) {
    const m = frame(x, z, rnd() * 6.28);
    bag.within(m, s => {
      for (const sz of [-0.022, 0.022]) s.add(WOOD, new THREE.BoxGeometry(0.11, 0.008, 0.008).rotateY(sz > 0 ? 0.12 : -0.12).translate(0, 0.05, sz));
      for (const [lx, lz] of [[-0.05, -0.028], [0.05, -0.016], [-0.05, 0.028], [0.05, 0.016]]) s.box(WOOD, 0.006, 0.046, 0.006, lx, 0.023, lz);
      for (let i = 0; i < 8; i++) { const len = 0.07 - i * 0.004; s.box(RAINBOW[i], 0.01, 0.005, len, -0.043 + i * 0.0123, 0.0565, 0); }
      for (const sz of [-0.01, 0.012]) { s.add(WOOD, new THREE.CylinderGeometry(0.0015, 0.0015, 0.05, 4).rotateZ(Math.PI / 2).rotateY(sz * 20).translate(0.035, 0.062, sz + 0.03)); s.sphere(RED, 0.005, 0.01, 0.062, sz + 0.03 - 0.004, 6); }
    });
    return [at(m, 0, -0.07), at(m, 0, 0.07)]; } },

  // ---- the hall ----
  // A rainbow play parachute spread on the floor, with children all round it.
  parachute: { r: 0.19, make(bag, x, z, c, rnd) {
    const r = 0.16, rot = rnd() * 6;
    for (let i = 0; i < 12; i++) bag.floor(RAINBOW[i % 8], new THREE.CircleGeometry(r, 3, rot + (i / 12) * Math.PI * 2, Math.PI * 2 / 12), x, 0.003, z);
    bag.floor(PAPER, new THREE.CircleGeometry(0.025, 12), x, 0.0034, z);
    const seats = []; for (let i = 0; i < 8; i++) { const a = rot + (i / 8) * Math.PI * 2; seats.push([x + Math.cos(a) * (r + 0.015), z - Math.sin(a) * (r + 0.015)]); }
    return seats; } },
  // A thick blue gym mat.
  gymmat: { r: 0.1, make(bag, x, z, c, rnd) { const rot = rnd() * 6.28; bag.add('#3d8de0', new THREE.BoxGeometry(0.1, 0.016, 0.17).rotateY(rot).translate(x, 0.008, z)); bag.add('#6aa8ec', new THREE.BoxGeometry(0.084, 0.002, 0.154).rotateY(rot).translate(x, 0.017, z)); return [[x, z]]; } },
  // A wooden climbing frame: two A-frames joined by rungs, with a slide board hooked on one side.
  climbframe: { r: 0.15, make(bag, x, z, c, rnd) {
    const m = frame(x, z, rnd() * 6.28), H = 0.17, half = 0.07;
    bag.within(m, s => {
      for (const sx of [-0.06, 0.06]) for (const sg of [-1, 1]) s.add(WOOD, new THREE.BoxGeometry(0.01, Math.hypot(H, half), 0.012).rotateX(-sg * Math.atan2(half, H)).translate(sx, H / 2, sg * half / 2));
      for (let i = 1; i < 7; i++) { const y = i * H / 7, zz = half * (1 - y / H); for (const sg of [-1, 1]) s.add('#e8cfa4', new THREE.CylinderGeometry(0.0035, 0.0035, 0.12, 6).rotateZ(Math.PI / 2).translate(0, y, sg * zz)); }
      s.add('#e8cfa4', new THREE.CylinderGeometry(0.005, 0.005, 0.13, 6).rotateZ(Math.PI / 2).translate(0, H, 0));
      s.add(pickC(rnd), new THREE.BoxGeometry(0.07, 0.006, 0.19).rotateX(0.73).translate(0, 0.068, 0.11));
    });
    return [at(m, 0, -0.12)]; } },
  // Big soft foam shapes to build and climb: a wedge, steps, a roll and a cube.
  softplay: { r: 0.13, make(bag, x, z, c, rnd) {
    const m = frame(x, z, rnd() * 6.28);
    bag.within(m, s => {
      const wedge = new THREE.Shape(); wedge.moveTo(0, 0); wedge.lineTo(0.1, 0); wedge.lineTo(0, 0.05); wedge.closePath();
      s.add(RAINBOW[0], new THREE.ExtrudeGeometry(wedge, { depth: 0.07, bevelEnabled: false }).translate(-0.12, 0, -0.035));
      s.box(RAINBOW[2], 0.05, 0.05, 0.07, -0.045, 0.025, 0); s.box(RAINBOW[4], 0.05, 0.025, 0.07, 0.005, 0.0125, 0);
      s.add(RAINBOW[5], new THREE.CylinderGeometry(0.025, 0.025, 0.08, 14).rotateX(Math.PI / 2).translate(0.07, 0.025, -0.03));
      s.box(RAINBOW[7], 0.045, 0.045, 0.045, 0.07, 0.0225, 0.05);
    });
    return [at(m, -0.045, 0.06), at(m, 0.07, 0.1)]; } },
  // A vaulting box: wooden layers and a soft red top.
  vault: { r: 0.075, make(bag, x, z, c, rnd) {
    const rot = rnd() * 6.28;
    for (let i = 0; i < 4; i++) bag.add(i % 2 ? '#c9975f' : WOOD, new THREE.BoxGeometry(0.13 - i * 0.008, 0.024, 0.07 - i * 0.004).rotateY(rot).translate(x, 0.012 + i * 0.024, z));
    bag.add(RED, new THREE.BoxGeometry(0.1, 0.012, 0.056).rotateY(rot).translate(x, 0.102, z));
    return []; } },
  // A basket heaped with balls.
  balls: { r: 0.06, make(bag, x, z, c, rnd) {
    bag.cyl(STEEL, 0.04, 0.035, x, 0.0175, z, 0.036, 12); bag.cyl('#e9e4da', 0.036, 0.002, x, 0.034, z, 0.036, 12);
    for (let i = 0; i < 7; i++) { const a = i * 0.9, rr = i ? 0.02 : 0; bag.sphere(RAINBOW[(i * 3) % 8], 0.013, x + Math.cos(a) * rr, 0.045 + (i ? 0 : 0.012), z + Math.sin(a) * rr, 8); }
    bag.sphere(ORANGE, 0.013, x + 0.06, 0.013, z + 0.02, 8);
    return []; } },
  // A long, low PE bench.
  bench: { r: 0.14, make(bag, x, z, c, rnd) {
    const m = frame(x, z, rnd() * 6.28);
    bag.within(m, s => { s.box(WOOD, 0.26, 0.012, 0.04, 0, 0.045, 0); for (const sx of [-0.1, 0.1]) { s.box(STEEL, 0.008, 0.039, 0.036, sx, 0.0195, 0); } s.box('#c9975f', 0.24, 0.006, 0.012, 0, 0.012, 0); });
    return [at(m, -0.08, 0), at(m, 0, 0), at(m, 0.08, 0)]; } },
  // Little orange cones and a rope ladder on the floor, for races.
  cones: { r: 0.13, make(bag, x, z, c, rnd) {
    const m = frame(x, z, rnd() * 6.28);
    bag.within(m, s => {
      for (let i = 0; i < 4; i++) { s.cyl(ORANGE, 0.0015, 0.026, -0.09 + i * 0.06, 0.013, -0.03, 0.011, 8); s.cyl(ORANGE, 0.014, 0.002, -0.09 + i * 0.06, 0.001, -0.03, 0.014, 8); }
      for (const sz of [0.02, 0.05]) s.box('#f7c22e', 0.24, 0.002, 0.004, 0, 0.001, sz);
      for (let i = 0; i < 7; i++) s.box('#f7c22e', 0.004, 0.0022, 0.03, -0.11 + i * 0.037, 0.0011, 0.035);
    });
    return []; } },

  // ---- the chill-out room ----
  // A hanging egg chair on a curved stand, with a cushion inside.
  eggchair: { r: 0.08, make(bag, x, z, c, rnd) {
    const m = frame(x, z, rnd() * 6.28), col = pickC(rnd);
    bag.within(m, s => {
      s.cyl(STEEL, 0.035, 0.006, -0.04, 0.003, 0);
      s.tube(STEEL, [new THREE.Vector3(-0.04, 0.005, 0), new THREE.Vector3(-0.058, 0.1, 0), new THREE.Vector3(-0.035, 0.19, 0), new THREE.Vector3(0.008, 0.212, 0)], 0.005, 20, 6);
      s.cyl(STEEL, 0.0015, 0.04, 0.008, 0.19, 0, 0.0015, 4);
      s.add('^' + col, new THREE.SphereGeometry(0.046, 14, 10, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI).scale(1, 1.3, 1).translate(0.008, 0.11, 0));
      s.ball(PAPER, 0.03, 0.008, 0.06, 0.004); s.ball(pickC(rnd), 0.014, -0.006, 0.08, -0.018);
    });
    return []; } },
  // A bubble tube: a tall column of water with bubbles rising, lit up, on a soft mat.
  bubbletube: { r: 0.06, make(bag, x, z, c, rnd) {
    bag.cyl(pickC(rnd), 0.055, 0.008, x, 0.004, z);
    bag.cyl(WHITE, 0.026, 0.024, x, 0.02, z, 0.028); bag.cyl('*#7fd8f0', 0.019, 0.004, x, 0.034, z);
    bag.cyl('~#9fdcf5', 0.018, 0.2, x, 0.136, z, 0.018, 14); bag.cyl(WHITE, 0.02, 0.012, x, 0.242, z); bag.cyl('*#f5a3c7', 0.019, 0.004, x, 0.234, z);
    for (let i = 0; i < 9; i++) bag.sphere(PAPER, 0.0035 + rnd() * 0.003, x + (rnd() - 0.5) * 0.02, 0.05 + i * 0.02 + rnd() * 0.01, z + (rnd() - 0.5) * 0.02, 6);
    return []; } },
  // Floor cushions round a low table with a singing bowl on it.
  cushions: { r: 0.1, make(bag, x, z, c, rnd) {
    bag.cyl(WOOD, 0.036, 0.006, x, 0.028, z); bag.cyl(WOOD, 0.006, 0.025, x, 0.0125, z, 0.006, 6);
    bag.cyl(GOLD, 0.012, 0.01, x, 0.036, z, 0.008, 10);
    const seats = [], off = rnd() * 6;
    for (let i = 0; i < 4; i++) { const a = off + i * Math.PI / 2, sx = x + Math.cos(a) * 0.07, sz = z + Math.sin(a) * 0.07; bag.cyl(['#f5a3c7', '#a3d140', '#7fd8f0', '#f7c22e'][i], 0.025, 0.014, sx, 0.007, sz, 0.027, 12); seats.push([sx, sz]); }
    return seats; } },
  // A little fountain: smooth stones in a round pool, water trickling down (like Finn's waterfall).
  fountain: { r: 0.07, make(bag, x, z, c, rnd) {
    const ring = new THREE.Shape(); ring.absarc(0, 0, 0.062, 0, Math.PI * 2, false); const hole = new THREE.Path(); hole.absarc(0, 0, 0.05, 0, Math.PI * 2, true); ring.holes.push(hole);
    bag.slab('#b9b4aa', ring, 0.03, x, 0, z, 0, 18); bag.cyl('#7a8c99', 0.05, 0.006, x, 0.003, z, 0.05, 16); bag.cyl('~#5ec4e2', 0.05, 0.02, x, 0.016, z, 0.05, 16);
    [[0.034, 0.015, '#9aa3a8'], [0.026, 0.04, '#c9ccd3'], [0.018, 0.06, '#e8e4da']].forEach(([r, y, col]) => bag.add(col, new THREE.SphereGeometry(r, 10, 6).scale(1, 0.45, 1).translate(x, y, z)));
    bag.cyl('~#9fdcf5', 0.006, 0.05, x + 0.02, 0.04, z, 0.012, 8);
    for (let i = 0; i < 3; i++) { const a = rnd() * 6.28; bag.sphere(LEAF[i], 0.012, x + Math.cos(a) * 0.07, 0.012, z + Math.sin(a) * 0.07, 6); }
    return []; } },

  // ---- the aquarium ----
  // A touch pool: a low stone ring of shallow water, with starfish, shells and a crab on the sand.
  touchpool: { r: 0.12, make(bag, x, z, c, rnd) {
    const ring = new THREE.Shape(); ring.absarc(0, 0, 0.11, 0, Math.PI * 2, false); const hole = new THREE.Path(); hole.absarc(0, 0, 0.09, 0, Math.PI * 2, true); ring.holes.push(hole);
    bag.slab('#b9b4aa', ring, 0.045, x, 0, z, 0, 22); bag.cyl('#f0e2c0', 0.09, 0.008, x, 0.004, z, 0.09, 20); bag.cyl('~#5ec4e2', 0.09, 0.03, x, 0.023, z, 0.09, 20);
    for (let i = 0; i < 4; i++) { const a = rnd() * 6.28, rr = 0.02 + rnd() * 0.05; bag.add(['#f28b30', '#e2457d', '#7c46a8', '#f7c22e'][i], new THREE.ExtrudeGeometry(star(0.012), { depth: 0.004, bevelEnabled: false }).rotateX(-Math.PI / 2).rotateY(rnd() * 6).translate(x + Math.cos(a) * rr, 0.008, z + Math.sin(a) * rr)); }
    const ca = rnd() * 6.28, cx = x + Math.cos(ca) * 0.04, cz = z + Math.sin(ca) * 0.04;
    bag.add(RED, new THREE.SphereGeometry(0.009, 8, 5).scale(1.3, 0.55, 1).translate(cx, 0.012, cz)); for (const sg of [-1, 1]) bag.sphere(RED, 0.004, cx + sg * 0.012, 0.012, cz + 0.006, 6);
    for (let i = 0; i < 2; i++) { const a = rnd() * 6.28; bag.add(PAPER, new THREE.ConeGeometry(0.006, 0.012, 6).rotateZ(1.2).translate(x + Math.cos(a) * 0.06, 0.011, z + Math.sin(a) * 0.06)); }
    for (let i = 0; i < 2; i++) { const a = rnd() * 6.28; bag.add('#9aa3a8', new THREE.SphereGeometry(0.018, 8, 5).scale(1.2, 0.9, 1).translate(x + Math.cos(a) * 0.055, 0.03, z + Math.sin(a) * 0.055)); }
    const seats = []; for (let i = 0; i < 3; i++) { const a = rnd() * 0.5 + i * 2.1; seats.push([x + Math.cos(a) * 0.15, z + Math.sin(a) * 0.15]); }
    return seats; } },

  // ---- the lunch hall ----
  // A water fountain with cups.
  water: { r: 0.045, make(bag, x, z, c, rnd) {
    bag.box(WHITE, 0.034, 0.064, 0.034, x, 0.032, z); bag.cyl('~#8fd3f4', 0.014, 0.032, x, 0.082, z, 0.014, 10); bag.cyl('#3d8de0', 0.006, 0.006, x, 0.1, z, 0.006, 8);
    for (let i = 0; i < 3; i++) bag.cyl(PAPER, 0.004, 0.008, x + 0.006 * i - 0.006, 0.068, z + 0.012, 0.003, 6);
    return []; } },
  // Three bins for recycling: paper, plastic and food.
  bins: { r: 0.06, make(bag, x, z, c, rnd) {
    const rot = rnd() * 6.28;
    ['#3d8de0', '#f7c22e', '#7db45a'].forEach((col, i) => { const bx = x + Math.cos(rot) * (i - 1) * 0.036, bz = z - Math.sin(rot) * (i - 1) * 0.036; bag.cyl(col, 0.016, 0.05, bx, 0.025, bz, 0.014, 10); bag.cyl(PAPER, 0.0165, 0.006, bx, 0.053, bz, 0.0165, 10); });
    return []; } },

  // ---- the library ----
  // A big story chair with a cushion, and a lamp on a little table beside it.
  storychair: { r: 0.09, make(bag, x, z, c, rnd) {
    const m = frame(x, z, rnd() * 6.28), col = pickC(rnd);
    bag.within(m, s => {
      s.box(col, 0.09, 0.035, 0.075, 0, 0.0175, 0); s.box(col, 0.09, 0.08, 0.02, 0, 0.055, -0.03);
      for (const sx of [-0.04, 0.04]) s.box(col, 0.016, 0.06, 0.075, sx, 0.03, 0);
      s.box(PAPER, 0.06, 0.012, 0.05, 0, 0.041, 0.005); s.ball(pickC(rnd), 0.02, -0.02, 0.047, -0.012);
      s.cyl(WOOD, 0.018, 0.004, 0.075, 0.05, -0.01); s.cyl(WOOD, 0.003, 0.05, 0.075, 0.025, -0.01, 0.003, 6);
      s.cyl(DARK, 0.002, 0.04, 0.075, 0.072, -0.01, 0.002, 4); s.cyl('*#ffe7a3', 0.009, 0.014, 0.075, 0.095, -0.01, 0.016, 10);
      s.box(RAINBOW[Math.floor(rnd() * 8)], 0.02, 0.006, 0.026, 0.075, 0.055, -0.01);
    });
    return [at(m, 0, 0.005)]; } },
  // A globe on a stand.
  globe: { r: 0.045, make(bag, x, z, c, rnd) {
    bag.cyl(WOOD, 0.02, 0.006, x, 0.003, z, 0.024, 10); bag.cyl(WOOD, 0.004, 0.06, x, 0.033, z, 0.004, 6);
    bag.sphere('#3d8de0', 0.03, x, 0.09, z, 12);
    for (let i = 0; i < 5; i++) { const a = rnd() * 6.28, e = (rnd() - 0.5) * 1.4; bag.sphere('#7db45a', 0.011 + rnd() * 0.007, x + Math.cos(a) * Math.cos(e) * 0.025, 0.09 + Math.sin(e) * 0.025, z + Math.sin(a) * Math.cos(e) * 0.025, 6); }
    bag.add(GOLD, new THREE.TorusGeometry(0.034, 0.002, 3, 16, Math.PI).rotateZ(-0.4 + Math.PI / 2).translate(x, 0.09, z));
    return []; } },
  // A sculpture on a plinth.
  sculpture: { r: 0.06, make(bag, x, z, c, rnd) {
    bag.box(WHITE, 0.06, 0.07, 0.06, x, 0.035, z);
    bag.add(pickC(rnd), new THREE.TorusGeometry(0.022, 0.009, 8, 16).translate(x, 0.1, z));
    bag.sphere(pickC(rnd), 0.014, x + 0.012, 0.085, z + 0.012, 10);
    bag.cyl(pickC(rnd), 0, 0.04, x - 0.01, 0.142, z, 0.012, 8);
    return []; } },

  // ---- the observatory ----
  // The telescope: a big white tube on a dark pier in the middle of the room, tilted up at the sky (towards the slit in
  // the dome), with a round step to stand on, and a navy star carpet round it to lie back on and look up.
  telescope: { r: 0.18, centre: true, make(bag, x, z, c, rnd) {
    const carpet = new THREE.Shape(); carpet.absarc(0, 0, 0.36, 0, Math.PI * 2, false); const hole = new THREE.Path(); hole.absarc(0, 0, 0.173, 0, Math.PI * 2, true); carpet.holes.push(hole);
    bag.slab(NAVY, carpet, 0.004, x, 0, z, 0, 28);
    for (let i = 0; i < 16; i++) { const a = rnd() * 6.28, rr = 0.2 + rnd() * 0.14; bag.floor('#f7c22e', new THREE.ShapeGeometry(star(0.008 + rnd() * 0.006)), x + Math.cos(a) * rr, 0.0045, z + Math.sin(a) * rr, rnd() * 6); }
    bag.floor('#e8e4da', new THREE.RingGeometry(0.014, 0.024, 12, 1, 0, Math.PI), x - 0.25, 0.0046, z + 0.12, 0.8);
    bag.cyl('#d8d3c8', 0.17, 0.02, x, 0.01, z, 0.17, 24);
    bag.cyl('#3d405b', 0.04, 0.1, x, 0.07, z, 0.045, 12); bag.box('#3d405b', 0.1, 0.03, 0.04, x, 0.13, z);
    const up = geo => geo.rotateX(0.7).translate(x, 0.13, z);
    bag.add('#fbfaf6', up(new THREE.CylinderGeometry(0.034, 0.028, 0.3, 14).translate(0, 0.15, 0)));
    bag.add('#2e4a8c', up(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 14).translate(0, 0.255, 0)));
    bag.add('#6fcde6', up(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 14).translate(0, 0.302, 0)));
    bag.add('#fbfaf6', up(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 8).translate(0, -0.03, 0)));
    const seats = []; for (let i = 0; i < 4; i++) { const a = Math.PI * (0.65 + i * 0.57); seats.push([x + Math.cos(a) * 0.2, z + Math.sin(a) * 0.2]); }
    return seats; } },
  // A planet on a stand: a ringed one, a striped one or a blue-and-green Earth.
  planet: { r: 0.06, make(bag, x, z, c, rnd) {
    const kind = Math.floor(rnd() * 3), y = 0.13;
    bag.cyl('#fbfaf6', 0.028, 0.01, x, 0.005, z, 0.032, 12); bag.cyl('#fbfaf6', 0.005, 0.09, x, 0.055, z, 0.005, 6);
    if (kind === 0) { bag.sphere(['#f28b30', '#e6463c', '#7c46a8'][Math.floor(rnd() * 3)], 0.036, x, y, z); bag.add('#f7c22e', new THREE.TorusGeometry(0.055, 0.005, 4, 22).rotateX(Math.PI / 2 - 0.4).translate(x, y, z)); }
    else if (kind === 1) { bag.sphere('#e8b77a', 0.04, x, y, z); for (const [dy, col] of [[-0.012, '#c2703d'], [0.01, '#c2703d'], [0.024, '#f2d6a8']]) { const rr = Math.sqrt(0.04 * 0.04 - dy * dy) + 0.0012; bag.cyl(col, rr, 0.006, x, y + dy, z, rr, 14); } }
    else { bag.sphere('#3d8de0', 0.038, x, y, z); for (let i = 0; i < 5; i++) { const a = rnd() * 6.28, e = (rnd() - 0.5) * 1.6; bag.sphere('#7db45a', 0.014 + rnd() * 0.008, x + Math.cos(a) * Math.cos(e) * 0.032, y + Math.sin(e) * 0.032, z + Math.sin(a) * Math.cos(e) * 0.032, 8); } }
    return []; } },
  // A model of the solar system on a little round table: the Sun in the middle and planets going round it.
  orrery: { r: 0.07, make(bag, x, z, c, rnd) {
    bag.cyl(WHITE, 0.058, 0.008, x, 0.066, z); bag.cyl('#3d8de0', 0.054, 0.002, x, 0.071, z); bag.cyl(WHITE, 0.007, 0.062, x, 0.031, z, 0.01, 8); bag.cyl(WHITE, 0.03, 0.006, x, 0.003, z);
    bag.cyl(STEEL, 0.002, 0.04, x, 0.09, z, 0.002, 4); bag.sphere('*#f7c22e', 0.016, x, 0.11, z, 12);
    [[0.024, 0.005, '#c9ccd3', 1.6], [0.034, 0.007, '#f28b30', 1.1], [0.044, 0.008, '#3d8de0', 0.8], [0.056, 0.007, '#e6463c', 0.55]].forEach(([rr, pr, col, sp], i) => {
      const arm = partGroup(p => { p.box(STEEL, rr, 0.0015, 0.0015, rr / 2, 0, 0); p.cyl(STEEL, 0.0012, 0.012, rr, 0.006, 0, 0.0012, 4); p.sphere(col, pr, rr, 0.012 + pr, 0, 8); if (i === 3) p.add(GOLD, new THREE.TorusGeometry(pr * 1.6, 0.0012, 3, 14).rotateX(1.2).translate(rr, 0.012 + pr, 0)); }, { yspin: sp });
      arm.position.set(x, 0.09 - i * 0.004, z); arm.rotation.y = rnd() * 6.28; bag.part(arm);
    });
    return []; } },
};

// ---------- the aquarium ----------
// Long glass tanks along the walls (sand, seaweed, coral and fish, on a navy base), and in an arch, a tunnel of
// water over your head when you walk through it. Heights are from the floor.
const WALL = 0.05, TANK = { back: WALL + 0.008, depth: 0.09, base: 0.045, top: 0.23 };
const WATER = '~#5ec4e2', FISH_COLS = ['#f28b30', '#f7c22e', '#e2457d', '#ffffff', '#3d8de0', '#f5a3c7', '#a3d140'];
const CORAL = ['#f5a3c7', '#e2457d', '#f28b30', '#7c46a8', '#f7c22e'], WEED = ['#3e9a4f', '#5f9a4c', '#7db45a'];
// A little fish facing along (dx, dz): a squashed ball with a flat tail.
function fishAt(bag, x, y, z, dx, dz, s, col) {
  const a = Math.atan2(-dz, dx);
  bag.add(col, new THREE.SphereGeometry(s, 7, 5).scale(1.7, 1, 0.55).rotateY(a).translate(x, y, z));
  bag.add(col, new THREE.ConeGeometry(s * 0.8, s * 1.1, 4).rotateZ(-Math.PI / 2).scale(1, 1, 0.35).translate(-s * 2.2, 0, 0).rotateY(a).translate(x, y, z));
}
function weedAt(bag, x, y, z, rnd) {
  for (let i = 0; i < 3; i++) {
    const hh = 0.06 + rnd() * 0.09;
    bag.add(WEED[i % 3], new THREE.ConeGeometry(0.007, hh, 4).translate(0, hh / 2, 0).rotateZ((rnd() - 0.5) * 0.5).rotateX((rnd() - 0.5) * 0.4).translate(x + (rnd() - 0.5) * 0.02, y, z + (rnd() - 0.5) * 0.02));
  }
}
function coralAt(bag, x, y, z, rnd) {
  const c = CORAL[Math.floor(rnd() * CORAL.length)];
  for (let i = 0; i < 3; i++) { const r = 0.008 + rnd() * 0.008; bag.add(c, new THREE.IcosahedronGeometry(r, 0).scale(1, 0.75, 1).translate(x + (rnd() - 0.5) * 0.03, y + i * 0.006 + r * 0.6, z + (rnd() - 0.5) * 0.02)); }
}
// Split a run of wall where it turns a sharp corner, and leave out the doors; tanks fill what is left.
function tankStretches(run, ops) {
  const blocked = [], n = run.n, cut = 0.16;
  if (!run.closed) blocked.push([-1, cut], [run.len - cut, run.len + 1]);
  for (let i = 1; i < n.length; i++) if (n[i - 1][0] * n[i][0] + n[i - 1][1] * n[i][1] < 0.85) blocked.push([run.s[i] - cut, run.s[i] + cut]);
  if (run.closed && n[0][0] * n[n.length - 1][0] + n[0][1] * n[n.length - 1][1] < 0.85) blocked.push([-1, cut], [run.len - cut, run.len + 1]);
  for (const o of ops) if (o.door) blocked.push([o.s0 - 0.05, o.s1 + 0.05]);
  blocked.sort((a, b) => a[0] - b[0]);
  const out = []; let at = 0;
  for (const [a, b] of blocked) { if (a - at > 0.18) out.push([at, a]); at = Math.max(at, b); }
  if (run.len - at > 0.18) out.push([at, run.len]);
  return out;
}
export function wallTanks(bag, b, k, o, rnd) {
  const runs = wallRuns(b, k), ops = openings(b, k, runs), seats = [];
  const longX = o.W >= o.D;
  runs.forEach((run, ri) => {
    if (!run.outer || run.colonnade) return;
    // (An arch's short ends are where you walk in and out.)
    if (b.shape === 'arch' && o.kind === 'rr') { const [p, q] = [run.pts[0], run.pts[run.pts.length - 1]]; if (Math.abs(longX ? q[0] - p[0] : q[1] - p[1]) < 1e-3) return; }
    for (const [a, c] of tankStretches(run, ops.filter(op => op.run === ri))) {
      // Points along the stretch (every corner of the run in between), with the way out averaged at each.
      const us = [a, ...run.s.filter(s => s > a + 1e-4 && s < c - 1e-4), c];
      const at = u => {
        const p = runAt(run, u), i = run.s.indexOf(u);
        if (i > 0 && i < run.n.length) { const nx = run.n[i - 1][0] + run.n[i][0], nz = run.n[i - 1][1] + run.n[i][1], l = Math.hypot(nx, nz) || 1; return { ...p, nx: nx / l, nz: nz / l }; }
        return p;
      };
      const band = (o0, o1) => { const pts = us.map(u => { const p = at(u); return [p.x - p.nx * o0, p.z - p.nz * o0]; }); return [...pts, ...us.slice().reverse().map(u => { const p = at(u); return [p.x - p.nx * o1, p.z - p.nz * o1]; })]; };
      const B = TANK.back, F = TANK.back + TANK.depth;
      bag.prism('#2e4a8c', band(B - 0.004, F + 0.006), 0, TANK.base);
      bag.prism('#f0e2c0', band(B + 0.004, F - 0.004), TANK.base, 0.016);
      bag.prism(WATER, band(B, F), TANK.base, TANK.top - TANK.base);
      bag.prism('#fbfaf6', band(B - 0.002, B + 0.01), TANK.top, 0.01);
      bag.prism('#fbfaf6', band(F - 0.01, F + 0.002), TANK.top, 0.01);
      // What lives in it.
      for (let u = a + 0.04; u < c - 0.03; u += 0.055) {
        const p = runAt(run, u), mid = B + TANK.depth / 2, j = (rnd() - 0.5) * 0.04;
        const x = p.x - p.nx * (mid + j), z = p.z - p.nz * (mid + j), r = rnd(), y0 = TANK.base + 0.016;
        if (r < 0.4) weedAt(bag, x, y0, z, rnd); else if (r < 0.65) coralAt(bag, x, y0, z, rnd);
        else if (r < 0.75) bag.add('#b9b4aa', new THREE.IcosahedronGeometry(0.016, 0).scale(1.4, 0.7, 1).translate(x, y0, z));
        if (rnd() < 0.7) { const sg = rnd() < 0.5 ? 1 : -1; fishAt(bag, p.x - p.nx * (mid + (rnd() - 0.5) * 0.04), y0 + 0.04 + rnd() * 0.12, p.z - p.nz * (mid + (rnd() - 0.5) * 0.04), p.dx * sg, p.dz * sg, 0.011 + rnd() * 0.005, FISH_COLS[Math.floor(rnd() * FISH_COLS.length)]); }
        if (rnd() < 0.08) for (let i = 0; i < 4; i++) bag.add('#ffffff', new THREE.IcosahedronGeometry(0.004 + i * 0.001, 0).translate(x, y0 + 0.05 + i * 0.035, z));
      }
      // Places to stand and look.
      for (let u = a + 0.12; u < c - 0.08; u += 0.3) { const p = runAt(run, u), x = p.x - p.nx * (F + 0.07), z = p.z - p.nz * (F + 0.07); if (o.inside(x, z, 0.04)) seats.push([x, z]); }
    }
  });
  return seats;
}
// The walk-through tunnel: an arch of water from the top of one wall of tanks to the other, fish swimming over you.
export function waterTunnel(bag, o, top, rnd) {
  const longX = o.W >= o.D, L = (longX ? o.W : o.D) - 0.12, half = (longX ? o.D : o.W) / 2 - TANK.back - TANK.depth;
  const y0 = TANK.top + 0.01, a = half, c = Math.max(0.12, top - 0.03 - y0), t = 0.05, n = 28, sh = new THREE.Shape();
  for (let i = 0; i <= n; i++) { const q = (i / n) * Math.PI; i ? sh.lineTo(a * Math.cos(q), y0 + c * Math.sin(q)) : sh.moveTo(a, y0); }
  for (let i = n; i >= 0; i--) { const q = (i / n) * Math.PI; sh.lineTo((a - t) * Math.cos(q), y0 + (c - t) * Math.sin(q)); }
  const geo = new THREE.ExtrudeGeometry(sh, { depth: L, bevelEnabled: false, curveSegments: 8 }).translate(0, 0, -L / 2);
  if (longX) geo.rotateY(Math.PI / 2);
  bag.add(WATER, geo);
  for (let i = 0; i < Math.round(L * 16); i++) {
    const q = (0.12 + rnd() * 0.76) * Math.PI, u = (a - t / 2) * Math.cos(q), y = y0 + (c - t / 2) * Math.sin(q), w = (rnd() - 0.5) * (L - 0.1), sg = rnd() < 0.5 ? 1 : -1;
    const col = FISH_COLS[Math.floor(rnd() * FISH_COLS.length)];
    if (longX) fishAt(bag, w, y, -u, sg, 0, 0.011, col); else fishAt(bag, u, y, w, 0, sg, 0.011, col);
  }
}

// Walking: strings of rainbow bunting across the ceiling, corner to corner.
export function bunting(bag, o, top, rnd) {
  const W = o.W / 2 - 0.12, D = o.D / 2 - 0.12, y = top - 0.05;
  if (W < 0.1 || D < 0.1) return;
  for (const [x0, z0, x1, z1] of [[-W, -D, W, D], [-W, D, W, -D]]) {
    if (!o.inside(x0, z0, 0.04) || !o.inside(x1, z1, 0.04)) continue;
    const len = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(z1 - z0, x1 - x0), sag = 0.035, n = Math.floor(len / 0.045), c0 = Math.floor(rnd() * 8);
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector3(x0 + (x1 - x0) * t, y - Math.sin(t * Math.PI) * sag, z0 + (z1 - z0) * t)); }
    bag.tube('#e8e4da', pts, 0.0012, 24, 3);
    const flag = new THREE.Shape(); flag.moveTo(-0.014, 0); flag.lineTo(0.014, 0); flag.lineTo(0, -0.03); flag.closePath();
    for (let i = 1; i < n; i++) { const t = i / n; bag.add(RAINBOW[(c0 + i) % 8], new THREE.ExtrudeGeometry(flag, { depth: 0.001, bevelEnabled: false }).rotateY(-a).translate(x0 + (x1 - x0) * t, y - Math.sin(t * Math.PI) * sag, z0 + (z1 - z0) * t)); }
  }
}

// The observatory, walking: planets hanging in the dome on long strings, turning slowly over your head.
export function hangingPlanets(bag, top) {
  const mobile = partGroup(p => {
    [[0.12, 0.3, 0.03, '#f28b30'], [0.2, 0.36, 0.022, '#3d8de0'], [0.27, 0.31, 0.026, '#e6463c'], [0.17, 0.42, 0.02, '#7c46a8'], [0.3, 0.4, 0.034, '#e8b77a'], [0.24, 0.27, 0.016, '#a3d140']].forEach(([rr, y, pr, col], i) => {
      const a = i * 1.05 + 0.3, px = Math.cos(a) * rr, pz = Math.sin(a) * rr;
      p.sphere(col, pr, px, y, pz, 12);
      p.cyl('#e8e4da', 0.001, top - y - pr, px, (top + y + pr) / 2, pz, 0.001, 3);
      if (i === 4) p.add(GOLD, new THREE.TorusGeometry(pr * 1.55, 0.003, 4, 20).rotateX(1.25).translate(px, y, pz));
    });
  }, { yspin: 0.12 });
  bag.part(mobile);
}

// What goes in each kind of room (piece, how many), by floor area in blocks. Wall pieces (WALLS) go up first.
export const PLANS = {
  classroom: A => [['cubbies', 1], ['pinboard', 1 + Math.floor(A / 2)], ['art', 1], ['frieze', A >= 2 ? 1 : 0], ['books', A >= 2 ? 1 : 0],
    ['rug', 1], ['roundTable', Math.max(2, Math.round(A * 1.6))], ['artwall', A >= 2 ? 1 : 0], ['kidney', A >= 2 ? 1 : 0], ['mountain', A >= 2 ? 1 : 0], ['cave', A >= 3 ? 1 : 0], ['beanbag', A + 1]],      // (no plants: Phil asked)
  ringhouse: A => PLANS.classroom(A),
  treehouse: A => [['rug', 1], ['beanbag', 2]],
  hall: A => [['wallbars', 3], ['parachute', 1], ['climbframe', 1], ['softplay', A >= 4 ? 1 : 0], ['trampoline', A >= 4 ? 1 : 0], ['gymmat', Math.max(2, Math.round(A / 2))], ['vault', 1], ['balls', 1], ['bench', A >= 4 ? 2 : 1], ['hoop', 1], ['cones', A >= 4 ? 1 : 0], ['beanbag', Math.round(A / 3)]],
  library: A => [['books', 2 + A], ['shelf', Math.max(1, A - 1)], ['storychair', 1], ['tree', A >= 2 ? 1 : 0], ['cave', 1], ['globe', 1], ['beanbag', A * 2], ['rug', 1], ['plant', A]],
  lunch: A => [['servery', 1], ['art', 1], ['lunchTable', Math.max(2, A * 2)], ['water', 1], ['bins', 1], ['plant', A]],
  art: A => [['rack', 1], ['art', 2 + A], ['painttable', Math.max(1, A)], ['artwall', 1], ['easel', A + 1], ['sculpture', A >= 2 ? 1 : 0], ['plant', 1]],
  maker: A => [['pegboard', 1 + Math.floor(A / 2)], ['cubbies', 1], ['printers', 1], ['robot', 1], ['workbench', A >= 2 ? 1 : 0], ['rover', A >= 2 ? 1 : 0], ['cardrocket', 1], ['kidney', A >= 3 ? 1 : 0], ['plant', 1]],
  music: A => [['guitars', 1], ['piano', 1], ['art', 1], ['drums', 1], ['xylophone', 1], ['stage', A >= 2 ? 1 : 0], ['beanbag', A + 1], ['plant', 1]],
  yoga: A => [['eggchair', 1], ['bubbletube', 1], ['fountain', 1], ['cushions', A >= 2 ? 1 : 0], ['rug', 1], ['yogamat', 2 + A], ['plant', 2]],
  aquarium: A => [['touchpool', A >= 2 ? 1 : 0], ['tank', A >= 2 ? Math.min(3, A - 1) : 1], ['jelly', A >= 3 ? 1 : 0], ['beanbag', Math.max(1, A - 1)], ['plant', 1]],
  archway: A => [],
  observatory: A => [['poster', 2 + A], ['telescope', 1], ['orrery', 1], ['planet', 1 + A], ['beanbag', A * 2 + 2]],
  pool: A => [['lounger', 2 + Math.floor(A / 3)], ['lifeguard', 1], ['kickboards', 1], ['plant', 2]],
};
