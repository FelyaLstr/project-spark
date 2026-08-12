import { GAME_CONFIG } from "../config/gameConfig";
import { createIdSource } from "../core/ids";
import type { Camp, Mob, MobKind } from "../core/types";
import type { Vec } from "../core/math";

const ids = createIdSource();

export const resetMobIds = () => ids.reset();

/** Stats for a mob kind. Every system reads mob tuning through here. */
export const mobConfig = (kind: MobKind) =>
  kind === "crawler" ? GAME_CONFIG.mobs.crawler : GAME_CONFIG.mobs.guardian;

export function makeMob(kind: MobKind, home: Vec, campId: number): Mob {
  const c = mobConfig(kind);
  return {
    id: ids.next(kind),
    kind,
    campId,
    state: "IDLE",
    pos: { ...home },
    home: { ...home },
    hp: c.hp,
    maxHp: c.hp,
    radius: c.radius,
    target: null,
    attackTimer: 0,
    aggroFor: 0,
    telegraphFor: 0,
    hitFlash: 0,
    alive: true,
    respawnIn: 0,
  };
}

/** Fresh camp descriptors — all camps start PENDING until the timeline activates them. */
export function makeCamps(): Camp[] {
  return GAME_CONFIG.mobs.camps.map((c, i) => ({
    id: i,
    pos: { x: c.x, y: c.y },
    radius: GAME_CONFIG.mobs.campRadius,
    phase: "PENDING" as const,
    respawnIn: 0,
  }));
}

/** Spawn (or respawn) every crawler of a single camp on a small ring. */
export function spawnCampMobs(camp: Camp): Mob[] {
  const M = GAME_CONFIG.mobs;
  const out: Mob[] = [];
  for (let i = 0; i < M.crawlersPerCamp; i++) {
    const a = (i / M.crawlersPerCamp) * Math.PI * 2 - Math.PI / 2;
    out.push(
      makeMob(
        "crawler",
        { x: camp.pos.x + Math.cos(a) * M.campSpread, y: camp.pos.y + Math.sin(a) * M.campSpread },
        camp.id,
      ),
    );
  }
  return out;
}

export function spawnGuardian(): Mob {
  return makeMob(
    "guardian",
    { x: GAME_CONFIG.arena.width / 2, y: GAME_CONFIG.arena.height / 2 - 260 },
    -1,
  );
}
