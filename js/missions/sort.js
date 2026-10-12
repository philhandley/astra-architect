// Mission 2: sort the room cards into hoops (noisy or quiet, wet or dry). Tap a card, then tap a hoop.
import { ROOMS } from '../core/catalogue.js';
import { emo } from '../core/emoji.js';
import { h, esc, say, sayAuto, sfx, speakButton } from '../ui/dom.js';

const SETS = {
  noise: {
    title: 'Noisy or quiet?',
    hoops: [{ id: 'noisy', label: 'Noisy', emoji: '🔊' }, { id: 'quiet', label: 'Quiet', emoji: '🤫' }],
    rooms: ['hall', 'library', 'pool', 'yoga', 'music', 'classroom', 'lunch', 'aquarium'],
    expect: r => (ROOMS[r].noisy ? 'noisy' : 'quiet'),
    why: { hall: 'Games and PE are loud!', library: 'Shh, people are reading.', pool: 'Splashing is noisy.', yoga: 'Yoga is calm and quiet.', music: 'Drums and singing are the loudest of all.', classroom: 'Pupils need to hear the teacher.', lunch: 'Lots of chatting at lunch!', aquarium: 'Fish like it quiet.' },
    end: 'Architects keep the quiet rooms away from the noisy ones, so nobody gets disturbed.',
  },
  wet: {
    title: 'Wet or dry?',
    hoops: [{ id: 'wet', label: 'Wet', emoji: '💧' }, { id: 'dry', label: 'Dry', emoji: '☀️' }],
    rooms: ['pool', 'library', 'changing', 'classroom', 'toilets', 'art', 'aquarium', 'hall'],
    expect: r => (ROOMS[r].wet ? 'wet' : 'dry'),
    why: { pool: 'A pool is full of water!', library: 'Books must stay dry.', changing: 'Wet swimming costumes come off here.', classroom: 'Paper and pencils like it dry.', toilets: 'Taps and water.', art: 'Paint can be wet, but the room stays dry.', aquarium: 'Full of water for the fish.', hall: 'You do not want a slippery hall floor!' },
    end: 'Architects put the wet rooms together, so the pipes are short and wet feet do not walk far.',
  },
};

export async function mount(host, ctx) {
  const order = (ctx.data.sets || ['noise', 'wet']).filter(s => SETS[s]);
  let si = 0;
  let picked = null;
  const placed = {};
  const root = h(`<div class="sortgame"></div>`);
  host.appendChild(root);

  function draw() {
    const set = SETS[order[si]];
    root.innerHTML = '';
    const head = h(`<div class="headrow"><div><div class="eyebrow">Sort the rooms</div><h2>${esc(set.title)}</h2></div><div class="sayline"><span class="sp"></span><span>${picked ? 'Now tap a hoop!' : 'Tap a room, then tap a hoop.'}</span></div></div>`);
    head.querySelector('.sp').replaceWith(speakButton(() => (picked ? 'Now tap a hoop.' : `${set.title} Tap a room, then tap a hoop.`)));
    const cards = h(`<div class="rcards"></div>`);
    const left = set.rooms.filter(r => !placed[r]);
    for (const r of left) {
      const R = ROOMS[r];
      const b = h(`<button class="rcard ${picked === r ? 'on' : ''}" type="button" style="--rc:${R.colour}">${emo(R.emoji)}<span>${esc(R.name)}</span></button>`);
      b.addEventListener('click', () => { picked = r; sfx.tap(); say(R.name); draw(); });
      cards.append(b);
    }
    if (!left.length) cards.append(h(`<div class="muted" style="font-size:22px;align-self:center">All sorted!</div>`));
    const hoops = h(`<div class="hoops"></div>`);
    for (const hp of set.hoops) {
      const el = h(`<div class="hoop ${picked ? 'ready' : ''}" role="button" tabindex="0"><h3>${emo(hp.emoji)} ${esc(hp.label)}</h3><div class="in"></div></div>`);
      const inside = el.querySelector('.in');
      for (const r of set.rooms.filter(x => placed[x] === hp.id)) inside.append(h(`<div class="rcard small" style="--rc:${ROOMS[r].colour}">${emo(ROOMS[r].emoji)}<span>${esc(ROOMS[r].name)}</span></div>`));
      el.addEventListener('click', () => drop(hp.id));
      hoops.append(el);
    }
    root.append(head, cards, hoops);
    // A hand shows the move until Finn has sorted his first card.
    if (!Object.keys(placed).length && !si) root.append(h(`<div class="hand-hint ${picked ? 'two' : ''}">${emo('👆')}</div>`));
  }

  function drop(hoop) {
    if (!picked) { say('Tap a room card first.'); return; }
    const set = SETS[order[si]];
    const r = picked;
    placed[r] = hoop;
    picked = null;
    const exp = set.expect(r);
    if (exp === hoop) { sfx.chime(); sayAuto(`${ROOMS[r].name}: ${hoop}. ${set.why[r] || ''}`); }
    else { sfx.pop(); sayAuto(`Hmm, most architects would say the ${ROOMS[r].name.toLowerCase()} is ${exp}. ${set.why[r] || ''} But you are the Architect!`); }
    ctx.log && ctx.log(`Sorted ${ROOMS[r].name} as ${hoop}.`);
    if (set.rooms.every(x => placed[x])) {
      setTimeout(() => {
        sayAuto(set.end);
        if (si < order.length - 1) {
          const next = h(`<button class="btn big go" type="button" style="align-self:center">Next: ${esc(SETS[order[si + 1]].title)}</button>`);
          next.addEventListener('click', () => { si++; draw(); sayAuto(SETS[order[si]].title); });
          root.append(next);
        } else {
          root.append(h(`<div class="card" style="align-self:center;font-size:22px;max-width:760px;text-align:center">${emo('🎉')} ${esc(set.end)}</div>`));
          ctx.complete && ctx.complete();
        }
      }, 900);
    }
    draw();
  }

  draw();
  sayAuto(`${SETS[order[0]].title} Tap a room, then tap a hoop.`);
  return { destroy() { root.remove(); } };
}
