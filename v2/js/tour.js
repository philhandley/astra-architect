// The Tour: the camera flies round the school, stopping at each kind of room with a line in Finn's words, read
// aloud. It is for show and tell: the teacher's link opens with a Tour button, and the tour runs itself.
// Finn picks each room's line from a word bank in "Tour words" (mountTourWords); the picks travel in the link.
import { PROGRAMMES } from './catalogue.js';
import { WISHES } from './wishes.js';
import { CUTTABLE } from './inside.js';
import { icon } from './icons.js';
import { h, esc, emo, say, hush, sfx } from './ui.js';

// What a room can say. The first line is what it says unless Finn picks another.
export const CAPTIONS = {
  classroom: ['This is my classroom. It looks at the sea.', 'We sit on the rug for stories.', 'There is a hamster in our class.', 'The windows are big, so the sun comes in.', 'My teacher sits at the desk by the flip chart.'],
  ringhouse: ['A ring of classrooms round a garden.', 'You can run all the way round.', 'The garden in the middle has a big tree.'],
  hall: ['We do PE in the hall.', 'The climbing wall goes right up to the top.', 'Assembly is in here every morning.', 'You can play football inside when it rains.'],
  pool: ['Splash! This is the swimming pool.', 'We swim every week.', 'There are lanes for races.'],
  aquarium: ['You walk under the fish!', 'A whale swims over your head.', 'My favourite is the jellyfish.', 'The fish watch you eat your lunch.'],
  library: ['Shh. This is the library.', 'You can read up in the tree.', 'There is a puppet show on Fridays.', 'The fairy lights come on for story time.'],
  yoga: ['The chill-out room is by the waterfall.', 'We do yoga in here.', 'It is calm and quiet, with stars on the ceiling.', 'You can lie in the hammock.'],
  lunch: ['Lunch time! Pizza on Fridays.', 'We all eat together at the long tables.', 'There is a salad bar and a fruit stand.', 'The lanterns light up at lunch.'],
  art: ['We paint and make pots in the art room.', 'Being messy is allowed in here.', 'The kiln gets really hot.', 'Our paintings hang on a washing line.'],
  music: ['Bang the drums! This is the music room.', 'We have a school band.', 'Everyone gets a recorder.', 'There is a double bass taller than me.'],
  maker: ['We build robots in the maker workshop.', 'The 3D printer prints little rockets.', 'The laser cutter cuts shapes out of wood.', 'A drone hangs from the ceiling.'],
  observatory: ['We look at the stars from the observatory.', 'The roof opens for the telescope.', 'The planets hang from the dome.', 'Mission control is in here.'],
  greenhouse: ['We grow our own vegetables in the greenhouse.', 'It is warm like a jungle.'],
  treehouse: ['A classroom up a tree!', 'You climb a ladder to get in.'],
  stage: ['Shows and plays happen on the stage.', 'I was a star in the Christmas play.'],
  circle: ['We sit in a circle to talk about big questions.', 'Everyone gets a turn to speak.'],
  rocket: ['Three, two, one, blast off!', 'The rocket launches at playtime.'],
  playground: ['Playtime is the best bit.', 'The slide is super fast.', 'You can go really high on the swings.'],
  slide: ['The helter-skelter goes round and round.', 'You come out at the bottom and run back up.'],
  zipline: ['Wheee! The zip line.', 'You hold on tight and fly.'],
  track: ['The running track is on the roof!', 'Sports day is up here.', 'You can see the sea while you run.'],
  terraces: ['We sit on the grass terraces for lunch outside.', 'The tree in the middle gives shade.'],
  steps: ['The big steps are for sitting and watching.'],
  garden: ['We grow flowers and carrots in the garden.', 'There are bees in the summer.'],
  tree: ['Trees for shade and for climbing.'],
  turbine: ['The wind turbine makes our electricity.'],
  weather: ['The weather station tells us if it will rain.'],
  stairs: ['Stairs up to the roof.'],
  bridge: ['A bridge from one building to the next.'],
  ramp: ['A ramp, so everyone can get up.'],
  walkway: ['A roof over the path, so you stay dry.'],
  archway: ['You go in under the archway.'],
};
const GENERAL = ['This is my favourite bit.', 'I made this bit myself.', 'A grown-up helped me with this one.'];

export function phrasesFor(type) {
  const P = PROGRAMMES[type];
  return [...(CAPTIONS[type] || [`This is the ${(P?.name || type).toLowerCase()}.`]), ...GENERAL];
}
export function captionFor(type, notes) { const p = phrasesFor(type); return p[Math.min(notes?.[type] || 0, p.length - 1)]; }

// The kinds of thing on the site, in the order they were built, one group each. (Trees and links don't get a stop.)
const QUIET = new Set(['tree', 'stairs', 'bridge', 'walkway', 'ramp', 'archway', 'turbine', 'weather']);
export function groupsOf(model, { all = false } = {}) {
  const groups = [], seen = new Map();
  for (const b of model.boxes) {
    if (!PROGRAMMES[b.type] || (!all && QUIET.has(b.type))) continue;
    let g = seen.get(b.type);
    if (!g) { g = { type: b.type, boxes: [] }; seen.set(b.type, g); groups.push(g); }
    g.boxes.push(b);
  }
  return groups;
}

// Where to look to see these boxes, and how close.
function frameOf(boxes) {
  if (!boxes.length) return [10, 7, 1];
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const b of boxes) { x0 = Math.min(x0, b.x); z0 = Math.min(z0, b.z); x1 = Math.max(x1, b.x + b.w); z1 = Math.max(z1, b.z + b.d); }
  const E = Math.max(x1 - x0, z1 - z0, 1);
  return [(x0 + x1) / 2, (z0 + z1) / 2, Math.max(0.8, Math.min(4, 10 / (E * 1.5 + 1.5)))];
}

export function startTour({ world, model, root, setInside, onExit }) {
  const groups = groupsOf(model);
  const stops = [{ kind: 'intro' }, ...groups.map(g => ({ kind: 'room', g })), ...(groups.some(g => CUTTABLE.has(g.boxes[0].shape)) ? [{ kind: 'inside' }] : []), { kind: 'end' }];
  const ui = h(`<div class="tour-ui">
    <button class="walk-exit tour-exit" type="button">${icon('close')}<span>Stop the tour</span></button>
    <div class="tour-card"><div class="tour-pic"></div><div class="tour-text"><small></small><p></p></div></div>
    <div class="tour-bar">
      <button class="tbtn" data-t="back" type="button" aria-label="Back">${icon('back')}</button>
      <button class="tbtn big" data-t="pause" type="button" aria-label="Pause">${icon('pause')}</button>
      <button class="tbtn" data-t="next" type="button" aria-label="Next">${icon('next')}</button>
    </div>
    <div class="tour-dots">${stops.map(() => '<i></i>').join('')}</div>
  </div>`);
  root.appendChild(ui);
  const pic = ui.querySelector('.tour-pic'), small = ui.querySelector('.tour-text small'), p = ui.querySelector('.tour-text p'), dots = [...ui.querySelectorAll('.tour-dots i')], pauseBtn = ui.querySelector('[data-t="pause"]');
  let i = -1, t = 0, dwell = 6, paused = false;

  const met = WISHES.filter(w => { try { return w.check(model); } catch (e) { return false; } }).length;
  const endLine = () => `That's Finn's Dream School: ${model.boxes.length} pieces, and ${met} of Finn's ${WISHES.length} wishes came true.`;

  function show(k) {
    i = (k + stops.length) % stops.length; t = 0;
    const s = stops[i];
    if (s.kind === 'intro') { setInside(false); const [cx, cz, zoom] = frameOf(model.boxes); world.frame(cx, cz, zoom); pic.innerHTML = emo('🏫'); small.textContent = 'Show and tell'; p.textContent = "Finn's Dream School. Come and have a look round!"; dwell = 5; }
    else if (s.kind === 'room') { setInside(false); const P = PROGRAMMES[s.g.type], [cx, cz, zoom] = frameOf(s.g.boxes); world.frame(cx, cz, zoom); pic.innerHTML = emo(P.emoji); small.textContent = P.name + (s.g.boxes.length > 1 ? ` × ${s.g.boxes.length}` : ''); p.textContent = captionFor(s.g.type, model.notes); dwell = 6.5; }
    else if (s.kind === 'inside') { setInside(true); const [cx, cz, zoom] = frameOf(model.boxes); world.frame(cx, cz, Math.min(zoom * 1.3, 2.2)); pic.innerHTML = icon('inside'); small.textContent = 'Inside'; p.textContent = 'Take the roofs off and peek inside.'; dwell = 8; }
    else { setInside(false); const [cx, cz, zoom] = frameOf(model.boxes); world.frame(cx, cz, zoom); pic.innerHTML = emo('⭐'); small.textContent = 'The end'; p.textContent = endLine(); dwell = 1e9; }
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
    say(p.textContent);
  }
  // Each frame: the clock towards the next stop, and a slow turn round what we are looking at.
  const fn = dt => {
    if (!paused) { t += dt; if (t >= dwell) show(i + 1); }
    const c = world.controls, cam = world.camera, off = cam.position.clone().sub(c.target);
    const a = Math.atan2(off.x, off.z) + dt * (paused ? 0 : 0.07), r = Math.hypot(off.x, off.z);
    cam.position.set(c.target.x + Math.sin(a) * r, c.target.y + off.y, c.target.z + Math.cos(a) * r);
  };
  world.updaters.add(fn);
  ui.addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    sfx.tap();
    if (b.dataset.t === 'next') show(i + 1);
    else if (b.dataset.t === 'back') show(i - 1);
    else { paused = !paused; pauseBtn.innerHTML = icon(paused ? 'play' : 'pause'); pauseBtn.setAttribute('aria-label', paused ? 'Play' : 'Pause'); if (paused) hush(); }
  });
  const onKey = e => { if (e.key === 'Escape') stop(); else if (e.key === 'ArrowRight') show(i + 1); else if (e.key === 'ArrowLeft') show(i - 1); };
  window.addEventListener('keydown', onKey);
  ui.querySelector('.tour-exit').addEventListener('click', () => { sfx.tap(); stop(); });
  function stop() {
    world.updaters.delete(fn);
    window.removeEventListener('keydown', onKey);
    hush(); ui.remove();
    onExit?.();
  }
  show(0);
  return { stop, next: () => show(i + 1), at: () => i };
}

// "Tour words": a sheet where Finn taps the line each kind of room should say. Tapping a line reads it out.
export function mountTourWords(root, model) {
  function open() {
    const groups = groupsOf(model, { all: true });
    const row = g => {
      const P = PROGRAMMES[g.type], cur = Math.min(model.notes?.[g.type] || 0, phrasesFor(g.type).length - 1);
      return `<div class="tw-row" data-type="${g.type}"><div class="tw-name">${emo(P.emoji)}<span>${esc(P.name)}</span></div><div class="tw-chips">${phrasesFor(g.type).map((ph, k) => `<button class="tw-chip ${k === cur ? 'on' : ''}" data-i="${k}" type="button">${esc(ph)}</button>`).join('')}</div></div>`;
    };
    const sheet = h(`<div class="nova-sheet"><div class="nova-card tw-card">
      <div class="nova-head">${emo('🎬', 'emo head-pic')}<div><small>Tour words</small><h2>What should each room say?</h2></div><button class="fbtn close" type="button" data-x aria-label="Done">${icon('close')}</button></div>
      <p class="share-text">${groups.length ? 'Tap a line for each room. The tour reads it out when it flies there, and the words go in the share link.' : 'Build some rooms first, then come back to choose their words.'}</p>
      <div class="tw-list">${groups.map(row).join('')}</div>
    </div></div>`);
    root.append(sheet);
    sheet.addEventListener('click', e => {
      if (e.target.closest('[data-x]') || e.target === sheet) { sfx.tap(); hush(); sheet.remove(); return; }
      const chip = e.target.closest('.tw-chip'); if (!chip) return;
      const rowEl = chip.closest('.tw-row'), type = rowEl.dataset.type, k = +chip.dataset.i;
      rowEl.querySelectorAll('.tw-chip').forEach(c => c.classList.toggle('on', c === chip));
      model.setNote(type, k); sfx.tap(); say(chip.textContent);
    });
  }
  return { open };
}
