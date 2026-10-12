// Twemoji pictures, served from assets/emoji/ (CC BY 4.0, Twitter Inc and contributors).
// File names follow Twemoji's rule: code points in hex joined by '-', dropping FE0F unless the sequence has a ZWJ.
export function emojiFile(ch) {
  const s = String(ch || '');
  const raw = s.includes('‍') ? s : s.replace(/️/g, '');
  const cps = [];
  for (const c of raw) cps.push(c.codePointAt(0).toString(16));
  return `assets/emoji/${cps.join('-')}.svg`;
}

// Split a string of emoji into separate pictures (handles ZWJ sequences, variation selectors and skin tones).
export function splitEmoji(str) {
  const out = [];
  let cur = '';
  let joinNext = false;
  for (const c of String(str || '')) {
    const cp = c.codePointAt(0);
    const attach = cp === 0xfe0f || cp === 0x200d || cp === 0x20e3 || (cp >= 0x1f3fb && cp <= 0x1f3ff) || joinNext;
    if (cur && attach) cur += c; else { if (cur) out.push(cur); cur = c; }
    joinNext = cp === 0x200d;
  }
  if (cur) out.push(cur);
  return out.filter(e => e.trim());
}

// <img> markup for one emoji (alt text keeps the character for screen readers).
export function emo(ch, cls = 'emo') {
  if (!ch) return '';
  return `<img class="${cls}" src="${emojiFile(ch)}" alt="${ch}" draggable="false" onerror="this.replaceWith(document.createTextNode(this.alt))">`;
}

export function emoRow(str, cls = 'emo') {
  return splitEmoji(str).map(e => emo(e, cls)).join('');
}

// Load an emoji as an Image (for canvas textures).
const cache = new Map();
export function emojiImage(ch) {
  const src = emojiFile(ch);
  if (!cache.has(src)) {
    cache.set(src, new Promise(res => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = src;
    }));
  }
  return cache.get(src);
}
