// Economy and saves. Money comes from missions, pawned cargo and stunt bonuses; it goes on
// armor, ammunition, repairs and better cars. Three localStorage slots hold the whole career —
// cash, reputation, mission progress, weapons, shells, stats — so a run can be picked up
// exactly where the patrol interrupted it.

import { SAVE_KEY } from './config.js';
import { WEAPONS, giveWeapon, weaponById } from './combat.js';

export function createCareer() {
  return {
    cash: 250,
    rep: 0,
    missionsDone: 0,
    cashEarned: 0,
    shellsFound: 0,
    arrests: 0,
    chasesLost: 0,
    shotsFired: 0,
    hitsLanded: 0,
    distanceDriven: 0,
    topSpeedKmh: 0,
    carsStolen: 0,
    playSeconds: 0,
  };
}

/** Reputation ranks, from nobody to the name dispatch uses carefully. */
export const RANKS = [
  { at: 0, name: 'Dock Runner' },
  { at: 120, name: 'Causeway Courier' },
  { at: 300, name: 'Key Smuggler' },
  { at: 550, name: 'Reef Operator' },
  { at: 850, name: 'Storm Captain' },
  { at: 1200, name: 'Legend of the Six Keys' },
];

export function rankFor(rep) {
  let current = RANKS[0];
  let next = null;
  for (let i = 0; i < RANKS.length; i += 1) {
    if (rep >= RANKS[i].at) {
      current = RANKS[i];
      next = RANKS[i + 1] || null;
    }
  }
  return { current, next };
}

/** Percentage of the whole game completed: missions, shells and the rank ladder blended. */
export function completionPct(career, totalMissions, totalShells) {
  const missionPart = (career.missionsDone / totalMissions) * 0.72;
  const shellPart = (career.shellsFound / totalShells) * 0.16;
  const rankPart = Math.min(1, career.rep / RANKS[RANKS.length - 1].at) * 0.12;
  return Math.round((missionPart + shellPart + rankPart) * 100);
}

const PRICES = {
  armor: 350,
  food: 45,
  ammoPack: 130,
  repairPerHp: 3,
};

/**
 * Trade with the shop the player is standing at. Returns a feed line describing the outcome.
 * `ctx` = { player, career, combat, car } where car is the player's current or nearest car.
 */
export function trade(shop, ctx) {
  const { player, career, combat } = ctx;
  switch (shop.trade) {
    case 'armor': {
      if (career.cash < PRICES.armor) return { ok: false, text: `${shop.name}: armor is $${PRICES.armor} — you are short.` };
      if (player.armor >= 100) return { ok: false, text: `${shop.name}: your vest is already whole.` };
      career.cash -= PRICES.armor;
      player.armor = 100;
      return { ok: true, text: `${shop.name}: fresh vest fitted. Armor 100.` };
    }
    case 'food': {
      if (career.cash < PRICES.food) return { ok: false, text: `${shop.name}: a meal is $${PRICES.food} — you are short.` };
      if (player.health >= 100) return { ok: false, text: `${shop.name}: you are fed and whole already.` };
      career.cash -= PRICES.food;
      player.health = Math.min(100, player.health + 55);
      return { ok: true, text: `${shop.name}: hot food. Health restored.` };
    }
    case 'ammo': {
      const weapon = weaponById(combat.current);
      if (weapon.ammo === Infinity) return { ok: false, text: `${shop.name}: fists do not take ammunition.` };
      if (career.cash < PRICES.ammoPack) return { ok: false, text: `${shop.name}: an ammo pack is $${PRICES.ammoPack}.` };
      career.cash -= PRICES.ammoPack;
      combat.ammo[weapon.id] = (combat.ammo[weapon.id] || 0) + Math.ceil(weapon.ammo / 2);
      return { ok: true, text: `${shop.name}: ${weapon.name} ammunition restocked.` };
    }
    case 'weapons': {
      const next = WEAPONS.find((w) => w.price > 0 && !combat.owned[w.id]);
      if (!next) return { ok: false, text: `${shop.name}: you own the whole wall already.` };
      if (career.cash < next.price) return { ok: false, text: `${shop.name}: next up is the ${next.name} at $${next.price}.` };
      career.cash -= next.price;
      giveWeapon(combat, next.id);
      combat.current = next.id;
      return { ok: true, text: `${shop.name}: ${next.name} sold and in your hands.` };
    }
    case 'repair': {
      const car = ctx.car;
      if (!car) return { ok: false, text: `${shop.name}: bring a car to the bay first.` };
      if (car.health >= 100) return { ok: false, text: `${shop.name}: she is already straight and true.` };
      const cost = Math.ceil((100 - car.health) * PRICES.repairPerHp);
      if (career.cash < cost) return { ok: false, text: `${shop.name}: full repair is $${cost} — you are short.` };
      career.cash -= cost;
      car.health = 100;
      car.wrecked = false;
      return { ok: true, text: `${shop.name}: panels beaten out, good as new. -$${cost}` };
    }
    case 'pawn': {
      if (!player.cargo) return { ok: false, text: `${shop.name}: nothing to fence. Run a job first.` };
      const value = player.cargo.value;
      career.cash += value;
      career.cashEarned += value;
      const label = player.cargo.label;
      player.cargo = null;
      return { ok: true, text: `${shop.name}: the ${label} fences for $${value}. No receipt.` };
    }
    default:
      return { ok: false, text: `${shop.name} has nothing for you.` };
  }
}

// --- Saves -------------------------------------------------------------------

function slotKey(slot) {
  return `${SAVE_KEY}-${slot}`;
}

export function saveGame(slot, snapshot) {
  try {
    window.localStorage.setItem(slotKey(slot), JSON.stringify({ ...snapshot, savedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(slot) {
  try {
    const raw = window.localStorage.getItem(slotKey(slot));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function slotSummary(slot) {
  const data = loadGame(slot);
  if (!data) return null;
  return {
    slot,
    cash: data.career ? data.career.cash : 0,
    rep: data.career ? data.career.rep : 0,
    missionsDone: data.career ? data.career.missionsDone : 0,
    savedAt: data.savedAt || 0,
  };
}
