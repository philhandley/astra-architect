// The children. Two designs, both from the passes in dev/characters.html (Phil found the picture-book toys too
// childish, then asked for ten passes with research into designed and architectural characters):
// - 'scale': like architects' scale figures. About five and a half heads tall, two small dot eyes
//   (FACE false: faceless), simple solid hair, square shoulders, a straight-cut top (some with Breton stripes or a
//   white collar), an A-line coat or a skirt on some, slim trousers, rounded sneakers, a slim backpack, sometimes a
//   bucket hat or a beanie; fresh colours mixed with muted ones.
// - 'crew' (the default, Phil's pick): a hoodie with a band of colour across the chest (some with the hood showing, some with a skirt),
//   joggers, chunky sneakers with white soles, pill eyes, stylish hair (a fade, curls, a bun, braids, long hair, a
//   swoop, an afro, a cap worn backwards, a beanie), headphones on a few; muted colours.
// - 'muted': the scale-figure kids as in pass 7 (Phil's pick to try): muted colours, a slightly bigger head, more
//   bucket hats and beanies, no stripes; small dot eyes.
// All: soft light and no outline (like the furniture). Pick one with ?kids=scale, ?kids=muted or ?kids=crew in the
// address (remembered on this device). crowd.js draws hundreds at once from these parts; miniKid() makes one.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const KIDS = (() => {
  try {
    const q = new URLSearchParams(location.search).get('kids');
    if (q === 'crew' || q === 'scale' || q === 'muted') { localStorage.setItem('astraarch-kids2', q); return q; }
    const saved = localStorage.getItem('astraarch-kids2');
    return saved === 'scale' || saved === 'muted' ? saved : 'crew';
  } catch (e) { return 'crew'; }
})();
const CREW = KIDS === 'crew', MUTED = KIDS === 'muted';

// The body (feet at y = 0, facing +z; a grown-up is the same figure drawn bigger).
export const HIP = CREW ? 0.086 : 0.088, SHOULDER = CREW ? 0.146 : 0.149, LEG_X = CREW ? 0.0135 : 0.0118, ARM_X = CREW ? 0.031 : 0.0285;
export const SEAT = CREW ? 0.076 : 0.083;               // the bottom of the top: where a sitting child's bum is, above their feet
export const REACH = SHOULDER + (CREW ? 0.057 : 0.063);  // how high their hands are with their arms straight up
export const SIT_DROP = SEAT;                            // how far the crowd lowers a sitting child, times its size: bum on the seat
export const SWIM_DROP = 0.138;                          // and a swimmer, so the head is just out of the water
export const FACE = true;                                // eyes (false: faceless, like a scale figure)
const R = CREW ? 0.0335 : MUTED ? 0.0305 : 0.0295, HEAD_Y = 0.189;

// Outfits that go together: a top, its sleeves, trousers, shoes and an accent (a skirt, stripes, the chest band).
export const OUTFITS = CREW || MUTED ? [
  { top: '#c8664a', sleeve: '#c8664a', shorts: '#3c3f45', shoes: '#efe9dc', accent: '#efe9dc' },
  { top: '#9bb39a', sleeve: '#9bb39a', shorts: '#2f3e5c', shoes: '#efe9dc', accent: '#2f3e5c' },
  { top: '#d9a441', sleeve: '#d9a441', shorts: '#2f3e5c', shoes: '#3c3f45', accent: '#2f3e5c' },
  { top: '#2f3e5c', sleeve: '#2f3e5c', shorts: '#cbb894', shoes: '#efe9dc', accent: '#d99a9a' },
  { top: '#d99a9a', sleeve: '#d99a9a', shorts: '#efe9dc', shoes: '#3c3f45', accent: '#3c3f45' },
  { top: '#efe9dc', sleeve: '#efe9dc', shorts: '#4f8a8b', shoes: '#3c3f45', accent: '#4f8a8b' },
  { top: '#4f8a8b', sleeve: '#4f8a8b', shorts: '#3c3f45', shoes: '#efe9dc', accent: '#d9a441' },
  { top: '#3c3f45', sleeve: '#3c3f45', shorts: '#c8664a', shoes: '#efe9dc', accent: '#c8664a' },
  { top: '#e3c9a8', sleeve: '#e3c9a8', shorts: '#6b4a3a', shoes: '#3c3f45', accent: '#6b4a3a' },
] : [
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
const DARK_HAIR = ['#3b2a20', '#1f1b18', '#6b4128', '#2a2320'];
export const BRIGHT = CREW || MUTED ? ['#d9a441', '#c8664a', '#2f3e5c', '#9bb39a', '#efe9dc', '#3c3f45'] : ['#e8b84a', '#e0573d', '#3b6fb6', '#2f3e5c', '#efe9dc', '#5f9e6e'];
// Hairstyles (the last two are hats, in the hat colour). Each is one part, named the same.
export const HAIRDOS = CREW ? ['fade', 'curls', 'bun', 'braids', 'long', 'swoop', 'afro', 'capBack', 'beanie'] : ['short', 'side', 'bob', 'pony', 'bun', 'curls', 'afro', 'bucket', 'beanie'];
export const HAIR_PART = HAIRDOS;
export const HATS = new Set(CREW ? ['capBack', 'beanie'] : ['bucket', 'beanie']);
const CURLY = new Set(['curls', 'afro']);
// Parts that only some children have (each lists just those children in crowd.js); a child's look holds the
// colour of each extra it has (or nothing). Extra parts on the legs, in a fixed colour (the crew's white soles).
export const EXTRAS = CREW ? ['band', 'hood', 'skirt', 'phones', 'bag'] : ['coat', 'skirt', 'collar', 'stripes', 'bag'];
export const OFF_WHEN_SEATED = new Set(['skirt', 'coat']);      // (they would hang through the seat)
export const LEG_EXTRAS = CREW ? [['sole', '#efe9dc']] : [];

// A look from a whole number: the outfit, skin, hair and extras are each picked independently.
export function kidLook(n) {
  let h = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b) >>> 0; h = (h ^ (h >>> 13)) >>> 0; h = Math.imul(h, 0xc2b2ae35) >>> 0; h = (h ^ (h >>> 16)) >>> 0;
  let h2 = Math.imul(h ^ 0x27d4eb2f, 0x165667b1) >>> 0; h2 = (h2 ^ (h2 >>> 15)) >>> 0;
  const o = OUTFITS[h % OUTFITS.length], hats = MUTED ? 3 : 2;      // (about one in six wears a hat; one in four in 'muted')
  const style = (h >>> 8) % 12 < 12 - hats ? (h >>> 8) % 7 : 7 + ((h >>> 12) & 1);
  const name = HAIRDOS[style], hair = CURLY.has(name) ? DARK_HAIR[(h >>> 16) % 4] : HAIR[(h >>> 16) % HAIR.length];      // (curls and afros in dark colours)
  const L = { ...o, skin: SKIN[(h >>> 4) % SKIN.length], hair, style, hat: BRIGHT[(h >>> 20) % BRIGHT.length], bag: h2 % 3 === 0 ? BRIGHT[(h2 >>> 22) % BRIGHT.length] : null };
  const skirtCol = o.accent === '#efe9dc' ? o.shorts : o.accent;
  if (CREW) Object.assign(L, { band: o.accent, hood: (h2 >>> 6) % 20 < 9 ? o.top : null, skirt: (h2 >>> 11) % 4 === 0 ? skirtCol : null, phones: !HATS.has(name) && (h2 >>> 15) % 10 === 0 ? L.hat : null });
  else {
    const coat = (h2 >>> 3) % 10 < 3;
    Object.assign(L, { coat: coat ? o.top : null, skirt: !coat && (h2 >>> 7) % 4 === 0 ? skirtCol : null,
      collar: (h2 >>> 11) % 5 < 2 ? (o.top === '#efe9dc' ? o.accent : '#f6f2ea') : null, stripes: !MUTED && (h2 >>> 15) % 9 < 2 ? (o.top === '#efe9dc' ? '#2f3e5c' : '#efe9dc') : null });
  }
  return L;
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
// The top of the hair: a cap of the head, tipped back so the fringe stays above the eyes.
const hs = (r, a1, tilt) => cap(r, 0, a1).rotateX(tilt).translate(0, HEAD_Y + 0.003, -0.001);

function scaleParts() {
  const torsoProf = [[0, 0.083], [0.0245, 0.083], [0.0258, 0.118], [0.026, 0.139], [0.0215, 0.152], [0.01, 0.157], [0, 0.157]];
  const wide = g => g.scale(1.16, 1, 0.74);
  return {
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
}
function crewParts() {
  const prof = [[0, 0.076], [0.026, 0.076], [0.028, 0.083], [0.028, 0.12], [0.026, 0.139], [0.017, 0.151], [0.009, 0.155], [0, 0.155]];
  const wide = g => g.scale(1.12, 1, 0.8);
  const pill = x => new THREE.SphereGeometry(0.0026, 5, 4).scale(1, 1.75, 0.8).translate(x, HEAD_Y + 0.002, R * 0.975);
  return {
    torso: join([wide(lathe(prof, 12)), new THREE.BoxGeometry(0.03, 0.015, 0.004).translate(0, 0.093, 0.0228)]),     // (with a front pocket)
    band: wide(lathe([[0.0283, 0.11], [0.0283, 0.119]], 12)),
    hood: new THREE.TorusGeometry(0.016, 0.006, 5, 10, Math.PI * 1.4).rotateZ(-Math.PI * 0.2 - Math.PI / 2).scale(1.25, 1, 1).rotateX(Math.PI / 2 - 0.45).translate(0, 0.152, -0.011),
    skirt: new THREE.CylinderGeometry(0.029, 0.038, 0.03, 12, 1, true).scale(1.1, 1, 0.85).translate(0, 0.071, 0),
    head: join([new THREE.SphereGeometry(R, 12, 9).scale(1, 1.06, 1).translate(0, HEAD_Y, 0), new THREE.CylinderGeometry(0.0085, 0.01, 0.022, 7).translate(0, 0.157, 0)]),
    eyes: join([pill(-0.011), pill(0.011)]),
    fade: join([hs(R * 1.03, Math.PI * 0.38, -0.42), new THREE.SphereGeometry(R * 0.8, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(1, 0.75, 1).translate(0, HEAD_Y + R * 0.6, 0.002)]),
    curls: join([hs(R * 1.04, Math.PI * 0.45, -0.32), ...Array.from({ length: 8 }, (_, i) => { const a = i * 2.4, e = 0.3 + (i % 3) * 0.28; return new THREE.SphereGeometry(R * 0.4, 6, 4).translate(Math.cos(a) * Math.cos(e) * R * 0.95, HEAD_Y + Math.sin(e) * R + 0.005, Math.sin(a) * Math.cos(e) * R * 0.95); })]),
    bun: join([hs(R * 1.06, Math.PI * 0.5, -0.42), new THREE.SphereGeometry(R * 0.45, 7, 5).translate(0, HEAD_Y + R * 1.0, -R * 0.4)]),
    braids: join([hs(R * 1.06, Math.PI * 0.5, -0.42), ...[-1, 1].map(s => new THREE.CapsuleGeometry(R * 0.17, R * 1.25, 1, 5).translate(s * R * 0.78, HEAD_Y - R * 0.55, -R * 0.4))]),
    long: join([hs(R * 1.08, Math.PI * 0.55, -0.55), new THREE.CylinderGeometry(R * 1.05, R * 1.13, R * 1.55, 10, 1, true, 0.8, Math.PI * 2 - 1.6).translate(0, HEAD_Y - R * 0.4, -0.003)]),
    swoop: join([hs(R * 1.05, Math.PI * 0.44, -0.38), new THREE.SphereGeometry(R * 0.62, 8, 5).scale(1.5, 0.45, 0.9).rotateZ(0.25).rotateX(0.3).translate(R * 0.18, HEAD_Y + R * 0.82, R * 0.4)]),
    afro: join([hs(R * 1.05, Math.PI * 0.5, -0.42), new THREE.SphereGeometry(R * 1.3, 11, 7).scale(1, 0.9, 1).translate(0, HEAD_Y + R * 0.42, -R * 0.12)]),
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
}
let PARTS = null;
export function kidParts() {
  if (PARTS) return PARTS;
  PARTS = CREW ? crewParts() : scaleParts();
  for (const g of Object.values(PARTS)) { if (g.attributes.uv) g.deleteAttribute('uv'); g.userData.shared = true; }
  return PARTS;
}
// Parts drawn with an ink line: none (soft light and no outline, like the furniture). Kept so crowd.js can ask.
export const INKED = new Set();
const NOT_DRAWN = new Set(FACE ? [] : ['eyes']);
export const drawn = name => !NOT_DRAWN.has(name);

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
  const seated = pose === 'sit' || pose === 'ride' || pose === 'swing';
  for (const x of EXTRAS) if (L[x] && !(seated && OFF_WHEN_SEATED.has(x))) add(x, L[x]);
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * LEG_X, HIP, 0); leg.rotation.x = legX; leg.userData.limb = 'leg'; leg.userData.s = s; add('leg', L.shorts, leg); add('shoe', L.shoes, leg); for (const [x, col] of LEG_EXTRAS) add(x, col, leg); k.add(leg);
    const arm = new THREE.Group(); arm.position.set(s * ARM_X, SHOULDER, 0); arm.rotation.set(armX, 0, s * out); arm.userData.limb = 'arm'; arm.userData.s = s; add('arm', L.sleeve, arm); add('hand', L.skin, arm); k.add(arm);
  }
  return k;
}
