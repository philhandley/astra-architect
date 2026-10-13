// Finn's wishes: the five things he asked for in his homework, and explorer stickers to keep going. Each is
// checked against the design as he builds; a wish that comes true brings stars, confetti and a cheer.
import { GRID, square, site } from './site.js';
import { h, emo, esc, say, sfx } from './ui.js';
import { icon } from './icons.js';

const CLASSROOMS = new Set(['classroom', 'ringhouse', 'treehouse']);
const near = (b, x, z) => Math.hypot(b.x + b.w / 2 - x, b.z + b.d / 2 - z);
// Is there sea (or beach) within two squares of one of this room's squares?
function byTheSea(model, b) {
  for (const [x, z] of model.squares(b)) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const q = square(x + dx, z + dz); if (q && (q.zone === 'water' || q.zone === 'beach')) return true; }
  return false;
}
const BUILDINGS = new Set(['classroom', 'hall', 'library', 'lunch', 'art', 'music', 'maker', 'yoga', 'ringhouse', 'aquarium', 'observatory', 'pool']);

// Finn's own five wishes, from his homework.
export const WISHES = [
  { id: 'chill', emoji: '🧘', name: 'A chill-out room by the waterfall', check: m => m.boxes.some(b => b.type === 'yoga' && near(b, site().waterfall[0], site().waterfall[1]) < 3.6) },
  { id: 'sea', emoji: '🌊', name: 'Classrooms that look at the sea', check: m => m.boxes.some(b => CLASSROOMS.has(b.type) && byTheSea(m, b)) },
  { id: 'pool', emoji: '🏊', name: 'A swimming pool', check: m => m.boxes.some(b => b.type === 'pool') },
  { id: 'aquarium', emoji: '🐠', name: 'An aquarium to walk through', check: m => m.boxes.some(b => b.type === 'aquarium') },
  { id: 'track', emoji: '🏃', name: 'A running track on a roof', check: m => m.boxes.some(b => b.type === 'track' && b.level > 0) },
];
// Explorer stickers.
export const STICKERS = [
  { id: 'lunch', emoji: '🍎', name: 'Somewhere to eat lunch', check: m => m.boxes.some(b => b.type === 'lunch') },
  { id: 'play', emoji: '🛝', name: 'Somewhere to play', check: m => m.boxes.some(b => ['playground', 'slide', 'zipline'].includes(b.type)) },
  { id: 'trees', emoji: '🌳', name: 'Plant five trees', check: m => m.boxes.filter(b => b.type === 'tree').reduce((n, b) => n + b.w * b.d, 0) >= 5 },
  { id: 'up', emoji: '🪜', name: 'Stairs up to a roof', check: m => m.boxes.some(b => b.type === 'stairs' || b.type === 'ramp') },
  { id: 'bridge', emoji: '🌉', name: 'A bridge between buildings', check: m => m.boxes.some(b => b.type === 'bridge' || b.type === 'walkway') },
  { id: 'stars', emoji: '🔭', name: 'Somewhere to see the stars', check: m => m.boxes.some(b => b.type === 'observatory') },
  { id: 'tall', emoji: '🏢', name: 'A building three storeys high', check: m => m.boxes.some(b => BUILDINGS.has(b.type) && b.level + b.h >= 3) },
  { id: 'rainbow', emoji: '🌈', name: 'Five different colours', check: m => new Set(m.boxes.filter(b => BUILDINGS.has(b.type)).map(b => b.colour)).size >= 5 },
  { id: 'day', emoji: '🔔', name: 'Watch a whole school day', check: () => false },
];
const ALL = [...WISHES, ...STICKERS];
const KEY = 'astraarch2-wishes';

export function mountWishes(root, model, { button, celebrate }) {
  let done = new Set();
  const load = () => { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s ? new Set(s) : null; } catch (e) { return null; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...done])); } catch (e) { /* storage blocked */ } };
  const now = () => new Set(ALL.filter(w => { try { return w.check(model); } catch (e) { return false; } }).map(w => w.id));

  // The button in the top bar shows how many wishes have come true.
  const paintButton = () => { button.innerHTML = `${emo('⭐')}<span>Wishes ${WISHES.filter(w => done.has(w.id)).length}/${WISHES.length}</span>`; };

  // The wishes card: big pictures, short words; tap one to hear it.
  const sheet = h(`<div class="wish-sheet" hidden><div class="wish-card">
    <div class="wish-head"><h2>${emo('⭐')} Finn's wishes</h2><button class="fbtn close" type="button">${icon('close')}<span>Close</span></button></div>
    <div class="wish-list wishes"></div>
    <h3>${emo('🧭')} Explorer stickers</h3>
    <div class="wish-list stickers"></div>
    <h3>${emo('⭐')} Changed-Mind stars</h3>
    <p class="cm-stars"></p>
  </div></div>`);
  root.append(sheet);
  const card = w => `<button class="wish ${done.has(w.id) ? 'done' : ''}" type="button" data-w="${w.id}">${emo(w.emoji, 'emo big')}<span>${esc(w.name)}</span><i>${done.has(w.id) ? emo('⭐') : ''}</i></button>`;
  let stars = (() => { try { return +localStorage.getItem(KEY + '-stars') || 0; } catch (e) { return 0; } })();
  const paintSheet = () => {
    sheet.querySelector('.wishes').innerHTML = WISHES.map(card).join(''); sheet.querySelector('.stickers').innerHTML = STICKERS.map(card).join('');
    sheet.querySelector('.cm-stars').innerHTML = stars ? emo('⭐').repeat(Math.min(stars, 20)) + `<span>${stars} for changing your mind after a Big Question</span>` : '<span>Tap the Conundrum circle and its Big Question button, talk about it together, and earn a star if you change your mind.</span>';
  };
  sheet.addEventListener('click', e => {
    if (e.target === sheet || e.target.closest('.close')) { sfx.tap(); sheet.hidden = true; return; }
    const id = e.target.closest('[data-w]')?.dataset.w; if (!id) return;
    const w = ALL.find(x => x.id === id); sfx.tap();
    say(done.has(id) ? `${w.name}. Done! Well done!` : `${w.name}. Not yet. Can you build it?`);
  });
  button.addEventListener('click', () => { sfx.tap(); paintSheet(); sheet.hidden = false; say(`Finn's wishes. ${WISHES.filter(w => done.has(w.id)).length} of ${WISHES.length} have come true.`); });

  // A wish comes true: a big star card, confetti and a cheer.
  const pop = h(`<div class="wish-pop" hidden></div>`); root.append(pop);
  let popTimer = 0;
  function hooray(list) {
    const wishes = list.filter(w => WISHES.includes(w));
    pop.innerHTML = `<div class="stars">${emo('⭐')}${emo('⭐')}${emo('⭐')}</div><b>${wishes.length ? (list.length > 1 ? `${list.length} wishes come true!` : 'A wish come true!') : (list.length > 1 ? 'New stickers!' : 'New sticker!')}</b>${list.map(w => `<div class="row">${emo(w.emoji, 'emo big')}<span>${esc(w.name)}</span></div>`).join('')}`;
    pop.hidden = false; pop.classList.remove('in'); void pop.offsetWidth; pop.classList.add('in');
    celebrate?.();
    say(`${wishes.length ? 'Hooray! A wish has come true!' : 'You got a sticker!'} ${list.map(w => w.name).join('. ')}.`);
    clearTimeout(popTimer); popTimer = setTimeout(() => { pop.hidden = true; }, 4200);
  }
  pop.addEventListener('click', () => { pop.hidden = true; });

  function update() {
    const n = now(), fresh = ALL.filter(w => n.has(w.id) && !done.has(w.id));
    done = new Set([...done, ...n]);       // a wish once granted stays granted
    save(); paintButton();
    if (!sheet.hidden) paintSheet();
    if (fresh.length) hooray(fresh);
  }
  // On first opening, what is already built counts without a fuss.
  done = load() || now(); save(); paintButton();
  model.onChange(w => { if (!w.style) setTimeout(update, 450); });
  return {
    update, open: () => button.click(),
    isDone: id => done.has(id),
    // Something done that the design itself can't show (like watching a whole school day).
    award(id) { if (done.has(id)) return; done.add(id); save(); paintButton(); const w = ALL.find(x => x.id === id); if (w) hooray([w]); },
    addStar() { stars++; try { localStorage.setItem(KEY + '-stars', stars); } catch (e) { /* ignore */ } },
  };
}
