// Little pictures for the Style workshop: roofs, windows, walls, push and pull, extras.
const INK = '#3d405b';
const svg = (inner, vb = '0 0 64 64') => `<svg viewBox="${vb}" class="sty" aria-hidden="true">${inner}</svg>`;
const house = (c, top) => `<path d="M14 34h36v20H14z" fill="${c}" stroke="${INK}" stroke-width="2"/>${top}`;

export function roofIcon(type, c = '#f4a261') {
  const dark = '#3d405b', zinc = '#cfd6dc', white = '#f7f4ee';
  const tops = {
    flat: `<path d="M10 30h44v5H10z" fill="${white}" stroke="${INK}" stroke-width="2"/>`,
    pitch: `<path d="M8 35 32 14l24 21z" fill="${dark}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
    pyramid: `<path d="M10 35 32 8l22 27z" fill="${dark}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M32 8v27" stroke="#6b6f8a" stroke-width="2"/>`,
    cone: `<path d="M14 35 32 4l18 31z" fill="${dark}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><ellipse cx="32" cy="35" rx="20" ry="3" fill="${white}" stroke="${INK}" stroke-width="1.5"/>`,
    barrel: `<path d="M12 35a20 15 0 0 1 40 0z" fill="${zinc}" stroke="${INK}" stroke-width="2"/><path d="M22 35a10 12 0 0 1 20 0" fill="none" stroke="${INK}" stroke-width="1.5"/>`,
    saw: `<path d="M12 35V25l10 10V25l10 10V25l10 10V25l10 10z" fill="${white}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M22 26v8M32 26v8M42 26v8" stroke="#6fb1d1" stroke-width="3"/>`,
    mono: `<path d="M10 35 54 20v15z" fill="${c}" stroke="${INK}" stroke-width="2" stroke-linejoin="round" style="filter:brightness(.8)"/>`,
    dome: `<path d="M12 35a20 20 0 0 1 40 0z" fill="${zinc}" stroke="${INK}" stroke-width="2"/><circle cx="32" cy="14" r="3" fill="${white}" stroke="${INK}" stroke-width="1.5"/>`,
  };
  return svg(house(c, tops[type] || tops.flat));
}

export function windowIcon(type, c = '#f4a261') {
  const wall = `<path d="M8 12h48v40H8z" fill="${c}" stroke="${INK}" stroke-width="2"/>`;
  const g = '#cdeaf5';
  const w = {
    big: `<path d="M14 18h16v24H14zM34 18h16v24H34z" fill="${g}" stroke="#fff" stroke-width="2.5"/>`,
    round: `<circle cx="20" cy="30" r="7" fill="${g}" stroke="#fff" stroke-width="3"/><circle cx="44" cy="30" r="7" fill="${g}" stroke="#fff" stroke-width="3"/>`,
    slot: `<path d="M16 16h4v28h-4zM30 16h4v28h-4zM44 16h4v28h-4z" fill="${g}" stroke="#fff" stroke-width="1.5"/>`,
    strip: `<path d="M12 24h40v8H12z" fill="${g}" stroke="#fff" stroke-width="2"/>`,
    grid: `<path d="M16 18h12v12H16zM30 18h12v12H30zM16 32h12v12H16zM30 32h12v12H30z" fill="${g}" stroke="#fff" stroke-width="2"/>`,
    none: `<path d="M20 22l24 16M44 22 20 38" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>`,
  };
  return svg(wall + (w[type] || ''));
}

// Walls are shown from above, like a plan.
export function wallIcon(type, c = '#f4a261') {
  const p = {
    straight: 'M12 16h40v32H12z',
    round: 'M22 16h20a10 10 0 0 1 10 10v12a10 10 0 0 1-10 10H22a10 10 0 0 1-10-10V26a10 10 0 0 1 10-10z',
    curvy: 'M12 16h40v32Q32 64 12 48z',
    wave: 'M12 16h40v32q-5 6-10 0t-10 0-10 0-10 0z',
  };
  return svg(`<path d="${p[type] || p.straight}" fill="${c}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`);
}

export function moreIcon(type, c = '#f4a261') {
  const m = {
    taller: `<path d="M18 26h28v28H18z" fill="${c}" stroke="${INK}" stroke-width="2"/><path d="M32 22V6M24 13l8-8 8 8" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    lower: `<path d="M18 30h28v24H18z" fill="${c}" stroke="${INK}" stroke-width="2"/><path d="M32 6v18M24 17l8 8 8-8" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    bay: `<path d="M10 14h44v40H10z" fill="${c}" stroke="${INK}" stroke-width="2"/><path d="M22 26h20v18H22z" fill="#cdeaf5" stroke="#fff" stroke-width="3"/><path d="M20 24h24M20 46h24" stroke="${INK}" stroke-width="2.5"/>`,
    legs: `<path d="M12 12h40v24H12z" fill="${c}" stroke="${INK}" stroke-width="2"/><path d="M18 36v18M32 36v18M46 36v18" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
    chimney: `${house(c, `<path d="M10 30h44v5H10z" fill="#f7f4ee" stroke="${INK}" stroke-width="2"/>`)}<path d="M40 10h8v20h-8z" fill="#4a4e69" stroke="${INK}" stroke-width="2"/><path d="M39 8h10v5H39z" fill="${c}" stroke="${INK}" stroke-width="2"/>`,
    flag: `${house(c, `<path d="M10 30h44v5H10z" fill="#f7f4ee" stroke="${INK}" stroke-width="2"/>`)}<path d="M32 30V6" stroke="${INK}" stroke-width="2.5"/><path d="M32 7l16 6-16 6z" fill="#e76f51" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`,
    beak: `<path d="M10 14h36v40H10z" fill="${c}" stroke="${INK}" stroke-width="2"/><path d="M22 36h12v18H22z" fill="#ffd166" stroke="${INK}" stroke-width="2"/><path d="M18 30h20l-10 6z" fill="#4a4e69"/><path d="M46 24l12 8-12 6z" fill="#4a4e69" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
    turn: `<path d="M48 32a16 16 0 1 1-6-12.5" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M44 10l-2 10 10 1" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
  };
  return svg(m[type] || '');
}
