// Coral Key Heat — shared constants. The world is a 6400x4800 archipelago drawn top-down on a
// 2D canvas: six named keys joined by causeways over open water. Everything tunable lives here
// so the balance of the chase — patrol speed, heat gain, shop prices — can be read at a glance.

export const STEP = 1 / 60;
export const WORLD = { width: 6400, height: 4800 };
export const VIEW = { width: 1280, height: 960 };

/** Player on foot. */
export const WALK = {
  radius: 11,
  walkSpeed: 148,
  sprintSpeed: 238,
  accel: 1500,
  health: 100,
  armorMax: 100,
};

/** Wanted system: heat is a 0..500 pool; each 100 is one star. */
export const HEAT = {
  perStar: 100,
  max: 500,
  witnessCrime: 55,
  shotFired: 14,
  carjack: 70,
  hitPed: 90,
  hitCop: 130,
  missionSpike: 100,
  decayPerSecond: 9,
  decayHiddenPerSecond: 26,
  heliStars: 4,
};

/** The six districts of the archipelago, west to east, south to north. */
export const DISTRICTS = [
  { id: 'coral', name: 'Coral Key', tag: 'Marina town — where every run starts' },
  { id: 'palmetto', name: 'Palmetto Reach', tag: 'Villas, palms and quiet money' },
  { id: 'sable', name: 'Fort Sable', tag: 'The old fort and its warehouses' },
  { id: 'heron', name: 'Heron Flats', tag: 'Night market and tower blocks' },
  { id: 'cove', name: "Smuggler's Cove", tag: 'Boathouses, coves and no questions' },
  { id: 'shallows', name: 'The Shallows', tag: 'Stilt huts over glass-clear water' },
];

/** Palette: sun-bleached pastel over turquoise, warming hard toward golden hour. */
export const COLORS = {
  waterDeep: '#0d5e73',
  waterMid: '#12809a',
  waterShallow: '#35b3b8',
  sand: '#ecd9a8',
  sandWet: '#dfc68d',
  grass: '#79b657',
  grassDry: '#a4bd63',
  scrub: '#5d9153',
  road: '#4a4a52',
  roadEdge: '#f3ead2',
  causeway: '#5b5648',
  rail: '#e8e2d0',
  roofRed: '#c65b4e',
  roofTeal: '#3f8f8a',
  roofCream: '#e6d7b8',
  roofSlate: '#5d6d7e',
  roofTerra: '#d08a4e',
  palmTrunk: '#8a6b45',
  palmLeaf: '#2e8b57',
  ink: '#12212b',
  paper: '#f6efdd',
  gold: '#ffb52e',
  coral: '#ff6b4a',
  police: '#1d3fbf',
  policeLight: '#e33f2f',
};

/** Radio stations the R key cycles through; tracks are named, the synth hums a bass line. */
export const RADIO = [
  { name: 'Reef FM 98.9', tracks: ['Salt in the Wiring — The Causeway Kids', 'Low Tide Lovers — Marisol Vane', 'Cop Lights Disco — DJ Anemone'] },
  { name: 'Cayo Nights 105.3', tracks: ['Midnight Manifest — Ivo & The Manifests', 'Six Keys, No Brakes — Petrol Rosa', 'Heron Flats Lullaby — The Night Clerks'] },
  { name: 'Patrol Band (muted)', tracks: ['— dispatch chatter only —'] },
];

/** Crew members with cooldown abilities (Z / X / C). */
export const CREW = [
  { key: 'Z', name: 'Nia', role: 'CAUSEWAY SCOUT', cooldown: 45, blurb: 'Marks the fastest bridge route and calms the search.' },
  { key: 'X', name: 'Ruy', role: 'QUICK FIX', cooldown: 60, blurb: 'Patches your ride where it stands — 40% hull, no charge.' },
  { key: 'C', name: 'Sef', role: 'EYES OUT', cooldown: 50, blurb: 'Reads the dispatch: patrol routes glow on the minimap.' },
];

/** localStorage keys for the save system. */
export const SAVE_KEY = 'coral-key-heat-save-v1';
export const BEST_KEY = 'coral-key-heat-best-v1';
