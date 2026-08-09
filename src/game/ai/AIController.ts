import { GAME_CONFIG } from "../config/gameConfig";
import { dist, norm, scale, sub, type Rect, type Vec } from "../core/math";
import type { Fighter, InputCommand, Mob, Projectile } from "../core/types";

export type AIDifficulty = "easy" | "normal" | "hard";

export type AIWorld = {
  self: Fighter;
  foe: Fighter;
  mobs: Mob[];
  projectiles: Projectile[];
  walls: readonly Rect[];
  coreActive: boolean;
  corePos: Vec;
};

export type AIController = { think(w: AIWorld, dt: number): InputCommand };

const rot = (v: Vec, a: number): Vec => ({
  x: v.x * Math.cos(a) - v.y * Math.sin(a),
  y: v.x * Math.sin(a) + v.y * Math.cos(a),
});

/**
 * Local opponent AI. Emits the same InputCommand shape as a human, so it can be
 * swapped for a network peer later. Intentionally imperfect.
 */
export function createAIController(difficulty: AIDifficulty = GAME_CONFIG.ai.difficulty): AIController {
  const cfg = GAME_CONFIG.ai.levels[difficulty];
  let reactionTimer = cfg.reaction;
  let strafeDir = Math.random() < 0.5 ? 1 : -1;
  let strafeTimer = 1.2;
  let decision: InputCommand["cast"] = null;

  return {
    think(w: AIWorld, dt: number): InputCommand {
      const { self, foe } = w;
      const C = GAME_CONFIG;
      strafeTimer -= dt;
      if (strafeTimer <= 0) {
        strafeTimer = 0.8 + Math.random() * 1.4;
        strafeDir *= -1;
      }

      const toFoe = norm(sub(foe.pos, self.pos));
      const range = dist(self.pos, foe.pos);

      // ---- aiming (with error, so it can miss) ----
      const aim = rot(toFoe, (Math.random() - 0.5) * cfg.aimError * 2);

      // ---- kiting: keep preferred range, strafe sideways ----
      const perp: Vec = { x: -toFoe.y * strafeDir, y: toFoe.x * strafeDir };
      let move: Vec;
      const delta = range - cfg.preferredRange;
      if (Math.abs(delta) < 60) move = perp;
      else move = norm({ x: toFoe.x * Math.sign(delta) + perp.x * cfg.strafe, y: toFoe.y * Math.sign(delta) + perp.y * cfg.strafe });

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
        if (threatened && self.cooldowns.w <= 0 && Math.random() < cfg.dodgeChance) decision = "w";
        else if (self.ultCharge >= C.abilities.r.chargeMax && range < 420 && Math.random() < cfg.useUlt) decision = "r";
        else if (self.cooldowns.q <= 0 && range < C.abilities.q.range * 0.8 && Math.random() < cfg.qChance) decision = "q";
        else if (self.cooldowns.basic <= 0 && range < C.vanguard.attackRange * 0.9) decision = "basic";
      }

      let cast = decision;
      decision = null;

      // dodge sideways when we burn the dash
      if (cast === "w") {
        const dodgeDir: Vec = { x: -toFoe.y * strafeDir, y: toFoe.x * strafeDir };
        return { move: dodgeDir, aim: dodgeDir, cast };
      }
      if (cast && self.cooldowns[cast] > 0) cast = null;

      return { move, aim, cast };
    },
  };
}
