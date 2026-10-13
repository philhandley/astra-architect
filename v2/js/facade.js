// Facade details that make a block read as a building: windows in the building's own style (big boxy frames,
// pixel squares, long strips, portholes or tall slots), a front door with a little canopy and a step, round
// windows up in the gable ends, and a pale deck on an open flat roof. Where the windows go comes from plan.js,
// so the cutaway and the walk-through show the same openings. Merged into a few meshes per piece, so it stays fast.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat } from './shapes.js';
import { GAP, WINDOWED, rows, wallRuns, openings, runAt, bandGeometry, roundedRect, ringThickness, turnAngle } from './plan.js';

const ROOF = 0.4;
const FRAME = '#fbfaf6';
// A bright colour that stands out against each wall colour, for doors and deep window frames.
const POP = { '#f7c22e': '#3d8de0', '#f28b30': '#22b2bf', '#e6463c': '#f7c22e', '#e2457d': '#f7c22e', '#f5a3c7': '#22b2bf', '#7c46a8': '#f7c22e', '#3d8de0': '#f28b30',
  '#22b2bf': '#e2457d', '#8fdac3': '#e2457d', '#a3d140': '#7c46a8', '#3e9a4f': '#f7c22e', '#f4f1ea': '#e6463c', '#2e4a8c': '#f7c22e' };
export const popColour = hex => POP[(hex || '').toLowerCase()] || '#3d8de0';

// A box w wide (along the wall), h tall and d deep, centred at height y on the wall at (x, z), out from the wall by `out`.
function panel(list, x, y, z, nx, nz, w, h, d, out = 0) {
  list.push(new THREE.BoxGeometry(w, h, d).translate(0, 0, out).rotateY(Math.atan2(nx, nz)).translate(x, y, z));
}
function disc(list, p, y, r, d, out) {
  list.push(new THREE.CylinderGeometry(r, r, d, 14).rotateX(Math.PI / 2).translate(0, 0, out).rotateY(Math.atan2(p.nx, p.nz)).translate(p.x, y, p.z));
}

// One window: glass on the wall, a frame round it (deep and brightly coloured for big windows), and glazing bars.
function rectWindow(L, run, o, yb) {
  const h = o.y1 - o.y0, yc = yb + (o.y0 + o.y1) / 2;
  L.glass.push(bandGeometry(run, o.s0, o.s1, yb + o.y0, yb + o.y1, 0.007, 0.017));
  const F = o.deep ? L.pop : o.frame ? L.of(o.frame) : L.frame, depth = o.deep ? 0.06 : 0.018, th = o.deep ? 0.024 : 0.016;
  F.push(bandGeometry(run, o.s0 - th, o.s1 + th, yb + o.y1, yb + o.y1 + th, 0, depth));
  F.push(bandGeometry(run, o.s0 - th, o.s1 + th, yb + o.y0 - th, yb + o.y0, 0, depth));
  for (const s of [o.s0 - th / 2, o.s1 + th / 2]) { const p = runAt(run, s); panel(F, p.x, yc, p.z, p.nx, p.nz, th, h, depth, depth / 2); }
  if (o.mull) for (let s = o.s0 + o.mull; s < o.s1 - 0.06; s += o.mull) { const p = runAt(run, s); panel(L.frame, p.x, yc, p.z, p.nx, p.nz, 0.012, h, 0.02, 0.014); }
  if (o.cross) {
    const p = runAt(run, (o.s0 + o.s1) / 2); panel(L.frame, p.x, yc, p.z, p.nx, p.nz, 0.012, h, 0.02, 0.014);
    L.frame.push(bandGeometry(run, o.s0, o.s1, yb + o.y0 + h * 0.64 - 0.006, yb + o.y0 + h * 0.64 + 0.006, 0.004, 0.024));
  }
}
// A flat shape (in the wall's plane) pushed out from the wall face.
function plate(list, p, y, shape, d, out) {
  list.push(new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, out - d / 2).rotateY(Math.atan2(p.nx, p.nz)).translate(p.x, y, p.z));
}
const circle = r => { const s = new THREE.Path(); s.absarc(0, 0, r, 0, Math.PI * 2, true); return s; };
function roundWindow(L, run, o, yb) {
  const p = runAt(run, (o.s0 + o.s1) / 2), r = (o.s1 - o.s0) / 2, y = yb + (o.y0 + o.y1) / 2;
  const ring = new THREE.Shape(); ring.absarc(0, 0, r + 0.022, 0, Math.PI * 2, false); ring.holes.push(circle(r));
  plate(o.frame ? L.of(o.frame) : L.frame, p, y, ring, 0.016, 0.013);
  if (L.walk) {
    // Walking through: the wall has a square hole here; a plate in the wall colour makes it look round.
    const sq = new THREE.Shape(); sq.moveTo(-r - 0.004, -r - 0.004); sq.lineTo(r + 0.004, -r - 0.004); sq.lineTo(r + 0.004, r + 0.004); sq.lineTo(-r - 0.004, r + 0.004); sq.closePath(); sq.holes.push(circle(r));
    plate(L.body, p, y, sq, 0.006, 0.004);
  } else disc(L.glass, p, y, r, 0.012, 0.016);
}
// The front door: a bright door with a little window, a white canopy over it and a step.
function frontDoor(L, run, o, yb) {
  if (o.glassDoor) return rectWindow(L, run, o, yb);
  const p = runAt(run, (o.s0 + o.s1) / 2), w = o.s1 - o.s0;
  panel(L.frame, p.x, yb + 0.158, p.z, p.nx, p.nz, w + 0.036, 0.316, 0.012, 0.006);
  panel(L.pop, p.x, yb + 0.15, p.z, p.nx, p.nz, w, 0.3, 0.014, 0.012);
  panel(L.glass, p.x, yb + 0.225, p.z, p.nx, p.nz, w * 0.46, 0.07, 0.01, 0.021);
  if (o.link) return;                            // (a door onto a bridge or stairs: no canopy, no step)
  panel(L.frame, p.x, yb + 0.345, p.z, p.nx, p.nz, w + 0.12, 0.016, 0.1, 0.05);
  panel(L.step, p.x, yb + 0.008, p.z, p.nx, p.nz, w + 0.08, 0.016, 0.07, 0.035);
}
// Round windows up in the gable ends of pointy and round roofs.
function gableWindows(L, box, H) {
  const long = box.shape === 'saw' ? box.w >= box.d : box.w > box.d, Lg = Math.max(box.w, box.d) - 2 * GAP, Wd = Math.min(box.w, box.d) - 2 * GAP, at = (a, b) => (long ? [a, b] : [b, a]), nrm = (a, b) => (long ? [a, b] : [b, a]);
  const put = (alongPos, acrossPos, nA, nB, y, r) => { const [x, z] = at(alongPos, acrossPos), [nx, nz] = nrm(nA, nB); const p = { x, z, nx, nz }; disc(L.frame, p, y, r + 0.02, 0.016, 0.008); disc(L.glass, p, y, r, 0.012, 0.016); };
  if (box.shape === 'house') {
    const r = Math.min(ROOF + 0.05, (Wd - 0.03) * 0.45); if (r < 0.2) return;
    for (const s of [-1, 1]) put(s * Lg / 2, 0, s, 0, H + r * 0.36, Math.min(0.075, r * 0.22));
  } else if (box.shape === 'vault') {
    const r = Math.min((Wd - 0.03) / 2, 0.55); if (r < 0.2) return;
    for (const s of [-1, 1]) put(s * Lg / 2, 0, s, 0, H + r * 0.42, Math.min(0.09, r * 0.24));
  } else if (box.shape === 'saw') {
    const Ls = Math.max(box.w, box.d), n = Math.max(1, Math.round(Ls)), u = (Ls - 2 * GAP) / n;
    for (let i = 0; i < n; i++) {
      const hh = H + (i % 2 ? 0.06 : 0), rf = Math.min(ROOF, u * 0.48), along = -Ls / 2 + GAP + u * (i + 0.5);
      for (const s of [-1, 1]) put(along, s * Wd / 2, 0, s, hh + rf * 0.36, Math.min(0.065, rf * 0.2));
    }
  }
}

export function addFacade(g, box, H, opts = {}) {
  if (!WINDOWED.has(box.shape) || box.surface === 'glass') return;
  const byColour = new Map(), of = hex => { if (!byColour.has(hex)) byColour.set(hex, []); return byColour.get(hex); };
  const L = { of, glass: [], frame: of(FRAME), pop: of(popColour(box.hex)), step: of('#e6e1d6') };
  for (const row of rows(box)) {
    const runs = wallRuns(box, row.k);
    // (When walking through this storey, the walls inside have the glass, and the doorway stays open.)
    const walked = opts.walkK === row.k, LL = walked ? { ...L, glass: [], walk: true, body: L.of(box.hex) } : L;
    for (const o of openings(box, row.k, runs)) {
      if (o.arch) continue;                       // (the tunnel through an arch is already in the shape)
      const run = runs[o.run];
      if (o.door) { if (walked && !o.glassDoor) { const p = runAt(run, (o.s0 + o.s1) / 2), w = o.s1 - o.s0; panel(L.frame, p.x, row.y0 + 0.345, p.z, p.nx, p.nz, w + 0.12, 0.016, 0.1, 0.05); panel(L.step, p.x, row.y0 + 0.008, p.z, p.nx, p.nz, w + 0.08, 0.016, 0.07, 0.035); } else frontDoor(LL, run, o, row.y0); }
      else if (o.round) roundWindow(LL, run, o, row.y0); else rectWindow(LL, run, o, row.y0);
    }
  }
  // Gable windows are worked out on the unturned piece, then turned with it.
  const ang = turnAngle(box), before = new Map([...byColour].map(([k, v]) => [k, v.length])), g0 = L.glass.length;
  gableWindows(L, box, H);
  if (ang) { for (const [k, v] of byColour) for (let i = before.get(k) || 0; i < v.length; i++) v[i].rotateY(-ang); for (let i = g0; i < L.glass.length; i++) L.glass[i].rotateY(-ang); }
  // (Window frames, doors and glass carry no outlines: the lines stay on the buildings themselves.)
  const merge = list => mergeGeometries(list.map(x => { const y = x.index ? x.toNonIndexed() : x; if (y.attributes.uv) y.deleteAttribute('uv'); return y; }));
  if (L.glass.length) { const m = new THREE.Mesh(merge(L.glass), mat('#a9d8ec', { emissive: '#6cb6d6', emissiveIntensity: 0.22 })); m.userData.glass = true; m.userData.noInk = true; m.receiveShadow = true; g.add(m); }
  for (const [hex, list] of byColour) if (list.length) { const m = new THREE.Mesh(merge(list), mat(hex)); m.castShadow = true; m.receiveShadow = true; m.userData.noInk = true; g.add(m); }
}

// A pale deck on an open flat roof, so it reads as a terrace to play on.
export function addTerrace(g, box, H) {
  const W = box.w - 2 * GAP - 0.06, D = box.d - 2 * GAP - 0.06;
  let shape, y = H;
  if (box.shape === 'drum') { shape = roundedRect(W, D, Math.min(W, D) / 2); y = H + 0.015; }      // the drum's rounded top edge sits a little higher
  else if (box.shape === 'ring' && box.w >= 2 && box.d >= 2) {
    const t = ringThickness(box), hw = box.w - 2 * GAP - 2 * t, hd = box.d - 2 * GAP - 2 * t;
    shape = roundedRect(W, D, Math.min(W, D) / 2); shape.holes.push(roundedRect(hw, hd, Math.min(hw, hd) / 2)); y = H + 0.015;
  }
  else if (box.shape === 'box') shape = roundedRect(W, D, 0.03);
  else return;
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.014, bevelEnabled: false, curveSegments: 24 }).rotateX(-Math.PI / 2).translate(0, y, 0);
  const deck = new THREE.Mesh(geo, mat('#efe9dd')); deck.receiveShadow = true;
  g.add(deck);
}

// A soft shadow under a building where it meets the ground.
let BLOB = null;
export function contactShadow(box) {
  if (!BLOB) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'); x.shadowColor = 'rgba(30,26,18,1)'; x.shadowBlur = 20; x.fillStyle = 'rgba(30,26,18,1)';
    x.beginPath(); x.roundRect(26, 26, 76, 76, 14); x.fill();
    const t = new THREE.CanvasTexture(c);
    BLOB = { geo: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat: new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.32, depthWrite: false }) };
    BLOB.geo.userData.shared = true; BLOB.mat.userData.shared = true;
  }
  const m = new THREE.Mesh(BLOB.geo, BLOB.mat);
  m.scale.set(box.w / 0.6, 1, box.d / 0.6); m.position.y = 0.006; m.renderOrder = 1; m.raycast = () => {}; m.userData.noInk = true;
  return m;
}
