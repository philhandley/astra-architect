// The site model: painted map on a height grid, a wooden plinth, water, the waterfall, trees and rocks.
import * as THREE from 'three';
import { site, zone, groundAt } from './site.js';
import { CLIP } from './scene.js';
import { staticParts } from './models.js';

let built = null;

export async function buildTerrain(world) {
  if (built) return built;
  const S = site();
  const g = world.groups.terrain;
  const tex = await new THREE.TextureLoader().loadAsync('assets/site/map.jpg');
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, world.renderer.capabilities.getMaxAnisotropy());

  // Ground
  const { hw, hd, res, heights, w, d } = S;
  const pos = new Float32Array(hw * hd * 3);
  const uv = new Float32Array(hw * hd * 2);
  for (let j = 0; j < hd; j++) for (let i = 0; i < hw; i++) {
    const k = j * hw + i;
    pos[k * 3] = i / res; pos[k * 3 + 1] = heights[k]; pos[k * 3 + 2] = j / res;
    uv[k * 2] = i / (hw - 1); uv[k * 2 + 1] = 1 - j / (hd - 1);
  }
  const idx = [];
  for (let j = 0; j < hd - 1; j++) for (let i = 0; i < hw - 1; i++) {
    const a = j * hw + i, b = a + 1, c = a + hw, e = c + 1;
    idx.push(a, c, b, b, c, e);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const groundMat = new THREE.MeshLambertMaterial({ map: tex, clippingPlanes: CLIP });
  const ground = new THREE.Mesh(geo, groundMat);
  ground.receiveShadow = true;
  ground.name = 'ground';
  g.add(ground);

  // Plinth sides: from the ground (or the water) down to the base, like a model on a table.
  const sea = S.seaLevel;
  const BASE = -1.3;
  const sp = [], sc = [];
  const wood = new THREE.Color('#e9dcc3'), woodDark = new THREE.Color('#cdb994'), waterTop = new THREE.Color('#5aa9cf'), waterDeep = new THREE.Color('#1f6f99');
  const edge = (pts) => {
    for (let n = 0; n < pts.length - 1; n++) {
      const [x0, z0] = pts[n], [x1, z1] = pts[n + 1];
      const top = (x, z) => {
        const zn = zone(Math.min(w - 1, Math.floor(x - (x >= w ? 0.01 : 0))), Math.min(d - 1, Math.floor(z - (z >= d ? 0.01 : 0))));
        const h = groundAt(x, z);
        return zn === 'w' ? Math.max(h, sea) : h;
      };
      const t0 = top(x0, z0), t1 = top(x1, z1);
      const wat0 = t0 === sea && groundAt(x0, z0) < sea, wat1 = t1 === sea && groundAt(x1, z1) < sea;
      sp.push(x0, t0, z0, x0, BASE, z0, x1, t1, z1, x1, t1, z1, x0, BASE, z0, x1, BASE, z1);
      const ct0 = wat0 ? waterTop : wood, ct1 = wat1 ? waterTop : wood, cb0 = wat0 ? waterDeep : woodDark, cb1 = wat1 ? waterDeep : woodDark;
      for (const c of [ct0, cb0, ct1, ct1, cb0, cb1]) sc.push(c.r, c.g, c.b);
    }
  };
  const step = 1 / res;
  const line = (ax, az, bx, bz) => { const pts = []; const n = Math.round(Math.hypot(bx - ax, bz - az) / step); for (let i = 0; i <= n; i++) pts.push([ax + (bx - ax) * i / n, az + (bz - az) * i / n]); return pts; };
  edge(line(0, d, w, d)); edge(line(w, d, w, 0)); edge(line(w, 0, 0, 0)); edge(line(0, 0, 0, d));
  const skirt = new THREE.BufferGeometry();
  skirt.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  skirt.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
  skirt.computeVertexNormals();
  const skirtMesh = new THREE.Mesh(skirt, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, clippingPlanes: CLIP }));
  g.add(skirtMesh);
  const bottom = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ color: '#cdb994' }));
  bottom.rotation.x = Math.PI / 2; bottom.position.set(w / 2, BASE, d / 2);
  g.add(bottom);
  // A soft shadow under the plinth.
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(w + 14, d + 14), new THREE.MeshBasicMaterial({ map: radialTex(), transparent: true, depthWrite: false, opacity: 0.35 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(w / 2, BASE - 0.02, d / 2);
  g.add(shadow);

  // Water surface over the whole site: land hides it wherever the ground is higher.
  const water = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 1, 1), waterMaterial(world));
  water.rotation.x = -Math.PI / 2;
  water.position.set(w / 2, sea, d / 2);
  water.renderOrder = 2;
  water.name = 'water';
  g.add(water);

  const falls = waterfall(world);
  g.add(falls);

  const trees = await plantTrees(world);
  built = { ground, water, trees, groundMat };
  return built;
}

export const terrain = () => built;

function radialTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(64, 64, 20, 64, 64, 64);
  gr.addColorStop(0, 'rgba(60,50,30,0.55)'); gr.addColorStop(1, 'rgba(60,50,30,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function waterMaterial(world) {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    clippingPlanes: CLIP,
    clipping: true,
    uniforms: { time: { value: 0 }, sunDir: { value: new THREE.Vector3(0, 1, 0) } },
    vertexShader: `
      #include <clipping_planes_pars_vertex>
      varying vec3 vW;
      void main(){
        #include <begin_vertex>
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <clipping_planes_vertex>
      }`,
    fragmentShader: `
      #include <clipping_planes_pars_fragment>
      varying vec3 vW; uniform float time; uniform vec3 sunDir;
      void main(){
        #include <clipping_planes_fragment>
        vec2 p = vW.xz;
        float w1 = sin(p.x * 1.7 + time * 1.1) * cos(p.y * 1.3 - time * 0.9);
        float w2 = sin(p.x * 3.9 - p.y * 2.7 + time * 2.1) * 0.5;
        float w3 = sin((p.x + p.y) * 7.0 + time * 3.0) * 0.25;
        vec3 n = normalize(vec3((w1 + w2) * 0.16 + w3 * 0.1, 1.0, (w2 - w1) * 0.16 + w3 * 0.1));
        vec3 v = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        vec3 h = normalize(normalize(sunDir) + v);
        float spec = pow(max(dot(n, h), 0.0), 120.0);
        vec3 col = mix(vec3(0.07, 0.45, 0.62), vec3(0.62, 0.85, 0.95), fres * 0.8);
        float a = 0.36 + fres * 0.4;
        col += vec3(1.0, 0.97, 0.88) * spec * 1.4;
        gl_FragColor = vec4(col, clamp(a + spec, 0.0, 0.92));
      }`,
  });
  world.updaters.add((dt, t) => { mat.uniforms.time.value = t; mat.uniforms.sunDir.value.copy(world.sunDir); });
  return mat;
}

function waterfall(world) {
  const S = site();
  const [fx, fz] = S.waterfall;
  const g = new THREE.Group();
  // A strip down the cliff, following the ground.
  const z0 = fz - 3.0, z1 = fz + 0.2, segs = 14, half = 0.62;
  const pos = [], uv = [], idx = [];
  for (let s = 0; s <= segs; s++) {
    const z = z0 + (z1 - z0) * s / segs;
    for (const side of [-1, 1]) {
      const x = fx - 0.25 + side * half;
      const y = Math.max(groundAt(x, z), S.poolLevel) + 0.05;
      pos.push(x, y, z);
      uv.push(side < 0 ? 0 : 1, s / segs);
    }
  }
  for (let s = 0; s < segs; s++) { const a = s * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float time;
      float hash(float n){ return fract(sin(n) * 43758.5453); }
      void main(){
        float col = floor(vUv.x * 18.0);
        float speed = 1.4 + hash(col) * 0.8;
        float streak = fract(vUv.y * 3.0 - time * speed + hash(col * 7.0));
        float s = smoothstep(0.0, 0.3, streak) * smoothstep(1.0, 0.6, streak);
        float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        float a = (0.45 + 0.45 * s) * edge;
        gl_FragColor = vec4(mix(vec3(0.75, 0.9, 1.0), vec3(1.0), s), a);
      }`,
  });
  const strip = new THREE.Mesh(geo, mat);
  strip.renderOrder = 3;
  g.add(strip);
  // Mist and foam at the foot.
  const mistTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  })();
  const puffs = [];
  for (let i = 0; i < 9; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, transparent: true, depthWrite: false, opacity: 0.5 }));
    sp.userData.phase = i / 9;
    g.add(sp); puffs.push(sp);
  }
  world.updaters.add((dt, t) => {
    mat.uniforms.time.value = t;
    for (const sp of puffs) {
      const ph = (t * 0.35 + sp.userData.phase) % 1;
      const a = sp.userData.phase * Math.PI * 2;
      sp.position.set(fx - 0.25 + Math.cos(a) * 0.5 * ph, S.poolLevel + 0.1 + ph * 0.7, fz + 0.3 + Math.sin(a) * 0.4 * ph);
      sp.scale.setScalar(0.4 + ph * 0.9);
      sp.material.opacity = 0.55 * (1 - ph);
    }
  });
  return g;
}

// Trees on forest cells, rocks on rocky ones. Instanced so hundreds cost little.
async function plantTrees(world) {
  const S = site();
  let seed = 20261012;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const kinds = [
    { url: 'assets/models/nature/tree_pineTallA.glb', h: 2.1, where: 'high' },
    { url: 'assets/models/nature/tree_tall.glb', h: 1.8, where: 'low' },
    { url: 'assets/models/nature/tree_fat.glb', h: 1.3, where: 'low' },
    { url: 'assets/models/nature/tree_simple.glb', h: 1.5, where: 'low' },
    { url: 'assets/models/nature/tree_cone.glb', h: 1.9, where: 'high' },
  ];
  const rocks = [
    { url: 'assets/models/nature/rock_largeA.glb', h: 0.6 },
    { url: 'assets/models/nature/rock_tallA.glb', h: 0.9 },
    { url: 'assets/models/nature/rock_smallA.glb', h: 0.35 },
  ];
  const plan = kinds.map(() => []), rplan = rocks.map(() => []);
  const byCell = new Map();          // "x,z" -> [{ kind, i }]
  for (let z = 0; z < S.d; z++) for (let x = 0; x < S.w; x++) {
    const zn = zone(x, z);
    if (zn === 'f') {
      const hgt = groundAt(x + 0.5, z + 0.5);
      const n = rnd() < 0.62 ? 1 : 0;
      for (let k = 0; k < n; k++) {
        const high = hgt > 0.7;
        const options = kinds.map((kd, i) => i).filter(i => (kinds[i].where === 'high') === high || rnd() < 0.25);
        const ki = options[Math.floor(rnd() * options.length)];
        const px = x + 0.2 + rnd() * 0.6, pz = z + 0.2 + rnd() * 0.6;
        const s = 0.75 + rnd() * 0.5;
        plan[ki].push({ x: px, z: pz, y: groundAt(px, pz) - 0.02, s, r: rnd() * Math.PI * 2, cell: `${x},${z}` });
      }
    } else if (zn === 'c' && rnd() < 0.3) {
      const ri = rnd() < 0.5 ? 0 : 1;
      const px = x + 0.3 + rnd() * 0.4, pz = z + 0.3 + rnd() * 0.4;
      rplan[ri].push({ x: px, z: pz, y: groundAt(px, pz) - 0.05, s: 0.7 + rnd() * 0.7, r: rnd() * Math.PI * 2 });
    } else if (zn === 'b' && rnd() < 0.06) {
      const px = x + rnd(), pz = z + rnd();
      rplan[2].push({ x: px, z: pz, y: groundAt(px, pz) - 0.03, s: 0.6 + rnd() * 0.8, r: rnd() * Math.PI * 2 });
    }
  }
  const meshes = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const place = async (spec, list, cast, track) => {
    if (!list.length) return;
    const parts = await staticParts(spec.url, spec.h, { clippingPlanes: CLIP, tint: 'nature' });
    for (const p of parts) {
      const im = new THREE.InstancedMesh(p.geometry, p.material, list.length);
      im.castShadow = cast;
      im.receiveShadow = false;
      list.forEach((t, i) => {
        q.setFromAxisAngle(v.set(0, 1, 0), t.r);
        m4.compose(new THREE.Vector3(t.x, t.y, t.z), q, sc.set(t.s, t.s, t.s));
        im.setMatrixAt(i, m4);
      });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      world.groups.terrain.add(im);
      meshes.push(im);
      if (track) list.forEach((t, i) => { if (!byCell.has(t.cell)) byCell.set(t.cell, []); byCell.get(t.cell).push({ im, i, t }); });
    }
  };
  await Promise.all([
    ...kinds.map((k, i) => place(k, plan[i], true, true)),
    ...rocks.map((k, i) => place(k, rplan[i], true, false)),
  ]);
  // Hide the trees on cells that have been built on, and show them again when cleared.
  const hidden = new Set();
  function sync(occupiedCells) {
    const want = new Set(occupiedCells);
    const changed = new Set();
    for (const c of hidden) if (!want.has(c)) { hidden.delete(c); changed.add(c); }
    for (const c of want) if (byCell.has(c) && !hidden.has(c)) { hidden.add(c); changed.add(c); }
    const dirty = new Set();
    for (const c of changed) for (const { im, i, t } of byCell.get(c) || []) {
      const s = hidden.has(c) ? 0.0001 : t.s;
      q.setFromAxisAngle(v.set(0, 1, 0), t.r);
      m4.compose(new THREE.Vector3(t.x, t.y, t.z), q, sc.set(s, s, s));
      im.setMatrixAt(i, m4);
      dirty.add(im);
    }
    for (const im of dirty) im.instanceMatrix.needsUpdate = true;
  }
  return { meshes, sync };
}
