// Geometry and materials for the forms, in Blocks mode (wooden toy blocks) and Building mode.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FORMS, ROOMS, MATERIALS, LEVEL_H, mix } from './catalogue.js';
import { CLIP } from './scene.js';

const GAP = 0.035;

// Footprint box (cells) of a form at rot 0.
export function formBox(form) {
  if (form === 'curve' || form === 'dome') return [2, 2];
  const base = FORMS[form].base;
  return [Math.max(...base.map(b => b[0])) + 1, Math.max(...base.map(b => b[1])) + 1];
}

const geoCache = new Map();
// Geometry for rot 0, centred on the footprint box, bottom at y = 0. mode: 'blocks' or 'building'.
export function formGeometry(form, mode = 'blocks') {
  const k = form + mode;
  if (geoCache.has(k)) return geoCache.get(k);
  const g = makeGeometry(form, mode);
  g.userData.cached = true;
  geoCache.set(k, g);
  return g;
}

function makeGeometry(form, mode) {
  const gap = mode === 'blocks' ? GAP : 0.0;
  const H = LEVEL_H - (mode === 'blocks' ? 0.02 : 0);
  const r = mode === 'blocks' ? 0.06 : 0.01;
  let g;
  switch (form) {
    case 'cube': g = new RoundedBoxGeometry(1 - 2 * gap, H, 1 - 2 * gap, 3, r); g.translate(0, H / 2, 0); break;
    case 'long': g = new RoundedBoxGeometry(2 - 2 * gap, H, 1 - 2 * gap, 3, r); g.translate(0, H / 2, 0); break;
    case 'tower': g = new RoundedBoxGeometry(1 - 2 * gap, 2 * LEVEL_H - 0.02, 1 - 2 * gap, 3, r); g.translate(0, LEVEL_H - 0.01, 0); break;
    case 'slab': g = new RoundedBoxGeometry(2 - 2 * gap, 0.22, 1 - 2 * gap, 2, Math.min(r, 0.05)); g.translate(0, 0.11, 0); break;
    case 'pad': g = new RoundedBoxGeometry(1 - 2 * gap, 0.06, 1 - 2 * gap, 1, 0.02); g.translate(0, 0.03, 0); break;
    case 'cylinder': g = new THREE.CylinderGeometry(0.47 - gap, 0.47 - gap, H, 32, 1); g.translate(0, H / 2, 0); break;
    case 'dome': {
      g = new THREE.SphereGeometry(0.98 - gap, 36, 14, 0, Math.PI * 2, 0, Math.PI / 2);
      g.scale(1, 0.9, 1);
      break;
    }
    case 'arch': {
      const w = 1 - 2 * gap, hw = w / 2, ow = 0.29, oh = 0.34;
      const s = new THREE.Shape();
      s.moveTo(-hw, 0); s.lineTo(-ow, 0); s.lineTo(-ow, oh); s.absarc(0, oh, ow, Math.PI, 0, true); s.lineTo(ow, 0); s.lineTo(hw, 0); s.lineTo(hw, H); s.lineTo(-hw, H); s.lineTo(-hw, 0);
      const len = 2 - 2 * gap;
      g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: mode === 'blocks', bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 20 });
      g.translate(0, 0, -len / 2);
      g.rotateY(Math.PI / 2);   // tunnel along x
      break;
    }
    case 'curve': {
      const ri = 1.0 + gap, ro = 2.0 - gap;
      const s = new THREE.Shape();
      // centre of the ring at the box corner (-1, -1); shape y maps to -z after rotateX.
      const cx = -1, cz = -1;
      const pt = (a, rr) => [cx + Math.cos(a) * rr, -(cz + Math.sin(a) * rr)];
      const N = 24;
      s.moveTo(...pt(0, ri));
      for (let i = 0; i <= N; i++) s.lineTo(...pt((Math.PI / 2) * i / N, ro));
      for (let i = N; i >= 0; i--) s.lineTo(...pt((Math.PI / 2) * i / N, ri));
      g = new THREE.ExtrudeGeometry(s, { depth: H, bevelEnabled: mode === 'blocks', bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
      g.rotateX(-Math.PI / 2);
      break;
    }
    case 'wedge': {
      const w = 1 - 2 * gap, hw = w / 2;
      const s = new THREE.Shape();
      s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, H); s.lineTo(-hw, 0.03);
      g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: mode === 'blocks', bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1 });
      g.translate(0, 0, -w / 2);
      break;
    }
    case 'roof': {
      const w = 1 - 2 * gap, hw = w / 2;
      const s = new THREE.Shape();
      s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(0, 0.42); s.lineTo(-hw, 0);
      g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: mode === 'blocks', bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1 });
      g.translate(0, 0, -w / 2);
      g.rotateY(Math.PI / 2);
      break;
    }
    case 'steps': {
      const w = 1 - 2 * gap, hw = w / 2, n = 5;
      const s = new THREE.Shape();
      s.moveTo(-hw, 0); s.lineTo(hw, 0); s.lineTo(hw, H);
      for (let i = n - 1; i >= 1; i--) { const x = -hw + w * i / n; s.lineTo(x, H * (i + 1) / n); s.lineTo(x, H * i / n); }
      s.lineTo(-hw, H / n);
      s.lineTo(-hw, 0);
      g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: mode === 'blocks', bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1 });
      g.translate(0, 0, -w / 2);
      break;
    }
    default: g = new THREE.BoxGeometry(0.9, 0.5, 0.9); g.translate(0, 0.25, 0);
  }
  g.computeVertexNormals();
  return g;
}

// Place a mesh for design entry c (works for any geometry built centred on the rot-0 box).
export function placeObject(obj, c, groundY = 0) {
  const [bw, bd] = formBox(c.form);
  const odd = (c.rot & 1) === 1;
  const w = odd ? bd : bw, d = odd ? bw : bd;
  obj.position.set(c.x + w / 2, c.level * LEVEL_H + groundY, c.z + d / 2);
  obj.rotation.set(0, -(c.rot & 3) * Math.PI / 2, 0);
}

// ---------- Textures ----------
function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

let grain = null;
export function grainTexture() {
  if (grain) return grain;
  grain = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      x.strokeStyle = `rgba(120,95,60,${0.03 + rnd() * 0.05})`;
      x.lineWidth = 1 + rnd() * 2.5;
      x.beginPath();
      const y0 = rnd() * h;
      x.moveTo(0, y0);
      for (let px = 0; px <= w; px += 16) x.lineTo(px, y0 + Math.sin(px / 40 + i) * 3 + (rnd() - 0.5) * 2);
      x.stroke();
    }
  });
  return grain;
}

const texCache = {};
export function materialTexture(id) {
  if (texCache[id]) return texCache[id];
  let t;
  switch (id) {
    case 'render': t = canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#f1ede4'; x.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(0,0,0,${rnd() * 0.035})`; x.fillRect(rnd() * w, rnd() * h, 2, 2); } }); break;
    case 'timber': t = canvasTex(256, 256, (x, w, h) => {
      for (let i = 0; i < 8; i++) { const c = 150 + rnd() * 30; x.fillStyle = `rgb(${c + 20},${c - 20},${c - 70})`; x.fillRect(i * 32, 0, 32, h); x.fillStyle = 'rgba(60,35,15,0.45)'; x.fillRect(i * 32, 0, 2, h); }
      for (let i = 0; i < 60; i++) { x.strokeStyle = 'rgba(90,55,25,0.15)'; x.beginPath(); const px = rnd() * w; x.moveTo(px, 0); x.lineTo(px + (rnd() - 0.5) * 6, h); x.stroke(); }
    }); break;
    case 'brick': t = canvasTex(256, 256, (x, w, h) => {
      x.fillStyle = '#d9cbb8'; x.fillRect(0, 0, w, h);
      const bh = 21.3, bw = 64;
      for (let r = 0; r < 12; r++) for (let c = -1; c < 5; c++) {
        const off = (r % 2) * bw / 2;
        const v = 0.85 + rnd() * 0.25;
        x.fillStyle = `rgb(${Math.round(178 * v)},${Math.round(84 * v)},${Math.round(60 * v)})`;
        x.fillRect(c * bw + off + 2, r * bh + 2, bw - 4, bh - 4);
      }
    }); break;
    case 'glass': t = canvasTex(128, 128, (x, w, h) => {
      const gr = x.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#cdeaf7'); gr.addColorStop(0.5, '#86c3e2'); gr.addColorStop(1, '#bfe3f4');
      x.fillStyle = gr; x.fillRect(0, 0, w, h); x.fillStyle = '#f5f5f2'; x.fillRect(0, 0, w, 5); x.fillRect(0, 0, 5, h); x.fillRect(w / 2 - 2, 0, 4, h);
    }); break;
    case 'stone': t = canvasTex(256, 256, (x, w, h) => {
      x.fillStyle = '#8e877c'; x.fillRect(0, 0, w, h);
      let y = 0;
      while (y < h) { const rh = 26 + rnd() * 22; let px = -rnd() * 40; while (px < w) { const rw = 40 + rnd() * 50; const v = 150 + rnd() * 40; x.fillStyle = `rgb(${v},${v - 6},${v - 14})`; x.fillRect(px + 2, y + 2, rw - 4, rh - 4); px += rw; } y += rh; }
    }); break;
    case 'grass': t = canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#5e9a45'; x.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { x.fillStyle = `hsl(${90 + rnd() * 40},${45 + rnd() * 25}%,${30 + rnd() * 25}%)`; x.beginPath(); x.arc(rnd() * w, rnd() * h, 2 + rnd() * 4, 0, 7); x.fill(); } }); break;
    case 'copper': t = canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#c87533'; x.fillRect(0, 0, w, h); for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(80,170,150,${rnd() * 0.5})`; x.beginPath(); x.arc(rnd() * w, rnd() * h, 1 + rnd() * 5, 0, 7); x.fill(); } for (let i = 0; i < 4; i++) { x.fillStyle = 'rgba(90,40,10,0.35)'; x.fillRect(i * 32, 0, 2, h); } }); break;
    default: t = null;
  }
  texCache[id] = t;
  return t;
}

// ---------- Materials ----------
const matCache = new Map();
function cached(k, make) { if (!matCache.has(k)) matCache.set(k, make()); return matCache.get(k); }

export function blockMaterial(roomId) {
  const col = ROOMS[roomId]?.colour || '#cccccc';
  return cached('b' + roomId, () => new THREE.MeshLambertMaterial({ color: col, map: grainTexture(), clippingPlanes: CLIP }));
}

// Outside walls in Building mode: the chosen material, or a soft version of the room colour.
export function wallMaterial(roomId, matId) {
  return cached(`w${roomId}:${matId}`, () => {
    const R = ROOMS[roomId];
    if (!matId || matId === 'colour') return new THREE.MeshLambertMaterial({ color: mix(R.colour, '#ffffff', 0.25), map: materialTexture('render'), clippingPlanes: CLIP });
    if (matId === 'glass') return new THREE.MeshLambertMaterial({ color: '#ffffff', map: materialTexture('glass'), transparent: true, opacity: 0.8, clippingPlanes: CLIP });
    return new THREE.MeshLambertMaterial({ color: '#ffffff', map: materialTexture(matId), clippingPlanes: CLIP });
  });
}

export function interiorMaterial(roomId) {
  // A little glow so inside walls and ceilings are not gloomy where the sun cannot reach.
  const col = mix(ROOMS[roomId]?.colour || '#dddddd', '#ffffff', 0.72);
  return cached('i' + roomId, () => new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.32, clippingPlanes: CLIP, side: THREE.FrontSide }));
}
export function floorMaterial(roomId) {
  return cached('f' + roomId, () => new THREE.MeshLambertMaterial({ color: mix(ROOMS[roomId]?.colour || '#dddddd', '#ffffff', 0.45), clippingPlanes: CLIP }));
}
export const shared = {
  get roof() { return cached('roof', () => new THREE.MeshLambertMaterial({ color: '#d8d4cb', clippingPlanes: CLIP })); },
  get parapet() { return cached('parapet', () => new THREE.MeshLambertMaterial({ color: '#f3f0ea', clippingPlanes: CLIP })); },
  get glass() { return cached('glass', () => new THREE.MeshLambertMaterial({ color: '#8fcbe8', emissive: '#1b4e6b', emissiveIntensity: 0.25, transparent: true, opacity: 0.85, clippingPlanes: CLIP })); },
  get frame() { return cached('frame', () => new THREE.MeshLambertMaterial({ color: '#fbfaf7', clippingPlanes: CLIP })); },
  get dark() { return cached('dark', () => new THREE.MeshLambertMaterial({ color: '#3b3f47', clippingPlanes: CLIP })); },
  get rail() { return cached('rail', () => new THREE.MeshLambertMaterial({ color: '#e7e3da', clippingPlanes: CLIP })); },
  get water() { return cached('water', () => new THREE.MeshLambertMaterial({ color: '#4fb3e8', emissive: '#0b5a86', emissiveIntensity: 0.35, transparent: true, opacity: 0.88, clippingPlanes: CLIP })); },
  get timber() { return cached('timberDeck', () => new THREE.MeshLambertMaterial({ color: '#ffffff', map: materialTexture('timber'), clippingPlanes: CLIP })); },
  get soil() { return cached('soil', () => new THREE.MeshLambertMaterial({ color: '#7a5a3a', clippingPlanes: CLIP })); },
  get leaf() { return cached('leaf', () => new THREE.MeshLambertMaterial({ color: '#5fae4a', clippingPlanes: CLIP })); },
  get track() { return cached('track', () => new THREE.MeshLambertMaterial({ color: '#c1440e', clippingPlanes: CLIP })); },
  get line() { return cached('line', () => new THREE.MeshBasicMaterial({ color: '#ffffff', clippingPlanes: CLIP })); },
  get stair() { return cached('stair', () => new THREE.MeshLambertMaterial({ color: '#b9bec6', clippingPlanes: CLIP })); },
};

export function ghostMaterial(ok) {
  return cached('ghost' + ok, () => new THREE.MeshLambertMaterial({ color: ok ? '#ffffff' : '#ff5a4d', emissive: ok ? '#4a90e2' : '#c62828', emissiveIntensity: 0.55, transparent: true, opacity: 0.55, depthWrite: false }));
}

export function materialFor(c, mode) {
  if (mode === 'blocks') return blockMaterial(c.room);
  return wallMaterial(c.room, c.material);
}

export { MATERIALS };
