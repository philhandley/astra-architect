// Walk inside: a first-person view at a child's eye height. A joystick to walk and turn, a finger on the
// picture to look around, and a button for every room that glides you there.
import * as THREE from 'three';
import { PROGRAMMES, LEVEL } from './catalogue.js';
import { GRID, square, groundAt, site } from './site.js';
import { storeyFloor, CUTTABLE, outline } from './inside.js';
import { icon } from './icons.js';
import { h, esc, emo, say, sfx } from './ui.js';

const EYE = 0.17;           // about 1.3 metres: a six-year-old's eyes

export function startWalk({ world, model, root, yOf, walls = () => [], setFloor, onExit, crowd }) {
  const cam = new THREE.PerspectiveCamera(70, world.w / world.h, 0.01, 120);
  const saved = { camera: world.camera, controls: world.controls.enabled };
  world.controls.enabled = false;
  world.camera = cam;
  const me = { x: 0, z: 0, y: 0, yaw: 0, pitch: -0.08, floor: 0 };
  // Start out on the school yard, a little way from the buildings, looking at the school.
  const S = site();
  me.x = S.gate[0] + 0.5; me.z = S.gate[1] + 0.5;
  if (model.boxes.length) {
    const cx = model.boxes.reduce((a, b) => a + b.x + b.w / 2, 0) / model.boxes.length, cz = model.boxes.reduce((a, b) => a + b.z + b.d / 2, 0) / model.boxes.length;
    let best = null, bd = Infinity;
    for (let z = 0; z < GRID.d; z++) for (let x = 0; x < GRID.w; x++) {
      const q = square(x, z); if (!q?.build || q.zone === 'clearing' || model.at(x, z, 0)) continue;
      const d = Math.abs(Math.hypot(x + 0.5 - cx, z + 0.5 - cz) - 2.6) + (z + 0.5 < cz ? 1.5 : 0);
      if (d < bd) { bd = d; best = [x + 0.5, z + 0.5]; }
    }
    if (best) [me.x, me.z] = best;
    me.yaw = Math.atan2(-(cx - me.x), -(cz - me.z));
  }

  const ui = h(`<div class="walk-ui">
    <button class="walk-exit" type="button">${icon('close')}<span>Back to the model</span></button>
    <div class="joy"><div class="knob"></div></div>
    <div class="walk-rooms"></div>
    <div class="walk-tip">Push the blue button to walk. Drag the picture to look around.</div>
  </div>`);
  root.appendChild(ui);
  const joy = ui.querySelector('.joy'), knob = ui.querySelector('.knob');
  let stick = { x: 0, y: 0 }, auto = null;

  // The joystick: up walks forward, sideways turns.
  let jid = null;
  const jmove = e => {
    const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2);
    const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    stick = { x: dx, y: dy }; auto = null;
    knob.style.transform = `translate(${dx * 38}px, ${dy * 38}px)`;
  };
  joy.addEventListener('pointerdown', e => { jid = e.pointerId; try { joy.setPointerCapture(jid); } catch (err) { /* test */ } jmove(e); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === jid) jmove(e); });
  const jend = e => { if (e.pointerId !== jid) return; jid = null; stick = { x: 0, y: 0 }; knob.style.transform = ''; };
  joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);

  // Look around by dragging the picture.
  let look = null;
  const cv = world.canvas;
  const onDown = e => { look = { x: e.clientX, y: e.clientY, yaw: me.yaw, pitch: me.pitch, id: e.pointerId }; e.stopPropagation(); };
  const onMove = e => { if (!look || e.pointerId !== look.id) return; me.yaw = look.yaw - (e.clientX - look.x) * 0.006; me.pitch = Math.max(-0.9, Math.min(0.6, look.pitch - (e.clientY - look.y) * 0.004)); };
  const onUp = () => { look = null; };
  cv.addEventListener('pointerdown', onDown, { capture: true });
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);

  // A button for every room: glide there.
  const rooms = ui.querySelector('.walk-rooms');
  const seen = new Set();
  for (const b of model.boxes) {
    const P = PROGRAMMES[b.type];
    if (!P || !CUTTABLE.has(b.shape) || seen.has(b.type + b.level)) continue;
    seen.add(b.type + b.level);
    const btn = h(`<button class="wroom" type="button">${emo(P.emoji)}<span>${esc(P.name)}${b.level ? ` <small>(floor ${b.level})</small>` : ''}</span></button>`);
    btn.addEventListener('click', () => { sfx.tap(); say(`Let's go to the ${P.name.toLowerCase()}.`); goTo(b); });
    rooms.append(btn);
  }
  function goTo(b) {
    const fy = yOf(b) + storeyFloor(b, b.level) + 0.02;
    const tx = b.x + b.w / 2, tz = b.z + b.d / 2, o = outline(b);
    // Stand just inside the door (on the front wall), looking into the room; otherwise near the side I came from.
    let sx, sz, dir;
    for (let k = b.d / 2 - 0.17; k > 0.05; k -= 0.05) if (o.inside(0, k, 0.1)) { sx = tx; sz = tz + k; dir = 0; break; }
    if (sx === undefined) {
      dir = Math.atan2(me.x - tx, me.z - tz);
      sx = tx + Math.sin(dir) * Math.max(0.15, Math.min(b.w, b.d) * 0.3); sz = tz + Math.cos(dir) * Math.max(0.15, Math.min(b.w, b.d) * 0.3);
    }
    auto = { x0: me.x, z0: me.z, y0: me.y, x1: sx, z1: sz, y1: fy, yaw0: me.yaw, yaw1: dir, t: 0 };
    if (b.level !== me.floor) { me.floor = b.level; setFloor(b.level); }
  }
  ui.querySelector('.walk-exit').addEventListener('click', () => { sfx.tap(); stop(); onExit?.(); });

  // Where is the floor under my feet? (A room on the floor I am on, or the ground.)
  function floorAt(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z);
    for (const b of model.boxes) {
      if (b.level > me.floor || me.floor >= b.level + b.h || !CUTTABLE.has(b.shape)) continue;
      if (xi >= b.x && xi < b.x + b.w && zi >= b.z && zi < b.z + b.d) return yOf(b) + storeyFloor(b, me.floor) + 0.02;
    }
    if (me.floor > 0) return null;
    return Math.max(groundAt(x, z), site().sea + 0.02);
  }
  const fn = dt => {
    cam.aspect = world.w / world.h; cam.updateProjectionMatrix();
    if (auto) {
      auto.t = Math.min(1, auto.t + dt / 1.6);
      const e = auto.t < 0.5 ? 2 * auto.t * auto.t : 1 - Math.pow(-2 * auto.t + 2, 2) / 2;
      me.x = auto.x0 + (auto.x1 - auto.x0) * e; me.z = auto.z0 + (auto.z1 - auto.z0) * e; me.y = auto.y0 + (auto.y1 - auto.y0) * e;
      let dy = auto.yaw1 - auto.yaw0; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      me.yaw = auto.yaw0 + dy * e;
      if (auto.t >= 1) auto = null;
    } else {
      me.yaw -= stick.x * dt * 1.6;
      const sp = -stick.y * dt * 0.9;
      const nx = Math.max(0.2, Math.min(GRID.w - 0.2, me.x - Math.sin(me.yaw) * sp)), nz = Math.max(0.2, Math.min(GRID.d - 0.2, me.z - Math.cos(me.yaw) * sp));
      // Bump into walls (slide along them); doorways are gaps.
      const free = (x, z) => { for (const [ax, az, bx, bz] of walls()) { const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1; const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l2)); if (Math.hypot(x - ax - vx * t, z - az - vz * t) < 0.055) return false; } return true; };
      let tx = nx, tz = nz;
      if (!free(tx, tz)) { if (free(nx, me.z)) tz = me.z; else if (free(me.x, nz)) tx = me.x; else { tx = me.x; tz = me.z; } }
      const f = floorAt(tx, tz);
      if (f !== null) { me.x = tx; me.z = tz; me.y += (f - me.y) * Math.min(1, dt * 8); }
      const step = Math.abs(sp) > 0 ? Math.abs(Math.sin(performance.now() / 120)) * 0.006 : 0;
      me.bob = step;
    }
    cam.position.set(me.x, me.y + EYE + (me.bob || 0), me.z);
    // Children right next to me step aside (so a head never fills the view).
    if (crowd) crowd.near = { x: me.x, y: me.y, z: me.z, r: 0.18 };
    cam.rotation.set(me.pitch, me.yaw, 0, 'YXZ');
  };
  me.y = floorAt(me.x, me.z) ?? 0;
  world.updaters.add(fn);
  say('Walk inside your school! Push the blue button to walk, or tap a room to go there.');

  function stop() {
    world.updaters.delete(fn);
    if (crowd) crowd.near = null;
    world.camera = saved.camera;
    world.controls.enabled = saved.controls;
    cv.removeEventListener('pointerdown', onDown, { capture: true });
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    ui.remove();
  }
  return { stop };
}
