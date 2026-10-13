// Big Questions (the Astra Nova way, kept simple for six): picture choices about the school with no right
// answer. Finn chooses, talks it over with the grown-up, hears why people choose each, and earns a
// Changed-Mind star if he changes his mind. And after a whole school day: what was your favourite part?
import { h, emo, esc, say, sfx } from './ui.js';
import { icon } from './icons.js';

// Big Questions: picture choices about the school, with no right answer.
export const BIG_QUESTIONS = [
  { q: 'The children want a bigger playground, but the trees would have to go. What should we do?', pic: '🌳',
    options: [['🌳', 'Keep the trees', 'Trees give shade, homes for birds and clean air.'], ['🛝', 'Bigger playground', 'More room to run, climb and play together.'], ['🏡', 'Play in the trees', 'A treehouse or a trail through the trees: both!']] },
  { q: 'Where should the lunch hall go?', pic: '🍎',
    options: [['🏫', 'Next to the classrooms', 'A short walk, so nobody waits long for lunch.'], ['🌻', 'By the garden', 'Eat food you grew, and sit outside on sunny days.'], ['🌊', 'By the sea', 'A lovely view while you eat.']] },
  { q: 'One big room for everyone, or lots of little rooms?', pic: '🏫',
    options: [['🏟️', 'One big room', 'Everyone together: easy to share and help each other.'], ['🏘️', 'Lots of little rooms', 'Quieter, and each class has its own cosy place.'], ['🔀', 'Some of each', 'Big rooms for sharing, little rooms for quiet.']] },
  { q: 'Should the swimming pool be inside or outside?', pic: '🏊',
    options: [['🏠', 'Inside', 'You can swim when it rains or is cold.'], ['☀️', 'Outside', 'Swim in the sunshine and fresh air.'], ['🔄', 'A roof that opens', 'Open on sunny days, closed on rainy ones.']] },
  { q: 'Should the music room be near the library?', pic: '🎵',
    options: [['📚', 'Far from the library', 'Readers need quiet, and drums are loud!'], ['🤝', 'Close together', 'Stories and songs can go together.'], ['🧱', 'Close, with thick walls', 'Near each other, but the noise stays in.']] },
];

export function mountGuide(root, model, { site, wishes }) {
  // ---------- a card in the middle of the screen (Big Questions, the day's chat) ----------
  const sheet = h(`<div class="nova-sheet" hidden><div class="nova-card"></div></div>`);
  root.append(sheet);
  const card = sheet.querySelector('.nova-card');
  const close = () => { sheet.hidden = true; };
  sheet.addEventListener('click', e => { if (e.target === sheet) close(); });

  let bqIndex = (() => { try { return +localStorage.getItem('astraarch2-bq') || 0; } catch (e) { return 0; } })();
  function bigQuestion() {
    const Q = BIG_QUESTIONS[bqIndex % BIG_QUESTIONS.length];
    bqIndex++; try { localStorage.setItem('astraarch2-bq', bqIndex); } catch (e) { /* ignore */ }
    let first = null;
    const head = `<div class="nova-head">${emo('💬', 'emo head-pic')}<div><small>Big Question</small><h2>${esc(Q.q)}</h2></div><button class="fbtn close" type="button">${icon('close')}</button></div>`;
    const opts = (cls = '') => `<div class="bq-opts ${cls}">${Q.options.map(([e, t], i) => `<button class="bq-opt ${first === i ? 'on' : ''}" type="button" data-i="${i}">${emo(e, 'emo big')}<span>${esc(t)}</span></button>`).join('')}</div>`;
    const step1 = () => {
      card.innerHTML = `${head}<p class="bq-step">What do you think, Finn? Tap one.</p>${opts()}`;
      say(`${Q.q} What do you think? ${Q.options.map(o => o[1]).join('. Or. ')}.`);
    };
    const step2 = () => {
      card.innerHTML = `${head}<p class="bq-step">${emo('🗣️')} Now ask your grown-up what they think, and why. Talk about it together!</p>${opts('picked')}<div class="bq-next"><button class="fbtn ok next" type="button">${icon('done')}<span>We talked</span></button></div>`;
      say('Now ask your grown-up what they think, and why. Talk about it together!');
    };
    const step3 = () => {
      card.innerHTML = `${head}<p class="bq-step">${emo('✨')} There is no right answer! People choose differently, and that's OK.</p>
        <div class="bq-why">${Q.options.map(([e, t, why]) => `<div class="bq-row">${emo(e, 'emo big')}<div><b>${esc(t)}</b><span>${esc(why)}</span></div></div>`).join('')}</div>
        <p class="bq-step">Did you change your mind?</p>
        <div class="bq-next"><button class="fbtn yes" type="button">${emo('⭐')}<span>Yes, I changed my mind</span></button><button class="fbtn ok no" type="button">${emo('👍')}<span>No, I still think the same</span></button></div>`;
      say(`There is no right answer! ${Q.options.map(o => `${o[1]}: ${o[2]}`).join(' ')} Did you change your mind?`);
    };
    card.onclick = e => {
      if (e.target.closest('.close')) { sfx.tap(); close(); return; }
      const o = e.target.closest('.bq-opt');
      if (o && first === null) { first = +o.dataset.i; sfx.tap(); say(`${Q.options[first][1]}. Good thinking!`); setTimeout(step2, 1400); return; }
      if (e.target.closest('.next')) { sfx.tap(); step3(); return; }
      if (e.target.closest('.yes')) { wishes.addStar(); sfx.cheer(); site.celebrate(); say('A Changed-Mind star! Changing your mind when you hear a good idea is very clever.'); close(); return; }
      if (e.target.closest('.no')) { sfx.tap(); say('Sticking with your idea is fine too. Good thinking!'); close(); }
    };
    step1(); sheet.hidden = false;
  }

  // ---------- after a school day ----------
  function debrief(periods, facts = { lines: [], ask: null }) {
    const asks = ['Where did the children walk the most? Can you see their paths in the grass?', 'Was anywhere too crowded? What could you change?', 'Which room do you think the children liked best?'];
    const ask = facts?.ask || asks[Math.floor(Math.random() * asks.length)], seen = facts?.lines?.length ? facts.lines.join(' ') : '';
    card.innerHTML = `<div class="nova-head">${emo('🔔', 'emo head-pic')}<div><small>School day done!</small><h2>What was your favourite part of the day?</h2></div><button class="fbtn close" type="button">${icon('close')}</button></div>
      <div class="bq-opts day">${periods.map((p, i) => `<button class="bq-opt" type="button" data-p="${i}">${emo(p.emoji, 'emo big')}<span>${esc(p.name)}</span></button>`).join('')}</div>
      ${seen ? `<p class="bq-step seen">${emo('👀')} ${esc(seen)}</p>` : ''}
      <p class="bq-step ask">${emo('🗣️')} ${esc(ask)}</p>
      <div class="bq-next"><button class="fbtn ok next" type="button">${icon('done')}<span>Done</span></button></div>`;
    card.onclick = e => {
      if (e.target.closest('.close') || e.target.closest('.next')) { sfx.tap(); close(); wishes.award('day'); return; }
      const o = e.target.closest('[data-p]');
      if (o) { card.querySelectorAll('.bq-opt').forEach(b => b.classList.toggle('on', b === o)); sfx.tap(); say(`${periods[+o.dataset.p].name}! Great choice. Tell your grown-up why. ${ask}`); }
    };
    sheet.hidden = false;
    say('School day done! What was your favourite part of the day?');
  }
  return { bigQuestion, debrief };
}
