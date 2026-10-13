// The school day. A bell rings, the children walk from room to room across the school yard (round the
// buildings, up the stairs to rooms on upper floors) and the paths they tread wear into the grass.
import * as THREE from 'three';
import { PROGRAMMES, LEVEL } from './catalogue.js';
import { GRID, square, site } from './site.js';
import { outline, storeyFloor, CUTTABLE } from './inside.js';
import { seeded } from './crowd.js';

export const PERIODS = [
  { id: 'arrive', name: 'Arriving', emoji: '🎒', types: ['own'] },
  { id: 'pe', name: 'PE', emoji: '🤸', types: ['hall', 'track', 'pool'] },
  { id: 'break', name: 'Playtime', emoji: '🛝', types: ['yard', 'slide', 'steps', 'terraces', 'garden', 'circle', 'tree'] },
  { id: 'lunch', name: 'Lunch', emoji: '🍎', types: ['lunch'] },
  { id: 'clubs', name: 'Clubs', emoji: '🎨', types: ['library', 'art', 'music', 'maker', 'greenhouse', 'observatory', 'aquarium', 'yoga', 'stage'] },
  { id: 'home', name: 'Home time', emoji: '🏠', types: ['gate'] },
];
const CLASSES = new Set(['classroom', 'ringhouse', 'treehouse']);
const WALK_THROUGH = new Set(['track', 'garden', 'circle', 'terraces', 'canopy', 'steps', 'tree', 'arch']);
const TOP_Y = { track: 0.09, garden: 0.16, circle: 0.045, stage: 0.16, terraces: 0.06, steps: 0.02, tree: 0.012, slide: 0.012, pool: 0.09 };
export const PERIOD_SECONDS = 15;

// Paths worn into the grass, painted onto a see-through layer over the site.
export class Trails {
  constructor(world) {
    this.c = document.createElement('canvas'); this.c.width = GRID.w * 50; this.c.height = GRID.d * 50;
    this.g = this.c.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(GRID.w, GRID.d).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false }));
    this.mesh.position.set(GRID.w / 2, 0.024, GRID.d / 2); this.mesh.renderOrder = 2; this.mesh.raycast = () => {};
    world.scene.add(this.mesh);
    this.dirty = 0;
    world.updaters.add(() => { if (this.dirty) { this.tex.needsUpdate = true; this.dirty = 0; } });
  }
  paint(x, z) {
    const g = this.g, px = x * 50, pz = z * 50;
    g.fillStyle = 'rgba(205, 176, 122, 0.035)'; g.beginPath(); g.arc(px, pz, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(170, 136, 84, 0.03)'; g.beginPath(); g.arc(px, pz, 3, 0, Math.PI * 2); g.fill();
    this.dirty++;
  }
  clear() { this.g.clearRect(0, 0, this.c.width, this.c.height); this.dirty++; }
}

export class SchoolDay {
  constructor({ world, model, crowd, yOf, onPeriod, onEnd }) {
    Object.assign(this, { world, model, crowd, yOf, onPeriod, onEnd });
    this.t = 0; this.period = -1; this.running = false;
    this.tick = dt => this.update(dt);
  }

  // ---------- the map of the school for walking ----------
  blocked(x, z) {
    const q = square(x, z);
    if (!q || q.zone === 'water' || q.zone === 'rocks') return true;
    const b = this.model.at(x, z, 0);
    return !!(b && !WALK_THROUGH.has(b.shape) && !WALK_THROUGH.has(b.type));
  }
  cost(x, z) { const q = square(x, z); return q.build ? 1 : 2.5; }
  // A* on the grid of squares, from square a to square b.
  route(a, b) {
    const key = (x, z) => x + z * GRID.w, open = new Map(), came = new Map(), gS = new Map();
    const h = (x, z) => Math.hypot(x - b[0], z - b[1]);
    const start = key(...a); gS.set(start, 0); open.set(start, h(...a));
    let guard = 0;
    while (open.size && guard++ < 4000) {
      let cur = null, best = Infinity; for (const [k, f] of open) if (f < best) { best = f; cur = k; }
      open.delete(cur);
      const cx = cur % GRID.w, cz = Math.floor(cur / GRID.w);
      if (cx === b[0] && cz === b[1]) { const out = [[cx, cz]]; let k = cur; while (came.has(k)) { k = came.get(k); out.unshift([k % GRID.w, Math.floor(k / GRID.w)]); } return out; }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= GRID.w || nz >= GRID.d) continue;
        const goal = nx === b[0] && nz === b[1];
        if (!goal && this.blocked(nx, nz)) continue;
        if (dx && dz && (this.blocked(cx + dx, cz) || this.blocked(cx, cz + dz))) continue;
        const k = key(nx, nz), g2 = gS.get(cur) + Math.hypot(dx, dz) * (goal ? 1 : this.cost(nx, nz));
        if (g2 < (gS.get(k) ?? Infinity)) { gS.set(k, g2); came.set(k, cur); open.set(k, g2 + h(nx, nz)); }
      }
    }
    return null;
  }

  // ---------- places in the school ----------
  findPlaces() {
    const m = this.model, out = [];
    const stairs = m.boxes.filter(b => b.type === 'stairs' || b.type === 'ramp');
    for (const b of m.boxes) {
      const type = b.type, cx = b.x + b.w / 2, cz = b.z + b.d / 2, y0 = this.yOf(b);
      const sq = m.squares(b);
      // A door: a free square next to the room, on the ground.
      let door = null;
      if (b.level === 0) {
        const near = [];
        for (const [x, z] of sq) for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const nx = x + dx, nz = z + dz; if (sq.some(s => s[0] === nx && s[1] === nz)) continue; if (!this.blocked(nx, nz)) near.push([nx, nz, dz === 1 ? 0 : 1]); }
        near.sort((p, q) => p[2] - q[2]);
        if (near.length) door = near[Math.floor(near.length / 2) % near.length];
      } else {
        // Upper rooms are reached by stairs next to the building.
        const st = stairs.find(s => s.level === 0 && s.level + s.h >= b.level && m.squares(s).some(([x, z]) => sq.some(([qx, qz]) => Math.abs(qx - x) + Math.abs(qz - z) === 1 || this.column(b, x, z))));
        if (!st) continue;
        const [sx, sz] = m.squares(st)[0];
        const near = [];
        for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (!this.blocked(sx + dx, sz + dz)) near.push([sx + dx, sz + dz]);
        if (!near.length) continue;
        door = near[0];
        b.__stairs = { x: sx + 0.5, z: sz + 0.5 };
      }
      if (!door && !['tree'].includes(b.shape)) continue;
      let zone;
      if (CUTTABLE.has(b.shape) && PROGRAMMES[type] && !['archway'].includes(type)) {
        const o = outline(b), fy = y0 + storeyFloor(b, b.level) + 0.02;
        zone = { ox: cx, oy: fy, oz: cz, w: b.w, d: b.d, inside: o.inside, margin: 0.12, boxId: b.id };
      } else {
        const topY = TOP_Y[b.shape] ?? 0.012, pad = b.shape === 'tree' || b.shape === 'slide' ? 0.6 : -0.1;
        zone = { rect: { x0: b.x - pad, z0: b.z - pad, x1: b.x + b.w + pad, z1: b.z + b.d + pad }, oy: y0 + topY, boxId: b.id, kind: b.shape === 'pool' ? 'swim' : 'walk' };
        if (b.shape === 'pool') zone.oy = y0 + 0.09;
      }
      out.push({ b, type, door: door || [Math.floor(cx), Math.floor(cz)], zone, level: b.level, cap: sq.length * (CLASSES.has(type) ? 6 : 5) });
    }
    return out;
  }
  column(b, x, z) { return false; }

  // ---------- running the day ----------
  start() {
    const m = this.model, r = seeded(m.boxes.length * 31 + 7);
    this.r = r;
    this.places = this.findPlaces();
    const classes = this.places.filter(p => CLASSES.has(p.type));
    const S = site(), gate = [Math.max(0, Math.min(GRID.w - 1, S.gate[0])), Math.max(0, Math.min(GRID.d - 1, S.gate[1]))];
    this.gate = gate;
    // The yard: free land near the school.
    const ok = (x, z) => { const xi = Math.floor(x), zi = Math.floor(z), q = square(xi, zi); return q?.build && !this.blocked(xi, zi); };
    this.yard = { rect: { x0: 1, z0: 6, x1: 13, z1: 13 }, ok, oy: 0.012, kind: 'walk' };
    const n = Math.max(12, Math.min(72, classes.reduce((a, p) => a + p.cap, 0) || 18));
    const people = [];
    for (let i = 0; i < n; i++) {
      const p = { kind: 'walk', zone: { rect: { x0: gate[0] + 0.1, z0: gate[1] + 0.1, x1: gate[0] + 0.9, z1: gate[1] + 0.9 }, oy: 0.012 }, s: i % 9 === 0 ? 0.98 : 0.72 + r() * 0.1, ph: r() * 6, wait: 0, speed: 0.36 * (0.85 + r() * 0.3), yaw: 0, r };
      p.x = gate[0] + 0.2 + r() * 0.6; p.z = gate[1] + 0.2 + r() * 0.6; p.y = Math.max(0.012, square(gate[0], gate[1])?.base || 0); p.tx = p.x; p.tz = p.z;
      p.home = classes.length ? classes[i % classes.length] : null;
      p.place = null;
      people.push(p);
    }
    this.crowd.people = people; this.crowd.setCount(people.length);
    this.t = 0; this.period = -1; this.running = true;
    this.world.updaters.add(this.tick);
    this.next();
  }
  stop(silent = false) {
    if (!this.running) return;
    this.running = false;
    this.world.updaters.delete(this.tick);
    if (!silent) this.onEnd?.();
  }
  update(dt) {
    this.t += dt;
    if (this.t >= PERIOD_SECONDS) { this.t = 0; if (this.period >= PERIODS.length - 1) { this.stop(); return; } this.next(); }
  }
  next() {
    this.period++;
    const P = PERIODS[this.period], r = this.r;
    this.onPeriod?.(this.period, P);
    // Where can everyone go this period? Share the children out by how big each place is.
    const targets = P.types.includes('own') ? null : this.places.filter(p => P.types.includes(p.type) || P.types.includes(p.b.shape));
    const fill = new Map();
    this.crowd.people.forEach((p, i) => {
      let dest = null;
      if (P.id === 'home') dest = 'gate';
      else if (!targets) dest = p.home;
      else if (targets.length) {
        const sorted = [...targets].sort((a, b) => (fill.get(a) || 0) / a.cap - (fill.get(b) || 0) / b.cap);
        dest = sorted[0]; fill.set(dest, (fill.get(dest) || 0) + 1);
      }
      if (!dest && P.types.includes('yard')) dest = 'yard';
      if (!dest) dest = 'yard';
      this.send(p, dest, i);
    });
  }
  // Plan a walk for one child to a place.
  send(p, dest, i) {
    const r = this.r, jit = () => (r() - 0.5) * 0.45;
    const path = [];
    // Out of the room they are in, through its door.
    const from = p.place && p.place !== 'yard' && p.place !== 'gate' ? p.place : null;
    if (from) {
      if (from.b.__stairs) { path.push(new THREE.Vector3(from.b.__stairs.x, from.zone.oy, from.b.__stairs.z), new THREE.Vector3(from.b.__stairs.x, 0.012, from.b.__stairs.z)); }
      path.push(new THREE.Vector3(from.door[0] + 0.5 + jit() * 0.5, 0.012, from.door[1] + 0.5 + jit() * 0.5));
    }
    const startSq = from ? from.door : [Math.floor(p.x), Math.floor(p.z)];
    let endSq, zone, finalKind = 'walk', climb = null;
    if (dest === 'gate') { endSq = this.gate; zone = { rect: { x0: this.gate[0] + 0.1, z0: this.gate[1] + 0.1, x1: this.gate[0] + 0.9, z1: this.gate[1] + 0.9 }, oy: 0.012 }; }
    else if (dest === 'yard') { const ys = this.yardSquare(); endSq = ys; zone = this.yard; }
    else { endSq = dest.door; zone = dest.zone; finalKind = zone.kind || 'walk'; climb = dest.b.__stairs; }
    const sq = this.route(startSq, endSq) || [startSq, endSq];
    for (const [x, z] of sq) path.push(new THREE.Vector3(x + 0.5 + jit(), Math.max(0.012, square(x, z)?.base || 0), z + 0.5 + jit()));
    // Up the stairs to a room on an upper floor.
    if (climb) { path.push(new THREE.Vector3(climb.x, 0.012, climb.z), new THREE.Vector3(climb.x, zone.oy, climb.z)); }
    // Into the room.
    const [tx, tz] = this.crowd.pick(zone, r);
    if (dest !== 'yard' && dest !== 'gate') path.push(new THREE.Vector3((tx + (dest.zone.ox ?? tx)) / 2, zone.oy, (tz + (dest.zone.oz ?? tz)) / 2));
    path.push(new THREE.Vector3(tx, zone.oy, tz));
    p.place = dest;
    p.speed = (dest !== 'yard' && dest.type === 'hall' ? 0.45 : 0.36) * (0.85 + r() * 0.3);
    this.crowd.route(p, path, { kind: finalKind === 'swim' ? 'swim' : (dest !== 'yard' && dest.type === 'hall' ? 'run' : 'walk'), zone: { ...zone, kind: undefined } });
  }
  yardSquare() {
    const r = this.r;
    for (let k = 0; k < 40; k++) { const x = 1 + Math.floor(r() * 11), z = 6 + Math.floor(r() * 7); if (square(x, z)?.build && !this.blocked(x, z)) return [x, z]; }
    return this.gate;
  }
}
