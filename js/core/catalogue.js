// Rooms, forms, materials, activities and wishes. ENGINE.md is the contract for these ids.

export const LEVEL_H = 0.8;        // height of one floor, in cells
export const MAX_LEVEL = 4;

// ---------- Forms ----------
// cells(rot) gives [dx, dz] offsets from the origin cell. levels = floors tall.
const rotXZ = (dx, dz, rot) => {
  switch (rot & 3) {
    case 1: return [-dz, dx];
    case 2: return [-dx, -dz];
    case 3: return [dz, -dx];
    default: return [dx, dz];
  }
};
// Rotating about the origin would move multi-cell forms onto other cells; instead rotate within the
// footprint's bounding box so the form stays on the cells the child tapped.
function rotCells(base, rot) {
  const pts = base.map(([x, z]) => rotXZ(x, z, rot));
  const mx = Math.min(...pts.map(p => p[0])), mz = Math.min(...pts.map(p => p[1]));
  return pts.map(([x, z]) => [x - mx, z - mz]);
}

export const FORMS = {
  cube:     { name: 'Cube',     base: [[0, 0]], levels: 1, top: 'flat', good: 'A cube makes a simple room. Cubes stack, side by side and on top of each other.' },
  long:     { name: 'Long block', base: [[0, 0], [1, 0]], levels: 1, top: 'flat', good: 'A long block makes a long room, like a hall or a corridor.' },
  tower:    { name: 'Tower',    base: [[0, 0]], levels: 2, top: 'flat', good: 'A tower is tall and thin. From the top you can see a long way.' },
  slab:     { name: 'Slab',     base: [[0, 0], [1, 0]], levels: 1, top: 'none', low: true, good: 'A slab is low and flat. It makes a pool, a deck or a bridge.' },
  arch:     { name: 'Arch',     base: [[0, 0], [1, 0]], levels: 1, top: 'flat', good: 'An arch has a curved opening. The stones push against each other, so it stands up by itself.' },
  curve:    { name: 'Curve',    base: [[1, 0], [0, 1], [1, 1]], box: [2, 2], levels: 1, top: 'flat', good: 'A curve is a quarter of a ring. Four curves make a ring with a courtyard in the middle.' },
  cylinder: { name: 'Cylinder', base: [[0, 0]], levels: 1, top: 'flat', good: 'A cylinder is round, with no corners. It feels calm inside.' },
  dome:     { name: 'Dome',     base: [[0, 0], [1, 0], [0, 1], [1, 1]], levels: 1, top: 'none', good: 'A dome is a round roof. It covers a big space with no posts in the way.' },
  wedge:    { name: 'Wedge',    base: [[0, 0]], levels: 1, top: 'none', good: 'A wedge is a ramp. Make it a slide from a roof down to the ground.' },
  roof:     { name: 'Pitched roof', base: [[0, 0]], levels: 1, top: 'none', cap: true, good: 'A pointy roof lets the rain run off.' },
  pad:      { name: 'Flat tile', base: [[0, 0]], levels: 1, top: 'none', flat: true, good: 'A flat tile goes on the ground or on a roof: a running track, a garden or a deck.' },
  steps:    { name: 'Stairs',   base: [[0, 0]], levels: 1, top: 'flat', good: 'Stairs take you up to the next floor.' },
};

// Curves keep their 2 by 2 box when they turn (the empty corner moves round).
const CURVE_CELLS = [
  [[1, 0], [0, 1], [1, 1]],   // rot 0: ring centre at the top left corner of the box
  [[0, 0], [0, 1], [1, 1]],   // rot 1: centre top right
  [[0, 0], [1, 0], [0, 1]],   // rot 2: centre bottom right
  [[0, 0], [1, 0], [1, 1]],   // rot 3: centre bottom left
];

export function formCells(form, rot = 0) {
  if (form === 'curve') return CURVE_CELLS[rot & 3];
  const f = FORMS[form];
  return rotCells(f.base, rot);
}

// ---------- Rooms ----------
// likes / dislikes: other room ids, or features: view (sea view), waterfall, trees, beach.
export const ROOMS = {
  classroom: { name: 'Classroom', emoji: '✏️', colour: '#f28c28', form: 'cube', forms: ['cube', 'long', 'tower', 'cylinder', 'curve', 'dome', 'arch'], does: ['learn', 'read', 'art'], cap: 4,
    likes: ['view', 'classroom', 'garden', 'library'], dislikes: ['hall', 'music', 'track'], noisy: false, wet: false,
    card: 'Classrooms are where pupils learn. They love daylight and a view.' },
  hall: { name: 'Hall', emoji: '🤸', colour: '#c62f4b', form: 'long', forms: ['long', 'cube', 'dome', 'curve', 'cylinder', 'arch'], does: ['play', 'music', 'eat', 'run'], cap: 6,
    likes: ['lunch', 'changing', 'climbing'], dislikes: ['library', 'yoga'], noisy: true, wet: false,
    card: 'The hall is a big room for PE, games and assemblies. It can get noisy!' },
  library: { name: 'Library', emoji: '📚', colour: '#7b5ea7', form: 'cube', forms: ['cube', 'long', 'cylinder', 'tower', 'curve'], does: ['read'], cap: 3,
    likes: ['classroom', 'yoga', 'view', 'trees'], dislikes: ['hall', 'music', 'pool', 'track'], noisy: false, wet: false,
    card: 'The library is full of books. It wants to be quiet.' },
  lunch: { name: 'Lunch room', emoji: '🍎', colour: '#e86a92', form: 'cube', forms: ['cube', 'long', 'cylinder', 'dome'], does: ['eat'], cap: 5,
    likes: ['hall', 'garden'], dislikes: ['toilets'], noisy: true, wet: false,
    card: 'The lunch room is where everyone eats. It likes to be near the garden.' },
  aquarium: { name: 'Aquarium', emoji: '🐠', colour: '#12857e', form: 'arch', forms: ['arch', 'curve', 'dome', 'tower', 'cylinder'], does: ['look'], cap: 4,
    likes: ['pool', 'beach'], dislikes: [], noisy: false, wet: true, walkThrough: true,
    card: 'The aquarium is full of fish. Walk through it and look up!' },
  yoga: { name: 'Chill-out room', emoji: '🧘', colour: '#8db87c', form: 'cylinder', forms: ['cylinder', 'dome', 'cube', 'curve'], does: ['yoga'], cap: 3,
    likes: ['waterfall', 'trees', 'garden'], dislikes: ['hall', 'track', 'music'], noisy: false, wet: false,
    card: 'The chill-out room is for yoga and calm. It loves the sound of water.' },
  pool: { name: 'Swimming pool', emoji: '🏊', colour: '#2e8bd8', form: 'slab', forms: ['slab'], does: ['swim'], cap: 3, water: true,
    likes: ['changing', 'beach'], dislikes: ['library'], noisy: true, wet: true,
    card: 'The swimming pool is for swimming lessons. Splash!' },
  climbing: { name: 'Climbing wall', emoji: '🧗', colour: '#e3a21a', form: 'tower', forms: ['tower'], does: ['climb'], cap: 2,
    likes: ['hall'], dislikes: ['library'], noisy: true, wet: false, connector: true,
    card: 'The climbing wall is a tall tower. Climb it to get up a floor.' },
  slide: { name: 'Slide', emoji: '🛝', colour: '#ffc93c', form: 'wedge', forms: ['wedge'], does: ['slide'], cap: 2,
    likes: [], dislikes: [], noisy: true, wet: false, connector: true,
    card: 'A slide is the fastest way down. Put it next to something high.' },
  stairs: { name: 'Stairs', emoji: '🪜', colour: '#8a8f99', form: 'steps', forms: ['steps'], does: [], cap: 3,
    likes: [], dislikes: [], noisy: false, wet: false, connector: true,
    card: 'Stairs take pupils up to the next floor, and down again.' },
  track: { name: 'Running track', emoji: '🏃', colour: '#c1440e', form: 'pad', forms: ['pad'], does: ['run'], cap: 3, flat: true,
    likes: [], dislikes: ['library', 'yoga'], noisy: true, wet: false,
    card: 'A running track. Join the tiles up into a loop so pupils can run round and round.' },
  garden: { name: 'Garden', emoji: '🌱', colour: '#4caf50', form: 'pad', forms: ['pad'], does: ['grow', 'play'], cap: 3, flat: true,
    likes: ['lunch'], dislikes: [], noisy: false, wet: false,
    card: 'A garden for growing vegetables and flowers. It can even go on a roof!' },
  lookout: { name: 'Lookout', emoji: '🔭', colour: '#cfc6b4', form: 'tower', forms: ['tower', 'cylinder'], does: ['look'], cap: 2,
    likes: ['view'], dislikes: [], noisy: false, wet: false,
    card: 'A lookout tower for watching the sea, the birds and the boats.' },
  bridge: { name: 'Bridge', emoji: '🌉', colour: '#a47148', form: 'slab', forms: ['slab'], does: [], cap: 4, water: true,
    likes: [], dislikes: [], noisy: false, wet: false,
    card: 'A bridge or a jetty lets pupils walk over water.' },
  changing: { name: 'Changing room', emoji: '🩱', colour: '#8ec5e8', form: 'cube', forms: ['cube'], does: [], cap: 4,
    likes: ['pool'], dislikes: [], noisy: false, wet: true,
    card: 'The changing room is where you get ready to swim.' },
  toilets: { name: 'Toilets', emoji: '🚽', colour: '#a7b3c2', form: 'cube', forms: ['cube'], does: [], cap: 3,
    likes: [], dislikes: ['lunch'], noisy: false, wet: true,
    card: 'Every school needs toilets!' },
  art: { name: 'Art room', emoji: '🎨', colour: '#b565c9', form: 'cube', forms: ['cube', 'long', 'cylinder', 'dome'], does: ['art'], cap: 4,
    likes: ['garden', 'view'], dislikes: [], noisy: false, wet: false,
    card: 'The art room is for painting and making. It loves lots of light.' },
  music: { name: 'Music room', emoji: '🎵', colour: '#5c6bc0', form: 'cube', forms: ['cube', 'cylinder', 'dome'], does: ['music'], cap: 4,
    likes: ['hall'], dislikes: ['library', 'classroom', 'yoga'], noisy: true, wet: false,
    card: 'The music room is for singing and drums. It is the noisiest room of all!' },
};

export const TRAY = ['classroom', 'hall', 'library', 'lunch', 'aquarium', 'yoga', 'pool', 'changing',
  'climbing', 'slide', 'stairs', 'track', 'garden', 'lookout', 'art', 'music', 'toilets', 'bridge'];

export const FEATURES = {
  view: { name: 'a sea view', emoji: '🌊' },
  waterfall: { name: 'the waterfall', emoji: '💦' },
  trees: { name: 'the trees', emoji: '🌳' },
  beach: { name: 'the beach', emoji: '🏖️' },
};

// ---------- Materials ----------
export const MATERIALS = {
  colour: { name: 'Painted', emoji: '🎨', card: 'Painted walls in the room colour, bright and easy to spot.' },
  render: { name: 'White render', emoji: '⬜', tint: '#f1ede4', card: 'Smooth white walls that stay cool in the sun.' },
  timber: { name: 'Wood', emoji: '🪵', tint: '#b07a4a', card: 'Wood is warm and friendly, and it comes from trees that grow again.' },
  brick: { name: 'Brick', emoji: '🧱', tint: '#b5523b', card: 'Bricks are strong, and they last a very long time.' },
  glass: { name: 'Glass', emoji: '🪟', tint: '#9fd3ef', card: 'Glass lets the light in and lets you see out.' },
  stone: { name: 'Stone', emoji: '🪨', tint: '#aaa398', card: 'Stone is heavy and strong, like the mountains.' },
  grass: { name: 'Green roof', emoji: '🌿', tint: '#6daa4f', card: 'Plants on the walls and roof are homes for bees and birds.' },
  copper: { name: 'Copper', emoji: '🟠', tint: '#c87533', card: 'Copper starts shiny orange and slowly turns sea green.' },
};
export const MATERIAL_ORDER = ['colour', 'render', 'timber', 'brick', 'glass', 'stone', 'grass', 'copper'];

// ---------- Activities ----------
export const ACTIVITIES = {
  learn: { name: 'Learn', emoji: '✏️', rooms: ['classroom'] },
  read: { name: 'Read', emoji: '📖', rooms: ['library', 'classroom'] },
  play: { name: 'Play', emoji: '⚽', rooms: ['hall', 'garden'] },
  swim: { name: 'Swim', emoji: '🏊', rooms: ['pool'] },
  run: { name: 'Run', emoji: '🏃', rooms: ['track', 'hall'] },
  climb: { name: 'Climb', emoji: '🧗', rooms: ['climbing'] },
  slide: { name: 'Slide', emoji: '🛝', rooms: ['slide'] },
  yoga: { name: 'Yoga', emoji: '🧘', rooms: ['yoga'] },
  eat: { name: 'Eat', emoji: '🍎', rooms: ['lunch', 'hall'] },
  look: { name: 'Look', emoji: '👀', rooms: ['aquarium', 'lookout'] },
  grow: { name: 'Grow', emoji: '🌱', rooms: ['garden'] },
  art: { name: 'Paint', emoji: '🎨', rooms: ['art', 'classroom'] },
  music: { name: 'Sing', emoji: '🎵', rooms: ['music', 'hall'] },
};
export const ACTIVITY_ORDER = ['learn', 'read', 'swim', 'run', 'eat', 'yoga', 'look', 'play', 'climb', 'slide', 'grow', 'art', 'music'];

// ---------- Wishes (the Brief) ----------
export const WISHES = {
  'yoga-waterfall': { name: 'A chill-out room by the waterfall', short: 'Chill-out by the waterfall', emoji: '🧘' },
  'sea-classroom': { name: 'Classrooms facing the sea', short: 'Classrooms facing the sea', emoji: '🌊' },
  pool: { name: 'A swimming pool', short: 'A swimming pool', emoji: '🏊' },
  'arch-aquarium': { name: 'An arched aquarium you can walk through', short: 'A walk-through aquarium', emoji: '🐠' },
  'roof-track': { name: 'A running track on the roof', short: 'A track on the roof', emoji: '🏃' },
  lunch: { name: 'Somewhere to eat', short: 'Somewhere to eat', emoji: '🍎' },
  library: { name: 'A library', short: 'A library', emoji: '📚' },
  toilets: { name: 'Toilets!', short: 'Toilets', emoji: '🚽' },
  slide: { name: 'A slide', short: 'A slide', emoji: '🛝' },
  lookout: { name: 'A lookout tower', short: 'A lookout', emoji: '🔭' },
  garden: { name: 'A garden to grow food', short: 'A garden', emoji: '🌱' },
  climbing: { name: 'A climbing wall', short: 'A climbing wall', emoji: '🧗' },
  art: { name: 'An art room', short: 'An art room', emoji: '🎨' },
  music: { name: 'A music room', short: 'A music room', emoji: '🎵' },
  happy: { name: 'Every room is happy', short: 'Happy neighbours', emoji: '😊' },
  reach: { name: 'Pupils can reach every room', short: 'Every room reachable', emoji: '🚶' },
};

// Colour helpers
export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mix(hex, toHex, t) {
  const a = hexToRgb(hex), b = hexToRgb(toHex);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

for (const T of [FORMS, ROOMS, MATERIALS, ACTIVITIES, WISHES, FEATURES]) for (const [id, v] of Object.entries(T)) v.id = id;
