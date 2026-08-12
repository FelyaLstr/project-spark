import { GAME_CONFIG } from "../config/gameConfig";
import type { Vec } from "../core/math";
import type { Fighter, Team } from "../core/types";

/** Minimal fighter used by unit tests that drive subsystems without a full engine. */
export function testFighter(team: Team, pos: Vec, overrides: Partial<Fighter> = {}): Fighter {
  const v = GAME_CONFIG.vanguard;
  return {
    id: `fighter_${team}`,
    team,
    pos: { ...pos },
    vel: { x: 0, y: 0 },
    facing: 0,
    radius: v.radius,
    hp: v.maxHealth,
    maxHp: v.maxHealth,
    alive: true,
    cooldowns: { basic: 0, q: 0, w: 0, e: 0, r: 0 },
    ultCharge: 0,
    ultActiveFor: 0,
    dashFor: 0,
    invulnFor: 0,
    hitFlash: 0,
    knockback: { x: 0, y: 0 },
    essence: 0,
    upgrades: { power: 0, vitality: 0, haste: 0 },
    buffs: { overchargeFor: 0, guardianPower: 0 },
    stats: {
      damageDealt: 0,
      damageTaken: 0,
      mobsKilled: 0,
      essenceEarned: 0,
      coreCaptures: 0,
      abilitiesHit: 0,
      abilitiesMissed: 0,
    },
    ...overrides,
  };
}
