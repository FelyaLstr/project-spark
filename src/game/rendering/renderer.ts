import { GAME_CONFIG } from "../config/gameConfig";
import type { GameEngine } from "../combat/GameEngine";
import type { Fighter, Mob } from "../core/types";

const C = GAME_CONFIG;

export function render(
  ctx: CanvasRenderingContext2D,
  engine: GameEngine,
  viewW: number,
  viewH: number,
  dpr: number,
  fps = 0,
) {
  const zoom = Math.max(0.52, Math.min(0.95, viewW / 900));
  const halfW = viewW / 2 / zoom;
  const halfH = viewH / 2 / zoom;
  const raw = engine.player.pos;
  const cam = {
    x: Math.min(Math.max(raw.x, Math.min(halfW, C.arena.width / 2)), Math.max(C.arena.width - halfW, C.arena.width / 2)),
    y: Math.min(Math.max(raw.y, Math.min(halfH, C.arena.height / 2)), Math.max(C.arena.height - halfH, C.arena.height / 2)),
  };

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "#07080f";
  ctx.fillRect(0, 0, viewW, viewH);

  ctx.translate(viewW / 2, viewH / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-cam.x, -cam.y);

  drawFloor(ctx);
  drawCore(ctx, engine);
  drawWalls(ctx);
  drawEffectsUnder(ctx, engine);
  drawAimIndicator(ctx, engine);
  for (const m of engine.mobs) if (m.alive) drawMob(ctx, m);
  drawFighter(ctx, engine.enemy, "#fb7185");
  drawFighter(ctx, engine.player, "#38bdf8");
  drawProjectiles(ctx, engine);
  drawEffectsOver(ctx, engine);
  drawSafeZone(ctx, engine);

  ctx.restore();

  if (C.debug) {
    ctx.save();
    ctx.scale(dpr, dpr);
    drawDebugOverlay(ctx, engine, fps);
    ctx.restore();
  }
}

function drawDebugOverlay(ctx: CanvasRenderingContext2D, engine: GameEngine, fps: number) {
  const p = engine.player;
  const e = engine.enemy;
  const v = (x: number, y: number) => `${x.toFixed(0)},${y.toFixed(0)}`;
  const lines = [
    `fps ${fps.toFixed(0)}  phase ${engine.phase}  t ${engine.elapsed.toFixed(1)}s`,
    `hitStop ${(engine.hitStop * 1000).toFixed(0)}ms  fx ${engine.effects.length}  proj ${engine.projectiles.length}`,
    `P pos ${v(p.pos.x, p.pos.y)}  vel ${v(p.vel.x, p.vel.y)} (${Math.hypot(p.vel.x, p.vel.y).toFixed(0)})`,
    `P hp ${p.hp.toFixed(0)}  dash ${p.dashFor.toFixed(2)}  inv ${p.invulnFor.toFixed(2)}  ult ${p.ultCharge.toFixed(0)}`,
    `P cd atk ${p.cooldowns.basic.toFixed(2)} q ${p.cooldowns.q.toFixed(2)} w ${p.cooldowns.w.toFixed(2)}`,
    `E pos ${v(e.pos.x, e.pos.y)}  vel ${v(e.vel.x, e.vel.y)} (${Math.hypot(e.vel.x, e.vel.y).toFixed(0)})`,
    `E hp ${e.hp.toFixed(0)}  hit ${e.stats.abilitiesHit}/${e.stats.abilitiesHit + e.stats.abilitiesMissed}  ai ${C.ai.difficulty}`,
    `blocked P:${engine.debugInfo.playerBlocked ? 1 : 0} E:${engine.debugInfo.enemyBlocked ? 1 : 0}`,
  ];
  ctx.font = "12px ui-monospace, SFMono-Regular, monospace";
  ctx.textAlign = "left";
  const w = 320;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(8, 8, w, lines.length * 15 + 10);
  ctx.fillStyle = "#7dd3fc";
  lines.forEach((l, i) => ctx.fillText(l, 16, 25 + i * 15));
}


function drawFloor(ctx: CanvasRenderingContext2D) {
  const g = ctx.createRadialGradient(C.arena.width / 2, C.arena.height / 2, 100, C.arena.width / 2, C.arena.height / 2, 1000);
  g.addColorStop(0, "#131a2c");
  g.addColorStop(1, "#0a0c16");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, C.arena.width, C.arena.height);

  ctx.strokeStyle = "rgba(56,189,248,0.06)";
  ctx.lineWidth = 2;
  for (let x = 0; x <= C.arena.width; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, C.arena.height);
    ctx.stroke();
  }
  for (let y = 0; y <= C.arena.height; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(C.arena.width, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(125,211,252,0.35)";
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, C.arena.width, C.arena.height);

  // spawn pads
  for (const [pad, color] of [
    [C.arena.spawnA, "rgba(56,189,248,0.18)"],
    [C.arena.spawnB, "rgba(251,113,133,0.18)"],
  ] as const) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pad.x, pad.y, 70, 0, Math.PI * 2);
    ctx.fill();
  }

  if (C.features.neutralMobs) {
    ctx.strokeStyle = "rgba(163,230,53,0.2)";
    ctx.lineWidth = 3;
    for (const camp of C.mobs.camps) {
      ctx.beginPath();
      ctx.arc(camp.x, camp.y, 90, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawWalls(ctx: CanvasRenderingContext2D) {
  for (const w of C.arena.walls) {
    ctx.fillStyle = "#232d45";
    ctx.fillRect(w.x, w.y, w.w, w.h);
    // readable top edge highlight
    ctx.fillStyle = "rgba(125,211,252,0.15)";
    ctx.fillRect(w.x, w.y, w.w, 5);
    ctx.strokeStyle = "rgba(125,211,252,0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(w.x, w.y, w.w, w.h);
  }
}

function drawCore(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  const p = engine.corePos;
  const r = C.arena.coreRadius;
  const active = engine.core.active;
  const pulse = active ? 0.5 + 0.5 * Math.sin(Date.now() / 220) : 0.12;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(56,189,248,${0.05 + pulse * 0.1})`;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.setLineDash(active ? [] : [12, 14]);
  ctx.strokeStyle = active ? `rgba(56,189,248,${0.4 + pulse * 0.6})` : "rgba(100,116,139,0.45)";
  ctx.stroke();
  ctx.setLineDash([]);

  if (!active) {
    ctx.font = "bold 20px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(148,163,184,0.55)";
    ctx.fillText("CORE IDLE", p.x, p.y + 6);
  }

  const prog = Math.max(engine.core.progressA, engine.core.progressB) / C.core.captureSeconds;
  if (active && prog > 0.01) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r - 10, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
    ctx.strokeStyle = engine.core.progressA >= engine.core.progressB ? "#38bdf8" : "#fb7185";
    ctx.lineWidth = 8;
    ctx.stroke();
  }
}

/** Directional aim line for the local player; longer/brighter while drag-aiming. */
function drawAimIndicator(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  const f = engine.player;
  if (!f.alive) return;
  const aiming = engine.aimPreview.active;
  const ability = engine.aimPreview.ability;
  const len = aiming ? (ability === "q" ? C.abilities.q.range : ability === "w" ? C.abilities.w.distance : C.vanguard.attackRange) : 90;
  const dir = { x: Math.cos(f.facing), y: Math.sin(f.facing) };

  ctx.save();
  ctx.translate(f.pos.x, f.pos.y);
  ctx.rotate(f.facing);
  if (aiming) {
    ctx.fillStyle = "rgba(56,189,248,0.12)";
    ctx.fillRect(f.radius, -10, len, 20);
    ctx.strokeStyle = "rgba(125,211,252,0.75)";
    ctx.setLineDash([16, 12]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(f.radius, 0);
    ctx.lineTo(f.radius + len, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    // arrow head
    ctx.beginPath();
    ctx.moveTo(f.radius + len + 16, 0);
    ctx.lineTo(f.radius + len - 6, -12);
    ctx.lineTo(f.radius + len - 6, 12);
    ctx.closePath();
    ctx.fillStyle = "rgba(125,211,252,0.85)";
    ctx.fill();
  } else {
    ctx.strokeStyle = "rgba(125,211,252,0.28)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(f.radius + 4, 0);
    ctx.lineTo(f.radius + len * 0.5, 0);
    ctx.stroke();
  }
  ctx.restore();
  void dir;
}

function healthBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, ratio: number, color: string) {
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x - w / 2, y, w, 6);
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, y, w * Math.max(0, ratio), 6);
}

function drawFighter(ctx: CanvasRenderingContext2D, f: Fighter, color: string) {
  if (!f.alive) return;
  ctx.save();
  ctx.translate(f.pos.x, f.pos.y);
  if (f.ultActiveFor > 0) {
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 90);
    ctx.beginPath();
    ctx.arc(0, 0, f.radius + 14 + pulse * 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(251,191,36,0.2)";
    ctx.fill();
    ctx.strokeStyle = "rgba(251,191,36,0.9)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  if (f.invulnFor > 0 || f.dashFor > 0) {
    // i-frame indicator: rotating dashed shield so dodges are unmistakable
    ctx.save();
    ctx.rotate(Date.now() / 220);
    ctx.beginPath();
    ctx.arc(0, 0, f.radius + 11, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(163,230,53,0.95)";
    ctx.shadowColor = "rgba(163,230,53,0.9)";
    ctx.shadowBlur = 16;
    ctx.setLineDash([9, 7]);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
  if (f.buffs.overchargeFor > 0) {
    ctx.beginPath();
    ctx.arc(0, 0, f.radius + 9, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(56,189,248,0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.shadowColor = color;
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
  ctx.fillStyle = f.hitFlash > 0 ? "#ffffff" : f.invulnFor > 0 ? "#e2e8f0" : color;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.rotate(f.facing);
  ctx.beginPath();
  ctx.moveTo(f.radius - 2, 0);
  ctx.lineTo(f.radius + 16, 0);
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.restore();

  healthBar(ctx, f.pos.x, f.pos.y - f.radius - 18, 60, f.hp / f.maxHp, color);
}

function drawMob(ctx: CanvasRenderingContext2D, m: Mob) {
  const guardian = m.kind === "guardian";
  ctx.save();
  ctx.translate(m.pos.x, m.pos.y);
  ctx.shadowColor = guardian ? "#f59e0b" : "#a3e635";
  ctx.shadowBlur = guardian ? 26 : 12;
  ctx.beginPath();
  if (guardian) {
    ctx.moveTo(0, -m.radius);
    ctx.lineTo(m.radius, 0);
    ctx.lineTo(0, m.radius);
    ctx.lineTo(-m.radius, 0);
    ctx.closePath();
  } else {
    ctx.arc(0, 0, m.radius, 0, Math.PI * 2);
  }
  ctx.fillStyle = m.hitFlash > 0 ? "#ffffff" : guardian ? "#f59e0b" : "#65a30d";
  ctx.fill();
  ctx.restore();
  healthBar(ctx, m.pos.x, m.pos.y - m.radius - 14, guardian ? 90 : 44, m.hp / m.maxHp, guardian ? "#f59e0b" : "#a3e635");
}

function drawProjectiles(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  for (const p of engine.projectiles) {
    const isQ = p.kind === "q";
    // ATK = thin cyan/rose dart, Q = fat violet/amber orb. Never the same read.
    const core = isQ ? (p.team === "A" ? "#ddd6fe" : "#fed7aa") : p.team === "A" ? "#a5f3fc" : "#fecdd3";
    const glow = isQ ? (p.team === "A" ? "#8b5cf6" : "#f97316") : p.team === "A" ? "#22d3ee" : "#f43f5e";
    const ang = Math.atan2(p.dir.y, p.dir.x);

    // trail
    if (p.trail.length > 1) {
      ctx.save();
      ctx.strokeStyle = glow;
      ctx.lineCap = "round";
      for (let i = 1; i < p.trail.length; i++) {
        const a = p.trail[i - 1]!;
        const b = p.trail[i]!;
        const k = i / p.trail.length;
        ctx.globalAlpha = k * (isQ ? 0.65 : 0.4);
        ctx.lineWidth = p.radius * (isQ ? 0.5 + k * 1.4 : 0.35 + k * 0.9);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(p.pos.x, p.pos.y);
    ctx.rotate(ang);
    ctx.shadowColor = glow;
    ctx.shadowBlur = isQ ? 30 : 14;
    if (isQ) {
      // pulsing orb + leading spike so the direction is unmistakable
      const pulse = 1 + 0.12 * Math.sin(Date.now() / 60);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.radius * 1.5 * pulse, p.radius * pulse, 0, 0, Math.PI * 2);
      ctx.fillStyle = core;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(p.radius * 2.4, 0);
      ctx.lineTo(p.radius * 0.6, -p.radius * 0.75);
      ctx.lineTo(p.radius * 0.6, p.radius * 0.75);
      ctx.closePath();
      ctx.fillStyle = glow;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(0, 0, p.radius * 1.9, p.radius * 0.7, 0, 0, Math.PI * 2);
      ctx.fillStyle = core;
      ctx.fill();
    }
    ctx.restore();
  }
}


function drawEffectsUnder(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  for (const e of engine.effects) {
    const t = e.life / e.maxLife;
    if (e.kind === "dash-trail") {
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, (e.radius ?? 20) * (0.4 + t * 0.6), 0, Math.PI * 2);
      ctx.fillStyle = e.color ?? "#38bdf8";
      ctx.globalAlpha = t * 0.35;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (e.kind === "telegraph-line" && e.dir) {
      // charge-up lane: fills toward the caster's aim during the windup
      const charge = 1 - t;
      const len = e.radius ?? 400;
      ctx.save();
      ctx.translate(e.pos.x, e.pos.y);
      ctx.rotate(Math.atan2(e.dir.y, e.dir.x));
      ctx.fillStyle = `${e.color ?? "#a78bfa"}22`;
      ctx.fillRect(0, -18, len, 36);
      ctx.fillStyle = `${e.color ?? "#a78bfa"}55`;
      ctx.fillRect(0, -18, len * charge, 36);
      ctx.strokeStyle = e.color ?? "#a78bfa";
      ctx.globalAlpha = 0.45 + 0.55 * charge;
      ctx.lineWidth = 2;
      ctx.strokeRect(0, -18, len, 36);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    if (e.kind === "shockwave") {
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, (e.radius ?? 100) * (1 - t * 0.35), 0, Math.PI * 2);
      ctx.fillStyle = `${e.color ?? "#60a5fa"}22`;
      ctx.fill();
      ctx.strokeStyle = e.color ?? "#60a5fa";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
}

function drawEffectsOver(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  for (const e of engine.effects) {
    const t = e.life / e.maxLife;
    if (e.kind === "muzzle" && e.dir) {
      ctx.save();
      ctx.translate(e.pos.x, e.pos.y);
      ctx.rotate(Math.atan2(e.dir.y, e.dir.x));
      ctx.globalAlpha = t;
      ctx.fillStyle = e.color ?? "#67e8f9";
      ctx.beginPath();
      ctx.ellipse(0, 0, (e.radius ?? 16) * (1.2 - t * 0.4), (e.radius ?? 16) * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    if (e.kind === "slash" && e.dir) {
      const a = Math.atan2(e.dir.y, e.dir.x);
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, (e.radius ?? 120) * 0.85, a - C.vanguard.attackArc, a + C.vanguard.attackArc);
      ctx.strokeStyle = `${e.color ?? "#38bdf8"}`;
      ctx.globalAlpha = t;
      ctx.lineWidth = 10;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (e.kind === "hit" || e.kind === "core-ring") {
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, (e.radius ?? 20) * (1.6 - t), 0, Math.PI * 2);
      ctx.strokeStyle = e.color ?? "#fef08a";
      ctx.globalAlpha = t;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (e.kind === "impact-ring") {
      const grow = 1 - t;
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, (e.radius ?? 24) * (0.35 + grow * 1.1), 0, Math.PI * 2);
      ctx.strokeStyle = e.color ?? "#fbbf24";
      ctx.globalAlpha = t * 0.9;
      ctx.lineWidth = 2 + t * 5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (e.kind === "dodge-ring") {
      const grow = 1 - t;
      ctx.save();
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, (e.radius ?? 30) * (0.5 + grow * 0.9), 0, Math.PI * 2);
      ctx.strokeStyle = e.color ?? "#a3e635";
      ctx.shadowColor = e.color ?? "#a3e635";
      ctx.shadowBlur = 18;
      ctx.globalAlpha = t;
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
    if (e.kind === "fizzle") {
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, (e.radius ?? 10) * (0.6 + (1 - t) * 0.8), 0, Math.PI * 2);
      ctx.fillStyle = e.color ?? "#94a3b8";
      ctx.globalAlpha = t * 0.45;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (e.kind === "text" && e.text) {
      const dodge = e.text === "DODGE";
      ctx.font = dodge ? "bold 20px ui-sans-serif, system-ui" : "bold 24px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.globalAlpha = Math.min(1, t * 1.6);
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(0,0,0,0.65)";
      const y = e.pos.y - 40 - (1 - t) * 34;
      ctx.strokeText(e.text, e.pos.x, y);
      ctx.fillStyle = e.color ?? "#fff";
      ctx.fillText(e.text, e.pos.x, y);
      ctx.globalAlpha = 1;
    }

  }
}

function drawSafeZone(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  if (engine.safeRadius == null) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, C.arena.width, C.arena.height);
  ctx.arc(engine.corePos.x, engine.corePos.y, engine.safeRadius, 0, Math.PI * 2, true);
  ctx.fillStyle = "rgba(239,68,68,0.16)";
  ctx.fill("evenodd");
  ctx.beginPath();
  ctx.arc(engine.corePos.x, engine.corePos.y, engine.safeRadius, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(239,68,68,0.8)";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}
