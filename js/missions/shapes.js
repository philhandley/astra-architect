// Mission 4: the shape lab. Meet the shapes, then test an arch: put a weight on it, then pull the keystone.
import * as THREE from 'three';
import { getWorld } from '../core/scene.js';
import { FORMS } from '../core/catalogue.js';
import { formGeometry, grainTexture } from '../core/forms3d.js';
import { formIcon } from '../ui/formicons.js';
import { h, esc, say, sayAuto, sfx } from '../ui/dom.js';
import { icon } from '../core/icons.js';

const LAB = [
  { id: 'cube', colour: '#f28c28', x: -3.6, z: 0.6, demo: 'stack' },
  { id: 'tower', colour: '#e3a21a', x: -2.4, z: -0.9, demo: 'grow' },
  { id: 'cylinder', colour: '#8db87c', x: -1.0, z: -1.6, demo: 'roll' },
  { id: 'arch', colour: '#c9b38a', x: 0.6, z: -1.8, demo: 'arch' },
  { id: 'ring', colour: '#12857e', x: 2.3, z: -1.2, demo: 'run', label: 'Ring', good: 'Four curves make a ring. Fuji Kindergarten in Tokyo has a ring roof that children run round and round.' },
  { id: 'dome', colour: '#7b5ea7', x: 3.4, z: 0.2, demo: 'pulse' },
  { id: 'wedge', colour: '#ffc93c', x: 2.3, z: 1.6, demo: 'ball' },
];

export async function mount(host, ctx) {
  const world = getWorld();
  const root = h(`<div class="shapelab"><div class="vp" style="position:absolute;inset:0"></div>
    <div class="lab-card card"><span class="ic"></span><p></p><span class="sp"></span></div>
    <div class="lab-ui"></div></div>`);
  host.appendChild(root);
  world.attach(root.querySelector('.vp'));
  // Hide the site while we are in the lab.
  const hidden = [];
  for (const k of ['terrain', 'design', 'pupils', 'ghost', 'fx']) { if (world.groups[k].visible) { world.groups[k].visible = false; hidden.push(k); } }
  const saved = { pos: world.cam.position.clone(), target: world.controls.target.clone(), minD: world.controls.minDistance, maxD: world.controls.maxDistance, shadow: world.shadowFocus.clone() };
  world.scene.background = new THREE.Color('#e7eef2');
  world.sky.visible = false;
  world.focusShadows(0, 0, 8);

  const lab = new THREE.Group();
  world.scene.add(lab);
  const table = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.4, 0.3, 64), new THREE.MeshLambertMaterial({ color: '#efe6d4', map: grainTexture() }));
  table.position.y = -0.15; table.receiveShadow = true;
  lab.add(table);
  const mat = c => new THREE.MeshLambertMaterial({ color: c, map: grainTexture() });
  const items = {};
  for (const it of LAB) {
    const g = new THREE.Group();
    g.position.set(it.x, 0, it.z);
    if (it.id === 'ring') {
      for (let r = 0; r < 4; r++) {
        const m = new THREE.Mesh(formGeometry('curve', 'blocks'), mat(it.colour));
        m.castShadow = true;
        const off = [[1, 1], [-1, 1], [-1, -1], [1, -1]][r];
        m.position.set(off[0], 0, off[1]);
        m.rotation.y = -r * Math.PI / 2;
        g.add(m);
      }
      g.scale.setScalar(0.45);
    } else if (it.id === 'arch') {
      buildArch(g, it.colour);
    } else {
      const m = new THREE.Mesh(formGeometry(it.id, 'blocks'), mat(it.colour));
      m.castShadow = true;
      g.add(m);
      if (it.id === 'dome') g.scale.setScalar(0.62);
    }
    g.userData.id = it.id;
    g.traverse(o => { o.userData.labId = it.id; });
    lab.add(g);
    items[it.id] = { ...it, g };
  }

  world.controls.target.set(0, 0.4, 0);
  world.cam.position.set(0, 5.2, 8.4);
  world.controls.minDistance = 2; world.controls.maxDistance = 16;
  world.controls.update();

  const card = root.querySelector('.lab-card'), cardP = card.querySelector('p'), cardIc = card.querySelector('.ic');
  let cardText = '';
  const sp = h(`<button class="speak-btn" type="button" aria-label="Read aloud">${icon('speaker')}</button>`);
  sp.addEventListener('click', () => say(cardText, sp));
  card.querySelector('.sp').replaceWith(sp);
  const setCard = (form, text, extra = []) => {
    cardIc.innerHTML = formIcon(form === 'ring' ? 'curve' : form, 'form');
    cardIc.querySelector('svg').style.cssText = 'width:64px;height:64px';
    cardP.textContent = text;
    cardText = text;
    card.querySelectorAll('.extras').forEach(e => e.remove());
    if (extra.length) {
      const row = document.createElement('div');
      row.className = 'extras';
      for (const b of extra) { b.classList.add('extra'); row.append(b); }
      card.append(row);
    }
  };
  setCard('cube', 'These are the shapes architects build with. Tap a shape to see what it is good for.');
  sayAuto('These are the shapes architects build with. Tap a shape to see what it is good for.');

  const ui = root.querySelector('.lab-ui');
  const seen = new Set();
  let archDone = false, completed = false;
  const tiles = {};
  for (const it of LAB) {
    const name = it.label || FORMS[it.id].name;
    const b = h(`<button class="opt" type="button">${formIcon(it.id === 'ring' ? 'curve' : it.id)}<span>${esc(name)}</span></button>`);
    b.addEventListener('click', () => choose(it.id));
    ui.append(b);
    tiles[it.id] = b;
  }

  // Animations are small functions run each frame until they return true.
  const anims = new Set();
  const run = fn => anims.add(fn);
  const tick = dt => { for (const f of [...anims]) if (f(dt)) anims.delete(f); };
  world.updaters.add(tick);

  let focusAnim = null;
  function focus(it) {
    const target = new THREE.Vector3(it.x, 1.1, it.z);
    const pos = new THREE.Vector3(it.x * 0.55, 3.6, it.z + 5.4);
    const t0 = world.controls.target.clone(), p0 = world.cam.position.clone();
    let t = 0;
    if (focusAnim) anims.delete(focusAnim);
    focusAnim = dt => { t = Math.min(1, t + dt / 0.7); const e = t * t * (3 - 2 * t); world.controls.target.lerpVectors(t0, target, e); world.cam.position.lerpVectors(p0, pos, e); return t >= 1; };
    run(focusAnim);
  }

  function choose(id) {
    const it = items[id];
    seen.add(id);
    Object.entries(tiles).forEach(([k, b]) => b.classList.toggle('on', k === id));
    focus(it);
    sfx.tap();
    const text = it.good || FORMS[id].good;
    if (id === 'arch') {
      const w = h(`<button class="btn small" type="button">${icon('down')} Put a weight on</button>`);
      const k = h(`<button class="btn small warn" type="button">Pull the keystone</button>`);
      const r = h(`<button class="btn small ghost" type="button">${icon('refresh')} Build it again</button>`);
      w.addEventListener('click', () => weightTest(it));
      k.addEventListener('click', () => keystoneTest(it));
      r.addEventListener('click', () => rebuild(it));
      setCard(id, text + ' The gold stone at the top is the keystone.', [w, k, r]);
      say(text + ' The gold stone at the top is the keystone. Try putting a weight on it, then pull the keystone out!');
    } else {
      setCard(id, text);
      say(text);
      demo(it);
    }
    checkDone();
  }

  function demo(it) {
    const g = it.g;
    if (it.demo === 'stack') {
      const blocks = [0, 1].map(i => { const m = new THREE.Mesh(formGeometry('cube', 'blocks'), mat(['#ffb366', '#f6a04d'][i])); m.castShadow = true; m.position.set(0, 4 + i, 0); g.add(m); return m; });
      let t = 0;
      run(dt => {
        t += dt;
        blocks.forEach((m, i) => { const land = 0.8 * (i + 1); const start = 0.35 * i; if (t > start) { m.position.y = Math.max(land, m.position.y - dt * 9); } });
        if (t > 3.2) { blocks.forEach(m => g.remove(m)); return true; }
        return false;
      });
      sfx.pop();
    } else if (it.demo === 'grow') {
      let t = 0;
      run(dt => { t += dt; g.scale.y = 1 + Math.sin(Math.min(t / 2.4, 1) * Math.PI) * 0.8; return t > 2.4; });
    } else if (it.demo === 'roll') {
      let t = 0;
      run(dt => {
        t += dt;
        const p = Math.min(t / 2.6, 1);
        const tip = Math.min(1, p * 4) * (p < 0.8 ? 1 : (1 - p) * 5);
        g.rotation.z = tip * Math.PI / 2;
        g.position.y = tip * 0.47 * 0.98;
        g.position.x = it.x + Math.sin(p * Math.PI) * 0.9;
        g.children[0].rotation.y = p * 8;
        if (p >= 1) { g.rotation.z = 0; g.position.set(it.x, 0, it.z); g.children[0].rotation.y = 0; return true; }
        return false;
      });
    } else if (it.demo === 'run') {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshLambertMaterial({ color: '#2f6fe4' }));
      ball.castShadow = true;
      g.add(ball);
      let t = 0;
      run(dt => { t += dt; const a = t * 2.6; ball.position.set(Math.cos(a) * 1.5, 0.8 + 0.22 + Math.abs(Math.sin(t * 10)) * 0.12, Math.sin(a) * 1.5); if (t > 4.8) { g.remove(ball); return true; } return false; });
    } else if (it.demo === 'pulse') {
      let t = 0;
      run(dt => { t += dt; g.scale.setScalar(0.62 * (1 + Math.sin(t * 6) * 0.04 * Math.max(0, 1 - t / 2))); return t > 2; });
    } else if (it.demo === 'ball') {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshLambertMaterial({ color: '#e5483d' }));
      ball.castShadow = true;
      g.add(ball);
      let t = 0;
      sfx.whoosh();
      run(dt => { t += dt; const p = Math.min(1, t / 0.9); const x = 0.45 - p * 1.4; const y = p < 0.66 ? 0.8 * (1 - p / 0.66) * 0.98 + 0.12 : 0.12; ball.position.set(x, y + 0.02, 0); if (t > 1.8) { g.remove(ball); return true; } return false; });
    }
  }

  // ---------- The arch ----------
  function buildArch(g, colour) {
    const N = 9, ri = 0.62, ro = 1.0, depth = 0.5;
    g.userData.stones = [];
    for (let i = 0; i < N; i++) {
      const a0 = Math.PI - i * Math.PI / N, a1 = Math.PI - (i + 1) * Math.PI / N;
      const s = new THREE.Shape();
      const P = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];
      s.moveTo(...P(a0, ri)); s.lineTo(...P(a0, ro));
      for (let k = 1; k <= 6; k++) s.lineTo(...P(a0 + (a1 - a0) * k / 6, ro));
      s.lineTo(...P(a1, ri));
      for (let k = 5; k >= 0; k--) s.lineTo(...P(a0 + (a1 - a0) * k / 6, ri));
      const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1 });
      geo.translate(0, 0, -depth / 2);
      // Centre each stone on its own middle so it can tumble.
      geo.computeBoundingBox();
      const c = geo.boundingBox.getCenter(new THREE.Vector3());
      geo.translate(-c.x, -c.y, 0);
      const key = i === Math.floor(N / 2);
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: key ? '#f2b544' : colour, map: grainTexture() }));
      m.castShadow = true;
      m.position.copy(c);
      m.userData.home = c.clone();
      m.userData.key = key;
      g.add(m);
      g.userData.stones.push(m);
    }
  }
  let busy = false;
  function weightTest(it) {
    if (busy || it.g.userData.fallen) { if (it.g.userData.fallen) say('Build it again first!'); return; }
    busy = true;
    const g = it.g;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.5), new THREE.MeshLambertMaterial({ color: '#8a8f99' }));
    box.castShadow = true;
    box.position.set(0, 3, 0);
    g.add(box);
    const arrows = [];
    let t = 0;
    run(dt => {
      t += dt;
      box.position.y = Math.max(1.2, box.position.y - dt * 6);
      if (box.position.y === 1.2 && !arrows.length) {
        sfx.thud();
        // Show the push travelling down both sides of the arch.
        for (const side of [-1, 1]) for (let k = 0; k < 4; k++) {
          const a = Math.PI / 2 + side * (k + 0.5) * (Math.PI / 2) / 4;
          const p = new THREE.Vector3(Math.cos(a) * 0.82, Math.sin(a) * 0.82, 0.32);
          const dir = new THREE.Vector3(Math.sin(a) * side, -Math.cos(a) * side, 0).multiplyScalar(-1).normalize();
          const ar = new THREE.ArrowHelper(new THREE.Vector3(-Math.sin(a), Math.cos(a), 0).multiplyScalar(side).negate().normalize(), p, 0.3, 0xe5483d, 0.12, 0.08);
          void dir;
          g.add(ar); arrows.push(ar);
        }
        say('The arch holds! The weight pushes the stones together, and the push goes down each side into the ground.');
      }
      if (t > 4.5) { g.remove(box); arrows.forEach(a => g.remove(a)); busy = false; return true; }
      return false;
    });
  }
  function keystoneTest(it) {
    if (busy) return;
    const g = it.g;
    if (g.userData.fallen) { say('Build it again first!'); return; }
    busy = true;
    g.userData.fallen = true;
    const stones = g.userData.stones;
    const key = stones.find(s => s.userData.key);
    let t = 0;
    const state = stones.map(s => ({ s, vx: 0, vy: 0, vr: 0, rest: false }));
    sfx.whoosh();
    run(dt => {
      t += dt;
      if (t < 0.7) { key.position.y = key.userData.home.y + t * 1.2; key.position.z = t * 1.4; return false; }
      if (t < 0.75) {
        for (const st of state) if (!st.s.userData.key) { const side = Math.sign(st.s.position.x) || 1; st.vx = -side * (0.6 + Math.random() * 0.5); st.vr = side * (2 + Math.random() * 2); }
        sfx.thud();
      }
      let moving = false;
      for (const st of state) {
        if (st.rest) continue;
        if (st.s.userData.key) { st.s.position.z += dt * 0.5; st.s.position.y = Math.max(0.2, st.s.position.y - dt * 2.5); if (st.s.position.y > 0.2) moving = true; else st.rest = true; continue; }
        st.vy -= 9.8 * dt;
        st.s.position.x += st.vx * dt; st.s.position.y += st.vy * dt;
        st.s.rotation.z += st.vr * dt;
        if (st.s.position.y <= 0.13) { st.s.position.y = 0.13; st.vy *= -0.25; st.vx *= 0.5; st.vr *= 0.4; if (Math.abs(st.vy) < 0.4) { st.rest = true; st.s.rotation.z = Math.round(st.s.rotation.z / (Math.PI / 2)) * Math.PI / 2; } }
        moving = true;
      }
      if (!moving || t > 4) {
        busy = false;
        if (!archDone) { archDone = true; ctx.log && ctx.log('Pulled the keystone out of the arch. Crash!'); }
        say('Crash! Without the keystone the stones have nothing to push against, so the arch falls down. Every stone needs the others.');
        checkDone();
        return true;
      }
      return false;
    });
  }
  function rebuild(it) {
    if (busy) return;
    const g = it.g;
    if (!g.userData.fallen) { say('It is already standing.'); return; }
    busy = true;
    const stones = g.userData.stones;
    const from = stones.map(s => ({ p: s.position.clone(), r: s.rotation.z }));
    let t = 0;
    run(dt => {
      t = Math.min(1, t + dt / 1.2);
      const e = t * t * (3 - 2 * t);
      stones.forEach((s, i) => { s.position.lerpVectors(from[i].p, s.userData.home, e); s.rotation.z = from[i].r * (1 - e); });
      if (t >= 1) { g.userData.fallen = false; busy = false; sfx.pop(); return true; }
      return false;
    });
  }

  function checkDone() {
    if (!completed && archDone && seen.size >= 3) { completed = true; sfx.tada(); ctx.complete && ctx.complete(); }
  }

  // Tap a shape in the scene to choose it.
  let down = null;
  const canvas = world.canvas;
  const onDown = e => { down = { x: e.clientX, y: e.clientY }; };
  const onUp = e => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) { down = null; return; }
    down = null;
    const hit = world.rayFrom(e.clientX, e.clientY).intersectObjects(lab.children, true).find(x => x.object.userData.labId);
    if (hit) choose(hit.object.userData.labId);
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);

  return {
    destroy() {
      world.updaters.delete(tick);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      world.scene.remove(lab);
      for (const k of hidden) world.groups[k].visible = true;
      world.scene.background = null;
      world.sky.visible = true;
      world.controls.minDistance = saved.minD; world.controls.maxDistance = saved.maxD;
      world.cam.position.copy(saved.pos); world.controls.target.copy(saved.target);
      world.focusShadows(saved.shadow.x, saved.shadow.z, 24);
      world.detach();
      root.remove();
    },
  };
}
