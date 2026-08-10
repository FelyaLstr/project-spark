import { GAME_CONFIG } from "../config/gameConfig";
import { add, dist, norm, scale, sub, type Vec } from "../core/math";
import type { Camp, Effect, Fighter, Mob } from "../core/types";
import { spawnCampMobs } from "./mobs";

const C = GAME_CONFIG;

/** Everything the mob simulation is allowed to touch on the engine. */
export type MobContext = {
  mobs: Mob[];
  camps: Camp[];
  fighters: Fighter[];
  applyDamage: (source: Mob, target: Fighter, amount: number) => void;
  collide: (p: Vec, r: number) => Vec;
  pushEffect: (e: Omit<Effect, "id" | "maxLife"> & { life: number }) => void;
  later: (seconds: number, fn: () => void) => void;
};

const cfgOf = (m: Mob) => (m.kind === "crawler" ? C.mobs.crawler : C.mobs.guardian);

/**
 * Neutral mob simulation. Runs inside the engine's fixed game loop — never React.
 * State machine: IDLE -> AGGRO -> CHASE -> ATTACK -> RETURN -> IDLE (or DEAD).
 */
export function updateMobs(ctx: MobContext, dt: number) {
  updateCamps(ctx, dt);

  for (const m of ctx.mobs) {
    m.hitFlash = Math.max(0, m.hitFlash - dt);
    if (!m.alive) continue;

    const cfg = cfgOf(m);
    m.attackTimer = Math.max(0, m.attackTimer - dt);
    m.telegraphFor = Math.max(0, m.telegraphFor - dt);
    m.aggroFor = Math.max(0, m.aggroFor - dt);

    const live = ctx.fighters.filter((f) => f.alive);
    let target = live.find((f) => f.id === m.target) ?? null;

    // leash: too far from the camp -> forget everything and walk home
    if (dist(m.home, m.pos) > cfg.leash) {
      m.target = null;
      target = null;
      m.state = "RETURN";
    }

    if (!target) {
      const found = nearest(live, m.pos);
      if (found && dist(found.pos, m.pos) < cfg.aggroRange && m.state !== "RETURN") {
        target = found;
        m.target = found.id;
        m.state = "AGGRO";
        m.aggroFor = 0.18;
      }
    }

    if (m.state === "RETURN") {
      const d = dist(m.pos, m.home);
      if (d < 6) {
        m.state = "IDLE";
        m.hp = m.maxHp; // reset like a normal neutral camp
      } else {
        step(ctx, m, m.home, cfg.returnSpeed, dt);
      }
      continue;
    }

    if (!target) {
      m.state = "IDLE";
      // drift back onto the idle ring without the full RETURN reset
      if (dist(m.pos, m.home) > 8) step(ctx, m, m.home, cfg.speed * 0.6, dt);
      continue;
    }

    const gap = dist(m.pos, target.pos) - m.radius - target.radius;
    if (m.aggroFor > 0) {
      m.state = "AGGRO";
      continue;
    }

    if (gap > cfg.attackRange) {
      m.state = "CHASE";
      step(ctx, m, target.pos, cfg.speed, dt);
      continue;
    }

    m.state = "ATTACK";
    if (m.attackTimer > 0) continue;
    m.attackTimer = cfg.attackCooldown;

    if (m.kind === "guardian") {
      m.telegraphFor = C.mobs.guardian.telegraph;
      const pos = { ...m.pos };
      ctx.pushEffect({ kind: "shockwave", pos, radius: 120, life: C.mobs.guardian.telegraph, color: "#f59e0b" });
      ctx.later(C.mobs.guardian.telegraph, () => {
        for (const f of ctx.fighters) {
          if (f.alive && dist(pos, f.pos) < 120 + f.radius) ctx.applyDamage(m, f, cfg.damage);
        }
      });
    } else {
      ctx.pushEffect({
        kind: "slash",
        pos: { ...m.pos },
        dir: norm(sub(target.pos, m.pos)),
        radius: m.radius + 26,
        life: 0.16,
        color: "#a3e635",
      });
      ctx.applyDamage(m, target, cfg.damage);
    }
  }
}

/** Camp phase bookkeeping + whole-camp respawn. */
function updateCamps(ctx: MobContext, dt: number) {
  for (const camp of ctx.camps) {
    if (camp.phase === "PENDING") continue;

    const alive = ctx.mobs.some((m) => m.campId === camp.id && m.alive);

    if (camp.phase === "CLEARED" || camp.phase === "RESPAWNING") {
      camp.respawnIn = Math.max(0, camp.respawnIn - dt);
      // "CAMP CLEARED" reads for a moment, then it becomes a respawn countdown
      camp.phase = camp.respawnIn > C.mobs.respawnSeconds - 2 ? "CLEARED" : "RESPAWNING";
      if (camp.respawnIn <= 0) {
        for (let i = ctx.mobs.length - 1; i >= 0; i--) if (ctx.mobs[i]!.campId === camp.id) ctx.mobs.splice(i, 1);
        ctx.mobs.push(...spawnCampMobs(camp));
        camp.phase = "AVAILABLE";
        ctx.pushEffect({ kind: "core-ring", pos: { ...camp.pos }, radius: camp.radius, life: 0.7, color: "#a3e635" });
      }
      continue;
    }

    if (!alive) {
      camp.phase = "CLEARED";
      camp.respawnIn = C.mobs.respawnSeconds;
      continue;
    }

    const contested = ctx.fighters.some((f) => f.alive && dist(f.pos, camp.pos) < camp.radius + 60);
    const fighting = ctx.mobs.some((m) => m.campId === camp.id && m.alive && (m.state === "CHASE" || m.state === "ATTACK"));
    camp.phase = contested || fighting ? "COMBAT" : "AVAILABLE";
  }

}

function nearest(fs: Fighter[], p: Vec): Fighter | null {
  let best: Fighter | null = null;
  let bd = Infinity;
  for (const f of fs) {
    const d = dist(f.pos, p);
    if (d < bd) {
      bd = d;
      best = f;
    }
  }
  return best;
}

function step(ctx: MobContext, m: Mob, goal: Vec, speed: number, dt: number) {
  const dir = norm(sub(goal, m.pos));
  if (!dir.x && !dir.y) return;
  m.pos = ctx.collide(add(m.pos, scale(dir, speed * dt)), m.radius);
}
