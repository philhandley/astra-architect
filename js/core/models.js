// GLB loading with a cache. Kenney models use unlit materials, so they are swapped for lit ones.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const cache = new Map();

export function loadGLB(url) {
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url));
  return cache.get(url);
}

const litCache = new Map();
// Kenney's nature colours are pale under real lights; deepen greens and soften the rest.
function natureTint(c) {
  const hsl = {};
  c.getHSL(hsl);
  if (hsl.h > 0.2 && hsl.h < 0.55 && hsl.s > 0.15) return new THREE.Color().setHSL(0.27 + (hsl.h - 0.35) * 0.25, 0.42, Math.min(0.34, hsl.l * 0.62));
  return c.clone().multiplyScalar(0.8);
}
export function litMaterial(m, extra = {}) {
  const k = m.uuid + JSON.stringify(extra);
  if (!litCache.has(k)) {
    const tint = extra.tint;
    const rest = { ...extra };
    delete rest.tint;
    const base = m.color ? m.color.clone() : new THREE.Color(0xffffff);
    const lm = new THREE.MeshLambertMaterial({ color: tint === 'nature' ? natureTint(base) : base, map: m.map || null, ...rest });
    if (lm.map) lm.map.colorSpace = THREE.SRGBColorSpace;
    litCache.set(k, lm);
  }
  return litCache.get(k);
}

// Flatten a static model into one geometry per material, normalised so its base sits at y = 0
// and its height is `height` units. Returns [{ geometry, material }].
export async function staticParts(url, height = 1, extra = {}) {
  const gltf = await loadGLB(url);
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const s = height / (size.y || 1);
  const centre = box.getCenter(new THREE.Vector3());
  const norm = new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-centre.x, -box.min.y, -centre.z));
  const byMat = new Map();
  root.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const g = o.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(norm, o.matrixWorld));
    if (mats.length === 1) {
      const m = mats[0];
      if (!byMat.has(m.uuid)) byMat.set(m.uuid, { mat: m, geos: [] });
      byMat.get(m.uuid).geos.push(g);
    } else {
      for (const grp of g.groups) {
        const m = mats[grp.materialIndex];
        const sub = g.clone();
        sub.setDrawRange(grp.start, grp.count);
        const idx = sub.index ? sub.index.array.slice(grp.start, grp.start + grp.count) : null;
        if (idx) sub.setIndex(Array.from(idx));
        sub.clearGroups();
        if (!byMat.has(m.uuid)) byMat.set(m.uuid, { mat: m, geos: [] });
        byMat.get(m.uuid).geos.push(sub);
      }
    }
  });
  const { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js');
  const parts = [];
  for (const { mat, geos } of byMat.values()) {
    const clean = geos.map(g => {
      const n = new THREE.BufferGeometry();
      n.setAttribute('position', g.attributes.position);
      if (g.attributes.normal) n.setAttribute('normal', g.attributes.normal);
      if (g.index) n.setIndex(g.index);
      return n.index ? n.toNonIndexed() : n;
    });
    const merged = clean.length > 1 ? mergeGeometries(clean, false) : clean[0];
    if (!merged.attributes.normal) merged.computeVertexNormals();
    parts.push({ geometry: merged, material: litMaterial(mat, extra) });
  }
  return parts;
}
