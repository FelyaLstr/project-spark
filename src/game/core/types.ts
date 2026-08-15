import type { Vec } from "./math";

export type AbilityKey = "basic" | "q" | "w" | "e" | "r";

export type InputCommand = {
  /** normalized movement direction, length 0..1 */
  move: Vec;
  /** aim direction (normalized) */
  aim: Vec;
  /** ability requested this frame */
  cast: AbilityKey | null;
};

export const emptyCommand = (): InputCommand => ({
  move: { x: 0, y: 0 },
  aim: { x: 0, y: -1 },
  cast: null,
});

export type Team = "A" | "B";

export type FighterStats = {
  damageDealt: number;
  damageTaken: number;
  mobsKilled: number;
  essenceEarned: number;
  coreCaptures: number;
  abilitiesHit: number;
  abilitiesMissed: number;
};

export type UpgradeKind = "power" | "vitality" | "haste";

export type Fighter = {
  id: string;
  team: Team;
  pos: Vec;
  vel: Vec;
  facing: number;
  radius: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  cooldowns: Record<AbilityKey, number>;
  ultCharge: number;
  ultActiveFor: number;
  dashFor: number;
  invulnFor: number;
  hitFlash: number;
  knockback: Vec;
  /** match-only resource, reset every match */
  essence: number;
  /** match-only upgrade LEVELS (0..maxLevel), never baked into base stats */
  upgrades: Record<UpgradeKind, number>;
  buffs: { overchargeFor: number; guardianPower: number };
  stats: FighterStats;
};

export type MobKind = "crawler" | "guardian";

export type MobState = "IDLE" | "AGGRO" | "CHASE" | "ATTACK" | "RETURN" | "DEAD";

export type Mob = {
  id: string;
  kind: MobKind;
  campId: number;
  state: MobState;
  pos: Vec;
  home: Vec;
  hp: number;
  maxHp: number;
  radius: number;
  target: string | null;
  attackTimer: number;
  /** short "just noticed you" delay before the chase begins */
  aggroFor: number;
  telegraphFor: number;
  hitFlash: number;
  alive: boolean;
  respawnIn: number;
};

export type CampPhase = "PENDING" | "AVAILABLE" | "COMBAT" | "CLEARED" | "RESPAWNING";

export type Camp = {
  id: number;
  pos: Vec;
  radius: number;
  phase: CampPhase;
  respawnIn: number;
};


export type ProjectileKind = "basic" | "q";

export type Projectile = {
  id: string;
  owner: string;
  team: Team;
  kind: ProjectileKind;
  pos: Vec;
  dir: Vec;
  speed: number;
  radius: number;
  damage: number;
  traveled: number;
  range: number;
  trail: Vec[];
  /** how many trail samples to keep — Q keeps a longer, more readable streak */
  trailMax: number;
  /** counted toward ability hit/miss accuracy stats */
  tracked: boolean;
  resolved: boolean;
};

export type Effect = {
  id: string;
  kind:
    | "telegraph-line"
    | "shockwave"
    | "hit"
    | "impact-ring"
    | "dodge-ring"
    | "fizzle"
    | "slash"
    | "text"
    | "core-ring"
    | "dash-trail"
    | "muzzle";
  pos: Vec;
  dir?: Vec;
  radius?: number;
  life: number;
  maxLife: number;
  text?: string;
  color?: string;
};


export type MatchPhase =
  | "COUNTDOWN"
  | "PLAYING"
  | "CORE_EVENT"
  | "SUDDEN_DEATH"
  | "PLAYER_DEAD"
  | "RESULTS";

export type CoreState = {
  active: boolean;
  /** both fighters inside the zone -> capture progress is frozen */
  contested: boolean;
  progressA: number;
  progressB: number;
  ownedBy: Team | null;
};

export type AimPreview = { active: boolean; ability: AbilityKey | null };

export type Snapshot = {
  phase: MatchPhase;
  time: number;
  countdown: number;
  timeLeft: number;
  player: Fighter;
  enemy: Fighter;
  /** player's spendable essence, floored for display */
  essence: number;
  /** player's upgrade levels */
  upgrades: Record<UpgradeKind, number>;
  core: CoreState;
  safeRadius: number | null;
  winner: Team | null;
  announcement: string | null;

};
