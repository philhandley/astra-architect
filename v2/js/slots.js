// My schools: up to four designs kept side by side, each with a little picture, so Finn can try a second
// school without losing the first. The live design is always one of them; the others sleep in localStorage.
import { icon } from './icons.js';
import { h, esc, emo, say, sfx, toast } from './ui.js';

const KEY = 'astraarch2-slots', MAX = 4;

export function mountSlots(root, model, { world, site }) {
  let store = load();
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && Array.isArray(s.list)) return s; } catch (e) { /* fresh */ }
    return { current: null, list: [] };
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { toast('No room left to keep another school.'); } }
  const data = () => JSON.parse(JSON.stringify({ boxes: model.boxes, nextId: model.nextId, styles: model.styles, grown: model.grown, pad: model.pad, notes: model.notes }));
  const nextName = () => { for (let n = 1; n < 20; n++) { const name = `School ${n}`; if (!store.list.some(s => s.name === name)) return name; } return 'Another school'; };
  const current = () => store.list.find(s => s.id === store.current);

  // The first time, the design on the table becomes School 1.
  function ensure() {
    if (current()) return;
    const id = Date.now().toString(36);
    store.list.push({ id, name: nextName(), at: Date.now(), thumb: null, data: data() });
    store.current = id; persist();
  }
  // A small picture of the school as it is now (the whole site, framed).
  function thumb() {
    const cam = world.camera, ctl = world.controls, keep = { pos: cam.position.clone(), target: ctl.target.clone(), zoom: cam.zoom };
    try {
      site.frameSite(true);
      world.step(0);
      const src = world.renderer.domElement, c = document.createElement('canvas'); c.width = 320; c.height = 200;
      const g = c.getContext('2d'), s = Math.max(c.width / src.width, c.height / src.height), w = src.width * s, hh = src.height * s;
      g.drawImage(src, (c.width - w) / 2, (c.height - hh) / 2, w, hh);
      return c.toDataURL('image/jpeg', 0.72);
    } catch (e) { return null; }
    finally { cam.position.copy(keep.pos); ctl.target.copy(keep.target); cam.zoom = keep.zoom; cam.updateProjectionMatrix(); ctl.update(); }
  }
  function saveCurrent(withThumb = false) {
    ensure();
    const s = current(); s.data = data(); s.at = Date.now(); if (withThumb) s.thumb = thumb() || s.thumb;
    persist();
  }
  // Keep the live design's slot up to date as Finn builds (no picture: that waits for the sheet).
  let timer = null;
  model.onChange(() => { if (!current()) return; clearTimeout(timer); timer = setTimeout(() => saveCurrent(false), 800); });

  function switchTo(id) {
    const s = store.list.find(x => x.id === id); if (!s || id === store.current) return;
    saveCurrent(true);
    const d = s.data || {};
    model.boxes = d.boxes || []; model.nextId = d.nextId || (model.boxes.length + 1); model.styles = d.styles || {}; model.grown = d.grown || []; model.pad = { w: 0, e: 0, n: 0, s: 0, ...(d.pad || {}) }; model.notes = d.notes || {};
    store.current = id; persist();
    site.reloadLand();
    say(`Here is ${s.name}.`);
  }
  function add(kind) {
    if (store.list.length >= MAX) { sfx.no(); toast(`You can keep ${MAX} schools. Take one away to start another.`); return; }
    saveCurrent(true);
    const id = Date.now().toString(36), d = kind === 'copy' ? data() : { boxes: [], nextId: 1, styles: model.styles, grown: [], pad: { w: 0, e: 0, n: 0, s: 0 }, notes: {} };
    store.list.push({ id, name: nextName(), at: Date.now(), thumb: kind === 'copy' ? current()?.thumb || null : null, data: d });
    persist();
    switchTo(id);
  }
  function remove(id) {
    const s = store.list.find(x => x.id === id); if (!s) return;
    if (id === store.current) { toast('Open another school first, then take this one away.'); return; }
    if (!confirm(`Take ${s.name} away for good?`)) return;
    store.list = store.list.filter(x => x.id !== id); persist();
  }
  function rename(id) {
    const s = store.list.find(x => x.id === id); if (!s) return;
    const name = prompt('What is this school called?', s.name); if (!name?.trim()) return;
    s.name = name.trim().slice(0, 30); persist();
  }

  let sheet = null;
  function draw() {
    const cards = store.list.map(s => `<div class="sl-card ${s.id === store.current ? 'on' : ''}" data-id="${s.id}">
      <div class="sl-pic">${s.thumb ? `<img src="${s.thumb}" alt="">` : `<div class="sl-blank">${icon('site')}</div>`}${s.id === store.current ? '<span class="sl-now">This one</span>' : ''}</div>
      <div class="sl-foot"><b>${esc(s.name)}</b><small>${(s.data?.boxes || []).length} pieces</small></div>
      <div class="sl-acts">${s.id === store.current ? '' : `<button class="fbtn ok" type="button" data-open>${icon('site')}<span>Open</span></button>`}<button class="fbtn" type="button" data-rename aria-label="Rename">${icon('talk')}</button><button class="fbtn" type="button" data-del aria-label="Take away">${icon('bin')}</button></div>
    </div>`).join('');
    sheet.querySelector('.sl-grid').innerHTML = cards;
    sheet.querySelector('.sl-new').hidden = store.list.length >= MAX;
  }
  function open() {
    saveCurrent(true);
    sheet = h(`<div class="nova-sheet"><div class="nova-card sl-sheet">
      <div class="nova-head">${emo('🏫', 'emo head-pic')}<div><small>My schools</small><h2>Which school shall we work on?</h2></div><button class="fbtn close" type="button" data-x aria-label="Done">${icon('close')}</button></div>
      <p class="share-text">Keep up to ${MAX} schools. Tap one to open it; the one you leave is kept just as it is.</p>
      <div class="sl-grid"></div>
      <div class="sl-new"><button class="fbtn" type="button" data-new="empty">${icon('leaf')}<span>New empty school</span></button><button class="fbtn" type="button" data-new="copy">${icon('copy')}<span>Copy this school</span></button></div>
    </div></div>`);
    root.append(sheet); draw();
    sheet.addEventListener('click', e => {
      if (e.target.closest('[data-x]') || e.target === sheet) { sfx.tap(); sheet.remove(); sheet = null; return; }
      const nw = e.target.closest('[data-new]'); if (nw) { sfx.tap(); add(nw.dataset.new); sheet.remove(); sheet = null; return; }
      const card = e.target.closest('.sl-card'); if (!card) return;
      const id = card.dataset.id;
      if (e.target.closest('[data-del]')) { sfx.tap(); remove(id); draw(); return; }
      if (e.target.closest('[data-rename]')) { sfx.tap(); rename(id); draw(); return; }
      if (id !== store.current) { sfx.whoosh(); switchTo(id); sheet.remove(); sheet = null; }
    });
  }
  return { open };
}
