// World generation: six coral keys as unions of land blobs, a road graph of ring roads, spokes
// and long causeways, and everything that stands on the land — buildings, shops, palms, docks,
// boats and beach shells. Generation is fully seeded: the same seed always grows the same city,
// and the helpers below (isLand, isOnRoad, districtAt) are the only geography the rest of the
// game ever asks about.

import { COLORS, DISTRICTS, WORLD } from './config.js';
import { clamp, dist, distToSegment } from './rng.js';

/** Island shapes: each district is a set of overlapping circles (land blobs). */
const ISLAND_SHAPES = {
  coral: [
    { x: 900, y: 3650, r: 470 },
    { x: 1240, y: 3450, r: 330 },
    { x: 620, y: 3380, r: 300 },
    { x: 980, y: 3980, r: 300 },
  ],
  palmetto: [
    { x: 1150, y: 1750, r: 430 },
    { x: 820, y: 1500, r: 300 },
    { x: 1480, y: 1980, r: 290 },
    { x: 1250, y: 2120, r: 260 },
  ],
  sable: [
    { x: 3050, y: 1100, r: 460 },
    { x: 2680, y: 920, r: 300 },
    { x: 3420, y: 1240, r: 300 },
    { x: 3080, y: 760, r: 260 },
  ],
  heron: [
    { x: 5100, y: 1450, r: 470 },
    { x: 4720, y: 1250, r: 300 },
    { x: 5480, y: 1650, r: 310 },
    { x: 5180, y: 1080, r: 270 },
  ],
  cove: [
    { x: 4950, y: 3550, r: 450 },
    { x: 5320, y: 3350, r: 300 },
    { x: 4620, y: 3820, r: 290 },
    { x: 5050, y: 3920, r: 270 },
  ],
  shallows: [
    { x: 3200, y: 3200, r: 380 },
    { x: 2880, y: 3450, r: 260 },
    { x: 3560, y: 3050, r: 250 },
    { x: 3250, y: 2820, r: 220 },
  ],
};

/** Causeway links between districts: [fromId, toId]. */
const CAUSEWAYS = [
  ['coral', 'palmetto'],
  ['coral', 'shallows'],
  ['palmetto', 'sable'],
  ['sable', 'heron'],
  ['sable', 'shallows'],
  ['shallows', 'cove'],
  ['heron', 'cove'],
];

/** Named shops: two per district, each with a trade the economy understands. */
const SHOP_DEFS = [
  { district: 'coral', name: 'Marina Chandlery', trade: 'armor', sign: 'ARMOR' },
  { district: 'coral', name: 'Café Concha', trade: 'food', sign: 'CAFÉ' },
  { district: 'palmetto', name: 'Palm & Powder', trade: 'ammo', sign: 'AMMO' },
  { district: 'palmetto', name: 'Villa Verde Deli', trade: 'food', sign: 'DELI' },
  { district: 'sable', name: 'Fort Salvage Co.', trade: 'pawn', sign: 'PAWN' },
  { district: 'sable', name: 'Sable Auto Works', trade: 'repair', sign: 'AUTO' },
  { district: 'heron', name: 'Night Market Arms', trade: 'weapons', sign: 'ARMS' },
  { district: 'heron', name: 'Heron Noodle Bar', trade: 'food', sign: 'FOOD' },
  { district: 'cove', name: 'No Questions Pawn', trade: 'pawn', sign: 'PAWN' },
  { district: 'cove', name: 'Cove Fuel & Fix', trade: 'repair', sign: 'AUTO' },
  { district: 'shallows', name: 'Stilt Hut Sundries', trade: 'armor', sign: 'GEAR' },
  { district: 'shallows', name: 'The Salty Conch', trade: 'food', sign: 'CAFÉ' },
];

const BUILDING_STYLES = [
  { type: 'house', roofs: [COLORS.roofTerra, COLORS.roofCream, COLORS.roofRed], wall: '#efe3c8' },
  { type: 'villa', roofs: [COLORS.roofRed, COLORS.roofTerra], wall: '#f4e9d2' },
  { type: 'warehouse', roofs: [COLORS.roofSlate, COLORS.roofTeal], wall: '#b9c0b8' },
  { type: 'hotel', roofs: [COLORS.roofCream, COLORS.roofTeal], wall: '#f7efdc' },
  { type: 'boathouse', roofs: [COLORS.roofTeal, COLORS.roofSlate], wall: '#a8bfae' },
  { type: 'hut', roofs: [COLORS.roofTerra, COLORS.roofCream], wall: '#d9c491' },
  { type: 'market', roofs: [COLORS.roofRed, COLORS.roofGold || '#ffb52e'], wall: '#e8d9b0' },
];

export function buildCity(rng) {
  const islands = DISTRICTS.map((d) => ({
    ...d,
    blobs: ISLAND_SHAPES[d.id].map((b) => ({ ...b })),
    cx: ISLAND_SHAPES[d.id][0].x,
    cy: ISLAND_SHAPES[d.id][0].y,
  }));
  const byId = {};
  for (const island of islands) byId[island.id] = island;

  // --- Geography helpers -------------------------------------------------
  function isLand(x, y) {
    for (const island of islands) {
      for (const b of island.blobs) {
        const dx = x - b.x;
        const dy = y - b.y;
        if (dx * dx + dy * dy < b.r * b.r) return true;
      }
    }
    return false;
  }
  /** Signed shore distance: negative in the water, positive inland (approx, per blob). */
  function shoreDepth(x, y) {
    let best = -Infinity;
    for (const island of islands) {
      for (const b of island.blobs) {
        const d = b.r - dist(x, y, b.x, b.y);
        if (d > best) best = d;
      }
    }
    return best;
  }
  function districtAt(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const island of islands) {
      const d = dist(x, y, island.cx, island.cy);
      if (d < bestD) {
        bestD = d;
        best = island;
      }
    }
    return best;
  }

  // --- Road graph ----------------------------------------------------------
  const nodes = [];
  const edges = [];
  function addNode(x, y, district) {
    nodes.push({ x, y, district, edges: [] });
    return nodes.length - 1;
  }
  function addEdge(a, b, kind, width) {
    const idx = edges.length;
    edges.push({ a, b, kind, width: width || (kind === 'causeway' ? 30 : 24) });
    nodes[a].edges.push(idx);
    nodes[b].edges.push(idx);
    return idx;
  }

  const hubs = {};
  const ringNodes = {};
  for (const island of islands) {
    const hub = addNode(island.cx, island.cy, island.id);
    hubs[island.id] = hub;
    const ring = [];
    const ringR = Math.min(...island.blobs.map((b) => b.r)) * 0.58;
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + 0.39;
      ring.push(addNode(island.cx + Math.cos(a) * ringR, island.cy + Math.sin(a) * ringR, island.id));
    }
    for (let i = 0; i < 8; i += 1) addEdge(ring[i], ring[(i + 1) % 8], 'street');
    for (let i = 0; i < 8; i += 2) addEdge(hub, ring[i], 'street');
    ringNodes[island.id] = ring;
  }
  // Causeways: hub to hub with two mid-water nodes so the bridge reads as a journey.
  for (const [fromId, toId] of CAUSEWAYS) {
    const a = nodes[hubs[fromId]];
    const b = nodes[hubs[toId]];
    const m1 = addNode(a.x + (b.x - a.x) * 0.36, a.y + (b.y - a.y) * 0.36, 'water');
    const m2 = addNode(a.x + (b.x - a.x) * 0.68, a.y + (b.y - a.y) * 0.68, 'water');
    addEdge(hubs[fromId], m1, 'causeway');
    addEdge(m1, m2, 'causeway');
    addEdge(m2, hubs[toId], 'causeway');
  }

  function nearestNode(x, y) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < nodes.length; i += 1) {
      const d = dist(x, y, nodes[i].x, nodes[i].y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }
  /** BFS route between graph nodes; returns a list of node indices including both ends. */
  function route(fromIdx, toIdx) {
    if (fromIdx === toIdx) return [fromIdx];
    const prev = new Array(nodes.length).fill(-1);
    const queue = [fromIdx];
    prev[fromIdx] = fromIdx;
    while (queue.length) {
      const cur = queue.shift();
      if (cur === toIdx) break;
      for (const eIdx of nodes[cur].edges) {
        const e = edges[eIdx];
        const nxt = e.a === cur ? e.b : e.a;
        if (prev[nxt] === -1) {
          prev[nxt] = cur;
          queue.push(nxt);
        }
      }
    }
    if (prev[toIdx] === -1) return [fromIdx];
    const path = [toIdx];
    let cur = toIdx;
    while (cur !== fromIdx) {
      cur = prev[cur];
      path.push(cur);
    }
    return path.reverse();
  }
  function isOnRoad(x, y, margin) {
    const m = margin || 0;
    for (const e of edges) {
      const a = nodes[e.a];
      const b = nodes[e.b];
      if (distToSegment(x, y, a.x, a.y, b.x, b.y) < e.width / 2 + m) return true;
    }
    return false;
  }
  function nearestRoadPoint(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const e of edges) {
      const a = nodes[e.a];
      const b = nodes[e.b];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lenSq = dx * dx + dy * dy || 1;
      let t = ((x - a.x) * dx + (y - a.y) * dy) / lenSq;
      t = clamp(t, 0, 1);
      const px = a.x + dx * t;
      const py = a.y + dy * t;
      const d = dist(x, y, px, py);
      if (d < bestD) {
        bestD = d;
        best = { x: px, y: py, edge: e };
      }
    }
    return best;
  }

  // --- Buildings -------------------------------------------------------------
  const buildings = [];
  const shops = [];
  for (const island of islands) {
    const wanted = island.id === 'heron' ? 34 : island.id === 'sable' ? 28 : 24;
    let placed = 0;
    let guard = 0;
    while (placed < wanted && guard < 900) {
      guard += 1;
      const blob = rng.pick(island.blobs);
      const a = rng.range(0, Math.PI * 2);
      const rr = Math.sqrt(rng.next()) * blob.r * 0.86;
      const x = blob.x + Math.cos(a) * rr;
      const y = blob.y + Math.sin(a) * rr;
      if (!isLand(x, y) || shoreDepth(x, y) < 42) continue;
      if (isOnRoad(x, y, 40)) continue;
      let clear = true;
      for (const other of buildings) {
        if (dist(x, y, other.x, other.y) < 96) {
          clear = false;
          break;
        }
      }
      if (!clear) continue;
      const style = rng.pick(BUILDING_STYLES);
      const w = rng.range(48, 96);
      const h = rng.range(40, 84);
      const building = {
        x, y, w, h,
        type: style.type,
        wall: style.wall,
        roof: rng.pick(style.roofs),
        district: island.id,
        floors: style.type === 'hotel' ? rng.int(3, 5) : style.type === 'market' ? 1 : rng.int(1, 2),
        seed: rng.int(1, 100000),
        shop: null,
      };
      buildings.push(building);
      placed += 1;
    }
  }
  // Promote two buildings per district into named shops, near the hub so they are findable.
  for (const def of SHOP_DEFS) {
    const island = byId[def.district];
    let best = null;
    let bestD = Infinity;
    for (const b of buildings) {
      if (b.district !== def.district || b.shop) continue;
      const d = dist(b.x, b.y, island.cx, island.cy);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    if (best) {
      best.shop = { name: def.name, trade: def.trade, sign: def.sign };
      best.type = 'shop';
      shops.push(best);
    }
  }

  // --- Vegetation and props ---------------------------------------------------
  const palms = [];
  let palmGuard = 0;
  while (palms.length < 420 && palmGuard < 6000) {
    palmGuard += 1;
    const island = rng.pick(islands);
    const blob = rng.pick(island.blobs);
    const a = rng.range(0, Math.PI * 2);
    const rr = Math.sqrt(rng.next()) * blob.r;
    const x = blob.x + Math.cos(a) * rr;
    const y = blob.y + Math.sin(a) * rr;
    if (!isLand(x, y)) continue;
    const depth = shoreDepth(x, y);
    if (depth > 190 && rng.chance(0.75)) continue; // palms hug the shore
    if (isOnRoad(x, y, 10)) continue;
    let inBuilding = false;
    for (const b of buildings) {
      if (Math.abs(x - b.x) < b.w / 2 + 12 && Math.abs(y - b.y) < b.h / 2 + 12) {
        inBuilding = true;
        break;
      }
    }
    if (inBuilding) continue;
    palms.push({ x, y, s: rng.range(0.75, 1.35), lean: rng.range(-0.16, 0.16), seed: rng.int(1, 99999) });
  }

  const props = [];
  for (const b of buildings) {
    if (b.type === 'warehouse' || b.type === 'boathouse') {
      const n = rng.int(2, 5);
      for (let i = 0; i < n; i += 1) {
        props.push({
          kind: rng.chance(0.6) ? 'crate' : 'barrel',
          x: b.x + rng.range(-b.w / 2 - 22, b.w / 2 + 22),
          y: b.y + b.h / 2 + rng.range(6, 26),
          seed: rng.int(1, 9999),
        });
      }
    }
  }
  // Buoys marking the causeway channels.
  for (const e of edges) {
    if (e.kind !== 'causeway') continue;
    const a = nodes[e.a];
    const b = nodes[e.b];
    const len = dist(a.x, a.y, b.x, b.y);
    const steps = Math.floor(len / 150);
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const side = i % 2 === 0 ? 1 : -1;
      const nx = -(b.y - a.y) / (len || 1);
      const ny = (b.x - a.x) / (len || 1);
      props.push({ kind: 'buoy', x: a.x + (b.x - a.x) * t + nx * 34 * side, y: a.y + (b.y - a.y) * t + ny * 34 * side, seed: i * 7 });
    }
  }
  // Lighthouses on the two exposed points.
  props.push({ kind: 'lighthouse', x: 470, y: 3760, seed: 1 });
  props.push({ kind: 'lighthouse', x: 3560, y: 2720, seed: 2 });

  // Marina piers: timber decks reaching into the water at each marina, post by post.
  const MARINA_POINTS = [
    { x: 700, y: 3980 }, { x: 1180, y: 3960 }, { x: 4680, y: 3980 }, { x: 3060, y: 3560 },
  ];
  for (const marina of MARINA_POINTS) {
    // Reach from the beach toward deeper water (away from the island's heart).
    const island = districtAt(marina.x, marina.y);
    let dx = marina.x - island.cx;
    let dy = marina.y - island.cy;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    for (let i = 0; i < 4; i += 1) {
      props.push({
        kind: 'pier',
        x: marina.x + dx * i * 34,
        y: marina.y + dy * i * 34,
        angle: Math.atan2(dy, dx),
        seed: i,
      });
    }
  }
  // Causeway streetlights: a post every so often along the bridges, lit at golden hour.
  for (const e of edges) {
    if (e.kind !== 'causeway') continue;
    const a = nodes[e.a];
    const b = nodes[e.b];
    const len = dist(a.x, a.y, b.x, b.y);
    const steps = Math.floor(len / 210);
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const side = i % 2 === 0 ? 1 : -1;
      const nx = (-(b.y - a.y) / (len || 1)) * (e.width / 2 + 7) * side;
      const ny = ((b.x - a.x) / (len || 1)) * (e.width / 2 + 7) * side;
      props.push({ kind: 'lamp', x: a.x + (b.x - a.x) * t + nx, y: a.y + (b.y - a.y) * t + ny, seed: i * 13 });
    }
  }

  // --- Boats at the marinas -----------------------------------------------------
  const boats = [];
  const MARINAS = [
    { x: 700, y: 3980, district: 'coral' },
    { x: 1180, y: 3960, district: 'coral' },
    { x: 4680, y: 3980, district: 'cove' },
    { x: 3060, y: 3560, district: 'shallows' },
  ];
  for (const marina of MARINAS) {
    for (let i = 0; i < 5; i += 1) {
      boats.push({
        x: marina.x + rng.range(-120, 120),
        y: marina.y + rng.range(-46, 46),
        angle: rng.range(0, Math.PI * 2),
        hue: rng.pick(['#e8e2d0', '#c65b4e', '#3f8f8a', '#e9b44c', '#5d6d7e']),
        size: rng.range(0.8, 1.3),
        district: marina.district,
      });
    }
  }

  // Beach umbrellas and sunbeds along the hotel and marina shores.
  let umbrellaGuard = 0;
  while (props.filter((p) => p.kind === 'umbrella').length < 26 && umbrellaGuard < 3000) {
    umbrellaGuard += 1;
    const island = rng.pick(islands);
    const blob = rng.pick(island.blobs);
    const a = rng.range(0, Math.PI * 2);
    const x = blob.x + Math.cos(a) * blob.r * rng.range(0.84, 0.95);
    const y = blob.y + Math.sin(a) * blob.r * rng.range(0.84, 0.95);
    const depth = shoreDepth(x, y);
    if (depth < 6 || depth > 46) continue;
    if (isOnRoad(x, y, 6)) continue;
    props.push({ kind: 'umbrella', x, y, seed: rng.int(1, 9999), hue: rng.pick(['#e2725b', '#ffd83d', '#3f8f8a', '#e8e2d0', '#5b8dd9']) });
    if (rng.chance(0.7)) {
      props.push({ kind: 'sunbed', x: x + rng.range(-16, 16), y: y + rng.range(8, 18), seed: rng.int(1, 9999) });
    }
  }

  // --- Collectible conch shells on the beaches -----------------------------------
  const shells = [];
  let shellGuard = 0;
  while (shells.length < 24 && shellGuard < 4000) {
    shellGuard += 1;
    const island = rng.pick(islands);
    const blob = rng.pick(island.blobs);
    const a = rng.range(0, Math.PI * 2);
    const x = blob.x + Math.cos(a) * blob.r * rng.range(0.86, 0.97);
    const y = blob.y + Math.sin(a) * blob.r * rng.range(0.86, 0.97);
    const depth = shoreDepth(x, y);
    if (depth < 4 || depth > 40) continue;
    if (isOnRoad(x, y, 4)) continue;
    shells.push({ x, y, taken: false, seed: rng.int(1, 9999) });
  }

  return {
    islands, nodes, edges, buildings, shops, palms, props, boats, shells,
    hubs, isLand, shoreDepth, districtAt, nearestNode, route, isOnRoad, nearestRoadPoint,
    worldW: WORLD.width,
    worldH: WORLD.height,
  };
}
