// The children, designed like architects' scale figures (round two, after Phil asked for cool, designed characters
// that look less childish; ten passes in dev/characters.html, with research into architectural scale figures,
// Monument Valley, Untitled Goose Game and Sprite Fright's simple chunky shapes):
// about five and a half heads tall, a calm face (two small dot eyes, or none), simple solid hair, square shoulders,
// a straight-cut top (some with Breton stripes or a white collar), an A-line coat or a skirt on some, slim trousers,
// rounded sneakers, a slim backpack, sometimes a bucket hat or a beanie. Fresh colours mixed with muted ones, soft
// light and no outline (like the furniture).
// crowd.js draws hundreds of them at once from these parts; miniKid() makes a single one (on a slide, a zipline...).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// The body (feet at y = 0, facing +z; a grown-up is the same figure drawn bigger).
export const HIP = 0.088, SHOULDER = 0.149, LEG_X = 0.0118, ARM_X = 0.0285;
export const SEAT = HIP - 0.004;              // where a sitting child's bum is, above their feet
export const REACH = SHOULDER + 0.063;         // how high their hands are with their arms straight up
export const SIT_DROP = HIP - 0.05;            // how far the crowd lowers a sitting child: hips just above a stool
export const SWIM_DROP = 0.138;                // and a swimmer, so the head is just out of the water
export const FACE = true;                      // two small dot eyes (false: faceless, like a scale figure)
const R = 0.0295, HEAD_Y = 0.189;

// Outfits that go together: a top, its sleeves, trousers, shoes and an accent (a skirt; stripes on a white top).
export const OUTFITS = [
  { top: '#3b6fb6', sleeve: '#3b6fb6', shorts: '#efe9dc', shoes: '#3c3f45', accent: '#efe9dc' },
  { top: '#e0573d', sleeve: '#e0573d', shorts: '#2f3e5c', shoes: '#efe9dc', accent: '#2f3e5c' },
  { top: '#5f9e6e', sleeve: '#5f9e6e', shorts: '#3c3f45', shoes: '#efe9dc', accent: '#efe9dc' },
  { top: '#e8b84a', sleeve: '#e8b84a', shorts: '#2f3e5c', shoes: '#efe9dc', accent: '#2f3e5c' },
  { top: '#efe9dc', sleeve: '#efe9dc', shorts: '#3b6fb6', shoes: '#3c3f45', accent: '#3b6fb6' },
  { top: '#c8664a', sleeve: '#c8664a', shorts: '#3c3f45', shoes: '#efe9dc', accent: '#efe9dc' },
  { top: '#9bb39a', sleeve: '#9bb39a', shorts: '#2f3e5c', shoes: '#efe9dc', accent: '#2f3e5c' },
  { top: '#2f3e5c', sleeve: '#2f3e5c', shorts: '#cbb894', shoes: '#efe9dc', accent: '#efe9dc' },
  { top: '#d99a9a', sleeve: '#d99a9a', shorts: '#3c3f45', shoes: '#efe9dc', accent: '#3c3f45' },
  { top: '#4f8a8b', sleeve: '#4f8a8b', shorts: '#efe9dc', shoes: '#3c3f45', accent: '#efe9dc' },
  { top: '#3c3f45', sleeve: '#3c3f45', shorts: '#e0573d', shoes: '#efe9dc', accent: '#e8b84a' },
  { top: '#e3c9a8', sleeve: '#e3c9a8', shorts: '#6b4a3a', shoes: '#3c3f45', accent: '#6b4a3a' },
];
export const SKIN = ['#f3d4bd', '#e2b590', '#c68b62', '#98653f', '#6c4630'];
export const HAIR = ['#3b2a20', '#1f1b18', '#b5652e', '#e3b65a', '#6b4128', '#2a2320'];
export const BRIGHT = ['#e8b84a', '#e0573d', '#3b6fb6', '#2f3e5c', '#efe9dc', '#5f9e6e'];
// Hairstyles (the last two are hats, in the hat colour). Each is one part, named the same.
export const HAIRDOS = ['short', 'side', 'bob', 'pony', 'bun', 'curls', 'afro', 'bucket', 'beanie'];
export const HAIR_PART = HAIRDOS;
export const HATS = new Set(['bucket', 'beanie']);
// Parts that only some children have (each lists just those children in crowd.js).
export const EXTRAS = ['coat', 'skirt', 'collar', 'stripes', 'bag'];

// A look from a whole number: the outfit, skin, hair and extras are each picked independently.
export function kidLook(n) {
  let h = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b) >>> 0; h = (h ^ (h >>> 13)) >>> 0; h = Math.imul(h, 0xc2b2ae35) >>> 0; h = (h ^ (h >>> 16)) >>> 0;
  let h2 = Math.imul(h ^ 0x27d4eb2f, 0x165667b1) >>> 0; h2 = (h2 ^ (h2 >>> 15)) >>> 0;
  const o = OUTFITS[h % OUTFITS.length], style = (h >>> 8) % 12 < 10 ? (h >>> 8) % 7 : 7 + ((h >>> 12) & 1);       // (about one in six wears a hat)
  const coat = (h2 >>> 3) % 10 < 3;
  const curly = style === 5 || style === 6, hair = curly ? ['#3b2a20', '#1f1b18', '#6b4128', '#2a2320'][(h >>> 16) % 4] : HAIR[(h >>> 16) % HAIR.length];      // (curls and afros in dark colours)
  return { ...o, skin: SKIN[(h >>> 4) % SKIN.length], hair, style, hat: BRIGHT[(h >>> 20) % BRIGHT.length],
    bag: h2 % 3 === 0 ? BRIGHT[(h2 >>> 22) % BRIGHT.length] : null, coat,
    skirt: !coat && (h2 >>> 7) % 4 === 0 ? (o.accent === '#efe9dc' ? o.shorts : o.accent) : null,
    collar: (h2 >>> 11) % 5 < 2 ? (o.top === '#efe9dc' ? o.accent : '#f6f2ea') : null,
    stripes: (h2 >>> 15) % 9 < 2 ? (o.top === '#efe9dc' ? '#2f3e5c' : '#efe9dc') : null };
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
// The top of the hair: a cap of the head, tipped back so the fringe stays well above the eyes.
const hs = (r, a1, tilt) => cap(r, 0, a1).rotateX(tilt).translate(0, HEAD_Y + 0.003, -0.001);
let PARTS = null;
export function kidParts() {
  if (PARTS) return PARTS;
  const torsoProf = [[0, 0.083], [0.0245, 0.083], [0.0258, 0.118], [0.026, 0.139], [0.0215, 0.152], [0.01, 0.157], [0, 0.157]];
  const wide = g => g.scale(1.16, 1, 0.74);
  PARTS = {
    torso: wide(lathe(torsoProf, 12)),
    coat: new THREE.CylinderGeometry(0.0262, 0.034, 0.06, 12, 1, true).scale(1.16, 1, 0.78).translate(0, 0.075, 0),
    skirt: new THREE.CylinderGeometry(0.026, 0.036, 0.03, 12, 1, true).scale(1.14, 1, 0.82).translate(0, 0.072, 0),
    collar: new THREE.TorusGeometry(0.0115, 0.0032, 4, 12).rotateX(Math.PI / 2).scale(1.15, 1, 0.9).translate(0, 0.156, 0.001),
    stripes: join([0.097, 0.111, 0.125].map(y => wide(lathe([[0.0265, y], [0.0265, y + 0.0055]], 12)))),
    head: join([new THREE.SphereGeometry(R, 12, 9).scale(0.95, 1.1, 1).translate(0, HEAD_Y, 0), new THREE.CylinderGeometry(0.0076, 0.0086, 0.022, 7).translate(0, 0.163, 0)]),
    eyes: join([-1, 1].map(s => new THREE.SphereGeometry(0.0021, 5, 4).scale(1, 1.3, 0.6).translate(s * 0.0093, HEAD_Y + 0.002, R * 0.985))),
    short: hs(R * 1.04, Math.PI * 0.42, -0.45),
    side: join([hs(R * 1.05, Math.PI * 0.43, -0.45), new THREE.SphereGeometry(R * 0.7, 9, 5).scale(1.35, 0.42, 1).rotateZ(0.32).translate(-R * 0.25, HEAD_Y + R * 0.82, R * 0.28)]),
    bob: join([hs(R * 1.08, Math.PI * 0.6, -0.5), new THREE.CylinderGeometry(R * 1.08, R * 1.1, R * 0.75, 12, 1, true, 0.9, Math.PI * 2 - 1.8).translate(0, HEAD_Y - R * 0.3, 0)]),
    pony: join([hs(R * 1.05, Math.PI * 0.5, -0.45), new THREE.CapsuleGeometry(R * 0.24, R * 0.9, 2, 6).rotateX(0.45).translate(0, HEAD_Y - R * 0.1, -R * 1.12)]),
    bun: join([hs(R * 1.05, Math.PI * 0.5, -0.45), new THREE.SphereGeometry(R * 0.42, 8, 6).translate(0, HEAD_Y + R * 0.95, -R * 0.45)]),
    curls: join([hs(R * 1.05, Math.PI * 0.5, -0.4), new THREE.SphereGeometry(R * 1.12, 12, 7).scale(1.05, 0.62, 1.05).translate(0, HEAD_Y + R * 0.55, -R * 0.05)]),
    afro: join([hs(R * 1.04, Math.PI * 0.5, -0.4), new THREE.SphereGeometry(R * 1.32, 12, 8).scale(1, 0.92, 1).translate(0, HEAD_Y + R * 0.45, -R * 0.1)]),
    bucket: join([cap(R * 1.12, 0, Math.PI * 0.5).translate(0, HEAD_Y + 0.006, 0), new THREE.CylinderGeometry(R * 1.12, R * 1.55, R * 0.35, 14, 1, true).translate(0, HEAD_Y, 0)]),
    beanie: join([cap(R * 1.14, 0, Math.PI * 0.5).rotateX(-0.12).translate(0, HEAD_Y + 0.004, 0), new THREE.CylinderGeometry(R * 1.15, R * 1.15, R * 0.32, 12).rotateX(-0.12).translate(0, HEAD_Y + 0.006, 0)]),
    bag: new RoundedBoxGeometry(0.034, 0.044, 0.014, 1, 0.005).translate(0, 0.122, -0.026),
    leg: new THREE.CylinderGeometry(0.0098, 0.0088, 0.08, 8).translate(0, -0.04, 0),                  // hangs from the hip
    shoe: new RoundedBoxGeometry(0.0195, 0.012, 0.035, 1, 0.0045).translate(0, -0.0835, 0.007),
    arm: new THREE.CylinderGeometry(0.0083, 0.0075, 0.06, 7).translate(0, -0.03, 0),                  // hangs from the shoulder
    hand: new THREE.SphereGeometry(0.0078, 6, 5).translate(0, -0.064, 0),
  };
  for (const g of Object.values(PARTS)) { if (g.attributes.uv) g.deleteAttribute('uv'); g.userData.shared = true; }
  return PARTS;
}
// Parts drawn with an ink line: none now (soft light and no outline, like the furniture). Kept so crowd.js can ask.
export const INKED = new Set();
const NOT_DRAWN = new Set(FACE ? [] : ['eyes']);

// Soft light (no outline); kidMat is the children's material. (toon is the old name, kept for crowd.js.)
const mats = new Map();
export function kidMat(hex = '#ffffff') { if (!mats.has(hex)) { const m = new THREE.MeshLambertMaterial({ color: hex }); m.userData.shared = true; mats.set(hex, m); } return mats.get(hex); }
export const toon = kidMat;
export const KID_LINE = new THREE.MeshBasicMaterial({ color: '#23252b', side: THREE.BackSide });
KID_LINE.userData.shared = true;
const lines = new Map();
export function inkOf(geo, w = 0.0014) {
  if (lines.has(geo)) return lines.get(geo);
  const g = geo.clone(), p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * w, p.getY(i) + n.getY(i) * w, p.getZ(i) + n.getZ(i) * w);
  g.userData.shared = true; lines.set(geo, g);
  return g;
}
export const drawn = name => !NOT_DRAWN.has(name);

// Poses for a child who is not part of the crowd: [legs forward, arms raised, arms out] in radians.
const POSES = {
  stand: [0, 0, 0.08], sit: [-1.45, -0.5, 0.08], ride: [-1.45, -1.0, 0.08], hold: [0, -1.1, 0.08],
  swing: [-1.2, -2.84, 0.35], hang: [-0.4, -2.95, -0.22], climb: [-0.3, -2.7, 0.28],
};
// One child, still, in a pose (feet at y = 0 standing; sitting, their bum is at SEAT).
let miniN = 0;
export function miniKid(pose = 'stand') {
  const P = kidParts(), L = kidLook(miniN++ * 7 + 3), k = new THREE.Group(), [legX, armX, out] = POSES[pose] || POSES.stand;
  k.userData.pose = pose;
  const add = (name, hex, parent = k) => {
    if (!drawn(name)) return;
    const m = new THREE.Mesh(P[name], kidMat(hex)); m.castShadow = name === 'torso' || name === 'head' || name === 'coat'; m.raycast = () => {}; m.userData.people = true; parent.add(m);
  };
  add('torso', L.top); add('head', L.skin); add('eyes', '#2a2523');
  const hair = HAIRDOS[L.style]; add(hair, HATS.has(hair) ? L.hat : L.hair);
  for (const x of EXTRAS) if (L[x]) add(x, x === 'coat' ? L.top : x === 'bag' ? L.bag : L[x]);
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * LEG_X, HIP, 0); leg.rotation.x = legX; leg.userData.limb = 'leg'; leg.userData.s = s; add('leg', L.shorts, leg); add('shoe', L.shoes, leg); k.add(leg);
    const arm = new THREE.Group(); arm.position.set(s * ARM_X, SHOULDER, 0); arm.rotation.set(armX, 0, s * out); arm.userData.limb = 'arm'; arm.userData.s = s; add('arm', L.sleeve, arm); add('hand', L.skin, arm); k.add(arm);
  }
  return k;
}
