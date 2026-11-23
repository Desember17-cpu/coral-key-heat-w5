// Maps. The corner minimap is a living chart of the archipelago — land, causeways, the
// player's arrow, patrol dots, the objective beacon and the pink glint of beach shells. The
// full-screen chart (M) is the poster version: every district named, every shop and lighthouse
// marked, the GPS route to the objective drawn as a lit thread across the water.

import { VIEW, WORLD } from './config.js';
import { clamp } from './rng.js';

function project(x, y, box) {
  return {
    x: box.x + (x / WORLD.width) * box.w,
    y: box.y + (y / WORLD.height) * box.h,
  };
}

function paintChart(ctx, game, box, detailed) {
  // Water and land.
  ctx.fillStyle = '#0d5e73';
  ctx.fillRect(box.x, box.y, box.w, box.h);
  if (detailed) {
    // A navigator's grid and depth contours, so the chart reads as an instrument.
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    for (let gx = 1; gx < 8; gx += 1) {
      ctx.beginPath();
      ctx.moveTo(box.x + (box.w / 8) * gx, box.y);
      ctx.lineTo(box.x + (box.w / 8) * gx, box.y + box.h);
      ctx.stroke();
    }
    for (let gy = 1; gy < 6; gy += 1) {
      ctx.beginPath();
      ctx.moveTo(box.x, box.y + (box.h / 6) * gy);
      ctx.lineTo(box.x + box.w, box.y + (box.h / 6) * gy);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(140,220,230,0.16)';
    ctx.setLineDash([5, 7]);
    for (const island of game.city.islands) {
      for (const b of island.blobs) {
        const p = project(b.x, b.y, box);
        const r = (b.r / WORLD.width) * box.w;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 13, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 26, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    // Compass rose, top-left of the chart.
    const cx = box.x + 44;
    const cy = box.y + 46;
    ctx.strokeStyle = 'rgba(246,239,221,0.75)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, 19, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd83d';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 16);
    ctx.lineTo(cx + 4.6, cy);
    ctx.lineTo(cx, cy + 16);
    ctx.lineTo(cx - 4.6, cy);
    ctx.closePath();
    ctx.fill();
    ctx.font = 'bold 11px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', cx, cy - 24);
  }
  ctx.fillStyle = '#35b3b8';
  for (const island of game.city.islands) {
    for (const b of island.blobs) {
      const p = project(b.x, b.y, box);
      const r = (b.r / WORLD.width) * box.w;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = '#a4bd63';
  for (const island of game.city.islands) {
    for (const b of island.blobs) {
      const p = project(b.x, b.y, box);
      const r = (b.r / WORLD.width) * box.w;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(2, r - 2), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Roads and causeways.
  ctx.strokeStyle = 'rgba(246,239,221,0.75)';
  ctx.lineWidth = detailed ? 2 : 1.2;
  const { nodes, edges } = game.city;
  ctx.beginPath();
  for (const e of edges) {
    const a = project(nodes[e.a].x, nodes[e.a].y, box);
    const b = project(nodes[e.b].x, nodes[e.b].y, box);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
  // Shops and lighthouses.
  if (detailed) {
    ctx.fillStyle = '#ffd83d';
    for (const shop of game.city.shops) {
      const p = project(shop.x, shop.y, box);
      ctx.fillRect(p.x - 2.4, p.y - 2.4, 4.8, 4.8);
    }
    ctx.fillStyle = '#ffffff';
    for (const prop of game.city.props) {
      if (prop.kind !== 'lighthouse') continue;
      const p = project(prop.x, prop.y, box);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Shells glint when Sef is watching.
  if (game.sefGlow > 0 || detailed) {
    ctx.fillStyle = '#ffb7c9';
    for (const shell of game.city.shells) {
      if (shell.taken) continue;
      const p = project(shell.x, shell.y, box);
      ctx.fillRect(p.x - 1.6, p.y - 1.6, 3.2, 3.2);
    }
  }
}

/** GPS thread: the routed path from the player to the objective, as a lit polyline. */
function paintRoute(ctx, game, box) {
  const objective = game.objective;
  if (!objective) return;
  const city = game.city;
  const from = city.nearestNode(game.player.x, game.player.y);
  const to = city.nearestNode(objective.x, objective.y);
  const path = city.route(from, to);
  ctx.strokeStyle = '#ffb52e';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  const start = project(game.player.x, game.player.y, box);
  ctx.moveTo(start.x, start.y);
  for (const idx of path) {
    const p = project(city.nodes[idx].x, city.nodes[idx].y, box);
    ctx.lineTo(p.x, p.y);
  }
  const end = project(objective.x, objective.y, box);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  // Objective diamond.
  ctx.fillStyle = '#ffb52e';
  ctx.save();
  ctx.translate(end.x, end.y);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-4.4, -4.4, 8.8, 8.8);
  ctx.restore();
}

function paintActors(ctx, game, box, detailed) {
  // Patrol units.
  for (const unit of game.dispatch.units) {
    const p = project(unit.car.x, unit.car.y, box);
    ctx.fillStyle = '#3a7bff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, detailed ? 3.6 : 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(p.x, p.y, detailed ? 1.7 : 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  if (game.dispatch.heli) {
    const p = project(game.dispatch.heli.x, game.dispatch.heli.y, box);
    ctx.fillStyle = '#e8f2f8';
    ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
  }
  // Search zone ring while SEARCHING.
  if (game.dispatch.sight === 'SEARCHING' && game.dispatch.lastKnown) {
    const p = project(game.dispatch.lastKnown.x, game.dispatch.lastKnown.y, box);
    ctx.strokeStyle = 'rgba(255,80,60,0.8)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, (540 / WORLD.width) * box.w, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Player arrow.
  const p = project(game.player.x, game.player.y, box);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(game.player.car ? game.player.car.angle : game.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6.4, 0);
  ctx.lineTo(-4.4, -4);
  ctx.lineTo(-4.4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#12212b';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

/** The corner minimap, drawn inside the HUD. */
export function drawMinimap(ctx, game, x, y, size) {
  const box = { x, y, w: size, h: size * (WORLD.height / WORLD.width) };
  ctx.save();
  ctx.fillStyle = 'rgba(10,22,32,0.82)';
  ctx.fillRect(x - 5, y - 5, box.w + 10, box.h + 10);
  ctx.strokeStyle = 'rgba(255,213,61,0.65)';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(x - 5, y - 5, box.w + 10, box.h + 10);
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  paintChart(ctx, game, box, false);
  paintRoute(ctx, game, box);
  paintActors(ctx, game, box, false);
  ctx.restore();
  // District name under the chart.
  const district = game.city.districtAt(game.player.x, game.player.y);
  ctx.font = 'bold 12.5px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(10,16,22,0.72)';
  const label = district ? district.name.toUpperCase() : 'OPEN WATER';
  ctx.fillText(label, x + 1, y + box.h + 21);
  ctx.fillStyle = '#ffd83d';
  ctx.fillText(label, x, y + box.h + 20);
  return box.h;
}

/** The full-screen chart for the map screen: big, named, legend down the side. */
export function drawBigMap(ctx, game) {
  const margin = 54;
  const box = { x: margin, y: margin + 48, w: VIEW.width - margin * 2 - 250, h: VIEW.height - margin * 2 - 62 };
  box.h = Math.min(box.h, box.w * (WORLD.height / WORLD.width));
  ctx.fillStyle = 'rgba(8,18,28,0.94)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.font = 'bold 30px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f6efdd';
  ctx.fillText('THE SIX KEYS', margin, margin + 6);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(246,239,221,0.66)';
  ctx.fillText('Chart of the archipelago — causeways in cream, patrol in blue, your heading in white', margin, margin + 30);
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  paintChart(ctx, game, box, true);
  paintRoute(ctx, game, box);
  paintActors(ctx, game, box, true);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,213,61,0.5)';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  // District names on the chart.
  ctx.textAlign = 'center';
  for (const island of game.city.islands) {
    const p = project(island.cx, island.cy, box);
    ctx.font = 'bold 15px Georgia, serif';
    ctx.fillStyle = 'rgba(10,20,28,0.65)';
    ctx.fillText(island.name.toUpperCase(), p.x + 1.4, p.y + 1.4);
    ctx.fillStyle = '#fff7dd';
    ctx.fillText(island.name.toUpperCase(), p.x, p.y);
    ctx.font = '10.5px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,247,221,0.85)';
    ctx.fillText(island.tag, p.x, p.y + 16);
  }
  // Legend + district standing down the right side.
  const lx = box.x + box.w + 26;
  let ly = box.y + 6;
  ctx.textAlign = 'left';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = '#ffd83d';
  ctx.fillText('LEGEND', lx, ly);
  ly += 24;
  ctx.font = '12.5px system-ui, sans-serif';
  const legend = [
    ['#ffd83d', 'Shop / services'],
    ['#ffffff', 'Lighthouse'],
    ['#3a7bff', 'Key Patrol unit'],
    ['#ffb7c9', 'Conch shell'],
    ['#ffb52e', 'GPS route + objective'],
  ];
  for (const [color, text] of legend) {
    ctx.fillStyle = color;
    ctx.fillRect(lx, ly - 9, 11, 11);
    ctx.fillStyle = '#f6efdd';
    ctx.fillText(text, lx + 19, ly);
    ly += 21;
  }
  ly += 12;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = '#ffd83d';
  ctx.fillText('DISTRICT STANDING', lx, ly);
  ly += 23;
  ctx.font = '12.5px system-ui, sans-serif';
  for (const island of game.city.islands) {
    // Standing counts the story jobs whose first stage stands in this district.
    let total = 0;
    let done = 0;
    game.runner.missions.forEach((mission, i) => {
      const first = mission.stages[0];
      const at = first.at || { x: island.cx, y: island.cy };
      if (game.city.districtAt(at.x, at.y).id !== island.id) return;
      total += 1;
      if (i < game.runner.index) done += 1;
    });
    const shellsHere = game.city.shells.filter((s) => s.taken && game.city.districtAt(s.x, s.y).id === island.id).length;
    ctx.fillStyle = '#f6efdd';
    ctx.fillText(island.name, lx, ly);
    ctx.fillStyle = 'rgba(246,239,221,0.6)';
    ctx.fillText(`jobs ${done}/${total} · shells ${shellsHere}`, lx, ly + 15);
    ly += 38;
  }
  ly += 8;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(246,239,221,0.55)';
  ctx.fillText('M / Esc — back to the street', lx, ly);
}
