// Show and tell: Finn's design packed into a link. There is no server; the design travels inside the link itself.
// Whoever opens it can look round, go inside, walk through and watch a school day, but cannot change anything,
// and nothing saved on their device is touched.
import { h, esc, emo, say, sfx, toast } from './ui.js';
import { icon } from './icons.js';

const toB64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const squeeze = async text => new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
const unsqueeze = async bytes => new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();

// The design as a short code: the rooms (without their ids) and any extra land round the site.
export async function packDesign(model) {
  const boxes = model.boxes.map(({ id, ...b }) => b);
  return toB64(await squeeze(JSON.stringify({ v: 1, boxes, pad: model.pad, grown: model.grown })));
}
export async function unpackDesign(code) {
  const d = JSON.parse(await unsqueeze(fromB64(code)));
  if (!d || !Array.isArray(d.boxes)) throw new Error('not a design');
  return { boxes: d.boxes.map((b, i) => ({ ...b, id: i + 1 })), pad: { w: 0, e: 0, n: 0, s: 0, ...(d.pad || {}) }, grown: Array.isArray(d.grown) ? d.grown : [] };
}
// The code in this page's address, if it was opened from a show-and-tell link.
export const shownCode = () => new URLSearchParams(location.search).get('show');

// In the builder: the card that makes the link.
export function mountShare(root, model) {
  const sheet = h(`<div class="nova-sheet" hidden><div class="nova-card"></div></div>`);
  root.append(sheet);
  const card = sheet.querySelector('.nova-card');
  const close = () => { sheet.hidden = true; };
  sheet.addEventListener('click', e => { if (e.target === sheet) close(); });
  async function open() {
    if (!model.boxes.length) { sfx.no(); toast('Build your school first!'); return; }
    const url = new URL(`./?show=${await packDesign(model)}#site`, location.href).href;
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
