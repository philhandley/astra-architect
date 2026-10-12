// The drawing sheet for school: model view, plans, a section, a key and a sentence, on one picture.
import * as THREE from 'three';
import { store } from '../core/store.js';
import { indexDesign, roomGroups, bounds, seaView, nearWaterfall } from '../core/design.js';
import { computeDoors } from '../core/arch.js';
import { ROOMS, WISHES, LEVEL_H, FORMS } from '../core/catalogue.js';
import { checkBrief, trackLoops } from '../core/brief.js';
import { loadSite } from '../core/site.js';
import { getWorld, CLIP, clipPlane, ISO_DIR } from '../core/scene.js';
import { buildTerrain } from '../core/terrain.js';
import { DesignView } from '../core/build3d.js';
import { drawPlan, loadMapImage, fitView } from '../core/plan2d.js';
import { emojiImage } from '../core/emoji.js';
import { icon } from '../core/icons.js';
import { h, esc, modal, say, speakButton, toast, sfx } from './dom.js';

const W = 2048, H = 1448;
const INK = '#1f2229';

export function schoolSentence(idx) {
  const groups = roomGroups(idx);
  const n = r => groups.filter(g => g.room === r).length;
  const brief = checkBrief(idx, ['yoga-waterfall', 'sea-classroom', 'arch-aquarium', 'roof-track']);
  const words = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const parts = [];
  const nc = n('classroom');
  if (nc) parts.push(`${nc === 1 ? 'a classroom' : `${words[nc] || nc} classrooms`}${brief['sea-classroom'] ? ' facing the sea' : ''}`);
  if (n('pool')) parts.push('a swimming pool');
  if (n('aquarium')) parts.push(brief['arch-aquarium'] ? 'an aquarium you can walk through' : 'an aquarium');
  if (brief['roof-track']) parts.push('a running track on the roof');
  else if (n('track')) parts.push('a running track');
  if (n('yoga')) parts.push(brief['yoga-waterfall'] ? 'a chill-out room by the waterfall' : 'a chill-out room');
  for (const [r, phrase] of [['hall', 'a hall'], ['library', 'a library'], ['lunch', 'a lunch room'], ['slide', 'a slide'], ['climbing', 'a climbing wall'], ['garden', 'a garden'], ['lookout', 'a lookout tower'], ['art', 'an art room'], ['music', 'a music room']]) if (n(r)) parts.push(phrase);
  if (!parts.length) return 'My school is waiting to be built!';
  const list = parts.slice(0, 7);
  const last = list.pop();
  return `My school has ${list.length ? list.join(', ') + ' and ' : ''}${last}.`;
}

async function renderViews(idx) {
  const world = getWorld();
  const wasHost = world.host;
  let tmp = null;
  if (!wasHost) {
    tmp = h(`<div style="position:fixed;left:-20000px;top:0;width:1200px;height:800px"></div>`);
    document.body.appendChild(tmp);
    world.attach(tmp);
  }
  await buildTerrain(world);
  if (!world.designView) world.designView = new DesignView(world);
  const dv = world.designView;
  const prevMode = dv.mode;
  const saved = { pos: world.cam.position.clone(), target: world.controls.target.clone(), camera: world.camera, shift: world.viewShift || 0, fog: world.scene.fog, bg: world.scene.background, sky: world.sky.visible };
  world.setViewShift(0);
  world.scene.fog = world.noFog;
  dv.sync(idx, 'building');
  const b = bounds(idx.design) || { x0: 8, x1: 28, z0: 20, z1: 36, l1: 1, cx: 18, cz: 28 };
  const r = world.renderer;
  const size = new THREE.Vector2();
  r.getSize(size);
  const pr = r.getPixelRatio();
  r.setPixelRatio(1);
  const shot = (w, hgt) => { r.setSize(w, hgt, false); world.render(); const c = document.createElement('canvas'); c.width = w; c.height = hgt; c.getContext('2d').drawImage(world.canvas, 0, 0, w, hgt); return c; };
  // An axonometric view, the architect's favourite, from the south-east.
  const span = Math.max(8, Math.max(b.x1 - b.x0, b.z1 - b.z0));
  const savedOrtho = { pos: world.ortho.position.clone(), quat: world.ortho.quaternion.clone(), zoom: world.ortho.zoom, view: world.orthoView ? { ...world.orthoView } : null };
  world.camera = world.ortho;
  world.ortho.zoom = 1;
  world.ortho.position.set(b.cx, 0.4, b.cz).addScaledVector(ISO_DIR, 80);
  world.ortho.up.set(0, 1, 0);
  world.ortho.lookAt(b.cx, 0.4, b.cz);
  const mh = span * 0.5 + 2;
  world.ortho.left = -mh * (1100 / 700); world.ortho.right = mh * (1100 / 700); world.ortho.top = mh; world.ortho.bottom = -mh; world.ortho.updateProjectionMatrix();
  world.focusShadows(b.cx, b.cz, span / 2 + 6);
  const model = shot(1100, 700);
  // Section: from the sea, cut through the biggest room, keeping only a thin slice behind it.
  const height = Math.max(1, b.l1) * LEVEL_H;
  const gs = roomGroups(idx).filter(gr => gr.level === 0).sort((p, q) => q.cells.length - p.cells.length);
  const cutZ = gs.length ? Math.round(gs[0].cells.reduce((a, c) => a + c.z, 0) / gs[0].cells.length) + 0.5 : b.cz;
  const onCut = idx.design.cells.filter(c => Math.abs(c.z + 0.5 - cutZ) < 2.5);
  const sx0 = onCut.length ? Math.min(...onCut.map(c => c.x)) - 1.5 : b.x0, sx1 = onCut.length ? Math.max(...onCut.map(c => c.x)) + 3.5 : b.x1;
  const width = sx1 - sx0;
  const scx = (sx0 + sx1) / 2;
  world.camera = world.ortho;
  world.sky.visible = false;
  world.scene.background = new THREE.Color('#ffffff');
  const back = new THREE.Plane(new THREE.Vector3(0, 0, 1), -(cutZ - 4));
  CLIP.length = 0; CLIP.push(clipPlane, back);
  clipPlane.normal.set(0, 0, -1); clipPlane.constant = cutZ;
  const trees = world.groups.terrain.children.filter(o => o.isInstancedMesh);
  trees.forEach(t => { t.visible = false; });
  const aspect = 1100 / 296;
  const halfH = Math.max(height * 0.8 + 0.4, (width / 2) / aspect);
  world.ortho.left = -halfH * aspect; world.ortho.right = halfH * aspect; world.ortho.top = halfH; world.ortho.bottom = -halfH; world.ortho.updateProjectionMatrix();
  const cy = halfH * 0.72 - 0.3;
  world.ortho.position.set(scx, cy, cutZ + 80); world.ortho.lookAt(scx, cy, cutZ);
  const section = shot(1100, 296);
  trees.forEach(t => { t.visible = true; });
  // Restore everything.
  CLIP.length = 0;
  world.scene.background = saved.bg;
  world.sky.visible = saved.sky;
  world.scene.fog = saved.fog;
  world.camera = saved.camera;
  world.cam.position.copy(saved.pos); world.controls.target.copy(saved.target);
  r.setPixelRatio(pr);
  r.setSize(size.x, size.y, false);
  world.ortho.position.copy(savedOrtho.pos); world.ortho.quaternion.copy(savedOrtho.quat); world.ortho.zoom = savedOrtho.zoom;
  if (savedOrtho.view) world.setOrthoView(savedOrtho.view.cx, savedOrtho.view.cy, savedOrtho.view.halfH);
  world.resize();
  world.setViewShift(saved.shift);
  dv.sync(idx, prevMode);
  if (tmp) { world.detach(); tmp.remove(); }
  return { model, section };
}

export async function makeSheet() {
  await loadSite();
  await document.fonts.ready;
  const S = store.state;
  const idx = indexDesign(S.design);
  const doors = computeDoors(idx);
  const name = (S.crew && S.crew.commander) || 'Finn';
  const { model, section } = await renderViews(idx);
  const map = await loadMapImage();
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fbfaf7'; g.fillRect(0, 0, W, H);
  // Header
  g.fillStyle = INK;
  g.font = '800 76px Lexend, sans-serif'; g.textBaseline = 'alphabetic';
  g.fillText(`${name}'s Dream School`, 70, 120);
  g.font = '500 30px Lexend, sans-serif'; g.fillStyle = '#4c5160';
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  g.fillText(`Designed by Architect ${name}  ·  ${date}`, 74, 170);
  g.textAlign = 'right'; g.font = '700 26px Lexend, sans-serif'; g.fillStyle = '#8a8f9c';
  g.fillText('ASTRA ARCHITECT', W - 70, 120);
  g.textAlign = 'left';
  const panel = (x, y, w, hh, title) => {
    g.fillStyle = '#ffffff'; g.strokeStyle = '#e2ddd1'; g.lineWidth = 3;
    roundRect(g, x, y, w, hh, 22); g.fill(); g.stroke();
    g.fillStyle = INK; g.font = '700 28px Lexend, sans-serif';
    g.fillText(title, x + 24, y + 44);
  };
  // Model view
  panel(60, 210, 1140, 790, 'Model');
  g.save(); roundRect(g, 80, 270, 1100, 710, 16); g.clip(); g.drawImage(model, 80, 270, 1100, 710); g.restore();
  // Plans
  const maxL = Math.max(0, ...S.design.cells.map(cc => cc.level + FORMS[cc.form].levels - 1));
  const upper = S.design.cells.some(cc => cc.level >= 1);
  panel(1230, 210, 758, 470, 'Plan: ground floor');
  const pc = document.createElement('canvas'); pc.width = 718; pc.height = 396;
  const pv = fitView(S.design, 718, 396, 1.5);
  drawPlan(pc.getContext('2d'), 718, 396, idx, doors, pv, { level: 0, mapImg: map, paper: true, labels: true });
  g.drawImage(pc, 1250, 266);
  panel(1230, 700, 758, 430, upper ? 'Plan: upstairs and roof' : 'Bubble diagram');
  const pc2 = document.createElement('canvas'); pc2.width = 718; pc2.height = 356;
  const pv2 = fitView(S.design, 718, 356, 1.5);
  drawPlan(pc2.getContext('2d'), 718, 356, idx, doors, pv2, upper ? { level: Math.min(maxL, 1), mapImg: map, paper: true, labels: true } : { level: 0, mapImg: map, paper: true, bubbles: true });
  g.drawImage(pc2, 1250, 756);
  panel(1230, 1150, 758, 240, 'My school');
  // Section
  panel(60, 1020, 1140, 370, 'Section: cut through the middle');
  g.save(); roundRect(g, 80, 1078, 1100, 296, 14); g.clip(); g.drawImage(section, 80, 1078, 1100, 296); g.restore();
  // Key and sentence
  const sentence = schoolSentence(idx);
  g.fillStyle = INK; g.font = '500 28px Lexend, sans-serif';
  wrap(g, sentence, 1254, 1246, 710, 36, 4);
  const keyRooms = [...new Set(roomGroups(idx).map(gr => gr.room))].slice(0, 12);
  const emojis = await Promise.all(keyRooms.map(r => emojiImage(ROOMS[r].emoji)));
  g.font = '600 20px Lexend, sans-serif';
  // Key along the bottom of the model panel.
  let kx = 100;
  keyRooms.forEach((r, i) => {
    const R = ROOMS[r];
    const label = R.name;
    g.font = '600 20px Lexend, sans-serif';
    const tw = g.measureText(label).width;
    if (kx + tw + 70 > 1180) return;
    g.fillStyle = 'rgba(255,255,255,0.92)'; roundRect(g, kx - 8, 930, tw + 64, 40, 20); g.fill();
    g.fillStyle = R.colour; g.beginPath(); g.arc(kx + 10, 950, 9, 0, 7); g.fill();
    if (emojis[i]) g.drawImage(emojis[i], kx + 22, 937, 26, 26);
    g.fillStyle = INK; g.fillText(label, kx + 52, 957);
    kx += tw + 76;
  });
  store.set({ sheets: [...(S.sheets || []), { t: Date.now(), sentence }].slice(-20) });
  return { canvas: c, sentence };
}

export async function openSheet(opts = {}) {
  const body = h(`<div style="display:flex;flex-direction:column;gap:14px">
    <div class="muted" style="font-size:20px">Drawing your school...</div></div>`);
  const close = modal('Drawing sheet', body, { wide: true });
  let res;
  try { res = await makeSheet(); }
  catch (e) { console.error(e); body.innerHTML = '<p>Sorry, the drawing sheet could not be made just now.</p>'; return; }
  const url = res.canvas.toDataURL('image/png');
  body.innerHTML = '';
  const img = h(`<img class="sheet-preview" alt="Drawing sheet of the dream school">`);
  img.src = url;
  const row = h(`<div class="mindrow" style="justify-content:flex-start"></div>`);
  const sp = speakButton(() => res.sentence, 'Read the sentence');
  const save = h(`<button class="btn go" type="button">${icon('download')} Save the picture</button>`);
  save.addEventListener('click', () => saveCanvas(res.canvas));
  row.append(sp, save);
  if (navigator.canShare) {
    const share = h(`<button class="btn ghost" type="button">${icon('share')} Share</button>`);
    share.addEventListener('click', () => shareCanvas(res.canvas));
    row.append(share);
  }
  body.append(img, h(`<p style="margin:0;font-size:22px;font-weight:600">${esc(res.sentence)}</p>`), row);
  sfx.tada();
  say(`Here is your drawing sheet. ${res.sentence}`);
  opts.onMade && opts.onMade(res);
  void close;
}

function saveCanvas(c) {
  c.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dream-school.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Saved as dream-school.png', '🖼️');
  }, 'image/png');
}
function shareCanvas(c) {
  c.toBlob(async blob => {
    const file = new File([blob], 'dream-school.png', { type: 'image/png' });
    try {
      if (navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: 'My dream school' });
      else saveCanvas(c);
    } catch (e) { /* cancelled */ }
  }, 'image/png');
}

function roundRect(g, x, y, w, hh, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function wrap(g, text, x, y, maxW, lh, maxLines = 5) {
  const words = text.split(' ');
  let line = '';
  const lines = [];
  for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((l, i) => g.fillText(l, x, y + i * lh));
}

export { seaView, nearWaterfall, trackLoops, WISHES };
