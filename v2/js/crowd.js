// People: black silhouettes that sit at desks, wander round rooms and roof terraces, run in the hall,
// swim in the pool, stroll across the meadow and, in the school day, walk from room to room.
// All of them are one instanced mesh, so it stays fast.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const MAX = 800;
function personGeometry() {
  const body = new THREE.CapsuleGeometry(0.034, 0.1, 3, 8).translate(0, 0.085, 0);
  const head = new THREE.SphereGeometry(0.036, 10, 8).translate(0, 0.197, 0);
  return mergeGeometries([body, head]);
}
export function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export class Crowd {
  constructor(world) {
    this.world = world;
    this.mesh = new THREE.InstancedMesh(personGeometry(), new THREE.MeshLambertMaterial({ color: '#23252b' }), MAX);
    this.mesh.castShadow = true;
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.userData.people = true;
    world.scene.add(this.mesh);
    this.people = [];
    this.onStep = null;               // called with (x, z) as people walk on the ground (to wear paths)
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0);
    world.updaters.add(dt => this.update(dt));
  }
  // zones: [{ ox, oy, oz, w, d, inside(x, z, m) | rect {x0,z0,x1,z1} + ok(x, z), walkers, seats: [[x,y,z]], fill, speed, kind, boxId }]
  set(zones, seed = 1) {
    const r = seeded(seed);
    this.people = [];
    for (const z of zones) this.addZone(z, r);
    this.mesh.count = this.people.length;
    this.update(0);
  }
  addZone(z, r) {
    for (const s of z.seats || []) {
      if (r() > (z.fill ?? 0.8) || this.people.length >= MAX) continue;
      this.people.push({ kind: 'sit', boxId: z.boxId, x: z.ox + s[0], y: z.oy + s[1], z: z.oz + s[2], s: 0.72 + r() * 0.08, ph: r() * 6, yaw: Math.PI + (r() - 0.5) * 0.6 });
    }
    for (let i = 0; i < (z.walkers || 0) && this.people.length < MAX; i++) {
      const p = { kind: z.kind || 'walk', zone: z, s: z.adults && i === 0 ? 1 : 0.74 + r() * 0.1, ph: r() * 6, wait: r() * 2, speed: (z.speed || 0.32) * (0.8 + r() * 0.4), yaw: r() * 6.28, r };
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
  // Everyone in (or on) a building jumps for joy.
  cheer(boxId) {
    let n = 0;
    for (const p of this.people) if (p.boxId === boxId || p.zone?.boxId === boxId) { p.jumpT = 1.8 + p.ph * 0.05; n++; }
    return n;
  }
  update(dt) {
    const t = (this.t = (this.t || 0) + dt);
    const { m4, q, v, s, up } = this;
    let steps = 0;
    this.people.forEach((p, i) => {
      let bob = 0, moving = false;
      if (p.kind === 'sit') { bob = Math.sin(t * 1.3 + p.ph) * 0.003; }
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
        bob = moving ? Math.abs(Math.sin(t * 10 + p.ph)) * 0.012 : 0;
      } else if (p.kind === 'swim') {
        const z = p.zone;
        if (p.wait > 0) p.wait -= dt;
        else { const dx = p.tx - p.x, dz = p.tz - p.z, dd = Math.hypot(dx, dz); if (dd < 0.03) { [p.tx, p.tz] = this.pick(z, p.r); } else { const st = Math.min(dd, p.speed * 0.5 * dt); p.x += dx / dd * st; p.z += dz / dd * st; p.yaw = Math.atan2(dx, dz); } }
        bob = -0.15 + Math.sin(t * 2 + p.ph) * 0.012;
      } else {
        if (p.wait > 0) { p.wait -= dt; }
        else {
          const dx = p.tx - p.x, dz = p.tz - p.z, dd = Math.hypot(dx, dz);
          if (dd < 0.02) { p.wait = 0.4 + p.r() * (p.kind === 'run' ? 0.3 : 2.2); [p.tx, p.tz] = this.pick(p.zone, p.r); }
          else { const st = Math.min(dd, p.speed * dt); p.x += dx / dd * st; p.z += dz / dd * st; p.yaw = Math.atan2(dx, dz); bob = Math.abs(Math.sin(t * (p.kind === 'run' ? 16 : 10) + p.ph)) * 0.012; moving = true; }
        }
      }
      if (p.jumpT > 0) { p.jumpT -= dt; bob += Math.abs(Math.sin(t * 9 + p.ph)) * 0.08; }
      if (moving && p.kind === 'path' && this.onStep && p.y < 0.06 && (p.trail = (p.trail || 0) + dt) > 0.06 && steps++ < 160) { p.trail = 0; this.onStep(p.x, p.z); }
      v.set(p.x, p.y + bob, p.z); q.setFromAxisAngle(up, p.yaw); s.setScalar(p.s); if (p.kind === 'sit') s.y *= 0.74;
      m4.compose(v, q, s); this.mesh.setMatrixAt(i, m4);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear() { this.people = []; this.mesh.count = 0; }
}
