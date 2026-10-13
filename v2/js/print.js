// Drawings to print: an axonometric of the whole site (white model, coloured buildings or full colour) and a floor plan for each floor,
// with room names, a north arrow and a scale bar (one square = one block, about 8 metres).
import * as THREE from 'three';
import { PROGRAMMES, LEVEL } from './catalogue.js';
import { GRID, square, site } from './site.js';
import { outline } from './inside.js';
import { wallRuns, openings, runAt, roundedRect, TALL, ringThickness } from './plan.js';
import { icon } from './icons.js';
import { h, esc, sfx, say } from './ui.js';
import { INK } from './shapes.js';

const FLOOR_NAMES = ['Ground floor', 'First floor', 'Second floor', 'Third floor'];

export async function openPrint(world, model, siteView, { design, crowd, handles }) {
  say('Making your drawings.');
  const axos = {};
  const axoFor = mode => (axos[mode] = axos[mode] || renderAxo(world, siteView, design, handles, mode));
  const axo = axoFor('white');
  const top = Math.min(3, Math.max(0, ...model.boxes.map(b => b.level + b.h - 1)));
  const plans = [];
  for (let l = 0; l <= top; l++) plans.push({ name: FLOOR_NAMES[l], url: drawPlan(model, siteView, l) });
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const sheet = h(`<div class="print-sheet">
    <div class="print-bar no-print">
      <b>Your drawings</b>
      <div class="pmodes" role="group" aria-label="Colours">
        <button class="pmode on" type="button" data-mode="white">White model</button>
        <button class="pmode" type="button" data-mode="colour">Colour buildings</button>
        <button class="pmode" type="button" data-mode="full">Full colour</button>
      </div>
      <button class="pbtn go" type="button">${icon('print')} Print</button>
      <button class="pbtn close" type="button">${icon('close')} Close</button>
    </div>
    <section class="page"><header><h1>Finn's Dream School</h1><span>Axonometric drawing · ${esc(date)}</span></header><img class="axo" src="${axo}" alt="Axonometric drawing of the school"></section>
    ${plans.map(p => `<section class="page"><header><h1>Finn's Dream School</h1><span>${esc(p.name)} plan · ${esc(date)}</span></header><img src="${p.url}" alt="${esc(p.name)} plan"></section>`).join('')}
  </div>`);
  document.body.appendChild(sheet);
  sheet.querySelector('.go').addEventListener('click', () => { sfx.tap(); window.print(); });
  const SAY = { white: 'A white model, like an architect\'s card model.', colour: 'Coloured buildings on a white site.', full: 'Everything in colour.' };
  for (const b of sheet.querySelectorAll('.pmode')) b.addEventListener('click', () => {
    sfx.tap(); say(SAY[b.dataset.mode]);
    for (const x of sheet.querySelectorAll('.pmode')) x.classList.toggle('on', x === b);
    sheet.querySelector('.axo').src = axoFor(b.dataset.mode);
  });
  sheet.querySelector('.close').addEventListener('click', () => { sfx.tap(); sheet.remove(); });
}

// ---------- the axonometric ----------
// mode: 'white' (a white card model), 'colour' (coloured buildings and children on a white site), 'full' (as on screen).
function renderAxo(world, siteView, design, handles, mode = 'white') {
  const r = world.renderer, scene = world.scene, cam = world.camera, ctl = world.controls;
  const saved = { bg: scene.background, size: r.getSize(new THREE.Vector2()), pr: r.getPixelRatio(), zoom: cam.zoom, pos: cam.position.clone(), target: ctl.target.clone(), hv: handles.visible,
    l: cam.left, rt: cam.right, t: cam.top, b: cam.bottom };
  const white = new THREE.MeshLambertMaterial({ color: '#ffffff' }), pale = new THREE.MeshLambertMaterial({ color: '#eef1f2' });
  const glass = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }), sea = new THREE.MeshBasicMaterial({ color: '#dbe8ee' });       // unlit, so the sun cannot bleach it white
  const swapped = [], edges = [], hidden = [];
  const inDesign = new Set(); design.traverse(o => { if (!o.userData.landscape) inDesign.add(o); });
  scene.traverse(o => {
    if (!o.isMesh || o === world.__skip || mode === 'full') return;
    if (o.material && o.material.isSpriteMaterial) return;
    const isPeople = !!o.userData.people || !!o.parent?.userData.people;
    if (mode === 'colour' && (isPeople || inDesign.has(o))) return;
    const see = !o.userData.noInk && (Array.isArray(o.material) ? o.material : [o.material]).some(m => m && m.transparent);
    if (see && !inDesign.has(o)) { if (o.visible) { o.visible = false; hidden.push(o); } return; }
    swapped.push([o, o.material, o.instanceColor || null]);
    if (o.isInstancedMesh) o.instanceColor = null;
    o.material = see && inDesign.has(o) ? glass : o === siteView.water ? sea : isPeople ? pale : white;
  });
  const inkWas = INK.opacity; INK.opacity = 1;
  // Glass gets a fine outline here (the pieces already carry outlines for everything solid).
  design.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.people || o.userData.noInk) return;
    if (!(Array.isArray(o.material) ? o.material : [o.material]).some(m => m === glass || (m && m.transparent && mode !== 'white'))) return;
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 28), new THREE.LineBasicMaterial({ color: '#1d1f24' }));
    o.add(e); edges.push(e);
  });
  // The site's outline too.
  const ge = new THREE.LineSegments(new THREE.EdgesGeometry(siteView.ground.geometry, 50), new THREE.LineBasicMaterial({ color: '#9aa0a6' }));
  siteView.ground.add(ge); edges.push(ge);
  handles.visible = false;
  scene.background = new THREE.Color('#ffffff');
  const W = 2400, H = 1600;
  r.setPixelRatio(1); r.setSize(W, H, false);
  const half = 7.6 * Math.max(GRID.w / 20, GRID.d / 14), a = W / H;
  cam.left = -half * a; cam.right = half * a; cam.top = half; cam.bottom = -half; cam.zoom = 1;
  const off = saved.pos.clone().sub(saved.target);
  const tgt = new THREE.Vector3(GRID.w / 2 - 0.6, 0, GRID.d / 2 + 0.6);
  cam.position.copy(tgt).add(off); cam.lookAt(tgt); cam.updateProjectionMatrix();
  r.render(scene, cam);
  const url = r.domElement.toDataURL('image/png');
  // Put everything back.
  for (const [o, m, ic] of swapped) { o.material = m; if (ic) o.instanceColor = ic; }
  for (const o of hidden) o.visible = true;
  for (const e of edges) { e.parent.remove(e); e.geometry.dispose(); e.material.dispose(); }
  white.dispose(); pale.dispose(); glass.dispose(); sea.dispose(); INK.opacity = inkWas;
  scene.background = saved.bg;
  r.setPixelRatio(saved.pr); r.setSize(saved.size.x, saved.size.y, false);
  cam.left = saved.l; cam.right = saved.rt; cam.top = saved.t; cam.bottom = saved.b; cam.zoom = saved.zoom;
  cam.position.copy(saved.pos); ctl.target.copy(saved.target); cam.updateProjectionMatrix(); ctl.update();
  handles.visible = saved.hv;
  world.resize();
  return url;
}

// ---------- a floor plan ----------
function drawPlan(model, siteView, L) {
  const W = 2400, H = 1600, m = 90, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const s = Math.min((W - 2 * m) / GRID.w, (H - 2 * m - 120) / GRID.d);
  const ox = (W - s * GRID.w) / 2, oz = m;
  const X = x => ox + x * s, Z = z => oz + z * s;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
  // The site: sea hatched, beach dotted, forest as little tree circles.
  const raw = site().raw, k = GRID.k, cs = s / k;
  g.save();
  for (let z = 0; z < raw.d; z++) for (let x = 0; x < raw.w; x++) {
    const zn = raw.zones[z][x], px = ox + x * cs, pz = oz + z * cs;
    if ('wpr'.includes(zn)) { g.fillStyle = '#eef2f4'; g.fillRect(px, pz, cs + 0.5, cs + 0.5); }
    if (zn === 'b') { g.fillStyle = '#c9c9c9'; for (let i = 0; i < 4; i++) g.fillRect(px + ((i * 7 + x * 3) % cs), pz + ((i * 11 + z * 5) % cs), 2, 2); }
    if (zn === 'c') { g.fillStyle = '#dadada'; g.fillRect(px, pz, cs + 0.5, cs + 0.5); }
  }
  g.beginPath(); g.rect(ox, oz, s * GRID.w, s * GRID.d); g.clip();
  g.strokeStyle = '#c3cbd0'; g.lineWidth = 1.2;
  for (let i = -H; i < W; i += 18) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + H, H); g.stroke(); }
  g.restore();
  g.strokeStyle = '#1d1f24'; g.lineWidth = 2; g.strokeRect(ox, oz, s * GRID.w, s * GRID.d);
  // Re-draw land on top of the hatch so only the water keeps it.
  for (let z = 0; z < raw.d; z++) for (let x = 0; x < raw.w; x++) {
    const zn = raw.zones[z][x]; if ('wpr'.includes(zn)) continue;
    g.fillStyle = zn === 'c' ? '#efefef' : '#ffffff'; g.fillRect(ox + x * cs - 0.5, oz + z * cs - 0.5, cs + 1, cs + 1);
    if (zn === 'b') { g.fillStyle = '#bdbdbd'; for (let i = 0; i < 3; i++) g.fillRect(ox + x * cs + ((i * 9 + x * 5) % cs), oz + z * cs + ((i * 13 + z * 7) % cs), 2.2, 2.2); }
  }
  // Trees.
  g.strokeStyle = '#9ea4a8'; g.lineWidth = 1.4;
  for (const t of siteView.trees.list) { if (model.at(t.sx, t.sz, 0)) continue; g.beginPath(); g.arc(X(t.p.x), Z(t.p.z), t.s.x * s * 0.9, 0, Math.PI * 2); g.stroke(); }
  // The grid, faintly.
  g.strokeStyle = '#e3e6e8'; g.lineWidth = 1;
  for (let z = 0; z < GRID.d; z++) for (let x = 0; x < GRID.w; x++) if (square(x, z)?.build) g.strokeRect(X(x), Z(z), s, s);
  // Rooms above this floor: dashed (an overhang or upper floor seen from below).
  g.setLineDash([10, 8]); g.strokeStyle = '#8a8f96'; g.lineWidth = 2;
  for (const b of model.boxes) if (b.level > L) { path(g, b, X, Z, s); g.stroke(); }
  g.setLineDash([]);
  // Rooms on this floor, cut through: white inside, thick black walls, the name in the middle.
  for (const b of model.boxes) {
    if (!(b.level <= L && L < b.level + b.h)) continue;
    const P = PROGRAMMES[b.type], cx = X(b.x + b.w / 2), cz = Z(b.z + b.d / 2);
    if (['tree'].includes(b.shape)) { g.strokeStyle = '#1d1f24'; g.lineWidth = 2.5; for (let i = 0; i < b.w; i++) for (let j = 0; j < b.d; j++) { g.beginPath(); g.arc(X(b.x + i + 0.5), Z(b.z + j + 0.5), s * 0.3, 0, Math.PI * 2); g.stroke(); } continue; }
    if (b.shape === 'turbine') { g.strokeStyle = '#1d1f24'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cz, s * 0.18, 0, Math.PI * 2); g.moveTo(cx - s * 0.4, cz); g.lineTo(cx + s * 0.4, cz); g.stroke(); continue; }
    const k = TALL.has(b.type) ? 0 : L - b.level;
    path(g, b, X, Z, s, k);
    g.fillStyle = b.shape === 'pool' ? '#e9f3f7' : '#ffffff'; g.fill('evenodd');
    g.strokeStyle = '#1d1f24'; g.lineWidth = b.shape === 'track' || b.shape === 'pool' || b.shape === 'garden' ? 3 : 7; g.stroke();
    planOpenings(g, b, X, Z, s, k);
    // Little symbols.
    g.lineWidth = 2;
    if (b.shape === 'stairs' || b.shape === 'steps') { const n = b.shape === 'stairs' ? 6 : Math.round(Math.max(b.w, b.d) * 3); for (let i = 1; i < n; i++) { g.beginPath(); if (b.w >= b.d) { const x = X(b.x) + (s * b.w * i) / n; g.moveTo(x, Z(b.z) + 6); g.lineTo(x, Z(b.z + b.d) - 6); } else { const z = Z(b.z) + (s * b.d * i) / n; g.moveTo(X(b.x) + 6, z); g.lineTo(X(b.x + b.w) - 6, z); } g.stroke(); } }
    if (b.shape === 'spiral') { for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.beginPath(); g.moveTo(cx, cz); g.lineTo(cx + Math.cos(a) * s * 0.42, cz + Math.sin(a) * s * 0.42); g.stroke(); } }
    if (b.shape === 'pool') { g.strokeStyle = '#7fb7cc'; for (let i = 1; i < 3; i++) { g.beginPath(); const z = Z(b.z) + (s * b.d * i) / 3; for (let x = X(b.x) + 10; x < X(b.x + b.w) - 10; x += 8) g.lineTo(x, z + Math.sin(x / 9) * 3); g.stroke(); } }
    if (b.shape === 'track') { g.beginPath(); g.ellipse(cx, cz, s * b.w * 0.36, s * b.d * 0.3, 0, 0, Math.PI * 2); g.stroke(); }
    // The name (on a ring, written on the front of the band, not over the courtyard garden).
    const ringy = (b.shape === 'ring' || b.shape === 'ringhouse') && b.w >= 3 && b.d >= 3;
    const tz = ringy ? cz + (b.d / 2 - 0.035 - ringThickness(b) / 2) * s : cz;
    let fs = Math.max(12, Math.min(ringy ? 22 : 30, s * Math.min(b.w, b.d) * 0.24));
    g.fillStyle = '#1d1f24'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const words = P.name.split(' '), room = b.w * s * 0.86;
    g.font = `600 ${fs}px Lexend, sans-serif`;
    const lines = words.length > 1 && g.measureText(P.name).width > room ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [P.name];
    const widest = Math.max(...lines.map(l => g.measureText(l).width));
    if (widest > room) { fs = Math.max(10, fs * room / widest); g.font = `600 ${fs}px Lexend, sans-serif`; }
    lines.forEach((ln, i) => g.fillText(ln, cx, tz + (i - (lines.length - 1) / 2) * fs * 1.1));
  }
  // North arrow and scale bar.
  const nx = W - m - 40, ny = H - 110;
  g.fillStyle = '#1d1f24'; g.beginPath(); g.moveTo(nx, ny - 50); g.lineTo(nx + 18, ny + 10); g.lineTo(nx, ny); g.lineTo(nx - 18, ny + 10); g.closePath(); g.fill();
  g.font = '700 28px Lexend, sans-serif'; g.textAlign = 'center'; g.fillText('N', nx, ny - 68);
  const sx = m, sy = H - 80;
  for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#1d1f24'; g.fillRect(sx + i * s, sy, s, 14); }
  g.strokeStyle = '#1d1f24'; g.lineWidth = 2; g.strokeRect(sx, sy, 4 * s, 14);
  g.font = '500 20px Lexend, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#1d1f24';
  for (let i = 0; i <= 4; i++) g.fillText(`${i * 8} m`, sx + i * s, sy + 40);
  g.textAlign = 'left'; g.fillText('One square = one block = a classroom for 30 children', sx + 4 * s + 30, sy + 10);
  return c.toDataURL('image/png');
}

// The outline of a room, as a canvas path.
// Windows and doors in a plan, the way architects draw them: a window is a gap in the wall with thin lines
// for the glass; a door is a gap with the door drawn swinging open. A colonnade's columns are dots.
function planOpenings(g, b, X, Z, s, k) {
  const runs = wallRuns(b, k), ops = openings(b, k, runs), ox = b.x + b.w / 2, oz = b.z + b.d / 2;
  const trace = (run, s0, s1, off) => {
    const pts = [s0];
    for (let i = 1; i < run.pts.length - 1; i++) if (run.s[i] > s0 && run.s[i] < s1) pts.push(run.s[i]);
    pts.push(s1);
    g.beginPath();
    pts.forEach((u, i) => { const p = runAt(run, u), x = X(ox + p.x) + p.nx * off, z = Z(oz + p.z) + p.nz * off; i ? g.lineTo(x, z) : g.moveTo(x, z); });
  };
  g.lineCap = 'butt';
  for (const o of ops) {
    const cutHere = o.door || (o.y0 < 0.27 && o.y1 > 0.2); if (!cutHere) continue;
    const run = runs[o.run];
    g.strokeStyle = '#ffffff'; g.lineWidth = 9; trace(run, o.s0, o.s1, 0); g.stroke();
    g.strokeStyle = '#1d1f24';
    if (o.door && !o.glassDoor) {
      const a = runAt(run, o.s0), e = runAt(run, o.s1), w = (o.s1 - o.s0) * s, hx = X(ox + a.x), hz = Z(oz + a.z);
      const lx = hx - a.nx * w, lz = hz - a.nz * w;
      g.lineWidth = 2.4; g.beginPath(); g.moveTo(hx, hz); g.lineTo(lx, lz); g.stroke();
      g.lineWidth = 1.2; g.beginPath(); const a0 = Math.atan2(lz - hz, lx - hx), a1 = Math.atan2(Z(oz + e.z) - hz, X(ox + e.x) - hx);
      let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      g.arc(hx, hz, w, a0, a1, d < 0); g.stroke();
    } else {
      g.lineWidth = 1.5; trace(run, o.s0, o.s1, 2.6); g.stroke(); trace(run, o.s0, o.s1, -2.6); g.stroke();
      for (const u of [o.s0, o.s1]) { const p = runAt(run, u), x = X(ox + p.x), z = Z(oz + p.z); g.beginPath(); g.moveTo(x + p.nx * 4.5, z + p.nz * 4.5); g.lineTo(x - p.nx * 4.5, z - p.nz * 4.5); g.stroke(); }
    }
  }
  const o = outline(b, k);
  if (o.kind === 'ring' && o.col) {
    const sh = roundedRect(o.fWi + 0.08, o.fDi + 0.08, Math.min(o.fWi, o.fDi) / 2 + 0.04), n = Math.max(8, Math.round(sh.getLength() / 0.3));
    g.fillStyle = '#1d1f24';
    for (const p of sh.getSpacedPoints(n).slice(0, -1)) { g.beginPath(); g.arc(X(ox + p.x), Z(oz - p.y), Math.max(2.5, 0.026 * s), 0, Math.PI * 2); g.fill(); }
  }
  if (o.kind === 'ring' && b.w >= 3 && b.d >= 3 && !(b.level > 0)) {
    const r = Math.min(o.fWi, o.fDi) / 2;
    g.strokeStyle = '#1d1f24'; g.lineWidth = 1.6; g.beginPath(); g.arc(X(ox), Z(oz), Math.min(0.42, r * 0.5) * s, 0, Math.PI * 2); g.stroke();
    g.setLineDash([4, 4]); g.beginPath(); g.arc(X(ox), Z(oz), Math.min(0.3, r * 0.42) * s, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  }
}
function path(g, b, X, Z, s, k = 0) {
  const o = outline(b, k), cx = X(b.x + b.w / 2), cz = Z(b.z + b.d / 2);
  g.beginPath();
  const rr = (W, D, r) => { const x = cx - W * s / 2, y = cz - D * s / 2; g.roundRect(x, y, W * s, D * s, Math.max(0, r * s)); };
  if (o.kind === 'rr') rr(o.W, o.D, o.r);
  else if (o.kind === 'ring') { rr(o.W, o.D, o.r); rr(o.Wi, o.Di, o.ri); }
  else {
    const ph = (o.rot || 0) * Math.PI / 2, co = Math.cos(ph), si = Math.sin(ph);
    const ax = X(b.x + b.w / 2 + o.cx * co - o.cz * si), az = Z(b.z + b.d / 2 + o.cx * si + o.cz * co);
    g.arc(ax, az, o.R1 * s, ph, ph + Math.PI / 2); g.arc(ax, az, Math.max(0.01, o.R0) * s, ph + Math.PI / 2, ph, true); g.closePath();
  }
}
