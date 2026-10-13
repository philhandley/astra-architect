// The school day, with children as little agents. Each class walks with its teacher in a line, two by two
// (a "crocodile"), following the teacher's path round the buildings, through the doors and up the stairs.
// In lessons and at lunch they find a seat and sit down; at playtime they scatter to the swings, slides and
// steps, play and stop to chat. They step round each other, say little things in speech bubbles (tap a child
// to hear them), and the paths they tread wear into the grass.
import * as THREE from 'three';
import { PROGRAMMES, SHAPES, LEVEL } from './catalogue.js';
import { GRID, square, site } from './site.js';
import { outline, storeyFloor, CUTTABLE } from './inside.js';
import { seeded } from './crowd.js';
import { emo, esc, say } from './ui.js';

// The timetable. go: own (the class's own classroom), room (one of these kinds of room, else their classroom),
// play (scatter outside), gate (home).
export const PERIODS = [
  { id: 'arrive', name: 'Arriving', emoji: '🎒', go: 'own' },
  { id: 'maths', name: 'Maths', emoji: '🔢', go: 'own' },
  { id: 'break', name: 'Playtime', emoji: '🛝', go: 'play' },
  { id: 'science', name: 'Science', emoji: '🔬', go: 'room', types: ['greenhouse', 'maker', 'observatory', 'aquarium'] },
  { id: 'lunch', name: 'Lunch', emoji: '🍎', go: 'room', types: ['lunch'] },
  { id: 'arts', name: 'Art and music', emoji: '🎨', go: 'room', types: ['art', 'music', 'stage', 'hall', 'yoga'] },
  { id: 'story', name: 'Story time', emoji: '📖', go: 'room', types: ['library', 'circle', 'terraces', 'steps', 'treehouse'] },
  { id: 'home', name: 'Home time', emoji: '🏠', go: 'gate' },
];
export const PERIOD_SECONDS = 20;
const CLASSES = new Set(['classroom', 'ringhouse', 'treehouse']);
const PLAY = new Set(['playground', 'zipline', 'slide', 'steps', 'terraces', 'garden', 'tree', 'circle', 'track', 'rocket', 'weather']);
const WALK_THROUGH = new Set(['track', 'garden', 'circle', 'terraces', 'canopy', 'steps', 'tree', 'arch', 'sandpit']);
const TOP_Y = { track: 0.09, garden: 0.16, circle: 0.045, stage: 0.16, terraces: 0.06, steps: 0.02, tree: 0.012, slide: 0.012, pool: 0.09 };
// Borrowed from theme-park games: children have simple needs (energy, fun, hunger) and choose what to do from them.
// Rides take one child at a time, so a queue forms (seconds per go, by shape); tired children look for somewhere to
// sit; passing something interesting they stop to look; and what they say comes from how they feel.
const RIDES = { slide: 3.5, swings: 3, zipline: 3, roundabout: 3, seesaw: 3, playtower: 3.5, climbdome: 4 };
const QUEUE_MAX = 4;                 // (a happy school: short lines, and anyone extra just plays nearby)
const REST = new Set(['steps', 'circle', 'terraces', 'garden', 'stage', 'treehouse']);
const LOOK = { rocket: ['🚀', 'Wow, a rocket!'], observatory: ['🔭', 'A telescope!'], aquarium: ['🐠', 'Fish!'], turbine: ['🌬️', 'Round and round!'], weather: ['🌡️', 'Is it windy?'], greenhouse: ['🌱', 'Look, plants!'], pool: ['🏊', 'Splash!'] };
const NEED_LINES = {
  tired: [['😮‍💨', 'Phew, I need a sit down'], ['🥱', 'My legs are tired']], hungry: [['🍎', 'I am hungry!'], ['🥪', 'Is it lunch yet?']],
  happy: [['🌟', 'Best day ever!'], ['😄', 'This is so fun!']], queue: [['⏳', 'My turn next!'], ['🙌', 'Nearly my go!']], ride: [['🛝', 'Wheee!'], ['🎉', 'Again, again!']],
};

// What children say: [emoji, words], by what they are doing, and by the room they are in.
const LINES = {
  arrive: [['👋', 'Morning!'], ['🎒', 'Got my bag!'], ['😊', 'Hello!'], ['🚌', 'I came on the bus']],
  maths: [['🔢', '2 + 2 = 4!'], ['✋', 'I know!'], ['🔺', 'A triangle!'], ['🤔', 'Hmm…'], ['📏', 'It is 10 long'], ['🔟', 'Count to ten!']],
  break: [['🏃', 'Tag! You are it!'], ['⚽', 'Pass!'], ['😂', 'Ha ha!'], ['🙈', 'Hide and seek!'], ['🤸', 'Look at me!'], ['👟', 'Race you!']],
  science: [['🔬', 'Look closer!'], ['🧪', 'Bubbles!'], ['🧲', 'It sticks!'], ['💡', 'It lit up!']],
  lunch: [['🍎', 'Yum!'], ['🥪', 'Sandwiches!'], ['🍝', 'Pasta day!'], ['😋', 'More please!'], ['🥕', 'Crunchy!']],
  arts: [['🎨', 'Look at my picture!'], ['🎵', 'La la la!'], ['✂️', 'Snip snip'], ['🖍️', 'A rainbow!']],
  story: [['📖', 'Once upon a time…'], ['🐉', 'A dragon!'], ['🤫', 'Shh…'], ['😮', 'What happens next?']],
  home: [['👋', 'Bye!'], ['🏠', 'Home time!'], ['😴', 'So tired…'], ['🌟', 'Best day ever!']],
  chat: [['😊', 'Want to play?'], ['🤝', 'Be my friend?'], ['😄', 'I like your shoes!'], ['🙋', 'Me too!']],
};
const ROOM_LINES = {
  greenhouse: [['🌱', 'It grew!'], ['🐛', 'A caterpillar!'], ['🌻', 'So tall!']],
  observatory: [['🔭', 'I see a planet!'], ['🌙', 'The moon!'], ['⭐', 'A star!']],
  aquarium: [['🐠', 'A fish!'], ['🐙', 'An octopus!'], ['🦈', 'A shark!']],
  maker: [['🔧', 'It works!'], ['🤖', 'My robot!'], ['🚀', 'Lift off!']],
  music: [['🥁', 'Boom boom!'], ['🎵', 'La la la!'], ['🎺', 'Toot!']],
  hall: [['💃', 'Dance!'], ['🎶', 'Music!']], yoga: [['🧘', 'So calm…'], ['😌', 'Breathe in…']],
  stage: [['🎭', 'Ta-da!'], ['👏', 'Clap clap!']], library: [['📚', 'Shh…'], ['📖', 'Good book!']],
  playground: [['🛝', 'Wheee!'], ['🎠', 'Faster!']], zipline: [['🪂', 'Wheee!']], slide: [['🛝', 'Wheee!']],
};
const noEmoji = s => s.replace(/[\p{Extended_Pictographic}‍️]/gu, '').trim();

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
    g.fillStyle = 'rgba(205, 176, 122, 0.026)'; g.beginPath(); g.arc(px, pz, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(170, 136, 84, 0.022)'; g.beginPath(); g.arc(px, pz, 3, 0, Math.PI * 2); g.fill();
    this.dirty++;
  }
  clear() { this.g.clearRect(0, 0, this.c.width, this.c.height); this.dirty++; }
  // The site grew: a fresh layer the new size.
  resize() {
    this.c.width = GRID.w * 50; this.c.height = GRID.d * 50; this.tex.dispose();
    this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace; this.mesh.material.map = this.tex; this.mesh.material.needsUpdate = true;
    this.mesh.geometry.dispose(); this.mesh.geometry = new THREE.PlaneGeometry(GRID.w, GRID.d).rotateX(-Math.PI / 2);
    this.mesh.position.set(GRID.w / 2, 0.024, GRID.d / 2);
  }
}

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

export class SchoolDay {
  // seatsOf(boxId): world-space seats in a room or on a piece (benches, steps), if any.
  constructor({ world, model, crowd, yOf, seatsOf, layer, onPeriod, onEnd }) {
    Object.assign(this, { world, model, crowd, yOf, seatsOf, layer, onPeriod, onEnd });
    this.t = 0; this.period = -1; this.running = false;
    this.tick = dt => this.update(dt);
    this.bubbles = [];
  }

  // ---------- the map of the school for walking ----------
  blocked(x, z) {
    const q = square(x, z);
    if (!q || q.zone === 'water' || q.zone === 'rocks' || this.holes?.has(x * 100 + z)) return true;
    const b = this.model.at(x, z, 0);
    return !!(b && !WALK_THROUGH.has(b.shape) && !WALK_THROUGH.has(b.type));
  }
  cost(x, z) { const q = square(x, z); return q.build ? 1 : 2.5; }

  // ---------- places in the school ----------
  findPlaces() {
    const m = this.model, out = [];
    // The squares in the middle of rings (closed courtyards).
    this.holes = new Set();
    for (const b of m.boxes) if (b.level === 0 && (b.shape === 'ring' || b.shape === 'ringhouse')) {
      const own = new Set(m.squares(b).map(([x, z]) => x * 100 + z));
      for (let x = b.x; x < b.x + b.w; x++) for (let z = b.z; z < b.z + b.d; z++) if (!own.has(x * 100 + z)) this.holes.add(x * 100 + z);
    }
    const stairs = m.boxes.filter(b => b.type === 'stairs' || b.type === 'ramp');
    for (const b of m.boxes) {
      const type = b.type, cx = b.x + b.w / 2, cz = b.z + b.d / 2, y0 = this.yOf(b), sq = m.squares(b);
      // A door: a free square next to the room, on the ground (front first).
      let door = null, climb = null, doors = null;
      if (b.level === 0) {
        const near = [];
        for (const [x, z] of sq) for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const nx = x + dx, nz = z + dz; if (sq.some(s => s[0] === nx && s[1] === nz)) continue; if (!this.blocked(nx, nz)) near.push([nx, nz, dz === 1 ? 0 : 1]); }
        near.sort((p, q) => p[2] - q[2]);
        if (near.length) door = near[Math.floor(near.length / 2) % near.length];
        doors = near.map(([x, z]) => [x, z]);
      } else {
        // Upper rooms are reached by stairs (or a ramp) next to the building.
        const st = stairs.find(s => s.level === 0 && s.level + s.h >= b.level && m.squares(s).some(([x, z]) => sq.some(([qx, qz]) => Math.abs(qx - x) + Math.abs(qz - z) === 1)));
        if (!st) continue;
        const [sx, sz] = m.squares(st)[0], near = [];
        for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (!this.blocked(sx + dx, sz + dz)) near.push([sx + dx, sz + dz]);
        if (!near.length) continue;
        door = near[0]; climb = { x: sx + 0.5, z: sz + 0.5 };
      }
      if (!door && b.shape !== 'tree') continue;
      let zone;
      if (CUTTABLE.has(b.shape) && PROGRAMMES[type] && type !== 'archway') {
        const o = outline(b), fy = y0 + storeyFloor(b, b.level) + 0.02;
        zone = { ox: cx, oy: fy, oz: cz, w: b.w, d: b.d, inside: o.inside, margin: 0.12, boxId: b.id, indoor: true };
      } else {
        const topY = TOP_Y[b.shape] ?? 0.012, pad = ['tree', 'slide', 'playground', 'zipline', 'rocket', 'weather', 'greenhouse', 'observatory'].includes(b.type) || b.shape === 'tree' ? 0.5 : -0.1;
        zone = { rect: { x0: b.x - pad, z0: b.z - pad, x1: b.x + b.w + pad, z1: b.z + b.d + pad }, oy: y0 + topY, boxId: b.id, ok: pad > 0 ? (x, z) => !this.blocked(Math.floor(x), Math.floor(z)) || this.model.at(Math.floor(x), Math.floor(z), 0)?.id === b.id : null };
      }
      door = door || [Math.floor(cx), Math.floor(cz)];
      const place = { b, type, door, doors: doors?.length ? doors : [door], climb, zone, seats: (this.seatsOf?.(b.id) || []).slice(), cap: sq.length * (CLASSES.has(type) ? 7 : 6), ride: RIDES[b.shape] || 0 };
      if (place.ride) {
        // The queue starts at the free square next to the ride that is easiest to reach (nearest the gate by the
        // paths) and runs away from the ride; you come out again to one side.
        if (doors && doors.length > 1) { const gf = this.fieldTo('gate', [this.gate]); let bd = Infinity; for (const dq of doors) { const dd = gf.dist[dq[0] + dq[1] * GRID.w]; if (dd < bd) { bd = dd; door = dq; } } }
        const hx = door[0] + 0.5, hz = door[1] + 0.5; let dx = hx - cx, dz = hz - cz; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        place.q = { hx, hz, dx, dz, sx: -dz, sz: dx, y: Math.max(0.012, square(door[0], door[1])?.base || 0) };
        place.queue = []; place.busy = null; place.maxQ = 0; place.goes = 0;
        place.doors = [door];                     // (everyone walks to the one square where the queue starts)
      }
      out.push(place);
    }
    return out;
  }

  qslot(p, i) { const q = p.q, s = i % 2 ? 0.02 : -0.02; return [q.hx + q.dx * 0.085 * i + q.sx * s, q.y, q.hz + q.dz * 0.085 * i + q.sz * s]; }
  qexit(p) { const q = p.q; return [q.hx + q.sx * 0.3 + q.dx * 0.1, q.y, q.hz + q.sz * 0.3 + q.dz * 0.1]; }
  // What a child does at playtime, from how they feel: tired children find somewhere to sit; the others pick
  // something to play on, looking at two and choosing the one with the shorter queue (and giving up on a long one).
  chooseFun(k) {
    const n = k.needs;
    // (Places you can walk to first; if the paths are all cut off, anywhere, as the children find a way.)
    const near = list => { const can = list.filter(p => this.reachable(k, p)); return can.length ? can : list; };
    if (n.energy < 0.45) {
      const rest = near(this.places.filter(p => p.seats.length && (REST.has(p.type) || REST.has(p.b.shape)) && p.seats.some(s => !s.taken)));
      if (rest.length) return rest[Math.floor(this.r() * rest.length)];
      this.noSeat++;
    }
    const spots = near(this.places.filter(p => PLAY.has(p.type) || PLAY.has(p.b.shape)));
    if (!spots.length || this.r() < 0.2) return 'yard';
    const load = p => (p.queue?.length || 0) + this.agents.filter(x => x.dest === p && x.mode === 'path').length * 0.5;
    const a = spots[Math.floor(this.r() * spots.length)], b = spots[Math.floor(this.r() * spots.length)], pick = load(a) <= load(b) ? a : b;
    return load(pick) >= 3 ? 'yard' : pick;
  }
  // Can this child walk there round the buildings (from the door of the room they are in, if indoors)?
  reachable(k, p) {
    const f = this.fieldTo(p.b?.id ?? p.door.join(','), p.doors || [p.door]), from = k.at;
    const sqs = from && from !== 'gate' && from.zone?.indoor ? (from.doors || [from.door]) : [[Math.floor(k.x), Math.floor(k.z)]];
    return sqs.some(([x, z]) => isFinite(f.dist[x + z * GRID.w]));
  }
  // Something interesting within a short walk (not where this child is going anyway).
  attractionNear(k) {
    for (const p of this.places) if (LOOK[p.type] && p !== k.dest && Math.hypot(p.b.x + p.b.w / 2 - k.x, p.b.z + p.b.d / 2 - k.z) < 0.6 + Math.max(p.b.w, p.b.d) / 2) return p;
    return null;
  }

  // ---------- running the day ----------
  start() {
    const m = this.model, r = seeded(m.boxes.length * 31 + 7);
    this.r = r;
    const S = site(), gate = [Math.max(0, Math.min(GRID.w - 1, S.gate[0])), Math.max(0, Math.min(GRID.d - 1, S.gate[1]))];
    this.gate = gate; this.fields = new Map();
    this.places = this.findPlaces();
    const ok = (x, z) => { const xi = Math.floor(x), zi = Math.floor(z), q = square(xi, zi); return q?.build && !this.blocked(xi, zi); };
    // The yard: all the open land you can build on.
    const land = []; for (let z = 0; z < GRID.d; z++) for (let x = 0; x < GRID.w; x++) if (ok(x + 0.5, z + 0.5)) land.push([x, z]);
    this.land = land.length ? land : [gate];
    const xs = this.land.map(l => l[0]), zs = this.land.map(l => l[1]);
    this.yard = { rect: { x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs) + 1, z1: Math.max(...zs) + 1 }, ok, oy: 0.012 };
    this.gateZone = { rect: { x0: gate[0] + 0.1, z0: gate[1] + 0.1, x1: gate[0] + 0.9, z1: gate[1] + 0.9 }, oy: Math.max(0.012, square(gate[0], gate[1])?.base || 0) };
    // Classes: one for each classroom (two for a big ring of classrooms), each with a teacher.
    const homes = [];
    for (const p of this.places.filter(p => CLASSES.has(p.type))) { homes.push(p); if (p.type === 'ringhouse') homes.push(p); }
    const per = Math.max(6, Math.min(14, Math.round(78 / Math.max(1, homes.length)))), people = [];
    this.groups = homes.slice(0, 7).map((home, gi) => {
      const g = { home, place: null, trail: [], kids: [], together: true, gi };
      const at = () => [gate[0] + 0.25 + r() * 0.5, gate[1] + 0.25 + r() * 0.5];
      const mk = (teacher, k) => {
        const [x, z] = at();
        const p = { kind: 'agent', pose: 'walk', teacher, g, k, s: teacher ? 1 : 0.72 + r() * 0.1, ph: r() * 6, x, z, y: this.gateZone.oy, yaw: 0, r, mode: 'idle', speed: teacher ? 0.85 : 1.05 * (0.9 + r() * 0.2), wait: 0,
          needs: { energy: 0.3 + r() * 0.7, fun: r() * 0.4, hunger: r() * 0.3 }, hidden: false };
        if (teacher) p.look = { top: '#2e4a8c', shorts: '#3d405b', skin: ['#f6d7bf', '#c98c62', '#e7b892', '#9a6544'][gi % 4], hair: ['#3b2a20', '#e3b65a', '#1f1b18', '#b5652e'][gi % 4], style: gi % 3 };
        people.push(p); return p;
      };
      g.teacher = mk(true, -1);
      for (let k = 0; k < per; k++) g.kids.push(mk(false, k));
      g.trail = [[g.teacher.x, g.teacher.y, g.teacher.z]];
      return g;
    });
    this.agents = people;
    this.crowd.people = people; this.crowd.setCount(people.length);
    this.t = 0; this.period = -1; this.running = true; this.sayT = 0.6; this.stepT = 0; this.clock = 0; this.noSeat = 0;
    this.world.updaters.add(this.tick);
    this.next();
  }
  stop(silent = false) {
    if (!this.running) return;
    this.running = false;
    this.world.updaters.delete(this.tick);
    for (const bb of this.bubbles) bb.el.remove();
    this.bubbles = [];
    if (!silent) this.onEnd?.(this.facts());
  }
  // One or two things the day showed (said as observations and a question, never a score).
  facts() {
    const rides = this.places.filter(p => p.ride), goes = rides.reduce((n, p) => n + p.goes, 0), lines = [];
    const busiest = rides.slice().sort((a, b) => b.maxQ - a.maxQ)[0];
    let ask = null;
    if (goes) lines.push(`The children had ${goes} goes on the rides.`);
    const rideName = p => (p.type === 'playground' ? SHAPES[p.b.shape]?.name : PROGRAMMES[p.type]?.name) || p.b.shape;
    if (busiest && busiest.maxQ >= 3) { lines.push(`The longest queue was ${busiest.maxQ} children, at the ${rideName(busiest).toLowerCase()}.`); ask = 'Would another ride help, or a bigger one? Where would you put it?'; }
    if (this.noSeat > 3) { lines.push(`${this.noSeat} tired children could not find anywhere to sit down.`); ask = ask || 'Where could tired children sit down? Big steps or a garden bench?'; }
    return { lines, ask };
  }
  next() {
    this.period++;
    this.fields = new Map();
    const P = PERIODS[this.period];
    this.onPeriod?.(this.period, P);
    const fill = new Map();
    const pick = types => {
      const list = this.places.filter(p => types.includes(p.type) || types.includes(p.b.shape));
      if (!list.length) return null;
      list.sort((a, b) => (fill.get(a) || 0) / a.cap - (fill.get(b) || 0) / b.cap);
      return list[0];
    };
    for (const g of this.groups) {
      let dest;
      if (P.go === 'own') dest = g.home;
      else if (P.go === 'gate') dest = 'gate';
      else if (P.go === 'play') dest = 'play';
      else { dest = pick(P.types) || g.home; fill.set(dest, (fill.get(dest) || 0) + g.kids.length); }
      this.sendGroup(g, dest, P);
    }
  }
  // The walk for a class (or one child) from where they are to a place: out of the door (and down the stairs),
  // along the grid round the buildings, then (up the stairs and) in through the door of the next place.
  // How far every square is from a set of end squares (walking round buildings), and which way to go.
  fieldTo(key, ends) {
    this.fields = this.fields || new Map();
    if (this.fields.has(key)) return this.fields.get(key);
    const W = GRID.w, N = W * GRID.d, dist = new Float32Array(N).fill(Infinity), next = new Int32Array(N).fill(-1), done = new Uint8Array(N);
    for (const [x, z] of ends) dist[x + z * W] = 0;
    for (let it = 0; it < N; it++) {
      let cur = -1, best = Infinity; for (let i = 0; i < N; i++) if (!done[i] && dist[i] < best) { best = dist[i]; cur = i; }
      if (cur < 0) break;
      done[cur] = 1;
      const cx = cur % W, cz = (cur - cx) / W;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = cx + dx, nz = cz + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= GRID.d || this.blocked(nx, nz)) continue;
        if (dx && dz && (this.blocked(cx + dx, cz) || this.blocked(cx, cz + dz))) continue;
        const n = nx + nz * W, d = dist[cur] + Math.hypot(dx, dz) * this.cost(cx, cz);
        if (d < dist[n]) { dist[n] = d; next[n] = cur; }
      }
    }
    const f = { dist, next }; this.fields.set(key, f); return f;
  }
  plan(from, pos, dest, jit = 0.25) {
    const r = this.r, J = () => (r() - 0.5) * jit, path = [], W = GRID.w;
    const ends = dest === 'gate' ? [this.gate] : dest.doors || [dest.door];
    const f = this.fieldTo(dest === 'gate' ? 'gate' : dest.b?.id ?? dest.door.join(','), ends);
    const at = ([x, z]) => f.dist[x + z * W];
    // Out of a room by the way out that is quickest overall (counting the steps to reach it).
    let startSq;
    if (from && from !== 'gate' && from.zone?.indoor) {
      const outs = from.doors || [from.door];
      startSq = outs.reduce((a, b) => (at(b) + Math.hypot(b[0] + 0.5 - pos.x, b[1] + 0.5 - pos.z) < at(a) + Math.hypot(a[0] + 0.5 - pos.x, a[1] + 0.5 - pos.z) ? b : a));
      if (from.climb) path.push(v3(from.climb.x, from.zone.oy, from.climb.z), v3(from.climb.x, 0.012, from.climb.z));
      path.push(v3(startSq[0] + 0.5 + J() * 0.5, 0.012, startSq[1] + 0.5 + J() * 0.5));
    } else {
      startSq = [Math.floor(pos.x), Math.floor(pos.z)];
      if (!isFinite(at(startSq))) { let best = null; for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const s = [startSq[0] + dx, startSq[1] + dz]; if (s[0] >= 0 && s[1] >= 0 && s[0] < W && s[1] < GRID.d && isFinite(at(s)) && (!best || at(s) < at(best))) best = s; } if (best) startSq = best; }
    }
    // Then square by square downhill on the distance map, to the nearest way in.
    let i = startSq[0] + startSq[1] * W, guard = 0;
    while (f.next[i] >= 0 && guard++ < 200) { i = f.next[i]; const x = i % W, z = (i - x) / W; path.push(v3(x + 0.5 + J(), Math.max(0.012, square(x, z)?.base || 0), z + 0.5 + J())); }
    if (dest !== 'gate' && dest.climb) path.push(v3(dest.climb.x, 0.012, dest.climb.z), v3(dest.climb.x, dest.zone.oy, dest.climb.z));
    if (dest !== 'gate' && dest.zone.indoor) path.push(v3(dest.zone.ox, dest.zone.oy, dest.zone.oz));
    return path;
  }
  sendGroup(g, dest, P) {
    const t = g.teacher;
    g.activity = P.id;
    if (dest === 'play') {
      // Playtime: everyone scatters to something to play on (or the yard), and the teacher keeps an eye out.
      for (const k of [t, ...g.kids]) {
        if (k.seat) { k.seat.taken = false; k.seat = null; }
        this.sendOne(k, k.teacher ? 'yard' : this.chooseFun(k));
        k.again = 4 + this.r() * 4;
      }
      g.place = 'play'; g.together = false;
      return;
    }
    if (g.together && dest === g.place) return;
    for (const k of [t, ...g.kids]) { if (k.seat) { k.seat.taken = false; k.seat = null; } this.leaveQueue(k); }
    if (g.together) {
      // A crocodile: the teacher leads, the children follow the teacher's path two by two.
      t.path = this.plan(g.place, t, dest); t.pi = 0; t.mode = 'lead'; t.dest = dest;
      for (const k of g.kids) { k.mode = 'follow'; k.dest = dest; k.seat = null; }
      g.trail = [[t.x, t.y, t.z]];
    } else {
      // After playtime they make their own way back, a few at a time.
      for (const k of [t, ...g.kids]) { this.sendOne(k, dest); k.wait = this.r() * 1.2; }
      g.together = true;
    }
    g.place = dest;
  }
  // One child (or teacher) walking alone to a place.
  sendOne(k, dest) {
    const from = k.at;
    const target = dest === 'yard' ? { door: this.yardSquare(), zone: this.yard, type: 'yard', seats: [] } : dest;
    k.path = this.plan(from, k, target === 'gate' ? 'gate' : target, 0.5); k.pi = 0; k.mode = 'path'; k.dest = target; k.seat = null; k.at = null;
  }
  yardSquare() { return this.land[Math.floor(this.r() * this.land.length)]; }
  leaveQueue(k) {
    if (k.ride) { const i = k.ride.queue.indexOf(k); if (i >= 0) k.ride.queue.splice(i, 1); if (k.ride.busy === k) k.ride.busy = null; k.ride = null; }
    if (k.hidden) { k.hidden = false; }
  }
  // What a child does on arriving: find a seat, or wander about the place.
  arrive(k) {
    const d = k.dest; k.at = d; k.path = null;
    if (d === 'gate') { k.mode = 'wander'; k.zone = this.gateZone; k.tx = k.x; k.tz = k.z; return; }
    k.zone = d.zone;
    const playing = k.g.activity === 'break';
    if (playing && !k.teacher && d.ride && d.queue.length < QUEUE_MAX) { d.queue.push(k); d.maxQ = Math.max(d.maxQ, d.queue.length); k.ride = d; k.mode = 'queue'; return; }
    if (!k.teacher && d.seats?.length && (!playing || ((REST.has(d.type) || REST.has(d.b?.shape)) && k.needs.energy < 0.5))) {
      // The nearest free seat.
      let best = -1, bd = Infinity;
      d.seats.forEach((s, i) => { if (s.taken) return; const dd = Math.hypot(s[0] - k.x, s[2] - k.z); if (dd < bd) { bd = dd; best = i; } });
      if (best >= 0) { const s = d.seats[best]; s.taken = true; k.seat = s; k.mode = 'toSeat'; return; }
    }
    k.mode = 'wander'; [k.tx, k.tz] = this.crowd.pick(d.zone, this.r); k.wait = this.r() * 1.5;
  }

  // ---------- moving everyone ----------
  update(dt) {
    this.t += dt;
    if (this.t >= PERIOD_SECONDS) {
      this.t = 0;
      if (this.period >= PERIODS.length - 1) { this.stop(); return; }
      this.next();
    }
    for (const g of this.groups) this.moveTeacher(g, dt);
    for (const k of this.agents) if (!k.teacher || k.mode !== 'lead') this.moveOne(k, dt);
    for (const k of this.agents) {
      const n = k.needs;
      n.energy = Math.max(0, Math.min(1, n.energy + (k.moving ? (k.pose === 'run' ? -0.045 : -0.02) : k.mode === 'sit' ? 0.025 : 0.005) * dt));
      n.fun = Math.max(0, n.fun - 0.003 * dt);
      n.hunger = Math.max(0, Math.min(1, n.hunger + (k.g.activity === 'lunch' && k.mode === 'sit' ? -0.15 : 0.0025) * dt));
    }
    this.separate(dt);
    this.wearPaths(dt);
    this.talk(dt);
  }
  stepTo(k, x, y, z, speed, dt, near = 0.012) {
    const dx = x - k.x, dz = z - k.z, dy = y - k.y, d = Math.hypot(dx, dz, dy);
    if (d < near) { k.moving = false; return true; }
    const st = Math.min(d, speed * dt);
    k.x += dx / d * st; k.z += dz / d * st; k.y += dy / d * st;
    if (Math.abs(dx) + Math.abs(dz) > 1e-4) k.yaw = Math.atan2(dx, dz);
    k.moving = true;
    return d - st < near;
  }
  moveTeacher(g, dt) {
    const t = g.teacher;
    if (t.mode !== 'lead') return;
    // Wait for the line to catch up a little before going on.
    const last = g.kids[g.kids.length - 1];
    if (last && last.mode === 'follow' && Math.hypot(last.x - t.x, last.z - t.z) > 0.18 + g.kids.length * 0.06) { t.moving = false; return; }
    const w = t.path[t.pi];
    if (!w) {
      this.arrive(t);
      for (const k of g.kids) if (k.mode === 'follow') {
        let near = 0, nd = Infinity; g.trail.forEach(([x, , z], i) => { const d = Math.hypot(x - k.x, z - k.z); if (d < nd) { nd = d; near = i; } });
        k.path = g.trail.slice(near).filter((_, i, a) => i % 4 === 0 || i === a.length - 1).map(([x, y, z]) => v3(x, y, z)); k.pi = 0; k.mode = 'path';
      }
      return;
    }
    if (this.stepTo(t, w.x, w.y, w.z, t.speed, dt, 0.02)) t.pi++;
    const tl = g.trail[g.trail.length - 1];
    if (Math.hypot(t.x - tl[0], t.z - tl[2], t.y - tl[1]) > 0.015) { g.trail.push([t.x, t.y, t.z]); if (g.trail.length > 400) g.trail.shift(); }
  }
  // A point a distance back along the teacher's trail, nudged sideways (for two-by-two).
  trailPoint(g, back, side) {
    const T = g.trail;
    let i = T.length - 1, left = back;
    while (i > 0) { const [ax, ay, az] = T[i], [bx, by, bz] = T[i - 1], l = Math.hypot(ax - bx, az - bz, ay - by); if (l >= left) { const f = left / (l || 1); const x = ax + (bx - ax) * f, y = ay + (by - ay) * f, z = az + (bz - az) * f, nx = -(az - bz) / (l || 1), nz = (ax - bx) / (l || 1); return [x + nx * side, y, z + nz * side]; } left -= l; i--; }
    return null;
  }
  moveOne(k, dt) {
    k.pose = 'walk';
    if (k.wait > 0) { k.wait -= dt; k.moving = false; return; }
    switch (k.mode) {
      case 'follow': {
        const row = Math.floor(k.k / 2) + 1, side = (k.k % 2 ? 1 : -1) * 0.032;
        // (Until the line has room, children gather where the teacher set off from.)
        const T = k.g.trail, p = this.trailPoint(k.g, row * 0.075, side) || [T[0][0] + side * 1.5, T[0][1], T[0][2] + (k.k % 5 - 2) * 0.03];
        const d = Math.hypot(p[0] - k.x, p[2] - k.z);
        this.stepTo(k, p[0], p[1], p[2], Math.min(k.speed * 1.3, 0.3 + d * 4), dt, 0.008);
        return;
      }
      case 'path': {
        const w = k.path?.[k.pi];
        if (!w) { this.arrive(k); return; }
        if (this.stepTo(k, w.x, w.y, w.z, k.speed, dt, 0.025)) k.pi++;
        // Passing something interesting, now and then a child stops to look at it.
        if (!k.teacher && k.y < 0.06 && this.r() < 0.005 && this.agents.filter(a => a.mode === 'look').length < 3) {
          const a = this.attractionNear(k);
          if (a) { k.back = 'path'; k.mode = 'look'; k.lookT = 1.6; k.lookAt = a.type; k.yaw = Math.atan2(a.b.x + a.b.w / 2 - k.x, a.b.z + a.b.d / 2 - k.z); k.moving = false; this.bubble(k, LOOK[a.type]); }
        }
        return;
      }
      case 'look': { k.moving = false; k.lookT -= dt; if (k.lookT <= 0) k.mode = k.back || 'wander'; return; }
      case 'queue': {
        const p = k.ride, i = p ? p.queue.indexOf(k) : -1;
        if (i < 0) { k.ride = null; k.zone = this.yard; k.mode = 'wander'; return; }
        const [sx, sy, sz] = this.qslot(p, i), there = this.stepTo(k, sx, sy, sz, k.speed * 0.7, dt, 0.015);
        if (!k.moving) k.yaw = Math.atan2(-p.q.dx, -p.q.dz);
        if (there && i === 0 && !p.busy) {
          // My go! (Out of sight on the ride, then out again at the side.)
          p.busy = k; p.queue.shift(); p.goes++; k.mode = 'riding'; k.rideT = p.ride; k.hidden = true; k.moving = false;
          const e = this.qexit(p); k.x = e[0]; k.y = e[1]; k.z = e[2];
        }
        return;
      }
      case 'riding': {
        k.moving = false; k.rideT -= dt;
        if (k.rideT <= 0) {
          const p = k.ride; if (p && p.busy === k) p.busy = null;
          k.hidden = false; k.ride = null; k.at = null; k.zone = this.yard; k.mode = 'wander'; [k.tx, k.tz] = this.crowd.pick(this.yard, this.r);
          k.needs.fun = Math.min(1, k.needs.fun + 0.45); k.needs.energy = Math.max(0, k.needs.energy - 0.08);
          k.wait = 0.6 + this.r(); k.again = 2 + this.r() * 3;
          this.bubble(k, NEED_LINES.ride[Math.floor(this.r() * NEED_LINES.ride.length)]);
        }
        return;
      }
      case 'toSeat': {
        const s = k.seat;
        if (this.stepTo(k, s[0], s[1], s[2], k.speed * 0.8, dt, 0.01)) { k.mode = 'sit'; k.x = s[0]; k.z = s[2]; k.y = s[1]; k.yaw = Math.atan2((k.zone.ox ?? k.x) - k.x, (k.zone.oz ?? k.z) - k.z); }
        return;
      }
      case 'sit': {
        k.pose = 'sit'; k.moving = false;
        // Rested at playtime: up and off to play.
        if (k.g.activity === 'break' && !k.teacher && k.needs.energy > 0.85) { k.seat.taken = false; k.seat = null; this.sendOne(k, this.chooseFun(k)); k.again = 4 + this.r() * 4; }
        return;
      }
      case 'chat': { k.pose = 'walk'; k.moving = false; k.chatT -= dt; if (k.chatT <= 0) { k.mode = 'wander'; k.wait = 0.5; } return; }
      case 'wander': {
        // At playtime, after a while, a child picks something else to do.
        if (k.g.activity === 'break' && !k.teacher && (k.again = (k.again ?? 4) - dt) <= 0) {
          const to = this.chooseFun(k); k.again = 3 + this.r() * 2;
          if (to !== 'yard') { this.sendOne(k, to); return; }
        }
        if (k.tx === undefined) [k.tx, k.tz] = this.crowd.pick(k.zone, this.r);
        if (this.stepTo(k, k.tx, k.zone.oy, k.tz, k.speed * (k.g.activity === 'break' ? 1.1 : 0.5), dt, 0.02)) {
          k.wait = 0.4 + this.r() * (k.g.activity === 'break' ? 1 : 2.5); [k.tx, k.tz] = this.crowd.pick(k.zone, this.r);
        }
        if (k.g.activity === 'break' && k.moving) k.pose = 'run';
        return;
      }
      default: k.moving = false;
    }
  }
  // Children step round each other instead of walking through.
  separate(dt) {
    const A = this.agents, R = 0.05;
    for (let i = 0; i < A.length; i++) {
      const a = A[i]; if (a.mode === 'sit') continue;
      for (let j = i + 1; j < A.length; j++) {
        const b = A[j]; if (b.mode === 'sit' || Math.abs(a.y - b.y) > 0.1) continue;
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
        if (d >= R || d < 1e-5) continue;
        const push = (R - d) * 0.5, ux = dx / d, uz = dz / d;
        a.x -= ux * push; a.z -= uz * push; b.x += ux * push; b.z += uz * push;
        // Two children playing bump into each other: sometimes they stop for a chat.
        if (a.mode === 'wander' && b.mode === 'wander' && a.g.activity === 'break' && this.r() < 0.006 && this.agents.filter(c => c.mode === 'chat').length < 6) {
          a.mode = b.mode = 'chat'; a.chatT = b.chatT = 2.2 + this.r(); a.yaw = Math.atan2(dx, dz); b.yaw = Math.atan2(-dx, -dz);
          this.bubble(a, LINES.chat[Math.floor(this.r() * LINES.chat.length)]);
        }
      }
    }
  }
  wearPaths(dt) {
    if (!this.crowd.onStep || (this.stepT += dt) < 0.14) return;
    this.stepT = 0; this.wearN = (this.wearN || 0) + 1;
    for (const k of this.agents) if (k.moving && k.y < 0.06 && (k.k + this.wearN) % 3 === 0) this.crowd.onStep(k.x, k.z);
  }

  // ---------- speech bubbles ----------
  lineFor(k) {
    const n = k.needs, two = list => list[Math.floor(this.r() * list.length)];
    if (k.mode === 'queue') return two(NEED_LINES.queue);
    if (k.mode === 'look' && LOOK[k.lookAt]) return LOOK[k.lookAt];
    if (n && !k.teacher && this.r() < 0.5) {
      if (n.energy < 0.3) return two(NEED_LINES.tired);
      if (n.hunger > 0.75 && k.g.activity !== 'lunch') return two(NEED_LINES.hungry);
      if (n.fun > 0.85) return two(NEED_LINES.happy);
    }
    const room = k.at && k.at !== 'gate' ? ROOM_LINES[k.at.type] || ROOM_LINES[k.at.b?.shape] : null;
    const list = room && this.r() < 0.6 ? room : LINES[k.g.activity] || LINES.chat;
    return list[Math.floor(this.r() * list.length)];
  }
  head(k) { return this.world.toScreen(v3(k.x, k.y + 0.27 * k.s, k.z)); }
  bubble(k, line, ms = 2600) {
    if (!this.layer || this.bubbles.length >= 4 || this.bubbles.some(b => b.k === k)) return null;
    // Not on top of another bubble.
    const h = this.head(k);
    if (this.bubbles.some(b => { const o = this.head(b.k); return Math.abs(o.x - h.x) < 150 && Math.abs(o.y - h.y) < 44; })) return null;
    const el = document.createElement('div'); el.className = 'bubble';
    el.innerHTML = `${emo(line[0])}<span>${esc(line[1])}</span>`;
    this.layer.append(el);
    const b = { k, el, until: this.clock + ms / 1000, line };
    this.bubbles.push(b); this.place(b);
    return b;
  }
  place(b) {
    const p = this.head(b.k), r = this.layer.getBoundingClientRect();
    b.el.style.left = `${p.x - r.left}px`; b.el.style.top = `${p.y - r.top}px`;
  }
  talk(dt) {
    const now = (this.clock = (this.clock || 0) + dt);
    this.bubbles = this.bubbles.filter(b => { if (now > b.until) { b.el.remove(); return false; } this.place(b); return true; });
    if ((this.sayT -= dt) > 0) return;
    this.sayT = 0.9 + this.r() * 1.2;
    // Someone who is settled (sitting, playing or arriving) says something.
    const pool = this.agents.filter(k => !k.teacher && !k.hidden && ['sit', 'wander', 'follow', 'queue'].includes(k.mode));
    if (!pool.length) return;
    const k = pool[Math.floor(this.r() * pool.length)];
    const s = this.world.toScreen(v3(k.x, k.y, k.z)), r = this.layer?.getBoundingClientRect();
    if (r && (s.x < r.left + 40 || s.x > r.right - 40 || s.y < r.top + 60 || s.y > r.bottom - 120)) return;
    this.bubble(k, this.lineFor(k));
  }
  // Tap a child to hear what they are saying.
  tap(cx, cy) {
    if (!this.running) return false;
    let best = null, bd = 34;
    for (const k of this.agents) { if (k.hidden) continue; const s = this.world.toScreen(v3(k.x, k.y + 0.15 * k.s, k.z)), d = Math.hypot(s.x - cx, s.y - cy); if (d < bd) { bd = d; best = k; } }
    if (!best) return false;
    const old = this.bubbles.find(b => b.k === best);
    const line = old ? old.line : best.teacher ? [['🍎', 'Well done, everyone!'], ['🔔', 'This way, class!'], ['⭐', 'Super work!']][Math.floor(this.r() * 3)] : this.lineFor(best);
    if (!old) { for (const o of this.bubbles) o.el.remove(); this.bubbles = []; this.bubble(best, line, 3200); }
    say(noEmoji(line[1]));
    return true;
  }
}
