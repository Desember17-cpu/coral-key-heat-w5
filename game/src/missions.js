// The story: fifteen jobs for the people of the Six Keys, dealt out by Captain Ivo Marchetti
// and the fixers he answers to. A mission is data — a brief, a chain of stages, a reward — and
// the runner below walks the chain: goto, pickup, deliver, checkpoint runs against the clock,
// an intercept on the causeways, a timed stand, and escapes that only end when the patrol
// loses your scent. Force_Last storytelling rule: every stage names its NEXT step on the HUD.

import { dist } from './rng.js';

function hub(city, id) {
  const island = city.islands.find((i) => i.id === id);
  return { x: island.cx, y: island.cy };
}
function off(point, dx, dy) {
  return { x: point.x + dx, y: point.y + dy };
}

export function buildMissions(city) {
  const coral = hub(city, 'coral');
  const palmetto = hub(city, 'palmetto');
  const sable = hub(city, 'sable');
  const heron = hub(city, 'heron');
  const cove = hub(city, 'cove');
  const shallows = hub(city, 'shallows');
  return [
    {
      title: 'First Tide Run', giver: 'Captain Ivo Marchetti', where: 'Coral Key Marina',
      brief: ['A crate of "fishing tackle" is waiting at the marina, runner.', 'Take it to the Palmetto dock before the tide turns. Simple money.'],
      reward: { cash: 850, rep: 40 },
      stages: [
        { kind: 'pickup', text: 'Pick up the crate at Coral Marina', at: off(coral, -180, 300), cargo: { label: 'sealed crate', value: 0 } },
        { kind: 'deliver', text: 'Deliver the crate to the Palmetto dock', at: off(palmetto, 260, 330) },
      ],
      unlock: 'Palmetto Reach contacts open',
    },
    {
      title: 'Quiet Money', giver: 'Marisol Vane', where: 'Palmetto Reach',
      brief: ['Three villas, three envelopes, no knocking twice.', 'Collect all three drops and keep the patrol bored.'],
      reward: { cash: 1100, rep: 55 },
      stages: [
        { kind: 'goto', text: 'Collect drop 1 of 3 — the blue villa', at: off(palmetto, -300, -160) },
        { kind: 'goto', text: 'Collect drop 2 of 3 — the boathouse steps', at: off(palmetto, 320, 120) },
        { kind: 'goto', text: 'Collect drop 3 of 3 — the palm court', at: off(palmetto, -60, 300) },
        { kind: 'deliver', text: 'Bring the envelopes back to Café Concha', at: off(coral, 120, -120), cargo: { label: 'envelopes', value: 0 } },
      ],
      unlock: 'Palm & Powder will sell to you',
    },
    {
      title: "The Fort's Ledger", giver: 'Captain Ivo Marchetti', where: 'Fort Sable',
      brief: ['Fort Salvage keeps a ledger that should not exist.', 'Lift it from the warehouse yard and fence it where it was written.'],
      reward: { cash: 1400, rep: 70 },
      stages: [
        { kind: 'goto', text: 'Reach the Fort Sable warehouse yard', at: off(sable, -260, 180) },
        { kind: 'pickup', text: 'Take the ledger from the yard', at: off(sable, -300, 240), cargo: { label: 'salvage ledger', value: 0 } },
        { kind: 'deliver', text: 'Fence the ledger at Fort Salvage Co.', at: off(sable, 140, -80) },
      ],
      unlock: 'Sable Auto Works gives you the trade rate',
    },
    {
      title: 'Night Market Run', giver: 'Sana Iqbal', where: 'Heron Flats',
      brief: ['The market closes at midnight and so does my patience.', 'Pick up the spice crates, then shake the heat and dock at the Cove.'],
      reward: { cash: 1750, rep: 85 },
      stages: [
        { kind: 'pickup', text: 'Load the spice crates at the night market', at: off(heron, -140, 220), cargo: { label: 'spice crates', value: 0 } },
        { kind: 'spike', text: 'The patrol was tipped off — keep moving', heat: 300 },
        { kind: 'deliver', text: 'Dock the crates at Smuggler\'s Cove', at: off(cove, -260, 260) },
      ],
      unlock: 'No Questions Pawn opens its back room',
    },
    {
      title: 'Six Keys, No Brakes', giver: 'Petrol Rosa', where: 'The Causeways',
      brief: ['Coral to Heron, causeway to causeway, against my stopwatch.', 'Beat the clock and the run is yours forever.'],
      reward: { cash: 2000, rep: 100 },
      stages: [
        { kind: 'goto', text: 'Hit the Palmetto causeway gate', at: palmetto, time: 150 },
        { kind: 'goto', text: 'Hit the Fort Sable gate', at: sable },
        { kind: 'deliver', text: 'Finish at the Heron Flats gate before the clock dies', at: heron },
      ],
      unlock: 'Causeway record posted at Reef FM',
    },
    {
      title: 'Storm Cargo', giver: 'Captain Ivo Marchetti', where: "Smuggler's Cove",
      brief: ['A storm manifest came off a boat that officially sank in 1998.', 'Carry it to the Shallows. The patrol will have opinions.'],
      reward: { cash: 2300, rep: 110 },
      stages: [
        { kind: 'pickup', text: 'Take the storm manifest from the Cove boathouse', at: off(cove, 240, -200), cargo: { label: 'storm manifest', value: 0 } },
        { kind: 'spike', text: 'HERON AIR has been scrambled — run', heat: 400 },
        { kind: 'deliver', text: 'Deliver the manifest to the Shallows stilt huts', at: off(shallows, -120, 140) },
      ],
      unlock: 'Stilt Hut Sundries stocks the heavy vest',
    },
    {
      title: 'The Informant', giver: 'Greta Voss', where: 'Heron Flats',
      brief: ['My informant talks in ninety seconds or not at all.', 'Hold the square while he talks. Then vanish.'],
      reward: { cash: 2600, rep: 125 },
      stages: [
        { kind: 'goto', text: 'Reach the informant in the Heron square', at: off(heron, 60, -40) },
        { kind: 'survive', text: 'Hold the square while he talks', seconds: 45 },
        { kind: 'escape', text: 'Lose the patrol completely', at: off(heron, -320, -240) },
      ],
      unlock: 'Night Market Arms unlocks the carbine shelf',
    },
    {
      title: 'Shell Game', giver: 'Little June', where: 'The Shallows',
      brief: ['Grandma pays for perfect conches and the Shallows grow the best.', 'Four beaches, four shells, mind the patrol boats.'],
      reward: { cash: 1500, rep: 90 },
      stages: [
        { kind: 'goto', text: 'Find the conch on the west beach', at: off(shallows, -330, 60) },
        { kind: 'goto', text: 'Find the conch on the north sandbar', at: off(shallows, 40, -300) },
        { kind: 'goto', text: 'Find the conch by the stilt huts', at: off(shallows, 260, 180) },
        { kind: 'deliver', text: 'Bring the shells to The Salty Conch', at: off(shallows, -80, -60) },
      ],
      unlock: 'June marks every beach shell on your map',
    },
    {
      title: 'Bridge Toll', giver: 'Captain Ivo Marchetti', where: 'The Causeways',
      brief: ['A Manifest Van is crossing with a strongbox that belongs to us.', 'Intercept it on the causeways and take the box off its hands.'],
      reward: { cash: 2900, rep: 140 },
      stages: [
        { kind: 'intercept', text: 'Intercept the Manifest Van on the causeways', from: 'coral', to: 'heron' },
        { kind: 'deliver', text: 'Bring the strongbox to Fort Salvage Co.', at: off(sable, 140, -80), cargo: { label: 'strongbox', value: 0 } },
      ],
      unlock: 'Manifest Vans now show on the dispatch band',
    },
    {
      title: 'Hot Manifest', giver: 'Ivo & The Manifests', where: 'Fort Sable',
      brief: ['This one is already hot, so drive like it.', 'Sable to Heron against the clock, and do not stop for lights.'],
      reward: { cash: 3200, rep: 155 },
      stages: [
        { kind: 'pickup', text: 'Load the hot manifest at Fort Sable', at: off(sable, 200, 200), cargo: { label: 'hot manifest', value: 0 }, time: 165 },
        { kind: 'spike', text: 'Every unit on the band knows your plate', heat: 350 },
        { kind: 'deliver', text: 'Dock it at Heron before the clock dies', at: off(heron, -200, 260) },
      ],
      unlock: 'Reef FM dedicates the midnight hour to you',
    },
    {
      title: 'The Long Way Home', giver: 'Marisol Vane', where: 'All Six Keys',
      brief: ['One parcel, every key, in order. The scenic route is the safe route.', 'Touch each key and bring it home to Coral.'],
      reward: { cash: 3600, rep: 175 },
      stages: [
        { kind: 'pickup', text: 'Collect the parcel at Heron Flats', at: off(heron, 120, 60), cargo: { label: 'long-way parcel', value: 0 } },
        { kind: 'goto', text: 'Touch Fort Sable', at: sable },
        { kind: 'goto', text: 'Touch Palmetto Reach', at: palmetto },
        { kind: 'goto', text: 'Touch the Shallows', at: shallows },
        { kind: 'goto', text: "Touch Smuggler's Cove", at: cove },
        { kind: 'deliver', text: 'Bring the parcel home to Coral Key Marina', at: off(coral, -160, 280) },
      ],
      unlock: 'Every dockmaster on the Keys knows your hull',
    },
    {
      title: 'Reef Runner', giver: 'Petrol Rosa', where: 'The Causeways',
      brief: ['Five gates, one tank of nerve.', 'Run the reef circuit and set a time they will chase for years.'],
      reward: { cash: 3900, rep: 190 },
      stages: [
        { kind: 'goto', text: 'Gate 1 — Coral causeway head', at: off(coral, 200, -260), time: 210 },
        { kind: 'goto', text: 'Gate 2 — Shallows crossing', at: shallows },
        { kind: 'goto', text: 'Gate 3 — Cove bridge foot', at: off(cove, -200, -240) },
        { kind: 'goto', text: 'Gate 4 — Heron gate', at: heron },
        { kind: 'deliver', text: 'Gate 5 — Fort Sable finish', at: sable },
      ],
      unlock: 'The Barracuda S is yours at trade price',
    },
    {
      title: 'Double Cross', giver: 'Unknown Number', where: "Smuggler's Cove",
      brief: ['Pick up the case. Do not open the case.', 'If the sky lights up, the Shallows will hide you. Probably.'],
      reward: { cash: 4400, rep: 215 },
      stages: [
        { kind: 'pickup', text: 'Take the case from the Cove dead-drop', at: off(cove, -300, -120), cargo: { label: 'unmarked case', value: 0 } },
        { kind: 'spike', text: 'AMBUSH — five stars, every unit, now', heat: 500 },
        { kind: 'escape', text: 'Lose them and reach the Shallows safehouse', at: off(shallows, 180, -160) },
        { kind: 'deliver', text: 'Leave the case at the safehouse door', at: off(shallows, 200, -140) },
      ],
      unlock: 'The Unknown Number never calls again',
    },
    {
      title: 'Harbor Lights', giver: 'Old Tomas', where: 'The Whole Coast',
      brief: ['Fifty years I kept these lights. Now my knees are done.', 'Service both lighthouses and both marinas before dark.'],
      reward: { cash: 3000, rep: 180 },
      stages: [
        { kind: 'goto', text: 'Service the Coral lighthouse', at: { x: 470, y: 3760 } },
        { kind: 'goto', text: 'Service the Cove marina beacon', at: off(cove, -320, 420) },
        { kind: 'goto', text: 'Service the Shallows lighthouse', at: { x: 3560, y: 2720 } },
        { kind: 'deliver', text: 'Report back to Old Tomas at Coral Marina', at: off(coral, -140, 320) },
      ],
      unlock: 'Harbor lights burn a little brighter for you',
    },
    {
      title: 'The Storm Run', giver: 'Captain Ivo Marchetti', where: 'All Six Keys',
      brief: ['Everything you have learned, one last time, in the rain.', 'The storm manifest crosses every key tonight. Bring it home.'],
      reward: { cash: 6500, rep: 300 },
      stages: [
        { kind: 'pickup', text: 'Take the final manifest at Coral Marina', at: off(coral, -180, 300), cargo: { label: 'storm manifest (final)', value: 0 }, time: 420 },
        { kind: 'goto', text: 'Cross Palmetto Reach', at: palmetto },
        { kind: 'goto', text: 'Cross Fort Sable', at: sable },
        { kind: 'spike', text: 'The whole band is up — finish it anyway', heat: 450 },
        { kind: 'goto', text: 'Cross the Shallows', at: shallows },
        { kind: 'goto', text: "Cross Smuggler's Cove", at: cove },
        { kind: 'deliver', text: 'Finish at Heron Flats — the Storm Run is yours', at: heron },
      ],
      unlock: 'Legend of the Six Keys',
    },
  ];
}

/** Par times per mission (seconds): beat gold for the medal dispatch brags about. */
export const PARS = [
  { gold: 95, silver: 150 }, { gold: 120, silver: 190 }, { gold: 130, silver: 200 },
  { gold: 150, silver: 230 }, { gold: 140, silver: 210 }, { gold: 160, silver: 250 },
  { gold: 170, silver: 260 }, { gold: 150, silver: 230 }, { gold: 170, silver: 260 },
  { gold: 155, silver: 235 }, { gold: 240, silver: 360 }, { gold: 200, silver: 300 },
  { gold: 190, silver: 290 }, { gold: 210, silver: 320 }, { gold: 380, silver: 560 },
];

export function medalFor(missionIndex, elapsed) {
  const par = PARS[missionIndex];
  if (!par) return null;
  if (elapsed <= par.gold) return 'GOLD';
  if (elapsed <= par.silver) return 'SILVER';
  return 'BRONZE';
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function createRunner(missions) {
  return {
    missions,
    index: 0, // next mission to offer
    active: null, // { mission, stageI, stageTime, timeLeft, marker, elapsed }
    lastPassed: null, // { mission, reward, medal, time } for the banner
    bannerTime: 0,
    failed: null,
    failTime: 0,
  };
}

/** The current objective marker, or null between missions. */
export function currentObjective(runner) {
  if (!runner.active) return null;
  const stage = runner.active.mission.stages[runner.active.stageI];
  if (!stage) return null;
  if (stage.kind === 'intercept') return runner.active.marker;
  return stage.at || null;
}

/** Begin the next mission if none is running. Returns the mission or null. */
export function startNextMission(runner, city) {
  if (runner.active || runner.index >= runner.missions.length) return null;
  const mission = runner.missions[runner.index];
  runner.active = {
    mission,
    stageI: 0,
    stageTime: 0,
    timeLeft: null,
    marker: null,
    markerPath: null,
    markerT: 0,
    elapsed: 0,
  };
  beginStage(runner, city);
  return mission;
}

function beginStage(runner, city) {
  const active = runner.active;
  const stage = active.mission.stages[active.stageI];
  active.stageTime = 0;
  if (stage.time) active.timeLeft = stage.time;
  if (stage.kind === 'intercept') {
    const from = city.hubs[stage.from];
    const to = city.hubs[stage.to];
    active.markerPath = city.route(from, to);
    active.markerT = 0;
    active.marker = { x: city.nodes[from].x, y: city.nodes[from].y };
  }
}

/**
 * Advance the active mission. ctx = { player, dispatch, feed, career, addHeat }.
 * Events returned: 'stage', 'passed', 'failed', 'spike'.
 */
export function stepMission(runner, dt, ctx) {
  const events = [];
  if (runner.bannerTime > 0) runner.bannerTime -= dt;
  if (runner.failTime > 0) runner.failTime -= dt;
  if (!runner.active) return events;
  const active = runner.active;
  const mission = active.mission;
  const stage = mission.stages[active.stageI];
  if (!stage) return events;
  active.stageTime += dt;
  active.elapsed += dt;
  const { player, feed } = ctx;

  if (active.timeLeft !== null && stage.time) {
    active.timeLeft -= dt;
    if (active.timeLeft <= 0) {
      failMission(runner, ctx, 'Out of time.');
      events.push('failed');
      return events;
    }
  }

  const finishStage = () => {
    active.stageI += 1;
    if (active.stageI >= mission.stages.length) {
      passMission(runner, ctx);
      events.push('passed');
    } else {
      beginStage(runner, ctx.city);
      const next = mission.stages[active.stageI];
      if (feed) feed.push({ text: `NEXT: ${next.text}`, kind: 'mission' });
      events.push('stage');
    }
  };

  switch (stage.kind) {
    case 'goto':
    case 'deliver': {
      if (stage.at && dist(player.x, player.y, stage.at.x, stage.at.y) < 56) finishStage();
      break;
    }
    case 'pickup': {
      if (stage.at && dist(player.x, player.y, stage.at.x, stage.at.y) < 56) {
        if (stage.cargo) player.cargo = { ...stage.cargo };
        if (feed) feed.push({ text: `Cargo aboard: ${stage.cargo ? stage.cargo.label : 'package'}`, kind: 'mission' });
        finishStage();
      }
      break;
    }
    case 'spike': {
      ctx.addHeat(stage.heat || 200);
      events.push('spike');
      finishStage();
      break;
    }
    case 'survive': {
      if (active.stageTime >= (stage.seconds || 30)) finishStage();
      break;
    }
    case 'escape': {
      const clear = ctx.dispatch.stars === 0;
      const home = !stage.at || dist(player.x, player.y, stage.at.x, stage.at.y) < 90;
      if (clear && home) finishStage();
      break;
    }
    case 'intercept': {
      // The marker drives the causeway route at van speed; touch it to take the box.
      const path = active.markerPath;
      if (path && path.length > 1) {
        active.markerT += dt * 0.028;
        if (active.markerT >= path.length - 1) active.markerT = path.length - 1;
        const i = Math.floor(active.markerT);
        const frac = active.markerT - i;
        const a = ctx.city.nodes[path[i]];
        const b = ctx.city.nodes[path[Math.min(i + 1, path.length - 1)]];
        active.marker = { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
        if (dist(player.x, player.y, active.marker.x, active.marker.y) < 58) {
          if (stage.cargo) player.cargo = { ...stage.cargo };
          finishStage();
        } else if (active.markerT >= path.length - 1.001) {
          failMission(runner, ctx, 'The van got away.');
          events.push('failed');
        }
      }
      break;
    }
    default:
      finishStage();
  }
  return events;
}

function passMission(runner, ctx) {
  const mission = runner.active.mission;
  const elapsed = runner.active.elapsed || 0;
  const medal = medalFor(runner.index, elapsed);
  ctx.career.cash += mission.reward.cash;
  ctx.career.cashEarned += mission.reward.cash;
  ctx.career.rep += mission.reward.rep;
  ctx.career.missionsDone += 1;
  if (!ctx.career.medals) ctx.career.medals = {};
  const previous = ctx.career.medals[runner.index];
  const order = { GOLD: 3, SILVER: 2, BRONZE: 1 };
  if (!previous || (order[medal] || 0) > (order[previous] || 0)) ctx.career.medals[runner.index] = medal;
  if (ctx.player.cargo && mission.stages.some((s) => s.kind === 'deliver')) ctx.player.cargo = null;
  runner.lastPassed = { mission, reward: mission.reward, medal, time: elapsed };
  runner.bannerTime = 5.2;
  runner.index += 1;
  runner.active = null;
  if (ctx.feed) {
    ctx.feed.push({ text: `MISSION PASSED — ${mission.title}: +$${mission.reward.cash}, +${mission.reward.rep} REP`, kind: 'pass' });
    ctx.feed.push({ text: `${medal} medal — finished in ${formatTime(elapsed)} · Unlocked: ${mission.unlock}`, kind: 'good' });
  }
}

function failMission(runner, ctx, reason) {
  runner.failed = { mission: runner.active.mission, reason };
  runner.failTime = 4;
  runner.active = null; // index does not advance: the job is offered again
  if (ctx.player) ctx.player.cargo = null;
  if (ctx.feed) ctx.feed.push({ text: `MISSION FAILED — ${reason} The job is still on the board.`, kind: 'crime' });
}
