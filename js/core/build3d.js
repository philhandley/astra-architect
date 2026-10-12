// Turns the design into 3D, in Blocks mode (toy blocks with room stickers) or Building mode
// (merged walls with doors, windows and roofs, plus pool water, slide rails, track lanes and fish).
import * as THREE from 'three';
import { FORMS, ROOMS, LEVEL_H, mix } from './catalogue.js';
import { key, footprint, roomGroups, DIRS } from './design.js';
import { BOX, isRoomCell, computeDoors, wedgeDir, computePaths } from './arch.js';
import { cellGround } from './site.js';
import { formGeometry, placeObject, materialFor, wallMaterial, interiorMaterial, floorMaterial, shared, formBox, blockMaterial } from './forms3d.js';
import { emojiImage } from './emoji.js';
import { CLIP } from './scene.js';
import { staticParts } from './models.js';
import { styleOf, layoutGroup, bodyGeometry, openBody, roofObject, slabFollowing, glassMat, setClip, shade, DOOR_ACCENT, liftOf, LIFT, splitParts, KEEP } from './character.js';

const UP = new THREE.Vector3(0, 1, 0);
let PATH_GEO = null;

const LINE_MAT = KEEP.keep(new THREE.LineBasicMaterial({ color: '#3d405b', transparent: true, opacity: 0.42, clippingPlanes: CLIP }));
const lamCache = new Map();
const lam = hex => { if (!lamCache.has(hex)) lamCache.set(hex, KEEP.keep(new THREE.MeshLambertMaterial({ color: hex, clippingPlanes: CLIP }))); return lamCache.get(hex); };
const once = (make) => { let g = null; return () => { if (!g) { g = make(); g.userData.cached = true; } return g; }; };
const BOX1 = once(() => new THREE.BoxGeometry(1, 1, 1));
const DOORFRAME = once(() => mergeBoxes([new THREE.BoxGeometry(0.04, 0.54, 0.045).translate(-0.17, 0.27, 0), new THREE.BoxGeometry(0.04, 0.54, 0.045).translate(0.17, 0.27, 0), new THREE.BoxGeometry(0.38, 0.05, 0.045).translate(0, 0.54, 0)]));
const DISC = once(() => new THREE.CylinderGeometry(0.1, 0.1, 0.03, 20).rotateX(Math.PI / 2));
const RING = once(() => new THREE.TorusGeometry(0.1, 0.02, 6, 24));
const LEG = once(() => new THREE.CylinderGeometry(0.032, 0.032, LIFT, 8).translate(0, LIFT / 2, 0));
const BEAK = once(() => { const g = new THREE.ConeGeometry(0.17, 0.42, 4); g.rotateY(Math.PI / 4); g.rotateX(Math.PI / 2); g.scale(1, 0.55, 1); return g; });
const CHIMNEY = once(() => new THREE.CylinderGeometry(0.06, 0.07, 0.48, 12));
const CHIMNEY_TOP = once(() => new THREE.CylinderGeometry(0.075, 0.075, 0.06, 12));
const POLE = once(() => new THREE.CylinderGeometry(0.012, 0.012, 0.72, 6));
const FLAG = once(() => { const s = new THREE.Shape(); s.moveTo(0, 0.1); s.lineTo(0.3, 0); s.lineTo(0, -0.1); s.lineTo(0, 0.1); return new THREE.ShapeGeometry(s); });
const SIGN_GEO = once(() => new THREE.CircleGeometry(0.13, 24));

const BLOB_GEO = () => { if (!BLOB_GEO.g) { BLOB_GEO.g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2); BLOB_GEO.g.userData.cached = true; } return BLOB_GEO.g; };
let BLOB_MAT = null;
function blobMat() {
  if (BLOB_MAT) return BLOB_MAT;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.shadowColor = 'rgba(40,34,24,1)'; x.shadowBlur = 22; x.fillStyle = 'rgba(40,34,24,1)';
  x.beginPath(); x.roundRect(28, 28, 72, 72, 10); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  BLOB_MAT = KEEP.keep(new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, clippingPlanes: CLIP }));
  return BLOB_MAT;
}
function openCourt(idx, hole, level) {
  const xs = hole.map(p => p[0]), zs = hole.map(p => p[1]);
  const inside = (px, pz) => { let c = false; for (let i = 0, j = hole.length - 1; i < hole.length; j = i++) { const [xi, zi] = hole[i], [xj, zj] = hole[j]; if ((zi > pz) !== (zj > pz) && px < (xj - xi) * (pz - zi) / (zj - zi) + xi) c = !c; } return c; };
  for (let z = Math.floor(Math.min(...zs)); z < Math.max(...zs); z++) for (let x = Math.floor(Math.min(...xs)); x < Math.max(...xs); x++) {
    if (!inside(x + 0.5, z + 0.5)) continue;
    if (idx.occ.has(key(x, z, level))) return false;
    if (level > 0) { const b = idx.occ.get(key(x, z, level - 1)); if (!b || FORMS[b.form].top !== 'flat') return false; }
  }
  return true;
}
function courtyard(hole, y0) {
  const g = new THREE.Group();
  const toV = p => new THREE.Vector2(p[0], -p[1]);
  const geo = new THREE.ShapeGeometry(new THREE.Shape(hole.map(toV)));
  geo.rotateX(-Math.PI / 2); geo.translate(0, y0 + 0.012, 0);
  const lawn = new THREE.Mesh(geo, lam('#8cc76a'));
  lawn.receiveShadow = true;
  g.add(lawn);
  const cx = hole.reduce((a, p) => a + p[0], 0) / hole.length, cz = hole.reduce((a, p) => a + p[1], 0) / hole.length;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.3, 6), lam('#8d6e52')); trunk.position.set(cx, y0 + 0.15, cz);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), lam('#5aa34a')); crown.position.set(cx, y0 + 0.48, cz); crown.scale.y = 0.9;
  for (const m of [trunk, crown]) { m.castShadow = true; g.add(m); }
  return g;
}

// Points round an outline, every `step`, pulled in a little (for legs).
function perimeterPoints(loop, step, inset) {
  const pts = [];
  let cx = 0, cz = 0; for (const p of loop) { cx += p[0]; cz += p[1]; } cx /= loop.length; cz /= loop.length;
  let carry = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i], b = loop[(i + 1) % loop.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let t = carry; t < len; t += step) {
      const x = a[0] + (b[0] - a[0]) * t / len, z = a[1] + (b[1] - a[1]) * t / len;
      const dx = cx - x, dz = cz - z, d = Math.hypot(dx, dz) || 1;
      pts.push([x + dx / d * inset, z + dz / d * inset]);
    }
    carry = ((carry - len) % step + step) % step;
  }
  return pts;
}
// How far a roof rises above the walls (for flags).
function roofHeight(type, b, rect) {
  const W = b.x1 - b.x0, D = b.z1 - b.z0, short = rect ? Math.min(W, D) : 1;
  return { flat: 0.05, pitch: Math.min(0.55, 0.32 * short + 0.18), pyramid: Math.min(0.9, 0.42 * short + 0.3), cone: Math.min(1.1, (short / 2 + 0.08) * 1.9 + 0.2), barrel: short * 0.31, saw: 0.24, mono: Math.min(0.4, 0.2 * short + 0.12), dome: Math.min(0.7, short * 0.5) }[type] || 0.05;
}

// ---------- Emoji stickers ----------
const stickerTex = new Map();
function emojiTexture(ch, plain = false) {
  const k = ch + (plain ? ':plain' : '');
  if (stickerTex.has(k)) return stickerTex.get(k);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const x = c.getContext('2d');
  if (!plain) { x.fillStyle = 'rgba(255,255,255,0.92)'; x.beginPath(); x.arc(64, 64, 60, 0, Math.PI * 2); x.fill(); }
  emojiImage(ch).then(img => { if (img) { if (plain) x.drawImage(img, 4, 4, 120, 120); else x.drawImage(img, 22, 22, 84, 84); t.needsUpdate = true; } });
  stickerTex.set(k, t);
  return t;
}
const stickerGeo = new THREE.CircleGeometry(0.3, 24).rotateX(-Math.PI / 2);
stickerGeo.userData.cached = true;
const stickerMats = new Map();
function stickerMat(ch) {
  if (!stickerMats.has(ch)) stickerMats.set(ch, KEEP.keep(new THREE.MeshBasicMaterial({ map: emojiTexture(ch), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, clippingPlanes: CLIP })));
  return stickerMats.get(ch);
}
export function fishTexture(ch) { return emojiTexture(ch, true); }

// Little flourishes on the toy blocks (a black hat on a tower, a white rim on a cylinder, a tip on a dome).
const ACC = {};
const accGeo = (k, mk) => ACC[k] || (ACC[k] = mk());
function accent(g, c) {
  const put = (geoKey, mk, mat, y, x = 0, z = 0) => { const m = new THREE.Mesh(accGeo(geoKey, mk), mat); m.position.set(x, y, z); m.castShadow = true; m.userData.cellId = c.id; g.add(m); };
  if (c.form === 'tower') put('cap', () => new THREE.BoxGeometry(0.72, 0.07, 0.72), shared.dark, 2 * LEVEL_H + 0.02);
  if (c.form === 'cylinder') put('rim', () => new THREE.TorusGeometry(0.44, 0.028, 8, 32).rotateX(Math.PI / 2), shared.parapet, LEVEL_H - 0.01);
  if (c.form === 'dome') put('tip', () => new THREE.SphereGeometry(0.08, 10, 8), shared.parapet, 0.9);
  if (c.form === 'long') { put('band', () => new THREE.BoxGeometry(0.06, LEVEL_H * 0.6, 1.02), shared.parapet, LEVEL_H / 2, 0); }
  if (c.form === 'roof') put('ridge', () => new THREE.BoxGeometry(1.0, 0.05, 0.06), shared.dark, 0.42);
}

// Top surface height of a form, relative to its base.
function topOf(form) {
  switch (form) {
    case 'tower': return 2 * LEVEL_H;
    case 'slab': return 0.22;
    case 'pad': return 0.06;
    case 'dome': return 0.9;
    case 'wedge': return LEVEL_H * 0.55;
    case 'roof': return 0.42;
    default: return LEVEL_H;
  }
}

export class DesignView {
  constructor(world) {
    this.world = world;
    this.group = world.groups.design;
    this.mode = 'blocks';
    this.fish = [];
    this.flags = [];
    this.byId = new Map();          // design id -> Object3D (for picking and highlighting)
    world.updaters.add((dt, t) => this.animate(dt, t));
  }

  clear() {
    for (const o of [...this.group.children]) {
      this.group.remove(o);
      // Free every geometry made for this build; shared, cached shapes are kept.
      o.traverse(m => {
        if ((m.isMesh || m.isLineSegments) && m.geometry && !m.geometry.userData.cached) m.geometry.dispose();
        if (m.isInstancedMesh) m.dispose();
        const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
        for (const mt of mats) if (!KEEP.has(mt)) mt.dispose();
      });
    }
    this.byId.clear();
    this.fish = [];
    this.flags = [];
  }

  sync(idx, mode = this.mode) {
    this.mode = mode;
    this.gen = (this.gen || 0) + 1;
    this.clear();
    this.idx = idx;
    this.doors = computeDoors(idx);
    this.pathCells = computePaths(idx, this.doors);
    if (mode === 'blocks') this.buildBlocks(idx);
    else this.buildBuilding(idx, mode === 'cutaway');
    this.drawPaths(idx);
    this.world.markShadows();
  }

  pickables() { return [...this.byId.values()]; }

  // A new block lands with a squash and a stretch (it bounces back to normal in a third of a second).
  // Only toy blocks squash (each is its own little group); returns false in Building mode.
  bounce(id, amp = 1) {
    if (this.mode !== 'blocks') return false;
    const o = this.byId.get(id);
    if (!o) return false;
    if (this.bouncing) this.bouncing();
    const base = o.userData.base || (o.userData.base = { y: o.position.y, sx: o.scale.x, sy: o.scale.y, sz: o.scale.z });
    let t = 0;
    const reset = () => { o.scale.set(base.sx, base.sy, base.sz); o.position.y = base.y; this.world.updaters.delete(fn); this.bouncing = null; };
    const fn = dt => {
      t += dt;
      const k = Math.min(1, t / 0.34);
      const sq = k < 0.35 ? 1 - 0.18 * amp * Math.sin(k / 0.35 * Math.PI / 2) : 1 + 0.1 * amp * Math.sin((k - 0.35) / 0.65 * Math.PI) * (1 - k);
      const wide = 1 + (1 - sq) * 0.5;
      o.scale.set(base.sx * wide, base.sy * sq, base.sz * wide);
      if (k >= 1) reset();
    };
    this.bouncing = reset;
    this.world.updaters.add(fn);
    return true;
  }

  // Overlapping sandy octagons make a soft, continuous path.
  drawPaths(idx) {
    const cells = [...this.pathCells].map(k => k.split(',').map(Number)).filter(([x, z]) => !idx.occ.has(key(x, z, 0)));
    if (!cells.length) return;
    const geo = PATH_GEO || (PATH_GEO = new THREE.CylinderGeometry(0.56, 0.56, 0.035, 8));
    const im = new THREE.InstancedMesh(geo, shared.path, cells.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    cells.forEach(([x, z], i) => { p.set(x + 0.5, Math.max(0, cellGround(x, z)) + 0.018, z + 0.5); m4.compose(p, q, s); im.setMatrixAt(i, m4); });
    im.receiveShadow = true;
    im.userData.isPath = true;
    this.group.add(im);
  }

  // ---------- Blocks mode ----------
  buildBlocks(idx) {
    for (const c of idx.design.cells) {
      const g = new THREE.Group();
      const m = new THREE.Mesh(formGeometry(c.form, 'blocks'), blockMaterial(c.room, c.colour));
      m.castShadow = true; m.receiveShadow = true;
      m.userData.cellId = c.id;
      g.add(m);
      accent(g, c);
      // Sticker on top, unless something sits on it.
      const covered = footprint(c).filter(p => p.level === c.level + FORMS[c.form].levels - 1).every(p => idx.occ.has(key(p.x, p.z, p.level + 1)));
      if (!covered && ROOMS[c.room]) {
        const s = new THREE.Mesh(stickerGeo, stickerMat(ROOMS[c.room].emoji));
        s.position.y = topOf(c.form) + 0.012;
        if (c.form === 'wedge') { s.position.set(-0.05, LEVEL_H * 0.5 + 0.03, 0); s.rotation.z = Math.atan2(LEVEL_H, 1); }
        if (c.form === 'curve') s.position.set(0.25, s.position.y, 0.25);
        if (c.form === 'dome') s.position.y = 0.91;
        if (c.form === 'roof') { s.position.set(0, 0.24, 0.29); s.rotation.x = -0.7; s.scale.setScalar(0.7); }
        s.userData.cellId = c.id;
        g.add(s);
      }
      placeObject(g, c, c.level === 0 ? cellGround(c.x, c.z) : 0);
      g.userData.cellId = c.id;
      this.group.add(g);
      this.byId.set(c.id, g);
    }
  }

  // ---------- Building mode ----------
  // Each room group becomes a character: its outline (maybe curved) pushed up into walls, a roof with
  // personality, its own kind of windows, a bright door, and any extras Finn has added.
  buildBuilding(idx, cut = false) {
    this.cut = cut;
    setClip(CLIP);
    const P = { glass: [], frames: [], rings: [], discs: [], pupils: [], doors: [], doorFrames: [], steps: [], legs: [] };
    this.layouts = [];
    for (const g of roomGroups(idx)) {
      const allBox = g.cells.filter(c => { const o = idx.occ.get(key(c.x, c.z, g.level)); return o && BOX.has(o.form); });
      for (const box of splitParts(allBox)) {
      const dcells = [...new Set(box.map(c => idx.occ.get(key(c.x, c.z, g.level))))];
      const style = styleOf(dcells);
      const L = layoutGroup({ room: g.room, level: g.level, cells: box }, idx, this.doors, style, { cut });
      if (!L) continue;
      this.layouts.push(L);
      const mark = this.group.children.length;
      const c0 = dcells[0];
      const colour = c0.colour || ROOMS[g.room].colour;
      const y0 = g.level * LEVEL_H + (g.level === 0 ? cellGround(box[0].x, box[0].z) : 0) + 0.004;
      const yb = y0 + L.lift;                 // where the room's floor is
      const yTop = yb + L.height;
      // Body: a solid character, or in the school day an open doll's house.
      if (cut) {
        const ob = openBody(L, y0);
        const wm = new THREE.Mesh(ob.walls, wallMaterial(g.room, c0.material, c0.colour, true));
        const fm = new THREE.Mesh(ob.floor, g.level > 0 ? seeThrough(floorMaterial(g.room, true)) : floorMaterial(g.room, true));
        wm.receiveShadow = fm.receiveShadow = true;
        this.group.add(wm, fm);
        if (L.lift) for (const q2 of perimeterPoints(L.outer, 0.62, 0.1)) P.legs.push({ x: q2[0], y: y0, z: q2[1] });
        continue;
      }
      const geo = bodyGeometry(L, y0);
      const body = new THREE.Mesh(geo, [interiorMaterial(g.room, 'double'), wallMaterial(g.room, c0.material, c0.colour, c0.material === 'glass')]);
      body.castShadow = true; body.receiveShadow = true;
      this.group.add(body);
      // The inside of the walls: a light colour, seen only from inside (Walk and Section views).
      const inner = new THREE.Mesh(openBody(L, y0, L.height).walls, interiorMaterial(g.room, 'front'));
      inner.receiveShadow = true;
      this.group.add(inner);
      this.group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), LINE_MAT));
      // Roof
      if (!L.covered) {
        if (style.roof === 'flat') this.group.add(slabFollowing(L, yTop, style.roofColour));
        else if (L.rect) this.group.add(roofObject(style.roof, L.bbox.x0, L.bbox.z0, L.bbox.x1, L.bbox.z1, yTop, style.roofColour, colour));
        else for (const c of box) this.group.add(roofObject(style.roof, c.x, c.z, c.x + 1, c.z + 1, yTop, style.roofColour, colour));
      } else {
        for (const c of box) if (!idx.occ.has(key(c.x, c.z, g.level + 1))) this.group.add(roofObject('flat', c.x, c.z, c.x + 1, c.z + 1, yTop, style.roofColour, colour));
      }
      // Windows (scaled to the wall height)
      const f = L.height / LEVEL_H;
      for (const w of L.windows) {
        const a = Math.atan2(w.nx, w.nz);
        const at = (u, y, out = 0) => ({ x: w.x + Math.cos(a) * u * 1 + w.nx * out, y, z: w.z - Math.sin(a) * u + w.nz * out, a });
        if (w.type === 'big') {
          const h = 0.42 * f, cy = yb + 0.12 * f + h / 2;
          P.glass.push({ ...at(0, cy), sx: w.w, sy: h, sz: 0.03 });
          P.frames.push({ ...at(0, cy + h / 2), sx: w.w + 0.04, sy: 0.03, sz: 0.045 }, { ...at(0, cy - h / 2), sx: w.w + 0.06, sy: 0.03, sz: 0.07 }, { ...at(0, cy), sx: 0.022, sy: h, sz: 0.04 });
        } else if (w.type === 'round' || w.type === 'eye') {
          const cy = yb + (w.type === 'eye' ? 0.52 : 0.44) * f, r = w.type === 'eye' ? 0.115 : 0.1;
          P.discs.push({ ...at(0, cy), r }); P.rings.push({ ...at(0, cy), r });
          if (w.type === 'eye') P.pupils.push({ ...at(0, cy - 0.02, 0.02), r: 0.045 });
        } else if (w.type === 'smile') {
          const cy = yb + 0.24 * f;
          for (let k = -3; k <= 3; k++) { const u = k / 3 * w.w / 2; P.glass.push({ ...at(u, cy + Math.pow(k / 3, 2) * 0.07), sx: w.w / 7 + 0.01, sy: 0.07, sz: 0.03 }); }
        } else if (w.type === 'slot') {
          const h = 0.52 * f, cy = yb + 0.1 * f + h / 2;
          P.glass.push({ ...at(0, cy), sx: 0.075, sy: h, sz: 0.03 });
          P.frames.push({ ...at(0, cy + h / 2), sx: 0.11, sy: 0.025, sz: 0.045 }, { ...at(0, cy - h / 2), sx: 0.11, sy: 0.025, sz: 0.045 });
        } else if (w.type === 'strip') {
          const cy = yb + 0.55 * f;
          P.glass.push({ ...at(0, cy), sx: w.w, sy: 0.17, sz: 0.03 });
          P.frames.push({ ...at(0, cy - 0.1), sx: w.w, sy: 0.025, sz: 0.06 });
        } else if (w.type === 'grid') {
          const cy = yb + 0.42 * f, s2 = 0.13;
          for (const [gx, gy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.glass.push({ ...at(gx * (s2 / 2 + 0.012), cy + gy * (s2 / 2 + 0.012)), sx: s2, sy: s2, sz: 0.03 });
          P.frames.push({ ...at(0, cy), sx: 0.024, sy: s2 * 2 + 0.07, sz: 0.04 }, { ...at(0, cy), sx: s2 * 2 + 0.07, sy: 0.024, sz: 0.04 });
        }
      }
      // Doors, with steps if the room stands on legs, and a beak if Finn added one.
      for (const d of L.doorPts) {
        const a = Math.atan2(d.nx, d.nz);
        P.doors.push({ x: d.x + d.nx * 0.004, y: yb + 0.25, z: d.z + d.nz * 0.004, a, colour: DOOR_ACCENT(colour) });
        P.doorFrames.push({ x: d.x, y: yb + 0.27, z: d.z, a });
        if (!d.outside) continue;
        if (L.lift) for (let k = 0; k < 2; k++) P.steps.push({ x: d.x + d.nx * (0.08 + k * 0.1), y: yb - 0.07 - k * 0.1, z: d.z + d.nz * (0.08 + k * 0.1), a, w: 0.34 });
        if (style.beak) {
          const bk = new THREE.Mesh(BEAK(), new THREE.MeshLambertMaterial({ color: shade(colour, 0.65), clippingPlanes: CLIP }));
          bk.position.set(d.x + d.nx * 0.16, yb + 0.6, d.z + d.nz * 0.16);
          bk.rotation.y = a;
          bk.castShadow = true;
          this.group.add(bk);
        }
      }
      // Legs, like a building on stilts.
      if (L.lift) {
        const per = perimeterPoints(L.outer, 0.62, 0.1);
        for (const q of per) P.legs.push({ x: q[0], y: y0, z: q[1] });
      }
      // A bay window pulled out from the wall.
      if (L.bay) {
        const a = Math.atan2(L.bay.nx, L.bay.nz);
        const bay = new THREE.Group();
        const glassBox = new THREE.Mesh(BOX1(), glassMat()); glassBox.scale.set(0.5, 0.5 * f, 0.28); glassBox.position.set(0, 0.32 * f, 0.14);
        const top = new THREE.Mesh(BOX1(), shared.frame); top.scale.set(0.58, 0.05, 0.34); top.position.set(0, 0.32 * f + 0.27 * f, 0.15);
        const bot = new THREE.Mesh(BOX1(), lam(colour)); bot.scale.set(0.58, 0.07, 0.34); bot.position.set(0, 0.32 * f - 0.28 * f, 0.15);
        bay.add(glassBox, top, bot);
        bay.position.set(L.bay.x, yb, L.bay.z); bay.rotation.y = a;
        bay.traverse(m => { if (m.isMesh) m.castShadow = true; });
        this.group.add(bay);
      }
      // Extras on the roof.
      const roofH = L.covered ? 0.05 : roofHeight(style.roof, L.bbox, L.rect);
      if (style.chimney && !L.covered) {
        const ch = new THREE.Group();
        const tube = new THREE.Mesh(CHIMNEY(), lam('#4a4e69')); tube.position.y = 0.24;
        const band = new THREE.Mesh(CHIMNEY_TOP(), lam(colour)); band.position.y = 0.46;
        ch.add(tube, band);
        ch.position.set(L.bbox.x0 + 0.24, yTop, L.bbox.z0 + 0.24);
        ch.traverse(m => { if (m.isMesh) m.castShadow = true; });
        this.group.add(ch);
      }
      if (style.flag && !L.covered) {
        const fl = new THREE.Group();
        const pole = new THREE.Mesh(POLE(), shared.frame); pole.position.y = 0.36;
        const cloth = new THREE.Mesh(FLAG(), new THREE.MeshLambertMaterial({ color: shade(colour, 0.8), side: THREE.DoubleSide, clippingPlanes: CLIP }));
        cloth.position.set(0, 0.62, 0);
        fl.add(pole, cloth);
        fl.position.set((L.bbox.x0 + L.bbox.x1) / 2, yTop + roofH - 0.02, (L.bbox.z0 + L.bbox.z1) / 2);
        fl.traverse(m => { if (m.isMesh) m.castShadow = true; });
        this.group.add(fl);
        this.flags.push(cloth);
      }
      // A courtyard closed in by the room becomes a little garden with a tree (like Townscaper).
      for (const hole of L.holes) if (!cut && openCourt(idx, hole, g.level)) this.group.add(courtyard(hole, y0));
      // A soft contact shadow under the room, so it sits on the ground whatever the sun is doing.
      if (!cut) {
        const bw = L.bbox.x1 - L.bbox.x0, bd = L.bbox.z1 - L.bbox.z0;
        const blob = new THREE.Mesh(BLOB_GEO(), blobMat());
        blob.scale.set(bw / 0.56 * 1.06, 1, bd / 0.56 * 1.06);
        blob.position.set((L.bbox.x0 + L.bbox.x1) / 2, y0 + 0.008, (L.bbox.z0 + L.bbox.z1) / 2);
        blob.renderOrder = 1;
        this.group.add(blob);
      }
      // A round sign with the room's picture high on the sunny side.
      if (g.room !== 'stairs' && style.win !== 'face' && !cut) {
        const seg = L.segs.filter(sg => sg.len > 0.35).sort((p2, q2) => (q2.n[0] * 0.6 + q2.n[1] * 0.8) - (p2.n[0] * 0.6 + p2.n[1] * 0.8))[0];
        if (seg) {
          const sx = (seg.a[0] + seg.b[0]) / 2, sz = (seg.a[1] + seg.b[1]) / 2;
          const sign = new THREE.Mesh(SIGN_GEO(), stickerMat(ROOMS[g.room].emoji));
          sign.position.set(sx + seg.n[0] * 0.02, yTop - 0.14, sz + seg.n[1] * 0.02);
          sign.rotation.y = Math.atan2(seg.n[0], seg.n[1]);
          this.group.add(sign);
        }
      }
      const ids = dcells.map(o => o.id);
      for (let k = mark; k < this.group.children.length; k++) this.group.children[k].userData.cells = ids;
      }
    }
    // Round rooms get a real door where the door map puts one.
    for (const d of this.doors.values()) {
      const c = idx.occ.get(key(d.x, d.z, d.l));
      if (!c || (c.form !== 'cylinder' && c.form !== 'dome')) continue;
      const ps = footprint(c);
      const cx = ps.reduce((a, q) => a + q.x + 0.5, 0) / ps.length, cz = ps.reduce((a, q) => a + q.z + 0.5, 0) / ps.length;
      const r = c.form === 'cylinder' ? 0.48 : 0.97;
      const ex = d.x + 0.5 + d.dx * 0.5 - cx, ez = d.z + 0.5 + d.dz * 0.5 - cz, el = Math.hypot(ex, ez) || 1;
      const x = cx + ex / el * r, z = cz + ez / el * r, a = Math.atan2(ex, ez);
      const y = d.l * LEVEL_H + (d.l === 0 ? cellGround(d.x, d.z) : 0);
      P.doors.push({ x, y: y + 0.25, z, a, colour: DOOR_ACCENT(c.colour || ROOMS[c.room].colour) });
      P.doorFrames.push({ x, y: y + 0.27, z, a });
    }
    this.instanced(P);

    // Pickable proxies for box forms (invisible), so tapping still selects the right form.
    const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
    for (const c of idx.design.cells) {
      if (BOX.has(c.form)) {
        const p = new THREE.Mesh(formGeometry(c.form, 'building'), proxyMat);
        placeObject(p, c, (c.level === 0 ? cellGround(c.x, c.z) : 0) + liftOf(c, idx));
        p.userData.cellId = c.id;
        this.group.add(p);
        this.byId.set(c.id, p);
        if (c.form === 'steps' && !cut) {
          const st = new THREE.Mesh(formGeometry('steps', 'building'), shared.stair);
          st.scale.set(0.7, 1, 0.7);
          placeObject(st, c, (c.level === 0 ? cellGround(c.x, c.z) : 0));
          st.castShadow = true;
          this.group.add(st);
        }
      } else {
        const o = this.special(c, idx);
        placeObject(o, c, c.level === 0 ? cellGround(c.x, c.z) : 0);
        o.userData.cellId = c.id;
        o.traverse(m => { m.userData.cellId = c.id; });
        this.group.add(o);
        this.byId.set(c.id, o);
      }
    }
    this.trackLanes(idx);
    this.furnish(idx);
  }

  instanced(P) {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    const make = (geo, mat, list, place, colourOf) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((it, i) => { s.set(1, 1, 1); place(it); m4.compose(p, q, s); im.setMatrixAt(i, m4); if (colourOf) im.setColorAt(i, new THREE.Color(colourOf(it))); });
      im.castShadow = true; im.receiveShadow = true;
      this.group.add(im);
    };
    const faced = it => { q.setFromAxisAngle(UP, it.a); p.set(it.x, it.y, it.z); };
    make(BOX1(), glassMat(), P.glass, it => { faced(it); s.set(it.sx, it.sy, it.sz); });
    make(BOX1(), shared.frame, P.frames, it => { faced(it); s.set(it.sx, it.sy, it.sz); });
    make(DISC(), glassMat(), P.discs, it => { faced(it); s.set(it.r / 0.1, it.r / 0.1, 1); });
    make(RING(), shared.frame, P.rings, it => { faced(it); s.set(it.r / 0.1, it.r / 0.1, 1); });
    make(DISC(), shared.dark, P.pupils, it => { faced(it); s.set(it.r / 0.1, it.r / 0.1, 1.2); });
    make(BOX1(), new THREE.MeshLambertMaterial({ color: '#ffffff', clippingPlanes: CLIP }), P.doors, it => { faced(it); s.set(0.3, 0.5, 0.035); }, it => it.colour);
    make(DOORFRAME(), shared.frame, P.doorFrames, it => { faced(it); p.y -= 0.27; });
    make(BOX1(), shared.frame, P.steps, it => { faced(it); s.set(it.w, 0.05, 0.12); });
    make(LEG(), shared.dark, P.legs, it => { q.identity(); p.set(it.x, it.y, it.z); });
  }

  // Forms that keep their own shape in Building mode, with details for the room.
  special(c, idx) {
    const g = new THREE.Group();
    const R = ROOMS[c.room];
    const add = (geo, mat, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; g.add(m); return m; };
    if (c.room === 'pool') {
      add(formGeometry('slab', 'building'), new THREE.MeshLambertMaterial({ color: '#e9e5dc', clippingPlanes: CLIP }));
      const w = add(new THREE.BoxGeometry(1.84, 0.05, 0.84), shared.water, false);
      w.position.y = 0.2;
      for (let i = -1; i <= 1; i += 2) { const lane = add(new THREE.BoxGeometry(1.7, 0.01, 0.025), new THREE.MeshBasicMaterial({ color: '#ffffff', clippingPlanes: CLIP }), false); lane.position.set(0, 0.226, i * 0.14); }
      return g;
    }
    if (c.room === 'bridge') {
      const deck = add(new THREE.BoxGeometry(2, 0.08, 0.8), shared.timber); deck.position.y = 0.18;
      for (const s of [-1, 1]) { const r = add(new THREE.BoxGeometry(2, 0.04, 0.04), shared.rail); r.position.set(0, 0.42, s * 0.38); for (let i = 0; i < 5; i++) { const post = add(new THREE.BoxGeometry(0.04, 0.22, 0.04), shared.rail); post.position.set(-0.9 + i * 0.45, 0.31, s * 0.38); } }
      return g;
    }
    if (c.form === 'pad') {
      const st = m => (this.cut && c.level > 0 ? seeThrough(m) : m);
      if (c.room === 'track') { add(formGeometry('pad', 'building'), st(shared.track)); }
      else if (c.room === 'garden') {
        add(formGeometry('pad', 'building'), st(shared.soil));
        for (let i = 0; i < 4; i++) { const b = add(new THREE.SphereGeometry(0.11, 8, 6), shared.leaf); b.position.set((i % 2 - 0.5) * 0.45, 0.12, (Math.floor(i / 2) - 0.5) * 0.45); b.scale.y = 0.8; }
      } else add(formGeometry('pad', 'building'), st(shared.timber));
      return g;
    }
    if (c.room === 'slide' || c.form === 'wedge') {
      add(formGeometry('wedge', 'building'), new THREE.MeshLambertMaterial({ color: c.colour || R.colour, clippingPlanes: CLIP }));
      const len = Math.hypot(1, LEVEL_H);
      for (const s of [-1, 1]) { const r = add(new THREE.BoxGeometry(len, 0.07, 0.05), shared.rail); r.position.set(0, LEVEL_H / 2 + 0.05, s * 0.45); r.rotation.z = Math.atan2(LEVEL_H, 1); }
      return g;
    }
    if (c.form === 'roof') { add(formGeometry('roof', 'building'), new THREE.MeshLambertMaterial({ color: '#b5523b', clippingPlanes: CLIP })); return g; }

    const aquarium = c.room === 'aquarium';
    const mat = aquarium ? (AQUA || (AQUA = KEEP.keep(new THREE.MeshLambertMaterial({ color: '#7fd3d0', emissive: '#0d5f63', emissiveIntensity: 0.3, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, clippingPlanes: CLIP })))) : materialFor(c, 'building');
    const body = add(formGeometry(c.form, 'building'), this.cut ? seeThrough(mat) : mat);
    if (this.cut) body.castShadow = false;
    if (aquarium) {
      body.renderOrder = 4;
      // Water and fish inside the glass.
      const [bw, bd] = formBox(c.form);
      const n = Math.min(14, 5 * footprint(c).length);
      const fishes = ['🐠', '🐟', '🐡', '🐠', '🦀', '🐙'];
      for (let i = 0; i < n; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: fishTexture(fishes[i % fishes.length]), transparent: true, depthWrite: false }));
        sp.scale.setScalar(0.12 + (i % 3) * 0.03);
        sp.renderOrder = 5;
        g.add(sp);
        this.fish.push({ sp, c, bw, bd, ph: i * 1.7, r: 0.25 + (i % 4) * 0.12, h: 0.18 + ((i * 7) % 5) * 0.11, sp2: 0.4 + (i % 3) * 0.2 });
      }
    } else if (c.form === 'cylinder') {
      const band = add(new THREE.CylinderGeometry(0.475, 0.475, 0.3, 32, 1, true), shared.glass, false);
      band.position.y = 0.43;
      const cap = add(new THREE.CylinderGeometry(0.58, 0.58, 0.05, 32), shared.frame);
      cap.position.y = LEVEL_H;
    } else if (c.form === 'dome') {
      const ring = add(new THREE.TorusGeometry(0.97, 0.04, 6, 40), shared.parapet, false);
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.02;
      const ocu = add(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 20), shared.glass, false);
      ocu.position.y = 0.88;
    } else if (c.form === 'curve' || c.form === 'arch') {
      // A glass strip of windows along the outer face.
      const strip = add(formGeometry(c.form, 'building'), shared.glass, false);
      strip.scale.set(1.004, 0.32, 1.004);
      strip.position.y = 0.3;
    }
    return g;
  }

  // White lane lines joining neighbouring track tiles, so the loop reads as one track.
  trackLanes(idx) {
    const lines = [];
    for (const c of idx.design.cells) {
      if (c.room !== 'track') continue;
      for (const [dx, dz] of DIRS) {
        const n = idx.occ.get(key(c.x + dx, c.z + dz, c.level));
        if (n && n.room === 'track') lines.push({ c, dx, dz });
      }
    }
    if (!lines.length) return;
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.01, 0.05), shared.line, lines.length * 2);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    let i = 0;
    for (const { c, dx, dz } of lines) {
      const y = c.level * LEVEL_H + (c.level === 0 ? cellGround(c.x, c.z) : 0) + 0.066;
      q.setFromAxisAngle(UP, dx !== 0 ? 0 : Math.PI / 2);
      for (const off of [-0.18, 0.18]) {
        const ox = dx !== 0 ? 0 : off, oz = dx !== 0 ? off : 0;
        p.set(c.x + 0.5 + dx * 0.25 + ox, y, c.z + 0.5 + dz * 0.25 + oz);
        m4.compose(p, q, s.set(0.56, 1, 1));
        im.setMatrixAt(i++, m4);
      }
    }
    this.group.add(im);
  }

  // Furniture inside rooms (Kenney Furniture Kit, CC0), instanced. Loaded lazily the first time.
  async furnish(idx) {
    const gen = this.gen;
    const F = 'assets/models/furniture/';
    // [model, height, u, v, turn] per cell, in cell coordinates (0..1), turn in quarter turns.
    const PLAN = {
      classroom: [['desk', 0.24, 0.3, 0.42, 2], ['desk', 0.24, 0.7, 0.42, 2], ['chair', 0.28, 0.3, 0.66, 2], ['chair', 0.28, 0.7, 0.66, 2]],
      library: [['bookcaseOpen', 0.46, 0.5, 0.14, 0], ['rugRound', 0.012, 0.5, 0.6, 0], ['books', 0.06, 0.55, 0.6, 1]],
      lunch: [['table', 0.22, 0.5, 0.5, 0], ['bench', 0.13, 0.5, 0.24, 0], ['bench', 0.13, 0.5, 0.76, 0]],
      yoga: [['rugRound', 0.012, 0.5, 0.5, 0], ['plantSmall1', 0.2, 0.18, 0.18, 0]],
      hall: [['bench', 0.13, 0.5, 0.15, 0]],
      toilets: [['toilet', 0.24, 0.3, 0.2, 0], ['toilet', 0.24, 0.7, 0.2, 0]],
      art: [['tableRound', 0.22, 0.5, 0.5, 0], ['chair', 0.28, 0.25, 0.5, 1], ['chair', 0.28, 0.75, 0.5, 3]],
      music: [['loungeSofa', 0.22, 0.5, 0.2, 0], ['pottedPlant', 0.24, 0.82, 0.8, 0]],
      changing: [['bench', 0.13, 0.5, 0.2, 0]],
    };
    const want = new Map();     // model -> [{ x, y, z, turn }]
    const height = {};
    for (const [k, c] of idx.occ) {
      const plan = PLAN[c.room];
      if (!plan || !isRoomCell(c) || c.form === 'dome' && false) continue;
      const [x, z, l] = k.split(',').map(Number);
      if (FORMS[c.form].levels > 1 && l > c.level) continue;
      const y = l * LEVEL_H + (l === 0 ? cellGround(x, z) : 0) + 0.014 + liftOf(c, idx);
      for (const [model, hgt, u, v, turn] of plan) {
        if (!want.has(model)) want.set(model, []);
        height[model] = hgt;
        want.get(model).push({ x: x + u, y, z: z + v, turn });
      }
    }
    if (!want.size) return;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3();
    for (const [model, list] of want) {
      let parts;
      try { parts = await staticParts(F + model + '.glb', height[model], { clippingPlanes: CLIP, maxW: model.startsWith('rug') ? 0.6 : 0.85 }); } catch (e) { continue; }
      if (gen !== this.gen) return;      // the design changed while loading
      for (const part of parts) {
        const im = new THREE.InstancedMesh(part.geometry, part.material, list.length);
        list.forEach((it, i) => { q.setFromAxisAngle(UP, -it.turn * Math.PI / 2); pos.set(it.x, it.y, it.z); m4.compose(pos, q, sc); im.setMatrixAt(i, m4); });
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
        im.castShadow = false;
        im.receiveShadow = true;
        this.group.add(im);
        this.world.markShadows();
      }
    }
  }

  animate(dt, t) {
    for (const [i, fl] of this.flags.entries()) { fl.rotation.y = Math.sin(t * 3 + i) * 0.35; fl.scale.x = 1 + Math.sin(t * 5 + i) * 0.06; }
    for (const f of this.fish) {
      const c = f.c;
      const odd = (c.rot & 1) === 1;
      const w = odd ? f.bd : f.bw, d = odd ? f.bw : f.bd;
      const a = t * f.sp2 + f.ph;
      let fx, fz;
      if (c.form === 'curve') {
        const cs = [[0, 0], [2, 0], [2, 2], [0, 2]][c.rot & 3];
        const aa = (c.rot & 3) * Math.PI / 2 + (Math.sin(a * 0.5) * 0.5 + 0.5) * Math.PI / 2;
        const rr = 1.5 + Math.sin(a * 1.3) * 0.25;
        fx = cs[0] - w / 2 + Math.cos(aa) * rr; fz = cs[1] - d / 2 + Math.sin(aa) * rr;
      } else {
        fx = Math.sin(a) * (w / 2 - 0.2) * 0.9; fz = Math.cos(a * 0.7) * (d / 2 - 0.2) * 0.8;
      }
      // Sprites live in the rotated group, so undo the group's turn.
      const r = (c.rot & 3) * Math.PI / 2;
      f.sp.position.set(fx * Math.cos(r) - fz * Math.sin(r), f.h + Math.sin(a * 2) * 0.03, fx * Math.sin(r) + fz * Math.cos(r));
      f.sp.material.rotation = Math.cos(a) > 0 ? 0 : 0;
    }
  }
}

// One wall face of a cell, optionally with an opening { u0, u1, ya, yb } (a door when ya is the floor).
function wallQuads(acc, x, z, dx, dz, inset, y0, y1, hole, inward) {
  const cx = x + 0.5 + dx * (0.5 - inset), cz = z + 0.5 + dz * (0.5 - inset);
  const tx = -dz, tz = dx;
  const P = (u, y) => [cx + tx * (u - 0.5), y, cz + tz * (u - 0.5)];
  const n = inward ? [-dx, 0, -dz] : [dx, 0, dz];
  const rect = (u0, u1, ya, yb) => { if (yb - ya > 0.001 && u1 - u0 > 0.001) quad(acc, P(u0, ya), P(u1, ya), P(u1, yb), P(u0, yb), n, [u0, (ya - y0) / LEVEL_H, u1, (yb - y0) / LEVEL_H]); };
  if (!hole) { rect(0, 1, y0, y1); return; }
  const yb = Math.min(hole.yb, y1);
  rect(0, hole.u0, y0, y1);
  rect(hole.u1, 1, y0, y1);
  rect(hole.u0, hole.u1, y0, hole.ya);
  rect(hole.u0, hole.u1, yb, y1);
}
// The thickness of the wall inside an opening, so it looks solid rather than paper thin.
function reveals(acc, x, z, dx, dz, hole, depth) {
  const tx = -dz, tz = dx;
  const at = (u, y, inset) => [x + 0.5 + dx * (0.5 - inset) + tx * (u - 0.5), y, z + 0.5 + dz * (0.5 - inset) + tz * (u - 0.5)];
  const side = (u, sgn) => quad(acc, at(u, hole.ya, 0), at(u, hole.ya, depth), at(u, hole.yb, depth), at(u, hole.yb, 0), [tx * sgn, 0, tz * sgn], [0, 0, 1, 1]);
  side(hole.u0, 1); side(hole.u1, -1);
  quad(acc, at(hole.u0, hole.yb, 0), at(hole.u1, hole.yb, 0), at(hole.u1, hole.yb, depth), at(hole.u0, hole.yb, depth), [0, -1, 0], [0, 0, 1, 1]);
  if (hole.ya > 0.0001 && Math.abs(hole.ya % LEVEL_H) > 0.001) quad(acc, at(hole.u0, hole.ya, 0), at(hole.u1, hole.ya, 0), at(hole.u1, hole.ya, depth), at(hole.u0, hole.ya, depth), [0, 1, 0], [0, 0, 1, 1]);
}

function flatQuad(acc, x, z, y, dir) {
  quad(acc, [x, y, z + 1], [x + 1, y, z + 1], [x + 1, y, z], [x, y, z], [0, dir, 0], [0, 0, 1, 1]);
}

function quad(acc, a, b, c, d, n, [u0, v0, u1, v1]) {
  // Make the winding match the wanted normal.
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
  const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  const flip = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0;
  const V = flip ? [a, d, c, b] : [a, b, c, d];
  const T = flip ? [[u0, v0], [u0, v1], [u1, v1], [u1, v0]] : [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  for (const i of [0, 1, 2, 0, 2, 3]) { acc.pos.push(...V[i]); acc.nor.push(...n); acc.uv.push(...T[i]); }
}

function mergeBoxes(geos) {
  const pos = [], nor = [];
  for (const g of geos) {
    const ng = g.index ? g.toNonIndexed() : g;
    pos.push(...ng.attributes.position.array); nor.push(...ng.attributes.normal.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return out;
}

export { mix };

let AQUA = null;
const stCache = new Map();
// A see-through copy of a material, for the doll's-house cutaway during the school day.
function seeThrough(m) {
  if (!stCache.has(m.uuid)) {
    const c = m.clone();
    c.transparent = true; c.opacity = Math.min(m.opacity ?? 1, 0.38); c.depthWrite = false;
    stCache.set(m.uuid, KEEP.keep(c));
  }
  return stCache.get(m.uuid);
}
