// The shapes a programme box can take, built to fit any size of footprint (w x d squares, h storeys).
// Every builder returns a Group centred on x = z = 0, standing on y = 0, in clean matte colours.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LEVEL } from './catalogue.js';
import { TREE_GREENS } from './site.js';
import { addFacade, addTerrace, contactShadow } from './facade.js';
import { REC, SOFFIT, hasColonnade, ringThickness, turnAngle, rows, wallRuns, openings } from './plan.js';
import { miniKid, SEAT, REACH } from './kid.js';

const GAP = 0.035;                   // a hair of space round every piece, so each reads as its own block
const ROOF = 0.4;

// ---------- materials ----------
const mats = new Map();
export function mat(hex, extra = {}) {
  const k = hex + JSON.stringify(extra);
  if (!mats.has(k)) { const m = new THREE.MeshLambertMaterial({ color: hex, ...extra }); m.userData.shared = true; mats.set(k, m); }
  return mats.get(k);
}
export const shade = (hex, f) => '#' + new THREE.Color(hex).multiplyScalar(f).getHexString();
const lighten = (hex, f) => '#' + new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), f).getHexString();
const WHITE = '#fbfaf6';
const glass = () => mat('#d8eef6', { transparent: true, opacity: 0.45, depthWrite: false });

// ---------- helpers ----------
function mesh(geo, material, shadow = true) { const m = new THREE.Mesh(geo, material); m.castShadow = shadow; m.receiveShadow = true; return m; }
// Extrude a profile drawn across the short side (x across, y up) along the long side.
function prism(points, len, shape = null) {
  const s = shape || new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1, curveSegments: 18 });
  g.translate(0, 0, -len / 2);
  return g;
}
// Turn a geometry built along z so it runs along the long side of the footprint.
const alongLong = (g, w, d) => (w > d ? g.rotateY(Math.PI / 2) : g);
function roundedRect(W, D, r) {
  const s = new THREE.Shape(), x = -W / 2, y = -D / 2;
  r = Math.min(r, W / 2, D / 2);
  s.moveTo(x + r, y); s.lineTo(x + W - r, y); s.absarc(x + W - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + W, y + D - r); s.absarc(x + W - r, y + D - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + D); s.absarc(x + r, y + D - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
function upExtrude(shape, H) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: H, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1, curveSegments: 16 });
  g.rotateX(-Math.PI / 2);
  return g;
}

// ---------- little people and trees, for scale ----------
// A little toy child (like the people in the school day), to ride on swings, roundabouts, slides and zip lines.
function people(group, spots) {
  for (const [x, y, z] of spots) { const p = miniKid(); p.position.set(x, y, z); group.add(p); }
}
let TREE = null;
export function roundTree(r = 0.3, colour = null) {
  if (!TREE) { TREE = { canopy: new THREE.SphereGeometry(1, 12, 9), trunk: new THREE.CylinderGeometry(0.1, 0.14, 1, 7).translate(0, 0.5, 0) }; TREE.canopy.userData.shared = TREE.trunk.userData.shared = true; }
  const g = new THREE.Group();
  const t = mesh(TREE.trunk, mat('#9b7b5c')); t.scale.set(r * 0.5, r * 0.9, r * 0.5); g.add(t);
  const c = mesh(TREE.canopy, mat(colour || TREE_GREENS[1])); c.scale.set(r, r * 1.05, r); c.position.y = r * 0.9 + r * 0.85; g.add(c);
  return g;
}
const seeded = id => { let a = (id * 2654435761) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// Glass rails round an open flat roof (a roof terrace).
function terrace(group, W, D, H, round = false) {
  if (round) return;
  const g = glass(), hgt = 0.09, t = 0.01;
  for (const [x, z, sx, sz] of [[0, -D / 2 + 0.02, W - 0.04, t], [0, D / 2 - 0.02, W - 0.04, t], [-W / 2 + 0.02, 0, t, D - 0.04], [W / 2 - 0.02, 0, t, D - 0.04]]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(sx, hgt, sz), g); p.position.set(x, H + hgt / 2, z); p.raycast = () => {}; group.add(p);
  }
}

// A pitched building as one mesh with two materials: the walls, then the roof (every face that looks upwards) a
// shade darker, so the form reads in the flat iso light, and a wall finish stays off the roof.
function roofed(geo, c, up = 0.3) {
  const g = geo.index ? geo.toNonIndexed() : geo, p = g.attributes.position, walls = [], roof = [];
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), N = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    A.fromBufferAttribute(p, i); B.fromBufferAttribute(p, i + 1); C.fromBufferAttribute(p, i + 2);
    N.subVectors(B, A).cross(C.clone().sub(A)).normalize();
    (N.y > up ? roof : walls).push(i);
  }
  const out = new Float32Array(p.count * 3); let k = 0;
  for (const list of [walls, roof]) for (const i of list) for (let j = 0; j < 3; j++) { out[k++] = p.getX(i + j); out[k++] = p.getY(i + j); out[k++] = p.getZ(i + j); }
  const geo2 = new THREE.BufferGeometry(); geo2.setAttribute('position', new THREE.BufferAttribute(out, 3)); geo2.computeVertexNormals();
  geo2.addGroup(0, walls.length * 3, 0); geo2.addGroup(walls.length * 3, roof.length * 3, 1);
  return mesh(geo2, [mat(c), mat(shade(c, 0.86))]);
}

// ---------- the shapes ----------
const BUILD = {
  box(w, d, H, c, o) {
    const W = w - 2 * GAP, D = d - 2 * GAP;
    const g = new THREE.Group();
    g.add(mesh(new RoundedBoxGeometry(W, H, D, 2, 0.04).translate(0, H / 2, 0), mat(c)));
    if (o.open) terrace(g, W, D, H);
    return g;
  },
  house(w, d, H, c) {
    const L = Math.max(w, d) - 2 * GAP - 0.03, W = Math.min(w, d) - 2 * GAP - 0.03, r = Math.min(ROOF + 0.05, W * 0.45);
    const geo = prism([[-W / 2, 0], [W / 2, 0], [W / 2, H], [0, H + r], [-W / 2, H]], L);
    const g = new THREE.Group(); g.add(roofed(alongLong(geo, w, d), c)); return g;
  },
  saw(w, d, H, c) {
    // A row of little pointy-roofed houses, one per square, ridges across the row.
    const L = Math.max(w, d), W = Math.min(w, d) - 2 * GAP - 0.03, n = Math.max(1, Math.round(L)), u = (L - 2 * GAP) / n;
    const parts = [];
    for (let i = 0; i < n; i++) {
      const hh = H + (i % 2 ? 0.06 : 0);
      const geo = prism([[-u / 2, 0], [u / 2, 0], [u / 2, hh], [0, hh + Math.min(ROOF, u * 0.48)], [-u / 2, hh]], W);
      geo.translate(-L / 2 + GAP + u * (i + 0.5), 0, 0);
      parts.push(geo);
    }
    const geo = mergeGeometries(parts);
    if (d > w) geo.rotateY(Math.PI / 2);
    const g = new THREE.Group(); g.add(roofed(geo, c)); return g;
  },
  vault(w, d, H, c) {
    const L = Math.max(w, d) - 2 * GAP - 0.03, W = Math.min(w, d) - 2 * GAP - 0.03, r = Math.min(W / 2, 0.55);
    const pts = [[-W / 2, 0], [W / 2, 0], [W / 2, H]];
    for (let i = 1; i < 16; i++) { const a = (i / 16) * Math.PI; pts.push([Math.cos(a) * W / 2, H + Math.sin(a) * r]); }
    pts.push([-W / 2, H]);
    const g = new THREE.Group(); g.add(mesh(alongLong(prism(pts, L), w, d), mat(c))); return g;
  },
  drum(w, d, H, c, o) {
    const W = w - 2 * GAP - 0.03, D = d - 2 * GAP - 0.03;
    const g = new THREE.Group(); g.add(mesh(upExtrude(roundedRect(W, D, Math.min(W, D) / 2), H), mat(c)));
    return g;
  },
  tower(w, d, H, c) {
    const g = BUILD.drum(w, d, H, c, {});
    const L = Math.max(w, d), n = w === d ? 1 : Math.round(L), rad = w === d ? Math.min(w, d) / 2 - GAP : 0.46;
    for (let i = 0; i < n; i++) {
      const cone = mesh(new THREE.ConeGeometry(rad, rad * 1.7, 28), mat(shade(c, 0.72)));
      const off = n === 1 ? 0 : -L / 2 + 0.5 + i;
      cone.position.set(w >= d ? off : 0, H + rad * 0.85, w >= d ? 0 : off);
      g.add(cone);
    }
    return g;
  },
  ring(w, d, H, c, o) {
    if (w < 2 || d < 2) return BUILD.drum(w, d, H, c, {});
    const W = w - 2 * GAP - 0.03, D = d - 2 * GAP - 0.03, t = ringThickness({ shape: 'ring', w, d });
    const outer = () => roundedRect(W, D, Math.min(W, D) / 2);
    const hole = e => roundedRect(W - 2 * t + 2 * e, D - 2 * t + 2 * e, Math.max(0.05, Math.min(W, D) / 2 - t + e));
    const g = new THREE.Group();
    if (o.box && hasColonnade(o.box)) {
      // The ground floor steps back behind a ring of columns, so you can walk round the courtyard under cover.
      const low = outer(); low.holes.push(hole(REC)); g.add(mesh(upExtrude(low, SOFFIT), mat(c)));
      const up = outer(); up.holes.push(hole(0)); const top = mesh(upExtrude(up, H - SOFFIT), mat(c)); top.position.y = SOFFIT; g.add(top);
      colonnade(g, W - 2 * t - 0.03 + 0.08, D - 2 * t - 0.03 + 0.08);
      walkway(g, W - 2 * t - 0.03, D - 2 * t - 0.03, REC);
    } else { const s = outer(); s.holes.push(hole(0)); g.add(mesh(upExtrude(s, H), mat(c))); }
    if (w >= 3 && d >= 3) courtyard(g, W - 2 * t - 0.03, D - 2 * t - 0.03, o.id, o.box && hasColonnade(o.box) ? 0.02 : 0);
    return g;
  },
  ringhouse(w, d, H, c, o) {
    // A ring of pointy-roofed houses round a garden: the roof follows the curve, one little house after another.
    // On the ground the courtyard side steps back behind a colonnade, like a cloister.
    if (w < 2 || d < 2) return BUILD.house(w, d, H, c);
    const t = ringThickness({ shape: 'ringhouse', w, d }), col = !!(o.box && hasColonnade(o.box));
    const W = w - 2 * GAP - t, D = d - 2 * GAP - t;       // the centre line of the band
    const path = loopPath(W, D, Math.min(W, D) / 2);
    const g = new THREE.Group();
    const [body, roofs] = sweepHouses(path, t, H, true, col ? REC : 0);
    g.add(mesh(body, mat(c)), mesh(roofs, mat(shade(c, 0.86))));
    const Wi = w - 2 * GAP - 2 * t, Di = d - 2 * GAP - 2 * t;
    if (col) { colonnade(g, Wi + 0.08, Di + 0.08); walkway(g, Wi, Di, REC); }
    if (w >= 3 && d >= 3) courtyard(g, Wi, Di, o.id, col ? 0.02 : 0);
    return g;
  },
  arc(w, d, H, c) {
    if (Math.min(w, d) < 2) {
      const R = 1 - 2 * GAP - 0.02, cx = -w / 2 + GAP, cz = -d / 2 + GAP, g = new THREE.Group();
      const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(R, 0); s.absarc(0, 0, R, 0, -Math.PI / 2, true); s.lineTo(0, 0);
      const body = upExtrude(s, H); body.translate(cx, 0, cz); g.add(mesh(body, mat(c)));
      // A soft quarter dome on top, like a slice of a round hut.
      const Rr = R + 0.02, sq = 0.36, roofC = mat(shade(c, 0.82), { side: THREE.DoubleSide });
      const dome = new THREE.SphereGeometry(Rr, 28, 12, Math.PI / 2, Math.PI / 2, 0, Math.PI / 2).scale(1, sq, 1).translate(cx, H, cz);
      g.add(mesh(dome, roofC));
      const q = new THREE.Shape(); q.moveTo(0, 0); q.lineTo(Rr, 0); q.absellipse(0, 0, Rr, Rr * sq, 0, Math.PI / 2, false); q.lineTo(0, 0);
      g.add(mesh(new THREE.ShapeGeometry(q, 16).translate(cx, H, cz), roofC));
      g.add(mesh(new THREE.ShapeGeometry(q, 16).rotateY(-Math.PI / 2).translate(cx, H, cz), roofC));
      return g;
    }
    // A curved building with a pointy roof, bending round a quarter circle.
    const R = Math.min(w, d) - GAP - 0.45, t = 0.85, pts = [];
    const cx = -w / 2 + GAP, cz = -d / 2 + GAP;
    for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI / 2; pts.push(new THREE.Vector2(cx + Math.cos(a) * R, cz + Math.sin(a) * R)); }
    const g = new THREE.Group(), [body, roofs] = sweepHouses(pts, t, H, false); g.add(mesh(body, mat(c)), mesh(roofs, mat(shade(c, 0.86)))); return g;
  },
  arch(w, d, H, c) {
    const L = Math.max(w, d) - 2 * GAP - 0.03, W = Math.min(w, d) - 2 * GAP - 0.03;
    const a = W * 0.56, spring = Math.min(H * 0.32, H - a / 2 - 0.06);
    const s = new THREE.Shape();
    s.moveTo(-W / 2, 0); s.lineTo(-a / 2, 0); s.lineTo(-a / 2, spring);
    s.absarc(0, spring, a / 2, Math.PI, 0, true);
    s.lineTo(a / 2, 0); s.lineTo(W / 2, 0); s.lineTo(W / 2, H); s.lineTo(-W / 2, H); s.lineTo(-W / 2, 0);
    // The tunnel runs across the long side, so you walk through the short way, like Finn's wooden arch.
    const geo = prism(null, L, s);
    if (w < d) geo.rotateY(Math.PI / 2);
    const g = new THREE.Group(); g.add(mesh(geo.rotateY(Math.PI / 2), mat(c)));
    // A white rim round each end of the tunnel, like the edge of Finn's wooden arch.
    const rim = new THREE.Shape(), o2 = a / 2 + 0.035;
    rim.moveTo(-o2, 0); rim.lineTo(-o2, spring); rim.absarc(0, spring, o2, Math.PI, 0, true); rim.lineTo(o2, 0); rim.lineTo(a / 2, 0); rim.lineTo(a / 2, spring); rim.absarc(0, spring, a / 2, 0, Math.PI, false); rim.lineTo(-a / 2, 0); rim.lineTo(-o2, 0);
    const end = L / 2 + 0.016;
    for (const sgn of [-1, 1]) {
      const rg = new THREE.ExtrudeGeometry(rim, { depth: 0.02, bevelEnabled: false, curveSegments: 18 }).translate(0, 0, sgn > 0 ? end - 0.006 : -end - 0.014);
      if (w < d) rg.rotateY(Math.PI / 2);
      g.add(mesh(rg.rotateY(Math.PI / 2), mat(WHITE)));
    }
    return g;
  },
  steps(w, d, H, c, o) {
    const L = Math.max(w, d) - 2 * GAP, W = Math.min(w, d) - 2 * GAP, n = Math.max(3, Math.round(L * 3));
    const pts = [[-L / 2, 0], [L / 2, 0], [L / 2, H]];
    for (let i = n - 1; i >= 0; i--) { const x = -L / 2 + (L * i) / n, y = (H * i) / n; pts.push([x + L / n, y], [x, y]); }
    const geo = prism(pts.slice(0, -1).concat([[-L / 2, 0]]), W);
    if (d > w) geo.rotateY(Math.PI / 2);
    const g = new THREE.Group(); g.add(mesh(geo, mat(c)));
    // Where children sit on the steps.
    const r = seeded(o.id || 1), spots = [];
    for (let i = 0; i < Math.min(14, n * 3); i++) {
      const k = Math.floor(r() * n), along = -L / 2 + (L * (k + 0.5)) / n, across = (r() - 0.5) * W * 0.8, y = (H * k) / n;     // (step k's top)
      spots.push(w >= d ? [along, y, across] : [across, y, along]);
    }
    g.userData.seats = spots;
    const cols = ['#f7c22e', '#e2457d', '#22b2bf', '#a3d140', '#f28b30', '#ffffff'];
    for (let i = 0; i < Math.min(8, n * 2); i++) {
      const k = 1 + Math.floor(r() * (n - 1)), along = -L / 2 + (L * (k + 0.5)) / n, across = (r() - 0.5) * W * 0.8, y = (H * k) / n;
      const cu = mesh(new RoundedBoxGeometry(0.11, 0.035, 0.1, 2, 0.014), mat(cols[i % cols.length])); cu.position.set(w >= d ? along : across, y + 0.0175, w >= d ? across : along); cu.raycast = () => {}; g.add(cu);
    }
    return g;
  },
  stairs(w, d, H, c, o) {
    // Chunky switchback stairs: a flight up one side, a landing, a flight back up the other side, and so on.
    // Each flight is one solid piece (stepped on top, a smooth sloping underside), with a solid wall on the
    // outside and a wall down the middle between the two sides; slim posts hold up the landings. Where the top
    // landing meets a room's door, that side of the landing is open and a threshold crosses the gap.
    const L = Math.max(w, d) - 2 * GAP, W = Math.min(w, d) - 2 * GAP, n = Math.max(1, Math.round(H / LEVEL));
    const land = Math.min(0.2, L * 0.2), run = L - 2 * land, steps = 7, rise = LEVEL / steps, thick = 0.06, spine = 0.03, lw = (W - spine) / 2, wall = 0.024, rail = 0.12;
    const flat = [], walls = [], box = (sx, sy, sz, x, y, z, list = flat) => list.push(new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z));
    const solid = (pts, len, z, list = flat) => { const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))); list.push(new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false }).translate(0, 0, z - len / 2)); };
    // The way out at the top, in this piece's own frame (before any turn): along its length (ex) or to a side (ez).
    const ang = o?.box ? turnAngle(o.box) : 0, exits = (o?.box?.exits || []).map(([dx, dz]) => { const x = dx * Math.cos(ang) + dz * Math.sin(ang), z = -dx * Math.sin(ang) + dz * Math.cos(ang); return d > w ? [Math.round(-z), Math.round(x)] : [Math.round(x), Math.round(z)]; });
    const ex = exits.find(e => e[0])?.[0] || 0, ez = exits.find(e => e[1])?.[1] || 0;
    const lastDir = (n - 1) % 2 ? -1 : 1, start = ex ? ex * lastDir : 1;
    for (let k = 0; k < n; k++) {
      const y0 = k * LEVEL, dir = start * (k % 2 ? -1 : 1), side = k % 2 ? 1 : -1, zc = side * (spine / 2 + lw / 2), X = x => x * dir;
      const pts = [[X(-run / 2), y0]];
      for (let i = 0; i < steps; i++) { const y = y0 + rise * (i + 1); pts.push([X(-run / 2 + (run * i) / steps), y], [X(-run / 2 + (run * (i + 1)) / steps), y]); }
      if (k === 0) pts.push([X(run / 2), 0]); else pts.push([X(run / 2), y0 + LEVEL - thick], [X(-run / 2), y0 - thick]);
      solid(pts, lw, zc);
      // The solid wall on the outside of the flight.
      const lo0 = k === 0 ? 0 : y0 - thick, lo1 = k === 0 ? 0 : y0 + LEVEL - thick;
      solid([[X(-run / 2), lo0], [X(run / 2), lo1], [X(run / 2), y0 + LEVEL + rail], [X(-run / 2), y0 + rail]], wall, side * (W / 2 - wall / 2), walls);
      // The landing at the top, across both sides, with a low wall round it and two posts under its corners.
      const lx = dir * (run / 2 + land / 2), top = y0 + LEVEL, last = k === n - 1;
      box(land, thick, W, lx, top - thick / 2, 0);
      if (!(last && ex === dir)) box(wall, rail + thick, W, dir * (L / 2 - wall / 2), top - thick + (rail + thick) / 2, 0, walls);
      for (const s of [-1, 1]) if (!(last && ez === s)) box(land, rail + thick, wall, lx, top - thick + (rail + thick) / 2, s * (W / 2 - wall / 2), walls);
      for (const s of [-1, 1]) flat.push(new THREE.CylinderGeometry(0.018, 0.018, top - thick, 10).translate(dir * (L / 2 - 0.04), (top - thick) / 2, s * (W / 2 - 0.04)));
      // The threshold across the gap to the room's door.
      if (last && ex === dir) box(2 * GAP + 0.03, thick, Math.min(W, 0.34), dir * (L / 2 + GAP), top - thick / 2, 0);
      if (last && ez) box(land, thick, 2 * GAP + 0.03, lx, top - thick / 2, ez * (W / 2 + GAP));
    }
    // The wall down the middle, from the ground to a rail above the top flight.
    box(run, H + rail, spine, 0, (H + rail) / 2, 0, walls);
    const clean = list => mergeGeometries(list.map(p => (p.index ? p.toNonIndexed() : p)).map(p => { if (p.attributes.uv) p.deleteAttribute('uv'); return p; }));
    const geo = clean(flat), wgeo = clean(walls);
    if (d > w) { geo.rotateY(Math.PI / 2); wgeo.rotateY(Math.PI / 2); }
    const g = new THREE.Group(), steps3 = mesh(geo, mat(c)); steps3.userData.noInk = true;      // (only the walls carry outlines)
    g.add(steps3, mesh(wgeo, mat(c))); return g;
  },
  spiral(w, d, H, c) {
    // A spiral staircase: steps winding round a pole, with a handrail.
    const g = new THREE.Group(), n = Math.max(1, Math.round(H / LEVEL)), per = 12, R = Math.min(w, d) / 2 - GAP - 0.04;
    g.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, H + 0.12, 10).translate(0, (H + 0.12) / 2, 0), mat(WHITE)));
    const parts = [];
    for (let i = 0; i < n * per; i++) {
      const a = i * (Math.PI * 2 / per) * 0.9, y = (i + 1) * (LEVEL / per);
      const st = new THREE.BoxGeometry(R - 0.04, 0.03, 0.15).translate((R - 0.04) / 2 + 0.04, y - 0.015, 0).rotateY(-a);
      parts.push(st);
    }
    g.add(mesh(mergeGeometries(parts.map(p => { p.deleteAttribute('uv'); return p; })), mat(c)));
    const pts = [];
    for (let i = 0; i <= n * per; i++) { const a = i * (Math.PI * 2 / per) * 0.9; pts.push(new THREE.Vector3(Math.cos(a) * R, i * (LEVEL / per) + 0.14, Math.sin(a) * R)); }
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 40, 0.014, 6, false), mat(shade(c, 0.7))));
    return g;
  },
  slide(w, d, H, c) {
    // A helter-skelter: a stripy tower with a little cabin on top and a tube slide spiralling round it.
    const L = Math.max(w, d), g = new THREE.Group(), top = H, x0 = -L / 2 + 0.5, bands = Math.max(3, Math.round(H / 0.18));
    for (let i = 0; i < bands; i++) {
      const hh = top / bands, band = mesh(new THREE.CylinderGeometry(0.21, 0.24, hh, 20), mat(i % 2 ? WHITE : '#e2457d'));
      band.position.set(x0, hh * (i + 0.5), 0); g.add(band);
    }
    const cabin = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 20), mat(WHITE)); cabin.position.set(x0, top + 0.09, 0); g.add(cabin);
    const roof = mesh(new THREE.ConeGeometry(0.34, 0.34, 20), mat('#e2457d')); roof.position.set(x0, top + 0.35, 0); g.add(roof);
    const flag = mesh(new THREE.BoxGeometry(0.12, 0.07, 0.01), mat('#f7c22e')); flag.position.set(x0 + 0.07, top + 0.62, 0); g.add(flag);
    const pole = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 5), mat(WHITE)); pole.position.set(x0, top + 0.58, 0); g.add(pole);
    // A door at the foot of the tower, on the front, with a step: the way in to the stairs up.
    g.add(mesh(new THREE.BoxGeometry(0.2, 0.27, 0.03).translate(x0, 0.135, 0.228), mat(WHITE)));
    g.add(mesh(new THREE.BoxGeometry(0.15, 0.24, 0.03).translate(x0, 0.12, 0.236), mat('#3d405b')));
    g.add(mesh(new THREE.BoxGeometry(0.22, 0.02, 0.1).translate(x0, 0.01, 0.28), mat('#e6e1d6')));
    // The slide: out of the cabin at the top, round and round the tower, then out along the next square.
    const pts = [new THREE.Vector3(x0 + 0.04, top + 0.1, 0), new THREE.Vector3(x0 + 0.3, top + 0.06, 0.02)], turns = Math.max(1.5, H * 1.6), R = 0.4;
    for (let i = 1; i <= 64; i++) { const t = i / 64, a = 0.3 + t * turns * Math.PI * 2; pts.push(new THREE.Vector3(x0 + Math.cos(a) * R, top - 0.02 - t * (top - 0.28), Math.sin(a) * R)); }
    const last = pts[pts.length - 1];
    pts.push(new THREE.Vector3(x0 + 0.62, 0.17, last.z * 0.4), new THREE.Vector3(L / 2 - 0.3, 0.1, 0), new THREE.Vector3(L / 2 - 0.08, 0.11, 0));
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.TubeGeometry(curve, 240, 0.085, 10, false);
    const uv = tube.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * curve.getLength() * 3);
    g.add(mesh(tube, mat(WHITE, { map: stripes(c) })));
    // A child: whizzes down sitting, climbs out at the bottom, walks round to the door and goes in to climb up again.
    const rider = new THREE.Group(), sit = miniKid('sit'), walker = miniKid('stand');
    sit.scale.setScalar(0.75); walker.scale.setScalar(0.75); sit.position.y = -(SEAT - 0.058) * 0.75; rider.add(sit, walker);      // (sits at the bottom of the tube)
    const legs = [], arms = []; walker.traverse(o => { if (o.userData.limb === 'leg') legs.push(o); if (o.userData.limb === 'arm') arms.push(o); });
    const path = [new THREE.Vector3(L / 2 + 0.06, 0, 0), new THREE.Vector3(x0 + 0.8, 0, 0.6), new THREE.Vector3(x0, 0, 0.4)];
    const lens = [0]; for (let i = 1; i < path.length; i++) lens.push(lens[i - 1] + path[i].distanceTo(path[i - 1]));
    rider.userData.slide = { curve, period: 3.4, pause: 2.6, sit, walker, legs, arms, path, lens, walk: lens[lens.length - 1] / 0.33 };
    g.add(rider);
    if (d > w) g.rotation.y = Math.PI / 2;          // (turned so the door and the walk back stay on the front, in view)
    const out = new THREE.Group(); out.add(g); return out;
  },
  pool(w, d, H, c) {
    const W = w - 2 * GAP, D = d - 2 * GAP, g = new THREE.Group();
    const rim = roundedRect(W, D, 0.12); rim.holes.push(roundedRect(W - 0.24, D - 0.24, 0.06));
    g.add(mesh(upExtrude(rim, 0.13), mat(c)));
    const water = mesh(new THREE.ShapeGeometry(roundedRect(W - 0.24, D - 0.24, 0.06)).rotateX(-Math.PI / 2), mat('#5fd0ea', { emissive: '#1d7fa0', emissiveIntensity: 0.25 }), false);
    water.position.y = 0.09; g.add(water);
    g.userData.swim = { w: W - 0.4, d: D - 0.4, y: 0.09 };
    // Lanes along the long side.
    const L = Math.max(W, D) - 0.4, lanes = Math.max(2, Math.round(Math.min(W, D) * 2.5));
    for (let i = 1; i < lanes; i++) {
      const off = -Math.min(W, D) / 2 + 0.12 + ((Math.min(W, D) - 0.24) * i) / lanes;
      const lane = new THREE.Mesh(new THREE.BoxGeometry(W > D ? L : 0.02, 0.005, W > D ? 0.02 : L), mat(WHITE));
      lane.position.set(W > D ? 0 : off, 0.095, W > D ? off : 0); g.add(lane);
    }
    return g;
  },
  track(w, d, H, c) {
    const W = w - 2 * GAP, D = d - 2 * GAP, g = new THREE.Group();
    g.add(mesh(new RoundedBoxGeometry(W, 0.06, D, 2, 0.02).translate(0, 0.03, 0), mat('#c9df9a')));
    const band = Math.min(0.3, Math.min(W, D) * 0.22);
    const s = roundedRect(W - 0.06, D - 0.06, Math.min(W, D) / 2); s.holes.push(roundedRect(W - 0.06 - 2 * band, D - 0.06 - 2 * band, Math.max(0.05, Math.min(W, D) / 2 - band)));
    const tr = mesh(upExtrude(s, 0.025), mat(c)); tr.position.y = 0.06; g.add(tr);
    // White lane markings painted on the track: both edges, three lane lines, and a start line across the straight.
    const strips = [];
    for (const k of [0.03, 0.27, 0.5, 0.73, 0.97]) {
      const Wk = W - 0.06 - 2 * band * k, Dk = D - 0.06 - 2 * band * k, rk = Math.min(W, D) / 2 - band * k;
      const ring = roundedRect(Wk + 0.012, Dk + 0.012, rk + 0.006); ring.holes.push(roundedRect(Wk - 0.012, Dk - 0.012, Math.max(0.03, rk - 0.006)));
      const flat = new THREE.ShapeGeometry(ring, 14).rotateX(-Math.PI / 2); if (flat.attributes.normal.getY(0) < 0) flat.rotateX(Math.PI);      // (face up, whichever way the outline winds)
      strips.push(flat.translate(0, 0.1015, 0));       // (the track's top, bevel and all, is at 0.1)
    }
    strips.push(W >= D ? new THREE.BoxGeometry(0.02, 0.004, band).translate(0, 0.1, D / 2 - 0.03 - band / 2) : new THREE.BoxGeometry(band, 0.004, 0.02).translate(W / 2 - 0.03 - band / 2, 0.1, 0));
    const lanes = mesh(mergeGeometries(strips.map(s => { const n = s.index ? s.toNonIndexed() : s; n.deleteAttribute('uv'); return n; })), mat(WHITE), false); lanes.userData.noInk = true; g.add(lanes);
    // A football pitch on the infield, kept well inside the track: brighter grass, white markings, a goal at
    // each end and a flag at each corner.
    const iw = W - 0.06 - 2 * band - 0.12, id = D - 0.06 - 2 * band - 0.12;
    if (iw > 0.7 && id > 0.45) {
      const pitch = new THREE.Group(), L = Math.max(iw, id) - 0.3, B = Math.min(iw, id) - 0.1, y = 0.064, white = new THREE.LineBasicMaterial({ color: '#ffffff' });
      pitch.add(mesh(new THREE.BoxGeometry(L, 0.006, B).translate(0, 0.061, 0), mat('#a6d86e'), false));
      const seg = [], R = Math.min(B * 0.18, 0.12), ga = Math.min(L * 0.16, 0.22), gw = B * 0.5;
      const line = (x0, z0, x1, z1) => seg.push(x0, y, z0, x1, y, z1);
      line(-L / 2, -B / 2, L / 2, -B / 2); line(L / 2, -B / 2, L / 2, B / 2); line(L / 2, B / 2, -L / 2, B / 2); line(-L / 2, B / 2, -L / 2, -B / 2);
      line(0, -B / 2, 0, B / 2);
      for (const s of [-1, 1]) { line(s * L / 2, -gw / 2, s * (L / 2 - ga), -gw / 2); line(s * (L / 2 - ga), -gw / 2, s * (L / 2 - ga), gw / 2); line(s * (L / 2 - ga), gw / 2, s * L / 2, gw / 2); }
      for (let i = 0; i < 32; i++) { const a0 = (i / 32) * Math.PI * 2, a1 = ((i + 1) / 32) * Math.PI * 2; line(Math.cos(a0) * R, Math.sin(a0) * R, Math.cos(a1) * R, Math.sin(a1) * R); }
      pitch.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(seg, 3)), white));
      // Goals: two posts, a crossbar and a little net frame behind.
      const gh = 0.08, gwid = Math.min(B * 0.34, 0.26), post = (x, z) => mesh(new THREE.CylinderGeometry(0.006, 0.006, gh, 6).translate(x, 0.06 + gh / 2, z), mat(WHITE), false);
      for (const s of [-1, 1]) {
        const gx = s * (L / 2 + 0.01), back = s * (L / 2 + 0.05);
        pitch.add(post(gx, -gwid / 2), post(gx, gwid / 2), mesh(new THREE.BoxGeometry(0.012, 0.012, gwid + 0.012).translate(gx, 0.06 + gh, 0), mat(WHITE), false));
        pitch.add(mesh(new THREE.BoxGeometry(Math.abs(back - gx), 0.006, 0.006).translate((gx + back) / 2, 0.06 + gh, -gwid / 2), mat(WHITE), false), mesh(new THREE.BoxGeometry(Math.abs(back - gx), 0.006, 0.006).translate((gx + back) / 2, 0.06 + gh, gwid / 2), mat(WHITE), false));
        const net = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(back - gx), gh, gwid).translate((gx + back) / 2, 0.06 + gh / 2, 0), mat('#ffffff', { transparent: true, opacity: 0.35, depthWrite: false })); net.userData.noInk = true; net.raycast = () => {}; pitch.add(net);
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { pitch.add(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.07, 5).translate(sx * L / 2, 0.095, sz * B / 2), mat(WHITE), false)); pitch.add(mesh(new THREE.BoxGeometry(0.03, 0.02, 0.004).translate(sx * L / 2 + 0.015, 0.12, sz * B / 2), mat('#f7c22e'), false)); }
      if (id > iw) pitch.rotation.y = Math.PI / 2;
      g.add(pitch);
    }
    return g;
  },
  garden(w, d, H, c, o) {
    // A school garden: a lawn with a low stone edge, a raised vegetable bed, a bug hotel, stepping stones, a
    // watering can, flowers and a tree. Small things of one colour are merged into one mesh.
    const W = w - 2 * GAP, D = d - 2 * GAP, g = new THREE.Group(), bits = new Map(), r = seeded(o.id || 3);
    const add = (col, geo) => { if (!bits.has(col)) bits.set(col, []); bits.get(col).push(geo); };
    const edge = roundedRect(W, D, 0.06); edge.holes.push(roundedRect(W - 0.06, D - 0.06, 0.04));
    g.add(mesh(new THREE.ExtrudeGeometry(edge, { depth: 0.035, bevelEnabled: false }).rotateX(-Math.PI / 2), mat('#e9e4d8')));
    g.add(mesh(new THREE.ExtrudeGeometry(roundedRect(W - 0.06, D - 0.06, 0.04), { depth: 0.02, bevelEnabled: false }).rotateX(-Math.PI / 2), mat('#8fcf5b')));
    const long = W >= D, hx = W / 2 - 0.08, hz = D / 2 - 0.08, flip = r() < 0.5 ? 1 : -1;
    // The tree in one corner (more trees in a big garden).
    for (let i = 0; i < Math.max(1, Math.round(w * d / 2)); i++) { const t = roundTree(0.17 + r() * 0.06, TREE_GREENS[i % TREE_GREENS.length]); t.position.set(i ? (r() - 0.5) * (W - 0.4) : -flip * (hx - 0.12), 0.02, i ? (r() - 0.5) * (D - 0.4) : -(hz - 0.12)); g.add(t); }
    // Raised vegetable beds along the far side: cabbages, carrots and lettuces in rows.
    const beds = Math.max(1, Math.floor(Math.max(w, d) / 1.5));
    for (let b = 0; b < beds; b++) {
      const bl = Math.min(0.42, (long ? W : D) / beds - 0.12), bw = 0.16, cx = long ? -W / 2 + (b + 0.5) * W / beds + flip * 0.05 : hx - bw / 2, cz = long ? hz - bw / 2 : -D / 2 + (b + 0.5) * D / beds;
      const sx = long ? bl : bw, sz = long ? bw : bl;
      add('#b5875a', new THREE.BoxGeometry(sx, 0.05, sz).translate(cx, 0.045, cz)); add('#6b4a32', new THREE.BoxGeometry(sx - 0.02, 0.004, sz - 0.02).translate(cx, 0.071, cz));
      for (let row = 0; row < 3; row++) for (let k = 0; k < 5; k++) {
        const u = -0.4 + k * 0.2, v = (row - 1) * 0.045, px = cx + (long ? u * (bl - 0.04) : v), pz = cz + (long ? v : u * (bl - 0.04));
        if (row === 0) add('#7db45a', new THREE.SphereGeometry(0.018, 7, 5).scale(1, 0.75, 1).translate(px, 0.083, pz));
        else if (row === 1) { add('#f28b30', new THREE.ConeGeometry(0.008, 0.012, 6).rotateX(Math.PI).translate(px, 0.076, pz)); add('#5f9a4c', new THREE.ConeGeometry(0.01, 0.026, 5).translate(px, 0.093, pz)); }
        else add('#a3d140', new THREE.SphereGeometry(0.014, 7, 5).scale(1, 0.6, 1).translate(px, 0.079, pz));
      }
    }
    // A bug hotel: a little wooden house stuffed with logs and canes.
    const bx = flip * (hx - 0.07), bz = -(hz - 0.06);
    add('#b5875a', new THREE.BoxGeometry(0.1, 0.11, 0.06).translate(bx, 0.075, bz));
    for (const sg of [-1, 1]) add('#8a5a3b', new THREE.BoxGeometry(0.075, 0.006, 0.07).rotateZ(-sg * 0.6).translate(bx + sg * 0.028, 0.148, bz));
    for (let i = 0; i < 9; i++) { const ux = (i % 3 - 1) * 0.03, uy = Math.floor(i / 3) * 0.032; add(i % 2 ? '#e8cfa4' : '#c99a6b', new THREE.CircleGeometry(0.012, 8).translate(bx + ux, 0.04 + uy, bz + 0.0305)); add('#4a3426', new THREE.CircleGeometry(0.004, 6).translate(bx + ux, 0.04 + uy, bz + 0.031)); }
    // Stepping stones across the lawn, and a watering can beside them.
    for (let i = 0; i < 4; i++) { const t = i / 3; add('#cfcac0', new THREE.CylinderGeometry(0.032, 0.034, 0.008, 9).translate(-flip * (hx - 0.1) + flip * t * (2 * hx - 0.3) * 0.6, 0.022, hz - 0.08 - t * 0.12 - (long ? 0.18 : 0))); }
    const wx = flip * 0.1, wz = 0.12;
    add('#3d8de0', new THREE.CylinderGeometry(0.022, 0.024, 0.04, 10).translate(wx, 0.04, wz)); add('#3d8de0', new THREE.CylinderGeometry(0.004, 0.005, 0.05, 6).rotateZ(-0.9).translate(wx + 0.035, 0.05, wz)); add('#3d8de0', new THREE.TorusGeometry(0.016, 0.003, 4, 10, Math.PI).translate(wx - 0.004, 0.06, wz));
    // Flowers dotted round the lawn.
    const flowers = ['#f5a3c7', '#f7c22e', '#ffffff', '#e2457d'];
    for (let i = 0; i < 9 * w * d; i++) { const fx = (r() - 0.5) * (W - 0.14), fz = (r() - 0.5) * (D - 0.14); if (Math.abs(fz - (hz - 0.08)) < 0.1 || Math.hypot(fx - bx, fz - bz) < 0.1) continue; add(flowers[i % 4], new THREE.SphereGeometry(0.022, 6, 4).translate(fx, 0.04, fz)); add('#5f9a4c', new THREE.CylinderGeometry(0.002, 0.002, 0.02, 3).translate(fx, 0.03, fz)); }
    for (const [col, list] of bits) g.add(mesh(mergeGeometries(list.map(x => { const y = x.index ? x.toNonIndexed() : x; if (y.attributes.uv) y.deleteAttribute('uv'); return y; })), mat(col), col !== '#4a3426'));
    return g;
  },
  tree(w, d, H, c, o) {
    const g = new THREE.Group(), r = seeded(o.id || 5);
    for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) {
      const t = roundTree(0.26 + r() * 0.08, TREE_GREENS[Math.floor(r() * TREE_GREENS.length)]);
      t.position.set(-w / 2 + x + 0.5 + (r() - 0.5) * 0.2, 0, -d / 2 + z + 0.5 + (r() - 0.5) * 0.2);
      g.add(t);
    }
    return g;
  },
  turbine(w, d, H, c, o) {
    const g = new THREE.Group(), hgt = 2.1;
    g.add(mesh(new THREE.CylinderGeometry(0.04, 0.08, hgt, 10).translate(0, hgt / 2, 0), mat(WHITE)));
    const hub = new THREE.Group(); hub.position.set(0, hgt, 0.08);
    hub.add(mesh(new THREE.SphereGeometry(0.07, 10, 8), mat(WHITE)));
    for (let i = 0; i < 3; i++) {
      const blade = mesh(new THREE.BoxGeometry(0.06, 0.75, 0.015).translate(0, 0.4, 0), mat(WHITE));
      blade.rotation.z = (i * Math.PI * 2) / 3; hub.add(blade);
    }
    hub.userData.spin = 1.4 + (o.id % 5) * 0.15;
    g.add(hub);
    const nac = mesh(new RoundedBoxGeometry(0.12, 0.1, 0.24, 2, 0.03).translate(0, hgt, -0.02), mat(WHITE)); g.add(nac);
    g.add(mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.05, 20).translate(0, 0.025, 0), mat(c === WHITE ? '#cfcac0' : c)));
    return g;
  },
};

// A greenhouse floor: green planting with brown rows of soil running along it (W across, L along).
function beds(g, W, L, y = 0, alongX = false) {
  const base = mesh(new THREE.BoxGeometry(alongX ? W - 0.04 : W - 0.04, 0.012, alongX ? L - 0.04 : L - 0.04).translate(0, y + 0.006, 0), mat('#8fcf5b'), false);
  g.add(base);
  const across = alongX ? L : W, n = Math.max(2, Math.round(across / 0.16));
  for (let i = 1; i < n; i++) {
    const o = -across / 2 + (across * i) / n, strip = alongX ? new THREE.BoxGeometry(W - 0.12, 0.006, 0.03).translate(0, y + 0.014, o) : new THREE.BoxGeometry(0.03, 0.006, L - 0.12).translate(o, y + 0.014, 0);
    g.add(mesh(strip, mat('#9b6b43'), false));
  }
}

// ---------- surfaces for walls ----------
const texCache = new Map();
function canvasTex(id, draw, size = 128) {
  if (texCache.has(id)) return texCache.get(id);
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  texCache.set(id, t); return t;
}
function rnd(seed) { let a = seed; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; }
const SURF = {
  // Grey patterns get the room's colour; the others bring their own.
  tiles: { tint: true, scale: 2, whole: true, draw: (g, s) => { const r = rnd(7), n = 4, u = s / n; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = 225 + r() * 30; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x * u, y * u, u, u); } g.strokeStyle = 'rgba(150,150,150,0.9)'; g.lineWidth = 3; for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * u, 0); g.lineTo(i * u, s); g.moveTo(0, i * u); g.lineTo(s, i * u); g.stroke(); } } },
  // Dazzle: bold stripes in the room's colour and white, in patches that run different ways (like dazzle ships).
  dazzle: { tint: false, perColour: true, size: 256, scale: 1.2, draw: (g, s, hex) => {
    const r = rnd(13);
    const stripes = (ang, sw, gap) => { g.save(); g.translate(s / 2, s / 2); g.rotate(ang); g.fillStyle = hex; for (let x = -s * 1.5; x < s * 1.5; x += sw + gap) g.fillRect(x, -s * 1.5, sw, s * 3); g.restore(); };
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s);
    stripes(0.45, 11, 11);
    for (let i = 0; i < 4; i++) {
      const cx = r() * s, cy = r() * s, a0 = r() * Math.PI * 2, a1 = a0 + 0.9 + r() * 1.2, R = s * 1.6;
      g.save(); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R); g.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R); g.closePath(); g.clip();
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s);
      const sw = 6 + r() * 10; stripes(r() * Math.PI, sw, sw * (0.7 + r() * 0.6));
      g.restore();
    }
  } },
  brick: { tint: true, scale: 3, draw: (g, s) => { const r = rnd(3), rows = 8, bh = s / rows, bw = s / 4; g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, s, s); for (let y = 0; y < rows; y++) for (let x = -1; x < 5; x++) { const v = 215 + r() * 40, ox = (y % 2) * bw / 2; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x * bw + ox + 2, y * bh + 2, bw - 4, bh - 4); } } },
  wood: { tint: true, scale: 3, draw: (g, s) => { const r = rnd(5), n = 8, u = s / n; for (let x = 0; x < n; x++) { const v = 205 + r() * 50; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x * u, 0, u - 3, s); g.fillStyle = 'rgba(120,120,120,0.9)'; g.fillRect(x * u + u - 3, 0, 3, s); } } },
  glass: { tint: false, scale: 2, whole: true, draw: (g, s) => { const gr = g.createLinearGradient(0, 0, s, s); gr.addColorStop(0, '#d9f1fa'); gr.addColorStop(0.5, '#a9d8ea'); gr.addColorStop(1, '#cfeaf5'); g.fillStyle = gr; g.fillRect(0, 0, s, s); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 10; g.beginPath(); g.moveTo(s * 0.1, s); g.lineTo(s * 0.6, 0); g.stroke(); g.strokeStyle = '#f7f7f4'; g.lineWidth = 6; g.strokeRect(3, 3, s - 6, s - 6); g.beginPath(); g.moveTo(s / 2, 0); g.lineTo(s / 2, s); g.stroke(); } },
  green: { tint: false, scale: 2, whole: true, draw: (g, s) => { const r = rnd(9); g.fillStyle = '#5c9a43'; g.fillRect(0, 0, s, s); const cols = ['#4c8a36', '#7cb85a', '#93c96b', '#3f7a30', '#a9d97a']; for (let i = 0; i < 260; i++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.beginPath(); g.ellipse(r() * s, r() * s, 4 + r() * 6, 3 + r() * 4, r() * 3, 0, Math.PI * 2); g.fill(); } for (let i = 0; i < 14; i++) { g.fillStyle = ['#f5a3c7', '#f7c22e', '#ffffff'][i % 3]; g.beginPath(); g.arc(r() * s, r() * s, 2.5, 0, Math.PI * 2); g.fill(); } } },
  chalk: { tint: false, scale: 1, draw: (g, s) => { g.fillStyle = '#2f463d'; g.fillRect(0, 0, s, s); g.strokeStyle = 'rgba(255,255,255,.85)'; g.fillStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.arc(30, 30, 12, 0, Math.PI * 2); g.stroke(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(30 + Math.cos(a) * 16, 30 + Math.sin(a) * 16); g.lineTo(30 + Math.cos(a) * 22, 30 + Math.sin(a) * 22); g.stroke(); }
    g.font = 'bold 22px sans-serif'; g.fillText('1+1=2', 58, 40); g.beginPath(); g.arc(96, 92, 14, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(96, 95, 7, 0.2, Math.PI - 0.2); g.stroke(); g.fillRect(90, 86, 3, 3); g.fillRect(100, 86, 3, 3);
    g.beginPath(); g.moveTo(16, 110); for (let x = 16; x < 70; x += 6) g.lineTo(x, 100 + Math.sin(x) * 6); g.stroke(); g.beginPath(); g.moveTo(40, 64); g.lineTo(48, 80); g.lineTo(30, 70); g.lineTo(50, 70); g.lineTo(32, 80); g.closePath(); g.stroke(); } },
};
// UVs from each face's direction, so a pattern lies evenly on walls of any shape.
function boxUV(geo, scale) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); } else if (ax >= az) { u = p.getZ(i); v = p.getY(i); } else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
function applySurface(g, box) {
  const body = mat(box.hex), meshes = [];
  g.traverse(o => { if (o.isMesh && (o.material === body || (Array.isArray(o.material) && o.material[0] === body))) meshes.push(o); });
  if (box.surface === 'climb') { for (const m of meshes) m.parent.add(climbingHolds(m, box.id || 1, box)); return; }
  const S = SURF[box.surface === 'pixel' ? 'dazzle' : box.surface]; if (!S) return;        // (pixels became dazzle)
  const tex = canvasTex(box.surface + (S.perColour ? box.hex : ''), (gc, s) => S.draw(gc, s, box.hex), S.size || 128);
  const m2 = mat(S.tint ? box.hex : '#ffffff', { map: tex });
  for (const m of meshes) {
    if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals(); boxUV(m.geometry, S.scale);
    m.material = Array.isArray(m.material) ? [m2, S.whole ? m2 : m.material[1]] : m2;
  }
}
// Where a building's windows and door are (in its turned frame), so climbing holds leave them clear.
function windowZones(box) {
  const zones = [];
  for (const row of rows(box)) { const runs = wallRuns(box, row.k); for (const o of openings(box, row.k, runs)) zones.push({ run: runs[o.run], s0: o.s0 - 0.03, s1: o.s1 + 0.03, y0: row.y0 + o.y0 - 0.03, y1: row.y0 + o.y1 + 0.03 }); }
  return zones;
}
function nearRun(run, x, z) {
  let best = Infinity, bs = 0;
  for (let i = 0; i < run.pts.length - 1; i++) {
    const [ax, az] = run.pts[i], [bx, bz] = run.pts[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best) { best = d; bs = run.s[i] + Math.sqrt(l2) * t; }
  }
  return [best, bs];
}
// Coloured climbing holds scattered over the outside walls (not over the windows or the door).
function climbingHolds(m, seed, box = null) {
  const geo = m.geometry, p = geo.attributes.position, idx = geo.index, tris = [], A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), N = new THREE.Vector3();
  const count = idx ? idx.count : p.count;
  let total = 0;
  for (let i = 0; i < count; i += 3) {
    const a = idx ? idx.getX(i) : i, b = idx ? idx.getX(i + 1) : i + 1, c = idx ? idx.getX(i + 2) : i + 2;
    A.fromBufferAttribute(p, a); B.fromBufferAttribute(p, b); C.fromBufferAttribute(p, c);
    N.subVectors(B, A).cross(C.clone().sub(A));
    const area = N.length() / 2; if (area < 1e-5) continue;
    N.normalize(); if (Math.abs(N.y) > 0.35) continue;
    total += area; tris.push({ a: A.clone(), b: B.clone(), c: C.clone(), n: N.clone(), acc: total });
  }
  const r = rnd(seed * 7 + 1), n = Math.min(220, Math.max(10, Math.round(total * 26)));
  const holds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.028, 0), new THREE.MeshLambertMaterial({ color: '#ffffff' }), n);
  const cols = ['#e6463c', '#f7c22e', '#3d8de0', '#a3d140', '#f28b30', '#e2457d', '#7c46a8'];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pos = new THREE.Vector3(), col = new THREE.Color();
  const zones = box ? windowZones(box) : [], ang = box ? turnAngle(box) : 0, co = Math.cos(ang), si = Math.sin(ang);
  const clear = p => { const x = p.x * co - p.z * si, z = p.x * si + p.z * co; return !zones.some(zn => { if (p.y < zn.y0 || p.y > zn.y1) return false; const [d, sAt] = nearRun(zn.run, x, z); return d < 0.08 && sAt >= zn.s0 && sAt <= zn.s1; }); };
  let placed = 0;
  for (let tries = 0; placed < n && tries < n * 4 && tris.length; tries++) {
    const k = r() * total, t = tris.find(tt => tt.acc >= k) || tris[tris.length - 1];
    let u = r(), v = r(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
    pos.copy(t.a).addScaledVector(t.b.clone().sub(t.a), u).addScaledVector(t.c.clone().sub(t.a), v).addScaledVector(t.n, 0.008);
    if (!clear(pos)) continue;
    q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)); s.set(0.7 + r() * 0.8, 0.6 + r() * 0.5, 0.7 + r() * 0.8);
    m4.compose(pos, q, s); holds.setMatrixAt(placed, m4); holds.setColorAt(placed, col.set(cols[placed % cols.length])); placed++;
  }
  holds.count = placed;
  holds.castShadow = true;
  holds.raycast = () => {};
  return holds;
}
function stripes(hex) {
  return canvasTex('stripes' + hex, (g, s) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s); g.fillStyle = hex; for (let i = 0; i < 4; i++) g.fillRect(i * s / 4, 0, s / 8, s); }, 64);
}

// ---------- links and landscape ----------
Object.assign(BUILD, {
  bridge(w, d, H, c) {
    // A bridge between buildings: a coloured deck with glass sides.
    const L = Math.max(w, d), W = Math.min(w, d) - 0.3, g = new THREE.Group(), inner = new THREE.Group();
    inner.add(mesh(new RoundedBoxGeometry(L, 0.07, W, 2, 0.02).translate(0, 0.035, 0), mat(c)));
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(L, 0.12, 0.012), glass()); p.position.set(0, 0.13, s * (W / 2 - 0.006)); p.raycast = () => {}; inner.add(p); inner.add(mesh(new THREE.BoxGeometry(L, 0.014, 0.03).translate(0, 0.195, s * (W / 2 - 0.01)), mat(WHITE))); }
    if (d > w) inner.rotation.y = Math.PI / 2;
    g.add(inner); g.userData.walk = { w: d > w ? W - 0.1 : L - 0.1, d: d > w ? L - 0.1 : W - 0.1, y: 0.07 };
    return g;
  },
  tube(w, d, H, c) {
    // A covered tube walkway with round windows, like a giant play tunnel.
    const L = Math.max(w, d), W = Math.min(w, d) - 0.32, th = Math.min(0.38, H * 0.8), g = new THREE.Group(), inner = new THREE.Group();
    inner.add(mesh(new RoundedBoxGeometry(L, th, W, 4, Math.min(W, th) * 0.45).translate(0, th / 2, 0), mat(c)));
    const n = Math.max(2, Math.round(L * 2.5));
    for (let i = 0; i < n; i++) for (const s of [-1, 1]) {
      const x = -L / 2 + (L * (i + 0.5)) / n;
      inner.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 18).rotateX(Math.PI / 2).translate(x, th * 0.55, s * (W / 2 + 0.004)), mat(WHITE)));
      inner.add(mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.022, 18).rotateX(Math.PI / 2).translate(x, th * 0.55, s * (W / 2 + 0.008)), mat('#bfe4f3', { emissive: '#7fc6e0', emissiveIntensity: 0.18 }), false));
    }
    if (d > w) inner.rotation.y = Math.PI / 2;
    g.add(inner);
    return g;
  },
  canopy(w, d, H, c) {
    // A covered walkway on the ground: a thin coloured roof on slim white columns.
    const L = Math.max(w, d), W = Math.min(w, d) - 0.2, g = new THREE.Group(), inner = new THREE.Group(), hh = 0.36;
    inner.add(mesh(new RoundedBoxGeometry(L - 0.06, 0.04, W, 2, 0.015).translate(0, hh, 0), mat(c)));
    inner.add(mesh(new THREE.BoxGeometry(L - 0.04, 0.012, W - 0.1).translate(0, 0.006, 0), mat('#efe9dd')));
    const n = Math.max(2, Math.round(L) + 1);
    for (let i = 0; i < n; i++) for (const s of [-1, 1]) inner.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, hh, 8).translate(-L / 2 + 0.08 + ((L - 0.16) * i) / (n - 1), hh / 2, s * (W / 2 - 0.05)), mat(WHITE)));
    if (d > w) inner.rotation.y = Math.PI / 2;
    g.add(inner); g.userData.walk = { w: d > w ? W - 0.2 : L - 0.2, d: d > w ? L - 0.2 : W - 0.2, y: 0.012 };
    return g;
  },
  swings(w, d, H, c) {
    // A-frames each end, a round beam, and two swings: a seat on two ropes, with a child sitting on it holding the
    // ropes, legs out in front.
    const g = new THREE.Group(), L = Math.max(w, d) - 0.2, hh = 0.42, inner = new THREE.Group(), dark = shade(c, 0.8);
    for (const s of [-1, 1]) {
      for (const k of [-1, 1]) { const leg = mesh(new THREE.CylinderGeometry(0.02, 0.024, hh * 1.1, 10), mat(c)); leg.position.set(s * L / 2, hh / 2, k * 0.13); leg.rotation.x = -k * 0.3; inner.add(leg); }
      inner.add(mesh(new THREE.SphereGeometry(0.032, 12, 8).translate(s * L / 2, hh, 0), mat(dark)));
      inner.add(mesh(new THREE.BoxGeometry(0.08, 0.02, 0.34).translate(s * L / 2, 0.01, 0), mat(dark)));
    }
    inner.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, L + 0.02, 10).rotateZ(Math.PI / 2).translate(0, hh, 0), mat(c)));
    for (const sx of [-L / 4, L / 4]) {
      const pivot = new THREE.Group(); pivot.position.set(sx, hh, 0);
      for (const o of [-0.048, 0.048]) pivot.add(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.3, 5).translate(o, -0.15, 0), mat('#3d405b'), false));
      pivot.add(mesh(new RoundedBoxGeometry(0.13, 0.016, 0.07, 2, 0.006).translate(0, -0.3, 0), mat('#e2457d')));
      const kid = miniKid('swing'); kid.scale.setScalar(0.75); kid.position.set(0, -0.292 - SEAT * 0.75, 0.01); kid.userData.rideKid = true; pivot.add(kid);
      pivot.userData.swing = { amp: 0.7, speed: 2.6 + sx };
      inner.add(pivot);
    }
    if (d > w) inner.rotation.y = Math.PI / 2;
    g.add(inner); return g;
  },
  climbdome(w, d, H, c) {
    // A climbing dome made of bars.
    const g = new THREE.Group(), R = Math.min(w, d) / 2 - 0.08, ico = new THREE.IcosahedronGeometry(R, 1), edges = new THREE.EdgesGeometry(ico), p = edges.attributes.position, bars = [];
    for (let i = 0; i < p.count; i += 2) {
      const a = new THREE.Vector3().fromBufferAttribute(p, i), b = new THREE.Vector3().fromBufferAttribute(p, i + 1);
      if (a.y < -0.02 || b.y < -0.02) continue;
      const len = a.distanceTo(b), mid = a.clone().add(b).multiplyScalar(0.5), bar = new THREE.CylinderGeometry(0.008, 0.008, len, 5);
      bar.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())).translate(mid.x, mid.y, mid.z);
      bars.push(bar);
    }
    g.add(mesh(mergeGeometries(bars.map(x => { x.deleteAttribute('uv'); return x; })), mat(c)));
    { const k = miniKid(); k.position.set(0, R * 0.95, 0); k.scale.setScalar(0.75); k.userData.rideKid = true; g.add(k); }
    { const k = miniKid('climb'); k.position.set(R * 0.72, R * 0.5, 0.1); k.scale.setScalar(0.75); k.rotation.y = -Math.PI / 2; k.rotation.z = 0.35; k.userData.rideKid = true; g.add(k); }
    g.userData.rideInfo = { kind: 'climbdome', R };
    return g;
  },
  roundabout(w, d, H, c) {
    const g = new THREE.Group(), R = Math.min(w, d) / 2 - 0.12, spin = new THREE.Group();
    for (let i = 0; i < 4; i++) spin.add(mesh(new THREE.CylinderGeometry(R, R, 0.03, 24, 1, false, (i / 4) * Math.PI * 2, Math.PI / 2).translate(0, 0.05, 0), mat(i % 2 ? c : '#22b2bf')));
    spin.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 8).translate(0, 0.14, 0), mat(WHITE)));
    spin.add(mesh(new THREE.TorusGeometry(R * 0.6, 0.008, 6, 24).rotateX(Math.PI / 2).translate(0, 0.18, 0), mat(WHITE)));
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2, k = miniKid('hold'); k.position.set(Math.cos(a) * R * 0.75, 0.065, Math.sin(a) * R * 0.75); k.scale.setScalar(0.7); k.rotation.y = -a; k.userData.rideKid = true; spin.add(k); }
    spin.userData.yspin = 1.6; spin.userData.R = R;
    g.add(mesh(new THREE.CylinderGeometry(R + 0.02, R + 0.04, 0.035, 24).translate(0, 0.0175, 0), mat('#d2cdc4')));
    g.add(spin); return g;
  },
  seesaw(w, d, H, c) {
    const g = new THREE.Group(), L = Math.max(w, d) - 0.15, inner = new THREE.Group();
    inner.add(mesh(new THREE.ConeGeometry(0.05, 0.1, 4).translate(0, 0.05, 0), mat('#3d405b')));
    const plank = new THREE.Group(); plank.position.y = 0.1;
    plank.add(mesh(new THREE.BoxGeometry(L, 0.02, 0.07), mat(c)));
    for (const s of [-1, 1]) { plank.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 6).translate(s * (L / 2 - 0.1), 0.04, 0), mat(WHITE))); const k = miniKid('ride'); k.userData.rideKid = true; k.position.set(s * (L / 2 - 0.03), 0.01 - SEAT * 0.7, 0); k.scale.setScalar(0.7); k.rotation.y = -s * Math.PI / 2; plank.add(k); }
    plank.userData.rock = { amp: 0.28, speed: 2.2 }; plank.userData.L = L;
    inner.add(plank);
    if (d > w) inner.rotation.y = Math.PI / 2;
    g.add(inner); return g;
  },
  sandpit(w, d, H, c) {
    const g = new THREE.Group(), W = w - 0.16, D = d - 0.16;
    g.add(mesh(new THREE.BoxGeometry(W, 0.05, D).translate(0, 0.025, 0), mat('#d8b98c')));
    g.add(mesh(new THREE.BoxGeometry(W - 0.06, 0.052, D - 0.06).translate(0, 0.027, 0), mat('#f1dfb0')));
    for (let i = 0; i < 4; i++) { const m = mesh(new THREE.SphereGeometry(0.05 + i * 0.012, 10, 6).scale(1, 0.4, 1).translate((i - 1.5) * 0.15, 0.05, (i % 2 - 0.5) * 0.15), mat('#ead39b')); g.add(m); }
    g.add(mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.04, 10).translate(0.1, 0.075, -0.08), mat('#e6463c')));
    g.add(mesh(new THREE.BoxGeometry(0.01, 0.01, 0.07).translate(0.14, 0.06, -0.06), mat('#3d8de0')));
    // A sandcastle with four towers and a flag.
    const castle = [new THREE.BoxGeometry(0.08, 0.035, 0.08).translate(-0.12, 0.07, -0.1)];
    for (const [tx, tz] of [[-0.04, -0.04], [0.04, -0.04], [-0.04, 0.04], [0.04, 0.04]]) castle.push(new THREE.CylinderGeometry(0.017, 0.019, 0.06, 8).translate(-0.12 + tx, 0.082, -0.1 + tz), new THREE.ConeGeometry(0.019, 0.022, 8).translate(-0.12 + tx, 0.123, -0.1 + tz));
    g.add(mesh(mergeGeometries(castle.map(x => (x.index ? x.toNonIndexed() : x))), mat('#e3c88a')));
    g.add(mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.06, 4).translate(-0.08, 0.16, -0.06), mat(WHITE), false));
    g.add(mesh(new THREE.BoxGeometry(0.03, 0.018, 0.002).translate(-0.065, 0.18, -0.06), mat('#e6463c'), false));
    g.add(mesh(new THREE.CylinderGeometry(0.02, 0.016, 0.034, 10).translate(0.16, 0.069, 0.16), mat('#f7c22e')));
    g.userData.seats = [[-0.12, 0.05, 0.1], [0.12, 0.05, 0.12], [0, 0.05, -0.14], [-0.15, 0.05, -0.05]];
    return g;
  },
  playtower(w, d, H, c) {
    const g = new THREE.Group(), top = 0.32;
    for (const [x, z] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) g.add(mesh(new THREE.CylinderGeometry(0.016, 0.016, top + 0.22, 8).translate(x, (top + 0.22) / 2, z), mat(WHITE)));
    g.add(mesh(new THREE.BoxGeometry(0.36, 0.03, 0.36).translate(0, top, 0), mat(c)));
    g.add(mesh(new THREE.ConeGeometry(0.28, 0.2, 4).rotateY(Math.PI / 4).translate(0, top + 0.32, 0), mat('#e2457d')));
    // A little slide down one side and a climbing net up the other.
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.42), mat('#22b2bf')); s.rotation.x = 0.7; s.position.set(0, top / 2, 0.32); s.castShadow = true; g.add(s);
    for (let i = 0; i < 5; i++) g.add(mesh(new THREE.BoxGeometry(0.2, 0.006, 0.006).translate(0, 0.05 + i * 0.06, -0.19 - i * 0.03), mat('#3d405b'), false));
    for (const x of [-0.1, 0, 0.1]) { const rope = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.36, 4), mat('#3d405b'), false); rope.rotation.x = 0.45; rope.position.set(x, top / 2, -0.25); g.add(rope); }
    const k = miniKid(); k.position.set(0.05, top + 0.015, 0); k.scale.setScalar(0.72); k.userData.rideKid = true; g.add(k);
    g.userData.rideInfo = { kind: 'playtower', top };
    return g;
  },
  zipline(w, d, H, c) {
    // A zip line with a little deck and steps to start from, a soft round mat to land on, and a child who zips
    // down holding the bar, lands, walks back along the side and climbs up for another go.
    const g = new THREE.Group(), L = Math.max(w, d) - 0.2, inner = new THREE.Group(), hi = 0.58, lo = 0.4, x0 = -L / 2, x1 = L / 2;
    for (const [x, hh] of [[x0, hi], [x1, lo]]) { inner.add(mesh(new THREE.CylinderGeometry(0.02, 0.025, hh, 8).translate(x, hh / 2, 0), mat(c))); inner.add(mesh(new THREE.BoxGeometry(0.16, 0.025, 0.16).translate(x, 0.0125, 0), mat('#d2cdc4'))); }
    const cable = mesh(new THREE.CylinderGeometry(0.003, 0.003, Math.hypot(L, hi - lo), 4), mat('#3d405b'), false);
    cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(L, lo - hi, 0).normalize()); cable.position.set(0, (hi + lo) / 2, 0); inner.add(cable);
    // The start: a wooden deck round the high post, up three steps on the far side.
    const deckY = 0.2;
    inner.add(mesh(new THREE.BoxGeometry(0.3, 0.03, 0.3).translate(x0 + 0.1, deckY, 0), mat('#d8b98c')));
    for (const [px, pz] of [[-0.05, -0.13], [0.25, -0.13], [-0.05, 0.13], [0.25, 0.13]]) inner.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, deckY, 6).translate(x0 + px, deckY / 2, pz), mat(WHITE)));
    for (let i = 0; i < 3; i++) inner.add(mesh(new THREE.BoxGeometry(0.07, 0.02, 0.16).translate(x0 + 0.28 + i * 0.07, deckY - 0.05 * (i + 1) - 0.0, 0), mat('#d8b98c')));
    for (const s of [-1, 1]) inner.add(mesh(new THREE.BoxGeometry(0.3, 0.012, 0.012).translate(x0 + 0.1, deckY + 0.08, s * 0.15), mat(WHITE), false));
    // The landing: a soft round mat.
    inner.add(mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 24).translate(x1 - 0.2, 0.01, 0), mat('#ffd1dc'), false));
    // The rider: a bar on a strap, a child hanging from it facing the way they go; and the same child walking back.
    const rider = new THREE.Group();
    rider.add(mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.15, 4).translate(0, -0.075, 0), mat('#3d405b'), false));
    rider.add(mesh(new THREE.BoxGeometry(0.012, 0.012, 0.1).translate(0, -0.155, 0), mat('#3d405b'), false));
    const hang = miniKid('hang'); hang.position.set(0, -0.162 - REACH * 0.75, 0); hang.scale.setScalar(0.75); hang.rotation.y = Math.PI / 2; hang.userData.rideKid = true; rider.add(hang);      // (hands on the bar)
    const walker = miniKid('stand'); walker.scale.setScalar(0.75); walker.visible = false;
    const legs = [], arms = []; walker.traverse(o => { if (o.userData.limb === 'leg') legs.push(o); if (o.userData.limb === 'arm') arms.push(o); });
    const path = [new THREE.Vector3(x1 - 0.2, 0, 0.1), new THREE.Vector3(x1 - 0.3, 0, 0.3), new THREE.Vector3(x0 + 0.6, 0, 0.3), new THREE.Vector3(x0 + 0.55, 0, 0)];
    const lens = [0]; for (let i = 1; i < path.length; i++) lens.push(lens[i - 1] + path[i].distanceTo(path[i - 1]));
    inner.userData.zipline = { rider, walker, legs, arms, x0: x0 + 0.1, x1: x1 - 0.2, y0: hi - 0.01, y1: lo - 0.01, period: 3.2, walk: lens[lens.length - 1] / 0.33, pause: 2.4, path, lens };
    inner.add(rider, walker);
    if (d > w) inner.rotation.y = -Math.PI / 2;
    g.add(inner); return g;
  },
  ramp(w, d, H, c) {
    // A gentle ramp rising along the long side, with glass sides and a landing at the top.
    const L = Math.max(w, d) - 2 * GAP, W = Math.min(w, d) - 0.24, g = new THREE.Group(), inner = new THREE.Group(), land = 0.3;
    const run = L - land, ang = Math.atan2(H, run), len = Math.hypot(run, H);
    const deck = mesh(new THREE.BoxGeometry(len, 0.05, W), mat(c)); deck.rotation.z = ang; deck.position.set(-L / 2 + run / 2, H / 2 - 0.01, 0); inner.add(deck);
    inner.add(mesh(new THREE.BoxGeometry(land, 0.05, W).translate(L / 2 - land / 2, H - 0.025, 0), mat(c)));
    if (H > 0.3) for (const fx of [-L / 2 + run * 0.5, L / 2 - land / 2]) inner.add(mesh(new THREE.BoxGeometry(0.05, fx > 0 ? H : H / 2, 0.05).translate(fx, (fx > 0 ? H : H / 2) / 2, 0), mat(WHITE)));
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.1, 0.01), glass()); rail.rotation.z = ang; rail.position.set(-L / 2 + run / 2, H / 2 + 0.06, s * (W / 2 - 0.005)); rail.raycast = () => {}; inner.add(rail);
      const hand = mesh(new THREE.BoxGeometry(len, 0.012, 0.025), mat(WHITE), false); hand.rotation.z = ang; hand.position.set(-L / 2 + run / 2, H / 2 + 0.115, s * (W / 2 - 0.01)); inner.add(hand);
    }
    if (d > w) inner.rotation.y = -Math.PI / 2;
    g.add(inner);
    g.userData.walk = { w: d > w ? W - 0.1 : L - 0.1, d: d > w ? L - 0.1 : W - 0.1, y: 0.03 };
    return g;
  },
  terraces(w, d, H, c) {
    // Tree terraces: rings of seats stepping up round a big tree (after MVRDV's Back to the Roots).
    const g = new THREE.Group(), R = Math.min(w, d) / 2 - GAP, tiers = 3, step = (R - 0.32) / tiers, seats = [];
    g.add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 32).translate(0, 0.015, 0), mat('#8fcf5b')));
    for (let k = 0; k < tiers; k++) {
      const r0 = 0.32 + k * step, r1 = r0 + step, hh = 0.06 * (k + 1);
      const s = new THREE.Shape(); s.absarc(0, 0, r1, 0, Math.PI * 2, false);
      const hole = new THREE.Path(); hole.absarc(0, 0, r0, 0, Math.PI * 2, true); s.holes.push(hole);
      const ring = mesh(new THREE.ExtrudeGeometry(s, { depth: hh, bevelEnabled: false, curveSegments: 40 }).rotateX(-Math.PI / 2), mat(k % 2 ? '#8fcf5b' : c));
      g.add(ring);
      if (k % 2 === 0) { const n = Math.round(r1 * 9); for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + k; seats.push([Math.cos(a) * (r0 + step * 0.5), hh, Math.sin(a) * (r0 + step * 0.5)]); } }
    }
    const tree = roundTree(Math.min(0.5, R * 0.42), TREE_GREENS[2]); tree.position.y = 0.03; g.add(tree);
    g.userData.seats = seats;
    return g;
  },
});

// ---------- Astra Nova pieces ----------
Object.assign(BUILD, {
  rocket(w, d, H, c) {
    // A launch pad in a park, not a factory: a slab painted in black-and-white dazzle, a low white fence round it
    // with a gap at the front, bushes in planters at the back corners, and a mini Starship on its booster beside a
    // white tower whose two chopstick arms catch the rocket when it comes back.
    const g = new THREE.Group(), W = w - 2 * GAP, D = d - 2 * GAP, rx = 0.12, dark = '#2b2f36', steel = '#d6d9dd';
    g.add(mesh(new RoundedBoxGeometry(W, 0.1, D, 2, 0.02).translate(0, 0.05, 0), mat('#3d4149')));
    const pw = W - 0.06, pd = D - 0.06;
    const paint = canvasTex('padbw', (gc, s) => SURF.dazzle.draw(gc, s, '#23252b'), 512); paint.repeat.set(2, 2);
    const top = mesh(new THREE.PlaneGeometry(pw, pd).rotateX(-Math.PI / 2).translate(0, 0.101, 0), mat('#ffffff', { map: paint }), false); top.userData.noInk = true; g.add(top);
    // The launch mount: a dark ring the booster stands on, on a plain circle of the pad.
    g.add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.004, 32).translate(rx, 0.104, 0), mat('#3d4149'), false));
    const ring = new THREE.Shape(); ring.absarc(0, 0, 0.22, 0, Math.PI * 2, false); ring.holes.push((() => { const hole = new THREE.Path(); hole.absarc(0, 0, 0.165, 0, Math.PI * 2, true); return hole; })());
    g.add(mesh(new THREE.ExtrudeGeometry(ring, { depth: 0.06, bevelEnabled: false, curveSegments: 24 }).rotateX(-Math.PI / 2).translate(rx, 0.14, 0), mat(dark)));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.04, 6).translate(rx + Math.cos(a) * 0.195, 0.12, Math.sin(a) * 0.195), mat(dark))); }
    // The fence: white posts and two rails, open at the front.
    const posts = [], rails = [], fy = 0.1, ph = 0.09;
    const run = (x0, z0, x1, z1, gap) => {
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(len / 0.14)), dx = (x1 - x0) / n, dz = (z1 - z0) / n;
      for (let i = 0; i <= n; i++) { const x = x0 + dx * i, z = z0 + dz * i; if (gap && Math.abs(x) < 0.17) continue; posts.push(new THREE.BoxGeometry(0.014, ph, 0.014).translate(x, fy + ph / 2, z)); }
      for (let i = 0; i < n; i++) { const xa = x0 + dx * i, za = z0 + dz * i, xb = xa + dx, zb = za + dz; if (gap && (Math.abs(xa) < 0.17 || Math.abs(xb) < 0.17)) continue; for (const yy of [0.045, 0.08]) rails.push(new THREE.BoxGeometry(dx ? Math.abs(dx) : 0.01, 0.01, dz ? Math.abs(dz) : 0.01).translate((xa + xb) / 2, fy + yy, (za + zb) / 2)); }
    };
    const e = 0.035;
    run(-W / 2 + e, -D / 2 + e, W / 2 - e, -D / 2 + e, false); run(-W / 2 + e, D / 2 - e, W / 2 - e, D / 2 - e, true);
    run(-W / 2 + e, -D / 2 + e, -W / 2 + e, D / 2 - e, false); run(W / 2 - e, -D / 2 + e, W / 2 - e, D / 2 - e, false);
    const strip = gs => mergeGeometries(gs.map(x => { x.deleteAttribute('uv'); return x; }));
    g.add(mesh(strip(posts), mat(WHITE))); g.add(mesh(strip(rails), mat(WHITE), false));
    // Bushes in planters at the back corners.
    for (const sx of [-1, 1]) { const bx = sx * (W / 2 - 0.16), bz = -D / 2 + 0.16; g.add(mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.06, 14).translate(bx, fy + 0.03, bz), mat(WHITE))); g.add(mesh(new THREE.SphereGeometry(0.075, 12, 9).translate(bx, fy + 0.11, bz), mat(TREE_GREENS[sx > 0 ? 1 : 3]))); }
    // The tower: a slim white lattice with diagonal bracing, taller than the rocket, with a flag on top, a dark
    // carriage, and two tapered chopstick arms reaching out either side of the booster, tipped in the pad's colour.
    const gx = -W / 2 + 0.22, gz = 0, gh = 2.5, armY = 1.22, half = 0.07, bars = [];
    for (const [px, pz] of [[-half, -half], [half, -half], [-half, half], [half, half]]) bars.push(new THREE.BoxGeometry(0.022, gh, 0.022).translate(gx + px, gh / 2 + 0.1, gz + pz));
    const lv = 0.25;
    for (let y = 0.1; y < gh + 0.1 - 0.01; y += lv) {
      for (const s of [-1, 1]) {
        bars.push(new THREE.BoxGeometry(2 * half, 0.012, 0.012).translate(gx, y + lv, gz + s * half), new THREE.BoxGeometry(0.012, 0.012, 2 * half).translate(gx + s * half, y + lv, gz));
        // one diagonal per face per level, zig-zagging
        const dl = Math.hypot(2 * half, lv), ang = Math.atan2(lv, 2 * half) * (y / lv % 2 < 1 ? 1 : -1);
        bars.push(new THREE.BoxGeometry(dl, 0.01, 0.01).rotateZ(ang).translate(gx, y + lv / 2, gz + s * half), new THREE.BoxGeometry(0.01, 0.01, dl).rotateX(-ang).translate(gx + s * half, y + lv / 2, gz));
      }
    }
    g.add(mesh(mergeGeometries(bars.map(x => { x.deleteAttribute('uv'); return x; })), mat(WHITE)));
    // The carriage on the tower, and the two chopsticks hinged on pins at its corners (userData.chopstick is which
    // side; the pad swings them open before lift-off and closes them again before the next rocket comes down).
    g.add(mesh(new THREE.BoxGeometry(0.2, 0.16, 0.5).translate(gx, armY, gz), mat(dark)));
    const armL = rx + 0.16 - (gx + 0.1), arm = new THREE.Shape(); arm.moveTo(0, -0.04); arm.lineTo(armL, -0.02); arm.lineTo(armL, 0.02); arm.lineTo(0, 0.04); arm.closePath();
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(gx + 0.1, armY, gz + s * 0.21); pivot.userData.chopstick = s;
      pivot.add(mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.2, 12), mat(dark)));
      pivot.add(mesh(new THREE.ExtrudeGeometry(arm, { depth: 0.05, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, -0.025, 0), mat(dark)));
      pivot.add(mesh(new THREE.BoxGeometry(0.09, 0.054, 0.044).translate(armL - 0.045, 0, 0), mat(c)));
      g.add(pivot);
    }
    g.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.18, 5).translate(gx, gh + 0.19, gz), mat(WHITE), false));
    g.add(mesh(new THREE.BoxGeometry(0.1, 0.06, 0.01).translate(gx + 0.055, gh + 0.25, gz), mat(c), false));
    // The rocket: a stainless booster with grid fins, and the ship on top with its pointed nose, four flaps and a
    // band of black heat-shield tiles down one side.
    const rk = new THREE.Group(); rk.position.set(rx, 0.2, 0);
    rk.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.95, 24).translate(0, 0.475, 0), mat(steel)));
    rk.add(mesh(new THREE.CylinderGeometry(0.156, 0.156, 0.07, 24).translate(0, 0.035, 0), mat(dark)));
    for (let i = 0; i < 7; i++) { const a = (i / 6) * Math.PI * 2, rr = i < 6 ? 0.095 : 0; rk.add(mesh(new THREE.CylinderGeometry(0.028, 0.02, 0.05, 10).translate(Math.cos(a) * rr, -0.025, Math.sin(a) * rr), mat('#5b6069'))); }
    for (let y = 0.2; y < 0.9; y += 0.18) rk.add(mesh(new THREE.CylinderGeometry(0.151, 0.151, 0.012, 24).translate(0, y, 0), mat('#c3c7cc'), false));
    // The flame: two cones that flicker while the rocket flies (and brakes to land), hidden on the pad.
    const flame = new THREE.Group();
    flame.add(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 12).rotateX(Math.PI).translate(0, -0.3, 0), new THREE.MeshBasicMaterial({ color: '#ff8a3d', transparent: true, opacity: 0.85 })));
    flame.add(new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.4, 12).rotateX(Math.PI).translate(0, -0.2, 0), new THREE.MeshBasicMaterial({ color: '#ffe48a', transparent: true, opacity: 0.95 })));
    flame.position.y = -0.04; flame.visible = false; flame.traverse(o => { o.userData.noInk = true; o.raycast = () => {}; }); rk.add(flame); rk.userData.flame = flame;
    for (let i = 0; i < 4; i++) { const fin = mesh(new THREE.BoxGeometry(0.1, 0.07, 0.014).translate(0, 0.9, 0.165), mat('#5b6069')); fin.rotation.y = Math.PI / 4 + (i * Math.PI) / 2; rk.add(fin); }
    rk.add(mesh(new THREE.CylinderGeometry(0.152, 0.152, 0.025, 24).translate(0, 0.96, 0), mat(dark)));
    rk.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.72, 24).translate(0, 1.33, 0), mat(steel)));
    const nose = [], noseT = []; for (let i = 0; i <= 12; i++) { const t2 = i / 12, r2 = 0.15 * Math.pow(Math.cos(t2 * Math.PI / 2), 0.55); nose.push(new THREE.Vector2(r2 + (i === 12 ? 0.0001 : 0), 1.69 + t2 * 0.48)); noseT.push(new THREE.Vector2(r2 + 0.004, 1.69 + t2 * 0.48)); }
    rk.add(mesh(new THREE.LatheGeometry(nose, 24), mat(steel)));
    // Black heat-shield tiles down one side of the ship, running up the nose to the tip.
    rk.add(mesh(new THREE.CylinderGeometry(0.154, 0.154, 0.72, 16, 1, true, Math.PI / 4, Math.PI).translate(0, 1.33, 0), mat(dark, { side: THREE.DoubleSide })));
    rk.add(mesh(new THREE.LatheGeometry(noseT, 12, Math.PI / 4, Math.PI), mat(dark, { side: THREE.DoubleSide })));
    for (const s of [-1, 1]) {
      rk.add(mesh(new THREE.BoxGeometry(0.026, 0.24, 0.13).translate(0, 1.1, s * 0.205), mat(steel)));
      rk.add(mesh(new THREE.BoxGeometry(0.026, 0.14, 0.08).translate(0, 1.8, s * 0.175), mat(steel)));
    }
    rk.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 16).rotateX(Math.PI / 2).translate(0, 1.5, 0.145), mat('#7fd0ea')));
    rk.userData.rocket = true;
    g.add(rk);
    return g;
  },
  observatory(w, d, H, c) {
    // A round tower with a silver dome on a white rim. The dome's shutter is slid open to one side, and the big
    // telescope looks out through the slit at the sky (towards the front, where the door is).
    // (The tower and its rim are open tubes with a flat white ring on top, so from inside you look straight up into
    // the dome; a capped tower would put a lid at the roof line, fighting the rim.)
    const g = new THREE.Group(), r = Math.min(w, d) / 2 - GAP, R = r * 0.98, slit = 0.5, y = H + 0.02;
    g.add(mesh(new THREE.CylinderGeometry(r, r, H, 40, 1, true).translate(0, H / 2, 0), mat(c)));
    g.add(mesh(new THREE.CylinderGeometry(r + 0.012, r + 0.012, 0.025, 40, 1, true).translate(0, H + 0.0125, 0), mat(WHITE)));
    g.add(mesh(new THREE.RingGeometry(R - 0.012, r + 0.012, 40).rotateX(-Math.PI / 2).translate(0, H + 0.025, 0), mat(WHITE, { side: THREE.DoubleSide })));
    g.add(mesh(new THREE.SphereGeometry(R, 36, 14, Math.PI / 2 + slit / 2, Math.PI * 2 - slit, 0, Math.PI / 2).translate(0, y, 0), mat('#dfe5ea', { side: THREE.DoubleSide })));
    g.add(mesh(new THREE.SphereGeometry(R + 0.012, 12, 14, Math.PI / 2 + slit / 2, slit * 1.05, 0.05, Math.PI / 2 - 0.05).translate(0, y, 0), mat('#b9c2c9', { side: THREE.DoubleSide })));
    // A dark lining just inside the dome, so the open slit reads as a dark opening with the telescope in it, not a
    // window onto the room below. (Its faces point outwards, so from inside, walking, you still see the silver dome.)
    const lining = mesh(new THREE.SphereGeometry(R - 0.012, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, y, 0), mat(shade(c, 0.4)), false);
    lining.userData.keep = true; lining.userData.noInk = true; g.add(lining);
    // The telescope: pivoted inside the dome, tilted up through the slit.
    const L = 0.56, up = geo => geo.rotateX(0.7).translate(0, H + 0.06, 0);
    g.add(mesh(up(new THREE.CylinderGeometry(0.055, 0.045, L, 14).translate(0, L / 2, 0)), mat(WHITE)));
    g.add(mesh(up(new THREE.CylinderGeometry(0.058, 0.058, 0.035, 14).translate(0, L - 0.06, 0)), mat('#2e4a8c')));
    g.add(mesh(up(new THREE.CylinderGeometry(0.048, 0.048, 0.006, 14).translate(0, L + 0.002, 0)), mat('#6fcde6')));
    return g;
  },
  greenhouse(w, d, H, c) {
    const L = Math.max(w, d) - 2 * GAP - 0.03, W = Math.min(w, d) - 2 * GAP - 0.03, r = W * 0.42, g = new THREE.Group();
    const frame = new THREE.Group();
    const geo = prism([[-W / 2, 0], [W / 2, 0], [W / 2, H], [0, H + r], [-W / 2, H]], L);
    frame.add(mesh(geo, mat('#d8eef6', { transparent: true, opacity: 0.38, depthWrite: false }), false));
    // White glazing bars.
    for (let i = 0; i <= Math.round(L * 4); i++) {
      const z = -L / 2 + (L * i) / Math.round(L * 4);
      for (const [a, b2] of [[[-W / 2, 0], [-W / 2, H]], [[W / 2, 0], [W / 2, H]], [[-W / 2, H], [0, H + r]], [[W / 2, H], [0, H + r]]]) {
        const len = Math.hypot(b2[0] - a[0], b2[1] - a[1]), bar = mesh(new THREE.BoxGeometry(0.015, len, 0.015), mat(WHITE), false);
        bar.position.set((a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2, z); bar.rotation.z = -Math.atan2(b2[0] - a[0], b2[1] - a[1]); frame.add(bar);
      }
    }
    frame.add(mesh(new THREE.BoxGeometry(0.015, 0.015, L).translate(0, H + r, 0), mat(WHITE), false));
    beds(frame, W, L);
    // Plants inside.
    const r2 = seeded(w * 13 + d);
    for (let i = 0; i < Math.round(L * 6); i++) { const p = mesh(new THREE.SphereGeometry(0.06 + r2() * 0.05, 8, 6), mat(TREE_GREENS[i % TREE_GREENS.length])); p.position.set((r2() - 0.5) * (W - 0.2), 0.08 + r2() * 0.1, (r2() - 0.5) * (L - 0.2)); frame.add(p); }
    for (let i = 0; i < Math.round(L * 3); i++) { const f = mesh(new THREE.SphereGeometry(0.025, 6, 4), mat(['#e2457d', '#f7c22e', '#f5a3c7'][i % 3]), false); f.position.set((r2() - 0.5) * (W - 0.2), 0.2, (r2() - 0.5) * (L - 0.2)); frame.add(f); }
    if (w > d) frame.rotation.y = Math.PI / 2;
    g.add(frame);
    return g;
  },
  glassdome(w, d, H, c) {
    // A round glass dome full of plants, with white ribs.
    const g = new THREE.Group(), R = Math.min(w, d) / 2 - GAP - 0.02;
    g.add(mesh(new THREE.CylinderGeometry(R, R + 0.02, 0.06, 32).translate(0, 0.03, 0), mat(WHITE)));
    g.add(mesh(new THREE.CylinderGeometry(R - 0.03, R - 0.03, 0.012, 40).translate(0, 0.066, 0), mat('#8fcf5b'), false));
    for (let i = 1; i <= 3; i++) { const rr = (R - 0.04) * i / 3.4; g.add(mesh(new THREE.RingGeometry(rr - 0.022, rr, 40).rotateX(-Math.PI / 2).translate(0, 0.073, 0), mat('#9b6b43'), false)); }
    g.add(mesh(new THREE.SphereGeometry(R, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.06, 0), mat('#d8eef6', { transparent: true, opacity: 0.35, depthWrite: false }), false));
    for (let i = 0; i < 8; i++) { const rib = mesh(new THREE.TorusGeometry(R, 0.008, 5, 24, Math.PI), mat(WHITE), false); rib.rotation.y = (i / 8) * Math.PI; rib.position.y = 0.06; g.add(rib); }
    const ring = mesh(new THREE.TorusGeometry(R * 0.72, 0.008, 5, 32).rotateX(Math.PI / 2).translate(0, 0.06 + R * 0.69, 0), mat(WHITE), false); g.add(ring);
    const r2 = seeded(w * 7 + d);
    for (let i = 0; i < Math.round(R * 14); i++) { const a = r2() * Math.PI * 2, rr = r2() * R * 0.7, p = mesh(new THREE.SphereGeometry(0.05 + r2() * 0.05, 8, 6), mat(TREE_GREENS[i % TREE_GREENS.length])); p.position.set(Math.cos(a) * rr, 0.1 + r2() * 0.08, Math.sin(a) * rr); g.add(p); }
    const palm = roundTree(Math.min(0.25, R * 0.35), TREE_GREENS[3]); palm.position.y = 0.06; g.add(palm);
    return g;
  },
  glassvault(w, d, H, c) {
    // A glass tunnel greenhouse: a barrel of glass with white hoops.
    const L = Math.max(w, d) - 2 * GAP, W = Math.min(w, d) - 2 * GAP, r = W / 2, g = new THREE.Group(), inner = new THREE.Group();
    inner.add(mesh(new THREE.BoxGeometry(L, 0.05, W).translate(0, 0.025, 0), mat(WHITE)));
    beds(inner, L, W, 0.05, true);
    const shell = mesh(new THREE.CylinderGeometry(r, r, L, 28, 1, true, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2).rotateX(Math.PI / 2).translate(0, 0.05, 0), mat('#d8eef6', { transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }), false);
    inner.add(shell);
    const hoops = Math.max(3, Math.round(L * 4));
    for (let i = 0; i <= hoops; i++) { const hp = mesh(new THREE.TorusGeometry(r, 0.008, 5, 20, Math.PI), mat(WHITE), false); hp.rotation.y = Math.PI / 2; hp.position.set(-L / 2 + (L * i) / hoops, 0.05, 0); inner.add(hp); }
    const r2 = seeded(w * 11 + d);
    for (let i = 0; i < Math.round(L * 8); i++) { const p = mesh(new THREE.SphereGeometry(0.05 + r2() * 0.04, 8, 6), mat(TREE_GREENS[i % TREE_GREENS.length])); p.position.set((r2() - 0.5) * (L - 0.15), 0.1 + r2() * 0.06, (r2() - 0.5) * (W - 0.3)); inner.add(p); }
    if (d > w) inner.rotation.y = Math.PI / 2;
    g.add(inner);
    return g;
  },
  treehouse(w, d, H, c) {
    const g = new THREE.Group(), top = Math.max(0.6, H * 0.75);
    g.add(mesh(new THREE.CylinderGeometry(0.09, 0.14, top + 0.2, 10).translate(0, (top + 0.2) / 2, 0), mat('#9b7b5c')));
    for (const [x, y, z, r] of [[0, top + 0.45, 0, 0.42], [0.25, top + 0.3, 0.12, 0.28], [-0.24, top + 0.32, -0.1, 0.3], [0.05, top + 0.62, -0.2, 0.26]]) { const b = mesh(new THREE.SphereGeometry(r, 12, 9), mat(TREE_GREENS[Math.round(r * 10) % TREE_GREENS.length])); b.position.set(x, y, z); g.add(b); }
    g.add(mesh(new THREE.BoxGeometry(0.62, 0.04, 0.62).translate(0, top, 0.05), mat('#d8b98c')));
    const hut = mesh(new RoundedBoxGeometry(0.34, 0.26, 0.3, 2, 0.02).translate(0.02, top + 0.15, 0.12), mat(c)); g.add(hut);
    g.add(mesh(new THREE.ConeGeometry(0.28, 0.2, 4).rotateY(Math.PI / 4).translate(0.02, top + 0.38, 0.12), mat(shade(c, 0.7))));
    g.add(mesh(new THREE.BoxGeometry(0.08, 0.12, 0.012).translate(0.02, top + 0.08, 0.275), mat('#3d405b'), false));
    // A rope ladder.
    for (let y = 0.1; y < top; y += 0.08) g.add(mesh(new THREE.BoxGeometry(0.14, 0.012, 0.012).translate(0.2, y, 0.33), mat('#d8b98c'), false));
    for (const x of [0.13, 0.27]) g.add(mesh(new THREE.BoxGeometry(0.01, top, 0.01).translate(x, top / 2, 0.33), mat('#9b7b5c'), false));
    return g;
  },
  stage(w, d, H, c) {
    const L = Math.max(w, d) - 2 * GAP, W = Math.min(w, d) - 2 * GAP, g = new THREE.Group(), inner = new THREE.Group();
    inner.add(mesh(new RoundedBoxGeometry(L, 0.16, W, 2, 0.02).translate(0, 0.08, 0), mat('#d8b98c')));
    // A curved shell behind the stage, like a bandstand.
    const shell = mesh(new THREE.CylinderGeometry(L / 2, L / 2, H * 1.6, 32, 1, true, Math.PI / 2, Math.PI).translate(0, 0.16 + H * 0.8, 0), mat(c, { side: THREE.DoubleSide }));
    shell.scale.z = W / L; inner.add(shell);
    for (let i = 0; i < 5; i++) { const lamp = mesh(new THREE.SphereGeometry(0.03, 8, 6), mat('#f7c22e', { emissive: '#f7c22e', emissiveIntensity: 0.6 }), false); lamp.position.set(-L / 2 + 0.2 + i * (L - 0.4) / 4, 0.2, W / 2 - 0.04); inner.add(lamp); }
    // Red curtains at the two ends of the shell, held back with gold ties.
    for (const s of [-1, 1]) {
      inner.add(mesh(new THREE.BoxGeometry(0.08, H * 1.5, 0.03).translate(s * (L / 2 - 0.06), 0.16 + H * 0.75, -0.03), mat('#c8323c')));
      inner.add(mesh(new THREE.BoxGeometry(0.09, 0.02, 0.036).translate(s * (L / 2 - 0.06), 0.16 + H * 0.5, -0.03), mat('#e8c547'), false));
    }
    // A string of bulbs along the top of the shell.
    const bulbs = [];
    for (let i = 1; i < 12; i++) { const th = Math.PI / 2 + (i / 12) * Math.PI; bulbs.push(new THREE.SphereGeometry(0.018, 6, 4).translate((L / 2) * Math.sin(th) * 0.97, 0.16 + H * 1.6 - 0.02, (W / 2) * Math.cos(th) * 0.97)); }
    inner.add(mesh(mergeGeometries(bulbs.map(x => (x.index ? x.toNonIndexed() : x))), mat('#fff1b8', { emissive: '#ffe08a', emissiveIntensity: 0.7 }), false));
    // A microphone at the front, and two steps up at the side.
    inner.add(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 5).translate(0.1, 0.26, W / 4), mat('#c9ccd3'), false));
    inner.add(mesh(new THREE.SphereGeometry(0.014, 8, 6).translate(0.1, 0.37, W / 4), mat('#3d405b'), false));
    inner.add(mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.012, 10).translate(0.1, 0.166, W / 4), mat('#3d405b'), false));
    for (let i = 0; i < 2; i++) inner.add(mesh(new THREE.BoxGeometry(0.16, 0.05 + i * 0.05, 0.08).translate(L / 2 - 0.2, 0.025 + i * 0.025, W / 2 + 0.04 + (1 - i) * 0.07), mat('#c9a46f')));
    if (d > w) inner.rotation.y = Math.PI / 2;
    g.add(inner);
    return g;
  },
  circle(w, d, H, c) {
    const g = new THREE.Group(), R = Math.min(w, d) / 2 - GAP;
    g.add(mesh(new THREE.CylinderGeometry(R, R, 0.04, 40).translate(0, 0.02, 0), mat('#efe7d6')));
    g.add(mesh(new THREE.RingGeometry(R * 0.35, R * 0.4, 40).rotateX(-Math.PI / 2).translate(0, 0.045, 0), mat(c), false));
    const n = Math.max(8, Math.round(R * 10)), seats = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, x = Math.cos(a) * R * 0.75, z = Math.sin(a) * R * 0.75;
      g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 12).translate(x, 0.08, z), mat(i % 2 ? c : '#f28b30')));
      seats.push([x, 0.12, z]);      // (the stool's top)
    }
    // A big yellow question mark set in the floor in the middle.
    const qm = R * 0.12, qy = 0.0455, turn = g => g.rotateY(Math.PI / 4);      // (turned to read from the usual view)
    g.add(mesh(turn(new THREE.RingGeometry(qm * 0.55, qm, 18, 1, -Math.PI / 2, Math.PI * 1.35).translate(0, qm * 0.55, 0).rotateX(-Math.PI / 2)).translate(0, qy, 0), mat('#f7c22e'), false));
    g.add(mesh(turn(new THREE.PlaneGeometry(qm * 0.45, qm * 0.6).translate(-qm * 0.225 + qm * 0.06, -qm * 0.25, 0).rotateX(-Math.PI / 2)).translate(0, qy, 0), mat('#f7c22e'), false));
    g.add(mesh(turn(new THREE.CircleGeometry(qm * 0.26, 12).translate(-qm * 0.165, -qm * 0.95, 0).rotateX(-Math.PI / 2)).translate(0, qy, 0), mat('#f7c22e'), false));
    // Two banners: two sides of a big question.
    for (const [x, col] of [[-R * 0.95, '#3d8de0'], [R * 0.95, '#f28b30']]) { g.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6).translate(x, 0.25, 0), mat(WHITE))); g.add(mesh(new THREE.BoxGeometry(0.02, 0.18, 0.2).translate(x, 0.4, 0.1), mat(col))); }
    g.userData.seats = seats;
    return g;
  },
  weather(w, d, H, c) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.0, 8).translate(0, 0.5, 0), mat(WHITE)));
    const cups = new THREE.Group(); cups.position.y = 1.02;
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2, arm = mesh(new THREE.BoxGeometry(0.18, 0.01, 0.01).translate(0.09, 0, 0), mat(WHITE)); arm.rotation.y = a; cups.add(arm); const cup = mesh(new THREE.SphereGeometry(0.03, 8, 6, 0, Math.PI), mat('#e6463c')); cup.position.set(Math.cos(a) * 0.18, 0, -Math.sin(a) * 0.18); cups.add(cup); }
    cups.userData.yspin = 2.5;
    g.add(cups);
    const vane = mesh(new THREE.ConeGeometry(0.03, 0.14, 8).rotateZ(-Math.PI / 2).translate(0.05, 0.86, 0), mat('#f7c22e')); g.add(vane);
    const box = mesh(new RoundedBoxGeometry(0.22, 0.18, 0.18, 2, 0.02).translate(0, 0.35, 0.12), mat(WHITE)); g.add(box);
    g.add(mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.04, 20).translate(0, 0.02, 0), mat('#cfcac0')));
    // A little solar panel on the pole, a rain gauge on the base and a striped windsock on a short pole.
    g.add(mesh(new THREE.BoxGeometry(0.16, 0.01, 0.12).rotateX(0.6).translate(0, 0.62, -0.06), mat('#2e4a8c')));
    g.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.09, 12).translate(-0.12, 0.085, -0.06), mat('#bfe4f3', { transparent: true, opacity: 0.55, depthWrite: false }), false));
    g.add(mesh(new THREE.CylinderGeometry(0.03, 0.022, 0.03, 12, 1, true).translate(-0.12, 0.145, -0.06), mat(WHITE, { side: THREE.DoubleSide }), false));
    g.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 6).translate(0.3, 0.25, 0.1), mat(WHITE)));
    const sock = new THREE.Group(); sock.position.set(0.3, 0.48, 0.1);
    for (let i = 0; i < 4; i++) sock.add(mesh(new THREE.CylinderGeometry(0.03 - i * 0.005, 0.025 - i * 0.005, 0.04, 10, 1, true).rotateZ(Math.PI / 2).translate(0.02 + i * 0.04, 0, 0), mat(i % 2 ? WHITE : '#f28b30', { side: THREE.DoubleSide }), false));
    sock.userData.wave = { axis: 'y', base: 0.6, amp: 0.5, speed: 0.4, phase: 0 };
    g.add(sock);
    return g;
  },
});

// A ring of slim white columns holding up the floor above a colonnade (Wc x Dc is the loop they stand on).
export function colonnade(g, Wc, Dc, hgt = SOFFIT) {
  const sh = roundedRect(Wc, Dc, Math.min(Wc, Dc) / 2), n = Math.max(8, Math.round(sh.getLength() / 0.3));
  const parts = sh.getSpacedPoints(n).slice(0, -1).map(p => new THREE.CylinderGeometry(0.024, 0.024, hgt, 10).translate(p.x, hgt / 2, -p.y));
  g.add(mesh(mergeGeometries(parts.map(x => { x.deleteAttribute('uv'); return x; })), mat(WHITE)));
}
// A garden in a courtyard (Wi x Di): a lawn, flowers, a round bench and a big tree in the middle.
// y: how high the garden sits (on the paving of a colonnade walkway, 0.02 up).
export function courtyard(g, Wi, Di, id = 1, y = 0) {
  const r = Math.min(Wi, Di) / 2; if (r < 0.2) return;
  const cy = new THREE.Group(); cy.position.y = y; cy.userData.keep = true; g.add(cy);
  const lawn = new THREE.ExtrudeGeometry(roundedRect(Wi - 0.08, Di - 0.08, r - 0.04), { depth: 0.02, bevelEnabled: false, curveSegments: 14 }).rotateX(-Math.PI / 2);
  const lawnM = mesh(lawn, mat('#9bd06a'), false); lawnM.userData.keep = true; cy.add(lawnM);
  const tr = roundTree(Math.min(0.42, r * 0.5), TREE_GREENS[2]); tr.position.y = 0.02; tr.traverse(o => { o.userData.keep = true; }); cy.add(tr);
  const br = Math.min(0.3, r * 0.42), bench = mesh(new THREE.TorusGeometry(br, 0.028, 6, 30).rotateX(Math.PI / 2).translate(0, 0.05, 0), mat(WHITE)); bench.userData.keep = true; cy.add(bench);
  const rr = seeded(id * 5 + 11), flowers = ['#f5a3c7', '#f7c22e', '#ffffff', '#e2457d'];
  // Flowers: one mesh per colour.
  const fl = flowers.map(() => []);
  for (let i = 0; i < Math.round(r * 30); i++) { const a = rr() * Math.PI * 2, d = br + 0.08 + rr() * (r - br - 0.16); fl[i % 4].push(new THREE.SphereGeometry(0.022, 6, 4).translate(Math.cos(a) * d * (Wi / (2 * r)), 0.04, Math.sin(a) * d * (Di / (2 * r)))); }
  fl.forEach((list, k) => { if (!list.length) return; const f = mesh(mergeGeometries(list.map(x => { x.deleteAttribute('uv'); return x; })), mat(flowers[k]), false); f.raycast = () => {}; f.userData.keep = true; cy.add(f); });
}
// The paved walkway under a colonnade: from the stepped-back wall to just under the edge of the lawn.
export function walkway(g, Wi, Di, rec) {
  const r = Math.min(Wi, Di) / 2, sh = roundedRect(Wi + 2 * rec + 0.02, Di + 2 * rec + 0.02, r + rec + 0.01);
  sh.holes.push(roundedRect(Math.max(0.1, Wi - 0.12), Math.max(0.1, Di - 0.12), Math.max(0.05, r - 0.06)));
  g.add(mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: false, curveSegments: 14 }).rotateX(-Math.PI / 2), mat('#efebe2')));
}
// The centre line of a rounded-rectangle loop (a circle when square), as points.
function loopPath(W, D, r) {
  const s = roundedRect(W, D, r);
  return s.getSpacedPoints(Math.max(36, Math.round((W + D) * 14))).slice(0, -1).map(p => new THREE.Vector2(p.x, -p.y));
}
// Sweep a pointy-roofed house section along a path; a closed loop or an open curve with gable ends.
// Every little house is the same height, so the roof runs on cleanly; every other house has a slightly darker
// roof, so it still reads as a ring of houses. Returns two geometries: [walls and roofs, the darker roofs].
function sweepHouses(path, t, H, closed, rec = 0) {
  const n = path.length, pos = [], alt = [];
  const nrm = i => {
    const a = path[(i - 1 + n) % n], b = path[(i + 1) % n];
    const p = closed ? [a, b] : [path[Math.max(0, i - 1)], path[Math.min(n - 1, i + 1)]];
    const dx = p[1].x - p[0].x, dz = p[1].y - p[0].y, l = Math.hypot(dx, dz) || 1;
    return [dz / l, -dx / l];
  };
  // Profile across the band (u from inside to outside), with a ridge in the middle.
  // (+u is the courtyard side; with a recess the ground floor steps back there under the floor above.)
  const P = rec > 0
    ? [[-t / 2, 0], [t / 2 - rec, 0], [t / 2 - rec, SOFFIT], [t / 2, SOFFIT], [t / 2, H], [0, H + ROOF * 1.35], [-t / 2, H]]
    : [[-t / 2, 0], [t / 2, 0], [t / 2, H], [0, H + ROOF * 1.35], [-t / 2, H]];
  const roof = e => P[e][1] >= H - 1e-6 && P[(e + 1) % P.length][1] >= H - 1e-6;
  let len = 0; const acc = [0];
  for (let i = 1; i < (closed ? n + 1 : n); i++) { len += path[i % n].distanceTo(path[i - 1]); acc.push(len); }
  let houses = Math.max(2, Math.round(len / 0.95)); if (closed && houses % 2) houses++;
  const at = (i, u, y) => { const [nx, nz] = nrm(i % n), p = path[i % n]; return [p.x + nx * u, y, p.y + nz * u]; };
  const quad = (list, a, b, c2, d2) => list.push(...a, ...c2, ...b, ...a, ...d2, ...c2);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const k = Math.floor(((acc[i] + acc[i + 1]) / 2 / len) * houses);
    for (let e = 1; e < P.length; e++) { const f = (e + 1) % P.length; quad(roof(e) && k % 2 ? alt : pos, at(i, ...P[e]), at(i + 1, ...P[e]), at(i + 1, ...P[f]), at(i, ...P[f])); }
  }
  // Gable ends on an open curve.
  if (!closed) for (const j of [0, segs]) {
    const c0 = P.map(([u, y]) => at(j, u, y));
    for (const [a, b, e] of THREE.ShapeUtils.triangulateShape(P.map(([u, y]) => new THREE.Vector2(u, y)), [])) pos.push(...c0[a], ...c0[b], ...c0[e], ...c0[a], ...c0[e], ...c0[b]);
  }
  const geo = list => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(list, 3)); g.computeVertexNormals(); return g; };
  return [geo(pos), geo(alt)];
}

// ---------- thin black outlines, like an architect's drawing ----------
// One shared line material (its opacity eases off when the whole site is in view, so it never looks scribbly).
export const INK = new THREE.LineBasicMaterial({ color: '#1f2126', transparent: true, opacity: 0.85 });
INK.userData.shared = true;
const edgeCache = new WeakMap();
const MOVES = ['spin', 'yspin', 'swing', 'rock', 'zip', 'slide'];
// Draw the creases and rims of every solid mesh in a piece (not glass, people or anything marked noInk).
// Lines for parts that sit still are merged into one line object per group; moving parts carry their own.
export function addInk(root, angle = 33) {
  const meshes = [], groups = new Map();
  root.traverse(o => { if (o.isMesh && !o.isInstancedMesh) meshes.push(o); });
  for (const o of meshes) {
    if (o.userData.people || o.parent?.userData.people || o.userData.noInk) continue;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    if (ms.some(m => !m || m.transparent || m.isSpriteMaterial || m.userData?.ghost)) continue;
    // Tiny bits (flowers, stars, knobs) stay soft: outlined, they look like dice.
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    if (o.geometry.boundingSphere.radius * Math.max(o.scale.x, o.scale.y, o.scale.z) < 0.035) continue;
    const shared = !!o.geometry.userData.shared;
    let e = shared ? edgeCache.get(o.geometry) : null;
    if (!e) { e = new THREE.EdgesGeometry(o.geometry, angle); if (shared) { e.userData.shared = true; edgeCache.set(o.geometry, e); } }
    if (!e.attributes.position.count) continue;
    if (MOVES.some(k => o.userData[k])) { const L = new THREE.LineSegments(e, INK); L.raycast = () => {}; L.userData.ink = true; o.add(L); continue; }
    o.updateMatrix();
    const c = e.clone(); c.userData = {}; c.applyMatrix4(o.matrix);
    if (!shared) e.dispose();
    if (!groups.has(o.parent)) groups.set(o.parent, []);
    groups.get(o.parent).push(c);
  }
  for (const [parent, gs] of groups) {
    const merged = gs.length === 1 ? gs[0] : mergeGeometries(gs);
    if (gs.length > 1) for (const x of gs) x.dispose();
    const L = new THREE.LineSegments(merged, INK); L.raycast = () => {}; L.userData.ink = true; parent.add(L);
  }
}

// Build a programme piece. box = { shape, w, d, h, colour (hex), id }, opts = { open, ghost }
export function buildPiece(box, opts = {}) {
  const H = box.h * LEVEL;
  const make = BUILD[box.shape] || BUILD.box;
  const g = make(box.w, box.d, H, box.hex, { ...opts, id: box.id || 1, box });
  const ang = turnAngle(box);
  if (ang) { const inner = new THREE.Group(); while (g.children.length) inner.add(g.children[0]); inner.rotation.y = -ang; g.add(inner); }
  if (box.surface && box.surface !== 'plain' && !opts.ghost) applySurface(g, box);
  // A bridge or ramp deck reaches across the gap to the door of the room it meets.
  if (!opts.ghost && box.exits?.length && ['bridge', 'ramp', 'tube'].includes(box.shape)) {
    const deck = box.shape === 'ramp' ? H : 0.07, wide = Math.min(box.w, box.d) - (box.shape === 'ramp' ? 0.24 : 0.3), long = box.w >= box.d;
    for (const [dx, dz] of box.exits) {
      if (box.shape === 'ramp' && !(long ? dx === 1 && !dz : dz === 1 && !dx)) continue;      // (only the top end)
      const sx = dx ? 2 * GAP + 0.03 : wide, sz = dz ? 2 * GAP + 0.03 : wide;
      g.add(mesh(new THREE.BoxGeometry(sx, 0.03, sz).translate(dx * (box.w / 2 + 0.005), deck - 0.015, dz * (box.d / 2 + 0.005)), mat(box.hex)));
    }
  }
  if (!opts.ghost) {
    addFacade(g, box, H, { walkK: opts.walkK });
    if (opts.open && ['box', 'drum', 'ring'].includes(box.shape)) addTerrace(g, box, H);
    if (opts.ink !== false) addInk(g);
    if ((box.level || 0) === 0 && !['tree', 'turbine', 'weather', 'circle', 'track', 'garden', 'pool', 'bridge', 'canopy'].includes(box.shape)) g.add(contactShadow(box));
  }
  if (opts.ghost) g.traverse(o => { if (o.isMesh) { o.material = opts.ghost; o.castShadow = false; } });
  return g;
}

export function disposePiece(g) {
  g.traverse(o => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) if (!m.userData?.shared && !m.userData?.ghost) m.dispose();
  });
}

export function ghostMaterial(ok) {
  const m = new THREE.MeshLambertMaterial({ color: ok ? '#ffffff' : '#ff6b5e', emissive: ok ? '#5aa9ff' : '#d02020', emissiveIntensity: 0.45, transparent: true, opacity: 0.5, depthWrite: false });
  m.userData.ghost = true;
  return m;
}
