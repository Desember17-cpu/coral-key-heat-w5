// The Key Patrol: named units with callsigns and roles, a dispatch brain that spends the
// wanted level on interceptors, roadblocks and — at four stars — HERON AIR, the helicopter
// whose spotlight makes hiding almost impossible. Units think in last-known positions: break
// sight long enough and the hunt degrades from IN SIGHT to SEARCHING, heat drains faster, and
// a clean minute ends it.

import { HEAT } from './config.js';
import { clamp, dist, turnToward } from './rng.js';
import { createCar, stepCar } from './vehicles.js';

export const UNIT_DEFS = [
  { callsign: 'REEF-1', role: 'PURSUIT' },
  { callsign: 'CAYO-3', role: 'ROADBLOCK' },
  { callsign: 'REEF-2', role: 'RAMMING' },
  { callsign: 'HERON-4', role: 'PURSUIT' },
  { callsign: 'PALM-5', role: 'SPOTLIGHT' },
  { callsign: 'TIDE-6', role: 'ROADBLOCK' },
  { callsign: 'CONCH-7', role: 'PURSUIT' },
  { callsign: 'SABLE-8', role: 'RAMMING' },
];

/** How many units each star level fields. */
const UNITS_BY_STARS = [0, 1, 2, 3, 4, 6];
const SIGHT_RANGE = 540;
const HELI_SIGHT_RANGE = 820;

export function createDispatch() {
  return {
    heat: 0,
    stars: 0,
    sight: 'CLEAR', // CLEAR | IN SIGHT | SEARCHING
    lastKnown: null,
    sinceSeen: 0,
    units: [],
    heli: null,
    totalArrests: 0,
    longestChase: 0,
    chaseTime: 0,
    nextDef: 0,
  };
}

export function addHeat(dispatch, amount, feed) {
  const before = dispatch.stars;
  dispatch.heat = clamp(dispatch.heat + amount, 0, HEAT.max);
  dispatch.stars = Math.floor(dispatch.heat / HEAT.perStar);
  if (dispatch.stars > before && feed) {
    feed.push({ text: `WANTED LEVEL ${dispatch.stars} — patrol is rolling`, kind: 'heat' });
  }
  return dispatch.stars > before;
}

function spawnUnit(dispatch, city, rng, player) {
  const def = UNIT_DEFS[dispatch.nextDef % UNIT_DEFS.length];
  dispatch.nextDef += 1;
  // Spawn on a road node a fair distance away, never on top of the player.
  let node = null;
  for (let tries = 0; tries < 24; tries += 1) {
    const cand = city.nodes[rng.int(0, city.nodes.length - 1)];
    const d = dist(cand.x, cand.y, player.x, player.y);
    if (d > 620 && d < 1500 && cand.district !== 'water') {
      node = cand;
      break;
    }
    node = cand;
  }
  const car = createCar('patrol', node.x, node.y, rng.range(0, Math.PI * 2), null, rng);
  car.driver = 'police';
  return {
    def,
    car,
    mode: 'pursuit',
    target: { x: player.x, y: player.y },
    searchNode: null,
    searchWait: 0,
    blockSet: false,
    ramCooldown: 0,
  };
}

function spawnHeli(player) {
  return {
    x: player.x + 420,
    y: player.y - 380,
    angle: 0,
    rotor: 0,
    searchlight: true,
    callsign: 'HERON AIR',
    role: 'AIR SUPPORT',
  };
}

/** Steer a unit's car toward a world point at a throttle fraction; returns the control. */
function driveToward(car, tx, ty, throttleWanted, dt) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  let delta = ((want - car.angle) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  const steer = clamp(delta * 1.7, -1, 1);
  let throttle = throttleWanted;
  if (Math.abs(delta) > 2.4) throttle = -0.5; // three-point turn
  else if (Math.abs(delta) > 0.9) throttle *= 0.5;
  return { throttle, steer, brake: false };
}

function unitControl(unit, dt, ctx) {
  const { player, city, dispatch } = ctx;
  const car = unit.car;
  if (car.wrecked) return { throttle: 0, steer: 0, brake: true };
  const dPlayer = dist(car.x, car.y, player.x, player.y);
  unit.ramCooldown = Math.max(0, unit.ramCooldown - dt);

  if (unit.mode === 'leave') {
    const away = city.nodes[city.nearestNode(car.x, car.y)];
    return driveToward(car, away.x + (car.x - player.x), away.y + (car.y - player.y), 0.7, dt);
  }

  if (unit.def.role === 'ROADBLOCK' && dispatch.sight === 'IN SIGHT') {
    // Get ahead of the player's line of travel and park across it.
    const lead = 3.2;
    const px = player.x + (player.vx || 0) * lead;
    const py = player.y + (player.vy || 0) * lead;
    const near = city.nearestRoadPoint(px, py);
    unit.target = { x: near.x, y: near.y };
    const d = dist(car.x, car.y, unit.target.x, unit.target.y);
    if (d > 60) {
      unit.blockSet = false;
      return driveToward(car, unit.target.x, unit.target.y, 0.95, dt);
    }
    // Set the block: nose perpendicular to the player's heading, engine off.
    unit.blockSet = true;
    const want = (player.angle || 0) + Math.PI / 2;
    let delta = ((want - car.angle) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    if (Math.abs(delta) > 0.12 && dPlayer < 700) {
      return { throttle: 0, steer: clamp(delta * 2, -1, 1), brake: false };
    }
    return { throttle: 0, steer: 0, brake: true };
  }

  if (dispatch.sight === 'SEARCHING' || dispatch.sight === 'CLEAR') {
    // Hunt the last-known position, then quarter the nearby road graph.
    if (!unit.searchNode || dist(car.x, car.y, unit.searchNode.x, unit.searchNode.y) < 60) {
      if (unit.searchWait > 0) {
        unit.searchWait -= dt;
        return { throttle: 0, steer: 0, brake: true };
      }
      const base = dispatch.lastKnown || player;
      const nearIdx = city.nearestNode(base.x, base.y);
      const options = [nearIdx];
      for (const eIdx of city.nodes[nearIdx].edges) {
        const e = city.edges[eIdx];
        options.push(e.a === nearIdx ? e.b : e.a);
      }
      const pickIdx = options[Math.floor((ctx.rng ? ctx.rng.next() : 0.5) * options.length)];
      unit.searchNode = city.nodes[pickIdx];
      unit.searchWait = 1.6;
    }
    return driveToward(car, unit.searchNode.x, unit.searchNode.y, 0.62, dt);
  }

  // IN SIGHT and not a roadblock: pursuit family.
  const predict = unit.def.role === 'SPOTLIGHT' ? 0.4 : 1.1;
  const tx = player.x + (player.vx || 0) * predict;
  const ty = player.y + (player.vy || 0) * predict;
  if (unit.def.role === 'SPOTLIGHT') {
    // Trail at 190px: close enough to hold the light, too far to ram.
    if (dPlayer < 150) return driveToward(car, car.x - (player.x - car.x), car.y - (player.y - car.y), 0.4, dt);
    if (dPlayer > 260) return driveToward(car, tx, ty, 0.9, dt);
    return driveToward(car, tx, ty, 0.45, dt);
  }
  if (unit.def.role === 'RAMMING' && dPlayer < 120 && unit.ramCooldown <= 0) {
    unit.ramCooldown = 1.4;
    return { throttle: 1, steer: clamp((((Math.atan2(player.y - car.y, player.x - car.x) - car.angle) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI) * 2, -1, 1), brake: false };
  }
  return driveToward(car, tx, ty, dPlayer > 300 ? 1 : 0.82, dt);
}

/**
 * Advance the whole dispatch: heat, sight, spawning, unit driving, the helicopter and bust
 * checks. `ctx` = { player:{x,y,vx,vy,angle,inCar}, city, rng, feed, audio }.
 * Returns events: {kind:'busted'} when a unit holds the player pinned.
 */
export function stepDispatch(dispatch, dt, ctx, events) {
  const { player, city, rng, feed } = ctx;
  const out = events || [];

  // Sight: any unit or the helicopter with eyes on the player.
  let seen = false;
  for (const unit of dispatch.units) {
    if (!unit.car.wrecked && dist(unit.car.x, unit.car.y, player.x, player.y) < SIGHT_RANGE) seen = true;
  }
  if (dispatch.heli && dist(dispatch.heli.x, dispatch.heli.y, player.x, player.y) < HELI_SIGHT_RANGE) seen = true;

  if (dispatch.stars > 0) {
    if (seen) {
      if (dispatch.sight !== 'IN SIGHT' && feed) feed.push({ text: 'DISPATCH: patrol has eyes on you', kind: 'dispatch' });
      dispatch.sight = 'IN SIGHT';
      dispatch.lastKnown = { x: player.x, y: player.y };
      dispatch.sinceSeen = 0;
      dispatch.chaseTime += dt;
    } else {
      dispatch.sinceSeen += dt;
      if (dispatch.sight === 'IN SIGHT' && feed) feed.push({ text: 'DISPATCH: contact lost — units are searching', kind: 'dispatch' });
      if (dispatch.sight !== 'CLEAR') dispatch.sight = 'SEARCHING';
      dispatch.heat -= (dispatch.sinceSeen > 1 ? HEAT.decayHiddenPerSecond : HEAT.decayPerSecond) * dt;
      if (dispatch.heat <= 0) {
        dispatch.heat = 0;
        dispatch.sight = 'CLEAR';
        dispatch.lastKnown = null;
        dispatch.longestChase = Math.max(dispatch.longestChase, dispatch.chaseTime);
        dispatch.chaseTime = 0;
        if (feed) feed.push({ text: 'You lost the patrol. Heat is gone.', kind: 'good' });
      }
    }
  }
  dispatch.stars = Math.floor(dispatch.heat / HEAT.perStar);

  // Field the right number of units for the level.
  const wanted = UNITS_BY_STARS[dispatch.stars] || 0;
  if (dispatch.units.length < wanted) {
    const unit = spawnUnit(dispatch, city, rng, player);
    dispatch.units.push(unit);
    if (feed) feed.push({ text: `DISPATCH: ${unit.def.callsign} (${unit.def.role}) joining the hunt`, kind: 'dispatch' });
  } else if (dispatch.units.length > wanted) {
    const unit = dispatch.units[dispatch.units.length - 1];
    if (dispatch.stars === 0) {
      dispatch.units.pop();
    } else {
      unit.mode = 'leave';
      if (dist(unit.car.x, unit.car.y, player.x, player.y) > 1100) dispatch.units.pop();
    }
  }
  if (dispatch.stars >= HEAT.heliStars && !dispatch.heli) {
    dispatch.heli = spawnHeli(player);
    if (feed) feed.push({ text: 'DISPATCH: HERON AIR is overhead — spotlight up', kind: 'dispatch' });
  } else if (dispatch.stars < HEAT.heliStars && dispatch.heli) {
    dispatch.heli = null;
    if (feed) feed.push({ text: 'DISPATCH: HERON AIR is standing down', kind: 'dispatch' });
  }

  // Drive the units.
  for (const unit of dispatch.units) {
    const control = unitControl(unit, dt, ctx);
    stepCar(unit.car, control, dt, city, out);
  }

  // Helicopter: hovers off the player's shoulder, drifting in a slow search ellipse.
  if (dispatch.heli) {
    const heli = dispatch.heli;
    heli.rotor += dt * 41;
    const anchor = dispatch.sight === 'IN SIGHT' || !dispatch.lastKnown ? player : dispatch.lastKnown;
    const tx = anchor.x + Math.cos(heli.rotor * 0.11) * 150;
    const ty = anchor.y + Math.sin(heli.rotor * 0.13) * 130 - 60;
    heli.angle = turnToward(heli.angle, Math.atan2(anchor.y - heli.y, anchor.x - heli.x), 2.2 * dt);
    heli.x += clamp(tx - heli.x, -260 * dt, 260 * dt);
    heli.y += clamp(ty - heli.y, -260 * dt, 260 * dt);
  }

  // Bust check: a slow or stopped player with a unit on top of them is arrested.
  if (dispatch.stars > 0 && dispatch.sight === 'IN SIGHT') {
    const playerSpeed = Math.hypot(player.vx || 0, player.vy || 0);
    if (playerSpeed < 26) {
      for (const unit of dispatch.units) {
        if (dist(unit.car.x, unit.car.y, player.x, player.y) < 64) {
          dispatch.bustTime = (dispatch.bustTime || 0) + dt;
          if (dispatch.bustTime > 1.6) {
            dispatch.bustTime = 0;
            dispatch.totalArrests += 1;
            out.push({ kind: 'busted', by: unit.def.callsign });
          }
          break;
        }
      }
    } else {
      dispatch.bustTime = 0;
    }
  }
  return out;
}

/** One-line-per-unit rows for the dispatch HUD panel. */
export function dispatchRows(dispatch, player) {
  const rows = dispatch.units.map((unit) => ({
    callsign: unit.def.callsign,
    role: unit.def.role,
    dist: Math.round(dist(unit.car.x, unit.car.y, player.x, player.y)),
    state: unit.car.wrecked ? 'WRECKED' : dispatch.sight,
  }));
  if (dispatch.heli) {
    rows.push({
      callsign: dispatch.heli.callsign,
      role: dispatch.heli.role,
      dist: Math.round(dist(dispatch.heli.x, dispatch.heli.y, player.x, player.y)),
      state: dispatch.sight,
    });
  }
  return rows;
}
