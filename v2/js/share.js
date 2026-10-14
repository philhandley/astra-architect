// Show and tell: Finn's design packed into a short link. There is no server; the design travels inside the link itself.
// Whoever opens it can look round, go inside, walk through and watch a school day, but cannot change anything,
// and nothing saved on their device is touched.
import { h, esc, emo, say, sfx, toast } from './ui.js';
import { icon } from './icons.js';

const fromB64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const unsqueeze = async bytes => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());

// The short code: every room packed into 49 bits from these tables (only ever add to the end of a table, so old
// links keep working), then squeezed if that makes it shorter. The first letter says which: r raw, z squeezed.
const TYPES = ['classroom', 'hall', 'pool', 'aquarium', 'library', 'yoga', 'lunch', 'art', 'music', 'ringhouse', 'steps', 'stairs', 'slide', 'archway', 'track', 'garden', 'tree', 'turbine',
  'rocket', 'observatory', 'greenhouse', 'treehouse', 'stage', 'maker', 'circle', 'bridge', 'walkway', 'playground', 'zipline', 'ramp', 'terraces', 'weather'];
const SHAPES = ['box', 'house', 'saw', 'vault', 'drum', 'tower', 'ring', 'ringhouse', 'arc', 'spiral', 'arch', 'steps', 'stairs', 'slide', 'pool', 'track', 'garden', 'tree', 'turbine', 'rocket',
  'observatory', 'greenhouse', 'glassdome', 'glassvault', 'treehouse', 'stage', 'circle', 'weather', 'bridge', 'tube', 'canopy', 'terraces', 'ramp', 'swings', 'climbdome', 'roundabout', 'seesaw', 'sandpit', 'playtower', 'zipline'];
const COLOURS = ['yellow', 'orange', 'red', 'magenta', 'pink', 'purple', 'blue', 'teal', 'mint', 'lime', 'forest', 'white', 'navy'];
const WINS = ['', 'big', 'pixel', 'ribbon', 'porthole', 'slots', 'grid'];
const SURFACES = ['', 'climb', 'green', 'tiles', 'dazzle', 'brick', 'wood', 'glass', 'chalk'];     // (dazzle took pixel's place)
const FIELDS = [['type', 6, TYPES], ['shape', 6, SHAPES], ['colour', 4, COLOURS], ['x', 6], ['z', 6], ['w', 3, -1], ['d', 3, -1], ['h', 3, -1], ['level', 3], ['rot', 2], ['win', 3, WINS], ['surface', 4, SURFACES]];
class Bits {
  constructor(bytes) { this.bytes = bytes ? [...bytes] : []; this.i = 0; this.acc = 0; this.n = 0; }
  put(v, bits) { for (let k = bits - 1; k >= 0; k--) { this.acc = (this.acc << 1) | ((v >> k) & 1); if (++this.n === 8) { this.bytes.push(this.acc); this.acc = 0; this.n = 0; } } }
  get(bits) { let v = 0; for (let k = 0; k < bits; k++) { const byte = this.bytes[this.i >> 3] ?? 0; v = (v << 1) | ((byte >> (7 - (this.i & 7))) & 1); this.i++; } return v; }
  end() { if (this.n) this.put(0, 8 - this.n); return new Uint8Array(this.bytes); }
}
const clamp = (v, bits) => Math.max(0, Math.min((1 << bits) - 1, v | 0));

// Format 3 (13 Oct 2026), the shortest: links look like ./?3<code>. Each room is written as what changed since the
// rooms before it. Its type is a move-to-front number (the same type as the room before costs one bit). Its look and
// its size cost one bit when they match the last room of that type (or, for the first, its usual look in DEF), and
// two or three when they match the room just before; otherwise only the parts that differ from that room are written.
// Its square is counted from the school's own corner, in only as many bits as the school is wide and deep.
// DEF and the tables above are frozen: only ever add to the end, and give every new type its DEF line at the same time.
const DEF = ['house yellow 111', 'vault magenta 322', 'pool teal 321', 'arch blue 311', 'drum purple 211', 'drum lime 111', 'saw orange 221', 'saw pink 111',
  'drum red 111', 'ringhouse yellow 331', 'steps blue 221', 'stairs teal 112', 'slide yellow 123', 'arch navy 211', 'track red 321', 'garden lime 111',
  'tree lime 111', 'turbine white 111', 'rocket red 221', 'observatory navy 111', 'greenhouse lime 211', 'treehouse orange 112', 'stage purple 211',
  'saw orange 211', 'circle blue 221', 'bridge magenta 131', 'canopy teal 131', 'swings yellow 111', 'zipline red 141', 'ramp lime 131', 'terraces orange 331',
  'weather white 111'].map(s => { const [shape, colour, n] = s.split(' '); return { shape, colour, win: '', surface: '', w: +n[0], d: +n[1], h: +n[2] }; });
const LOOK = [['shape', SHAPES, 6], ['colour', COLOURS, 5], ['win', WINS, 4], ['surface', SURFACES, 5]];
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
class Bits3 {
  constructor(text) { this.b = []; this.i = 0; for (const ch of text || '') { const v = B64.indexOf(ch); if (v < 0) throw new Error('not a design'); this.put(v, 6); } }
  put(v, n) { for (let k = n - 1; k >= 0; k--) this.b.push((v >> k) & 1); }
  get(n) { let v = 0; for (let k = 0; k < n; k++) v = (v << 1) | (this.b[this.i++] || 0); return v; }
  gamma(v) { let L = 0; while (v >> (L + 1)) L++; this.put(0, L); this.put(v, L + 1); }      // (Elias gamma, v >= 1: small numbers, few bits)
  ungamma() { let L = 0; while (!this.b[this.i]) { if (this.i >= this.b.length || ++L > 24) throw new Error('not a design'); this.i++; } return this.get(L + 1); }
  text() { let s = ''; for (let i = 0; i < this.b.length; i += 6) { let v = 0; for (let k = 0; k < 6; k++) v = (v << 1) | (this.b[i + k] || 0); s += B64[v]; } return s; }
}
const pick = (table, v) => table[Math.max(0, table.indexOf(v || ''))];
const bitsFor = v => { let n = 0; while (v >> n) n++; return n; };
export async function packDesign(model) {
  const w = new Bits3(), boxes = model.boxes.slice(0, 4000), pad = model.pad || {}, grown = (model.grown || []).slice(0, 255);
  const padded = ['w', 'e', 'n', 's'].some(k => pad[k]);
  w.put(+padded, 1); if (padded) for (const k of ['w', 'e', 'n', 's']) w.put(clamp(pad[k], 3), 3);
  w.put(+!!grown.length, 1); if (grown.length) { w.gamma(grown.length); for (const [x, z] of grown) { w.put(clamp(x, 6), 6); w.put(clamp(z, 6), 6); } }
  w.gamma(boxes.length + 1);
  if (!boxes.length) return w.text();
  const xs = boxes.map(b => clamp(b.x, 6)), zs = boxes.map(b => clamp(b.z, 6)), x0 = Math.min(...xs), z0 = Math.min(...zs);
  const xb = bitsFor(Math.max(...xs) - x0), zb = bitsFor(Math.max(...zs) - z0);
  w.put(x0, 6); w.put(z0, 6); w.put(xb, 3); w.put(zb, 3);
  const order = TYPES.map((_, i) => i), last = [];
  let prev = null;
  const sameLook = (a, b) => LOOK.every(([k]) => a[k] === b[k]);
  boxes.forEach((b, n) => {
    const t = Math.max(0, TYPES.indexOf(b.type)), i = order.indexOf(t);
    w.gamma(i + 1); order.splice(i, 1); order.unshift(t);
    const L = last[t] || DEF[t] || DEF[0], P = prev || L, look = {};
    for (const [k, table] of LOOK) look[k] = pick(table, b[k]);
    if (sameLook(look, L)) w.put(1, 1);                                     // 1: as the last room of this type
    else if (sameLook(look, P)) w.put(1, 2);                                // 01: as the room before
    else { w.put(0, 2); for (const [k, table, bits] of LOOK) { const ch = look[k] !== P[k]; w.put(+!ch, 1); if (ch) w.put(table.indexOf(look[k]), bits); } }
    const s = { w: clamp(b.w - 1, 3) + 1, d: clamp(b.d - 1, 3) + 1, h: clamp(b.h - 1, 3) + 1 };
    const is = (q, turn) => s.h === q.h && (turn ? s.w === q.d && s.d === q.w : s.w === q.w && s.d === q.d);
    if (is(L)) w.put(1, 1);                                                 // 1: as the last room of this type
    else if (is(P)) w.put(1, 2);                                            // 01: as the room before
    else if (is(L, true)) w.put(1, 3);                                      // 001: the last of this type, turned
    else if (is(P, true)) w.put(1, 4);                                      // 0001: the room before, turned
    else { w.put(0, 4); w.put(s.w - 1, 3); w.put(s.d - 1, 3); w.put(s.h - 1, 3); }
    const r = (b.rot || 0) & 3; w.put(+!!r, 1); if (r) w.put(r, 2);
    w.gamma(clamp(b.level, 4) + 1);
    w.put(xs[n] - x0, xb); w.put(zs[n] - z0, zb);
    last[t] = prev = { ...look, ...s };
  });
  // Tour words (tour.js): which line each kind of room says, when Finn picked one. Readers from before skip this.
  const notes = Object.entries(model.notes || {}).filter(([t, i]) => i > 0 && TYPES.includes(t)).slice(0, 63);
  w.put(+!!notes.length, 1);
  if (notes.length) { w.gamma(notes.length); for (const [t, i] of notes) { w.put(TYPES.indexOf(t), 6); w.gamma(Math.min(i, 30) + 1); } }
  return w.text();
}
function unpack3(text) {
  const r = new Bits3(text), pad = { w: 0, e: 0, n: 0, s: 0 }, grown = [], boxes = [];
  if (r.get(1)) for (const k of ['w', 'e', 'n', 's']) pad[k] = r.get(3);
  if (r.get(1)) { const g = r.ungamma(); for (let i = 0; i < g; i++) grown.push([r.get(6), r.get(6)]); }
  const n = r.ungamma() - 1;
  if (n < 0 || n > 4000) throw new Error('not a design');
  if (!n) return { boxes, pad, grown };
  const x0 = r.get(6), z0 = r.get(6), xb = r.get(3), zb = r.get(3), order = TYPES.map((_, i) => i), last = [];
  let prev = null;
  for (let k = 0; k < n; k++) {
    const i = r.ungamma() - 1, t = order[i];
    if (t === undefined) throw new Error('not a design');
    order.splice(i, 1); order.unshift(t);
    const L = last[t] || DEF[t] || DEF[0], P = prev || L, look = {};
    const from = q => { for (const [key] of LOOK) look[key] = q[key]; };
    if (r.get(1)) from(L);
    else if (r.get(1)) from(P);
    else for (const [key, table, bits] of LOOK) look[key] = r.get(1) ? P[key] : table[r.get(bits)] ?? table[0];
    let s;
    if (r.get(1)) s = { w: L.w, d: L.d, h: L.h };
    else if (r.get(1)) s = { w: P.w, d: P.d, h: P.h };
    else if (r.get(1)) s = { w: L.d, d: L.w, h: L.h };
    else if (r.get(1)) s = { w: P.d, d: P.w, h: P.h };
    else s = { w: r.get(3) + 1, d: r.get(3) + 1, h: r.get(3) + 1 };
    const rot = r.get(1) ? r.get(2) : 0, level = r.ungamma() - 1, x = x0 + r.get(xb), z = z0 + r.get(zb);
    const b = { id: k + 1, type: TYPES[t], shape: look.shape, colour: look.colour, x, z, ...s, level };
    if (rot) b.rot = rot;
    if (look.win) b.win = look.win;
    if (look.surface) b.surface = look.surface;
    boxes.push(b);
    last[t] = prev = { ...look, ...s };
  }
  if (r.i > r.b.length) throw new Error('not a design');      // (the link was cut short)
  const notes = {};
  if (r.i < r.b.length && r.get(1)) { const m = r.ungamma(); for (let k = 0; k < m && k < 64; k++) { const t = TYPES[r.get(6)], i = r.ungamma() - 1; if (t && i > 0) notes[t] = i; } }
  return { boxes, pad, grown, notes };
}

// Format 2 (links made before format 3): every room in 49 bits, squeezed when that was shorter. Only read now.
export async function unpackDesign(code) {
  if (code.startsWith('3:')) return unpack3(code.slice(2));
  if (!code.startsWith('s:')) return unpackOld(code);
  const s = code.slice(2), bytes = s[0] === 'z' ? await unsqueeze(fromB64(s.slice(1))) : fromB64(s.slice(1));
  const r = new Bits(bytes);
  if (r.get(8) !== 2) throw new Error('not a design');
  const pad = {}; for (const k of ['w', 'e', 'n', 's']) pad[k] = r.get(3);
  const grown = []; const g = r.get(8); for (let i = 0; i < g; i++) grown.push([r.get(6), r.get(6)]);
  const boxes = [], n = r.get(10);
  for (let i = 0; i < n; i++) {
    const b = { id: i + 1 };
    for (const [key, bits, table] of FIELDS) {
      const v = r.get(bits);
      if (table === -1) b[key] = v + 1; else if (Array.isArray(table)) { const name = table[v] ?? table[0]; if (name) b[key] = name; } else if (v || key === 'x' || key === 'z' || key === 'level') b[key] = v;
    }
    boxes.push(b);
  }
  return { boxes, pad, grown };
}
// Links made before the short code: the design as squeezed JSON.
async function unpackOld(code) {
  const d = JSON.parse(new TextDecoder().decode(await unsqueeze(fromB64(code))));
  if (!d || !Array.isArray(d.boxes)) throw new Error('not a design');
  return { boxes: d.boxes.map((b, i) => ({ ...b, id: i + 1 })), pad: { w: 0, e: 0, n: 0, s: 0, ...(d.pad || {}) }, grown: Array.isArray(d.grown) ? d.grown : [] };
}
// The code in this page's address, if it was opened from a show-and-tell link.
// Format 3 links are ./?3<code>; older ones are ./?s=<code> and, before that, ./?show=<code>.
export const shownCode = () => {
  const bare = location.search.slice(1).split('&')[0], q = new URLSearchParams(location.search);
  if (/^3[A-Za-z0-9_-]+$/.test(bare)) return '3:' + bare.slice(1);
  return q.get('s') ? 's:' + q.get('s') : q.get('show');
};

// In the builder: the card that makes the link.
export function mountShare(root, model) {
  const sheet = h(`<div class="nova-sheet" hidden><div class="nova-card"></div></div>`);
  root.append(sheet);
  const card = sheet.querySelector('.nova-card');
  const close = () => { sheet.hidden = true; };
  sheet.addEventListener('click', e => { if (e.target === sheet) close(); });
  async function open() {
    if (!model.boxes.length) { sfx.no(); toast('Build your school first!'); return; }
    const url = new URL(`./?3${await packDesign(model)}`, location.href).href;
    card.innerHTML = `<div class="nova-head">${emo('🏫', 'emo head-pic')}<div><small>Show and tell</small><h2>A link to show your school</h2></div><button class="fbtn close" type="button">${icon('close')}</button></div>
      <p class="share-text">Anyone with this link can look round the school, go inside, walk through it and watch a school day, but they can't change it. It shows the school as it is now, so if you build more, make a new link.</p>
      <input class="share-link" type="text" readonly value="${esc(url)}" aria-label="Show and tell link">
      <div class="bq-next">${navigator.share ? `<button class="fbtn ok send" type="button">${icon('share')}<span>Send the link</span></button>` : ''}<button class="fbtn copy ${navigator.share ? '' : 'ok'}" type="button">${icon('copy')}<span>Copy the link</span></button><button class="fbtn try" type="button">${icon('walk')}<span>Try it</span></button></div>`;
    card.onclick = async e => {
      if (e.target.closest('.close')) { sfx.tap(); close(); return; }
      if (e.target.closest('.copy')) {
        sfx.tap();
        try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch (err) { card.querySelector('.share-link').select(); toast('Press and hold the link to copy it'); }
        return;
      }
      if (e.target.closest('.send')) { sfx.tap(); try { await navigator.share({ title: "Finn's Dream School", text: 'Have a look round the school Finn designed!', url }); } catch (err) { /* closed without sending */ } return; }
      if (e.target.closest('.try')) { sfx.tap(); window.open(url, '_blank'); }
    };
    sheet.hidden = false;
    say('Here is a link to show your school. Ask your grown-up to send it.');
  }
  return { open };
}

// Opened from a link: a welcome card, with big buttons for the ways to look round.
export function mountViewer(root, { tour } = {}) {
  const sheet = h(`<div class="nova-sheet"><div class="nova-card view-card">
    <div class="nova-head">${emo('🏫', 'emo head-pic')}<div><small>Show and tell</small><h2>Finn's Dream School</h2></div></div>
    <p class="share-text">Finn designed this school. Take the tour, or have a look round yourself: look inside, walk through it and watch a school day. You can look, but not change anything.</p>
    <div class="view-go">
      <button class="fbtn ok tourgo" type="button" data-go="tour">${icon('play')}<span>Take the tour</span></button>
      <button class="fbtn" type="button" data-go="look">${icon('whole')}<span>Look around</span></button>
      <button class="fbtn" type="button" data-go="inside">${icon('inside')}<span>Look inside</span></button>
      <button class="fbtn" type="button" data-go="walk">${icon('walk')}<span>Walk through</span></button>
      <button class="fbtn" type="button" data-go="day">${icon('bell')}<span>School day</span></button>
    </div>
  </div></div>`);
  root.append(sheet);
  sheet.addEventListener('click', e => {
    const b = e.target.closest('[data-go]');
    if (!b && e.target !== sheet) return;
    sfx.tap(); sheet.hidden = true;
    const go = b?.dataset.go;
    if (go === 'tour') tour?.();
    else if (go && go !== 'look') root.querySelector(`.side .sbtn[data-a="${go}"]`)?.click();
  });
}
