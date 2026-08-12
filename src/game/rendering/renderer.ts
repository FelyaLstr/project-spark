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

  drawFloor(ctx, engine.time);
  drawCamps(ctx, engine);
  drawCore(ctx, engine);
  drawWalls(ctx);
  drawEffectsUnder(ctx, engine);
  drawAimIndicator(ctx, engine);
  for (const m of engine.mobs) if (m.alive) drawMob(ctx, m, engine.time);

  drawFighter(ctx, engine.enemy, "#fb7185", "#7f1d3a");
  drawFighter(ctx, engine.player, "#38bdf8", "#0e4a6e");

  drawProjectiles(ctx, engine);
  drawEffectsOver(ctx, engine);
  drawSafeZone(ctx, engine);

  ctx.restore();

  // screen-space grade: vignette + overdrive tint (cosmetic only)
  ctx.save();
  ctx.scale(dpr, dpr);
  const vig = ctx.createRadialGradient(viewW / 2, viewH / 2, Math.min(viewW, viewH) * 0.35, viewW / 2, viewH / 2, Math.max(viewW, viewH) * 0.78);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(2,3,8,0.72)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, viewW, viewH);
  if (engine.player.alive && engine.player.ultActiveFor > 0) {
    const k = 0.1 + 0.06 * Math.sin(Date.now() / 90);
    const og = ctx.createRadialGradient(viewW / 2, viewH / 2, Math.min(viewW, viewH) * 0.25, viewW / 2, viewH / 2, Math.max(viewW, viewH) * 0.7);
    og.addColorStop(0, "rgba(251,191,36,0)");
    og.addColorStop(1, `rgba(251,191,36,${k})`);
    ctx.fillStyle = og;
    ctx.fillRect(0, 0, viewW, viewH);
  }
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


function drawFloor(ctx: CanvasRenderingContext2D, time: number) {
  const W = C.arena.width;
  const H = C.arena.height;
  const cx = W / 2;
  const cy = H / 2;

  const g = ctx.createRadialGradient(cx, cy, 80, cx, cy, Math.max(W, H) * 0.75);
  g.addColorStop(0, "#151a30");
  g.addColorStop(0.55, "#0c0f1e");
  g.addColorStop(1, "#05060d");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // fine weave texture — two offset grids read as dark stone tiling
  ctx.save();
  ctx.strokeStyle = "rgba(125,211,252,0.035)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 40) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let y = 0; y <= H; y += 40) {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();

  ctx.strokeStyle = "rgba(139,92,246,0.06)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 160) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let y = 0; y <= H; y += 160) {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();
  ctx.restore();

  // central magic composition: slow counter-rotating rune rings
  ctx.save();
  ctx.translate(cx, cy);
  const breathe = 0.5 + 0.5 * Math.sin(time * 0.7);
  ctx.strokeStyle = `rgba(139,92,246,${0.1 + breathe * 0.06})`;
  ctx.lineWidth = 2;
  for (const r of [230, 340, 470]) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.rotate(time * 0.05);
  ctx.strokeStyle = `rgba(56,189,248,${0.12 + breathe * 0.08})`;
  ctx.lineWidth = 3;
  ctx.setLineDash([28, 46]);
  ctx.beginPath();
  ctx.arc(0, 0, 300, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.rotate(-time * 0.09);
  ctx.strokeStyle = "rgba(139,92,246,0.16)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const fn = i === 0 ? "moveTo" : "lineTo";
    ctx[fn](Math.cos(a) * 400, Math.sin(a) * 400);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  // boundary: inner falloff + double neon edge
  ctx.save();
  const edge = ctx.createLinearGradient(0, 0, 0, 120);
  edge.addColorStop(0, "rgba(56,189,248,0.10)");
  edge.addColorStop(1, "rgba(56,189,248,0)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, W, 120);
  ctx.save();
  ctx.translate(0, H);
  ctx.scale(1, -1);
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, W, 120);
  ctx.restore();
  ctx.shadowColor = "rgba(56,189,248,0.8)";
  ctx.shadowBlur = 26;
  ctx.strokeStyle = "rgba(125,211,252,0.55)";
  ctx.lineWidth = 5;
  ctx.strokeRect(0, 0, W, H);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(139,92,246,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.restore();

  // spawn pads — glowing sigils
  for (const [pad, hue] of [
    [C.arena.spawnA, "56,189,248"],
    [C.arena.spawnB, "251,113,133"],
  ] as const) {
    ctx.save();
    ctx.translate(pad.x, pad.y);
    const pg = ctx.createRadialGradient(0, 0, 6, 0, 0, 78);
    pg.addColorStop(0, `rgba(${hue},0.22)`);
    pg.addColorStop(1, `rgba(${hue},0)`);
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(0, 0, 78, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(time * 0.25);
    ctx.strokeStyle = `rgba(${hue},0.4)`;
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 18]);
    ctx.beginPath();
    ctx.arc(0, 0, 56, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}


/** Subtle camp state indicators: available / in combat / cleared / respawning. */
function drawCamps(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  if (!C.features.neutralMobs) return;
  const pulse = 0.5 + 0.5 * Math.sin(engine.time * 3);
  for (const camp of engine.camps) {
    const style =
      camp.phase === "COMBAT"
        ? { stroke: `rgba(251,191,36,${0.35 + pulse * 0.35})`, fill: "rgba(251,191,36,0.05)", dash: [] as number[] }
        : camp.phase === "AVAILABLE"
          ? { stroke: "rgba(163,230,53,0.32)", fill: "rgba(163,230,53,0.05)", dash: [] }
          : camp.phase === "PENDING"
            ? { stroke: "rgba(148,163,184,0.14)", fill: "rgba(148,163,184,0.02)", dash: [10, 12] }
            : { stroke: "rgba(148,163,184,0.24)", fill: "rgba(148,163,184,0.03)", dash: [6, 10] };

    ctx.save();
    ctx.setLineDash(style.dash);
    ctx.lineWidth = 3;
    ctx.strokeStyle = style.stroke;
    ctx.fillStyle = style.fill;
    ctx.beginPath();
    ctx.arc(camp.pos.x, camp.pos.y, camp.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    // magical ground markings — purely decorative, no gameplay meaning
    ctx.save();
    ctx.translate(camp.pos.x, camp.pos.y);
    ctx.globalAlpha = camp.phase === "PENDING" ? 0.25 : 0.6;
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = 1.5;
    ctx.rotate(engine.time * 0.15);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const fn = i === 0 ? "moveTo" : "lineTo";
      ctx[fn](Math.cos(a) * camp.radius * 0.62, Math.sin(a) * camp.radius * 0.62);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.rotate(-engine.time * 0.35);
    ctx.beginPath();
    ctx.arc(0, 0, camp.radius * 0.38, 0, Math.PI * 2);
    ctx.setLineDash([8, 14]);
    ctx.stroke();
    ctx.restore();


    const label =
      camp.phase === "COMBAT"
        ? "COMBAT"
        : camp.phase === "AVAILABLE"
          ? "AVAILABLE"
          : camp.phase === "CLEARED"
            ? "CLEARED"
            : `RESPAWN ${Math.ceil(camp.respawnIn)}s`;

    if (camp.phase === "CLEARED" || camp.phase === "RESPAWNING") {
      ctx.fillStyle = "rgba(148,163,184,0.7)";
      ctx.font = "600 15px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, camp.pos.x, camp.pos.y + 5);
      if (camp.phase === "RESPAWNING") {
        const t = 1 - camp.respawnIn / C.mobs.respawnSeconds;
        ctx.strokeStyle = "rgba(163,230,53,0.5)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(camp.pos.x, camp.pos.y, camp.radius, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = camp.phase === "COMBAT" ? "rgba(251,191,36,0.95)" : "rgba(163,230,53,0.8)";
      ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, camp.pos.x, camp.pos.y - camp.radius - 16);
    }
    ctx.restore();
  }

}

function drawWalls(ctx: CanvasRenderingContext2D) {
  // Purely cosmetic: identical rect geometry, richer shading. Collision untouched.
  for (const w of C.arena.walls) {
    ctx.save();
    // grounded shadow
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(w.x + 4, w.y + 6, w.w, w.h);

    const g = ctx.createLinearGradient(w.x, w.y, w.x, w.y + w.h);
    g.addColorStop(0, "#2a3555");
    g.addColorStop(0.35, "#1c2440");
    g.addColorStop(1, "#111726");
    ctx.fillStyle = g;
    ctx.fillRect(w.x, w.y, w.w, w.h);

    // engraved inner line
    ctx.strokeStyle = "rgba(139,92,246,0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(w.x + 6, w.y + 6, Math.max(0, w.w - 12), Math.max(0, w.h - 12));

    // neon crest
    ctx.fillStyle = "rgba(125,211,252,0.22)";
    ctx.fillRect(w.x, w.y, w.w, 4);
    ctx.shadowColor = "rgba(56,189,248,0.7)";
    ctx.shadowBlur = 14;
    ctx.strokeStyle = "rgba(125,211,252,0.6)";
    ctx.lineWidth = 2;
    ctx.strokeRect(w.x, w.y, w.w, w.h);
    ctx.restore();
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
  const h = 6;
  ctx.save();
  ctx.fillStyle = "rgba(3,6,14,0.8)";
  ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = "rgba(148,163,184,0.18)";
  ctx.fillRect(x - w / 2, y, w, h);
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, y, w * Math.max(0, ratio), h);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(x - w / 2, y, w * Math.max(0, ratio), 2);
  ctx.restore();
}


function drawFighter(ctx: CanvasRenderingContext2D, f: Fighter, color: string, dark: string) {
  if (!f.alive) return;
  const now = Date.now();
  ctx.save();
  ctx.translate(f.pos.x, f.pos.y);

  // contact shadow — separates the silhouette from the floor
  ctx.save();
  ctx.scale(1, 0.45);
  ctx.beginPath();
  ctx.arc(0, f.radius * 1.5, f.radius * 1.05, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fill();
  ctx.restore();

  if (f.ultActiveFor > 0) {
    // OVERDRIVE: layered amber aura + rotating blades
    const pulse = 0.5 + 0.5 * Math.sin(now / 90);
    const ag = ctx.createRadialGradient(0, 0, f.radius, 0, 0, f.radius + 44 + pulse * 8);
    ag.addColorStop(0, "rgba(251,191,36,0.32)");
    ag.addColorStop(1, "rgba(251,191,36,0)");
    ctx.fillStyle = ag;
    ctx.beginPath();
    ctx.arc(0, 0, f.radius + 46 + pulse * 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.rotate(now / 320);
    ctx.strokeStyle = `rgba(253,224,71,${0.65 + pulse * 0.3})`;
    ctx.shadowColor = "rgba(251,191,36,0.9)";
    ctx.shadowBlur = 20;
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 14]);
    ctx.beginPath();
    ctx.arc(0, 0, f.radius + 16 + pulse * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (f.invulnFor > 0 || f.dashFor > 0) {
    // i-frame indicator: rotating dashed shield so dodges are unmistakable
    ctx.save();
    ctx.rotate(now / 220);
    ctx.beginPath();
    ctx.arc(0, 0, f.radius + 11, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(163,230,53,0.95)";
    ctx.shadowColor = "rgba(163,230,53,0.9)";
    ctx.shadowBlur = 18;
    ctx.setLineDash([9, 7]);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.rotate(-now / 110);
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, f.radius + 17, 0, Math.PI * 2);
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

  // team glow pool
  const glow = ctx.createRadialGradient(0, 0, f.radius * 0.6, 0, 0, f.radius + 26);
  glow.addColorStop(0, `${color}55`);
  glow.addColorStop(1, `${color}00`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, f.radius + 26, 0, Math.PI * 2);
  ctx.fill();

  // body: shaded orb with hard neon rim for a clean silhouette
  ctx.save();
  ctx.rotate(f.facing);
  const body = ctx.createRadialGradient(-f.radius * 0.35, -f.radius * 0.4, f.radius * 0.15, 0, 0, f.radius);
  if (f.hitFlash > 0) {
    body.addColorStop(0, "#ffffff");
    body.addColorStop(1, "#ffffff");
  } else {
    body.addColorStop(0, "#f8fbff");
    body.addColorStop(0.45, color);
    body.addColorStop(1, dark);
  }
  ctx.beginPath();
  ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "rgba(240,249,255,0.9)";
  ctx.stroke();
  ctx.shadowBlur = 0;

  // shoulder plates read as a facing-aware silhouette
  ctx.beginPath();
  ctx.moveTo(-f.radius * 0.2, -f.radius * 1.05);
  ctx.lineTo(f.radius * 0.55, -f.radius * 0.55);
  ctx.lineTo(f.radius * 0.55, f.radius * 0.55);
  ctx.lineTo(-f.radius * 0.2, f.radius * 1.05);
  ctx.closePath();
  ctx.fillStyle = `${dark}cc`;
  ctx.fill();
  ctx.strokeStyle = `${color}`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // weapon prong
  ctx.beginPath();
  ctx.moveTo(f.radius - 2, 0);
  ctx.lineTo(f.radius + 18, 0);
  ctx.strokeStyle = "#f1f5f9";
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();
  ctx.restore();

  healthBar(ctx, f.pos.x, f.pos.y - f.radius - 18, 60, f.hp / f.maxHp, color);
}


function drawMob(ctx: CanvasRenderingContext2D, m: Mob, time: number) {
  const guardian = m.kind === "guardian";
  const hostile = m.state === "CHASE" || m.state === "ATTACK" || m.state === "AGGRO";
  const accent = guardian ? "#f59e0b" : hostile ? "#facc15" : "#a3e635";
  const bob = Math.sin(time * 3 + m.pos.x * 0.01) * 2;

  // contact shadow keeps neutrals grounded in the arena
  ctx.save();
  ctx.translate(m.pos.x, m.pos.y);
  ctx.save();
  ctx.scale(1, 0.4);
  ctx.beginPath();
  ctx.arc(0, m.radius * 1.8, m.radius * 0.95, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fill();
  ctx.restore();

  ctx.translate(0, bob);
  // corrupted aura
  const ag = ctx.createRadialGradient(0, 0, m.radius * 0.4, 0, 0, m.radius * 2.1);
  ag.addColorStop(0, `${accent}33`);
  ag.addColorStop(1, `${accent}00`);
  ctx.fillStyle = ag;
  ctx.beginPath();
  ctx.arc(0, 0, m.radius * 2.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.rotate(guardian ? time * 0.4 : time * (hostile ? 1.3 : 0.5));
  ctx.shadowColor = accent;
  ctx.shadowBlur = guardian ? 26 : hostile ? 18 : 10;
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
  const body = ctx.createRadialGradient(0, 0, m.radius * 0.15, 0, 0, m.radius);
  if (m.hitFlash > 0) {
    body.addColorStop(0, "#ffffff");
    body.addColorStop(1, "#ffffff");
  } else {
    body.addColorStop(0, guardian ? "#fde68a" : hostile ? "#fde047" : "#65a30d");
    body.addColorStop(1, guardian ? "#78350f" : hostile ? "#713f12" : "#1a2e05");
  }
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = accent;
  ctx.stroke();
  ctx.restore();

  // glowing inner core
  ctx.beginPath();
  ctx.arc(0, 0, m.radius * (0.28 + 0.06 * Math.sin(time * 6)), 0, Math.PI * 2);
  ctx.fillStyle = m.hitFlash > 0 ? "#ffffff" : accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 14;
  ctx.fill();
  ctx.restore();


  if (!guardian && m.state === "AGGRO") {
    ctx.save();
    ctx.fillStyle = "#facc15";
    ctx.font = "700 16px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("!", m.pos.x, m.pos.y - m.radius - 18);
    ctx.restore();
  }

  healthBar(ctx, m.pos.x, m.pos.y - m.radius - 14, guardian ? 90 : 36, m.hp / m.maxHp, guardian ? "#f59e0b" : "#a3e635");
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
      const c = e.color ?? "#38bdf8";
      const r = (e.radius ?? 20) * (0.4 + t * 0.6);
      const g = ctx.createRadialGradient(e.pos.x, e.pos.y, 0, e.pos.x, e.pos.y, r);
      g.addColorStop(0, `${c}88`);
      g.addColorStop(1, `${c}00`);
      ctx.globalAlpha = t * 0.8;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = t * 0.5;
      ctx.strokeStyle = c;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, r * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (e.kind === "telegraph-line" && e.dir) {
      // charge-up lane: fills toward the caster's aim during the windup
      const charge = 1 - t;
      const len = e.radius ?? 400;
      const c = e.color ?? "#a78bfa";
      ctx.save();
      ctx.translate(e.pos.x, e.pos.y);
      ctx.rotate(Math.atan2(e.dir.y, e.dir.x));
      ctx.fillStyle = `${c}1f`;
      ctx.fillRect(0, -18, len, 36);
      const fill = ctx.createLinearGradient(0, 0, len * Math.max(charge, 0.001), 0);
      fill.addColorStop(0, `${c}88`);
      fill.addColorStop(1, `${c}33`);
      ctx.fillStyle = fill;
      ctx.fillRect(0, -18, len * charge, 36);
      // leading edge marker
      ctx.shadowColor = c;
      ctx.shadowBlur = 18;
      ctx.fillStyle = c;
      ctx.fillRect(len * charge - 2, -18, 4, 36);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = c;
      ctx.globalAlpha = 0.45 + 0.55 * charge;
      ctx.lineWidth = 2;
      ctx.setLineDash([14, 10]);
      ctx.strokeRect(0, -18, len, 36);
      ctx.setLineDash([]);
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
