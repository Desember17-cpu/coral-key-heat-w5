// Vehicles: an arcade car model shared by the player, traffic and the Key Patrol, plus the
// traffic driver that wanders the road graph. Cars are rectangles with a heading and a speed;
// steering bites harder at low speed, the handbrake breaks the rear loose, and hull health is
// what crashes spend. Water is death unless a causeway carries the road across it.

import { clamp, dist, turnToward } from './rng.js';

/** The drivable catalog. topSpeed in px/s, accel in px/s^2. */
export const CAR_MODELS = [
  { id: 'conch', name: 'Conch Runner', topSpeed: 342, accel: 205, grip: 3.4, w: 44, h: 21, price: 0, colors: ['#e9b44c', '#e8e2d0', '#7fb3c8'] },
  { id: 'mullet', name: 'Mullet GT', topSpeed: 398, accel: 246, grip: 3.1, w: 47, h: 22, price: 4200, colors: ['#c65b4e', '#31435c', '#e6d7b8'] },
  { id: 'pelican', name: 'Pelican Wagon', topSpeed: 308, accel: 178, grip: 3.6, w: 50, h: 24, price: 2600, colors: ['#3f8f8a', '#a8bfae', '#d08a4e'] },
  { id: 'barracuda', name: 'Barracuda S', topSpeed: 452, accel: 292, grip: 2.9, w: 48, h: 21, price: 9800, colors: ['#20242c', '#711f2b', '#ffb52e'] },
  { id: 'dune', name: 'Dune Rat Pickup', topSpeed: 330, accel: 224, grip: 3.8, w: 50, h: 24, price: 3600, colors: ['#a4bd63', '#8a6b45', '#e6d7b8'] },
  { id: 'taxi', name: 'Key Cab', topSpeed: 322, accel: 190, grip: 3.4, w: 46, h: 22, price: 0, colors: ['#ffd83d'] },
  { id: 'patrol', name: 'Patrol Interceptor', topSpeed: 428, accel: 268, grip: 3.3, w: 48, h: 22, price: 0, colors: ['#f2f4f6'] },
  { id: 'van', name: 'Manifest Van', topSpeed: 296, accel: 168, grip: 3.5, w: 54, h: 25, price: 5200, colors: ['#5d6d7e', '#e8e2d0'] },
];

let carSeq = 1;

export function createCar(modelId, x, y, angle, color, rng) {
  const model = CAR_MODELS.find((m) => m.id === modelId) || CAR_MODELS[0];
  return {
    id: carSeq++,
    model,
    x, y,
    angle: angle || 0,
    speed: 0,
    steer: 0,
    w: model.w,
    h: model.h,
    color: color || (rng ? rng.pick(model.colors) : model.colors[0]),
    health: 100,
    driver: null, // 'player' | 'traffic' | 'police' | null (parked)
    // traffic / patrol routing state
    path: null,
    pathI: 0,
    cruise: 0.55 + (rng ? rng.range(0, 0.25) : 0),
    stuckTime: 0,
    lastX: x,
    lastY: y,
    honk: 0,
    wrecked: false,
    doorsOpen: 0,
    cargo: null,
  };
}

export function carRadius(car) {
  return Math.max(car.w, car.h) * 0.46;
}

/**
 * Advance one car by dt under control {throttle -1..1, steer -1..1, brake bool}.
 * `city` answers geography; `events` collects crashes so the caller can price them.
 */
export function stepCar(car, control, dt, city, events) {
  if (car.wrecked) {
    car.speed *= Math.max(0, 1 - 3 * dt);
    return;
  }
  const model = car.model;
  const onLand = city.isLand(car.x, car.y);
  const onRoad = city.isOnRoad(car.x, car.y, 2);
  const inWater = !onLand && !onRoad;
  const surfaceGrip = onRoad ? 1 : onLand ? 0.72 : 0.25;
  const surfaceTop = model.topSpeed * (onRoad ? 1 : onLand ? 0.66 : 0.2);

  // Longitudinal: engine, drag, brakes.
  if (control.throttle > 0) {
    car.speed += model.accel * control.throttle * surfaceGrip * dt;
  } else if (control.throttle < 0) {
    car.speed += model.accel * 0.62 * control.throttle * dt; // reverse / brake pedal
  }
  if (control.brake) {
    car.speed -= Math.sign(car.speed) * 520 * dt;
    if (Math.abs(car.speed) < 14) car.speed = 0;
  }
  const drag = 0.55 + (inWater ? 4.2 : 0);
  car.speed -= car.speed * drag * dt * 0.36;
  if (!control.throttle && !control.brake) car.speed -= Math.sign(car.speed) * 26 * dt;
  if (Math.abs(car.speed) < 2 && !control.throttle) car.speed = 0;
  car.speed = clamp(car.speed, -model.topSpeed * 0.32, surfaceTop);

  // Steering: authority grows with speed up to a point, then fades; handbrake loosens the rear.
  const speedRatio = clamp(Math.abs(car.speed) / 130, 0, 1);
  const steerAuthority = (0.9 + 1.9 * speedRatio) * (control.brake ? 1.5 : 1);
  car.steer = clamp(control.steer, -1, 1);
  car.angle += car.steer * steerAuthority * dt * Math.sign(car.speed || 1) * model.grip * 0.36;

  const vx = Math.cos(car.angle) * car.speed;
  const vy = Math.sin(car.angle) * car.speed;
  car.x += vx * dt;
  car.y += vy * dt;

  // Water off a bridge is a sinking, not a swim.
  if (inWater) {
    car.health -= 26 * dt;
    if (events) events.push({ kind: 'splash', car, x: car.x, y: car.y });
    if (car.health <= 0) {
      car.health = 0;
      car.wrecked = true;
    }
  }

  // Buildings are walls: circle push-out with a priced thud.
  for (const b of city.buildings) {
    const hw = b.w / 2 + carRadius(car) * 0.72;
    const hh = b.h / 2 + carRadius(car) * 0.72;
    const dx = car.x - b.x;
    const dy = car.y - b.y;
    if (Math.abs(dx) < hw && Math.abs(dy) < hh) {
      const penX = hw - Math.abs(dx);
      const penY = hh - Math.abs(dy);
      if (penX < penY) car.x = b.x + Math.sign(dx || 1) * hw;
      else car.y = b.y + Math.sign(dy || 1) * hh;
      const impact = Math.abs(car.speed);
      if (impact > 60) {
        car.health -= (impact - 60) * 0.09;
        if (events) events.push({ kind: 'crash', car, x: car.x, y: car.y, impact });
        if (car.health <= 0) {
          car.health = 0;
          car.wrecked = true;
        }
      }
      car.speed *= -0.24;
    }
  }

  // World edge.
  car.x = clamp(car.x, 30, city.worldW - 30);
  car.y = clamp(car.y, 30, city.worldH - 30);
}

/** Soft car-to-car separation: nudges both cars apart and trades a little speed. */
export function separateCars(a, b, events) {
  const r = carRadius(a) + carRadius(b);
  const d = dist(a.x, a.y, b.x, b.y);
  if (d === 0 || d >= r) return;
  const push = (r - d) / 2;
  const nx = (b.x - a.x) / d;
  const ny = (b.y - a.y) / d;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const closing = Math.abs(a.speed) + Math.abs(b.speed);
  if (closing > 130) {
    const dmg = (closing - 130) * 0.05;
    a.health = Math.max(0, a.health - dmg);
    b.health = Math.max(0, b.health - dmg);
    if (events) events.push({ kind: 'crash', car: a, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, impact: closing });
    a.speed *= 0.55;
    b.speed *= 0.55;
    if (a.health <= 0) a.wrecked = true;
    if (b.health <= 0) b.wrecked = true;
  } else {
    a.speed *= 0.92;
    b.speed *= 0.92;
  }
}

/**
 * The traffic driver: follows a routed path node to node at a cruise fraction of the car's top
 * speed, slowing for the car ahead, re-routing when it arrives or gets stuck.
 */
export function createTrafficDriver(city, rng) {
  return {
    control(car, dt, carsAhead) {
      if (!car.path || car.pathI >= car.path.length) {
        const from = city.nearestNode(car.x, car.y);
        let to = rng.int(0, city.nodes.length - 1);
        if (to === from) to = (to + 5) % city.nodes.length;
        car.path = city.route(from, to);
        car.pathI = 0;
      }
      // Stuck detection: barely moved while trying.
      const moved = dist(car.x, car.y, car.lastX, car.lastY);
      if (moved < 6 * dt * 60 * 0.016) car.stuckTime += dt;
      else car.stuckTime = 0;
      car.lastX = car.x;
      car.lastY = car.y;
      if (car.stuckTime > 2.4) {
        car.stuckTime = 0;
        car.path = null;
        return { throttle: -0.7, steer: 0.6, brake: false };
      }
      let target = city.nodes[car.path[car.pathI]];
      while (target && dist(car.x, car.y, target.x, target.y) < 42 && car.pathI < car.path.length - 1) {
        car.pathI += 1;
        target = city.nodes[car.path[car.pathI]];
      }
      if (!target) {
        car.path = null;
        return { throttle: 0, steer: 0, brake: true };
      }
      const want = Math.atan2(target.y - car.y, target.x - car.x);
      let steer = clamp(turnToward(0, 0, 0) + ((((want - car.angle) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -1, 1) * 1.6;
      steer = clamp(steer, -1, 1);
      let throttle = car.cruise;
      if (Math.abs(steer) > 0.55) throttle *= 0.55;
      // Keep a gap to the car ahead.
      if (carsAhead) {
        for (const other of carsAhead) {
          if (other === car) continue;
          const ahead = dist(car.x, car.y, other.x, other.y);
          const bearing = Math.atan2(other.y - car.y, other.x - car.x);
          if (ahead < 74 && Math.abs((((bearing - car.angle) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI) < 0.5) {
            throttle = ahead < 44 ? -0.2 : 0.12;
            if (ahead < 40) car.honk = 0.4;
            break;
          }
        }
      }
      return { throttle, steer, brake: false };
    },
  };
}

/** Spawn a ring of parked cars near roads plus the moving traffic set. */
export function spawnTraffic(city, rng, count) {
  const cars = [];
  const models = ['conch', 'mullet', 'pelican', 'dune', 'taxi', 'van', 'barracuda'];
  for (let i = 0; i < count; i += 1) {
    const node = city.nodes[rng.int(0, city.nodes.length - 1)];
    if (node.district === 'water') continue;
    const x = node.x + rng.range(-30, 30);
    const y = node.y + rng.range(-30, 30);
    const car = createCar(rng.pick(models), x, y, rng.range(0, Math.PI * 2), null, rng);
    car.driver = 'traffic';
    cars.push(car);
  }
  // Parked cars tucked against buildings.
  for (let i = 0; i < 26; i += 1) {
    const b = rng.pick(city.buildings);
    const x = b.x + rng.range(-b.w / 2, b.w / 2);
    const y = b.y + b.h / 2 + 20;
    if (!city.isLand(x, y)) continue;
    const car = createCar(rng.pick(models), x, y, rng.chance(0.5) ? 0 : Math.PI, null, rng);
    car.driver = null;
    cars.push(car);
  }
  return cars;
}
