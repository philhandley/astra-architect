// Small helpers: DOM, read-aloud and sounds.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const h = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return document.importNode(t.content, true).firstElementChild; };
export const emo = (ch, cls = 'emo') => {
  const cps = [...String(ch).replace(/️/g, '')].map(c => c.codePointAt(0).toString(16)).join('-');
  return `<img class="${cls}" src="../assets/emoji/${cps}.svg" alt="${ch}" draggable="false" onerror="this.replaceWith(document.createTextNode(this.alt))">`;
};

// ---------- read-aloud (a friendly UK voice, a sentence or two at a time) ----------
const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
let voice = null;
function pick() {
  const vs = synth ? synth.getVoices() : [];
  const tests = [v => /UK English Female/i.test(v.name), v => /en[-_]GB/i.test(v.lang) && /(Sonia|Libby|Maisie|Google|Natural|Online)/i.test(v.name), v => /en[-_]GB/i.test(v.lang), v => /^en/i.test(v.lang)];
  for (const t of tests) { const v = vs.find(t); if (v) return v; }
  return null;
}
if (synth) { voice = pick(); synth.addEventListener?.('voiceschanged', () => { voice = pick(); }); }
export let speechOn = (() => { try { return localStorage.getItem('astraarch2.speech') !== 'off'; } catch (e) { return true; } })();
export function setSpeech(on) { speechOn = on; try { localStorage.setItem('astraarch2.speech', on ? 'on' : 'off'); } catch (e) { /* ignore */ } if (!on) hush(); }
export function say(text) {
  if (!synth || !text || !speechOn) return;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;      // (nothing speaks before the first tap)
  synth.cancel();
  const parts = String(text).match(/[^.!?]+[.!?]*/g) || [String(text)];
  for (const p of parts) {
    const u = new SpeechSynthesisUtterance(p.trim());
    if (voice) u.voice = voice;
    u.lang = voice ? voice.lang : 'en-GB'; u.rate = 0.92; u.pitch = 1.08;
    synth.speak(u);
  }
}
export function hush() { try { synth && synth.cancel(); } catch (e) { /* ignore */ } }

// ---------- sounds (a tiny synth, no files) ----------
let ac = null;
export let soundOn = (() => { try { return localStorage.getItem('astraarch2.sound') !== 'off'; } catch (e) { return true; } })();
export function setSound(on) { soundOn = on; try { localStorage.setItem('astraarch2.sound', on ? 'on' : 'off'); } catch (e) { /* ignore */ } }
function tone(f, t0, dur, type = 'sine', vol = 0.15, slide = 0) {
  if (!soundOn) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + t0;
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.linearRampToValueAtTime(f + slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch (e) { /* no audio */ }
}
export const sfx = {
  tap() { tone(660, 0, 0.06, 'triangle', 0.1); },
  place(level = 0) { const f = 392 * Math.pow(2, level * 3 / 12); tone(f * 0.6, 0, 0.05, 'triangle', 0.2, -50); tone(f, 0.04, 0.12, 'triangle', 0.16, 200); tone(f * 1.5, 0.1, 0.14, 'sine', 0.08); },
  grow() { tone(520, 0, 0.08, 'sine', 0.12, 180); },
  shrink() { tone(560, 0, 0.08, 'sine', 0.12, -200); },
  no() { tone(200, 0, 0.14, 'square', 0.06, -40); },
  bin() { tone(180, 0, 0.18, 'sine', 0.22, -90); },
  whoosh() { tone(300, 0, 0.25, 'sine', 0.06, 500); },
  bell() { for (let i = 0; i < 4; i++) { tone(988, i * 0.32, 0.3, 'sine', 0.12); tone(784, i * 0.32 + 0.16, 0.3, 'sine', 0.1); } },
  cheer() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.07, 0.22, 'triangle', 0.1)); },
};

export function toast(text) {
  const t = h(`<div class="toast">${esc(text)}</div>`);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}
