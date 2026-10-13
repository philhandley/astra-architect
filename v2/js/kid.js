// The children, designed: real proportions for a seven-year-old (the head about a fifth of their height), a hoodie
// with a band of colour across the chest (some with the hood showing, some with a skirt over their joggers), chunky
// sneakers with white soles, calm little faces (pill eyes, eyebrows, a small smile) and stylish hair: a fade, curls,
// a bun, braids, long hair, a swoop, an afro, a cap worn backwards or a beanie; some wear headphones, some a backpack.
// Two-tone shading and a thin ink line round the silhouette only, to match the outlines on the buildings.
// (Phil found the earlier picture-book toys too childish; this design came out of five passes in dev/characters.html.)
// crowd.js draws hundreds of them at once from these parts; miniKid() makes a single one (on a slide, a zipline...).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// The body (feet at y = 0, facing +z; a grown-up is the same figure drawn bigger).
export const HIP = 0.086, SHOULDER = 0.146, LEG_X = 0.0135, ARM_X = 0.031;
export const SEAT = HIP - 0.004;              // where a sitting child's bum is, above their feet
export const REACH = SHOULDER + 0.057;         // how high their hands are with their arms straight up
export const SIT_DROP = HIP - 0.05;            // how far the crowd lowers a sitting child: hips just above a stool
export const SWIM_DROP = 0.138;                // and a swimmer, so the head is just out of the water
const R = 0.0335, HEAD_Y = 0.189;

// Outfits that go together: a hoodie, its sleeves, trousers, shoes and an accent (the chest band; a skirt).
export const OUTFITS = [
  { top: '#f4c23d', sleeve: '#f4c23d', shorts: '#2f4b7c', shoes: '#fbfaf6', accent: '#2f4b7c' },
  { top: '#e6463c', sleeve: '#fbfaf6', shorts: '#3d405b', shoes: '#22b2bf', accent: '#fbfaf6' },
  { top: '#22b2bf', sleeve: '#22b2bf', shorts: '#f4c23d', shoes: '#fbfaf6', accent: '#f4c23d' },
  { top: '#2f4b7c', sleeve: '#e2457d', shorts: '#c9ccd3', shoes: '#e2457d', accent: '#e2457d' },
  { top: '#fbfaf6', sleeve: '#3d8de0', shorts: '#3d8de0', shoes: '#f4c23d', accent: '#3d8de0' },
  { top: '#8bc34a', sleeve: '#8bc34a', shorts: '#2f4b7c', shoes: '#fbfaf6', accent: '#fbfaf6' },
  { top: '#9a6cd4', sleeve: '#9a6cd4', shorts: '#26272d', shoes: '#fbfaf6', accent: '#f4c23d' },
  { top: '#ea7b2c', sleeve: '#26272d', shorts: '#26272d', shoes: '#ea7b2c', accent: '#26272d' },
  { top: '#e2457d', sleeve: '#e2457d', shorts: '#fbfaf6', shoes: '#3d405b', accent: '#fbfaf6' },
];
export const SKIN = ['#f6d7bf', '#e7b892', '#c98c62', '#9a6544', '#6e4630'];
export const HAIR = ['#3b2a20', '#1f1b18', '#b5652e', '#e3b65a', '#6b4128', '#2a2320'];
export const BRIGHT = ['#22b2bf', '#e6463c', '#f4c23d', '#9a6cd4', '#3d8de0', '#26272d'];
// Hairstyles (the last two are hats, in the hat colour). Each is one part, named the same.
export const HAIRDOS = ['fade', 'curls', 'bun', 'braids', 'long', 'swoop', 'afro', 'capBack', 'beanie'];
export const HAIR_PART = HAIRDOS;
export const HATS = new Set(['capBack', 'beanie']);
// Parts that only some children have (each lists just those children in crowd.js).
export const EXTRAS = ['hood', 'skirt', 'phones', 'bag'];

// A look from a whole number: the outfit, skin, hair and extras are each picked independently.
export function kidLook(n) {
  let h = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b) >>> 0; h = (h ^ (h >>> 13)) >>> 0; h = Math.imul(h, 0xc2b2ae35) >>> 0; h = (h ^ (h >>> 16)) >>> 0;
  let h2 = Math.imul(h ^ 0x27d4eb2f, 0x165667b1) >>> 0; h2 = (h2 ^ (h2 >>> 15)) >>> 0;
  const o = OUTFITS[h % OUTFITS.length], style = (h >>> 8) % 11 < 9 ? (h >>> 8) % 11 : (h >>> 12) % 7;       // (hats a little rarer)
  return { ...o, skin: SKIN[(h >>> 4) % SKIN.length], hair: HAIR[(h >>> 16) % HAIR.length], style, hat: BRIGHT[(h >>> 20) % BRIGHT.length],
    bag: h2 % 3 === 0 ? BRIGHT[(h2 >>> 3) % BRIGHT.length] : null, hood: (h2 >>> 6) % 20 < 9,
    skirt: (h2 >>> 11) % 10 < 3 ? (o.accent === '#fbfaf6' ? o.shorts : o.accent) : null, phones: !HATS.has(HAIRDOS[style]) && (h2 >>> 15) % 10 === 0 };
}

// Several pieces as one geometry (just positions and normals).
function join(list) {
  const parts = list.map(g => (g.index ? g.toNonIndexed() : g)), out = new THREE.BufferGeometry();
  for (const k of ['position', 'normal']) {
    const arr = new Float32Array(parts.reduce((n, g) => n + g.attributes[k].array.length, 0));
    let at = 0; for (const g of parts) { arr.set(g.attributes[k].array, at); at += g.attributes[k].array.length; }
    out.setAttribute(k, new THREE.BufferAttribute(arr, 3));
  }
  return out;
}
const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const cap = (r, a0, a1, seg = 12, rings = 6) => new THREE.SphereGeometry(r, seg, rings, 0, Math.PI * 2, a0, a1);
// The top of the hair: a cap of the head, tipped back so the fringe stays above the eyebrows.
const top = (r, a1, tilt) => cap(r, 0, a1).rotateX(tilt).translate(0, HEAD_Y + 0.003, -0.002);
let PARTS = null;
export function kidParts() {
  if (PARTS) return PARTS;
  const prof = [[0, 0.076], [0.026, 0.076], [0.028, 0.083], [0.028, 0.12], [0.026, 0.139], [0.017, 0.151], [0.009, 0.155], [0, 0.155]];
  const pill = x => new THREE.SphereGeometry(0.0026, 5, 4).scale(1, 1.75, 0.8).translate(x, HEAD_Y + 0.002, R * 0.975);
  const brow = x => new THREE.BoxGeometry(0.009, 0.0022, 0.002).rotateZ(x > 0 ? -0.12 : 0.12).translate(x, HEAD_Y + 0.0135, R * 0.955);
  PARTS = {
    torso: join([lathe(prof, 12).scale(1.12, 1, 0.8), new THREE.BoxGeometry(0.03, 0.015, 0.004).translate(0, 0.093, 0.0228)]),     // (with a front pocket)
    band: lathe([[0.0283, 0.11], [0.0283, 0.119]], 12).scale(1.12, 1, 0.8),
    hood: new THREE.TorusGeometry(0.016, 0.006, 5, 10, Math.PI * 1.4).rotateZ(-Math.PI * 0.2 - Math.PI / 2).scale(1.25, 1, 1).rotateX(Math.PI / 2 - 0.45).translate(0, 0.152, -0.011),
    skirt: new THREE.CylinderGeometry(0.029, 0.038, 0.03, 12, 1, true).scale(1.1, 1, 0.85).translate(0, 0.071, 0),
    head: join([new THREE.SphereGeometry(R, 12, 9).scale(1, 1.06, 1).translate(0, HEAD_Y, 0), new THREE.CylinderGeometry(0.0085, 0.01, 0.022, 7).translate(0, 0.157, 0)]),
    eyes: join([pill(-0.011), pill(0.011), brow(-0.011), brow(0.011), new THREE.TorusGeometry(0.005, 0.0011, 3, 7, Math.PI).rotateZ(Math.PI).translate(0, HEAD_Y - 0.008, R * 0.94)]),
    fade: join([top(R * 1.03, Math.PI * 0.38, -0.42), new THREE.SphereGeometry(R * 0.8, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(1, 0.75, 1).translate(0, HEAD_Y + R * 0.6, 0.002)]),
    curls: join([top(R * 1.04, Math.PI * 0.45, -0.32), ...Array.from({ length: 8 }, (_, i) => { const a = i * 2.4, e = 0.3 + (i % 3) * 0.28; return new THREE.SphereGeometry(R * 0.4, 6, 4).translate(Math.cos(a) * Math.cos(e) * R * 0.95, HEAD_Y + Math.sin(e) * R + 0.005, Math.sin(a) * Math.cos(e) * R * 0.95); })]),
    bun: join([top(R * 1.06, Math.PI * 0.5, -0.42), new THREE.SphereGeometry(R * 0.45, 7, 5).translate(0, HEAD_Y + R * 1.0, -R * 0.4)]),
    braids: join([top(R * 1.06, Math.PI * 0.5, -0.42), ...[-1, 1].map(s => new THREE.CapsuleGeometry(R * 0.17, R * 1.25, 1, 5).translate(s * R * 0.78, HEAD_Y - R * 0.55, -R * 0.4))]),
    long: join([top(R * 1.08, Math.PI * 0.55, -0.55), new THREE.CylinderGeometry(R * 1.05, R * 1.13, R * 1.55, 10, 1, true, 0.8, Math.PI * 2 - 1.6).translate(0, HEAD_Y - R * 0.4, -0.003)]),
    swoop: join([top(R * 1.05, Math.PI * 0.44, -0.38), new THREE.SphereGeometry(R * 0.62, 8, 5).scale(1.5, 0.45, 0.9).rotateZ(0.25).rotateX(0.3).translate(R * 0.18, HEAD_Y + R * 0.82, R * 0.4)]),
    afro: join([top(R * 1.05, Math.PI * 0.5, -0.42), new THREE.SphereGeometry(R * 1.3, 11, 7).scale(1, 0.9, 1).translate(0, HEAD_Y + R * 0.42, -R * 0.12)]),
    capBack: join([cap(R * 1.08, 0, Math.PI * 0.42).rotateX(-0.2).translate(0, HEAD_Y + 0.004, -0.002), new THREE.CylinderGeometry(R * 0.7, R * 0.7, 0.004, 9, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, 0.9).translate(0, HEAD_Y + R * 0.48, -R * 0.62).rotateX(-0.08)]),
    beanie: join([cap(R * 1.12, 0, Math.PI * 0.5).rotateX(-0.15).translate(0, HEAD_Y + 0.004, -0.001), new THREE.TorusGeometry(R * 1.06, R * 0.17, 4, 14).rotateX(Math.PI / 2 - 0.15).translate(0, HEAD_Y + 0.006, 0)]),
    phones: join([new THREE.TorusGeometry(R * 1.12, 0.0033, 4, 14, Math.PI).translate(0, HEAD_Y + 0.002, 0), ...[-1, 1].map(s => new THREE.CylinderGeometry(0.0105, 0.0105, 0.008, 9).rotateZ(Math.PI / 2).translate(s * R * 1.08, HEAD_Y, 0))]),
    bag: new RoundedBoxGeometry(0.038, 0.046, 0.019, 1, 0.008).translate(0, 0.118, -0.03),
    leg: new THREE.CapsuleGeometry(0.0108, 0.05, 1, 7).translate(0, -0.036, 0),                       // hangs from the hip
    shoe: new THREE.CapsuleGeometry(0.0124, 0.017, 1, 7).rotateX(Math.PI / 2).scale(1.08, 0.78, 1).translate(0, -0.074, 0.007),
    sole: new THREE.BoxGeometry(0.025, 0.006, 0.044).translate(0, -0.0835, 0.007),
    arm: new THREE.CapsuleGeometry(0.009, 0.043, 1, 7).translate(0, -0.028, 0),                      // hangs from the shoulder
    hand: new THREE.SphereGeometry(0.0087, 6, 5).translate(0, -0.058, 0),
  };
  for (const g of Object.values(PARTS)) { if (g.attributes.uv) g.deleteAttribute('uv'); g.userData.shared = true; }
  return PARTS;
}
// Parts drawn with an ink line (the silhouette); hands, faces, soles, the band and headphones have none.
export const INKED = new Set(['torso', 'hood', 'skirt', 'head', 'bag', 'leg', 'shoe', 'arm', ...HAIRDOS]);

// Flat shading in two tones, and the ink line: each part again, a little fatter, drawn inside out in dark grey.
const RAMP = (() => { const t = new THREE.DataTexture(new Uint8Array([150, 255]), 2, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toons = new Map();
export function toon(hex = '#ffffff') { if (!toons.has(hex)) { const m = new THREE.MeshToonMaterial({ color: hex, gradientMap: RAMP }); m.userData.shared = true; toons.set(hex, m); } return toons.get(hex); }
export const KID_LINE = new THREE.MeshBasicMaterial({ color: '#23252b', side: THREE.BackSide });
KID_LINE.userData.shared = true;
const lines = new Map();
export function inkOf(geo, w = 0.0016) {
  if (lines.has(geo)) return lines.get(geo);
  const g = geo.clone(), p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * w, p.getY(i) + n.getY(i) * w, p.getZ(i) + n.getZ(i) * w);
  g.userData.shared = true; lines.set(geo, g);
  return g;
}

// Poses for a child who is not part of the crowd: [legs forward, arms raised, arms out] in radians.
const POSES = {
  stand: [0, 0, 0.1], sit: [-1.45, -0.5, 0.1], ride: [-1.45, -1.0, 0.1], hold: [0, -1.1, 0.1],
  swing: [-1.2, -2.84, 0.4], hang: [-0.4, -2.95, -0.25], climb: [-0.3, -2.7, 0.3],
};
// One child, still, in a pose (feet at y = 0 standing; sitting, their bum is at SEAT).
let miniN = 0;
export function miniKid(pose = 'stand') {
  const P = kidParts(), L = kidLook(miniN++ * 7 + 3), k = new THREE.Group(), [legX, armX, out] = POSES[pose] || POSES.stand;
  k.userData.pose = pose;
  const add = (name, hex, parent = k) => {
    const geo = P[name], m = new THREE.Mesh(geo, toon(hex)); m.castShadow = name === 'torso' || name === 'head'; m.raycast = () => {}; m.userData.people = true; parent.add(m);
    if (INKED.has(name)) { const o = new THREE.Mesh(inkOf(geo), KID_LINE); o.raycast = () => {}; o.userData.people = true; parent.add(o); }
  };
  add('torso', L.top); add('band', L.accent); add('head', L.skin); add('eyes', '#23252b');
  const hair = HAIRDOS[L.style]; add(hair, HATS.has(hair) ? L.hat : L.hair);
  if (L.hood) add('hood', L.top);
  if (L.skirt) add('skirt', L.skirt);
  if (L.phones) add('phones', L.hat);
  if (L.bag) add('bag', L.bag);
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * LEG_X, HIP, 0); leg.rotation.x = legX; leg.userData.limb = 'leg'; leg.userData.s = s; add('leg', L.shorts, leg); add('shoe', L.shoes, leg); add('sole', '#fbfaf6', leg); k.add(leg);
    const arm = new THREE.Group(); arm.position.set(s * ARM_X, SHOULDER, 0); arm.rotation.set(armX, 0, s * out); arm.userData.limb = 'arm'; arm.userData.s = s; add('arm', L.sleeve, arm); add('hand', L.skin, arm); k.add(arm);
  }
  return k;
}
