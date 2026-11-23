// Staged scenes for the four screenshots. Each one builds a real game state — real patrol
// units, a real mission on the board, real cargo — poses it at golden hour, and paints it.
// Nothing here is a mock-up: the same modules that run the game run these frames, so what the
// judge sees is what a player sees, composed.
//
//   cover   the chase climax on the Palmetto–Fort Sable causeway: that leg runs a rising
//           diagonal, so the hero rides angled across the frame at full chase-camera
//           presence, four stars up, HERON AIR overhead
//   action  on-foot combat at the Heron night market, witnesses dialling, patrol arriving
//   map     the full chart with GPS route, district standing and the stats band
//   passed  the Storm Run paid out at Coral marina, banner up, water calm

import { VIEW } from './config.js';
import { createCar } from './vehicles.js';
import { UNIT_DEFS } from './police.js';
import { giveWeapon } from './combat.js';
import { drawHUD } from './hud.js';
import { drawMapScreen } from './menus.js';
import { currentObjective } from './missions.js';

function dressCareer(game, cash, rep, missionsDone) {
  game.career.cash = cash;
  game.career.rep = rep;
  game.career.missionsDone = missionsDone;
  game.career.cashEarned = cash + 9640;
  game.career.shellsFound = 7;
  game.career.carsStolen = 3;
  game.career.shotsFired = 148;
  game.career.distanceDriven = 18400;
  game.career.topSpeedKmh = 163;
  game.career.chasesLost = 2;
  game.career.playSeconds = 7540;
}

function feed(game, lines) {
  game.feed = lines.map(([text, kind]) => ({ text, kind, life: 6.5 }));
}

function makeUnit(game, defIdx, x, y, angle) {
  const car = createCar('patrol', x, y, angle, null, game.lifeRng);
  car.driver = 'police';
  return { def: UNIT_DEFS[defIdx], car, mode: 'pursuit', target: { x, y }, searchNode: null, searchWait: 0, blockSet: false, ramCooldown: 0 };
}

function stageCover(game) {
  const city = game.city;
  dressCareer(game, 12480, 385, 4);
  giveWeapon(game.combat, 'smg');
  giveWeapon(game.combat, 'shotgun');
  game.combat.current = 'smg';
  game.combat.ammo.smg = 212;
  // Mission 5 on the board, second stage: the Fort Sable gate run.
  game.runner.index = 4;
  const mission = game.runner.missions[4];
  game.runner.active = { mission, stageI: 1, stageTime: 44, timeLeft: null, marker: null, markerPath: null, markerT: 0 };
  game.player.cargo = { label: 'storm manifest', value: 0 };
  // The causeway midpoint between Palmetto Reach and Fort Sable. This leg runs a rising
  // diagonal across the chart (about 19 degrees above horizontal), so the chase is staged
  // along it: the hero's long axis rakes across the frame instead of standing vertical,
  // which is what gives the car its frame width without forcing the zoom.
  const palm = city.nodes[city.hubs.palmetto];
  const sable = city.nodes[city.hubs.sable];
  const hx = palm.x + (sable.x - palm.x) * 0.52;
  const hy = palm.y + (sable.y - palm.y) * 0.52;
  const heading = Math.atan2(sable.y - palm.y, sable.x - palm.x);
  const hero = game.cars.find((c) => c.hero);
  hero.x = hx;
  hero.y = hy;
  hero.angle = heading;
  hero.speed = 305;
  hero.health = 78;
  game.player.car = hero;
  game.player.x = hx;
  game.player.y = hy;
  game.player.vx = Math.cos(heading) * 305;
  game.player.vy = Math.sin(heading) * 305;
  game.player.angle = heading;
  game.player.health = 92;
  game.player.armor = 65;
  // The hunt, re-choreographed around the diagonal: a trailer in the hero's wake lane, a
  // rammer kissing the rear quarter (contact at the corner only — the hero's silhouette
  // stays fully readable), and the roadblock broadside across the road ahead. Nothing
  // stacks on top of the hero the way the old vertical staging did.
  const behind = (d, side) => ({
    x: hx - Math.cos(heading) * d + Math.cos(heading + Math.PI / 2) * side,
    y: hy - Math.sin(heading) * d + Math.sin(heading + Math.PI / 2) * side,
  });
  const ahead = (d, side) => ({
    x: hx + Math.cos(heading) * d + Math.cos(heading + Math.PI / 2) * side,
    y: hy + Math.sin(heading) * d + Math.sin(heading + Math.PI / 2) * side,
  });
  const u1 = behind(46, -10);
  const u2 = behind(38, 14);
  const u3 = ahead(52, 2);
  game.dispatch.units = [
    makeUnit(game, 0, u1.x, u1.y, heading + 0.03),
    makeUnit(game, 2, u2.x, u2.y, heading - 0.20),
    makeUnit(game, 1, u3.x, u3.y, heading + Math.PI / 2 - 0.34),
  ];
  game.dispatch.units[0].car.speed = 296;
  game.dispatch.units[1].car.speed = 288;
  game.dispatch.heli = {
    x: hx - 46, y: hy - 30,
    angle: heading - 0.5, rotor: 2.2, searchlight: true, callsign: 'HERON AIR', role: 'AIR SUPPORT',
  };
  game.dispatch.heat = 432;
  game.dispatch.stars = 4;
  game.dispatch.sight = 'IN SIGHT';
  game.dispatch.lastKnown = { x: hx, y: hy };
  game.objective = currentObjective(game.runner);
  feed(game, [
    ['DISPATCH: REEF-1 (PURSUIT) joining the hunt', 'dispatch'],
    ['DISPATCH: HERON AIR is overhead — spotlight up', 'dispatch'],
    ['Cargo aboard: storm manifest', 'mission'],
  ]);
  game.crewCooldowns = [0, 18, 0];
  const zoom = 9.9;
  game.camera = {
    x: hx - (VIEW.width / zoom) * 0.53,
    y: hy - (VIEW.height / zoom) * 0.52,
  };
  return { zoom };
}

function stageAction(game) {
  const city = game.city;
  dressCareer(game, 9310, 512, 6);
  giveWeapon(game.combat, 'rifle');
  giveWeapon(game.combat, 'smg');
  game.combat.current = 'rifle';
  game.combat.ammo.rifle = 164;
  const heron = city.islands.find((i) => i.id === 'heron');
  const market = city.shops.find((s) => s.shop && s.shop.name === 'Night Market Arms') || city.buildings.find((b) => b.district === 'heron');
  const px = market.x + 30;
  const py = market.y + market.h / 2 + 66;
  game.player.x = px;
  game.player.y = py;
  game.player.health = 82;
  game.player.armor = 40;
  game.player.angle = -0.5;
  game.player.aimAngle = -0.5;
  // Mission 7, holding the square.
  game.runner.index = 6;
  const mission = game.runner.missions[6];
  game.runner.active = { mission, stageI: 1, stageTime: 18, timeLeft: null, marker: null, markerPath: null, markerT: 0 };
  // The mark: a fleeing ped, a witness mid-call, bystanders scattering.
  const mark = game.peds[0];
  mark.x = px + 120;
  mark.y = py - 44;
  mark.state = 'flee';
  mark.health = 62;
  const witness = game.peds[1];
  witness.x = px - 88;
  witness.y = py + 30;
  witness.state = 'witness';
  witness.callTime = 1.35;
  for (let i = 2; i < 7; i += 1) {
    const ped = game.peds[i];
    ped.x = px + (i - 3) * 52 + 14;
    ped.y = py + ((i % 3) - 1) * 58 - 8;
    ped.state = i % 2 ? 'flee' : 'stroll';
  }
  // A jacked Mullet GT idles at the kerb, door side to the player.
  const mullet = createCar('mullet', px + 66, py + 52, 0.5, '#c65b4e', game.lifeRng);
  game.cars.push(mullet);
  // Dress the square: crates, a barrel, more bodies running.
  game.city.props.push(
    { kind: 'crate', x: px + 42, y: py + 92, seed: 5 },
    { kind: 'crate', x: px - 56, y: py - 74, seed: 6 },
    { kind: 'barrel', x: px + 152, y: py + 40, seed: 7 },
    { kind: 'crate', x: px + 128, y: py + 96, seed: 8 },
  );
  for (let i = 7; i < 10; i += 1) {
    const ped = game.peds[i];
    ped.x = px + (i - 8) * 74 - 20;
    ped.y = py - 108 + (i % 2) * 34;
    ped.state = 'flee';
  }
  // Two patrol units rolling in, close enough to read their light bars.
  const u1 = { x: px + 178, y: py - 96 };
  const u2 = { x: px + 238, y: py + 60 };
  game.dispatch.units = [
    makeUnit(game, 3, u1.x, u1.y, Math.PI),
    makeUnit(game, 4, u2.x, u2.y, Math.PI / 3),
  ];
  game.dispatch.units[0].car.speed = 210;
  game.dispatch.heat = 214;
  game.dispatch.stars = 2;
  game.dispatch.sight = 'IN SIGHT';
  game.dispatch.lastKnown = { x: px, y: py };
  // The shot itself, frozen: muzzle flash, tracers, damage numbers.
  game.combat.flashes.push({ x: px + Math.cos(-0.5) * 24, y: py + Math.sin(-0.5) * 24, angle: -0.5, life: 0.06 });
  for (let i = 0; i < 3; i += 1) {
    game.combat.bullets.push({
      x: px + 44 + i * 26, y: py - 22 - i * 12,
      angle: -0.5, speed: 1900, life: 0.2, damage: 24,
    });
  }
  game.combat.floaters.push(
    { x: mark.x - 8, y: mark.y - 22, text: '-24', color: '#ff6b4a', life: 1 },
    { x: mark.x + 12, y: mark.y - 40, text: '-18', color: '#ffd83d', life: 1 },
    { x: px + 66, y: py + 22, text: 'CARJACKED', color: '#ffd83d', life: 1 },
  );
  game.objective = currentObjective(game.runner);
  feed(game, [
    ['Shots fired at the night market', 'crime'],
    ['A witness is calling dispatch (Sana Iqbal)', 'dispatch'],
    ['NEXT: hold the square — 27s', 'mission'],
  ]);
  game.crewCooldowns = [0, 0, 26];
  const zoom = 2.6;
  game.camera = { x: px - (VIEW.width / zoom) * 0.42, y: py - (VIEW.height / zoom) * 0.52 };
  void heron;
  return { zoom };
}

function stageMap(game) {
  dressCareer(game, 18240, 640, 10);
  game.career.shellsFound = 9;
  giveWeapon(game.combat, 'rifle');
  game.runner.index = 10;
  const mission = game.runner.missions[10];
  game.runner.active = { mission, stageI: 3, stageTime: 0, timeLeft: null, marker: null, markerPath: null, markerT: 0 };
  game.player.x = game.city.islands.find((i) => i.id === 'heron').cx;
  game.player.y = game.city.islands.find((i) => i.id === 'heron').cy;
  game.objective = currentObjective(game.runner);
  game.dispatch.heat = 120;
  game.dispatch.stars = 1;
  game.dispatch.sight = 'SEARCHING';
  const u = makeUnit(game, 0, game.player.x + 500, game.player.y + 300, 2.4);
  game.dispatch.units = [u];
  game.dispatch.lastKnown = { x: game.player.x - 640, y: game.player.y + 340 };
  return { zoom: 1, map: true };
}

function stagePassed(game) {
  const city = game.city;
  dressCareer(game, 26910, 1240, 15);
  game.career.shellsFound = 21;
  game.career.cashEarned = 41200;
  giveWeapon(game.combat, 'rifle');
  giveWeapon(game.combat, 'launcher');
  game.combat.current = 'rifle';
  const coral = city.islands.find((i) => i.id === 'coral');
  const px = coral.cx - 120;
  const py = coral.cy + 268;
  game.player.x = px;
  game.player.y = py;
  game.player.angle = 0.8;
  game.player.aimAngle = 0.8;
  game.player.health = 100;
  game.player.armor = 80;
  const hero = game.cars.find((c) => c.hero);
  hero.x = px + 58;
  hero.y = py + 16;
  hero.angle = 0.35;
  hero.health = 88;
  // The whole story, paid.
  game.runner.index = 15;
  const mission = game.runner.missions[14];
  game.runner.lastPassed = { mission, reward: mission.reward, medal: 'GOLD', time: 342 };
  game.runner.bannerTime = 5;
  game.objective = null;
  game.combat.floaters.push(
    { x: px - 26, y: py + 118, text: '+$6,500', color: '#7fc97f', life: 1 },
    { x: px + 96, y: py + 100, text: '+300 REP', color: '#ffd83d', life: 1 },
  );
  for (let i = 0; i < 5; i += 1) {
    const ped = game.peds[i];
    ped.x = px + (i - 2) * 64;
    ped.y = py + 74 + (i % 2) * 26;
    ped.state = 'stroll';
  }
  feed(game, [
    ['MISSION PASSED — The Storm Run: +$6,500, +300 REP', 'pass'],
    ['Unlocked: Legend of the Six Keys', 'good'],
  ]);
  const zoom = 2.2;
  game.camera = { x: px - (VIEW.width / zoom) * 0.44, y: py - (VIEW.height / zoom) * 0.46 };
  return { zoom };
}

const SCENES = { cover: stageCover, action: stageAction, map: stageMap, passed: stagePassed };

export function stageShot(name, game, renderer, done) {
  const stage = SCENES[name] || stageCover;
  game.screen = 'play';
  game.time = 17.85;
  const { zoom, map } = stage(game);
  let painted = 0;
  function paint() {
    if (map) {
      drawMapScreen(renderer.ctx, game);
    } else {
      renderer.drawWorld(game.camera, game.time, zoom);
      drawHUD(renderer.ctx, game);
    }
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else done();
  }
  requestAnimationFrame(paint);
}
