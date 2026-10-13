// What Finn can build. One grid square is one wooden block from his model: a classroom for about 30 children
// (about 8 by 8 metres). One level is one storey (about 4 metres).

export const LEVEL = 0.5;          // world units per storey (a square is 1 unit)
export const MAX_LEVELS = 8;
export const MAX_SIZE = 6;          // squares along one side

// Bold, matte colours in the MVRDV diagram family.
export const PALETTE = [
  { id: 'yellow', hex: '#f7c22e', name: 'Sunshine' },
  { id: 'orange', hex: '#f28b30', name: 'Orange' },
  { id: 'red', hex: '#e6463c', name: 'Red' },
  { id: 'magenta', hex: '#e2457d', name: 'Raspberry' },
  { id: 'pink', hex: '#f5a3c7', name: 'Pink' },
  { id: 'purple', hex: '#7c46a8', name: 'Purple' },
  { id: 'blue', hex: '#3d8de0', name: 'Blue' },
  { id: 'teal', hex: '#22b2bf', name: 'Teal' },
  { id: 'mint', hex: '#8fdac3', name: 'Mint' },
  { id: 'lime', hex: '#a3d140', name: 'Lime' },
  { id: 'forest', hex: '#3e9a4f', name: 'Leaf green' },
  { id: 'white', hex: '#f4f1ea', name: 'White' },
  { id: 'navy', hex: '#2e4a8c', name: 'Navy' },
];
export const colourHex = id => (PALETTE.find(p => p.id === id) || PALETTE[0]).hex;

// Shapes. flat: things can be built on top. cap: nothing goes on top. ring: the middle stays open.
export const SHAPES = {
  box: { name: 'Box', flat: true },
  house: { name: 'Pointy roof' },
  saw: { name: 'Zigzag roof' },
  vault: { name: 'Round roof' },
  drum: { name: 'Round', flat: true },
  tower: { name: 'Witch hats' },
  ring: { name: 'Ring', flat: true, ring: true },
  ringhouse: { name: 'Ring of classrooms', ring: true },
  arc: { name: 'Curve' },
  spiral: { name: 'Spiral stairs', cap: true },
  arch: { name: 'Arch', flat: true },
  steps: { name: 'Big steps' },
  stairs: { name: 'Stairs', cap: true },
  slide: { name: 'Slide', cap: true },
  pool: { name: 'Pool', cap: true },
  track: { name: 'Track', cap: true },
  garden: { name: 'Garden', cap: true },
  tree: { name: 'Tree', cap: true },
  turbine: { name: 'Wind turbine', cap: true },
  rocket: { name: 'Rocket', cap: true },
  observatory: { name: 'Star dome', cap: true },
  greenhouse: { name: 'Glass house', cap: true },
  glassdome: { name: 'Glass dome', cap: true },
  glassvault: { name: 'Glass tunnel', cap: true },
  treehouse: { name: 'Treehouse', cap: true },
  stage: { name: 'Stage', cap: true },
  circle: { name: 'Talking circle', cap: true },
  weather: { name: 'Weather station', cap: true },
  bridge: { name: 'Bridge', cap: true },
  tube: { name: 'Tube', cap: true },
  canopy: { name: 'Covered walk', cap: true },
  terraces: { name: 'Tree terraces', cap: true },
  ramp: { name: 'Ramp', cap: true },
  swings: { name: 'Swings', cap: true },
  climbdome: { name: 'Climbing dome', cap: true },
  roundabout: { name: 'Roundabout', cap: true },
  seesaw: { name: 'Seesaw', cap: true },
  sandpit: { name: 'Sandpit', cap: true },
  playtower: { name: 'Play tower', cap: true },
  zipline: { name: 'Zip line', cap: true },
};

// Programmes: what each piece is for. size = [width, depth, storeys].
export const PROGRAMMES = {
  classroom: { name: 'Classroom', emoji: '✏️', size: [1, 1, 1], shapes: ['house', 'box', 'arc', 'drum', 'saw', 'tower', 'vault', 'ringhouse'], colour: 'yellow',
    holds: '30 children', say: 'A classroom for thirty children. It is one block, like in your model.' },
  hall: { name: 'Hall', emoji: '🤸', size: [3, 2, 2], shapes: ['vault', 'box', 'saw', 'house', 'drum', 'arch'], colour: 'magenta',
    holds: 'the whole school', say: 'The hall is big and tall, for PE and for the whole school to meet.' },
  pool: { name: 'Swimming pool', emoji: '🏊', size: [3, 2, 1], shapes: ['pool', 'vault', 'box'], colour: 'teal',
    holds: '20 swimmers', say: 'A swimming pool. Make it bigger to have more lanes.' },
  aquarium: { name: 'Aquarium', emoji: '🐠', size: [3, 1, 1], shapes: ['arch', 'ring', 'arc', 'drum'], colour: 'blue',
    holds: 'lots of fish', say: 'An aquarium you can walk through, like a tunnel under the sea.' },
  library: { name: 'Library', emoji: '📚', size: [2, 1, 1], shapes: ['drum', 'house', 'ring', 'tower', 'box', 'arc'], colour: 'purple',
    holds: '20 readers', say: 'A quiet library full of books.' },
  yoga: { name: 'Chill-out room', emoji: '🧘', size: [1, 1, 1], shapes: ['drum', 'tower', 'house', 'ring'], colour: 'lime',
    holds: '10 children', say: 'A calm chill-out room. Put it by the waterfall to hear the water.' },
  lunch: { name: 'Lunch hall', emoji: '🍎', size: [2, 2, 1], shapes: ['saw', 'house', 'box', 'drum', 'ringhouse'], colour: 'orange',
    holds: '60 children', say: 'The lunch hall, where everyone eats together.' },
  art: { name: 'Art room', emoji: '🎨', size: [1, 1, 1], shapes: ['saw', 'house', 'box'], colour: 'pink',
    holds: '20 artists', say: 'An art room. A zigzag roof lets in soft light for painting.' },
  music: { name: 'Music room', emoji: '🎵', size: [1, 1, 1], shapes: ['drum', 'box', 'house', 'tower'], colour: 'red',
    holds: '15 musicians', say: 'A music room for drums and singing.' },
  ringhouse: { name: 'Ring of classrooms', emoji: '🏘️', size: [3, 3, 1], shapes: ['ringhouse', 'ring'], colour: 'yellow',
    holds: '8 classrooms', say: 'A ring of classrooms with pointy roofs, round a garden in the middle.' },
  steps: { name: 'Big steps', emoji: '🪑', size: [2, 2, 1], shapes: ['steps'], colour: 'blue',
    holds: '60 children sitting', say: 'Big steps to sit on, like a theatre outside.' },
  stairs: { name: 'Stairs', emoji: '🪜', size: [1, 1, 2], shapes: ['stairs', 'spiral'], colour: 'teal',
    holds: '', say: 'Stairs, to climb up to the first and second floors. Put them next to a building.' },
  slide: { name: 'Helter-skelter', emoji: '🛝', size: [1, 2, 3], shapes: ['slide'], colour: 'yellow',
    holds: '', say: 'A helter-skelter slide! Climb up the tower and whizz round and round to the bottom.' },
  archway: { name: 'Archway', emoji: '🌈', size: [2, 1, 1], shapes: ['arch'], colour: 'navy',
    holds: '', say: 'An archway to walk under. You can build on top of it.' },
  track: { name: 'Running track', emoji: '🏃', size: [3, 2, 1], shapes: ['track'], colour: 'red',
    holds: '', say: 'A running track. Try it on a roof!' },
  garden: { name: 'Garden', emoji: '🌻', size: [1, 1, 1], shapes: ['garden'], colour: 'lime',
    holds: '', say: 'A garden with flowers and a tree.' },
  tree: { name: 'Tree', emoji: '🌳', size: [1, 1, 1], shapes: ['tree'], colour: 'lime',
    holds: '', say: 'A tree. Dot them all around your school.' },
  turbine: { name: 'Wind turbine', emoji: '🌬️', size: [1, 1, 1], shapes: ['turbine'], colour: 'white',
    holds: '', say: 'A wind turbine makes electricity from the wind.' },
};
// Surfaces Finn can put on the walls.
export const SURFACES = [
  { id: 'plain', name: 'Plain' }, { id: 'climb', name: 'Climbing wall' }, { id: 'green', name: 'Green wall' },
  { id: 'tiles', name: 'Tiles' }, { id: 'pixel', name: 'Pixels' }, { id: 'brick', name: 'Bricks' },
  { id: 'wood', name: 'Wood' }, { id: 'glass', name: 'Glass' }, { id: 'chalk', name: 'Chalkboard' },
];
export const NO_SURFACE = new Set(['pool', 'track', 'garden', 'tree', 'turbine', 'slide', 'rocket', 'greenhouse', 'glassdome', 'glassvault', 'treehouse', 'circle', 'weather', 'observatory', 'bridge', 'canopy', 'terraces', 'ramp', 'swings', 'climbdome', 'roundabout', 'seesaw', 'sandpit', 'playtower', 'zipline']);

PROGRAMMES.rocket = { name: 'Rocket launch pad', emoji: '🚀', size: [2, 2, 1], shapes: ['rocket'], colour: 'red', holds: '', say: 'A rocket on its launch pad! Tap Launch to send it up.' };
PROGRAMMES.observatory = { name: 'Observatory', emoji: '🔭', size: [1, 1, 1], shapes: ['observatory'], colour: 'navy', holds: '10 star-gazers', say: 'An observatory with a big telescope, to look at the stars and planets.' };
PROGRAMMES.greenhouse = { name: 'Greenhouse', emoji: '🌱', size: [2, 1, 1], shapes: ['greenhouse', 'glassdome', 'glassvault'], colour: 'lime', holds: 'lots of plants', say: 'A glass greenhouse, to grow plants and do science experiments.' };
PROGRAMMES.treehouse = { name: 'Treehouse classroom', emoji: '🌳', size: [1, 1, 2], shapes: ['treehouse'], colour: 'orange', holds: '12 children', say: 'A classroom up in a tree! Climb the ladder to get in.' };
PROGRAMMES.stage = { name: 'Stage', emoji: '🎭', size: [2, 1, 1], shapes: ['stage'], colour: 'purple', holds: 'a show', say: 'A stage for shows, plays and talks.' };
PROGRAMMES.maker = { name: 'Maker workshop', emoji: '🛠️', size: [2, 1, 1], shapes: ['saw', 'box', 'vault'], colour: 'orange', holds: '20 makers', say: 'A workshop to build and test inventions, like real engineers.' };
PROGRAMMES.circle = { name: 'Conundrum circle', emoji: '💬', size: [2, 2, 1], shapes: ['circle'], colour: 'blue', holds: '16 thinkers', say: 'A circle to sit in and talk about big questions. There is no right answer!' };
PROGRAMMES.bridge = { name: 'Bridge', emoji: '🌉', size: [1, 3, 1], shapes: ['bridge', 'tube'], colour: 'magenta', holds: '', say: 'A bridge between buildings. Tap on top of a building to start it, then stretch it to the next one.' };
PROGRAMMES.walkway = { name: 'Covered walkway', emoji: '☂️', size: [1, 3, 1], shapes: ['canopy'], colour: 'teal', holds: '', say: 'A covered walkway, to stay dry walking between buildings.' };
PROGRAMMES.playground = { name: 'Playground', emoji: '🎠', size: [1, 1, 1], shapes: ['swings', 'climbdome', 'roundabout', 'seesaw', 'sandpit', 'playtower'], colour: 'yellow', holds: '8 children playing', say: 'Playground things! Tap Shape to choose swings, a climbing dome, a roundabout, a seesaw, a sandpit or a play tower.' };
PROGRAMMES.zipline = { name: 'Zip line', emoji: '🪂', size: [1, 4, 1], shapes: ['zipline'], colour: 'red', holds: '', say: 'A zip line! Hold on tight and whizz from one end to the other.' };
PROGRAMMES.ramp = { name: 'Ramp', emoji: '↗️', size: [1, 3, 1], shapes: ['ramp'], colour: 'lime', holds: '', say: 'A ramp, a gentle slope up onto a roof. Put it next to a building.' };
PROGRAMMES.terraces = { name: 'Tree terraces', emoji: '🌲', size: [3, 3, 1], shapes: ['terraces'], colour: 'orange', holds: '40 children sitting', say: 'Rings of seats round a big tree, for stories and lessons outside.' };
PROGRAMMES.weather = { name: 'Weather station', emoji: '🌦️', size: [1, 1, 1], shapes: ['weather'], colour: 'white', holds: '', say: 'A weather station measures the wind and the rain.' };

export const TRAY = ['classroom', 'hall', 'pool', 'aquarium', 'library', 'yoga', 'lunch', 'art', 'music', 'ringhouse', 'maker', 'greenhouse', 'observatory', 'treehouse', 'stage', 'circle', 'rocket', 'playground', 'zipline', 'terraces', 'steps', 'stairs', 'ramp', 'bridge', 'walkway', 'slide', 'archway', 'track', 'garden', 'tree', 'turbine', 'weather'];
