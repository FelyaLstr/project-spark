// Single source of truth for tunable gameplay values.
// Do NOT hardcode timings/stats elsewhere.

export const GAME_CONFIG = {
  /** Debug telemetry overlay (FPS, positions, velocity, cooldowns, collision). Never ship as true. */
  debug: false,
  /** Sprint toggles — keeps future systems in the codebase but out of the way. */
  features: {
    neutralMobs: false, // Sprint 3
    coreObjective: false, // Sprint 3 (Core stays visually IDLE)
    suddenDeath: false, // Sprint 3
    essenceUpgrades: false, // Sprint 3
    shockwaveAbility: false, // E is parked for now
  },

  arena: {
    width: 1600,
    height: 1200,
    // Walls / cover blocks (x, y, w, h) in world units
    walls: [
      { x: 380, y: 300, w: 220, h: 40 },
      { x: 1000, y: 300, w: 220, h: 40 },
      { x: 380, y: 860, w: 220, h: 40 },
      { x: 1000, y: 860, w: 220, h: 40 },
      { x: 560, y: 520, w: 40, h: 160 },
      { x: 1000, y: 520, w: 40, h: 160 },
      { x: 740, y: 180, w: 120, h: 40 },
      { x: 740, y: 980, w: 120, h: 40 },
      { x: 180, y: 560, w: 40, h: 80 },
      { x: 1380, y: 560, w: 40, h: 80 },
    ],
    spawnA: { x: 800, y: 1090 },
    spawnB: { x: 800, y: 110 },
    coreRadius: 90,
  },
  match: {
    countdownSeconds: 3,
    durationSeconds: 180,
    freezeOnDeath: 1.4,
    suddenDeathShrinkPerSecond: 9,
    suddenDeathDps: 14,
    minSafeRadius: 180,
  },
  timeline: {
    campsActivateAt: 20,
    guardianAt: 60,
    coreActivateAt: 90,
    coreReactivateAt: 150,
  },
  vanguard: {
    radius: 22,
    maxHealth: 300,
    movementSpeed: 260,
    /** units/s^2 — higher = snappier start */
    acceleration: 2600,
    /** units/s^2 — higher = snappier stop */
    deceleration: 3200,
    attackDamage: 16,
    attackCooldown: 0.62,
    attackRange: 430,
    /** fast + flat: ATK is the reliable poke, ~0.48s to max range */
    attackProjectileSpeed: 900,
    attackProjectileRadius: 9,
    attackTrailLength: 7,
    /** legacy melee arc values, unused by the projectile attack */
    attackArc: Math.PI / 3,
  },
  abilities: {
    q: {
      name: "Strike",
      cooldown: 4,
      damage: 46,
      /** slower + fatter than ATK so it reads as a dodgeable skillshot (~0.86s to max range) */
      speed: 760,
      range: 640,
      radius: 17,
      /** windup before the bolt leaves — must be reactable but never turn-based */
      qTelegraphDuration: 0.3,
      trailLength: 14,
    },
    w: {
      name: "Dash",
      cooldown: 5,
      distance: 230,
      duration: 0.16,
      invulnerable: 0.3,
      /** movement is locked to the dash vector for this long (feels predictable) */
      recovery: 0.06,
    },
    e: { name: "Shockwave", cooldown: 8, radius: 150, damage: 35, knockback: 260, telegraph: 0.25 },

    r: {
      name: "Overdrive",
      chargeMax: 100,
      duration: 5,
      damageMult: 1.15,
      speedMult: 1.15,
      attackSpeedMult: 1.2,
      chargePerDamageDealt: 0.55,
      chargePerDamageTaken: 0.35,
      chargePerDodge: 3,
    },
  },
  ai: {
    difficulty: "normal" as "easy" | "normal" | "hard",
    levels: {
      easy: {
        reaction: 0.42,
        aimError: 0.34,
        preferredRange: 300,
        dodgeChance: 0.25,
        qChance: 0.35,
        strafe: 0.35,
        useUlt: 0.5,
      },
      normal: {
        reaction: 0.24,
        aimError: 0.16,
        preferredRange: 280,
        dodgeChance: 0.55,
        qChance: 0.6,
        strafe: 0.55,
        useUlt: 0.85,
      },
      hard: {
        reaction: 0.12,
        aimError: 0.06,
        preferredRange: 260,
        dodgeChance: 0.85,
        qChance: 0.85,
        strafe: 0.7,
        useUlt: 1,
      },
    },
    /** distance at which an incoming projectile triggers a dodge attempt */
    dodgeThreatDistance: 190,
  },
  mobs: {
    crawler: { hp: 70, damage: 10, speed: 120, radius: 16, attackCooldown: 1.4, aggroRange: 220, leash: 300, essence: 5 },
    guardian: { hp: 420, damage: 32, speed: 95, radius: 30, attackCooldown: 2.6, aggroRange: 280, leash: 380, essence: 30, telegraph: 0.8, abilityPowerBonus: 0.1 },
    camps: [
      { x: 380, y: 420 },
      { x: 1220, y: 420 },
      { x: 380, y: 780 },
      { x: 1220, y: 780 },
    ],
    crawlersPerCamp: 2,
    respawnSeconds: 25,
  },
  core: {
    captureSeconds: 4,
    buffDuration: 20,
    damageBonus: 0.15,
    speedBonus: 0.1,
  },
  upgrades: {
    cost: 30,
    power: 0.05,
    vitality: 0.05,
    haste: 0.05,
  },
  essence: {
    perDamageToMob: 0.06,
    perDamageToPlayer: 0.04,
  },
  feedback: {
    hitFlashDuration: 0.16,
    damageTextLife: 0.85,
  },
} as const;

export type GameConfig = typeof GAME_CONFIG;
