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
// A seat is [x, z, h]: where a child sits and how high the seat is above the floor (0: on the floor).
const atH = (m, x, z, h) => [...at(m, x, z), h];
// The same, with the way the sitter faces: the frame's front (+z), turned by `turn`.
const atF = (m, x, z, h, turn = 0) => [...at(m, x, z), h, Math.atan2(m.elements[8], m.elements[10]) + turn];
// The turn that points a piece's front (+z in its own frame) at the middle of the room.
const facing = (x, z) => Math.atan2(-x, -z);
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
  // ---- library ----
  // A window seat: an open bench with books underneath and cushions on top.
  readingnook: { w: 0.22, h: 0.1, d: 0.07, seat: [[-0.06, 0.005, 0.068], [0.06, 0.005, 0.068]], make(s, rnd) {
    const col = pickC(rnd);
    for (const sx of [-0.1, 0.1]) s.box(WOOD, 0.01, 0.052, 0.066, sx, 0.026, 0);
    s.box(WOOD, 0.21, 0.01, 0.066, 0, 0.047, 0); s.box(WOOD, 0.19, 0.006, 0.066, 0, 0.003, 0); s.box('#e9e4da', 0.19, 0.04, 0.004, 0, 0.026, -0.031);
    bookRow(s, -0.09, 0.09, 0.006, -0.002, 0.05, 0.026, 0.038, rnd);
    s.box(col, 0.2, 0.016, 0.06, 0, 0.06, 0);
    for (let i = 0; i < 3; i++) s.box(pickC(rnd), 0.04, 0.034, 0.014, -0.065 + i * 0.065, 0.085, -0.024);
    s.box(RAINBOW[Math.floor(rnd() * 8)], 0.024, 0.004, 0.03, 0.03, 0.07, 0.01);
  } },
  // An alphabet frieze: letter cards in a row.
  alphabet: { w: 0.26, h: 0.03, lift: 0.19, min: 0.14, make(s, rnd, y0) {
    for (let i = 0; i < 9; i++) {
      const x = -0.116 + i * 0.029, col = RAINBOW[(i + 2) % 8];
      s.box(PAPER, 0.026, 0.028, 0.003, x, y0 + 0.015, 0.0015);
      s.box(col, 0.004, 0.016, 0.001, x - 0.004, y0 + 0.015, 0.0035); s.box(col, 0.01, 0.004, 0.001, x + 0.001, y0 + 0.021, 0.0035); s.box(col, 0.008, 0.004, 0.001, x, y0 + 0.014, 0.0035);
    }
  } },
  // Picture books face out on a stand with three ledges.
  bookdisplay: { w: 0.14, h: 0.13, d: 0.04, make(s, rnd) {
    s.box(WOOD, 0.14, 0.13, 0.008, 0, 0.065, -0.014);
    for (let r = 0; r < 3; r++) {
      const y = 0.004 + r * 0.042; s.box(WOOD, 0.14, 0.004, 0.024, 0, y, -0.002);
      for (let k = 0; k < 3; k++) { const bx = -0.044 + k * 0.044, by = y + 0.02, col = pickC(rnd); s.box(col, 0.034, 0.036, 0.004, bx, by, -0.008); s.box(PAPER, 0.02, 0.005, 0.001, bx, by + 0.012, -0.0055); s.add(RAINBOW[Math.floor(rnd() * 8)], new THREE.CircleGeometry(0.008, 8).translate(bx, by - 0.004, -0.0055)); }
    }
  } },
  // ---- hall ----
  // A climbing wall: a board with bright holds and a crash mat beneath.
  climbwall: { w: 0.22, h: 0.26, d: 0.03, make(s, rnd) {
    s.box('#e9e4da', 0.22, 0.26, 0.012, 0, 0.13, -0.009);
    for (let i = 0; i < 18; i++) s.add(pickC(rnd), new THREE.DodecahedronGeometry(0.007, 0).scale(1, 0.7, 0.6).translate(-0.09 + rnd() * 0.18, 0.03 + rnd() * 0.21, -0.001));
    s.box('#3d8de0', 0.24, 0.016, 0.06, 0, 0.008, 0.025);
  } },
  // Team pennants in a row, high up.
  banners: { w: 0.22, h: 0.09, lift: 0.17, min: 0.1, make(s, rnd, y0) {
    s.box(STEEL, 0.22, 0.003, 0.003, 0, y0 + 0.088, 0.004);
    for (let i = 0; i < 4; i++) { const bx = -0.078 + i * 0.052; s.add(['#e6463c', '#3d8de0', '#f7c22e', '#a3d140'][i], tri([[-0.02, 0.085], [0.02, 0.085], [0, 0]]).translate(bx, y0, 0.004)); s.add(PAPER, new THREE.CircleGeometry(0.008, 8).translate(bx, y0 + 0.062, 0.0046)); }
  } },
  // ---- lunch hall ----
  // Today's menu on a chalkboard, with a pudding drawn in the corner.
  menuboard: { w: 0.14, h: 0.11, lift: 0.12, min: 0.04, make(s, rnd, y0) {
    s.box(WOOD, 0.14, 0.11, 0.006, 0, y0 + 0.055, 0.003); s.box('#2f4a3a', 0.126, 0.096, 0.004, 0, y0 + 0.055, 0.0065);
    s.box(PAPER, 0.05, 0.004, 0.001, -0.03, y0 + 0.092, 0.009);
    for (let i = 0; i < 4; i++) { const len = 0.04 + rnd() * 0.04; s.box(['#f7c22e', '#f5a3c7', '#a3d140', PAPER][i], len, 0.0025, 0.001, -0.055 + len / 2, y0 + 0.075 - i * 0.015, 0.009); }
    s.add('#f5a3c7', new THREE.CircleGeometry(0.012, 10).translate(0.04, y0 + 0.028, 0.009)); s.add(RED, new THREE.CircleGeometry(0.004, 6).translate(0.04, y0 + 0.04, 0.0095));
  } },
  // A rack of coloured trays with a pot of cutlery on top.
  trayrack: { w: 0.1, h: 0.1, d: 0.045, make(s, rnd) {
    s.box(STEEL, 0.1, 0.1, 0.004, 0, 0.05, -0.02); for (const sx of [-0.048, 0.048]) s.box(STEEL, 0.004, 0.1, 0.044, sx, 0.05, 0);
    for (let i = 0; i < 6; i++) s.box(RAINBOW[(i * 3) % 8], 0.09, 0.003, 0.038, 0, 0.008 + i * 0.012, 0);
    s.box(STEEL, 0.1, 0.004, 0.044, 0, 0.102, 0);
    s.cyl(STEEL, 0.012, 0.02, 0.025, 0.114, 0, 0.011, 8); for (let i = 0; i < 4; i++) s.box(STEEL, 0.002, 0.03, 0.002, 0.02 + i * 0.004, 0.13, (i % 2) * 0.006 - 0.003);
  } },
  // ---- art room ----
  // A shelf of paint pots, a jar of brushes and a pot of glue.
  paintshelf: { w: 0.18, h: 0.08, lift: 0.12, min: 0.05, make(s, rnd, y0) {
    s.box(WOOD, 0.18, 0.006, 0.04, 0, y0 + 0.003, 0.02); for (const sx of [-0.08, 0.08]) s.box(WOOD, 0.006, 0.02, 0.03, sx, y0 - 0.01, 0.015);
    for (let i = 0; i < 6; i++) s.cyl(RAINBOW[(i + 1) % 8], 0.009, 0.022, -0.07 + i * 0.022, y0 + 0.017, 0.016, 0.008, 8);
    s.cyl('~#bfe4f3', 0.012, 0.03, 0.065, y0 + 0.021, 0.018, 0.011, 8); for (let i = 0; i < 4; i++) s.cyl(RAINBOW[i * 2], 0.0015, 0.05, 0.06 + i * 0.004, y0 + 0.04, 0.014 + (i % 2) * 0.006, 0.0015, 4);
    s.box(PAPER, 0.016, 0.028, 0.016, 0.075, y0 + 0.02, 0.016); s.box(RED, 0.012, 0.004, 0.012, 0.075, y0 + 0.036, 0.016);
  } },
  // A colour wheel on the wall.
  colourwheel: { w: 0.08, h: 0.08, lift: 0.15, min: 0.04, make(s, rnd, y0) {
    const cy = y0 + 0.04; s.add(PAPER, new THREE.CircleGeometry(0.04, 24).translate(0, cy, 0.002));
    ['#e6463c', '#f28b30', '#f7c22e', '#a3d140', '#3d8de0', '#7c46a8'].forEach((col, i) => s.add(col, new THREE.CircleGeometry(0.034, 6, i * Math.PI / 3, Math.PI / 3).translate(0, cy, 0.0035)));
    s.add(PAPER, new THREE.CircleGeometry(0.009, 12).translate(0, cy, 0.005));
  } },
  // A paint trolley: pots of paint on top, brushes in a jar, paper on the shelf below. (It can stand in front of a window.)
  painttrolley: { w: 0.14, h: 0.1, d: 0.05, make(s, rnd) {
    s.box(WHITE, 0.14, 0.006, 0.05, 0, 0.097, 0); s.box(WHITE, 0.14, 0.006, 0.05, 0, 0.05, 0);
    for (const sx of [-0.066, 0.066]) for (const sz of [-0.02, 0.02]) s.box(STEEL, 0.005, 0.1, 0.005, sx, 0.05, sz);
    for (let i = 0; i < 5; i++) s.cyl(RAINBOW[(i + 1) % 8], 0.009, 0.022, -0.05 + i * 0.022, 0.111, 0, 0.008, 8);
    s.cyl('~#bfe4f3', 0.012, 0.03, 0.05, 0.115, 0, 0.011, 8); for (let i = 0; i < 4; i++) s.cyl(RAINBOW[i * 2], 0.0015, 0.05, 0.045 + i * 0.004, 0.135, (i % 2) * 0.006 - 0.003, 0.0015, 4);
    s.box(PAPER, 0.1, 0.01, 0.04, 0, 0.058, 0); s.box(RED, 0.012, 0.016, 0.012, 0.055, 0.061, 0.01);
    for (const sx of [-0.05, 0.05]) for (const sz of [-0.02, 0.02]) s.add(DARK, new THREE.CylinderGeometry(0.008, 0.008, 0.005, 8).rotateX(Math.PI / 2).translate(sx, 0.008, sz));
  } },
  // ---- music room ----
  // A stave of music along the wall.
  notesfrieze: { w: 0.22, h: 0.045, lift: 0.19, min: 0.13, make(s, rnd, y0) {
    for (let i = 0; i < 5; i++) s.box(DARK, 0.22, 0.0015, 0.001, 0, y0 + 0.008 + i * 0.007, 0.002);
    for (let i = 0; i < 6; i++) { const nx = -0.09 + i * 0.036, ny = y0 + 0.012 + Math.floor(rnd() * 5) * 0.0035; s.add(DARK, new THREE.CircleGeometry(0.005, 8).scale(1.2, 0.9, 1).translate(nx, ny, 0.003)); s.box(DARK, 0.0015, 0.022, 0.001, nx + 0.005, ny + 0.011, 0.003); }
    s.box(RED, 0.005, 0.034, 0.001, -0.105, y0 + 0.022, 0.003); s.add(RED, new THREE.CircleGeometry(0.006, 8).translate(-0.105, y0 + 0.012, 0.0032));
  } },
  // A rack of recorders in a row.
  recorders: { w: 0.1, h: 0.08, lift: 0.1, min: 0.05, make(s, rnd, y0) {
    s.box(WOOD, 0.1, 0.006, 0.02, 0, y0 + 0.07, 0.01);
    for (let i = 0; i < 6; i++) { const rx = -0.04 + i * 0.016; s.cyl(RAINBOW[(i * 3) % 8], 0.003, 0.064, rx, y0 + 0.035, 0.01, 0.0025, 6); s.cyl(PAPER, 0.0032, 0.01, rx, y0 + 0.062, 0.01, 0.003, 6); }
  } },
  // A speaker stack with a little mixing desk on top.
  speaker: { w: 0.07, h: 0.13, d: 0.05, make(s, rnd) {
    s.box(DARK, 0.07, 0.11, 0.05, 0, 0.055, 0);
    for (const [cy, r] of [[0.035, 0.02], [0.085, 0.012]]) { s.add('#6b6e76', new THREE.CylinderGeometry(r, r, 0.004, 14).rotateX(Math.PI / 2).translate(0, cy, 0.026)); s.add('#26272d', new THREE.CylinderGeometry(r * 0.4, r * 0.4, 0.004, 10).rotateX(Math.PI / 2).translate(0, cy, 0.028)); }
    s.box('#8d8f96', 0.064, 0.012, 0.044, 0, 0.116, 0); for (let i = 0; i < 4; i++) { s.box(RAINBOW[i * 2], 0.004, 0.004, 0.012, -0.02 + i * 0.013, 0.124, 0.004); s.cyl(PAPER, 0.003, 0.003, -0.02 + i * 0.013, 0.1235, -0.012, 0.003, 6); }
  } },
  // ---- maker workshop ----
  // Rows of little parts bins on rails.
  partsbins: { w: 0.16, h: 0.08, lift: 0.1, min: 0.05, make(s, rnd, y0) {
    for (let r = 0; r < 3; r++) { s.box(STEEL, 0.16, 0.004, 0.01, 0, y0 + 0.004 + r * 0.027, 0.005); for (let i = 0; i < 6; i++) s.box(RAINBOW[(i + r * 2) % 8], 0.022, 0.018, 0.02, -0.065 + i * 0.026, y0 + 0.015 + r * 0.027, 0.01); }
  } },
  // A big screen showing the house being designed, in green lines.
  screen: { w: 0.14, h: 0.09, lift: 0.14, min: 0.05, make(s, rnd, y0) {
    s.box(DARK, 0.14, 0.09, 0.006, 0, y0 + 0.045, 0.003); s.add('*#1f2a44', new THREE.PlaneGeometry(0.13, 0.08).translate(0, y0 + 0.045, 0.0065));
    for (const [a, b2] of [[[-0.03, -0.02], [0.03, -0.02]], [[0.03, -0.02], [0.03, 0.02]], [[0.03, 0.02], [-0.03, 0.02]], [[-0.03, 0.02], [-0.03, -0.02]], [[-0.03, 0.02], [0, 0.035]], [[0, 0.035], [0.03, 0.02]]]) { const dx = b2[0] - a[0], dy = b2[1] - a[1]; s.add('*#7fe0a0', new THREE.PlaneGeometry(Math.hypot(dx, dy), 0.0025).rotateZ(Math.atan2(dy, dx)).translate((a[0] + b2[0]) / 2, y0 + 0.04 + (a[1] + b2[1]) / 2, 0.007)); }
  } },
  // ---- chill-out room ----
  // A "how are you feeling?" board: a row of faces.
  feelings: { w: 0.16, h: 0.07, lift: 0.13, min: 0.05, make(s, rnd, y0) {
    s.box('#9fdcd0', 0.16, 0.07, 0.004, 0, y0 + 0.035, 0.002);
    const faces = ['#f7c22e', '#a3d140', '#3d8de0', '#f28b30', '#e2457d'];
    for (let i = 0; i < 5; i++) { const fx = -0.06 + i * 0.03; s.add(faces[i], new THREE.CircleGeometry(0.012, 12).translate(fx, y0 + 0.03, 0.005)); for (const ex of [-0.004, 0.004]) s.add(DARK, new THREE.CircleGeometry(0.0015, 5).translate(fx + ex, y0 + 0.034, 0.0056)); s.add(DARK, i % 2 ? new THREE.RingGeometry(0.004, 0.0055, 8, 1, Math.PI, Math.PI).translate(fx, y0 + 0.028, 0.0056) : new THREE.RingGeometry(0.004, 0.0055, 8, 1, 0, Math.PI).translate(fx, y0 + 0.022, 0.0056)); }
    s.box(PAPER, 0.1, 0.006, 0.001, 0, y0 + 0.058, 0.005);
  } },
  // A small fish tank on a cabinet, for watching quietly.
  calmtank: { w: 0.14, h: 0.1, d: 0.06, make(s, rnd) {
    s.box(WHITE, 0.14, 0.06, 0.06, 0, 0.03, 0); s.box(DARK, 0.13, 0.004, 0.05, 0, 0.062, 0);
    s.box('~#5ec4e2', 0.12, 0.06, 0.046, 0, 0.094, 0); s.box('#e8cfa4', 0.118, 0.006, 0.044, 0, 0.067, 0);
    for (let i = 0; i < 3; i++) fishAt(s, -0.04 + i * 0.035, 0.085 + (i % 2) * 0.015, i % 2 ? 0.01 : -0.01, i % 2 ? -1 : 1, 0, 0.006, FISH_COLS[(i * 2) % 7]);
    weedAt(s, 0.045, 0.07, 0.01, rnd); s.sphere('#8d8f96', 0.007, -0.045, 0.074, -0.01, 7);
    s.box(DARK, 0.124, 0.006, 0.05, 0, 0.127, 0);
  } },
  // ---- observatory ----
  // Mission control: three screens, a keyboard, a big red button and a chair.
  controldesk: { w: 0.2, h: 0.09, d: 0.07, seat: [[0, 0.08, 0.045]], face: 'wall', make(s, rnd) {
    s.box(DARK, 0.2, 0.012, 0.07, 0, 0.064, 0); s.box('#3d405b', 0.19, 0.058, 0.012, 0, 0.029, -0.025); for (const sx of [-0.09, 0.09]) s.box('#3d405b', 0.012, 0.058, 0.066, sx, 0.029, 0);
    for (let i = 0; i < 3; i++) { const sx = -0.062 + i * 0.062; s.box(DARK, 0.054, 0.04, 0.004, sx, 0.095, -0.02); s.add(['*#1f2a44', '*#2a4a7a', '*#1f2a44'][i], new THREE.PlaneGeometry(0.048, 0.034).translate(sx, 0.095, -0.0175)); s.cyl(DARK, 0.004, 0.008, sx, 0.074, -0.02, 0.012, 8); }
    s.add('*#f7c22e', new THREE.CircleGeometry(0.008, 10).translate(-0.062, 0.1, -0.017)); s.add('*#e6463c', new THREE.CircleGeometry(0.004, 8).translate(0.062, 0.09, -0.017)); for (let i = 0; i < 4; i++) s.add('*#7fe0a0', new THREE.PlaneGeometry(0.03, 0.002).translate(0, 0.085 + i * 0.006, -0.017));
    s.box(STEEL, 0.05, 0.004, 0.018, 0, 0.072, 0.012); s.cyl(RED, 0.006, 0.006, 0.06, 0.073, 0.015, 0.006, 8);
    s.cyl(pickC(rnd), 0.02, 0.045, 0, 0.0225, 0.08);
  } },
  // A whiteboard with today's sums and a drawing, and a pen tray.
  whiteboard: { w: 0.24, h: 0.13, lift: 0.1, min: 0.04, make(s, rnd, y0) {
    const cy = y0 + 0.07;
    s.box(STEEL, 0.232, 0.122, 0.004, 0, cy, 0.002); s.box(PAPER, 0.22, 0.11, 0.004, 0, cy, 0.0035);
    const ink = ['#3d8de0', '#e6463c', '#5f9a4c', '#26272d'];
    for (let i = 0; i < 4; i++) { const yy = cy + 0.038 - i * 0.022, len = 0.04 + rnd() * 0.07; s.box(ink[i % 4], len, 0.003, 0.001, -0.095 + len / 2, yy, 0.0062); for (let k = 0; k < 2 + Math.floor(rnd() * 3); k++) s.box(ink[(i + k) % 4], 0.006, 0.006, 0.001, -0.09 + len + 0.012 + k * 0.012, yy, 0.0062); }
    s.add('#f7c22e', new THREE.CircleGeometry(0.014, 12).translate(0.07, cy + 0.025, 0.0062)); s.add('#7db45a', new THREE.CircleGeometry(1, 10, 0, Math.PI).scale(0.03, 0.016, 1).translate(0.07, cy - 0.03, 0.0062)); s.box('#3d8de0', 0.012, 0.014, 0.001, 0.07, cy - 0.012, 0.0062);
    s.box(STEEL, 0.14, 0.004, 0.014, 0, y0 + 0.012, 0.007); for (let i = 0; i < 4; i++) s.add(ink[i], new THREE.CylinderGeometry(0.0025, 0.0025, 0.03, 6).rotateZ(Math.PI / 2).translate(-0.045 + i * 0.03, y0 + 0.017, 0.008));
  } },
  // The class pet: a hamster in a cage on a shelf, with a wheel and a water bottle.
  petcage: { w: 0.12, h: 0.1, lift: 0.1, min: 0.05, make(s, rnd, y0) {
    s.box(WOOD, 0.12, 0.008, 0.07, 0, y0 + 0.004, 0.03);
    s.box('#3d8de0', 0.1, 0.012, 0.06, 0, y0 + 0.014, 0.03); s.box('#e8cfa4', 0.09, 0.004, 0.05, 0, y0 + 0.022, 0.03);
    for (let i = 0; i < 9; i++) s.box(STEEL, 0.0015, 0.06, 0.0015, -0.048 + i * 0.012, y0 + 0.05, 0.06);
    for (const sx of [-0.05, 0.05]) for (let i = 0; i < 4; i++) s.box(STEEL, 0.0015, 0.06, 0.0015, sx, y0 + 0.05, 0.004 + i * 0.018);
    s.box('#3d8de0', 0.102, 0.004, 0.062, 0, y0 + 0.082, 0.03);
    s.add('#f28b30', new THREE.TorusGeometry(0.014, 0.003, 6, 14).rotateY(Math.PI / 2).translate(-0.028, y0 + 0.04, 0.03));                       // the wheel
    s.add('#c99a6b', new THREE.SphereGeometry(0.01, 8, 6).scale(1.3, 0.9, 1).translate(0.018, y0 + 0.032, 0.03)); s.sphere(DARK, 0.0015, 0.03, y0 + 0.035, 0.034, 4);   // the hamster
    s.cyl('~#bfe4f3', 0.006, 0.03, 0.04, y0 + 0.058, 0.012, 0.006, 8);
  } },
  // A craft sink: a unit with a sink, a tap and a row of paint pots drying.
  sink: { w: 0.16, h: 0.1, d: 0.05, make(s, rnd) {
    s.box('#9fdcd0', 0.15, 0.08, 0.046, 0, 0.04, 0); s.box(PAPER, 0.152, 0.008, 0.05, 0, 0.084, 0);
    s.box('#cfe8ee', 0.07, 0.006, 0.034, -0.03, 0.087, 0); s.cyl(STEEL, 0.003, 0.03, -0.03, 0.1, -0.015, 0.003, 6); s.add(STEEL, new THREE.TorusGeometry(0.012, 0.0028, 4, 10, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(-0.03, 0.115, -0.004));
    for (let i = 0; i < 4; i++) s.cyl(RAINBOW[(i * 2 + 1) % 8], 0.007, 0.014, 0.025 + i * 0.016, 0.095, 0.004, 0.007, 8);
    s.box(STEEL, 0.03, 0.003, 0.003, -0.03, 0.05, 0.0235); s.box(STEEL, 0.03, 0.003, 0.003, 0.04, 0.05, 0.0235);
  } },
  // Coat pegs by the door: a rail with pegs, little coats and a bag or two hanging up.
  coatpegs: { w: 0.2, h: 0.1, lift: 0.1, min: 0.05, make(s, rnd, y0) {
    s.box(WOOD, 0.19, 0.012, 0.008, 0, y0 + 0.09, 0.004);
    for (let i = 0; i < 6; i++) {
      const x = -0.075 + i * 0.03; s.cyl(STEEL, 0.003, 0.012, x, y0 + 0.084, 0.012, 0.003, 6);
      if (i % 3 === 2) { s.box(pickC(rnd), 0.028, 0.034, 0.014, x, y0 + 0.055, 0.016); continue; }        // a bag
      const c = pickC(rnd); s.add(c, new THREE.CylinderGeometry(0.013, 0.017, 0.062, 8).translate(x, y0 + 0.049, 0.016)); s.sphere(c, 0.011, x, y0 + 0.082, 0.016, 8);   // a coat on its hood
    }
  } },
  // A round clock, high on the wall.
  clock: { w: 0.07, h: 0.06, lift: 0.185, min: 0.12, make(s, rnd, y0) {
    const cy = y0 + 0.03;
    s.add(pickC(rnd), new THREE.CylinderGeometry(0.03, 0.03, 0.006, 16).rotateX(Math.PI / 2).translate(0, cy, 0.003));
    s.add(PAPER, new THREE.CircleGeometry(0.025, 16).translate(0, cy, 0.0065));
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; s.add(DARK, new THREE.CircleGeometry(i % 3 ? 0.0012 : 0.002, 5).translate(Math.sin(a) * 0.02, cy + Math.cos(a) * 0.02, 0.0072)); }
    const h1 = rnd() * 6.28, h2 = rnd() * 6.28;
    s.add(DARK, new THREE.BoxGeometry(0.0024, 0.014, 0.001).translate(0, 0.006, 0).rotateZ(h1).translate(0, cy, 0.0078));
    s.add(RED, new THREE.BoxGeometry(0.0016, 0.02, 0.001).translate(0, 0.009, 0).rotateZ(h2).translate(0, cy, 0.0082));
  } },
  // A star chart: everyone's name and a row of gold stars.
  starchart: { w: 0.14, h: 0.1, lift: 0.115, min: 0.04, make(s, rnd, y0) {
    s.box(PAPER, 0.13, 0.095, 0.004, 0, y0 + 0.05, 0.002); s.box(pickC(rnd), 0.13, 0.012, 0.005, 0, y0 + 0.092, 0.0025);
    for (let r = 0; r < 5; r++) {
      s.box(RAINBOW[(r * 2) % 8], 0.02, 0.005, 0.001, -0.05, y0 + 0.078 - r * 0.014, 0.0045);
      const n = 1 + Math.floor(rnd() * 5);
      for (let k = 0; k < n; k++) s.add(GOLD, new THREE.ShapeGeometry(star(0.0045)).translate(-0.03 + k * 0.012, y0 + 0.078 - r * 0.014, 0.0048));
    }
  } },
  // A number line along the wall: a white strip with coloured marks.
  numberline: { w: 0.28, h: 0.03, lift: 0.165, min: 0.12, make(s, rnd, y0) {
    s.box(PAPER, 0.27, 0.026, 0.003, 0, y0 + 0.013, 0.0015);
    for (let i = 0; i <= 10; i++) { const x = -0.125 + i * 0.025; s.box(RAINBOW[i % 8], 0.0025, i % 5 ? 0.009 : 0.016, 0.001, x, y0 + 0.011, 0.0035); s.add(DARK, new THREE.CircleGeometry(0.002, 6).translate(x, y0 + 0.021, 0.0035)); }
  } },
  // A little play kitchen: cupboards, a hob with two rings, an oven door and a tap (against the wall).
  playkitchen: { w: 0.16, h: 0.12, d: 0.05, make(s, rnd) {
    const c = ['#f5a3c7', '#9fdcd0', '#f7c22e', '#a3d140'][Math.floor(rnd() * 4)];
    s.box(c, 0.15, 0.085, 0.046, 0, 0.0425, 0); s.box(PAPER, 0.152, 0.008, 0.05, 0, 0.089, 0);
    s.box(DARK, 0.03, 0.02, 0.002, -0.04, 0.05, 0.0235); s.box(PAPER, 0.044, 0.034, 0.002, -0.04, 0.045, 0.024); s.box('~#bfe4f3', 0.03, 0.02, 0.002, -0.04, 0.05, 0.0245);     // oven door
    s.box(PAPER, 0.03, 0.04, 0.002, 0.035, 0.05, 0.024); s.cyl(STEEL, 0.003, 0.012, 0.045, 0.05, 0.026, 0.003, 6);                                                        // cupboard
    for (const hx of [-0.05, -0.02]) s.cyl(DARK, 0.009, 0.003, hx, 0.0945, 0.008, 0.009, 12);                                                                            // hob rings
    s.box('~#bfe4f3', 0.036, 0.004, 0.026, 0.035, 0.092, 0.006); s.cyl(STEEL, 0.0025, 0.03, 0.035, 0.108, -0.01, 0.0025, 6); s.add(STEEL, new THREE.TorusGeometry(0.01, 0.0025, 4, 10, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0.035, 0.123, 0));   // sink and tap
    s.cyl(RED, 0.012, 0.012, -0.05, 0.102, 0.008, 0.01, 10); s.box(RED, 0.02, 0.003, 0.003, -0.034, 0.104, 0.008);                                                        // a pan
  } },
  // A low shelf of coloured trays (against the wall).
  cubbies: { w: 0.19, h: 0.075, d: 0.045, make(s, rnd) {
    s.box(WHITE, 0.18, 0.066, 0.04, 0, 0.033, 0);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) s.box(pickC(rnd), 0.036, 0.024, 0.006, -0.06 + c * 0.04, 0.018 + r * 0.03, 0.021);
    for (let i = 0; i < 3; i++) { const bx = -0.06 + i * 0.03 + (rnd() - 0.5) * 0.006; const c = pickC(rnd); s.box(c, 0.024, 0.016, 0.018, bx, 0.074, -0.002); s.box(PAPER, 0.024, 0.003, 0.018, bx, 0.0835, -0.002); s.box(c, 0.01, 0.004, 0.004, bx, 0.087, -0.002); }   // lunch boxes
    if (rnd() < 0.6) { s.cyl('#f0e2c0', 0.014, 0.004, 0.05, 0.068, 0, 0.012, 10); s.sphere('~#5ec4e2', 0.019, 0.05, 0.085, 0, 12); s.add(ORANGE, new THREE.SphereGeometry(0.006, 6, 4).scale(1.6, 1, 0.6).translate(0.052, 0.084, 0.003)); s.add(ORANGE, new THREE.ConeGeometry(0.004, 0.006, 4).rotateZ(Math.PI / 2).translate(0.041, 0.084, 0.003)); }
  } },
  // An upright piano against the wall, with its stool.
  piano: { w: 0.18, h: 0.13, d: 0.11, seat: [[0, 0.035, 0.05]], face: 'wall', make(s, rnd) {
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
  lounger: { w: 0.15, h: 0.06, d: 0.05, seat: [[0.02, 0, 0.04]], make(s, rnd) {
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
        if (W.seat) for (const [a, c, h = 0] of W.seat) seats.push([...at(m, a, c), h, Math.atan2(m.elements[8], m.elements[10]) + (W.face === 'wall' ? Math.PI : 0)]);      // (facing the room, or the wall for a piano or a desk of screens)
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
    bag.cyl(pickC(rnd), 0.022, 0.045, sx, 0.0225, sz); seats.push([sx, sz, 0.045]);
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
    for (let i = 0; i < 4; i++) { const a = rot + Math.PI + (i - 1.5) * 0.5, sx = x + Math.sin(a) * 0.07, sz = z + Math.cos(a) * 0.07; bag.cyl(pickC(rnd), 0.022, 0.045, sx, 0.0225, sz); seats.push([sx, sz, 0.045]); }
    tableClutter(bag, x + Math.sin(rot) * 0.02, z + Math.cos(rot) * 0.02, 0.093, rnd, 0.06);
    return seats; } },
  rug: { r: 0.17, low: true, make(bag, x, z, c, rnd) {
    const col = pickC(rnd);
    bag.cyl(col, 0.15, 0.006, x, 0.003, z, 0.15, 28); bag.cyl('#ffffff', 0.1, 0.007, x, 0.0035, z, 0.1, 24); bag.cyl(col, 0.05, 0.008, x, 0.004, z, 0.05, 16);
    const seats = [];
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, sx = x + Math.cos(a) * 0.11, sz = z + Math.sin(a) * 0.11; bag.ball(pickC(rnd), 0.022, sx, 0.006, sz); seats.push([sx, sz, 0.026]); }
    return seats; } },
  // The same, smaller, for a one-square room.
  rugS: { r: 0.125, low: true, make(bag, x, z, c, rnd) {
    const col = pickC(rnd);
    bag.cyl(col, 0.11, 0.006, x, 0.003, z, 0.11, 24); bag.cyl('#ffffff', 0.072, 0.007, x, 0.0035, z, 0.072, 20); bag.cyl(col, 0.035, 0.008, x, 0.004, z, 0.035, 14);
    const seats = [];
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + 0.3, sx = x + Math.cos(a) * 0.082, sz = z + Math.sin(a) * 0.082; bag.ball(pickC(rnd), 0.02, sx, 0.006, sz); seats.push([sx, sz, 0.024]); }
    return seats; } },
  mountain: { r: 0.2, make(bag, x, z, c, rnd) {
    // Stepped seats, like a little mountain to climb and sit on (after Rosan Bosch's school "mountains").
    const seats = [], col = pickC(rnd);
    for (let k = 0; k < 3; k++) { const rr = 0.19 - k * 0.055, hh = 0.035 * (k + 1); bag.cyl(k % 2 ? '#fbfaf6' : col, rr, hh, x, hh / 2, z, rr, 24); for (let i = 0; i < 4 - k; i++) { const a = rnd() * 6.28; seats.push([x + Math.cos(a) * (rr - 0.03), z + Math.sin(a) * (rr - 0.03), hh]); } }
    return seats; } },
  cave: { r: 0.12, make(bag, x, z, c, rnd) {
    // A cosy reading cave: half a dome with a cushion inside.
    const col = pickC(rnd), rot = rnd() * 6.28;
    bag.add(col, new THREE.SphereGeometry(0.11, 14, 8, rot, Math.PI * 1.35, 0, Math.PI / 2).translate(x, 0, z));
    bag.ball('#ffffff', 0.04, x, 0, z);
    return [[x, z, 0.04]]; } },
  beanbag: { r: 0.06, make(bag, x, z, c, rnd) { bag.ball(pickC(rnd), 0.05, x, 0, z); return [[x, z, 0.048]]; } },
  tree: { r: 0.16, make(bag, x, z, c, rnd) {
    // An indoor tree with a round bench.
    bag.cyl('#9b7b5c', 0.02, 0.22, x, 0.11, z, 0.026, 8); bag.sphere('#7db45a', 0.1, x, 0.27, z, 12);
    bag.add(pickC(rnd), new THREE.TorusGeometry(0.1, 0.022, 6, 24).rotateX(Math.PI / 2).translate(x, 0.035, z));
    const seats = []; for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.28; seats.push([x + Math.cos(a) * 0.1, z + Math.sin(a) * 0.1, 0.055]); }
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
  yogamat: { r: 0.07, low: true, make(bag, x, z, c, rnd) { const rot = rnd() * 6.28; bag.add(pickC(rnd), new THREE.BoxGeometry(0.06, 0.008, 0.15).rotateY(rot).translate(x, 0.004, z)); return [[x, z, 0.006]]; } },

  // ---- the classroom ----
  // The teacher's desk: a chair behind it, a mug, a pile of books and a pot of pens.
  teacherdesk: { r: 0.11, make(bag, x, z, c, rnd) {
    const m = frame(x, z, facing(x, z) + (rnd() - 0.5) * 0.5);
    bag.within(m, s => {
      s.box(WOOD, 0.17, 0.012, 0.085, 0, 0.082, 0); for (const [lx, lz] of [[-0.075, -0.035], [0.075, -0.035], [-0.075, 0.035], [0.075, 0.035]]) s.box('#c9a46f', 0.01, 0.076, 0.01, lx, 0.038, lz);
      s.box(WOOD, 0.06, 0.07, 0.07, 0.05, 0.035, 0); s.box(STEEL, 0.02, 0.003, 0.003, 0.05, 0.05, 0.036); s.box(STEEL, 0.02, 0.003, 0.003, 0.05, 0.025, 0.036);          // drawers
      s.cyl(pickC(rnd), 0.009, 0.014, -0.06, 0.095, -0.02, 0.008, 8);                                                                                                       // a mug
      for (let i = 0; i < 3; i++) s.box(RAINBOW[(i * 3 + 1) % 8], 0.04, 0.006, 0.03, -0.02 + i * 0.003, 0.091 + i * 0.006, 0.02);                                            // books
      s.cyl(pickC(rnd), 0.007, 0.016, 0.03, 0.096, -0.025, 0.007, 8); for (let i = 0; i < 3; i++) s.cyl(RAINBOW[(i * 2) % 8], 0.0016, 0.024, 0.03 + (i - 1) * 0.003, 0.108, -0.025 + (i % 2) * 0.002, 0.0016, 4);
      s.box(PAPER, 0.03, 0.002, 0.04, 0.0, 0.089, -0.01);
      s.cyl(DARK, 0.022, 0.006, 0, 0.05, -0.085); s.cyl(DARK, 0.005, 0.044, 0, 0.022, -0.085, 0.009, 8); s.box(DARK, 0.04, 0.05, 0.008, 0, 0.078, -0.104);              // the chair
    });
    return [atH(m, 0, -0.085, 0.05)]; } },
  // A flip chart on an easel, with today's drawing on it.
  flipchart: { r: 0.07, make(bag, x, z, c, rnd) {
    const m = frame(x, z, facing(x, z) + (rnd() - 0.5) * 0.6), col = pickC(rnd);
    bag.within(m, s => {
      for (const sx of [-0.065, 0.065]) { s.add(WOOD, new THREE.BoxGeometry(0.01, 0.2, 0.01).rotateX(-0.14).translate(sx, 0.1, 0.014)); s.add(WOOD, new THREE.BoxGeometry(0.01, 0.2, 0.01).rotateX(0.42).translate(sx, 0.1, -0.03)); }
      s.box(WOOD, 0.14, 0.008, 0.012, 0, 0.197, -0.008);
      s.within(new THREE.Matrix4().makeRotationX(-0.14).setPosition(0, 0, 0.018), p => { p.box(col, 0.15, 0.12, 0.006, 0, 0.14, 0.003); p.box(PAPER, 0.136, 0.106, 0.004, 0, 0.14, 0.007); painting(p, 0.12, 0.09, 0.14, 0.009, Math.floor(rnd() * 6), rnd); });
      s.box(WOOD, 0.15, 0.008, 0.022, 0, 0.078, 0.03); s.box(pickC(rnd), 0.012, 0.012, 0.012, 0.055, 0.088, 0.03); s.box(pickC(rnd), 0.012, 0.012, 0.012, 0.04, 0.088, 0.03);
    });
    return [at(m, -0.08, 0.14), at(m, 0.08, 0.14)]; } },
  // Wooden building blocks: a tower someone is building and a spill of blocks round it.
  blocks: { r: 0.075, make(bag, x, z, c, rnd) {
    const b = (col, w, h, d, px, py, pz, ry = 0) => bag.add(col, new THREE.BoxGeometry(w, h, d).rotateY(ry).translate(x + px, py, z + pz));
    b(RAINBOW[2], 0.04, 0.016, 0.04, 0, 0.008, 0); b(RAINBOW[4], 0.034, 0.016, 0.034, 0.002, 0.024, 0, 0.3); b(RAINBOW[0], 0.028, 0.016, 0.028, -0.002, 0.04, 0.002, 0.6);
    bag.cyl(RAINBOW[5], 0.011, 0.016, x + 0.001, 0.056, z, 0.011, 10); bag.add(RAINBOW[1], new THREE.ConeGeometry(0.014, 0.02, 4).translate(x + 0.001, 0.074, z));
    for (let i = 0; i < 7; i++) { const a = rnd() * 6.28, rr = 0.04 + rnd() * 0.035, s = 0.014 + rnd() * 0.01; b(RAINBOW[(i * 3) % 8], s, s, s, Math.cos(a) * rr, s / 2, Math.sin(a) * rr, rnd() * 3); }
    bag.add(RAINBOW[6], new THREE.CylinderGeometry(0.012, 0.012, 0.03, 10).rotateZ(Math.PI / 2).translate(x - 0.05, 0.012, z + 0.04));
    return [[x + 0.1, z], [x - 0.09, z + 0.06]]; } },
  // A sand tray on legs, with a bucket and spade.
  sandtray: { r: 0.09, make(bag, x, z, c, rnd) {
    const m = frame(x, z, rnd() * 6.28);
    bag.within(m, s => {
      s.box('#3d8de0', 0.16, 0.04, 0.1, 0, 0.065, 0); s.box('#f1dfb0', 0.148, 0.03, 0.088, 0, 0.072, 0);
      for (const [lx, lz] of [[-0.07, -0.04], [0.07, -0.04], [-0.07, 0.04], [0.07, 0.04]]) s.box(STEEL, 0.008, 0.046, 0.008, lx, 0.023, lz);
      s.add('#ead39b', new THREE.SphereGeometry(0.02, 8, 5).scale(1, 0.5, 1).translate(-0.04, 0.085, 0.01));
      s.cyl(RED, 0.012, 0.022, 0.04, 0.098, -0.015, 0.009, 10); s.box('#f7c22e', 0.004, 0.004, 0.05, 0.02, 0.09, 0.02); s.box('#f7c22e', 0.016, 0.003, 0.016, 0.02, 0.09, 0.05);
    });
    return [at(m, -0.08, 0.1), at(m, 0.08, 0.1), at(m, 0, -0.1)]; } },
  // A reading tepee: a cone of fabric with an opening at the front and a cushion inside.
  tent: { r: 0.11, make(bag, x, z, c, rnd) {
    const rot = rnd() * 6.28, col = pickC(rnd);
    bag.add('^' + col, new THREE.ConeGeometry(0.1, 0.24, 14, 1, true, 0.5, Math.PI * 2 - 1.0).rotateY(rot).translate(x, 0.12, z));
    for (let i = 0; i < 5; i++) { const a = rot + 0.5 + i * (Math.PI * 2 - 1.0) / 4; bag.add(WOOD, new THREE.CylinderGeometry(0.003, 0.003, 0.27, 5).rotateZ(0.38).rotateY(-a + Math.PI / 2).translate(x + Math.sin(a) * 0.05, 0.125, z + Math.cos(a) * 0.05)); }
    bag.add(PAPER, new THREE.ConeGeometry(0.012, 0.03, 8).translate(x, 0.26, z));
    bag.ball('#ffffff', 0.035, x, 0, z); bag.ball(pickC(rnd), 0.02, x + Math.sin(rot) * 0.03, 0.02, z + Math.cos(rot) * 0.03);
    return [[x + Math.sin(rot) * 0.02, z + Math.cos(rot) * 0.02, 0.03]]; } },
  // A nature table: shells, pebbles, a pine cone, leaves and a magnifying glass on a cloth.
  naturetable: { r: 0.09, make(bag, x, z, c, rnd) {
    const m = frame(x, z, rnd() * 6.28);
    bag.within(m, s => {
      s.box(WOOD, 0.14, 0.01, 0.08, 0, 0.075, 0); for (const [lx, lz] of [[-0.06, -0.03], [0.06, -0.03], [-0.06, 0.03], [0.06, 0.03]]) s.box('#c9a46f', 0.008, 0.07, 0.008, lx, 0.035, lz);
      s.box('#9bb39a', 0.13, 0.003, 0.07, 0, 0.0815, 0);
      s.add('#8a5a3b', new THREE.SphereGeometry(0.012, 7, 5).scale(0.8, 1.3, 0.8).translate(-0.045, 0.098, -0.01));                  // a pine cone
      s.sphere('#e8e4da', 0.009, -0.015, 0.09, 0.015, 7); s.sphere('#f5a3c7', 0.007, 0.0, 0.089, -0.02, 7); s.sphere('#9aa3a8', 0.008, 0.02, 0.09, 0.012, 7);   // shells and a pebble
      for (let i = 0; i < 3; i++) s.add(LEAF[i], new THREE.CircleGeometry(0.011, 6).scale(1, 0.6, 1).rotateX(-Math.PI / 2).translate(0.045 + (i - 1) * 0.012, 0.0835 + i * 0.0006, -0.015 + i * 0.01));
      s.add(STEEL, new THREE.TorusGeometry(0.011, 0.002, 4, 12).rotateX(-Math.PI / 2).translate(0.04, 0.086, 0.02)); s.box(DARK, 0.004, 0.003, 0.024, 0.04, 0.085, 0.043);   // a magnifying glass
      s.cyl('~#bfe4f3', 0.009, 0.03, -0.05, 0.097, 0.022, 0.009, 8); for (let i = 0; i < 3; i++) s.add('#8a5a3b', new THREE.CylinderGeometry(0.0012, 0.0012, 0.05, 3).rotateZ((i - 1) * 0.3).translate(-0.05 + (i - 1) * 0.004, 0.125, 0.022));   // twigs in a jar
    });
    return [at(m, 0, 0.09)]; } },
  // A little two-seat sofa for the reading corner.
  sofa2: { r: 0.1, make(bag, x, z, c, rnd) {
    const m = frame(x, z, facing(x, z) + (rnd() - 0.5) * 0.7), col = pickC(rnd);
    bag.within(m, s => {
      s.box(col, 0.15, 0.04, 0.07, 0, 0.02, 0); s.box(col, 0.15, 0.06, 0.025, 0, 0.065, -0.03);
      for (const sx of [-0.07, 0.07]) s.box(col, 0.014, 0.06, 0.07, sx, 0.045, 0);
      for (const sx of [-0.035, 0.035]) s.box('#fbfaf6', 0.056, 0.012, 0.05, sx, 0.046, 0.004);
      s.ball(pickC(rnd), 0.016, 0.045, 0.05, -0.01); s.box(RAINBOW[Math.floor(rnd() * 8)], 0.024, 0.005, 0.03, -0.04, 0.054, 0.006);
    });
    return [atF(m, -0.035, 0.0, 0.05), atF(m, 0.035, 0.0, 0.05)]; } },
  // A road play mat with two toy cars.
  playmat: { r: 0.1, low: true, make(bag, x, z, c, rnd) {
    const m = frame(x, z, rnd() * 6.28);
    bag.within(m, s => {
      s.box('#8fcf5b', 0.2, 0.004, 0.16, 0, 0.002, 0);
      const road = new THREE.Shape(); road.absellipse(0, 0, 0.078, 0.058, 0, Math.PI * 2, false); const hole = new THREE.Path(); hole.absellipse(0, 0, 0.05, 0.03, 0, Math.PI * 2, true); road.holes.push(hole);
      s.slab('#8b8f96', road, 0.002, 0, 0.004, 0, 0, 18);
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; s.add(PAPER, new THREE.BoxGeometry(0.01, 0.001, 0.003).rotateY(-a).translate(Math.cos(a) * 0.064, 0.0065, Math.sin(a) * 0.044)); }
      s.box('#f7c22e', 0.016, 0.006, 0.02, 0.02, 0.009, 0.01); s.box('#3d8de0', 0.014, 0.006, 0.012, -0.01, 0.009, 0.0);                           // a pond and a house
      for (const [a, col] of [[0.6, RED], [3.6, '#3d8de0']]) { const px = Math.cos(a) * 0.064, pz = Math.sin(a) * 0.044; s.add(col, new THREE.BoxGeometry(0.018, 0.008, 0.01).rotateY(-a).translate(px, 0.01, pz)); s.add(col, new THREE.BoxGeometry(0.01, 0.006, 0.008).rotateY(-a).translate(px, 0.016, pz)); }
    });
    return [at(m, 0, 0.12), at(m, 0.12, 0)]; } },
  // A big striped carpet for a bigger classroom's story corner.
  carpet: { r: 0.2, low: true, make(bag, x, z, c, rnd) {
    const rot = rnd() < 0.5 ? 0 : Math.PI / 2;
    for (let i = 0; i < 7; i++) bag.add(i % 2 ? '#fbfaf6' : RAINBOW[(i + Math.floor(rnd() * 3)) % 8], new THREE.BoxGeometry(0.36, 0.006, 0.04).translate(0, 0.003, -0.12 + i * 0.04).rotateY(rot).translate(x, 0, z));
    const seats = []; for (let i = 0; i < 8; i++) { const u = -0.14 + (i % 4) * 0.093, v = i < 4 ? -0.08 : 0.08; seats.push(rot ? [x + v, z + u, 0.004] : [x + u, z + v, 0.004]); }
    return seats; } },
  // ---- library ----
  // The librarian's desk: a computer, a date stamp and a crate of returned books; a chair behind it.
  librarydesk: { r: 0.1, make(bag, x, z, c, rnd) {
    const m = frame(x, z, facing(x, z) + (rnd() - 0.5) * 0.6);
    bag.within(m, s => {
      s.box(WOOD, 0.16, 0.012, 0.07, 0, 0.07, 0); s.box('#e9e4da', 0.15, 0.064, 0.012, 0, 0.032, 0.028);
      for (const sx of [-0.07, 0.07]) s.box('#e9e4da', 0.012, 0.064, 0.06, sx, 0.032, 0);
      s.box(DARK, 0.04, 0.03, 0.004, -0.04, 0.095, -0.01); s.add('*#bfe4f3', new THREE.PlaneGeometry(0.034, 0.024).rotateY(Math.PI).translate(-0.04, 0.095, -0.0125)); s.cyl(DARK, 0.008, 0.004, -0.04, 0.078, -0.01, 0.012, 8); s.cyl(DARK, 0.003, 0.012, -0.04, 0.084, -0.01, 0.003, 6);
      s.box(STEEL, 0.03, 0.004, 0.014, -0.03, 0.078, -0.028);
      s.cyl(RED, 0.006, 0.01, 0.01, 0.081, -0.02, 0.004, 8); s.box(DARK, 0.012, 0.004, 0.012, 0.01, 0.077, -0.02);
      s.box('#c9975f', 0.05, 0.03, 0.04, 0.05, 0.091, 0.005); bookRow(s, 0.028, 0.072, 0.092, 0.005, 0.034, 0.03, 0.04, rnd);
      s.cyl(pickC(rnd), 0.02, 0.045, 0, 0.0225, -0.075);
    });
    return [atH(m, 0, -0.075, 0.045)]; } },
  // A book trolley on four wheels.
  bookcart: { r: 0.06, make(bag, x, z, c, rnd) {
    const m = frame(x, z, rnd() * 6.28);
    bag.within(m, s => {
      for (const y of [0.012, 0.052]) s.box(STEEL, 0.1, 0.004, 0.05, 0, y, 0);
      for (const sx of [-0.048, 0.048]) s.box(STEEL, 0.004, 0.09, 0.05, sx, 0.052, 0);
      s.box(STEEL, 0.1, 0.004, 0.004, 0, 0.096, -0.02);
      for (const y of [0.014, 0.054]) bookRow(s, -0.044, 0.044, y, 0, 0.04, 0.03, 0.036, rnd);
      for (const sx of [-0.04, 0.04]) for (const sz of [-0.02, 0.02]) s.add(DARK, new THREE.CylinderGeometry(0.008, 0.008, 0.006, 8).rotateX(Math.PI / 2).translate(sx, 0.008, sz));
    });
    return []; } },
  // A floor lamp with a warm glowing shade.
  lamp: { r: 0.035, make(bag, x, z, c, rnd) {
    bag.cyl(DARK, 0.03, 0.006, x, 0.003, z, 0.03, 12); bag.cyl(DARK, 0.004, 0.2, x, 0.1, z, 0.004, 6);
    bag.cyl('*#ffe7a3', 0.035, 0.05, x, 0.215, z, 0.028, 12);
    return []; } },
  // A puppet theatre: a striped booth with two puppets on the go, and cushions for the audience.
  puppettheatre: { r: 0.09, make(bag, x, z, c, rnd) {
    const m = frame(x, z, facing(x, z) + (rnd() - 0.5) * 0.8), col = pickC(rnd), seats = [];
    bag.within(m, s => {
      s.box(col, 0.14, 0.17, 0.05, 0, 0.085, -0.02);
      for (let i = 0; i < 7; i++) if (i % 2) s.box(PAPER, 0.02, 0.17, 0.002, -0.06 + i * 0.02, 0.085, 0.0065);
      s.box('#26272d', 0.1, 0.07, 0.003, 0, 0.1, 0.0085);
      s.add(RED, tri([[-0.08, 0], [0.08, 0], [0, 0.05]]).translate(0, 0.17, 0.006));
      for (const [px, pc] of [[-0.025, '#f28b30'], [0.025, '#3d8de0']]) { s.ball('#f2cfa8', 0.012, px, 0.09, 0.014); s.box(pc, 0.02, 0.028, 0.014, px, 0.077, 0.016); }
      for (let i = 0; i < 3; i++) { const sx = -0.04 + i * 0.04; s.cyl(pickC(rnd), 0.02, 0.012, sx, 0.006, 0.09, 0.02, 10); seats.push(atH(m, sx, 0.09, 0.012)); }
    });
    return seats; } },
  // ---- hall ----
  // Court lines painted on the hall floor: a border, a centre line and a centre circle. (Drawn to the room.)
  court: { r: 0.02, low: true, centre: true, make(bag, x, z, c, rnd, o) {
    if (!o || o.kind !== 'rr') return [];
    const W = o.W - 0.5, D = o.D - 0.5, t = 0.01;
    if (W < 0.6 || D < 0.4) return [];
    const line = (w, d, px, pz) => bag.box(PAPER, w, 0.002, d, px, 0.002, pz);
    line(W, t, 0, -D / 2); line(W, t, 0, D / 2); line(t, D, -W / 2, 0); line(t, D, W / 2, 0);
    if (W >= D) line(t, D, 0, 0); else line(W, t, 0, 0);
    const r = Math.min(W, D) * 0.16; bag.add(PAPER, new THREE.RingGeometry(r, r + t, 32).rotateX(-Math.PI / 2).translate(0, 0.003, 0));
    return []; } },
  // A small goal with a net.
  goal: { r: 0.09, make(bag, x, z, c, rnd) {
    const m = frame(x, z, facing(x, z) + (rnd() - 0.5) * 0.5);
    bag.within(m, s => {
      for (const sx of [-0.07, 0.07]) s.box(WHITE, 0.008, 0.09, 0.008, sx, 0.045, 0);
      s.box(WHITE, 0.148, 0.008, 0.008, 0, 0.094, 0);
      for (const sx of [-0.07, 0.07]) s.box(WHITE, 0.006, 0.006, 0.05, sx, 0.003, -0.025);
      s.add('^#e8e4da', new THREE.PlaneGeometry(0.14, 0.09).translate(0, 0.045, -0.045));
      s.add('^#e8e4da', new THREE.PlaneGeometry(0.14, 0.05).rotateX(-Math.PI / 2).translate(0, 0.09, -0.02));
      s.sphere(PAPER, 0.012, 0.03, 0.012, 0.08, 8);
    });
    return []; } },
  // A low balance beam.
  balancebeam: { r: 0.1, make(bag, x, z, c, rnd) {
    const m = frame(x, z, rnd() * 6.28);
    bag.within(m, s => { s.box('#3d8de0', 0.2, 0.016, 0.02, 0, 0.04, 0); for (const sx of [-0.08, 0.08]) { s.box(STEEL, 0.012, 0.032, 0.012, sx, 0.016, 0); s.box(STEEL, 0.03, 0.006, 0.05, sx, 0.003, 0); } });
    return []; } },
  // Hula hoops leaning in a stack, and a basket of bean bags.
  hoops: { r: 0.06, make(bag, x, z, c, rnd) {
    for (let i = 0; i < 4; i++) bag.add(RAINBOW[(i * 2 + 1) % 8], new THREE.TorusGeometry(0.04, 0.003, 5, 16).rotateX(Math.PI / 2 - 0.25).translate(x + i * 0.006, 0.042, z + i * 0.004));
    bag.cyl('#c9975f', 0.025, 0.03, x - 0.05, 0.015, z + 0.03, 0.02, 10);
    for (let i = 0; i < 3; i++) bag.ball(pickC(rnd), 0.008, x - 0.05 + Math.cos(i * 2.1) * 0.01, 0.03, z + 0.03 + Math.sin(i * 2.1) * 0.01);
    return []; } },
  // ---- lunch hall ----
  // A long table with a bench down each side: six places, each laid, and a bowl of fruit in the middle.
  longtable: { r: 0.15, make(bag, x, z, c, rnd) {
    const m = frame(x, z, rnd() < 0.5 ? 0 : Math.PI / 2), seats = [];
    bag.within(m, s => {
      s.box(TABLE, 0.26, 0.012, 0.09, 0, 0.075, 0); for (const sx of [-0.1, 0.1]) s.box('#d8d4cc', 0.012, 0.07, 0.07, sx, 0.035, 0);
      for (const sz of [-0.075, 0.075]) { s.box(pickC(rnd), 0.24, 0.01, 0.035, 0, 0.045, sz); for (const sx of [-0.1, 0.1]) s.box(STEEL, 0.008, 0.04, 0.03, sx, 0.02, sz); }
      for (let i = 0; i < 6; i++) { const px = -0.085 + (i % 3) * 0.085, pz = i < 3 ? -0.028 : 0.028; s.cyl(PAPER, 0.016, 0.003, px, 0.0825, pz, 0.014, 12); s.ball(['#a3d140', ORANGE, '#f7c22e', RED][i % 4], 0.008, px, 0.083, pz); s.cyl(pickC(rnd), 0.005, 0.014, px + 0.024, 0.088, pz, 0.004, 8); seats.push(atH(m, px, i < 3 ? -0.075 : 0.075, 0.05)); }
      s.cyl(PAPER, 0.018, 0.012, 0, 0.087, 0, 0.012, 12); for (let i = 0; i < 3; i++) s.sphere([RED, '#f7c22e', '#a3d140'][i], 0.008, Math.cos(i * 2.1) * 0.007, 0.097, Math.sin(i * 2.1) * 0.007);
    });
    return seats; } },
  // A salad bar: bowls of colours under a glass guard, on wheels.
  saladbar: { r: 0.09, make(bag, x, z, c, rnd) {
    const m = frame(x, z, rnd() * 6.28);
    bag.within(m, s => {
      s.box(WHITE, 0.16, 0.07, 0.07, 0, 0.035, 0); s.box(STEEL, 0.17, 0.006, 0.08, 0, 0.073, 0);
      ['#a3d140', '#e6463c', '#f7c22e', '#f28b30', '#7db45a'].forEach((col, i) => { s.cyl(STEEL, 0.014, 0.01, -0.06 + i * 0.03, 0.08, 0, 0.012, 10); s.ball(col, 0.011, -0.06 + i * 0.03, 0.082, 0); });
      s.box('~#bfe4f3', 0.16, 0.03, 0.003, 0, 0.11, -0.03); for (const sx of [-0.075, 0.075]) s.box(STEEL, 0.004, 0.045, 0.004, sx, 0.0975, -0.03);
      for (const sx of [-0.06, 0.06]) for (const sz of [-0.03, 0.03]) s.add(DARK, new THREE.CylinderGeometry(0.009, 0.009, 0.006, 8).rotateX(Math.PI / 2).translate(sx, 0.009, sz));
    });
    return []; } },
  // A tiered fruit stand.
  fruitstand: { r: 0.05, make(bag, x, z, c, rnd) {
    bag.cyl(WOOD, 0.04, 0.05, x, 0.025, z, 0.04, 12);
    for (let t = 0; t < 3; t++) {
      const r = 0.045 - t * 0.012, y = 0.05 + t * 0.028; bag.cyl(WHITE, r, 0.004, x, y, z, r, 12); if (t < 2) bag.cyl(STEEL, 0.004, 0.028, x, y + 0.014, z, 0.004, 6);
      const n = 7 - t * 2; for (let i = 0; i < n; i++) { const a = i / n * 6.28; bag.sphere([RED, '#f7c22e', '#f28b30', '#a3d140'][(i + t) % 4], 0.009, x + Math.cos(a) * (r - 0.012), y + 0.011, z + Math.sin(a) * (r - 0.012), 8); }
    }
    return []; } },
  // ---- art room ----
  // A potter's wheel with a pot on the go, a stool and a bucket.
  potterywheel: { r: 0.07, make(bag, x, z, c, rnd) {
    const m = frame(x, z, rnd() * 6.28);
    bag.within(m, s => {
      s.box(STEEL, 0.07, 0.05, 0.06, 0, 0.025, 0); s.cyl('#8d8f96', 0.03, 0.006, 0, 0.053, 0, 0.03, 14);
      s.cyl('#b7855a', 0.016, 0.03, 0, 0.071, 0, 0.012, 10); s.cyl('#8d6a4a', 0.012, 0.004, 0, 0.088, 0, 0.012, 10);
      s.cyl(STEEL, 0.02, 0.028, 0.06, 0.014, -0.02, 0.016, 10); s.cyl('~#bfe4f3', 0.017, 0.004, 0.06, 0.03, -0.02, 0.017, 10);
      s.cyl(WOOD, 0.02, 0.04, 0, 0.02, 0.07, 0.02, 10);
    });
    return [atH(m, 0, 0.07, 0.04)]; } },
  // A kiln with a round door glowing inside, and pots cooling on top.
  kiln: { r: 0.06, make(bag, x, z, c, rnd) {
    const m = frame(x, z, facing(x, z) + (rnd() - 0.5) * 0.8);
    bag.within(m, s => {
      s.box('#8d8f96', 0.1, 0.11, 0.09, 0, 0.055, 0); s.box(DARK, 0.1, 0.01, 0.09, 0, 0.115, 0);
      s.add('#6b6e76', new THREE.CylinderGeometry(0.03, 0.03, 0.006, 16).rotateX(Math.PI / 2).translate(0, 0.05, 0.047)); s.add('*#ff9a3c', new THREE.CircleGeometry(0.012, 12).translate(0, 0.05, 0.051));
      s.box(STEEL, 0.03, 0.006, 0.006, 0.02, 0.05, 0.052);
      for (let i = 0; i < 3; i++) s.cyl(['#c99a6b', '#e2457d', '#22b2bf'][i], 0.01, 0.022, -0.03 + i * 0.03, 0.131, 0, 0.007, 8);
    });
    return []; } },
  // A clay table: lumps of clay, pots drying and a rolling pin, with stools round it.
  claytable: { r: 0.11, make(bag, x, z, c, rnd) {
    const m = frame(x, z, rnd() * 6.28), seats = [];
    bag.within(m, s => {
      s.box(TABLE, 0.18, 0.012, 0.1, 0, 0.07, 0); for (const [lx, lz] of [[-0.08, -0.04], [0.08, -0.04], [-0.08, 0.04], [0.08, 0.04]]) s.box('#d8d4cc', 0.01, 0.064, 0.01, lx, 0.032, lz);
      s.box('#8d8f96', 0.16, 0.003, 0.08, 0, 0.0775, 0);
      for (let i = 0; i < 4; i++) { const px = -0.06 + i * 0.04, pz = i % 2 ? 0.02 : -0.02; if (i % 2) s.ball('#b7855a', 0.012, px, 0.079, pz); else s.cyl('#b7855a', 0.012, 0.018, px, 0.088, pz, 0.009, 8); }
      s.add(WOOD, new THREE.CylinderGeometry(0.005, 0.005, 0.05, 6).rotateZ(Math.PI / 2).rotateY(0.4).translate(0.05, 0.084, 0.03));
      for (const sx of [-0.05, 0.05]) for (const sz of [-0.085, 0.085]) { s.cyl(pickC(rnd), 0.02, 0.045, sx, 0.0225, sz); seats.push(atH(m, sx, sz, 0.045)); }
    });
    return seats; } },
  // ---- music room ----
  // Three music stands with chairs, in a little arc: the school orchestra.
  musicstands: { r: 0.11, make(bag, x, z, c, rnd) {
    const m = frame(x, z, facing(x, z) + (rnd() - 0.5) * 0.6), seats = [];
    bag.within(m, s => {
      for (let i = 0; i < 3; i++) {
        const a = (i - 1) * 0.55, sx = Math.sin(a) * 0.07, sz = -Math.cos(a) * 0.07 + 0.04;
        s.within(new THREE.Matrix4().makeRotationY(a).setPosition(sx, 0, sz), p => {
          p.cyl(DARK, 0.002, 0.08, 0, 0.04, 0, 0.002, 5); for (let k = 0; k < 3; k++) p.add(DARK, new THREE.BoxGeometry(0.003, 0.003, 0.03).translate(0, 0.0015, 0.015).rotateY(k * 2.09));
          p.add(DARK, new THREE.BoxGeometry(0.05, 0.04, 0.002).rotateX(-0.4).translate(0, 0.095, 0)); p.add(PAPER, new THREE.BoxGeometry(0.036, 0.03, 0.001).rotateX(-0.4).translate(0, 0.097, 0.0015));
          p.cyl(pickC(rnd), 0.02, 0.045, 0, 0.0225, -0.06);
        });
        seats.push(atH(m, sx - Math.sin(a) * 0.06, sz - Math.cos(a) * 0.06, 0.045));
      }
    });
    return seats; } },
  // A conductor's podium with a music stand and a baton.
  conductor: { r: 0.05, make(bag, x, z, c, rnd) {
    bag.box(WOOD, 0.07, 0.02, 0.07, x, 0.01, z);
    bag.cyl(DARK, 0.002, 0.09, x, 0.065, z + 0.02, 0.002, 5); bag.add(DARK, new THREE.BoxGeometry(0.05, 0.04, 0.002).rotateX(-0.4).translate(x, 0.12, z + 0.02));
    bag.cyl(PAPER, 0.0015, 0.03, x + 0.02, 0.035, z - 0.01, 0.0015, 4);
    return []; } },
  // A basket of shakers: maracas and a tambourine.
  shakers: { r: 0.05, make(bag, x, z, c, rnd) {
    bag.cyl('#c9975f', 0.035, 0.04, x, 0.02, z, 0.03, 12);
    for (let i = 0; i < 3; i++) { const a = i * 2.1, mx = x + Math.cos(a) * 0.015, mz = z + Math.sin(a) * 0.015; bag.ball(pickC(rnd), 0.011, mx, 0.04, mz); bag.cyl(WOOD, 0.003, 0.035, mx, 0.07, mz, 0.003, 5); }
    bag.add('#f7c22e', new THREE.TorusGeometry(0.02, 0.004, 5, 14).rotateX(0.5).translate(x + 0.045, 0.03, z + 0.02));
    return []; } },
  // A microphone on a stand.
  mic: { r: 0.03, make(bag, x, z, c, rnd) {
    bag.cyl(DARK, 0.02, 0.004, x, 0.002, z, 0.02, 10); bag.cyl(DARK, 0.002, 0.14, x, 0.072, z, 0.002, 5);
    bag.add(DARK, new THREE.CylinderGeometry(0.003, 0.003, 0.03, 6).rotateX(0.9).translate(x, 0.15, z + 0.01)); bag.sphere('#8d8f96', 0.008, x, 0.158, z + 0.022, 8);
    return []; } },
  // A double bass leaning on its stand.
  doublebass: { r: 0.05, make(bag, x, z, c, rnd) {
    const m = frame(x, z, rnd() * 6.28);
    bag.within(m, s => {
      s.within(new THREE.Matrix4().makeRotationX(-0.25).setPosition(0, 0.02, 0), p => {
        p.add('#8a5a3b', new THREE.SphereGeometry(0.03, 10, 8).scale(1, 1.1, 0.4).translate(0, 0.04, 0)); p.add('#8a5a3b', new THREE.SphereGeometry(0.024, 10, 8).scale(1, 1.1, 0.4).translate(0, 0.085, 0));
        p.box('#5a3a26', 0.008, 0.16, 0.008, 0, 0.17, 0); p.box(DARK, 0.012, 0.03, 0.012, 0, 0.26, 0);
        for (let i = 0; i < 4; i++) p.box(STEEL, 0.0008, 0.22, 0.0008, -0.0045 + i * 0.003, 0.14, 0.0125);
        p.box('#5a3a26', 0.03, 0.004, 0.004, 0, 0.06, 0.013);
      });
      s.box(DARK, 0.06, 0.006, 0.05, 0, 0.003, 0.02); s.box(DARK, 0.006, 0.03, 0.006, 0, 0.015, -0.03);
    });
    return []; } },
  // ---- maker workshop ----
  // A brick-building table: a green baseplate with towers going up, a tub of bricks, stools round it.
  legotable: { r: 0.1, make(bag, x, z, c, rnd) {
    const m = frame(x, z, rnd() * 6.28), seats = [];
    bag.within(m, s => {
      s.box(TABLE, 0.16, 0.012, 0.12, 0, 0.065, 0); for (const [lx, lz] of [[-0.07, -0.05], [0.07, -0.05], [-0.07, 0.05], [0.07, 0.05]]) s.box('#d8d4cc', 0.01, 0.06, 0.01, lx, 0.03, lz);
      s.box('#a3d140', 0.14, 0.004, 0.1, 0, 0.073, 0);
      for (let i = 0; i < 7; i++) { const bx = -0.05 + rnd() * 0.1, bz = -0.035 + rnd() * 0.07, h = 0.008 + Math.floor(rnd() * 4) * 0.008; s.box(pickC(rnd), 0.014, h, 0.014, bx, 0.075 + h / 2, bz); s.cyl(pickC(rnd), 0.003, 0.003, bx, 0.0765 + h, bz, 0.003, 6); }
      s.box('#3d8de0', 0.05, 0.03, 0.04, 0.11, 0.015, 0.02); for (let i = 0; i < 4; i++) s.box(pickC(rnd), 0.01, 0.008, 0.01, 0.1 + (i % 2) * 0.016, 0.034, 0.012 + Math.floor(i / 2) * 0.016);
      for (const sz of [-0.09, 0.09]) for (const sx of [-0.04, 0.04]) { s.cyl(pickC(rnd), 0.02, 0.045, sx, 0.0225, sz); seats.push(atH(m, sx, sz, 0.045)); }
    });
    return seats; } },
  // A laser cutter: an open tray with an orange glass lid, and a head that runs to and fro over the wood.
  lasercutter: { r: 0.08, make(bag, x, z, c, rnd) {
    const m = frame(x, z, rnd() * 6.28);
    bag.within(m, s => {
      s.box(STEEL, 0.14, 0.05, 0.1, 0, 0.025, 0); s.box('#d8d4cc', 0.14, 0.008, 0.1, 0, 0.004, 0);
      for (const sx of [-0.066, 0.066]) s.box(STEEL, 0.008, 0.022, 0.1, sx, 0.061, 0); for (const sz of [-0.046, 0.046]) s.box(STEEL, 0.14, 0.022, 0.008, 0, 0.061, sz);
      s.box('#c9a46f', 0.1, 0.003, 0.06, 0, 0.0515, -0.005);
      s.box('~#f8b878', 0.124, 0.002, 0.084, 0, 0.073, 0);
      s.add('*#7fe0a0', new THREE.PlaneGeometry(0.02, 0.01).translate(0.045, 0.06, 0.0505)); s.cyl(RED, 0.004, 0.004, -0.05, 0.074, 0.047, 0.004, 8);
      s.part(partGroup(h => { h.box(DARK, 0.012, 0.01, 0.012, 0, 0, 0); h.cyl(STEEL, 0.002, 0.012, 0, -0.008, 0, 0.001, 6); h.add('*#ff5a3c', new THREE.PlaneGeometry(0.003, 0.012).translate(0, -0.014, 0)); }, { glide: { axis: 'x', base: 0, amp: 0.04, speed: 1.8 + rnd(), phase: rnd() * 6 } })).position.set(0, 0.066, -0.005);
    });
    return []; } },
  // A cardboard castle the children made, with a flag on top.
  cardboardcastle: { r: 0.08, make(bag, x, z, c, rnd) {
    const m = frame(x, z, rnd() * 6.28), CARD = '#c9a46f';
    bag.within(m, s => {
      s.box(CARD, 0.12, 0.08, 0.1, 0, 0.04, 0);
      for (const [tx, tz] of [[-0.06, -0.05], [0.06, -0.05], [-0.06, 0.05], [0.06, 0.05]]) { s.box(CARD, 0.036, 0.11, 0.036, tx, 0.055, tz); for (let k = 0; k < 4; k++) s.box(CARD, 0.009, 0.012, 0.009, tx + (k % 2 ? 0.012 : -0.012), 0.116, tz + (k < 2 ? -0.012 : 0.012)); }
      for (let k = 0; k < 4; k++) s.box(CARD, 0.012, 0.012, 0.012, -0.03 + k * 0.02, 0.086, 0.044);
      s.box('#5a3a26', 0.03, 0.04, 0.004, 0, 0.02, 0.05); s.add(DARK, new THREE.CylinderGeometry(0.015, 0.015, 0.004, 10, 1, false, 0, Math.PI).rotateX(Math.PI / 2).translate(0, 0.04, 0.05));
      s.cyl(STEEL, 0.0015, 0.05, 0.06, 0.135, -0.05, 0.0015, 4); s.add('^#e6463c', tri([[0, 0], [0.03, 0.008], [0, 0.016]]).translate(0.06, 0.144, -0.05));
    });
    return []; } },
  // A soldering bench: a lamp, a circuit board and a coil of wire, and a stool.
  solder: { r: 0.07, make(bag, x, z, c, rnd) {
    const m = frame(x, z, facing(x, z) + (rnd() - 0.5) * 0.8);
    bag.within(m, s => {
      s.box(WOOD, 0.12, 0.012, 0.07, 0, 0.07, 0); for (const [lx, lz] of [[-0.05, -0.025], [0.05, -0.025], [-0.05, 0.025], [0.05, 0.025]]) s.box('#d8d4cc', 0.01, 0.064, 0.01, lx, 0.032, lz);
      s.box('#3e9a4f', 0.04, 0.003, 0.03, -0.01, 0.0775, 0.005); for (let i = 0; i < 5; i++) s.box(DARK, 0.004, 0.004, 0.004, -0.024 + i * 0.008, 0.081, 0.002 + (i % 2) * 0.008);
      s.cyl(DARK, 0.004, 0.003, 0.04, 0.0775, -0.02, 0.004, 6); s.add(DARK, new THREE.CylinderGeometry(0.0015, 0.0015, 0.06, 4).rotateX(0.5).translate(0.04, 0.1, -0.008)); s.cyl('*#ffe7a3', 0.012, 0.012, 0.035, 0.125, 0.01, 0.008, 10);
      s.add('#f28b30', new THREE.TorusGeometry(0.008, 0.003, 5, 10).rotateX(Math.PI / 2).translate(0.03, 0.08, 0.022));
      s.cyl(pickC(rnd), 0.02, 0.045, 0, 0.0225, 0.07);
    });
    return [atH(m, 0, 0.07, 0.045)]; } },
  // ---- chill-out room ----
  // A hammock on a wooden stand.
  hammock: { r: 0.1, make(bag, x, z, c, rnd) {
    const m = frame(x, z, rnd() * 6.28), col = pickC(rnd);
    bag.within(m, s => {
      for (const sx of [-0.11, 0.11]) { s.add(WOOD, new THREE.BoxGeometry(0.012, 0.11, 0.012).rotateZ(sx > 0 ? -0.5 : 0.5).translate(sx, 0.05, 0)); s.box(WOOD, 0.05, 0.01, 0.05, sx * 1.15, 0.005, 0); }
      s.box(WOOD, 0.3, 0.01, 0.014, 0, 0.012, 0);
      for (let i = 0; i < 8; i++) { const t0 = i / 8, t1 = (i + 1) / 8, x0 = -0.1 + 0.2 * t0, x1 = -0.1 + 0.2 * t1, y0 = 0.095 - Math.sin(t0 * Math.PI) * 0.05, y1 = 0.095 - Math.sin(t1 * Math.PI) * 0.05; s.add(col, new THREE.BoxGeometry(Math.hypot(x1 - x0, y1 - y0) + 0.002, 0.003, 0.06).rotateZ(Math.atan2(y1 - y0, x1 - x0)).translate((x0 + x1) / 2, (y0 + y1) / 2, 0)); }
      s.add('#fbfaf6', new THREE.SphereGeometry(0.014, 8, 6).scale(1.4, 0.6, 1).translate(0.05, 0.062, 0));
    });
    return [atH(m, 0, 0, 0.045)]; } },
  // A lava lamp on a little table.
  lavalamp: { r: 0.035, make(bag, x, z, c, rnd) {
    bag.cyl(WOOD, 0.025, 0.004, x, 0.05, z, 0.025, 10); bag.cyl(WOOD, 0.004, 0.05, x, 0.025, z, 0.004, 6); bag.cyl(WOOD, 0.02, 0.004, x, 0.002, z, 0.02, 10);
    bag.cyl(STEEL, 0.012, 0.012, x, 0.058, z, 0.009, 10); bag.cyl('~#f5a3c7', 0.009, 0.05, x, 0.089, z, 0.014, 10); bag.cyl(STEEL, 0.006, 0.01, x, 0.119, z, 0.009, 10);
    for (let i = 0; i < 3; i++) bag.sphere('*#e2457d', 0.005 + i * 0.001, x + (i - 1) * 0.003, 0.075 + i * 0.013, z, 6);
    return []; } },
  // A big nest cushion to curl up in.
  nest: { r: 0.08, make(bag, x, z, c, rnd) {
    const col = pickC(rnd);
    bag.add(col, new THREE.TorusGeometry(0.05, 0.022, 7, 18).rotateX(Math.PI / 2).translate(x, 0.02, z)); bag.cyl(col, 0.05, 0.012, x, 0.006, z, 0.05, 18);
    bag.ball(pickC(rnd), 0.014, x + 0.01, 0.012, z - 0.01);
    return [[x, z, 0.014]]; } },
  // ---- observatory ----
  // The moon on a stand, craters and all.
  moonglobe: { r: 0.04, make(bag, x, z, c, rnd) {
    bag.cyl(DARK, 0.02, 0.004, x, 0.002, z, 0.02, 10); bag.cyl(DARK, 0.003, 0.03, x, 0.019, z, 0.003, 6);
    bag.sphere('#d9d6cf', 0.03, x, 0.064, z, 12);
    for (let i = 0; i < 6; i++) { const a = rnd() * 6.28, b2 = (rnd() - 0.5) * 2.4, r = 0.004 + rnd() * 0.004, nx = Math.cos(b2) * Math.cos(a), ny = Math.sin(b2), nz = Math.cos(b2) * Math.sin(a); bag.add('#b5b1a8', new THREE.CircleGeometry(r, 8).lookAt(new THREE.Vector3(nx, ny, nz)).translate(x + nx * 0.0303, 0.064 + ny * 0.0303, z + nz * 0.0303)); }
    return []; } },
  // A model rocket on a stand.
  rocketmodel: { r: 0.04, make(bag, x, z, c, rnd) {
    bag.cyl(DARK, 0.025, 0.006, x, 0.003, z, 0.025, 10); bag.cyl(STEEL, 0.003, 0.03, x, 0.02, z, 0.003, 5);
    bag.cyl(PAPER, 0.012, 0.08, x, 0.075, z, 0.012, 10); bag.cyl(RED, 0, 0.03, x, 0.13, z, 0.012, 10);
    for (let i = 0; i < 3; i++) { const a = i * 2.09; bag.add('^#e6463c', tri([[0, 0], [0.018, -0.02], [0, 0.03]]).rotateY(-a).translate(x + Math.cos(a) * 0.012, 0.045, z + Math.sin(a) * 0.012)); }
    bag.add('#3d8de0', new THREE.CircleGeometry(0.004, 8).translate(x, 0.09, z + 0.0121));
    return []; } },
  // A meteorite in a glass case.
  meteorite: { r: 0.045, make(bag, x, z, c, rnd) {
    bag.box(DARK, 0.06, 0.06, 0.06, x, 0.03, z); bag.box('~#bfe4f3', 0.056, 0.05, 0.056, x, 0.085, z); bag.box(DARK, 0.06, 0.004, 0.06, x, 0.112, z);
    bag.add('#5a5650', new THREE.DodecahedronGeometry(0.014, 0).scale(1.2, 0.8, 1).translate(x, 0.075, z));
    bag.box(PAPER, 0.03, 0.012, 0.001, x, 0.045, z + 0.0305);
    return []; } },
  // An astronaut's suit on a stand, with a gold visor.
  spacesuit: { r: 0.045, make(bag, x, z, c, rnd) {
    const m = frame(x, z, facing(x, z) + (rnd() - 0.5) * 0.5);
    bag.within(m, s => {
      s.cyl(DARK, 0.03, 0.006, 0, 0.003, 0, 0.03, 12);
      for (const sx of [-0.012, 0.012]) s.box(PAPER, 0.018, 0.06, 0.02, sx, 0.036, 0);
      s.box(PAPER, 0.052, 0.07, 0.03, 0, 0.1, 0); s.box('#8d8f96', 0.04, 0.05, 0.02, 0, 0.1, -0.024);
      for (const sx of [-0.036, 0.036]) s.add(PAPER, new THREE.BoxGeometry(0.016, 0.06, 0.018).rotateZ(sx > 0 ? -0.2 : 0.2).translate(sx, 0.1, 0));
      s.sphere(PAPER, 0.022, 0, 0.155, 0, 12); s.add('#e8c547', new THREE.SphereGeometry(0.0225, 12, 8, Math.PI * 0.2, Math.PI * 0.6, Math.PI * 0.3, Math.PI * 0.4).translate(0, 0.155, 0));
      s.box('#3d8de0', 0.014, 0.006, 0.002, 0, 0.118, 0.016); s.box(RED, 0.01, 0.004, 0.002, -0.015, 0.112, 0.016);
    });
    return []; } },
  // The class teddy, sitting on the floor.
  teddy: { r: 0.045, make(bag, x, z, c, rnd) {
    const rot = rnd() * 6.28, m = frame(x, z, rot), fur = ['#c99a6b', '#8a5a3b', '#e3c9a8'][Math.floor(rnd() * 3)];
    bag.within(m, s => {
      s.sphere(fur, 0.02, 0, 0.02, 0, 10); s.sphere(fur, 0.015, 0, 0.046, 0, 10);
      for (const sx of [-0.011, 0.011]) s.sphere(fur, 0.006, sx, 0.058, -0.002, 6);
      s.sphere('#f6e6d2', 0.0065, 0, 0.042, 0.011, 7); s.sphere(DARK, 0.0025, 0, 0.044, 0.016, 5);
      for (const sx of [-0.0055, 0.0055]) s.sphere(DARK, 0.0018, sx, 0.05, 0.0135, 4);
      for (const sx of [-0.016, 0.016]) s.add(fur, new THREE.CapsuleGeometry(0.006, 0.014, 2, 6).rotateZ(sx > 0 ? -1.2 : 1.2).translate(sx * 1.2, 0.012, 0.012));
      for (const sx of [-0.013, 0.013]) s.add(fur, new THREE.CapsuleGeometry(0.0065, 0.012, 2, 6).rotateX(Math.PI / 2).translate(sx, 0.008, 0.02));
      s.add(RED, new THREE.TorusGeometry(0.0115, 0.0025, 4, 12).rotateX(Math.PI / 2).translate(0, 0.034, 0));
    });
    return []; } },

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
    return [atH(m, -0.055, 0.1, 0.045), atH(m, 0.055, 0.1, 0.045)]; } },
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
    return [atH(m, 0.07, 0.11, 0.045), atH(m, -0.07, 0.11, 0.045), atH(m, 0.07, -0.11, 0.045)]; } },
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
    return [atH(m, -0.08, D / 2 + 0.05, 0.045), atH(m, 0, D / 2 + 0.05, 0.045), atH(m, 0.08, D / 2 + 0.05, 0.045)]; } },
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
    for (const [sx, sz] of [[-0.06, 0.1], [0.06, 0.1], [-0.06, -0.1], [0.06, -0.1]]) bag.within(m, t => t.cyl(pickC(rnd), 0.02, 0.045, sx, 0.0225, sz));      // (stools)
    return [atH(m, -0.06, 0.1, 0.045), atH(m, 0.06, 0.1, 0.045), atH(m, -0.06, -0.1, 0.045), atH(m, 0.06, -0.1, 0.045)]; } },
  // A free-standing display board on feet, with children's paintings on both sides (for rooms with glass walls).
  artwall: { r: 0.11, make(bag, x, z, c, rnd) {
    const m = frame(x, z, facing(x, z) + (rnd() - 0.5) * 0.8);
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
    return [atH(m, 0, -0.06, 0.048)]; } },
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
  parachute: { r: 0.19, low: true, make(bag, x, z, c, rnd) {
    const r = 0.16, rot = rnd() * 6;
    for (let i = 0; i < 12; i++) bag.floor(RAINBOW[i % 8], new THREE.CircleGeometry(r, 3, rot + (i / 12) * Math.PI * 2, Math.PI * 2 / 12), x, 0.003, z);
    bag.floor(PAPER, new THREE.CircleGeometry(0.025, 12), x, 0.0034, z);
    const seats = []; for (let i = 0; i < 8; i++) { const a = rot + (i / 8) * Math.PI * 2; seats.push([x + Math.cos(a) * (r + 0.015), z - Math.sin(a) * (r + 0.015)]); }
    return seats; } },
  // A thick blue gym mat.
  gymmat: { r: 0.1, low: true, make(bag, x, z, c, rnd) { const rot = rnd() * 6.28; bag.add('#3d8de0', new THREE.BoxGeometry(0.1, 0.016, 0.17).rotateY(rot).translate(x, 0.008, z)); bag.add('#6aa8ec', new THREE.BoxGeometry(0.084, 0.002, 0.154).rotateY(rot).translate(x, 0.017, z)); return [[x, z, 0.014]]; } },
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
    return [atF(m, -0.08, 0, 0.05), atF(m, 0, 0, 0.05), atF(m, 0.08, 0, 0.05)]; } },
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
  cushions: { r: 0.1, low: true, make(bag, x, z, c, rnd) {
    bag.cyl(WOOD, 0.036, 0.006, x, 0.028, z); bag.cyl(WOOD, 0.006, 0.025, x, 0.0125, z, 0.006, 6);
    bag.cyl(GOLD, 0.012, 0.01, x, 0.036, z, 0.008, 10);
    const seats = [], off = rnd() * 6;
    for (let i = 0; i < 4; i++) { const a = off + i * Math.PI / 2, sx = x + Math.cos(a) * 0.07, sz = z + Math.sin(a) * 0.07; bag.cyl(['#f5a3c7', '#a3d140', '#7fd8f0', '#f7c22e'][i], 0.025, 0.014, sx, 0.007, sz, 0.027, 12); seats.push([sx, sz, 0.012]); }
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
    return [atF(m, 0, 0.005, 0.047)]; } },
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

// Pull a line's ends in towards the middle of the room until both are inside it (for round rooms), or give up.
function fitSpan(o, x0, z0, x1, z1, m = 0.04) {
  for (let k = 1; k >= 0.5; k -= 0.06) if (o.inside(x0 * k, z0 * k, m) && o.inside(x1 * k, z1 * k, m)) return [x0 * k, z0 * k, x1 * k, z1 * k];
  return null;
}
// Walking in the library or the chill-out room: strings of warm fairy lights across the ceiling.
export function fairylights(bag, o, top, rnd) {
  const W = o.W / 2 - 0.1, D = o.D / 2 - 0.1, y = top - 0.03;
  if (W < 0.1 || D < 0.1) return;
  for (const span of [[-W, -D * 0.6, W, D * 0.6], [-W, D * 0.6, W, -D * 0.6]]) {
    const sp = fitSpan(o, ...span); if (!sp) continue; const [x0, z0, x1, z1] = sp;
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(4, Math.floor(len / 0.035)), sag = 0.03;
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector3(x0 + (x1 - x0) * t, y - Math.sin(t * Math.PI) * sag, z0 + (z1 - z0) * t)); }
    bag.tube('#26272d', pts, 0.0008, 24, 3);
    for (let i = 1; i < n; i++) { const t = i / n; bag.sphere('*#ffe7a3', 0.005, x0 + (x1 - x0) * t, y - Math.sin(t * Math.PI) * sag - 0.006, z0 + (z1 - z0) * t, 6); }
  }
}
// Walking in the lunch hall: paper lanterns hanging over the tables.
export function lanterns(bag, o, top, rnd) {
  const nx = Math.max(1, Math.round(o.W / 0.35)), nz = Math.max(1, Math.round(o.D / 0.35));
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = -o.W / 2 + o.W * (i + 0.5) / nx, z = -o.D / 2 + o.D * (j + 0.5) / nz;
    if (!o.inside(x, z, 0.12)) continue;
    const drop = 0.05 + rnd() * 0.03, r = 0.025 + rnd() * 0.01, col = ['*#ffd27a', '*#f5a3c7', '*#9fdcd0', '*#ffb66b'][(i + j * 2) % 4];
    bag.cyl('#26272d', 0.0008, drop, x, top - drop / 2, z, 0.0008, 3);
    bag.add(col, new THREE.SphereGeometry(r, 12, 8).scale(1, 0.8, 1).translate(x, top - drop - r * 0.8, z));
    bag.cyl(DARK, 0.006, 0.004, x, top - drop - r * 1.6 - 0.002, z, 0.006, 8);
  }
}
// Walking in the hall: climbing ropes hanging from the ceiling, knotted at the bottom.
export function climbropes(bag, o, top, rnd) {
  if (o.D < 0.6) return;
  const z = -o.D / 2 + 0.16, L = top - 0.08;
  for (const x of [-0.14, 0, 0.14]) {
    if (!o.inside(x, z, 0.06)) continue;
    bag.cyl('#c9a46f', 0.004, L, x, top - L / 2, z, 0.004, 6);
    bag.sphere('#b48b58', 0.009, x, top - L + 0.01, z, 8);
    bag.cyl(STEEL, 0.012, 0.006, x, top - 0.003, z, 0.012, 8);
  }
}

// Walking in the music room: paper notes hanging from the ceiling, turning slowly.
export function notemobiles(bag, o, top, rnd) {
  const spots = [[-0.3, -0.25], [0.32, -0.2], [-0.25, 0.3], [0.3, 0.28], [0, 0]].map(([u, v]) => [u * o.W, v * o.D]).filter(([x, z]) => o.inside(x, z, 0.1));
  spots.slice(0, 4).forEach(([x, z], i) => {
    const drop = 0.07 + rnd() * 0.05, y = top - drop, col = '^' + RAINBOW[(i * 3 + 1) % 8];
    const g = partGroup(p => { p.cyl('#e8e4da', 0.001, drop, 0, drop / 2, 0, 0.001, 3); p.add(col, new THREE.CircleGeometry(0.014, 10).scale(1.2, 0.9, 1).rotateZ(-0.4).translate(0, -0.03, 0)); p.add(col, new THREE.PlaneGeometry(0.004, 0.06).translate(0.014, 0, 0)); p.add(col, new THREE.PlaneGeometry(0.018, 0.005).rotateZ(-0.5).translate(0.022, 0.028, 0)); }, { yspin: 0.3 + i * 0.1 });
    g.position.set(x, y, z); bag.part(g);
  });
}
// Walking in the maker workshop: a drone the children built hangs from the ceiling, turning slowly.
export function drone(bag, o, top, rnd) {
  const x = -0.2 * o.W, z = 0.15 * o.D; if (!o.inside(x, z, 0.12)) return;
  const drop = 0.08;
  const g = partGroup(p => {
    p.cyl('#e8e4da', 0.001, drop, 0, drop / 2, 0, 0.001, 3);
    p.box(DARK, 0.03, 0.012, 0.03, 0, -0.006, 0); p.add('*#7fe0a0', new THREE.PlaneGeometry(0.008, 0.004).translate(0, -0.006, 0.0155));
    for (const [ax, az] of [[-0.03, -0.03], [0.03, -0.03], [-0.03, 0.03], [0.03, 0.03]]) { p.add(STEEL, new THREE.BoxGeometry(0.045, 0.004, 0.006).rotateY(Math.atan2(-az, ax)).translate(ax / 2, -0.004, az / 2)); p.cyl(DARK, 0.005, 0.008, ax, -0.004, az, 0.005, 8); p.cyl('~#9fdcd0', 0.02, 0.0015, ax, 0.002, az, 0.02, 12); }
  }, { yspin: 0.35 });
  g.position.set(x, top - drop, z); bag.part(g);
}
// Walking in the chill-out room: glowing stars on the ceiling.
export function ceilingstars(bag, o, top, rnd) {
  for (let i = 0; i < 14; i++) {
    const x = (rnd() - 0.5) * o.W * 0.85, z = (rnd() - 0.5) * o.D * 0.85; if (!o.inside(x, z, 0.08)) continue;
    bag.add('*#f5b82e', new THREE.ShapeGeometry(star(0.012 + rnd() * 0.01)).rotateX(Math.PI / 2).translate(x, top - 0.046, z));
  }
}
// Walking in the aquarium: a whale hangs over your head, turning slowly on its strings.
export function hangingwhale(bag, o, top, rnd) {
  if (!o.inside(0.25, 0, 0.1) || !o.inside(-0.25, 0, 0.1)) return;
  const ry = 0.07, bottom = Math.max(0.21, top - 0.3), cy = bottom + ry, BLUE = '#3d8de0';
  const g = partGroup(p => {
    for (const px of [-0.1, 0.1]) p.cyl('#e8e4da', 0.001, top - cy - ry * 0.9, px, (top + cy + ry * 0.9) / 2, 0, 0.001, 3);
    p.add(BLUE, new THREE.SphereGeometry(ry, 14, 10).scale(2.8, 1, 1).translate(0, cy, 0));
    p.add('#cfe8f7', new THREE.SphereGeometry(ry * 0.97, 12, 8).scale(2.6, 0.55, 0.9).translate(0, cy - ry * 0.35, 0));
    p.add(BLUE, new THREE.BoxGeometry(0.1, 0.012, 0.07).translate(-0.24, cy + 0.01, 0)); for (const sz of [-0.06, 0.06]) p.add(BLUE, new THREE.BoxGeometry(0.04, 0.008, 0.06).rotateY(sz > 0 ? 0.4 : -0.4).translate(-0.26, cy + 0.012, sz));
    for (const sz of [-0.05, 0.05]) p.add(BLUE, new THREE.BoxGeometry(0.09, 0.008, 0.03).rotateY(sz > 0 ? -0.3 : 0.3).translate(0.03, cy - ry * 0.5, sz * 1.7));
    p.sphere(DARK, 0.007, 0.13, cy + 0.01, 0.055, 6); p.sphere(DARK, 0.007, 0.13, cy + 0.01, -0.055, 6);
  }, { wave: { axis: 'y', base: 0, amp: 0.15, speed: 0.5, phase: rnd() * 6 } });
  bag.part(g);
}

// Walking in a classroom: a washing line of paintings pegged up across the room, and paper mobiles hanging
// from the ceiling (a sun, clouds, a rainbow and birds) turning slowly.
export function artline(bag, o, top, rnd) {
  const W = o.W / 2 - 0.14, D = o.D / 2 - 0.14, y = top - 0.07;
  if (W < 0.12 || D < 0.08) return;
  const across = W >= D;
  let x0 = across ? -W : 0.05 * W, z0 = across ? -0.2 * D : -D, x1 = across ? W : 0.05 * W, z1 = across ? -0.2 * D : D;
  const sp = fitSpan(o, x0, z0, x1, z1); if (!sp) return; [x0, z0, x1, z1] = sp;
  const len = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(z1 - z0, x1 - x0), n = Math.max(2, Math.floor(len / 0.11));
  const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector3(x0 + (x1 - x0) * t, y - Math.sin(t * Math.PI) * 0.025, z0 + (z1 - z0) * t)); }
  bag.tube('#e8e4da', pts, 0.0012, 20, 3);
  for (let i = 1; i < n; i++) {
    const t = i / n, px = x0 + (x1 - x0) * t, pz = z0 + (z1 - z0) * t, py = y - Math.sin(t * Math.PI) * 0.025, w = 0.06 + rnd() * 0.02, h = 0.05 + rnd() * 0.015;
    const m = new THREE.Matrix4().makeRotationY(-a).setPosition(px, py - 0.004 - h / 2, pz);
    bag.within(m, s => { painting(s, w, h, 0, 0, Math.floor(rnd() * 6), rnd); s.box(pickC(rnd), 0.006, 0.012, 0.004, -w / 3, h / 2, 0.001); s.box(pickC(rnd), 0.006, 0.012, 0.004, w / 3, h / 2, 0.001); });
  }
}
export function mobiles(bag, o, top, rnd) {
  const spots = [[-0.3, -0.25], [0.32, -0.2], [-0.25, 0.3], [0.3, 0.28]].map(([u, v]) => [u * o.W, v * o.D]).filter(([x, z]) => o.inside(x, z, 0.1));
  spots.slice(0, 3).forEach(([x, z], i) => {
    const drop = 0.08 + rnd() * 0.05, y = top - drop;
    const g = partGroup(p => {
      p.cyl('#e8e4da', 0.001, drop, 0, drop / 2, 0, 0.001, 3);
      if (i % 3 === 0) { p.add('*#f7c22e', new THREE.CircleGeometry(0.022, 12).translate(0, 0, 0)); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; p.add('#f7c22e', new THREE.BoxGeometry(0.004, 0.014, 0.002).translate(0, 0.03, 0).rotateZ(a)); } }
      else if (i % 3 === 1) { for (const [cx, r] of [[-0.012, 0.012], [0.004, 0.016], [0.02, 0.011]]) p.sphere('#ffffff', r, cx, -0.004, 0, 9); for (let k = 0; k < 5; k++) p.add('#7fd8f0', new THREE.CylinderGeometry(0.002, 0.002, 0.03, 4).translate(-0.016 + k * 0.009, -0.035, 0)); }
      else { ['#e6463c', '#f28b30', '#f7c22e', '#5f9e6e', '#3d8de0', '#7c46a8'].forEach((c, k) => p.add(c, new THREE.RingGeometry(0.03 - k * 0.0045, 0.034 - k * 0.0045, 14, 1, 0, Math.PI).translate(0, -0.02, 0))); }
    }, { yspin: 0.25 + i * 0.1 });
    g.position.set(x, y, z); bag.part(g);
  });
}

// Walking: strings of rainbow bunting across the ceiling, corner to corner.
export function bunting(bag, o, top, rnd) {
  const W = o.W / 2 - 0.12, D = o.D / 2 - 0.12, y = top - 0.05;
  if (W < 0.1 || D < 0.1) return;
  for (const span of [[-W, -D, W, D], [-W, D, W, -D]]) {
    const sp = fitSpan(o, ...span); if (!sp) continue; const [x0, z0, x1, z1] = sp;
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
  classroom: A => [['cubbies', 1], ['whiteboard', 1], ['coatpegs', 1], ['clock', 1], ['petcage', 1], ['pinboard', Math.floor(A / 2)], ['starchart', 1], ['art', 1], ['books', 1], ['sink', A >= 2 ? 1 : 0], ['numberline', A >= 2 ? 1 : 0], ['frieze', A >= 2 ? 1 : 0], ['playkitchen', A >= 2 ? 1 : 0],
    [A >= 3 ? 'carpet' : A >= 2 ? 'rug' : 'rugS', 1], ['teacherdesk', 1], ['flipchart', 1], ['roundTable', A >= 2 ? Math.round(A * 1.6) : 1], ['blocks', 1], ['teddy', 1], ['tent', A >= 2 ? 1 : 0], ['sofa2', A >= 2 ? 1 : 0], ['playmat', A >= 2 ? 1 : 0], ['artwall', A >= 3 ? 1 : 0], ['kidney', A >= 2 ? 1 : 0], ['mountain', A >= 4 ? 1 : 0], ['sandtray', A >= 2 ? 1 : 0], ['naturetable', A >= 3 ? 1 : 0], ['globe', A >= 3 ? 1 : 0], ['beanbag', A + 1], ['roundTable', A >= 2 ? 0 : 1]],      // (no plants: Phil asked)
  ringhouse: A => PLANS.classroom(A),
  treehouse: A => [['rug', 1], ['beanbag', 2]],
  hall: A => [['climbwall', 1], ['wallbars', 3], ['banners', 1], ['clock', 1], ['piano', 1], ['court', 1], ['stage', 1], ['parachute', 1], ['climbframe', 1], ['goal', 2], ['softplay', 1], ['trampoline', 1], ['gymmat', Math.max(3, Math.round(A * 0.7))], ['vault', 1], ['balancebeam', 1], ['balls', 2], ['hoops', 1], ['bench', 3], ['hoop', 2], ['cones', 2], ['beanbag', 2]],
  library: A => [['readingnook', 1], ['books', 1 + A], ['alphabet', 1], ['bookdisplay', 1], ['clock', 1], ['poster', A >= 2 ? 1 : 0], [A >= 2 ? 'rug' : 'rugS', 1], ['storychair', 1], ['librarydesk', 1], ['shelf', Math.max(1, A - 1)], ['tree', A >= 2 ? 1 : 0], ['cave', 1], ['puppettheatre', A >= 2 ? 1 : 0], ['bookcart', 1], ['lamp', 1], ['globe', 1], ['sofa2', A >= 2 ? 1 : 0], ['beanbag', A * 2]],
  lunch: A => [['servery', 1], ['menuboard', 1], ['trayrack', 1], ['sink', 1], ['clock', 1], ['art', 1], ['longtable', Math.max(1, Math.floor(A / 2))], ['lunchTable', Math.max(2, A + 1)], ['saladbar', A >= 2 ? 1 : 0], ['fruitstand', 1], ['water', 1], ['bins', 1]],
  art: A => [['rack', 1], ['painttrolley', 1], ['colourwheel', 1], ['coatpegs', 1], ['paintshelf', A >= 2 ? 1 : 0], ['sink', A >= 2 ? 1 : 0], ['art', 1 + A], ['painttable', Math.max(1, A)], ['easel', 2], ['potterywheel', 1], ['kiln', 1], ['artwall', 1], ['claytable', A >= 2 ? 1 : 0], ['sculpture', A >= 2 ? 1 : 0], ['easel', Math.max(0, A - 1)]],
  maker: A => [['pegboard', 1 + Math.floor(A / 2)], ['partsbins', 1], ['screen', 1], ['cubbies', 1], ['clock', 1], ['printers', 1], ['robot', 1], ['legotable', 1], ['lasercutter', A >= 2 ? 1 : 0], ['workbench', A >= 2 ? 1 : 0], ['rover', A >= 2 ? 1 : 0], ['solder', A >= 2 ? 1 : 0], ['cardrocket', 1], ['cardboardcastle', A >= 2 ? 1 : 0], ['kidney', A >= 3 ? 1 : 0]],
  music: A => [['guitars', 1], ['notesfrieze', 1], ['recorders', 1], ['piano', 1], ['speaker', A >= 2 ? 1 : 0], ['art', 1], ['clock', 1], ['drums', 1], ['xylophone', 1], ['musicstands', 1], ['shakers', 1], ['doublebass', 1], ['conductor', A >= 2 ? 1 : 0], ['stage', A >= 2 ? 1 : 0], ['mic', A >= 2 ? 1 : 0], ['beanbag', A + 1]],
  yoga: A => [['feelings', 1], ['calmtank', 1], ['poster', 1], ['clock', A >= 2 ? 1 : 0], ['eggchair', 1], ['bubbletube', 1], ['hammock', 1], [A >= 2 ? 'rug' : 'rugS', 1], ['nest', 1], ['lavalamp', 1], ['fountain', A >= 2 ? 1 : 0], ['cushions', A >= 2 ? 1 : 0], ['tent', A >= 2 ? 1 : 0], ['yogamat', 1 + A], ['sofa2', A >= 3 ? 1 : 0]],
  aquarium: A => [['touchpool', A >= 2 ? 1 : 0], ['tank', A >= 2 ? Math.min(3, A - 1) : 1], ['jelly', A >= 3 ? 1 : 0], ['naturetable', A >= 2 ? 1 : 0], ['bench', A >= 3 ? 1 : 0], ['beanbag', Math.max(1, A - 1)]],
  archway: A => [],
  observatory: A => [['poster', 1 + A], ['controldesk', 1], ['telescope', 1], ['orrery', 1], ['planet', 1 + A], ['moonglobe', 1], ['rocketmodel', 1], ['meteorite', 1], ['spacesuit', 1], ['beanbag', A * 2 + 1]],
  pool: A => [['lounger', 2 + Math.floor(A / 3)], ['lifeguard', 1], ['kickboards', 1]],
};
