// The Site model: Finn's site with a grid. Tap to place a room, drag its arrows to make it bigger or smaller,
// drag the room to move it (anything on top comes too), tap on top of a room to stack another on it.
import * as THREE from 'three';
import { PROGRAMMES, SHAPES, PALETTE, LEVEL, MAX_SIZE, MAX_LEVELS, TRAY, colourHex } from './catalogue.js';
import { GRID, square } from './site.js';
import { buildPiece, disposePiece, ghostMaterial } from './shapes.js';
import { WHY } from './model.js';
import { h, esc, emo, say, sfx, toast } from './ui.js';

export function mountSite(root, world, model, siteView, thumbs) {
  const ui = h(`<div class="site-ui">
    <aside class="tray"><div class="tray-in"></div></aside>
    <div class="side">
      <button class="sbtn" data-a="undo" aria-label="Undo">↶<span>Undo</span></button>
      <button class="sbtn" data-a="left" aria-label="Turn left">⟲<span>Turn</span></button>
      <button class="sbtn" data-a="right" aria-label="Turn right">⟳<span>Turn</span></button>
      <button class="sbtn" data-a="in" aria-label="Closer">＋<span>Closer</span></button>
      <button class="sbtn" data-a="out" aria-label="Further">－<span>Further</span></button>
      <button class="sbtn" data-a="home" aria-label="See the whole site">⌂<span>Whole site</span></button>
    </div>
    <div class="selbar" hidden></div>
    <div class="hint"></div>
  </div>`);
  root.appendChild(ui);
  const trayIn = ui.querySelector('.tray-in'), selbar = ui.querySelector('.selbar'), hint = ui.querySelector('.hint');

  const design = new THREE.Group(); design.name = 'design';
  world.scene.add(design);
  const pieces = new Map();                 // box id -> Group
  const S = { tool: null, selected: null, drag: null };

  // ---------- the tray ----------
  function drawTray() {
    trayIn.innerHTML = '';
    const pick = h(`<button class="tile tool ${S.tool === null ? 'on' : ''}" type="button">${emo('👆', 'big')}<b>Pick</b></button>`);
    pick.addEventListener('click', () => setTool(null));
    trayIn.append(pick);
    for (const id of TRAY) {
      const P = PROGRAMMES[id];
      const pic = thumbs.get(id) ? `<img class="thumb" src="${thumbs.get(id)}" alt="">` : emo(P.emoji, 'big');
      const b = h(`<button class="tile ${S.tool === id ? 'on' : ''}" type="button" data-id="${id}">${pic}<b>${esc(P.name)}</b></button>`);
      b.addEventListener('click', () => setTool(S.tool === id ? null : id));
      trayIn.append(b);
    }
  }
  function setTool(id) {
    S.tool = id;
    select(null);
    drawTray();
    siteView.setGridStrong(!!id);
    if (id) { sfx.tap(); say(`${PROGRAMMES[id].name}. Tap the grid to build it.`); setHint(`${emo(PROGRAMMES[id].emoji)} Tap a square to build a ${esc(PROGRAMMES[id].name.toLowerCase())}. Tap on top of a room to stack it.`); }
    else setHint(model.boxes.length ? 'Tap a room to change it, or choose a room on the left to build.' : 'Choose a room on the left, then tap the grid.');
  }
  function setHint(html) { hint.innerHTML = html; }

  // ---------- drawing the design ----------
  const baseOf = b => { let m = 0; for (const [x, z] of model.squares(b)) m = Math.max(m, square(x, z)?.base || 0); return m; };
  const yOf = b => baseOf(b) + b.level * LEVEL;
  function makeGroup(b, ghost = null) {
    const g = buildPiece({ ...b, hex: colourHex(b.colour) }, { open: model.open(b), ghost });
    // On a sloping clearing, the room stands on a little white plinth.
    if (b.level === 0) {
      let lo = Infinity; for (const [x, z] of model.squares(b)) lo = Math.min(lo, square(x, z)?.lo ?? 0);
      const ph = baseOf(b) - Math.max(lo, -0.2);
      if (ph > 0.03) { const p = new THREE.Mesh(new THREE.BoxGeometry(b.w - 0.04, ph, b.d - 0.04), ghost || new THREE.MeshLambertMaterial({ color: '#f1ede4' })); p.position.y = -ph / 2; p.receiveShadow = true; p.castShadow = true; g.add(p); }
    }
    g.position.set(b.x + b.w / 2, yOf(b), b.z + b.d / 2);
    g.traverse(o => { o.userData.boxId = b.id; });
    return g;
  }
  function redraw() {
    for (const g of pieces.values()) { design.remove(g); disposePiece(g); }
    pieces.clear();
    for (const b of model.boxes) { const g = makeGroup(b); design.add(g); pieces.set(b.id, g); }
    const occ = new Set();
    for (const b of model.boxes) if (b.level === 0) for (const [x, z] of model.squares(b)) occ.add(`${x},${z}`);
    siteView.clearTrees(occ);
    if (S.selected && !model.byId.has(S.selected)) select(null); else if (S.selected) placeHandles();
  }
  model.onChange(() => redraw());

  // A new room pops up out of the ground.
  function pop(id) {
    const g = pieces.get(id); if (!g) return;
    let t = 0;
    const fn = dt => { t += dt; const k = Math.min(1, t / 0.36); const s = k < 0.6 ? 0.25 + (k / 0.6) * 0.9 : 1.15 - ((k - 0.6) / 0.4) * 0.15; g.scale.set(s, s, s); if (k >= 1) { g.scale.set(1, 1, 1); world.updaters.delete(fn); } };
    world.updaters.add(fn);
  }
  // Wind turbines turn.
  world.updaters.add(dt => { for (const g of pieces.values()) g.traverse(o => { if (o.userData.spin) o.rotation.z += dt * o.userData.spin; }); });

  // ---------- picking ----------
  function hits(clientX, clientY, skip = null) {
    const ray = world.rayFrom(clientX, clientY);
    const objs = [...design.children.filter(g => !skip || !skip.has(g.children[0]?.userData.boxId)), siteView.ground];
    return ray.intersectObjects(objs, true).filter(hh => hh.face && !hh.object.isLine);
  }
  // Where would a new room go if Finn tapped here?
  function target(clientX, clientY, skip = null) {
    for (const hit of hits(clientX, clientY, skip)) {
      const id = hit.object.userData.boxId, p = hit.point;
      if (id) {
        const b = model.byId.get(id); if (!b) continue;
        const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
        if (n.y > 0.55) return { x: Math.floor(p.x), z: Math.floor(p.z), level: b.level + b.h, on: b };
        const x = Math.floor(p.x + n.x * 0.3), z = Math.floor(p.z + n.z * 0.3);
        const l = Math.max(0, Math.min(MAX_LEVELS - 1, b.level + Math.floor((p.y - yOf(b)) / LEVEL)));
        return { x, z, level: l, side: b };
      }
      if (hit.object === siteView.ground) return { x: Math.floor(p.x), z: Math.floor(p.z), level: 0 };
    }
    return null;
  }
  // The square under the finger while dragging: the top of a room, or the ground.
  function under(clientX, clientY, skip) {
    for (const hit of hits(clientX, clientY, skip)) {
      const id = hit.object.userData.boxId, p = hit.point;
      if (id) { const b = model.byId.get(id); if (!b) continue; const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld); if (n.y > 0.55) return { x: Math.floor(p.x), z: Math.floor(p.z), level: b.level + b.h }; continue; }
      if (hit.object === siteView.ground) return { x: Math.floor(p.x), z: Math.floor(p.z), level: 0 };
    }
    return null;
  }
  const boxAt = (clientX, clientY) => { const hit = hits(clientX, clientY).find(hh => hh.object.userData.boxId); return hit ? model.byId.get(hit.object.userData.boxId) : null; };

  // ---------- ghost (preview) ----------
  let ghost = null;
  const okMat = ghostMaterial(true), noMat = ghostMaterial(false);
  function showGhost(b, ok) {
    clearGhost();
    ghost = makeGroup({ ...b, id: -1 }, ok ? okMat : noMat);
    ghost.traverse(o => { o.userData.boxId = undefined; o.raycast = () => {}; });
    design.add(ghost);
  }
  function clearGhost() { if (ghost) { design.remove(ghost); disposePiece(ghost); ghost = null; } }

  // ---------- placing ----------
  const seen = new Set();
  function place(t) {
    const b = model.make(S.tool, t.x, t.z, t.level);
    const r = model.fit(b);
    if (!r.ok) { sfx.no(); say(WHY[r.why] || 'It will not fit there.'); toast(WHY[r.why] || 'It will not fit there.'); showGhost(b, false); setTimeout(clearGhost, 900); return; }
    const box = model.add(r.box);
    pop(box.id);
    sfx.place(box.level);
    if (!seen.has(box.type)) { seen.add(box.type); say(PROGRAMMES[box.type].say); }
    select(box.id, { quiet: true });
  }

  // ---------- selection, arrows and the toolbar ----------
  const handles = new THREE.Group(); handles.name = 'handles';
  world.scene.add(handles);
  const arrowMat = new THREE.MeshBasicMaterial({ color: '#2f6fe4' }), arrowRim = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  function arrow() {
    const g = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 20).rotateX(Math.PI / 2).translate(0, 0, 0.27), arrowRim); rim.scale.setScalar(1.15);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 20).rotateX(Math.PI / 2).translate(0, 0, 0.27), arrowMat);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.24, 12).rotateX(Math.PI / 2).translate(0, 0, 0.06), arrowMat);
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8).translate(0, 0, 0.2), hitMat);
    g.add(rim, cone, stem, pad);
    g.traverse(o => { o.renderOrder = 10; if (o.material) { o.material.depthTest = false; } });
    return g;
  }
  const H = { px: arrow(), nx: arrow(), pz: arrow(), nz: arrow(), up: arrow() };
  for (const [k, a] of Object.entries(H)) { a.userData.handle = k; a.traverse(o => { o.userData.handle = k; }); handles.add(a); }
  handles.visible = false;
  function placeHandles() {
    const b = model.byId.get(S.selected);
    if (!b) { handles.visible = false; return; }
    const y0 = yOf(b), hh = b.h * LEVEL, cx = b.x + b.w / 2, cz = b.z + b.d / 2, mid = y0 + Math.min(hh / 2, 0.3);
    H.px.position.set(b.x + b.w + 0.05, mid, cz); H.px.rotation.set(0, Math.PI / 2, 0);
    H.nx.position.set(b.x - 0.05, mid, cz); H.nx.rotation.set(0, -Math.PI / 2, 0);
    H.pz.position.set(cx, mid, b.z + b.d + 0.05); H.pz.rotation.set(0, 0, 0);
    H.nz.position.set(cx, mid, b.z - 0.05); H.nz.rotation.set(0, Math.PI, 0);
    H.up.position.set(cx, y0 + hh + 0.5, cz); H.up.rotation.set(-Math.PI / 2, 0, 0);
    const fixed = ['stairs', 'slide', 'turbine', 'tree'].includes(b.shape) ? ['up'] : [];
    for (const k of fixed) H[k].visible = b.shape !== 'turbine' && b.shape !== 'tree' && b.shape !== 'stairs' && b.shape !== 'slide';
    H.up.visible = !['turbine', 'tree', 'pool', 'track', 'garden'].includes(b.shape);
    handles.visible = true;
  }
  // Arrows stay the same size on screen at any zoom.
  world.updaters.add(() => { if (handles.visible) { const s = Math.min(1.6, Math.max(0.45, 1.25 / world.camera.zoom)); for (const a of Object.values(H)) a.scale.setScalar(s); } });

  function select(id, { quiet = false } = {}) {
    S.selected = id;
    const b = id ? model.byId.get(id) : null;
    if (!b) {
      handles.visible = false; selbar.hidden = true;
      setHint(S.tool ? `${emo(PROGRAMMES[S.tool].emoji)} Tap a square to build a ${esc(PROGRAMMES[S.tool].name.toLowerCase())}. Tap on top of a room to stack it.` : model.boxes.length ? 'Tap a room to change it, or choose a room on the left to build.' : 'Choose a room on the left, then tap the grid.');
      return;
    }
    placeHandles();
    drawSelbar(b);
    if (!quiet) { sfx.tap(); say(PROGRAMMES[b.type].name); }
    setHint('Drag a blue arrow to make it bigger or smaller. Drag the room to move it.');
  }
  function drawSelbar(b) {
    const P = PROGRAMMES[b.type];
    selbar.hidden = false;
    selbar.innerHTML = '';
    const info = h(`<div class="selname">${emo(P.emoji)}<div><b>${esc(P.name)}</b><span>${b.w} × ${b.d} blocks${b.h > 1 ? `, ${b.h} storeys` : ''}</span></div></div>`);
    info.addEventListener('click', () => say(`${P.name}. ${P.say}`));
    selbar.append(info);
    const btn = (icon, label, fn, cls = '') => { const x = h(`<button class="selbtn ${cls}" type="button">${icon}<span>${esc(label)}</span></button>`); x.addEventListener('click', e => { e.stopPropagation(); fn(); }); selbar.append(x); return x; };
    if (P.shapes.length > 1) btn('◆', 'Shape', () => nextShape(b));
    btn('🎨', 'Colour', () => colours(b));
    if (b.w !== b.d) btn('↻', 'Turn', () => turnBox(b));
    btn('⧉', 'Copy', () => copyBox(b));
    btn('🗑️', 'Bin', () => { const fell = model.remove(b.id); sfx.bin(); if (fell) toast('The rooms on top came down too. Undo brings them back.'); select(null); }, 'no');
    btn('✓', 'Done', () => select(null), 'ok');
  }
  function nextShape(b) {
    const list = PROGRAMMES[b.type].shapes, s = list[(list.indexOf(b.shape) + 1) % list.length];
    const r = model.update(b.id, { shape: s });
    if (!r.ok) { sfx.no(); toast(WHY[r.why] || 'That shape will not fit here.'); return; }
    model.setStyle(b.type, { shape: s });
    sfx.tap(); say(SHAPES[s].name); select(b.id, { quiet: true });
  }
  function colours(b) {
    const pop = h(`<div class="swatches"></div>`);
    for (const p of PALETTE) {
      const s = h(`<button class="sw ${b.colour === p.id ? 'on' : ''}" type="button" style="background:${p.hex}" aria-label="${esc(p.name)}"></button>`);
      s.addEventListener('click', () => { model.update(b.id, { colour: p.id }); model.setStyle(b.type, { colour: p.id }); sfx.tap(); say(p.name); pop.remove(); select(b.id, { quiet: true }); });
      pop.append(s);
    }
    ui.querySelector('.swatches')?.remove();
    ui.append(pop);
  }
  function turnBox(b) {
    const cx = b.x + b.w / 2, cz = b.z + b.d / 2;
    const n = { w: b.d, d: b.w, x: Math.round(cx - b.d / 2), z: Math.round(cz - b.w / 2) };
    const r = model.update(b.id, n);
    if (!r.ok) { sfx.no(); toast(WHY[r.why] || 'There is no room to turn it here.'); return; }
    sfx.whoosh(); select(b.id, { quiet: true });
  }
  function copyBox(b) {
    for (const [dx, dz] of [[b.w, 0], [0, b.d], [-b.w, 0], [0, -b.d]]) {
      const c = { ...b, x: b.x + dx, z: b.z + dz };
      if (model.check(c).ok) { const nb = model.add(c); pop(nb.id); sfx.place(nb.level); select(nb.id, { quiet: true }); return; }
    }
    sfx.no(); toast('There is no room next to it for a copy.');
  }

  // ---------- touch: tap, drag an arrow, drag a room ----------
  const canvas = world.canvas;
  const onDown = e => {
    if (!ui.isConnected) return;
    ui.querySelector('.swatches')?.remove();
    const start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    // An arrow?
    if (handles.visible) {
      const ray = world.rayFrom(e.clientX, e.clientY);
      const hh = ray.intersectObjects(handles.children, true).find(x => x.object.userData.handle && x.object.parent.visible);
      if (hh) {
        const b = model.byId.get(S.selected);
        S.drag = { mode: 'resize', handle: hh.object.userData.handle, start, orig: { ...b }, moved: false, plane: new THREE.Plane(), last: { ...b } };
        const k = S.drag.handle;
        if (k === 'up') { const n = world.camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize().negate(); S.drag.plane.setFromNormalAndCoplanarPoint(n, H.up.position); }
        else S.drag.plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), H[k].position);
        S.drag.p0 = ray.ray.intersectPlane(S.drag.plane, new THREE.Vector3()) || H[k].position.clone();
        world.controls.enabled = false;
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events in tests */ }
        return;
      }
    }
    // The selected room itself?
    const b = boxAt(e.clientX, e.clientY);
    if (b && b.id === S.selected && !S.tool) {
      // Which square of the room is under the finger (so that square follows the finger).
      const hit = hits(e.clientX, e.clientY).find(x => x.object.userData.boxId === b.id);
      let gx = b.x, gz = b.z;
      if (hit) { const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld); gx = Math.floor(hit.point.x - n.x * 0.05); gz = Math.floor(hit.point.z - n.z * 0.05); }
      gx = clamp(gx, b.x, b.x + b.w - 1); gz = clamp(gz, b.z, b.z + b.d - 1);
      S.drag = { mode: 'move', start, orig: { ...b }, moved: false, grab: { dx: gx - b.x, dz: gz - b.z } };
      world.controls.enabled = false;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events in tests */ }
      return;
    }
    S.drag = { mode: 'tap', start, moved: false };
    if (S.tool && e.pointerType !== 'mouse') { const t = target(e.clientX, e.clientY); if (t) { const nb = model.fit(model.make(S.tool, t.x, t.z, t.level)); showGhost(nb.box, nb.ok); } }
  };
  const onMove = e => {
    const d = S.drag;
    if (!d) {
      // Mouse hover: show where the room would go.
      if (S.tool && e.pointerType === 'mouse' && e.buttons === 0) { const t = target(e.clientX, e.clientY); if (t) { const nb = model.fit(model.make(S.tool, t.x, t.z, t.level)); showGhost(nb.box, nb.ok); } else clearGhost(); }
      return;
    }
    if (e.pointerId !== d.start.id) return;
    if (Math.hypot(e.clientX - d.start.x, e.clientY - d.start.y) > 8) d.moved = true;
    if (d.mode === 'tap') { if (d.moved) clearGhost(); return; }
    if (!d.moved) return;
    if (d.mode === 'resize') {
      const ray = world.rayFrom(e.clientX, e.clientY), p = ray.ray.intersectPlane(d.plane, new THREE.Vector3());
      if (!p) return;
      const o = d.orig, k = d.handle;
      let patch;
      if (k === 'up') { const n = Math.round((p.y - d.p0.y) / LEVEL); patch = { h: clamp(o.h + n, 1, MAX_LEVELS - o.level) }; }
      else {
        const along = k === 'px' || k === 'nx' ? p.x - d.p0.x : p.z - d.p0.z;
        const n = Math.round(along * (k[0] === 'p' ? 1 : -1));
        if (k === 'px') patch = { w: clamp(o.w + n, 1, MAX_SIZE) };
        if (k === 'nx') { const w = clamp(o.w + n, 1, MAX_SIZE); patch = { w, x: o.x + o.w - w }; }
        if (k === 'pz') patch = { d: clamp(o.d + n, 1, MAX_SIZE) };
        if (k === 'nz') { const dd = clamp(o.d + n, 1, MAX_SIZE); patch = { d: dd, z: o.z + o.d - dd }; }
      }
      const cur = model.byId.get(S.selected);
      const same = Object.keys(patch).every(key => cur[key] === patch[key]);
      if (same) return;
      if (!d.snap) { model.snapshot(); d.snap = true; }
      const r = model.update(S.selected, patch, { snapshot: false });
      if (r.ok) { (patch.w || patch.d || patch.h) > 0 && ((patch.w ?? cur.w) * (patch.d ?? cur.d) * (patch.h ?? cur.h) > d.last.w * d.last.d * d.last.h ? sfx.grow() : sfx.shrink()); d.last = { ...model.byId.get(S.selected) }; drawSelbar(model.byId.get(S.selected)); }
      return;
    }
    if (d.mode === 'move') {
      const b = model.byId.get(S.selected);
      const skip = new Set([b.id, ...model.above(b).map(x => x.id)]);
      const t = under(e.clientX, e.clientY, skip);
      if (!t) return;
      const patch = { x: t.x - d.grab.dx, z: t.z - d.grab.dz, level: t.level };
      d.patch = patch;
      const r = model.test(b.id, patch);
      d.ok = r.ok;
      // Show the room (and its riders) where it would go.
      const dx = patch.x - b.x, dz = patch.z - b.z, dl = patch.level - b.level;
      for (const id of skip) {
        const g = pieces.get(id), c = model.byId.get(id); if (!g) continue;
        g.position.set(c.x + dx + c.w / 2, yOf({ ...c, x: c.x + dx, z: c.z + dz, level: c.level + dl }), c.z + dz + c.d / 2);
        g.traverse(o => { if (o.isMesh) { if (!o.userData.mat0) o.userData.mat0 = o.material; o.material = r.ok ? o.userData.mat0 : noMat; } });
      }
      handles.visible = false;
    }
  };
  const onUp = e => {
    const d = S.drag; S.drag = null;
    world.controls.enabled = true;
    if (!d || e.pointerId !== d.start.id) return;
    clearGhost();
    if (d.mode === 'resize') {
      if (!d.moved) {
        // A tap on an arrow grows the room by one block that way.
        const o = model.byId.get(S.selected), k = d.handle;
        const patch = k === 'up' ? { h: o.h + 1 } : k === 'px' ? { w: o.w + 1 } : k === 'nx' ? { w: o.w + 1, x: o.x - 1 } : k === 'pz' ? { d: o.d + 1 } : { d: o.d + 1, z: o.z - 1 };
        const r = model.update(S.selected, patch);
        if (r.ok) sfx.grow(); else { sfx.no(); toast(WHY[r.why] || 'No room to grow that way.'); }
        drawSelbar(model.byId.get(S.selected));
      }
      return;
    }
    if (d.mode === 'move') {
      if (!d.moved) { handleTap(e.clientX, e.clientY); return; }
      if (d.patch && d.ok) { model.update(S.selected, d.patch); sfx.place(d.patch.level); }
      else { sfx.no(); toast('It will not fit there.'); redraw(); }
      placeHandles();
      return;
    }
    if (d.mode === 'tap' && !d.moved) handleTap(e.clientX, e.clientY);
  };
  canvas.addEventListener('pointerdown', onDown, { capture: true });
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', () => { S.drag = null; world.controls.enabled = true; clearGhost(); redraw(); });
  canvas.addEventListener('pointerleave', () => { if (!S.drag) clearGhost(); });

  function handleTap(x, y) {
    if (S.tool) { const t = target(x, y); if (t) place(t); return; }
    const b = boxAt(x, y);
    if (b) { if (b.id === S.selected) select(null); else select(b.id); }
    else if (S.selected) select(null);
  }

  // ---------- side buttons ----------
  ui.querySelector('.side').addEventListener('click', e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    sfx.tap();
    if (a === 'undo') { if (!model.undo()) toast('Nothing to undo'); }
    if (a === 'left') world.turn(-1);
    if (a === 'right') world.turn(1);
    if (a === 'in') zoomBy(1.3);
    if (a === 'out') zoomBy(1 / 1.3);
    if (a === 'home') frameSite();
  });
  function zoomBy(f) {
    const b = model.byId.get(S.selected);
    const t = world.controls.target;
    world.frame(b && f > 1 ? (t.x + b.x + b.w / 2) / 2 : t.x, b && f > 1 ? (t.z + b.z + b.d / 2) / 2 : t.z, clamp(world.camera.zoom * f, 0.6, 6));
  }
  function frameSite(instant = false) { world.frame(7.4, 8.6, 1.05, instant); }

  drawTray();
  redraw();
  frameSite(true);
  setTool(null);
  return {
    S, select, setTool, redraw, frameSite, tap: handleTap,
    // Testing aid: where a square is on screen.
    screenOf(x, z, y = 0) { return world.toScreen(new THREE.Vector3(x + 0.5, y, z + 0.5)); },
    show(on) { ui.hidden = !on; design.visible = on; handles.visible = on && !!S.selected; },
    refreshTray: drawTray,
  };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
