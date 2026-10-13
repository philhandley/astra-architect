// The Rooms area: a card for each kind of room. Finn picks its shape and colour and sees it spin in 3D,
// then taps Build it to place it on the site.
import * as THREE from 'three';
import { PROGRAMMES, SHAPES, PALETTE, TRAY, LEVEL, colourHex } from './catalogue.js';
import { buildPiece, disposePiece } from './shapes.js';
import { h, esc, emo, say, sfx } from './ui.js';

// A small studio for pictures of pieces (thumbnails) and the spinning preview.
class Studio {
  constructor(w, h) {
    this.r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.r.setSize(w, h, false);
    this.r.outputColorSpace = THREE.SRGBColorSpace;
    this.r.shadowMap.enabled = true; this.r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#e6dfd0', 1.62));
    const sun = new THREE.DirectionalLight('#fff4e2', 1.9);
    sun.position.set(-4, 7, 4); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    const c = sun.shadow.camera; c.left = -5; c.right = 5; c.top = 5; c.bottom = -5;
    this.scene.add(sun);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.06, 48), new THREE.MeshLambertMaterial({ color: '#e9efd9' }));
    disc.position.y = -0.03; disc.receiveShadow = true;
    this.disc = disc; this.scene.add(disc);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.w = w; this.h = h; this.piece = null; this.angle = Math.PI / 4;
  }
  show(box) {
    if (this.piece) { this.scene.remove(this.piece); disposePiece(this.piece); }
    this.piece = buildPiece({ ...box, hex: colourHex(box.colour) }, { open: true });
    this.scene.add(this.piece);
    const span = Math.max(box.w, box.d) * 0.75 + box.h * LEVEL * 0.4;
    this.disc.scale.set(Math.hypot(box.w, box.d) * 0.62, 1, Math.hypot(box.w, box.d) * 0.62);
    const bb = new THREE.Box3().setFromObject(this.piece);
    this.top = Math.max(1, bb.max.y);
    this.fit = Math.max(span, this.top * 0.75) * 1.15;
    this.place();
  }
  place() {
    const a = this.w / this.h, f = this.fit;
    this.cam.left = -f * a; this.cam.right = f * a; this.cam.top = f; this.cam.bottom = -f; this.cam.updateProjectionMatrix();
    const ty = this.top * 0.35;
    this.cam.position.set(Math.sin(this.angle) * 20, 14 + ty, Math.cos(this.angle) * 20);
    this.cam.lookAt(0, ty, 0);
  }
  render() { this.r.render(this.scene, this.cam); }
  snap(box) { this.show(box); this.angle = Math.PI / 4; this.place(); this.render(); return this.r.domElement.toDataURL('image/png'); }
}

let thumbStudio = null;
export function thumb(type, shape, colour) {
  if (!thumbStudio) thumbStudio = new Studio(180, 150);
  const [w, d, hh] = PROGRAMMES[type].size;
  return thumbStudio.snap({ id: 1, type, shape, colour, w, d, h: hh, x: 0, z: 0, level: 0 });
}
export function trayThumbs(model) {
  const m = new Map();
  for (const id of TRAY) { const st = model.style(id); m.set(id, thumb(id, st.shape, st.colour)); }
  return m;
}

export function mountRooms(root, model, { onBuild, thumbs }) {
  const ui = h(`<div class="rooms">
    <div class="cards"></div>
    <div class="detail card">
      <div class="dhead"><span class="demo"></span><div><h2 class="dname"></h2><p class="dholds"></p></div><button class="speak" type="button" aria-label="Read aloud">🔊</button></div>
      <div class="preview"></div>
      <div class="label">Shape</div><div class="shapes"></div>
      <div class="label">Colour</div><div class="colours"></div>
      <button class="build" type="button">Build it on the site ➜</button>
    </div>
  </div>`);
  root.appendChild(ui);
  const cards = ui.querySelector('.cards'), preview = ui.querySelector('.preview');
  const big = new Studio(520, 340);
  preview.appendChild(big.r.domElement);
  let current = TRAY[0], running = false;

  function drawCards() {
    cards.innerHTML = '';
    for (const id of TRAY) {
      const P = PROGRAMMES[id];
      const c = h(`<button class="rcard ${id === current ? 'on' : ''}" type="button"><img src="${thumbs.get(id)}" alt=""><b>${esc(P.name)}</b><span>${emo(P.emoji)} ${esc(P.size[0])} × ${esc(P.size[1])}</span></button>`);
      c.addEventListener('click', () => { current = id; sfx.tap(); say(`${P.name}. ${P.say}`); drawCards(); drawDetail(); });
      cards.append(c);
    }
  }
  function drawDetail() {
    const P = PROGRAMMES[current], st = model.style(current);
    ui.querySelector('.demo').innerHTML = emo(P.emoji, 'big');
    ui.querySelector('.dname').textContent = P.name;
    ui.querySelector('.dholds').textContent = `${P.size[0]} × ${P.size[1]} blocks${P.size[2] > 1 ? `, ${P.size[2]} storeys` : ''}${P.holds ? ` · holds ${P.holds}` : ''}`;
    const [w, d, hh] = P.size;
    big.show({ id: 7, type: current, shape: st.shape, colour: st.colour, w, d, h: hh, x: 0, z: 0, level: 0 });
    const shapes = ui.querySelector('.shapes'); shapes.innerHTML = '';
    for (const s of P.shapes) {
      const b = h(`<button class="shapebtn ${s === st.shape ? 'on' : ''}" type="button"><img src="${thumb(current, s, st.colour)}" alt=""><span>${esc(SHAPES[s].name)}</span></button>`);
      b.addEventListener('click', () => { model.setStyle(current, { shape: s }); thumbs.set(current, thumb(current, s, st.colour)); sfx.tap(); say(SHAPES[s].name); drawCards(); drawDetail(); });
      shapes.append(b);
    }
    const cols = ui.querySelector('.colours'); cols.innerHTML = '';
    for (const p of PALETTE) {
      const b = h(`<button class="sw ${p.id === st.colour ? 'on' : ''}" type="button" style="background:${p.hex}" aria-label="${esc(p.name)}"></button>`);
      b.addEventListener('click', () => { model.setStyle(current, { colour: p.id }); thumbs.set(current, thumb(current, model.style(current).shape, p.id)); sfx.tap(); say(p.name); drawCards(); drawDetail(); });
      cols.append(b);
    }
  }
  ui.querySelector('.speak').addEventListener('click', () => { const P = PROGRAMMES[current]; say(`${P.name}. ${P.say}`); });
  ui.querySelector('.build').addEventListener('click', () => { sfx.whoosh(); onBuild(current); });

  // The preview spins slowly.
  const loop = () => { if (!running) return; big.angle += 0.006; big.place(); big.render(); requestAnimationFrame(loop); };
  drawCards(); drawDetail();
  return {
    show(on) { ui.hidden = !on; if (on && !running) { running = true; drawCards(); drawDetail(); loop(); } if (!on) running = false; },
    advance() { big.render(); },
  };
}
