// Drawings to print: an axonometric of the whole site, a floor plan for each floor (with a key to its numbered
// rooms), and two elevations. Two colour schemes: coloured buildings on a white site, or full colour.
import * as THREE from 'three';
import { PROGRAMMES, LEVEL, colourHex } from './catalogue.js';
import { GRID, square, site, groundAt, ZONE_COL } from './site.js';
import { outline } from './inside.js';
import { wallRuns, openings, runAt, roundedRect, TALL, ringThickness } from './plan.js';
import { icon } from './icons.js';
import { h, esc, sfx, say } from './ui.js';
import { INK } from './shapes.js';

const FLOOR_NAMES = ['Ground floor', 'First floor', 'Second floor', 'Third floor'];
const INKC = '#1d1f24';

export async function openPrint(world, model, siteView, { design, handles }) {
  say('Making your drawings.');
  const top = Math.min(3, Math.max(0, ...model.boxes.map(b => b.level + b.h - 1)));
  const floors = Array.from({ length: top + 1 }, (_, l) => l);
  const cut = cuts(model);
  // Every drawing in one colour scheme, made the first time that scheme is chosen.
  const sets = {};
  const drawings = mode => (sets[mode] = sets[mode] || {
    axo: renderAxo(world, siteView, design, handles, mode),
    plans: floors.map(l => drawPlan(model, siteView, l, mode, cut)),
    elev: renderElevations(world, model, siteView, design, handles, mode, cut),
  });
  const d = drawings('colour');
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  // A sheet: the school's name and the drawing's name along the top; on a plan, the key to its numbered rooms beside it.
  const page = ({ title, key, img }) => `<section class="page"><header><h1>Finn's Dream School</h1><span>${esc(title)} · ${esc(date)}</span></header>${key
    ? `<div class="sheet-body${key.length > 22 ? ' wide' : ''}"><div class="plan-key"><small>Key</small>${key.length ? `<ol>${key.map(k => `<li><i>${k.n}</i><span>${esc(k.name)}</span><em>${esc(k.size)}</em></li>`).join('')}</ol>` : '<span>No rooms on this floor yet.</span>'}</div>${img}</div>`
    : img}</section>`;
  const sheet = h(`<div class="print-sheet">
    <div class="print-bar no-print">
      <b>Your drawings</b>
      <div class="pmodes" role="group" aria-label="Colours">
        <button class="pmode on" type="button" data-mode="colour">Colour buildings</button>
        <button class="pmode" type="button" data-mode="full">Full colour</button>
      </div>
      <button class="pbtn go" type="button">${icon('print')} Print</button>
      <button class="pbtn close" type="button">${icon('close')} Close</button>
    </div>
    ${page({ title: 'Axonometric drawing', img: `<img class="axo" src="${d.axo}" alt="Axonometric drawing of the school">` })}
    ${floors.map((l, i) => page({ title: `${FLOOR_NAMES[l]} plan`, key: d.plans[i].key, img: `<img class="plan" data-i="${i}" src="${d.plans[i].url}" alt="${esc(FLOOR_NAMES[l])} plan">` })).join('')}
    ${page({ title: 'Elevations', img: `<img class="elev" src="${d.elev}" alt="Elevations of the school from the south and the east">` })}
  </div>`);
  document.body.appendChild(sheet);
  sheet.querySelector('.go').addEventListener('click', () => { sfx.tap(); window.print(); });
  const SAY = { colour: 'Coloured buildings on a white site.', full: 'Everything in colour.' };
  for (const b of sheet.querySelectorAll('.pmode')) b.addEventListener('click', () => {
    sfx.tap(); say(SAY[b.dataset.mode]);
    for (const x of sheet.querySelectorAll('.pmode')) x.classList.toggle('on', x === b);
    const set = drawings(b.dataset.mode);
    sheet.querySelector('.axo').src = set.axo;
    for (const img of sheet.querySelectorAll('img.plan')) img.src = set.plans[+img.dataset.i].url;
    sheet.querySelector('.elev').src = set.elev;
  });
  sheet.querySelector('.close').addEventListener('click', () => { sfx.tap(); sheet.remove(); });
}

// ---------- the scene, dressed for a drawing ----------
// A white background, no handles, outlines at full strength; in 'colour' mode the site turns white and only the
// buildings and children keep their colours ('full' is as on screen). shoot(cam, renderer, scene, saved) renders,
// then everything is put back. soft: the white site is barely shaded, so it sits quietly behind the buildings.
function printLook(world, siteView, design, handles, mode, shoot, soft = false) {
  const r = world.renderer, scene = world.scene, cam = world.camera, ctl = world.controls;
  const saved = { bg: scene.background, size: r.getSize(new THREE.Vector2()), pr: r.getPixelRatio(), zoom: cam.zoom, pos: cam.position.clone(), target: ctl.target.clone(), hv: handles.visible,
    l: cam.left, rt: cam.right, t: cam.top, b: cam.bottom };
  const white = new THREE.MeshLambertMaterial({ color: '#ffffff', ...(soft ? { emissive: '#a4a4a4' } : {}) });
  const glass = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }), sea = new THREE.MeshBasicMaterial({ color: '#dbe8ee' });       // unlit, so the sun cannot bleach it white
  const swapped = [], edges = [], hidden = [];
  const inDesign = new Set(); design.traverse(o => { if (!o.userData.landscape) inDesign.add(o); });
  if (mode !== 'full') scene.traverse(o => {
    if (!o.isMesh || o === world.__skip) return;
    if (o.material && o.material.isSpriteMaterial) return;
    const isPeople = !!o.userData.people || !!o.parent?.userData.people;
    if (isPeople || inDesign.has(o)) return;
    const see = !o.userData.noInk && (Array.isArray(o.material) ? o.material : [o.material]).some(m => m && m.transparent);
    if (see) { if (o.visible) { o.visible = false; hidden.push(o); } return; }
    swapped.push([o, o.material, o.instanceColor || null]);
    if (o.isInstancedMesh) o.instanceColor = null;
    o.material = o === siteView.water ? sea : white;
  });
  const inkWas = INK.opacity; INK.opacity = 1;
  // Glass gets a fine outline here (the pieces already carry outlines for everything solid).
  design.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.people || o.userData.noInk) return;
    if (!(Array.isArray(o.material) ? o.material : [o.material]).some(m => m && m.transparent)) return;
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 28), new THREE.LineBasicMaterial({ color: INKC }));
    o.add(e); edges.push(e);
  });
  // The site's outline too.
  const ge = new THREE.LineSegments(new THREE.EdgesGeometry(siteView.ground.geometry, 50), new THREE.LineBasicMaterial({ color: '#9aa0a6' }));
  siteView.ground.add(ge); edges.push(ge);
  handles.visible = false;
  scene.background = new THREE.Color('#ffffff');
  r.setPixelRatio(1);
  try { return shoot(cam, r, scene, saved); } finally {
    // Put everything back.
    r.clippingPlanes = [];
    for (const [o, m, ic] of swapped) { o.material = m; if (ic) o.instanceColor = ic; }
    for (const o of hidden) o.visible = true;
    for (const e of edges) { e.parent.remove(e); e.geometry.dispose(); e.material.dispose(); }
    white.dispose(); glass.dispose(); sea.dispose(); INK.opacity = inkWas;
    scene.background = saved.bg;
    r.setPixelRatio(saved.pr); r.setSize(saved.size.x, saved.size.y, false);
    cam.left = saved.l; cam.right = saved.rt; cam.top = saved.t; cam.bottom = saved.b; cam.zoom = saved.zoom;
    cam.position.copy(saved.pos); ctl.target.copy(saved.target); cam.updateProjectionMatrix(); ctl.update();
    handles.visible = saved.hv;
    world.resize();
  }
}

// ---------- the axonometric ----------
function renderAxo(world, siteView, design, handles, mode) {
  return printLook(world, siteView, design, handles, mode, (cam, r, scene, saved) => {
    const W = 2400, H = 1600;
    r.setSize(W, H, false);
    const half = 7.6 * Math.max(GRID.w / 20, GRID.d / 14), a = W / H;
    cam.left = -half * a; cam.right = half * a; cam.top = half; cam.bottom = -half; cam.zoom = 1;
    const off = saved.pos.clone().sub(saved.target);
    const tgt = new THREE.Vector3(GRID.w / 2 - 0.6, 0, GRID.d / 2 + 0.6);
    cam.position.copy(tgt).add(off); cam.lookAt(tgt); cam.updateProjectionMatrix();
    r.render(scene, cam);
    return r.domElement.toDataURL('image/png');
  });
}

// ---------- two elevations ----------
// Where they are cut: A looks north from just south of the school, B looks west from just east of it. Anything
// in front of the cut (trees, hills) is sliced away so the buildings can be seen.
function cuts(model) {
  const bs = model.boxes;
  if (!bs.length) return { a: GRID.d / 2, b: GRID.w / 2 };
  return { a: Math.min(GRID.d, Math.max(...bs.map(b => b.z + b.d)) + 0.35), b: Math.min(GRID.w, Math.max(...bs.map(b => b.x + b.w)) + 0.35) };
}
const ELEVATIONS = [
  { id: 'A', name: 'South elevation', sub: 'Looking north', along: 'x' },
  { id: 'B', name: 'East elevation', sub: 'Looking west', along: 'z' },
];
function renderElevations(world, model, siteView, design, handles, mode, cut) {
  const W = 2400, H = 1600, m = 90, BASE = -0.75, sea = site().sea;
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const g = out.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
  // How high the drawings go: the tallest room, or the hills behind the cut.
  let hill = 0;
  for (let z = 0; z <= GRID.d; z += 0.1) for (let x = 0; x <= GRID.w; x += 0.1) if (z < cut.a || x < cut.b) hill = Math.max(hill, groundAt(x, z));
  const tops = model.boxes.map(b => groundAt(b.x + b.w / 2, b.z + b.d / 2) + (b.level + b.h) * LEVEL + 0.5);
  const yLo = BASE - 0.1, yHi = Math.max(1.5, hill, ...tops) + 0.25;
  const band = (H - 60 - 2 * 100 - 130) / 2;          // two drawings, each with its name under it, then the scale bar
  const s = Math.min((W - 2 * m) / Math.max(GRID.w, GRID.d), band / (yHi - yLo));
  const Hr = Math.round((yHi - yLo) * s), cy = (yHi + yLo) / 2;
  const views = ELEVATIONS.map(v => ({ ...v, at: v.along === 'x' ? cut.a : cut.b, len: v.along === 'x' ? GRID.w : GRID.d }));
  const shots = printLook(world, siteView, design, handles, mode, (cam, r, scene) => views.map(v => {
    r.setSize(W, Hr, false);
    const hw = W / 2 / s, hh = Hr / 2 / s, c = v.len / 2;
    cam.left = -hw; cam.right = hw; cam.top = hh; cam.bottom = -hh; cam.zoom = 1;
    if (v.along === 'x') { cam.position.set(c, cy, v.at + 40); cam.lookAt(c, cy, v.at); }
    else { cam.position.set(v.at + 40, cy, c); cam.lookAt(v.at, cy, c); }
    cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    r.clippingPlanes = [v.along === 'x' ? new THREE.Plane(new THREE.Vector3(0, 0, -1), v.at) : new THREE.Plane(new THREE.Vector3(-1, 0, 0), v.at)];
    r.render(scene, cam);
    const img = document.createElement('canvas'); img.width = W; img.height = Hr;
    img.getContext('2d').drawImage(r.domElement, 0, 0);
    const pc = cam.clone(); pc.updateMatrixWorld();
    return { img, cam: pc };
  }), true);
  const full = mode === 'full';
  let y0 = Math.max(50, (H - 120 - 2 * (Hr + 100)) / 2 + 20);           // the pair, centred above the scale bar
  views.forEach((v, n) => {
    const { img, cam } = shots[n];
    g.drawImage(img, 0, y0);
    // The ground where it is cut, drawn like a slice: earth below, and water where the cut crosses the sea.
    const P = (t, y) => { const p = (v.along === 'x' ? new THREE.Vector3(t, y, v.at) : new THREE.Vector3(v.at, y, t)).project(cam); return [(p.x + 1) / 2 * W, y0 + (1 - p.y) / 2 * Hr]; };
    const prof = [];
    for (let t = 0; t <= v.len + 1e-6; t += 0.04) prof.push([t, v.along === 'x' ? groundAt(t, v.at) : groundAt(v.at, t)]);
    const poly = pts => { g.beginPath(); pts.forEach(([t, y], i) => { const [x, z] = P(t, y); i ? g.lineTo(x, z) : g.moveTo(x, z); }); g.closePath(); };
    poly([...prof.map(([t]) => [t, sea + 0.02]), ...prof.slice().reverse().map(([t, y]) => [t, Math.min(y, sea + 0.02)])]);
    g.fillStyle = full ? '#9fd4e4' : '#dbe8ee'; g.fill();
    poly([...prof, [v.len, BASE], [0, BASE]]);
    g.fillStyle = full ? '#d9bf96' : '#f1efea'; g.fill();
    g.save(); g.clip();
    g.strokeStyle = full ? '#b8986c' : '#b9b4aa'; g.lineWidth = 1.5;
    for (let i = -Hr; i < W + Hr; i += 16) { g.beginPath(); g.moveTo(i, y0 + Hr); g.lineTo(i + Hr, y0); g.stroke(); }
    g.restore();
    poly([...prof, [v.len, BASE], [0, BASE]]);
    g.strokeStyle = INKC; g.lineWidth = 2; g.stroke();
    g.beginPath(); prof.forEach(([t, y], i) => { const [x, z] = P(t, y); i ? g.lineTo(x, z) : g.moveTo(x, z); });
    if (full) { g.strokeStyle = '#7db45a'; g.lineWidth = 9; g.stroke(); }
    g.strokeStyle = INKC; g.lineWidth = 4.5; g.stroke();
    // The drawing's name underneath, with its letter in a circle.
    const ny = y0 + Hr + 52, lx = Math.min(...[0, v.len].map(t => P(t, 0)[0]));
    marker(g, lx + 22, ny - 8, v.id, 0, 0);
    g.fillStyle = INKC; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.font = '700 34px Lexend, sans-serif'; g.fillText(v.name, lx + 60, ny + 4);
    const nw = g.measureText(v.name).width;
    g.font = '500 24px Lexend, sans-serif'; g.fillStyle = '#6b707c'; g.fillText(v.sub, lx + 60 + nw + 18, ny + 4);
    g.strokeStyle = INKC; g.lineWidth = 2; g.beginPath(); g.moveTo(lx + 60, ny + 16); g.lineTo(lx + 60 + nw, ny + 16); g.stroke();
    y0 += Hr + 100;
  });
  scaleBar(g, m, H - 80, s);
  return out.toDataURL('image/png');
}
// A drawing's letter in a circle; with a direction (dx, dy), a solid arrow showing which way it looks.
function marker(g, x, y, letter, dx, dy) {
  const r = 22;
  if (dx || dy) { g.fillStyle = INKC; g.beginPath(); g.moveTo(x + dx * (r + 20), y + dy * (r + 20)); g.lineTo(x - dy * r, y + dx * r); g.lineTo(x + dy * r, y - dx * r); g.closePath(); g.fill(); }
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 3; g.strokeStyle = INKC; g.stroke();
  g.fillStyle = INKC; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 24px Lexend, sans-serif'; g.fillText(letter, x, y + 1);
}
// Four squares, black and white, marked in metres (one square = one block = about 8 m).
function scaleBar(g, sx, sy, s) {
  for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#ffffff' : INKC; g.fillRect(sx + i * s, sy, s, 14); }
  g.strokeStyle = INKC; g.lineWidth = 2; g.strokeRect(sx, sy, 4 * s, 14);
  g.font = '500 20px Lexend, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = INKC;
  for (let i = 0; i <= 4; i++) g.fillText(`${i * 8} m`, sx + i * s, sy + 40);
  g.textAlign = 'left'; g.fillText('One square = one block = a classroom for 30 children', sx + 4 * s + 30, sy + 10);
}

// ---------- a floor plan ----------
// A colour mixed towards white (t = 0 keeps it, 1 is white).
const tint = (hex, t) => { const n = parseInt(hex.slice(1), 16), f = c => Math.round(c + (255 - c) * t); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
// mode: 'colour' (white site, rooms in their colours) or 'full' (the site painted too). cut: where the elevations are cut.
function drawPlan(model, siteView, L, mode = 'colour', cut = null) {
  const key = [];         // the numbered rooms on this floor, for the title block
  const W = 2400, H = 1600, m = 90, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const s = Math.min((W - 2 * m) / GRID.w, (H - 2 * m - 120) / GRID.d);
  const ox = (W - s * GRID.w) / 2, oz = m;
  const X = x => ox + x * s, Z = z => oz + z * s;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
  // The site. Colour buildings: white land, the sea hatched, the beach dotted. Full colour: painted as on the model.
  const raw = site().raw, k = GRID.k, cs = s / k, full = mode === 'full', grown = site().grown;
  const zone = (x, z) => (grown.has(`${Math.floor(x / k)},${Math.floor(z / k)}`) ? 'm' : raw.zones[z][x]);
  if (full) {
    // One pixel per map cell (with the edges repeated round it), stretched and softly blurred like the model's ground.
    const P = 3, zc = document.createElement('canvas'); zc.width = raw.w + 2 * P; zc.height = raw.d + 2 * P;
    const zg = zc.getContext('2d');
    for (let z = -P; z < raw.d + P; z++) for (let x = -P; x < raw.w + P; x++) {
      zg.fillStyle = ZONE_COL[zone(Math.min(raw.w - 1, Math.max(0, x)), Math.min(raw.d - 1, Math.max(0, z)))] || ZONE_COL.m; zg.fillRect(x + P, z + P, 1, 1);
    }
    g.save(); g.beginPath(); g.rect(ox, oz, s * GRID.w, s * GRID.d); g.clip();
    g.imageSmoothingEnabled = true; g.filter = `blur(${Math.round(cs * 0.4)}px)`;
    g.drawImage(zc, ox - P * cs, oz - P * cs, zc.width * cs, zc.height * cs);
    g.restore();
  } else {
    g.save();
    for (let z = 0; z < raw.d; z++) for (let x = 0; x < raw.w; x++) {
      const zn = zone(x, z), px = ox + x * cs, pz = oz + z * cs;
      if ('wpr'.includes(zn)) { g.fillStyle = '#eef2f4'; g.fillRect(px, pz, cs + 0.5, cs + 0.5); }
    }
    g.beginPath(); g.rect(ox, oz, s * GRID.w, s * GRID.d); g.clip();
    g.strokeStyle = '#c3cbd0'; g.lineWidth = 1.2;
    for (let i = -H; i < W; i += 18) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + H, H); g.stroke(); }
    g.restore();
    // Re-draw land on top of the hatch so only the water keeps it.
    for (let z = 0; z < raw.d; z++) for (let x = 0; x < raw.w; x++) {
      const zn = zone(x, z); if ('wpr'.includes(zn)) continue;
      g.fillStyle = zn === 'c' ? '#efefef' : '#ffffff'; g.fillRect(ox + x * cs - 0.5, oz + z * cs - 0.5, cs + 1, cs + 1);
      if (zn === 'b') { g.fillStyle = '#bdbdbd'; for (let i = 0; i < 3; i++) g.fillRect(ox + x * cs + ((i * 9 + x * 5) % cs), oz + z * cs + ((i * 13 + z * 7) % cs), 2.2, 2.2); }
    }
  }
  g.strokeStyle = INKC; g.lineWidth = 2; g.strokeRect(ox, oz, s * GRID.w, s * GRID.d);
  // Trees.
  g.strokeStyle = full ? '#5f9a4c' : '#9ea4a8'; g.lineWidth = 1.4; g.fillStyle = '#8fc263';
  for (const t of siteView.trees.list) {
    if (model.at(t.sx, t.sz, 0) || grown.has(`${t.sx},${t.sz}`)) continue;
    g.beginPath(); g.arc(X(t.p.x), Z(t.p.z), t.s.x * s * 0.9, 0, Math.PI * 2); if (full) g.fill(); g.stroke();
  }
  // The grid, faintly.
  g.strokeStyle = full ? 'rgba(255,255,255,0.75)' : '#e3e6e8'; g.lineWidth = 1;
  for (let z = 0; z < GRID.d; z++) for (let x = 0; x < GRID.w; x++) if (square(x, z)?.build) g.strokeRect(X(x), Z(z), s, s);
  // Rooms above this floor: dashed (an overhang or upper floor seen from below).
  g.setLineDash([10, 8]); g.strokeStyle = '#8a8f96'; g.lineWidth = 2;
  for (const b of model.boxes) if (b.level > L) { path(g, b, X, Z, s); g.stroke(); }
  g.setLineDash([]);
  // Rooms on this floor, cut through: filled with their colour, thick black walls, a number in the middle.
  for (const b of model.boxes) {
    if (!(b.level <= L && L < b.level + b.h)) continue;
    if (!['tree', 'turbine'].includes(b.shape)) key.push({ n: key.length + 1, name: PROGRAMMES[b.type].name, size: `${b.w} × ${b.d}`, b });
    const P = PROGRAMMES[b.type], cx = X(b.x + b.w / 2), cz = Z(b.z + b.d / 2);
    if (['tree'].includes(b.shape)) { g.strokeStyle = INKC; g.lineWidth = 2.5; g.fillStyle = tint(colourHex(b.colour), 0.3); for (let i = 0; i < b.w; i++) for (let j = 0; j < b.d; j++) { g.beginPath(); g.arc(X(b.x + i + 0.5), Z(b.z + j + 0.5), s * 0.3, 0, Math.PI * 2); g.fill(); g.stroke(); } continue; }
    if (b.shape === 'turbine') { g.strokeStyle = '#1d1f24'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cz, s * 0.18, 0, Math.PI * 2); g.moveTo(cx - s * 0.4, cz); g.lineTo(cx + s * 0.4, cz); g.stroke(); continue; }
    const k = TALL.has(b.type) ? 0 : L - b.level;
    path(g, b, X, Z, s, k);
    g.fillStyle = b.shape === 'pool' ? '#bfe6f0' : tint(colourHex(b.colour), 0.3); g.fill('evenodd');
    g.strokeStyle = '#1d1f24'; g.lineWidth = b.shape === 'track' || b.shape === 'pool' || b.shape === 'garden' ? 3 : 7; g.stroke();
    planOpenings(g, b, X, Z, s, k);
    // Little symbols.
    g.lineWidth = 2;
    if (b.shape === 'stairs' || b.shape === 'steps') { const n = b.shape === 'stairs' ? 6 : Math.round(Math.max(b.w, b.d) * 3); for (let i = 1; i < n; i++) { g.beginPath(); if (b.w >= b.d) { const x = X(b.x) + (s * b.w * i) / n; g.moveTo(x, Z(b.z) + 6); g.lineTo(x, Z(b.z + b.d) - 6); } else { const z = Z(b.z) + (s * b.d * i) / n; g.moveTo(X(b.x) + 6, z); g.lineTo(X(b.x + b.w) - 6, z); } g.stroke(); } }
    if (b.shape === 'spiral') { for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.beginPath(); g.moveTo(cx, cz); g.lineTo(cx + Math.cos(a) * s * 0.42, cz + Math.sin(a) * s * 0.42); g.stroke(); } }
    if (b.shape === 'pool') { g.strokeStyle = '#7fb7cc'; for (let i = 1; i < 3; i++) { g.beginPath(); const z = Z(b.z) + (s * b.d * i) / 3; for (let x = X(b.x) + 10; x < X(b.x + b.w) - 10; x += 8) g.lineTo(x, z + Math.sin(x / 9) * 3); g.stroke(); } }
    if (b.shape === 'track') { g.beginPath(); g.ellipse(cx, cz, s * b.w * 0.36, s * b.d * 0.3, 0, 0, Math.PI * 2); g.stroke(); }
    // The room's number in a circle (on a ring, on the front of the band, not over the courtyard garden).
    const ringy = (b.shape === 'ring' || b.shape === 'ringhouse') && b.w >= 3 && b.d >= 3;
    const tz = ringy ? cz + (b.d / 2 - 0.035 - ringThickness(b) / 2) * s : cz, me = key.find(k => k.b === b);
    if (me) {
      const rad = Math.max(15, Math.min(24, s * Math.min(b.w, b.d) * 0.2));
      g.beginPath(); g.arc(cx, tz, rad, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#1d1f24'; g.stroke();
      g.fillStyle = '#1d1f24'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 ${Math.round(rad * 1.05)}px Lexend, sans-serif`; g.fillText(String(me.n), cx, tz + 1);
    }
  }
  // Where the elevations are cut (sheet A-201): a dash-dot line, with a lettered arrow at each end showing which way they look.
  if (cut) {
    const za = Z(cut.a), xb = X(cut.b);
    g.strokeStyle = INKC; g.lineWidth = 2; g.setLineDash([24, 7, 4, 7]);
    g.beginPath(); g.moveTo(X(0) - 28, za); g.lineTo(X(GRID.w) + 28, za); g.moveTo(xb, Z(0) - 28); g.lineTo(xb, Z(GRID.d) + 28); g.stroke();
    g.setLineDash([]);
    marker(g, X(0) - 52, za, 'A', 0, -1); marker(g, X(GRID.w) + 52, za, 'A', 0, -1);
    marker(g, xb, Z(0) - 52, 'B', -1, 0); marker(g, xb, Z(GRID.d) + 52, 'B', -1, 0);
  }
  // North arrow and scale bar.
  const nx = W - m - 40, ny = H - 110;
  g.fillStyle = '#1d1f24'; g.beginPath(); g.moveTo(nx, ny - 50); g.lineTo(nx + 18, ny + 10); g.lineTo(nx, ny); g.lineTo(nx - 18, ny + 10); g.closePath(); g.fill();
  g.font = '700 28px Lexend, sans-serif'; g.textAlign = 'center'; g.fillText('N', nx, ny - 68);
  scaleBar(g, m, H - 80, s);
  return { url: c.toDataURL('image/png'), key: key.map(({ n, name, size }) => ({ n, name, size })) };
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
