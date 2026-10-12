// Pupils in 3D: little children drawn in code, with a coloured ring at their feet and a speech bubble.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { makeKid, KID_HEIGHT } from './kid.js';
import { ACTIVITIES } from '../core/catalogue.js';
import { emo } from '../core/emoji.js';
import { esc } from '../ui/dom.js';

export class PupilsView {
  constructor(world) {
    this.world = world;
    this.group = world.groups.pupils;
    this.items = new Map();
  }

  async ensure(pupils) {
    const want = new Set(pupils.map(p => p.name));
    for (const name of [...this.items.keys()]) if (!want.has(name)) this.remove(name);
    pupils.forEach((p, i) => {
      if (this.items.has(p.name)) return;
      const kid = makeKid({ colour: p.colour, seed: p.i ?? i });
      const root = new THREE.Group();
      root.add(kid.root);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.12, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: p.colour, transparent: true, opacity: 0.9, depthWrite: false }));
      ring.position.y = 0.012;
      root.add(ring);
      const el = document.createElement('div');
      el.className = 'bubble3d';
      const label = new CSS2DObject(el);
      label.position.set(0, KID_HEIGHT + 0.16, 0);
      root.add(label);
      this.group.add(root);
      this.items.set(p.name, { root, kid, el, label, ring, bubbleKey: '', t: (i * 1.7) % 5 });
    });
  }

  // Draw the simulation state.
  update(day, dt, opts = {}) {
    // When the camera is far away the children grow a little, so a six-year-old can still follow them.
    const w = this.world;
    const big = w.iso ? Math.min(1.35, Math.max(1, 1.2 / (w.ortho.zoom || 1))) : 1;
    // Moving children need fresh shadows, ten times a second is plenty.
    if (day.started && w.time - (this.shadowAt || 0) > 0.1) { this.shadowAt = w.time; w.markShadows(); }
    for (const p of day.pupils) {
      const it = this.items.get(p.name);
      if (!it) continue;
      it.root.visible = p.active && p.state !== 'home';
      if (!it.root.visible) continue;
      const swim = p.anim === 'swim';
      it.root.position.set(p.pos.x, p.pos.y + (swim ? -0.1 : 0), p.pos.z);
      it.root.scale.setScalar(big);
      // Turn smoothly to face the way they are going.
      let d = p.dir - it.kid.root.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      it.kid.root.rotation.y += d * Math.min(1, dt * 10);
      it.t += dt;
      it.kid.pose(p.anim || 'idle', it.t);
      it.ring.visible = !swim;
      // Speech bubble: what they are doing, or why they are stuck.
      let emoji = null, stuck = false;
      if (p.stuck) { emoji = p.stuck.why === 'full' ? '😟' : '🤔'; stuck = true; }
      else if (p.state === 'do' && p.act) emoji = ACTIVITIES[p.act]?.emoji;
      else if (p.state === 'walk' && p.want === 'slide' && p.anim === 'slide') emoji = '🛝';
      else if (p.state === 'waitbell') emoji = '🔔';
      const me = opts.selected === p.name;
      const showName = me || opts.names;
      const k = `${emoji}|${stuck}|${me}|${showName}`;
      if (k !== it.bubbleKey) {
        it.bubbleKey = k;
        it.el.className = `bubble3d${stuck ? ' stuck' : ''}${me ? ' me' : ''}`;
        it.el.innerHTML = `${emoji ? emo(emoji) : ''}${showName ? `<span class="nm" style="color:${p.colour}">${esc(p.name)}</span>` : ''}`;
        it.el.style.display = emoji || showName ? '' : 'none';
      }
    }
  }

  remove(name) {
    const it = this.items.get(name);
    if (!it) return;
    this.group.remove(it.root);
    it.el.remove();
    this.items.delete(name);
  }
  clear() { for (const name of [...this.items.keys()]) this.remove(name); }
}
