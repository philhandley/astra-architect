// The school day: pupils follow their picture-tile code, or the bell timetable, round the real building.
import { ROOMS, ACTIVITIES, FORMS, LEVEL_H } from '../core/catalogue.js';
import { key, roomGroups, DIRS } from '../core/design.js';
import { computeDoors, buildGraph, findPath, gateKey } from '../core/arch.js';
import { trackLoops } from '../core/brief.js';

export const PERIOD = 16;          // seconds of sim time between bells at normal speed
export const BELLS = 6;
const DO_TIME = 4.2;
const WALK = 2.4, RUN = 3.4;

export const TILE = {
  parse(t) { const [kind, arg] = String(t).split(':'); return { kind, arg }; },
};

// Rooms where an activity can happen, in order of preference.
function roomsFor(act) { return ACTIVITIES[act]?.rooms || []; }

export class Day {
  constructor(idx, pupils, bells, { onlyPupil = null, mode = 'day' } = {}) {
    this.idx = idx;
    this.doors = computeDoors(idx);
    this.graph = buildGraph(idx, this.doors);
    this.groups = roomGroups(idx);
    this.bells = bells;
    this.mode = mode;               // 'day' (bells) or 'try' (one pupil runs their code)
    this.t = 0;
    this.bell = -1;
    this.over = false;
    this.events = [];
    this.traffic = new Map();
    this.loops = trackLoops(idx);
    this.slideTops = [];
    for (const [k, es] of this.graph.edges) if (es.some(e => e.kind === 'slide')) this.slideTops.push(k);
    this.climbBottoms = [...this.graph.nodes.entries()].filter(([, n]) => n.room === 'climbing' && n.kind === 'room').map(([k]) => k);
    const gate = gateKey();
    this.gate = this.graph.nodes.has(gate) ? gate : [...this.graph.nodes.keys()][0];
    this.pupils = pupils.map((p, i) => ({
      i, name: p.name, colour: p.colour, model: p.model,
      program: (p.strip || []).map(TILE.parse),
      coded: (p.strip || []).length > 0,
      active: !onlyPupil || onlyPupil === p.name,
      pc: 0, loops: {}, node: this.gate,
      pos: { x: 0, y: 0, z: 0 }, path: null, kinds: null, seg: 0, segT: 0,
      state: 'idle', act: null, timer: 0, after: null, want: null,
      jx: ((i * 37) % 9) / 9 * 0.44 - 0.22, jz: ((i * 53) % 7) / 7 * 0.44 - 0.22,
      bubble: null, stuck: null, dir: 0, speed: WALK, anim: 'idle',
      log: [], did: {}, stuckAt: [], walked: 0, codeDone: false, ended: null, tileNow: -1,
    }));
    for (const p of this.pupils) this.place(p, this.gate, 0.6);
    this.capUse = new Map();
  }

  place(p, k, spread = 0.25) {
    const n = this.graph.nodes.get(k);
    if (!n) return;
    p.node = k;
    p.pos.x = n.x + 0.5 + p.jx * spread * 4;
    p.pos.z = n.z + 0.5 + p.jz * spread * 4;
    p.pos.y = n.y;
  }

  emit(type, data) { this.events.push({ type, t: this.t, bell: this.bell, ...data }); }

  // ---------- Goals ----------
  roomNodes(room) {
    const out = [];
    for (const [k, n] of this.graph.nodes) if (n.room === room && n.kind !== 'slide') out.push(k);
    return out;
  }
  // Pick a room group for this pupil that still has space.
  goalFor(p, act) {
    for (const room of roomsFor(act)) {
      const groups = this.groups.filter(g => g.room === room);
      if (!groups.length) continue;
      const scored = groups.map(g => {
        const keys = g.cells.map(c => key(c.x, c.z, g.level)).filter(k => this.graph.nodes.has(k));
        const cap = ROOMS[room].cap * g.cells.length;
        const used = this.capUse.get(g) || 0;
        return { g, keys, cap, used };
      }).filter(s => s.keys.length);
      if (!scored.length) continue;
      const free = scored.find(s => s.used < s.cap);
      const pick = free || scored[0];
      this.capUse.set(pick.g, pick.used + 1);
      return { room, keys: pick.keys, full: !free, group: pick.g };
    }
    return null;
  }

  // ---------- Pupil actions ----------
  startPath(p, goals, then) {
    const r = findPath(this.graph, p.node, goals);
    if (!r) return false;
    p.path = r.path; p.kinds = r.kinds; p.seg = 0; p.segT = 0;
    p.state = 'walk'; p.after = then;
    p.walked += r.path.length;
    return true;
  }
  stick(p, why, what) {
    p.state = 'stuck'; p.stuck = { why, what }; p.timer = 3.5;
    p.stuckAt.push({ why, what, bell: this.bell, tile: p.tileNow });
    this.emit('stuck', { pupil: p.name, why, what });
  }

  // Begin doing an activity: walk to the right room first if needed.
  beginDo(p, act, { fromTimetable = false } = {}) {
    p.want = act;
    if (act === 'slide') return this.beginSlide(p);
    if (act === 'climb') return this.beginClimb(p);
    const here = this.graph.nodes.get(p.node);
    if (here && roomsFor(act).includes(here.room) && !fromTimetable) { this.startActivity(p, act); return; }
    const goal = this.goalFor(p, act);
    if (!goal) { this.stick(p, 'noroom', act); return; }
    if (goal.full) p.full = goal.room;
    // Each pupil heads for their own spot in the room, so they spread out.
    const n = this.capUse.get(goal.group) || 1;
    const mine = [goal.keys[(n - 1 + p.i) % goal.keys.length]];
    const then = () => {
      if (p.full) { this.stick(p, 'full', goal.room); p.full = null; return; }
      this.startActivity(p, act);
    };
    if (this.startPath(p, mine, then)) return;
    const ok = this.startPath(p, goal.keys, () => {
      if (p.full) { this.stick(p, 'full', goal.room); p.full = null; return; }
      this.startActivity(p, act);
    });
    if (!ok) this.stick(p, 'noway', goal.room);
  }
  startActivity(p, act) {
    p.state = 'do'; p.act = act; p.timer = DO_TIME;
    p.did[act] = (p.did[act] || 0) + 1;
    const n = this.graph.nodes.get(p.node);
    this.emit('do', { pupil: p.name, act, room: n?.room });
    if (act === 'run') this.startLap(p);
  }
  beginSlide(p) {
    if (!this.slideTops.length) { this.stick(p, 'noroom', 'slide'); return; }
    const ok = this.startPath(p, this.slideTops, () => {
      const e = this.graph.edges.get(p.node).find(x => x.kind === 'slide');
      p.path = [p.node, e.to]; p.kinds = ['slide']; p.seg = 0; p.segT = 0; p.state = 'walk';
      p.after = () => { p.did.slide = (p.did.slide || 0) + 1; this.emit('do', { pupil: p.name, act: 'slide', room: 'slide' }); this.next(p); };
    });
    if (!ok) this.stick(p, 'noway', 'slide');
  }
  beginClimb(p) {
    if (!this.climbBottoms.length) { this.stick(p, 'noroom', 'climb'); return; }
    const ok = this.startPath(p, this.climbBottoms, () => {
      const up = (this.graph.edges.get(p.node) || []).find(x => x.kind === 'climb' && this.graph.nodes.get(x.to).l > this.graph.nodes.get(p.node).l);
      if (!up) { this.startActivity(p, 'climb'); return; }
      const bottom = p.node;
      p.path = [p.node, up.to, bottom]; p.kinds = ['climb', 'climb']; p.seg = 0; p.segT = 0; p.state = 'walk';
      p.after = () => { p.did.climb = (p.did.climb || 0) + 1; this.emit('do', { pupil: p.name, act: 'climb', room: 'climbing' }); this.next(p); };
    });
    if (!ok) this.stick(p, 'noway', 'climbing');
  }
  // Running: keep moving round the track tiles without turning back unless it ends.
  startLap(p) {
    const n = this.graph.nodes.get(p.node);
    if (!n || n.room !== 'track') { p.lap = null; return; }
    p.lap = { prev: null, gap: false };
  }
  lapStep(p) {
    const n = this.graph.nodes.get(p.node);
    const nbs = (this.graph.edges.get(p.node) || []).filter(e => { const m = this.graph.nodes.get(e.to); return m && m.room === 'track' && m.l === n.l; }).map(e => e.to);
    let choices = nbs.filter(k => k !== p.lap.prev);
    if (!choices.length) { choices = nbs; if (nbs.length) p.lap.gap = true; }
    if (!choices.length) return;
    // Prefer going straight on.
    let pick = choices[0];
    if (p.lap.prev) {
      const a = this.graph.nodes.get(p.lap.prev);
      const dx = n.x - a.x, dz = n.z - a.z;
      const straight = choices.find(k => { const m = this.graph.nodes.get(k); return m.x - n.x === dx && m.z - n.z === dz; });
      if (straight && Math.random() < 0.7) pick = straight;
      else pick = choices[(p.i + Math.floor(this.t)) % choices.length];
    }
    p.lap.prev = p.node;
    p.path = [p.node, pick]; p.kinds = ['run']; p.seg = 0; p.segT = 0; p.state = 'walk'; p.speed = RUN;
    p.after = () => { p.state = 'do'; };
  }

  // ---------- Program ----------
  next(p) {
    p.speed = WALK;
    if (this.mode === 'day' && (!p.coded || p.codeDone)) { p.state = 'idle'; p.act = null; return; }
    if (!p.coded) { p.state = 'idle'; return; }
    let guard = 0;
    while (guard++ < 50) {
      if (p.pc >= p.program.length) {
        p.codeDone = true; p.tileNow = -1;
        p.ended = this.graph.nodes.get(p.node)?.room || 'outside';
        this.emit('codeDone', { pupil: p.name, at: p.ended });
        p.state = 'idle'; p.act = null;
        return;
      }
      const ins = p.program[p.pc];
      if (ins.kind === 'again') {
        const times = ins.arg === 'forever' ? 99 : (+ins.arg || 2);
        const c = p.loops[p.pc] || 0;
        if (c < times - 1) {
          p.loops[p.pc] = c + 1;
          let start = 0;
          for (let j = p.pc - 1; j >= 0; j--) if (p.program[j].kind === 'again') { start = j + 1; break; }
          for (let j = start; j < p.pc; j++) delete p.loops[j];
          p.pc = start;
        } else { p.pc++; }
        continue;
      }
      p.tileNow = p.pc;
      p.pc++;
      this.emit('tile', { pupil: p.name, tile: p.tileNow });
      if (ins.kind === 'go') {
        const keys = ins.arg === 'gate' ? [this.gate] : this.roomNodes(ins.arg);
        if (!keys.length) { this.stick(p, 'noroom', ins.arg); return; }
        if (keys.includes(p.node)) continue;
        const ok = this.startPath(p, keys, () => this.next(p));
        if (!ok) this.stick(p, 'noway', ins.arg);
        return;
      }
      if (ins.kind === 'do') { this.beginDo(p, ins.arg); return; }
      if (ins.kind === 'wait') {
        if (ins.arg === 'bell' && this.mode === 'day') { p.state = 'waitbell'; return; }
        p.state = 'pause'; p.timer = 2; return;
      }
    }
  }

  ringBell(n) {
    this.bell = n;
    this.capUse = new Map();
    const act = this.bells[n];
    this.emit('bell', { n, act });
    for (const p of this.pupils) {
      if (!p.active) continue;
      if (p.coded && !p.codeDone) {
        if (p.state === 'waitbell') this.next(p);
        continue;
      }
      p.stuck = null;
      if (act === 'home') this.goHome(p);
      else this.beginDo(p, act, { fromTimetable: true });
    }
  }
  goHome(p) {
    if (p.node === this.gate) { p.state = 'home'; return; }
    if (!this.startPath(p, [this.gate], () => { p.state = 'home'; })) p.state = 'home';
  }

  start() {
    if (this.mode === 'try') {
      for (const p of this.pupils) if (p.active && p.coded) this.next(p);
      return;
    }
    this.ringBell(0);
    for (const p of this.pupils) if (p.active && p.coded) this.next(p);
  }

  // ---------- Time ----------
  step(dt) {
    if (this.over) return;
    this.t += dt;
    if (this.mode === 'day') {
      const b = Math.floor(this.t / PERIOD);
      if (b !== this.bell && b < BELLS) this.ringBell(b);
      if (b >= BELLS && this.bell < BELLS) { this.bell = BELLS; for (const p of this.pupils) if (p.active) { p.stuck = null; p.lap = null; this.goHome(p); } this.emit('home', {}); }
      if (this.t > PERIOD * BELLS + 14) this.finish();
    } else {
      const busy = this.pupils.some(p => p.active && p.coded && !p.codeDone);
      if (!busy || this.t > 60) this.finish();
    }
    for (const p of this.pupils) if (p.active) this.stepPupil(p, dt);
  }
  stepPupil(p, dt) {
    if (p.state === 'walk') {
      const a = this.graph.nodes.get(p.path[p.seg]), b = this.graph.nodes.get(p.path[p.seg + 1]);
      if (!a || !b) { p.state = 'idle'; return; }
      const kind = p.kinds[p.seg];
      if (p.lap) p.timer -= dt;
      const sp = kind === 'slide' ? 2.4 : kind === 'stairs' ? 0.9 : kind === 'climb' ? 0.55 : p.speed;
      p.segT += dt * sp;
      const t = Math.min(1, p.segT);
      const last = p.seg + 1 === p.path.length - 1;
      const spread = last && p.state === 'walk' ? 1 : 0.35;
      const ax = a.x + 0.5 + p.jx * (p.seg === 0 ? 1 : 0.35), az = a.z + 0.5 + p.jz * (p.seg === 0 ? 1 : 0.35);
      const bx = b.x + 0.5 + p.jx * spread, bz = b.z + 0.5 + p.jz * spread;
      p.pos.x = ax + (bx - ax) * t; p.pos.z = az + (bz - az) * t;
      p.pos.y = a.y + (b.y - a.y) * (kind === 'slide' ? t * t : t);
      if (Math.abs(bx - ax) + Math.abs(bz - az) > 0.05) p.dir = Math.atan2(bx - ax, bz - az);
      p.anim = kind === 'climb' ? 'climb' : kind === 'slide' ? 'slide' : p.speed > 2 ? 'sprint' : 'walk';
      if (t >= 1) {
        const ra = a.room, rb = b.room;
        if (ra !== rb && ra && rb) { const k = `${ra}-${rb}`; this.traffic.set(k, (this.traffic.get(k) || 0) + 1); }
        p.node = p.path[p.seg + 1];
        p.seg++; p.segT = 0;
        if (p.seg >= p.path.length - 1) { p.path = null; const f = p.after; p.after = null; p.state = 'arrived'; f ? f() : this.next(p); }
      }
      return;
    }
    if (p.state === 'do') {
      p.timer -= dt;
      p.anim = { learn: 'sit', read: 'sit', eat: 'sit', yoga: 'sit', art: 'interact', music: 'emote', grow: 'pick', look: 'idle', play: 'jump', swim: 'swim', run: 'sprint', climb: 'idle' }[p.act] || 'idle';
      if (p.act === 'run' && p.lap) { if (p.timer > 0) { this.lapStep(p); return; } if (p.lap.gap) this.emit('trackGap', { pupil: p.name }); p.lap = null; }
      if (p.timer <= 0) {
        // On the timetable, keep going until the next bell rings.
        if (this.mode === 'day' && (!p.coded || p.codeDone) && this.bell < BELLS) { p.timer = DO_TIME; if (p.act === 'run') this.startLap(p); return; }
        p.state = 'done'; this.next(p); if (p.state === 'done') p.state = 'idle';
      }
      return;
    }
    if (p.state === 'pause') { p.timer -= dt; p.anim = 'idle'; if (p.timer <= 0) this.next(p); return; }
    if (p.state === 'stuck') {
      p.anim = 'idle';
      p.timer -= dt;
      if (p.timer <= 0 && p.coded && !p.codeDone) { p.stuck = null; this.next(p); }
      return;
    }
    p.anim = p.state === 'home' ? 'idle' : 'idle';
  }

  finish() {
    if (this.over) return;
    this.over = true;
    this.emit('over', {});
  }
}

// ---------- The report card ----------
const say1 = (n, one, many) => (n === 1 ? one : many.replace('#', numberWord(n)));
export function numberWord(n) { return ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][n] || String(n); }
const actName = a => ({ learn: 'lessons', read: 'reading', play: 'playing', swim: 'swimming', run: 'running', climb: 'climbing', slide: 'the slide', yoga: 'yoga', eat: 'lunch', look: 'looking at the fish', grow: 'gardening', art: 'painting', music: 'singing' }[a] || a);
const roomName = r => ROOMS[r] ? ROOMS[r].name.toLowerCase() : r === 'gate' ? 'gate' : r;

export function report(day) {
  const lines = [];
  const P = day.pupils.filter(p => p.active);
  const stuck = P.flatMap(p => p.stuckAt.map(s => ({ ...s, p })));
  if (day.mode === 'try') {
    for (const p of P.filter(q => q.coded)) {
      const did = Object.entries(p.did).map(([a, n]) => `${actName(a)}${n > 1 ? ` ${numberWord(n)} times` : ''}`);
      const s = p.stuckAt[0];
      if (s) lines.push({ kind: 'fix', emoji: '🤔', text: `${p.name} got stuck: ${stuckWhy(s)}` });
      if (p.ended) lines.push({ kind: s ? 'info' : 'good', emoji: s ? '📍' : '🎉', text: `${p.name} ended up ${p.ended === 'outside' ? 'outside' : `at the ${roomName(p.ended)}`}${did.length ? `, after ${did.join(', ')}` : ''}.` });
    }
    return { lines, question: P.some(p => p.stuckAt.length) ? 'Which tile needs changing?' : 'What could the pupil do next?' };
  }
  // What happened at each bell.
  const byBell = new Map();
  for (const s of stuck) { if (!byBell.has(s.bell)) byBell.set(s.bell, []); byBell.get(s.bell).push(s); }
  day.bells.forEach((act, b) => {
    const st = byBell.get(b) || [];
    const noroom = st.filter(s => s.why === 'noroom');
    const noway = st.filter(s => s.why === 'noway');
    const full = st.filter(s => s.why === 'full');
    if (noroom.length >= Math.max(1, P.length * 0.5)) lines.push({ kind: 'fix', emoji: ACTIVITIES[act]?.emoji || '❓', text: `There was nowhere for ${actName(act)}, so ${act === 'eat' ? 'everyone got hungry' : 'it was cancelled'}. Which room would help?` });
    else if (noway.length) lines.push({ kind: 'fix', emoji: '🪜', text: `${say1(noway.length, 'One pupil', '# pupils')} couldn't get to the ${roomName(noway[0].what)}. How could they get there?` });
    else if (full.length) lines.push({ kind: 'fix', emoji: '😟', text: `The ${roomName(full[0].what)} was too small: ${say1(full.length, 'one pupil', '# pupils')} had to wait outside.` });
    else lines.push({ kind: 'good', emoji: ACTIVITIES[act]?.emoji || '✅', text: `${capital(actName(act))}: everyone ${act === 'learn' ? 'learned something' : act === 'eat' ? 'had lunch' : act === 'look' ? 'saw the fish' : 'joined in'}!` });
  });
  // Coders.
  for (const p of P.filter(q => q.coded)) {
    const s = p.stuckAt.find(x => x.tile >= 0);
    if (s) lines.push({ kind: 'fix', emoji: '🧩', text: `${p.name}'s code got stuck: ${stuckWhy(s)}` });
    else lines.push({ kind: 'good', emoji: '🧩', text: `${p.name}'s code worked!${p.did.slide ? ` ${p.name} went down the slide ${numberWord(p.did.slide)} time${p.did.slide > 1 ? 's' : ''}.` : ''}` });
  }
  if (day.events.some(e => e.type === 'trackGap')) lines.push({ kind: 'fix', emoji: '🏃', text: 'The running track had a gap, so the runners had to turn back. Can you join it into a loop?' });
  // Noise next door.
  const lib = day.groups.find(g => g.room === 'library');
  if (lib) {
    const noisyNear = new Set();
    for (const c of lib.cells) for (const [dx, dz, dl] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1]]) { const n = day.idx.occ.get(key(c.x + dx, c.z + dz, lib.level + dl)); if (n && ROOMS[n.room].noisy) noisyNear.add(n.room); }
    if (noisyNear.size) lines.push({ kind: 'fix', emoji: '📚', text: `The library was noisy because the ${roomName([...noisyNear][0])} is right next to it.` });
  }
  // Favourite place: the most fun activity done.
  const fun = {};
  for (const p of P) for (const [a, n] of Object.entries(p.did)) if (['slide', 'swim', 'climb', 'play', 'run', 'look'].includes(a)) fun[a] = (fun[a] || 0) + n;
  const fav = Object.entries(fun).sort((a, b) => b[1] - a[1])[0];
  if (fav) lines.push({ kind: 'good', emoji: '⭐', text: `The favourite thing today was ${actName(fav[0])}!` });
  // Long walks.
  const avgWalk = P.reduce((a, p) => a + p.walked, 0) / Math.max(1, P.length);
  if (avgWalk > 120) lines.push({ kind: 'info', emoji: '👣', text: 'Pupils walked a very long way today. Could some rooms be closer together?' });
  const fixes = lines.filter(l => l.kind === 'fix');
  const question = fixes.length ? 'What one thing would you change first?' : 'Everything worked! What would make the school even better?';
  return { lines: [...fixes.slice(0, 4), ...lines.filter(l => l.kind !== 'fix').slice(0, 6 - Math.min(4, fixes.length))], question };
}
function stuckWhy(s) {
  if (s.why === 'noroom') return ROOMS[s.what] ? `there is no ${roomName(s.what)} yet.` : `there is nowhere for ${actName(s.what)}.`;
  if (s.why === 'noway') return `there is no way to get to the ${roomName(s.what)}. Does it need stairs or a door?`;
  if (s.why === 'full') return `the ${roomName(s.what)} was full.`;
  return 'something was in the way.';
}
const capital = s => s.charAt(0).toUpperCase() + s.slice(1);

export { FORMS, LEVEL_H, DIRS };
