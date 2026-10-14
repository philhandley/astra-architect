// The sky: day, sunset, night and rain. One button cycles them. Night makes the windows glow; rain falls in
// streaks over the site and spins the wind turbines faster. Nothing here is saved: the sun comes up on reload.
import * as THREE from 'three';
import { mat } from './shapes.js';
import { GRID } from './site.js';

export const MOODS = ['day', 'sunset', 'night', 'rain'];
export const MOOD_NAMES = { day: 'Day', sunset: 'Sunset', night: 'Night', rain: 'Rain' };
export const MOOD_LINES = { day: 'Good morning! The sun is up.', sunset: 'Sunset. The sky goes orange and the shadows get long.', night: 'Night time! Look at the windows glowing.', rain: 'Rain! The wind turbines are spinning fast.' };

// Each sky: the gradient (horizon to overhead), the hemisphere light, the sun, how the windows glow, and the wind.
const LOOKS = {
  day: { sky: ['#f7f4ec', '#eef4ef', '#dceef3'], stars: 0, hemi: ['#ffffff', '#e6dfd0', 1.62], sun: ['#fff4e2', 1.95, [-0.62, 1.05, 0.55]], glow: ['#6cb6d6', 0.22], wind: 1, rain: false },
  sunset: { sky: ['#f9d9c0', '#f4b58c', '#8fb0d6'], stars: 0, hemi: ['#f7d9c4', '#b08d6b', 1.15], sun: ['#ffb36b', 1.7, [-1.0, 0.42, 0.3]], glow: ['#ffc27a', 0.55], wind: 1, rain: false },
  night: { sky: ['#2b3f6e', '#1b2b57', '#0d1b3a'], stars: 1, hemi: ['#6a7fb0', '#2a3450', 0.75], sun: ['#9fb4ff', 0.6, [0.5, 1.0, -0.4]], glow: ['#ffd27a', 1.1], wind: 1, rain: false },
  rain: { sky: ['#d5d9dd', '#b9c2cb', '#8c9aa8'], stars: 0, hemi: ['#dfe4e8', '#aeb4ba', 1.05], sun: ['#dfe6ee', 0.7, [-0.62, 1.05, 0.55]], glow: ['#ffe7a3', 0.5], wind: 2.8, rain: true },
};

function skyTexture(cols, stars) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, cols[2]); gr.addColorStop(0.55, cols[1]); gr.addColorStop(1, cols[0]);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
  if (stars) { g.fillStyle = '#ffffff'; let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; for (let i = 0; i < 90; i++) { const x = rnd() * 64, y = rnd() * 150, r = rnd() < 0.2 ? 1.1 : 0.6; g.globalAlpha = 0.5 + rnd() * 0.5; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); } g.globalAlpha = 1; }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The window glass is one shared material (mat() caches it; facade.js asks for exactly this), so changing its glow
// lights every window in the school at once.
const GLASS = () => [mat('#a9d8ec', { emissive: '#6cb6d6', emissiveIntensity: 0.22 })];

export function mountMood(world) {
  let mood = 'day', rain = null, fn = null;
  const skies = {};
  const skyFor = m => skies[m] || (skies[m] = skyTexture(LOOKS[m].sky, LOOKS[m].stars));

  function makeRain() {
    const n = 1400, pos = new Float32Array(n * 6), W = GRID.w + 6, D = GRID.d + 6;
    for (let i = 0; i < n; i++) { const x = -3 + Math.random() * W, z = -3 + Math.random() * D, y = Math.random() * 9; pos.set([x, y, z, x, y + 0.14, z], i * 6); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#7f97ad', transparent: true, opacity: 0.55 }));
    l.frustumCulled = false; l.raycast = () => {}; l.userData.noInk = true;
    return l;
  }
  function set(m, { instant = false } = {}) {
    if (!LOOKS[m]) return;
    mood = m;
    const L = LOOKS[m], from = { hemi: world.hemi.intensity, sun: world.sun.intensity, glow: GLASS()[0].emissiveIntensity || 0 };
    const hemiSky = world.hemi.color.clone(), hemiGround = world.hemi.groundColor.clone(), sunCol = world.sun.color.clone(), dir0 = world.sunDir.clone(), glow0 = GLASS()[0].emissive.clone();
    const toHemiSky = new THREE.Color(L.hemi[0]), toHemiGround = new THREE.Color(L.hemi[1]), toSun = new THREE.Color(L.sun[0]), toDir = new THREE.Vector3(...L.sun[2]).normalize(), toGlow = new THREE.Color(L.glow[0]);
    world.scene.background = skyFor(m);
    world.wind = L.wind;
    if (L.rain && !rain) { rain = makeRain(); world.scene.add(rain); }
    if (!L.rain && rain) { world.scene.remove(rain); rain.geometry.dispose(); rain = null; }
    let t = instant ? 1 : 0;
    if (fn) world.updaters.delete(fn);
    fn = dt => {
      t = Math.min(1, t + dt / 1.2);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      world.hemi.intensity = from.hemi + (L.hemi[2] - from.hemi) * e;
      world.hemi.color.copy(hemiSky).lerp(toHemiSky, e); world.hemi.groundColor.copy(hemiGround).lerp(toHemiGround, e);
      world.sun.intensity = from.sun + (L.sun[1] - from.sun) * e;
      world.sun.color.copy(sunCol).lerp(toSun, e);
      world.sunDir.copy(dir0).lerp(toDir, e).normalize(); world.setSunFocus(world.sunFocus.x, world.sunFocus.z);
      for (const g of GLASS()) { g.emissiveIntensity = from.glow + (L.glow[1] - from.glow) * e; g.emissive.copy(glow0).lerp(toGlow, e); }
      // Rain falls, and stays outside: it hides while someone is walking indoors.
      if (rain) {
        rain.visible = !document.body.classList.contains('walking');
        const p = rain.geometry.attributes.position.array;
        for (let i = 0; i < p.length; i += 6) { p[i + 1] -= dt * 5; p[i + 4] -= dt * 5; if (p[i + 1] < 0) { p[i + 1] += 9; p[i + 4] += 9; } }
        rain.geometry.attributes.position.needsUpdate = true;
      }
      if (t >= 1 && !rain) { world.updaters.delete(fn); fn = null; }
    };
    world.updaters.add(fn);
  }
  return { get mood() { return mood; }, set, next() { set(MOODS[(MOODS.indexOf(mood) + 1) % MOODS.length]); return mood; } };
}
