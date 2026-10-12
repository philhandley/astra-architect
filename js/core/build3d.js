// Turns the design into 3D, in Blocks mode (toy blocks with room stickers) or Building mode
// (merged walls with doors, windows and roofs, plus pool water, slide rails, track lanes and fish).
import * as THREE from 'three';
import { FORMS, ROOMS, LEVEL_H, mix } from './catalogue.js';
import { key, footprint, roomGroups, DIRS } from './design.js';
import { BOX, isRoomCell, computeDoors, wedgeDir } from './arch.js';
import { cellGround } from './site.js';
import { formGeometry, placeObject, materialFor, wallMaterial, interiorMaterial, floorMaterial, shared, formBox, blockMaterial } from './forms3d.js';
import { emojiImage } from './emoji.js';
import { CLIP } from './scene.js';

const UP = new THREE.Vector3(0, 1, 0);

// ---------- Emoji stickers ----------
const stickerTex = new Map();
function emojiTexture(ch) {
  if (stickerTex.has(ch)) return stickerTex.get(ch);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(255,255,255,0.92)';
  x.beginPath(); x.arc(64, 64, 60, 0, Math.PI * 2); x.fill();
  emojiImage(ch).then(img => { if (img) { x.drawImage(img, 22, 22, 84, 84); t.needsUpdate = true; } });
  stickerTex.set(ch, t);
  return t;
}
const stickerGeo = new THREE.CircleGeometry(0.26, 24).rotateX(-Math.PI / 2);
const stickerMats = new Map();
function stickerMat(ch) {
  if (!stickerMats.has(ch)) stickerMats.set(ch, new THREE.MeshBasicMaterial({ map: emojiTexture(ch), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, clippingPlanes: CLIP }));
  return stickerMats.get(ch);
}
export function fishTexture(ch) { return emojiTexture(ch); }

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
    this.byId = new Map();          // design id -> Object3D (for picking and highlighting)
    world.updaters.add((dt, t) => this.animate(dt, t));
  }

  clear() {
    for (const o of [...this.group.children]) {
      this.group.remove(o);
      o.traverse(m => { if (m.isMesh && m.userData.ownGeo) m.geometry.dispose(); });
    }
    this.byId.clear();
    this.fish = [];
  }

  sync(idx, mode = this.mode) {
    this.mode = mode;
    this.clear();
    this.idx = idx;
    this.doors = computeDoors(idx);
    if (mode === 'blocks') this.buildBlocks(idx);
    else this.buildBuilding(idx, mode === 'cutaway');
  }

  pickables() { return [...this.byId.values()]; }

  // ---------- Blocks mode ----------
  buildBlocks(idx) {
    for (const c of idx.design.cells) {
      const g = new THREE.Group();
      const m = new THREE.Mesh(formGeometry(c.form, 'blocks'), blockMaterial(c.room));
      m.castShadow = true; m.receiveShadow = true;
      m.userData.cellId = c.id;
      g.add(m);
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
  buildBuilding(idx, cut = false) {
    this.cut = cut;
    const acc = new Map();      // material key -> { mat, pos, nor, uv }
    const quadsFor = (mat, k) => { if (!acc.has(k)) acc.set(k, { mat, pos: [], nor: [], uv: [] }); return acc.get(k); };
    const windows = [], doorFrames = [], parapets = [], holds = [];
    const doors = this.doors;

    // Merged walls for box-shaped rooms.
    for (const [k, c] of idx.occ) {
      if (!BOX.has(c.form)) continue;
      const [x, z, l] = k.split(',').map(Number);
      const g0 = l === 0 ? cellGround(x, z) : 0;
      const y0 = l * LEVEL_H + g0, y1 = (l + 1) * LEVEL_H + g0;
      const ext = quadsFor(wallMaterial(c.room, c.material), `w${c.room}:${c.material || 'colour'}`);
      const int = quadsFor(interiorMaterial(c.room), `i${c.room}`);
      const glassWall = c.material === 'glass';
      for (const [dx, dz] of DIRS) {
        const n = idx.occ.get(key(x + dx, z + dz, l));
        if (n && BOX.has(n.form) && n.room === c.room) continue;
        const internal = n && BOX.has(n.form);
        const door = doors.has(`${x},${z},${l},${dx},${dz}`) || (n && isRoomCell(n) && n.room !== c.room);
        const hole = door ? { u0: 0.31, u1: 0.69, y: y0 + 0.5 } : null;
        const yw = cut ? y0 + 0.26 : y1;
        const holeC = hole && cut ? null : hole;
        wallQuads(int, x, z, dx, dz, 0.035, y0, yw, cut ? (door ? { u0: 0.31, u1: 0.69, y: yw } : null) : holeC, true);
        if (!internal) {
          wallQuads(ext, x, z, dx, dz, 0, y0, yw, cut ? (door ? { u0: 0.31, u1: 0.69, y: yw } : null) : holeC, false);
          if (door) doorFrames.push({ x, z, dx, dz, y: y0, room: c.room });
          else if (!glassWall) windows.push({ x, z, dx, dz, y: y0 + 0.43, wide: c.room === 'classroom' || c.room === 'art' });
          if (c.room === 'climbing') holds.push({ x, z, dx, dz, y0 });
        }
      }
      const up = idx.occ.get(key(x, z, l + 1));
      const upBox = up && BOX.has(up.form);
      // Ceiling (inside) and roof (outside).
      if (!cut) flatQuad(int, x, z, y1 - 0.012, -1);
      if (!upBox && !cut) {
        const roofMat = c.material === 'grass' ? wallMaterial(c.room, 'grass') : shared.roof;
        flatQuad(quadsFor(roofMat, c.material === 'grass' ? 'roofgrass' : 'roof'), x, z, y1, 1);
        if (!up) for (const [dx, dz] of DIRS) {
          const n = idx.occ.get(key(x + dx, z + dz, l));
          if (!(n && BOX.has(n.form))) parapets.push({ x, z, dx, dz, y: y1 });
        }
      }
      // Floor (inside), and an underside where it hangs out over nothing.
      if (cut && l > 0) flatQuad(quadsFor(seeThrough(floorMaterial(c.room)), `ft${c.room}`), x, z, y0 + 0.012, 1);
      else flatQuad(quadsFor(floorMaterial(c.room), `f${c.room}`), x, z, y0 + 0.012, 1);
      if (l > 0) {
        const below = idx.occ.get(key(x, z, l - 1));
        if (!(below && BOX.has(below.form))) flatQuad(ext, x, z, y0, -1);
      }
      if (c.form === 'steps' || c.room === 'stairs') {
        const st = new THREE.Mesh(formGeometry('steps', 'building'), shared.stair);
        st.scale.set(0.7, 1, 0.7);
        st.position.set(x + 0.5, y0, z + 0.5);
        st.rotation.y = -(c.rot & 3) * Math.PI / 2;
        st.castShadow = true;
        this.group.add(st);
      }
    }
    for (const { mat, pos, nor, uv } of acc.values()) {
      if (!pos.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true; m.receiveShadow = true;
      m.userData.ownGeo = true;
      this.group.add(m);
    }
    this.instanced(windows, doorFrames, parapets, holds);

    // Pickable proxies for box forms (invisible), so tapping still selects the right form.
    const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
    for (const c of idx.design.cells) {
      if (BOX.has(c.form)) {
        const p = new THREE.Mesh(formGeometry(c.form, 'building'), proxyMat);
        placeObject(p, c, c.level === 0 ? cellGround(c.x, c.z) : 0);
        p.userData.cellId = c.id;
        this.group.add(p);
        this.byId.set(c.id, p);
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
  }

  instanced(windows, doorFrames, parapets, holds) { // eslint-disable-line
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    const face = (it, out) => { const a = Math.atan2(it.dx, it.dz); q.setFromAxisAngle(UP, a); p.set(it.x + 0.5 + it.dx * (0.5 + out), it.y, it.z + 0.5 + it.dz * (0.5 + out)); };
    if (this.cut) { windows = []; doorFrames = []; parapets = []; }
    if (windows.length) {
      const glass = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.07), shared.glass, windows.length);
      const sill = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.04, 0.1), shared.frame, windows.length);
      windows.forEach((w, i) => {
        face(w, -0.017);
        const ww = w.wide ? 0.74 : 0.5;
        m4.compose(p, q, s.set(ww, 0.34, 1)); glass.setMatrixAt(i, m4);
        p.y -= 0.19; m4.compose(p, q, s.set(ww + 0.06, 1, 1)); sill.setMatrixAt(i, m4);
      });
      this.group.add(glass, sill);
    }
    if (doorFrames.length) {
      const fg = new THREE.BufferGeometry();
      const parts = [new THREE.BoxGeometry(0.05, 0.54, 0.09).translate(-0.215, 0.27, 0), new THREE.BoxGeometry(0.05, 0.54, 0.09).translate(0.215, 0.27, 0), new THREE.BoxGeometry(0.48, 0.06, 0.09).translate(0, 0.53, 0)];
      const merged = mergeBoxes(parts);
      fg.copy(merged);
      const frames = new THREE.InstancedMesh(fg, new THREE.MeshLambertMaterial({ color: '#ffffff', clippingPlanes: CLIP }), doorFrames.length);
      doorFrames.forEach((d, i) => { face(d, 0); m4.compose(p, q, s.set(1, 1, 1)); frames.setMatrixAt(i, m4); frames.setColorAt(i, new THREE.Color(ROOMS[d.room].colour)); });
      frames.castShadow = true;
      this.group.add(frames);
    }
    if (parapets.length) {
      const par = new THREE.InstancedMesh(new THREE.BoxGeometry(1.0, 0.07, 0.06), shared.parapet, parapets.length);
      parapets.forEach((r, i) => { const a = Math.atan2(r.dx, r.dz); q.setFromAxisAngle(UP, a); p.set(r.x + 0.5 + r.dx * 0.47, r.y + 0.035, r.z + 0.5 + r.dz * 0.47); m4.compose(p, q, s.set(1, 1, 1)); par.setMatrixAt(i, m4); });
      par.castShadow = true;
      this.group.add(par);
    }
    if (holds.length) {
      const n = holds.length * 9;
      const hm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshLambertMaterial({ clippingPlanes: CLIP }), n);
      const cols = ['#e63946', '#2a9d8f', '#f4a261', '#457b9d', '#8ac926'];
      let i = 0;
      for (const h of holds) for (let k = 0; k < 9; k++) {
        const u = ((k * 37) % 9) / 9 - 0.42, v = (k / 9) * 0.7 + 0.06;
        const t = [-h.dz, h.dx];
        p.set(h.x + 0.5 + h.dx * 0.51 + t[0] * u, h.y0 + v, h.z + 0.5 + h.dz * 0.51 + t[1] * u);
        m4.compose(p, q.identity(), s.set(1, 1, 1)); hm.setMatrixAt(i, m4); hm.setColorAt(i, new THREE.Color(cols[(k + i) % cols.length])); i++;
      }
      this.group.add(hm);
    }
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
      add(formGeometry('wedge', 'building'), new THREE.MeshLambertMaterial({ color: R.colour, clippingPlanes: CLIP }));
      const len = Math.hypot(1, LEVEL_H);
      for (const s of [-1, 1]) { const r = add(new THREE.BoxGeometry(len, 0.07, 0.05), shared.rail); r.position.set(0, LEVEL_H / 2 + 0.05, s * 0.45); r.rotation.z = Math.atan2(LEVEL_H, 1); }
      return g;
    }
    if (c.form === 'roof') { add(formGeometry('roof', 'building'), new THREE.MeshLambertMaterial({ color: '#b5523b', clippingPlanes: CLIP })); return g; }

    const aquarium = c.room === 'aquarium';
    const mat = aquarium ? new THREE.MeshLambertMaterial({ color: '#7fd3d0', emissive: '#0d5f63', emissiveIntensity: 0.3, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, clippingPlanes: CLIP }) : materialFor(c, 'building');
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
        sp.scale.setScalar(0.17 + (i % 3) * 0.04);
        sp.renderOrder = 5;
        g.add(sp);
        this.fish.push({ sp, c, bw, bd, ph: i * 1.7, r: 0.25 + (i % 4) * 0.12, h: 0.18 + ((i * 7) % 5) * 0.11, sp2: 0.4 + (i % 3) * 0.2 });
      }
    } else if (c.form === 'cylinder') {
      const band = add(new THREE.CylinderGeometry(0.475, 0.475, 0.3, 32, 1, true), shared.glass, false);
      band.position.y = 0.43;
      const cap = add(new THREE.CylinderGeometry(0.49, 0.49, 0.05, 32), shared.parapet);
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

  animate(dt, t) {
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

// One wall face of a cell, optionally with a door-shaped hole. inset moves it into the cell.
function wallQuads(acc, x, z, dx, dz, inset, y0, y1, hole, inward) {
  const cx = x + 0.5 + dx * (0.5 - inset), cz = z + 0.5 + dz * (0.5 - inset);
  const tx = -dz, tz = dx;
  const P = (u, y) => [cx + tx * (u - 0.5), y, cz + tz * (u - 0.5)];
  const n = inward ? [-dx, 0, -dz] : [dx, 0, dz];
  const rect = (u0, u1, ya, yb) => quad(acc, P(u0, ya), P(u1, ya), P(u1, yb), P(u0, yb), n, [u0, (ya - y0) / LEVEL_H, u1, (yb - y0) / LEVEL_H]);
  if (!hole) { rect(0, 1, y0, y1); return; }
  rect(0, hole.u0, y0, y1);
  rect(hole.u1, 1, y0, y1);
  rect(hole.u0, hole.u1, hole.y, y1);
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

const stCache = new Map();
// A see-through copy of a material, for the doll's-house cutaway during the school day.
function seeThrough(m) {
  if (!stCache.has(m.uuid)) {
    const c = m.clone();
    c.transparent = true; c.opacity = Math.min(m.opacity ?? 1, 0.38); c.depthWrite = false;
    stCache.set(m.uuid, c);
  }
  return stCache.get(m.uuid);
}
