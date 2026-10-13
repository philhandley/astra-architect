// People: children drawn like picture-book toys (see kid.js), with swinging arms and legs.
// They sit at tables, wander round rooms and roof terraces, run in the hall, swim, stroll across the meadow,
// cheer, and in the school day walk from room to room.
// Each body part is one instanced mesh, so a whole school of children stays fast. Parts that move together
// (the body, head and face; a leg and its shoe; an arm and its hand) share one set of matrices, and each part's
// ink line shares the matrices of its part. Each hairstyle (and the bag) lists only the children who have it, so
// nobody draws hair they aren't wearing.
import * as THREE from 'three';
import { HIP, SHOULDER, LEG_X, ARM_X, kidParts, kidLook, HAIR_PART, toon, KID_LINE, inkOf } from './kid.js';

const MAX = 800;
export function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const look = p => kidLook(Math.floor(p.ph * 1e6));
// (Looks made elsewhere, like the teachers', may leave some of these out.)
const LOOK_DEFAULTS = { shoes: '#fbfaf6', hat: '#e6463c', bag: null };

export class Crowd {
  constructor(world) {
    this.world = world;
    const P = kidParts();
    const tinted = toon('#ffffff');
    this.all = [];
    // name: [geometry, colour (null = each child's own), shares matrices with, casts a shadow, ink line]
    const SPEC = {
      torso: [P.torso, null, null, true, true], head: [P.head, null, 'torso', true, true], eyes: [P.eyes, '#23252b', 'torso'],
      bob: [P.bob, null, null, false, true], quiff: [P.quiff, null, null, false, true], puff: [P.puff, null, null, false, true],
      capHair: [P.capHair, null, null, false, true], hat: [P.hat, null, 'capHair', false, true], bunches: [P.bunches, null, null, false, true], pony: [P.pony, null, null, false, true],
      bag: [P.bag, null, null, false, true],
      legL: [P.leg, null, null, false, true], legR: [P.leg, null, null, false, true], shoeL: [P.shoe, null, 'legL', false, true], shoeR: [P.shoe, null, 'legR', false, true],
      armL: [P.arm, null, null, false, true], armR: [P.arm, null, null, false, true], handL: [P.hand, null, 'armL', false, true], handR: [P.hand, null, 'armR', false, true],
    };
    this.meshes = {}; this.inks = {};
    for (const [name, [geo, colour, share, shadow, ink]] of Object.entries(SPEC)) {
      const m = new THREE.InstancedMesh(geo, colour ? toon(colour) : tinted, MAX);
      if (share) m.instanceMatrix = this.meshes[share].instanceMatrix;
      m.castShadow = !!shadow; m.count = 0; m.frustumCulled = false; m.userData.people = true; m.raycast = () => {};
      world.scene.add(m); this.meshes[name] = m; this.all.push(m);
      if (ink) {
        const o = new THREE.InstancedMesh(inkOf(geo), KID_LINE, MAX);
        o.instanceMatrix = m.instanceMatrix; o.count = 0; o.frustumCulled = false; o.userData.people = true; o.raycast = () => {};
        world.scene.add(o); this.all.push(o); this.inks[name] = o;
      }
    }
    // Which colour each instanced part takes from the child's look.
    this.colourOf = { torso: 'top', armL: 'top', armR: 'top', legL: 'shorts', legR: 'shorts', shoeL: 'shoes', shoeR: 'shoes', head: 'skin', handL: 'skin', handR: 'skin',
      bob: 'hair', quiff: 'hair', puff: 'hair', capHair: 'hair', bunches: 'hair', pony: 'hair', hat: 'hat', bag: 'bag' };
    this.people = [];
    this.near = null;                 // in walk mode: hide anyone right next to the camera
    this.onStep = null;               // called with (x, z) as people walk between rooms (to wear paths)
    const self = this;
    this.mesh = { get visible() { return self.meshes.torso.visible; }, set visible(v) { for (const m of self.all) m.visible = v; } };
    this.tmp = { base: new THREE.Matrix4(), part: new THREE.Matrix4(), rot: new THREE.Matrix4(), q: new THREE.Quaternion(), v: new THREE.Vector3(), s: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), e: new THREE.Euler() };
    world.updaters.add(dt => this.update(dt));
  }
  setCount(n) {
    const c = new THREE.Color(), counts = Object.fromEntries(HAIR_PART.map(h => [h, 0]));
    let bags = 0;
    // Each child's place in its hairstyle's list (p.hi) and, if it has one, in the list of bags (p.bi).
    for (const p of this.people) {
      p.look = { ...LOOK_DEFAULTS, ...(p.look || look(p)) };
      p.hair = HAIR_PART[p.look.style | 0] || HAIR_PART[0]; p.hi = counts[p.hair]++;
      p.bi = p.look.bag ? bags++ : -1;
    }
    const countOf = name => (name in counts ? counts[name] : name === 'hat' ? counts.capHair : name === 'bag' ? bags : n);
    for (const [name, m] of Object.entries(this.meshes)) { m.count = countOf(name); if (this.inks[name]) this.inks[name].count = m.count; }
    this.people.forEach((p, i) => {
      for (const [name, key] of Object.entries(this.colourOf)) {
        const j = name in counts ? (name === p.hair ? p.hi : -1) : name === 'hat' ? (p.hair === 'capHair' ? p.hi : -1) : name === 'bag' ? p.bi : i;
        if (j >= 0) this.meshes[name].setColorAt(j, c.set(p.look[key] || '#ffffff'));
      }
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
      if (p.kind === 'agent') moving = !!p.moving;
      else if (p.kind === 'path') {
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
      if (moving) p.walk = (p.walk || 0) + dt * ((p.kind === 'agent' ? p.pose : p.kind) === 'run' ? 16 : 10);
      if (moving && p.kind === 'path' && this.onStep && p.y < 0.06 && (p.trail = (p.trail || 0) + dt) > 0.06 && steps++ < 160) { p.trail = 0; this.onStep(p.x, p.z); }
      this.pose(i, p, moving, t, dt);
    });
    for (const m of this.all) m.instanceMatrix.needsUpdate = true;
  }
  // Put one person's body parts in place for this moment.
  pose(i, p, moving, t, dt) {
    const { base, part, rot, q, v, s, up, e } = this.tmp, M = this.meshes, kind = p.kind === 'agent' ? p.pose : p.kind;
    let legL = 0, legR = 0, armL = 0, armR = 0, outL = -0.12, outR = 0.12, y = p.y, lean = 0;
    const swing = Math.sin(p.walk || 0);
    if (kind === 'sit') { legL = legR = -1.45; armL = armR = -0.55; y -= 0.037; }
    else if (kind === 'swim') { y -= 0.125; const w = t * 4 + p.ph; armL = Math.sin(w) * 2.6; armR = Math.sin(w + Math.PI) * 2.6; lean = 0.3; }
    else if (moving) { const a = kind === 'run' ? 0.9 : 0.55; legL = swing * a; legR = -swing * a; armL = -swing * a * 0.9; armR = swing * a * 0.9; y += Math.abs(Math.cos(p.walk || 0)) * (kind === 'run' ? 0.012 : 0.006); lean = kind === 'run' ? 0.18 : 0.04; }
    else { armL = Math.sin(t * 1.5 + p.ph) * 0.05; armR = -armL; }
    if (p.jumpT > 0) { p.jumpT -= dt; y += Math.abs(Math.sin(t * 9 + p.ph)) * 0.07; const wave = 2.7 + Math.sin(t * 14 + p.ph) * 0.25; outL = -wave; outR = wave; armL = armR = 0; }
    const nr = this.near, hide = p.hidden || (nr && Math.abs(p.y - nr.y) < 0.2 && Math.hypot(p.x - nr.x, p.z - nr.z) < nr.r);
    q.setFromAxisAngle(up, p.yaw); v.set(p.x, y, p.z); s.setScalar(hide ? 1e-4 : p.s);
    base.compose(v, q, s);
    if (lean) base.multiply(rot.makeRotationX(lean));
    M.torso.setMatrixAt(i, base);         // also the head and face
    if (p.hair) M[p.hair].setMatrixAt(p.hi, base);      // (the hat goes with the cap)
    if (p.bi >= 0) M.bag.setMatrixAt(p.bi, base);
    const limb = (mesh, x, yy, rx, rz) => { part.makeTranslation(x, yy, 0).multiply(rot.makeRotationFromEuler(e.set(rx, 0, rz))); mesh.setMatrixAt(i, part.premultiply(base)); };
    limb(M.legL, -LEG_X, HIP, legL, 0);
    limb(M.legR, LEG_X, HIP, legR, 0);
    limb(M.armL, -ARM_X, SHOULDER, armL, outL);
    limb(M.armR, ARM_X, SHOULDER, armR, outR);
  }
  clear() { this.people = []; this.setCount(0); }
}
