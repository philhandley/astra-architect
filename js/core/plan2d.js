// The plan: an architect's floor plan drawn on a 2D canvas over the painted map.
// Also used for the homework drawing sheet.
import { FORMS, ROOMS, mix } from './catalogue.js';
import { key, roomGroups, DIRS, footprint, mood } from './design.js';
import { BOX, isRoomCell, archOpenSide, wedgeDir } from './arch.js';
import { emojiImage } from './emoji.js';

let mapImg = null;
export function loadMapImage() {
  if (!mapImg) mapImg = new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = 'assets/site/map.jpg'; });
  return mapImg;
}

const INK = '#23262d';
const emojiCache = new Map();
function emojiNow(ch, redraw) {
  if (emojiCache.has(ch)) return emojiCache.get(ch);
  emojiCache.set(ch, null);
  emojiImage(ch).then(img => { emojiCache.set(ch, img); redraw && redraw(); });
  return null;
}

// view: { x0, z0, s } where s = pixels per cell. opts: { level, labels, map, bubbles, faces, ghost, select, redraw, traffic, paper }
export function drawPlan(g, W, H, idx, doors, view, opts = {}) {
  const { x0, z0, s } = view;
  const L = opts.level ?? 0;
  const X = x => (x - x0) * s, Z = z => (z - z0) * s;
  g.save();
  if (!opts.overlay) {
  g.clearRect(0, 0, W, H);
  // Paper and map.
  g.fillStyle = opts.paper ? '#ffffff' : '#f4f1ea';
  g.fillRect(0, 0, W, H);
  }
  if (!opts.overlay && opts.map !== false && opts.mapImg) {
    g.globalAlpha = opts.paper ? 0.5 : 0.85;
    g.drawImage(opts.mapImg, X(0), Z(0), 60 * s, 42 * s);
    g.globalAlpha = 1;
    // A wash so the drawing reads clearly on top.
    g.fillStyle = opts.paper ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.32)';
    g.fillRect(X(0), Z(0), 60 * s, 42 * s);
  }
  // Grid
  if (s >= 14 && !opts.paper && !opts.overlay) {
    g.strokeStyle = 'rgba(40,60,90,0.10)';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(60, x0 + W / s + 1); x++) { g.moveTo(X(x), Z(0)); g.lineTo(X(x), Z(42)); }
    for (let z = Math.max(0, Math.floor(z0)); z <= Math.min(42, z0 + H / s + 1); z++) { g.moveTo(X(0), Z(z)); g.lineTo(X(60), Z(z)); }
    g.stroke();
  }

  if (opts.bubbles) { drawBubbles(g, idx, L, X, Z, s, opts); g.restore(); return; }

  // The floor below, faintly.
  if (L > 0) {
    g.fillStyle = 'rgba(35,38,45,0.10)';
    for (const [k, c] of idx.occ) { const [x, z, l] = k.split(',').map(Number); if (l === L - 1) g.fillRect(X(x), Z(z), s, s); }
  }

  const cellsAt = [];
  for (const [k, c] of idx.occ) { const [x, z, l] = k.split(',').map(Number); if (l === L) cellsAt.push({ x, z, c }); }
  const drawn = new Set();

  // Room fills.
  for (const { x, z, c } of cellsAt) {
    const R = ROOMS[c.room];
    const f = c.form;
    if (BOX.has(f) || f === 'arch') {
      g.fillStyle = mix(R.colour, '#ffffff', 0.55);
      g.fillRect(X(x), Z(z), s + 0.5, s + 0.5);
    }
    if (drawn.has(c.id)) continue;
    drawn.add(c.id);
    if (f === 'cylinder') circleRoom(g, X(c.x + 0.5), Z(c.z + 0.5), s * 0.47, R, s);
    else if (f === 'dome') circleRoom(g, X(c.x + 1), Z(c.z + 1), s * 0.97, R, s, true);
    else if (f === 'curve') curveRoom(g, c, X, Z, s, R);
    else if (f === 'slab') slabThing(g, c, X, Z, s, R);
    else if (f === 'pad') padThing(g, c, X, Z, s, R, idx);
    else if (f === 'wedge') wedgeThing(g, c, X, Z, s, R);
    else if (f === 'roof') { g.fillStyle = '#c96a4f'; g.fillRect(X(c.x) + s * 0.05, Z(c.z) + s * 0.05, s * 0.9, s * 0.9); g.strokeStyle = INK; g.lineWidth = 1; g.beginPath(); g.moveTo(X(c.x) + s * 0.05, Z(c.z + 0.5)); g.lineTo(X(c.x + 0.95), Z(c.z + 0.5)); g.stroke(); }
  }

  // Walls, doors and windows of box rooms and arches.
  const wall = Math.max(2, s * 0.09);
  for (const { x, z, c } of cellsAt) {
    if (!(BOX.has(c.form) || c.form === 'arch')) continue;
    for (const [dx, dz] of DIRS) {
      const n = idx.occ.get(key(x + dx, z + dz, L));
      if (n && n.room === c.room && (BOX.has(n.form) || n.form === 'arch')) {
        if (!(c.form === 'arch' && n.form === 'arch' && !archOpenSide(c, dx, dz))) continue;
      }
      const internal = n && isRoomCell(n);
      const door = doors.has(`${x},${z},${L},${dx},${dz}`) || (internal && n.room !== c.room);
      if (internal && n.room !== c.room && (dx < 0 || dz < 0) && BOX.has(n.form)) continue; // draw shared walls once
      if (c.form === 'arch' && archOpenSide(c, dx, dz) && !internal) continue;          // open tunnel ends
      edge(g, x, z, dx, dz, X, Z, s, wall, door, !internal && !door && c.material !== 'glass');
    }
    if (c.form === 'steps' || c.room === 'stairs') stairsSymbol(g, x, z, c, X, Z, s);
    if (c.form === 'arch') { g.strokeStyle = 'rgba(18,133,126,0.6)'; g.setLineDash([s * 0.12, s * 0.1]); g.lineWidth = 1.5; const alongX = (c.rot & 1) === 0; g.beginPath(); if (alongX) { g.moveTo(X(x), Z(z + 0.22)); g.lineTo(X(x + 1), Z(z + 0.22)); g.moveTo(X(x), Z(z + 0.78)); g.lineTo(X(x + 1), Z(z + 0.78)); } else { g.moveTo(X(x + 0.22), Z(z)); g.lineTo(X(x + 0.22), Z(z + 1)); g.moveTo(X(x + 0.78), Z(z)); g.lineTo(X(x + 0.78), Z(z + 1)); } g.stroke(); g.setLineDash([]); }
  }

  // Ghost footprint.
  if (opts.ghost) {
    const gh = opts.ghost;
    g.fillStyle = gh.ok ? 'rgba(74,144,226,0.35)' : 'rgba(229,57,53,0.35)';
    g.strokeStyle = gh.ok ? '#2f6fe4' : '#e53935';
    g.lineWidth = 3;
    g.setLineDash([6, 5]);
    for (const p of footprint(gh.cell)) if (p.level === L) { g.fillRect(X(p.x), Z(p.z), s, s); g.strokeRect(X(p.x) + 1.5, Z(p.z) + 1.5, s - 3, s - 3); }
    g.setLineDash([]);
  }
  if (opts.select) {
    g.strokeStyle = '#2f6fe4'; g.lineWidth = 4;
    for (const p of footprint(opts.select)) if (p.level === L) g.strokeRect(X(p.x) + 2, Z(p.z) + 2, s - 4, s - 4);
  }

  // Labels: one per room group on this floor.
  if (opts.labels !== false) {
    for (const gr of roomGroups(idx)) {
      if (gr.level !== L) continue;
      const cx = gr.cells.reduce((a, p) => a + p.x + 0.5, 0) / gr.cells.length;
      const cz = gr.cells.reduce((a, p) => a + p.z + 0.5, 0) / gr.cells.length;
      const R = ROOMS[gr.room];
      const img = emojiNow(R.emoji, opts.redraw);
      const sz = Math.min(s * 0.62, 40);
      if (img) g.drawImage(img, X(cx) - sz / 2, Z(cz) - sz / 2 - (s > 30 && gr.cells.length > 1 ? sz * 0.3 : 0), sz, sz);
      if (s > 30 && gr.cells.length > 1) {
        g.font = `600 ${Math.round(Math.min(15, s * 0.28))}px Lexend, sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'top';
        g.fillStyle = INK;
        g.fillText(R.name, X(cx), Z(cz) + sz * 0.25);
      }
      if (opts.faces) {
        const m = mood(idx, gr);
        const fe = m.face === 'happy' ? '😊' : m.face === 'sad' ? '😟' : '🙂';
        const fi = emojiNow(fe, opts.redraw);
        const fs = Math.min(28, s * 0.5);
        if (fi) g.drawImage(fi, X(cx) + sz * 0.35, Z(cz) - sz * 0.9, fs, fs);
      }
    }
  }
  g.restore();
}

function edge(g, x, z, dx, dz, X, Z, s, wall, door, windowed) {
  // Edge line from a to b in cell units.
  let ax, az, bx, bz;
  if (dx === 1) { ax = x + 1; az = z; bx = x + 1; bz = z + 1; }
  else if (dx === -1) { ax = x; az = z; bx = x; bz = z + 1; }
  else if (dz === 1) { ax = x; az = z + 1; bx = x + 1; bz = z + 1; }
  else { ax = x; az = z; bx = x + 1; bz = z; }
  g.strokeStyle = INK; g.lineWidth = wall; g.lineCap = 'square';
  const P = t => [X(ax + (bx - ax) * t), Z(az + (bz - az) * t)];
  g.beginPath();
  if (door) {
    g.moveTo(...P(0)); g.lineTo(...P(0.31));
    g.moveTo(...P(0.69)); g.lineTo(...P(1));
    g.stroke();
    // Door swing: a quarter circle into the room.
    const [hx, hy] = P(0.31);
    const len = 0.38 * s;
    const inx = -dx, inz = -dz;
    const along = [(bx - ax), (bz - az)];
    g.lineWidth = Math.max(1, wall * 0.35);
    g.strokeStyle = 'rgba(35,38,45,0.75)';
    g.beginPath();
    g.moveTo(hx, hy); g.lineTo(hx + inx * len, hy + inz * len);
    const a0 = Math.atan2(along[1], along[0]), a1 = Math.atan2(inz, inx);
    let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    g.moveTo(hx + Math.cos(a0) * len, hy + Math.sin(a0) * len);
    g.arc(hx, hy, len, a0, a1, da < 0);
    g.stroke();
    return;
  }
  g.moveTo(...P(0)); g.lineTo(...P(1));
  g.stroke();
  if (windowed) {
    // A window: a light double line in the middle of the wall.
    g.strokeStyle = '#ffffff'; g.lineWidth = wall * 0.55;
    g.beginPath(); g.moveTo(...P(0.25)); g.lineTo(...P(0.75)); g.stroke();
    g.strokeStyle = '#5aa9d6'; g.lineWidth = Math.max(1, wall * 0.22);
    g.beginPath(); g.moveTo(...P(0.25)); g.lineTo(...P(0.75)); g.stroke();
  }
}

function circleRoom(g, cx, cy, r, R, s, dome) {
  g.fillStyle = mix(R.colour, '#ffffff', 0.55);
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = INK; g.lineWidth = Math.max(2, s * 0.09);
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  if (dome) { g.lineWidth = 1; g.setLineDash([4, 4]); g.beginPath(); g.arc(cx, cy, r * 0.6, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
}

function curveRoom(g, c, X, Z, s, R) {
  const centre = [[0, 0], [2, 0], [2, 2], [0, 2]][c.rot & 3];
  const cx = X(c.x + centre[0]), cy = Z(c.z + centre[1]);
  const a0 = (c.rot & 3) * Math.PI / 2;
  g.fillStyle = mix(R.colour, '#ffffff', 0.55);
  g.beginPath(); g.arc(cx, cy, 2 * s, a0, a0 + Math.PI / 2); g.arc(cx, cy, 1 * s, a0 + Math.PI / 2, a0, true); g.closePath(); g.fill();
  g.strokeStyle = INK; g.lineWidth = Math.max(2, s * 0.09);
  g.beginPath(); g.arc(cx, cy, 2 * s - 1, a0, a0 + Math.PI / 2); g.stroke();
  g.beginPath(); g.arc(cx, cy, 1 * s + 1, a0, a0 + Math.PI / 2); g.stroke();
}

function slabThing(g, c, X, Z, s, R) {
  for (const p of footprint(c)) {
    if (c.room === 'pool') { g.fillStyle = '#7cc6ee'; g.fillRect(X(p.x), Z(p.z), s, s); }
    else { g.fillStyle = '#c69c6d'; g.fillRect(X(p.x), Z(p.z), s, s); }
  }
  const cs = footprint(c);
  const x0 = Math.min(...cs.map(p => p.x)), z0 = Math.min(...cs.map(p => p.z)), x1 = Math.max(...cs.map(p => p.x)) + 1, z1 = Math.max(...cs.map(p => p.z)) + 1;
  g.strokeStyle = c.room === 'pool' ? '#e9e5dc' : '#8a5f38'; g.lineWidth = Math.max(2, s * 0.08);
  g.strokeRect(X(x0), Z(z0), (x1 - x0) * s, (z1 - z0) * s);
  if (c.room === 'pool') {
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1.5;
    const alongX = (x1 - x0) > (z1 - z0);
    g.beginPath();
    for (let i = 1; i < 3; i++) { if (alongX) { const zz = Z(z0 + (z1 - z0) * i / 3); g.moveTo(X(x0) + 4, zz); g.lineTo(X(x1) - 4, zz); } else { const xx = X(x0 + (x1 - x0) * i / 3); g.moveTo(xx, Z(z0) + 4); g.lineTo(xx, Z(z1) - 4); } }
    g.stroke();
  }
}

function padThing(g, c, X, Z, s, R, idx) {
  g.fillStyle = c.room === 'track' ? '#d4643a' : c.room === 'garden' ? '#7fb85c' : '#c69c6d';
  g.fillRect(X(c.x), Z(c.z), s, s);
  if (c.room === 'track') {
    g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(1, s * 0.04);
    g.beginPath();
    for (const [dx, dz] of DIRS) {
      const n = idx.occ.get(key(c.x + dx, c.z + dz, c.level));
      if (n && n.room === 'track') { g.moveTo(X(c.x + 0.5), Z(c.z + 0.5)); g.lineTo(X(c.x + 0.5 + dx * 0.5), Z(c.z + 0.5 + dz * 0.5)); }
    }
    g.stroke();
  }
  if (c.room === 'garden') { g.fillStyle = '#4b8b33'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(X(c.x + 0.28 + (i % 2) * 0.44), Z(c.z + 0.28 + Math.floor(i / 2) * 0.44), s * 0.1, 0, 7); g.fill(); } }
}

function wedgeThing(g, c, X, Z, s, R) {
  g.fillStyle = mix(R.colour, '#ffffff', 0.2);
  g.fillRect(X(c.x) + s * 0.08, Z(c.z) + s * 0.08, s * 0.84, s * 0.84);
  const [wx, wz] = wedgeDir(c);
  // Arrow pointing down the slide (away from the high side).
  const cx = X(c.x + 0.5), cy = Z(c.z + 0.5);
  g.strokeStyle = INK; g.fillStyle = INK; g.lineWidth = Math.max(1.5, s * 0.05);
  g.beginPath(); g.moveTo(cx + wx * s * 0.3, cy + wz * s * 0.3); g.lineTo(cx - wx * s * 0.3, cy - wz * s * 0.3); g.stroke();
  g.beginPath();
  const tx = cx - wx * s * 0.36, ty = cy - wz * s * 0.36;
  g.moveTo(tx, ty); g.lineTo(tx + wx * s * 0.16 - wz * s * 0.12, ty + wz * s * 0.16 + wx * s * 0.12); g.lineTo(tx + wx * s * 0.16 + wz * s * 0.12, ty + wz * s * 0.16 - wx * s * 0.12); g.fill();
}

function stairsSymbol(g, x, z, c, X, Z, s) {
  g.strokeStyle = 'rgba(35,38,45,0.7)'; g.lineWidth = 1;
  const alongX = (c.rot & 1) === 0;
  g.beginPath();
  for (let i = 1; i < 5; i++) {
    if (alongX) { const xx = X(x + 0.15 + 0.7 * i / 5); g.moveTo(xx, Z(z + 0.15)); g.lineTo(xx, Z(z + 0.85)); }
    else { const zz = Z(z + 0.15 + 0.7 * i / 5); g.moveTo(X(x + 0.15), zz); g.lineTo(X(x + 0.85), zz); }
  }
  g.stroke();
}

// Bubble diagram: one bubble per room, joined to its neighbours (green if they like each other, red if not).
function drawBubbles(g, idx, L, X, Z, s, opts) {
  const groups = roomGroups(idx).filter(gr => !['stairs', 'bridge'].includes(gr.room));
  const cen = gr => [gr.cells.reduce((a, p) => a + p.x + 0.5, 0) / gr.cells.length, gr.cells.reduce((a, p) => a + p.z + 0.5, 0) / gr.cells.length];
  const byCell = new Map();
  groups.forEach((gr, i) => gr.cells.forEach(p => byCell.set(key(p.x, p.z, gr.level), i)));
  const links = new Map();
  groups.forEach((gr, i) => {
    for (const p of gr.cells) for (const [dx, dz, dl] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const j = byCell.get(key(p.x + dx, p.z + dz, gr.level + dl));
      if (j === undefined || j === i) continue;
      const k = i < j ? `${i}-${j}` : `${j}-${i}`;
      links.set(k, [Math.min(i, j), Math.max(i, j)]);
    }
  });
  for (const [, [i, j]] of links) {
    const a = groups[i], b = groups[j];
    const like = ROOMS[a.room].likes.includes(b.room) || ROOMS[b.room].likes.includes(a.room);
    const hate = ROOMS[a.room].dislikes.includes(b.room) || ROOMS[b.room].dislikes.includes(a.room);
    const [ax, az] = cen(a), [bx, bz] = cen(b);
    const tr = opts.traffic ? (opts.traffic.get(`${a.room}-${b.room}`) || opts.traffic.get(`${b.room}-${a.room}`) || 0) : 0;
    g.strokeStyle = hate ? '#e53935' : like ? '#2e9d58' : 'rgba(35,38,45,0.45)';
    g.lineWidth = 3 + Math.min(10, tr * 0.6);
    g.setLineDash(hate ? [8, 6] : []);
    g.beginPath(); g.moveTo(X(ax), Z(az)); g.lineTo(X(bx), Z(bz)); g.stroke();
  }
  g.setLineDash([]);
  for (const gr of groups) {
    const [cx, cz] = cen(gr);
    const R = ROOMS[gr.room];
    const r = s * (0.45 + Math.sqrt(gr.cells.length) * 0.32);
    g.fillStyle = mix(R.colour, '#ffffff', 0.25);
    g.strokeStyle = gr.level > 0 ? '#ffffff' : INK;
    g.lineWidth = 3;
    g.beginPath(); g.arc(X(cx), Z(cz), r, 0, Math.PI * 2); g.fill(); g.stroke();
    const img = emojiNow(R.emoji, opts.redraw);
    const sz = Math.min(r * 1.0, 44);
    if (img) g.drawImage(img, X(cx) - sz / 2, Z(cz) - sz / 2, sz, sz);
    if (gr.level > 0) { g.fillStyle = INK; g.font = '600 12px Lexend, sans-serif'; g.textAlign = 'center'; g.fillText(`floor ${gr.level}`, X(cx), Z(cz) + r + 12); }
  }
}

// Frame a design: a view that fits its footprint (or the meadow if empty) into W x H pixels.
export function fitView(design, W, H, margin = 3) {
  let x0 = 2, z0 = 16, x1 = 34, z1 = 40;
  if (design.cells.length) {
    x0 = 1e9; z0 = 1e9; x1 = -1e9; z1 = -1e9;
    for (const c of design.cells) for (const p of footprint(c)) { x0 = Math.min(x0, p.x); z0 = Math.min(z0, p.z); x1 = Math.max(x1, p.x + 1); z1 = Math.max(z1, p.z + 1); }
    x0 -= margin; z0 -= margin; x1 += margin; z1 += margin;
  }
  const s = Math.min(W / (x1 - x0), H / (z1 - z0), 90);
  return { x0: (x0 + x1) / 2 - W / s / 2, z0: (z0 + z1) / 2 - H / s / 2, s };
}
