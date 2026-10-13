// Show and tell: Finn's design packed into a short link. There is no server; the design travels inside the link itself.
// Whoever opens it can look round, go inside, walk through and watch a school day, but cannot change anything,
// and nothing saved on their device is touched.
import { h, esc, emo, say, sfx, toast } from './ui.js';
import { icon } from './icons.js';

const toB64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const squeeze = async text => new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
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
export async function packDesign(model) {
  const w = new Bits();
  w.put(2, 8);
  for (const k of ['w', 'e', 'n', 's']) w.put(clamp(model.pad[k], 3), 3);
  w.put(clamp(model.grown.length, 8), 8); for (const [x, z] of model.grown.slice(0, 255)) { w.put(clamp(x, 6), 6); w.put(clamp(z, 6), 6); }
  w.put(clamp(model.boxes.length, 10), 10);
  for (const b of model.boxes.slice(0, 1023)) for (const [key, bits, table] of FIELDS) {
    const v = b[key];
    w.put(clamp(table === -1 ? v - 1 : Array.isArray(table) ? Math.max(0, table.indexOf(v || '')) : v || 0, bits), bits);
  }
  const raw = w.end(), z = await squeeze(raw);
  return z.length < raw.length ? 'z' + toB64(z) : 'r' + toB64(raw);
}
export async function unpackDesign(code) {
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
export const shownCode = () => { const q = new URLSearchParams(location.search); return q.get('s') ? 's:' + q.get('s') : q.get('show'); };

// In the builder: the card that makes the link.
export function mountShare(root, model) {
  const sheet = h(`<div class="nova-sheet" hidden><div class="nova-card"></div></div>`);
  root.append(sheet);
  const card = sheet.querySelector('.nova-card');
  const close = () => { sheet.hidden = true; };
  sheet.addEventListener('click', e => { if (e.target === sheet) close(); });
  async function open() {
    if (!model.boxes.length) { sfx.no(); toast('Build your school first!'); return; }
    const url = new URL(`./?s=${await packDesign(model)}#site`, location.href).href;
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
export function mountViewer(root) {
  const sheet = h(`<div class="nova-sheet"><div class="nova-card view-card">
    <div class="nova-head">${emo('🏫', 'emo head-pic')}<div><small>Show and tell</small><h2>Finn's Dream School</h2></div></div>
    <p class="share-text">Finn designed this school. Have a look round! You can look inside, walk through it and watch a school day. You can look, but not change anything.</p>
    <div class="view-go">
      <button class="fbtn ok" type="button" data-go="look">${icon('whole')}<span>Look around</span></button>
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
    if (go && go !== 'look') root.querySelector(`.side .sbtn[data-a="${go}"]`)?.click();
  });
}
