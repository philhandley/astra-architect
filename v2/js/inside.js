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
    const one = Math.min(b.w, b.d) < 2;
    const R = one ? 0.47 : Math.min(b.w, b.d) - GAP - 0.45, t = one ? 0.9 : 0.85, cx = -b.w / 2 + GAP, cz = -b.d / 2 + GAP, R0 = Math.max(0, R - t / 2), R1 = R + t / 2;
    const rot = b.w === b.d ? (b.rot || 0) : 0, ph = rot * Math.PI / 2, co = Math.cos(ph), si = Math.sin(ph);
    const un = (x, z) => [x * co + z * si, -x * si + z * co];      // back to the unturned frame
    return { kind: 'arc', cx, cz, R0, R1, rot, inside: (x, z, m) => { const [u, v] = un(x, z); const dd = Math.hypot(u - cx, v - cz); return dd > R0 + m && dd < R1 - m && u > cx + m && v > cz + m; } };
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

// The outline as closed lines of points (piece-local x, z), turned for curved pieces that face another corner.
function loopsOf(o) {
  const xz = s => { const pts = s.getPoints(8).map(p => [p.x, -p.y]); if (pts.length > 2 && Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]) < 1e-4) pts.pop(); return pts; };
  if (o.kind === 'rr') return [{ pts: xz(roundedRect(o.W, o.D, o.r)), outer: true }];
  if (o.kind === 'ring') return [{ pts: xz(roundedRect(o.W, o.D, o.r)), outer: true }, { pts: xz(roundedRect(o.Wi, o.Di, o.ri)), outer: false }];
  const pts = [], n = 16;
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; pts.push([o.cx + Math.cos(a) * o.R1, o.cz + Math.sin(a) * o.R1]); }
  for (let i = n; i >= 0; i--) { const a = (i / n) * Math.PI / 2; pts.push([o.cx + Math.cos(a) * Math.max(0.01, o.R0), o.cz + Math.sin(a) * Math.max(0.01, o.R0)]); }
  const ph = (o.rot || 0) * Math.PI / 2, co = Math.cos(ph), si = Math.sin(ph);
  return [{ pts: pts.map(([x, z]) => [x * co - z * si, x * si + z * co]), outer: true }];
}
function inPoly(pts, x, z) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }
function walkWalls(o, b, hex, floorY, top) {
  const T = 0.04, SILL = 0.11, HEAD = 0.36, DOOR = 0.3;
  const solid = [], glassG = [], segments = [], bays = [];
  for (const loop of loopsOf(o)) {
    const P = loop.pts;
    for (let i = 0; i < P.length; i++) {
      const [ax, az] = P[i], [bx, bz] = P[(i + 1) % P.length], len = Math.hypot(bx - ax, bz - az);
      if (len < 0.01) continue;
      const dx = (bx - ax) / len, dz = (bz - az) / len;
      // Which side is the room? (Into the shape for the outside wall, out of the hole for a courtyard wall.)
      let nx = -dz, nz = dx; const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const into = inPoly(P, mx + nx * 0.02, mz + nz * 0.02);
      if (into !== loop.outer) { nx = -nx; nz = -nz; }
      const k = Math.max(1, Math.round(len / 0.3)), bl = len / k;
      for (let j = 0; j < k; j++) bays.push({ x: ax + dx * bl * (j + 0.5) + nx * T / 2, z: az + dz * bl * (j + 0.5) + nz * T / 2, dx, dz, len: bl, outer: loop.outer });
    }
  }
  // The doorway: the widest bay on the front of the outside wall.
  let door = null;
  for (const by of bays) if (by.outer && by.len >= 0.14 && (!door || by.z > door.z + 0.01)) door = by;
  let w = 0;
  for (const by of bays) {
    const a = Math.atan2(by.dx, by.dz), put = (list, y0, y1, th = T) => list.push(new THREE.BoxGeometry(th, y1 - y0, by.len + 0.004).rotateY(a).translate(by.x, floorY + (y0 + y1) / 2, by.z));
    const seg = [by.x - by.dx * by.len / 2, by.z - by.dz * by.len / 2, by.x + by.dx * by.len / 2, by.z + by.dz * by.len / 2];
    if (by === door) { put(solid, DOOR, top); continue; }
    segments.push(seg);
    if (by.len >= 0.14 && (w++ % 2 === 0)) { put(solid, 0, SILL); put(solid, HEAD, top); put(glassG, SILL, HEAD, 0.006); }
    else put(solid, 0, top);
  }
  const g = new THREE.Group();
  const merge = list => mergeGeometries(list.map(x => { x.deleteAttribute('uv'); return x; }));
  if (solid.length) { const m = new THREE.Mesh(merge(solid), mat(hex, { emissive: hex, emissiveIntensity: 0.28 })); m.castShadow = true; m.receiveShadow = true; g.add(m); }
  if (glassG.length) g.add(new THREE.Mesh(merge(glassG), mat('#cfeaf5', { transparent: true, opacity: 0.28, depthWrite: false })));
  return { group: g, segments };
}

// ---------- playful furniture ----------
function seededRnd(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const FUN = ['#f7c22e', '#e2457d', '#22b2bf', '#a3d140', '#f28b30', '#7c46a8', '#f5a3c7', '#3d8de0'];
const pickC = rnd => FUN[Math.floor(rnd() * FUN.length)];
const TABLE = '#fbfaf6';
function bean(len, wid) {
  // A bean (kidney) shape: a curved fat capsule.
  const s = new THREE.Shape(), R = len, a0 = -0.55, a1 = 0.55, n = 14, pts = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([Math.sin(a) * R, -Math.cos(a) * R + R]); }
  const outer = pts.map(([x, y]) => [x * (1 + wid / R), y - wid * 0.2]), inner = pts.map(([x, y]) => [x * (1 - wid / R), y + wid]).reverse();
  [...outer, ...inner].forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}
// Each piece: r = how much floor it needs; make() draws it and returns where children sit.
const FEATURES = {
  roundTable: { r: 0.13, make(bag, x, z, c, rnd) {
    bag.cyl(TABLE, 0.075, 0.012, x, 0.075, z); bag.cyl('#d8d4cc', 0.012, 0.07, x, 0.035, z, 0.012, 8);
    const n = 4 + Math.floor(rnd() * 2), seats = [], off = rnd() * 6;
    for (let i = 0; i < n; i++) { const a = off + (i / n) * Math.PI * 2, sx = x + Math.cos(a) * 0.115, sz = z + Math.sin(a) * 0.115; bag.cyl(pickC(rnd), 0.022, 0.045, sx, 0.0225, sz); seats.push([sx, sz]); }
    return seats; } },
  kidney: { r: 0.16, make(bag, x, z, c, rnd) {
    const rot = rnd() * Math.PI * 2;
    bag.plan(TABLE, bean(0.13, 0.05), 0.012, x, 0.075, z, rot);
    const seats = [];
    for (let i = 0; i < 4; i++) { const a = rot + Math.PI + (i - 1.5) * 0.5, sx = x + Math.sin(a) * 0.07, sz = z + Math.cos(a) * 0.07; bag.cyl(pickC(rnd), 0.022, 0.045, sx, 0.0225, sz); seats.push([sx, sz]); }
    return seats; } },
  rug: { r: 0.17, make(bag, x, z, c, rnd) {
    const col = pickC(rnd);
    bag.cyl(col, 0.15, 0.006, x, 0.003, z, 0.15, 32); bag.cyl('#ffffff', 0.1, 0.007, x, 0.0035, z, 0.1, 32); bag.cyl(col, 0.05, 0.008, x, 0.004, z, 0.05, 24);
    const seats = [];
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, sx = x + Math.cos(a) * 0.11, sz = z + Math.sin(a) * 0.11; bag.ball(pickC(rnd), 0.022, sx, 0.006, sz); seats.push([sx, sz]); }
    return seats; } },
  mountain: { r: 0.2, make(bag, x, z, c, rnd) {
    // Stepped seats, like a little mountain to climb and sit on (after Rosan Bosch's school "mountains").
    const seats = [], col = pickC(rnd);
    for (let k = 0; k < 3; k++) { const rr = 0.19 - k * 0.055, hh = 0.035 * (k + 1); bag.cyl(k % 2 ? '#fbfaf6' : col, rr, hh, x, hh / 2, z, rr, 28); for (let i = 0; i < 4 - k; i++) { const a = rnd() * 6.28; seats.push([x + Math.cos(a) * (rr - 0.03), z + Math.sin(a) * (rr - 0.03), hh]); } }
    return seats.map(([sx, sz]) => [sx, sz]); } },
  cave: { r: 0.12, make(bag, x, z, c, rnd) {
    // A cosy reading cave: half a dome with a cushion inside.
    const col = pickC(rnd), rot = rnd() * 6.28;
    bag.add(col, new THREE.SphereGeometry(0.11, 16, 10, rot, Math.PI * 1.35, 0, Math.PI / 2).translate(x, 0, z));
    bag.ball('#ffffff', 0.04, x, 0, z);
    return [[x, z]]; } },
  beanbag: { r: 0.06, make(bag, x, z, c, rnd) { bag.ball(pickC(rnd), 0.05, x, 0, z); return [[x, z]]; } },
  plant: { r: 0.05, make(bag, x, z, c, rnd) { bag.cyl('#fbfaf6', 0.028, 0.05, x, 0.025, z, 0.022, 12); bag.add(['#5f9a4c', '#7db45a', '#8fc263'][Math.floor(rnd() * 3)], new THREE.SphereGeometry(0.05, 10, 8).translate(x, 0.1, z)); return []; } },
  sofa: { r: 0.2, make(bag, x, z, c, rnd) {
    // A wavy sofa that snakes across the room.
    const rot = rnd() * 6.28, col = pickC(rnd), pts = [], seats = [];
    for (let i = 0; i <= 10; i++) { const u = (i / 10 - 0.5) * 0.36, v = Math.sin(i / 10 * Math.PI * 2) * 0.05; pts.push(new THREE.Vector3(x + Math.cos(rot) * u - Math.sin(rot) * v, 0.035, z + Math.sin(rot) * u + Math.cos(rot) * v)); }
    bag.tube(col, pts, 0.035);
    for (let i = 1; i < 10; i += 3) seats.push([pts[i].x, pts[i].z]);
    return seats; } },
  tree: { r: 0.16, make(bag, x, z, c, rnd) {
    // An indoor tree with a round bench.
    bag.cyl('#9b7b5c', 0.02, 0.22, x, 0.11, z, 0.026, 8); bag.add('#7db45a', new THREE.SphereGeometry(0.1, 14, 10).translate(x, 0.27, z));
    bag.add(pickC(rnd), new THREE.TorusGeometry(0.1, 0.022, 8, 28).rotateX(Math.PI / 2).translate(x, 0.035, z));
    const seats = []; for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.28; seats.push([x + Math.cos(a) * 0.1, z + Math.sin(a) * 0.1]); }
    return seats; } },
  shelf: { r: 0.15, make(bag, x, z, c, rnd) {
    // A curved bookshelf.
    const s = new THREE.Shape(), R = 0.14, a0 = rnd() * 6.28;
    s.absarc(0, 0, R, a0, a0 + 2.2, false); s.absarc(0, 0, R - 0.035, a0 + 2.2, a0, true);
    bag.plan('#fbfaf6', s, 0.17, x, 0, z);
    for (let k = 0; k < 3; k++) { const b2 = new THREE.Shape(); b2.absarc(0, 0, R - 0.002, a0 + 0.1, a0 + 2.1, false); b2.absarc(0, 0, R - 0.03, a0 + 2.1, a0 + 0.1, true); bag.plan(pickC(rnd), b2, 0.025, x, 0.02 + k * 0.055, z); }
    return []; } },
  mats: { r: 0.1, make(bag, x, z, c, rnd) { bag.cyl(pickC(rnd), 0.09, 0.012, x, 0.006, z, 0.09, 24); return []; } },
  hoop: { r: 0.08, make(bag, x, z) { bag.cyl('#fbfaf6', 0.008, 0.36, x, 0.18, z, 0.008, 6); bag.box('#ffffff', 0.12, 0.08, 0.008, x, 0.36, z); bag.add('#f28b30', new THREE.TorusGeometry(0.035, 0.005, 6, 16).rotateX(Math.PI / 2).translate(x, 0.33, z + 0.04)); return []; } },
  trampoline: { r: 0.16, make(bag, x, z, c, rnd) { bag.cyl('#3d8de0', 0.15, 0.03, x, 0.03, z, 0.15, 28); bag.cyl('#26272d', 0.13, 0.032, x, 0.032, z, 0.13, 28); return []; } },
  easel: { r: 0.07, make(bag, x, z, c, rnd) { bag.box('#d8b98c', 0.012, 0.2, 0.012, x - 0.03, 0.1, z); bag.box('#d8b98c', 0.012, 0.2, 0.012, x + 0.03, 0.1, z); bag.box('#ffffff', 0.1, 0.09, 0.008, x, 0.16, z + 0.006); bag.box(pickC(rnd), 0.06, 0.05, 0.009, x, 0.16, z + 0.008); return [[x, z + 0.08]]; } },
  stage: { r: 0.2, make(bag, x, z, c, rnd) {
    bag.cyl('#d8b98c', 0.15, 0.04, x, 0.02, z, 0.15, 28);
    bag.box('#26272d', 0.13, 0.06, 0.06, x - 0.04, 0.07, z - 0.04); bag.box('#ffffff', 0.12, 0.008, 0.02, x - 0.04, 0.1, z - 0.015);
    bag.cyl('#e6463c', 0.035, 0.04, x + 0.06, 0.06, z + 0.02); bag.cyl('#fbfaf6', 0.025, 0.05, x + 0.07, 0.065, z - 0.05);
    const seats = []; for (let i = 0; i < 6; i++) { const a = Math.PI * (0.15 + i * 0.14), sx = x + Math.cos(a) * 0.2, sz = z + Math.sin(a) * 0.2; seats.push([sx, sz]); }
    return seats; } },
  yogamat: { r: 0.07, make(bag, x, z, c, rnd) { const rot = rnd() * 6.28; bag.add(pickC(rnd), new THREE.BoxGeometry(0.06, 0.008, 0.15).rotateY(rot).translate(x, 0.004, z)); return [[x, z]]; } },
  counter: { r: 0.16, make(bag, x, z, c, rnd) { const s = new THREE.Shape(); s.absarc(0, 0, 0.14, 0, Math.PI, false); s.absarc(0, 0, 0.09, Math.PI, 0, true); bag.plan('#fbfaf6', s, 0.09, x, 0, z, rnd() * 6.28); return []; } },
  fish: { r: 0.08, make(bag, x, z, c, rnd) { for (let k = 0; k < 3; k++) bag.ball(['#f28b30', '#f7c22e', '#e2457d', '#ffffff'][k % 4], 0.025, x + (rnd() - 0.5) * 0.1, 0.12 + k * 0.08, z + (rnd() - 0.5) * 0.1); return []; } },
};
// What goes in each kind of room (piece, how many), by floor area in blocks.
const PLANS = {
  classroom: A => [['rug', 1], ['roundTable', Math.max(2, Math.round(A * 1.6))], ['kidney', A >= 2 ? 1 : 0], ['mountain', A >= 2 ? 1 : 0], ['cave', A >= 3 ? 1 : 0], ['beanbag', A + 1], ['plant', A + 1]],
  ringhouse: A => PLANS.classroom(A),
  treehouse: A => [['rug', 1], ['beanbag', 2]],
  hall: A => [['trampoline', Math.max(1, Math.round(A / 3))], ['mats', A * 2], ['hoop', 1], ['sofa', A >= 4 ? 1 : 0], ['beanbag', A]],
  library: A => [['shelf', Math.max(1, A)], ['tree', A >= 2 ? 1 : 0], ['cave', 1], ['beanbag', A * 2 + 1], ['rug', 1], ['plant', A]],
  lunch: A => [['roundTable', Math.max(2, A * 2)], ['counter', 1], ['plant', A]],
  art: A => [['kidney', Math.max(1, A)], ['easel', A + 1], ['rug', 1], ['plant', 1]],
  maker: A => [['kidney', Math.max(1, A)], ['roundTable', A], ['plant', 1]],
  music: A => [['stage', 1], ['beanbag', A + 2], ['plant', 1]],
  yoga: A => [['rug', 1], ['yogamat', 3 + A * 2], ['plant', 2]],
  aquarium: A => [['fish', A * 3], ['beanbag', A]],
  archway: A => [],
  observatory: A => [['rug', 1]],
};

// (old furniture units, kept for reference by nothing)
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
  cyl(col, r, h, x, y, z, r2 = r, seg = 18) { this.add(col, new THREE.CylinderGeometry(r, r2, h, seg).translate(x, y, z)); }
  // A flat shape (in plan) pushed up from y0 to y0 + h.
  plan(col, shape, h, x, y0, z, rotY = 0) { this.add(col, new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 20 }).rotateX(-Math.PI / 2).rotateY(rotY).translate(x, y0, z)); }
  tube(col, pts, r) { this.add(col, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, r, 8, false)); }
  meshes() {
    const out = [];
    for (const [col, list] of this.geos) { const g = mergeGeometries(list.map(x => { const y = x.index ? x.toNonIndexed() : x; y.deleteAttribute('uv'); if (!y.attributes.normal) y.computeVertexNormals(); return y; })); const m = new THREE.Mesh(g, mat(col)); m.castShadow = true; m.receiveShadow = true; out.push(m); }
    return out;
  }
}

// Build the cut room. Coordinates are local to the piece (centred, y = 0 at the piece's base).
// floorY: where this storey's floor is, inside the piece. Returns { group, seats, walk, inside }.
export function cutRoom(b, hex, floorY, cutH = CUT, opts = {}) {
  const o = outline(b), g = new THREE.Group(), sh = shapesOf(o);
  // Everything below this floor stays solid; the floor and cut walls sit on top.
  if (floorY > 0.001) { const base = new THREE.Mesh(slab(sh.floor, floorY), mat(hex)); base.castShadow = base.receiveShadow = true; if (o.rot) base.rotation.y = -o.rot * Math.PI / 2; g.add(base); }
  const shell = new THREE.Group(); if (o.rot) shell.rotation.y = -o.rot * Math.PI / 2; g.add(shell);
  const floor = new THREE.Mesh(slab(sh.floor, 0.02), mat(lighten(hex, 0.8)));
  floor.position.y = floorY; floor.receiveShadow = true; shell.add(floor);
  let segments = [];
  if (opts.walk) {
    // Walls right up to the ceiling, with real window openings and one doorway, and a ceiling over the room.
    const w = walkWalls(o, b, hex, floorY, opts.top);
    g.add(w.group); segments = w.segments;
    const ceil = new THREE.Mesh(slab(sh.floor, 0.02), mat('#fbfaf6', { emissive: '#f3ede2', emissiveIntensity: 0.75 }));
    ceil.position.y = floorY + opts.top - 0.02; shell.add(ceil);       // no shadow from the ceiling, so the room stays sunny
    const above = opts.boxH - (floorY + opts.top);
    if (above > 0.02) { const top = new THREE.Mesh(slab(sh.floor, above), mat(hex)); top.position.y = floorY + opts.top; shell.add(top); }
  } else {
    const walls = new THREE.Mesh(slab(sh.walls, cutH), [mat('#ffffff'), mat(hex)]);
    walls.position.y = floorY; walls.castShadow = walls.receiveShadow = true; shell.add(walls);
  }
  // Furniture: playful pieces placed loosely round the room (not in rows), so it feels like a happy place.
  const bag = new Bag(), seats = [];
  const area = Math.max(1, Math.round(b.w * b.d * (o.kind === 'ring' ? 0.6 : o.kind === 'arc' ? 0.5 : 1)));
  const plan = (PLANS[b.type] || PLANS.classroom)(area);
  const placed = [], rnd = seededRnd(b.id * 97 + (b.x + 1) * 13 + (b.z + 1) * 7);
  for (const [kind, count] of plan) {
    const F = FEATURES[kind];
    for (let n = 0; n < count; n++) {
      for (let tries = 0; tries < 60; tries++) {
        const x = (rnd() - 0.5) * (b.w - 0.1), z = (rnd() - 0.5) * (b.d - 0.1);
        if (!o.inside(x, z, WALL + F.r + 0.02)) continue;
        if (placed.some(p => Math.hypot(p.x - x, p.z - z) < p.r + F.r + 0.03)) continue;
        placed.push({ x, z, r: F.r });
        for (const s of F.make(bag, x, z, hex, rnd)) seats.push(s);
        break;
      }
    }
  }
  if ((b.type === 'classroom') && o.kind === 'rr') bag.box('#2f3a33', Math.min(0.5, o.W * 0.5), 0.12, 0.012, 0, 0.18, -o.D / 2 + WALL + 0.01);
  for (const mm of bag.meshes()) { mm.position.y = floorY + 0.02; g.add(mm); }
  return { group: g, seats: seats.map(([x, z]) => [x, floorY + 0.02, z]), inside: o.inside, floorY: floorY + 0.02, segments };
}

export { CUT, SINGLE as SINGLE_SPACE };
export const storeyFloor = (b, L) => (SINGLE.has(b.type) ? 0 : Math.max(0, L - b.level) * LEVEL);
