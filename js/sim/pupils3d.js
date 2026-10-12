// Pupils in 3D: Kenney Mini Characters (CC0) with their own walk, sprint, sit and jump animations.
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { loadGLB } from '../core/models.js';
import { ACTIVITIES, ROOMS } from '../core/catalogue.js';
import { emo } from '../core/emoji.js';
import { esc } from '../ui/dom.js';

const HEIGHT = 0.4;
// Only gentle clips are ever used.
const CLIP = { idle: 'idle', walk: 'walk', sprint: 'sprint', sit: 'sit', jump: 'jump', emote: 'emote-yes', interact: 'interact-right', pick: 'pick-up', climb: 'idle', slide: 'sit', swim: 'walk' };

export class PupilsView {
  constructor(world) {
    this.world = world;
    this.group = world.groups.pupils;
    this.items = new Map();
    this.selected = null;
  }

  async ensure(pupils) {
    const want = new Set(pupils.map(p => p.name));
    for (const [name, it] of this.items) if (!want.has(name)) this.remove(name);
    await Promise.all(pupils.map(async p => {
      if (this.items.has(p.name)) return;
      const gltf = await loadGLB(`assets/models/characters/character-${p.model || 'male-a'}.glb`);
      const model = cloneSkinned(gltf.scene);
      model.traverse(o => {
        if (o.isMesh) {
          o.castShadow = true;
          o.frustumCulled = false;
          const m = o.material;
          o.material = new THREE.MeshLambertMaterial({ map: m.map || null, color: m.color ? m.color.clone() : 0xffffff });
          if (o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
        }
      });
      const box = new THREE.Box3().setFromObject(model);
      const s = HEIGHT / Math.max(0.01, box.max.y - box.min.y);
      model.scale.setScalar(s);
      const root = new THREE.Group();
      root.add(model);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.11, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: p.colour, transparent: true, opacity: 0.9, depthWrite: false }));
      ring.position.y = 0.012;
      root.add(ring);
      const mixer = new THREE.AnimationMixer(model);
      const actions = {};
      for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip);
      const el = document.createElement('div');
      el.className = 'bubble3d';
      const label = new CSS2DObject(el);
      label.position.set(0, HEIGHT + 0.16, 0);
      root.add(label);
      this.group.add(root);
      this.items.set(p.name, { root, model, mixer, actions, current: null, el, label, ring, bubbleKey: '' });
    }));
  }

  play(it, name) {
    const clipName = CLIP[name] || 'idle';
    if (it.current === clipName) return;
    const next = it.actions[clipName] || it.actions.idle;
    if (!next) return;
    const prev = it.current ? it.actions[it.current] : null;
    next.reset().fadeIn(0.18).play();
    if (name === 'sit' || name === 'slide') next.setLoop(THREE.LoopOnce, 1), next.clampWhenFinished = true;
    else next.setLoop(THREE.LoopRepeat, Infinity);
    if (prev && prev !== next) prev.fadeOut(0.18);
    it.current = clipName;
  }

  // Draw the sim state.
  update(day, dt, opts = {}) {
    for (const p of day.pupils) {
      const it = this.items.get(p.name);
      if (!it) continue;
      it.root.visible = p.active && p.state !== 'home';
      if (!it.root.visible) continue;
      const swim = p.anim === 'swim';
      it.root.position.set(p.pos.x, p.pos.y + (swim ? -0.13 : 0), p.pos.z);
      // Turn smoothly towards the way they are going.
      let d = p.dir - it.model.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      it.model.rotation.y += d * Math.min(1, dt * 10);
      this.play(it, p.anim);
      it.mixer.update(dt * (p.anim === 'sprint' ? 1.2 : 1));
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

export { ROOMS };
