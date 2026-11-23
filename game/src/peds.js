// Pedestrians: named citizens who stroll the pavements, flee from gunfire and crashes, and —
// the important part — phone the Key Patrol when they see a crime. A witness needs line of
// sight and a few seconds with their phone up; break the sightline and the call dies. That
// single rule is what makes the wanted system's SEARCHING state fair.

import { clamp, dist, turnToward } from './rng.js';

export const PED_NAMES = [
  'Marisol Vane', 'Old Tomas', 'Priya Nair', 'Captain Ivo', 'Little June', 'Marco Reyes',
  'Auntie Bea', 'Felix Grant', 'Sana Iqbal', 'Rosa Delgado', 'Kenji Mori', 'Petra Lindqvist',
  'Hugo Ferreira', 'Nia Okafor', 'Sal Marchetti', 'Greta Voss', 'Emeka Obi', 'Luz Herrera',
  'Ivan Petrov', 'Cleo Marchetti', 'Dario Fontana', 'Mina Haddad', 'Oscar Lindgren', 'Tessa Roy',
  'Bruno Almeida', 'Ines Duarte', 'Kofi Mensah', 'Lena Fischer', 'Ruy Tavares', 'Alba Serra',
];

const SHIRT_COLORS = ['#e2725b', '#5b8dd9', '#f2d16b', '#7fc97f', '#d97fb8', '#e8e2d0', '#4a6b8a', '#c65b4e', '#3f8f8a', '#ffb52e'];
const SKIN_TONES = ['#f2c9a0', '#d9a066', '#a9713f', '#7a4a21', '#5b3a1e'];
const PANTS_COLORS = ['#31435c', '#5d4a35', '#3a3a42', '#715c8a', '#2e4a3a'];

let pedSeq = 1;

export function createPed(x, y, rng) {
  return {
    id: pedSeq++,
    name: rng.pick(PED_NAMES),
    x, y,
    angle: rng.range(0, Math.PI * 2),
    speed: 0,
    walkPhase: rng.range(0, Math.PI * 2),
    state: 'stroll', // stroll | flee | witness | down | vendor
    target: null,
    stateTime: 0,
    callTime: 0,
    reported: false,
    health: 100,
    shirt: rng.pick(SHIRT_COLORS),
    skin: rng.pick(SKIN_TONES),
    pants: rng.pick(PANTS_COLORS),
    hat: rng.chance(0.35),
    home: { x, y },
    vendor: false,
  };
}

export function spawnPeds(city, rng, count) {
  const peds = [];
  let guard = 0;
  while (peds.length < count && guard < count * 60) {
    guard += 1;
    const island = rng.pick(city.islands);
    const blob = rng.pick(island.blobs);
    const a = rng.range(0, Math.PI * 2);
    const rr = Math.sqrt(rng.next()) * blob.r * 0.8;
    const x = blob.x + Math.cos(a) * rr;
    const y = blob.y + Math.sin(a) * rr;
    if (!city.isLand(x, y) || city.shoreDepth(x, y) < 26) continue;
    peds.push(createPed(x, y, rng));
  }
  // One vendor stands at each shop door and never flees far.
  for (const shop of city.shops) {
    const vendor = createPed(shop.x, shop.y + shop.h / 2 + 18, rng);
    vendor.state = 'vendor';
    vendor.vendor = true;
    vendor.name = 'Vendor';
    vendor.home = { x: vendor.x, y: vendor.y };
    peds.push(vendor);
  }
  return peds;
}

const FLEE_RADIUS = 190;
const WITNESS_RADIUS = 240;
const CALL_SECONDS = 2.6;

/**
 * Advance all pedestrians. `ctx` carries the player, the crime feed and the city.
 * Returns witness events: {kind:'call-started'|'call-completed'|'call-dropped', ped}.
 */
export function stepPeds(peds, dt, ctx, rng) {
  const events = [];
  const { player, city } = ctx;
  for (const ped of peds) {
    if (ped.state === 'down') continue;
    ped.stateTime += dt;
    const dPlayer = dist(ped.x, ped.y, player.x, player.y);
    const danger = ctx.dangerAt(ped.x, ped.y); // 0 calm .. 1 gunfire/crash right here

    if (ped.state === 'vendor') {
      // Vendors duck behind their counter when it kicks off, then come back.
      if (danger > 0.4) {
        ped.x = ped.home.x;
        ped.y = ped.home.y - 6;
      } else {
        ped.x = ped.home.x;
        ped.y = ped.home.y;
      }
      continue;
    }

    // Fleeing beats everything except finishing a call already connected.
    if (danger > 0.25 && ped.state !== 'witness') {
      if (ped.state !== 'flee') {
        ped.state = 'flee';
        ped.stateTime = 0;
        const away = Math.atan2(ped.y - ctx.dangerY, ped.x - ctx.dangerX);
        ped.target = { x: ped.x + Math.cos(away) * 320, y: ped.y + Math.sin(away) * 320 };
      }
    }

    if (ped.state === 'flee') {
      const speed = 196;
      const want = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
      ped.angle = turnToward(ped.angle, want, 6 * dt);
      ped.speed = speed;
      ped.walkPhase += dt * 11;
      ped.x += Math.cos(ped.angle) * speed * dt;
      ped.y += Math.sin(ped.angle) * speed * dt;
      if (ped.stateTime > 2.8 || danger === 0) {
        ped.state = 'stroll';
        ped.stateTime = 0;
        ped.target = null;
      }
      continue;
    }

    if (ped.state === 'witness') {
      ped.speed = 0;
      ped.angle = Math.atan2(player.y - ped.y, player.x - ped.x);
      const sightline = dPlayer < WITNESS_RADIUS && city.shoreDepth(ped.x, ped.y) > 0;
      if (!sightline || !ctx.crimeFresh) {
        ped.callTime = 0;
        ped.state = 'stroll';
        events.push({ kind: 'call-dropped', ped });
      } else {
        ped.callTime += dt;
        if (ped.callTime >= CALL_SECONDS && !ped.reported) {
          ped.reported = true;
          events.push({ kind: 'call-completed', ped });
          ped.state = 'flee';
          ped.stateTime = 0;
          ped.target = { x: ped.x + rng.range(-260, 260), y: ped.y + rng.range(-260, 260) };
        }
      }
      continue;
    }

    // Stroll: amble toward a wandering target, pause, amble on.
    if (ctx.crimeFresh && dPlayer < WITNESS_RADIUS && !ped.reported && ctx.playerVisible) {
      ped.state = 'witness';
      ped.callTime = 0;
      ped.speed = 0;
      events.push({ kind: 'call-started', ped });
      continue;
    }
    if (!ped.target || dist(ped.x, ped.y, ped.target.x, ped.target.y) < 14) {
      if (rng.chance(0.3)) {
        ped.speed = 0;
        ped.target = null;
        if (ped.stateTime > rng.range(2, 5)) {
          ped.stateTime = 0;
          ped.target = {
            x: ped.home.x + rng.range(-300, 300),
            y: ped.home.y + rng.range(-300, 300),
          };
        }
      } else {
        ped.target = {
          x: ped.home.x + rng.range(-340, 340),
          y: ped.home.y + rng.range(-340, 340),
        };
      }
    }
    if (ped.target) {
      const want = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
      ped.angle = turnToward(ped.angle, want, 4.4 * dt);
      ped.speed = 64;
      ped.walkPhase += dt * 7;
      const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
      const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
      if (city.isLand(nx, ny) && city.shoreDepth(nx, ny) > 12) {
        ped.x = nx;
        ped.y = ny;
      } else {
        ped.target = null;
      }
    } else {
      ped.speed = 0;
    }
    ped.reported = ped.reported && dPlayer < WITNESS_RADIUS * 1.6;
    ped.x = clamp(ped.x, 20, city.worldW - 20);
    ped.y = clamp(ped.y, 20, city.worldH - 20);
  }
  return events;
}

/** A ped struck by a car or a bullet. Returns true if they went down. */
export function hurtPed(ped, amount) {
  ped.health -= amount;
  if (ped.health <= 0 && ped.state !== 'down') {
    ped.state = 'down';
    ped.speed = 0;
    return true;
  }
  if (ped.state !== 'down') {
    ped.state = 'flee';
    ped.stateTime = 0;
    ped.target = { x: ped.x + 200, y: ped.y + 120 };
  }
  return false;
}
