// The shapes a programme box can take, built to fit any size of footprint (w x d squares, h storeys).
// Every builder returns a Group centred on x = z = 0, standing on y = 0, in clean matte colours.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LEVEL } from './catalogue.js';
import { TREE_GREENS } from './site.js';

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

// ---------- little white people and trees, for scale ----------
let PERSON = null;
function personGeo() {
  if (PERSON) return PERSON;
  const body = new THREE.CapsuleGeometry(0.032, 0.1, 2, 6).translate(0, 0.082, 0);
  const head = new THREE.SphereGeometry(0.034, 8, 6).translate(0, 0.19, 0);
  PERSON = mergeGeometries([body, head]);
  PERSON.userData.shared = true;
  return PERSON;
}
function people(group, spots) {
  for (const [x, y, z] of spots) { const p = mesh(personGeo(), mat(WHITE)); p.position.set(x, y, z); p.raycast = () => {}; group.add(p); }
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
      geo.rotateY(Math.PI / 2); geo.translate(-L / 2 + GAP + u * (i + 0.5), 0, 0);
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
  ring(w, d, H, c) {
    if (w < 2 || d < 2) return BUILD.drum(w, d, H, c, {});
    const W = w - 2 * GAP - 0.03, D = d - 2 * GAP - 0.03, t = w >= 3 && d >= 3 ? 0.95 : Math.min(W, D) * 0.3;
    const s = roundedRect(W, D, Math.min(W, D) / 2);
    s.holes.push(roundedRect(W - 2 * t, D - 2 * t, Math.max(0.05, Math.min(W, D) / 2 - t)));
    const g = new THREE.Group(); g.add(mesh(upExtrude(s, H), mat(c)));
    if (w >= 3 && d >= 3) { const tr = roundTree(Math.min(0.35, (Math.min(W, D) - 2 * t) * 0.3)); g.add(tr); }
    return g;
  },
  ringhouse(w, d, H, c) {
    // A ring of pointy-roofed houses round a garden: the roof follows the curve, one little house after another.
    if (w < 2 || d < 2) return BUILD.house(w, d, H, c);
    const t = w >= 3 && d >= 3 ? 0.9 : 0.6;
    const W = w - 2 * GAP - t, D = d - 2 * GAP - t;       // the centre line of the band
    const path = loopPath(W, D, Math.min(W, D) / 2);
    const g = new THREE.Group();
    g.add(mesh(sweepHouses(path, t, H, true), mat(c)));
    if (w >= 3 && d >= 3) g.add(roundTree(Math.min(0.32, (Math.min(w, d) - 2 * t) * 0.3)));
    return g;
  },
  arc(w, d, H, c) {
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
    return g;
  },
  steps(w, d, H, c, o) {
    const L = Math.max(w, d) - 2 * GAP, W = Math.min(w, d) - 2 * GAP, n = Math.max(3, Math.round(L * 3));
    const pts = [[-L / 2, 0], [L / 2, 0], [L / 2, H]];
    for (let i = n - 1; i >= 0; i--) { const x = -L / 2 + (L * i) / n, y = (H * i) / n; pts.push([x + L / n, y], [x, y]); }
    const geo = prism(pts.slice(0, -1).concat([[-L / 2, 0]]), W);
    geo.rotateY(Math.PI / 2);
    if (d > w) geo.rotateY(Math.PI / 2);
    const g = new THREE.Group(); g.add(mesh(geo, mat(c)));
    // Children sitting on the steps.
    const r = seeded(o.id || 1), spots = [];
    for (let i = 0; i < Math.min(8, n); i++) {
      const k = Math.floor(r() * n), along = -L / 2 + (L * (k + 0.5)) / n, across = (r() - 0.5) * W * 0.8, y = (H * (k + 1)) / n;
      spots.push(w >= d ? [along, y, across] : [across, y, along]);
    }
    people(g, spots);
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
  slide(w, d, H, c) {
    // A little tower at one end and a tube slide curling down to the ground.
    const L = Math.max(w, d), g = new THREE.Group();
    const top = H, x0 = -L / 2 + 0.5;
    for (const [px, pz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) { const post = mesh(new THREE.CylinderGeometry(0.025, 0.025, top, 6), mat(WHITE)); post.position.set(x0 + px, top / 2, pz); g.add(post); }
    const deck = mesh(new THREE.BoxGeometry(0.7, 0.06, 0.7), mat(shade(c, 0.85))); deck.position.set(x0, top, 0); g.add(deck);
    const roof = mesh(new THREE.ConeGeometry(0.5, 0.4, 4), mat('#e2457d')); roof.rotation.y = Math.PI / 4; roof.position.set(x0, top + 0.32, 0); g.add(roof);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x0 + 0.35, top + 0.02, 0), new THREE.Vector3(x0 + 0.8, top * 0.7, 0.32),
      new THREE.Vector3(x0 + L * 0.55, top * 0.35, -0.3), new THREE.Vector3(L / 2 - 0.15, 0.08, 0.1)]);
    g.add(mesh(new THREE.TubeGeometry(curve, 48, 0.11, 10, false), mat(c)));
    if (d > w) g.rotation.y = -Math.PI / 2;
    const out = new THREE.Group(); out.add(g); return out;
  },
  pool(w, d, H, c) {
    const W = w - 2 * GAP, D = d - 2 * GAP, g = new THREE.Group();
    const rim = roundedRect(W, D, 0.12); rim.holes.push(roundedRect(W - 0.24, D - 0.24, 0.06));
    g.add(mesh(upExtrude(rim, 0.13), mat(c)));
    const water = mesh(new THREE.ShapeGeometry(roundedRect(W - 0.24, D - 0.24, 0.06)).rotateX(-Math.PI / 2), mat('#5fd0ea', { emissive: '#1d7fa0', emissiveIntensity: 0.25 }), false);
    water.position.y = 0.09; g.add(water);
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

// The centre line of a rounded-rectangle loop (a circle when square), as points.
function loopPath(W, D, r) {
  const s = roundedRect(W, D, r);
  return s.getSpacedPoints(Math.max(36, Math.round((W + D) * 14))).slice(0, -1).map(p => new THREE.Vector2(p.x, -p.y));
}
// Sweep a pointy-roofed house section along a path; a closed loop or an open curve with gable ends.
// The roof is broken into little houses (alternating heights), like a ring of cottages.
function sweepHouses(path, t, H, closed) {
  const n = path.length, pos = [];
  const nrm = i => {
    const a = path[(i - 1 + n) % n], b = path[(i + 1) % n];
    const p = closed ? [a, b] : [path[Math.max(0, i - 1)], path[Math.min(n - 1, i + 1)]];
    const dx = p[1].x - p[0].x, dz = p[1].y - p[0].y, l = Math.hypot(dx, dz) || 1;
    return [dz / l, -dx / l];
  };
  // Profile across the band (u from inside to outside), with a ridge in the middle.
  const prof = (hh, r) => [[-t / 2, 0], [t / 2, 0], [t / 2, hh], [0, hh + r * 1.35], [-t / 2, hh]];
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
      pos.push(...c0[0], ...c0[1], ...c0[2], ...c0[0], ...c0[2], ...c0[4], ...c0[4], ...c0[2], ...c0[3]);
      pos.push(...c0[0], ...c0[2], ...c0[1], ...c0[0], ...c0[4], ...c0[2], ...c0[4], ...c0[3], ...c0[2]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

// Build a programme piece. box = { shape, w, d, h, colour (hex), id }, opts = { open, ghost }
export function buildPiece(box, opts = {}) {
  const H = box.h * LEVEL;
  const make = BUILD[box.shape] || BUILD.box;
  const g = make(box.w, box.d, H, box.hex, { ...opts, id: box.id || 1 });
  // People on open flat roofs (a roof terrace to play on).
  if (opts.open && ['box', 'drum', 'arch'].includes(box.shape) && !opts.ghost) {
    const r = seeded(box.id || 7), n = Math.min(4, Math.max(1, Math.round(box.w * box.d / 2)));
    const spots = [];
    for (let i = 0; i < n; i++) spots.push([(r() - 0.5) * (box.w - 0.5), H + 0.01, (r() - 0.5) * (box.d - 0.5)]);
    people(g, spots);
  }
  if (opts.ghost) g.traverse(o => { if (o.isMesh) { o.material = opts.ghost; o.castShadow = false; } });
  return g;
}

export function disposePiece(g) {
  g.traverse(o => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    if (o.material && !o.material.userData?.shared && !o.material.userData?.ghost) o.material.dispose();
  });
}

export function ghostMaterial(ok) {
  const m = new THREE.MeshLambertMaterial({ color: ok ? '#ffffff' : '#ff6b5e', emissive: ok ? '#5aa9ff' : '#d02020', emissiveIntensity: 0.45, transparent: true, opacity: 0.5, depthWrite: false });
  m.userData.ghost = true;
  return m;
}
