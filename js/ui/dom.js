// Small DOM, speech and sound helpers shared by the shell, the Studio and the missions.
import { speak, stopSpeaking, canSpeak } from '../core/speak.js';
import { store } from '../core/store.js';
import { icon } from '../core/icons.js';
import { emo } from '../core/emoji.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Elements are imported into the page's document straight away (template content belongs to an inert document).
export const h = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return document.importNode(t.content, true).firstElementChild; };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let speakingBtn = null;
export function say(text, btn = null) {
  if (!text) return;
  if (speakingBtn && speakingBtn !== btn) speakingBtn.classList.remove('on');
  speakingBtn = btn;
  btn && btn.classList.add('on');
  speak(text, { onend: () => { btn && btn.classList.remove('on'); if (speakingBtn === btn) speakingBtn = null; } });
}
// Speak only if read-aloud is switched on.
export function sayAuto(text) { if (store.state.autoRead) say(text); }
export function hush() {
  stopSpeaking();
  if (speakingBtn) speakingBtn.classList.remove('on');
  speakingBtn = null;
}
export function speakButton(getText, label = 'Read aloud') {
  const b = h(`<button class="speak-btn" type="button" aria-label="${esc(label)}">${icon('speaker')}</button>`);
  if (!canSpeak) b.style.display = 'none';
  b.addEventListener('click', e => {
    e.stopPropagation();
    if (b.classList.contains('on')) { hush(); return; }
    say(typeof getText === 'function' ? getText() : getText, b);
  });
  return b;
}

export function toast(text, emoji = '') {
  const t = h(`<div class="toast">${emoji ? emo(emoji) : ''}<span>${esc(text)}</span></div>`);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2700);
}

export function modal(title, bodyEl, { wide = false, onClose } = {}) {
  const back = h(`<div class="modal-back" role="dialog" aria-modal="true"><div class="modal card"${wide ? ' style="width:min(1060px,100%)"' : ''}>
    <div class="headrow"><h2>${esc(title)}</h2><button class="btn ghost round" type="button" aria-label="Close">${icon('close')}</button></div>
  </div></div>`);
  back.querySelector('.modal').appendChild(bodyEl);
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); onClose && onClose(); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  back.querySelector('.headrow .btn').addEventListener('click', close);
  back.addEventListener('click', e => { if (e.target === back) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(back);
  return close;
}

// ---------- Sounds (tiny Web Audio synth, no files) ----------
let ac = null;
function audio() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
  if (ac && ac.state === 'suspended') ac.resume();
  return ac;
}
function tone(freq, t0, dur, type = 'sine', vol = 0.18, slide = 0) {
  const a = audio(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, a.currentTime + t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), a.currentTime + t0 + dur);
  g.gain.setValueAtTime(0.0001, a.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(vol, a.currentTime + t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + t0); o.stop(a.currentTime + t0 + dur + 0.05);
}
export const sfx = {
  pop() { if (!store.state.sound) return; tone(520, 0, 0.09, 'triangle', 0.2, 260); tone(780, 0.05, 0.08, 'sine', 0.12); },
  thud() { if (!store.state.sound) return; tone(140, 0, 0.16, 'sine', 0.3, -60); },
  tap() { if (!store.state.sound) return; tone(900, 0, 0.04, 'sine', 0.08); },
  no() { if (!store.state.sound) return; tone(220, 0, 0.12, 'square', 0.06); tone(180, 0.1, 0.16, 'square', 0.06); },
  chime() { if (!store.state.sound) return; [660, 880, 1320].forEach((f, i) => tone(f, i * 0.09, 0.35, 'sine', 0.14)); },
  bell() { if (!store.state.sound) return; [1046, 1318].forEach((f, i) => { tone(f, i * 0.02, 0.9, 'sine', 0.12); tone(f * 2.01, i * 0.02, 0.5, 'sine', 0.03); }); },
  whoosh() { if (!store.state.sound) return; tone(300, 0, 0.35, 'sawtooth', 0.04, 600); },
  tada() { if (!store.state.sound) return; [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.11, 0.5, 'triangle', 0.13)); },
  step() { if (!store.state.sound) return; tone(1200, 0, 0.03, 'sine', 0.05); },
};
