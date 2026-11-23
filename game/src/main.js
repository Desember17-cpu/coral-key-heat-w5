// Coral Key Heat — boot and the one loop. The world advances in fixed 1/60 steps; the screens
// are title, play, chart, stats, paused and down. Everything the other modules need hangs off
// one game object: city, player, traffic, peds, dispatch, combat, missions, career, feed.
//
// ?seed=N fixes the city and the day. ?shot=cover|action|map|passed (with &seed=N) stages a
// composed scene instead of running the loop, paints it and sets window.__shotReady.

import { HEAT, STEP, VIEW, WALK } from './config.js';
import { clamp, dist } from './rng.js';
import { createRng, seedFromString } from './rng.js';
import { buildCity } from './city.js';
import { createCar, createTrafficDriver, separateCars, spawnTraffic, stepCar } from './vehicles.js';
import { spawnPeds, stepPeds } from './peds.js';
import { addHeat, createDispatch, stepDispatch } from './police.js';
import { createCombat, giveWeapon, hurtPlayerState, stepCombat, tryShoot, weaponById } from './combat.js';
import { buildMissions, createRunner, currentObjective, startNextMission, stepMission } from './missions.js';
import { createCareer, loadGame, saveGame, trade } from './economy.js';
import { ACTION_CONFIRM, ACTION_CREW1, ACTION_CREW2, ACTION_CREW3, ACTION_ENTER, ACTION_MAP, ACTION_PAUSE, ACTION_RADIO, ACTION_SAVE, ACTION_SHOP, ACTION_STATS, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { drawHUD } from './hud.js';
import { drawGameOver, drawMapScreen, drawPaused, drawStats, drawTitle } from './menus.js';
import { stageShot } from './shots.js';
import { createAutopilotInput } from './autopilot.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : seedFromString('coral-key-heat');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();

function pushFeed(game, text, kind) {
  game.feed.push({ text, kind: kind || 'info', life: 6.5 });
  if (game.feed.length > 9) game.feed.shift();
}

function buildGame() {
  const worldRng = createRng(seed);
  const lifeRng = createRng(seed ^ 0x5f3759df);
  const city = buildCity(worldRng);
  const career = createCareer();
  const combat = createCombat();
  giveWeapon(combat, 'pistol');
  combat.current = 'pistol';
  const missions = buildMissions(city);
  const runner = createRunner(missions);
  const coral = city.islands.find((i) => i.id === 'coral');
  const player = {
    x: coral.cx - 60, y: coral.cy + 120,
    vx: 0, vy: 0, angle: -Math.PI / 2, aimAngle: -Math.PI / 2,
    walkPhase: 0, health: 100, armor: 0, car: null, cargo: null,
  };
  // The hero car waits at the marina: an orange Conch Runner, visibly the player's.
  const hero = createCar('conch', coral.cx - 20, coral.cy + 190, -0.4, '#ff7a26', worldRng);
  hero.hero = true;
  const cars = spawnTraffic(city, lifeRng, 15);
  cars.push(hero);
  const game = {
    city, worldRng, lifeRng, career, combat, runner,
    player, cars,
    peds: spawnPeds(city, lifeRng, 30),
    dispatch: createDispatch(),
    trafficDriver: createTrafficDriver(city, lifeRng),
    feed: [],
    camera: { x: 0, y: 0 },
    time: 16.9,
    screen: 'title',
    menu: { selected: 0 },
    dialogue: null,
    dialogueTime: 0,
    prompt: '',
    objective: null,
    currentDistrict: city.districtAt(player.x, player.y),
    districtSplash: 0,
    crewCooldowns: [0, 0, 0],
    sefGlow: 0,
    radioIndex: 0,
    trackIndex: 0,
    danger: { x: 0, y: 0, level: 0 },
    pendingCrime: null,
    bustedTime: 0,
    prevStars: 0,
    elapsed: 0,
  };
  renderer.attach(game);
  return game;
}

const game = buildGame();
window.__ckh = game; // a handle for headless proofs and curious players alike
const autopilotMode = params.get('autopilot') === '1';
const input = autopilotMode ? createAutopilotInput(game, game.trafficDriver) : createInput(canvas);
if (autopilotMode) game.screen = 'play';

function missionStartPoint(g) {
  if (g.runner.index >= g.runner.missions.length) return null;
  const mission = g.runner.missions[g.runner.index];
  const first = mission.stages[0];
  if (first.at) return first.at;
  const island = g.city.islands.find((i) => mission.where.includes(i.name.split(' ')[0]));
  return island ? { x: island.cx, y: island.cy } : { x: g.city.hubs.coral ? g.city.nodes[g.city.hubs.coral].x : 900, y: 3600 };
}

function refreshObjective(g) {
  if (g.runner.active) g.objective = currentObjective(g.runner);
  else g.objective = missionStartPoint(g);
}

function reportCrime(g, kind, x, y, amount) {
  // Police in earshot book it at once; otherwise it waits for a witness call to land.
  let booked = false;
  for (const unit of g.dispatch.units) {
    if (dist(unit.car.x, unit.car.y, x, y) < 330) booked = true;
  }
  if (g.dispatch.heli && dist(g.dispatch.heli.x, g.dispatch.heli.y, x, y) < 500) booked = true;
  if (g.dispatch.sight === 'IN SIGHT') booked = true;
  if (booked) {
    addHeat(g.dispatch, amount, g.feed);
  } else {
    g.pendingCrime = { kind, x, y, amount, fresh: 4 };
  }
  g.danger = { x, y, level: 1 };
}

function snapshot(g) {
  return {
    career: g.career,
    missionIndex: g.runner.index,
    owned: Object.keys(g.combat.owned).filter((k) => g.combat.owned[k]),
    ammo: g.combat.ammo,
    current: g.combat.current,
    shells: g.city.shells.map((s) => (s.taken ? 1 : 0)),
    player: { x: g.player.x, y: g.player.y, health: g.player.health, armor: g.player.armor },
    time: g.time,
  };
}

function applySnapshot(g, data) {
  if (!data) return false;
  Object.assign(g.career, data.career || {});
  g.runner.index = data.missionIndex || 0;
  for (const id of data.owned || []) giveWeapon(g.combat, id);
  Object.assign(g.combat.ammo, data.ammo || {});
  g.combat.current = data.current || 'pistol';
  (data.shells || []).forEach((taken, i) => {
    if (g.city.shells[i]) g.city.shells[i].taken = !!taken;
  });
  if (data.player) {
    g.player.x = data.player.x;
    g.player.y = data.player.y;
    g.player.health = data.player.health;
    g.player.armor = data.player.armor;
  }
  g.time = data.time || 16.9;
  return true;
}

function nearestCar(g, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  const all = g.cars.concat(g.dispatch.units.map((u) => u.car));
  for (const car of all) {
    const d = dist(x, y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function enterExitCar(g) {
  const p = g.player;
  if (p.car) {
    const car = p.car;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 26;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 26;
    if (!g.city.isLand(p.x, p.y) && !g.city.isOnRoad(p.x, p.y, 4)) {
      p.x = car.x - Math.cos(car.angle + Math.PI / 2) * 26;
      p.y = car.y - Math.sin(car.angle + Math.PI / 2) * 26;
    }
    car.driver = null;
    p.car = null;
    audio.ui();
    return;
  }
  const car = nearestCar(g, p.x, p.y, 52);
  if (!car || car.wrecked) return;
  if (car.driver === 'traffic' || car.driver === 'police') {
    reportCrime(g, 'carjack', car.x, car.y, HEAT.carjack);
    g.career.carsStolen += 1;
    pushFeed(g, car.driver === 'police' ? 'You stole a PATROL interceptor. Bold.' : 'Car taken — the driver is already dialling', 'crime');
    if (car.driver === 'police') {
      const unit = g.dispatch.units.find((u) => u.car === car);
      if (unit) g.dispatch.units.splice(g.dispatch.units.indexOf(unit), 1);
    }
  }
  car.driver = 'player';
  p.car = car;
  audio.ui();
}

function crewAbility(g, idx) {
  if (g.crewCooldowns[idx] > 0) {
    audio.deny();
    return;
  }
  const cooldowns = [45, 60, 50];
  g.crewCooldowns[idx] = cooldowns[idx];
  if (idx === 0) {
    // Nia: the search cools and the last-known goes stale.
    g.dispatch.heat = Math.max(0, g.dispatch.heat - 48);
    if (g.dispatch.lastKnown) {
      g.dispatch.lastKnown = { x: g.dispatch.lastKnown.x + 260, y: g.dispatch.lastKnown.y - 190 };
    }
    pushFeed(g, 'Nia (scout): "Take the north causeway — they are watching the wrong bridge."', 'good');
  } else if (idx === 1) {
    const car = g.player.car || nearestCar(g, g.player.x, g.player.y, 70);
    if (car) {
      car.health = Math.min(100, car.health + 40);
      car.wrecked = false;
      pushFeed(g, 'Ruy (quick fix): panels patched, she will run.', 'good');
    } else {
      pushFeed(g, 'Ruy: "Bring me a car to fix, boss."', 'info');
      g.crewCooldowns[idx] = 2;
    }
  } else {
    g.sefGlow = 22;
    pushFeed(g, 'Sef (eyes out): patrol routes and shells lit on the chart.', 'good');
  }
  audio.confirm();
}

function handleBusted(g) {
  const fine = Math.floor(g.career.cash * 0.15);
  g.career.cash -= fine;
  g.career.arrests += 1;
  g.player.cargo = null;
  g.dispatch.heat = 0;
  g.dispatch.stars = 0;
  g.dispatch.sight = 'CLEAR';
  g.dispatch.units = [];
  g.dispatch.heli = null;
  g.bustedTime = 3.4;
  const hub = g.city.districtAt(g.player.x, g.player.y);
  g.player.x = hub.cx;
  g.player.y = hub.cy + 60;
  if (g.player.car) {
    g.player.car.driver = null;
    g.player.car = null;
  }
  pushFeed(g, `BUSTED — the patrol takes $${fine} and the cargo`, 'crime');
  audio.missionFail();
}

function stepPlay(g, dt) {
  const p = g.player;
  const actions = input.takeActions();
  g.elapsed += dt;
  g.career.playSeconds += dt;
  g.time += dt / 240; // a full day in about 96 minutes
  if (g.time >= 24) g.time -= 24;
  if (g.bustedTime > 0) g.bustedTime -= dt;
  for (let i = 0; i < 3; i += 1) g.crewCooldowns[i] = Math.max(0, g.crewCooldowns[i] - dt);
  g.sefGlow = Math.max(0, g.sefGlow - dt);
  if (g.dialogueTime > 0) {
    g.dialogueTime -= dt;
    if (g.dialogueTime <= 0) g.dialogue = null;
  }
  if (g.pendingCrime) {
    g.pendingCrime.fresh -= dt;
    if (g.pendingCrime.fresh <= 0) g.pendingCrime = null;
  }
  g.danger.level = Math.max(0, g.danger.level - dt * 0.5);

  // Screen switches.
  if (actions & ACTION_PAUSE) {
    g.screen = 'paused';
    return;
  }
  if (actions & ACTION_MAP) {
    g.screen = 'map';
    return;
  }
  if (actions & ACTION_STATS) {
    g.screen = 'stats';
    return;
  }
  if (actions & ACTION_SAVE) {
    if (saveGame(0, snapshot(g))) pushFeed(g, 'Run saved to slot 1', 'good');
  }
  if (actions & ACTION_CREW1) crewAbility(g, 0);
  if (actions & ACTION_CREW2) crewAbility(g, 1);
  if (actions & ACTION_CREW3) crewAbility(g, 2);
  if (actions & ACTION_RADIO && p.car) {
    g.radioIndex = (g.radioIndex + 1) % 3;
    if (g.radioIndex < 2) g.trackIndex = (g.trackIndex + 1) % 3;
    pushFeed(g, 'Radio: ' + ['Reef FM 98.9', 'Cayo Nights 105.3', 'Patrol Band'][g.radioIndex], 'info');
    audio.ui();
  }
  if (actions & ACTION_ENTER) enterExitCar(g);

  // Movement.
  const axes = input.axes();
  if (p.car) {
    const control = { throttle: -axes.y, steer: axes.x, brake: input.brake() };
    const events = [];
    stepCar(p.car, control, dt, g.city, events);
    p.x = p.car.x;
    p.y = p.car.y;
    p.vx = Math.cos(p.car.angle) * p.car.speed;
    p.vy = Math.sin(p.car.angle) * p.car.speed;
    p.angle = p.car.angle;
    g.career.distanceDriven += Math.abs(p.car.speed) * dt;
    const kmh = Math.round(Math.abs(p.car.speed) * 0.36);
    if (kmh > g.career.topSpeedKmh) g.career.topSpeedKmh = kmh;
    for (const e of events) {
      if (e.kind === 'crash') {
        audio.crash(Math.min(1, e.impact / 300));
        g.danger = { x: e.x, y: e.y, level: 0.8 };
      }
      if (e.kind === 'splash') audio.splash();
    }
    audio.engine(Math.abs(p.car.speed) / p.car.model.topSpeed, true);
  } else {
    audio.engine(0, false);
    const speed = input.sprint() ? WALK.sprintSpeed : WALK.walkSpeed;
    const want = Math.atan2(axes.y, axes.x);
    if (axes.x !== 0 || axes.y !== 0) {
      p.vx += Math.cos(want) * WALK.accel * dt;
      p.vy += Math.sin(want) * WALK.accel * dt;
      const mag = Math.hypot(p.vx, p.vy);
      if (mag > speed) {
        p.vx = (p.vx / mag) * speed;
        p.vy = (p.vy / mag) * speed;
      }
      p.angle = Math.atan2(p.vy, p.vx);
      p.walkPhase += dt * (speed / 16);
    } else {
      p.vx *= Math.max(0, 1 - 10 * dt);
      p.vy *= Math.max(0, 1 - 10 * dt);
    }
    const nx = p.x + p.vx * dt;
    const ny = p.y + p.vy * dt;
    if (g.city.isLand(nx, ny) || g.city.isOnRoad(nx, ny, 2)) {
      p.x = nx;
      p.y = ny;
    } else {
      p.vx = 0;
      p.vy = 0;
    }
    // Buildings block walking.
    for (const b of g.city.buildings) {
      if (Math.abs(p.x - b.x) < b.w / 2 + 9 && Math.abs(p.y - b.y) < b.h / 2 + 9) {
        p.x -= p.vx * dt;
        p.y -= p.vy * dt;
        p.vx = 0;
        p.vy = 0;
        break;
      }
    }
    // Aim follows the pointer; firing is on foot only.
    const pointer = input.pointer();
    p.aimAngle = Math.atan2((g.camera.y + pointer.y) - p.y, (g.camera.x + pointer.x) - p.x);
    if (pointer.down) {
      const weapon = weaponById(g.combat.current);
      if (tryShoot(g.combat, p.x, p.y, p.aimAngle, dt, g.lifeRng)) {
        g.career.shotsFired += 1;
        audio.shot();
        reportCrime(g, 'shotFired', p.x, p.y, HEAT.shotFired);
        void weapon;
      }
    }
  }
  const weaponEdge = input.weaponEdge();
  if (weaponEdge) {
    const weapon = [null, 'fists', 'pistol', 'smg', 'shotgun', 'rifle', 'launcher'][weaponEdge];
    if (weapon && g.combat.owned[weapon]) {
      g.combat.current = weapon;
      audio.ui();
    }
  }

  // Traffic.
  const allCars = g.cars.concat(g.dispatch.units.map((u) => u.car));
  for (const car of g.cars) {
    if (car === p.car) continue;
    if (car.driver === 'traffic') {
      const control = g.trafficDriver.control(car, dt, allCars);
      const events = [];
      stepCar(car, control, dt, g.city, events);
      for (const e of events) {
        if (e.kind === 'crash') g.danger = { x: e.x, y: e.y, level: 0.7 };
      }
    }
  }
  for (let i = 0; i < allCars.length; i += 1) {
    for (let j = i + 1; j < allCars.length; j += 1) {
      separateCars(allCars[i], allCars[j], null);
    }
  }

  // Pedestrians and their phone calls.
  const pedEvents = stepPeds(g.peds, dt, {
    player: p,
    city: g.city,
    dangerAt: (x, y) => (dist(x, y, g.danger.x, g.danger.y) < 200 ? g.danger.level : 0),
    dangerX: g.danger.x,
    dangerY: g.danger.y,
    crimeFresh: !!g.pendingCrime,
    playerVisible: true,
  }, g.lifeRng);
  for (const e of pedEvents) {
    if (e.kind === 'call-completed' && g.pendingCrime) {
      addHeat(g.dispatch, g.pendingCrime.amount, g.feed);
      pushFeed(g, `A witness got through to dispatch (${e.ped.name})`, 'dispatch');
      g.pendingCrime = null;
    }
  }

  // Patrol.
  const patrolEvents = stepDispatch(g.dispatch, dt, {
    player: { x: p.x, y: p.y, vx: p.vx, vy: p.vy, angle: p.angle },
    city: g.city, rng: g.lifeRng, feed: g.feed,
  }, []);
  for (const e of patrolEvents) {
    if (e.kind === 'busted') handleBusted(g);
    if (e.kind === 'crash') audio.crash(0.5);
  }
  if (g.dispatch.stars > g.prevStars) audio.starUp();
  if (g.prevStars > 0 && g.dispatch.stars === 0) g.career.chasesLost += 1;
  g.prevStars = g.dispatch.stars;
  let nearestUnit = Infinity;
  for (const unit of g.dispatch.units) nearestUnit = Math.min(nearestUnit, dist(unit.car.x, unit.car.y, p.x, p.y));
  audio.siren(nearestUnit === Infinity ? 0 : clamp(1 - nearestUnit / 700, 0, 1));
  audio.radio(dt, !!p.car, g.radioIndex);

  // Combat resolution.
  stepCombat(g.combat, dt, {
    peds: g.peds,
    cars: allCars,
    player: p,
    city: g.city,
    feed: g.feed,
    hurtPlayer: (amount) => hurtPlayerState(p, amount),
    reportCrime: (kind, x, y, amount) => reportCrime(g, kind, x, y, amount),
  });

  // Shells.
  for (const shell of g.city.shells) {
    if (!shell.taken && dist(p.x, p.y, shell.x, shell.y) < 26) {
      shell.taken = true;
      g.career.shellsFound += 1;
      pushFeed(g, `Conch shell ${g.career.shellsFound}/24 — June will pay for the set`, 'good');
      audio.pickup();
    }
  }

  // Missions.
  refreshObjective(g);
  if (!g.runner.active && g.runner.index < g.runner.missions.length) {
    const start = missionStartPoint(g);
    if (start && dist(p.x, p.y, start.x, start.y) < 62) {
      const mission = startNextMission(g.runner, g.city);
      if (mission) {
        g.dialogue = { giver: mission.giver, where: mission.where, lines: mission.brief };
        g.dialogueTime = 7;
        pushFeed(g, `JOB ${g.runner.index + 1}/15 — ${mission.title}`, 'mission');
        audio.confirm();
      }
    }
  }
  const missionEvents = stepMission(g.runner, dt, {
    player: p, dispatch: g.dispatch, feed: g.feed, career: g.career, city: g.city,
    addHeat: (amount) => addHeat(g.dispatch, amount, g.feed),
  });
  if (missionEvents.includes('passed')) audio.missionPass(), audio.cash();
  if (missionEvents.includes('failed')) audio.missionFail();
  refreshObjective(g);

  // Prompts and shops.
  g.prompt = '';
  const shopNear = g.city.shops.find((s) => dist(p.x, p.y, s.x, s.y) < Math.max(s.w, s.h) / 2 + 34);
  if (!p.car) {
    const carNear = nearestCar(g, p.x, p.y, 52);
    if (carNear && !carNear.wrecked) g.prompt = carNear.driver ? 'E — STEAL THE CAR' : 'E — GET IN';
  }
  if (shopNear) {
    g.prompt = `B — ${shopNear.shop.name.toUpperCase()} (${shopNear.shop.trade.toUpperCase()})`;
    if (actions & ACTION_SHOP) {
      const result = trade(shopNear.shop, { player: p, career: g.career, combat: g.combat, car: p.car || nearestCar(g, p.x, p.y, 80) });
      pushFeed(g, result.text, result.ok ? 'good' : 'info');
      if (result.ok) audio.cash();
      else audio.deny();
    }
  }

  // District splash.
  const district = g.city.districtAt(p.x, p.y);
  if (district && (!g.currentDistrict || district.id !== g.currentDistrict.id)) {
    g.currentDistrict = district;
    g.districtSplash = 3.2;
  }
  g.districtSplash = Math.max(0, g.districtSplash - dt);
  if (!g.city.isLand(p.x, p.y)) g.currentDistrict = null;

  // Feed aging.
  for (let i = g.feed.length - 1; i >= 0; i -= 1) {
    g.feed[i].life -= dt;
    if (g.feed[i].life <= 0) g.feed.splice(i, 1);
  }

  // Death.
  if (p.health <= 0) {
    g.screen = 'over';
    audio.missionFail();
  }

  // Camera.
  const lookX = clamp(p.vx * 0.42, -130, 130);
  const lookY = clamp(p.vy * 0.42, -130, 130);
  g.camera.x = clamp(p.x + lookX - VIEW.width / 2, 0, g.city.worldW - VIEW.width);
  g.camera.y = clamp(p.y + lookY - VIEW.height / 2, 0, g.city.worldH - VIEW.height);
}

function stepAmbient(g, dt) {
  // Behind the title, the city lives: traffic wanders, peds stroll, the light warms.
  for (const car of g.cars) {
    if (car.driver === 'traffic') {
      const control = g.trafficDriver.control(car, dt, g.cars);
      stepCar(car, control, dt, g.city, null);
    }
  }
  stepPeds(g.peds, dt, {
    player: { x: -9999, y: -9999 },
    city: g.city,
    dangerAt: () => 0,
    dangerX: 0, dangerY: 0,
    crimeFresh: false,
    playerVisible: false,
  }, g.lifeRng);
  g.camera.x = clamp(1750 + Math.sin(g.elapsed * 0.05) * 500, 0, g.city.worldW - VIEW.width);
  g.camera.y = clamp(2950 + Math.cos(g.elapsed * 0.04) * 300, 0, g.city.worldH - VIEW.height);
  g.elapsed += dt;
}

function draw() {
  const { ctx } = renderer;
  if (game.screen === 'title') {
    renderer.drawWorld(game.camera, 17.85);
    drawTitle(ctx, game, game.menu);
    return;
  }
  if (game.screen === 'map') {
    drawMapScreen(ctx, game);
    return;
  }
  if (game.screen === 'stats') {
    renderer.drawWorld(game.camera, game.time);
    drawStats(ctx, game);
    return;
  }
  renderer.drawWorld(game.camera, game.time);
  if (game.screen === 'paused') {
    drawPaused(ctx, game);
    return;
  }
  if (game.screen === 'over') {
    drawGameOver(ctx, game);
    return;
  }
  drawHUD(ctx, game);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - (frame.last || now)) / 1000, 0.25);
  frame.last = now;
  frame.acc = (frame.acc || 0) + dt;
  while (frame.acc >= STEP) {
    frame.acc -= STEP;
    if (game.screen === 'play') stepPlay(game, STEP);
    else if (game.screen === 'title') stepAmbient(game, STEP);
    else if (game.screen !== 'title') {
      const actions = input.takeActions();
      if (game.screen === 'paused' && (actions & ACTION_PAUSE)) game.screen = 'play';
      else if (game.screen === 'map' && (actions & (ACTION_MAP | ACTION_PAUSE))) game.screen = 'play';
      else if (game.screen === 'stats' && (actions & (ACTION_STATS | ACTION_PAUSE))) game.screen = 'play';
      else if (game.screen === 'over' && (actions & ACTION_CONFIRM)) {
        Object.assign(game, buildGame());
        renderer.attach(game);
        game.screen = 'play';
      } else if (game.screen === 'title') {
        // handled below
      }
    }
  }
  // Title menu input runs once per frame, not per step.
  if (game.screen === 'title') {
    const axes = input.axes();
    if (axes.y !== 0 && !frame.menuHeld) {
      game.menu.selected = (game.menu.selected + (axes.y > 0 ? 1 : -1) + 4) % 4;
      audio.ui();
    }
    frame.menuHeld = axes.y !== 0;
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      audio.confirm();
      if (game.menu.selected === 0) {
        game.screen = 'play';
      } else {
        const slot = game.menu.selected - 1;
        if (applySnapshot(game, loadGame(slot))) {
          pushFeed(game, `Slot ${slot + 1} loaded — welcome back to the Keys`, 'good');
          game.screen = 'play';
        } else {
          audio.deny();
        }
      }
      if (status) status.textContent = 'Playing Coral Key Heat.';
    }
  }
  draw();
}

if (shotName) {
  stageShot(shotName, game, renderer, () => {
    window.__shotReady = true;
  });
} else {
  if (status) status.textContent = 'Coral Key Heat. Press Enter to start.';
  requestAnimationFrame(frame);
}
