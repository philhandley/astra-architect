// The inside view: a room cut through at one floor, like an architect's cutaway. Light floor, walls cut at
// half height (white on the cut), and furniture for what the room is for. Returns where people sit and walk.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LEVEL } from './catalogue.js';
import { mat, shade } from './shapes.js';

const GAP = 0.035, WALL = 0.05, CUT = 0.27;
export const CUTTABLE = new Set(['box', 'house', 'saw', 'vault', 'drum', 'tower', 'ring', 'ringhouse', 'arc', 'arch']);
// Rooms that are one tall space (the floor stays at the bottom); others are stacked storeys.
export const SINGLE = new Set(['hall', 'aquarium', 'pool']);

const lighten = (hex, f) => '#' + new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), f).getHexString();

function roundedRect(W, D, r) {
  const s = new THREE.Shape(), x = -W / 2, y = -D / 2;
  r = Math.max(0.001, Math.min(r, W / 2, D / 2));
  s.moveTo(x + r, y); s.lineTo(x + W - r, y); s.absarc(x + W - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + W, y + D - r); s.absarc(x + W - r, y + D - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + D); s.absarc(x + r, y + D - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
// Signed "inside" test for a rounded rectangle (local x, z), shrunk by m.
function inRR(x, z, W, D, r, m = 0) {
  const hw = W / 2 - m, hd = D / 2 - m, rr = Math.max(0, r - m);
  if (hw <= 0 || hd <= 0) return false;
  const qx = Math.abs(x) - (hw - rr), qz = Math.abs(z) - (hd - rr);
  if (qx <= 0 || qz <= 0) return Math.abs(x) <= hw && Math.abs(z) <= hd;
  return Math.hypot(qx, qz) <= rr;
}

// The plan outline of a room shape, with an "inside" test for furniture and people.
export function outline(b) {
  const W = b.w - 2 * GAP - 0.03, D = b.d - 2 * GAP - 0.03, s = b.shape;
  if (['drum', 'tower'].includes(s)) { const r = Math.min(W, D) / 2; return { kind: 'rr', W, D, r, inside: (x, z, m) => inRR(x, z, W, D, r, m) }; }
  if ((s === 'ring' || s === 'ringhouse') && b.w >= 2 && b.d >= 2) {
    const t = s === 'ring' ? (b.w >= 3 && b.d >= 3 ? 0.95 : Math.min(W, D) * 0.3) : (b.w >= 3 && b.d >= 3 ? 0.9 : 0.6);
    const r = Math.min(W, D) / 2, Wi = W - 2 * t, Di = D - 2 * t, ri = Math.max(0.05, r - t);
    return { kind: 'ring', W, D, r, Wi, Di, ri, inside: (x, z, m) => inRR(x, z, W, D, r, m) && !inRR(x, z, Wi, Di, ri, -m) };
  }
  if (s === 'arc') {
    const R = Math.min(b.w, b.d) - GAP - 0.45, t = 0.85, cx = -b.w / 2 + GAP, cz = -b.d / 2 + GAP, R0 = R - t / 2, R1 = R + t / 2;
    return { kind: 'arc', cx, cz, R0, R1, inside: (x, z, m) => { const dd = Math.hypot(x - cx, z - cz); return dd > R0 + m && dd < R1 - m && x > cx + m && z > cz + m; } };
  }
  return { kind: 'rr', W, D, r: 0.04, inside: (x, z, m) => inRR(x, z, W, D, 0.04, m) };
}

function shapesOf(o) {
  if (o.kind === 'rr') { const f = roundedRect(o.W, o.D, o.r); const w = roundedRect(o.W, o.D, o.r); w.holes.push(roundedRect(o.W - 2 * WALL, o.D - 2 * WALL, o.r - WALL)); return { floor: [f], walls: [w] }; }
  if (o.kind === 'ring') {
    const f = roundedRect(o.W, o.D, o.r); f.holes.push(roundedRect(o.Wi, o.Di, o.ri));
    const w1 = roundedRect(o.W, o.D, o.r); w1.holes.push(roundedRect(o.W - 2 * WALL, o.D - 2 * WALL, o.r - WALL));
    const w2 = roundedRect(o.Wi + 2 * WALL, o.Di + 2 * WALL, o.ri + WALL); w2.holes.push(roundedRect(o.Wi, o.Di, o.ri));
    return { floor: [f], walls: [w1, w2] };
  }
  // A quarter band, drawn as a polygon.
  const band = (a, b2) => { const s = new THREE.Shape(), n = 24; for (let i = 0; i <= n; i++) { const t = (i / n) * Math.PI / 2; const p = [o.cx + Math.cos(t) * b2, -(o.cz + Math.sin(t) * b2)]; i ? s.lineTo(...p) : s.moveTo(...p); } for (let i = n; i >= 0; i--) { const t = (i / n) * Math.PI / 2; s.lineTo(o.cx + Math.cos(t) * a, -(o.cz + Math.sin(t) * a)); } return s; };
  const ends = [];
  for (const t of [0, Math.PI / 2]) {
    const s = new THREE.Shape(), c = Math.cos(t), sn = Math.sin(t), nx = -sn, nz = c, k = t ? -1 : 1;
    const p = (r, o2) => [o.cx + c * r + nx * o2 * k, -(o.cz + sn * r + nz * o2 * k)];
    s.moveTo(...p(o.R0, 0)); s.lineTo(...p(o.R1, 0)); s.lineTo(...p(o.R1, WALL)); s.lineTo(...p(o.R0, WALL));
    ends.push(s);
  }
  return { floor: [band(o.R0, o.R1)], walls: [band(o.R1 - WALL, o.R1), band(o.R0, o.R0 + WALL), ...ends] };
}
function slab(shapes, h) {
  const g = new THREE.ExtrudeGeometry(shapes, { depth: h, bevelEnabled: false, curveSegments: 24 });
  g.rotateX(-Math.PI / 2);
  return g;
}

// Furniture, one "unit" per spot, merged into a few meshes. Seats are where children sit.
const UNITS = {
  classroom: (bag, x, z, c) => { bag.box('#fbfaf6', 0.15, 0.085, 0.09, x, 0.043, z - 0.03); bag.box(shade(c, 0.7), 0.07, 0.05, 0.06, x, 0.025, z + 0.06); return [[x, z + 0.07]]; },
  lunch: (bag, x, z, c) => { bag.box('#fbfaf6', 0.2, 0.08, 0.09, x, 0.04, z); bag.box(shade(c, 0.7), 0.2, 0.04, 0.04, x, 0.02, z - 0.08); bag.box(shade(c, 0.7), 0.2, 0.04, 0.04, x, 0.02, z + 0.08); return [[x - 0.05, z - 0.08], [x + 0.05, z + 0.08]]; },
  library: (bag, x, z, c, i) => { if (i % 2) { bag.box(lighten(c, 0.2), 0.24, 0.28, 0.07, x, 0.14, z); for (let k = 0; k < 3; k++) bag.box(['#e2457d', '#f7c22e', '#3d8de0'][k], 0.2, 0.05, 0.075, x, 0.05 + k * 0.09, z); return []; } bag.ball(['#f28b30', '#a3d140', '#f5a3c7'][i % 3], 0.075, x, 0.04, z); return [[x, z]]; },
  art: (bag, x, z, c, i) => { bag.box('#fbfaf6', 0.22, 0.09, 0.18, x, 0.045, z); if (i % 2) { bag.box('#d8b98c', 0.012, 0.22, 0.012, x + 0.13, 0.11, z); bag.box('#ffffff', 0.12, 0.1, 0.01, x + 0.13, 0.16, z - 0.01); } return [[x - 0.07, z + 0.12], [x + 0.07, z + 0.12]]; },
  music: (bag, x, z, c, i) => { if (i % 3 === 0) { bag.box('#26272d', 0.24, 0.12, 0.1, x, 0.06, z); bag.box('#ffffff', 0.22, 0.012, 0.03, x, 0.125, z + 0.035); return [[x, z + 0.11]]; } if (i % 3 === 1) { bag.cyl('#e6463c', 0.06, 0.06, x - 0.05, 0.03, z); bag.cyl('#fbfaf6', 0.045, 0.08, x + 0.06, 0.04, z); return [[x, z + 0.1]]; } bag.box(shade(c, 0.7), 0.08, 0.06, 0.08, x, 0.03, z); return [[x, z]]; },
  hall: (bag, x, z, c, i) => { if (i % 3 === 0) bag.box('#3d8de0', 0.26, 0.02, 0.18, x, 0.01, z); return []; },
  yoga: (bag, x, z, c, i) => { bag.box(['#a3d140', '#8fdac3', '#f5a3c7', '#f7c22e'][i % 4], 0.09, 0.012, 0.22, x, 0.006, z); return [[x, z]]; },
  aquarium: (bag, x, z) => { for (let k = 0; k < 2; k++) bag.ball(['#f28b30', '#f7c22e', '#e2457d', '#ffffff'][(k + Math.round(x * 7)) & 3], 0.03, x + (k - 0.5) * 0.12, 0.16 + k * 0.12, z); return []; },
};
UNITS.ringhouse = UNITS.classroom;
UNITS.archway = UNITS.hall;

class Bag {
  constructor() { this.geos = new Map(); }
  add(col, g) { if (!this.geos.has(col)) this.geos.set(col, []); this.geos.get(col).push(g); }
  box(col, w, h, d, x, y, z) { this.add(col, new THREE.BoxGeometry(w, h, d).translate(x, y, z)); }
  ball(col, r, x, y, z) { this.add(col, new THREE.SphereGeometry(r, 10, 7).scale(1, 0.7, 1).translate(x, y + r * 0.7, z)); }
  cyl(col, r, h, x, y, z) { this.add(col, new THREE.CylinderGeometry(r, r, h, 14).translate(x, y, z)); }
  meshes() {
    const out = [];
    for (const [col, list] of this.geos) { const g = mergeGeometries(list.map(x => { x.deleteAttribute('uv'); return x; })); const m = new THREE.Mesh(g, mat(col)); m.castShadow = true; m.receiveShadow = true; out.push(m); }
    return out;
  }
}

// Build the cut room. Coordinates are local to the piece (centred, y = 0 at the piece's base).
// floorY: where this storey's floor is, inside the piece. Returns { group, seats, walk, inside }.
export function cutRoom(b, hex, floorY) {
  const o = outline(b), g = new THREE.Group(), sh = shapesOf(o);
  // Everything below this floor stays solid; the floor and cut walls sit on top.
  if (floorY > 0.001) { const base = new THREE.Mesh(slab(sh.floor, floorY), mat(hex)); base.castShadow = base.receiveShadow = true; g.add(base); }
  const floor = new THREE.Mesh(slab(sh.floor, 0.02), mat(lighten(hex, 0.8)));
  floor.position.y = floorY; floor.receiveShadow = true; g.add(floor);
  const walls = new THREE.Mesh(slab(sh.walls, CUT), [mat('#ffffff'), mat(hex)]);
  walls.position.y = floorY; walls.castShadow = walls.receiveShadow = true; g.add(walls);
  // Furniture on a grid of spots inside the walls.
  const unit = UNITS[b.type] || UNITS.classroom, bag = new Bag(), seats = [];
  const step = ['classroom', 'ringhouse', 'lunch', 'art', 'yoga'].includes(b.type) ? 0.22 : 0.3, m = WALL + 0.06;
  let i = 0;
  for (let z = -b.d / 2 + step / 2; z < b.d / 2; z += step) for (let x = -b.w / 2 + step / 2; x < b.w / 2; x += step) {
    if (!o.inside(x, z, m)) continue;
    // Keep a strip clear at the front of classrooms for the teacher and the board.
    if ((b.type === 'classroom' || b.type === 'ringhouse') && o.kind === 'rr' && z < -b.d / 2 + 0.26) continue;
    for (const s of unit(bag, x, z, hex, i++)) seats.push(s);
  }
  if ((b.type === 'classroom') && o.kind === 'rr') bag.box('#2f3a33', Math.min(0.6, o.W * 0.6), 0.13, 0.012, 0, 0.17, -o.D / 2 + WALL + 0.01);
  for (const mm of bag.meshes()) { mm.position.y = floorY + 0.02; g.add(mm); }
  return { group: g, seats: seats.map(([x, z]) => [x, floorY + 0.02, z]), inside: o.inside, floorY: floorY + 0.02 };
}

export { CUT, SINGLE as SINGLE_SPACE };
export const storeyFloor = (b, L) => (SINGLE.has(b.type) ? 0 : Math.max(0, L - b.level) * LEVEL);
