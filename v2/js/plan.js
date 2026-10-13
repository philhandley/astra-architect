// The plan of a building: its outline, the runs of outside wall round it, and where its windows and door go.
// The outside (facade.js), the cutaway and the walk-through (inside.js) all use this, so they always match.
import * as THREE from 'three';
import { LEVEL } from './catalogue.js';

export const GAP = 0.035;
export const WALL_T = 0.04;                         // wall thickness inside
export const REC = 0.18;                            // how far the ground floor steps back behind a colonnade
export const SOFFIT = LEVEL - 0.06;                 // the underside of the floor above a colonnade
// Rooms that are one tall space (the floor stays at the bottom); others are stacked storeys.
export const TALL = new Set(['hall', 'aquarium', 'pool']);

export function roundedRect(W, D, r) {
  const s = new THREE.Shape(), x = -W / 2, y = -D / 2;
  r = Math.max(0.001, Math.min(r, W / 2, D / 2));
  s.moveTo(x + r, y); s.lineTo(x + W - r, y); s.absarc(x + W - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + W, y + D - r); s.absarc(x + W - r, y + D - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + D); s.absarc(x + r, y + D - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
// Signed "inside" test for a rounded rectangle (local x, z), shrunk by m.
export function inRR(x, z, W, D, r, m = 0) {
  const hw = W / 2 - m, hd = D / 2 - m, rr = Math.max(0, r - m);
  if (hw <= 0 || hd <= 0) return false;
  const qx = Math.abs(x) - (hw - rr), qz = Math.abs(z) - (hd - rr);
  if (qx <= 0 || qz <= 0) return Math.abs(x) <= hw && Math.abs(z) <= hd;
  return Math.hypot(qx, qz) <= rr;
}
export function seeded(seed) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- window styles ----------
// Each kind of room has a favourite; Finn can change it with the Windows button.
export const DEFAULT_WIN = { classroom: 'big', ringhouse: 'big', art: 'big', treehouse: 'big', hall: 'slots', pool: 'ribbon', lunch: 'ribbon', maker: 'grid',
  aquarium: 'porthole', yoga: 'porthole', music: 'porthole', observatory: 'porthole', library: 'pixel' };
export const winStyle = b => b.win || DEFAULT_WIN[b.type] || 'grid';
// Shapes with walls you can put windows in.
export const WINDOWED = new Set(['box', 'house', 'saw', 'vault', 'drum', 'tower', 'ring', 'ringhouse', 'arc', 'observatory', 'arch']);
// A ring on the ground, big enough to walk round, has a colonnade round its courtyard.
export const hasColonnade = b => (b.shape === 'ring' || b.shape === 'ringhouse') && b.w >= 3 && b.d >= 3 && !(b.level > 0);
export function ringThickness(b) {
  const W = b.w - 2 * GAP - 0.03, D = b.d - 2 * GAP - 0.03;
  if (b.shape === 'ringhouse') return b.w >= 3 && b.d >= 3 ? 0.9 : 0.6;
  return b.w >= 3 && b.d >= 3 ? 0.95 : Math.min(W, D) * 0.3;
}

// How far a piece is turned: square pieces in quarter turns; long ones flip end to end on their second turn
// (their first turn swaps width and depth instead).
export function turnAngle(b) {
  const r = (b.rot || 0) % 4;
  return r ? (b.w === b.d ? r : r >= 2 ? 2 : 0) * Math.PI / 2 : 0;
}

// ---------- the outline ----------
// The plan outline of a room at storey k (its outside face), with an "inside" test for furniture and people.
export function outline(b, k = 0) {
  const W = b.w - 2 * GAP, D = b.d - 2 * GAP, s = b.shape;
  if (['drum', 'tower', 'observatory'].includes(s)) { const r = Math.min(W, D) / 2; return { kind: 'rr', W, D, r, inside: (x, z, m) => inRR(x, z, W, D, r, m) }; }
  if ((s === 'ring' || s === 'ringhouse') && b.w >= 2 && b.d >= 2) {
    const t = ringThickness(b), r = Math.min(W, D) / 2;
    const fWi = s === 'ring' ? W - 2 * t - 0.06 : W - 2 * t, fDi = s === 'ring' ? D - 2 * t - 0.06 : D - 2 * t, fri = Math.max(0.05, Math.min(fWi, fDi) / 2);
    const col = hasColonnade(b) && k === 0, e = col ? REC : 0;
    const Wi = fWi + 2 * e, Di = fDi + 2 * e, ri = Math.max(0.05, Math.min(Wi, Di) / 2);
    return { kind: 'ring', W, D, r, Wi, Di, ri, fWi, fDi, fri, col, inside: (x, z, m) => inRR(x, z, W, D, r, m) && !inRR(x, z, Wi, Di, ri, -m) };
  }
  if (s === 'arc') {
    const pie = Math.min(b.w, b.d) < 2, cx = -b.w / 2 + GAP, cz = -b.d / 2 + GAP;
    let R0, R1;
    if (pie) { R0 = 0; R1 = 1 - 2 * GAP - 0.005; } else { const R = Math.min(b.w, b.d) - GAP - 0.45; R0 = R - 0.425; R1 = R + 0.425; }
    const rot = Math.round(turnAngle(b) / (Math.PI / 2)), ph = rot * Math.PI / 2, co = Math.cos(ph), si = Math.sin(ph);
    const un = (x, z) => [x * co + z * si, -x * si + z * co];      // back to the unturned frame
    const inside0 = (u, v, m) => { const dd = Math.hypot(u - cx, v - cz); return dd > R0 + m && dd < R1 - m && u > cx + m && v > cz + m; };     // before turning
    return { kind: 'arc', pie, cx, cz, R0, R1, rot, inside0, inside: (x, z, m) => inside0(...un(x, z), m) };
  }
  return { kind: 'rr', W, D, r: 0.04, inside: (x, z, m) => inRR(x, z, W, D, 0.04, m) };
}

// ---------- runs of wall ----------
// A run is one stretch of outside wall: points along its outside face, which way is out, and how long it is.
function makeRun(pts, closed, outer, solid) {
  if (closed) pts = [...pts, pts[0]];
  const s = [0], n = [];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], l = Math.hypot(bx - ax, bz - az) || 1, dx = (bx - ax) / l, dz = (bz - az) / l;
    let nx = -dz, nz = dx;
    // "Out" is the side that is not building.
    if (solid((ax + bx) / 2 + nx * 0.03, (az + bz) / 2 + nz * 0.03)) { nx = -nx; nz = -nz; }
    n.push([nx, nz]);
  }
  return { pts, s, n, len: s[s.length - 1], closed, outer };
}
// Where along a run is s: the point, the way out and the way along.
export function runAt(run, s) {
  let i = 0;
  while (i < run.s.length - 2 && run.s[i + 1] < s) i++;
  const a = run.pts[i], b = run.pts[i + 1], l = run.s[i + 1] - run.s[i] || 1, t = Math.max(0, Math.min(1, (s - run.s[i]) / l));
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, nx: run.n[i][0], nz: run.n[i][1], dx: (b[0] - a[0]) / l, dz: (b[1] - a[1]) / l };
}
// Walk along a run from s0 to s1, calling fn for each straight piece (centre, way out, way along, length).
export function eachPiece(run, s0, s1, fn) {
  for (let i = 0; i < run.pts.length - 1; i++) {
    const a = run.s[i], b = run.s[i + 1];
    if (b <= s0 || a >= s1) continue;
    const u0 = Math.max(a, s0), u1 = Math.min(b, s1);
    if (u1 - u0 < 1e-4) continue;
    const P = run.pts[i], Q = run.pts[i + 1], l = b - a || 1, dx = (Q[0] - P[0]) / l, dz = (Q[1] - P[1]) / l, um = (u0 + u1) / 2 - a;
    fn({ x: P[0] + dx * um, z: P[1] + dz * um, nx: run.n[i][0], nz: run.n[i][1], dx, dz, len: u1 - u0, u0, u1 });
  }
}
const loopPts = (W, D, r) => { const sh = roundedRect(W, D, r), n = Math.max(32, Math.round(sh.getLength() / 0.035)); return sh.getSpacedPoints(n).slice(0, -1).map(p => [p.x, -p.y]); };
const arcPts = (cx, cz, R, a0, a1, n = Math.max(24, Math.round(Math.abs(a1 - a0) * R / 0.035))) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * R, cz + Math.sin(a) * R]; });

// The runs of wall round a building at storey k.
export function wallRuns(b, k = 0) {
  // (Curved pieces are worked out unturned, then turned at the end.)
  const o = outline(b, k), solid = o.inside0 ? (x, z) => o.inside0(x, z, 0) : (x, z) => o.inside(x, z, 0), runs = [];
  if (o.kind === 'rr' && o.r < 0.15) {
    const { W, D } = o, T = WALL_T;
    runs.push(makeRun([[-W / 2, D / 2], [W / 2, D / 2]], false, true, solid));
    runs.push(makeRun([[W / 2, D / 2 - T], [W / 2, -D / 2 + T]], false, true, solid));
    runs.push(makeRun([[W / 2, -D / 2], [-W / 2, -D / 2]], false, true, solid));
    runs.push(makeRun([[-W / 2, -D / 2 + T], [-W / 2, D / 2 - T]], false, true, solid));
  } else if (o.kind === 'rr') {
    runs.push(makeRun(loopPts(o.W, o.D, o.r), true, true, solid));
  } else if (o.kind === 'ring') {
    runs.push(makeRun(loopPts(o.W, o.D, o.r), true, true, solid));
    const inner = makeRun(loopPts(o.Wi, o.Di, o.ri), true, false, solid);
    inner.colonnade = o.col;
    runs.push(inner);
  } else {
    const { cx, cz, R0, R1 } = o;
    runs.push(makeRun(arcPts(cx, cz, R1, 0, Math.PI / 2), false, true, solid));
    if (o.pie) {
      runs.push(makeRun([[cx, cz + R1], [cx, cz]], false, true, solid));
      runs.push(makeRun([[cx, cz], [cx + R1, cz]], false, true, solid));
    } else {
      runs.push(makeRun([[cx, cz + R1], [cx, cz + R0]], false, true, solid));
      runs.push(makeRun(arcPts(cx, cz, R0, Math.PI / 2, 0), false, true, solid));
      runs.push(makeRun([[cx + R0, cz], [cx + R1, cz]], false, true, solid));
    }
  }
  // A turned piece: everything is worked out unturned, then turned (so the door and windows turn with it).
  const ang = turnAngle(b);
  if (ang) {
    const co = Math.cos(ang), si = Math.sin(ang), turn = ([x, z]) => [x * co - z * si, x * si + z * co];
    for (const r of runs) { r.pts = r.pts.map(turn); r.n = r.n.map(turn); }
  }
  runs.ang = ang;
  return runs;
}

// ---------- windows and doors ----------
const PIXEL_FRAMES = ['#f7c22e', '#e2457d', '#22b2bf', '#3d8de0', '#a3d140', '#f28b30', '#ffffff', '#ffffff'];
const spread = (len, n, w, y0, y1, extra = {}) => { const st = len / n; return Array.from({ length: n }, (_, i) => ({ s0: st * (i + 0.5) - w / 2, s1: st * (i + 0.5) + w / 2, y0, y1, ...extra })); };
// Each style fills one run of wall, rh tall (one storey, or the whole height of a tall room).
const PATTERNS = {
  // Neat rows of framed windows.
  grid: (r, rh) => { if (r.len < 0.16) return []; const n = Math.max(1, Math.round(r.len / 0.34)); return spread(r.len, n, Math.min(0.2, (r.len / n) * 0.62), rh > 0.6 ? 0.12 : 0.13, rh > 0.6 ? rh - 0.14 : 0.36); },
  // Big picture windows in deep coloured frames that stick out, like boxes.
  big: (r, rh) => { if (r.len < 0.24) return []; const n = Math.max(1, Math.round(r.len / 0.55)); return spread(r.len, n, Math.min(0.46, (r.len / n) * 0.74), 0.07, rh > 0.6 ? rh * 0.74 : 0.42, { deep: true, cross: true }); },
  // One long strip window round each storey.
  ribbon: (r, rh) => { if (r.len < 0.22) return []; const out = [], rows = rh > 0.6 ? Math.max(1, Math.round(rh / LEVEL)) : 1; for (let i = 0; i < rows; i++) out.push({ s0: 0.07, s1: r.len - 0.07, y0: i * LEVEL + 0.17, y1: i * LEVEL + 0.36, mull: 0.17 }); return out; },
  // Round windows, like a ship.
  porthole: (r, rh) => {
    const d = 0.17, n = Math.max(1, Math.round(r.len / 0.3)), st = r.len / n, rows = rh > 0.6 ? [rh * 0.33, rh * 0.68] : [0.25], out = [];
    if (r.len < 0.22) return out;
    rows.forEach((yc, j) => { for (let i = 0; i < n; i++) { const s = st * (i + 0.5) + (rows.length > 1 && j % 2 ? st / 2 : 0), y = yc + (rows.length === 1 && n > 2 ? (i % 2 ? 0.03 : -0.03) : 0); if (s + d / 2 > r.len - 0.03) continue; out.push({ s0: s - d / 2, s1: s + d / 2, y0: y - d / 2, y1: y + d / 2, round: true }); } });
    return out;
  },
  // Tall thin slots of different widths, in a jumpy rhythm.
  slots: (r, rh, rnd) => { const out = []; let s = 0.06 + rnd() * 0.05; while (s < r.len - 0.09) { const w = [0.035, 0.06, 0.09][Math.floor(rnd() * 3)]; if (s + w > r.len - 0.05) break; out.push({ s0: s, s1: s + w, y0: 0.06, y1: rh - (rh > 0.6 ? 0.1 : 0.06) }); s += w + 0.04 + rnd() * 0.11; } return out; },
  // Pixel windows: squares of three sizes scattered over the wall, some with bright frames.
  pixel: (r, rh, rnd) => {
    const out = [], sizes = [0.09, 0.13, 0.19], tries = Math.round(r.len * rh * 34);
    for (let t = 0; t < tries; t++) {
      const sz = sizes[Math.floor(rnd() * 3)]; if (r.len - 0.08 - sz < 0 || rh - 0.1 - sz < 0) continue;
      const s0 = 0.04 + rnd() * (r.len - 0.08 - sz), y0 = 0.05 + rnd() * (rh - 0.1 - sz), w = { s0, s1: s0 + sz, y0, y1: y0 + sz };
      if (out.some(o => o.s0 < w.s1 + 0.03 && w.s0 < o.s1 + 0.03 && o.y0 < w.y1 + 0.03 && w.y0 < o.y1 + 0.03)) continue;
      if (rnd() < 0.45) w.frame = PIXEL_FRAMES[Math.floor(rnd() * PIXEL_FRAMES.length)];
      out.push(w);
    }
    return out;
  },
};
// Behind a colonnade: a glass wall from floor to ceiling, with glass doors every few panes.
function glazed(r) {
  const n = Math.max(3, Math.round(r.len / 0.3)), st = r.len / n, out = [];
  for (let i = 0; i < n; i++) out.push({ s0: st * i + 0.012, s1: st * (i + 1) - 0.012, y0: i % 4 === 0 ? 0 : 0.02, y1: SOFFIT - 0.02, door: i % 4 === 0, glassDoor: true });
  return out;
}
// Where the front door goes: on an outside wall, facing the front (towards +z) as much as possible.
function findDoor(runs) {
  let best = null;
  runs.forEach((r, ri) => {
    if (!r.outer || r.len < 0.26) return;
    const co = Math.cos(-(runs.ang || 0)), si = Math.sin(-(runs.ang || 0));
    for (let s = 0.12; s <= r.len - 0.12; s += 0.02) {
      const q = runAt(r, s), p = { z: q.x * si + q.z * co, nz: q.nx * si + q.nz * co };
      const score = p.nz * 2 + p.z * 0.2 - Math.abs(s - r.len / 2) * (r.closed ? 0 : 0.02);
      if (!best || score > best.score + 1e-6) best = { score, run: ri, s };
    }
  });
  return best && { run: best.run, s0: best.s - 0.08, s1: best.s + 0.08 };
}
// The rows of a building: one per storey, or one for a tall room.
export function rows(b) {
  const H = b.h * LEVEL;
  return TALL.has(b.type) ? [{ k: 0, y0: 0, h: H }] : Array.from({ length: b.h }, (_, k) => ({ k, y0: k * LEVEL, h: LEVEL }));
}
// The openings in storey k: [{ run, s0, s1, y0, y1 (above that storey's floor), round, door, deep, frame, mull, cross }].
export function openings(b, k, runs = wallRuns(b, k)) {
  const out = [];
  if (!WINDOWED.has(b.shape) || b.surface === 'glass') return out;
  const tall = TALL.has(b.type), rh = tall ? b.h * LEVEL : LEVEL, style = winStyle(b), rnd = seeded((b.id || 1) * 131 + k * 17 + b.w * 7 + b.d * 3);
  const door = !(b.level > 0) && k === 0 && b.shape !== 'arch' ? findDoor(runs) : null;
  const pattern = PATTERNS[style] || PATTERNS.grid;
  // An arch: the tunnel runs along the long axis, so its two ends (the short faces) are open: the way in and out.
  const ang = runs.ang || 0, co = Math.cos(ang), si = Math.sin(ang), a0 = b.w >= b.d ? [1, 0] : [0, 1];
  const along = [a0[0] * co - a0[1] * si, a0[0] * si + a0[1] * co];
  const isEnd = r => Math.abs(r.n[0][0] * along[0] + r.n[0][1] * along[1]) > 0.5;
  runs.forEach((r, ri) => {
    if (b.shape === 'arch') {
      if (isEnd(r)) { const a = archSpan(b, rh); out.push({ run: ri, s0: r.len / 2 - a.w / 2, s1: r.len / 2 + a.w / 2, y0: 0, y1: a.h, door: true, arch: true }); return; }
      // Windows only on its long sides, and no front door (the tunnel is the way in).
      if (b.type === 'archway') return;
    }
    if (r.colonnade) { for (const o of glazed(r)) out.push({ ...o, run: ri }); return; }
    if (!door || door.run !== ri) { for (const o of pattern(r, rh, rnd)) out.push({ ...o, run: ri }); return; }
    // The wall with the front door: windows are laid out either side of it, so the door never pushes them all away.
    for (const [a, z] of [[0, door.s0 - 0.04], [door.s1 + 0.04, r.len]]) {
      if (z - a < 0.14) continue;
      for (const o of pattern({ len: z - a }, rh, rnd)) {
        if (o.y0 < 0.34 && (a + o.s1 > door.s0 - 0.02 && a + o.s0 < door.s1 + 0.02)) continue;
        out.push({ ...o, s0: o.s0 + a, s1: o.s1 + a, run: ri });
      }
    }
  });
  if (door) out.push({ run: door.run, s0: door.s0, s1: door.s1, y0: 0, y1: 0.3, door: true });
  return out;
}

// The tunnel through an arch: how wide it is and how high its top is (the same curve shapes.js builds).
export function archSpan(b, rh = (TALL.has(b.type) ? b.h : 1) * LEVEL) {
  const Wd = Math.min(b.w, b.d) - 2 * GAP - 0.03, H = b.h * LEVEL, a = Wd * 0.56, spring = Math.min(H * 0.32, H - a / 2 - 0.06);
  return { w: a, h: Math.min(rh, spring + a / 2), spring };
}

// A smooth band following a run from s0 to s1, from y0 to y1, standing o0..o1 out from the wall face.
// (One piece of geometry that bends round curves, so curved window frames look clean, not segmented.)
export function bandGeometry(run, s0, s1, y0, y1, o0, o1) {
  const P = [], a = runAt(run, s0), b = runAt(run, s1);
  P.push([a.x, a.z, a.nx, a.nz]);
  for (let i = 1; i < run.pts.length - 1; i++) if (run.s[i] > s0 + 1e-5 && run.s[i] < s1 - 1e-5) {
    let nx = run.n[i - 1][0] + run.n[i][0], nz = run.n[i - 1][1] + run.n[i][1]; const l = Math.hypot(nx, nz) || 1;
    P.push([run.pts[i][0], run.pts[i][1], nx / l, nz / l]);
  }
  P.push([b.x, b.z, b.nx, b.nz]);
  const F = P.map(([x, z, nx, nz]) => [x + nx * o1, z + nz * o1]), B = P.map(([x, z, nx, nz]) => [x + nx * o0, z + nz * o0]), pos = [];
  const quad = (p, q, r, s, n) => {
    const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2];
    if ((uy * vz - uz * vy) * n[0] + (uz * vx - ux * vz) * n[1] + (ux * vy - uy * vx) * n[2] < 0) pos.push(...p, ...r, ...q, ...p, ...s, ...r); else pos.push(...p, ...q, ...r, ...p, ...r, ...s);
  };
  for (let i = 0; i < P.length - 1; i++) {
    const n = [P[i][2] + P[i + 1][2], 0, P[i][3] + P[i + 1][3]];
    quad([F[i][0], y0, F[i][1]], [F[i + 1][0], y0, F[i + 1][1]], [F[i + 1][0], y1, F[i + 1][1]], [F[i][0], y1, F[i][1]], n);
    quad([B[i][0], y0, B[i][1]], [B[i + 1][0], y0, B[i + 1][1]], [B[i + 1][0], y1, B[i + 1][1]], [B[i][0], y1, B[i][1]], [-n[0], 0, -n[2]]);
    quad([F[i][0], y1, F[i][1]], [F[i + 1][0], y1, F[i + 1][1]], [B[i + 1][0], y1, B[i + 1][1]], [B[i][0], y1, B[i][1]], [0, 1, 0]);
    quad([F[i][0], y0, F[i][1]], [F[i + 1][0], y0, F[i + 1][1]], [B[i + 1][0], y0, B[i + 1][1]], [B[i][0], y0, B[i][1]], [0, -1, 0]);
  }
  const end = (i, j) => quad([F[i][0], y0, F[i][1]], [B[i][0], y0, B[i][1]], [B[i][0], y1, B[i][1]], [F[i][0], y1, F[i][1]], [F[i][0] - F[j][0], 0, F[i][1] - F[j][1]]);
  end(0, 1); end(P.length - 1, P.length - 2);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return g;
}
