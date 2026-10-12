// The site: zones per cell and ground heights, loaded from assets/site/site.json.
let SITE = null;

export async function loadSite() {
  if (SITE) return SITE;
  const r = await fetch('assets/site/site.json');
  const s = await r.json();
  const hw = s.w * s.res + 1;
  const heights = new Float32Array(s.heights.length);
  for (let i = 0; i < heights.length; i++) heights[i] = s.heights[i] / 100;
  SITE = { ...s, hw, hd: s.d * s.res + 1, heights };
  return SITE;
}

export const site = () => SITE;

export function zone(x, z) {
  if (!SITE || x < 0 || z < 0 || x >= SITE.w || z >= SITE.d) return 'x';
  return SITE.zones[z][x];
}

export const ZONE_NAMES = { m: 'the meadow', b: 'the beach', f: 'the forest', w: 'the sea', p: 'the waterfall pool', r: 'the stream', c: 'the rocks', x: 'off the map' };

export const isWater = z => z === 'w' || z === 'p' || z === 'r';
export const isBuildable = z => z === 'm' || z === 'b' || z === 'f';
export const isWalkGround = z => z === 'm' || z === 'b' || z === 'f';

// Ground height (world y) at a world position (cells), bilinear on the height grid.
export function groundAt(wx, wz) {
  if (!SITE) return 0;
  const { res, hw, hd, heights } = SITE;
  const fx = Math.min(Math.max(wx * res, 0), hw - 1.001), fz = Math.min(Math.max(wz * res, 0), hd - 1.001);
  const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
  const h = (a, b) => heights[b * hw + a];
  return (h(i, j) * (1 - tx) + h(i + 1, j) * tx) * (1 - tz) + (h(i, j + 1) * (1 - tx) + h(i + 1, j + 1) * tx) * tz;
}

// Height used for building on a cell: buildable cells are flat at 0; forest cells may be raised.
export function cellGround(x, z) {
  const zn = zone(x, z);
  if (zn === 'm' || zn === 'b') return 0;
  if (isWater(zn)) return 0;   // pools and bridges float at deck height
  return groundAt(x + 0.5, z + 0.5);
}

// A forest cell is buildable only where the ground is still nearly flat (the forest edge).
export function canBuildOn(x, z, room) {
  const zn = zone(x, z);
  if (zn === 'x' || zn === 'c') return { ok: false, why: zn === 'c' ? 'rock' : 'edge' };
  if (isWater(zn)) return room && room.water ? { ok: true } : (room && room.id === 'aquarium' && zn === 'w' ? { ok: true } : { ok: false, why: 'water' });
  if (zn === 'f' && groundAt(x + 0.5, z + 0.5) > 0.12) return { ok: false, why: 'slope' };
  return { ok: true };
}
