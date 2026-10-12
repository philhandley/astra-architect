// Walk: first person at a child's eye height. Thumb joystick to walk, drag to look, or tap a room to walk there.
import * as THREE from 'three';
import { key, roomGroups } from '../core/design.js';
import { computeDoors, buildGraph, findPath, gateKey } from '../core/arch.js';
import { ROOMS, LEVEL_H } from '../core/catalogue.js';
import { site } from '../core/site.js';
import { h, esc, say, sfx, toast } from '../ui/dom.js';
import { emo } from '../core/emoji.js';
import { icon } from '../core/icons.js';

const EYE = 0.27;
const SPEED = 1.5;

export function startWalk(api, world, root) {
  const idx = api.idx;
  const graph = buildGraph(idx, computeDoors(idx));
  const cam = world.cam;
  const saved = { pos: cam.position.clone(), target: world.controls.target.clone(), fov: cam.fov, near: cam.near };
  world.controls.enabled = false;
  world.baseFov = 70; cam.near = 0.02; world.applyShift();
  world.scene.fog = new THREE.Fog('#dfeaf0', 5, 34);

  // Start at the gate, facing the school.
  let at = graph.nodes.get(gateKey()) || [...graph.nodes.values()][0];
  const me = { x: at.x + 0.5, z: at.z + 0.5, l: at.l, y: at.y, yaw: 0, pitch: -0.05 };
  const groups = roomGroups(idx).filter(g => !['stairs', 'bridge'].includes(g.room));
  if (groups.length) {
    const g = groups[0];
    const c = g.cells[0];
    me.yaw = Math.atan2(-(c.x + 0.5 - me.x), -(c.z + 0.5 - me.z));
  }

  const ui = h(`<div class="walk-ui">
    <div class="crosshair"></div>
    <div class="walk-pad"></div>
    <div class="walk-dest"></div>
    <div class="walk-act"></div>
  </div>`);
  root.appendChild(ui);
  // Walking needs the space: hide the room tray and the undo/zoom row while we walk.
  const hideEls = [root.querySelector('.rail.left'), root.querySelector('.topright')].filter(Boolean);
  hideEls.forEach(e => { e.dataset.prevDisplay = e.style.display; e.style.display = 'none'; });
  const pad = ui.querySelector('.walk-pad');
  const dest = ui.querySelector('.walk-dest');
  const act = ui.querySelector('.walk-act');

  // Joystick (nipplejs from the CDN), with a simple fallback if it does not load.
  let joy = { x: 0, y: 0 };
  let nipple = null;
  import('nipplejs').then(m => {
    const lib = m.default || m;
    nipple = lib.create({ zone: pad, mode: 'static', position: { left: '50%', top: '50%' }, color: '#2f6fe4', size: 150, restOpacity: 0.85 });
    nipple.on('move', (e, d) => { if (d && d.vector) joy = { x: d.vector.x * Math.min(1, d.force), y: d.vector.y * Math.min(1, d.force) }; auto = null; });
    nipple.on('end', () => { joy = { x: 0, y: 0 }; });
  }).catch(() => { pad.innerHTML = '<div class="pill">Drag to look, tap a room below to walk there</div>'; });

  // Look by dragging on the scene.
  let look = null;
  const onDown = e => { if (e.target !== world.canvas) return; look = { x: e.clientX, y: e.clientY, id: e.pointerId }; };
  const onMove = e => {
    if (!look || e.pointerId !== look.id) return;
    me.yaw -= (e.clientX - look.x) * 0.006;
    me.pitch = Math.max(-0.9, Math.min(0.7, me.pitch - (e.clientY - look.y) * 0.004));
    look.x = e.clientX; look.y = e.clientY;
  };
  const onUp = e => { if (look && e.pointerId === look.id) look = null; };
  world.canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  const keys = new Set();
  const onKey = e => { if (e.type === 'keydown') keys.add(e.key); else keys.delete(e.key); };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  // Destinations: one button per room, plus the gate.
  const addDest = (label, emoji, goal) => {
    const b = h(`<button class="opt" type="button">${emo(emoji)}<span>${esc(label)}</span></button>`);
    b.addEventListener('click', () => walkTo(goal, label));
    dest.append(b);
  };
  addDest('Gate', '🚪', [gateKey()]);
  const seen = new Set();
  for (const g of groups) {
    if (seen.has(g.room + g.level)) continue;
    seen.add(g.room + g.level);
    const goals = g.cells.map(c => key(c.x, c.z, g.level)).filter(k => graph.nodes.has(k));
    if (goals.length) addDest(ROOMS[g.room].name + (g.level ? ` (floor ${g.level})` : ''), ROOMS[g.room].emoji, goals);
  }

  let auto = null;   // { path: [keys], kinds, i, t, from }
  function walkTo(goals, label) {
    const here = nodeKeyAt();
    const p = findPath(graph, here, goals);
    if (!p) { sfx.no(); say(`I can't find a way to the ${label.toLowerCase()}. Is there a door, or stairs?`); api.emit('walkStuck'); return; }
    sfx.tap();
    auto = { path: p.path, kinds: p.kinds, i: 0, t: 0, label };
    api.emit('walkTo', { label });
  }

  function nodeKeyAt() {
    const k = key(Math.floor(me.x), Math.floor(me.z), me.l);
    if (graph.nodes.has(k)) return k;
    let best = null, bd = 1e9;
    for (const [kk, n] of graph.nodes) { if (n.l !== me.l) continue; const d = Math.hypot(n.x + 0.5 - me.x, n.z + 0.5 - me.z); if (d < bd) { bd = d; best = kk; } }
    return best;
  }
  const edgeBetween = (a, b) => (graph.edges.get(a) || []).find(e => e.to === b);

  // Can we step from the current cell to (nx, nz) on this level? Door edges need you to be in the doorway.
  function canStep(nx, nz) {
    const a = key(Math.floor(me.x), Math.floor(me.z), me.l);
    const b = key(Math.floor(nx), Math.floor(nz), me.l);
    if (a === b) return true;
    const e = edgeBetween(a, b);
    if (!e) return false;
    if (e.kind === 'door') {
      const fx = nx - Math.floor(nx), fz = nz - Math.floor(nz);
      const across = Math.floor(nx) !== Math.floor(me.x) ? fz : fx;
      return across > 0.28 && across < 0.72;
    }
    return true;
  }

  // Up, down and slide buttons when standing on a connector.
  let lastAct = '';
  function updateActions() {
    const here = nodeKeyAt();
    const vert = (graph.edges.get(here) || []).filter(e => e.kind === 'stairs' || e.kind === 'climb' || e.kind === 'slide');
    const sig = here + vert.map(e => e.to).join();
    if (sig === lastAct) return;
    lastAct = sig;
    act.innerHTML = '';
    for (const e of vert) {
      const to = graph.nodes.get(e.to);
      const up = to.l > me.l;
      const label = e.kind === 'slide' ? 'Slide!' : up ? (e.kind === 'climb' ? 'Climb up' : 'Go up') : (e.kind === 'climb' ? 'Climb down' : 'Go down');
      const b = h(`<button class="btn big ${e.kind === 'slide' ? 'go' : ''}" type="button">${e.kind === 'slide' ? emo('🛝') : icon(up ? 'up' : 'down')} ${label}</button>`);
      b.addEventListener('click', () => { auto = { path: [here, e.to], kinds: [e.kind], i: 0, t: 0, label }; e.kind === 'slide' ? sfx.whoosh() : sfx.step(); api.emit('walkVertical', { kind: e.kind }); });
      act.append(b);
    }
  }

  const fwd = new THREE.Vector3();
  const update = dt => {
    if (auto) {
      const a = graph.nodes.get(auto.path[auto.i]), b = graph.nodes.get(auto.path[auto.i + 1]);
      if (!b) { auto = null; }
      else {
        const kind = auto.kinds[auto.i];
        const dur = kind === 'slide' ? 0.9 : kind === 'stairs' || kind === 'climb' ? 1.1 : 0.42;
        auto.t += dt / dur;
        const t = Math.min(1, auto.t);
        const ax = a.x + 0.5, az = a.z + 0.5, bx = b.x + 0.5, bz = b.z + 0.5;
        me.x = ax + (bx - ax) * t; me.z = az + (bz - az) * t;
        me.y = a.y + (b.y - a.y) * (kind === 'slide' ? t * t : t);
        if (Math.hypot(bx - ax, bz - az) > 0.1) {
          const want = Math.atan2(-(bx - ax), -(bz - az));
          let d = want - me.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
          me.yaw += d * Math.min(1, dt * 6);
        }
        if (t >= 1) {
          me.l = b.l; auto.i++; auto.t = 0;
          if (auto.i >= auto.path.length - 1) { const lbl = auto.label; auto = null; if (lbl && !/up|down|slide/i.test(lbl)) say(`Here we are: the ${lbl.toLowerCase()}.`); api.emit('walkArrive', { label: lbl }); }
        }
      }
    } else {
      let mx = joy.x, my = joy.y;
      if (keys.has('ArrowUp') || keys.has('w')) my = 1;
      if (keys.has('ArrowDown') || keys.has('s')) my = -1;
      if (keys.has('ArrowLeft') || keys.has('a')) mx = -1;
      if (keys.has('ArrowRight') || keys.has('d')) mx = 1;
      if (mx || my) {
        const sx = Math.sin(me.yaw), cz = Math.cos(me.yaw);
        const vx = (-sx * my + cz * mx) * SPEED * dt, vz = (-cz * my - sx * mx) * SPEED * dt;
        if (canStep(me.x + vx, me.z + vz)) { me.x += vx; me.z += vz; }
        else if (canStep(me.x + vx, me.z)) me.x += vx;
        else if (canStep(me.x, me.z + vz)) me.z += vz;
        const n = graph.nodes.get(key(Math.floor(me.x), Math.floor(me.z), me.l));
        if (n) me.y += (n.y - me.y) * Math.min(1, dt * 8);
        api.emit('walkMove');
      }
    }
    cam.position.set(me.x, me.y + EYE, me.z);
    fwd.set(-Math.sin(me.yaw) * Math.cos(me.pitch), Math.sin(me.pitch), -Math.cos(me.yaw) * Math.cos(me.pitch));
    cam.lookAt(cam.position.clone().add(fwd));
    updateActions();
  };
  world.updaters.add(update);
  say('Walk round your school! Push the blue circle to walk, and drag to look round. Or tap a room to walk there.');

  return {
    me,
    destroy() {
      world.updaters.delete(update);
      ui.remove();
      hideEls.forEach(e => { e.style.display = e.dataset.prevDisplay || ''; });
      nipple && nipple.destroy();
      world.canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      world.scene.fog = null;
      world.baseFov = saved.fov; cam.near = saved.near; world.applyShift();
      cam.position.copy(saved.pos);
      world.controls.target.copy(saved.target);
      world.controls.enabled = true;
      cam.lookAt(saved.target);
    },
  };
}
