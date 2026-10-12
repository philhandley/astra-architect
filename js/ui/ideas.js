// The Ideas book: real schools children love, each drawn as a little plan, with a "Try it" button.
import { store } from '../core/store.js';
import { indexDesign, placeCheck, footprint } from '../core/design.js';
import { computeDoors } from '../core/arch.js';
import { drawPlan } from '../core/plan2d.js';
import { loadSite, site, zone } from '../core/site.js';
import { emo } from '../core/emoji.js';
import { icon } from '../core/icons.js';
import { h, esc, modal, say, speakButton, toast, sfx } from './dom.js';

let ideas = null;
async function loadIdeas() {
  if (!ideas) ideas = await (await fetch('content/ideas.json')).json();
  return ideas;
}

export async function openIdeas() {
  await loadSite();
  const list = await loadIdeas();
  const body = h(`<div style="display:flex;flex-direction:column;gap:14px">
    <p class="muted" style="margin:0;font-size:19px">Real schools that architects designed for children. Tap Try it to add the idea to your school.</p>
    <div class="ideas-grid"></div></div>`);
  const grid = body.querySelector('.ideas-grid');
  let close = null;
  for (const it of list) {
    const card = h(`<div class="card idea-card">
      <div class="top">${emo(it.emoji)}<div style="flex:1"><h3>${esc(it.name)}</h3><div class="meta">${esc(it.architect)} &middot; ${esc(it.place)} &middot; ${esc(it.year)}</div></div><span class="sp"></span></div>
      <div style="font-weight:700;color:var(--accent);font-size:19px">${esc(it.idea)}</div>
      <p style="margin:0;font-size:19px">${esc(it.text)}</p>
      <canvas width="440" height="240" style="width:100%;border-radius:14px;background:#fff;box-shadow:inset 0 0 0 2px var(--line)"></canvas>
      <div class="num">${emo('🔢')} ${esc(it.number?.text || '')}</div>
      <div class="mindrow" style="justify-content:flex-start">
        <button class="btn go small try" type="button">${icon('plus')} Try it in my school</button>
        <a class="btn ghost small" href="${esc(it.link)}" target="_blank" rel="noopener">${icon('ext')} Real photos</a>
        ${it.number?.source ? `<a class="source-link" href="${esc(it.number.source)}" target="_blank" rel="noopener">Where the number comes from</a>` : ''}
      </div></div>`);
    card.querySelector('.sp').replaceWith(speakButton(() => `${it.name}. ${it.idea}. ${it.text} ${it.number?.text || ''}`));
    const cv = card.querySelector('canvas');
    drawIdea(cv, it);
    card.querySelector('.try').addEventListener('click', () => {
      const ok = tryIdea(it);
      if (ok) { sfx.tada(); toast(`${it.name}'s idea is in your school. Undo takes it away.`, it.emoji); close && close(); location.hash = '#/studio'; }
      else { sfx.no(); say('There is not enough free space in the meadow. Try moving some rooms first.'); }
    });
    grid.append(card);
  }
  close = modal('Ideas book', body, { wide: true });
}

function drawIdea(cv, it) {
  const idx = indexDesign({ cells: it.cells.map((c, i) => ({ ...c, id: i + 1, rot: c.rot || 0 })) });
  const doors = computeDoors(idx);
  let x1 = 0, z1 = 0;
  for (const c of idx.design.cells) for (const p of footprint(c)) { x1 = Math.max(x1, p.x + 1); z1 = Math.max(z1, p.z + 1); }
  const W = cv.width, H = cv.height;
  const s = Math.min(W / (x1 + 1), H / (z1 + 1));
  const g = cv.getContext('2d');
  const levels = Math.max(...idx.design.cells.map(c => c.level));
  // Draw the top-most floor that has rooms, on white paper, so roof ideas show.
  drawPlan(g, W, H, idx, doors, { x0: -(W / s - x1) / 2, z0: -(H / s - z1) / 2, s }, { level: 0, map: false, paper: true, labels: true, redraw: () => drawIdea(cv, it) });
  if (levels > 0) {
    g.globalAlpha = 0.85;
    drawPlan(g, W, H, idx, doors, { x0: -(W / s - x1) / 2, z0: -(H / s - z1) / 2, s }, { level: levels, map: false, overlay: true, labels: false });
    g.globalAlpha = 1;
  }
}

// Find a free patch of meadow and add the idea's blocks there.
export function tryIdea(it) {
  const design = store.state.design;
  const cells = [...it.cells].sort((a, b) => a.level - b.level).map(c => ({ ...c, rot: c.rot || 0 }));
  let w = 0, d = 0;
  for (const c of cells) for (const p of footprint(c)) { w = Math.max(w, p.x + 1); d = Math.max(d, p.z + 1); }
  const S = site();
  const centre = [16, 29];
  const spots = [];
  for (let z = 0; z + d < S.d; z++) for (let x = 0; x + w < S.w; x++) spots.push([x, z, Math.hypot(x + w / 2 - centre[0], z + d / 2 - centre[1])]);
  spots.sort((a, b) => a[2] - b[2]);
  for (const [ox, oz] of spots) {
    // Keep a one-cell gap round the idea, on meadow only.
    let clear = true;
    for (let z = oz - 1; z <= oz + d && clear; z++) for (let x = ox - 1; x <= ox + w && clear; x++) if (zone(x, z) !== 'm') clear = false;
    if (!clear) continue;
    let idx = indexDesign(design);
    const added = [];
    let ok = true;
    for (const c of cells) {
      const cand = { ...c, id: -1 - added.length, x: c.x + ox, z: c.z + oz };
      const r = placeCheck(idx, cand);
      if (!r.ok) { ok = false; break; }
      added.push(cand);
      idx = indexDesign({ cells: [...design.cells, ...added] });
    }
    if (!ok) continue;
    try { sessionStorage.setItem('astraarch.undo', JSON.stringify(design.cells)); } catch (e) { /* ignore */ }
    for (const c of added) design.cells.push({ ...c, id: design.nextId++, material: 'colour' });
    store.set({ design });
    store.addLog('', `Tried an idea from ${it.name}: ${it.idea}.`);
    return true;
  }
  return false;
}
