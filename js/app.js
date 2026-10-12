// Astra Architect: router, home, crew setup, mission runner and the free Studio.
import { sentences, canSpeak } from './core/speak.js';
import { formIcon } from './ui/formicons.js';
import { store } from './core/store.js';
import { patchSVG } from './core/patch.js';
import { icon } from './core/icons.js';
import { emo, emoRow, splitEmoji } from './core/emoji.js';
import { loadSite } from './core/site.js';
import { indexDesign } from './core/design.js';
import { checkBrief, HINTS } from './core/brief.js';
import { WISHES } from './core/catalogue.js';
import { h, esc, say, hush, speakButton, toast, modal, sfx, clamp } from './ui/dom.js';

const app = document.getElementById('app');
const ACCENT = { orange: '#f28c28', teal: '#12857e', green: '#22a565', plum: '#7b5ea7', blue: '#2f6fe4', red: '#e5483d', yellow: '#e0a800' };
const STEP_LABEL = { story: 'Look', guess: 'Guess', play: 'Build', question: 'Big Question', video: 'Watch', athome: 'Try it at home', finish: 'Mission complete' };
const FRAMED = (() => { try { return window.top !== window.self; } catch (e) { return true; } })();

let missionIds = [];
const missions = {};
let runner = null;
let stepCleanup = [];
let stepToken = 0;
let studioInst = null;
let wakeLock = null;

const crew = () => store.state.crew || { commander: 'Finn', engineer: 'Grown-up' };

/* ---------------- Data ---------------- */
async function loadMission(id) {
  if (!missions[id]) {
    const r = await fetch(`content/${id}.json`);
    if (!r.ok) throw new Error(`Mission ${id} not found`);
    missions[id] = await r.json();
  }
  return missions[id];
}
async function loadAll() {
  try { missionIds = await (await fetch('content/missions.json')).json(); } catch (e) { missionIds = []; }
  await Promise.all(missionIds.map(id => loadMission(id).catch(err => console.warn(err.message))));
  missionIds = missionIds.filter(id => missions[id]);
}

function autoSay(text, btn) {
  if (!store.state.autoRead) return;
  const token = stepToken;
  setTimeout(() => { if (token === stepToken) say(text, btn); }, 450);
}

function toggleBtn(on, icOn, icOff, label, fn) {
  const b = h(`<button class="btn ghost round" type="button" aria-label="${esc(label)}" title="${esc(label)}">${icon(on ? icOn : icOff)}</button>`);
  b.addEventListener('click', () => { on = !on; b.innerHTML = icon(on ? icOn : icOff); fn(on); });
  return b;
}

async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { /* ignore */ }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && (runner || studioInst)) keepAwake(true); });

function mount(el) {
  leaveRunner();
  leaveStudio();
  app.replaceChildren(el);
}
function leaveStep() {
  stepToken++;
  hush();
  for (const fn of stepCleanup.splice(0)) { try { fn(); } catch (e) { console.warn(e); } }
}
function leaveRunner() {
  if (!runner) return;
  leaveStep();
  runner = null;
  keepAwake(false);
}
function leaveStudio() {
  if (!studioInst) return;
  saveCover(studioInst);
  try { studioInst.destroy(); } catch (e) { console.warn(e); }
  studioInst = null;
  keepAwake(false);
}
function saveCover(inst) {
  try {
    if (!inst.design.cells.length) return;
    const w = inst.world;
    const c = document.createElement('canvas');
    c.width = 640; c.height = Math.round(640 * (w.h / w.w));
    w.render();
    c.getContext('2d').drawImage(w.canvas, 0, 0, c.width, c.height);
    store.modSave('home', 'cover', c.toDataURL('image/jpeg', 0.72));
  } catch (e) { /* ignore */ }
}

/* ---------------- Crew setup ---------------- */
function renderSetup() {
  const c = store.state.crew || { commander: 'Finn', engineer: '' };
  const v = h(`<section class="view setup"><div class="card">
    <div class="wordmark"><div class="mark">${emo('🏫')}</div><div><div class="t1">Astra Architect</div><div class="t2">Finn's Dream School</div></div></div>
    <p class="muted" style="font-size:22px;margin:0">An architect designs buildings for people. Today you are the Architect, and your grown-up is the Client: the person who asks for the building.</p>
    <div class="field"><label>The Architect</label><input class="textin a" maxlength="24" value="${esc(c.commander)}"></div>
    <div class="field"><label>The Client (the grown-up)</label><input class="textin b" maxlength="24" placeholder="Grown-up" value="${esc(c.engineer)}"></div>
    <button class="btn big go" type="button">${icon('check')} Let's design a school</button>
  </div></section>`);
  v.querySelector('.btn').addEventListener('click', () => {
    const a = v.querySelector('.a').value.trim() || 'Finn';
    const b = v.querySelector('.b').value.trim() || 'Grown-up';
    store.set({ crew: { commander: a, engineer: b } });
    location.hash = '#/';
  });
  mount(v);
}

/* ---------------- Home ---------------- */
function renderHome() {
  const c = crew();
  const s = store.state;
  const idx = indexDesign(s.design);
  const brief = checkBrief(idx, s.brief);
  const cover = store.modLoad('home', 'cover');
  const v = h(`<section class="view home"><div class="scroll">
    <div class="home-head">
      <div class="wordmark"><div class="mark">${emo('🏫')}</div><div><div class="t1">Astra Architect</div><div class="t2">${esc(c.commander)}'s Dream School</div></div></div>
      <div class="spacer"></div>
      <span class="actions" style="display:flex;gap:10px"></span>
    </div>
    <div class="home-grid">
      <div class="studio-card" role="button" tabindex="0" style="background-image:url('${cover || 'assets/site/map.jpg'}')">
        <div class="veil"></div>
        <div class="body"><div><h2>${s.design.cells.length ? 'Your school' : 'Start your school'}</h2><p>${s.design.cells.length ? `${s.design.cells.length} blocks so far. Tap to keep building.` : 'The site is ready: mountains, a waterfall, a meadow and the sea.'}</p></div>
          <span class="btn big go">${icon('building')} Build</span></div>
      </div>
      <div class="card brief-card">
        <div class="headrow"><h3>${esc(c.commander)}'s wishes</h3><span class="sp"></span></div>
        <div class="brief-list">${s.brief.map(id => WISHES[id] ? `<div class="brief-item ${brief[id] ? 'done' : ''}" data-id="${id}">${emo(WISHES[id].emoji)}<span>${esc(WISHES[id].name)}</span><span class="tick ${brief[id] ? '' : 'say'}">${brief[id] ? icon('check') : icon('speaker')}</span></div>` : '').join('')}</div>
      </div>
    </div>
    <div class="section-title"><h2>Missions</h2><span class="muted">Ten minutes each. Every mission adds to your school.</span></div>
    <div class="missions">${missionIds.map((id, i) => {
      const m = missions[id];
      const isNext = id === missionIds.find(x => !s.done[x]);
      return `<div class="mission-tile ${isNext ? 'next' : ''}" role="button" tabindex="0" data-go="${id}" style="--mc:${ACCENT[m.accent] || ACCENT.blue}">
        ${isNext ? `<span class="ribbon">${icon('play')} Play</span>` : ''}
        <div class="num">Mission ${i + 1}</div>
        <div class="pic">${emoRow(m.emoji || '🏫')}</div>
        <h3>${esc(m.title)}</h3><div class="idea">${esc(m.idea || m.tagline || '')}</div>
        ${s.done[id] ? `<span class="done">${icon('check')}</span>` : ''}
      </div>`;
    }).join('')}</div>
    <div class="section-title"><h2>Patches</h2></div>
    <div class="patch-wall">${missionIds.filter(id => s.patches[id]).map(id => `<div class="p">${patchSVG({ ...missions[id].patch, accent: missions[id].accent, crew: c })}<div>${esc(missions[id].patch?.name || '')}</div></div>`).join('') || '<div class="empty">Finish a mission to earn your first patch.</div>'}${s.stars ? `<div class="p" style="display:grid;place-items:center;font-size:20px">${emo('⭐')} ${s.stars} Changed-Mind star${s.stars > 1 ? 's' : ''}</div>` : ''}</div>
    <div class="home-actions"></div>
  </div></section>`);
  const studioGo = () => { location.hash = '#/studio'; };
  v.querySelector('.studio-card').addEventListener('click', studioGo);
  const briefText = () => sentences(`${c.commander}'s wishes`, ...s.brief.map(id => `${WISHES[id]?.name}${brief[id] ? ', done' : ''}`));
  v.querySelector('.brief-card .sp').replaceWith(speakButton(briefText));
  v.querySelectorAll('.brief-item').forEach(el => el.addEventListener('click', () => { const id = el.dataset.id; say(brief[id] ? `${WISHES[id].name}. Done!` : `${WISHES[id].name}. ${HINTS[id] || ''}`); }));
  v.querySelectorAll('[data-go]').forEach(el => {
    const go = () => { location.hash = `#/m/${el.dataset.go}/0`; };
    el.addEventListener('click', go);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
  const actions = v.querySelector('.actions');
  if (canSpeak) actions.append(toggleBtn(s.autoRead, 'speaker', 'speakerOff', 'Read aloud automatically', on => { store.set({ autoRead: on }); if (!on) hush(); toast(on ? 'Cards will be read aloud' : 'Read-aloud off'); }));
  actions.append(toggleBtn(s.sound, 'music', 'musicOff', 'Sounds', on => { store.set({ sound: on }); }));
  const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
  if (!standalone && document.documentElement.requestFullscreen) {
    const fs = h(`<button class="btn ghost round" type="button" aria-label="Full screen">${icon('expand')}</button>`);
    fs.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); });
    actions.append(fs);
  }
  const ha = v.querySelector('.home-actions');
  const act = (ic, label, fn, cls = 'ghost') => { const b = h(`<button class="btn ${cls}" type="button">${icon(ic)} ${esc(label)}</button>`); b.addEventListener('click', fn); ha.append(b); };
  act('ideas', 'Ideas book', () => import('./ui/ideas.js').then(m => m.openIdeas()));
  act('image', 'Drawing sheet', () => import('./ui/sheet.js').then(m => m.openSheet()));
  act('book', 'Crew Log', openLog);
  act('notes', "Grown-up's corner", openGrownUp);
  mount(v);
}

/* ---------------- Crew log and grown-up corner ---------------- */
function fmtTime(t) {
  const d = new Date(t);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function openLog() {
  const body = h(`<div class="loglist"></div>`);
  const items = [...store.state.log].reverse();
  body.innerHTML = items.length ? items.map(it => `<div class="logitem"><div class="when">${esc(fmtTime(it.t))}</div><div>${it.m && missions[it.m] ? `<b>${esc(missions[it.m].title)}</b> &middot; ` : ''}${esc(it.text)}</div></div>`).join('')
    : `<p class="muted">Nothing here yet. Guesses, Big Question answers and school-day reports will appear here.</p>`;
  modal('Crew Log', body);
}

function openGrownUp() {
  const s = store.state;
  const c = crew();
  const body = h(`<div style="display:flex;flex-direction:column;gap:18px">
    <p class="muted" style="margin:0">Choose which wishes are on ${esc(c.commander)}'s brief. The first five came from the homework model.</p>
    <div class="optrow wishes"></div>
    <h3>Pupils' names</h3>
    <p class="muted" style="margin:0">The first pupil is ${esc(c.commander)}. Change the classmates' names to anything you like.</p>
    <div class="names" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px"></div>
    <h3>The school</h3>
    <div class="mindrow" style="justify-content:flex-start"></div>
    <h3>Notes for the grown-up</h3>
    <div class="notes" style="display:flex;flex-direction:column;gap:12px;font-size:18px"></div>
  </div>`);
  const wrow = body.querySelector('.wishes');
  for (const [id, W] of Object.entries(WISHES)) {
    const on = s.brief.includes(id);
    const b = h(`<button class="opt ${on ? 'on' : ''}" type="button" style="min-width:120px">${emo(W.emoji)}<span>${esc(W.short)}</span></button>`);
    b.addEventListener('click', () => {
      const list = store.state.brief.includes(id) ? store.state.brief.filter(x => x !== id) : [...store.state.brief, id];
      store.set({ brief: list });
      b.classList.toggle('on');
    });
    wrow.append(b);
  }
  const names = body.querySelector('.names');
  s.pupils.forEach((p, i) => {
    const inp = h(`<input class="textin" style="font-size:18px;padding:10px 12px" maxlength="14" value="${esc(i === 0 ? c.commander : p.name)}" ${i === 0 ? 'disabled' : ''}>`);
    inp.addEventListener('change', () => { store.state.pupils[i].name = inp.value.trim() || p.name; store.save(); });
    names.append(inp);
  });
  const row = body.querySelector('.mindrow');
  const b1 = h(`<button class="btn ghost small" type="button">${icon('download')} Save the school as a file</button>`);
  b1.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(store.state.design)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'dream-school.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  const b2 = h(`<label class="btn ghost small">${icon('folder')} Open a school file<input type="file" accept=".json,application/json" hidden></label>`);
  b2.querySelector('input').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const d = JSON.parse(await f.text()); if (Array.isArray(d.cells)) { store.set({ design: { name: d.name || "Finn's Dream School", cells: d.cells, sun: d.sun ?? 0.32, nextId: d.nextId || (Math.max(0, ...d.cells.map(c => c.id)) + 1) } }); toast('School opened'); } }
    catch (err) { toast('That file did not open'); }
  });
  const b3 = h(`<button class="btn ghost small" type="button">${icon('refresh')} Start a new empty school</button>`);
  b3.addEventListener('click', () => {
    if (!confirm('Start again with an empty site? The current school will be kept in the saved schools list.')) return;
    const slots = [...store.state.slots, { name: store.state.design.name, t: Date.now(), design: store.state.design }].slice(-6);
    store.set({ slots, design: { name: "Finn's Dream School", cells: [], sun: 0.32, nextId: 1 } });
    store.modSave('home', 'cover', null);
    toast('A fresh site is ready');
  });
  row.append(b1, b2, b3);
  if (s.slots.length) {
    for (const [i, sl] of s.slots.entries()) {
      const b = h(`<button class="btn ghost small" type="button">${icon('folder')} Bring back the school from ${esc(fmtTime(sl.t))}</button>`);
      b.addEventListener('click', () => { const cur = store.state.design; const slots = [...store.state.slots]; slots[i] = { name: cur.name, t: Date.now(), design: cur }; store.set({ design: sl.design, slots }); toast('School swapped'); });
      row.append(b);
    }
  }
  const notes = body.querySelector('.notes');
  notes.innerHTML = missionIds.map(id => { const m = missions[id]; return `<div><b>${esc(m.title)}</b><ul style="margin:6px 0 0;padding-left:22px">${(m.grownUp || []).map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>`; }).join('');
  modal("Grown-up's corner", body, { wide: true, onClose: () => { if (!runner && !studioInst) renderHome(); } });
}

/* ---------------- Free Studio ---------------- */
async function renderStudio() {
  const v = h(`<section class="view"><div class="studio-host" style="position:absolute;inset:0"></div><button class="btn ghost round home-btn" type="button" aria-label="Home" style="position:absolute;left:12px;bottom:12px;z-index:9">${icon('home')}</button></section>`);
  mount(v);
  v.querySelector('.home-btn').addEventListener('click', () => { location.hash = '#/'; });
  // Lift the tray so the home button fits underneath.
  const { mountStudio } = await import('./studio.js');
  const inst = await mountStudio(v.querySelector('.studio-host'), { preset: { full: true } });
  if (!v.isConnected) { inst.destroy(); return; }
  inst.root.querySelector('.rail.left').style.bottom = '88px';
  studioInst = inst;
  keepAwake(true);
  if (new URLSearchParams(location.search).has('debugwalk')) inst.setView('walk');
  if (new URLSearchParams(location.search).has('debugday')) inst.openDay({ autoplay: true });
  window.__studio = inst;
}

/* ---------------- Mission runner ---------------- */
async function renderRunner(id, idx) {
  let mission;
  try { mission = await loadMission(id); } catch (e) { location.hash = '#/'; return; }
  if (runner && runner.id === id && runner.el.isConnected) { showStep(idx); return; }
  const el = h(`<section class="view runner" style="--accent:${ACCENT[mission.accent] || ACCENT.blue}">
    <div class="topbar">
      <button class="btn ghost round home-btn" type="button" aria-label="Home">${icon('home')}</button>
      <div class="title">${emo(splitEmoji(mission.emoji || '🏫')[0])}${esc(mission.title)}</div>
      <div class="spacer"></div>
      <div class="dots">${mission.steps.map(() => '<i></i>').join('')}</div>
      <div class="spacer"></div>
      <span class="tb-tools" style="display:flex;gap:8px"></span>
    </div>
    <div class="stage"></div>
    <div class="bottombar">
      <button class="btn ghost back-btn" type="button">${icon('back')} Back</button>
      <div class="steplabel"></div>
      <button class="btn next-btn" type="button">Next ${icon('next')}</button>
    </div>
  </section>`);
  mount(el);
  const tools = el.querySelector('.tb-tools');
  if (canSpeak) tools.append(toggleBtn(store.state.autoRead, 'speaker', 'speakerOff', 'Read cards aloud', on => { store.set({ autoRead: on }); if (!on) hush(); toast(on ? 'Cards will be read aloud' : 'Read-aloud off. Tap a speaker to hear a card'); }));
  tools.append(toggleBtn(store.state.sound, 'music', 'musicOff', 'Sounds', on => store.set({ sound: on })));
  el.querySelector('.home-btn').addEventListener('click', () => { location.hash = '#/'; });
  runner = { id, mission, idx: -1, el, stage: el.querySelector('.stage'), nextBtn: el.querySelector('.next-btn'), backBtn: el.querySelector('.back-btn'), label: el.querySelector('.steplabel'), dots: [...el.querySelectorAll('.dots i')] };
  runner.backBtn.addEventListener('click', () => go(runner.idx - 1));
  runner.nextBtn.addEventListener('click', () => { if (runner.idx >= runner.mission.steps.length - 1) location.hash = '#/'; else go(runner.idx + 1); });
  runner.dots.forEach((d, i) => d.addEventListener('click', () => go(i)));
  keepAwake(true);
  showStep(idx);
}
function go(i) {
  if (!runner) return;
  location.hash = `#/m/${runner.id}/${clamp(i, 0, runner.mission.steps.length - 1)}`;
}
// Next looks like an outline until the step is done, then fills in and glows.
function setReady(on = true) { if (runner) { runner.nextBtn.classList.toggle('glow', on); runner.nextBtn.classList.toggle('wait', !on); } }

function showStep(i) {
  const r = runner;
  const steps = r.mission.steps;
  i = clamp(i, 0, steps.length - 1);
  leaveStep();
  r.idx = i;
  const step = steps[i];
  r.dots.forEach((d, k) => { d.className = k < i ? 'done' : k === i ? 'now' : ''; });
  r.backBtn.style.visibility = i === 0 ? 'hidden' : '';
  const last = i === steps.length - 1;
  r.nextBtn.innerHTML = last ? `${icon('home')} Home` : `Next ${icon('next')}`;
  setReady(false);
  r.label.replaceChildren(document.createTextNode(STEP_LABEL[step.type] || ''));
  const el = h(`<div class="step"></div>`);
  r.stage.replaceChildren(el);
  const fn = RENDER[step.type] || renderUnknown;
  try { fn(el, step, r, i); } catch (e) { console.error(e); renderUnknown(el); }
  r.stage.scrollTop = 0;
}
function renderUnknown(el) {
  el.className = 'step pad';
  el.innerHTML = `<div class="card" style="max-width:640px;margin:40px auto">This part isn't ready yet. Tap Next to carry on.</div>`;
}

function pictureHTML(s) {
  if (s.img) return `<div class="picture has-img"><img class="full" src="${esc(s.img)}" alt=""></div>`;
  const list = splitEmoji(s.emoji || '🏫').slice(0, 3);
  return `<div class="picture"><div class="emos n${list.length}">${list.map(e => emo(e, '')).join('')}</div></div>`;
}

function renderStory(el, s) {
  el.className = 'step pad';
  const c = crew();
  el.innerHTML = `<div class="story">
    ${pictureHTML(s)}
    <div class="text"><div class="card">
      <div class="headrow"><h2>${esc(s.title)}</h2><span class="sp"></span></div>
      <p class="lead">${esc(s.text)}</p>
      ${s.wow ? `<div class="wow">${esc(s.wow)}</div>` : ''}
      ${s.ask ? `<div class="dadline"><b>${esc(c.engineer)}</b><span>${esc(s.ask)}</span></div>` : ''}
      ${s.source ? `<a class="source-link" href="${esc(s.source)}" target="_blank" rel="noopener">Where this fact comes from</a>` : ''}
    </div></div></div>`;
  const text = sentences(s.title, s.text, s.wow);
  const btn = speakButton(() => text);
  el.querySelector('.sp').replaceWith(btn);
  autoSay(text, btn);
  setReady(true);
}

function choiceHTML(ch, i, showKey) {
  return `<button class="choice" type="button" data-i="${i}">
    <span class="badges"></span>${showKey ? `<span class="key">${'ABCD'[i] || ''}</span>` : ''}
    ${choicePic(ch)}
    <span>${esc(ch.label)}</span>${ch.detail ? `<span class="detail">${esc(ch.detail)}</span>` : ''}
  </button>`;
}
// A choice's picture: a block shape, a crop of Finn's painted site, a compass, or an emoji.
function choicePic(ch) {
  if (ch.form) return `<span class="cpic">${formIcon(ch.form, 'iso', ch.colour || '#2a9d8f')}</span>`;
  if (ch.crop) return `<span class="cpic crop" style="background-position:${ch.crop[0]}% ${ch.crop[1]}%"></span>`;
  if (ch.compass) {
    const a = { N: 0, E: 90, S: 180, W: 270 }[ch.compass] || 0;
    return `<span class="cpic"><svg viewBox="0 0 80 80" class="compass"><circle cx="40" cy="40" r="34" fill="#fff" stroke="#3d405b" stroke-width="3"/><text x="40" y="17" text-anchor="middle" font-size="11" font-weight="800" fill="#8a8f9c">N</text><g transform="rotate(${a} 40 40)"><path d="M40 12 50 44H30z" fill="#e5483d"/><path d="M30 44h20L40 66z" fill="#cfd6dc"/></g><circle cx="40" cy="44" r="4" fill="#3d405b"/></svg></span>`;
  }
  return ch.emoji ? emo(splitEmoji(ch.emoji)[0], 'cemo') : '';
}
function setBadges(btns, cmd, eng) {
  const c = crew();
  btns.forEach((b, i) => {
    b.classList.toggle('pick-cmd', i === cmd);
    b.classList.toggle('pick-eng', i === eng);
    b.querySelector('.badges').innerHTML = (i === cmd ? `<span class="badge cmd">${esc(c.commander)}</span>` : '') + (i === eng ? `<span class="badge eng">${esc(c.engineer)}</span>` : '');
  });
}

function renderGuess(el, s, r) {
  el.className = 'step pad';
  const c = crew();
  const choices = s.choices || [];
  el.innerHTML = `<div class="ask">
    <div class="headrow"><div><div class="eyebrow">${esc(s.title || 'Guess!')}</div><div class="prompt">${esc(s.prompt)}</div></div><span class="sp"></span></div>
    <div class="choices">${choices.map((ch, i) => choiceHTML(ch, i, false)).join('')}</div>
    <div class="turn"></div><div class="revealslot"></div></div>`;
  const btns = [...el.querySelectorAll('.choice')];
  const turn = el.querySelector('.turn');
  const slot = el.querySelector('.revealslot');
  const pbtn = speakButton(() => sentences(s.prompt, choices.map(ch => ch.label).join(', or ') + '?'));
  el.querySelector('.sp').replaceWith(pbtn);
  autoSay(sentences(s.prompt, choices.map(ch => ch.label).join(', or ') + '?'), pbtn);
  let cmd = null, eng = null, phase = 'cmd';
  const drawTurn = () => {
    turn.innerHTML = '';
    if (phase === 'cmd') turn.innerHTML = `<span class="who cmd">${esc(c.commander)}</span><span>tap your guess!</span>`;
    else if (phase === 'eng') {
      turn.innerHTML = `<span class="who eng">${esc(c.engineer)}</span><span>what's your guess?</span>`;
      const skip = h(`<button class="btn ghost small" type="button">Skip</button>`);
      skip.addEventListener('click', () => { phase = 'ready'; drawTurn(); });
      turn.append(skip);
    } else if (phase === 'ready') {
      const rb = h(`<button class="btn big glow" type="button">Reveal!</button>`);
      rb.addEventListener('click', reveal);
      turn.append(rb);
    }
  };
  btns.forEach((b, i) => b.addEventListener('click', () => {
    if (phase === 'cmd') { cmd = i; phase = 'eng'; }
    else if (phase === 'eng') { eng = i; phase = 'ready'; }
    else if (phase === 'ready') { if (eng === null) cmd = i; else eng = i; }
    else return;
    sfx.tap();
    setBadges(btns, cmd, eng);
    drawTurn();
  }));
  function reveal() {
    phase = 'done';
    turn.innerHTML = '';
    const ans = typeof s.answer === 'number' ? s.answer : -1;
    btns.forEach((b, i) => { b.classList.toggle('answer', i === ans); b.classList.toggle('dim', ans >= 0 && i !== ans); });
    const hit = cmd === ans;
    const opener = ans < 0 ? 'Here is the answer!' : hit ? `Spot on, ${c.commander}!` : 'Good guess! Here is the answer:';
    const rv = h(`<div class="reveal"><div class="card"><div class="headrow"><div class="big">${esc(opener)}</div><span class="sp"></span></div><p class="lead" style="font-size:24px;margin:8px 0 0">${esc(s.reveal)}</p>${s.source ? `<a class="source-link" href="${esc(s.source)}" target="_blank" rel="noopener">Where this fact comes from</a>` : ''}</div></div>`);
    const text = sentences(opener, s.reveal);
    const b = speakButton(() => text);
    rv.querySelector('.sp').replaceWith(b);
    slot.replaceChildren(rv);
    if (store.state.autoRead) say(text, b);
    hit ? sfx.chime() : sfx.pop();
    const who = [cmd !== null ? `${c.commander} said "${choices[cmd]?.label}"` : null, eng !== null ? `${c.engineer} said "${choices[eng]?.label}"` : null].filter(Boolean).join(', ');
    store.addLog(r.id, `Guess: ${s.prompt} ${who ? who + '.' : ''} Answer: ${ans >= 0 ? choices[ans]?.label : s.reveal}`);
    setReady(true);
    rv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  drawTurn();
}

function renderQuestion(el, s, r) {
  el.className = 'step pad';
  const c = crew();
  const opts = s.options || [];
  el.innerHTML = `<div class="ask">
    <div class="eyebrow">${esc(s.title || 'Big Question')} &middot; there's no right answer</div>
    <div class="card"><div class="headrow"><p class="scenario" style="margin:0">${esc(s.scenario)}</p><span class="sp"></span></div></div>
    <div class="choices">${opts.map((o, i) => choiceHTML(o, i, true)).join('')}</div>
    <div class="turn"></div><div class="revealslot"></div></div>`;
  const btns = [...el.querySelectorAll('.choice')];
  const turn = el.querySelector('.turn');
  const slot = el.querySelector('.revealslot');
  const scen = sentences(s.scenario, 'What would you choose?', opts.map((o, i) => `${'ABCD'[i]}: ${o.label}`).join('. '));
  const sb = speakButton(() => scen);
  el.querySelector('.sp').replaceWith(sb);
  autoSay(scen, sb);
  let cmd = null, eng = null, phase = 'cmd', changing = null;
  const drawTurn = () => {
    turn.innerHTML = '';
    if (phase === 'cmd') turn.innerHTML = `<span class="who cmd">${esc(c.commander)}</span><span>what would you choose? Tap one.</span>`;
    else if (phase === 'eng') turn.innerHTML = `<span class="who eng">${esc(c.engineer)}</span><span>your turn. What would you choose?</span>`;
    else if (phase === 'why') {
      const box = h(`<div style="display:flex;flex-direction:column;gap:12px;width:100%">
        <div class="turn"><span class="who cmd">${esc(c.commander)}</span><span>why did you choose that? Tell ${esc(c.engineer)}!</span></div>
        <div class="whybox"><input class="textin" type="text" maxlength="160" placeholder="${esc(c.engineer)} can write the reason here (optional)"><button class="btn big glow" type="button">What do architects think?</button></div></div>`);
      if (store.state.autoRead) say(`${c.commander}, why did you choose that? Tell ${c.engineer}!`);
      box.querySelector('.btn').addEventListener('click', () => {
        const why = box.querySelector('input').value.trim();
        store.addLog(r.id, `Big Question: ${s.title || s.scenario}. ${c.commander} chose "${opts[cmd]?.label}"${eng !== null ? `, ${c.engineer} chose "${opts[eng]?.label}"` : ''}.${why ? ` Because: ${why}` : ''}`);
        phase = 'reveal'; drawTurn(); showReveal();
      });
      turn.append(box);
    } else if (phase === 'reveal') {
      const row = h(`<div class="mindrow"></div>`);
      const mk = (who, name, col) => {
        const b = h(`<button class="btn ghost small" type="button" style="box-shadow:0 0 0 3px ${col} inset">${icon('star')} ${esc(name)}: I changed my mind</button>`);
        b.addEventListener('click', () => { changing = who; turn.querySelector('.hint')?.remove(); row.after(h(`<span class="hint muted">Tap your new choice, ${esc(name)}.</span>`)); });
        return b;
      };
      row.append(mk('cmd', c.commander, 'var(--blue)'), mk('eng', c.engineer, 'var(--orange)'));
      turn.append(row);
    }
  };
  btns.forEach((b, i) => b.addEventListener('click', () => {
    if (phase === 'cmd') { cmd = i; phase = 'eng'; }
    else if (phase === 'eng') { eng = i; phase = 'why'; }
    else if (phase === 'why') return;
    else if (phase === 'reveal' && changing) {
      const who = changing; changing = null;
      const before = who === 'cmd' ? cmd : eng;
      if (before === i) { turn.querySelector('.hint')?.remove(); return; }
      if (who === 'cmd') cmd = i; else eng = i;
      const name = who === 'cmd' ? c.commander : c.engineer;
      store.addStar();
      store.addLog(r.id, `${name} had a rethink and chose "${opts[i]?.label}". A star for changing your mind!`);
      toast(`${name} had a rethink. That's what architects do! +1 star`, '⭐');
      say(`${name} had a rethink. That's what architects do!`);
      turn.querySelector('.hint')?.remove();
    } else return;
    sfx.tap();
    setBadges(btns, cmd, eng);
    drawTurn();
  }));
  function showReveal() {
    const rv = h(`<div class="reveal"><div class="card">
      <div class="headrow"><div class="eyebrow">What architects think</div><span class="sp"></span></div>
      <p class="lead" style="font-size:23px;margin:8px 0 0">${esc(s.reveal)}</p>
      ${s.followUp ? `<div class="dadline" style="font-size:21px"><b>Talk about it</b><span>${esc(s.followUp)}</span></div>` : ''}
    </div></div>`);
    const text = sentences(s.reveal, s.followUp);
    const b = speakButton(() => text);
    rv.querySelector('.sp').replaceWith(b);
    slot.replaceChildren(rv);
    if (store.state.autoRead) say(text, b);
    setReady(true);
    rv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  drawTurn();
}

function renderAtHome(el, s) {
  el.className = 'step pad';
  const need = s.need || [], steps = s.steps || [];
  el.innerHTML = `<div style="max-width:1200px;margin:0 auto;display:flex;flex-direction:column;gap:20px">
    <div class="headrow"><div><div class="eyebrow">Try it at home</div><h2>${esc(String(s.title || '').replace(/^Try it at home:\s*/i, ''))}</h2></div><span class="sp"></span></div>
    <div class="athome">
      <div class="card"><h3 style="margin-bottom:14px">You need</h3><ul>${need.map((n, i) => `<li><span class="tick" role="checkbox" aria-checked="false" tabindex="0" data-i="${i}"></span><span>${esc(n)}</span></li>`).join('')}</ul></div>
      <div class="card"><h3 style="margin-bottom:14px">What to do</h3><ol>${steps.map((t, i) => `<li><span class="n">${i + 1}</span><span>${esc(t)}</span></li>`).join('')}</ol>
        ${s.why ? `<div class="wow" style="font-size:21px;font-weight:500;color:var(--ink)"><b style="color:var(--accent)">Why it works: </b>${esc(s.why)}</div>` : ''}</div>
    </div></div>`;
  el.querySelectorAll('.tick').forEach(t => {
    const flip = () => { const on = !t.classList.contains('on'); t.classList.toggle('on', on); t.setAttribute('aria-checked', on); t.innerHTML = on ? icon('check') : ''; sfx.tap(); };
    t.addEventListener('click', flip);
    t.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } });
  });
  const text = sentences(s.title, 'You need: ' + need.join(', '), ...steps, s.why ? 'Why it works: ' + s.why : '');
  const b = speakButton(() => text);
  el.querySelector('.sp').replaceWith(b);
  autoSay(sentences(s.title), b);
  setReady(true);
}

function renderFinish(el, s, r) {
  el.className = 'step pad';
  const c = crew();
  const m = r.mission;
  const isNew = store.earnPatch(m.id);
  store.set({ done: { ...store.state.done, [m.id]: Date.now() } });
  if (isNew) store.addLog(m.id, `Mission complete! Earned the "${m.patch?.name || m.title}" patch.`);
  const nextId = missionIds[missionIds.indexOf(m.id) + 1];
  const deb = s.debrief || ['What was your favourite part?'];
  el.innerHTML = `<div class="finish">
    <div class="patchbig">${patchSVG({ ...m.patch, accent: m.accent, crew: c })}</div>
    <div style="display:flex;flex-direction:column;gap:20px">
      <div><div class="eyebrow">Mission complete</div><h1>${esc(m.patch?.name || m.title)}</h1>
        <p class="muted" style="font-size:22px;margin-top:8px">${isNew ? 'A new patch for the wall!' : 'You did this mission again. Brilliant!'}</p></div>
      <div class="card"><h3 style="margin-bottom:12px">Crew debrief</h3><div class="debrief">${deb.map((q, i) => `<div class="q"><span class="sp" data-i="${i}"></span><span>${esc(q)}</span></div>`).join('')}</div></div>
      <div class="mindrow" style="justify-content:flex-start"><button class="btn big home-go" type="button">${icon('home')} Home</button>${nextId ? `<button class="btn ghost big next-go" type="button">Next: ${esc(missions[nextId].title)} ${icon('next')}</button>` : `<button class="btn ghost big studio-go" type="button">${icon('building')} Keep building</button>`}</div>
    </div></div>`;
  el.querySelectorAll('.sp').forEach(sp => { const q = deb[+sp.dataset.i]; sp.replaceWith(speakButton(() => q)); });
  el.querySelector('.home-go').addEventListener('click', () => { location.hash = '#/'; });
  el.querySelector('.next-go')?.addEventListener('click', () => { location.hash = `#/m/${nextId}/0`; });
  el.querySelector('.studio-go')?.addEventListener('click', () => { location.hash = '#/studio'; });
  if (isNew) { toast(`New patch: ${m.patch?.name || m.title}!`, '🏅'); sfx.tada(); }
  autoSay(sentences(`Mission complete! You earned the ${m.patch?.name || m.title} patch`, deb[0]), null);
  setReady(true);
}

function renderPlay(el, s, r) {
  el.className = 'step';
  el.innerHTML = `<div class="play-host"></div>`;
  const host = el.firstElementChild;
  const c = crew();
  const intro = h(`<div style="display:flex;align-items:center;gap:12px;justify-content:center;text-transform:none;letter-spacing:0;font-size:18px;color:var(--ink-2);font-weight:500"><span class="sp"></span><span><b style="color:var(--ink)">${esc(s.title || 'Build')}</b>${s.intro ? ' &middot; ' + esc(s.intro) : ''}</span></div>`);
  const text = sentences(s.title, s.intro);
  const b = speakButton(() => text);
  intro.querySelector('.sp').replaceWith(b);
  r.label.replaceChildren(intro);
  autoSay(text, b);
  const token = stepToken;
  let inst = null;
  stepCleanup.push(() => { try { inst && inst.destroy && inst.destroy(); } catch (e) { console.warn(e); } inst = null; });
  const ctx = {
    data: s.data || {},
    missionId: r.id,
    speak: t => { if (store.state.autoRead) say(t); },
    stopSpeaking: hush,
    log: t => store.addLog(r.id, t),
    complete: () => { if (token === stepToken) setReady(true); },
    crew: c,
    get sound() { return !!store.state.sound; },
    save: (k, v) => store.modSave(s.module, k, v),
    load: k => store.modLoad(s.module, k),
  };
  host.innerHTML = `<div style="position:absolute;inset:0;display:grid;place-items:center;color:var(--ink-3);font-weight:600">Getting the site ready...</div>`;
  import(`./missions/${s.module}.js`).then(async mod => {
    if (token !== stepToken) return;
    host.innerHTML = '';
    const made = await mod.mount(host, ctx);
    if (token !== stepToken) { try { made && made.destroy && made.destroy(); } catch (e) { /* ignore */ } return; }
    inst = made;
  }).catch(err => {
    console.error(err);
    if (token !== stepToken) return;
    host.innerHTML = `<div class="card" style="max-width:640px;margin:60px auto;text-align:center">This activity couldn't load right now. Tap Next to carry on.</div>`;
    setReady(true);
  });
}

const RENDER = { story: renderStory, guess: renderGuess, question: renderQuestion, athome: renderAtHome, finish: renderFinish, play: renderPlay };

/* ---------------- Router ---------------- */
function route() {
  document.querySelectorAll('.modal-back').forEach(m => m.remove());
  const hash = location.hash || '#/';
  if (!store.state.crew && !hash.startsWith('#/setup')) { location.replace('#/setup'); return; }
  const m = hash.match(/^#\/m\/([\w-]+)(?:\/(\d+))?/);
  if (m && missions[m[1]]) { renderRunner(m[1], +(m[2] || 0)); return; }
  if (hash.startsWith('#/setup')) { renderSetup(); return; }
  if (hash.startsWith('#/studio')) { renderStudio(); return; }
  renderHome();
}

document.addEventListener('keydown', e => {
  if (!runner || e.target.closest('input, textarea') || document.querySelector('.modal-back')) return;
  const step = runner.mission.steps[runner.idx];
  if (step && step.type === 'play') return;
  if (e.key === 'ArrowRight') { e.preventDefault(); runner.nextBtn.click(); }
  if (e.key === 'ArrowLeft' && runner.idx > 0) { e.preventDefault(); go(runner.idx - 1); }
});

async function boot() {
  app.innerHTML = `<div style="height:100%;display:grid;place-items:center;color:var(--ink-3);font-weight:700;letter-spacing:.2em">LOADING</div>`;
  await Promise.all([loadAll(), loadSite()]);
  const p = new URLSearchParams(location.search);
  if (p.has('reset')) store.wipe();
  if (p.has('devcrew') && !store.state.crew) store.set({ crew: { commander: 'Finn', engineer: 'Grown-up' } });
  if (p.has('devdesign')) {
    const { SAMPLE } = await import('./core/sample.js');
    store.set({ design: JSON.parse(JSON.stringify(SAMPLE)) });
  }
  window.addEventListener('hashchange', route);
  route();
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if ('serviceWorker' in navigator && (!local || p.has('sw'))) navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW failed', err));
}

boot();
export { FRAMED };
