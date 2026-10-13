// The inside view: a room cut through at one floor, like an architect's cutaway. Light floor, walls cut at
// child height (white on the cut) with the same windows and doors as outside, and furniture for what the
// room is for. Returns where people sit and walk.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LEVEL } from './catalogue.js';
import { mat, colonnade, courtyard, INK } from './shapes.js';
import { outline, roundedRect, wallRuns, openings, eachPiece, runAt, TALL, WALL_T } from './plan.js';
export { outline } from './plan.js';

const WALL = 0.05, CUT = 0.27;
export const CUTTABLE = new Set(['box', 'house', 'saw', 'vault', 'drum', 'tower', 'ring', 'ringhouse', 'arc', 'arch', 'observatory']);
// Rooms that are one tall space (the floor stays at the bottom); others are stacked storeys.
export const SINGLE = TALL;

const lighten = (hex, f) => '#' + new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), f).getHexString();

// The floor of a room. With e, it is tucked just inside the walls, so its edge never flickers against the wall face.
function floorShapes(o, e = 0) {
  if (o.kind === 'rr') return [roundedRect(o.W - 2 * e, o.D - 2 * e, Math.max(0.001, o.r - e))];
  if (o.kind === 'ring') {
    // (The floor runs out under the colonnade and a little under the edge of the courtyard lawn, which sits on it.)
    const f = roundedRect(o.W - 2 * e, o.D - 2 * e, o.r - e); f.holes.push(roundedRect(Math.max(0.1, o.fWi - 0.12), Math.max(0.1, o.fDi - 0.12), Math.max(0.05, o.fri - 0.06)));
    return [f];
  }
  // A quarter band (a quarter of a pie when the inside radius is 0), round a corner nudged in by e.
  const cx = o.cx + e, cz = o.cz + e, a = o.R0 > 0.01 ? o.R0 + e : 0, b2 = o.R1 - 2 * e, s = new THREE.Shape(), n = 24;
  for (let i = 0; i <= n; i++) { const t = (i / n) * Math.PI / 2; const p = [cx + Math.cos(t) * b2, -(cz + Math.sin(t) * b2)]; i ? s.lineTo(...p) : s.moveTo(...p); }
  if (a < 0.01) s.lineTo(cx, -cz);
  else for (let i = n; i >= 0; i--) { const t = (i / n) * Math.PI / 2; s.lineTo(cx + Math.cos(t) * a, -(cz + Math.sin(t) * a)); }
  return [s];
}
function slab(shapes, h) {
  const g = new THREE.ExtrudeGeometry(shapes, { depth: h, bevelEnabled: false, curveSegments: 24 });
  g.rotateX(-Math.PI / 2);
  return g;
}

// Walls round one storey, built from the plan: solid wall, with the building's own windows (glass) and its
// doorway (a gap) cut out, `top` high. With cut on, the top is white, like a drawing's cut line.
// Returns the walls and, for walking, the lines you bump into.
// Walls are built as smooth strips that follow the wall (not lots of little boxes), so curved walls stay
// clean and the outline only shows the real edges. Each strip: outside face, inside face, top, ends.
class Strips {
  // Positions and normals for the sides (wall colour) and tops (white on a cut), and the cut outline.
  constructor() { this.side = { p: [], n: [] }; this.top = { p: [], n: [] }; this.inner = { p: [], n: [] }; this.lines = []; }
  // A quad with a normal at each corner (so curved walls shade smoothly); wound to face `face`.
  quad(L, a, b, c, d, na, nb, nc, nd, face) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const flip = (uy * vz - uz * vy) * face[0] + (uz * vx - ux * vz) * face[1] + (ux * vy - uy * vx) * face[2] < 0;
    const P = flip ? [a, c, b, a, d, c] : [a, b, c, a, c, d], N = flip ? [na, nc, nb, na, nd, nc] : [na, nb, nc, na, nc, nd];
    for (let i = 0; i < 6; i++) { L.p.push(...P[i]); L.n.push(...N[i]); }
  }
  // pts/ns: the outside face line and its way out; the strip is T thick inwards, from y0 to y1.
  add(pts, ns, T, y0, y1, white) {
    const O = pts, I = pts.map(([x, z], i) => [x - ns[i][0] * T, z - ns[i][1] * T]), top = white ? this.top : this.side, S = this.side;
    const up = [0, 1, 0], down = [0, -1, 0], out = i => [ns[i][0], 0, ns[i][1]], inn = i => [-ns[i][0], 0, -ns[i][1]];
    for (let i = 0; i < pts.length - 1; i++) {
      const j = i + 1, [ox0, oz0] = O[i], [ox1, oz1] = O[j], [ix0, iz0] = I[i], [ix1, iz1] = I[j], f = [(ns[i][0] + ns[j][0]) / 2, 0, (ns[i][1] + ns[j][1]) / 2];
      this.quad(S, [ox0, y0, oz0], [ox1, y0, oz1], [ox1, y1, oz1], [ox0, y1, oz0], out(i), out(j), out(j), out(i), f);
      this.quad(this.inner, [ix0, y0, iz0], [ix1, y0, iz1], [ix1, y1, iz1], [ix0, y1, iz0], inn(i), inn(j), inn(j), inn(i), [-f[0], 0, -f[2]]);
      this.quad(top, [ox0, y1, oz0], [ox1, y1, oz1], [ix1, y1, iz1], [ix0, y1, iz0], up, up, up, up, up);
      this.quad(S, [ox0, y0, oz0], [ox1, y0, oz1], [ix1, y0, iz1], [ix0, y0, iz0], down, down, down, down, down);
      if (white) this.lines.push(ox0, y1, oz0, ox1, y1, oz1, ix0, y1, iz0, ix1, y1, iz1);
    }
    const end = (i, j) => { const d = [O[i][0] - O[j][0], 0, O[i][1] - O[j][1]], l = Math.hypot(d[0], d[2]) || 1, n = [d[0] / l, 0, d[2] / l]; this.quad(S, [O[i][0], y0, O[i][1]], [I[i][0], y0, I[i][1]], [I[i][0], y1, I[i][1]], [O[i][0], y1, O[i][1]], n, n, n, n, d); if (white) this.lines.push(O[i][0], y1, O[i][1], I[i][0], y1, I[i][1]); };
    end(0, 1); end(pts.length - 1, pts.length - 2);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...this.side.p, ...this.top.p, ...this.inner.p], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([...this.side.n, ...this.top.n, ...this.inner.n], 3));
    const a = this.side.p.length / 3, b = this.top.p.length / 3;
    g.addGroup(0, a, 0); g.addGroup(a, b, 1); g.addGroup(a + b, this.inner.p.length / 3, 2);
    return g;
  }
}
// The wall line between u0 and u1 along a run: its points and (smoothed) ways out, shifted by `off` outwards.
function wallLine(run, u0, u1, off = 0) {
  const pts = [], ns = [], push = (x, z, nx, nz) => { pts.push([x + nx * off, z + nz * off]); ns.push([nx, nz]); };
  const a = runAt(run, u0); push(a.x, a.z, a.nx, a.nz);
  for (let i = 1; i < run.pts.length - 1; i++) if (run.s[i] > u0 + 1e-5 && run.s[i] < u1 - 1e-5) {
    let nx = run.n[i - 1][0] + run.n[i][0], nz = run.n[i - 1][1] + run.n[i][1]; const l = Math.hypot(nx, nz) || 1;
    push(run.pts[i][0], run.pts[i][1], nx / l, nz / l);
  }
  const b = runAt(run, u1); push(b.x, b.z, b.nx, b.nz);
  return { pts, ns };
}
// Walls round one storey, built from the plan: solid wall, with the building's own windows (glass) and its
// doorway (a gap) left open, `top` high. With cut on, the top is white, like a drawing's cut line.
// Returns the walls and, for walking, the lines you bump into.
function buildWalls(b, k, hex, floorY, top, cut) {
  const runs = wallRuns(b, k), ops = openings(b, k, runs), T = WALL_T;
  const walls = new Strips(), glass = new Strips(), segments = [];
  runs.forEach((run, ri) => {
    const mine = ops.filter(o => o.run === ri);
    const cuts = [0, run.len];
    for (const o of mine) for (const s of [o.s0, o.s1]) if (s > 0 && s < run.len) cuts.push(s);
    cuts.sort((a, b2) => a - b2);
    for (let i = 0; i < cuts.length - 1; i++) {
      const u0 = cuts[i], u1 = cuts[i + 1]; if (u1 - u0 < 1e-4) continue;
      const um = (u0 + u1) / 2, o = mine.find(x => x.s0 <= um && um <= x.s1), line = wallLine(run, u0, u1);
      const wall = (y0, y1) => { y1 = Math.min(y1, top); if (y1 - y0 > 0.004) walls.add(line.pts, line.ns, T, floorY + y0, floorY + y1, cut && y1 >= top - 1e-4); };
      if (!o) wall(0, top);
      else {
        if (o.y0 > 0.03) wall(0, o.y0); if (o.y1 < top) wall(o.y1, top);        // (no sill lower than the floor slab: its top would fight the floor's)
        if (!o.door || o.glassDoor) { const gl = wallLine(run, u0, u1, -T / 2 + 0.004); const y0 = Math.max(0, o.y0), y1 = Math.min(top, o.y1); if (y1 - y0 > 0.004) glass.add(gl.pts, gl.ns, 0.008, floorY + y0, floorY + y1, false); }
      }
      if (!o || !o.door) eachPiece(run, u0, u1, p => { const cx = p.x - p.nx * T / 2, cz = p.z - p.nz * T / 2; segments.push([cx - p.dx * p.len / 2, cz - p.dz * p.len / 2, cx + p.dx * p.len / 2, cz + p.dz * p.len / 2]); });
    }
  });
  const g = new THREE.Group(), body = mat(hex), bright = cut ? body : mat(hex, { emissive: hex, emissiveIntensity: 0.28 });
  // (On a cut, the outline is drawn only round the white cut tops, like an architect's section; not at every window edge.)
  if (walls.side.p.length) { const m = new THREE.Mesh(walls.geometry(), [body, cut ? mat('#ffffff') : body, bright]); m.castShadow = true; m.receiveShadow = true; m.userData.noInk = true; g.add(m); }
  if (cut && walls.lines.length) { const ln = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(walls.lines, 3)), INK); ln.raycast = () => {}; g.add(ln); }
  if (glass.side.p.length) g.add(new THREE.Mesh(glass.geometry(), mat('#bfe4f3', { transparent: true, opacity: 0.4, depthWrite: false })));
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
  // The observatory's telescope: a big white tube on a dark pier in the middle of the room, tilted up at the sky
  // (towards the slit in the dome), with a round step to stand on and places to lie back and look up.
  telescope: { r: 0.2, centre: true, make(bag, x, z, c, rnd) {
    bag.cyl('#d8d3c8', 0.17, 0.02, x, 0.01, z, 0.17, 28);
    bag.cyl('#3d405b', 0.04, 0.1, x, 0.07, z, 0.045, 14); bag.box('#3d405b', 0.1, 0.03, 0.04, x, 0.13, z);
    const up = geo => geo.rotateX(0.7).translate(x, 0.13, z);
    bag.add('#fbfaf6', up(new THREE.CylinderGeometry(0.034, 0.028, 0.3, 14).translate(0, 0.15, 0)));
    bag.add('#2e4a8c', up(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 14).translate(0, 0.255, 0)));
    bag.add('#6fcde6', up(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 14).translate(0, 0.302, 0)));
    bag.add('#fbfaf6', up(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 8).translate(0, -0.03, 0)));
    const seats = []; for (let i = 0; i < 4; i++) { const a = Math.PI * (0.65 + i * 0.57); seats.push([x + Math.cos(a) * 0.2, z + Math.sin(a) * 0.2]); }
    return seats; } },
  // A planet on a stand, with a ring round it.
  planet: { r: 0.07, make(bag, x, z, c, rnd) {
    bag.cyl('#fbfaf6', 0.03, 0.01, x, 0.005, z, 0.035, 12); bag.cyl('#fbfaf6', 0.006, 0.09, x, 0.055, z, 0.006, 6);
    bag.add(['#3d8de0', '#f28b30', '#e6463c'][Math.floor(rnd() * 3)], new THREE.SphereGeometry(0.04, 14, 10).translate(x, 0.14, z));
    bag.add('#f7c22e', new THREE.TorusGeometry(0.06, 0.006, 6, 24).rotateX(Math.PI / 2 - 0.4).translate(x, 0.14, z));
    return []; } },
  // A big round fish tank: see-through water on a navy base, sand, seaweed and coral, and fish swimming round.
  tank: { r: 0.12, make(bag, x, z, c, rnd) {
    bag.cyl('#2e4a8c', 0.105, 0.04, x, 0.02, z, 0.11, 24); bag.cyl('#f0e2c0', 0.088, 0.012, x, 0.046, z, 0.088, 20);
    bag.cyl(WATER, 0.095, 0.25, x, 0.165, z, 0.095, 28);
    bag.add('#fbfaf6', new THREE.TorusGeometry(0.095, 0.006, 6, 28).rotateX(Math.PI / 2).translate(x, 0.29, z));
    weedAt(bag, x + 0.03, 0.052, z - 0.02, rnd); coralAt(bag, x - 0.04, 0.052, z + 0.03, rnd);
    for (let k = 0; k < 5; k++) { const a = rnd() * 6.28, rr = 0.03 + rnd() * 0.04; fishAt(bag, x + Math.cos(a) * rr, 0.09 + rnd() * 0.17, z + Math.sin(a) * rr, -Math.sin(a), Math.cos(a), 0.012, FISH_COLS[k % FISH_COLS.length]); }
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
  aquarium: A => [['tank', A >= 2 ? Math.min(3, A - 1) : 1], ['jelly', A >= 3 ? 1 : 0], ['beanbag', Math.max(1, A - 1)], ['plant', 1]],
  archway: A => [],
  observatory: A => [['telescope', 1], ['planet', 1], ['beanbag', A * 2 + 2]],
  pool: A => [['plant', 2], ['beanbag', 2]],
};

class Bag {
  constructor() { this.geos = new Map(); }
  add(col, g) { if (!this.geos.has(col)) this.geos.set(col, []); this.geos.get(col).push(g); }
  box(col, w, h, d, x, y, z) { this.add(col, new THREE.BoxGeometry(w, h, d).translate(x, y, z)); }
  ball(col, r, x, y, z) { this.add(col, new THREE.SphereGeometry(r, 10, 7).scale(1, 0.7, 1).translate(x, y + r * 0.7, z)); }
  cyl(col, r, h, x, y, z, r2 = r, seg = 18) { this.add(col, new THREE.CylinderGeometry(r, r2, h, seg).translate(x, y, z)); }
  // A flat shape (in plan) pushed up from y0 to y0 + h.
  plan(col, shape, h, x, y0, z, rotY = 0) { this.add(col, new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 20 }).rotateX(-Math.PI / 2).rotateY(rotY).translate(x, y0, z)); }
  // A flat outline in plan ([x, z] points) pushed straight up from y0 by h.
  prism(col, pts, y0, h) { this.add(col, new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z))), { depth: h, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, y0, 0)); }
  tube(col, pts, r) { this.add(col, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, r, 8, false)); }
  meshes() {
    const out = [];
    for (const [col, list] of this.geos) {
      // (A colour starting with ~ is water: see-through, and it casts no shadow.)
      const water = col[0] === '~', g = mergeGeometries(list.map(x => { const y = x.index ? x.toNonIndexed() : x; y.deleteAttribute('uv'); if (!y.attributes.normal) y.computeVertexNormals(); return y; }));
      const m = new THREE.Mesh(g, water ? mat(col.slice(1), { transparent: true, opacity: 0.42, depthWrite: false }) : mat(col));
      m.castShadow = m.receiveShadow = !water; if (water) m.renderOrder = 1;
      out.push(m);
    }
    return out;
  }
}

// ---------- the aquarium ----------
// Long glass tanks along the walls (sand, seaweed, coral and fish, on a navy base), and in an arch, a tunnel of
// water over your head when you walk through it. Heights are from the floor.
const TANK = { back: WALL + 0.008, depth: 0.09, base: 0.045, top: 0.23 };
const WATER = '~#5ec4e2', FISH_COLS = ['#f28b30', '#f7c22e', '#e2457d', '#ffffff', '#3d8de0', '#f5a3c7', '#a3d140'];
const CORAL = ['#f5a3c7', '#e2457d', '#f28b30', '#7c46a8', '#f7c22e'], WEED = ['#3e9a4f', '#5f9a4c', '#7db45a'];
// A little fish facing along (dx, dz): a squashed ball with a flat tail.
function fishAt(bag, x, y, z, dx, dz, s, col) {
  const a = Math.atan2(-dz, dx);
  bag.add(col, new THREE.SphereGeometry(s, 8, 6).scale(1.7, 1, 0.55).rotateY(a).translate(x, y, z));
  bag.add(col, new THREE.ConeGeometry(s * 0.8, s * 1.1, 6).rotateZ(-Math.PI / 2).scale(1, 1, 0.35).translate(-s * 2.2, 0, 0).rotateY(a).translate(x, y, z));
}
function weedAt(bag, x, y, z, rnd) {
  for (let i = 0; i < 3; i++) {
    const hh = 0.06 + rnd() * 0.09;
    bag.add(WEED[i % 3], new THREE.ConeGeometry(0.007, hh, 5).translate(0, hh / 2, 0).rotateZ((rnd() - 0.5) * 0.5).rotateX((rnd() - 0.5) * 0.4).translate(x + (rnd() - 0.5) * 0.02, y, z + (rnd() - 0.5) * 0.02));
  }
}
function coralAt(bag, x, y, z, rnd) {
  const c = CORAL[Math.floor(rnd() * CORAL.length)];
  for (let i = 0; i < 3; i++) bag.ball(c, 0.008 + rnd() * 0.008, x + (rnd() - 0.5) * 0.03, y + i * 0.006, z + (rnd() - 0.5) * 0.02);
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
function wallTanks(bag, b, k, o, rnd) {
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
        else if (r < 0.75) bag.add('#b9b4aa', new THREE.SphereGeometry(0.016, 7, 5).scale(1.4, 0.7, 1).translate(x, y0, z));
        if (rnd() < 0.7) { const sg = rnd() < 0.5 ? 1 : -1; fishAt(bag, p.x - p.nx * (mid + (rnd() - 0.5) * 0.04), y0 + 0.04 + rnd() * 0.12, p.z - p.nz * (mid + (rnd() - 0.5) * 0.04), p.dx * sg, p.dz * sg, 0.011 + rnd() * 0.005, FISH_COLS[Math.floor(rnd() * FISH_COLS.length)]); }
        if (rnd() < 0.08) for (let i = 0; i < 4; i++) bag.add('#ffffff', new THREE.SphereGeometry(0.004 + i * 0.001, 5, 4).translate(x, y0 + 0.05 + i * 0.035, z));
      }
      // Places to stand and look.
      for (let u = a + 0.12; u < c - 0.08; u += 0.3) { const p = runAt(run, u), x = p.x - p.nx * (F + 0.07), z = p.z - p.nz * (F + 0.07); if (o.inside(x, z, 0.04)) seats.push([x, z]); }
    }
  });
  return seats;
}
// The walk-through tunnel: an arch of water from the top of one wall of tanks to the other, fish swimming over you.
function waterTunnel(bag, o, top, rnd) {
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

// Build the cut room. Coordinates are local to the piece (centred, y = 0 at the piece's base).
// floorY: where this storey's floor is, inside the piece. Returns { group, seats, walk, inside }.
export function cutRoom(b, hex, floorY, cutH = CUT, opts = {}) {
  const k = TALL.has(b.type) ? 0 : Math.round(floorY / LEVEL), o = outline(b, k), g = new THREE.Group(), inner = floorShapes(o, 0.012);
  // Everything below this floor stays solid; the floor and cut walls sit on top.
  // (In walk mode the real building stands above and below the storey being walked, so it is left out here.)
  if (floorY > 0.001 && !opts.walk) { const base = new THREE.Mesh(slab(floorShapes(o), floorY), mat(hex)); base.castShadow = base.receiveShadow = true; if (o.rot) base.rotation.y = -o.rot * Math.PI / 2; g.add(base); }
  const shell = new THREE.Group(); if (o.rot) shell.rotation.y = -o.rot * Math.PI / 2; g.add(shell);
  const floor = new THREE.Mesh(slab(inner, 0.02), mat(lighten(hex, 0.8)));
  floor.position.y = floorY; floor.receiveShadow = true; shell.add(floor);
  let segments = [];
  if (opts.walk) {
    // Walls right up to the ceiling, with real window openings and one doorway, and a ceiling over the room.
    const w = buildWalls(b, k, hex, floorY, opts.top, false);
    g.add(w.group); segments = w.segments;
    // (An observatory has no flat ceiling: you look up into the dome, where the real telescope is.)
    if (b.shape !== 'observatory') { const ceil = new THREE.Mesh(slab(inner, 0.02), mat('#fbfaf6', { emissive: '#f3ede2', emissiveIntensity: 0.75 })); ceil.position.y = floorY + opts.top - 0.02; shell.add(ceil); }       // no shadow from the ceiling, so the room stays sunny
  } else {
    g.add(buildWalls(b, k, hex, floorY, cutH, true).group);
  }
  // A ring: columns round the courtyard on the ground floor, and the garden with its big tree in the middle.
  if (o.kind === 'ring') {
    const ringFrame = new THREE.Group();
    if (o.col) colonnade(ringFrame, o.fWi + 0.08, o.fDi + 0.08, opts.walk ? opts.top : cutH);
    if (!(b.level > 0) && b.w >= 3 && b.d >= 3 && !opts.walk) courtyard(ringFrame, o.fWi, o.fDi, b.id, floorY + 0.02);
    g.add(ringFrame);
  }
  // Furniture: playful pieces placed loosely round the room (not in rows), so it feels like a happy place.
  const bag = new Bag(), seats = [];
  const area = Math.max(1, Math.round(b.w * b.d * (o.kind === 'ring' ? 0.6 : o.kind === 'arc' ? 0.5 : 1)));
  const aqua = b.type === 'aquarium', plan = (aqua && b.shape === 'arch' ? [] : (PLANS[b.type] || PLANS.classroom)(area))
    .filter(([kind]) => !(opts.walk && b.shape === 'observatory' && kind === 'telescope'));      // (walking, the big telescope overhead is the real one)
  const placed = [], rnd = seededRnd(b.id * 97 + (b.x + 1) * 13 + (b.z + 1) * 7);
  // An aquarium: tanks along the walls, and in an arch, a tunnel of water overhead when you walk through.
  if (aqua) {
    for (const s of wallTanks(bag, b, k, o, rnd)) seats.push(s);
    if (opts.walk && b.shape === 'arch' && o.kind === 'rr') waterTunnel(bag, o, opts.top, rnd);
  }
  for (const [kind, count] of plan) {
    const F = FEATURES[kind];
    for (let n = 0; n < count; n++) {
      for (let tries = 0; tries < 60; tries++) {
        const x = F.centre ? 0 : (rnd() - 0.5) * (b.w - 0.1), z = F.centre ? 0 : (rnd() - 0.5) * (b.d - 0.1);
        if (!o.inside(x, z, WALL + (aqua ? 0.11 : 0) + F.r + 0.02) && !F.centre) continue;
        if (b.type === 'pool' && o.kind === 'rr' && Math.abs(x) < (o.W - 0.2) / 2 && Math.abs(z) < (o.D - 0.2) / 2) continue;
        if (placed.some(p => Math.hypot(p.x - x, p.z - z) < p.r + F.r + 0.03)) continue;
        placed.push({ x, z, r: F.r });
        for (const s of F.make(bag, x, z, hex, rnd)) seats.push(s);
        break;
      }
    }
  }
  // A swimming pool in a building: the pool itself, with lanes, a white edge and swimmers.
  let swim = null;
  if (b.type === 'pool' && o.kind === 'rr') {
    const BW = o.W - 0.34, BD = o.D - 0.34, rim = roundedRect(BW + 0.12, BD + 0.12, 0.1); rim.holes.push(roundedRect(BW, BD, 0.06));
    bag.plan('#fbfaf6', rim, 0.03, 0, 0, 0); bag.plan('#5fd0ea', roundedRect(BW, BD, 0.06), 0.012, 0, 0, 0);
    const lanes = Math.max(2, Math.round(Math.min(BW, BD) * 2.5)), long = BW > BD;
    for (let i = 1; i < lanes; i++) { const off = -Math.min(BW, BD) / 2 + (Math.min(BW, BD) * i) / lanes; bag.box('#ffffff', long ? BW - 0.1 : 0.012, 0.004, long ? 0.012 : BD - 0.1, long ? 0 : off, 0.02, long ? off : 0); }
    swim = { w: BW - 0.12, d: BD - 0.12, y: floorY + 0.03 };
  }
  if ((b.type === 'classroom') && o.kind === 'rr') bag.box('#2f3a33', Math.min(0.5, o.W * 0.5), 0.12, 0.012, 0, 0.18, -o.D / 2 + WALL + 0.01);
  for (const mm of bag.meshes()) { mm.position.y = floorY + 0.02; mm.userData.noInk = true; g.add(mm); }
  return { group: g, seats: seats.map(([x, z]) => [x, floorY + 0.02, z]), inside: o.inside, floorY: floorY + 0.02, segments, swim };
}

export { CUT, SINGLE as SINGLE_SPACE };
export const storeyFloor = (b, L) => (SINGLE.has(b.type) ? 0 : Math.max(0, L - b.level) * LEVEL);
