// The first time the app opens on an empty site: three big steps, each ticked off the moment Finn does it,
// then it gets out of the way for good. (Skip is always there for a grown-up.)
import { h, say, sfx } from './ui.js';

const KEY = 'astraarch2-guided';

export function mountGuided(root, model, { site, world }) {
  let done = false; try { done = !!localStorage.getItem(KEY); } catch (e) { /* ignore */ }
  if (done || model.readOnly || model.boxes.length) return false;
  const STEPS = [
    { text: 'Tap <b>Classroom</b> on the left.', pulse: '.tray .tile[data-id="classroom"]', ok: () => !!site.S.tool },
    { text: 'Now tap a square on the grass.', pulse: null, ok: () => model.boxes.length > 0 },
    { text: 'Tap <b>Inside</b> to look in.', pulse: '.side .sbtn[data-a="inside"]', ok: () => !!site.S.inside },
  ];
  const card = h(`<div class="g1"><div><div class="g1-step"></div><p></p></div><button class="g1-skip" type="button">Skip</button></div>`);
  root.append(card);
  let i = 0, pulsed = null;
  const unpulse = () => { pulsed?.classList.remove('pulse'); pulsed = null; };
  const paint = () => {
    card.querySelector('.g1-step').textContent = `Step ${i + 1} of 3`;
    card.querySelector('p').innerHTML = STEPS[i].text;
    unpulse();
    say(card.querySelector('p').textContent);
  };
  const finish = msg => {
    world.updaters.delete(fn); unpulse();
    try { localStorage.setItem(KEY, '1'); } catch (e) { /* ignore */ }
    if (!msg) { card.remove(); return; }
    card.querySelector('.g1-step').textContent = 'You did it!'; card.querySelector('p').textContent = msg; card.querySelector('.g1-skip').remove();
    say(msg); setTimeout(() => card.remove(), 4500);
  };
  const fn = () => {
    const s = STEPS[i];
    // (The tray is drawn again now and then, so the glowing button is found afresh when it goes missing.)
    if (s.pulse && !pulsed?.isConnected) { pulsed = document.querySelector(s.pulse); pulsed?.classList.add('pulse'); }
    if (s.ok()) { i++; if (i >= STEPS.length) finish('Now build the rest of your dream school!'); else paint(); }
  };
  world.updaters.add(fn);
  card.querySelector('.g1-skip').addEventListener('click', () => { sfx.tap(); finish(null); });
  setTimeout(paint, 900);
  return true;
}
