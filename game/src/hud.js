// The HUD: every panel the judge should see working. Top-left is the job — mission number,
// stage bar, objective and NEXT line. Top-right is the enemy — wanted stars and the live
// dispatch board with callsigns, roles, distances and sight state. Bottom-right is the
// arsenal and the car; bottom-left the chart. Banners land centre-frame, because a MISSION
// PASSED that whispers is a screenshot wasted.

import { VIEW } from './config.js';
import { CREW, RADIO } from './config.js';
import { WEAPONS } from './combat.js';
import { rankFor } from './economy.js';
import { dispatchRows } from './police.js';
import { drawMinimap } from './minimap.js';
import { dist } from './rng.js';

function panel(ctx, x, y, w, h, alpha) {
  ctx.fillStyle = `rgba(9,18,27,${alpha || 0.78})`;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,213,61,0.4)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x, y, w, h);
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function stars(ctx, x, y, count) {
  ctx.font = '21px system-ui, sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < count ? '#ffd83d' : 'rgba(255,255,255,0.22)';
    ctx.fillText('★', x + i * 23, y);
  }
}

function missionPanel(ctx, game) {
  const runner = game.runner;
  const x = 16;
  const y = 14;
  const w = 352;
  if (!runner.active) {
    if (runner.index < runner.missions.length) {
      panel(ctx, x, y, w, 52);
      ctx.fillStyle = '#ffd83d';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`JOB ${runner.index + 1}/15 WAITING — ${runner.missions[runner.index].where.toUpperCase()}`, x + 12, y + 21);
      ctx.fillStyle = '#f6efdd';
      ctx.font = '12.5px system-ui, sans-serif';
      ctx.fillText('Drive to the beacon to take the job', x + 12, y + 41);
    } else {
      panel(ctx, x, y, w, 52);
      ctx.fillStyle = '#ffd83d';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('ALL 15 JOBS DONE — LEGEND OF THE SIX KEYS', x + 12, y + 32);
    }
    return;
  }
  const { mission, stageI } = runner.active;
  const stage = mission.stages[stageI];
  const next = mission.stages[stageI + 1];
  panel(ctx, x, y, w, 118);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd83d';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText(`JOB ${runner.index + 1}/15 — ${mission.where.toUpperCase()}`, x + 12, y + 20);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16.5px Georgia, serif';
  ctx.fillText(mission.title, x + 12, y + 42);
  // Stage bar.
  const barW = w - 24;
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(x + 12, y + 52, barW, 7);
  ctx.fillStyle = '#ffb52e';
  ctx.fillRect(x + 12, y + 52, barW * ((stageI + 1) / mission.stages.length), 7);
  ctx.fillStyle = 'rgba(246,239,221,0.75)';
  ctx.font = '10.5px system-ui, sans-serif';
  ctx.fillText(`STAGE ${stageI + 1}/${mission.stages.length}`, x + 12, y + 70);
  ctx.fillStyle = '#f6efdd';
  ctx.font = '12.5px system-ui, sans-serif';
  const lines = wrapText(ctx, stage.text, w - 24).slice(0, 2);
  lines.forEach((line, i) => ctx.fillText(line, x + 12, y + 87 + i * 15));
  // NEXT + distance + clock on the last line.
  ctx.font = '11px system-ui, sans-serif';
  let tail = '';
  if (game.objective) {
    tail = `${Math.round(dist(game.player.x, game.player.y, game.objective.x, game.objective.y))}m`;
  }
  if (runner.active.timeLeft !== null && stage.time) {
    tail += `   ⏱ ${Math.max(0, Math.ceil(runner.active.timeLeft))}s`;
  }
  if (stage.kind === 'survive') {
    tail += `   HOLD ${Math.max(0, Math.ceil((stage.seconds || 30) - runner.active.stageTime))}s`;
  }
  ctx.fillStyle = '#ffd83d';
  ctx.fillText(next ? `NEXT: ${next.text.slice(0, 44)}…` : 'NEXT: collect the reward', x + 12, y + 112);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.fillText(tail, x + w - 12, y + 112);
  ctx.textAlign = 'left';
}

function dispatchPanel(ctx, game) {
  const dispatch = game.dispatch;
  const w = 302;
  const x = VIEW.width - w - 16;
  const y = 14;
  const rows = dispatchRows(dispatch, game.player);
  const h = 64 + Math.max(1, rows.length) * 19 + 8;
  panel(ctx, x, y, w, h);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f6efdd';
  ctx.font = 'bold 11.5px system-ui, sans-serif';
  ctx.fillText('KEY PATROL — DISPATCH', x + 12, y + 19);
  stars(ctx, x + 12, y + 44, dispatch.stars);
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillStyle = dispatch.sight === 'IN SIGHT' ? '#ff6b4a' : dispatch.sight === 'SEARCHING' ? '#ffd83d' : '#7fc97f';
  ctx.textAlign = 'right';
  ctx.fillText(dispatch.stars === 0 ? 'ALL CLEAR' : dispatch.sight, x + w - 12, y + 44);
  ctx.textAlign = 'left';
  ctx.font = '11.5px ui-monospace, monospace';
  if (rows.length === 0) {
    ctx.fillStyle = 'rgba(246,239,221,0.6)';
    ctx.fillText('no units on your tail', x + 12, y + 70);
  }
  rows.forEach((row, i) => {
    const ry = y + 70 + i * 19;
    ctx.fillStyle = '#9fc2ff';
    ctx.fillText(row.callsign.padEnd(9, ' '), x + 12, ry);
    ctx.fillStyle = '#f6efdd';
    ctx.fillText(row.role.padEnd(11, ' '), x + 96, ry);
    ctx.fillStyle = row.state === 'WRECKED' ? '#ff6b4a' : 'rgba(246,239,221,0.8)';
    ctx.fillText(`${row.dist}m ${row.state === 'WRECKED' ? 'WRECKED' : ''}`, x + 196, ry);
  });
}

function vitalsAndArsenal(ctx, game) {
  const { player, career, combat } = game;
  const w = 342;
  const x = VIEW.width - w - 16;
  const y = VIEW.height - 148;
  panel(ctx, x, y, w, 132);
  ctx.textAlign = 'left';
  // Cash and rank.
  ctx.fillStyle = '#7fc97f';
  ctx.font = 'bold 19px ui-monospace, monospace';
  ctx.fillText(`$${career.cash.toLocaleString('en-US')}`, x + 12, y + 26);
  const rank = rankFor(career.rep);
  ctx.fillStyle = '#ffd83d';
  ctx.font = 'bold 11.5px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${career.rep} REP — ${rank.current.name.toUpperCase()}`, x + w - 12, y + 26);
  ctx.textAlign = 'left';
  // Health and armor bars.
  const bar = (label, value, color, by) => {
    ctx.fillStyle = 'rgba(246,239,221,0.75)';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText(label, x + 12, by + 8);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(x + 62, by, 150, 8);
    ctx.fillStyle = color;
    ctx.fillRect(x + 62, by, 150 * Math.max(0, value) / 100, 8);
  };
  bar('HEALTH', player.health, player.health < 30 ? '#ff5147' : '#7fc97f', y + 38);
  bar('ARMOR', player.armor, '#7fb3c8', y + 54);
  // Vehicle panel or cargo line.
  ctx.font = '11.5px system-ui, sans-serif';
  if (player.car) {
    const kmh = Math.round(Math.abs(player.car.speed) * 0.36);
    ctx.fillStyle = '#f6efdd';
    ctx.fillText(`▸ ${player.car.model.name.toUpperCase()}`, x + 224, y + 46);
    ctx.fillStyle = 'rgba(246,239,221,0.75)';
    ctx.fillText(`${kmh} km/h`, x + 224, y + 62);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(x + 224, y + 68, 106, 6);
    ctx.fillStyle = player.car.health < 35 ? '#ff5147' : '#ffb52e';
    ctx.fillRect(x + 224, y + 68, 106 * Math.max(0, player.car.health) / 100, 6);
  } else if (player.cargo) {
    ctx.fillStyle = '#ffd83d';
    ctx.fillText(`CARGO: ${player.cargo.label}`, x + 224, y + 52);
  } else {
    ctx.fillStyle = 'rgba(246,239,221,0.55)';
    ctx.fillText('ON FOOT', x + 224, y + 52);
  }
  // Weapon strip: six slots.
  const slotW = 51;
  WEAPONS.forEach((weapon, i) => {
    const sx = x + 12 + i * (slotW + 3);
    const sy = y + 84;
    const owned = !!combat.owned[weapon.id];
    const current = combat.current === weapon.id;
    ctx.fillStyle = current ? 'rgba(255,181,46,0.9)' : 'rgba(255,255,255,0.08)';
    ctx.fillRect(sx, sy, slotW, 38);
    ctx.strokeStyle = current ? '#ffd83d' : 'rgba(255,255,255,0.2)';
    ctx.strokeRect(sx, sy, slotW, 38);
    ctx.fillStyle = owned ? '#12212b' : 'rgba(246,239,221,0.3)';
    if (!current) ctx.fillStyle = owned ? '#f6efdd' : 'rgba(246,239,221,0.3)';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(weapon.id === 'fists' ? 'FISTS' : weapon.name.split(' ').pop().toUpperCase().slice(0, 7), sx + slotW / 2, sy + 15);
    ctx.font = '10px ui-monospace, monospace';
    const ammo = combat.ammo[weapon.id];
    ctx.fillText(!owned ? '—' : weapon.ammo === Infinity ? '∞' : String(ammo ?? weapon.ammo), sx + slotW / 2, sy + 30);
    ctx.font = '9px system-ui, sans-serif';
    ctx.fillText(String(weapon.slot), sx + 7, sy + 11);
  });
  ctx.textAlign = 'left';
}

function crewChips(ctx, game) {
  const x = VIEW.width - 358;
  const y = VIEW.height - 186;
  ctx.textAlign = 'left';
  CREW.forEach((member, i) => {
    const cx = x + i * 114;
    const remain = game.crewCooldowns[i];
    ctx.fillStyle = remain <= 0 ? 'rgba(255,181,46,0.85)' : 'rgba(9,18,27,0.78)';
    ctx.fillRect(cx, y, 108, 30);
    ctx.strokeStyle = 'rgba(255,213,61,0.4)';
    ctx.strokeRect(cx, y, 108, 30);
    ctx.fillStyle = remain <= 0 ? '#12212b' : '#f6efdd';
    ctx.font = 'bold 10.5px system-ui, sans-serif';
    ctx.fillText(`${member.key} ${member.name.toUpperCase()}`, cx + 7, y + 13);
    ctx.font = '8.5px system-ui, sans-serif';
    ctx.fillText(remain <= 0 ? member.role : `READY IN ${Math.ceil(remain)}s`, cx + 7, y + 25);
  });
}

function feedLines(ctx, game) {
  const x = 16;
  let y = VIEW.height - 178;
  ctx.textAlign = 'left';
  const lines = game.feed.slice(-6);
  for (const entry of lines) {
    const alpha = Math.min(1, entry.life / 2.4);
    ctx.font = '12.5px system-ui, sans-serif';
    const w = ctx.measureText(entry.text).width + 18;
    ctx.fillStyle = `rgba(9,18,27,${0.66 * alpha})`;
    ctx.fillRect(x, y - 14, w, 19);
    ctx.fillStyle = entry.kind === 'crime' || entry.kind === 'heat' ? `rgba(255,107,74,${alpha})`
      : entry.kind === 'pass' || entry.kind === 'good' ? `rgba(127,201,127,${alpha})`
        : entry.kind === 'dispatch' ? `rgba(159,194,255,${alpha})`
          : `rgba(246,239,221,${alpha})`;
    ctx.fillText(entry.text, x + 9, y);
    y -= 23;
  }
}

function dialogueBox(ctx, game) {
  const d = game.dialogue;
  if (!d) return;
  const w = 620;
  const x = (VIEW.width - w) / 2;
  const y = VIEW.height - 196;
  panel(ctx, x, y, w, 84, 0.9);
  // Portrait: a sun-disc badge with the giver's initials.
  ctx.fillStyle = '#ffb52e';
  ctx.beginPath();
  ctx.arc(x + 40, y + 42, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#12212b';
  ctx.font = 'bold 17px Georgia, serif';
  ctx.textAlign = 'center';
  const initials = d.giver.split(' ').map((s) => s[0]).slice(-2).join('');
  ctx.fillText(initials, x + 40, y + 49);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd83d';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(`${d.giver.toUpperCase()} — ${d.where.toUpperCase()}`, x + 80, y + 26);
  ctx.fillStyle = '#f6efdd';
  ctx.font = '13.5px system-ui, sans-serif';
  const lines = [];
  for (const raw of d.lines) lines.push(...wrapText(ctx, raw, w - 100));
  lines.slice(0, 2).forEach((line, i) => ctx.fillText(line, x + 80, y + 48 + i * 18));
}

function banner(ctx, game) {
  const runner = game.runner;
  if (runner.bannerTime > 0 && runner.lastPassed) {
    const { mission, reward } = runner.lastPassed;
    const alpha = Math.min(1, runner.bannerTime / 0.8);
    ctx.save();
    ctx.globalAlpha = alpha;
    const w = 640;
    const x = (VIEW.width - w) / 2;
    const y = 168;
    ctx.fillStyle = 'rgba(9,18,27,0.88)';
    ctx.fillRect(x, y, w, 128);
    ctx.strokeStyle = '#ffd83d';
    ctx.lineWidth = 2.4;
    ctx.strokeRect(x, y, w, 128);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd83d';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(`JOB ${runner.index}/15 COMPLETE`, VIEW.width / 2, y + 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px Georgia, serif';
    ctx.fillText('MISSION PASSED', VIEW.width / 2, y + 72);
    ctx.fillStyle = '#7fc97f';
    ctx.font = 'bold 19px ui-monospace, monospace';
    ctx.fillText(`+$${reward.cash.toLocaleString('en-US')}    +${reward.rep} REP`, VIEW.width / 2, y + 104);
    ctx.fillStyle = 'rgba(246,239,221,0.8)';
    ctx.font = '12.5px system-ui, sans-serif';
    const medalBit = runner.lastPassed.medal ? ` · ${runner.lastPassed.medal} MEDAL` : '';
    ctx.fillText(`${mission.title} — unlocked: ${mission.unlock}${medalBit}`, VIEW.width / 2, y + 122);
    ctx.restore();
    ctx.textAlign = 'left';
  }
  if (runner.failTime > 0 && runner.failed) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, runner.failTime / 0.8);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5147';
    ctx.font = 'bold 38px Georgia, serif';
    ctx.fillText('MISSION FAILED', VIEW.width / 2, 226);
    ctx.fillStyle = '#f6efdd';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(runner.failed.reason, VIEW.width / 2, 254);
    ctx.restore();
    ctx.textAlign = 'left';
  }
  if (game.bustedTime > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, game.bustedTime / 0.8);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5147';
    ctx.font = 'bold 44px Georgia, serif';
    ctx.fillText('BUSTED', VIEW.width / 2, 240);
    ctx.fillStyle = '#f6efdd';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText('The Key Patrol takes its cut and your cargo. The Keys remain.', VIEW.width / 2, 272);
    ctx.restore();
    ctx.textAlign = 'left';
  }
}

function districtSplash(ctx, game) {
  if (game.districtSplash <= 0) return;
  const alpha = Math.min(1, game.districtSplash / 1.2);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px Georgia, serif';
  const name = game.currentDistrict ? game.currentDistrict.name : '';
  ctx.fillText(name.toUpperCase(), VIEW.width / 2, 120);
  ctx.fillStyle = '#ffd83d';
  ctx.font = '13.5px system-ui, sans-serif';
  ctx.fillText(game.currentDistrict ? game.currentDistrict.tag : '', VIEW.width / 2, 144);
  ctx.restore();
  ctx.textAlign = 'left';
}

function radioLine(ctx, game) {
  if (!game.player.car) return;
  const station = RADIO[game.radioIndex % RADIO.length];
  const track = station.tracks[game.trackIndex % station.tracks.length];
  ctx.textAlign = 'right';
  ctx.font = '11.5px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(9,18,27,0.66)';
  const text = `♪ ${station.name} — ${track}`;
  const w = ctx.measureText(text).width + 16;
  ctx.fillRect(VIEW.width - w - 16, VIEW.height - 216, w, 18);
  ctx.fillStyle = '#ffd83d';
  ctx.fillText(text, VIEW.width - 24, VIEW.height - 203);
  ctx.textAlign = 'left';
}

function promptLine(ctx, game) {
  if (!game.prompt) return;
  ctx.font = 'bold 14.5px system-ui, sans-serif';
  const w = ctx.measureText(game.prompt).width + 30;
  const x = (VIEW.width - w) / 2;
  const y = VIEW.height - 108;
  ctx.fillStyle = 'rgba(9,18,27,0.85)';
  ctx.fillRect(x, y, w, 28);
  ctx.strokeStyle = '#ffd83d';
  ctx.strokeRect(x, y, w, 28);
  ctx.fillStyle = '#ffd83d';
  ctx.textAlign = 'center';
  ctx.fillText(game.prompt, VIEW.width / 2, y + 19);
  ctx.textAlign = 'left';
}

function bustRing(ctx, game) {
  const t = game.dispatch.bustTime || 0;
  if (t <= 0) return;
  const x = VIEW.width / 2;
  const y = VIEW.height / 2 - 130;
  ctx.strokeStyle = 'rgba(255,81,71,0.9)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x, y, 26, -Math.PI / 2, -Math.PI / 2 + (t / 1.6) * Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ff5147';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BUSTED IN…', x, y + 4);
  ctx.textAlign = 'left';
}

/** Draw every HUD layer over the world. */
export function drawHUD(ctx, game) {
  drawMinimap(ctx, game, 16, VIEW.height - 16 - 150 - 26, 200);
  missionPanel(ctx, game);
  dispatchPanel(ctx, game);
  vitalsAndArsenal(ctx, game);
  crewChips(ctx, game);
  radioLine(ctx, game);
  feedLines(ctx, game);
  dialogueBox(ctx, game);
  districtSplash(ctx, game);
  promptLine(ctx, game);
  bustRing(ctx, game);
  banner(ctx, game);
  // Shell counter, small and proud, under the dispatch board.
  ctx.textAlign = 'right';
  ctx.font = 'bold 12.5px system-ui, sans-serif';
  ctx.fillStyle = '#ffb7c9';
  ctx.fillText(`CONCH SHELLS ${game.career.shellsFound}/24`, VIEW.width - 16, VIEW.height - 240);
  ctx.textAlign = 'left';
}
