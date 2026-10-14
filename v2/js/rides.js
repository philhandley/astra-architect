// Riding: during a school day the child whose turn it is goes on the ride itself, following the ride's moving
// parts (the swing seat, the seesaw plank, the roundabout, the zip-line bar, the slide tube), instead of
// vanishing and popping out at the end. rideDriver(group) looks at a playground piece and returns
// drive(k, u): u runs from 0 to 1 over the go, and it sets the child's place, facing, pose and tilt.
import * as THREE from 'three';
import { SEAT, SIT_DROP, REACH } from './kid.js';

const v = new THREE.Vector3(), w = new THREE.Vector3();
// A point in a part's own frame, in the world (the part may be swinging or turning right now).
const at = (o, x, y, z) => { o.updateWorldMatrix(true, false); return o.localToWorld(new THREE.Vector3(x, y, z)); };
// Which way a direction in a part's frame points in the world, as a facing.
const yawOf = (o, x, z) => { o.updateWorldMatrix(true, false); v.set(0, 0, 0); w.set(x, 0, z); o.localToWorld(v); o.localToWorld(w); return Math.atan2(w.x - v.x, w.z - v.z); };
const lerp = (a, b, f) => a + (b - a) * f;
const ease = f => f * f * (3 - 2 * f);
// Where to put a sitting child so their bottom is at height `bum` (the crowd lowers a sitter by SIT_DROP).
const sitY = (k, bum) => bum + SIT_DROP - SEAT * k.s;
// Walk from where the go started (k.rideFrom) to a point, f of the way.
function walkTo(k, p, f) {
  const [x0, y0, z0] = k.rideFrom;
  k.x = lerp(x0, p.x, f); k.y = lerp(y0, p.y, f); k.z = lerp(z0, p.z, f);
  if (Math.hypot(p.x - x0, p.z - z0) > 0.01) k.yaw = Math.atan2(p.x - x0, p.z - z0);
  k.pose = 'walk'; k.moving = true; k.tilt = 0;
}
// Step from one point to another (f of the way), walking.
function step(k, a, b, f) { k.x = lerp(a.x, b.x, f); k.y = lerp(a.y, b.y, f); k.z = lerp(a.z, b.z, f); k.yaw = Math.atan2(b.x - a.x, b.z - a.z); k.pose = 'walk'; k.moving = true; k.tilt = 0; }
const still = (k, pose) => { k.pose = pose; k.moving = false; };

export function rideDriver(group) {
  let slide, zip, swing, plank, spin, info;
  group.traverse(o => { const d = o.userData; if (d.slide) slide = o; if (d.zipline) zip = o; if (d.swing && !swing) swing = o; if (d.rock) plank = o; if (d.yspin && d.R) spin = o; if (d.rideInfo) info = o; });

  // The helter-skelter: walk to the door, up the stairs inside the tower (out of sight), whizz down the tube.
  if (slide) {
    const S = slide.userData.slide, P = slide.parent, door = S.path[S.path.length - 1];
    return (k, u) => {
      if (u < 0.15) { k.hidden = false; walkTo(k, at(P, door.x, 0, door.z), u / 0.15); return; }
      if (u < 0.32) { k.hidden = true; still(k, 'walk'); return; }
      k.hidden = false;
      if (u > 0.9) { const e = S.curve.getPointAt(1), out = S.path[0]; step(k, at(P, e.x, 0.012, e.z), at(P, out.x + 0.08, 0.012, out.z), (u - 0.9) / 0.1); return; }      // (out of the end of the tube)
      const f = (u - 0.32) / 0.58, s = Math.min(1, f * f * 0.4 + f * 0.6), p = S.curve.getPointAt(s), q = S.curve.getPointAt(Math.min(1, s + 0.01));
      const a = at(P, p.x, p.y - 0.057, p.z), b = at(P, q.x, q.y - 0.057, q.z);
      k.x = a.x; k.z = a.z; k.y = sitY(k, a.y); k.yaw = Math.atan2(b.x - a.x, b.z - a.z); k.tilt = 0; still(k, 'sit');
    };
  }
  // The zip line: walk to the steps, up on to the deck, zip down holding the bar, drop on to the soft mat.
  if (zip) {
    const Z = zip.userData.zipline, x0 = Z.x0 - 0.1, deck = 0.215;
    return (k, u) => {
      k.hidden = false;
      if (u < 0.18) { walkTo(k, at(zip, x0 + 0.5, 0.012, 0), u / 0.18); return; }
      if (u < 0.3) { step(k, at(zip, x0 + 0.5, 0.012, 0), at(zip, x0 + 0.1, deck, 0), (u - 0.18) / 0.12); return; }
      const yaw = yawOf(zip, 1, 0), hang = y => y - 0.162 - REACH * k.s;
      if (u < 0.86) {
        const e = Math.pow((u - 0.3) / 0.56, 1.5), bx = lerp(Z.x0, Z.x1, e), by = lerp(Z.y0, Z.y1, e), p = at(zip, bx, hang(by), 0);
        Z.dayPos = [bx, by]; Z.dayAt = performance.now();      // (the bar comes along: sitescreen.js moves it)
        k.x = p.x; k.y = p.y; k.z = p.z; k.yaw = yaw; k.tilt = 0; still(k, 'hang'); return;
      }
      const a = at(zip, Z.x1, hang(Z.y1), 0), b = at(zip, Z.x1 + 0.02, 0.012, 0), f = ease((u - 0.86) / 0.14);
      k.x = lerp(a.x, b.x, f); k.y = lerp(a.y, b.y, f); k.z = lerp(a.z, b.z, f); k.yaw = yaw; still(k, f < 1 ? 'hang' : 'walk');
    };
  }
  // The swings: walk to a seat, sit and swing (leaning with the ropes), hop off in front.
  if (swing) {
    const P = swing.parent, px = swing.position.x, py = swing.position.y;
    return (k, u) => {
      k.hidden = false;
      const front = at(P, px, 0.012, 0.16);
      if (u < 0.14) { walkTo(k, front, u / 0.14); return; }
      if (u < 0.9) { const b = at(swing, 0, -0.292, 0.012); k.x = b.x; k.z = b.z; k.y = sitY(k, b.y); k.yaw = yawOf(P, 0, 1); k.tilt = swing.rotation.x * 0.9; still(k, 'sit'); return; }
      const b = at(swing, 0, -0.292, 0.012); step(k, { x: b.x, y: 0.012, z: b.z }, front, ease((u - 0.9) / 0.1));
    };
  }
  // The seesaw: sit on one end and go up and down.
  if (plank) {
    const P = plank.parent, L = plank.userData.L || 0.8, end = L / 2 - 0.03;
    return (k, u) => {
      k.hidden = false;
      const side = at(P, end, 0.012, 0.12);
      if (u < 0.15) { walkTo(k, side, u / 0.15); return; }
      if (u < 0.9) { const b = at(plank, end, 0.012, 0); k.x = b.x; k.z = b.z; k.y = sitY(k, b.y); k.yaw = yawOf(plank, -1, 0); k.tilt = plank.rotation.z; still(k, 'sit'); return; }
      const b = at(plank, end, 0.012, 0); step(k, { x: b.x, y: 0.012, z: b.z }, side, ease((u - 0.9) / 0.1));
    };
  }
  // The roundabout: step on, hold the rail and go round, step off.
  if (spin) {
    const R = spin.userData.R, a = Math.PI / 3, ca = Math.cos(a), sa = Math.sin(a);
    return (k, u) => {
      k.hidden = false;
      if (u < 0.14) { walkTo(k, at(spin, ca * (R + 0.08), 0.012, sa * (R + 0.08)), u / 0.14); return; }
      const on = at(spin, ca * R * 0.75, 0.065, sa * R * 0.75);
      if (u < 0.9) { k.x = on.x; k.y = on.y; k.z = on.z; k.yaw = yawOf(spin, -sa, ca); k.tilt = 0; still(k, 'hold'); return; }
      step(k, on, at(spin, ca * (R + 0.12), 0.012, sa * (R + 0.12)), ease((u - 0.9) / 0.1));
    };
  }
  if (info) {
    const I = info.userData.rideInfo;
    // The climbing dome: up one side, over the top and down the other.
    if (I.kind === 'climbdome') {
      const R = I.R + 0.01;
      return (k, u) => {
        k.hidden = false;
        const ph = k.ph || 0, cx = Math.cos(ph), cz = Math.sin(ph), pt = al => at(info, Math.sin(al) * R * cx, Math.cos(al) * R, Math.sin(al) * R * cz), lim = 1.3;
        if (u < 0.12) { walkTo(k, pt(-lim), u / 0.12); return; }
        const al = lerp(-lim, lim, (u - 0.12) / 0.88), p = pt(al);
        k.x = p.x; k.y = p.y; k.z = p.z; k.yaw = yawOf(info, cx, cz); k.tilt = 0; k.pose = 'climb'; k.moving = true;
      };
    }
    // The play tower: up the net, across the top, down the slide.
    if (I.kind === 'playtower') {
      const top = I.top;
      return (k, u) => {
        k.hidden = false;
        const foot = at(info, 0, 0.012, -0.36), up = at(info, 0, top + 0.015, -0.16), over = at(info, 0, top + 0.015, 0.12);
        if (u < 0.12) { walkTo(k, foot, u / 0.12); return; }
        if (u < 0.4) { const f = (u - 0.12) / 0.28; k.x = lerp(foot.x, up.x, f); k.y = lerp(foot.y, up.y, f); k.z = lerp(foot.z, up.z, f); k.yaw = yawOf(info, 0, 1); k.tilt = 0; k.pose = 'climb'; k.moving = true; return; }
        if (u < 0.5) { step(k, up, over, (u - 0.4) / 0.1); return; }
        if (u < 0.86) { const f = ease((u - 0.5) / 0.36), b = at(info, 0, lerp(0.302, 0.032, f), lerp(0.16, 0.48, f)); k.x = b.x; k.z = b.z; k.y = sitY(k, b.y); k.yaw = yawOf(info, 0, 1); k.tilt = 0; still(k, 'sit'); return; }
        step(k, at(info, 0, 0.012, 0.5), at(info, 0, 0.012, 0.62), (u - 0.86) / 0.14);
      };
    }
  }
  return null;
}
