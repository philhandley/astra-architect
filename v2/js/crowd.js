// People: chunky little toy children with hair, faces, bright clothes and shoes, and swinging arms and legs.
// They sit at tables, wander round rooms and roof terraces, run in the hall, swim, stroll across the meadow,
// cheer, and in the school day walk from room to room.
// Each body part is one instanced mesh, so a whole school of children stays fast. Parts that move together
// (the body, head, hair and face; a leg and its shoe; an arm and its hand) share one set of matrices.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const MAX = 800;
export function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// The body (a grown-up is about 0.22 tall, two thirds of a storey; children are drawn smaller).
const HIP = 0.056, SHOULDER = 0.125, LEG_X = 0.016, ARM_X = 0.04;
const two = (geo, x) => { const a = geo.clone().translate(-x, 0, 0), b = geo.clone().translate(x, 0, 0); return mergeTwo(a, b); };
function mergeTwo(a, b) {
  // Two small pieces as one geometry (eyes, cheeks, pigtails).
  const g = new THREE.BufferGeometry(), A = a.toNonIndexed(), B = b.toNonIndexed();
  for (const k of ['position', 'normal']) { const x = A.attributes[k].array, y = B.attributes[k].array, arr = new Float32Array(x.length + y.length); arr.set(x); arr.set(y, x.length); g.setAttribute(k, new THREE.BufferAttribute(arr, 3)); }
  return g;
}
function parts() {
  return {
    torso: new RoundedBoxGeometry(0.066, 0.062, 0.044, 3, 0.016).translate(0, 0.1, 0),
    shorts: new RoundedBoxGeometry(0.062, 0.026, 0.042, 2, 0.01).translate(0, 0.064, 0),
    head: new THREE.SphereGeometry(0.042, 18, 12).translate(0, 0.17, 0),
    hair: new THREE.SphereGeometry(0.0445, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.5).rotateX(-0.5).translate(0, 0.172, -0.004),
    bun: new THREE.SphereGeometry(0.018, 10, 8).translate(0, 0.21, -0.03),
    tails: two(new THREE.SphereGeometry(0.014, 10, 8).translate(0, 0.18, -0.01), 0.042),
    eyes: two(new THREE.SphereGeometry(0.005, 6, 4).translate(0, 0.172, 0.04), 0.014),
    cheeks: two(new THREE.SphereGeometry(0.007, 6, 4).scale(1, 0.6, 0.4).translate(0, 0.16, 0.036), 0.024),
    leg: new THREE.CylinderGeometry(0.011, 0.01, 0.05, 8).translate(0, -0.025, 0),                  // hangs from the hip
    shoe: new RoundedBoxGeometry(0.022, 0.014, 0.032, 2, 0.006).translate(0, -0.054, 0.006),
    arm: new THREE.CylinderGeometry(0.0105, 0.009, 0.05, 8).translate(0, -0.025, 0),               // hangs from the shoulder
    hand: new THREE.SphereGeometry(0.0105, 8, 6).translate(0, -0.054, 0),
  };
}
// Bright clothes, a range of skin and hair colours, and three hair styles (short, a bun, bunches).
const CLOTHES = ['#f4c23d', '#e6463c', '#22b2bf', '#e2457d', '#3d8de0', '#8bc34a', '#9a6cd4', '#ea7b2c'];
const SHORTS = ['#2f4b7c', '#3d405b', '#ea7b2c', '#22b2bf', '#e2457d', '#2f4b7c'];
const SKIN = ['#f6d7bf', '#e7b892', '#c98c62', '#9a6544', '#6e4630'];
const HAIR = ['#3b2a20', '#1f1b18', '#b5652e', '#e3b65a', '#6b4128'];
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
function look(p) {
  // Mix the number well, so each part of the look is picked independently.
  let h = Math.imul(Math.floor(p.ph * 1e6) ^ 0x9e3779b9, 0x85ebca6b) >>> 0; h = (h ^ (h >>> 13)) >>> 0; h = Math.imul(h, 0xc2b2ae35) >>> 0; h = (h ^ (h >>> 16)) >>> 0;
  return { top: CLOTHES[h % CLOTHES.length], shorts: SHORTS[(h >>> 4) % SHORTS.length], skin: SKIN[(h >>> 8) % SKIN.length], hair: HAIR[(h >>> 12) % HAIR.length], style: (h >>> 16) % 3 };
}

export class Crowd {
  constructor(world) {
    this.world = world;
    const P = parts();
    const tinted = new THREE.MeshLambertMaterial({ color: '#ffffff' });
    this.all = [];
    // name: [geometry, colour (null = each child's own), shares matrices with, casts a shadow]
    const SPEC = {
      torso: [P.torso, null, null, true], shorts: [P.shorts, null, 'torso'], head: [P.head, null, 'torso', true], hair: [P.hair, null, 'torso'],
      eyes: [P.eyes, '#2a2c31', 'torso'], cheeks: [P.cheeks, '#f39aa0', 'torso'], bun: [P.bun, null], tails: [P.tails, null],
      legL: [P.leg, null], legR: [P.leg, null], shoeL: [P.shoe, '#fbfaf6', 'legL'], shoeR: [P.shoe, '#fbfaf6', 'legR'],
      armL: [P.arm, null], armR: [P.arm, null], handL: [P.hand, null, 'armL'], handR: [P.hand, null, 'armR'],
    };
    this.meshes = {};
    for (const [name, [geo, colour, share, shadow]] of Object.entries(SPEC)) {
      const m = new THREE.InstancedMesh(geo, colour ? new THREE.MeshLambertMaterial({ color: colour }) : tinted, MAX);
      if (share) m.instanceMatrix = this.meshes[share].instanceMatrix;
      m.castShadow = !!shadow; m.count = 0; m.frustumCulled = false; m.userData.people = true; m.raycast = () => {};
      world.scene.add(m); this.meshes[name] = m; this.all.push(m);
    }
    // Which colour each instanced part takes from the child's look.
    this.colourOf = { torso: 'top', armL: 'top', armR: 'top', shorts: 'shorts', head: 'skin', legL: 'skin', legR: 'skin', handL: 'skin', handR: 'skin', hair: 'hair', bun: 'hair', tails: 'hair' };
    this.people = [];
    this.near = null;                 // in walk mode: hide anyone right next to the camera
    this.onStep = null;               // called with (x, z) as people walk between rooms (to wear paths)
    const self = this;
    this.mesh = { get visible() { return self.meshes.torso.visible; }, set visible(v) { for (const m of self.all) m.visible = v; } };
    this.tmp = { base: new THREE.Matrix4(), part: new THREE.Matrix4(), rot: new THREE.Matrix4(), q: new THREE.Quaternion(), v: new THREE.Vector3(), s: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), e: new THREE.Euler() };
    world.updaters.add(dt => this.update(dt));
  }
  setCount(n) {
    for (const m of this.all) m.count = n;
    const c = new THREE.Color();
    this.people.forEach((p, i) => {
      p.look = p.look || look(p);
      for (const [name, key] of Object.entries(this.colourOf)) this.meshes[name].setColorAt(i, c.set(p.look[key]));
    });
    for (const name of Object.keys(this.colourOf)) if (this.meshes[name].instanceColor) this.meshes[name].instanceColor.needsUpdate = true;
  }
  // zones: [{ ox, oy, oz, w, d, inside(x, z, m) | rect {x0,z0,x1,z1} + ok(x, z), walkers, seats: [[x,y,z]], fill, speed, kind, boxId }]
  set(zones, seed = 1) {
    const r = seeded(seed);
    this.people = [];
    for (const z of zones) this.addZone(z, r);
    this.setCount(this.people.length);
    this.update(0);
  }
  addZone(z, r) {
    for (const s of z.seats || []) {
      if (r() > (z.fill ?? 0.8) || this.people.length >= MAX) continue;
      this.people.push({ kind: 'sit', boxId: z.boxId, x: z.ox + s[0], y: z.oy + s[1], z: z.oz + s[2], s: 0.72 + r() * 0.08, ph: r() * 6, yaw: Math.PI + (r() - 0.5) * 0.6 });
    }
    for (let i = 0; i < (z.walkers || 0) && this.people.length < MAX; i++) {
      const p = { kind: z.kind || 'walk', zone: z, s: z.adults && i === 0 ? 1 : 0.72 + r() * 0.1, ph: r() * 6, wait: r() * 2, speed: (z.speed || 0.32) * (0.8 + r() * 0.4), yaw: r() * 6.28, r };
      const [x, zz] = this.pick(z, r); p.x = x; p.z = zz; p.y = z.oy; [p.tx, p.tz] = this.pick(z, r);
      this.people.push(p);
    }
  }
  pick(z, r) {
    for (let k = 0; k < 30; k++) {
      if (z.rect) { const x = z.rect.x0 + r() * (z.rect.x1 - z.rect.x0), zz = z.rect.z0 + r() * (z.rect.z1 - z.rect.z0); if (!z.ok || z.ok(x, zz)) return [x, zz]; continue; }
      const lx = (r() - 0.5) * z.w, lz = (r() - 0.5) * z.d;
      if (z.inside(lx, lz, z.margin ?? 0.08)) return [z.ox + lx, z.oz + lz];
    }
    return [z.ox ?? 0, z.oz ?? 0];
  }
  // Send someone along a route (a list of Vector3), then let them wander in a zone when they arrive.
  route(p, path, then) { p.kind = 'path'; p.path = path; p.pi = 0; p.then = then; p.wait = p.r() * 1.2; }
  // Everyone in (or on) a building jumps for joy with their arms in the air.
  cheer(boxId) {
    let n = 0;
    for (const p of this.people) if (p.boxId === boxId || p.zone?.boxId === boxId) { p.jumpT = 1.8 + p.ph * 0.05; n++; }
    return n;
  }
  update(dt) {
    const t = (this.t = (this.t || 0) + dt);
    let steps = 0;
    this.people.forEach((p, i) => {
      let moving = false;
      if (p.kind === 'path') {
        if (p.wait > 0) p.wait -= dt;
        else {
          const tgt = p.path[p.pi];
          const dx = tgt.x - p.x, dz = tgt.z - p.z, dy = tgt.y - p.y, dd = Math.hypot(dx, dz, dy);
          const st = Math.min(dd, p.speed * 1.25 * dt);
          if (dd > 1e-4) { p.x += dx / dd * st; p.z += dz / dd * st; p.y += dy / dd * st; if (Math.abs(dx) + Math.abs(dz) > 1e-4) p.yaw = Math.atan2(dx, dz); }
          moving = true;
          if (dd < 0.02) { p.pi++; if (p.pi >= p.path.length) { const th = p.then; p.kind = th.kind || 'walk'; p.zone = th.zone; p.boxId = th.zone?.boxId; p.y = th.zone?.oy ?? p.y; p.wait = 0.3 + p.r() * 1.5; [p.tx, p.tz] = this.pick(th.zone, p.r); } }
        }
      } else if (p.kind === 'swim') {
        if (p.wait > 0) p.wait -= dt;
        else { const dx = p.tx - p.x, dz = p.tz - p.z, dd = Math.hypot(dx, dz); if (dd < 0.03) { [p.tx, p.tz] = this.pick(p.zone, p.r); } else { const st = Math.min(dd, p.speed * 0.5 * dt); p.x += dx / dd * st; p.z += dz / dd * st; p.yaw = Math.atan2(dx, dz); } }
      } else if (p.kind !== 'sit') {
        if (p.wait > 0) { p.wait -= dt; }
        else {
          const dx = p.tx - p.x, dz = p.tz - p.z, dd = Math.hypot(dx, dz);
          if (dd < 0.02) { p.wait = 0.4 + p.r() * (p.kind === 'run' ? 0.3 : 2.2); [p.tx, p.tz] = this.pick(p.zone, p.r); }
          else { const st = Math.min(dd, p.speed * dt); p.x += dx / dd * st; p.z += dz / dd * st; p.yaw = Math.atan2(dx, dz); moving = true; }
        }
      }
      if (moving) p.walk = (p.walk || 0) + dt * (p.kind === 'run' ? 16 : 10);
      if (moving && p.kind === 'path' && this.onStep && p.y < 0.06 && (p.trail = (p.trail || 0) + dt) > 0.06 && steps++ < 160) { p.trail = 0; this.onStep(p.x, p.z); }
      this.pose(i, p, moving, t, dt);
    });
    for (const m of this.all) m.instanceMatrix.needsUpdate = true;
  }
  // Put one person's body parts in place for this moment.
  pose(i, p, moving, t, dt) {
    const { base, part, rot, q, v, s, up, e } = this.tmp, M = this.meshes;
    let legL = 0, legR = 0, armL = 0, armR = 0, outL = -0.12, outR = 0.12, y = p.y, lean = 0;
    const swing = Math.sin(p.walk || 0);
    if (p.kind === 'sit') { legL = legR = -1.45; armL = armR = -0.55; y -= 0.033; }
    else if (p.kind === 'swim') { y -= 0.125; const w = t * 4 + p.ph; armL = Math.sin(w) * 2.6; armR = Math.sin(w + Math.PI) * 2.6; lean = 0.3; }
    else if (moving) { const a = p.kind === 'run' ? 0.9 : 0.55; legL = swing * a; legR = -swing * a; armL = -swing * a * 0.9; armR = swing * a * 0.9; y += Math.abs(Math.cos(p.walk || 0)) * (p.kind === 'run' ? 0.012 : 0.006); lean = p.kind === 'run' ? 0.18 : 0.04; }
    else { armL = Math.sin(t * 1.5 + p.ph) * 0.05; armR = -armL; }
    if (p.jumpT > 0) { p.jumpT -= dt; y += Math.abs(Math.sin(t * 9 + p.ph)) * 0.07; const wave = 2.7 + Math.sin(t * 14 + p.ph) * 0.25; outL = -wave; outR = wave; armL = armR = 0; }
    const nr = this.near, hide = nr && Math.abs(p.y - nr.y) < 0.2 && Math.hypot(p.x - nr.x, p.z - nr.z) < nr.r;
    q.setFromAxisAngle(up, p.yaw); v.set(p.x, y, p.z); s.setScalar(hide ? 1e-4 : p.s);
    base.compose(v, q, s);
    if (lean) base.multiply(rot.makeRotationX(lean));
    M.torso.setMatrixAt(i, base);         // also the shorts, head, hair and face
    const st = p.look ? p.look.style : 0;
    M.bun.setMatrixAt(i, st === 1 ? base : ZERO);
    M.tails.setMatrixAt(i, st === 2 ? base : ZERO);
    const limb = (mesh, x, yy, rx, rz) => { part.makeTranslation(x, yy, 0).multiply(rot.makeRotationFromEuler(e.set(rx, 0, rz))); mesh.setMatrixAt(i, part.premultiply(base)); };
    limb(M.legL, -LEG_X, HIP, legL, 0);
    limb(M.legR, LEG_X, HIP, legR, 0);
    limb(M.armL, -ARM_X, SHOULDER, armL, outL);
    limb(M.armR, ARM_X, SHOULDER, armR, outR);
  }
  clear() { this.people = []; this.setCount(0); }
}
