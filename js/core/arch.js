// Architecture derived from the blocks: walls, doors, windows and the walkable graph.
// The 3D building skin, the plan drawing and the pupils' route finding all use this, so they always agree.
import { FORMS, ROOMS, LEVEL_H } from './catalogue.js';
import { key, roomGroups, DIRS } from './design.js';
import { zone, isWalkGround, isWater, site, cellGround, groundAt } from './site.js';
import { liftOf } from './character.js';

export const BOX = new Set(['cube', 'long', 'tower', 'steps']);          // drawn as merged walls in Building mode
export const OPEN_ROOM = new Set(['cylinder', 'dome', 'curve', 'arch']); // rooms with their own shape
const DIR_PRIORITY = [[0, -1], [-1, 0], [0, 1], [1, 0]];                 // doors prefer north, then west

export const isRoomCell = c => c && !FORMS[c.form].flat && !FORMS[c.form].cap && c.form !== 'wedge' && c.form !== 'slab';

// Is (x, z, l) an outdoor place you can stand on (ground, roof terrace, a pad, a deck)?
export function outdoorAt(idx, x, z, l) {
  const here = idx.occ.get(key(x, z, l));
  if (here) {
    const f = FORMS[here.form];
    return f.flat || here.form === 'slab' ? here : null;   // pads, pool decks and bridges are walkable surfaces
  }
  if (l === 0) return isWalkGround(zone(x, z)) ? 'ground' : null;
  const below = idx.occ.get(key(x, z, l - 1));
  return below && FORMS[below.form].top === 'flat' ? 'roof' : null;
}

// Doors: for every room group, a few faces onto outdoor places, preferring the north and west sides
// (so windows look south and east, towards the sun and the sea).
export function computeDoors(idx) {
  const doors = new Map();                       // "x,z,l,dx,dz" -> { x, z, l, dx, dz, room }
  for (const g of roomGroups(idx)) {
    const sample = idx.occ.get(key(g.cells[0].x, g.cells[0].z, g.level));
    if (!isRoomCell(sample)) continue;
    const cands = [];
    for (const { x, z } of g.cells) {
      const c = idx.occ.get(key(x, z, g.level));
      for (const [dx, dz] of DIR_PRIORITY) {
        if (c.form === 'arch' && !archOpenSide(c, dx, dz)) continue;
        const n = idx.occ.get(key(x + dx, z + dz, g.level));
        if (n && isRoomCell(n)) continue;
        if (!outdoorAt(idx, x + dx, z + dz, g.level)) continue;
        cands.push({ x, z, l: g.level, dx, dz, room: g.room, pri: DIR_PRIORITY.findIndex(d => d[0] === dx && d[1] === dz) });
      }
    }
    if (!cands.length) continue;
    // Arch tunnels are open at both ends; other rooms get one door per three cells.
    if (sample.form === 'arch') { for (const d of cands) doors.set(dkey(d), d); continue; }
    cands.sort((a, b) => a.pri - b.pri || a.z - b.z || a.x - b.x);
    const want = Math.max(1, Math.ceil(g.cells.length / 3));
    const chosen = [];
    for (const d of cands) {
      if (chosen.length >= want) break;
      if (chosen.some(o => Math.abs(o.x - d.x) + Math.abs(o.z - d.z) < 2)) continue;
      chosen.push(d);
    }
    if (!chosen.length) chosen.push(cands[0]);
    for (const d of chosen) doors.set(dkey(d), d);
  }
  // Inside doors: one between each pair of rooms that share a wall, near the middle of that wall.
  const groupAt = new Map();
  roomGroups(idx).forEach((g, gi) => { for (const p of g.cells) groupAt.set(key(p.x, p.z, g.level), gi); });
  const shared = new Map();
  for (const [k, gi] of groupAt) {
    const [x, z, l] = k.split(',').map(Number);
    const c = idx.occ.get(k);
    if (!isRoomCell(c)) continue;
    for (const [dx, dz] of [[1, 0], [0, 1]]) {
      const k2 = key(x + dx, z + dz, l);
      const gj = groupAt.get(k2);
      if (gj === undefined || gj === gi) continue;
      const n = idx.occ.get(k2);
      if (!isRoomCell(n)) continue;
      if (c.form === 'arch' && !archOpenSide(c, dx, dz)) continue;
      if (n.form === 'arch' && !archOpenSide(n, dx, dz)) continue;
      const pk = gi < gj ? `${gi}-${gj}` : `${gj}-${gi}`;
      if (!shared.has(pk)) shared.set(pk, []);
      shared.get(pk).push({ x, z, l, dx, dz });
    }
  }
  for (const list of shared.values()) {
    list.sort((a, b) => a.z - b.z || a.x - b.x);
    const d = list[Math.floor((list.length - 1) / 2)];
    const a = { ...d, room: idx.occ.get(key(d.x, d.z, d.l)).room, inside: true };
    const b = { x: d.x + d.dx, z: d.z + d.dz, l: d.l, dx: -d.dx, dz: -d.dz, room: idx.occ.get(key(d.x + d.dx, d.z + d.dz, d.l)).room, inside: true };
    doors.set(dkey(a), a); doors.set(dkey(b), b);
  }
  return doors;
}
export const dkey = d => `${d.x},${d.z},${d.l},${d.dx},${d.dz}`;

// The tunnel of an arch runs along its long side; only the two ends are open.
export function archOpenSide(c, dx, dz) {
  const alongX = (c.rot & 1) === 0;
  return alongX ? dz === 0 : dx === 0;
}

// Wedge (slide) direction: the high side faces this way.
export function wedgeDir(c) {
  return [[1, 0], [0, 1], [-1, 0], [0, -1]][c.rot & 3];
}

// ---------- Walkable graph ----------
// Nodes are places a pupil can stand: "x,z,l". Edges have a cost; slides are one way.
export function buildGraph(idx, doors, paths = computePaths(idx, doors)) {
  const S = site();
  const nodes = new Map();      // key -> { x, z, l, y, kind, room, cell }
  const edges = new Map();      // key -> [{ to, cost, kind }]
  const add = (k, n) => { nodes.set(k, n); edges.set(k, []); };
  const link = (a, b, cost = 1, kind = 'walk') => { if (nodes.has(a) && nodes.has(b)) edges.get(a).push({ to: b, cost, kind }); };
  const maxL = Math.max(1, ...idx.design.cells.map(c => c.level + FORMS[c.form].levels)) + 1;

  // Outdoor ground: the whole site is too big to need, so take the area round the school plus the gate.
  let x0 = S.gate[0], x1 = S.gate[0], z0 = S.gate[1], z1 = S.gate[1];
  for (const c of idx.design.cells) { x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x + 2); z0 = Math.min(z0, c.z); z1 = Math.max(z1, c.z + 2); }
  x0 = Math.max(0, x0 - 4); z0 = Math.max(0, z0 - 4); x1 = Math.min(S.w - 1, x1 + 4); z1 = Math.min(S.d - 1, z1 + 4);
  const area = { x0, z0, x1, z1 };

  for (let l = 0; l <= maxL; l++) {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const c = idx.occ.get(key(x, z, l));
      const k = key(x, z, l);
      if (c) {
        if (isRoomCell(c)) add(k, { x, z, l, y: l * LEVEL_H + cellGround(x, z) * (l === 0 ? 1 : 0) + 0.01 + (BOX.has(c.form) ? liftOf(c, idx) : 0), kind: 'room', room: c.room, cell: c });
        else if (FORMS[c.form].flat) add(k, { x, z, l, y: l * LEVEL_H + (l === 0 ? cellGround(x, z) : 0) + 0.07, kind: 'pad', room: c.room, cell: c });
        else if (c.form === 'slab') add(k, { x, z, l, y: l * LEVEL_H + 0.22, kind: c.room === 'pool' ? 'pool' : 'deck', room: c.room, cell: c });
        else if (c.form === 'wedge') add(k, { x, z, l, y: l * LEVEL_H + 0.02, kind: 'slide', room: 'slide', cell: c });
        continue;
      }
      const o = outdoorAt(idx, x, z, l);
      if (o === 'ground') add(k, { x, z, l, y: Math.max(cellGround(x, z), 0) + 0.01, kind: 'ground', room: null });
      else if (o === 'roof') add(k, { x, z, l, y: l * LEVEL_H + 0.01, kind: 'roof', room: null });
    }
  }

  // Side-by-side moves.
  for (const [k, n] of nodes) {
    for (const [dx, dz] of DIRS) {
      const mk = key(n.x + dx, n.z + dz, n.l);
      const m = nodes.get(mk);
      if (!m) continue;
      if (n.kind === 'slide' || m.kind === 'slide') {
        // You can walk off the low end of a slide, not onto its sides.
        const s = n.kind === 'slide' ? n : m;
        const [wx, wz] = wedgeDir(s.cell);
        const other = s === n ? m : n;
        const ox = other.x - s.x, oz = other.z - s.z;
        if (ox === -wx && oz === -wz && s === n) link(k, mk, 1);
        continue;
      }
      const nRoom = n.kind === 'room', mRoom = m.kind === 'room';
      if (nRoom && mRoom) {
        if (n.room === m.room) {
          if (n.cell.form === 'arch' && m.cell.form === 'arch' && !archOpenSide(n.cell, dx, dz)) continue;
          link(k, mk, 1);
        } else if (doors.has(`${n.x},${n.z},${n.l},${dx},${dz}`)) link(k, mk, 1.4, 'door');   // the one door between two rooms
        continue;
      }
      if (nRoom || mRoom) {
        const r = nRoom ? n : m, out = nRoom ? m : n;
        const ddx = out.x - r.x, ddz = out.z - r.z;
        const hasDoor = doors.has(`${r.x},${r.z},${r.l},${ddx},${ddz}`);
        if (hasDoor) link(k, mk, 1.2, 'door');
        continue;
      }
      // Outdoors to outdoors (ground, roofs, pads, decks). Pools you can walk into, but it is slow.
      const onPath = m.l === 0 && m.kind === 'ground' && paths && paths.has(`${m.x},${m.z}`);
      const cost = (m.kind === 'pool' || n.kind === 'pool') ? 2 : onPath ? 0.7 : (zone(m.x, m.z) === 'f' && m.l === 0 ? 1.4 : 1.1);
      link(k, mk, cost);
    }
  }

  // Up and down: stairs, climbing walls, slides.
  for (const c of idx.design.cells) {
    if (c.room === 'stairs' || c.form === 'steps') {
      const a = key(c.x, c.z, c.level), b = key(c.x, c.z, c.level + 1);
      link(a, b, 2, 'stairs'); link(b, a, 2, 'stairs');
    }
    if (c.room === 'climbing' || (c.form === 'tower' && c.room === 'lookout')) {
      const lv = FORMS[c.form].levels;
      for (let k2 = 0; k2 < lv; k2++) {
        const a = key(c.x, c.z, c.level + k2), b = key(c.x, c.z, c.level + k2 + 1);
        const kind = c.room === 'climbing' ? 'climb' : 'stairs';
        link(a, b, 2.5, kind); link(b, a, 2.5, kind);
      }
    }
    if (c.form === 'wedge') {
      const [wx, wz] = wedgeDir(c);
      const top = key(c.x + wx, c.z + wz, c.level + 1);   // the roof or room at the high end
      link(top, key(c.x, c.z, c.level), 0.6, 'slide');
    }
  }
  return { nodes, edges, area };
}

// A* from one node to the nearest of several goal nodes.
export function findPath(graph, from, goals) {
  const goalSet = new Set(goals);
  if (!graph.nodes.has(from) || !goalSet.size) return null;
  const gs = [...goalSet].map(k => graph.nodes.get(k)).filter(Boolean);
  const h = k => { const n = graph.nodes.get(k); let best = 1e9; for (const g of gs) best = Math.min(best, Math.abs(n.x - g.x) + Math.abs(n.z - g.z) + Math.abs(n.l - g.l) * 2); return best; };
  const open = new Map([[from, h(from)]]);
  const g = new Map([[from, 0]]);
  const came = new Map();
  let guard = 0;
  while (open.size && guard++ < 20000) {
    let cur = null, best = Infinity;
    for (const [k, f] of open) if (f < best) { best = f; cur = k; }
    if (goalSet.has(cur)) {
      const path = [cur];
      while (came.has(path[0])) path.unshift(came.get(path[0]).from);
      const kinds = [];
      for (let i = 1; i < path.length; i++) kinds.push(came.get(path[i]).kind);
      return { path, kinds, cost: g.get(cur) };
    }
    open.delete(cur);
    for (const e of graph.edges.get(cur) || []) {
      const ng = g.get(cur) + e.cost;
      if (ng < (g.get(e.to) ?? Infinity)) {
        g.set(e.to, ng);
        came.set(e.to, { from: cur, kind: e.kind });
        open.set(e.to, ng + h(e.to));
      }
    }
  }
  return null;
}

// Which nodes can be reached at all from a start node.
export function reachable(graph, from) {
  const seen = new Set([from]);
  const q = [from];
  while (q.length) {
    const k = q.pop();
    for (const e of graph.edges.get(k) || []) if (!seen.has(e.to)) { seen.add(e.to); q.push(e.to); }
  }
  return seen;
}

export function gateKey() {
  const [gx, gz] = site().gate;
  return key(gx, gz, 0);
}

// ---------- Paths ----------
// Sandy paths that join every ground-floor room's door to the gate, the way a village grows round its green.
export function computePaths(idx, doors) {
  const S = site();
  const [gx, gz] = S.gate;
  const paths = new Set([`${gx},${gz}`]);
  if (!idx.design.cells.length) return paths;
  const groups = roomGroups(idx).filter(g => g.level === 0);
  const groupOf = new Map();
  groups.forEach((g, i) => g.cells.forEach(c => groupOf.set(`${c.x},${c.z}`, i)));
  const best = new Map();
  for (const d of doors.values()) {
    if (d.l !== 0) continue;
    const gi = groupOf.get(`${d.x},${d.z}`);
    if (gi === undefined) continue;
    const ox = d.x + d.dx, oz = d.z + d.dz;
    if (!pathPassable(idx, ox, oz)) continue;
    const dist = Math.abs(ox - gx) + Math.abs(oz - gz);
    const cur = best.get(gi);
    if (!cur || dist < cur.dist) best.set(gi, { x: ox, z: oz, dist });
  }
  for (const t of [...best.values()].sort((a, b) => a.dist - b.dist)) connectPath(idx, paths, t.x, t.z);
  return paths;
}
function pathPassable(idx, x, z) {
  const o = idx.occ.get(key(x, z, 0));
  if (o) return o.form === 'slab' || o.form === 'pad';          // decks, bridges and ground tiles can be crossed
  return isWalkGround(zone(x, z)) && groundAt(x + 0.5, z + 0.5) < 0.6;
}
// Breadth-first from a door to the nearest cell already on a path, then add that route.
function connectPath(idx, paths, sx, sz) {
  const start = `${sx},${sz}`;
  if (paths.has(start)) return;
  const prev = new Map([[start, null]]);
  const q = [[sx, sz]];
  let found = null, guard = 0;
  while (q.length && guard++ < 6000 && !found) {
    const [x, z] = q.shift();
    for (const [dx, dz] of DIRS) {
      const nx = x + dx, nz = z + dz, k = `${nx},${nz}`;
      if (prev.has(k) || !pathPassable(idx, nx, nz)) continue;
      prev.set(k, `${x},${z}`);
      if (paths.has(k)) { found = k; break; }
      q.push([nx, nz]);
    }
  }
  if (!found) return;
  for (let k = prev.get(found); k; k = prev.get(k)) paths.add(k);
}

export const groundIsWater = (x, z) => isWater(zone(x, z));
export { ROOMS };
