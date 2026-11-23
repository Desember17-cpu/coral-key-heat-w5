// Combat: six weapon slots, hitscan-with-tracer projectiles, floating damage numbers and the
// noise that brings witnesses running. Shooting is loud — every shot is a small crime the
// peds module can hear — and hitting a patrol car is the fastest way to meet HERON AIR.

import { HEAT } from './config.js';
import { clamp, dist } from './rng.js';
import { hurtPed } from './peds.js';

export const WEAPONS = [
  { slot: 1, id: 'fists', name: 'Fists', damage: 9, rate: 2.6, range: 30, spread: 0, speed: 0, ammo: Infinity, price: 0, auto: false },
  { slot: 2, id: 'pistol', name: 'Harbor Pistol', damage: 16, rate: 4.2, range: 430, spread: 0.028, speed: 1500, ammo: 120, price: 900, auto: false },
  { slot: 3, id: 'smg', name: 'Causeway SMG', damage: 11, rate: 10.5, range: 390, spread: 0.06, speed: 1450, ammo: 300, price: 2400, auto: true },
  { slot: 4, id: 'shotgun', name: 'Boathouse Scattergun', damage: 8, pellets: 6, rate: 1.25, range: 250, spread: 0.14, speed: 1250, ammo: 48, price: 3100, auto: false },
  { slot: 5, id: 'rifle', name: 'Sable Carbine', damage: 24, rate: 7.2, range: 560, spread: 0.016, speed: 1900, ammo: 240, price: 5600, auto: true },
  { slot: 6, id: 'launcher', name: 'Flare Mortar', damage: 65, rate: 0.8, range: 480, spread: 0.01, speed: 780, ammo: 10, price: 9900, auto: false, blast: 74 },
];

export function createCombat() {
  return {
    bullets: [],
    floaters: [], // {x, y, text, color, life}
    flashes: [], // {x, y, angle, life}
    booms: [], // {x, y, r, life}
    cooldown: 0,
    owned: { fists: true },
    ammo: {},
    current: 'fists',
  };
}

export function weaponById(id) {
  return WEAPONS.find((w) => w.id === id) || WEAPONS[0];
}

export function giveWeapon(combat, id) {
  const weapon = weaponById(id);
  combat.owned[id] = true;
  combat.ammo[id] = Math.max(combat.ammo[id] || 0, weapon.ammo === Infinity ? Infinity : weapon.ammo);
}

export function addFloater(combat, x, y, text, color) {
  combat.floaters.push({ x, y, text, color: color || '#ffd83d', life: 1.05 });
  if (combat.floaters.length > 42) combat.floaters.shift();
}

/**
 * Fire the current weapon from (x, y) toward angle. Returns true if a shot left the barrel
 * (the caller plays the sound and books the heat).
 */
export function tryShoot(combat, x, y, angle, dt, rng) {
  combat.cooldown -= dt;
  const weapon = weaponById(combat.current);
  if (combat.cooldown > 0) return false;
  if (weapon.id === 'fists') {
    combat.cooldown = 1 / weapon.rate;
    combat.flashes.push({ x: x + Math.cos(angle) * 20, y: y + Math.sin(angle) * 20, angle, life: 0.08, melee: true });
    combat.bullets.push({ x, y, angle, speed: 340, life: weapon.range / 340, damage: weapon.damage, melee: true });
    return true;
  }
  const ammo = combat.ammo[weapon.id];
  if (ammo !== undefined && ammo <= 0) {
    combat.cooldown = 0.3;
    return false;
  }
  if (ammo !== undefined && ammo !== Infinity) combat.ammo[weapon.id] = ammo - 1;
  combat.cooldown = 1 / weapon.rate;
  const pellets = weapon.pellets || 1;
  for (let i = 0; i < pellets; i += 1) {
    const a = angle + rng.range(-weapon.spread, weapon.spread);
    combat.bullets.push({
      x: x + Math.cos(angle) * 18,
      y: y + Math.sin(angle) * 18,
      angle: a,
      speed: weapon.speed,
      life: weapon.range / weapon.speed,
      damage: weapon.damage,
      blast: weapon.blast || 0,
    });
  }
  combat.flashes.push({ x: x + Math.cos(angle) * 24, y: y + Math.sin(angle) * 24, angle, life: 0.055 });
  return true;
}

function explode(combat, bullet, ctx) {
  const { peds, cars, player, feed } = ctx;
  combat.booms.push({ x: bullet.x, y: bullet.y, r: bullet.blast, life: 0.34 });
  for (const ped of peds) {
    if (dist(bullet.x, bullet.y, ped.x, ped.y) < bullet.blast) hurtPed(ped, bullet.damage);
  }
  for (const car of cars) {
    if (dist(bullet.x, bullet.y, car.x, car.y) < bullet.blast + 22) {
      car.health -= bullet.damage;
      if (car.health <= 0) car.wrecked = true;
      addFloater(combat, car.x, car.y - 26, `-${bullet.damage}`, '#ff9d5c');
    }
  }
  if (dist(bullet.x, bullet.y, player.x, player.y) < bullet.blast * 0.7) {
    ctx.hurtPlayer(bullet.damage * 0.5);
  }
  if (feed) feed.push({ text: 'An explosion rocks the street', kind: 'crime' });
}

/**
 * Advance bullets and effects. `ctx` = { peds, cars (incl. patrol), player, city, feed,
 * hurtPlayer, reportCrime(kind, x, y, amount) }.
 */
export function stepCombat(combat, dt, ctx) {
  const { peds, cars, player, city } = ctx;
  combat.cooldown -= dt * 0; // cooldown is spent in tryShoot; keep the field warm
  for (let i = combat.bullets.length - 1; i >= 0; i -= 1) {
    const b = combat.bullets[i];
    b.life -= dt;
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    let dead = b.life <= 0;
    // Buildings stop bullets.
    if (!dead) {
      for (const building of city.buildings) {
        if (Math.abs(b.x - building.x) < building.w / 2 && Math.abs(b.y - building.y) < building.h / 2) {
          dead = true;
          break;
        }
      }
    }
    // Pedestrians.
    if (!dead && !b.fromPlayerOnly) {
      for (const ped of peds) {
        if (ped.state === 'down') continue;
        if (dist(b.x, b.y, ped.x, ped.y) < 11) {
          const downed = hurtPed(ped, b.damage);
          addFloater(combat, ped.x, ped.y - 18, `-${b.damage}`, '#ff6b4a');
          ctx.reportCrime(downed ? 'hitPed' : 'shotFired', ped.x, ped.y, downed ? HEAT.hitPed : HEAT.shotFired);
          dead = true;
          break;
        }
      }
    }
    // Cars, including patrol units.
    if (!dead) {
      for (const car of cars) {
        if (dist(b.x, b.y, car.x, car.y) < Math.max(car.w, car.h) * 0.52) {
          car.health -= b.damage * 0.7;
          addFloater(combat, car.x, car.y - 24, `-${Math.round(b.damage * 0.7)}`, '#ffd83d');
          if (car.driver === 'police') ctx.reportCrime('hitCop', car.x, car.y, HEAT.hitCop * 0.4);
          if (car.health <= 0 && !car.wrecked) {
            car.wrecked = true;
            addFloater(combat, car.x, car.y - 40, 'WRECKED', '#ff6b4a');
          }
          if (b.blast) explode(combat, b, ctx);
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.life <= 0 && b.blast) {
      explode(combat, b, ctx);
      dead = true;
    }
    if (dead) combat.bullets.splice(i, 1);
  }
  for (let i = combat.floaters.length - 1; i >= 0; i -= 1) {
    const f = combat.floaters[i];
    f.life -= dt;
    f.y -= 34 * dt;
    if (f.life <= 0) combat.floaters.splice(i, 1);
  }
  for (let i = combat.flashes.length - 1; i >= 0; i -= 1) {
    combat.flashes[i].life -= dt;
    if (combat.flashes[i].life <= 0) combat.flashes.splice(i, 1);
  }
  for (let i = combat.booms.length - 1; i >= 0; i -= 1) {
    combat.booms[i].life -= dt;
    if (combat.booms[i].life <= 0) combat.booms.splice(i, 1);
  }
  return combat;
}

/** Damage the player, armor first. Returns the health actually lost. */
export function hurtPlayerState(player, amount) {
  let remaining = amount;
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, remaining * 0.7);
    player.armor -= absorbed;
    remaining -= absorbed;
  }
  player.health = clamp(player.health - remaining, 0, 100);
  return remaining;
}
