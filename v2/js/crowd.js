// People: black silhouettes that sit at desks, wander round rooms and roof terraces, run in the hall,
// swim in the pool and stroll across the meadow. All of them are one instanced mesh, so it stays fast.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const MAX = 700;
function personGeometry() {
  const body = new THREE.CapsuleGeometry(0.034, 0.1, 3, 8).translate(0, 0.085, 0);
  const head = new THREE.SphereGeometry(0.036, 10, 8).translate(0, 0.197, 0);
  return mergeGeometries([body, head]);
}

export class Crowd {
  constructor(world) {
    this.world = world;
    this.mesh = new THREE.InstancedMesh(personGeometry(), new THREE.MeshLambertMaterial({ color: '#23252b' }), MAX);
    this.mesh.castShadow = true;
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    world.scene.add(this.mesh);
    this.people = [];
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0);
    world.updaters.add(dt => this.update(dt));
  }
  // zones: [{ ox, oy, oz (world origin), inside(x, z, m) local test or rect {x0,z0,x1,z1}, walkers, seats: [[x,y,z]], fill, speed, kind }]
  set(zones, seed = 1) {
    let a = seed >>> 0;
    const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    this.people = [];
    for (const z of zones) {
      for (const s of z.seats || []) {
        if (r() > (z.fill ?? 0.8) || this.people.length >= MAX) continue;
        this.people.push({ kind: 'sit', x: z.ox + s[0], y: z.oy + s[1], z: z.oz + s[2], s: 0.72 + r() * 0.08, ph: r() * 6, yaw: Math.PI + (r() - 0.5) * 0.6 });
      }
      for (let i = 0; i < (z.walkers || 0) && this.people.length < MAX; i++) {
        const p = { kind: z.kind || 'walk', zone: z, s: z.adults && i === 0 ? 1 : 0.74 + r() * 0.1, ph: r() * 6, wait: r() * 2, speed: (z.speed || 0.32) * (0.8 + r() * 0.4), yaw: r() * 6.28, r };
        const [x, zz] = this.pick(z, r); p.x = x; p.z = zz; p.y = z.oy; [p.tx, p.tz] = this.pick(z, r);
        this.people.push(p);
      }
    }
    this.mesh.count = this.people.length;
    this.update(0);
  }
  pick(z, r) {
    for (let k = 0; k < 30; k++) {
      if (z.rect) { const x = z.rect.x0 + r() * (z.rect.x1 - z.rect.x0), zz = z.rect.z0 + r() * (z.rect.z1 - z.rect.z0); if (!z.ok || z.ok(x, zz)) return [x, zz]; continue; }
      const lx = (r() - 0.5) * z.w, lz = (r() - 0.5) * z.d;
      if (z.inside(lx, lz, z.margin ?? 0.08)) return [z.ox + lx, z.oz + lz];
    }
    return [z.ox, z.oz];
  }
  update(dt) {
    const t = (this.t = (this.t || 0) + dt);
    const { m4, q, v, s, up } = this;
    this.people.forEach((p, i) => {
      let bob = 0;
      if (p.kind === 'sit') { bob = Math.sin(t * 1.3 + p.ph) * 0.003; }
      else if (p.kind === 'swim') {
        p.ph += dt; const z = p.zone;
        if (p.wait > 0) p.wait -= dt;
        else { const dx = p.tx - p.x, dz = p.tz - p.z, dd = Math.hypot(dx, dz); if (dd < 0.03) { [p.tx, p.tz] = this.pick(z, p.r); } else { const st = Math.min(dd, p.speed * 0.5 * dt); p.x += dx / dd * st; p.z += dz / dd * st; p.yaw = Math.atan2(dx, dz); } }
        bob = -0.15 + Math.sin(t * 2 + p.ph) * 0.012;
      } else {
        if (p.wait > 0) { p.wait -= dt; }
        else {
          const dx = p.tx - p.x, dz = p.tz - p.z, dd = Math.hypot(dx, dz);
          if (dd < 0.02) { p.wait = 0.4 + p.r() * (p.kind === 'run' ? 0.3 : 2.2); [p.tx, p.tz] = this.pick(p.zone, p.r); }
          else { const st = Math.min(dd, p.speed * dt); p.x += dx / dd * st; p.z += dz / dd * st; p.yaw = Math.atan2(dx, dz); bob = Math.abs(Math.sin(t * (p.kind === 'run' ? 16 : 10) + p.ph)) * 0.012; }
        }
      }
      v.set(p.x, p.y + bob, p.z); q.setFromAxisAngle(up, p.yaw); s.setScalar(p.s);
      m4.compose(v, q, s); this.mesh.setMatrixAt(i, m4);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear() { this.people = []; this.mesh.count = 0; }
}
