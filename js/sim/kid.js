// Children for the school day: big round heads, bright jumpers, stubby legs and their own little animations.
// Built from simple shapes, so every pupil looks different and nothing needs downloading.
import * as THREE from 'three';

export const KID_HEIGHT = 0.46;
const SKINS = ['#f6d5b8', '#e8b48f', '#c98a5e', '#a06a44', '#6e4a2f', '#f1c9a8'];
const HAIRS = ['#2b2118', '#5a3a1e', '#b0702c', '#e8c35a', '#8f2d1f', '#1f1f23', '#c25a2c'];
const STYLES = ['short', 'bob', 'bun', 'spiky', 'curly'];
const LEGS = ['#2b3a67', '#3b3b3b', '#6b4f3a', '#355070'];
const SHOES = ['#1f1f23', '#e5383b', '#f6f3ee', '#2b6fe0'];
const PACKS = ['#ffd60a', '#e5383b', '#2fbf71', '#7b4fff', '#ff8c1a'];

const mats = new Map();
const mat = hex => { if (!mats.has(hex)) mats.set(hex, new THREE.MeshLambertMaterial({ color: hex })); return mats.get(hex); };
const geos = {};
const geo = (k, make) => geos[k] || (geos[k] = make());

// A child one unit tall, scaled down to KID_HEIGHT. seed picks skin, hair, clothes and backpack.
export function makeKid({ colour = '#2f6fe4', seed = 0 } = {}) {
  const skin = SKINS[seed % SKINS.length];
  const hairC = HAIRS[(seed * 3 + 1) % HAIRS.length];
  const style = STYLES[(seed * 7 + 2) % STYLES.length];
  const skirt = seed % 3 === 1;
  const legC = LEGS[seed % LEGS.length];
  const shoeC = SHOES[(seed * 5 + 1) % SHOES.length];
  const packC = PACKS[(seed * 2 + 3) % PACKS.length];

  const root = new THREE.Group();     // placed and turned in the world
  const fig = new THREE.Group();      // bobs up and down, lies flat to swim
  root.add(fig);
  const add = (parent, g, m, x = 0, y = 0, z = 0) => { const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; mesh.position.set(x, y, z); parent.add(mesh); return mesh; };

  // Legs hang from hip pivots.
  const legGeo = geo('leg', () => new THREE.CapsuleGeometry(0.06, 0.12, 3, 8));
  const shoeGeo = geo('shoe', () => new THREE.BoxGeometry(0.1, 0.07, 0.15));
  const mkLeg = x => { const p = new THREE.Group(); p.position.set(x, 0.24, 0); add(p, legGeo, mat(legC), 0, -0.11, 0); add(p, shoeGeo, mat(shoeC), 0, -0.225, 0.025); fig.add(p); return p; };
  const legL = mkLeg(-0.085), legR = mkLeg(0.085);

  // Body, with a skirt or shorts and a backpack.
  const body = new THREE.Group();
  body.position.y = 0.24;
  fig.add(body);
  add(body, geo('body', () => new THREE.CapsuleGeometry(0.165, 0.16, 4, 12)), mat(colour), 0, 0.2, 0);
  if (skirt) add(body, geo('skirt', () => new THREE.ConeGeometry(0.235, 0.15, 14, 1, true)), mat(shade(colour, 0.72)), 0, 0.06, 0);
  else add(body, geo('shorts', () => new THREE.BoxGeometry(0.3, 0.12, 0.2)), mat(legC), 0, 0.02, 0);
  add(body, geo('pack', () => new THREE.BoxGeometry(0.2, 0.24, 0.1)), mat(packC), 0, 0.2, -0.2);

  // Arms hang from shoulder pivots.
  const armGeo = geo('arm', () => new THREE.CapsuleGeometry(0.05, 0.14, 3, 8));
  const handGeo = geo('hand', () => new THREE.SphereGeometry(0.055, 10, 8));
  const mkArm = x => { const p = new THREE.Group(); p.position.set(x, 0.33, 0); add(p, armGeo, mat(colour), 0, -0.12, 0); add(p, handGeo, mat(skin), 0, -0.25, 0); body.add(p); return p; };
  const armL = mkArm(-0.21), armR = mkArm(0.21);

  // Head: a big sphere with dot eyes, a smile, pink cheeks and hair.
  const head = new THREE.Group();
  head.position.y = 0.52;
  body.add(head);
  add(head, geo('head', () => new THREE.SphereGeometry(0.24, 18, 12)), mat(skin));
  const eyeGeo = geo('eye', () => new THREE.SphereGeometry(0.03, 8, 6));
  const eyes = [add(head, eyeGeo, mat('#1f1f23'), -0.085, 0.03, 0.215), add(head, eyeGeo, mat('#1f1f23'), 0.085, 0.03, 0.215)];
  const mouth = add(head, geo('mouth', () => new THREE.TorusGeometry(0.06, 0.013, 6, 12, Math.PI)), mat('#8c2f39'), 0, -0.06, 0.225);
  mouth.rotation.z = Math.PI;
  const cheekGeo = geo('cheek', () => new THREE.SphereGeometry(0.035, 8, 6));
  add(head, cheekGeo, mat('#f4a3b4'), -0.15, -0.04, 0.17);
  add(head, cheekGeo, mat('#f4a3b4'), 0.15, -0.04, 0.17);
  for (const m of [...eyes, mouth]) m.castShadow = false;
  const hm = mat(hairC);
  add(head, geo('cap', () => new THREE.SphereGeometry(0.255, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55)), hm);
  if (style === 'bob') add(head, geo('bob', () => new THREE.SphereGeometry(0.26, 18, 10, Math.PI * 0.85, Math.PI * 1.3, 0, Math.PI * 0.82)), hm);
  if (style === 'bun') add(head, geo('bun', () => new THREE.SphereGeometry(0.1, 10, 8)), hm, 0, 0.21, -0.12);
  if (style === 'spiky') {
    const sp = geo('spike', () => new THREE.ConeGeometry(0.05, 0.14, 6));
    for (const [x, y, z, r] of [[-0.1, 0.25, 0.02, 0.35], [0, 0.28, -0.02, 0], [0.1, 0.25, 0.02, -0.35]]) add(head, sp, hm, x, y, z).rotation.z = r;
  }
  if (style === 'curly') {
    const cg = geo('curl', () => new THREE.SphereGeometry(0.07, 8, 6));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; add(head, cg, hm, Math.cos(a) * 0.2, 0.1 + Math.sin(i) * 0.02, Math.sin(a) * 0.2 - 0.03); }
  }
  root.scale.setScalar(KID_HEIGHT);

  const P = { fig, body, head, legL, legR, armL, armR, eyes };
  const blinkT = (seed * 0.7) % 3.3;

  // Set the whole figure for one moment of an animation. t is this child's own clock.
  function pose(anim, t) {
    P.fig.position.y = 0; P.fig.rotation.x = 0; P.body.rotation.x = 0; P.body.scale.y = 1; P.head.rotation.set(0, 0, 0);
    for (const l of [P.legL, P.legR, P.armL, P.armR]) l.rotation.set(0, 0, 0);
    const swing = (f, a) => { P.legL.rotation.x = Math.sin(f) * a; P.legR.rotation.x = -Math.sin(f) * a; P.armL.rotation.x = -Math.sin(f) * a * 0.8; P.armR.rotation.x = Math.sin(f) * a * 0.8; };
    switch (anim) {
      case 'walk': { const f = t * 7.5; swing(f, 0.7); P.fig.position.y = Math.abs(Math.sin(f)) * 0.02; P.body.rotation.x = 0.06; break; }
      case 'sprint': { const f = t * 11.5; swing(f, 1.0); P.fig.position.y = Math.abs(Math.sin(f)) * 0.04; P.body.rotation.x = 0.22; break; }
      case 'sit': case 'slide': {
        P.fig.position.y = -0.2; P.legL.rotation.x = P.legR.rotation.x = -1.45;
        P.armL.rotation.x = P.armR.rotation.x = anim === 'slide' ? -2.7 : -0.5;
        if (anim === 'slide') P.body.rotation.x = -0.3;
        break;
      }
      case 'jump': { const hop = Math.abs(Math.sin(t * 5)); P.fig.position.y = hop * 0.2; P.armL.rotation.x = P.armR.rotation.x = -2.6 * hop; P.legL.rotation.x = P.legR.rotation.x = 0.5 * hop; break; }
      case 'climb': { const f = t * 4; P.armL.rotation.x = -2.3 + Math.sin(f) * 0.5; P.armR.rotation.x = -2.3 - Math.sin(f) * 0.5; P.legL.rotation.x = Math.sin(f) * 0.6 - 0.3; P.legR.rotation.x = -Math.sin(f) * 0.6 - 0.3; P.fig.position.y = (Math.sin(f) + 1) * 0.02; break; }
      case 'swim': { const f = t * 6; P.fig.rotation.x = 1.3; P.fig.position.y = 0.3; P.armL.rotation.x = f; P.armR.rotation.x = f + Math.PI; P.legL.rotation.x = Math.sin(f * 1.5) * 0.4; P.legR.rotation.x = -Math.sin(f * 1.5) * 0.4; break; }
      case 'interact': case 'pick': { P.armR.rotation.x = -1.3 + Math.sin(t * 6) * 0.25; P.body.rotation.x = 0.15; break; }
      case 'emote': { P.armR.rotation.x = -2.6; P.armR.rotation.z = Math.sin(t * 8) * 0.45; P.head.rotation.z = Math.sin(t * 4) * 0.08; break; }
      default: { P.body.scale.y = 1 + Math.sin(t * 2.5) * 0.015; P.head.rotation.z = Math.sin(t * 0.9) * 0.05; P.armL.rotation.x = Math.sin(t * 1.3) * 0.06; P.armR.rotation.x = -Math.sin(t * 1.3) * 0.06; }
    }
    // A blink every few seconds.
    const sy = ((t + blinkT) % 3.3) < 0.12 ? 0.12 : 1;
    for (const e of P.eyes) e.scale.y = sy;
  }
  return { root, pose, parts: P };
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = v => Math.max(0, Math.min(255, Math.round(k >= 1 ? v + (255 - v) * (k - 1) : v * k)));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map(v => v.toString(16).padStart(2, '0')).join('');
}
