// The School Day panel: code a pupil with picture tiles, set the bell timetable, run the day, read the report.
import { store } from '../core/store.js';
import { ROOMS, ACTIVITIES, ACTIVITY_ORDER } from '../core/catalogue.js';
import { roomGroups } from '../core/design.js';
import { formIcon } from '../ui/formicons.js';
import { Day, report, PERIOD, BELLS, TILE } from './sim.js';
import { PupilsView } from './pupils3d.js';
import { emo } from '../core/emoji.js';
import { icon } from '../core/icons.js';
import { h, esc, say, sayAuto, sfx, toast, hush } from '../ui/dom.js';

const MAX_TILES = 8;
const SHORT = { pool: 'Pool', track: 'Track', yoga: 'Chill-out', lunch: 'Lunch', classroom: 'Classroom', climbing: 'Climbing', changing: 'Changing', toilets: 'Toilets' };

export async function openDayPanel(api, world, root, opts = {}) {
  const S = store.state;
  const crewName = (S.crew && S.crew.commander) || 'Finn';
  const pupilsAll = S.pupils.map((p, i) => ({ ...p, name: i === 0 ? crewName : p.name }));
  const limit = opts.pupils || pupilsAll.length;
  const pupils = () => pupilsAll.slice(0, limit).map((p, i) => ({ ...p, strip: S.pupils[i].strip || [] }));
  let sel = 0;
  const view = world.pupilsView || (world.pupilsView = new PupilsView(world));
  let day = new Day(api.idx, pupils(), S.bells, {});
  await view.ensure(day.pupils);
  view.update(day, 0.016, { selected: null, names: true });
  let running = false, speed = 1, predicted = null, tab = opts.focus === 'timetable' ? 'bells' : 'code';

  const el = h(`<div class="day">
    <div class="daybar">
      <h3>${emo(opts.codeOnly ? '🧩' : '🔔')} ${opts.codeOnly ? 'Code' : 'School day'}</h3>
      <div class="dtabs"></div>
      <div class="bells"></div>
      <div class="clock"></div>
      <div class="pslot"></div>
      <div style="flex:1"></div>
      <span class="codeact" style="display:flex;gap:8px"></span>
      <span class="ctl" style="display:flex;gap:8px"></span>
      <button class="btn ghost round small close" type="button" aria-label="Close">${icon('close')}</button>
    </div>
    <div class="body"></div>
  </div>`);
  root.appendChild(el);
  const shift = () => world.setViewShift(Math.round(el.offsetHeight / 2));
  requestAnimationFrame(shift);
  const ro = new ResizeObserver(shift);
  ro.observe(el);
  // Keep the rails clear of the panel, then frame the school in the space above it.
  const lrail = root.querySelector('.rail.left'), rrail = root.querySelector('.rail.right'), tright = root.querySelector('.topright');
  const oldL = lrail.style.display, oldR = rrail.style.display, oldT = tright ? tright.style.display : '';
  lrail.style.display = 'none';
  rrail.style.display = 'none';
  if (tright) tright.style.display = 'none';
  shift();
  api.frameModel(false, false, true);
  api.setCutaway(true);
  // If the school changes while the panel is open, the pupils use the new one.
  const offChange = api.on('change', () => {
    if (running) stopRun();
    else { day = new Day(api.idx, pupils(), S.bells, {}); view.ensure(day.pupils); drawBody(); }
  });
  const bellsEl = el.querySelector('.bells'), clock = el.querySelector('.clock'), ctl = el.querySelector('.ctl'), body = el.querySelector('.body');
  const dtabs = el.querySelector('.dtabs'), pslot = el.querySelector('.pslot'), codeact = el.querySelector('.codeact');
  el.querySelector('.close').addEventListener('click', close);

  function drawBells() {
    bellsEl.innerHTML = '';
    S.bells.slice(0, BELLS).forEach((a, i) => {
      const cur = running && day.mode === 'day' ? day.bell : -1;
      const b = h(`<button class="bell ${i === cur ? 'now' : ''} ${cur > i ? 'past' : ''}" type="button" aria-label="Bell ${i + 1}: ${esc(ACTIVITIES[a]?.name || a)}"><span class="n">${i + 1}</span>${emo(ACTIVITIES[a]?.emoji || '❓')}<span>${esc(ACTIVITIES[a]?.name || a)}</span></button>`);
      b.addEventListener('click', () => { if (running) return; tab = 'bells'; bellPick = i; drawBody(); sfx.tap(); say(`Bell ${i + 1}: ${ACTIVITIES[a]?.name}. Choose what happens at this bell.`); });
      bellsEl.append(b);
    });
  }
  let bellPick = 0;

  function drawCtl() {
    ctl.innerHTML = '';
    if (!running) {
      if (opts.codeOnly) return;
      const run = h(`<button class="btn go" type="button">${icon('play')} Run the day</button>`);
      run.addEventListener('click', () => startRun('day'));
      ctl.append(run);
    } else {
      const pause = h(`<button class="btn ghost round" type="button" aria-label="Pause">${icon(paused ? 'play' : 'pause')}</button>`);
      pause.addEventListener('click', () => { paused = !paused; drawCtl(); });
      const fast = h(`<button class="btn ghost ${speed > 1 ? 'on' : ''}" type="button">${icon('fast')} ${speed > 1 ? 'Fast' : 'Normal'}</button>`);
      fast.addEventListener('click', () => { speed = speed > 1 ? 1 : 3; drawCtl(); });
      const stop = h(`<button class="btn ghost" type="button">${icon('close')} Stop</button>`);
      stop.addEventListener('click', () => stopRun());
      ctl.append(pause, fast, stop);
    }
  }
  let paused = false;

  // ---------- Body: code, timetable or report ----------
  function drawBody() {
    body.innerHTML = ''; dtabs.innerHTML = ''; pslot.innerHTML = ''; codeact.innerHTML = '';
    if (tab === 'report') return drawReport();
    const tb = (id, ic, label) => { const b = h(`<button class="btn small ${tab === id ? '' : 'ghost'}" type="button">${emo(ic)} ${label}</button>`); b.addEventListener('click', () => { tab = id; drawBody(); }); return b; };
    if (!opts.codeOnly) dtabs.append(tb('code', '🧩', 'Code'), tb('bells', '🔔', 'Timetable'));
    if (tab === 'bells') return drawTimetable();
    drawCode();
  }

  function tileHTML(t, i, cls = '') {
    const { kind, arg } = TILE.parse(t);
    if (kind === 'go') {
      const R = ROOMS[arg];
      const pic = arg === 'gate' || !R ? emo('🚪') : `<span class="blk">${formIcon(R.form, 'iso', R.colour)}</span>`;
      return `<button class="ctile go ${cls}" type="button" data-i="${i}">${emo('👣', 'foot')}${pic}<span>${esc(arg === 'gate' ? 'Gate' : SHORT[arg] || R?.name.split(' ')[0] || arg)}</span></button>`;
    }
    if (kind === 'do') return `<button class="ctile do ${cls}" type="button" data-i="${i}">${emo(ACTIVITIES[arg]?.emoji || '❓')}<span>${esc(ACTIVITIES[arg]?.name || arg)}</span></button>`;
    if (kind === 'wait') return `<button class="ctile wait ${cls}" type="button" data-i="${i}">${emo(arg === 'bell' ? '🔔' : '⏳')}<span>${arg === 'bell' ? 'Wait for bell' : 'Wait'}</span></button>`;
    if (kind === 'again') return `<button class="ctile again ${cls}" type="button" data-i="${i}">${emo('🔁')}<span class="dots3">${arg === 'forever' ? '<b style="font-size:16px">∞</b>' : '<i></i>'.repeat(+arg || 2)}</span></button>`;
    return '';
  }
  const tileSay = t => {
    const { kind, arg } = TILE.parse(t);
    if (kind === 'go') return arg === 'gate' ? 'Go to the gate' : `Go to the ${ROOMS[arg]?.name.toLowerCase()}`;
    if (kind === 'do') return ACTIVITIES[arg]?.name;
    if (kind === 'wait') return arg === 'bell' ? 'Wait for the bell' : 'Wait a moment';
    if (kind === 'again') return arg === 'forever' ? 'Again, for ever' : `Again, ${arg} times altogether`;
    return '';
  };

  function drawCode() {
    const P = pupils();
    const chips = h(`<div class="pupils"></div>`);
    if (sel >= 6) sel = 0;
    P.slice(0, 6).forEach((p, i) => {
      const b = h(`<button class="pupil-chip ${i === sel ? 'on' : ''}" type="button"><span class="av" style="background:${p.colour}">${esc(p.name[0])}</span>${esc(p.name)}${p.strip.length ? emo('🧩', 'coded') : ''}</button>`);
      b.addEventListener('click', () => { sel = i; drawBody(); sfx.tap(); });
      chips.append(b);
    });
    const strip = h(`<div class="strip"></div>`);
    const st = S.pupils[sel].strip || (S.pupils[sel].strip = []);
    strip.innerHTML = `<div class="ctile start">${emo('🚩')}<span>Start</span></div>` + st.map((t, i) => tileHTML(t, i, running && day.pupils[sel]?.tileNow === i ? 'now' : '')).join('') +
      (st.length < MAX_TILES ? `<div style="color:var(--ink-3);font-size:16px;padding:0 10px">${st.length ? 'Tap a tile to take it off.' : `Tap the tiles below to tell ${esc(P[sel].name)} what to do.`}</div>` : '');
    strip.querySelectorAll('.ctile[data-i]').forEach(b => b.addEventListener('click', () => {
      if (running) return;
      const i = +b.dataset.i;
      st.splice(i, 1); store.save(); sfx.thud(); drawBody(); api.emit('codeChange', { pupil: sel, strip: [...st] });
    }));
    const actions = h(`<div class="row" style="gap:8px"></div>`);
    const right = h(`<div style="display:flex;gap:8px;margin-left:auto"></div>`);
    const tryBtn = h(`<button class="btn go big gobtn" type="button" ${st.length ? '' : 'disabled'} aria-label="Go: try ${esc(P[sel].name)}'s code">${icon('play')} Go!</button>`);
    tryBtn.addEventListener('click', () => askPredict());
    const clr = h(`<button class="btn ghost small" type="button" ${st.length ? '' : 'disabled'}>${icon('trash')} Clear</button>`);
    clr.addEventListener('click', () => { st.length = 0; store.save(); drawBody(); api.emit('codeChange', { pupil: sel, strip: [] }); });
    // With one pupil everything fits on the top bar; with a class, the pupils get their own row.
    if (opts.codeOnly || P.length < 2) { pslot.append(chips); if (!running) codeact.append(clr, tryBtn); body.append(strip); }
    else { right.append(clr, tryBtn); if (running) right.innerHTML = ''; actions.append(chips, right); body.append(actions, strip); }
    // Tiles, in two labelled rows: places to go, and things to do.
    const tray = h(`<div class="ctray rows"></div>`);
    const rooms = [...new Set(roomGroups(api.idx).map(g => g.room))].filter(r => !['stairs', 'bridge', 'slide'].includes(r));
    const groups = [
      ['go', ['go:gate', ...rooms.map(r => `go:${r}`)]],
      ['do', ACTIVITY_ORDER.map(a => `do:${a}`)],
      ['wait', ['wait:bell', 'wait:short']],
      ['again', ['again:2', 'again:3', 'again:forever']],
    ];
    const rowGo = h(`<div class="trow"><span class="tlabel">${emo('🚶')}<b>Go to</b></span></div>`);
    const rowDo = h(`<div class="trow"><span class="tlabel">${emo('🤸')}<b>Do</b></span></div>`);
    tray.append(rowGo, rowDo);
    for (const [kind, list] of groups) {
      const g = h(`<div class="grp"></div>`);
      (kind === 'go' ? rowGo : rowDo).append(g);
      for (const t of list) {
        const b = h(tileHTML(t, -1, 'small'));
        b.addEventListener('click', () => {
          if (running) return;
          say(tileSay(t));
          if (st.length >= MAX_TILES) { sfx.no(); toast('That is a long program! Take a tile off first.'); return; }
          st.push(t); store.save(); sfx.pop(); drawBody(); api.emit('codeChange', { pupil: sel, strip: [...st] });
        });
        g.append(b);
      }
    }
    body.append(tray);
    // Drag to reorder (SortableJS), if it loads.
    import('sortablejs').then(m => {
      const Sortable = m.default || m.Sortable;
      if (!Sortable || !strip.isConnected) return;
      Sortable.create(strip, { draggable: '.ctile[data-i]', animation: 150, forceFallback: true, delayOnTouchOnly: true, delay: 120, touchStartThreshold: 6,
        onEnd: e => {
          const from = e.oldDraggableIndex, to = e.newDraggableIndex;
          if (from === to || from === undefined) return;
          const [t] = st.splice(from, 1); st.splice(to, 0, t); store.save(); drawBody(); api.emit('codeChange', { pupil: sel, strip: [...st] });
        } });
    }).catch(() => {});
  }

  function drawTimetable() {
    body.append(h(`<p class="muted" style="margin:0;font-size:18px">Pupils without code follow the bells. Tap a bell at the top, then choose what happens. Now choosing for bell ${bellPick + 1}.</p>`));
    const row = h(`<div class="ctray"></div>`);
    for (const a of ACTIVITY_ORDER) {
      const b = h(`<button class="ctile do small ${S.bells[bellPick] === a ? 'now' : ''}" type="button">${emo(ACTIVITIES[a].emoji)}<span>${esc(ACTIVITIES[a].name)}</span></button>`);
      b.addEventListener('click', () => { S.bells[bellPick] = a; store.save(); sfx.pop(); say(`Bell ${bellPick + 1}: ${ACTIVITIES[a].name}.`); bellPick = (bellPick + 1) % BELLS; drawBells(); drawBody(); api.emit('bellSet', { bells: [...S.bells] }); });
      row.append(b);
    }
    body.append(row);
  }

  let lastReport = null;
  function drawReport() {
    const r = lastReport;
    const box = h(`<div class="report"></div>`);
    const head = h(`<div class="row"><h3 style="flex:1">${r.title}</h3></div>`);
    const sp = h(`<button class="speak-btn" type="button" aria-label="Read the report">${icon('speaker')}</button>`);
    sp.addEventListener('click', () => say([r.title, ...r.lines.map(l => l.text), r.question].join(' '), sp));
    const again = h(`<button class="btn go small" type="button">${icon('refresh')} Run it again</button>`);
    again.addEventListener('click', () => startRun(r.mode));
    const back = h(`<button class="btn ghost small" type="button">${icon('back')} Back</button>`);
    back.addEventListener('click', () => { tab = r.mode === 'try' ? 'code' : 'code'; drawBody(); });
    head.append(sp, back, again);
    box.append(head);
    const grid = h(`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;max-height:210px;overflow-y:auto"></div>`);
    for (const l of r.lines) grid.append(h(`<div class="line ${l.kind === 'good' ? 'good' : l.kind === 'fix' ? 'fix' : ''}">${emo(l.emoji)}<span>${esc(l.text)}</span></div>`));
    box.append(grid);
    box.append(h(`<div class="line" style="background:var(--blue-soft)">${emo('💬')}<span><b>Talk about it:</b> ${esc(r.question)}</span></div>`));
    body.append(box);
  }

  // ---------- Predict, then Go ----------
  function askPredict() {
    const P = pupils();
    const rooms = [...new Set(roomGroups(api.idx).map(g => g.room))].filter(r => !['stairs', 'bridge'].includes(r));
    body.innerHTML = '';
    const q = h(`<div style="display:flex;flex-direction:column;gap:10px"><div class="row"><h3 style="flex:1">${emo('🤔')} Where will ${esc(P[sel].name)} end up?</h3></div><div class="ctray"></div></div>`);
    const skip = h(`<button class="btn ghost small" type="button">Just go!</button>`);
    skip.addEventListener('click', () => { predicted = null; startRun('try'); });
    q.querySelector('.row').append(skip);
    const row = q.querySelector('.ctray');
    for (const r of ['gate', ...rooms]) {
      const b = h(`<button class="opt" type="button">${emo(r === 'gate' ? '🚪' : ROOMS[r].emoji)}<span>${esc(r === 'gate' ? 'Gate' : ROOMS[r].name)}</span></button>`);
      b.addEventListener('click', () => { predicted = r; sfx.tap(); startRun('try'); });
      row.append(b);
    }
    body.append(q);
    say(`Where do you think ${P[sel].name} will end up? Tap your guess.`);
  }

  // ---------- Running ----------
  function startRun(mode) {
    hush();
    const P = pupils();
    day = new Day(api.idx, P, S.bells, mode === 'try' ? { onlyPupil: P[sel].name, mode: 'try' } : {});
    running = true; paused = false;
    if (mode === 'day') { tab = 'code'; sfx.bell(); sayAuto('The school day begins!'); }
    else sfx.whoosh();
    view.ensure(day.pupils).then(() => day.start());
    drawCtl(); drawBells(); drawBody();
    api.emit(mode === 'try' ? 'tryStart' : 'dayStart');
  }
  function stopRun() {
    running = false;
    day = new Day(api.idx, pupils(), S.bells, {});
    drawCtl(); drawBells(); drawBody();
  }
  let lastBell = -1, lastTile = -1;
  const tick = (dt) => {
    if (!running || paused) { view.update(day, dt, { selected: pupils()[sel]?.name, names: !running }); return; }
    let t = dt * speed;
    while (t > 0) { const s = Math.min(0.08, t); day.step(s); t -= s; }
    view.update(day, dt * speed, { selected: day.mode === 'try' ? pupils()[sel].name : null, names: false });
    if (day.mode === 'day') {
      const left = Math.max(0, PERIOD - (day.t % PERIOD));
      clock.textContent = day.bell < BELLS ? `Bell ${day.bell + 1} of ${BELLS}` : 'Home time';
      if (day.bell !== lastBell) {
        lastBell = day.bell;
        drawBells();
        if (day.bell > 0 && day.bell < BELLS) { sfx.bell(); const a = S.bells[day.bell]; sayAuto(`Bell! Time for ${ACTIVITIES[a]?.name.toLowerCase()}.`); }
        if (day.bell >= BELLS) sayAuto('Home time!');
      }
      void left;
    } else {
      const p = day.pupils[sel];
      clock.textContent = p ? `${p.name}'s code` : '';
      if (p && p.tileNow !== lastTile) {
        lastTile = p.tileNow;
        body.querySelectorAll('.strip .ctile[data-i]').forEach(b => b.classList.toggle('now', +b.dataset.i === p.tileNow));
        if (p.tileNow >= 0) sfx.step();
      }
      if (p && p.stuck) body.querySelectorAll('.strip .ctile[data-i]').forEach(b => b.classList.toggle('bad', +b.dataset.i === p.stuckAt[p.stuckAt.length - 1]?.tile));
    }
    if (day.over) finishRun();
  };
  world.updaters.add(tick);

  function finishRun() {
    running = false;
    const r = report(day);
    const P = pupils();
    if (day.mode === 'try') {
      const p = day.pupils[sel];
      const ended = p.ended || (p.stuck ? null : 'outside');
      let title = `${p.name}'s code`;
      if (predicted) {
        const hit = predicted === ended;
        const where = predicted === 'gate' ? 'the gate' : `the ${ROOMS[predicted]?.name.toLowerCase()}`;
        r.lines.unshift({ kind: hit ? 'good' : 'info', emoji: hit ? '🎯' : '🔍', text: hit ? `You guessed ${where}. Spot on!` : `You guessed ${where}. Can you see what happened?` });
        title = hit ? 'Spot on!' : `${p.name}'s code`;
      }
      lastReport = { ...r, title, mode: 'try' };
      api.emit('tryDone', { pupil: sel, name: p.name, ended, did: { ...p.did }, stuck: p.stuckAt.length > 0, predicted, strip: [...(S.pupils[sel].strip || [])] });
    } else {
      store.set({ days: (S.days || 0) + 1 });
      store.addLog(api.ctx.missionId || '', `School day: ${r.lines.map(l => l.text).join(' ')}`);
      lastReport = { ...r, title: 'School report', mode: 'day' };
      api.setTraffic && api.setTraffic(day.traffic);
      sfx.tada();
      api.emit('dayDone', { report: r, day });
    }
    tab = 'report';
    drawCtl(); drawBells(); drawBody();
    sayAuto([lastReport.title, ...lastReport.lines.slice(0, 3).map(l => l.text), lastReport.question].join(' '));
    void P;
  }

  function close() {
    ro.disconnect();
    offChange();
    world.setViewShift(0);
    api.setCutaway(false);
    world.updaters.delete(tick);
    view.clear();
    el.remove();
    lrail.style.display = oldL;
    rrail.style.display = oldR;
    if (tright) tright.style.display = oldT;
    hush();
    opts.onClose && opts.onClose();
  }

  if (opts.codeOnly) bellsEl.style.display = 'none';
  drawBells(); drawCtl(); drawBody();
  clock.textContent = '';
  if (opts.autoplay) startRun('day');
  return { close, get running() { return running; }, get sim() { return day; }, startRun, selectPupil(i) { sel = i; drawBody(); } };
}
