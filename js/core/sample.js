// A sample school like Finn's table model, for testing (?devdesign) and for the drawing sheet demo.
const cells = [
  // Aquarium: a ring of four curves with a courtyard in the middle.
  { form: 'curve', room: 'aquarium', x: 10, z: 22, level: 0, rot: 0 },
  { form: 'curve', room: 'aquarium', x: 8, z: 22, level: 0, rot: 1 },
  { form: 'curve', room: 'aquarium', x: 8, z: 20, level: 0, rot: 2 },
  { form: 'curve', room: 'aquarium', x: 10, z: 20, level: 0, rot: 3 },
  // Hall, pool and changing room.
  { form: 'long', room: 'hall', x: 13, z: 24, level: 0, rot: 1 },
  { form: 'slab', room: 'pool', x: 15, z: 24, level: 0, rot: 1 },
  { form: 'cube', room: 'changing', x: 16, z: 24, level: 0, rot: 0 },
  { form: 'cube', room: 'lunch', x: 13, z: 26, level: 0, rot: 0 },
  // Classrooms facing the sea, with a running track on the roof and stairs up.
  { form: 'long', room: 'classroom', x: 27, z: 30, level: 0, rot: 0 },
  { form: 'long', room: 'classroom', x: 27, z: 31, level: 0, rot: 0 },
  { form: 'long', room: 'classroom', x: 27, z: 32, level: 0, rot: 0 },
  { form: 'long', room: 'classroom', x: 27, z: 33, level: 0, rot: 0 },
  { form: 'steps', room: 'stairs', x: 26, z: 31, level: 0, rot: 0 },
  { form: 'cube', room: 'library', x: 24, z: 30, level: 0, rot: 0 },
  { form: 'pad', room: 'garden', x: 24, z: 33, level: 0, rot: 0 },
  ...[[27, 30], [28, 30], [27, 31], [28, 31], [27, 32], [28, 32], [27, 33], [28, 33]].map(([x, z]) => ({ form: 'pad', room: 'track', x, z, level: 1, rot: 0 })),
  { form: 'wedge', room: 'slide', x: 27, z: 34, level: 0, rot: 3 },
  // Chill-out room by the waterfall.
  { form: 'cylinder', room: 'yoga', x: 33, z: 16, level: 0, rot: 0 },
];

export const SAMPLE = { name: "Finn's Dream School", sun: 0.32, cells: cells.map((c, i) => ({ id: i + 1, material: 'colour', ...c })), nextId: cells.length + 1 };
