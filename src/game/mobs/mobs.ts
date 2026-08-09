import { GAME_CONFIG } from "../config/gameConfig";
import type { Mob } from "../core/types";
import type { Vec } from "../core/math";

let idc = 0;
const nid = (p: string) => `${p}_${++idc}`;

export function makeMob(kind: "crawler" | "guardian", home: Vec): Mob {
  const c = kind === "crawler" ? GAME_CONFIG.mobs.crawler : GAME_CONFIG.mobs.guardian;
  return {
    id: nid(kind),
    kind,
    pos: { ...home },
    home: { ...home },
    hp: c.hp,
    maxHp: c.hp,
    radius: c.radius,
    target: null,
    attackTimer: 0,
    telegraphFor: 0,
    hitFlash: 0,
    alive: true,
    respawnIn: 0,
  };
}

export function spawnCamps(): Mob[] {
  const mobs: Mob[] = [];
  for (const camp of GAME_CONFIG.mobs.camps) {
    for (let i = 0; i < GAME_CONFIG.mobs.crawlersPerCamp; i++) {
      const a = (i / GAME_CONFIG.mobs.crawlersPerCamp) * Math.PI * 2;
      mobs.push(makeMob("crawler", { x: camp.x + Math.cos(a) * 40, y: camp.y + Math.sin(a) * 40 }));
    }
  }
  return mobs;
}

export function spawnGuardian(): Mob {
  return makeMob("guardian", { x: GAME_CONFIG.arena.width / 2, y: GAME_CONFIG.arena.height / 2 - 260 });
}
