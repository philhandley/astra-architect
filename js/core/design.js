// The design (Finn's school) as data: occupancy, placement rules, rooms and neighbours. No Three.js here.
import { FORMS, ROOMS, MAX_LEVEL, formCells } from './catalogue.js';
import { zone, canBuildOn, site, isWater } from './site.js';

export const key = (x, z, l) => `${x},${z},${l}`;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const DIRS = N4;

// Every (x, z, level) a design entry occupies.
export function footprint(c) {
  const f = FORMS[c.form];
  const out = [];
  for (const [dx, dz] of formCells(c.form, c.rot || 0)) {
    for (let k = 0; k < f.levels; k++) out.push({ x: c.x + dx, z: c.z + dz, level: c.level + k });
  }
  return out;
}

export function indexDesign(design) {
  const occ = new Map();
  const byId = new Map();
  for (const c of design.cells) {
    byId.set(c.id, c);
    for (const p of footprint(c)) occ.set(key(p.x, p.z, p.level), c);
  }
  return { occ, byId, design };
}

export const at = (idx, x, z, l) => idx.occ.get(key(x, z, l)) || null;

// The level a new form would sit on if dropped at (x, z): on top of whatever is there.
export function stackLevel(idx, x, z) {
  let l = 0;
  while (l <= MAX_LEVEL && idx.occ.has(key(x, z, l))) l++;
  return l;
}

const SUPPORT_ALL = new Set(['slab', 'dome', 'wedge', 'roof', 'pad']);

export const REASONS = {
  taken: 'Something is already there.',
  water: 'That is water! Only a pool, a bridge or the aquarium can go on water.',
  rock: 'It is too rocky to build there.',
  slope: 'The forest is too steep there. Try nearer the meadow.',
  edge: 'That is off the edge of the map.',
  float: 'It needs something underneath to sit on.',
  high: 'That is as high as we can build.',
  cap: 'Nothing can go on top of that shape.',
};

// Can this candidate go here? Returns { ok, why, cells }.
export function placeCheck(idx, cand, ignoreId = null) {
  const room = ROOMS[cand.room];
  const cells = footprint(cand);
  const formTop = FORMS[cand.form].levels - 1 + cand.level;
  if (formTop > MAX_LEVEL) return { ok: false, why: 'high', cells };
  let supported = 0;
  const base = cells.filter(p => p.level === cand.level);
  for (const p of cells) {
    const o = idx.occ.get(key(p.x, p.z, p.level));
    if (o && o.id !== ignoreId) return { ok: false, why: 'taken', cells };
    if (p.x < 0 || p.z < 0 || p.x >= site().w || p.z >= site().d) return { ok: false, why: 'edge', cells };
  }
  if (cand.level === 0) {
    for (const p of base) {
      const r = canBuildOn(p.x, p.z, room);
      if (!r.ok) return { ok: false, why: r.why, cells };
    }
    return { ok: true, cells };
  }
  for (const p of base) {
    const below = idx.occ.get(key(p.x, p.z, cand.level - 1));
    if (below && below.id !== ignoreId) {
      if (FORMS[below.form].top !== 'flat') return { ok: false, why: 'cap', cells };
      supported++;
    }
  }
  if (supported === 0) return { ok: false, why: 'float', cells };
  if (SUPPORT_ALL.has(cand.form) && supported < base.length) return { ok: false, why: 'float', cells };
  return { ok: true, cells };
}

// Rooms: groups of same-room cells joined side by side on one level.
export function roomGroups(idx) {
  const seen = new Set();
  const groups = [];
  for (const [k, c] of idx.occ) {
    if (seen.has(k)) continue;
    const [x0, z0, l0] = k.split(',').map(Number);
    const g = { room: c.room, level: l0, cells: [], forms: new Set(), id: groups.length };
    const q = [[x0, z0]];
    seen.add(k);
    while (q.length) {
      const [x, z] = q.pop();
      const cc = idx.occ.get(key(x, z, l0));
      g.cells.push({ x, z });
      g.forms.add(cc.id);
      for (const [dx, dz] of N4) {
        const nk = key(x + dx, z + dz, l0);
        const n = idx.occ.get(nk);
        if (n && !seen.has(nk) && n.room === c.room) { seen.add(nk); q.push([x + dx, z + dz]); }
      }
    }
    groups.push(g);
  }
  return groups;
}

// Does any cell of this group look out over the sea?
export function seaView(idx, g) {
  for (const { x, z } of g.cells) {
    for (const [dx, dz] of N4) {
      const n = idx.occ.get(key(x + dx, z + dz, g.level));
      if (n && !FORMS[n.form].flat) continue;     // a wall of another room, not a window
      for (let s = 1; s <= 16; s++) {
        const cx = x + dx * s, cz = z + dz * s;
        const zn = zone(cx, cz);
        if (zn === 'x') break;
        let blocked = false;
        for (let l = g.level; l <= g.level + 1 && !blocked; l++) {
          const o = idx.occ.get(key(cx, cz, l));
          if (o && !FORMS[o.form].flat && !(o.room === 'pool' || o.room === 'bridge')) blocked = true;
        }
        if (blocked) break;
        if (zn === 'w') return { x, z, dx, dz };
      }
    }
  }
  return null;
}

export function nearWaterfall(g, within = 5.5) {
  const [wx, wz] = site().waterfall;
  return g.cells.some(({ x, z }) => Math.hypot(x + 0.5 - wx, z + 0.5 - wz) <= within);
}

// Who and what is next to a room group: other rooms (side by side, above and below) and site features.
export function neighbours(idx, g) {
  const rooms = new Set();
  const features = new Set();
  for (const { x, z } of g.cells) {
    for (const [dx, dz] of N4) {
      const n = idx.occ.get(key(x + dx, z + dz, g.level));
      if (n && n.room !== g.room) rooms.add(n.room);
      if (g.level === 0 && !n) {
        const zn = zone(x + dx, z + dz);
        if (zn === 'f') features.add('trees');
        if (zn === 'b' || zn === 'w') features.add('beach');
      }
    }
    for (const dl of [-1, 1]) {
      const n = idx.occ.get(key(x, z, g.level + dl));
      if (n && n.room !== g.room) rooms.add(n.room);
    }
  }
  if (g.level === 0 && g.cells.some(({ x, z }) => zone(x, z) === 'b')) features.add('beach');
  if (nearWaterfall(g)) features.add('waterfall');
  if (seaView(idx, g)) features.add('view');
  return { rooms, features };
}

// Happy, unhappy or fine, with reasons a six-year-old can hear.
export function mood(idx, g) {
  const R = ROOMS[g.room];
  const { rooms, features } = neighbours(idx, g);
  const liked = R.likes.filter(id => rooms.has(id) || features.has(id));
  const disliked = R.dislikes.filter(id => rooms.has(id));
  // A room can also be happy simply by being near something nice that is not on its list.
  const face = disliked.length ? 'sad' : liked.length ? 'happy' : 'ok';
  return { face, liked, disliked, rooms, features };
}

export function allMoods(idx) {
  const groups = roomGroups(idx).filter(g => !['stairs', 'bridge', 'slide', 'track', 'climbing'].includes(g.room) || ROOMS[g.room].dislikes.length);
  return groups.map(g => ({ g, m: mood(idx, g) }));
}

export function bounds(design) {
  if (!design.cells.length) return null;
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9, l1 = 0;
  for (const c of design.cells) for (const p of footprint(c)) {
    x0 = Math.min(x0, p.x); z0 = Math.min(z0, p.z); x1 = Math.max(x1, p.x + 1); z1 = Math.max(z1, p.z + 1); l1 = Math.max(l1, p.level + 1);
  }
  return { x0, z0, x1, z1, l1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
}

export const onWater = (x, z) => isWater(zone(x, z));
