import { GAME_CONFIG } from "../config/gameConfig";
import { dist, norm, scale, sub, type Rect, type Vec } from "../core/math";
import type { Camp, Fighter, InputCommand, Mob, Projectile, UpgradeKind } from "../core/types";

export type AIDifficulty = "easy" | "normal" | "hard";

export type AIWorld = {
  self: Fighter;
  foe: Fighter;
  mobs: Mob[];
  camps: Camp[];
  projectiles: Projectile[];
  walls: readonly Rect[];
  coreActive: boolean;
  corePos: Vec;
  /** same purchase entry point the human HUD uses */
  buy: (kind: UpgradeKind) => boolean;
};

export type AIController = { think(w: AIWorld, dt: number): InputCommand };

/** FIGHT = duel the player, FARM = clear a camp, CONTEST = punish a farming player, RETREAT = disengage. */
type AIMode = "FIGHT" | "FARM" | "CONTEST" | "RETREAT";

type AimTarget = { pos: Vec; vel: Vec; radius: number };

const rot = (v: Vec, a: number): Vec => ({
  x: v.x * Math.cos(a) - v.y * Math.sin(a),
  y: v.x * Math.sin(a) + v.y * Math.cos(a),
});

const ZERO: Vec = { x: 0, y: 0 };

/**
 * Cheap projectile leading: two fixed-point iterations of
 * "how long until the shot arrives -> where will they be then".
 * Never solves the exact quadratic; that is intentional.
 */
function leadAim(
  self: Fighter,
  target: AimTarget,
  projectileSpeed: number,
  leadFactor: number,
): Vec {
  let t = dist(self.pos, target.pos) / projectileSpeed;
  for (let i = 0; i < 2; i++) {
    const px = target.pos.x + target.vel.x * t * leadFactor;
    const py = target.pos.y + target.vel.y * t * leadFactor;
    t = Math.min(
      GAME_CONFIG.ai.maxLeadSeconds,
      Math.hypot(px - self.pos.x, py - self.pos.y) / projectileSpeed,
    );
  }
  const predicted: Vec = {
    x: target.pos.x + target.vel.x * t * leadFactor,
    y: target.pos.y + target.vel.y * t * leadFactor,
  };
  return norm(sub(predicted, self.pos));
}

function nearestMob(mobs: Mob[], p: Vec, maxDist = Infinity): Mob | null {
  let best: Mob | null = null;
  let bd = maxDist;
  for (const m of mobs) {
    if (!m.alive) continue;
    const d = dist(m.pos, p);
    if (d < bd) {
      bd = d;
      best = m;
    }
  }
  return best;
}

/**
 * Local opponent AI. Emits the same InputCommand shape as a human, so it can be
 * swapped for a network peer later. Intentionally imperfect.
 */
export function createAIController(
  difficulty: AIDifficulty = GAME_CONFIG.ai.difficulty,
): AIController {
  const cfg = GAME_CONFIG.ai.levels[difficulty];
  const FARM = GAME_CONFIG.ai.farm;
  let reactionTimer = cfg.reaction;
  let strafeDir = Math.random() < 0.5 ? 1 : -1;
  let strafeTimer = 1.2;
  let decision: InputCommand["cast"] = null;
  let mode: AIMode = "FIGHT";
  let modeTimer = 0;
  let campId: number | null = null;
  let buyTimer = cfg.buyInterval;

  /** Very small behaviour selector — re-evaluated a couple of times per second. */
  function pickMode(w: AIWorld): AIMode {
    const { self, foe } = w;
    const hp = self.hp / self.maxHp;
    const range = dist(self.pos, foe.pos);
    const farmable = w.camps.filter((c) => c.phase === "AVAILABLE" || c.phase === "COMBAT");

    if (hp < FARM.retreatHpRatio && range < 700) return "RETREAT";
    if (mode === "RETREAT" && hp < FARM.resumeHpRatio) return "RETREAT";

    // the player is sitting in a camp -> maybe go punish them
    const contested = farmable.find((c) => dist(foe.pos, c.pos) < FARM.contestRadius);
    if (contested && hp > 0.5 && Math.random() < cfg.contestChance) {
      campId = contested.id;
      return "CONTEST";
    }

    if (farmable.length && range > FARM.safeDistance && Math.random() < cfg.farmChance) {
      const target = farmable.reduce((a, b) =>
        dist(self.pos, a.pos) < dist(self.pos, b.pos) ? a : b,
      );
      campId = target.id;
      return "FARM";
    }
    return "FIGHT";
  }

  return {
    think(w: AIWorld, dt: number): InputCommand {
      const { self, foe } = w;
      const C = GAME_CONFIG;
      strafeTimer -= dt;
      if (strafeTimer <= 0) {
        strafeTimer = 0.8 + Math.random() * 1.4;
        strafeDir *= -1;
      }

      // ---- spend essence like a player would ----
      buyTimer -= dt;
      if (buyTimer <= 0) {
        buyTimer = cfg.buyInterval;
        const order: UpgradeKind[] =
          self.hp / self.maxHp < 0.5
            ? ["vitality", "power", "haste"]
            : ["power", "haste", "vitality"];
        for (const k of order) if (w.buy(k)) break;
      }

      // ---- behaviour selection ----
      modeTimer -= dt;
      if (modeTimer <= 0) {
        modeTimer = FARM.decisionInterval;
        mode = pickMode(w);
      }
      const camp = campId === null ? null : (w.camps.find((c) => c.id === campId) ?? null);
      if (
        (mode === "FARM" || mode === "CONTEST") &&
        (!camp || camp.phase === "CLEARED" || camp.phase === "RESPAWNING")
      ) {
        mode = "FIGHT";
      }

      const toFoe = norm(sub(foe.pos, self.pos));
      const range = dist(self.pos, foe.pos);

      // pick what we are actually shooting at this frame
      const campMob = camp
        ? nearestMob(
            w.mobs.filter((m) => m.campId === camp.id),
            self.pos,
          )
        : null;
      const closeMob = nearestMob(w.mobs, self.pos, 200);
      const attackMob =
        mode === "FARM" ? (campMob ?? closeMob) : mode === "CONTEST" ? null : closeMob;
      const engaged: AimTarget =
        attackMob && (mode === "FARM" || range > 360)
          ? { pos: attackMob.pos, vel: ZERO, radius: attackMob.radius }
          : { pos: foe.pos, vel: foe.vel, radius: foe.radius };
      const toTarget = norm(sub(engaged.pos, self.pos));
      const targetRange = dist(self.pos, engaged.pos);

      // ---- movement ----
      const perp: Vec = { x: -toTarget.y * strafeDir, y: toTarget.x * strafeDir };
      let move: Vec;
      if (mode === "RETREAT") {
        move = norm({ x: -toFoe.x + perp.x * 0.4, y: -toFoe.y + perp.y * 0.4 });
      } else if (mode === "FARM" && campMob) {
        // close in on the crawler, then hold a short poke distance
        const delta = targetRange - 190;
        move =
          Math.abs(delta) < 40
            ? perp
            : norm({ x: toTarget.x * Math.sign(delta), y: toTarget.y * Math.sign(delta) });
      } else if (mode === "CONTEST" && camp && dist(self.pos, camp.pos) > FARM.contestRadius) {
        move = norm(sub(camp.pos, self.pos));
      } else {
        const delta = range - cfg.preferredRange;
        if (Math.abs(delta) < 60) move = perp;
        else
          move = norm({
            x: toFoe.x * Math.sign(delta) + perp.x * cfg.strafe,
            y: toFoe.y * Math.sign(delta) + perp.y * cfg.strafe,
          });
      }

      // avoid hugging walls: nudge away from any wall we are close to
      for (const wall of w.walls) {
        const cx = Math.max(wall.x, Math.min(self.pos.x, wall.x + wall.w));
        const cy = Math.max(wall.y, Math.min(self.pos.y, wall.y + wall.h));
        const d = Math.hypot(self.pos.x - cx, self.pos.y - cy);
        if (d < self.radius + 26) {
          const away = norm({ x: self.pos.x - cx, y: self.pos.y - cy });
          move = norm({ x: move.x + away.x * 1.4, y: move.y + away.y * 1.4 });
        }
      }

      // ---- threat detection: dodge incoming projectiles with W ----
      let threatened = false;
      for (const p of w.projectiles) {
        if (p.team === self.team) continue;
        const rel = sub(self.pos, p.pos);
        const closing = rel.x * p.dir.x + rel.y * p.dir.y;
        if (closing <= 0 || closing > C.ai.dodgeThreatDistance * 2.2) continue;
        const closest = scale(p.dir, closing);
        const perpDist = Math.hypot(rel.x - closest.x, rel.y - closest.y);
        if (perpDist < self.radius + p.radius + 26 && closing < C.ai.dodgeThreatDistance) {
          threatened = true;
          break;
        }
      }

      reactionTimer -= dt;
      if (reactionTimer <= 0) {
        reactionTimer = cfg.reaction;
        decision = null;
        const dueling = engaged.pos === foe.pos;
        if (threatened && self.cooldowns.w <= 0 && Math.random() < cfg.dodgeChance) decision = "w";
        else if (mode === "RETREAT" && self.cooldowns.w <= 0 && range < 300) decision = "w";
        else if (
          dueling &&
          self.ultCharge >= C.abilities.r.chargeMax &&
          range < 420 &&
          Math.random() < cfg.useUlt
        )
          decision = "r";
        else if (
          self.cooldowns.q <= 0 &&
          targetRange < C.abilities.q.range * 0.8 &&
          Math.random() < cfg.qChance
        )
          decision = "q";
        else if (self.cooldowns.basic <= 0 && targetRange < C.vanguard.attackRange * 0.9)
          decision = "basic";
      }

      let cast = decision;
      decision = null;

      // ---- aiming: lead the target for projectiles, then add human-ish error ----
      let aim: Vec;
      if (cast === "q" || cast === "basic") {
        const projSpeed = cast === "q" ? C.abilities.q.speed : C.vanguard.attackProjectileSpeed;
        // Q also has to cover its own windup, so treat it as a slower shot
        const effSpeed =
          cast === "q"
            ? projSpeed /
              (1 + (C.abilities.q.qTelegraphDuration * projSpeed) / Math.max(1, targetRange))
            : projSpeed;
        aim = leadAim(self, engaged, effSpeed, cfg.leadFactor);
        aim = rot(aim, (Math.random() - 0.5) * (cfg.aimError + cfg.leadError) * 2);
      } else {
        aim = rot(toTarget, (Math.random() - 0.5) * cfg.aimError * 2);
      }

      // dodge sideways when we burn the dash
      if (cast === "w") {
        const dodgeDir: Vec =
          mode === "RETREAT" ? move : { x: -toFoe.y * strafeDir, y: toFoe.x * strafeDir };
        return { move: dodgeDir, aim: dodgeDir, cast };
      }
      if (cast && self.cooldowns[cast] > 0) cast = null;

      return { move, aim, cast };
    },
  };
}
