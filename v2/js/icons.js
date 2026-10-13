// A small set of clean line icons (24 x 24, round ends), drawn to match each other. Colour comes from the button.
const P = {
  pick: '<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v4.5a6.5 6.5 0 0 1-6.5 6.5h-.6a6 6 0 0 1-4.6-2.2L4.6 15a1.6 1.6 0 0 1 2.3-2.2L9 14.5"/>',
  rooms: '<rect x="3" y="12" width="8" height="8" rx="1.5"/><rect x="13" y="12" width="8" height="8" rx="1.5"/><rect x="8" y="3" width="8" height="8" rx="1.5"/>',
  site: '<path d="M3 17l9 4 9-4-9-4z"/><path d="M7.5 15l9 4M16.5 15l-9 4"/><circle cx="12" cy="7" r="3"/><path d="M12 10v3"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  left: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  right: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',
  in: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M11 8v6M8 11h6"/>',
  out: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M8 11h6"/>',
  whole: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><path d="M8 14l4 2 4-2-4-2z"/>',
  inside: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 12l8 4 8-4" stroke-dasharray="2 2.5"/><path d="M12 16v4"/>',
  print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
  shape: '<path d="M12 3l3.5 6h-7z"/><rect x="3" y="13" width="7" height="7" rx="1"/><circle cx="17.5" cy="16.5" r="3.5"/>',
  colour: '<path d="M12 3a9 9 0 0 0 0 18c1.4 0 2-1 2-2s-1-1.6-1-2.6S14 15 15 15h2a4 4 0 0 0 4-4c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
  expand: '<path d="M9 3.5H3.5V9M15 3.5h5.5V9M9 20.5H3.5V15M15 20.5h5.5V15"/><path d="M3.5 3.5 9.5 9.5M20.5 3.5l-6 6M3.5 20.5l6-6M20.5 20.5l-6-6"/>',
  windows: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M12 3.5v17M3.5 12h17"/><circle cx="7.8" cy="7.8" r=".9"/>',
  surface: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.3h18M3 14.6h18M9 4v5.3M15 9.3v5.3M9 14.6V20"/>',
  turn: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  bin: '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/>',
  done: '<path d="M5 12.5 10 17l9-10"/>',
  blocks: '<rect x="3" y="13" width="8" height="7" rx="1.2"/><rect x="13" y="13" width="8" height="7" rx="1.2"/><rect x="6" y="4" width="12" height="7" rx="1.2"/>',
  leaf: '<path d="M5 19c0-8 6-14 15-14 0 9-6 15-14 15"/><path d="M5 19 14 10"/>',
  speaker: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  floors: '<path d="M12 4 3 8.5l9 4.5 9-4.5z"/><path d="m3 12.5 9 4.5 9-4.5M3 16.5 12 21l9-4.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/><path d="M12 3v2"/>',
  walk: '<circle cx="13" cy="4.5" r="2"/><path d="M10 21l2-6 3 3v3M8.5 12.5 11 8h3l2.5 3.5L19 12"/><path d="M11 8l-1.5 5.5L12 15"/>',
  rocket: '<path d="M12 2c3 2.5 4.5 6 4.5 10L15 16H9l-1.5-4C7.5 8 9 4.5 12 2z"/><circle cx="12" cy="9.5" r="1.6"/><path d="M9 16l-2.5 3 2.5-.5M15 16l2.5 3-2.5-.5M10.5 19.5 12 22l1.5-2.5"/>',
};
export const icon = (name, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

// The app's mark: three stacked blocks in the school's colours.
export const MARK = `<svg class="mark" viewBox="0 0 48 48" aria-hidden="true">
  <path d="M8 30l12-6 12 6-12 6z" fill="#f9d45c"/><path d="M8 30v8l12 6v-8z" fill="#f7c22e"/><path d="M20 36v8l12-6v-8z" fill="#e0a915"/>
  <path d="M18 18l11-5.5 11 5.5-11 5.5z" fill="#ff7aa6"/><path d="M18 18v8l11 5.5v-8z" fill="#e2457d"/><path d="M29 23.5v8l11-5.5v-8z" fill="#c22f63"/>
  <path d="M6 14l8-4 8 4-8 4z" fill="#5fd2db"/><path d="M6 14v6l8 4v-6z" fill="#22b2bf"/><path d="M14 18v6l8-4v-6z" fill="#14919c"/>
</svg>`;

// A little picture of each window style, on a wall in the room's own colour.
export function winSwatch(id, hex) {
  const W = '<rect x="0" y="0" width="64" height="44" fill="' + hex + '"/>', g = '#a9d8ec', f = '#fbfaf6', pop = '#3d8de0';
  const r = (x, y, w, h, fr = f, sw = 1.6) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${g}" stroke="${fr}" stroke-width="${sw}"/>`;
  const art = {
    big: r(6, 9, 22, 26, pop, 3) + r(36, 9, 22, 26, pop, 3) + `<path d="M17 9v26M6 25h22M47 9v26M36 25h22" stroke="${f}" stroke-width="1.4"/>`,
    pixel: r(6, 7, 9, 9, '#f7c22e') + r(20, 18, 14, 14) + r(40, 6, 9, 9, '#e2457d') + r(46, 24, 12, 12, '#22b2bf') + r(8, 28, 8, 8),
    ribbon: r(5, 15, 54, 13) + [16, 27, 38, 49].map(x => `<path d="M${x} 15v13" stroke="${f}" stroke-width="1.4"/>`).join(''),
    porthole: [12, 32, 52].map((x, i) => `<circle cx="${x}" cy="${i % 2 ? 19 : 25}" r="7" fill="${g}" stroke="${f}" stroke-width="2.4"/>`).join(''),
    slots: [[6, 4], [14, 7], [26, 3], [33, 9], [47, 5], [56, 4]].map(([x, w]) => r(x, 6, w, 32)).join(''),
    grid: [8, 26, 44].map(x => r(x, 9, 12, 12) + r(x, 26, 12, 12)).join(''),
  }[id] || '';
  return `<svg class="sf" viewBox="0 0 64 44" aria-hidden="true">${W}${art}</svg>`;
}
