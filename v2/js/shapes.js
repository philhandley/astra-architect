// The shapes a programme box can take, built to fit any size of footprint (w x d squares, h storeys).
// Every builder returns a Group centred on x = z = 0, standing on y = 0, in clean matte colours.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LEVEL } from './catalogue.js';
import { TREE_GREENS } from './site.js';
import { addFacade, addTerrace, contactShadow } from './facade.js';
import { REC, SOFFIT, hasColonnade, ringThickness, turnAngle } from './plan.js';

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
  const g = new THREE.ExtrudeGeometry(shape, { depth: H, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1, curveSegments: 28 });
  g.rotateX(-Math.PI / 2);
  return g;
}

// ---------- little people and trees, for scale ----------
// A little toy child (like the people in the school day), to ride on swings, roundabouts, slides and zip lines.
let MINI = null, miniN = 0;
const KID_TOPS = ['#f4c23d', '#e6463c', '#22b2bf', '#e2457d', '#3d8de0', '#8bc34a', '#9a6cd4', '#ea7b2c'];
const KID_SKIN = ['#f6d7bf', '#e7b892', '#c98c62', '#9a6544', '#6e4630'];
const KID_HAIR = ['#3b2a20', '#1f1b18', '#b5652e', '#e3b65a', '#6b4128'];
export function miniKid() {
  if (!MINI) {
    const legs = [], arms = [];
    for (const s of [-1, 1]) {
      legs.push(new THREE.CylinderGeometry(0.011, 0.01, 0.05, 8).translate(s * 0.016, 0.031, 0));
      arms.push(new THREE.CylinderGeometry(0.0105, 0.009, 0.05, 8).translate(s * 0.042, 0.1, 0));
    }
    const strip = gs => mergeGeometries(gs.map(g => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); return n; }));
    MINI = {
      top: strip([new RoundedBoxGeometry(0.066, 0.062, 0.044, 3, 0.016).translate(0, 0.1, 0), ...arms]),
      shorts: new RoundedBoxGeometry(0.062, 0.026, 0.042, 2, 0.01).translate(0, 0.064, 0),
      skin: strip([new THREE.SphereGeometry(0.042, 16, 12).translate(0, 0.17, 0), ...legs, new THREE.SphereGeometry(0.0105, 8, 6).translate(-0.042, 0.072, 0), new THREE.SphereGeometry(0.0105, 8, 6).translate(0.042, 0.072, 0)]),
      hair: new THREE.SphereGeometry(0.0445, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5).rotateX(-0.5).translate(0, 0.172, -0.004),
      eyes: strip([new THREE.SphereGeometry(0.005, 6, 4).translate(-0.014, 0.172, 0.04), new THREE.SphereGeometry(0.005, 6, 4).translate(0.014, 0.172, 0.04)]),
      shoes: strip([new RoundedBoxGeometry(0.022, 0.014, 0.032, 2, 0.006).translate(-0.016, 0.003, 0.006), new RoundedBoxGeometry(0.022, 0.014, 0.032, 2, 0.006).translate(0.016, 0.003, 0.006)]),
    };
    for (const g of Object.values(MINI)) g.userData.shared = true;
  }
  const n = miniN++, k = new THREE.Group();
  for (const [geo, hex] of [[MINI.top, KID_TOPS[n % KID_TOPS.length]], [MINI.shorts, n % 2 ? '#2f4b7c' : '#3d405b'], [MINI.skin, KID_SKIN[(n * 3) % KID_SKIN.length]],
    [MINI.hair, KID_HAIR[(n * 2) % KID_HAIR.length]], [MINI.eyes, '#2a2c31'], [MINI.shoes, '#fbfaf6']]) {
    const m = mesh(geo, mat(hex), geo === MINI.top || geo === MINI.skin); m.raycast = () => {}; m.userData.people = true; k.add(m);
  }
  return k;
}
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
    const g = new THREE.Group(); g.add(mesh(alongLong(geo, w, d), mat(c))); return g;
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
    const g = new THREE.Group(); g.add(mesh(geo, mat(c))); return g;
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
    } else { const s = outer(); s.holes.push(hole(0)); g.add(mesh(upExtrude(s, H), mat(c))); }
    if (w >= 3 && d >= 3) courtyard(g, W - 2 * t - 0.03, D - 2 * t - 0.03, o.id);
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
    g.add(mesh(sweepHouses(path, t, H, true, col ? REC : 0), mat(c)));
    const Wi = w - 2 * GAP - 2 * t, Di = d - 2 * GAP - 2 * t;
    if (col) colonnade(g, Wi + 0.08, Di + 0.08);
    if (w >= 3 && d >= 3) courtyard(g, Wi, Di, o.id);
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
    const g = new THREE.Group(); g.add(mesh(sweepHouses(pts, t, H, false), mat(c))); return g;
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
      const k = Math.floor(r() * n), along = -L / 2 + (L * (k + 0.5)) / n, across = (r() - 0.5) * W * 0.8, y = (H * (k + 1)) / n;
      spots.push(w >= d ? [along, y, across] : [across, y, along]);
    }
    g.userData.seats = spots;
    const cols = ['#f7c22e', '#e2457d', '#22b2bf', '#a3d140', '#f28b30', '#ffffff'];
    for (let i = 0; i < Math.min(8, n * 2); i++) {
      const k = Math.floor(r() * n), along = -L / 2 + (L * (k + 0.5)) / n, across = (r() - 0.5) * W * 0.8, y = (H * (k + 1)) / n;
      const cu = mesh(new RoundedBoxGeometry(0.11, 0.035, 0.1, 2, 0.014), mat(cols[i % cols.length])); cu.position.set(w >= d ? along : across, y + 0.03, w >= d ? across : along); cu.raycast = () => {}; g.add(cu);
    }
    return g;
  },
  stairs(w, d, H, c) {
    // Chunky zigzag stairs: one walled flight per storey, back and forth along the long side, landings at each turn.
    const L = Math.max(w, d) - 2 * GAP, W = Math.min(w, d) - 2 * GAP, n = Math.max(1, Math.round(H / LEVEL));
    const land = 0.2, run = L - 2 * land, lw = W / 2 - 0.02, steps = 7, parts = [];
    for (let k = 0; k < n; k++) {
      const y0 = k * LEVEL, rise = LEVEL, back = k % 2 === 1, side = (back ? 1 : -1) * (W / 4);
      const lo = k === 0 ? 0 : y0 - 0.08;
      const pts = [[-run / 2, lo]];
      for (let i = 0; i < steps; i++) { const x0 = -run / 2 + (run * i) / steps, x1 = -run / 2 + (run * (i + 1)) / steps, y = y0 + (rise * (i + 1)) / steps; pts.push([x0, y], [x1, y]); }
      pts.push([run / 2, y0 + rise - 0.08]);
      if (k === 0) pts.push([run / 2 - run * 0.25, lo]);
      const flight = prism(pts, lw);
      const wallP = [[-run / 2, lo - 0.01], [run / 2, y0 + rise - 0.1], [run / 2, y0 + rise + 0.14], [-run / 2, y0 + 0.14]];
      const w1 = prism(wallP, 0.035).translate(0, 0, lw / 2), w2 = prism(wallP, 0.035).translate(0, 0, -lw / 2);
      for (const g of [flight, w1, w2]) { if (back) g.rotateY(Math.PI); g.translate(0, 0, side); parts.push(g); }
      // Landing at the top of the flight, with a little wall round its end.
      const lx = (back ? -1 : 1) * (L / 2 - land / 2);
      parts.push(new THREE.BoxGeometry(land, 0.08, W).translate(lx, y0 + rise - 0.04, 0));
      parts.push(new THREE.BoxGeometry(0.035, 0.22, W).translate(lx + (back ? -1 : 1) * (land / 2 - 0.017), y0 + rise + 0.07, 0));
    }
    const geo = mergeGeometries(parts.map(p => (p.index ? p.toNonIndexed() : p)).map(p => { p.deleteAttribute('uv'); return p; }));
    if (d > w) geo.rotateY(Math.PI / 2);
    const g = new THREE.Group(); g.add(mesh(geo, mat(c))); return g;
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
    // The slide: round and round the tower, then out along the next square.
    const pts = [], turns = Math.max(1.5, H * 1.6), R = 0.4;
    for (let i = 0; i <= 64; i++) { const t = i / 64, a = t * turns * Math.PI * 2; pts.push(new THREE.Vector3(x0 + Math.cos(a) * R, top - 0.02 - t * (top - 0.28), Math.sin(a) * R)); }
    const last = pts[pts.length - 1];
    pts.push(new THREE.Vector3(x0 + 0.62, 0.17, last.z * 0.4), new THREE.Vector3(L / 2 - 0.3, 0.1, 0), new THREE.Vector3(L / 2 - 0.08, 0.11, 0));
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.TubeGeometry(curve, 240, 0.085, 10, false);
    const uv = tube.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * curve.getLength() * 3);
    g.add(mesh(tube, mat(WHITE, { map: stripes(c) })));
    // A child whizzing down now and then.
    const kid = miniKid(); kid.scale.setScalar(0.75);
    kid.userData.slide = { curve, period: 3.4, pause: 2.2 };
    g.add(kid);
    if (d > w) g.rotation.y = -Math.PI / 2;
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
    g.add(mesh(new RoundedBoxGeometry(W, 0.06, D, 2, 0.02).translate(0, 0.03, 0), mat('#8fcf5b')));
    const band = Math.min(0.3, Math.min(W, D) * 0.22);
    const s = roundedRect(W - 0.06, D - 0.06, Math.min(W, D) / 2); s.holes.push(roundedRect(W - 0.06 - 2 * band, D - 0.06 - 2 * band, Math.max(0.05, Math.min(W, D) / 2 - band)));
    const tr = mesh(upExtrude(s, 0.025), mat(c)); tr.position.y = 0.06; g.add(tr);
    for (const k of [1 / 3, 2 / 3]) {
      const ln = roundedRect(W - 0.06 - 2 * band * k, D - 0.06 - 2 * band * k, Math.min(W, D) / 2 - band * k);
      const pts = ln.getPoints(48).map(p => new THREE.Vector3(p.x, 0.09, -p.y));
      const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#ffffff' }));
      g.add(line);
    }
    return g;
  },
  garden(w, d, H, c, o) {
    const W = w - 2 * GAP, D = d - 2 * GAP, g = new THREE.Group();
    g.add(mesh(new RoundedBoxGeometry(W, 0.14, D, 2, 0.03).translate(0, 0.07, 0), mat(WHITE)));
    const lawn = mesh(new RoundedBoxGeometry(W - 0.08, 0.03, D - 0.08, 1, 0.01).translate(0, 0.15, 0), mat('#8fcf5b')); g.add(lawn);
    const r = seeded(o.id || 3);
    for (let i = 0; i < Math.max(1, Math.round(w * d)); i++) { const t = roundTree(0.17 + r() * 0.06, TREE_GREENS[i % TREE_GREENS.length]); t.position.set((r() - 0.5) * (W - 0.4), 0.16, (r() - 0.5) * (D - 0.4)); g.add(t); }
    const flowers = ['#f5a3c7', '#f7c22e', '#ffffff', '#e2457d'];
    for (let i = 0; i < 10 * w * d; i++) { const f = mesh(new THREE.SphereGeometry(0.025, 6, 4), mat(flowers[i % 4]), false); f.position.set((r() - 0.5) * (W - 0.14), 0.18, (r() - 0.5) * (D - 0.14)); g.add(f); }
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
  tiles: { tint: true, scale: 2, draw: (g, s) => { const r = rnd(7), n = 4, u = s / n; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = 225 + r() * 30; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x * u, y * u, u, u); } g.strokeStyle = 'rgba(150,150,150,0.9)'; g.lineWidth = 3; for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * u, 0); g.lineTo(i * u, s); g.moveTo(0, i * u); g.lineTo(s, i * u); g.stroke(); } } },
  pixel: { tint: true, scale: 1.5, draw: (g, s) => { const r = rnd(11), n = 8, u = s / n; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = 170 + Math.floor(r() * 4) * 28; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x * u, y * u, u, u); } } },
  brick: { tint: true, scale: 3, draw: (g, s) => { const r = rnd(3), rows = 8, bh = s / rows, bw = s / 4; g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, s, s); for (let y = 0; y < rows; y++) for (let x = -1; x < 5; x++) { const v = 215 + r() * 40, ox = (y % 2) * bw / 2; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x * bw + ox + 2, y * bh + 2, bw - 4, bh - 4); } } },
  wood: { tint: true, scale: 3, draw: (g, s) => { const r = rnd(5), n = 8, u = s / n; for (let x = 0; x < n; x++) { const v = 205 + r() * 50; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x * u, 0, u - 3, s); g.fillStyle = 'rgba(120,120,120,0.9)'; g.fillRect(x * u + u - 3, 0, 3, s); } } },
  glass: { tint: false, scale: 2, draw: (g, s) => { const gr = g.createLinearGradient(0, 0, s, s); gr.addColorStop(0, '#d9f1fa'); gr.addColorStop(0.5, '#a9d8ea'); gr.addColorStop(1, '#cfeaf5'); g.fillStyle = gr; g.fillRect(0, 0, s, s); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 10; g.beginPath(); g.moveTo(s * 0.1, s); g.lineTo(s * 0.6, 0); g.stroke(); g.strokeStyle = '#f7f7f4'; g.lineWidth = 6; g.strokeRect(3, 3, s - 6, s - 6); g.beginPath(); g.moveTo(s / 2, 0); g.lineTo(s / 2, s); g.stroke(); } },
  green: { tint: false, scale: 2, draw: (g, s) => { const r = rnd(9); g.fillStyle = '#5c9a43'; g.fillRect(0, 0, s, s); const cols = ['#4c8a36', '#7cb85a', '#93c96b', '#3f7a30', '#a9d97a']; for (let i = 0; i < 260; i++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.beginPath(); g.ellipse(r() * s, r() * s, 4 + r() * 6, 3 + r() * 4, r() * 3, 0, Math.PI * 2); g.fill(); } for (let i = 0; i < 14; i++) { g.fillStyle = ['#f5a3c7', '#f7c22e', '#ffffff'][i % 3]; g.beginPath(); g.arc(r() * s, r() * s, 2.5, 0, Math.PI * 2); g.fill(); } } },
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
  g.traverse(o => { if (o.isMesh && o.material === body) meshes.push(o); });
  if (box.surface === 'climb') { for (const m of meshes) g.add(climbingHolds(m, box.id || 1)); return; }
  const S = SURF[box.surface]; if (!S) return;
  const tex = canvasTex(box.surface, S.draw);
  const m2 = mat(S.tint ? box.hex : '#ffffff', { map: tex });
  for (const m of meshes) { if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals(); boxUV(m.geometry, S.scale); m.material = m2; }
}
// Coloured climbing holds scattered over the outside walls.
function climbingHolds(m, seed) {
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
  const r = rnd(seed * 7 + 1), n = Math.min(260, Math.max(12, Math.round(total * 34)));
  const holds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.024, 0), new THREE.MeshLambertMaterial({ color: '#ffffff' }), n);
  const cols = ['#e6463c', '#f7c22e', '#3d8de0', '#a3d140', '#f28b30', '#e2457d', '#7c46a8'];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pos = new THREE.Vector3(), col = new THREE.Color();
  for (let i = 0; i < n && tris.length; i++) {
    const k = r() * total, t = tris.find(tt => tt.acc >= k) || tris[tris.length - 1];
    let u = r(), v = r(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
    pos.copy(t.a).addScaledVector(t.b.clone().sub(t.a), u).addScaledVector(t.c.clone().sub(t.a), v).addScaledVector(t.n, 0.008);
    q.setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)); s.set(0.7 + r() * 0.8, 0.6 + r() * 0.5, 0.7 + r() * 0.8);
    m4.compose(pos, q, s); holds.setMatrixAt(i, m4); holds.setColorAt(i, col.set(cols[i % cols.length]));
  }
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
    const g = new THREE.Group(), L = Math.max(w, d) - 0.2, hh = 0.42, inner = new THREE.Group();
    for (const s of [-1, 1]) for (const k of [-1, 1]) { const leg = mesh(new THREE.CylinderGeometry(0.014, 0.014, hh * 1.08, 8), mat(c)); leg.position.set(s * L / 2, hh / 2, k * 0.12); leg.rotation.x = -k * 0.28; inner.add(leg); }
    inner.add(mesh(new THREE.CylinderGeometry(0.016, 0.016, L + 0.04, 8).rotateZ(Math.PI / 2).translate(0, hh, 0), mat(c)));
    for (const sx of [-L / 4, L / 4]) {
      const pivot = new THREE.Group(); pivot.position.set(sx, hh, 0);
      for (const o of [-0.045, 0.045]) pivot.add(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.3, 4).translate(o, -0.15, 0), mat('#3d405b'), false));
      pivot.add(mesh(new THREE.BoxGeometry(0.11, 0.012, 0.05).translate(0, -0.3, 0), mat('#e2457d')));
      const kid = miniKid(); kid.position.set(0, -0.36, 0); kid.scale.setScalar(0.75); pivot.add(kid);
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
    for (const [x, y, z] of [[0, R * 0.95, 0], [R * 0.6, R * 0.6, 0.1]]) { const k = miniKid(); k.position.set(x, y, z); k.scale.setScalar(0.75); g.add(k); }
    return g;
  },
  roundabout(w, d, H, c) {
    const g = new THREE.Group(), R = Math.min(w, d) / 2 - 0.12, spin = new THREE.Group();
    for (let i = 0; i < 4; i++) spin.add(mesh(new THREE.CylinderGeometry(R, R, 0.03, 24, 1, false, (i / 4) * Math.PI * 2, Math.PI / 2).translate(0, 0.05, 0), mat(i % 2 ? c : '#22b2bf')));
    spin.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 8).translate(0, 0.14, 0), mat(WHITE)));
    spin.add(mesh(new THREE.TorusGeometry(R * 0.6, 0.008, 6, 24).rotateX(Math.PI / 2).translate(0, 0.18, 0), mat(WHITE)));
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2, k = miniKid(); k.position.set(Math.cos(a) * R * 0.75, 0.065, Math.sin(a) * R * 0.75); k.scale.setScalar(0.7); spin.add(k); }
    spin.userData.yspin = 1.6;
    g.add(mesh(new THREE.CylinderGeometry(R + 0.02, R + 0.04, 0.035, 24).translate(0, 0.0175, 0), mat('#d2cdc4')));
    g.add(spin); return g;
  },
  seesaw(w, d, H, c) {
    const g = new THREE.Group(), L = Math.max(w, d) - 0.15, inner = new THREE.Group();
    inner.add(mesh(new THREE.ConeGeometry(0.05, 0.1, 4).translate(0, 0.05, 0), mat('#3d405b')));
    const plank = new THREE.Group(); plank.position.y = 0.1;
    plank.add(mesh(new THREE.BoxGeometry(L, 0.02, 0.07), mat(c)));
    for (const s of [-1, 1]) { plank.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 6).translate(s * (L / 2 - 0.08), 0.04, 0), mat(WHITE))); const k = miniKid(); k.position.set(s * (L / 2 - 0.04), 0.01, 0); k.scale.setScalar(0.7); plank.add(k); }
    plank.userData.rock = { amp: 0.28, speed: 2.2 };
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
    const k = miniKid(); k.position.set(0.05, top + 0.015, 0); k.scale.setScalar(0.72); g.add(k);
    return g;
  },
  zipline(w, d, H, c) {
    const g = new THREE.Group(), L = Math.max(w, d) - 0.2, inner = new THREE.Group(), hi = 0.55, lo = 0.4;
    for (const [x, hh] of [[-L / 2, hi], [L / 2, lo]]) { inner.add(mesh(new THREE.CylinderGeometry(0.02, 0.025, hh, 8).translate(x, hh / 2, 0), mat(c))); inner.add(mesh(new THREE.BoxGeometry(0.16, 0.025, 0.16).translate(x, 0.0125, 0), mat('#d2cdc4'))); }
    const cable = mesh(new THREE.CylinderGeometry(0.003, 0.003, Math.hypot(L, hi - lo), 4), mat('#3d405b'), false);
    cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(L, lo - hi, 0).normalize()); cable.position.set(0, (hi + lo) / 2, 0); inner.add(cable);
    const rider = new THREE.Group(); rider.add(mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.16, 4).translate(0, -0.08, 0), mat('#3d405b'), false));
    const k = miniKid(); k.position.set(0, -0.36, 0); k.scale.setScalar(0.75); rider.add(k);
    rider.userData.zip = { x0: -L / 2 + 0.05, x1: L / 2 - 0.05, y0: hi - 0.02, y1: lo - 0.02, period: 3.2 };
    inner.add(rider);
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
    const g = new THREE.Group(), W = w - 2 * GAP, D = d - 2 * GAP;
    g.add(mesh(new RoundedBoxGeometry(W, 0.1, D, 2, 0.02).translate(0, 0.05, 0), mat('#c9c6bf')));
    // Yellow and black hazard edge.
    for (let i = 0; i < 16; i++) { const s = mesh(new THREE.BoxGeometry(W / 16, 0.012, 0.06), mat(i % 2 ? '#26272d' : '#f7c22e'), false); s.position.set(-W / 2 + W / 16 * (i + 0.5), 0.104, D / 2 - 0.05); g.add(s); }
    // The gantry: a teal tower of thin bars.
    const gx = -W / 2 + 0.18, gz = 0, gh = 1.9;
    for (const [px, pz] of [[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08]]) g.add(mesh(new THREE.BoxGeometry(0.025, gh, 0.025).translate(gx + px, gh / 2 + 0.1, gz + pz), mat('#22b2bf')));
    for (let y = 0.3; y < gh; y += 0.25) g.add(mesh(new THREE.BoxGeometry(0.2, 0.02, 0.2).translate(gx, y + 0.1, gz), mat('#22b2bf')));
    const arm = mesh(new THREE.BoxGeometry(0.28, 0.03, 0.04).translate(gx + 0.2, 1.5, gz), mat('#22b2bf')); g.add(arm);
    // The rocket.
    const rk = new THREE.Group(); rk.position.set(0.12, 0.1, 0);
    rk.add(mesh(new THREE.CylinderGeometry(0.13, 0.15, 1.2, 20).translate(0, 0.72, 0), mat(WHITE)));
    rk.add(mesh(new THREE.ConeGeometry(0.13, 0.36, 20).translate(0, 1.5, 0), mat(c)));
    rk.add(mesh(new THREE.CylinderGeometry(0.155, 0.17, 0.12, 20).translate(0, 0.06, 0), mat('#3d405b')));
    const win = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 16).rotateX(Math.PI / 2).translate(0, 1.05, 0.135), mat('#7fd0ea')); rk.add(win);
    for (let i = 0; i < 3; i++) { const fin = mesh(new THREE.BoxGeometry(0.02, 0.26, 0.16).translate(0, 0.2, 0.2), mat(c)); fin.rotation.y = (i * Math.PI * 2) / 3; rk.add(fin); }
    rk.userData.rocket = true;
    g.add(rk);
    return g;
  },
  observatory(w, d, H, c) {
    const g = new THREE.Group(), r = Math.min(w, d) / 2 - GAP;
    g.add(mesh(new THREE.CylinderGeometry(r, r, H, 40).translate(0, H / 2, 0), mat(c)));
    const dome = mesh(new THREE.SphereGeometry(r * 0.98, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, H, 0), mat('#dfe5ea'));
    g.add(dome);
    const slot = mesh(new THREE.BoxGeometry(0.12, 0.02, r * 1.6).translate(0, H + r * 0.55, 0.02), mat('#26272d')); slot.rotation.x = -0.45; slot.position.z = r * 0.3; g.add(slot);
    const scope = mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.42, 12), mat(WHITE)); scope.rotation.x = -0.9; scope.position.set(0, H + r * 0.75, r * 0.45); g.add(scope);
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
      seats.push([x * 1.12, 0.04, z * 1.12]);
    }
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
export function courtyard(g, Wi, Di, id = 1) {
  const r = Math.min(Wi, Di) / 2; if (r < 0.2) return;
  const lawn = new THREE.ExtrudeGeometry(roundedRect(Wi - 0.08, Di - 0.08, r - 0.04), { depth: 0.02, bevelEnabled: false, curveSegments: 32 }).rotateX(-Math.PI / 2);
  const lawnM = mesh(lawn, mat('#9bd06a'), false); lawnM.userData.keep = true; g.add(lawnM);
  const tr = roundTree(Math.min(0.42, r * 0.5), TREE_GREENS[2]); tr.position.y = 0.02; tr.traverse(o => { o.userData.keep = true; }); g.add(tr);
  const br = Math.min(0.3, r * 0.42), bench = mesh(new THREE.TorusGeometry(br, 0.028, 8, 36).rotateX(Math.PI / 2).translate(0, 0.05, 0), mat(WHITE)); bench.userData.keep = true; g.add(bench);
  const rr = seeded(id * 5 + 11), flowers = ['#f5a3c7', '#f7c22e', '#ffffff', '#e2457d'];
  for (let i = 0; i < Math.round(r * 30); i++) { const a = rr() * Math.PI * 2, d = br + 0.08 + rr() * (r - br - 0.16); const f = mesh(new THREE.SphereGeometry(0.022, 6, 4), mat(flowers[i % 4]), false); f.position.set(Math.cos(a) * d * (Wi / (2 * r)), 0.04, Math.sin(a) * d * (Di / (2 * r))); f.raycast = () => {}; f.userData.keep = true; g.add(f); }
}
// The centre line of a rounded-rectangle loop (a circle when square), as points.
function loopPath(W, D, r) {
  const s = roundedRect(W, D, r);
  return s.getSpacedPoints(Math.max(36, Math.round((W + D) * 14))).slice(0, -1).map(p => new THREE.Vector2(p.x, -p.y));
}
// Sweep a pointy-roofed house section along a path; a closed loop or an open curve with gable ends.
// The roof is broken into little houses (alternating heights), like a ring of cottages.
function sweepHouses(path, t, H, closed, rec = 0) {
  const n = path.length, pos = [];
  const nrm = i => {
    const a = path[(i - 1 + n) % n], b = path[(i + 1) % n];
    const p = closed ? [a, b] : [path[Math.max(0, i - 1)], path[Math.min(n - 1, i + 1)]];
    const dx = p[1].x - p[0].x, dz = p[1].y - p[0].y, l = Math.hypot(dx, dz) || 1;
    return [dz / l, -dx / l];
  };
  // Profile across the band (u from inside to outside), with a ridge in the middle.
  // (+u is the courtyard side; with a recess the ground floor steps back there under the floor above.)
  const prof = (hh, r) => rec > 0
    ? [[-t / 2, 0], [t / 2 - rec, 0], [t / 2 - rec, SOFFIT], [t / 2, SOFFIT], [t / 2, hh], [0, hh + r * 1.35], [-t / 2, hh]]
    : [[-t / 2, 0], [t / 2, 0], [t / 2, hh], [0, hh + r * 1.35], [-t / 2, hh]];
  let len = 0; const acc = [0];
  for (let i = 1; i < (closed ? n + 1 : n); i++) { len += path[i % n].distanceTo(path[i - 1]); acc.push(len); }
  const houses = Math.max(2, Math.round(len / 0.95));
  const at = (i, u, y) => { const [nx, nz] = nrm(i % n), p = path[i % n]; return [p.x + nx * u, y, p.y + nz * u]; };
  const quad = (a, b, c2, d2) => pos.push(...a, ...c2, ...b, ...a, ...d2, ...c2);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const k = Math.floor((acc[i] / len) * houses), k2 = Math.floor((acc[i + 1] / len) * houses);
    const hh = H + (k % 2 ? 0.13 : 0), r = ROOF * (k % 2 ? 0.8 : 1);
    const P = prof(hh, r);
    for (let e = 1; e < P.length; e++) quad(at(i, P[e][0], P[e][1]), at(i + 1, P[e][0], P[e][1]), at(i + 1, P[(e + 1) % P.length][0], P[(e + 1) % P.length][1]), at(i, P[(e + 1) % P.length][0], P[(e + 1) % P.length][1]));
    // A gable step where one little house meets the next.
    if (k2 !== k || (!closed && (i === 0 || i === segs - 1))) {
      const j = k2 !== k ? i + 1 : (i === 0 ? 0 : i + 1);
      const hh2 = H + (k2 % 2 ? 0.13 : 0), r2 = ROOF * (k2 % 2 ? 0.8 : 1), Q = prof(Math.max(hh, hh2), Math.max(r, r2));
      const c0 = Q.map(([u, y]) => at(j, u, y));
      for (const [a, b, e] of THREE.ShapeUtils.triangulateShape(Q.map(([u, y]) => new THREE.Vector2(u, y)), [])) pos.push(...c0[a], ...c0[b], ...c0[e], ...c0[a], ...c0[e], ...c0[b]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
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
