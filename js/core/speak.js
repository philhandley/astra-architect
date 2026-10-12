// Read-aloud with the browser's speech synthesis, preferring a UK English voice.
const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
let voice = null;
let current = null;

function pickVoice() {
  if (!synth) return null;
  const voices = synth.getVoices();
  const tests = [
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
    const u = new SpeechSynthesisUtterance(String(text));
    if (voice) u.voice = voice;
    u.lang = voice ? voice.lang : 'en-GB';
    u.rate = 0.92;
    u.pitch = 1.02;
    let ended = false;
    const done = () => { if (ended) return; ended = true; if (current === u) current = null; onend && onend(); };
    u.onend = done;
    u.onerror = done;
    current = u;
    synth.speak(u);
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
