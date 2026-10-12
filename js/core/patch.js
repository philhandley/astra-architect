// Architect's patch: a round badge with a blueprint middle and a Twemoji picture.
import { emojiFile } from './emoji.js';

let uid = 0;
const ACCENTS = {
  orange: ['#f28c28', '#ffd2a3'], teal: ['#12857e', '#9fe0db'], green: ['#22a565', '#b9ecd0'], plum: ['#7b5ea7', '#d9c9f0'],
  blue: ['#2f6fe4', '#bcd2fa'], red: ['#e5483d', '#ffc2bc'], yellow: ['#e0a800', '#ffe7a0'],
};
const ICON_EMOJI = { map: '🗺️', bubbles: '🫧', ruler: '📏', arch: '🌈', pencil: '✏️', footsteps: '👣', star: '⭐' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function patchSVG({ name = 'Mission', icon = 'star', emoji = null, accent = 'blue', crew = { commander: 'Finn' }, year = '2026', locked = false } = {}) {
  const id = `ap${++uid}`;
  const [a, a2] = ACCENTS[accent] || ACCENTS.blue;
  const top = String(name).toUpperCase();
  const bottom = `ARCHITECT ${crew.commander || 'Finn'}`.toUpperCase();
  const fsTop = Math.min(19, 300 / Math.max(8, top.length * 0.95));
  const fsBot = Math.min(15, 280 / Math.max(8, bottom.length * 0.95));
  const pic = emojiFile(emoji || ICON_EMOJI[icon] || '⭐');
  return `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(name)} patch"${locked ? ' style="opacity:.25;filter:grayscale(1)"' : ''}>
  <defs>
    <radialGradient id="${id}g" cx="45%" cy="35%" r="75%"><stop offset="0" stop-color="#2d6cc0"/><stop offset="1" stop-color="#173f78"/></radialGradient>
    <pattern id="${id}p" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M12 0H0V12" fill="none" stroke="#ffffff" stroke-opacity=".12" stroke-width="1"/></pattern>
    <path id="${id}t" d="M 41 120 A 79 79 0 0 1 199 120"/>
    <path id="${id}b" d="M 27 120 A 93 93 0 0 0 213 120"/>
  </defs>
  <circle cx="120" cy="120" r="117" fill="${a}"/>
  <circle cx="120" cy="120" r="110" fill="#ffffff"/>
  <circle cx="120" cy="120" r="106" fill="none" stroke="${a}" stroke-width="1.5" stroke-dasharray="3 4"/>
  <text font-family="Lexend, system-ui, sans-serif" font-weight="700" font-size="${fsTop.toFixed(1)}" letter-spacing="2.2" fill="#1f2229" text-anchor="middle"><textPath href="#${id}t" startOffset="50%">${esc(top)}</textPath></text>
  <text font-family="Lexend, system-ui, sans-serif" font-weight="600" font-size="${fsBot.toFixed(1)}" letter-spacing="2.2" fill="${a}" text-anchor="middle"><textPath href="#${id}b" startOffset="50%">${esc(bottom)}</textPath></text>
  <circle cx="27" cy="120" r="5" fill="${a2}"/><circle cx="213" cy="120" r="5" fill="${a2}"/>
  <circle cx="120" cy="120" r="72" fill="url(#${id}g)" stroke="${a}" stroke-width="4"/>
  <circle cx="120" cy="120" r="70" fill="url(#${id}p)"/>
  <image href="${pic}" x="78" y="78" width="84" height="84"/>
  <text x="120" y="182" font-family="Lexend, system-ui, sans-serif" font-size="9" letter-spacing="3" fill="#ffffff" opacity=".7" text-anchor="middle">${esc(year)}</text>
</svg>`;
}
