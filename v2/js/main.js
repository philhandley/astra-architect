// Astra Architect 2: Finn's site model and his programme boxes. Two areas: Rooms (choose shapes and colours)
// and Site (build on the grid).
import { World } from './world.js';
import { loadSite, buildSite } from './site.js';
import { Model } from './model.js';
import { mountSite } from './sitescreen.js';
import { mountRooms, trayThumbs } from './rooms.js';
import { h, emo, say, hush, sfx, toast, speechOn, setSpeech, soundOn, setSound } from './ui.js';
import { icon, MARK } from './icons.js';
import { mountWishes } from './wishes.js';

// Finn's wooden-block model from the photos: green classrooms along the beach, orange bars round the meadow,
// a blue pool in the middle, a ring of green curves and an orange drum by the waterfall.
// Finn's wooden-block model, as it stands on the table: an arc of orange bars round the top-left of the meadow
// (some stacked on red bars), a curve of green curved blocks inside it, the blue pool in the middle, an arc of
// green classroom cubes along the beach, and the orange drum right by the waterfall.
const FINNS_MODEL = [
  { type: 'hall', shape: 'box', colour: 'orange', x: 2, z: 6, w: 2, d: 1, level: 0, h: 1 },
  { type: 'music', shape: 'box', colour: 'orange', x: 4, z: 6, w: 2, d: 1, level: 0, h: 1 },
  { type: 'art', shape: 'box', colour: 'orange', x: 1, z: 6, w: 1, d: 2, level: 0, h: 1 },
  { type: 'lunch', shape: 'box', colour: 'red', x: 1, z: 8, w: 1, d: 2, level: 0, h: 1 },
  { type: 'library', shape: 'box', colour: 'orange', x: 1, z: 8, w: 1, d: 2, level: 1, h: 1 },
  { type: 'lunch', shape: 'box', colour: 'red', x: 1, z: 10, w: 2, d: 1, level: 0, h: 1 },
  { type: 'maker', shape: 'box', colour: 'orange', x: 1, z: 10, w: 2, d: 1, level: 1, h: 1 },
  { type: 'aquarium', shape: 'arc', colour: 'forest', x: 2, z: 7, w: 3, d: 3, level: 0, h: 1, rot: 2 },
  { type: 'pool', shape: 'pool', colour: 'blue', x: 5, z: 8, w: 3, d: 1, level: 0, h: 1 },
  { type: 'classroom', shape: 'box', colour: 'forest', x: 3, z: 12, w: 1, d: 1, level: 0, h: 1 },
  { type: 'classroom', shape: 'box', colour: 'forest', x: 4, z: 11, w: 1, d: 1, level: 0, h: 1 },
  { type: 'classroom', shape: 'box', colour: 'lime', x: 5, z: 11, w: 1, d: 1, level: 0, h: 1 },
  { type: 'classroom', shape: 'box', colour: 'lime', x: 6, z: 11, w: 1, d: 1, level: 0, h: 1 },
  { type: 'classroom', shape: 'box', colour: 'lime', x: 7, z: 10, w: 1, d: 1, level: 0, h: 1 },
  { type: 'classroom', shape: 'box', colour: 'lime', x: 8, z: 10, w: 1, d: 1, level: 0, h: 1 },
  { type: 'yoga', shape: 'drum', colour: 'orange', x: 11, z: 6, w: 1, d: 1, level: 0, h: 1 },
];

async function boot() {
  const app = document.getElementById('app');
  const shell = h(`<div class="shell">
    <header class="top">
      <div class="brand">${MARK}<div><small>Astra Architect</small><b>Finn's Dream School</b></div></div>
      <nav class="tabs"><button data-go="rooms" type="button">${icon('rooms')} Rooms</button><button data-go="site" type="button">${icon('site')} Site</button></nav>
      <div class="acts">
        <button class="ab wishbtn" data-a="wishes" type="button"></button>
        <button class="ab" data-a="photo" type="button">${icon('camera')} Photo</button>
        <button class="ab" data-a="finn" type="button">${icon('blocks')} Finn's model</button>
        <button class="ab" data-a="clear" type="button">${icon('leaf')} Empty site</button>
        <button class="ab round" data-a="speech" type="button" aria-label="Read aloud">${icon('speaker')}</button>
        <button class="ab round" data-a="sound" type="button" aria-label="Sounds">${icon('music')}</button>
      </div>
    </header>
    <main class="stage"><div class="world"></div><div class="overlay"></div><div class="rooms-host" hidden></div></main>
  </div>`);
  app.appendChild(shell);
  const worldHost = shell.querySelector('.world'), overlay = shell.querySelector('.overlay'), roomsHost = shell.querySelector('.rooms-host');

  await loadSite();
  const world = new World(worldHost);
  const siteView = buildSite(world);
  const model = new Model();
  const thumbs = trayThumbs(model);
  const site = mountSite(overlay, world, model, siteView, thumbs);
  const rooms = mountRooms(roomsHost, model, { thumbs, onBuild: id => { location.hash = '#site'; setTimeout(() => site.setTool(id), 50); } });
  model.onChange(w => { if (w.style) site.refreshTray(); });
  mountWishes(shell.querySelector('.stage'), model, { button: shell.querySelector('.wishbtn'), celebrate: () => { if (location.hash !== '#rooms') site.celebrate(); } });

  function route() {
    const r = location.hash === '#rooms' ? 'rooms' : 'site';
    hush();
    shell.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.go === r));
    roomsHost.hidden = r !== 'rooms';
    overlay.hidden = r !== 'site';
    rooms.show(r === 'rooms');
    if (r === 'site') { world.start(); site.refreshTray(); } else world.stop();
  }
  shell.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) { sfx.tap(); location.hash = '#' + b.dataset.go; } });
  window.addEventListener('hashchange', route);

  const acts = shell.querySelector('.acts');
  const sp = acts.querySelector('[data-a="speech"]'), so = acts.querySelector('[data-a="sound"]');
  const paint = () => { sp.classList.toggle('off', !speechOn); so.classList.toggle('off', !soundOn); };
  acts.addEventListener('click', e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'speech') { setSpeech(!speechOn); paint(); toast(speechOn ? 'Read-aloud on' : 'Read-aloud off'); }
    if (a === 'sound') { setSound(!soundOn); paint(); sfx.tap(); }
    if (a === 'photo') { if (location.hash === '#rooms') { location.hash = '#site'; setTimeout(() => site.photo(), 400); } else site.photo(); }
    if (a === 'finn') {
      if (model.boxes.length && !confirm('Put Finn\'s wooden-block model on the site? (Undo brings back what is there now.)')) return;
      model.snapshot(); model.boxes = FINNS_MODEL.map((b, i) => ({ ...b, id: i + 1 })); model.nextId = FINNS_MODEL.length + 1; model.changed({ loaded: true });
      location.hash = '#site'; site.select(null); site.frameSite(); sfx.whoosh(); say('Here is your model from the table, on the site. Tap a block to change it.');
    }
    if (a === 'clear') { if (!model.boxes.length || confirm('Start with an empty site? (Undo brings it back.)')) { model.clear(); site.select(null); sfx.whoosh(); } }
  });
  paint();
  route();
  if (!model.boxes.length) setTimeout(() => say('Welcome to your site! Choose a room on the left, then tap the grid to build it.'), 800);
  window.__v2 = { world, model, site, rooms, siteView };   // testing aid
  if ('serviceWorker' in navigator && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => {});
}
boot();
