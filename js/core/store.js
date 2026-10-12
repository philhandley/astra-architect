// Persistent store in localStorage. Everything degrades gracefully if storage is blocked.
const KEY = 'astraarch.v1';

export const DEFAULT_PUPILS = () => [
  { name: 'Finn', model: 'male-b', colour: '#2f6fe4', strip: [] },
  { name: 'Ava', model: 'female-a', colour: '#e4572e', strip: [] },
  { name: 'Leo', model: 'male-c', colour: '#17a398', strip: [] },
  { name: 'Mia', model: 'female-c', colour: '#9b5de5', strip: [] },
  { name: 'Sam', model: 'male-e', colour: '#f2a541', strip: [] },
  { name: 'Isla', model: 'female-e', colour: '#e05297', strip: [] },
  { name: 'Noah', model: 'male-d', colour: '#4c9f38', strip: [] },
  { name: 'Ruby', model: 'female-b', colour: '#d1495b', strip: [] },
];

export const DEFAULT_BELLS = () => ['learn', 'swim', 'eat', 'yoga', 'run', 'look'];
export const DEFAULT_BRIEF = () => ['yoga-waterfall', 'sea-classroom', 'pool', 'arch-aquarium', 'roof-track'];

export const emptyDesign = () => ({ name: "Finn's Dream School", cells: [], sun: 0.32, nextId: 1 });

const DEFAULTS = () => ({
  crew: null,              // { architect, client }
  patches: {},
  stars: 0,
  log: [],
  sound: true,
  autoRead: true,
  done: {},                // mission id -> time
  design: emptyDesign(),
  slots: [],               // saved copies: { name, t, design }
  brief: DEFAULT_BRIEF(),
  pupils: DEFAULT_PUPILS(),
  bells: DEFAULT_BELLS(),
  days: 0,
  sheets: [],              // drawing sheet history: { t, sentence }
  mod: {},
});

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = { ...DEFAULTS(), ...JSON.parse(raw) };
      if (!s.design || !Array.isArray(s.design.cells)) s.design = emptyDesign();
      return s;
    }
  } catch (e) { /* ignore */ }
  return DEFAULTS();
}

let state = read();
let timer = 0;

function write() {
  clearTimeout(timer);
  timer = setTimeout(flush, 120);
}
function flush() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}
window.addEventListener('pagehide', flush);

export const store = {
  get state() { return state; },
  set(patch) { Object.assign(state, patch); write(); },
  save() { write(); },
  flush,
  addLog(mission, text) {
    state.log.push({ t: Date.now(), m: mission || '', text: String(text) });
    if (state.log.length > 600) state.log.splice(0, state.log.length - 600);
    write();
  },
  earnPatch(id) {
    if (state.patches[id]) return false;
    state.patches[id] = Date.now();
    write();
    return true;
  },
  addStar() { state.stars = (state.stars || 0) + 1; write(); },
  modSave(mod, k, v) { (state.mod[mod] ||= {})[k] = v; write(); },
  modLoad(mod, k) { return state.mod?.[mod]?.[k] ?? null; },
  reset() { const crew = state.crew; state = DEFAULTS(); state.crew = crew; flush(); },
};
