// Facade details that make a block read as a building: big framed windows on every storey, a front door,
// and a pale terrace deck on an open flat roof. Merged into two or three meshes per piece, so it stays fast.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LEVEL } from './catalogue.js';
import { mat, shade } from './shapes.js';

const GAP = 0.035;
const RECT = new Set(['box', 'house', 'saw', 'vault']);
const ROUND = new Set(['drum', 'tower']);
const TALL = new Set(['hall', 'pool', 'aquarium', 'maker']);       // one tall room: tall windows
const NO_WINDOWS = new Set(['glass']);

function roundedRectPath(W, D, r) {
  const s = new THREE.Shape(), x = -W / 2, y = -D / 2;
  r = Math.max(0.001, Math.min(r, W / 2, D / 2));
  s.moveTo(x + r, y); s.lineTo(x + W - r, y); s.absarc(x + W - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + W, y + D - r); s.absarc(x + W - r, y + D - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + D); s.absarc(x + r, y + D - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

// One window: a white frame with glass in front, facing outward along (nx, nz).
function windowAt(glass, frames, x, z, nx, nz, y, ww, wh, door = false) {
  const a = Math.atan2(nx, nz);
  const put = (list, w, h, d, off, yy) => list.push(new THREE.BoxGeometry(w, h, d).translate(0, 0, off).rotateY(a).translate(x, yy, z));
  put(frames, ww + 0.035, wh + 0.035, 0.012, 0.006, y);
  put(door ? frames.doors : glass, ww, wh, 0.012, 0.012, y);
  if (!door && wh > 0.2) put(frames, ww, 0.012, 0.014, 0.014, y);      // a transom bar
}

export function addFacade(g, box, H) {
  if (NO_WINDOWS.has(box.surface)) return;
  const glass = [], frames = []; frames.doors = [];
  const storeys = Math.max(1, Math.round(H / LEVEL)), tall = TALL.has(box.type);
  const wallH = H;
  const rows = tall ? [{ y: wallH * 0.5, h: Math.min(wallH * 0.62, 0.6) }] : Array.from({ length: storeys }, (_, k) => ({ y: k * LEVEL + 0.25, h: 0.22 }));
  const W = box.w - 2 * GAP, D = box.d - 2 * GAP;
  if (RECT.has(box.shape)) {
    const faces = [[0, D / 2, 0, 1, W], [0, -D / 2, 0, -1, W], [W / 2, 0, 1, 0, D], [-W / 2, 0, -1, 0, D]];
    // Saw and house roofs: windows only below the eaves, and a round window up in each gable end.
    for (const [cx, cz, nx, nz, len] of faces) {
      const n = Math.max(1, Math.round(len / 0.34)), step = len / n, ww = Math.min(0.2, step * 0.62);
      rows.forEach((row, ri) => {
        for (let i = 0; i < n; i++) {
          const t = -len / 2 + step * (i + 0.5);
          const x = cx + (nz !== 0 ? t : 0), z = cz + (nx !== 0 ? t : 0);
          const isDoor = box.level === 0 && ri === 0 && nz === 1 && i === Math.floor(n / 2);
          if (isDoor) windowAt(glass, frames, x, z, nx, nz, 0.14, 0.15, 0.27, true);
          else windowAt(glass, frames, x, z, nx, nz, row.y, ww, row.h);
        }
      });
    }
  } else if (ROUND.has(box.shape) || box.shape === 'ring' || box.shape === 'ringhouse') {
    const loops = [];
    if (box.shape === 'ringhouse') { const t = box.w >= 3 && box.d >= 3 ? 0.9 : 0.6; loops.push([W - 0.02, D - 0.02, Math.min(W, D) / 2, 1]); loops.push([W - 2 * t + 0.02, D - 2 * t + 0.02, Math.max(0.05, Math.min(W, D) / 2 - t), -1]); }
    else if (box.shape === 'ring') { const t = box.w >= 3 && box.d >= 3 ? 0.95 : Math.min(W, D) * 0.3; loops.push([W - 0.02, D - 0.02, Math.min(W, D) / 2, 1]); if (box.w >= 2 && box.d >= 2) loops.push([W - 2 * t + 0.02, D - 2 * t + 0.02, Math.max(0.05, Math.min(W, D) / 2 - t), -1]); }
    else loops.push([W - 0.01, D - 0.01, Math.min(W, D) / 2, 1]);
    for (const [lw, ld, r, side] of loops) {
      const path = roundedRectPath(lw, ld, r), len = path.getLength(), n = Math.max(4, Math.round(len / 0.36));
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n, p = path.getPointAt(u), tg = path.getTangentAt(u);
        const nx = tg.y * side, nz = tg.x * side;            // outward (shape y is world -z)
        rows.forEach((row, ri) => {
          const isDoor = box.level === 0 && ri === 0 && side === 1 && i === Math.floor(n * 0.375);
          if (isDoor) windowAt(glass, frames, p.x, -p.y, nx, nz, 0.14, 0.15, 0.27, true);
          else windowAt(glass, frames, p.x, -p.y, nx, nz, row.y, 0.16, row.h);
        });
      }
    }
  } else return;
  const merge = list => list.length ? mergeGeometries(list.map(x => { x.deleteAttribute('uv'); return x; })) : null;
  const gm = merge(glass), fm = merge(frames), dm = merge(frames.doors);
  if (gm) { const m = new THREE.Mesh(gm, mat('#bfe4f3', { emissive: '#7fc6e0', emissiveIntensity: 0.18 })); m.userData.glass = true; g.add(m); }
  if (fm) { const m = new THREE.Mesh(fm, mat('#fbfaf6')); m.castShadow = true; g.add(m); }
  if (dm) g.add(new THREE.Mesh(dm, mat(shade(box.hex, 0.55))));
}

// A pale deck on an open flat roof, so it reads as a terrace to play on.
export function addTerrace(g, box, H) {
  const W = box.w - 2 * GAP - 0.06, D = box.d - 2 * GAP - 0.06;
  let shape;
  if (box.shape === 'drum') shape = roundedRectPath(W, D, Math.min(W, D) / 2);
  else if (box.shape === 'box') shape = roundedRectPath(W, D, 0.03);
  else return;
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.014, bevelEnabled: false, curveSegments: 24 }).rotateX(-Math.PI / 2).translate(0, H, 0);
  const deck = new THREE.Mesh(geo, mat('#efe9dd')); deck.receiveShadow = true;
  g.add(deck);
}

// A soft shadow under a building where it meets the ground.
let BLOB = null;
export function contactShadow(box) {
  if (!BLOB) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'); x.shadowColor = 'rgba(30,26,18,1)'; x.shadowBlur = 20; x.fillStyle = 'rgba(30,26,18,1)';
    x.beginPath(); x.roundRect(26, 26, 76, 76, 14); x.fill();
    const t = new THREE.CanvasTexture(c);
    BLOB = { geo: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat: new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.32, depthWrite: false }) };
    BLOB.geo.userData.shared = true; BLOB.mat.userData.shared = true;
  }
  const m = new THREE.Mesh(BLOB.geo, BLOB.mat);
  m.scale.set(box.w / 0.6, 1, box.d / 0.6); m.position.y = 0.006; m.renderOrder = 1; m.raycast = () => {};
  return m;
}
