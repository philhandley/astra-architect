// Mission play step: the Studio with a preset (which rooms, which tools, which jobs).
import * as THREE from 'three';
import { mountStudio } from '../studio.js';
import { roomGroups, allMoods, key } from '../core/design.js';
import { checkBrief } from '../core/brief.js';
import { computeDoors, buildGraph, reachable, gateKey } from '../core/arch.js';
import { ROOMS, LEVEL_H } from '../core/catalogue.js';
import { site, zone, groundAt } from '../core/site.js';
import { store } from '../core/store.js';
import { h, say, sayAuto, sfx, toast } from '../ui/dom.js';
import { icon } from '../core/icons.js';
import { emo } from '../core/emoji.js';

const has = (api, room) => api.design.cells.some(c => c.room === room);
const brief = (api, id) => checkBrief(api.idx, [id])[id];
const groupsOf = (api, room) => roomGroups(api.idx).filter(g => g.room === room);

export const PRESETS = {
  site: {
    iso: false,
    rooms: ['yoga'],
    tools: ['sun', 'undo', 'zoom', 'mode'],
    briefIds: ['yoga-waterfall'],
    tasks: [
      { text: 'Turn the site round', emoji: '🔄', say: 'Drag your finger across the site to turn it round.', check: (a, ev) => ev === 'orbit', praise: 'Now you can see the site from every side.' },
      { text: 'Move the sun', emoji: '☀️', say: 'Slide the sun along the bar at the top. Watch the shadows move.', check: (a, ev) => ev === 'sun', praise: 'Morning sun in the east, evening sun in the west.' },
      { text: 'Tap the best view', emoji: '🔭', say: 'Tap the place on the site with the best view. Architects stand there to look.', check: (a, ev) => ev === 'flag' },
      { text: 'Build your chill-out room', emoji: '🧘', room: 'yoga', say: 'Choose the chill-out room. Put your finger where it should go, then lift your finger to build it.', check: (a, ev, d) => ev === 'build' && d.cell.room === 'yoga' },
    ],
    async setup(api) { api.toggleSun(true); },
    onGroundTap(t, api) { lookFrom(api, t); },
  },
  neighbours: {
    rooms: ['classroom', 'hall', 'library', 'lunch', 'music', 'yoga', 'garden', 'art'],
    tools: ['views', 'faces', 'undo', 'zoom', 'mode', 'bubbles'],
    views: ['model', 'plan'],
    faces: true,
    briefIds: ['library', 'happy'],
    tasks: [
      { text: 'Build a classroom', emoji: '✏️', room: 'classroom', check: a => has(a, 'classroom') },
      { text: 'Build a hall', emoji: '🤸', room: 'hall', check: a => has(a, 'hall') },
      { text: 'Build a library', emoji: '📚', room: 'library', check: a => has(a, 'library') },
      { text: 'Tap a face to hear how a room feels', emoji: '😊', check: (a, ev) => ev === 'faceTap' },
      { text: 'Make every face happy', emoji: '🥳', say: 'Move rooms so nobody is sad. Quiet rooms want to be away from noisy ones.', check: a => { const m = allMoods(a.idx); return ['classroom', 'hall', 'library'].every(r => has(a, r)) && m.every(x => x.m.face !== 'sad'); }, praise: 'Every room is happy. That is a good programme!' },
      { text: 'Look at the bubble diagram', emoji: '🫧', say: 'Tap Bubbles. Architects draw rooms as bubbles to see who is next to who.', check: (a, ev) => ev === 'bubbles' },
    ],
  },
  scale: {
    rooms: ['classroom'],
    tools: ['views', 'undo', 'zoom', 'mode'],
    views: ['model', 'walk'],
    briefIds: [],
    tasks: [
      { text: 'Build a classroom', emoji: '✏️', room: 'classroom', check: a => has(a, 'classroom') },
      { text: 'Make it big enough for 8 pupils', emoji: '👥', say: 'Each block holds four pupils. Put two classroom blocks side by side to make one big classroom.', check: a => groupsOf(a, 'classroom').some(g => g.cells.length >= 2) },
      { text: 'Fill it with pupils', emoji: '🧒', say: 'Tap Fill it up to see if everyone fits.', check: (a, ev, d) => ev === 'fill' && d.ok },
      { text: 'Walk in as the Architect', emoji: '🚶', say: 'Tap Walk, then tap the classroom to walk inside.', check: (a, ev) => ev === 'walkArrive' || ev === 'walkMove' },
    ],
    async setup(api) { fillButton(api); },
  },
  aquarium: {
    rooms: ['aquarium', 'pool', 'changing'],
    tools: ['views', 'mode', 'undo', 'zoom'],
    views: ['model', 'walk'],
    briefIds: ['arch-aquarium'],
    tasks: [
      { text: 'Build the aquarium', emoji: '🐠', room: 'aquarium', check: a => has(a, 'aquarium') },
      { text: 'Make it an arch, or a ring of curves', emoji: '🌈', say: 'The aquarium starts as an arch. Pick it and tap the shape button to try curves. Four curves make a ring.', check: a => brief(a, 'arch-aquarium') },
      { text: 'Switch to Building to see the fish', emoji: '🏠', check: (a, ev, d) => ev === 'mode' && d.mode === 'building' || (a.S.mode === 'building' && ev === 'build') },
      { text: 'Walk through it', emoji: '🚶', say: 'Tap Walk, then tap the aquarium to walk through.', check: (a, ev, d) => ev === 'walkArrive' && /aquarium/i.test(d.label || '') },
    ],
    formFor: {},
  },
  style: {
    tools: ['views', 'mode', 'undo', 'zoom'],
    views: ['model', 'plan', 'walk'],
    briefIds: [],
    rooms: ['classroom', 'hall', 'library', 'art', 'music', 'lunch'],
    tasks: [
      { text: 'Build a room, then tap it', emoji: '👆', say: 'Build a room. Then choose Pick and tap the room.', check: (a, ev) => ev === 'select' },
      { text: 'Tap Style', emoji: '✨', say: 'Tap the colourful Style button.', check: (a, ev) => ev === 'stylePanel' || ev === 'style' || ev === 'push' },
      { text: 'Give it a new roof', emoji: '🎩', say: 'Tap Roof and choose a new one. A witch hat? A zigzag?', check: (a, ev, d) => (ev === 'style' && d.patch && d.patch.roof) },
      { text: 'Make the walls curvy or wavy', emoji: '〰️', say: 'Tap Walls and try Curvy or Wavy.', check: (a, ev, d) => ev === 'style' && d.patch && (d.patch.walls === 'curvy' || d.patch.walls === 'wave' || d.patch.walls === 'round') },
      { text: 'Push it, pull it or put it on legs', emoji: '🦵', say: 'Tap Push and pull. Make it taller, pull out a bay window, or put it on legs.', check: (a, ev) => ev === 'push' },
      { text: 'Add a flag, a chimney or a beak', emoji: '🚩', check: (a, ev, d) => ev === 'style' && d.patch && (d.patch.flag || d.patch.chimney || d.patch.beak) },
    ],
  },
  drawings: {
    tools: ['views', 'mode', 'sun', 'undo', 'zoom'],
    views: ['model', 'plan', 'section'],
    briefIds: ['sea-classroom'],
    tasks: [
      { text: 'Give a classroom a sea view', emoji: '🌊', room: 'classroom', say: 'Build a classroom near the beach side of the meadow, where its windows look at the sea.', check: a => brief(a, 'sea-classroom') },
      { text: 'Look at the plan', emoji: '📐', check: (a, ev, d) => ev === 'view' && d.view === 'plan' },
      { text: 'Slide the section through the school', emoji: '✂️', check: (a, ev, d) => ev === 'section' && d.t < 0.9 },
      { text: 'Look from the mountains', emoji: '🏔️', check: (a, ev, d) => ev === 'sectionSide' && d.side === 'north' },
      { text: 'Move the sun and watch the shadows', emoji: '☀️', check: (a, ev) => ev === 'sun' },
    ],
  },
  code1: {
    tools: ['views', 'day', 'undo', 'zoom', 'mode'],
    views: ['model'],
    briefIds: [],
    day: { pupils: 1, codeOnly: true, tiles: ['go:', 'do:learn', 'do:swim', 'do:read', 'do:play'] },
    tasks: [
      { text: 'Make sure there is a classroom and a pool', emoji: '🏫', say: 'Your school needs a classroom and a swimming pool for this. Build them if they are missing.', check: a => has(a, 'classroom') && has(a, 'pool') },
      { text: 'Code: Go to the classroom', emoji: '🧩', say: 'Tap Day. Give your pupil the tile Go to the classroom, then press Go.', check: (a, ev, d) => ev === 'tryDone' && d.ended === 'classroom' },
      { text: 'Guess before you press Go', emoji: '🤔', check: (a, ev, d) => ev === 'tryDone' && d.predicted },
      { text: 'Code a swim: Go to the pool, then Swim', emoji: '🏊', check: (a, ev, d) => ev === 'tryDone' && (d.did.swim || 0) >= 1 },
    ],
    async setup(api) { if (has(api, 'classroom') || api.design.cells.length) setTimeout(() => api.openDay(), 600); },
  },
  code2: {
    tools: ['views', 'day', 'mode', 'undo', 'zoom'],
    views: ['model', 'walk', 'section'],
    briefIds: ['roof-track'],
    async setup(api) {
      const tall = [...api.design.cells].sort((a, b) => b.level - a.level || b.id - a.id)[0];
      if (tall) { const V = api.world.controls.target.constructor; api.animateCam(new V(tall.x + 0.5, 0.6, tall.z + 0.5), null, 0.8, 2.2); }
    },
    day: { pupils: 1, codeOnly: true, tiles: ['go:', 'do:run', 'do:swim', 'do:learn', 'wait:short', 'again:2', 'again:3'] },
    tasks: [
      { text: 'Put running track on a roof, in a loop', emoji: '🏃', room: 'track', say: 'Choose the running track. Tap on top of some rooms to put track on the roof, and join it up into a loop.', check: a => brief(a, 'roof-track') },
      { text: 'Add stairs or a climbing wall to get up', emoji: '🪜', say: 'Pupils cannot fly! Put stairs next to the building so they can climb up to the roof.', check: a => trackReachable(a) },
      { text: 'Code laps: Go to the track, Run, Again', emoji: '🔁', say: 'Tap Day. Use the tiles Go to the track, Run, then Again.', check: (a, ev, d) => ev === 'tryDone' && (d.did.run || 0) >= 2 },
    ],
  },
  openday: {
    tools: ['views', 'day', 'mode', 'faces', 'undo', 'zoom'],
    briefIds: null,
    day: {},
    tasks: [
      { text: 'Fill in the bell timetable', emoji: '🔔', say: 'Tap Day, then Bell timetable. Choose what happens at each bell.', check: (a, ev) => ev === 'bellSet' },
      { text: 'Run the school day', emoji: '▶️', check: (a, ev) => ev === 'dayDone' },
      { text: 'Fix one thing from the report', emoji: '🔧', say: 'Close the day, then change one thing the report talked about.', check: (a, ev) => ['build', 'remove', 'move', 'shape', 'turn'].includes(ev) && a.S.events.includes('dayDone') },
      { text: 'Run the day again', emoji: '🔁', check: (a, ev) => ev === 'dayDone' && a.S.events.filter(e => e === 'dayDone').length >= 2 },
    ],
    async setup(api) { setTimeout(() => api.openDay({ focus: 'timetable' }), 700); },
  },
  sheet: {
    tools: ['views', 'mode', 'undo', 'zoom'],
    briefIds: null,
    tasks: [
      { text: 'Make your drawing sheet', emoji: '🖼️', check: (a, ev) => ev === 'sheet' },
    ],
    async setup(api) {
      const b = h(`<button class="btn go big" type="button" style="position:absolute;left:50%;transform:translateX(-50%);bottom:18px;z-index:7">${icon('image')} Make my drawing sheet</button>`);
      b.addEventListener('click', async () => { const m = await import('../ui/sheet.js'); m.openSheet({ onMade: () => api.emit('sheet') }); });
      api.root.appendChild(b);
    },
  },
};

function trackReachable(api) {
  const tracks = api.design.cells.filter(c => c.room === 'track' && c.level >= 1);
  if (!tracks.length) return false;
  const g = buildGraph(api.idx, computeDoors(api.idx));
  const r = reachable(g, gateKey());
  return tracks.some(c => r.has(key(c.x, c.z, c.level)));
}

// Mission 1: tap a spot, plant a flag and swoop down to see the view from there.
function lookFrom(api, t) {
  const w = api.world;
  if (api.flag) { w.groups.fx.remove(api.flag); }
  const flag = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), new THREE.MeshLambertMaterial({ color: '#f4f1ea' }));
  pole.position.y = 0.45;
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.28), new THREE.MeshLambertMaterial({ color: '#e5483d', side: THREE.DoubleSide }));
  cloth.position.set(0.23, 0.76, 0);
  flag.add(pole, cloth);
  const gy = Math.max(0, groundAt(t.x + 0.5, t.z + 0.5));
  flag.position.set(t.x + 0.5, gy, t.z + 0.5);
  w.groups.fx.add(flag);
  api.flag = flag;
  sfx.pop();
  // What can you see from here?
  const S = site();
  const [fx, fz] = S.waterfall;
  const dWater = Math.hypot(t.x - fx, t.z - fz);
  let seaD = 99, sea = null;
  for (let z = 0; z < S.d; z++) for (let x = 0; x < S.w; x++) if (zone(x, z) === 'w') { const d = Math.hypot(x - t.x, z - t.z); if (d < seaD) { seaD = d; sea = [x, z]; } }
  const looks = [];
  if (seaD < 14) looks.push('the sea');
  if (dWater < 9) looks.push('the waterfall');
  if (t.z < 22 && t.x < 20) looks.push('the mountains');
  if (zone(t.x, t.z) === 'f') looks.push('lots of trees');
  const target = seaD < 14 ? new THREE.Vector3(sea[0], 0, sea[1]) : new THREE.Vector3(fx, 0.8, fz);
  const pos = new THREE.Vector3(t.x + 0.5, gy + 1.6, t.z + 0.5).add(new THREE.Vector3(t.x + 0.5 - target.x, 0, t.z + 0.5 - target.z).setLength(2.5));
  api.animateCam(target, pos, 1.1);
  say(looks.length ? `From here you can see ${looks.join(' and ')}. ${looks.includes('the sea') || looks.includes('the waterfall') ? 'What a view!' : ''}` : 'From here you can see the meadow. Try somewhere nearer the water for a better view.');
  api.emit('flag', { x: t.x, z: t.z, looks });
  if (!api.root.querySelector('.whole-site')) {
    const b = h(`<button class="btn big whole-site" type="button" style="position:absolute;left:50%;transform:translateX(-50%);bottom:18px;z-index:7">${emo('🗺️')} See the whole site</button>`);
    const back = () => { clearTimeout(api.siteTimer); b.remove(); api.frameModel(false); };
    b.addEventListener('click', back);
    api.root.appendChild(b);
    clearTimeout(api.siteTimer);
    api.siteTimer = setTimeout(() => { if (!api.S.destroyed && b.isConnected) back(); }, 6000);
  }
}

// Mission 3: a button that sends eight pupils into the classroom to see if they fit.
function fillButton(api) {
  const b = h(`<button class="btn go big" type="button" style="position:absolute;left:50%;transform:translateX(-50%);bottom:18px;z-index:7">${emo('🧒')} Fill it up</button>`);
  api.root.appendChild(b);
  b.addEventListener('click', async () => {
    if (!has(api, 'classroom')) { sfx.no(); say('Build a classroom first!'); return; }
    b.disabled = true;
    const { Day } = await import('../sim/sim.js');
    const { PupilsView } = await import('../sim/pupils3d.js');
    const S = store.state;
    const pupils = S.pupils.slice(0, 8).map((p, i) => ({ ...p, name: i === 0 ? (S.crew?.commander || 'Finn') : p.name, strip: [] }));
    const day = new Day(api.idx, pupils, ['learn', 'learn', 'learn', 'learn', 'learn', 'learn'], {});
    const view = api.world.pupilsView || (api.world.pupilsView = new PupilsView(api.world));
    await view.ensure(day.pupils);
    api.setCutaway(true);
    api.frameModel(false, true, true);
    day.start();
    let t = 0;
    const tick = dt => {
      t += dt;
      day.step(Math.min(dt, 0.08));
      view.update(day, dt, {});
      if (t > 11) {
        api.world.updaters.delete(tick);
        api.fillTick = null;
        if (api.S.destroyed) return;
        const waiting = day.pupils.filter(p => p.stuck && p.stuck.why === 'full').length;
        const ok = waiting === 0;
        if (ok) { sfx.tada(); toast('Everyone fits!', '🎉'); sayAuto('Everyone fits! Eight pupils, in a classroom of two blocks.'); }
        else { sfx.no(); toast(`${waiting} pupil${waiting > 1 ? 's' : ''} had to wait outside`, '😟'); sayAuto(`Oh no, ${waiting} pupils had to wait outside. The classroom is too small. Make it bigger!`); }
        api.emit('fill', { ok, waiting });
        setTimeout(() => { if (api.S.destroyed) return; view.clear(); api.setCutaway(false); b.disabled = false; }, 2500);
      }
    };
    api.fillTick = tick;
    api.world.updaters.add(tick);
  });
}

export async function mount(host, ctx) {
  const preset = PRESETS[ctx.data.preset] || {};
  const api = await mountStudio(host, { preset, ctx });
  const destroy = api.destroy;
  api.destroy = () => {
    if (api.flag) { api.world.groups.fx.remove(api.flag); api.flag = null; }
    if (api.fillTick) { api.world.updaters.delete(api.fillTick); api.fillTick = null; if (api.world.pupilsView) api.world.pupilsView.clear(); }
    destroy();
  };
  if (preset.tools && preset.tools.includes('bubbles')) {
    const rail = api.root.querySelector('.rail.right');
    const b = h(`<button class="rbtn" type="button" aria-label="Bubbles">${icon('bubbles')}<span>Bubbles</span></button>`);
    b.addEventListener('click', () => {
      const on = !api.S.bubbles;
      if (on && api.S.view !== 'plan') api.setView('plan');
      api.setBubbles(on);
      b.classList.toggle('on', on);
      if (on) say('This is a bubble diagram. Each room is a bubble. Green lines join rooms that like each other. Red lines join rooms that do not.');
      api.emit('bubbles', { on });
    });
    rail.insertBefore(b, rail.querySelector('.rspacer'));
  }
  return api;
}

export { LEVEL_H, ROOMS };
