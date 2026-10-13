// The design: a list of programme boxes on the grid, with Minecraft-like rules.
// box = { id, type, shape, colour, x, z, w, d, level, h }  (x, z = the corner square; w, d in squares; level, h in storeys)
import { PROGRAMMES, SHAPES, MAX_LEVELS, MAX_SIZE, colourHex } from './catalogue.js';
import { GRID, square } from './site.js';

const KEY = 'astraarch2';
const k3 = (x, z, l) => `${x},${z},${l}`;

export class Model {
  // shown: a design from a show-and-tell link, to look at but not change (and never saved over the one kept here).
  constructor(shown = null) {
    this.readOnly = !!shown;
    this.boxes = [];
    this.nextId = 1;
    this.styles = {};            // programme -> { shape, colour } chosen in the Rooms area
    this.grown = [];             // forest cleared into land in an earlier version, [x, z]
    this.pad = { w: 0, e: 0, n: 0, s: 0 };   // squares of new land added round the site with the green arrows
    this.history = [];
    this.listeners = new Set();
    if (shown) { this.boxes = shown.boxes; this.nextId = shown.boxes.length + 1; this.pad = shown.pad; this.grown = shown.grown; } else this.load();
    this.reindex();
  }

  // ---------- saving ----------
  load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s) { this.boxes = s.boxes || []; this.nextId = s.nextId || 1; this.styles = s.styles || {}; this.grown = s.grown || []; this.pad = { w: 0, e: 0, n: 0, s: 0, ...(s.pad || {}) }; }
    } catch (e) { /* a fresh start */ }
  }
  save() { if (this.readOnly) return; try { localStorage.setItem(KEY, JSON.stringify({ boxes: this.boxes, nextId: this.nextId, styles: this.styles, grown: this.grown, pad: this.pad })); } catch (e) { /* storage full or blocked */ } }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  changed(what = {}) { this.reindex(); this.save(); for (const fn of this.listeners) fn(what); }
  snapshot() { this.history.push(JSON.stringify(this.boxes)); if (this.history.length > 80) this.history.shift(); }
  undo() { if (!this.history.length) return false; this.boxes = JSON.parse(this.history.pop()); this.changed({ undo: true }); return true; }

  style(type) { const P = PROGRAMMES[type]; return { shape: P.shapes[0], colour: P.colour, ...(this.styles[type] || {}) }; }
  setStyle(type, patch) { this.styles[type] = { ...this.style(type), ...patch }; this.save(); for (const fn of this.listeners) fn({ style: type }); }
  hex(b) { return colourHex(b.colour); }

  // ---------- the voxel index ----------
  // Which squares of the footprint a shape fills (a ring leaves its middle open, for a garden).
  squares(b) {
    const out = [];
    const ring = SHAPES[b.shape]?.ring && b.w >= 3 && b.d >= 3;
    for (let i = 0; i < b.w; i++) for (let j = 0; j < b.d; j++) {
      if (ring && i > 0 && j > 0 && i < b.w - 1 && j < b.d - 1) continue;
      out.push([b.x + i, b.z + j]);
    }
    return out;
  }
  reindex() {
    this.occ = new Map();
    this.byId = new Map();
    for (const b of this.boxes) {
      this.byId.set(b.id, b);
      for (const [x, z] of this.squares(b)) for (let l = b.level; l < b.level + b.h; l++) this.occ.set(k3(x, z, l), b.id);
    }
  }
  at(x, z, l) { const id = this.occ.get(k3(x, z, l)); return id ? this.byId.get(id) : null; }
  // Is the top of this box open (nothing built on it)?
  open(b) { return !this.squares(b).some(([x, z]) => this.occ.has(k3(x, z, b.level + b.h))); }
  // The highest free level on a square (where a new block would land if you tap there).
  topAt(x, z) { let l = 0; while (this.occ.has(k3(x, z, l))) l++; return l; }

  // ---------- the rules ----------
  check(b, ignore = new Set()) {
    if (b.w < 1 || b.d < 1 || b.h < 1) return { ok: false, why: 'small' };
    if (b.w > MAX_SIZE || b.d > MAX_SIZE) return { ok: false, why: 'big' };
    if (b.level + b.h > MAX_LEVELS) return { ok: false, why: 'high' };
    const sq = this.squares(b);
    let supported = 0;
    for (const [x, z] of sq) {
      if (x < 0 || z < 0 || x >= GRID.w || z >= GRID.d) return { ok: false, why: 'edge' };
      const q = square(x, z);
      for (let l = b.level; l < b.level + b.h; l++) {
        const id = this.occ.get(k3(x, z, l));
        if (id && !ignore.has(id)) return { ok: false, why: 'taken' };
      }
      if (b.level === 0) { if (!q.build) return { ok: false, why: q.zone === 'water' ? 'water' : q.zone === 'rocks' ? 'rocks' : 'forest' }; supported++; }
      else {
        const below = this.at(x, z, b.level - 1);
        if (below && !ignore.has(below.id)) {
          const S = SHAPES[below.shape];
          if (S?.cap) return { ok: false, why: 'cap' };
          if (S?.flat) supported++;
          else return { ok: false, why: 'roof' };
        }
      }
    }
    // Overhangs are fine (like MVRDV's stacked boxes), but at least a third of it must sit on something.
    if (b.level > 0 && supported < Math.ceil(sq.length / 3)) return { ok: false, why: supported ? 'wobbly' : 'float' };
    return { ok: true };
  }

  // A new box of a programme, centred on the tapped square.
  make(type, x, z, level) {
    const P = PROGRAMMES[type], st = this.style(type);
    const [w, d, h] = P.size;
    return { id: 0, type, shape: st.shape, colour: st.colour, ...(st.win ? { win: st.win } : {}), x: x - Math.floor((w - 1) / 2), z: z - Math.floor((d - 1) / 2), w, d, level, h };
  }
  // Find a spot near the tap where the new box fits (nudging up to one square), turning it if that helps.
  fit(b) {
    const tries = [];
    for (const turn of [false, true]) for (const [dx, dz] of [[0, 0], [-1, 0], [0, -1], [-1, -1], [1, 0], [0, 1], [1, 1], [-1, 1], [1, -1]]) {
      const c = turn ? { ...b, w: b.d, d: b.w } : { ...b };
      c.x += dx; c.z += dz;
      tries.push(c);
    }
    let first = null;
    for (const c of tries) { const r = this.check(c); if (r.ok) return { box: c, ok: true }; if (!first) first = r; }
    return { box: b, ok: false, why: first?.why };
  }
  add(b) {
    this.snapshot();
    const box = { ...b, id: this.nextId++ };
    this.boxes.push(box);
    this.changed({ added: box.id });
    return box;
  }
  // Everything resting on top of a box (and on those, and so on).
  above(b) {
    const out = new Map(), todo = [b];
    while (todo.length) {
      const c = todo.pop();
      for (const [x, z] of this.squares(c)) {
        const t = this.at(x, z, c.level + c.h);
        if (t && !out.has(t.id) && t.id !== b.id) { out.set(t.id, t); todo.push(t); }
      }
    }
    return [...out.values()];
  }
  // Change a box (move, resize, restyle). Things on top travel with it. Returns { ok, why }.
  // Would this change work? (Nothing is changed.)
  test(id, patch) {
    const b = this.byId.get(id);
    if (!b) return { ok: false };
    const next = { ...b, ...patch };
    const dx = next.x - b.x, dz = next.z - b.z, dl = next.level - b.level;
    const riders = dx || dz || dl ? this.above(b) : [];
    const ignore = new Set([b.id, ...riders.map(r => r.id)]);
    const r = this.check(next, ignore);
    if (!r.ok) return r;
    for (const t of riders) { const rc = this.check({ ...t, x: t.x + dx, z: t.z + dz, level: t.level + dl }, ignore); if (!rc.ok) return rc; }
    return { ok: true, riders, dx, dz, dl };
  }
  update(id, patch, { snapshot = true } = {}) {
    const b = this.byId.get(id);
    const t0 = this.test(id, patch);
    if (!t0.ok) return t0;
    const { riders, dx, dz, dl } = t0;
    if (snapshot) this.snapshot();
    Object.assign(b, patch);
    for (const t of riders) { t.x += dx; t.z += dz; t.level += dl; }
    // Growing taller may push things on top up; shrinking leaves nothing floating.
    this.changed({ updated: id });
    this.settle();
    return { ok: true };
  }
  remove(id) {
    const b = this.byId.get(id);
    if (!b) return 0;
    this.snapshot();
    this.boxes = this.boxes.filter(x => x.id !== id);
    this.reindex();
    const fell = this.settle(true);
    this.changed({ removed: id });
    return fell;
  }
  // Boxes with nothing under them come down too (returns how many).
  settle(silent = false) {
    let fell = 0, again = true;
    while (again) {
      again = false;
      for (const b of this.boxes) {
        if (b.level === 0) continue;
        if (!this.check(b, new Set([b.id])).ok) { this.boxes = this.boxes.filter(x => x !== b); this.reindex(); fell++; again = true; break; }
      }
    }
    if (fell && !silent) this.changed({ fell });
    return fell;
  }
  clear() { this.snapshot(); this.boxes = []; this.changed({ cleared: true }); }
}

export const WHY = {
  taken: 'Something is already there.', water: 'That is water! Try the meadow.', rocks: 'Too rocky to build there.', forest: 'The forest is too steep there.',
  edge: 'That is off the edge of the site.', high: 'That is as high as we can build.', big: 'That is as big as it goes.', small: 'That is as small as it goes.',
  cap: 'Nothing can go on top of that.', roof: 'It will not stand on a pointy or round roof. Choose a flat-topped box underneath.',
  float: 'It needs something under it.', wobbly: 'Too wobbly! More of it needs to sit on something.',
};
