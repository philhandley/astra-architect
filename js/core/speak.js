// Read-aloud with the browser's speech synthesis, preferring a UK English voice.
const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
let voice = null;
let current = null;

function pickVoice() {
  if (!synth) return null;
  const voices = synth.getVoices();
  const tests = [
    v => /UK English Female/i.test(v.name),                                   // Samsung and Google on Android
    v => /en[-_]GB/i.test(v.lang) && /(Sonia|Libby|Maisie)/i.test(v.name),     // friendly Microsoft UK voices
    v => /en[-_]GB/i.test(v.lang) && /(Google|Natural|Online|Neural|Enhanced|Premium)/i.test(v.name),
    v => /en[-_]GB/i.test(v.lang),
    v => /^en[-_](AU|IE|NZ)/i.test(v.lang),
    v => /^en/i.test(v.lang),
  ];
  for (const t of tests) {
    const v = voices.find(t);
    if (v) return v;
  }
  return null;
}

if (synth) {
  voice = pickVoice();
  synth.addEventListener?.('voiceschanged', () => { voice = pickVoice(); });
}

export const canSpeak = !!synth;

export function speak(text, { onend } = {}) {
  if (!synth || !text) { onend && onend(); return; }
  try {
    synth.cancel();
    // Chrome stops long utterances after about 15 seconds, so speak a sentence or two at a time.
    const parts = String(text).match(/[^.!?]+[.!?]*/g) || [String(text)];
    const chunks = [];
    for (const raw of parts) { const p = raw.trim(); if (!p) continue; if (chunks.length && chunks[chunks.length - 1].length + p.length < 150) chunks[chunks.length - 1] += ' ' + p; else chunks.push(p); }
    const token = {};
    current = token;
    let ended = false;
    const done = () => { if (ended) return; ended = true; if (current === token) current = null; onend && onend(); };
    chunks.forEach((c, i) => {
      const u = new SpeechSynthesisUtterance(c);
      if (voice) u.voice = voice;
      u.lang = voice ? voice.lang : 'en-GB';
      u.rate = 0.9;
      u.pitch = 1.08;
      if (i === chunks.length - 1) u.onend = done;
      u.onerror = done;
      synth.speak(u);
    });
    if (!chunks.length) done();
  } catch (e) {
    onend && onend();
  }
}

export function stopSpeaking() {
  if (!synth) return;
  try { synth.cancel(); } catch (e) { /* ignore */ }
}

// Join parts into speakable text, adding full stops where needed.
export function sentences(...parts) {
  return parts
    .filter(Boolean)
    .map(p => String(p).trim())
    .map(p => (/[.!?:]$/.test(p) ? p : p + '.'))
    .join(' ');
}
