// Section and elevation: look at the school from one side, and slide a cut through it like a doll's house.
import * as THREE from 'three';
import { CLIP, clipPlane } from '../core/scene.js';
import { bounds } from '../core/design.js';
import { LEVEL_H } from '../core/catalogue.js';
import { h, esc, say, sfx } from '../ui/dom.js';
import { emo } from '../core/emoji.js';

const SIDES = [
  { id: 'south', d: [0, 1], label: 'From the sea', emoji: '🌊' },
  { id: 'east', d: [1, 0], label: 'From the east', emoji: '🌅' },
  { id: 'north', d: [0, -1], label: 'From the mountains', emoji: '🏔️' },
  { id: 'west', d: [-1, 0], label: 'From the west', emoji: '🌳' },
];

export function startSection(api, world, root) {
  if (api.S.mode === 'blocks') api.setMode('building');
  const ui = h(`<div class="section-ui"></div>`);
  const sidebar = h(`<div class="pill" style="position:absolute;top:84px;left:50%;transform:translateX(-50%);z-index:6;gap:6px;padding:6px"></div>`);
  const slider = h(`<div class="section-slider pill" style="padding:8px 18px">${emo('🏫')}<input type="range" min="0" max="1000" value="1000" aria-label="Cut through the school"><b class="cutlbl" style="min-width:150px">Outside view</b></div>`);
  ui.append(sidebar, slider);
  root.appendChild(ui);
  const input = slider.querySelector('input');
  const lbl = slider.querySelector('.cutlbl');
  let side = SIDES[0];
  let zoomF = 1;
  const btns = SIDES.map(s => {
    const b = h(`<button class="opt ${s === side ? 'on' : ''}" type="button" style="min-width:86px;min-height:70px">${emo(s.emoji)}<span>${esc(s.label)}</span></button>`);
    b.addEventListener('click', () => { side = s; btns.forEach(x => x.classList.toggle('on', x === b)); frame(); sfx.tap(); api.emit('sectionSide', { side: s.id }); });
    sidebar.append(b);
    return b;
  });

  world.sky.visible = false;
  world.scene.background = new THREE.Color('#eef2f4');
  CLIP.length = 0;
  CLIP.push(clipPlane);
  world.camera = world.ortho;
  world.controls.enabled = false;

  let range = { min: 0, max: 1 };
  function frame() {
    const b = bounds(api.design) || { x0: 10, x1: 26, z0: 22, z1: 34, l1: 1, cx: 18, cz: 28 };
    const [dx, dz] = side.d;
    const along = p => p[0] * dx + p[1] * dz;
    const corners = [[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1]].map(along);
    range = { min: Math.min(...corners), max: Math.max(...corners) };
    const width = dx !== 0 ? b.z1 - b.z0 : b.x1 - b.x0;
    const height = Math.max(1, b.l1) * LEVEL_H;
    const aspect = (world.w || 1280) / (world.h || 800);
    const halfH = Math.max(height * 0.9 + 0.6, (width / 2 + 1.5) / aspect) * zoomF;
    const cy = Math.max(halfH * 0.55, height / 2) - 0.25;
    const c = new THREE.Vector3(b.cx, cy, b.cz);
    world.ortho.position.set(c.x + dx * 80, cy, c.z + dz * 80);
    world.ortho.up.set(0, 1, 0);
    world.ortho.lookAt(c);
    world.setOrthoView(0, 0, halfH);
    applyCut();
  }
  function applyCut() {
    const t = input.value / 1000;
    const [dx, dz] = side.d;
    // t = 1: just in front of the school (an elevation). t = 0: through the back.
    const cut = range.min + (range.max - range.min + 0.6) * t;
    clipPlane.normal.set(-dx, 0, -dz);
    clipPlane.constant = cut;
    lbl.textContent = t > 0.98 ? 'Outside view' : 'Cut through';
  }
  input.addEventListener('input', () => { applyCut(); api.emit('section', { t: input.value / 1000 }); });
  frame();
  say('This is a section. Slide the bar to cut through the school and see inside, like a doll\'s house.');

  return {
    zoom(f) { zoomF = Math.max(0.35, Math.min(2.5, zoomF * f)); frame(); },
    destroy() {
      ui.remove();
      CLIP.length = 0;
      world.scene.background = null;
      world.sky.visible = true;
      world.camera = world.cam;
      world.controls.enabled = true;
    },
  };
}
