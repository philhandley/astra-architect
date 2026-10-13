// The children, drawn like picture-book toys: a big head with sculpted hair (a bob, a quiff, a round puff, a cap,
// bunches or a ponytail), an A-line top, an outfit whose colours go together, chunky shoes and sometimes a
// backpack. Flat, three-tone shading and a dark ink line round each part, to match the outlines on the buildings.
// crowd.js draws hundreds of them at once from these parts; miniKid() makes a single one (on a slide, a zipline...).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// The body (feet at y = 0, facing +z; a grown-up is drawn at full size, children a bit smaller).
export const HIP = 0.06, SHOULDER = 0.128, LEG_X = 0.015, ARM_X = 0.034, SEAT = 0.058;
const R = 0.046, HEAD_Y = 0.176;

// Outfits that go together: [top, trousers, shoes].
export const OUTFITS = [['#f4c23d', '#2f4b7c', '#fbfaf6'], ['#e6463c', '#22b2bf', '#fbfaf6'], ['#22b2bf', '#f4c23d', '#e6463c'], ['#e2457d', '#3d405b', '#fbfaf6'],
  ['#3d8de0', '#ea7b2c', '#fbfaf6'], ['#8bc34a', '#2f4b7c', '#f4c23d'], ['#9a6cd4', '#f4c23d', '#fbfaf6'], ['#fbfaf6', '#e6463c', '#2f4b7c'], ['#ea7b2c', '#3d8de0', '#fbfaf6']];
export const SKIN = ['#f6d7bf', '#e7b892', '#c98c62', '#9a6544', '#6e4630'];
export const HAIR = ['#3b2a20', '#1f1b18', '#b5652e', '#e3b65a', '#6b4128'];
export const BRIGHT = ['#22b2bf', '#e6463c', '#f4c23d', '#9a6cd4', '#3d8de0'];
export const HAIRDOS = ['bob', 'quiff', 'puff', 'cap', 'bunches', 'pony'];

// A look from a whole number: the outfit, skin, hair colour and style are each picked independently.
export function kidLook(n) {
  let h = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b) >>> 0; h = (h ^ (h >>> 13)) >>> 0; h = Math.imul(h, 0xc2b2ae35) >>> 0; h = (h ^ (h >>> 16)) >>> 0;
  const [top, shorts, shoes] = OUTFITS[h % OUTFITS.length];
  return { top, shorts, shoes, skin: SKIN[(h >>> 4) % SKIN.length], hair: HAIR[(h >>> 8) % HAIR.length], style: (h >>> 12) % HAIRDOS.length,
    hat: BRIGHT[(h >>> 16) % BRIGHT.length], bag: (h >>> 20) % 3 === 0 ? BRIGHT[(h >>> 22) % BRIGHT.length] : null };
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
const cap = (r, a0, a1, tilt, y = HEAD_Y + 0.002) => new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, a0, a1).rotateX(tilt).translate(0, y, -0.004);
let PARTS = null;
export function kidParts() {
  if (PARTS) return PARTS;
  const prof = [[0, 0.058], [0.035, 0.058], [0.037, 0.064], [0.03, 0.118], [0.022, 0.135], [0.012, 0.142], [0, 0.142]].map(([r, y]) => new THREE.Vector2(r, y));
  const eye = x => new THREE.SphereGeometry(0.0055, 5, 4).scale(0.75, 1.15, 0.5).translate(x, HEAD_Y - 0.002, R - 0.003);
  PARTS = {
    torso: new THREE.LatheGeometry(prof, 14),
    head: new THREE.SphereGeometry(R, 14, 10).translate(0, HEAD_Y, 0),
    eyes: join([eye(-0.015), eye(0.015)]),
    // One piece of hair for each style (only the child's own style is shown).
    bob: cap(R * 1.08, 0, Math.PI * 0.62, -0.3).scale(1.06, 1, 1.04),
    quiff: join([cap(R * 1.05, 0, Math.PI * 0.46, -0.45), new THREE.SphereGeometry(R * 0.5, 9, 5).scale(1.2, 0.7, 1).rotateX(0.5).translate(0, HEAD_Y + R * 0.92, R * 0.35)]),
    puff: new THREE.SphereGeometry(R * 1.18, 13, 9).translate(0, HEAD_Y + R * 0.3, -R * 0.2),
    capHair: cap(R * 1.04, Math.PI * 0.38, Math.PI * 0.2, -0.4, HEAD_Y),
    bunches: join([cap(R * 1.05, 0, Math.PI * 0.5, -0.4), ...[-1, 1].map(s => new THREE.SphereGeometry(R * 0.42, 8, 6).translate(s * R * 1.05, HEAD_Y + R * 0.15, -R * 0.2))]),
    pony: join([cap(R * 1.05, 0, Math.PI * 0.5, -0.4), new THREE.SphereGeometry(R * 0.4, 8, 6).scale(0.8, 1.5, 0.8).rotateX(0.5).translate(0, HEAD_Y + R * 0.15, -R * 1.15)]),
    hat: join([new THREE.SphereGeometry(R * 1.07, 13, 6, 0, Math.PI * 2, 0, Math.PI * 0.42).rotateX(-0.2).translate(0, HEAD_Y + 0.003, -0.002),
      new THREE.CylinderGeometry(R * 0.75, R * 0.75, 0.005, 10, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, 0.9).translate(0, HEAD_Y + R * 0.55, R * 0.62).rotateX(0.1)]),
    leg: new THREE.CapsuleGeometry(0.0105, 0.026, 2, 7).translate(0, -0.02, 0),                     // hangs from the hip
    shoe: new THREE.CapsuleGeometry(0.0105, 0.012, 2, 7).rotateX(Math.PI / 2).scale(1.05, 0.8, 1).translate(0, -0.048, 0.006),
    arm: new THREE.CapsuleGeometry(0.009, 0.03, 2, 7).translate(0, -0.022, 0),                      // hangs from the shoulder
    hand: new THREE.SphereGeometry(0.0095, 7, 5).translate(0, -0.05, 0),
    bag: new RoundedBoxGeometry(0.046, 0.05, 0.022, 1, 0.01).translate(0, 0.104, -0.034),
  };
  for (const g of Object.values(PARTS)) { g.deleteAttribute('uv'); g.userData.shared = true; }
  return PARTS;
}
// Which hair piece each style uses (the cap style also wears the hat).
export const HAIR_PART = ['bob', 'quiff', 'puff', 'capHair', 'bunches', 'pony'];

// Flat shading in three tones, and the ink line: each part again, a little fatter, drawn inside out in dark grey.
const RAMP = (() => { const t = new THREE.DataTexture(new Uint8Array([95, 178, 255]), 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toons = new Map();
export function toon(hex = '#ffffff') { if (!toons.has(hex)) { const m = new THREE.MeshToonMaterial({ color: hex, gradientMap: RAMP }); m.userData.shared = true; toons.set(hex, m); } return toons.get(hex); }
export const KID_LINE = new THREE.MeshBasicMaterial({ color: '#23252b', side: THREE.BackSide });
KID_LINE.userData.shared = true;
const lines = new Map();
export function inkOf(geo, w = 0.003) {
  if (lines.has(geo)) return lines.get(geo);
  const g = geo.clone(), p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * w, p.getY(i) + n.getY(i) * w, p.getZ(i) + n.getZ(i) * w);
  g.userData.shared = true; lines.set(geo, g);
  return g;
}

// Poses for a child who is not part of the crowd: [legs forward, arms raised, arms out] in radians.
const POSES = {
  stand: [0, 0, 0.12], sit: [-1.45, -0.5, 0.12], ride: [-1.45, -1.0, 0.12], hold: [0, -1.1, 0.12],
  swing: [-1.2, -2.84, 0.45], hang: [-0.4, -2.95, -0.3], climb: [-0.3, -2.7, 0.3],
};
// One child, still, in a pose (feet at y = 0 standing; the bottom of the top is at y = 0.058 for sitting).
let miniN = 0;
export function miniKid(pose = 'stand') {
  const P = kidParts(), L = kidLook(miniN++ * 7 + 3), k = new THREE.Group(), [legX, armX, out] = POSES[pose] || POSES.stand;
  k.userData.pose = pose;
  const add = (geo, hex, parent = k, line = true) => {
    const m = new THREE.Mesh(geo, toon(hex)); m.castShadow = geo === P.torso || geo === P.head; m.raycast = () => {}; m.userData.people = true; parent.add(m);
    if (line) { const o = new THREE.Mesh(inkOf(geo), KID_LINE); o.raycast = () => {}; o.userData.people = true; parent.add(o); }
  };
  add(P.torso, L.top); add(P.head, L.skin); add(P.eyes, '#23252b', k, false);
  add(P[HAIR_PART[L.style]], L.hair);
  if (L.style === 3) add(P.hat, L.hat);
  if (L.bag) add(P.bag, L.bag);
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * LEG_X, HIP, 0); leg.rotation.x = legX; leg.userData.limb = 'leg'; leg.userData.s = s; add(P.leg, L.shorts, leg); add(P.shoe, L.shoes, leg); k.add(leg);
    const arm = new THREE.Group(); arm.position.set(s * ARM_X, SHOULDER, 0); arm.rotation.set(armX, 0, s * out); arm.userData.limb = 'arm'; arm.userData.s = s; add(P.arm, L.top, arm); add(P.hand, L.skin, arm); k.add(arm);
  }
  return k;
}
