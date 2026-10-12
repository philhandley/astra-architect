// Little isometric drawings of each form, for the Shape panel and the shape lab.
const T = '#9ec5f0', L = '#5d93d6', R = '#3f74b8', S = 'stroke="#1f2229" stroke-width="1.6" stroke-linejoin="round"';

const draw = {
  cube: `<path d="M32 10 52 21 32 32 12 21z" fill="${T}" ${S}/><path d="M12 21v22l20 11V32z" fill="${L}" ${S}/><path d="M52 21v22L32 54V32z" fill="${R}" ${S}/>`,
  long: `<path d="M24 12 58 30 40 40 6 22z" fill="${T}" ${S}/><path d="M6 22v18l34 18V40z" fill="${L}" ${S}/><path d="M58 30v18L40 58V40z" fill="${R}" ${S}/>`,
  tower: `<path d="M32 4 46 12 32 20 18 12z" fill="${T}" ${S}/><path d="M18 12v38l14 8V20z" fill="${L}" ${S}/><path d="M46 12v38l-14 8V20z" fill="${R}" ${S}/>`,
  slab: `<path d="M24 22 58 38 40 48 6 32z" fill="${T}" ${S}/><path d="M6 32v6l34 16v-6z" fill="${L}" ${S}/><path d="M58 38v6L40 54v-6z" fill="${R}" ${S}/>`,
  arch: `<path d="M24 12 58 30 40 40 6 22z" fill="${T}" ${S}/><path d="M6 22v18l34 18V40z" fill="${L}" ${S}/><path d="M58 30v18L40 58V40z" fill="${R}" ${S}/><path d="M44 54V46a5 6 0 0 1 10-5v9" fill="#fff" ${S}/>`,
  curve: `<path d="M8 30a26 13 0 0 1 48 0l-10 5a16 8 0 0 0-28 0z" fill="${T}" ${S}/><path d="M8 30v14l10 5V35z" fill="${L}" ${S}/><path d="M56 30v14l-10 5V35z" fill="${R}" ${S}/>`,
  cylinder: `<ellipse cx="32" cy="18" rx="18" ry="8" fill="${T}" ${S}/><path d="M14 18v26a18 8 0 0 0 36 0V18a18 8 0 0 1-36 0z" fill="${L}" ${S}/>`,
  dome: `<path d="M8 42a24 26 0 0 1 48 0z" fill="${L}" ${S}/><ellipse cx="32" cy="42" rx="24" ry="9" fill="${R}" ${S}/><path d="M20 26a14 14 0 0 1 10-8" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  wedge: `<path d="M8 46 40 58 56 50 24 38z" fill="${R}" ${S}/><path d="M24 38 56 50V24z" fill="${T}" ${S}/><path d="M40 58V32l16-8v26z" fill="${L}" ${S}/>`,
  roof: `<path d="M12 40 32 18 52 40z" fill="${R}" ${S}/><path d="M32 18 52 40l-8 6-20-22z" fill="${L}" ${S}/>`,
  pad: `<path d="M32 26 56 38 32 50 8 38z" fill="${T}" ${S}/><path d="M8 38v4l24 12v-4zM56 38v4L32 54v-4z" fill="${L}" ${S}/>`,
  steps: `<path d="M12 46v-8l8 4v-8l8 4v-8l8 4v-8l8 4v-8l8 4v28L32 58z" fill="${L}" ${S}/>`,
};

export function formIcon(form, cls = 'form') {
  return `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true">${draw[form] || draw.cube}</svg>`;
}
