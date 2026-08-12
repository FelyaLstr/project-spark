import { GAME_CONFIG } from "../config/gameConfig";
import type { GameEngine } from "../combat/GameEngine";
import { teamColors } from "../core/teams";
import type { Fighter, Mob } from "../core/types";
import { getCamera } from "./camera";
import { drawText, fillCircle, inLocalSpace, strokeCircle } from "./draw";

const C = GAME_CONFIG;
const ORIGIN = { x: 0, y: 0 };

export function render(
  ctx: CanvasRenderingContext2D,
  engine: GameEngine,
  viewW: number,
  viewH: number,
  dpr: number,
  fps = 0,
) {
  const { zoom, cam } = getCamera(viewW, viewH, engine.player.pos);

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "#07080f";
  ctx.fillRect(0, 0, viewW, viewH);

  ctx.translate(viewW / 2, viewH / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-cam.x, -cam.y);

  drawFloor(ctx);
  drawCamps(ctx, engine);
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
    `fps ${fps.toFixed(0)}  phase ${engine.phase}  t ${engine.time.toFixed(1)}s`,
    `hitStop ${(engine.hitStop * 1000).toFixed(0)}ms  fx ${engine.effects.length}  proj ${engine.projectiles.length}`,
    `P pos ${v(p.pos.x, p.pos.y)}  vel ${v(p.vel.x, p.vel.y)} (${Math.hypot(p.vel.x, p.vel.y).toFixed(0)})`,
    `P hp ${p.hp.toFixed(0)}  dash ${p.dashFor.toFixed(2)}  inv ${p.invulnFor.toFixed(2)}  ult ${p.ultCharge.toFixed(0)}`,
    `P cd atk ${p.cooldowns.basic.toFixed(2)} q ${p.cooldowns.q.toFixed(2)} w ${p.cooldowns.w.toFixed(2)}`,
    `E pos ${v(e.pos.x, e.pos.y)}  vel ${v(e.vel.x, e.vel.y)} (${Math.hypot(e.vel.x, e.vel.y).toFixed(0)})`,
    `E hp ${e.hp.toFixed(0)}  hit ${e.stats.abilitiesHit}/${e.stats.abilitiesHit + e.stats.abilitiesMissed}  ai ${C.ai.difficulty}`,
    `blocked P:${engine.debugInfo.playerBlocked ? 1 : 0} E:${engine.debugInfo.enemyBlocked ? 1 : 0}`,
    `P ess ${p.essence.toFixed(0)}  up P${p.upgrades.power}/V${p.upgrades.vitality}/H${p.upgrades.haste}  maxHp ${p.maxHp.toFixed(0)}`,
    `E ess ${e.essence.toFixed(0)}  up P${e.upgrades.power}/V${e.upgrades.vitality}/H${e.upgrades.haste}`,
    `mobs ${engine.mobs.filter((m) => m.alive).length}/${engine.mobs.length}  ${engine.camps
      .map((c) => `#${c.id} ${c.phase}${c.respawnIn > 0 ? ` ${c.respawnIn.toFixed(0)}s` : ""}`)
      .join("  ")}`,
    ...engine.mobs
      .filter((m) => m.alive)
      .map((m) => `  ${m.id} ${m.state} hp ${m.hp.toFixed(0)}/${m.maxHp} @${v(m.pos.x, m.pos.y)}`),
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
  const g = ctx.createRadialGradient(
    C.arena.width / 2,
    C.arena.height / 2,
    100,
    C.arena.width / 2,
    C.arena.height / 2,
    1000,
  );
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
    fillCircle(ctx, pad, 70, color);
  }
}

/** Subtle camp state indicators: available / in combat / cleared / respawning. */
function drawCamps(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  if (!C.features.neutralMobs) return;
  const pulse = 0.5 + 0.5 * Math.sin(engine.time * 3);
  for (const camp of engine.camps) {
    const style =
      camp.phase === "COMBAT"
        ? {
            stroke: `rgba(251,191,36,${0.35 + pulse * 0.35})`,
            fill: "rgba(251,191,36,0.05)",
            dash: [] as number[],
          }
        : camp.phase === "AVAILABLE"
          ? { stroke: "rgba(163,230,53,0.32)", fill: "rgba(163,230,53,0.05)", dash: [] }
          : camp.phase === "PENDING"
            ? { stroke: "rgba(148,163,184,0.14)", fill: "rgba(148,163,184,0.02)", dash: [10, 12] }
            : { stroke: "rgba(148,163,184,0.24)", fill: "rgba(148,163,184,0.03)", dash: [6, 10] };

    ctx.save();
    fillCircle(ctx, camp.pos, camp.radius, style.fill);
    strokeCircle(ctx, camp.pos, camp.radius, { color: style.stroke, width: 3, dash: style.dash });

    const label =
      camp.phase === "COMBAT"
        ? "COMBAT"
        : camp.phase === "AVAILABLE"
          ? "AVAILABLE"
          : camp.phase === "CLEARED"
            ? "CLEARED"
            : `RESPAWN ${Math.ceil(camp.respawnIn)}s`;

    if (camp.phase === "CLEARED" || camp.phase === "RESPAWNING") {
      drawText(
        ctx,
        label,
        { x: camp.pos.x, y: camp.pos.y + 5 },
        {
          font: "600 15px ui-sans-serif, system-ui, sans-serif",
          color: "rgba(148,163,184,0.7)",
        },
      );
      if (camp.phase === "RESPAWNING") {
        const t = 1 - camp.respawnIn / C.mobs.respawnSeconds;
        ctx.strokeStyle = "rgba(163,230,53,0.5)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(camp.pos.x, camp.pos.y, camp.radius, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2);
        ctx.stroke();
      }
    } else {
      drawText(
        ctx,
        label,
        { x: camp.pos.x, y: camp.pos.y - camp.radius - 16 },
        {
          font: "600 13px ui-sans-serif, system-ui, sans-serif",
          color: camp.phase === "COMBAT" ? "rgba(251,191,36,0.95)" : "rgba(163,230,53,0.8)",
        },
      );
    }
    ctx.restore();
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
  fillCircle(ctx, p, r, `rgba(56,189,248,${0.05 + pulse * 0.1})`);
  strokeCircle(ctx, p, r, {
    color: active ? `rgba(56,189,248,${0.4 + pulse * 0.6})` : "rgba(100,116,139,0.45)",
    width: 4,
    ...(active ? {} : { dash: [12, 14] }),
  });

  if (!active) {
    drawText(
      ctx,
      "CORE IDLE",
      { x: p.x, y: p.y + 6 },
      {
        font: "bold 20px ui-sans-serif, system-ui",
        color: "rgba(148,163,184,0.55)",
      },
    );
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
  const len = aiming
    ? ability === "q"
      ? C.abilities.q.range
      : ability === "w"
        ? C.abilities.w.distance
        : C.vanguard.attackRange
    : 90;
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

function healthBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  ratio: number,
  color: string,
) {
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x - w / 2, y, w, 6);
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, y, w * Math.max(0, ratio), 6);
}

function drawFighter(ctx: CanvasRenderingContext2D, f: Fighter, color: string) {
  if (!f.alive) return;
  inLocalSpace(ctx, f.pos, 0, () => {
    if (f.ultActiveFor > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 90);
      fillCircle(ctx, ORIGIN, f.radius + 14 + pulse * 4, "rgba(251,191,36,0.2)");
      strokeCircle(ctx, ORIGIN, f.radius + 14 + pulse * 4, {
        color: "rgba(251,191,36,0.9)",
        width: 3,
      });
    }
    if (f.invulnFor > 0 || f.dashFor > 0) {
      // i-frame indicator: rotating dashed shield so dodges are unmistakable
      inLocalSpace(ctx, ORIGIN, Date.now() / 220, () => {
        strokeCircle(ctx, ORIGIN, f.radius + 11, {
          color: "rgba(163,230,53,0.95)",
          width: 3,
          dash: [9, 7],
          glow: 16,
        });
      });
    }
    if (f.buffs.overchargeFor > 0) {
      strokeCircle(ctx, ORIGIN, f.radius + 9, { color: "rgba(56,189,248,0.8)", width: 2 });
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
  });

  healthBar(ctx, f.pos.x, f.pos.y - f.radius - 18, 60, f.hp / f.maxHp, color);
}

function drawMob(ctx: CanvasRenderingContext2D, m: Mob) {
  const guardian = m.kind === "guardian";
  const hostile = m.state === "CHASE" || m.state === "ATTACK" || m.state === "AGGRO";
  inLocalSpace(ctx, m.pos, 0, () => {
    ctx.shadowColor = guardian ? "#f59e0b" : hostile ? "#facc15" : "#65a30d";
    ctx.shadowBlur = guardian ? 26 : hostile ? 14 : 8;
    ctx.beginPath();
    if (guardian) {
      ctx.moveTo(0, -m.radius);
      ctx.lineTo(m.radius, 0);
      ctx.lineTo(0, m.radius);
      ctx.lineTo(-m.radius, 0);
      ctx.closePath();
    } else {
      // spiky hexagon — deliberately NOT a smooth circle so it never reads as a player
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? m.radius : m.radius * 0.72;
        const fn = i === 0 ? "moveTo" : "lineTo";
        ctx[fn](Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
    }
    ctx.fillStyle =
      m.hitFlash > 0 ? "#ffffff" : guardian ? "#f59e0b" : hostile ? "#a16207" : "#4d7c0f";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = hostile ? "#facc15" : "#84cc16";
    ctx.stroke();
  });

  if (!guardian && m.state === "AGGRO") {
    ctx.save();
    drawText(
      ctx,
      "!",
      { x: m.pos.x, y: m.pos.y - m.radius - 18 },
      {
        font: "700 16px ui-sans-serif, system-ui, sans-serif",
        color: "#facc15",
      },
    );
    ctx.restore();
  }

  healthBar(
    ctx,
    m.pos.x,
    m.pos.y - m.radius - 14,
    guardian ? 90 : 36,
    m.hp / m.maxHp,
    guardian ? "#f59e0b" : "#a3e635",
  );
}

function drawProjectiles(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  for (const p of engine.projectiles) {
    const isQ = p.kind === "q";
    // ATK = thin cyan/rose dart, Q = fat violet/amber orb. Never the same read.
    const colors = teamColors(p.team);
    const core = isQ ? colors.projectileCoreQ : colors.projectileCore;
    const glow = isQ ? colors.projectileGlowQ : colors.projectileGlow;
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

    inLocalSpace(ctx, p.pos, ang, () => {
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
    });
  }
}

function drawEffectsUnder(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  for (const e of engine.effects) {
    const t = e.life / e.maxLife;
    if (e.kind === "dash-trail") {
      fillCircle(ctx, e.pos, (e.radius ?? 20) * (0.4 + t * 0.6), e.color ?? "#38bdf8", t * 0.35);
    }
    if (e.kind === "telegraph-line" && e.dir) {
      // charge-up lane: fills toward the caster's aim during the windup
      const charge = 1 - t;
      const len = e.radius ?? 400;
      const color = e.color ?? "#a78bfa";
      inLocalSpace(ctx, e.pos, Math.atan2(e.dir.y, e.dir.x), () => {
        ctx.fillStyle = `${color}22`;
        ctx.fillRect(0, -18, len, 36);
        ctx.fillStyle = `${color}55`;
        ctx.fillRect(0, -18, len * charge, 36);
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.45 + 0.55 * charge;
        ctx.lineWidth = 2;
        ctx.strokeRect(0, -18, len, 36);
      });
    }

    if (e.kind === "shockwave") {
      const color = e.color ?? "#60a5fa";
      const radius = (e.radius ?? 100) * (1 - t * 0.35);
      fillCircle(ctx, e.pos, radius, `${color}22`);
      strokeCircle(ctx, e.pos, radius, { color, width: 3 });
    }
  }
}

function drawEffectsOver(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  for (const e of engine.effects) {
    const t = e.life / e.maxLife;
    if (e.kind === "muzzle" && e.dir) {
      inLocalSpace(ctx, e.pos, Math.atan2(e.dir.y, e.dir.x), () => {
        ctx.globalAlpha = t;
        ctx.fillStyle = e.color ?? "#67e8f9";
        ctx.beginPath();
        ctx.ellipse(
          0,
          0,
          (e.radius ?? 16) * (1.2 - t * 0.4),
          (e.radius ?? 16) * 0.45,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      });
    }
    if (e.kind === "slash" && e.dir) {
      const a = Math.atan2(e.dir.y, e.dir.x);
      ctx.beginPath();
      ctx.arc(
        e.pos.x,
        e.pos.y,
        (e.radius ?? 120) * 0.85,
        a - C.vanguard.attackArc,
        a + C.vanguard.attackArc,
      );
      ctx.strokeStyle = `${e.color ?? "#38bdf8"}`;
      ctx.globalAlpha = t;
      ctx.lineWidth = 10;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (e.kind === "hit" || e.kind === "core-ring") {
      strokeCircle(ctx, e.pos, (e.radius ?? 20) * (1.6 - t), {
        color: e.color ?? "#fef08a",
        width: 3,
        alpha: t,
      });
    }
    if (e.kind === "impact-ring") {
      strokeCircle(ctx, e.pos, (e.radius ?? 24) * (0.35 + (1 - t) * 1.1), {
        color: e.color ?? "#fbbf24",
        width: 2 + t * 5,
        alpha: t * 0.9,
      });
    }
    if (e.kind === "dodge-ring") {
      strokeCircle(ctx, e.pos, (e.radius ?? 30) * (0.5 + (1 - t) * 0.9), {
        color: e.color ?? "#a3e635",
        width: 3,
        alpha: t,
        dash: [10, 8],
        glow: 18,
      });
    }
    if (e.kind === "fizzle") {
      fillCircle(
        ctx,
        e.pos,
        (e.radius ?? 10) * (0.6 + (1 - t) * 0.8),
        e.color ?? "#94a3b8",
        t * 0.45,
      );
    }
    if (e.kind === "text" && e.text) {
      const dodge = e.text === "DODGE";
      ctx.font = dodge
        ? "bold 20px ui-sans-serif, system-ui"
        : "bold 24px ui-sans-serif, system-ui";
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
  ctx.restore();
  strokeCircle(ctx, engine.corePos, engine.safeRadius, { color: "rgba(239,68,68,0.8)", width: 4 });
}
