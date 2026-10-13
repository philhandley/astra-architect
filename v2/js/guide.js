// Nova, the builder robot: a friendly guide who looks at the school and suggests one thing to try next
// (a wish still to come true, rooms upstairs with no stairs, somewhere for everyone to get in), asks the odd
// Big Question (no right answer: talk it over together, and earn a Changed-Mind star if you change your mind),
// and after a school day asks what Finn liked best. Nova never chatters: tap Nova to hear what Nova says.
import { PROGRAMMES } from './catalogue.js';
import { h, emo, esc, say, sfx } from './ui.js';
import { icon } from './icons.js';
import { WISHES } from './wishes.js';

const BUILDINGS = new Set(['classroom', 'hall', 'library', 'lunch', 'art', 'music', 'maker', 'yoga', 'ringhouse', 'aquarium', 'observatory', 'greenhouse', 'treehouse']);
const NOVA = `<svg class="nova-svg" viewBox="0 0 80 80" aria-hidden="true">
  <line x1="40" y1="12" x2="40" y2="4" stroke="#2e4a8c" stroke-width="3" stroke-linecap="round"/><circle class="nova-light" cx="40" cy="5" r="4" fill="#f7c22e"/>
  <rect x="10" y="12" width="60" height="50" rx="22" fill="#ffffff" stroke="#2e4a8c" stroke-width="3"/>
  <rect x="18" y="22" width="44" height="26" rx="13" fill="#2e4a8c"/>
  <g class="nova-eyes"><ellipse cx="31" cy="35" rx="5" ry="6" fill="#7fe0f0"/><ellipse cx="49" cy="35" rx="5" ry="6" fill="#7fe0f0"/></g>
  <path d="M32 54 Q40 59 48 54" stroke="#e2457d" stroke-width="3" fill="none" stroke-linecap="round"/>
  <rect x="2" y="30" width="8" height="16" rx="4" fill="#22b2bf"/><rect x="70" y="30" width="8" height="16" rx="4" fill="#22b2bf"/>
  <rect x="24" y="64" width="32" height="12" rx="6" fill="#f28b30"/>
</svg>`;

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
  const el = h(`<div class="nova" role="button" aria-label="Nova, your builder robot" tabindex="0">${NOVA}<i class="nova-dot" hidden></i></div>`);
  const bubble = h(`<div class="nova-bubble" hidden><p></p><div class="nova-acts"></div></div>`);
  root.append(el, bubble);
  let tip = null, lastShown = '', autoTimer = 0;

  // ---------- what Nova notices ----------
  const has = t => model.boxes.some(b => b.type === t);
  function upstairsWithoutStairs() {
    const ups = model.boxes.filter(b => b.level > 0 && BUILDINGS.has(b.type));
    const stairs = model.boxes.filter(s => (s.type === 'stairs' || s.type === 'ramp') && s.level === 0);
    return ups.find(b => !stairs.some(s => s.h + s.level >= b.level && model.squares(s).some(([x, z]) => model.squares(b).some(([qx, qz]) => Math.abs(qx - x) + Math.abs(qz - z) <= 1))));
  }
  const WISH_TIPS = {
    chill: { text: 'Finn wished for a chill-out room by the waterfall. Can you build one there?', tool: 'yoga' },
    sea: { text: 'Can some classrooms look out at the sea? Build them near the beach.', tool: 'classroom' },
    pool: { text: 'Finn wished for a swimming pool. Where will it go?', tool: 'pool' },
    aquarium: { text: 'How about an aquarium to walk through, full of fish?', tool: 'aquarium' },
    track: { text: 'A running track on a roof! Build a big flat roof first, then put the track on top.', tool: 'track' },
  };
  function think() {
    const n = model.boxes.filter(b => BUILDINGS.has(b.type)).length;
    if (!model.boxes.length) return { id: 'start', text: "Let's build a school! Start with a classroom for 30 children.", tool: 'classroom' };
    if (!has('classroom') && !has('ringhouse')) return { id: 'class', text: 'The children need somewhere to learn. Can you build a classroom?', tool: 'classroom' };
    const up = upstairsWithoutStairs();
    if (up) return { id: 'stairs-' + up.id, text: `The ${PROGRAMMES[up.type].name.toLowerCase()} upstairs has no stairs! How will the children get up there?`, tool: 'stairs' };
    const wish = WISHES.find(w => !wishes.isDone(w.id));
    if (wish) return { id: 'wish-' + wish.id, ...WISH_TIPS[wish.id] };
    if (model.boxes.some(b => b.level > 0 && BUILDINGS.has(b.type)) && !has('ramp')) return { id: 'ramp', text: 'Can everyone get upstairs? Some children use wheelchairs. A ramp would help!', tool: 'ramp' };
    if (!has('lunch')) return { id: 'lunch', text: 'Where will the children eat their lunch?', tool: 'lunch' };
    if (!['playground', 'slide', 'zipline'].some(has)) return { id: 'play', text: 'Where will the children play at playtime?', tool: 'playground' };
    if (n >= 3 && !wishes.isDone('day')) return { id: 'day', text: 'Your school is ready! Shall we watch a school day?', day: true };
    return { id: 'bq', text: 'Your school looks amazing! I have a Big Question for you. Shall we think about it together?', bq: true };
  }

  // ---------- Nova's speech bubble ----------
  function show(t, { speak = false } = {}) {
    tip = t;
    bubble.querySelector('p').textContent = t.text;
    const acts = bubble.querySelector('.nova-acts'); acts.innerHTML = '';
    const btn = (label, ic, fn, cls = '') => { const b = h(`<button class="fbtn ${cls}" type="button">${ic}<span>${esc(label)}</span></button>`); b.addEventListener('click', e => { e.stopPropagation(); sfx.tap(); fn(); }); acts.append(b); };
    if (t.tool) btn('Show me', emo(PROGRAMMES[t.tool].emoji), () => { hide(); site.setTool(t.tool); }, 'ok');
    if (t.day) btn('School day', icon('bell'), () => { hide(); site.startDay(); }, 'ok');
    if (t.bq) btn('Big Question', emo('💬'), () => { hide(); bigQuestion(); }, 'ok');
    btn('Not now', icon('close'), hide);
    bubble.hidden = false; el.querySelector('.nova-dot').hidden = true;
    el.classList.remove('hop'); void el.offsetWidth; el.classList.add('hop');
    if (speak) say(t.text);
  }
  function hide() { bubble.hidden = true; clearTimeout(autoTimer); }
  el.addEventListener('click', () => { sfx.tap(); if (!bubble.hidden && tip) { say(tip.text); return; } show(think(), { speak: true }); });
  // When there is something new to say, Nova hops and shows it quietly (tap Nova to hear it).
  function notice() {
    const t = think();
    if (t.id === lastShown || site.S?.day || site.S?.walking || site.S?.siteEdit) return;
    lastShown = t.id;
    el.querySelector('.nova-dot').hidden = false;
    el.classList.remove('hop'); void el.offsetWidth; el.classList.add('hop');
  }
  let noticeTimer = 0;
  model.onChange(w => { if (w.style) return; clearTimeout(noticeTimer); noticeTimer = setTimeout(notice, 3500); });
  setTimeout(notice, 2500);

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
    const head = `<div class="nova-head">${NOVA}<div><small>${emo('💬')} Big Question</small><h2>${esc(Q.q)}</h2></div><button class="fbtn close" type="button">${icon('close')}</button></div>`;
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
  function debrief(periods) {
    const asks = ['Where did the children walk the most? Can you see their paths in the grass?', 'Was anywhere too crowded? What could you change?', 'Which room do you think the children liked best?'];
    const ask = asks[Math.floor(Math.random() * asks.length)];
    card.innerHTML = `<div class="nova-head">${NOVA}<div><small>${emo('🔔')} School day done!</small><h2>What was your favourite part of the day?</h2></div><button class="fbtn close" type="button">${icon('close')}</button></div>
      <div class="bq-opts day">${periods.map((p, i) => `<button class="bq-opt" type="button" data-p="${i}">${emo(p.emoji, 'emo big')}<span>${esc(p.name)}</span></button>`).join('')}</div>
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
  return { bigQuestion, debrief, show: () => el.click() };
}
