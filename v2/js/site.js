// Finn's site as a clean model: pale meadow, sandy beach, soft blue sea, round trees and a grid on the land
// he can build on. The data comes from his painted map (../assets/site/site.json, 60 x 42 small cells);
// one grid square here is 3 x 3 of those cells, the size of one wooden block.
import * as THREE from 'three';

export const GRID = { w: 20, d: 14, k: 3 };
const EXAG = 2.0;                       // hills a little taller than life, so the site reads as a model
let S = null;

export async function loadSite() {
  if (S) return S;
  const s = await (await fetch('../assets/site/site.json')).json();
  const hw = s.w * s.res + 1, hd = s.d * s.res + 1;
  const heights = new Float32Array(s.heights.length);
  for (let i = 0; i < heights.length; i++) heights[i] = s.heights[i] / 100;
  S = { raw: s, hw, hd, heights, sea: s.seaLevel * EXAG / GRID.k, waterfall: [s.waterfall[0] / GRID.k, s.waterfall[1] / GRID.k], gate: [Math.floor(s.gate[0] / GRID.k), Math.floor(s.gate[1] / GRID.k)] };
  // Each square: what it mostly is, whether you can build on it, and the height a building would stand at.
  S.squares = [];
  for (let sz = 0; sz < GRID.d; sz++) {
    const row = [];
    for (let sx = 0; sx < GRID.w; sx++) {
      const cells = [];
      for (let j = 0; j < GRID.k; j++) for (let i = 0; i < GRID.k; i++) cells.push(s.zones[sz * GRID.k + j][sx * GRID.k + i]);
      const n = ch => cells.filter(c => ch.includes(c)).length;
      let lo = Infinity, hi = -Infinity;
      for (let b = 0; b <= 6; b++) for (let a = 0; a <= 6; a++) { const hgt = groundAt(sx + a / 6, sz + b / 6); lo = Math.min(lo, hgt); hi = Math.max(hi, hgt); }
      let zone = '.', build = false, base = 0;
      if (n('mb') >= 5) { zone = n('m') >= n('b') ? 'meadow' : 'beach'; build = true; base = 0; }
      else if (n('f') >= 5 && hi - lo <= 0.32) { zone = 'clearing'; build = true; base = Math.max(0, hi); }
      else if (n('wpr') >= 5) zone = 'water';
      else if (n('c') >= 4) zone = 'rocks';
      else zone = 'forest';
      row.push({ zone, build, base, lo });
    }
    S.squares.push(row);
  }
  return S;
}
export const site = () => S;
export const square = (x, z) => (S && x >= 0 && z >= 0 && x < GRID.w && z < GRID.d ? S.squares[z][x] : null);

// Ground height (world units) at a world point, from the painted map's height grid.
export function groundAt(wx, wz) {
  const { hw, hd, heights } = S, res = S.raw.res;
  const fx = Math.min(Math.max(wx * GRID.k * res, 0), hw - 1.001), fz = Math.min(Math.max(wz * GRID.k * res, 0), hd - 1.001);
  const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
  const h = (a, b) => heights[b * hw + a];
  const v = (h(i, j) * (1 - tx) + h(i + 1, j) * tx) * (1 - tz) + (h(i, j + 1) * (1 - tx) + h(i + 1, j + 1) * tx) * tz;
  return v * EXAG / GRID.k;
}

const ZONE_COL = { m: '#cfe39c', b: '#f0e2c0', f: '#a8cc83', c: '#d4d0c6', w: '#93cbd9', p: '#93cbd9', r: '#93cbd9' };

export function buildSite(world) {
  const s = S.raw, group = new THREE.Group();
  group.name = 'site';

  // Ground colours, softly blended, painted once onto a canvas.
  const px = 16, cv = document.createElement('canvas');
  cv.width = s.w * px; cv.height = s.d * px;
  const g = cv.getContext('2d');
  for (let z = 0; z < s.d; z++) for (let x = 0; x < s.w; x++) { g.fillStyle = ZONE_COL[s.zones[z][x]] || '#cfe39c'; g.fillRect(x * px, z * px, px, px); }
  const soft = document.createElement('canvas'); soft.width = cv.width; soft.height = cv.height;
  const sg = soft.getContext('2d');
  sg.filter = 'blur(9px)'; sg.drawImage(cv, 0, 0); sg.filter = 'none';
  // The buildable meadow is a shade lighter, like a lawn that has been mown.
  sg.fillStyle = 'rgba(255,255,240,0.18)';
  for (let z = 0; z < GRID.d; z++) for (let x = 0; x < GRID.w; x++) if (S.squares[z][x].build && S.squares[z][x].zone !== 'clearing') sg.fillRect(x * px * GRID.k, z * px * GRID.k, px * GRID.k, px * GRID.k);
  const tex = new THREE.CanvasTexture(soft);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  // Terrain from the height grid.
  const { hw, hd, heights } = S, res = s.res, k = GRID.k;
  const pos = new Float32Array(hw * hd * 3), uv = new Float32Array(hw * hd * 2), idx = [];
  for (let j = 0; j < hd; j++) for (let i = 0; i < hw; i++) {
    const n = j * hw + i;
    pos[n * 3] = i / res / k; pos[n * 3 + 1] = heights[n] * EXAG / k; pos[n * 3 + 2] = j / res / k;
    uv[n * 2] = i / (hw - 1); uv[n * 2 + 1] = 1 - j / (hd - 1);
  }
  for (let j = 0; j < hd - 1; j++) for (let i = 0; i < hw - 1; i++) { const a = j * hw + i, b = a + 1, c = a + hw, d = c + 1; idx.push(a, c, b, b, c, d); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex }));
  ground.receiveShadow = true; ground.name = 'ground';
  group.add(ground);

  // Sea and the waterfall pool: one calm, pale blue sheet.
  const W = s.w / k, D = s.d / k;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#9fd4e4' }));
  water.position.set(W / 2, S.sea + 0.02, D / 2); water.receiveShadow = true;
  group.add(water);

  // The model's base: off-white sides down to a board, like an architect's site model.
  group.add(plinth(W, D));

  // The waterfall: water running down the cliff, foam and ripples.
  const falls = waterfall();
  group.add(falls);
  world.updaters.add(dt => falls.userData.update(dt));

  // Round trees on the forest, each a ball on a stick.
  const trees = forestTrees();
  group.add(trees.mesh, trees.trunks);

  // The grid, on the land you can build on.
  const lines = [];
  for (let z = 0; z < GRID.d; z++) for (let x = 0; x < GRID.w; x++) {
    const q = S.squares[z][x];
    if (!q.build) continue;
    const y = q.base + 0.015;
    lines.push(x, y, z, x + 1, y, z, x + 1, y, z, x + 1, y, z + 1, x + 1, y, z + 1, x, y, z + 1, x, y, z + 1, x, y, z);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  const grid = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false }));
  grid.renderOrder = 2;
  group.add(grid);

  world.scene.add(group);
  return { group, ground, water, grid, trees,
    setGridStrong(on) { grid.material.opacity = on ? 0.85 : 0.0; grid.visible = on; },
    // Trees step out of the way of buildings.
    clearTrees(occupied) {
      const m = new THREE.Matrix4();
      trees.list.forEach((t, i) => {
        const hide = occupied.has(`${t.sx},${t.sz}`);
        m.compose(t.p, t.q, hide ? new THREE.Vector3(0, 0, 0) : t.s);
        trees.mesh.setMatrixAt(i, m);
        m.compose(t.tp, t.q, hide ? new THREE.Vector3(0, 0, 0) : t.ts);
        trees.trunks.setMatrixAt(i, m);
      });
      trees.mesh.instanceMatrix.needsUpdate = true; trees.trunks.instanceMatrix.needsUpdate = true;
    },
  };
}

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export const TREE_GREENS = ['#7db45a', '#8fc263', '#6ba553', '#9dcb6c', '#5f9a4c'];
export function treeGeometries() {
  const canopy = new THREE.SphereGeometry(1, 9, 7);
  const trunk = new THREE.CylinderGeometry(0.12, 0.16, 1, 6).translate(0, 0.5, 0);
  return { canopy, trunk };
}

function forestTrees() {
  const s = S.raw, r = rng(4242), list = [];
  for (let z = 0; z < s.d; z++) for (let x = 0; x < s.w; x++) {
    if (s.zones[z][x] !== 'f' || r() > 0.42) continue;
    const wx = (x + 0.15 + r() * 0.7) / GRID.k, wz = (z + 0.15 + r() * 0.7) / GRID.k;
    if (Math.abs(wx - S.waterfall[0]) < 0.55 && wz > S.waterfall[1] - 1.2 && wz < S.waterfall[1] + 0.7) continue;   // keep the falls clear
    const y = groundAt(wx, wz);
    const rad = 0.13 + r() * 0.09, trunkH = 0.12 + r() * 0.06;
    list.push({ sx: Math.floor(wx), sz: Math.floor(wz), p: new THREE.Vector3(wx, y + trunkH + rad * 0.85, wz), q: new THREE.Quaternion(), s: new THREE.Vector3(rad, rad * 1.08, rad),
      tp: new THREE.Vector3(wx, y, wz), ts: new THREE.Vector3(0.18, trunkH + rad * 0.3, 0.18), c: TREE_GREENS[Math.floor(r() * TREE_GREENS.length)] });
  }
  const { canopy, trunk } = treeGeometries();
  const mesh = new THREE.InstancedMesh(canopy, new THREE.MeshLambertMaterial({ color: '#ffffff' }), list.length);
  const trunks = new THREE.InstancedMesh(trunk, new THREE.MeshLambertMaterial({ color: '#9b7b5c' }), list.length);
  const m = new THREE.Matrix4(), col = new THREE.Color();
  list.forEach((t, i) => {
    m.compose(t.p, t.q, t.s); mesh.setMatrixAt(i, m); mesh.setColorAt(i, col.set(t.c));
    m.compose(t.tp, t.q, t.ts); trunks.setMatrixAt(i, m);
  });
  mesh.castShadow = true; mesh.receiveShadow = true; trunks.castShadow = true;
  return { mesh, trunks, list };
}

function plinth(W, D) {
  const base = -0.75, pts = [];
  const edge = (x0, z0, x1, z1, n) => { for (let i = 0; i <= n; i++) { const t = i / n; pts.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]); } };
  edge(0, 0, W, 0, 60); edge(W, 0, W, D, 42); edge(W, D, 0, D, 60); edge(0, D, 0, 0, 42);
  const pos = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const ay = Math.max(groundAt(ax, az), S.sea), by = Math.max(groundAt(bx, bz), S.sea);
    pos.push(ax, ay, az, bx, by, bz, bx, base, bz, ax, ay, az, bx, base, bz, ax, base, az);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: '#efebe2', side: THREE.DoubleSide })));
  const board = new THREE.Mesh(new THREE.BoxGeometry(W + 1.2, 0.12, D + 1.2), new THREE.MeshLambertMaterial({ color: '#e4dfd3' }));
  board.position.set(W / 2, base - 0.06, D / 2); board.receiveShadow = true;
  g.add(board);
  return g;
}

function waterfall() {
  const [fx, fz] = S.waterfall, g = new THREE.Group();
  // Find the lip of the cliff just north of the pool.
  let top = 0, tz = fz;
  for (let d = 0; d < 1.6; d += 0.04) { const h = groundAt(fx, fz - d); if (h > top) { top = h; tz = fz - d; } }
  const bottom = S.sea + 0.02, hgt = Math.max(0.25, top - bottom);
  // Streaky water: bright white ribbons over pale blue, drawn once and scrolled downwards.
  const streaks = (seed, gaps) => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = gaps ? 'rgba(0,0,0,0)' : '#cfeef8'; x.fillRect(0, 0, 128, 256);
    let a = seed; const r = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
    for (let i = 0; i < (gaps ? 50 : 90); i++) {
      const w = 2 + r() * 7, px = r() * 128, py = r() * 256, len = 40 + r() * 120;
      x.fillStyle = r() < 0.75 ? 'rgba(255,255,255,0.95)' : 'rgba(170,222,240,0.95)';
      x.fillRect(px, py, w, len); if (py + len > 256) x.fillRect(px, py - 256, w, len);
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  // A curved sheet that leaves the lip and drops into the pool, a little wider at the bottom.
  const sheet = (width, out, tex, opacity) => {
    const nx = 14, ny = 18, pos = [], uv = [], idx = [];
    for (let j = 0; j <= ny; j++) {
      const v = j / ny, y = top - v * hgt, z = tz + (fz + 0.14 - tz) * Math.pow(v, 0.55) + out * Math.sin(v * Math.PI) * 0.5, w = width * (0.85 + 0.3 * v);
      for (let i = 0; i <= nx; i++) { const u = i / nx, xx = fx + (u - 0.5) * w; pos.push(xx, y, z + Math.sin(u * Math.PI) * 0.06); uv.push(u * 1.6, -v * 2.2); }
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, emissive: '#e6f7fc', emissiveIntensity: 0.45, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }));
  };
  const t1 = streaks(7, false), t2 = streaks(31, true);
  const back = sheet(0.62, 0.1, t1, 0.96), front = sheet(0.7, 0.16, t2, 0.9);
  front.renderOrder = 3; back.renderOrder = 2;
  g.add(back, front);
  // A foamy white lip along the top.
  const lip = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.56, 4, 10).rotateZ(Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.2 }));
  lip.position.set(fx, top + 0.02, tz + 0.02); g.add(lip);
  // White water at the bottom.
  const foam = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.15 }), bubbles = [];
  for (let i = 0; i < 20; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.045 + (i % 5) * 0.015, 9, 7), foam);
    const a = (i / 20) * Math.PI * 2, rr = 0.12 + (i % 4) * 0.08;
    b.userData.base = new THREE.Vector3(fx + Math.cos(a) * rr * 1.6, bottom + 0.01, fz + 0.06 + Math.sin(a) * rr * 0.7);
    b.position.copy(b.userData.base); g.add(b); bubbles.push(b);
  }
  // Spray rising and fading.
  const sc = document.createElement('canvas'); sc.width = sc.height = 64;
  const sx = sc.getContext('2d'), gr = sx.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); sx.fillStyle = gr; sx.fillRect(0, 0, 64, 64);
  const sprayTex = new THREE.CanvasTexture(sc), mist = [];
  for (let i = 0; i < 10; i++) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprayTex, transparent: true, depthWrite: false })); m.userData.ph = i / 10; m.userData.x = fx + (i % 5 - 2) * 0.14; g.add(m); mist.push(m); }
  // Boulders round the pool and beside the fall.
  const rock = [new THREE.MeshLambertMaterial({ color: '#bdb8af' }), new THREE.MeshLambertMaterial({ color: '#d2cdc4' })];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2, rr = 0.5 + (i % 3) * 0.12;
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07 + (i % 4) * 0.035, 0), rock[i % 2]);
    const x = fx + Math.cos(a) * rr * 1.25, z = fz + 0.1 + Math.sin(a) * rr * 0.75;
    if (z < tz + 0.1) continue;
    b.position.set(x, Math.max(bottom, groundAt(x, z)) + 0.02, z); b.rotation.set(i, i * 2, 0); b.scale.y = 0.7; b.castShadow = true; g.add(b);
  }
  for (const side of [-1, 1]) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), rock[0]); b.position.set(fx + side * 0.42, top - 0.05, tz + 0.05); b.scale.set(1, 0.8, 0.9); b.castShadow = true; g.add(b); }
  // Ripples spreading over the pool.
  const ripples = [];
  for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.25, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false })); r.position.set(fx, bottom + 0.016, fz + 0.12); r.scale.z = 0.7; r.userData.ph = i / 4; g.add(r); ripples.push(r); }
  let t = 0;
  g.userData.update = dt => {
    t += dt;
    t1.offset.y += dt * 0.9; t2.offset.y += dt * 1.45; t2.offset.x = Math.sin(t * 0.7) * 0.03;
    bubbles.forEach((b, i) => { const k = (t * 1.4 + i * 0.29) % 1, e = Math.sin(k * Math.PI); b.position.y = b.userData.base.y + e * 0.05; const s2 = 0.75 + e * 0.45; b.scale.set(s2, s2 * 0.6, s2); });
    mist.forEach(m => { const k = (t * 0.35 + m.userData.ph) % 1; m.position.set(m.userData.x + Math.sin(t + m.userData.ph * 9) * 0.05, bottom + 0.05 + k * 0.6, fz + 0.1); const s2 = 0.25 + k * 0.5; m.scale.set(s2, s2, 1); m.material.opacity = 0.7 * Math.sin(k * Math.PI); });
    ripples.forEach(r => { const k = (t * 0.4 + r.userData.ph) % 1; r.scale.set(1 + k * 3.5, 1, (1 + k * 3.5) * 0.7); r.material.opacity = 0.55 * (1 - k); });
  };
  return g;
}
