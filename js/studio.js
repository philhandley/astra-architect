// The Studio: Finn's building screen. Used full screen (free build) and inside missions with a preset.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { store } from './core/store.js';
import { ROOMS, FORMS, TRAY, GROUPS, PAINT, LEVEL_H, MAX_LEVEL, MATERIALS, MATERIAL_ORDER, WISHES, FEATURES, formCells } from './core/catalogue.js';
import { loadSite, site, cellGround, ZONE_NAMES, zone } from './core/site.js';
import { indexDesign, placeCheck, stackLevel, REASONS, footprint, key, roomGroups, mood, bounds, DIRS } from './core/design.js';
import { getWorld, CLIP, clipPlane } from './core/scene.js';
import { buildTerrain } from './core/terrain.js';
import { DesignView } from './core/build3d.js';
import { formGeometry, placeObject, ghostMaterial } from './core/forms3d.js';
import { computeDoors } from './core/arch.js';
import { drawPlan, loadMapImage, fitView } from './core/plan2d.js';
import { checkBrief, HINTS } from './core/brief.js';
import { emo, emojiFile } from './core/emoji.js';
import { icon } from './core/icons.js';
import { formIcon } from './ui/formicons.js';
import { h, esc, say, sayAuto, hush, toast, sfx, clamp } from './ui/dom.js';

const NEEDS_TURN = new Set(['long', 'slab', 'arch', 'curve', 'wedge', 'steps', 'roof']);

export async function mountStudio(host, opts = {}) {
  const preset = opts.preset || {};
  const ctx = opts.ctx || {};
  await loadSite();
  const world = getWorld();
  const root = h(`<div class="studio">
    <div class="viewport"><canvas class="plan-canvas"></canvas></div>
    <aside class="rail left"><div class="tray"></div></aside>
    <aside class="rail right"></aside>
    <div class="topstrip"></div>
  </div>`);
  host.appendChild(root);
  const viewport = root.querySelector('.viewport');
  const planCanvas = root.querySelector('.plan-canvas');
  world.attach(viewport);
  const terrain = await buildTerrain(world);
  if (!world.designView) world.designView = new DesignView(world);
  const dv = world.designView;

  // ---------- State ----------
  const S = {
    design: store.state.design,
    idx: null,
    doors: null,
    mode: preset.mode || store.modLoad('studio', 'mode') || 'blocks',
    view: 'model',
    tool: null,          // room id, or null for the hand
    rot: 0,
    ghost: null,         // { cell, ok, why }
    selected: null,      // design id
    moving: null,        // design id being moved
    faces: preset.full ? !!store.modLoad('studio', 'faces') : !!preset.faces,
    form: null,          // the shape chosen for the current room tool
    iso: preset.iso ?? true,
    floor: 0,
    brief: {},
    history: [],
    events: [],
    destroyed: false,
  };
  const listeners = new Map();
  const on = (ev, fn) => { if (!listeners.has(ev)) listeners.set(ev, new Set()); listeners.get(ev).add(fn); return () => listeners.get(ev).delete(fn); };
  const emit = (ev, data = {}) => {
    S.events.push(ev);
    for (const fn of listeners.get(ev) || []) try { fn(data); } catch (e) { console.error(e); }
    for (const fn of listeners.get('*') || []) try { fn(ev, data); } catch (e) { console.error(e); }
  };
  const allowed = preset.rooms ? new Set(preset.rooms) : null;

  // ---------- Design changes ----------
  function refresh({ silent = false } = {}) {
    S.idx = indexDesign(S.design);
    S.doors = computeDoors(S.idx);
    dv.sync(S.idx, S.cutaway ? 'cutaway' : S.mode);
    // Trees hop aside from buildings and the cells around them, like a cleared plot.
    const occ = new Set();
    for (const c of S.design.cells) for (const p of footprint(c)) if (p.level === 0) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) occ.add(`${p.x + dx},${p.z + dz}`);
    terrain.trees.sync([...occ]);
    const b = bounds(S.design);
    if (b) world.focusShadows(b.cx, b.cz, Math.max(b.x1 - b.x0, b.z1 - b.z0) / 2 + 6);
    store.set({ design: S.design });
    updateFaces();
    updateBrief(silent);
    if (S.view === 'plan') drawPlanView();
    if (S.selected && !S.idx.byId.has(S.selected)) select(null);
    emit('change');
  }
  function snapshot() {
    S.history.push(JSON.stringify(S.design.cells));
    if (S.history.length > 60) S.history.shift();
  }
  function undo() {
    if (!S.history.length) { toast('Nothing to undo'); return; }
    S.design.cells = JSON.parse(S.history.pop());
    clearGhost(); select(null);
    refresh();
    sfx.tap();
    emit('undo');
  }

  function addCell(c) {
    snapshot();
    const cell = { id: S.design.nextId++, form: c.form, room: c.room, x: c.x, z: c.z, level: c.level, rot: c.rot || 0, material: c.material || 'colour', colour: c.colour || null };
    S.design.cells.push(cell);
    refresh();
    sfx.pop();
    emit('build', { cell });
    const seenKey = 'seen:' + cell.room;
    if (!store.modLoad('studio', seenKey)) { store.modSave('studio', seenKey, 1); sayAuto(ROOMS[cell.room].card); }
    return cell;
  }

  function removeCell(id) {
    const c = S.idx.byId.get(id);
    if (!c) return;
    snapshot();
    // Anything that was sitting on it tumbles off too.
    const gone = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      const idx = indexDesign({ cells: S.design.cells.filter(x => !gone.has(x.id)) });
      for (const o of S.design.cells) {
        if (gone.has(o.id) || o.level === 0) continue;
        const r = placeCheck(idx, o, o.id);
        if (!r.ok && (r.why === 'float' || r.why === 'cap')) { gone.add(o.id); changed = true; }
      }
    }
    S.design.cells = S.design.cells.filter(x => !gone.has(x.id));
    select(null);
    refresh();
    sfx.thud();
    if (gone.size > 1) toast('Everything on top came off too. Tap Undo to bring it back.');
    emit('remove', { cell: c });
  }

  // ---------- Layout: tray ----------
  const tray = root.querySelector('.tray');
  function drawTray() {
    const allowedRooms = TRAY.filter(r => !allowed || allowed.has(r));
    tray.innerHTML = '';
    const hand = h(`<button class="tile-btn tool ${S.tool === null ? 'on' : ''}" type="button">${icon('hand')}<span>Pick</span></button>`);
    hand.addEventListener('click', () => setTool(null));
    const bin = h(`<button class="tile-btn tool bin ${S.tool === 'bin' ? 'on' : ''}" type="button">${icon('trash')}<span>Bin</span></button>`);
    bin.addEventListener('click', () => setTool(S.tool === 'bin' ? null : 'bin'));
    tray.append(hand, bin);
    const groups = allowedRooms.length > 6 ? GROUPS : [{ name: 'Rooms', rooms: allowedRooms }];
    for (const grp of groups) {
      const rooms = grp.rooms.filter(r => allowedRooms.includes(r));
      if (!rooms.length) continue;
      if (groups.length > 1) tray.append(h(`<div class="tt">${esc(grp.name)}</div>`));
      for (const id of rooms) {
        const R = ROOMS[id];
        const b = h(`<button class="tile-btn ${S.tool === id ? 'on' : ''}" type="button" data-room="${id}"><span class="blk">${formIcon(R.form, 'iso', R.colour)}${emo(R.emoji, 'stk')}</span><span class="lbl">${esc(R.name)}</span></button>`);
        b.addEventListener('click', () => setTool(S.tool === id ? null : id));
        tray.append(b);
      }
    }
  }
  function setTool(id) {
    S.tool = id;
    S.moving = null;
    S.form = id && ROOMS[id] ? (preset.formFor?.[id] || ROOMS[id].form) : null;
    S.rot = 0;
    clearGhost();
    select(null);
    drawTray();
    drawShapeStrip();
    if (id) { sfx.tap(); say(id === 'bin' ? 'Tap a block to take it away.' : `${ROOMS[id].name}. Tap where it should go.`); }
    emit('tool', { tool: id });
  }

  // ---------- Layout: right rail ----------
  const rail = root.querySelector('.rail.right');
  const tools = preset.tools || ['views', 'mode', 'faces', 'sun', 'undo', 'zoom', 'day'];
  const rb = (ic, label, fn, cls = '') => { const b = h(`<button class="rbtn ${cls}" type="button" aria-label="${esc(label)}">${icon(ic)}<span>${esc(label)}</span></button>`); b.addEventListener('click', fn); return b; };
  const viewBtns = {};
  let modeBtn, facesBtn, sunBtn, floorGroup;
  function drawRail() {
    rail.innerHTML = '';
    if (tools.includes('views')) {
      const g = h(`<div class="rgroup"></div>`);
      for (const [v, ic, label] of [['model', 'model', 'Model'], ['plan', 'plan', 'Plan'], ['section', 'section', 'Section'], ['walk', 'walk', 'Walk']]) {
        if (preset.views && !preset.views.includes(v)) continue;
        viewBtns[v] = rb(ic, label, () => setView(v), S.view === v ? 'on' : '');
        g.append(viewBtns[v]);
      }
      rail.append(g);
    }
    if (tools.includes('mode')) {
      modeBtn = rb(S.mode === 'blocks' ? 'blocks' : 'building', S.mode === 'blocks' ? 'Blocks' : 'Building', () => setMode(S.mode === 'blocks' ? 'building' : 'blocks'));
      rail.append(modeBtn);
    }
    if (tools.includes('faces')) { facesBtn = rb('faces', 'Faces', () => setFaces(!S.faces), S.faces ? 'on' : ''); rail.append(facesBtn); }
    if (tools.includes('sun')) { sunBtn = rb('sun', 'Sun', toggleSun); rail.append(sunBtn); }
    floorGroup = h(`<div class="rgroup" style="display:none"></div>`);
    floorGroup.append(rb('up', 'Up', () => setFloor(S.floor + 1)), h(`<div class="rbtn floor-n" style="min-height:40px;font-size:15px">Ground</div>`), rb('down', 'Down', () => setFloor(S.floor - 1)));
    rail.append(floorGroup);
    rail.append(h(`<div class="rspacer"></div>`));
    if (preset.full) {
      rail.append(rb('bubbles', 'Bubbles', () => { const on = !S.bubbles; if (on && S.view !== 'plan') setView('plan'); api.setBubbles(on); if (on) say('A bubble diagram: every room is a bubble. Green lines join rooms that like each other, red lines join rooms that do not.'); emit('bubbles', { on }); }));
    }
    if (tools.includes('day')) rail.append(rb('bell', 'Day', () => openDay(), 'day-btn'));
    // Undo and zoom sit in a row at the top right, so the rail fits on a tablet.
    topRight.innerHTML = '';
    if (tools.includes('undo')) topRight.append(rb('undo', 'Undo', undo));
    if (tools.includes('zoom')) topRight.append(rb('zoomIn', 'Closer', () => zoom(0.75)), rb('zoomOut', 'Further', () => zoom(1.33)));
    if (preset.full) {
      topRight.append(rb('ideas', 'Ideas', () => import('./ui/ideas.js').then(m => m.openIdeas())));
      topRight.append(rb('image', 'Sheet', () => import('./ui/sheet.js').then(m => m.openSheet({ onMade: () => emit('sheet') }))));
    }
  }
  const topRight = h(`<div class="topright"></div>`);
  root.appendChild(topRight);

  // ---------- Top strip: brief chips and sun ----------
  const top = root.querySelector('.topstrip');
  const chips = h(`<div class="brief-chips"></div>`);
  const sunPill = h(`<div class="pill" style="display:none">${emo('🌅')}<input type="range" min="0" max="1000" aria-label="Move the sun">${emo('🌇')}</div>`);
  if (preset.brief !== false) top.append(chips);
  top.append(sunPill);
  const shapeStrip = h(`<div class="shape-strip" style="display:none"></div>`);
  top.append(shapeStrip);
  function drawShapeStrip() {
    const R = S.tool && ROOMS[S.tool];
    const turnable = S.form && (NEEDS_TURN.has(S.form) || S.form === 'curve');
    if (!R || (R.forms.length < 2 && !turnable)) { shapeStrip.style.display = 'none'; shapeStrip.innerHTML = ''; return; }
    shapeStrip.style.display = '';
    shapeStrip.innerHTML = `<span class="tt">Shape</span>`;
    for (const f of R.forms) {
      const b = h(`<button class="shape-btn ${S.form === f ? 'on' : ''}" type="button" aria-label="${esc(FORMS[f].name)}">${formIcon(f, 'iso', R.colour)}<span>${esc(FORMS[f].name)}</span></button>`);
      if (S.form === f) b.querySelector('svg').style.transform = `rotate(${S.rot * 90}deg)`;
      b.addEventListener('click', () => { S.form = f; S.rot = 0; drawShapeStrip(); sfx.tap(); say(FORMS[f].good); emit('shapePick', { form: f }); });
      shapeStrip.append(b);
    }
    if (turnable) {
      const t = h(`<button class="shape-btn turn" type="button" aria-label="Turn">${icon('rotate')}<span>Turn</span></button>`);
      t.addEventListener('click', () => { S.rot = (S.rot + 1) & 3; drawShapeStrip(); sfx.tap(); emit('turn'); });
      shapeStrip.append(t);
    }
  }
  const sunInput = sunPill.querySelector('input');
  sunInput.value = Math.round((S.design.sun ?? 0.32) * 1000);
  world.setSun(S.design.sun ?? 0.32);
  sunInput.addEventListener('input', () => { const t = sunInput.value / 1000; world.setSun(t); S.design.sun = t; store.save(); emit('sun', { t }); });
  function toggleSun(force) {
    const show = typeof force === 'boolean' ? force : sunPill.style.display === 'none';
    sunPill.style.display = show ? '' : 'none';
    sunBtn && sunBtn.classList.toggle('on', show);
    if (show) say('Slide the sun from morning to evening. Watch the shadows move!');
  }

  function updateBrief(silent) {
    const ids = preset.briefIds || store.state.brief;
    const res = checkBrief(S.idx, ids);
    chips.innerHTML = '';
    for (const id of ids) {
      const W = WISHES[id];
      if (!W) continue;
      const b = h(`<button class="brief-chip ${res[id] ? 'done' : ''}" type="button" aria-label="${esc(W.name)}">${emo(W.emoji)}</button>`);
      b.addEventListener('click', () => { sfx.tap(); say(res[id] ? `${W.name}. Done!` : `${W.name}. ${HINTS[id] || ''}`); });
      if (res[id] && S.brief[id] === false && !silent) {
        b.classList.add('pop');
        sfx.chime();
        toast(`Wish granted: ${W.name}!`, W.emoji);
        sayAuto(`Wish granted! ${W.name}.`);
        emit('brief', { id, done: true });
      }
      chips.append(b);
    }
    S.brief = res;
  }

  // ---------- Faces (room moods) ----------
  const faceObjs = [];
  function setFaces(on) {
    S.faces = on;
    if (preset.full) store.modSave('studio', 'faces', on);
    facesBtn && facesBtn.classList.toggle('on', on);
    updateFaces();
    if (on) say('Every room has a face. Tap a face to find out how it feels.');
    emit('faces', { on });
  }
  function clearFaceObjs() { for (const o of faceObjs) dropLabel(o); faceObjs.length = 0; }
  function updateFaces() {
    clearFaceObjs();
    if (!S.faces || S.view === 'plan' || S.view === 'walk') { if (S.view === 'plan') drawPlanView(); return; }
    for (const g of roomGroups(S.idx)) {
      if (['stairs', 'bridge', 'slide'].includes(g.room)) continue;
      const m = mood(S.idx, g);
      const el = h(`<div class="label3d"><div class="face3d ${m.face}">${emo(m.face === 'happy' ? '😊' : m.face === 'sad' ? '😟' : '🙂')}</div></div>`);
      el.addEventListener('pointerdown', e => e.stopPropagation());
      el.addEventListener('click', e => { e.stopPropagation(); sfx.tap(); say(moodSentence(g, m)); emit('faceTap', { room: g.room }); });
      const o = new CSS2DObject(el);
      const cx = g.cells.reduce((a, p) => a + p.x + 0.5, 0) / g.cells.length, cz = g.cells.reduce((a, p) => a + p.z + 0.5, 0) / g.cells.length;
      let topL = g.level;
      for (const p of g.cells) { let l = g.level; while (S.idx.occ.has(key(p.x, p.z, l + 1))) l++; topL = Math.max(topL, l); }
      o.position.set(cx, (topL + 1) * LEVEL_H + 0.35, cz);
      world.groups.lab.add(o);
      faceObjs.push(o);
    }
  }
  function moodSentence(g, m) {
    const R = ROOMS[g.room];
    const nameOf = id => ROOMS[id] ? `the ${ROOMS[id].name.toLowerCase()}` : FEATURES[id] ? FEATURES[id].name : id;
    if (m.face === 'sad') return `The ${R.name.toLowerCase()} is sad. It does not like being next to ${m.disliked.map(nameOf).join(' and ')}.`;
    if (m.face === 'happy') return `The ${R.name.toLowerCase()} is happy. It loves ${m.liked.map(nameOf).join(' and ')}.`;
    const wants = R.likes.slice(0, 2).map(nameOf).join(' or ');
    return wants ? `The ${R.name.toLowerCase()} is OK. It would love ${wants}.` : `The ${R.name.toLowerCase()} is happy anywhere.`;
  }

  // ---------- Ghost (placement preview) ----------
  const ghostGroup = world.groups.ghost;
  let ghostMesh = null, ghostTag = null, floatbar = null;
  function dropLabel(o) {
    if (!o) return;
    o.element.remove();
    try { o.parent && o.parent.remove(o); } catch (e) { /* label never drawn */ }
  }
  function clearGhost() {
    S.ghost = null;
    hideFloatbar();
    if (ghostMesh) { ghostGroup.remove(ghostMesh); ghostMesh = null; }
    dropLabel(ghostTag); ghostTag = null;
    if (S.view === 'plan') drawPlanView();
  }
  function bestRot(form, x, z, level) {
    if (form !== 'wedge') return S.rot;
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    for (let r = 0; r < 4; r++) {
      const [dx, dz] = dirs[r];
      const n = S.idx.occ.get(key(x + dx, z + dz, level));
      if (n && FORMS[n.form].top === 'flat' && !S.idx.occ.has(key(x + dx, z + dz, level + 1))) return r;
      if (n && S.idx.occ.has(key(x + dx, z + dz, level + 1))) return r;
    }
    return S.rot;
  }
  function showGhost(x, z, level, { form, room, rot, ignoreId = null } = {}) {
    const R = ROOMS[room];
    form = form || R.form;
    rot = rot ?? bestRot(form, x, z, level);
    const cell = { id: -1, form, room, x, z, level, rot, material: 'colour', colour: S.moving ? (S.idx.byId.get(S.moving)?.colour || null) : null };
    let chk = placeCheck(S.idx, cell, ignoreId);
    // A long shape that does not fit this way round may fit turned.
    if (!chk.ok && formCells(form, 0).length > 1) {
      for (let k = 1; k < 4; k++) {
        const alt = { ...cell, rot: (rot + k) & 3 };
        const c2 = placeCheck(S.idx, alt, ignoreId);
        if (c2.ok) { cell.rot = alt.rot; chk = c2; break; }
      }
    }
    S.ghost = { cell, ok: chk.ok, why: chk.why, ignoreId };
    if (ghostMesh) ghostGroup.remove(ghostMesh);
    ghostMesh = new THREE.Mesh(formGeometry(form, 'blocks'), ghostMaterial(chk.ok));
    ghostMesh.scale.set(1.02, 1.02, 1.02);
    placeObject(ghostMesh, cell, level === 0 ? cellGround(x, z) : 0);
    ghostGroup.add(ghostMesh);
    // Preview how the new room would feel.
    let tagHtml;
    if (chk.ok) {
      const others = S.design.cells.filter(c => c.id !== ignoreId);
      const idx2 = indexDesign({ cells: [...others, cell] });
      const g = roomGroups(idx2).find(gr => gr.room === room && gr.level === level && gr.cells.some(p => p.x === x && p.z === z) || gr.forms.has(-1));
      const m = g ? mood(idx2, g) : { face: 'ok', liked: [], disliked: [] };
      const fe = m.face === 'happy' ? '😊' : m.face === 'sad' ? '😟' : '🙂';
      const why = m.face === 'sad' ? `Not next to ${shortName(m.disliked[0])}!` : m.face === 'happy' ? `Loves ${shortName(m.liked[0])}` : R.name;
      tagHtml = `<div class="ghost-tag">${emo(fe)}<span>${esc(why)}</span></div>`;
      S.ghost.mood = m;
    } else {
      tagHtml = `<div class="ghost-tag" style="color:#c62828">${emo('🚫')}<span>${esc(shortWhy(chk.why))}</span></div>`;
    }
    dropLabel(ghostTag);
    const el = h(`<div class="label3d">${tagHtml}</div>`);
    ghostTag = new CSS2DObject(el);
    const hgt = FORMS[form].levels * LEVEL_H;
    ghostTag.position.set(ghostMesh.position.x, ghostMesh.position.y + hgt + 0.3, ghostMesh.position.z);
    world.groups.lab.add(ghostTag);
    if (S.view === 'plan') drawPlanView();
    emit('ghost', { ok: chk.ok });
  }
  const shortName = id => ROOMS[id] ? ROOMS[id].name.toLowerCase() : FEATURES[id] ? FEATURES[id].name : id;
  const shortWhy = why => ({ taken: 'Something is there', water: 'That is water', rock: 'Too rocky', slope: 'Too steep', edge: 'Off the map', float: 'Needs something under it', high: 'Too high', cap: 'Cannot go on that' }[why] || 'Will not fit');

  function confirmGhost() {
    const gh = S.ghost;
    if (!gh) return;
    if (!gh.ok) { sfx.no(); say(REASONS[gh.why] || 'That will not fit there.'); shakeGhost(); return; }
    if (S.moving) {
      snapshot();
      const c = S.idx.byId.get(S.moving);
      Object.assign(c, { x: gh.cell.x, z: gh.cell.z, level: gh.cell.level, rot: gh.cell.rot });
      S.moving = null;
      clearGhost();
      refresh();
      sfx.pop();
      flashMood(c, gh.mood);
      emit('move', { cell: c });
      return;
    }
    const mood = gh.mood;
    const cell = addCell(gh.cell);
    clearGhost();
    flashMood(cell, mood);
  }
  // A wobble when something will not fit, then the ghost goes away.
  function shakeGhost() {
    if (!ghostMesh) return;
    if (S.view === 'plan') { setTimeout(clearGhost, 320); return; }
    const m = ghostMesh, x0 = m.position.x;
    let t = 0;
    const fn = dt => { t += dt; m.position.x = x0 + Math.sin(t * 50) * 0.06 * Math.max(0, 1 - t / 0.35); if (t > 0.35) { world.updaters.delete(fn); if (ghostMesh === m) clearGhost(); } };
    world.updaters.add(fn);
  }
  // A little face and a word above a block that has just been built or moved.
  let flashObj = null, flashTimer = 0;
  function flashMood(cell, m) {
    dropLabel(flashObj); flashObj = null; clearTimeout(flashTimer);
    const R = ROOMS[cell.room];
    const fe = !m ? '✅' : m.face === 'happy' ? '😊' : m.face === 'sad' ? '😟' : '🙂';
    const txt = !m ? R.name : m.face === 'sad' ? `Not next to ${shortName(m.disliked[0])}!` : m.face === 'happy' ? `Loves ${shortName(m.liked[0])}` : R.name;
    const el = h(`<div class="label3d"><div class="ghost-tag flash">${emo(fe)}<span>${esc(txt)}</span></div></div>`);
    flashObj = new CSS2DObject(el);
    const ps = footprint(cell);
    const cx = ps.reduce((a, p) => a + p.x + 0.5, 0) / ps.length, cz = ps.reduce((a, p) => a + p.z + 0.5, 0) / ps.length;
    flashObj.position.set(cx, (cell.level + FORMS[cell.form].levels) * LEVEL_H + 0.35 + (cell.level === 0 ? cellGround(cell.x, cell.z) : 0), cz);
    world.groups.lab.add(flashObj);
    flashTimer = setTimeout(() => { dropLabel(flashObj); flashObj = null; }, 2600);
    if (m && m.face === 'sad') sayAuto(`${txt} Tap it and move it if you like.`);
  }
  function turnGhost() {
    if (!S.ghost) return;
    const c = S.ghost.cell;
    S.rot = (c.rot + 1) & 3;
    showGhost(c.x, c.z, c.level, { form: c.form, room: c.room, rot: S.rot, ignoreId: S.ghost.ignoreId });
    emit('turn');
  }

  // ---------- Floating buttons ----------
  function showFloatbar(kind) {
    hideFloatbar();
    floatbar = h(`<div class="floatbar"></div>`);
    const fb = (html, cls, fn, label) => { const b = h(`<button class="fb ${cls}" type="button" aria-label="${esc(label)}">${html}</button>`); b.addEventListener('pointerdown', e => e.stopPropagation()); b.addEventListener('click', e => { e.stopPropagation(); fn(); }); floatbar.append(b); return b; };
    if (kind === 'select') {
      const c = S.idx.byId.get(S.selected);
      const R = ROOMS[c.room];
      fb(emo(R.emoji), '', () => say(`${R.name}. ${R.card}`), 'About this room');
      if (!['stairs', 'slide', 'climbing', 'lookout'].includes(c.room) && c.form !== 'curve') {
        fb(`${icon('plus')} Bigger`, 'go', () => growRoom(c), 'Bigger');
        if (groupOf(c)?.forms.size > 1) fb(`${icon('minus')} Smaller`, '', () => shrinkRoom(c), 'Smaller');
      }
      if (NEEDS_TURN.has(c.form) || c.form === 'curve') fb(icon('rotate'), '', () => turnSelected(), 'Turn');
      if (R.forms.length > 1) fb(icon('shape'), '', () => openPanel('shape'), 'Change shape');
      fb(icon('paint'), '', () => openPanel('colour'), 'Colour');
      fb(icon('move'), '', () => startMove(), 'Move');
      fb(icon('trash'), 'no', () => removeCell(S.selected), 'Bin');
      fb(icon('close'), '', () => select(null), 'Done');
    }
    viewport.appendChild(floatbar);
    positionFloatbar();
  }
  function hideFloatbar() { if (floatbar) { floatbar.remove(); floatbar = null; } }
  function anchorPoint() {
    if (S.ghost && ghostMesh) return new THREE.Vector3(ghostMesh.position.x, ghostMesh.position.y + FORMS[S.ghost.cell.form].levels * LEVEL_H + 0.1, ghostMesh.position.z);
    if (S.selected) {
      const c = S.idx.byId.get(S.selected);
      const ps = footprint(c);
      const cx = ps.reduce((a, p) => a + p.x + 0.5, 0) / ps.length, cz = ps.reduce((a, p) => a + p.z + 0.5, 0) / ps.length;
      return new THREE.Vector3(cx, (c.level + FORMS[c.form].levels) * LEVEL_H + 0.1 + (c.level === 0 ? cellGround(c.x, c.z) : 0), cz);
    }
    return null;
  }
  function positionFloatbar() {
    if (!floatbar) return;
    let x, y;
    if (S.view === 'plan') {
      const c = S.ghost ? S.ghost.cell : S.idx.byId.get(S.selected);
      if (!c) return;
      const ps = footprint(c);
      const v = planView;
      x = (Math.min(...ps.map(p => p.x)) + Math.max(...ps.map(p => p.x)) + 1) / 2;
      const z = Math.min(...ps.map(p => p.z));
      x = (x - v.x0) * v.s; y = (z - v.z0) * v.s - 14;
    } else {
      const p = anchorPoint();
      if (!p) return;
      const sp = world.toScreen(p);
      x = sp.x; y = sp.y - 64;
    }
    const W = viewport.clientWidth, H = viewport.clientHeight;
    const fw = floatbar.offsetWidth || 300;
    x = clamp(x, fw / 2 + 320, W - fw / 2 - 96);
    y = clamp(y, 150, H - 20);
    floatbar.style.left = x + 'px';
    floatbar.style.top = y + 'px';
  }
  world.updaters.add(positionFloatbar);

  // ---------- Selection ----------
  let selMesh = null;
  function select(id) {
    S.selected = id;
    closePanel();
    if (selMesh) { ghostGroup.remove(selMesh); selMesh = null; }
    if (!id) { hideFloatbar(); if (S.view === 'plan') drawPlanView(); return; }
    const c = S.idx.byId.get(id);
    selMesh = new THREE.Mesh(formGeometry(c.form, 'blocks'), new THREE.MeshBasicMaterial({ color: '#2f6fe4', transparent: true, opacity: 0.28, depthWrite: false }));
    selMesh.scale.setScalar(1.06);
    placeObject(selMesh, c, c.level === 0 ? cellGround(c.x, c.z) : 0);
    ghostGroup.add(selMesh);
    showFloatbar('select');
    sfx.tap();
    if (S.view === 'plan') drawPlanView();
    emit('select', { cell: c });
  }
  function turnSelected() {
    const c = S.idx.byId.get(S.selected);
    for (let k = 1; k <= 3; k++) {
      const cand = { ...c, rot: (c.rot + k) & 3 };
      if (placeCheck(S.idx, cand, c.id).ok) { snapshot(); c.rot = cand.rot; refresh(); select(c.id); sfx.pop(); emit('turn'); return; }
    }
    sfx.no(); say('There is no room to turn it here.');
  }
  // Rooms grow a block at a time, like dragging out a pool in SimCity: the long side first, next to the tapped block.
  function groupOf(c) { return roomGroups(S.idx).find(g => g.forms.has(c.id)); }
  function growRoom(c) {
    const g = groupOf(c);
    if (!g) return;
    const xs = g.cells.map(p => p.x), zs = g.cells.map(p => p.z);
    const w = Math.max(...xs) - Math.min(...xs) + 1, d = Math.max(...zs) - Math.min(...zs) + 1;
    const dirs = w >= d ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[0, 1], [0, -1], [1, 0], [-1, 0]];
    const fc = formCells(c.form, c.rot);
    const fw = Math.max(...fc.map(p => p[0])) + 1, fd = Math.max(...fc.map(p => p[1])) + 1;
    const anchors = [c, ...S.design.cells.filter(o => g.forms.has(o.id) && o.id !== c.id)];
    for (const [dx, dz] of dirs) for (const a of anchors) {
      const cand = { form: c.form, room: c.room, level: c.level, rot: c.rot, material: c.material, colour: c.colour, id: -1, x: a.x + dx * fw, z: a.z + dz * fd };
      if (placeCheck(S.idx, cand).ok) {
        const cell = addCell(cand);
        select(c.id);
        flashMood(cell, null);
        emit('grow', { cell });
        return;
      }
    }
    sfx.no(); say('There is no room to make it bigger here. Try turning it, or moving something.');
  }
  function shrinkRoom(c) {
    const g = groupOf(c);
    if (!g || g.forms.size < 2) { sfx.no(); say('That is as small as it goes. Use the bin to take it away.'); return; }
    const ids = [...g.forms].filter(id => id !== c.id).sort((a, b) => b - a);
    removeCell(ids[0]);
    if (S.idx.byId.has(c.id)) select(c.id);
    emit('shrink', { cell: c });
  }
  function startMove() {
    const c = S.idx.byId.get(S.selected);
    S.moving = c.id;
    S.tool = null;
    S.rot = c.rot;
    select(null);
    drawTray();
    say('Tap where it should go.');
  }

  // ---------- Panels: shape and paint ----------
  let panel = null;
  function closePanel() { if (panel) { panel.remove(); panel = null; } }
  function openPanel(kind) {
    closePanel();
    const c = S.idx.byId.get(S.selected);
    if (!c) return;
    const R = ROOMS[c.room];
    const title = kind === 'shape' ? `Shape for the ${R.name.toLowerCase()}` : `Colour for the ${R.name.toLowerCase()}`;
    panel = h(`<div class="sheet-panel"><div class="head"><h3>${esc(title)}</h3></div><div class="optrow"></div></div>`);
    const close = h(`<button class="btn ghost round small" type="button" aria-label="Close">${icon('close')}</button>`);
    close.addEventListener('click', closePanel);
    panel.querySelector('.head').append(close);
    const row = panel.querySelector('.optrow');
    const apply = (fn, ev) => { snapshot(); fn(); refresh(); select(c.id); openPanel(kind); sfx.pop(); emit(ev, { cell: c }); };
    if (kind === 'shape') {
      for (const f of R.forms) {
        const b = h(`<button class="opt ${c.form === f ? 'on' : ''}" type="button">${formIcon(f, 'form', c.colour || R.colour)}<span>${esc(FORMS[f].name)}</span></button>`);
        b.addEventListener('click', () => {
          say(FORMS[f].good);
          if (f === c.form) return;
          for (let r = 0; r < 4; r++) {
            const cand = { ...c, form: f, rot: (c.rot + r) & 3 };
            if (placeCheck(S.idx, cand, c.id).ok) { apply(() => { c.form = f; c.rot = cand.rot; }, 'shape'); return; }
          }
          sfx.no(); say(`A ${FORMS[f].name.toLowerCase()} will not fit here.`);
        });
        row.append(b);
      }
    } else {
      const def = h(`<button class="opt ${!c.colour ? 'on' : ''}" type="button"><span class="sw" style="background:${R.colour}"></span><span>Room colour</span></button>`);
      def.addEventListener('click', () => apply(() => { c.colour = null; }, 'paint'));
      row.append(def);
      for (const pc of PAINT) {
        const b = h(`<button class="opt ${c.colour === pc.hex ? 'on' : ''}" type="button"><span class="sw" style="background:${pc.hex}"></span><span>${esc(pc.name)}</span></button>`);
        b.addEventListener('click', () => apply(() => { c.colour = pc.hex; }, 'paint'));
        row.append(b);
      }
      const mrow = h(`<div class="optrow"></div>`);
      panel.append(h(`<div style="font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)">Made of (shows in Building)</div>`), mrow);
      for (const m of MATERIAL_ORDER) {
        if (m === 'colour') continue;
        const M = MATERIALS[m];
        const b = h(`<button class="opt ${(c.material || 'colour') === m ? 'on' : ''}" type="button">${emo(M.emoji)}<span>${esc(M.name)}</span></button>`);
        b.addEventListener('click', () => { apply(() => { c.material = c.material === m ? 'colour' : m; }, 'paint'); say(M.card); if (S.mode === 'blocks') toast('Switch to Building to see the materials', '🏠'); });
        mrow.append(b);
      }
    }
    root.appendChild(panel);
  }

  // ---------- Picking ----------
  const ray = new THREE.Raycaster();
  function targetFromRay(rc) {
    const objs = [...dv.pickables(), terrain.ground];
    const hits = rc.intersectObjects(objs, true);
    for (const hit of hits) {
      const id = hit.object.userData.cellId ?? findCellId(hit.object);
      const p = hit.point;
      if (id !== undefined && id !== null && S.idx.byId.has(id)) {
        if (S.moving === id) continue;
        const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
        if (n.y > 0.5) {
          const x = Math.floor(p.x), z = Math.floor(p.z);
          return { x, z, level: Math.min(MAX_LEVEL, stackLevel(S.idx, x, z)), hitId: id };
        }
        const x = Math.floor(p.x + n.x * 0.5), z = Math.floor(p.z + n.z * 0.5);
        let level = clamp(Math.floor((p.y - Math.max(0, cellGround(x, z))) / LEVEL_H), 0, MAX_LEVEL);
        if (S.idx.occ.has(key(x, z, level))) level = stackLevel(S.idx, x, z);
        return { x, z, level, hitId: id };
      }
      if (hit.object === terrain.ground) {
        const x = Math.floor(p.x), z = Math.floor(p.z);
        return { x, z, level: stackLevel(S.idx, x, z), hitId: null };
      }
    }
    return null;
  }
  function findCellId(o) { while (o) { if (o.userData && o.userData.cellId !== undefined) return o.userData.cellId; o = o.parent; } return undefined; }

  function handleTap(clientX, clientY) {
    if (S.view === 'section' || S.view === 'walk') {
      if (S.view === 'section') { const t = targetFromRay(world.rayFrom(clientX, clientY)); if (t && t.hitId) select(t.hitId); }
      return;
    }
    const t = targetFromRay(world.rayFrom(clientX, clientY));
    tapAt(t);
  }
  function tapAt(t, phase = 'up') {
    if (!t) { if (phase === 'up' && S.selected) select(null); return; }
    if (S.moving) {
      const c = S.idx.byId.get(S.moving);
      const level = t.hitId === S.moving ? c.level : t.level;
      if (phase === 'down') { showGhost(t.x, t.z, level, { form: c.form, room: c.room, rot: S.rot, ignoreId: c.id }); return; }
      if (!S.ghost) showGhost(t.x, t.z, level, { form: c.form, room: c.room, rot: S.rot, ignoreId: c.id });
      confirmGhost();
      return;
    }
    if (S.tool === 'bin') {
      if (phase === 'down') return;
      if (t.hitId) { removeCell(t.hitId); emit('binTap'); }
      else { sfx.no(); say('Tap a block to take it away.'); }
      return;
    }
    if (S.tool) {
      if (phase === 'down') { showGhost(t.x, t.z, t.level, { room: S.tool, form: S.form }); return; }
      if (!S.ghost) showGhost(t.x, t.z, t.level, { room: S.tool, form: S.form });
      confirmGhost();
      return;
    }
    if (phase === 'down') return;
    if (t.hitId) { if (S.selected === t.hitId) select(null); else select(t.hitId); }
    else {
      if (S.selected) select(null);
      else {
        const zn = zone(t.x, t.z);
        if (preset.onGroundTap) preset.onGroundTap(t, api);
        else if (!S.design.cells.length) say(`This is ${ZONE_NAMES[zn] || 'the site'}. Choose a room on the left, then tap here to build it.`);
      }
      emit('groundTap', { x: t.x, z: t.z });
    }
  }

  // Touch on the 3D canvas: finger down shows where a block would go, lifting it builds; a drag turns the view instead.
  let down = null;
  const onDown = e => {
    if (S.view === 'walk' || S.view === 'section') return;
    down = { x: e.clientX, y: e.clientY, id: e.pointerId, multi: false };
    if (((S.tool && S.tool !== 'bin') || S.moving) && S.view === 'model') { const t = targetFromRay(world.rayFrom(e.clientX, e.clientY)); if (t) tapAt(t, 'down'); }
  };
  const onMove = e => {
    if (!down) return;
    if (e.pointerId !== down.id) { down.multi = true; clearGhost(); return; }
    if (S.ghost && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) clearGhost();
  };
  const onUp = e => {
    if (!down || e.pointerId !== down.id) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const d = down; down = null;
    if (moved < 10 && !d.multi) handleTap(e.clientX, e.clientY);
    else { clearGhost(); if (moved >= 10 && S.view === 'model') emit('orbit'); }
  };
  world.canvas.addEventListener('pointerdown', onDown);
  world.canvas.addEventListener('pointermove', onMove);
  world.canvas.addEventListener('pointerup', onUp);
  world.canvas.addEventListener('pointercancel', () => { down = null; clearGhost(); });

  // ---------- Views ----------
  let section = null, walk = null;
  function setView(v) {
    if (v === S.view && v !== 'model') return;
    const prev = S.view;
    S.view = v;
    for (const [k, b] of Object.entries(viewBtns)) b.classList.toggle('on', k === v);
    root.classList.toggle('plan', v === 'plan');
    floorGroup.style.display = v === 'plan' ? '' : 'none';
    if (sunBtn) sunBtn.style.display = v === 'plan' ? 'none' : '';
    if (prev === 'section' && section) { section.destroy(); section = null; }
    if (prev === 'walk' && walk) { walk.destroy(); walk = null; }
    world.sky.visible = true;
    world.scene.background = null;
    CLIP.length = 0;
    world.camera = world.cam;
    world.controls.enabled = true;
    world.setIso(v === 'model' && S.iso);
    if (v === 'plan') {
      world.stop();
      // Fit the school into the clear area between the tray and the right-hand buttons.
      const W = viewport.clientWidth, H = viewport.clientHeight;
      planView = fitView(S.design, Math.max(200, W - 440), Math.max(200, H - 140));
      planView.x0 -= 326 / planView.s; planView.z0 -= 76 / planView.s;
      drawPlanView();
      say('This is the plan. It shows the school from above, like a map, with the walls, doors and windows.');
    } else {
      world.start();
    }
    if (v === 'model' && prev !== 'model') frameModel(false);
    if (v === 'section') {
      import('./views/section.js').then(m => { if (S.view === 'section') section = m.startSection(api, world, root); });
    }
    if (v === 'walk') {
      clearGhost(); select(null);
      import('./views/walk.js').then(m => { if (S.view === 'walk') walk = m.startWalk(api, world, root); });
    }
    updateFaces();
    if (S.ghost && v !== 'plan' && v !== 'model') clearGhost();
    emit('view', { view: v });
  }
  function setMode(m) {
    S.mode = m;
    store.modSave('studio', 'mode', m);
    if (modeBtn) { modeBtn.querySelector('span').textContent = m === 'blocks' ? 'Blocks' : 'Building'; modeBtn.querySelector('svg').outerHTML = icon(m === 'blocks' ? 'blocks' : 'building'); }
    refresh({ silent: true });
    sfx.whoosh();
    say(m === 'building' ? 'Building mode. The blocks become a real building, with walls, doors, windows and roofs.' : 'Blocks mode. Just the shapes, like a model on the table.');
    emit('mode', { mode: m });
  }
  function setFloor(f) {
    const maxL = Math.max(1, ...S.design.cells.map(c => c.level + FORMS[c.form].levels));
    S.floor = clamp(f, 0, Math.min(MAX_LEVEL, maxL));
    floorGroup.querySelector('.floor-n').textContent = S.floor === 0 ? 'Ground' : `Floor ${S.floor}`;
    drawPlanView();
    sfx.tap();
    emit('floor', { floor: S.floor });
  }
  function zoom(f) {
    if (S.view === 'plan') {
      const v = planView, W = viewport.clientWidth, H = viewport.clientHeight;
      const cx = v.x0 + W / v.s / 2, cz = v.z0 + H / v.s / 2;
      v.s = clamp(v.s / f, 8, 120);
      v.x0 = cx - W / v.s / 2; v.z0 = cz - H / v.s / 2;
      drawPlanView();
      return;
    }
    if (S.view === 'section' && section) { section.zoom(f); return; }
    if (S.view !== 'model') return;
    if (world.iso) { world.ortho.zoom = clamp(world.ortho.zoom / f, 0.3, 7); world.ortho.updateProjectionMatrix(); return; }
    const c = world.controls;
    const off = world.cam.position.clone().sub(c.target);
    const len = clamp(off.length() * f, c.minDistance, c.maxDistance);
    animateCam(c.target.clone(), c.target.clone().add(off.setLength(len)));
  }
  function frameModel(instant = true, close = false, withGate = false) {
    let b = bounds(S.design);
    if (b && withGate) {
      const [gx, gz] = site().gate;
      b = { ...b, x0: Math.min(b.x0, gx), x1: Math.max(b.x1, gx + 1), z0: Math.min(b.z0, gz), z1: Math.max(b.z1, gz + 1) };
      b.cx = (b.x0 + b.x1) / 2; b.cz = (b.z0 + b.z1) / 2;
    }
    const target = b ? new THREE.Vector3(b.cx, 0.4, b.cz) : new THREE.Vector3(24, 0, 24);
    const size = b ? Math.max(8, Math.max(b.x1 - b.x0, b.z1 - b.z0) * 1.25 + 3) : 40;
    if (world.iso) {
      const zoom = clamp(12 / Math.max(5, size * (close ? 0.42 : 0.56)), 0.3, 7);
      if (instant) { world.controls.target.copy(target); world.placeIso(target); world.ortho.zoom = zoom; world.ortho.updateProjectionMatrix(); world.controls.update(); }
      else animateCam(target, null, 0.7, zoom);
      return;
    }
    const dist = close ? size * 0.7 : size;
    const pos = target.clone().add(new THREE.Vector3(0.45, 0.62, 0.95).normalize().multiplyScalar(dist));
    if (instant) { world.controls.target.copy(target); world.cam.position.copy(pos); world.controls.update(); }
    else animateCam(target, pos);
  }
  let camAnim = null;
  function animateCam(target, pos, dur = 0.7, zoom = null) {
    const c = world.controls;
    const t0 = c.target.clone(), p0 = world.cam.position.clone();
    const iso = world.iso;
    const off = world.ortho.position.clone().sub(c.target), z0 = world.ortho.zoom;
    let t = 0;
    if (camAnim) world.updaters.delete(camAnim);
    camAnim = dt => {
      t = Math.min(1, t + dt / dur);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      c.target.lerpVectors(t0, target, e);
      if (iso) {
        world.ortho.position.copy(c.target).add(off);
        if (zoom) { world.ortho.zoom = z0 + (zoom - z0) * e; world.ortho.updateProjectionMatrix(); }
      } else if (pos) world.cam.position.lerpVectors(p0, pos, e);
      if (t >= 1) { world.updaters.delete(camAnim); camAnim = null; }
    };
    world.updaters.add(camAnim);
  }

  // ---------- Plan view (2D) ----------
  let planView = null;
  let mapImage = null;
  loadMapImage().then(img => { mapImage = img; if (S.view === 'plan') drawPlanView(); });
  function drawPlanView() {
    if (S.view !== 'plan') return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = viewport.clientWidth, H = viewport.clientHeight;
    if (planCanvas.width !== Math.round(W * dpr)) { planCanvas.width = Math.round(W * dpr); planCanvas.height = Math.round(H * dpr); }
    const g = planCanvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawPlan(g, W, H, S.idx, S.doors, planView, { level: S.floor, mapImg: mapImage, faces: S.faces, ghost: S.ghost, paths: dv.pathCells, select: S.selected ? S.idx.byId.get(S.selected) : null, redraw: () => drawPlanView(), bubbles: S.bubbles, traffic: S.traffic });
    positionFloatbar();
  }
  // Plan interactions: finger down previews, lifting builds or picks; a drag pans.
  let pdown = null;
  function planTarget(e) {
    const r = planCanvas.getBoundingClientRect();
    const x = Math.floor(planView.x0 + (e.clientX - r.left) / planView.s), z = Math.floor(planView.z0 + (e.clientY - r.top) / planView.s);
    const here = S.idx.occ.get(key(x, z, S.floor));
    if (S.tool && S.tool !== 'bin') return { x, z, level: here ? stackLevel(S.idx, x, z) : S.floor, hitId: null };
    if (S.moving) return { x, z, level: S.floor, hitId: null };
    return { x, z, level: S.floor, hitId: here ? here.id : null };
  }
  planCanvas.addEventListener('pointerdown', e => {
    pdown = { x: e.clientX, y: e.clientY, vx: planView.x0, vz: planView.z0, moved: false };
    planCanvas.setPointerCapture(e.pointerId);
    if (S.tool || S.moving) tapAt(planTarget(e), 'down');
  });
  planCanvas.addEventListener('pointermove', e => {
    if (!pdown) return;
    const dx = e.clientX - pdown.x, dy = e.clientY - pdown.y;
    if (!pdown.moved && Math.hypot(dx, dy) > 10) { pdown.moved = true; clearGhost(); }
    if (pdown.moved) { planView.x0 = pdown.vx - dx / planView.s; planView.z0 = pdown.vz - dy / planView.s; drawPlanView(); }
  });
  planCanvas.addEventListener('pointerup', e => {
    if (!pdown) return;
    const d = pdown; pdown = null;
    if (d.moved) { emit('pan'); return; }
    tapAt(planTarget(e), 'up');
  });
  planCanvas.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.15 : 0.87); }, { passive: false });

  // ---------- Tasks (missions) ----------
  let tasksEl = null, tasksDone = false;
  function setTasks(list) {
    S.tasks = list.map(t => ({ ...t, done: false }));
    tasksDone = false;
    if (tasksEl) tasksEl.remove();
    tasksEl = h(`<div class="tasks"><div class="tt" role="button" tabindex="0">Your jobs <span class="fold">${icon('down')}</span></div></div>`);
    tasksEl.querySelector('.tt').addEventListener('click', () => { tasksEl.classList.toggle('folded'); sfx.tap(); });
    root.appendChild(tasksEl);
    drawTasks();
  }
  function drawTasks() {
    if (!tasksEl) return;
    tasksEl.querySelectorAll('.task').forEach(n => n.remove());
    const firstOpen = S.tasks.findIndex(t => !t.done);
    S.tasks.forEach((t, i) => {
      const el = h(`<div class="task ${t.done ? 'done' : ''} ${i === firstOpen ? 'now' : ''}"><div class="box">${t.done ? icon('check') : ''}</div>${t.emoji ? emo(t.emoji) : ''}<span>${esc(t.text)}</span></div>`);
      el.addEventListener('click', () => say(t.say || t.text));
      tasksEl.append(el);
    });
  }
  function checkTasks(ev, data) {
    if (!S.tasks || tasksDone) return;
    let changed = false;
    for (const t of S.tasks) {
      if (t.done) continue;
      let ok = false;
      try { ok = t.check(api, ev, data); } catch (e) { console.warn(e); }
      if (ok) { t.done = true; changed = true; sfx.chime(); if (t.praise) sayAuto(t.praise); }
    }
    if (changed) {
      drawTasks();
      const next = S.tasks.find(t => !t.done);
      if (!next) { tasksDone = true; sfx.tada(); toast('All jobs done!', '🎉'); ctx.complete && ctx.complete(); emit('tasksDone'); setTimeout(() => tasksEl && tasksEl.classList.add('folded'), 3500); }
      else setTimeout(() => sayAuto(next.say || next.text), 1800);
    }
  }
  on('*', (ev, data) => checkTasks(ev, data));

  // ---------- Day (pupils) ----------
  let day = null;
  async function openDay(opts2 = {}) {
    if (day) { day.close(); day = null; return; }
    clearGhost(); select(null);
    if (S.view !== 'model') setView('model');
    const m = await import('./sim/daypanel.js');
    day = await m.openDayPanel(api, world, root, { ...preset.day, ...opts2, onClose: () => { day = null; emit('dayClosed'); } });
    emit('dayOpen');
  }

  // ---------- API ----------
  const api = {
    S, on, emit, refresh, setView, setMode, setFaces, setTool, setTasks, toggleSun, select, openDay, frameModel, animateCam, undo,
    get idx() { return S.idx; },
    get design() { return S.design; },
    get root() { return root; },
    get viewport() { return viewport; },
    world, ctx, preset,
    addCell, removeCell, drawPlanView, say,
    setBubbles(on) { S.bubbles = on; drawPlanView(); },
    setCutaway(on) { S.cutaway = on; dv.sync(S.idx, on ? 'cutaway' : S.mode); },
    setTraffic(t) { S.traffic = t; },
    get day() { return day; },
    destroy() {
      if (S.destroyed) return;
      S.destroyed = true;
      hush();
      if (day) { day.close(); day = null; }
      if (section) section.destroy();
      if (walk) walk.destroy();
      clearGhost(); clearFaceObjs();
      if (selMesh) ghostGroup.remove(selMesh);
      CLIP.length = 0;
      world.setIso(false);
      world.camera = world.cam;
      world.controls.enabled = true;
      world.sky.visible = true;
      world.scene.background = null;
      world.updaters.delete(positionFloatbar);
      if (camAnim) world.updaters.delete(camAnim);
      world.canvas.removeEventListener('pointerdown', onDown);
      world.canvas.removeEventListener('pointermove', onMove);
      world.canvas.removeEventListener('pointerup', onUp);
      for (const o of [...world.groups.lab.children]) dropLabel(o);
      world.detach();
      store.flush();
      root.remove();
    },
  };

  try { const pending = sessionStorage.getItem('astraarch.undo'); if (pending) { S.history.push(pending); sessionStorage.removeItem('astraarch.undo'); } } catch (e) { /* ignore */ }
  drawTray();
  drawRail();
  refresh({ silent: true });
  world.setIso(S.iso);
  frameModel(true);
  if (preset.setup) await preset.setup(api);
  if (preset.tasks) setTasks(preset.tasks);
  emit('ready');
  if (preset.full && !S.design.cells.length) setTimeout(() => sayAuto('Welcome to your site! Choose a room on the left, then tap the meadow to see where it goes. Tap again to build it.'), 900);
  window.__studio = api;   // testing aid
  return api;
}
