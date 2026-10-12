// The Brief: Finn's wishes, checked against the design every time it changes.
import { ROOMS, FORMS } from './catalogue.js';
import { roomGroups, seaView, nearWaterfall, key, allMoods, DIRS } from './design.js';
import { computeDoors, buildGraph, reachable, gateKey } from './arch.js';

const has = (idx, room) => idx.design.cells.some(c => c.room === room);

export const HINTS = {
  'yoga-waterfall': 'Build a chill-out room close to the waterfall. It is at the top, near the pool under the falls.',
  'sea-classroom': 'Put a classroom where its windows look out at the sea. Try the edge of the meadow nearest the beach, or the beach itself.',
  pool: 'Choose the swimming pool and build it anywhere.',
  'arch-aquarium': 'Choose the aquarium. It starts as an arch you can walk through. Four curves make a ring.',
  'roof-track': 'Build some rooms, then put running track tiles on their roofs. Join them up into a loop!',
  lunch: 'Build a lunch room, or a hall where everyone can eat.',
  library: 'Build a library somewhere quiet.',
  toilets: 'Every school needs toilets!',
  slide: 'Put a slide next to something high.',
  lookout: 'Build a lookout tower.',
  garden: 'Build a garden, on the ground or on a roof.',
  climbing: 'Build a climbing wall.',
  art: 'Build an art room.',
  music: 'Build a music room, somewhere it will not disturb the library.',
  happy: 'Tap the faces to see why a room is sad, then move things so every room is happy.',
  reach: 'Run a school day to check that pupils can get everywhere. Stairs help them go up.',
};

// A closed loop: some group of track tiles where every tile joins at least two others.
export function trackLoops(idx) {
  const tiles = idx.design.cells.filter(c => c.room === 'track');
  const set = new Set(tiles.map(c => key(c.x, c.z, c.level)));
  const loops = [];
  const seen = new Set();
  for (const c of tiles) {
    const k = key(c.x, c.z, c.level);
    if (seen.has(k)) continue;
    const comp = [];
    const q = [c];
    seen.add(k);
    while (q.length) {
      const t = q.pop();
      comp.push(t);
      for (const [dx, dz] of DIRS) {
        const nk = key(t.x + dx, t.z + dz, t.level);
        if (set.has(nk) && !seen.has(nk)) { seen.add(nk); q.push(tiles.find(o => key(o.x, o.z, o.level) === nk)); }
      }
    }
    let edges = 0;
    for (const t of comp) for (const [dx, dz] of DIRS) if (set.has(key(t.x + dx, t.z + dz, t.level))) edges++;
    edges /= 2;
    loops.push({ tiles: comp, level: c.level, closed: comp.length >= 4 && edges >= comp.length });
  }
  return loops;
}

export function checkBrief(idx, ids) {
  const groups = roomGroups(idx);
  const out = {};
  for (const id of ids) {
    let done = false;
    switch (id) {
      case 'yoga-waterfall': done = groups.some(g => g.room === 'yoga' && nearWaterfall(g)); break;
      case 'sea-classroom': done = groups.some(g => g.room === 'classroom' && seaView(idx, g)); break;
      case 'pool': done = has(idx, 'pool'); break;
      case 'arch-aquarium': done = idx.design.cells.some(c => c.room === 'aquarium' && (c.form === 'arch' || c.form === 'curve')); break;
      case 'roof-track': done = trackLoops(idx).some(l => l.closed && l.level >= 1); break;
      case 'lunch': done = has(idx, 'lunch') || has(idx, 'hall'); break;
      case 'happy': { const m = allMoods(idx); done = m.length >= 3 && m.every(x => x.m.face !== 'sad'); break; }
      case 'reach': {
        if (!idx.design.cells.length) break;
        const graph = buildGraph(idx, computeDoors(idx));
        const r = reachable(graph, gateKey());
        const rooms = [...graph.nodes.entries()].filter(([, n]) => n.kind === 'room' || n.kind === 'pad' || n.kind === 'pool');
        done = rooms.length > 0 && rooms.every(([k]) => r.has(k));
        break;
      }
      default: done = ROOMS[id] ? has(idx, id) : false;
    }
    out[id] = done;
  }
  return out;
}

export { FORMS };
