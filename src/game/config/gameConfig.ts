// Single source of truth for tunable gameplay values.
// Do NOT hardcode timings/stats elsewhere.

export const GAME_CONFIG = {
  /** Debug telemetry overlay (FPS, positions, velocity, cooldowns, mobs, essence). Never ship as true. */
  debug: false,
  /** Sprint toggles — keeps future systems in the codebase but out of the way. */
  features: {
    neutralMobs: true, // Sprint 3
    guardian: false, // parked — Sprint 3 is crawlers only
    essenceUpgrades: true, // Sprint 3
    coreObjective: true, // Sprint 4: the core becomes an active objective
    suddenDeath: true, // Sprint 4: late-game collapse escalates the match
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
    /** neutral camps become available this many seconds after FIGHT */
    campsActivateAt: 15,
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
        /** radians of random aim spread */
        aimError: 0.3,
        /** 0 = shoots at where you are, 1 = full velocity leading */
        leadFactor: 0.35,
        /** extra random error (radians) applied on top when leading */
        leadError: 0.14,
        preferredRange: 300,
        dodgeChance: 0.25,
        qChance: 0.35,
        strafe: 0.35,
        useUlt: 0.5,
        /** chance to go farm when the player is far away */
        farmChance: 0.4,
        /** chance to punish a farming player */
        contestChance: 0.25,
        /** buys upgrades this often (seconds) once it can afford one */
        buyInterval: 3.5,
      },
      normal: {
        reaction: 0.24,
        aimError: 0.12,
        leadFactor: 0.75,
        leadError: 0.07,
        preferredRange: 280,
        dodgeChance: 0.55,
        qChance: 0.55,
        strafe: 0.55,
        useUlt: 0.85,
        farmChance: 0.6,
        contestChance: 0.5,
        buyInterval: 2.5,
      },
      hard: {
        reaction: 0.12,
        aimError: 0.05,
        leadFactor: 1,
        leadError: 0.025,
        preferredRange: 260,
        dodgeChance: 0.85,
        qChance: 0.85,
        strafe: 0.7,
        useUlt: 1,
        farmChance: 0.75,
        contestChance: 0.7,
        buyInterval: 1.5,
      },
    },
    /** distance at which an incoming projectile triggers a dodge attempt */
    dodgeThreatDistance: 190,
    /** cap on predicted travel time so the AI never aims at absurd extrapolations */
    maxLeadSeconds: 0.9,
    farm: {
      /** the player must be at least this far away before farming is considered */
      safeDistance: 620,
      /** hp ratio below which the AI disengages */
      retreatHpRatio: 0.3,
      /** hp ratio it needs to recover to before re-engaging */
      resumeHpRatio: 0.55,
      /** how close the enemy must be to a camp to count as "farming there" */
      contestRadius: 260,
      /** how often the AI re-picks a behaviour (seconds) */
      decisionInterval: 1.1,
    },
  },

  mobs: {
    crawler: {
      hp: 120,
      damage: 8,
      /** slower than the player's 260 */
      speed: 140,
      /** speed while walking home after a leash break */
      returnSpeed: 190,
      radius: 15,
      /** short melee reach measured between hitboxes */
      attackRange: 12,
      attackCooldown: 1.2,
      aggroRange: 210,
      /** max distance from its camp before it gives up and walks home */
      leash: 300,
      essence: 5,
      /** death effect length */
      deathEffect: 0.45,
    },
    guardian: {
      hp: 420,
      damage: 32,
      speed: 95,
      returnSpeed: 130,
      radius: 30,
      attackRange: 20,
      attackCooldown: 2.6,
      aggroRange: 280,
      leash: 380,
      essence: 30,
      telegraph: 0.8,
      abilityPowerBonus: 0.1,
      deathEffect: 0.6,
    },
    /** exactly two symmetric camps, both reachable by either player */
    camps: [
      { x: 320, y: 600 },
      { x: 1280, y: 600 },
    ],
    /** subtle camp marker radius (also used for camp-presence checks) */
    campRadius: 105,
    /** distance at which a camp becomes active after player interaction */
    campActivationRadius: 165,
    /** distance from the camp at which it is considered to be in combat */
    campCombatRadius: 60,
    /** ring the crawlers idle on inside their camp */
    campSpread: 46,
    crawlersPerCamp: 3,
    /** the whole camp respawns together this long after the last crawler dies */
    respawnSeconds: 25,
    /** mob hit feedback is dialled down vs. player-on-player hits */
    feedbackScale: 0.6,
  },
  core: {
    captureSeconds: 4,
    buffDuration: 20,
    damageBonus: 0.15,
    speedBonus: 0.1,
  },
  upgrades: {
    cost: 20,
    maxLevel: 3,
    /** per level */
    power: 0.05,
    vitality: 0.05,
    haste: 0.05,
  },
  essence: {
    startingEssence: 0,
    /** no trickle income — essence only comes from crawler kills */
    perDamageToMob: 0,
    perDamageToPlayer: 0,
  },
  feedback: {
    hitFlashDuration: 0.16,
    damageTextLife: 0.85,
    /** real-time length of the hit pause (kept tiny on purpose) */
    hitStopSeconds: 0.045,
    /** heavier hit (Q / ult-boosted) pause */
    hitStopSecondsHeavy: 0.06,
    /** time scale applied while a hit pause is active */
    hitStopScale: 0.12,
    /** minimum gap between DODGE popups so overlapping projectiles don't spam */
    dodgeTextCooldown: 0.45,
    /** short death reaction before the results screen is allowed */
    deathReactionSeconds: 0.55,
  },

} as const;

export type GameConfig = typeof GAME_CONFIG;
