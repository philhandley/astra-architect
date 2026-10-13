// Dev: character designs for the children, built from the same parts the crowd uses (crowd.js): a body (torso,
// head, face, hair, hat, bag) on one matrix, legs (with shoes and soles) hanging from the hips and arms (with hands)
// from the shoulders. Each style gives its body sizes, its part geometries and how it is drawn.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const flat = g => (g.index ? g.toNonIndexed() : g);
const join = list => { const g = mergeGeometries(list.map(x => { const y = flat(x); if (y.attributes.uv) y.deleteAttribute('uv'); return y; })); return g; };
const lathe = (pts, seg = 14) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const cap = (r, a0, a1, seg = 14, rings = 7) => new THREE.SphereGeometry(r, seg, rings, 0, Math.PI * 2, a0, a1);

// ---------- looks ----------
// A look from a number: outfit colours that go together, skin, hair colour and style, and extras.
const OUT = [
  { top: '#f4c23d', sleeve: '#f4c23d', legs: '#2f4b7c', shoes: '#fbfaf6', accent: '#2f4b7c' },
  { top: '#e6463c', sleeve: '#fbfaf6', legs: '#3d405b', shoes: '#22b2bf', accent: '#fbfaf6' },
  { top: '#22b2bf', sleeve: '#22b2bf', legs: '#f4c23d', shoes: '#fbfaf6', accent: '#f4c23d' },
  { top: '#2f4b7c', sleeve: '#e2457d', legs: '#c9ccd3', shoes: '#e2457d', accent: '#e2457d' },
  { top: '#fbfaf6', sleeve: '#3d8de0', legs: '#3d8de0', shoes: '#f4c23d', accent: '#3d8de0' },
  { top: '#8bc34a', sleeve: '#8bc34a', legs: '#2f4b7c', shoes: '#fbfaf6', accent: '#fbfaf6' },
  { top: '#9a6cd4', sleeve: '#9a6cd4', legs: '#26272d', shoes: '#fbfaf6', accent: '#f4c23d' },
  { top: '#ea7b2c', sleeve: '#26272d', legs: '#26272d', shoes: '#ea7b2c', accent: '#26272d' },
  { top: '#e2457d', sleeve: '#e2457d', legs: '#fbfaf6', shoes: '#3d405b', accent: '#fbfaf6' },
];
export const SKIN = ['#f6d7bf', '#e7b892', '#c98c62', '#9a6544', '#6e4630'];
export const HAIR = ['#3b2a20', '#1f1b18', '#b5652e', '#e3b65a', '#6b4128', '#2a2320'];
export const HATS = ['#e6463c', '#22b2bf', '#f4c23d', '#3d8de0', '#26272d', '#e2457d'];
export function look(n, styles) {
  let h = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b) >>> 0; h = (h ^ (h >>> 13)) >>> 0; h = Math.imul(h, 0xc2b2ae35) >>> 0; h = (h ^ (h >>> 16)) >>> 0;
  const o = OUT[h % OUT.length];
  return { ...o, skin: SKIN[(h >>> 4) % SKIN.length], hair: HAIR[(h >>> 8) % HAIR.length], style: styles[(h >>> 12) % styles.length], hat: HATS[(h >>> 16) % HATS.length], bag: (h >>> 20) % 3 === 0 ? HATS[(h >>> 22) % HATS.length] : null, sole: '#fbfaf6' };
}

// ---------- materials ----------
const RAMP = (() => { const t = new THREE.DataTexture(new Uint8Array([95, 178, 255]), 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const RAMP2 = (() => { const t = new THREE.DataTexture(new Uint8Array([150, 255]), 2, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const cache = new Map();
export function material(kind, hex) {
  const k = kind + hex;
  if (!cache.has(k)) cache.set(k, kind === 'toon' ? new THREE.MeshToonMaterial({ color: hex, gradientMap: RAMP }) : kind === 'toon2' ? new THREE.MeshToonMaterial({ color: hex, gradientMap: RAMP2 }) : kind === 'flat' ? new THREE.MeshLambertMaterial({ color: hex, flatShading: true }) : new THREE.MeshLambertMaterial({ color: hex }));
  return cache.get(k);
}
const INK = new THREE.MeshBasicMaterial({ color: '#23252b', side: THREE.BackSide });
export function inkOf(geo, w) {
  const g = geo.clone(), p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * w, p.getY(i) + n.getY(i) * w, p.getZ(i) + n.getZ(i) * w);
  return g;
}

// ---------- styles ----------
export const STYLES = {};

// A: soft and designed. Real proportions for a seven-year-old (the head about a fifth of the height), a body wider
// than it is deep, long legs in slim trousers, sneakers with white soles, small calm faces with eyebrows.
STYLES.soft = (() => {
  const HIP = 0.082, SHOULDER = 0.143, LEG_X = 0.0135, ARM_X = 0.031, R = 0.034, HY = 0.183;
  const torso = lathe([[0, 0.074], [0.025, 0.074], [0.027, 0.08], [0.027, 0.118], [0.025, 0.138], [0.017, 0.149], [0.009, 0.153], [0, 0.153]], 16).scale(1.12, 1, 0.78);
  const head = join([new THREE.SphereGeometry(R, 16, 12).scale(1, 1.08, 1).translate(0, HY, 0), new THREE.CylinderGeometry(0.009, 0.01, 0.02, 8).translate(0, 0.154, 0)]);
  const eye = x => new THREE.SphereGeometry(0.0042, 6, 5).scale(0.8, 1.25, 0.45).translate(x, HY + 0.002, R * 1.02);
  const brow = x => new THREE.BoxGeometry(0.009, 0.0022, 0.002).rotateZ(x > 0 ? -0.15 : 0.15).translate(x, HY + 0.0135, R * 0.95);
  const face = join([eye(-0.0115), eye(0.0115), brow(-0.012), brow(0.012)]);
  const top = (r, a1, tilt = -0.25, y = HY + 0.003) => cap(r, 0, a1, 16, 8).rotateX(tilt).translate(0, y, -0.002);
  const hairs = {
    crop: join([top(R * 1.07, Math.PI * 0.42, -0.35).scale(1.02, 1.04, 1.03), new THREE.SphereGeometry(R * 0.55, 10, 6).scale(1.5, 0.5, 0.8).rotateX(0.35).translate(0.008, HY + R * 0.78, R * 0.42)]),
    curls: join([top(R * 1.05, Math.PI * 0.45, -0.3), ...Array.from({ length: 11 }, (_, i) => { const a = i * 2.4, e = 0.25 + (i % 4) * 0.22; return new THREE.SphereGeometry(R * 0.36, 7, 5).translate(Math.cos(a) * Math.cos(e) * R * 0.95, HY + Math.sin(e) * R * 1.0 + 0.004, Math.sin(a) * Math.cos(e) * R * 0.95 - 0.003); })]),
    bob: join([top(R * 1.1, Math.PI * 0.62, -0.32).scale(1.06, 1.02, 1.05), new THREE.BoxGeometry(R * 1.5, R * 0.32, R * 0.4).translate(0, HY + R * 0.62, R * 0.72)]),
    pony: join([top(R * 1.07, Math.PI * 0.48, -0.38), new THREE.CapsuleGeometry(R * 0.28, R * 0.9, 3, 8).rotateX(0.5).translate(0, HY + R * 0.25, -R * 1.18), new THREE.SphereGeometry(R * 0.32, 8, 6).translate(0, HY + R * 0.85, -R * 0.82)]),
    buns: join([top(R * 1.06, Math.PI * 0.48, -0.34), ...[-1, 1].map(s => new THREE.SphereGeometry(R * 0.42, 9, 7).translate(s * R * 0.62, HY + R * 0.95, -R * 0.1))]),
    long: join([top(R * 1.09, Math.PI * 0.55, -0.3), new THREE.CylinderGeometry(R * 1.04, R * 1.12, R * 1.5, 14, 1, true, 0.75, Math.PI * 2 - 1.5).translate(0, HY - R * 0.35, -0.004)]),
  };
  const beanie = join([cap(R * 1.12, 0, Math.PI * 0.5, 16, 8).rotateX(-0.15).translate(0, HY + 0.004, -0.001), new THREE.TorusGeometry(R * 1.06, R * 0.16, 6, 18).rotateX(Math.PI / 2 - 0.15).translate(0, HY + 0.006, 0.0), new THREE.SphereGeometry(R * 0.28, 8, 6).translate(0, HY + R * 1.18, -0.004)]);
  const bag = new RoundedBoxGeometry(0.04, 0.046, 0.018, 1, 0.008).translate(0, 0.118, -0.03);
  const leg = new THREE.CapsuleGeometry(0.0105, 0.048, 2, 8).translate(0, -0.034, 0).scale(1, 1, 0.95);
  const shoe = new THREE.CapsuleGeometry(0.0115, 0.016, 2, 8).rotateX(Math.PI / 2).scale(1.05, 0.72, 1).translate(0, -0.071, 0.006);
  const sole = new THREE.BoxGeometry(0.0225, 0.005, 0.04).translate(0, -0.0795, 0.006);
  const arm = new THREE.CapsuleGeometry(0.0085, 0.042, 2, 8).translate(0, -0.028, 0);
  const hand = new THREE.SphereGeometry(0.0088, 8, 6).scale(0.9, 1.1, 0.8).translate(0, -0.058, 0);
  return { name: 'Soft designed', HIP, SHOULDER, LEG_X, ARM_X, mat: 'lambert', ink: 0, parts: { torso, head, face, ...hairs, beanie, bag, leg, shoe, sole, arm, hand }, hairs: Object.keys(hairs), hat: { beanie: 0.35 } };
})();

// B: like architects' scale figures. Tall and slim, no faces, one strong colour each.
STYLES.model = (() => {
  const HIP = 0.096, SHOULDER = 0.158, LEG_X = 0.012, ARM_X = 0.027, R = 0.028, HY = 0.19;
  const torso = lathe([[0, 0.09], [0.021, 0.09], [0.022, 0.13], [0.02, 0.155], [0.012, 0.165], [0, 0.166]], 12).scale(1.1, 1, 0.75);
  const head = join([new THREE.SphereGeometry(R, 12, 9).scale(0.95, 1.12, 1).translate(0, HY, 0), new THREE.CylinderGeometry(0.007, 0.008, 0.02, 6).translate(0, 0.167, 0)]);
  const hairs = { short: cap(R * 1.05, 0, Math.PI * 0.45, 12, 6).rotateX(-0.3).translate(0, HY + 0.003, -0.002), knot: join([cap(R * 1.05, 0, Math.PI * 0.45, 12, 6).rotateX(-0.3).translate(0, HY + 0.003, -0.002), new THREE.SphereGeometry(R * 0.4, 8, 6).translate(0, HY + R * 0.9, -R * 0.7)]) };
  const leg = new THREE.CapsuleGeometry(0.009, 0.07, 2, 6).translate(0, -0.044, 0);
  const shoe = new THREE.CapsuleGeometry(0.0095, 0.012, 2, 6).rotateX(Math.PI / 2).scale(1, 0.7, 1).translate(0, -0.088, 0.004);
  const arm = new THREE.CapsuleGeometry(0.0072, 0.055, 2, 6).translate(0, -0.035, 0);
  const hand = new THREE.SphereGeometry(0.0072, 6, 5).translate(0, -0.07, 0);
  return { name: 'Scale model', HIP, SHOULDER, LEG_X, ARM_X, mat: 'lambert', ink: 0, mono: true, parts: { torso, head, ...hairs, leg, shoe, arm, hand }, hairs: Object.keys(hairs) };
})();

// C: streetwear. A hoodie (with its hood behind the neck), joggers, big sneakers with white soles, caps worn
// backwards and headphones; pill-shaped eyes; a thin ink line.
STYLES.street = (() => {
  const HIP = 0.076, SHOULDER = 0.14, LEG_X = 0.0145, ARM_X = 0.033, R = 0.038, HY = 0.184;
  const torso = join([lathe([[0, 0.066], [0.028, 0.066], [0.03, 0.074], [0.03, 0.115], [0.028, 0.136], [0.018, 0.148], [0, 0.149]], 16).scale(1.12, 1, 0.82),
    new THREE.TorusGeometry(0.016, 0.006, 6, 14).scale(1.2, 1, 1).rotateX(Math.PI / 2 - 0.4).translate(0, 0.148, -0.01),
    new THREE.BoxGeometry(0.03, 0.014, 0.004).translate(0, 0.09, 0.0245)]);
  const head = join([new THREE.SphereGeometry(R, 16, 12).scale(1, 1.05, 1).translate(0, HY, 0), new THREE.CylinderGeometry(0.009, 0.01, 0.02, 8).translate(0, 0.152, 0)]);
  const pill = x => new THREE.CapsuleGeometry(0.0028, 0.005, 2, 6).translate(x, HY + 0.002, R * 0.95);
  const brow = x => new THREE.BoxGeometry(0.01, 0.0026, 0.002).translate(x, HY + 0.014, R * 0.96);
  const face = join([pill(-0.012), pill(0.012), brow(-0.012), brow(0.012)]);
  const top = (r, a1, tilt = -0.3) => cap(r, 0, a1, 16, 8).rotateX(tilt).translate(0, HY + 0.003, -0.002);
  const hairs = {
    fade: join([top(R * 1.04, Math.PI * 0.4, -0.4), new THREE.BoxGeometry(R * 1.2, R * 0.45, R * 1.2).translate(0, HY + R * 0.82, -0.002)]),
    curls: join([top(R * 1.04, Math.PI * 0.45), ...Array.from({ length: 12 }, (_, i) => { const a = i * 2.4, e = 0.3 + (i % 4) * 0.2; return new THREE.SphereGeometry(R * 0.34, 7, 5).translate(Math.cos(a) * Math.cos(e) * R * 0.95, HY + Math.sin(e) * R + 0.005, Math.sin(a) * Math.cos(e) * R * 0.95); })]),
    braids: join([top(R * 1.06, Math.PI * 0.5), ...[-1, 1].map(s => new THREE.CapsuleGeometry(R * 0.16, R * 1.2, 2, 6).translate(s * R * 0.75, HY - R * 0.5, -R * 0.45))]),
    bun: join([top(R * 1.06, Math.PI * 0.48), new THREE.SphereGeometry(R * 0.45, 9, 7).translate(0, HY + R * 1.05, -R * 0.3)]),
  };
  const capHat = join([cap(R * 1.08, 0, Math.PI * 0.42, 16, 7).rotateX(-0.2).translate(0, HY + 0.004, -0.002), new THREE.CylinderGeometry(R * 0.7, R * 0.7, 0.004, 12, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, 0.9).translate(0, HY + R * 0.5, -R * 0.62).rotateX(-0.1)]);
  const phones = join([new THREE.TorusGeometry(R * 1.12, 0.0035, 5, 18, Math.PI).translate(0, HY + 0.002, 0), ...[-1, 1].map(s => new THREE.CylinderGeometry(0.011, 0.011, 0.008, 10).rotateZ(Math.PI / 2).translate(s * R * 1.08, HY, 0))]);
  const bag = new RoundedBoxGeometry(0.042, 0.05, 0.02, 1, 0.009).translate(0, 0.112, -0.032);
  const leg = new THREE.CapsuleGeometry(0.0118, 0.04, 2, 8).translate(0, -0.03, 0);
  const shoe = new THREE.CapsuleGeometry(0.0135, 0.02, 2, 8).rotateX(Math.PI / 2).scale(1.1, 0.8, 1).translate(0, -0.064, 0.008);
  const sole = new THREE.BoxGeometry(0.027, 0.006, 0.048).translate(0, -0.0735, 0.008);
  const arm = new THREE.CapsuleGeometry(0.0098, 0.04, 2, 8).translate(0, -0.027, 0);
  const hand = new THREE.SphereGeometry(0.0092, 8, 6).translate(0, -0.056, 0);
  return { name: 'Streetwear', HIP, SHOULDER, LEG_X, ARM_X, mat: 'toon2', ink: 0.0018, parts: { torso, head, face, ...hairs, capHat, phones, bag, leg, shoe, sole, arm, hand }, hairs: Object.keys(hairs), hat: { capHat: 0.3, phones: 0.3 } };
})();

// D: geometric. Faceted shapes like Monument Valley: a cone of a body, a ball of a head, a hat or a bob of hair.
STYLES.geo = (() => {
  const HIP = 0.07, SHOULDER = 0.135, LEG_X = 0.012, ARM_X = 0.03, R = 0.034, HY = 0.172;
  const torso = new THREE.CylinderGeometry(0.012, 0.032, 0.09, 7).translate(0, 0.104, 0);
  const head = new THREE.IcosahedronGeometry(R, 1).translate(0, HY, 0);
  const hairs = { hatcone: new THREE.ConeGeometry(R * 1.05, R * 1.4, 7).translate(0, HY + R * 1.2, 0), bobgeo: new THREE.IcosahedronGeometry(R * 1.08, 0).scale(1, 0.75, 1).translate(0, HY + R * 0.35, -0.004) };
  const leg = new THREE.CylinderGeometry(0.007, 0.007, 0.06, 5).translate(0, -0.03, 0);
  const shoe = new THREE.BoxGeometry(0.014, 0.01, 0.022).translate(0, -0.064, 0.004);
  const arm = new THREE.CylinderGeometry(0.0055, 0.0055, 0.05, 5).translate(0, -0.025, 0);
  const hand = new THREE.IcosahedronGeometry(0.007, 0).translate(0, -0.052, 0);
  return { name: 'Geometric', HIP, SHOULDER, LEG_X, ARM_X, mat: 'flat', ink: 0, parts: { torso, head, ...hairs, leg, shoe, arm, hand }, hairs: Object.keys(hairs) };
})();

// ---------- one figure, posed ----------
// pose: [legs forward (radians), arms forward, arms out]; walking swings legs and arms the opposite way.
export function figure(style, L, pose = [0, 0, 0.1], swing = 0) {
  const S = STYLES[style], P = S.parts, g = new THREE.Group();
  const add = (geo, hex, parent = g, ink = S.ink) => {
    if (!geo) return;
    if (S.inkOnly && !S.inkOnly.some(k => P[k] === geo)) ink = 0;
    const m = new THREE.Mesh(geo, material(S.mat, hex)); m.castShadow = true; m.receiveShadow = true; parent.add(m);
    if (ink) parent.add(new THREE.Mesh(inkOf(geo, ink), INK));
  };
  const mono = S.mono;
  add(P.torso, L.top); add(P.head, mono ? '#e9e4da' : L.skin); if (P.face) add(P.face, '#23252b', g, 0);
  const hatKind = S.hat && Object.keys(S.hat).find((k, i) => ((L.hatRoll ?? 0.5) + i * 0.37) % 1 < S.hat[k]);
  if (hatKind === 'capHat' || hatKind === 'beanie') add(P[hatKind], L.hat);
  else { add(P[L.style] || P[S.hairs[0]], mono ? '#9a958c' : L.hair); if (hatKind === 'phones') add(P.phones, L.hat); }
  if (L.bag && P.bag) add(P.bag, L.bag);
  if (S.extras?.band) add(P.band, L[S.extras.band], g, 0);
  if (S.extras?.hood && ((L.hatRoll ?? 0.5) * 7.3) % 1 < S.extras.hood) add(P.hood, L.top);
  if (S.extras?.skirt && ((L.hatRoll ?? 0.5) * 3.7 + 0.2) % 1 < S.extras.skirt) add(P.skirt, L.accent === '#fbfaf6' ? L.legs : L.accent);
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * S.LEG_X, S.HIP, 0); leg.rotation.x = pose[0] + swing * s;
    add(P.leg, mono ? '#d8d3c8' : L.legs, leg); add(P.shoe, mono ? '#9a958c' : L.shoes, leg); if (P.sole) add(P.sole, L.sole, leg, 0); g.add(leg);
    const arm = new THREE.Group(); arm.position.set(s * S.ARM_X, S.SHOULDER, 0); arm.rotation.set(pose[1] - swing * s * 0.9, 0, s * pose[2]);
    add(P.arm, mono ? L.top : L.sleeve, arm); add(P.hand, mono ? '#e9e4da' : L.skin, arm); g.add(arm);
  }
  return g;
}
export function triangles(style) { let t = 0; const P = STYLES[style].parts; for (const k of ['torso', 'head', 'face', 'leg', 'shoe', 'sole', 'arm', 'hand']) { const g = P[k]; if (!g) continue; const n = (g.index ? g.index.count : g.attributes.position.count) / 3; t += ['leg', 'shoe', 'sole', 'arm', 'hand'].includes(k) ? 2 * n : n; } const hair = P[STYLES[style].hairs[0]]; t += (hair.index ? hair.index.count : hair.attributes.position.count) / 3; return Math.round(t * (STYLES[style].ink ? 1.9 : 1)); }

// ---------- pass 2: "Crew" ----------
// Soft's proportions with Streetwear's details: a smaller head, a hoodie (some with the hood showing) with a band of
// colour across the chest, joggers, chunky sneakers with white soles, pill eyes, eyebrows and a small smile.
function crew({ mat, ink, smile = true, name }) {
  const HIP = 0.08, SHOULDER = 0.142, LEG_X = 0.014, ARM_X = 0.032, R = 0.036, HY = 0.186;
  const prof = [[0, 0.07], [0.027, 0.07], [0.029, 0.077], [0.029, 0.116], [0.027, 0.136], [0.018, 0.148], [0.009, 0.152], [0, 0.152]];
  const torso = join([lathe(prof, 16).scale(1.12, 1, 0.8), new THREE.BoxGeometry(0.032, 0.016, 0.004).translate(0, 0.088, 0.0236)]);
  const band = lathe([[0.0292, 0.106], [0.0292, 0.116]], 16).scale(1.12, 1, 0.8);
  const hood = new THREE.TorusGeometry(0.017, 0.0065, 6, 14, Math.PI * 1.4).rotateZ(-Math.PI * 0.2 - Math.PI / 2).scale(1.25, 1, 1).rotateX(Math.PI / 2 - 0.45).translate(0, 0.149, -0.011);
  const head = join([new THREE.SphereGeometry(R, 16, 12).scale(1, 1.06, 1).translate(0, HY, 0), new THREE.CylinderGeometry(0.009, 0.0105, 0.022, 8).translate(0, 0.154, 0)]);
  const pill = x => new THREE.CapsuleGeometry(0.0027, 0.0048, 2, 6).translate(x, HY + 0.002, R * 0.968);
  const brow = x => new THREE.BoxGeometry(0.0095, 0.0024, 0.002).rotateZ(x > 0 ? -0.12 : 0.12).translate(x, HY + 0.0142, R * 0.955);
  const mouth = new THREE.TorusGeometry(0.0055, 0.0012, 4, 8, Math.PI).rotateZ(Math.PI).translate(0, HY - 0.0085, R * 0.94);
  const face = join([pill(-0.0118), pill(0.0118), brow(-0.0118), brow(0.0118), ...(smile ? [mouth] : [])]);
  const top = (r, a1, tilt = -0.32, y = HY + 0.003) => cap(r, 0, a1, 16, 8).rotateX(tilt).translate(0, y, -0.002);
  const hairs = {
    fade: join([top(R * 1.03, Math.PI * 0.38, -0.42), new THREE.SphereGeometry(R * 0.8, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(1, 0.75, 1).translate(0, HY + R * 0.6, 0.002)]),
    curls: join([top(R * 1.04, Math.PI * 0.45), ...Array.from({ length: 12 }, (_, i) => { const a = i * 2.4, e = 0.3 + (i % 4) * 0.2; return new THREE.SphereGeometry(R * 0.34, 7, 5).translate(Math.cos(a) * Math.cos(e) * R * 0.95, HY + Math.sin(e) * R + 0.005, Math.sin(a) * Math.cos(e) * R * 0.95); })]),
    bun: join([top(R * 1.06, Math.PI * 0.5), new THREE.SphereGeometry(R * 0.45, 9, 7).translate(0, HY + R * 1.02, -R * 0.35)]),
    braids: join([top(R * 1.06, Math.PI * 0.5), ...[-1, 1].map(s => new THREE.CapsuleGeometry(R * 0.17, R * 1.25, 2, 6).translate(s * R * 0.78, HY - R * 0.55, -R * 0.4))]),
    long: join([top(R * 1.08, Math.PI * 0.55), new THREE.CylinderGeometry(R * 1.05, R * 1.13, R * 1.55, 14, 1, true, 0.75, Math.PI * 2 - 1.5).translate(0, HY - R * 0.4, -0.003)]),
    swoop: join([top(R * 1.05, Math.PI * 0.44, -0.38), new THREE.SphereGeometry(R * 0.62, 10, 6).scale(1.5, 0.45, 0.9).rotateZ(0.25).rotateX(0.3).translate(R * 0.18, HY + R * 0.8, R * 0.4)]),
    afro: join([top(R * 1.05, Math.PI * 0.5), new THREE.SphereGeometry(R * 1.32, 14, 10).scale(1, 0.9, 1).translate(0, HY + R * 0.42, -R * 0.12)]),
  };
  const capBack = join([cap(R * 1.08, 0, Math.PI * 0.42, 16, 7).rotateX(-0.2).translate(0, HY + 0.004, -0.002), new THREE.CylinderGeometry(R * 0.7, R * 0.7, 0.004, 12, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, 0.9).translate(0, HY + R * 0.48, -R * 0.62).rotateX(-0.08)]);
  const beanie = join([cap(R * 1.12, 0, Math.PI * 0.5, 16, 8).rotateX(-0.15).translate(0, HY + 0.004, -0.001), new THREE.TorusGeometry(R * 1.06, R * 0.17, 6, 18).rotateX(Math.PI / 2 - 0.15).translate(0, HY + 0.006, 0)]);
  const phones = join([new THREE.TorusGeometry(R * 1.12, 0.0035, 5, 18, Math.PI).translate(0, HY + 0.002, 0), ...[-1, 1].map(s => new THREE.CylinderGeometry(0.011, 0.011, 0.008, 10).rotateZ(Math.PI / 2).translate(s * R * 1.08, HY, 0))]);
  const bag = new RoundedBoxGeometry(0.04, 0.048, 0.02, 1, 0.009).translate(0, 0.114, -0.031);
  const leg = new THREE.CapsuleGeometry(0.0112, 0.044, 2, 8).translate(0, -0.033, 0);
  const shoe = new THREE.CapsuleGeometry(0.0128, 0.018, 2, 8).rotateX(Math.PI / 2).scale(1.08, 0.78, 1).translate(0, -0.068, 0.007);
  const sole = new THREE.BoxGeometry(0.026, 0.006, 0.046).translate(0, -0.0775, 0.007);
  const arm = new THREE.CapsuleGeometry(0.0094, 0.041, 2, 8).translate(0, -0.027, 0);
  const hand = new THREE.SphereGeometry(0.009, 8, 6).translate(0, -0.056, 0);
  return { name, HIP, SHOULDER, LEG_X, ARM_X, mat, ink, parts: { torso, band, hood, head, face, ...hairs, capBack, beanie, phones, bag, leg, shoe, sole, arm, hand }, hairs: Object.keys(hairs), hat: { capBack: 0.18, beanie: 0.14, phones: 0.2 }, extras: { band: 'accent', hood: 0.5 } };
}
STYLES.crew = crew({ mat: 'toon2', ink: 0.0016, name: 'Crew (two-tone, thin line)' });
STYLES.crewSoft = crew({ mat: 'lambert', ink: 0, name: 'Crew (soft light, no line)' });
STYLES.crewToon = crew({ mat: 'toon2', ink: 0, name: 'Crew (two-tone, no line)' });

// ---------- pass 3: "Crew" refined ----------
// A smaller head and longer legs; skirts for some; outlines only round the silhouette (body, head, hair, limbs),
// none on hands, faces, soles or the chest band; fewer segments.
function crew3({ name, ink = 0.0016 }) {
  const HIP = 0.086, SHOULDER = 0.146, LEG_X = 0.0135, ARM_X = 0.031, R = 0.0335, HY = 0.189;
  const prof = [[0, 0.076], [0.026, 0.076], [0.028, 0.083], [0.028, 0.12], [0.026, 0.139], [0.017, 0.151], [0.009, 0.155], [0, 0.155]];
  const torso = join([lathe(prof, 14).scale(1.12, 1, 0.8), new THREE.BoxGeometry(0.03, 0.015, 0.004).translate(0, 0.093, 0.0228)]);
  const band = lathe([[0.0283, 0.11], [0.0283, 0.119]], 14).scale(1.12, 1, 0.8);
  const hood = new THREE.TorusGeometry(0.016, 0.006, 5, 12, Math.PI * 1.4).rotateZ(-Math.PI * 0.2 - Math.PI / 2).scale(1.25, 1, 1).rotateX(Math.PI / 2 - 0.45).translate(0, 0.152, -0.011);
  const skirt = new THREE.CylinderGeometry(0.029, 0.038, 0.03, 14, 1, true).scale(1.1, 1, 0.85).translate(0, 0.071, 0);
  const head = join([new THREE.SphereGeometry(R, 14, 10).scale(1, 1.06, 1).translate(0, HY, 0), new THREE.CylinderGeometry(0.0085, 0.01, 0.022, 8).translate(0, 0.157, 0)]);
  const pill = x => new THREE.CapsuleGeometry(0.0025, 0.0045, 2, 6).translate(x, HY + 0.002, R * 0.968);
  const brow = x => new THREE.BoxGeometry(0.009, 0.0022, 0.002).rotateZ(x > 0 ? -0.12 : 0.12).translate(x, HY + 0.0135, R * 0.955);
  const mouth = new THREE.TorusGeometry(0.005, 0.0011, 3, 8, Math.PI).rotateZ(Math.PI).translate(0, HY - 0.008, R * 0.94);
  const face = join([pill(-0.011), pill(0.011), brow(-0.011), brow(0.011), mouth]);
  const top = (r, a1, tilt = -0.32, y = HY + 0.003) => cap(r, 0, a1, 14, 7).rotateX(tilt).translate(0, y, -0.002);
  const hairs = {
    fade: join([top(R * 1.03, Math.PI * 0.38, -0.42), new THREE.SphereGeometry(R * 0.8, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(1, 0.75, 1).translate(0, HY + R * 0.6, 0.002)]),
    curls: join([top(R * 1.04, Math.PI * 0.45), ...Array.from({ length: 9 }, (_, i) => { const a = i * 2.4, e = 0.3 + (i % 3) * 0.28; return new THREE.SphereGeometry(R * 0.38, 6, 4).translate(Math.cos(a) * Math.cos(e) * R * 0.95, HY + Math.sin(e) * R + 0.005, Math.sin(a) * Math.cos(e) * R * 0.95); })]),
    bun: join([top(R * 1.06, Math.PI * 0.5), new THREE.SphereGeometry(R * 0.45, 8, 6).translate(0, HY + R * 1.02, -R * 0.35)]),
    braids: join([top(R * 1.06, Math.PI * 0.5), ...[-1, 1].map(s => new THREE.CapsuleGeometry(R * 0.17, R * 1.25, 2, 6).translate(s * R * 0.78, HY - R * 0.55, -R * 0.4))]),
    long: join([top(R * 1.08, Math.PI * 0.55), new THREE.CylinderGeometry(R * 1.05, R * 1.13, R * 1.55, 12, 1, true, 0.75, Math.PI * 2 - 1.5).translate(0, HY - R * 0.4, -0.003)]),
    swoop: join([top(R * 1.05, Math.PI * 0.44, -0.38), new THREE.SphereGeometry(R * 0.62, 9, 5).scale(1.5, 0.45, 0.9).rotateZ(0.25).rotateX(0.3).translate(R * 0.18, HY + R * 0.8, R * 0.4)]),
    afro: join([top(R * 1.05, Math.PI * 0.5), new THREE.SphereGeometry(R * 1.3, 12, 8).scale(1, 0.9, 1).translate(0, HY + R * 0.42, -R * 0.12)]),
  };
  const capBack = join([cap(R * 1.08, 0, Math.PI * 0.42, 14, 6).rotateX(-0.2).translate(0, HY + 0.004, -0.002), new THREE.CylinderGeometry(R * 0.7, R * 0.7, 0.004, 10, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, 0.9).translate(0, HY + R * 0.48, -R * 0.62).rotateX(-0.08)]);
  const beanie = join([cap(R * 1.12, 0, Math.PI * 0.5, 14, 7).rotateX(-0.15).translate(0, HY + 0.004, -0.001), new THREE.TorusGeometry(R * 1.06, R * 0.17, 5, 16).rotateX(Math.PI / 2 - 0.15).translate(0, HY + 0.006, 0)]);
  const phones = join([new THREE.TorusGeometry(R * 1.12, 0.0033, 4, 16, Math.PI).translate(0, HY + 0.002, 0), ...[-1, 1].map(s => new THREE.CylinderGeometry(0.0105, 0.0105, 0.008, 10).rotateZ(Math.PI / 2).translate(s * R * 1.08, HY, 0))]);
  const bag = new RoundedBoxGeometry(0.038, 0.046, 0.019, 1, 0.008).translate(0, 0.118, -0.03);
  const leg = new THREE.CapsuleGeometry(0.0108, 0.05, 2, 7).translate(0, -0.036, 0);
  const shoe = new THREE.CapsuleGeometry(0.0124, 0.017, 2, 7).rotateX(Math.PI / 2).scale(1.08, 0.78, 1).translate(0, -0.074, 0.007);
  const sole = new THREE.BoxGeometry(0.025, 0.006, 0.044).translate(0, -0.0835, 0.007);
  const arm = new THREE.CapsuleGeometry(0.009, 0.043, 2, 7).translate(0, -0.028, 0);
  const hand = new THREE.SphereGeometry(0.0087, 7, 5).translate(0, -0.058, 0);
  return { name, HIP, SHOULDER, LEG_X, ARM_X, mat: 'toon2', ink, inkOnly: ['torso', 'head', 'hood', 'skirt', 'bag', 'leg', 'shoe', 'arm', 'capBack', 'beanie', ...Object.keys(hairs)],
    parts: { torso, band, hood, skirt, head, face, ...hairs, capBack, beanie, phones, bag, leg, shoe, sole, arm, hand }, hairs: Object.keys(hairs), hat: { capBack: 0.14, beanie: 0.1, phones: 0.1 }, extras: { band: 'accent', hood: 0.45, skirt: 0.3 } };
}
STYLES.crew3 = crew3({ name: 'Crew, pass 3' });
