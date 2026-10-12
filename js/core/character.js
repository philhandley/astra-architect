// Room characters: each room is its own figure, in the spirit of John Hejduk's playful buildings.
// A room's style (roof, windows, walls, push and pull, extras) turns its block footprint into a shape
// with curves, a roof with personality and windows of its own. layoutGroup() is pure geometry, shared
// by the 3D builder and the plan drawing, so both always agree.
import * as THREE from 'three';
import { ROOMS, LEVEL_H } from './catalogue.js';
import { key, roomGroups } from './design.js';

// Materials kept across rebuilds (everything cached). Anything else is freed when the school is rebuilt.
const keepSet = new WeakSet();
export const KEEP = { has: m => keepSet.has(m), keep: m => { keepSet.add(m); return m; } };

export const ROOFS = ['flat', 'pitch', 'pyramid', 'cone', 'barrel', 'saw', 'mono', 'dome'];
export const WINDOWS = ['big', 'round', 'face', 'slot', 'strip', 'grid', 'none'];
export const WALLS = ['straight', 'round', 'curvy', 'wave'];
export const SIDES = ['s', 'e', 'n', 'w'];
export const ROOF_NAMES = { flat: 'Flat', pitch: 'Pointy', pyramid: 'Pyramid', cone: 'Witch hat', barrel: 'Round', saw: 'Zigzag', mono: 'Slope', dome: 'Dome' };
export const WINDOW_NAMES = { big: 'Big glass', round: 'Portholes', face: 'A face', slot: 'Slits', strip: 'Strip', grid: 'Grid', none: 'None' };
// Every room has a character name, read aloud in the Style workshop (an idea from John Hejduk's drawings).
export const CHARACTER_NAMES = { classroom: 'the Thinking House', hall: 'the Big Jump Hall', library: 'the Story Tower', lunch: 'the Munch House', art: 'the Paint Pot', music: 'the Drum House', toilets: 'the Splash Room', changing: 'the Wiggle Room', yoga: 'the Calm Shell', aquarium: 'the Fish Palace', lookout: 'the Seagull Tower', climbing: 'the Monkey Tower', stairs: 'the Up and Down' };
export const WALL_NAMES = { straight: 'Straight', round: 'Soft corners', curvy: 'Curvy', wave: 'Wavy' };

// Every kind of room starts with its own character, so a new school already looks like a little village.
export const DEFAULT_STYLE = {
  classroom: { roof: 'saw', win: 'big' },
  hall: { roof: 'barrel', win: 'slot' },
  library: { roof: 'mono', win: 'strip' },
  lunch: { roof: 'pitch', win: 'round' },
  art: { roof: 'pyramid', win: 'grid' },
  music: { roof: 'cone', win: 'round', walls: 'round' },
  toilets: { roof: 'flat', win: 'round' },
  changing: { roof: 'flat', win: 'round' },
  stairs: { roof: 'flat', win: 'slot' },
  climbing: { roof: 'pyramid', win: 'none' },
  lookout: { roof: 'cone', win: 'round' },
  yoga: { roof: 'dome', win: 'big', walls: 'round' },
  aquarium: { roof: 'barrel', win: 'big' },
};
const BASE = { roof: 'flat', win: 'big', walls: 'straight', side: 's', tall: 0, bay: false, legs: false, chimney: false, flag: false, beak: false, roofColour: null };

export function styleOf(cells) {
  const src = cells.find(c => c && c.style)?.style || {};
  const own = Object.fromEntries(Object.entries(src).filter(([, v]) => v !== undefined));
  const room = cells[0]?.room;
  return { ...BASE, ...(DEFAULT_STYLE[room] || {}), ...own };
}

export const LIFT = 0.28;                 // how high legs raise a room
// A room stands on legs only on the ground and with nothing on top. The whole room shares one answer.
export function liftOf(c, idx) {
  if (!c || c.level !== 0) return 0;
  if (!idx) return c.style && c.style.legs ? LIFT : 0;
  if (!idx._lifted) idx._lifted = liftedCells(idx);
  return idx._lifted.has(c.id) ? LIFT : 0;
}
function liftedCells(idx) {
  const out = new Set();
  for (const g of roomGroups(idx)) {
    if (g.level !== 0) continue;
    const dc = [...g.forms].map(id => idx.byId.get(id)).filter(Boolean);
    if (!styleOf(dc).legs) continue;
    if (g.cells.some(p => idx.occ.has(key(p.x, p.z, 1)))) continue;
    for (const c of dc) out.add(c.id);
  }
  return out;
}
// Split cells into pieces that touch side by side (a curved block can cut a room in two).
export function splitParts(cells) {
  const left = new Map(cells.map(c => [`${c.x},${c.z}`, c]));
  const parts = [];
  while (left.size) {
    const [k0, c0] = left.entries().next().value;
    left.delete(k0);
    const part = [c0], todo = [c0];
    while (todo.length) {
      const c = todo.pop();
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${c.x + dx},${c.z + dz}`;
        if (left.has(k)) { const n = left.get(k); left.delete(k); part.push(n); todo.push(n); }
      }
    }
    parts.push(part);
  }
  return parts;
}

const SIDE_VEC = { s: [0, 1], n: [0, -1], e: [1, 0], w: [-1, 0] };

// ---------- Outline of a group of cells ----------
// Boundary edges run with the room on one side; n = (dz, -dx) always points out of the room.
export function traceLoops(cells) {
  const set = new Set(cells.map(c => `${c.x},${c.z}`));
  const has = (x, z) => set.has(`${x},${z}`);
  const edges = new Map();
  const addE = (ax, az, bx, bz) => { const k = `${ax},${az}`; if (!edges.has(k)) edges.set(k, []); edges.get(k).push([bx, bz]); };
  for (const { x, z } of cells) {
    if (!has(x, z - 1)) addE(x, z, x + 1, z);
    if (!has(x + 1, z)) addE(x + 1, z, x + 1, z + 1);
    if (!has(x, z + 1)) addE(x + 1, z + 1, x, z + 1);
    if (!has(x - 1, z)) addE(x, z + 1, x, z);
  }
  const loops = [];
  let guardAll = 0;
  while (edges.size && guardAll++ < 200) {
    const [startK] = edges.keys();
    let [cx, cz] = startK.split(',').map(Number);
    const loop = [[cx, cz]];
    let guard = 0, px = null, pz = null;
    while (guard++ < 10000) {
      const k = `${cx},${cz}`;
      const outs = edges.get(k);
      if (!outs || !outs.length) { edges.delete(k); break; }
      // Where two corners touch, always keep to the outside (the sharper left turn), so a courtyard stays
      // a closed courtyard whatever order the blocks were built in.
      let pick = 0;
      if (outs.length > 1 && px !== null) {
        const ix = cx - px, iz = cz - pz;
        const turn = o => ix * (o[1] - cz) - iz * (o[0] - cx);
        pick = outs.reduce((bi, o, i) => (turn(o) < turn(outs[bi]) ? i : bi), 0);
      }
      const [nx, nz] = outs.splice(pick, 1)[0];
      if (!outs.length) edges.delete(k);
      px = cx; pz = cz;
      cx = nx; cz = nz;
      if (cx === loop[0][0] && cz === loop[0][1]) break;
      loop.push([cx, cz]);
    }
    if (loop.length >= 3) loops.push(simplify(loop));
  }
  return loops;
}
function simplify(loop) {
  const out = [];
  const n = loop.length;
  for (let i = 0; i < n; i++) {
    const a = loop[(i - 1 + n) % n], b = loop[i], c = loop[(i + 1) % n];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cross) > 1e-9) out.push(b);
  }
  return out;
}
export const loopArea = l => { let a = 0; for (let i = 0; i < l.length; i++) { const p = l[i], q = l[(i + 1) % l.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };

// Soften corners into quarter circles.
function rounded(loop, rConvex = 0.34, rConcave = 0.14) {
  const out = [];
  const n = loop.length;
  for (let i = 0; i < n; i++) {
    const a = loop[(i - 1 + n) % n], b = loop[i], c = loop[(i + 1) % n];
    const v1 = [b[0] - a[0], b[1] - a[1]], v2 = [c[0] - b[0], c[1] - b[1]];
    const l1 = Math.hypot(...v1), l2 = Math.hypot(...v2);
    const cross = v1[0] * v2[1] - v1[1] * v2[0];
    const r = Math.min(cross > 0 ? rConvex : rConcave, l1 / 2 - 0.01, l2 / 2 - 0.01);
    if (r <= 0.02) { out.push(b); continue; }
    const u1 = [v1[0] / l1, v1[1] / l1], u2 = [v2[0] / l2, v2[1] / l2];
    const s = [b[0] - u1[0] * r, b[1] - u1[1] * r], e = [b[0] + u2[0] * r, b[1] + u2[1] * r];
    const cen = [s[0] + u2[0] * r, s[1] + u2[1] * r];
    const a0 = Math.atan2(s[1] - cen[1], s[0] - cen[0]);
    let a1 = Math.atan2(e[1] - cen[1], e[0] - cen[0]);
    let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    for (let k = 0; k <= 6; k++) { const t = a0 + da * k / 6; out.push([cen[0] + Math.cos(t) * r, cen[1] + Math.sin(t) * r]); }
  }
  return out;
}

// Replace the longest edge facing `side` with a curve (a bulge) or a wave.
function shapeSide(loop, side, kind) {
  const sv = SIDE_VEC[side] || SIDE_VEC.s;
  let best = -1, bestLen = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i], b = loop[(i + 1) % loop.length];
    const d = [b[0] - a[0], b[1] - a[1]], len = Math.hypot(...d);
    const nrm = [d[1] / len, -d[0] / len];
    if (nrm[0] * sv[0] + nrm[1] * sv[1] > 0.9 && len > bestLen) { best = i; bestLen = len; }
  }
  if (best < 0) return { loop, edge: null };
  const a = loop[best], b = loop[(best + 1) % loop.length];
  const d = [b[0] - a[0], b[1] - a[1]];
  const nrm = [d[1] / bestLen, -d[0] / bestLen];
  const pts = [];
  const N = Math.max(10, Math.round(bestLen * 14));
  const h = Math.min(0.42, bestLen * 0.3), waves = Math.max(1, Math.round(bestLen / 0.7));
  for (let k = 1; k < N; k++) {
    const t = k / N;
    const off = kind === 'curvy' ? h * Math.sin(Math.PI * t) : 0.1 * Math.sin(2 * Math.PI * waves * t);
    pts.push([a[0] + d[0] * t + nrm[0] * off, a[1] + d[1] * t + nrm[1] * off]);
  }
  const out = [...loop.slice(0, best + 1), ...pts, ...loop.slice(best + 1)];
  return { loop: out, edge: { a, b, nrm, h: kind === 'curvy' ? h : 0.1 } };
}

const nearestOn = (segs, px, pz) => {
  let best = null, bd = Infinity;
  for (const s of segs) {
    const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((px - s.a[0]) * dx + (pz - s.a[1]) * dz) / L2));
    const x = s.a[0] + dx * t, z = s.a[1] + dz * t, d = Math.hypot(px - x, pz - z);
    if (d < bd) { bd = d; best = { x, z, nx: s.n[0], nz: s.n[1], seg: s }; }
  }
  return best;
};

// Everything about how one room group looks, in plan coordinates (x, z).
export function layoutGroup(group, idx, doors, style, { cut = false } = {}) {
  const cells = group.cells;
  const loops = traceLoops(cells);
  if (!loops.length) return null;
  loops.sort((p, q) => loopArea(q) - loopArea(p));
  let outer = loops[0];
  const holes = loops.slice(1).filter(l => loopArea(l) < 0);
  let bulge = null;
  if (style.walls === 'round') outer = rounded(outer);
  else if (style.walls === 'curvy' || style.walls === 'wave') { const r = shapeSide(outer, style.side, style.walls); outer = r.loop; bulge = r.edge; }
  const xs = cells.map(c => c.x), zs = cells.map(c => c.z);
  const bbox = { x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs) + 1, z1: Math.max(...zs) + 1 };
  const rect = cells.length === (bbox.x1 - bbox.x0) * (bbox.z1 - bbox.z0) && !holes.length;
  const covered = cells.some(c => idx.occ.has(key(c.x, c.z, group.level + 1)));
  const lift = style.legs && group.level === 0 && !covered ? LIFT : 0;
  const tall = covered || cut ? 0 : (style.tall || 0);
  const height = cut ? 0.26 : LEVEL_H * (1 + 0.45 * tall);
  // Wall segments (outer and courtyards), with outward normals.
  const segs = [];
  const pushSegs = l => { for (let i = 0; i < l.length; i++) { const a = l[i], b = l[(i + 1) % l.length]; const d = [b[0] - a[0], b[1] - a[1]]; const len = Math.hypot(...d); if (len < 1e-6) continue; segs.push({ a, b, len, n: [d[1] / len, -d[0] / len] }); } };
  pushSegs(outer); holes.forEach(pushSegs);
  // Doors from the shared door map, moved onto the (maybe curved) wall.
  const doorPts = [];
  for (const { x, z } of cells) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const k = `${x},${z},${group.level},${dx},${dz}`;
    const n = idx.occ.get(key(x + dx, z + dz, group.level));
    if (n && n.room === group.room) continue;
    if (!doors.has(k)) continue;
    const p = nearestOn(segs, x + 0.5 + dx * 0.5, z + 0.5 + dz * 0.5);
    if (p) doorPts.push({ ...p, outside: !n, dx, dz });
  }
  // Windows evenly along the walls, keeping clear of corners and doors.
  const windows = [];
  if (!cut && style.win === 'face') {
    // Two round eyes and a wide smile on the sunniest long wall.
    const front = segs.filter(s => s.len > 0.6).sort((p, q) => (q.n[0] * 0.6 + q.n[1] * 0.8) - (p.n[0] * 0.6 + p.n[1] * 0.8))[0];
    if (front) {
      const at = t => [front.a[0] + (front.b[0] - front.a[0]) * t, front.a[1] + (front.b[1] - front.a[1]) * t];
      const e = Math.min(0.3, 0.32 / front.len);
      for (const t of [0.5 - e, 0.5 + e]) { const [x, z] = at(t); windows.push({ x, z, nx: front.n[0], nz: front.n[1], w: 0.2, type: 'eye' }); }
      if (!doorPts.some(d => Math.hypot(d.x - at(0.5)[0], d.z - at(0.5)[1]) < 0.3)) { const [x, z] = at(0.5); windows.push({ x, z, nx: front.n[0], nz: front.n[1], w: Math.min(0.5, front.len * 0.4), type: 'smile' }); }
    }
  }
  if (!cut && style.win !== 'none' && style.win !== 'face') {
    const spacing = { big: 0.5, round: 0.34, slot: 0.26, strip: 0.2, grid: 0.5 }[style.win] || 0.5;
    for (const s of segs) {
      if (style.win === 'strip') {
        const n = Math.max(1, Math.round(s.len / 0.2));
        for (let k = 0; k < n; k++) {
          const t0 = k / n, t1 = (k + 1) / n, tm = (t0 + t1) / 2;
          const x = s.a[0] + (s.b[0] - s.a[0]) * tm, z = s.a[1] + (s.b[1] - s.a[1]) * tm;
          if (doorPts.some(d => Math.hypot(d.x - x, d.z - z) < 0.26)) continue;
          windows.push({ x, z, nx: s.n[0], nz: s.n[1], w: s.len / n + 0.002, type: 'strip' });
        }
        continue;
      }
      if (s.len < spacing * 0.8) {
        if (s.len > 0.1 && ['round', 'slot'].includes(style.win)) {
          // short curved pieces get the odd porthole or slit
        } else continue;
      }
      const n = Math.max(1, Math.floor(s.len / spacing));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const x = s.a[0] + (s.b[0] - s.a[0]) * t, z = s.a[1] + (s.b[1] - s.a[1]) * t;
        if (s.len >= 0.3 && (t * s.len < 0.12 || (1 - t) * s.len < 0.12)) continue;
        if (doorPts.some(d => Math.hypot(d.x - x, d.z - z) < 0.3)) continue;
        if (windows.some(w => Math.hypot(w.x - x, w.z - z) < spacing * 0.6)) continue;
        windows.push({ x, z, nx: s.n[0], nz: s.n[1], w: Math.min(0.36, s.len / n * 0.72), type: style.win });
      }
    }
  }
  // A face for the bay window: the middle of the longest wall on the chosen side.
  let bay = null;
  if (style.bay && !cut) {
    const sv = SIDE_VEC[style.side] || SIDE_VEC.s;
    const cand = segs.filter(s => s.n[0] * sv[0] + s.n[1] * sv[1] > 0.7).sort((p, q) => q.len - p.len)[0] || segs.slice().sort((p, q) => q.len - p.len)[0];
    if (cand) bay = { x: (cand.a[0] + cand.b[0]) / 2, z: (cand.a[1] + cand.b[1]) / 2, nx: cand.n[0], nz: cand.n[1] };
    if (bay) for (let i = windows.length - 1; i >= 0; i--) if (Math.hypot(windows[i].x - bay.x, windows[i].z - bay.z) < 0.4) windows.splice(i, 1);
  }
  return { group, style, outer, holes, segs, doorPts, windows, bbox, rect, covered, lift, height, tall, bay, bulge };
}
const isRoomish = n => n && !['pad', 'slab', 'wedge', 'roof'].includes(n.form);

// ---------- 3D ----------
const mats = new Map();
const M = (k, make) => { if (!mats.has(k)) mats.set(k, KEEP.keep(make())); return mats.get(k); };
let CLIPS = [];
export function setClip(arr) { CLIPS = arr; }
const lam = (hex, extra = {}) => M(hex + JSON.stringify(extra), () => new THREE.MeshLambertMaterial({ color: hex, clippingPlanes: CLIPS, ...extra }));
export const ROOF_DEFAULT_COLOUR = { pitch: '#3d405b', pyramid: '#3d405b', cone: '#3d405b', barrel: '#dfe5e8', dome: '#dfe5e8', saw: '#f7f4ee', mono: null, flat: '#f7f4ee' };
export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = v => Math.max(0, Math.min(255, Math.round(k >= 1 ? v + (255 - v) * (k - 1) : v * k)));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map(v => v.toString(16).padStart(2, '0')).join('');
}
const DOOR_ACCENT = c => (['#ffd166', '#f4c95d', '#ffd60a'].includes(c) ? '#e76f51' : '#ffd166');

// The room's body: its outline pushed up into a solid, open inside so you can walk in.
export function bodyGeometry(L, y0) {
  const toV = p => new THREE.Vector2(p[0], -p[1]);
  const shape = new THREE.Shape(L.outer.map(toV));
  for (const h of L.holes) shape.holes.push(new THREE.Path(h.map(toV)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: L.height, bevelEnabled: false, curveSegments: 4 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0 + L.lift, 0);
  return g;
}

// The doll's-house version for the school day: low walls with no lid, and a floor.
export function openBody(L, y0, h = 0.26) {
  const pos = [], nor = [];
  const quad = (a, b, n, ya, yb) => {
    const v = [[a[0], ya, a[1]], [b[0], ya, b[1]], [b[0], yb, b[1]], [a[0], yb, a[1]]];
    for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...v[i]); nor.push(n[0], 0, n[1]); }
  };
  const yb = y0 + L.lift;
  for (const sgm of L.segs) quad(sgm.a, sgm.b, sgm.n, yb, yb + h);
  const walls = new THREE.BufferGeometry();
  walls.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  walls.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  const toV = p => new THREE.Vector2(p[0], -p[1]);
  const shape = new THREE.Shape(L.outer.map(toV));
  for (const hl of L.holes) shape.holes.push(new THREE.Path(hl.map(toV)));
  const floor = new THREE.ShapeGeometry(shape);
  floor.rotateX(-Math.PI / 2);
  floor.translate(0, yb + 0.006, 0);
  return { walls, floor };
}

// A roof of the given type over a rectangle (cells x0..x1, z0..z1), sitting at height y.
// Built with its long side along x, then turned to fit.
export function roofObject(type, x0, z0, x1, z1, y, colour, roomColour) {
  const W = x1 - x0, D = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const alongX = W >= D;
  const long = alongX ? W : D, short = alongX ? D : W;
  const col = colour || ROOF_DEFAULT_COLOUR[type] || shade(roomColour, 0.72);
  const mat = lam(col), white = lam('#f7f4ee');
  const g = new THREE.Group();
  const add = (geo, m = mat) => { const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); return mesh; };
  const ov = 0.1;
  if (type === 'pitch' || type === 'mono') {
    const w = short + ov * 2, hgt = type === 'pitch' ? Math.min(0.55, 0.32 * short + 0.18) : Math.min(0.4, 0.2 * short + 0.12);
    const s = new THREE.Shape();
    if (type === 'pitch') { s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, hgt); s.lineTo(-w / 2, 0); }
    else { s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, hgt); s.lineTo(-w / 2, 0.04); }
    const geo = new THREE.ExtrudeGeometry(s, { depth: long + ov * 2, bevelEnabled: false });
    geo.translate(0, 0, -(long + ov * 2) / 2);
    geo.rotateY(Math.PI / 2);
    add(geo);
    add(new THREE.BoxGeometry(long + ov * 2, 0.03, w), white).position.y = 0.015;
  } else if (type === 'pyramid') {
    const geo = new THREE.ConeGeometry(0.5, 1, 4, 1);
    geo.rotateY(Math.PI / 4);
    const k = 1 / Math.SQRT1_2, hgt = Math.min(0.9, 0.42 * short + 0.3);
    const m = add(geo);
    m.scale.set((long + ov * 2) * k, hgt, (short + ov * 2) * k);
    m.position.y = hgt / 2;
  } else if (type === 'cone') {
    // Square rooms get one big witch hat; long rooms get a row of them.
    const n = Math.max(1, Math.round(long / short));
    const r = short / 2 + 0.08, hgt = Math.min(1.1, r * 1.9 + 0.2);
    for (let i = 0; i < n; i++) {
      const t = -long / 2 + long * (i + 0.5) / n;
      const m = add(new THREE.ConeGeometry(r, hgt, 28, 1));
      m.position.set(t, hgt / 2, 0);
      add(new THREE.CylinderGeometry(r + 0.05, r + 0.05, 0.03, 28), white).position.set(t, 0.015, 0);
    }
  } else if (type === 'dome') {
    const hgt = Math.min(0.7, short * 0.5);
    const m = add(new THREE.SphereGeometry(0.5, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2));
    m.scale.set(long + 0.04, hgt * 2, short + 0.04);
    add(new THREE.SphereGeometry(0.06, 10, 8), white).position.y = hgt + 0.02;
  } else if (type === 'barrel') {
    const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 20, 1, true, 0, Math.PI);
    geo.rotateZ(Math.PI / 2);
    const m = add(geo, lam(col, { side: THREE.DoubleSide }));
    m.scale.set(long + ov, short * 0.62, short);
    for (const sgn of [-1, 1]) {
      const lun = add(new THREE.CircleGeometry(0.48, 20, 0, Math.PI), glassMat());
      lun.scale.set(short, short * 0.62, 1);
      lun.rotation.y = sgn * Math.PI / 2;
      lun.position.x = sgn * (long + ov) / 2;
    }
    const n = Math.max(1, Math.round(long));
    for (let i = 0; i <= n; i++) {
      const rib = add(new THREE.TorusGeometry(0.5, 0.014, 4, 18, Math.PI), white);
      rib.scale.set(short, short * 0.62, short);
      rib.rotation.y = Math.PI / 2;
      rib.position.x = -long / 2 + long * i / n;
    }
  } else if (type === 'saw') {
    const n = Math.max(1, Math.round(long / 0.55)), tw = long / n, hgt = 0.24;
    for (let i = 0; i < n; i++) {
      const s = new THREE.Shape();
      s.moveTo(0, 0); s.lineTo(tw, 0); s.lineTo(tw, hgt); s.lineTo(0, 0);
      const geo = new THREE.ExtrudeGeometry(s, { depth: short, bevelEnabled: false });
      geo.translate(-long / 2 + i * tw, 0, -short / 2);
      add(geo);
      add(new THREE.BoxGeometry(0.012, hgt * 0.78, short * 0.86), glassMat()).position.set(-long / 2 + (i + 1) * tw - 0.008, hgt * 0.45, 0);
    }
    add(new THREE.BoxGeometry(long + ov * 2, 0.04, short + ov * 2), white).position.y = 0.02;
  } else {
    add(new THREE.BoxGeometry(long + ov * 2.4, 0.05, short + ov * 2.4)).position.y = 0.025;
  }
  if (!alongX) g.rotation.y = Math.PI / 2;
  g.position.set(cx, y, cz);
  return g;
}
let _glass = null;
export function glassMat() { return _glass || (_glass = KEEP.keep(new THREE.MeshLambertMaterial({ color: '#cdeaf5', emissive: '#6fb1d1', emissiveIntensity: 0.22, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, clippingPlanes: CLIPS }))); }

// A flat roof that follows any outline, a little bigger all round.
export function slabFollowing(L, y, colour) {
  const toV = p => new THREE.Vector2(p[0], -p[1]);
  const cx = (L.bbox.x0 + L.bbox.x1) / 2, cz = (L.bbox.z0 + L.bbox.z1) / 2;
  const grow = p => { const dx = p[0] - cx, dz = p[1] - cz, d = Math.hypot(dx, dz) || 1; return [p[0] + dx / d * 0.1, p[1] + dz / d * 0.1]; };
  const shape = new THREE.Shape(L.outer.map(grow).map(toV));
  for (const h of L.holes) shape.holes.push(new THREE.Path(h.map(toV)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  const m = new THREE.Mesh(g, lam(colour || '#f7f4ee'));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export { ROOMS, DOOR_ACCENT };
