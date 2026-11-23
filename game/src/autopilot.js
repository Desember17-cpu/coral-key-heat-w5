// Autopilot proof: a synthetic player that plays mission 1 (First Tide Run) through the real
// input interface — walk to the hero car, get in, drive the causeway on the road graph, dock
// the delivery. It exists so the entry can prove, headlessly and deterministically, that the
// game is completable: same seed, same route, same result string, every run.
//
// Enable with ?autopilot=1. On success it writes the outcome to document.title, to a DOM node
// (#autopilot-result) and to window.__autopilotDone.

import { ACTION_ENTER } from './input.js';
import { dist } from './rng.js';

/**
 * Create an input object with the exact interface of createInput, driven by the game state.
 * `driver` is the traffic driver, reused here as a route follower for the hero car.
 */
export function createAutopilotInput(game, driver) {
  const state = {
    phase: 'toCar', // toCar | drive | done
    control: { throttle: 0, steer: 0, brake: false },
    enterQueued: false,
    lastStage: -1,
    result: null,
    stuckTime: 0,
    stuckCount: 0,
    winT: 0,
    winX: 0,
    winY: 0,
    reverseTime: 0,
  };

  function heroCar() {
    return game.cars.find((c) => c.hero);
  }

  function currentTarget() {
    if (game.runner.active) {
      const stage = game.runner.active.mission.stages[game.runner.active.stageI];
      if (stage && stage.at) return stage.at;
    }
    return game.objective;
  }

  function planRoute(car, target) {
    const from = game.city.nearestNode(car.x, car.y);
    const to = game.city.nearestNode(target.x, target.y);
    car.path = game.city.route(from, to);
    car.pathI = 0;
  }

  return {
    state,
    axes() {
      const p = game.player;
      const car = heroCar();
      if (state.phase === 'done') return { x: 0, y: 0 };
      if (!p.car) {
        // Walk straight at the hero car; queue the enter action when alongside.
        state.phase = 'toCar';
        if (!car) return { x: 0, y: 0 };
        const d = dist(p.x, p.y, car.x, car.y);
        if (d < 46) {
          state.enterQueued = true;
          return { x: 0, y: 0 };
        }
        return { x: Math.sign(car.x - p.x), y: Math.sign(car.y - p.y) };
      }
      // Driving: if the mission just passed, we are done.
      if (!game.runner.active && game.runner.index >= 1) {
        state.phase = 'done';
        state.control = { throttle: 0, steer: 0, brake: true };
        if (!state.result) {
          state.result = `AUTOPILOT WIN mission=1 cash=${game.career.cash} rep=${game.career.rep} missionsDone=${game.career.missionsDone}`;
          document.title = state.result;
          const node = document.getElementById('autopilot-result');
          if (node) node.textContent = state.result;
          window.__autopilotDone = state.result;
        }
        return { x: 0, y: 0 };
      }
      const target = currentTarget();
      if (!target) return { x: 0, y: 0 };
      const stageKey = game.runner.active ? game.runner.active.stageI : -1;
      if (stageKey !== state.lastStage || !p.car.path) {
        state.lastStage = stageKey;
        planRoute(p.car, target);
      }
      // The road graph ends a few hundred metres from most docks and doors, so the last leg
      // is always homed in; the graph only carries the car between districts.
      const dTarget = dist(p.car.x, p.car.y, target.x, target.y);
      // Is a point drivable for a car? Buildings and open water are not.
      const blockedAt = (x, y) => {
        if (game.city.shoreDepth(x, y) < 2) return true;
        for (const b of game.city.buildings) {
          const dx = x - b.x;
          const dy = y - b.y;
          const ca = Math.cos(-b.angle);
          const sa = Math.sin(-b.angle);
          const lx = dx * ca - dy * sa;
          const ly = dx * sa + dy * ca;
          if (Math.abs(lx) < b.w / 2 + 24 && Math.abs(ly) < b.h / 2 + 24) return true;
        }
        return false;
      };
      // Stuck detection over a sliding 1.5 s window: trying hard but going nowhere.
      state.winT += 1 / 60;
      if (state.winT >= 1.5) {
        if (state.reverseTime <= 0 && dist(p.car.x, p.car.y, state.winX, state.winY) < 10 && dTarget > 70) {
          state.stuckCount += 1;
          state.reverseTime = 1.1;
        }
        state.winT = 0;
        state.winX = p.car.x;
        state.winY = p.car.y;
      }
      if (state.reverseTime > 0) {
        state.reverseTime -= 1 / 60;
        // Alternate the escape direction each episode so a corner cannot trap the car.
        state.control = { throttle: -0.85, steer: state.stuckCount % 2 === 0 ? 0.85 : -0.85, brake: false };
      } else if (dTarget < 360) {
        // Feeler steering: probe ahead and to both sides; if the nose direction is blocked,
        // bend toward whichever side is clear, like a driver edging around a warehouse.
        const baseWant = Math.atan2(target.y - p.car.y, target.x - p.car.x);
        let chosen = baseWant;
        const probe = (ang) => !blockedAt(p.car.x + Math.cos(ang) * 95, p.car.y + Math.sin(ang) * 95);
        if (!probe(p.car.angle)) {
          const left = probe(p.car.angle - 0.6);
          const right = probe(p.car.angle + 0.6);
          if (left && !right) chosen = p.car.angle - 0.85;
          else if (right && !left) chosen = p.car.angle + 0.85;
          else if (left && right) chosen = baseWant;
          else chosen = p.car.angle + (state.stuckCount % 2 === 0 ? 1.2 : -1.2);
        }
        let delta = ((chosen - p.car.angle) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        const throttle = dTarget < 60 ? 0.24 : dTarget < 200 ? 0.5 : 0.72;
        state.control = { throttle, steer: Math.max(-1, Math.min(1, delta * 1.8)), brake: false };
      } else {
        state.control = driver.control(p.car, 1 / 60, game.cars);
      }
      return { x: state.control.steer, y: -state.control.throttle };
    },
    sprint() {
      return false;
    },
    brake() {
      return state.control.brake;
    },
    weaponEdge() {
      return 0;
    },
    pointer() {
      return { x: 640, y: 480, down: false };
    },
    takeActions() {
      if (state.enterQueued) {
        state.enterQueued = false;
        return ACTION_ENTER;
      }
      return 0;
    },
  };
}
