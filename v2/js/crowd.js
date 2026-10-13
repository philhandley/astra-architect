// People: little white figures with a pencil outline (like the scale figures on an architect's drawing),
// with child proportions, swinging arms and legs. They sit at desks, wander round rooms and roof terraces,
// run in the hall, swim, stroll across the meadow, cheer, and in the school day walk from room to room.
// Each body part is one instanced mesh (plus its outline), so a whole school of children stays fast.
import * as THREE from 'three';

const MAX = 800;
const OUTLINE = 0.0045;
export function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// The body (a grown-up is about 0.22 tall, two thirds of a storey; children are drawn smaller).
const HIP = 0.068, SHOULDER = 0.136, NECK = 0.146;
function parts() {
  const torso = new THREE.CylinderGeometry(0.025, 0.035, 0.078, 12).translate(0, HIP + 0.039, 0);
  const head = new THREE.SphereGeometry(0.035, 14, 10).translate(0, NECK + 0.035, 0);
  const leg = new THREE.CylinderGeometry(0.0115, 0.0095, HIP, 7).translate(0, -HIP / 2, 0);     // hangs from the hip
  const arm = new THREE.CylinderGeometry(0.0095, 0.008, 0.062, 7).translate(0, -0.031, 0);      // hangs from the shoulder
  return { torso, head, leg, arm };
}
// A slightly fatter copy of a part, pushed out along its normals: drawn inside-out in dark grey it makes the outline.
function hull(geo) {
  const g = geo.clone(), p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * OUTLINE, p.getY(i) + n.getY(i) * OUTLINE, p.getZ(i) + n.getZ(i) * OUTLINE);
  return g;
}

export class Crowd {
  constructor(world) {
    this.world = world;
    const P = parts();
    const body = new THREE.MeshLambertMaterial({ color: '#ffffff' });
    const ink = new THREE.MeshBasicMaterial({ color: '#2a2c31', side: THREE.BackSide });
    this.meshes = {};
    for (const [name, geo] of [['torso', P.torso], ['head', P.head], ['legL', P.leg], ['legR', P.leg], ['armL', P.arm], ['armR', P.arm]]) {
      const m = new THREE.InstancedMesh(geo, body, MAX);
      const o = new THREE.InstancedMesh(hull(geo), ink, MAX);
      o.instanceMatrix = m.instanceMatrix;
      m.castShadow = name === 'torso' || name === 'head';
      for (const x of [m, o]) { x.count = 0; x.frustumCulled = false; x.userData.people = true; x.raycast = () => {}; world.scene.add(x); }
      this.meshes[name] = { m, o };
    }
    // A pale tint on each child's clothes, so they are not all the same.
    this.tints = ['#ffffff', '#fde3ea', '#fdf1cf', '#dff3f5', '#e9f5dc', '#ece4f6'];
    this.people = [];
    this.onStep = null;               // called with (x, z) as people walk between rooms (to wear paths)
    const self = this;
    this.mesh = { get visible() { return self.meshes.torso.m.visible; }, set visible(v) { for (const { m, o } of Object.values(self.meshes)) { m.visible = v; o.visible = v; } } };
    this.tmp = { base: new THREE.Matrix4(), part: new THREE.Matrix4(), rot: new THREE.Matrix4(), q: new THREE.Quaternion(), v: new THREE.Vector3(), s: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), e: new THREE.Euler() };
    world.updaters.add(dt => this.update(dt));
  }
  setCount(n) {
    for (const { m, o } of Object.values(this.meshes)) { m.count = n; o.count = n; }
    const c = new THREE.Color();
    this.people.forEach((p, i) => this.meshes.torso.m.setColorAt(i, c.set(this.tints[Math.floor(p.ph * 10) % this.tints.length])));
    if (this.meshes.torso.m.instanceColor) this.meshes.torso.m.instanceColor.needsUpdate = true;
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
    for (const { m } of Object.values(this.meshes)) m.instanceMatrix.needsUpdate = true;
  }
  // Put one person's body parts in place for this moment.
  pose(i, p, moving, t, dt) {
    const { base, part, rot, q, v, s, up, e } = this.tmp, M = this.meshes;
    let legL = 0, legR = 0, armL = 0, armR = 0, outL = -0.12, outR = 0.12, y = p.y, lean = 0;
    const swing = Math.sin(p.walk || 0);
    if (p.kind === 'sit') { legL = legR = -1.45; armL = armR = -0.55; y -= 0.045; }
    else if (p.kind === 'swim') { y -= 0.135; const w = t * 4 + p.ph; armL = Math.sin(w) * 2.6; armR = Math.sin(w + Math.PI) * 2.6; lean = 0.3; }
    else if (moving) { const a = p.kind === 'run' ? 0.9 : 0.55; legL = swing * a; legR = -swing * a; armL = -swing * a * 0.9; armR = swing * a * 0.9; y += Math.abs(Math.cos(p.walk || 0)) * (p.kind === 'run' ? 0.012 : 0.006); lean = p.kind === 'run' ? 0.18 : 0.04; }
    else { armL = Math.sin(t * 1.5 + p.ph) * 0.05; armR = -armL; }
    if (p.jumpT > 0) { p.jumpT -= dt; y += Math.abs(Math.sin(t * 9 + p.ph)) * 0.07; const wave = 2.7 + Math.sin(t * 14 + p.ph) * 0.25; outL = -wave; outR = wave; armL = armR = 0; }
    const nr = this.near, hide = nr && Math.abs(p.y - nr.y) < 0.2 && Math.hypot(p.x - nr.x, p.z - nr.z) < nr.r;
    q.setFromAxisAngle(up, p.yaw); v.set(p.x, y, p.z); s.setScalar(hide ? 1e-4 : p.s);
    base.compose(v, q, s);
    if (lean) base.multiply(rot.makeRotationX(lean));
    M.torso.m.setMatrixAt(i, base);
    M.head.m.setMatrixAt(i, base);
    const limb = (mesh, x, yy, rx, rz) => { part.makeTranslation(x, yy, 0).multiply(rot.makeRotationFromEuler(e.set(rx, 0, rz))); mesh.setMatrixAt(i, part.premultiply(base)); };
    limb(M.legL.m, -0.014, HIP, legL, 0);
    limb(M.legR.m, 0.014, HIP, legR, 0);
    limb(M.armL.m, -0.033, SHOULDER, armL, outL);
    limb(M.armR.m, 0.033, SHOULDER, armR, outR);
  }
  clear() { this.people = []; this.setCount(0); }
}
