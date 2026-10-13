// The Site model: Finn's site with a grid. Tap to place a room, drag its arrows to make it bigger or smaller,
// drag the room to move it (anything on top comes too), tap on top of a room to stack another on it.
// "Inside" cuts every building at one floor to show furniture and people.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PROGRAMMES, SHAPES, PALETTE, SURFACES, NO_SURFACE, WINDOWS, LEVEL, MAX_SIZE, MAX_LEVELS, TRAY, colourHex } from './catalogue.js';
import { WINDOWED, winStyle } from './plan.js';
import { GRID, MAX_PAD, square, makeSite, buildSite, growSquares } from './site.js';
import { buildPiece, disposePiece, ghostMaterial, addInk, INK } from './shapes.js';
import { cutRoom, outline, CUTTABLE, storeyFloor, SINGLE_SPACE } from './inside.js';
import { SchoolDay, Trails, PERIODS } from './day.js';
import { startWalk } from './walk.js';
import { Crowd } from './crowd.js';
import { WHY } from './model.js';
import { icon, winSwatch } from './icons.js';
import { h, esc, emo, say, sfx, toast } from './ui.js';

// viewer: opened from a show-and-tell link, so you can look round, go inside and walk, but not build or change.
export function mountSite(root, world, model, siteView, thumbs, { viewer = false } = {}) {
  const ui = h(`<div class="site-ui ${viewer ? 'viewer' : ''}">
    <aside class="tray"><div class="tray-in"></div></aside>
    <div class="side">
      <button class="sbtn" data-a="undo" aria-label="Undo">${icon('undo')}<span>Undo</span></button>
      <button class="sbtn inside" data-a="inside" aria-label="Look inside">${icon('inside')}<span>Inside</span></button>
      <button class="sbtn day" data-a="day" aria-label="School day">${icon('bell')}<span>School day</span></button>
      <button class="sbtn" data-a="walk" aria-label="Walk inside">${icon('walk')}<span>Walk</span></button>
      <button class="sbtn" data-a="left" aria-label="Turn left">${icon('left')}<span>Turn</span></button>
      <button class="sbtn" data-a="right" aria-label="Turn right">${icon('right')}<span>Turn</span></button>
      <button class="sbtn" data-a="in" aria-label="Closer">${icon('in')}<span>Closer</span></button>
      <button class="sbtn" data-a="out" aria-label="Further">${icon('out')}<span>Further</span></button>
      <button class="sbtn" data-a="home" aria-label="See the whole site">${icon('whole')}<span>Whole site</span></button>
      <button class="sbtn grow" data-a="grow" aria-label="Make the site bigger">${icon('expand')}<span>Bigger site</span></button>
      <button class="sbtn" data-a="print" aria-label="Print drawings">${icon('print')}<span>Print</span></button>
    </div>
    <div class="floors" hidden></div>
    <div class="bubbles"></div>
    <div class="daybar" hidden></div>
    <div class="growbar" hidden><button class="fbtn reset" type="button">${icon('undo')}<span>Start again</span></button><button class="fbtn ok done" type="button">${icon('done')}<span>Done</span></button></div>
    <div class="selbar" hidden></div>
    <div class="hint"><span class="hint-text"></span><button class="hint-say" type="button" aria-label="Hear this">${icon('speaker')}</button></div>
  </div>`);
  root.appendChild(ui);
  const trayIn = ui.querySelector('.tray-in'), selbar = ui.querySelector('.selbar'), hint = ui.querySelector('.hint'), floorsEl = ui.querySelector('.floors');
  const tray = ui.querySelector('.tray'), daybar = ui.querySelector('.daybar'), sideEl = ui.querySelector('.side');

  const design = new THREE.Group(); design.name = 'design';
  world.scene.add(design);
  const pieces = new Map();                 // box id -> Group
  const S = { tool: null, selected: null, drag: null, inside: false, floor: 0, day: false, walking: null, cutH: undefined };
  const hooks = {};          // set by the app: dayDone(periods) after a whole school day, bigQuestion()
  const crowd = new Crowd(world);
  const trails = new Trails(world);

  // ---------- the tray ----------
  function drawTray() {
    trayIn.innerHTML = '';
    const pick = h(`<button class="tile tool ${S.tool === null ? 'on' : ''}" type="button">${icon('pick', 'ic big')}<b>Pick</b></button>`);
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
    if (S.siteEdit) stopGrow();
    if (S.inside) setInside(false);
    S.tool = id;
    select(null);
    drawTray();
    siteView.setGridStrong(!!id);
    if (id) { sfx.tap(); say(`${PROGRAMMES[id].name}. Tap the grid to build it.`); }
    defaultHint();
  }
  const hintText = hint.querySelector('.hint-text');
  function setHint(html) { hintText.innerHTML = html; hint.hidden = !html; }
  hint.querySelector('.hint-say').addEventListener('click', () => { sfx.tap(); say(hintText.textContent); });
  function defaultHint() {
    if (S.inside) return setHint('Inside the school! Choose a floor at the bottom.');
    if (viewer) return setHint('Finn designed this school. Tap a room to hear what it is.');
    if (S.tool) return setHint(`${emo(PROGRAMMES[S.tool].emoji)} Tap a square to build a ${esc(PROGRAMMES[S.tool].name.toLowerCase())}. Tap on top of a room to stack it.`);
    setHint(model.boxes.length ? 'Tap a room to change it, or choose a room on the left to build.' : 'Choose a room on the left, then tap the grid.');
  }

  // ---------- drawing the design ----------
  // A building stands at the lowest level of the ground under it; the ground is levelled to meet it (no plinth).
  // Rooms stacked on top stand on whatever holds them up.
  function baseOf(b, seen = 0) {
    if (b.level > 0 && seen < 12) for (const [x, z] of model.squares(b)) { const s = model.at(x, z, b.level - 1); if (s && s.id !== b.id) return baseOf(s, seen + 1); }
    let m = Infinity; for (let x = b.x; x < b.x + b.w; x++) for (let z = b.z; z < b.z + b.d; z++) { const q = square(x, z); if (q?.build) m = Math.min(m, q.base || 0); }
    return m === Infinity ? 0 : m;
  }
  const yOf = b => baseOf(b) + b.level * LEVEL;
  function levelGround() {
    const pads = new Map();
    for (const b of model.boxes) if (b.level === 0) { const y = baseOf(b); for (let x = b.x; x < b.x + b.w; x++) for (let z = b.z; z < b.z + b.d; z++) pads.set(x * 100 + z, y); }
    siteView.regrade(pads);
  }
  function makeGroup(b, ghost = null) {
    const g = buildPiece({ ...b, hex: colourHex(b.colour) }, { open: model.open(b), ghost });
    g.position.set(b.x + b.w / 2, yOf(b), b.z + b.d / 2);
    g.traverse(o => { o.userData.boxId = b.id; });
    return g;
  }
  // In the inside view: rooms on this floor are cut open; rooms above are hidden; rooms below stay solid.
  function makeInside(b) {
    const L = S.floor;
    if (b.level > L) return S.day ? { g: makeGroup(b, ghostUp) } : S.walkMode ? { g: makeGroup(b) } : null;
    const spans = b.level <= L && L < b.level + b.h;
    if (!spans || !CUTTABLE.has(b.shape)) { const g = makeGroup(b); return { g }; }
    const floorY = storeyFloor(b, L);
    const top = S.walkMode ? (SINGLE_SPACE.has(b.type) ? b.h * LEVEL : LEVEL) : 0;
    const room = cutRoom(b, colourHex(b.colour), floorY, S.cutH, S.walkMode ? { walk: true, top, boxH: b.h * LEVEL } : {});
    if (S.walkMode) for (const [ax, az, bx, bz] of room.segments) walls.push([ax + b.x + b.w / 2, az + b.z + b.d / 2, bx + b.x + b.w / 2, bz + b.z + b.d / 2]);
    let g = room.group;
    if (S.walkMode) {
      // The real building (roof, upper floors, window frames, canopies), with the storey being walked cut away,
      // where the room with its real window openings stands instead.
      const y0 = yOf(b), k = SINGLE_SPACE.has(b.type) ? 0 : L - b.level;
      const real = buildPiece({ ...b, hex: colourHex(b.colour) }, { open: model.open(b), walkK: k, ink: false });
      const planes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -(y0 + floorY + top)), new THREE.Plane(new THREE.Vector3(0, -1, 0), y0 + floorY)];
      real.traverse(o => {
        if (!o.isMesh || o.userData.noInk || o.userData.keep) return;
        const cl = m => { const c = m.clone(); c.clippingPlanes = planes; c.clipIntersection = true; c.clipShadows = true; c.side = THREE.DoubleSide; return c; };
        o.material = Array.isArray(o.material) ? o.material.map(cl) : cl(o.material);
      });
      const both = new THREE.Group(); both.add(real, g); g = both;
    } else addInk(g);
    g.position.set(b.x + b.w / 2, yOf(b), b.z + b.d / 2);
    g.traverse(o => { o.userData.boxId = b.id; });
    return { g, room };
  }
  const walls = [];          // wall lines on the floor being walked (for bumping into)
  const seatsById = new Map();
  function redraw() {
    walls.length = 0; seatsById.clear();
    for (const g of pieces.values()) { design.remove(g); disposePiece(g); }
    pieces.clear();
    const zones = [];
    for (const b of model.boxes) {
      let g, room = null;
      if (S.inside) { const r = makeInside(b); if (!r) continue; g = r.g; room = r.room; }
      else g = makeGroup(b);
      design.add(g); pieces.set(b.id, g);
      zones.push(...peopleFor(b, g, room));
      // Where people can sit, in the world: room seats, or the benches and steps of a piece.
      const cx = b.x + b.w / 2, cz = b.z + b.d / 2, y0 = yOf(b);
      let st = room?.seats; if (!st) g.traverse(o => { if (o.userData.seats) st = o.userData.seats; });
      seatsById.set(b.id, (st || []).map(([x, y, z]) => [cx + x, y0 + y, cz + z]));
    }
    zones.push(...strollers());
    levelGround();
    yard();
    if (!S.day) crowd.set(zones, model.boxes.length * 7 + (S.inside ? 101 : 0) + S.floor);
    const occ = new Set();
    for (const b of model.boxes) if (b.level === 0) for (const [x, z] of model.squares(b)) occ.add(`${x},${z}`);
    siteView.clearTrees(occ);
    if (S.selected && !model.byId.has(S.selected)) select(null); else if (S.selected) placeHandles();
    if (S.inside) drawFloors();
  }
  model.onChange(() => { if (S.day) stopDay(); redraw(); });
  const ghostUp = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.22, depthWrite: false });
  ghostUp.userData.ghost = true;

  // A pale paved yard spreads round the buildings, like the plazas in MVRDV's drawings.
  let yardMesh = null;
  function yard() {
    if (yardMesh) { design.remove(yardMesh); yardMesh.geometry.dispose(); yardMesh = null; }
    const occ = new Set(), pave = [];
    for (const b of model.boxes) if (b.level === 0) for (const [x, z] of model.squares(b)) occ.add(`${x},${z}`);
    if (!occ.size) return;
    for (let z = 0; z < GRID.d; z++) for (let x = 0; x < GRID.w; x++) {
      const q = square(x, z); if (!q?.build || q.zone === 'clearing' || occ.has(`${x},${z}`)) continue;
      let near = false; for (let dz = -1; dz <= 1 && !near; dz++) for (let dx = -1; dx <= 1; dx++) if (occ.has(`${x + dx},${z + dz}`)) { near = true; break; }
      if (near) pave.push(new THREE.BoxGeometry(1.02, 0.014, 1.02).translate(x + 0.5, q.base + 0.007, z + 0.5));
    }
    if (!pave.length) return;
    yardMesh = new THREE.Mesh(mergeGeometries(pave.map(g => { g.deleteAttribute('uv'); return g; })), new THREE.MeshLambertMaterial({ color: '#f1ece2' }));
    yardMesh.userData.landscape = true;
    yardMesh.receiveShadow = true; yardMesh.raycast = () => {};
    design.add(yardMesh);
  }

  // ---------- people ----------
  const DENSITY = { classroom: 1, hall: 2.5, library: 1, lunch: 0.6, art: 1, music: 1, yoga: 0.3, aquarium: 2, ringhouse: 0.6, archway: 1 };
  function peopleFor(b, g, room) {
    const out = [], cx = b.x + b.w / 2, cz = b.z + b.d / 2, y0 = yOf(b), P = PROGRAMMES[b.type];
    if (room) {
      const area = model.squares(b).length;
      const sw = room.swim;
      out.push({ boxId: b.id, ox: cx, oy: y0 + room.floorY, oz: cz, w: b.w, d: b.d, inside: sw ? (x, z, m) => room.inside(x, z, m) && !(Math.abs(x) < sw.w / 2 + 0.1 && Math.abs(z) < sw.d / 2 + 0.1) : room.inside, margin: 0.12, seats: room.seats.map(([x, y, z]) => [x, y - room.floorY, z]), fill: 0.65,
        walkers: sw ? 2 : Math.max(1, Math.round((DENSITY[b.type] ?? 1) * area)), adults: true, kind: b.type === 'hall' ? 'run' : 'walk', speed: b.type === 'hall' ? 0.6 : 0.28 });
      if (sw) out.push({ boxId: b.id, ox: cx, oy: y0 + sw.y, oz: cz, w: sw.w, d: sw.d, inside: (x, z) => Math.abs(x) < sw.w / 2 && Math.abs(z) < sw.d / 2, margin: 0, walkers: Math.max(2, Math.round(area * 1.5)), kind: 'swim', speed: 0.25 });
      return out;
    }
    // Swimmers in the pool.
    let swim = null; g.traverse(o => { if (o.userData.swim) swim = o.userData.swim; });
    let walk = null; g.traverse(o => { if (o.userData.walk) walk = o.userData.walk; });
    if (walk) out.push({ boxId: b.id, ox: cx, oy: y0 + walk.y, oz: cz, w: walk.w, d: walk.d, inside: (x, z) => Math.abs(x) < walk.w / 2 && Math.abs(z) < walk.d / 2, margin: 0, walkers: Math.max(1, Math.round(b.w * b.d * 0.7)), speed: 0.25 });
    if (swim) out.push({ boxId: b.id, ox: cx, oy: y0 + swim.y, oz: cz, w: swim.w, d: swim.d, inside: (x, z) => Math.abs(x) < swim.w / 2 && Math.abs(z) < swim.d / 2, margin: 0, walkers: Math.max(2, Math.round(b.w * b.d * 1.5)), kind: 'swim', speed: 0.25 });
    // Children sitting on the big steps.
    let seats = null; g.traverse(o => { if (o.userData.seats) seats = o.userData.seats; });
    if (seats) out.push({ boxId: b.id, ox: cx, oy: y0, oz: cz, w: b.w, d: b.d, inside: () => true, seats, fill: 0.8, walkers: 0 });
    // A roof terrace on top of an open flat roof.
    if (SHAPES[b.shape]?.flat && model.open(b) && !S.inside) {
      const o = outline(b);
      out.push({ boxId: b.id, ox: cx, oy: y0 + b.h * LEVEL + 0.012, oz: cz, w: b.w, d: b.d, inside: o.inside, margin: 0.14, walkers: Math.min(5, Math.max(1, Math.round(model.squares(b).length * 0.8))), speed: 0.22 });
    }
    return out;
  }
  // A few people strolling across the meadow, round the buildings.
  function strollers() {
    const free = [];
    for (let z = 0; z < GRID.d; z++) for (let x = 0; x < GRID.w; x++) { const q = square(x, z); if (q?.build && q.zone !== 'clearing' && !model.at(x, z, 0)) free.push([x, z]); }
    if (!free.length) return [];
    const ok = (x, z) => { const q = square(Math.floor(x), Math.floor(z)); return q?.build && q.zone !== 'clearing' && !model.at(Math.floor(x), Math.floor(z), 0); };
    const xs = free.map(f => f[0]), zs = free.map(f => f[1]);
    return [{ rect: { x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs) + 1, z1: Math.max(...zs) + 1 }, ok, oy: 0.012, walkers: Math.min(14, 4 + Math.round(model.boxes.length * 0.6)), speed: 0.3, adults: true }];
  }

  // A new room pops up out of the ground.
  function pop(id) {
    const g = pieces.get(id); if (!g) return;
    let t = 0;
    const fn = dt => { t += dt; const k = Math.min(1, t / 0.36); const s = k < 0.6 ? 0.25 + (k / 0.6) * 0.9 : 1.15 - ((k - 0.6) / 0.4) * 0.15; g.scale.set(s, s, s); if (k >= 1) { g.scale.set(1, 1, 1); world.updaters.delete(fn); } };
    world.updaters.add(fn);
  }
  // Outlines are crisp close up and softer when the whole site is in view.
  world.updaters.add(() => { const c = world.camera; INK.visible = !c.isPerspectiveCamera; INK.opacity = Math.min(0.85, Math.max(0.35, 0.2 + c.zoom * 0.3)); });
  // Wind turbines turn; children whizz down helter-skelters.
  world.updaters.add(dt => {
    const t = performance.now() / 1000;
    for (const g of pieces.values()) g.traverse(o => {
      if (o.userData.spin) o.rotation.z += dt * o.userData.spin;
      if (o.userData.yspin) o.rotation.y += dt * o.userData.yspin;
      if (o.userData.swing) o.rotation.x = Math.sin(t * o.userData.swing.speed) * o.userData.swing.amp;
      if (o.userData.rock) o.rotation.z = Math.sin(t * o.userData.rock.speed) * o.userData.rock.amp;
      const zp = o.userData.zip;
      if (zp) { const k = (t % (zp.period * 2)) / zp.period, u = k < 1 ? k * k : Math.max(0, 1 - (k - 1) * 1.6); o.position.set(zp.x0 + (zp.x1 - zp.x0) * u, zp.y0 + (zp.y1 - zp.y0) * u, 0); }
      const sl = o.userData.slide;
      if (sl) {
        const k = ((t + (o.parent?.id || 0) * 0.37) % (sl.period + sl.pause)) / sl.period;
        o.visible = k <= 1;
        if (k <= 1) { const p = sl.curve.getPointAt(Math.min(1, k * k * 0.4 + k * 0.6)); o.position.set(p.x, p.y - 0.05, p.z); }
      }
    });
  });

  // ---------- picking ----------
  function hits(clientX, clientY, skip = null) {
    const ray = world.rayFrom(clientX, clientY);
    const objs = [...design.children.filter(g => !skip || !skip.has(g.children[0]?.userData.boxId)), siteView.ground];
    return ray.intersectObjects(objs, true).filter(hh => hh.face && !hh.object.isLine && !hh.object.isInstancedMesh);
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
  function proposal(t) {
    const b = model.make(S.tool, t.x, t.z, t.level);
    // Stairs put next to a building grow to reach its roof (so you can get to the first and second floors).
    if ((b.type === 'stairs' || b.type === 'ramp') && b.level === 0) {
      let top = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { let l = 0; while (model.at(b.x + dx, b.z + dz, l)) l++; top = Math.max(top, l); }
      if (top >= 1) b.h = Math.min(MAX_LEVELS, top);
    }
    return model.fit(b);
  }
  function place(t) {
    const r = proposal(t);
    if (!r.ok) { sfx.no(); say(WHY[r.why] || 'It will not fit there.'); toast(WHY[r.why] || 'It will not fit there.'); showGhost(r.box, false); setTimeout(clearGhost, 900); return; }
    const box = model.add(r.box);
    pop(box.id);
    sfx.place(box.level);
    if (!seen.has(box.type)) { seen.add(box.type); say(PROGRAMMES[box.type].say); }
    select(box.id, { quiet: true });
  }

  // ---------- selection, arrow badges and the toolbar ----------
  const handles = new THREE.Group(); handles.name = 'handles';
  world.scene.add(handles);
  const badgeTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.fillStyle = 'rgba(20,30,60,0.25)'; g.beginPath(); g.arc(64, 68, 56, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2f6fe4'; g.beginPath(); g.arc(64, 64, 47, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(64, 26); g.lineTo(94, 60); g.lineTo(76, 60); g.lineTo(76, 98); g.lineTo(52, 98); g.lineTo(52, 60); g.lineTo(34, 60); g.closePath(); g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  // The turn badge: a round arrow.
  const turnTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.fillStyle = 'rgba(20,30,60,0.25)'; g.beginPath(); g.arc(64, 68, 56, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f28b30'; g.beginPath(); g.arc(64, 64, 47, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 11; g.lineCap = 'round'; g.beginPath(); g.arc(64, 66, 24, Math.PI * 0.95, Math.PI * 2.35); g.stroke();
    const a = Math.PI * 2.35, tx = 64 + Math.cos(a) * 24, ty = 66 + Math.sin(a) * 24;
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(tx + 15, ty - 13); g.lineTo(tx + 6, ty + 16); g.lineTo(tx - 16, ty - 4); g.closePath(); g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const DIRS = { px: new THREE.Vector3(1, 0, 0), nx: new THREE.Vector3(-1, 0, 0), pz: new THREE.Vector3(0, 0, 1), nz: new THREE.Vector3(0, 0, -1), up: new THREE.Vector3(0, 1, 0) };
  const H = {};
  for (const k of [...Object.keys(DIRS), 'turn']) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: k === 'turn' ? turnTex : badgeTex, depthTest: false, transparent: true }));
    sp.renderOrder = 20; sp.userData.handle = k; H[k] = sp; handles.add(sp);
  }
  handles.visible = false;
  function placeHandles() {
    const b = model.byId.get(S.selected);
    if (!b || S.inside) { handles.visible = false; return; }
    const y0 = yOf(b), hh = b.h * LEVEL, cx = b.x + b.w / 2, cz = b.z + b.d / 2, mid = y0 + Math.min(hh / 2, 0.3);
    H.px.position.set(b.x + b.w + 0.28, mid, cz); H.nx.position.set(b.x - 0.28, mid, cz);
    H.pz.position.set(cx, mid, b.z + b.d + 0.28); H.nz.position.set(cx, mid, b.z - 0.28);
    H.up.position.set(cx, y0 + hh + 0.55, cz);
    H.turn.position.set(b.x + b.w + 0.2, y0 + hh + 0.3, b.z + b.d + 0.2);
    const fixedSize = ['turbine', 'tree'].includes(b.shape);
    for (const k of ['px', 'nx', 'pz', 'nz']) H[k].visible = !fixedSize && !['stairs', 'spiral'].includes(b.shape);
    H.up.visible = !['turbine', 'tree', 'pool', 'track', 'garden'].includes(b.shape);
    handles.visible = true;
  }
  // Badges stay the same size on screen and their arrows point the way the room will grow.
  world.updaters.add(() => {
    if (!handles.visible) return;
    const s = Math.min(1.1, Math.max(0.3, 0.62 / world.camera.zoom));
    for (const [k, sp] of Object.entries(H)) {
      sp.scale.set(s, s, 1);
      if (!DIRS[k]) continue;
      const a = world.toScreen(sp.position), b2 = world.toScreen(sp.position.clone().add(DIRS[k]));
      sp.material.rotation = Math.atan2(-(b2.y - a.y), b2.x - a.x) - Math.PI / 2;
    }
  });

  function select(id, { quiet = false } = {}) {
    S.selected = id;
    ui.querySelector('.swatches')?.remove();
    const b = id ? model.byId.get(id) : null;
    if (!b) { handles.visible = false; selbar.hidden = true; defaultHint(); return; }
    placeHandles();
    drawSelbar(b);
    if (!quiet) { sfx.tap(); say(PROGRAMMES[b.type].name); cheer(b); }
    setHint('Drag a blue arrow to make it bigger or smaller. Drag the room to move it.');
  }
  function drawSelbar(b) {
    const P = PROGRAMMES[b.type];
    selbar.hidden = false;
    selbar.innerHTML = '';
    const info = h(`<div class="selname">${emo(P.emoji)}<div><b>${esc(P.name)}</b><span>${b.w} × ${b.d} block${b.w * b.d > 1 ? 's' : ''}${b.h > 1 ? `, ${b.h} storeys` : ''}</span></div></div>`);
    info.addEventListener('click', () => say(`${P.name}. ${P.say}`));
    selbar.append(info);
    const btn = (ic, label, fn, cls = '') => { const x = h(`<button class="selbtn ${cls}" type="button">${icon(ic)}<span>${esc(label)}</span></button>`); x.addEventListener('click', e => { e.stopPropagation(); if (!['Shape', 'Turn', 'Launch!', 'Big Question'].includes(label)) say(label); fn(x); }); selbar.append(x); return x; };
    if (b.shape === 'rocket') btn('rocket', 'Launch!', () => launch(b), 'go');
    if (b.type === 'circle') btn('talk', 'Big Question', () => { select(null); hooks.bigQuestion?.(); }, 'go');
    if (P.shapes.length > 1) btn('shape', 'Shape', () => nextShape(b));
    btn('colour', 'Colour', x => swatches(b, x));
    if (WINDOWED.has(b.shape) && b.surface !== 'glass') btn('windows', 'Windows', x => windowsPick(b, x));
    if (!NO_SURFACE.has(b.shape)) btn('surface', 'Walls', x => surfaces(b, x));
    btn('turn', 'Turn', () => turnBox(b));
    btn('copy', 'Copy', () => copyBox(b));
    btn('bin', 'Bin', () => { const fell = model.remove(b.id); sfx.bin(); if (fell) toast('The rooms on top came down too. Undo brings them back.'); select(null); }, 'no');
    btn('done', 'Done', () => select(null), 'ok');
  }
  function nextShape(b) {
    const list = PROGRAMMES[b.type].shapes, s = list[(list.indexOf(b.shape) + 1) % list.length];
    const r = model.update(b.id, { shape: s });
    if (!r.ok) { sfx.no(); toast(WHY[r.why] || 'That shape will not fit here.'); return; }
    model.setStyle(b.type, { shape: s });
    sfx.tap(); say(SHAPES[s].name); select(b.id, { quiet: true });
  }
  function popover(anchor, html) {
    ui.querySelector('.swatches')?.remove();
    const pop = h(`<div class="swatches">${html}</div>`);
    ui.append(pop);
    const r = anchor.getBoundingClientRect(), pr = ui.getBoundingClientRect();
    pop.style.left = Math.max(260, Math.min(pr.width - pop.offsetWidth / 2 - 100, r.left + r.width / 2 - pr.left)) + 'px';
    return pop;
  }
  function swatches(b, anchor) {
    const pop = popover(anchor, PALETTE.map(p => `<button class="sw ${b.colour === p.id ? 'on' : ''}" type="button" data-c="${p.id}" style="background:${p.hex}" aria-label="${esc(p.name)}"></button>`).join(''));
    pop.addEventListener('click', e => { const c = e.target.closest('[data-c]')?.dataset.c; if (!c) return; model.update(b.id, { colour: c }); model.setStyle(b.type, { colour: c }); sfx.tap(); say(PALETTE.find(p => p.id === c).name); select(b.id, { quiet: true }); });
  }
  function surfaces(b, anchor) {
    const pop = popover(anchor, SURFACES.map(s => `<button class="surf ${(b.surface || 'plain') === s.id ? 'on' : ''}" type="button" data-s="${s.id}"><i class="sf sf-${s.id}"></i><span>${esc(s.name)}</span></button>`).join(''));
    pop.classList.add('surfaces');
    pop.addEventListener('click', e => { const s = e.target.closest('[data-s]')?.dataset.s; if (!s) return; model.update(b.id, { surface: s }); sfx.tap(); say(SURFACES.find(x => x.id === s).name); select(b.id, { quiet: true }); });
  }
  function windowsPick(b, anchor) {
    const now = winStyle(b), hex = colourHex(b.colour);
    const pop = popover(anchor, WINDOWS.map(w => `<button class="surf ${now === w.id ? 'on' : ''}" type="button" data-w="${w.id}">${winSwatch(w.id, hex)}<span>${esc(w.name)}</span></button>`).join(''));
    pop.classList.add('surfaces');
    pop.addEventListener('click', e => { const w = e.target.closest('[data-w]')?.dataset.w; if (!w) return; model.update(b.id, { win: w }); model.setStyle(b.type, { win: w }); sfx.tap(); say(WINDOWS.find(x => x.id === w).name); select(b.id, { quiet: true }); });
  }
  // 3, 2, 1... lift off! The rocket climbs out of sight in a puff of smoke, then floats back down.
  function launch(b) {
    const g = pieces.get(b.id); let rk = null; g?.traverse(o => { if (o.userData.rocket) rk = o; });
    if (!rk || rk.userData.flying) return;
    rk.userData.flying = true;
    say('Three, two, one. Lift off!');
    const puffs = [], base = rk.position.y;
    let t = 0;
    const fn = dt => {
      t += dt;
      const up = t < 0.8 ? 0 : t < 4 ? Math.pow(t - 0.8, 2) * 1.6 : t < 6 ? 16.4 : Math.max(0, 16.4 - (t - 6) * 4.5);
      rk.position.y = base + up;
      rk.rotation.y += dt * (t < 4 ? 0.6 : 0);
      if (t > 0.3 && t < 4.5 && Math.random() < 0.6) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.08 + Math.random() * 0.06, 8, 6), new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }));
        p.position.set(rk.position.x + (Math.random() - 0.5) * 0.15, rk.position.y + 0.02, rk.position.z + (Math.random() - 0.5) * 0.15);
        p.userData.v = new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.05, (Math.random() - 0.5) * 0.5);
        g.add(p); puffs.push(p);
      }
      for (const p of puffs) { p.position.addScaledVector(p.userData.v, dt); p.scale.multiplyScalar(1 + dt * 1.4); p.material.opacity = Math.max(0, p.material.opacity - dt * 0.35); }
      if (t > 9.8) { rk.position.y = base; rk.userData.flying = false; for (const p of puffs) { g.remove(p); p.geometry.dispose(); p.material.dispose(); } world.updaters.delete(fn); say('The rocket is back on its launch pad.'); }
    };
    world.updaters.add(fn);
    sfx.whoosh(); setTimeout(() => sfx.whoosh(), 800); setTimeout(() => sfx.whoosh(), 1300);
  }
  function turnBox(b) {
    // A square piece turns a quarter where it stands (its door and windows turn with it);
    // a long piece swings round (and on every second turn faces the other way).
    const rot = ((b.rot || 0) + 1) % 4;
    if (b.w === b.d) { model.update(b.id, { rot }); sfx.whoosh(); say('Turn!'); select(b.id, { quiet: true }); return; }
    const cx = b.x + b.w / 2, cz = b.z + b.d / 2;
    const n = { w: b.d, d: b.w, x: Math.round(cx - b.d / 2), z: Math.round(cz - b.w / 2), rot };
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

  // ---------- the inside view ----------
  function topFloor() { return Math.max(0, ...model.boxes.map(b => b.level + b.h - 1)); }
  function setInside(on, { quiet = false } = {}) {
    S.inside = on;
    if (on) { S.tool = null; select(null); drawTray(); S.floor = Math.min(S.floor, topFloor()); }
    tray.hidden = on;
    ui.querySelector('.sbtn.inside').classList.toggle('on', on);
    floorsEl.hidden = !on;
    siteView.setGridStrong(!on && !!S.tool);
    redraw();
    defaultHint();
    if (on && !quiet) { sfx.whoosh(); say('Inside the school! You can see the rooms, the furniture and the people.'); }
  }
  const FLOOR_NAMES = ['Ground floor', 'First floor', 'Second floor', 'Third floor', 'Fourth floor', 'Fifth floor', 'Sixth floor', 'Seventh floor'];
  function drawFloors() {
    const top = topFloor();
    floorsEl.innerHTML = `<span class="ftitle">${icon('floors')}</span>`;
    for (let l = 0; l <= top; l++) {
      const b = h(`<button class="fbtn ${l === S.floor ? 'on' : ''}" type="button">${esc(FLOOR_NAMES[l] || `Floor ${l}`)}</button>`);
      b.addEventListener('click', () => { S.floor = l; sfx.tap(); say(FLOOR_NAMES[l]); redraw(); });
      floorsEl.append(b);
    }
    const out = h(`<button class="fbtn close" type="button">${icon('close')}<span>Back outside</span></button>`);
    out.addEventListener('click', () => setInside(false));
    floorsEl.append(out);
  }

  // ---------- touch: tap, drag an arrow, drag a room ----------
  const canvas = world.canvas;
  // ---------- a bigger site: green arrows on the edges of the land ----------
  const growTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.fillStyle = 'rgba(20,30,60,0.25)'; g.beginPath(); g.arc(64, 68, 56, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2fa35a'; g.beginPath(); g.arc(64, 64, 47, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(64, 26); g.lineTo(94, 60); g.lineTo(76, 60); g.lineTo(76, 98); g.lineTo(52, 98); g.lineTo(52, 60); g.lineTo(34, 60); g.closePath(); g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const growbar = ui.querySelector('.growbar'), siteArrows = new THREE.Group(); world.scene.add(siteArrows); siteArrows.visible = false;
  const GDIR = { px: [1, 0], nx: [-1, 0], pz: [0, 1], nz: [0, -1] }, GA = {};
  for (const k of Object.keys(GDIR)) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: growTex, depthTest: false, transparent: true })); sp.renderOrder = 20; sp.userData.dir = k; GA[k] = sp; siteArrows.add(sp); }
  // Each green arrow adds a row of new land on its side of the site (up to MAX_PAD rows a side).
  const SIDE = { px: 'e', nx: 'w', pz: 's', nz: 'n' };
  function placeSiteArrows() {
    const y = 0.5;
    GA.px.position.set(GRID.w + 0.7, y, GRID.d / 2); GA.nx.position.set(-0.7, y, GRID.d / 2);
    GA.pz.position.set(GRID.w / 2, y, GRID.d + 0.7); GA.nz.position.set(GRID.w / 2, y, -0.7);
    for (const k of Object.keys(GA)) GA[k].visible = model.pad[SIDE[k]] < MAX_PAD;
  }
  world.updaters.add(() => {
    if (!siteArrows.visible) return;
    const s = Math.min(1.4, Math.max(0.45, 0.8 / world.camera.zoom));
    for (const [k, sp] of Object.entries(GA)) {
      sp.scale.set(s, s, 1);
      const a = world.toScreen(sp.position), b2 = world.toScreen(sp.position.clone().add(new THREE.Vector3(GDIR[k][0], 0, GDIR[k][1])));
      sp.material.rotation = Math.atan2(-(b2.y - a.y), b2.x - a.x) - Math.PI / 2;
    }
  });
  function startGrow() {
    if (S.day) stopDay(); if (S.inside) setInside(false, { quiet: true });
    select(null); S.tool = null; drawTray();
    S.siteEdit = true; siteView.setGridStrong(true); placeSiteArrows(); siteArrows.visible = true;
    growbar.hidden = false; sideEl.querySelector('.sbtn.grow').classList.add('on');
    frameSite();
    say('Tap a green arrow to add more land to that side of the site.');
    setHint('Tap a green arrow to add more land.');
  }
  function stopGrow() {
    S.siteEdit = false; siteArrows.visible = false; growbar.hidden = true; siteView.setGridStrong(false);
    sideEl.querySelector('.sbtn.grow').classList.remove('on'); defaultHint();
  }
  // Make the site again at its new size. Land added to the west or north moves everything along, so the
  // buildings stay where they are on the land.
  function resize(dx, dz) {
    for (const b of model.boxes) { b.x += dx; b.z += dz; }
    if (dx || dz) model.history = [];   // (old undo steps were at the old positions)
    model.grown = model.grown.map(([x, z]) => [x + dx, z + dz]);
    makeSite(model.pad);
    buildSite(world, siteView);
    if (model.grown.length) growSquares(model.grown);
    siteView.regrow(); trails.resize();
    model.changed({ resized: true });
    siteView.setGridStrong(S.siteEdit); placeSiteArrows(); frameSite();
  }
  function growDir(dir) {
    const side = SIDE[dir];
    if (model.pad[side] >= MAX_PAD) { sfx.no(); toast('That side is as big as it can be.'); return; }
    model.pad[side]++;
    resize(side === 'w' ? 1 : 0, side === 'n' ? 1 : 0);
    sfx.grow(); say(model.pad[side] >= MAX_PAD ? 'More land! That side is as big as it can be now.' : 'More land!');
  }
  growbar.querySelector('.done').addEventListener('click', () => { sfx.tap(); stopGrow(); });
  growbar.querySelector('.reset').addEventListener('click', () => { sfx.tap(); resetSite(); });
  // Put the land back exactly as Finn painted it: no extra land, and no forest cleared away. Rooms standing on
  // land that goes (and anything resting on them) are taken away; everything else stays where it is.
  function resetSite() {
    if (S.day) stopDay();
    const p = model.pad, grown = new Set(model.grown.map(([x, z]) => `${x},${z}`));
    const goes = (x, z) => x < p.w || z < p.n || x >= GRID.w - p.e || z >= GRID.d - p.s || grown.has(`${x},${z}`);
    const off = new Map();
    for (const b of model.boxes) if (b.level === 0 && model.squares(b).some(([x, z]) => goes(x, z))) { off.set(b.id, b); for (const [id, t] of model.above(b)) off.set(id, t); }
    const sure = off.size
      ? `Put the site back as it was? ${off.size} room${off.size > 1 ? 's' : ''} on the extra land will be taken away.`
      : 'Put the site back as it was, with all its trees and hills?';
    say(sure);
    if (!confirm(sure)) return;
    model.boxes = model.boxes.filter(b => !off.has(b.id));
    model.history = [];                 // (undo can't go back across a change of site)
    model.grown = [];
    const dx = -p.w, dz = -p.n;
    model.pad = { w: 0, e: 0, n: 0, s: 0 };
    select(null);
    resize(dx, dz);
    sfx.whoosh(); say('The site is back to how it was.');
  }
  // Land added in an earlier visit comes back.
  if (model.grown.length) { growSquares(model.grown); siteView.regrow(); }

  const onDown = e => {
    if (!ui.isConnected || ui.hidden) return;
    ui.querySelector('.swatches')?.remove();
    const start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    if (S.siteEdit) {
      let best = null, bd = 48;
      for (const sp of siteArrows.children) { if (!sp.visible) continue; const p = world.toScreen(sp.position), dd = Math.hypot(p.x - e.clientX, p.y - e.clientY); if (dd < bd) { bd = dd; best = sp; } }
      if (best) { growDir(best.userData.dir); world.controls.enabled = false; S.drag = { mode: 'grow', start, moved: false }; }
      return;
    }
    if (S.inside) { S.drag = { mode: 'tap', start, moved: false }; return; }
    // An arrow badge?
    if (handles.visible) {
      const ray = world.rayFrom(e.clientX, e.clientY);
      let best = null, bd = 44;
      for (const sp of handles.children) { if (!sp.visible) continue; const p = world.toScreen(sp.position); const dd = Math.hypot(p.x - e.clientX, p.y - e.clientY); if (dd < bd) { bd = dd; best = sp; } }
      if (best && best.userData.handle === 'turn') { S.drag = { mode: 'turn', start, moved: false }; return; }
      if (best) {
        const b = model.byId.get(S.selected), k = best.userData.handle;
        S.drag = { mode: 'resize', handle: k, start, orig: { ...b }, moved: false, plane: new THREE.Plane(), last: { ...b } };
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
    if (S.tool && e.pointerType !== 'mouse') { const t = target(e.clientX, e.clientY); if (t) { const nb = proposal(t); showGhost(nb.box, nb.ok); } }
  };
  const onMove = e => {
    const d = S.drag;
    if (!d) {
      if (S.tool && e.pointerType === 'mouse' && e.buttons === 0 && !ui.hidden) { const t = target(e.clientX, e.clientY); if (t) { const nb = proposal(t); showGhost(nb.box, nb.ok); } else clearGhost(); }
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
      if (Object.keys(patch).every(key => cur[key] === patch[key])) return;
      if (!d.snap) { model.snapshot(); d.snap = true; }
      const before = cur.w * cur.d * cur.h;
      const r = model.update(S.selected, patch, { snapshot: false });
      if (r.ok) { const nb = model.byId.get(S.selected); (nb.w * nb.d * nb.h > before ? sfx.grow : sfx.shrink)(); drawSelbar(nb); }
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
    if (d.mode === 'turn') { const b = model.byId.get(S.selected); if (b) turnBox(b); return; }
    if (d.mode === 'resize') {
      if (!d.moved) {
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

  function cheer(b) {
    crowd.cheer(b.id);
    sfx.cheer();
    confetti(new THREE.Vector3(b.x + b.w / 2, yOf(b) + b.h * LEVEL + 0.1, b.z + b.d / 2));
  }
  function confetti(top, n = 46, spread = 1.6) {
    const cols = ['#f7c22e', '#e2457d', '#22b2bf', '#a3d140', '#7c46a8', '#f28b30', '#3d8de0'], bits = [];
    const geo = new THREE.PlaneGeometry(0.05, 0.03);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide, transparent: true }));
      m.position.copy(top); m.userData.v = new THREE.Vector3((Math.random() - 0.5) * spread, 1.4 + Math.random() * 1.4, (Math.random() - 0.5) * spread); m.userData.s = new THREE.Vector3(Math.random() * 9, Math.random() * 9, 0);
      world.scene.add(m); bits.push(m);
    }
    let t = 0;
    const fn = dt => {
      t += dt;
      for (const m of bits) { m.userData.v.y -= dt * 3.2; m.position.addScaledVector(m.userData.v, dt); m.rotation.x += dt * m.userData.s.x; m.rotation.y += dt * m.userData.s.y; m.material.opacity = Math.max(0, 1 - t / 1.8); }
      if (t > 1.8) { for (const m of bits) { world.scene.remove(m); m.material.dispose(); } geo.dispose(); world.updaters.delete(fn); }
    };
    world.updaters.add(fn);
  }

  // ---------- the school day ----------
  const day = new SchoolDay({ world, model, crowd, yOf, seatsOf: id => seatsById.get(id), layer: ui.querySelector('.bubbles'), onPeriod: (i, P) => drawDaybar(i, P), onEnd: () => { endDay(); setTimeout(() => hooks.dayDone?.(PERIODS), 900); } });
  function startDay() {
    if (!model.boxes.some(b => ['classroom', 'ringhouse', 'treehouse'].includes(b.type))) { sfx.no(); toast('Build a classroom first!'); say('Build a classroom first, so the children have somewhere to learn.'); return; }
    if (S.walking) return;
    select(null); S.tool = null; drawTray();
    S.day = true; S.floor = 0;
    setInside(true, { quiet: true });
    floorsEl.hidden = true;
    trails.clear();
    crowd.onStep = (x, z) => trails.paint(x, z);
    day.start();
    sideEl.querySelector('.sbtn.day').classList.add('on');
    daybar.hidden = false;
  }
  function drawDaybar(i, P) {
    daybar.innerHTML = PERIODS.map((p, k) => `<div class="period ${k === i ? 'now' : k < i ? 'past' : ''}">${emo(p.emoji)}<span>${esc(p.name)}</span></div>`).join('') + `<button class="fbtn close" type="button">${icon('close')}<span>Stop</span></button>`;
    daybar.querySelector('.close').addEventListener('click', () => { stopDay(); });
    sfx.bell();
    say(i === 0 ? 'Good morning! The classes are walking in.' : i === PERIODS.length - 1 ? 'Home time! Watch the paths they made across the grass.' : `Bell! Time for ${P.name.toLowerCase()}.`);
    setHint(`${emo(P.emoji)} ${esc(P.name)}. Tap a child to hear what they say.`);
  }
  function stopDay() { if (day.running) day.stop(true); endDay(); }
  function endDay() {
    if (!S.day) return;
    S.day = false;
    crowd.onStep = null;
    daybar.hidden = true;
    sideEl.querySelector('.sbtn.day').classList.remove('on');
    setInside(false, { quiet: true });
    say('The school day is over. Can you see the paths the children made?');
  }

  // ---------- walking inside ----------
  function startWalking() {
    if (S.day) stopDay();
    select(null); S.tool = null; drawTray();
    S.walkMode = true; S.floor = 0;
    setInside(true, { quiet: true });
    ui.hidden = true;
    S.walking = startWalk({ world, model, root, yOf, crowd, walls: () => walls, setFloor: l => { S.floor = l; redraw(); }, onExit: () => { S.walking = null; ui.hidden = false; S.walkMode = false; setInside(false, { quiet: true }); } });
  }

  function handleTap(x, y) {
    if (S.day && day.tap(x, y)) return;
    if (S.inside || viewer) { const b = boxAt(x, y); if (b) { say(PROGRAMMES[b.type].name); cheer(b); } return; }
    if (S.tool) { const t = target(x, y); if (t) place(t); return; }
    const b = boxAt(x, y);
    if (b) { if (b.id === S.selected) select(null); else select(b.id); }
    else if (S.selected) select(null);
  }

  // ---------- side buttons ----------
  ui.querySelector('.side').addEventListener('click', e => {
    const el = e.target.closest('[data-a]'), a = el?.dataset.a; if (!a) return;
    sfx.tap();
    if (['undo', 'left', 'right', 'in', 'out', 'home', 'print'].includes(a)) say(el.querySelector('span')?.textContent || '');
    if (a === 'undo') { if (!model.undo()) toast('Nothing to undo'); }
    if (a === 'inside') { if (S.day) stopDay(); else setInside(!S.inside); }
    if (a === 'day') { if (S.day) stopDay(); else startDay(); }
    if (a === 'walk') startWalking();
    if (a === 'left') world.turn(-1);
    if (a === 'right') world.turn(1);
    if (a === 'in') zoomBy(1.3);
    if (a === 'out') zoomBy(1 / 1.3);
    if (a === 'home') frameSite();
    if (a === 'grow') { if (S.siteEdit) stopGrow(); else startGrow(); }
    if (a === 'print') import('./print.js').then(m => m.openPrint(world, model, siteView, { design, crowd, handles }));
  });
  function zoomBy(f) {
    const b = model.byId.get(S.selected);
    const t = world.controls.target;
    world.frame(b && f > 1 ? (t.x + b.x + b.w / 2) / 2 : t.x, b && f > 1 ? (t.z + b.z + b.d / 2) / 2 : t.z, clamp(world.camera.zoom * f, 0.6, 6));
  }
  // The whole site in view (it may have grown).
  function frameSite(instant = false) { world.frame(GRID.w / 2 - 2.6, GRID.d / 2 + 1.6, 1.05 * Math.min(20 / GRID.w, 14 / GRID.d), instant); }

  drawTray();
  redraw();
  frameSite(true);
  setTool(null);
  return {
    S, select, setTool, redraw, frameSite, setInside, tap: handleTap, crowd, hooks, startDay, resetSite,
    // Everyone cheers and confetti flies (a wish has come true).
    celebrate() {
      for (const b of model.boxes) crowd.cheer(b.id);
      sfx.cheer(); setTimeout(() => sfx.cheer(), 450);
      const t = world.controls.target;
      for (let i = 0; i < 3; i++) setTimeout(() => confetti(new THREE.Vector3(t.x + (i - 1) * 1.2, 0.8, t.z + (i - 1) * 0.6), 60, 2.4), i * 220);
    },
    // A picture of the school as it is on screen, saved to the tablet (for showing at school).
    photo() {
      const hv = handles.visible, gv = siteArrows.visible; handles.visible = false; siteArrows.visible = false;
      world.renderer.render(world.scene, world.camera);
      world.renderer.domElement.toBlob(blob => {
        handles.visible = hv; siteArrows.visible = gv;
        if (!blob) return;
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Finns-dream-school-${new Date().toISOString().slice(0, 10)}.png`;
        document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }, 'image/png');
      const flash = h('<div class="flash"></div>'); ui.append(flash); setTimeout(() => flash.remove(), 600);
      sfx.whoosh(); say('Snap! A photo of your school.');
    },
    screenOf(x, z, y = 0) { return world.toScreen(new THREE.Vector3(x + 0.5, y, z + 0.5)); },
    show(on) { ui.hidden = !on; design.visible = on; crowd.mesh.visible = on; handles.visible = on && !!S.selected && !S.inside; },
    refreshTray: drawTray,
  };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
