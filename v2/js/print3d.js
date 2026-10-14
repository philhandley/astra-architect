// Print in 3D: the school as one STL file, sized to fit a small 3D printer's plate (Phil's da Vinci 1.0 prints
// 200 × 200 × 200 mm). Every solid part of every building and piece goes in; people, glass, water, outlines and
// anything thinner than a nozzle's width are left out, and a base plate ties it all together. The file downloads
// (or shares, on a phone or tablet), ready to open in the printer's own slicer.
import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LEVEL } from './catalogue.js';
import { h, esc, emo, say, sfx, toast } from './ui.js';
import { icon } from './icons.js';

export const PLATE = 200;        // the printer's plate, mm, each way
const EDGE = 8;                  // stay this far from the plate's edge, mm
const MAX_SQUARE = 24;           // never bigger than this per square, mm
const BASE = 2;                  // the base plate, mm
const THIN = 0.7;                // leave out anything thinner than this, mm (a 0.4 mm nozzle)
const SKIRT = 0.4;               // base plate margin round the school, squares

// Build the printable geometry (in mm, Z up). Returns { geometry, mm: {w, d, h}, perSquare, parts }.
export function schoolGeometry({ design, model, yOf }) {
  const boxes = model.boxes;
  if (!boxes.length) return null;
  const x0 = Math.min(...boxes.map(b => b.x)) - SKIRT, x1 = Math.max(...boxes.map(b => b.x + b.w)) + SKIRT;
  const z0 = Math.min(...boxes.map(b => b.z)) - SKIRT, z1 = Math.max(...boxes.map(b => b.z + b.d)) + SKIRT;
  const yBase = Math.min(...boxes.map(b => yOf(b)));
  const yTop = Math.max(...boxes.map(b => yOf(b) + b.h * LEVEL)) + 1.2;      // (room for roofs and towers)
  const span = Math.max(x1 - x0, z1 - z0);
  const perSquare = Math.min(MAX_SQUARE, (PLATE - 2 * EDGE) / span, (PLATE - BASE - EDGE) / Math.max(0.5, yTop - yBase));
  // Every solid part of the drawn school.
  design.updateMatrixWorld(true);
  const parts = [], tmp = new THREE.Box3(), size = new THREE.Vector3();
  let skipped = 0;
  design.traverseVisible(o => {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry?.attributes?.position) return;
    const u = o.userData, m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (u.people || u.landscape || u.ghost || u.flame || u.noPrint || !m || m.transparent || m.side === THREE.BackSide) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    g.computeBoundingBox(); tmp.copy(g.boundingBox).getSize(size);
    if (Math.min(size.x, size.y, size.z) * perSquare < THIN) { skipped++; g.dispose(); return; }
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (k !== 'position') n.deleteAttribute(k);
    n.morphAttributes = {};
    parts.push(n);
  });
  // A base plate under the school, and a plinth under any building that stands on higher ground.
  const baseU = BASE / perSquare;
  parts.push(new THREE.BoxGeometry(x1 - x0, baseU, z1 - z0).translate((x0 + x1) / 2, yBase - baseU / 2, (z0 + z1) / 2).toNonIndexed());
  for (const b of boxes) if (b.level === 0 && yOf(b) > yBase + 0.005) parts.push(new THREE.BoxGeometry(b.w - 0.07, yOf(b) - yBase + 0.01, b.d - 0.07).translate(b.x + b.w / 2, (yOf(b) + yBase) / 2, b.z + b.d / 2).toNonIndexed());
  const geometry = mergeGeometries(parts.map(p => { p.deleteAttribute('normal'); p.deleteAttribute('uv'); return p; }));
  for (const p of parts) p.dispose();
  // To millimetres, Z up, standing on z = 0 with its corner at the origin.
  geometry.scale(perSquare, perSquare, perSquare).rotateX(Math.PI / 2);
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  geometry.translate(-bb.min.x, -bb.min.y, -bb.min.z);
  geometry.computeBoundingBox(); geometry.boundingBox.getSize(size);
  return { geometry, mm: { w: size.x, d: size.y, h: size.z }, perSquare, parts: parts.length, skipped, triangles: geometry.attributes.position.count / 3 };
}

export function schoolSTL(opts) {
  const built = schoolGeometry(opts);
  if (!built) return null;
  const data = new STLExporter().parse(new THREE.Mesh(built.geometry), { binary: true });
  return { ...built, blob: new Blob([data], { type: 'model/stl' }) };      // (the geometry is kept for the preview; dispose it when done)
}

// A little turning view of the print itself: the same geometry the file holds, in plain plastic white.
function preview(canvas, geometry, mm) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(1.5, devicePixelRatio || 1)); renderer.setSize(canvas.clientWidth || 560, canvas.clientHeight || 340, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#eef0ea');
  scene.add(new THREE.HemisphereLight('#ffffff', '#b9bdb2', 1.0));
  const sun = new THREE.DirectionalLight('#fff6e6', 2.1); sun.position.set(-1, 1.6, 1.2).multiplyScalar(mm.w); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  const R = Math.max(mm.w, mm.d, mm.h); Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 0.1, far: 6 * R }); scene.add(sun);
  // Z up in the file; Y up on screen.
  const g = geometry.clone().rotateX(-Math.PI / 2).translate(-mm.w / 2, 0, mm.d / 2);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#f2f0ea', roughness: 0.85, metalness: 0, flatShading: true }));
  mesh.castShadow = mesh.receiveShadow = true;
  const turn = new THREE.Group(); turn.add(mesh); scene.add(turn);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(PLATE, 1, PLATE).translate(0, -0.5, 0), new THREE.MeshStandardMaterial({ color: '#d8dbd2', roughness: 1 }));
  plate.receiveShadow = true; turn.add(plate);
  const cam = new THREE.PerspectiveCamera(32, (canvas.clientWidth || 560) / (canvas.clientHeight || 340), 1, 20 * R);
  const dist = Math.max(PLATE * 1.45, R * 2.3);
  cam.position.set(0, dist * 0.6, dist * 0.8); cam.lookAt(0, mm.h * 0.25, 0);
  let yaw = 0.6, drag = null, spinning = true, alive = true;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, yaw }; spinning = false; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (drag) yaw = drag.yaw + (e.clientX - drag.x) * 0.012; });
  canvas.addEventListener('pointerup', () => { drag = null; });
  const tick = () => { if (!alive) return; if (spinning) yaw += 0.004; turn.rotation.y = yaw; renderer.render(scene, cam); requestAnimationFrame(tick); };
  tick();
  return () => { alive = false; renderer.dispose(); renderer.forceContextLoss(); g.dispose(); plate.geometry.dispose(); };      // (give the GL context back: the browser only allows a few)
}

const round = v => Math.round(v);
// The card: what the file is, how big the print will be, and buttons to download or send it.
export function openPrint3D(opts) {
  if (!opts.model.boxes.length) { sfx.no(); toast('Build your school first!'); return; }
  say('Making a file for the 3D printer.');
  const out = schoolSTL(opts);
  if (!out) return;
  const name = 'finns-school.stl', file = new File([out.blob], name, { type: 'model/stl' });
  const canSend = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  const sheet = h(`<div class="nova-sheet"><div class="nova-card">
    <div class="nova-head">${emo('🏗️', 'emo head-pic')}<div><small>Print in 3D</small><h2>A model of your school</h2></div><button class="fbtn close" type="button">${icon('close')}</button></div>
    <p class="share-text">This is a file for a 3D printer (an STL). The school comes out <b>${round(out.mm.w)} × ${round(out.mm.d)} mm</b> and <b>${round(out.mm.h)} mm</b> tall, with one square ${out.perSquare.toFixed(1)} mm across, to fit a 200 mm printer plate. Children, glass and very thin bits are left out, and it stands on a 2 mm base.</p>
    <canvas class="stl-view" width="560" height="340" aria-label="The model, turning"></canvas>
    <p class="share-text small">Drag the model to turn it. On the da Vinci 1.0: open the file in XYZware, put it in the middle of the plate, choose 0.2 mm layers with a raft and supports, and use the glue stick on the glass.</p>
    <div class="bq-next">${canSend ? `<button class="fbtn ok send" type="button">${icon('share')}<span>Send the file</span></button>` : ''}<button class="fbtn save ${canSend ? '' : 'ok'}" type="button">${icon('print')}<span>Download the file</span></button></div>
  </div></div>`);
  document.body.append(sheet);
  const stop = preview(sheet.querySelector('.stl-view'), out.geometry, out.mm);
  const close = () => { stop(); out.geometry.dispose(); sheet.remove(); };
  sheet.addEventListener('click', async e => {
    if (e.target === sheet || e.target.closest('.close')) { sfx.tap(); close(); return; }
    if (e.target.closest('.save')) {
      sfx.tap();
      const a = document.createElement('a'); a.href = URL.createObjectURL(out.blob); a.download = name; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 20000);
      toast('Saved to your downloads');
      return;
    }
    if (e.target.closest('.send')) { sfx.tap(); try { await navigator.share({ files: [file], title: "Finn's Dream School", text: 'A 3D print file of the school Finn designed.' }); } catch (err) { /* closed without sending */ } }
  });
}
