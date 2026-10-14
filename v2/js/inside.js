// The inside view: a room cut through at one floor, like an architect's cutaway. Light floor, walls cut at
// child height (white on the cut) with the same windows and doors as outside, and furniture for what the
// room is for. Returns where people sit and walk.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LEVEL } from './catalogue.js';
import { mat, colonnade, courtyard, INK } from './shapes.js';
import { Bag, FEATURES, PLANS, STRIPS, standFor, placeWallItems, seededRnd, wallTanks, waterTunnel, hangingPlanets, bunting, artline, mobiles, fairylights, lanterns, climbropes, notemobiles, drone, ceilingstars, hangingwhale } from './furnish.js';
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
  // Things on and against the walls first (clear of doors and windows), then loose furniture in the floor left.
  const missed = placeWallItems(bag, b, k, plan, rnd, placed, seats) || [];
  // What found no wall stands in the room on wheels instead (one in a small room, up to three in a big one).
  const stands = missed.filter(kd => !STRIPS.has(kd)).slice(0, area >= 2 ? 3 : 1).map(kd => [kd, 1, standFor(kd)]);
  const floorPlan = plan.filter(([kd]) => FEATURES[kd]).map(([kd, n]) => [kd, n, FEATURES[kd]]);
  floorPlan.splice(Math.min(3, floorPlan.length), 0, ...stands);
  if (opts.walk && b.shape === 'observatory') hangingPlanets(bag, opts.top);
  if (opts.walk && ['classroom', 'ringhouse', 'art', 'lunch', 'music'].includes(b.type) && o.kind === 'rr') bunting(bag, o, opts.top, rnd);
  if (opts.walk && ['classroom', 'ringhouse', 'art'].includes(b.type) && o.kind === 'rr') { artline(bag, o, opts.top, rnd); mobiles(bag, o, opts.top, rnd); }
  if (opts.walk && o.kind === 'rr') {
    if (b.type === 'library' || b.type === 'yoga') fairylights(bag, o, opts.top, rnd);
    if (b.type === 'lunch') lanterns(bag, o, opts.top, rnd);
    if (b.type === 'hall') climbropes(bag, o, opts.top, rnd);
    if (b.type === 'music') notemobiles(bag, o, opts.top, rnd);
    if (b.type === 'maker') drone(bag, o, opts.top, rnd);
    if (b.type === 'yoga') ceilingstars(bag, o, opts.top, rnd);
    if (aqua) hangingwhale(bag, o, opts.top, rnd);
  }
  for (const [kind, count, F] of floorPlan) {
    const centre = F.centre && o.inside(0, 0, 0.1);
    for (let n = 0; n < count; n++) {
      for (let tries = 0; tries < 60; tries++) {
        const x = centre ? 0 : (rnd() - 0.5) * (b.w - 0.1), z = centre ? 0 : (rnd() - 0.5) * (b.d - 0.1);
        if (!centre && !o.inside(x, z, WALL + (aqua ? 0.11 : 0) + F.r + 0.02)) continue;
        if (b.type === 'pool' && o.kind === 'rr' && Math.abs(x) < (o.W - 0.2) / 2 && Math.abs(z) < (o.D - 0.2) / 2) continue;
        if (placed.some(p => Math.hypot(p.x - x, p.z - z) < p.r + F.r + 0.03)) continue;
        const me = { x, z, r: F.r, low: !!F.low }; placed.push(me);
        for (const s of F.make(bag, x, z, hex, rnd, o)) {
          if (!o.inside(s[0], s[1], WALL + 0.025) || placed.some(p => p !== me && !p.low && Math.hypot(p.x - s[0], p.z - s[1]) < p.r * 0.85)) continue;      // (no sitting in a wall or a table)
          seats.push(s.length > 3 || Math.hypot(s[0] - x, s[1] - z) < 0.02 ? s : [s[0], s[1], s[2] || 0, Math.atan2(x - s[0], z - s[1])]);      // (sitters face the piece they sit at)
        }
        break;
      }
    }
  }
  // A swimming pool in a building: the pool itself, with lanes, a white edge and swimmers.
  let swim = null;
  if (b.type === 'pool' && o.kind === 'rr') {
    const BW = o.W - 0.34, BD = o.D - 0.34, rim = roundedRect(BW + 0.12, BD + 0.12, 0.1); rim.holes.push(roundedRect(BW, BD, 0.06));
    bag.plan('#fbfaf6', rim, 0.03, 0, 0, 0); bag.plan('#5fd0ea', roundedRect(BW, BD, 0.06), 0.012, 0, 0, 0);
    const lanes = Math.max(2, Math.round(Math.min(BW, BD) * 2.5)), long = BW > BD, L = (long ? BW : BD) - 0.1, S = Math.min(BW, BD), prnd = seededRnd(b.id * 31 + 7);
    // Lane ropes of red and white floats, a starting block at the end of each lane, and a few rings floating about.
    for (let i = 1; i < lanes; i++) {
      const off = -S / 2 + (S * i) / lanes, n = Math.max(4, Math.round(L / 0.05));
      for (let j = 0; j < n; j++) { const u = -L / 2 + (j + 0.5) * (L / n); bag.box(j % 2 ? '#ffffff' : (j % 6 < 3 ? '#e6463c' : '#3d8de0'), long ? L / n * 0.9 : 0.012, 0.008, long ? 0.012 : L / n * 0.9, long ? u : off, 0.022, long ? off : u); }
    }
    for (let i = 0; i < lanes; i++) { const off = -S / 2 + (S * (i + 0.5)) / lanes, end = -(long ? BW : BD) / 2 - 0.032; bag.box('#fbfaf6', long ? 0.03 : 0.04, 0.026, long ? 0.04 : 0.03, long ? end : off, 0.043, long ? off : end); bag.box(['#e6463c', '#f7c22e', '#3d8de0', '#a3d140'][i % 4], long ? 0.026 : 0.036, 0.003, long ? 0.036 : 0.026, long ? end : off, 0.0575, long ? off : end); }
    for (let i = 0; i < 3; i++) bag.add(['#e6463c', '#f7c22e', '#f28b30'][i], new THREE.TorusGeometry(0.02, 0.007, 6, 12).rotateX(Math.PI / 2).translate((prnd() - 0.5) * (BW - 0.2), 0.02, (prnd() - 0.5) * (BD - 0.2)));
    swim = { w: BW - 0.12, d: BD - 0.12, y: floorY + 0.03 };
  }
  for (const mm of bag.meshes()) { mm.position.y = floorY + 0.02; mm.userData.noInk = true; g.add(mm); }
  // Moving parts (a robot arm, print heads, an orrery...), animated by sitescreen.js.
  if (bag.parts.length) {
    const moving = new THREE.Group(); moving.position.y = floorY + 0.02;
    for (const p of bag.parts) { p.traverse(m => { m.userData.noInk = true; }); moving.add(p); }
    g.add(moving);
  }
  return { group: g, seats: seats.map(([x, z, h = 0, yaw]) => [x, floorY + 0.02 + h, z, yaw]), obstacles: placed.filter(p => !p.low).map(p => ({ x: p.x, z: p.z, r: p.r })), inside: o.inside, floorY: floorY + 0.02, segments, swim };
}

export { CUT, SINGLE as SINGLE_SPACE };
export const storeyFloor = (b, L) => (SINGLE.has(b.type) ? 0 : Math.max(0, L - b.level) * LEVEL);
