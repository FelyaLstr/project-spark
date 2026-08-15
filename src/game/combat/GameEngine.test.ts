import { beforeEach, describe, expect, it } from "vitest";
import { GAME_CONFIG } from "../config/gameConfig";
import type { Vec } from "../core/math";
import { emptyCommand, type AbilityKey, type InputCommand } from "../core/types";
import { makeMob } from "../mobs/mobs";
import { GameEngine } from "./GameEngine";

const C = GAME_CONFIG;

const cmd = (over: Partial<InputCommand> = {}): InputCommand => ({ ...emptyCommand(), ...over });
const cast = (key: AbilityKey, aim: Vec = { x: 1, y: 0 }) => cmd({ cast: key, aim });

/** Steps the fixed loop in engine-sized slices so dt clamping never kicks in. */
function advance(engine: GameEngine, seconds: number, command: InputCommand = cmd()) {
  const step = 0.02;
  for (let t = 0; t < seconds - 1e-9; t += step) {
    engine.update(Math.min(step, seconds - t), command);
  }
}

/** A match past the countdown with a solo player, so the AI never perturbs assertions. */
function playing() {
  const engine = new GameEngine();
  advance(engine, C.match.countdownSeconds + 0.02);
  engine.enemy.alive = false;
  return engine;
}

describe("initial state", () => {
  it("starts in countdown with both fighters at full health", () => {
    const engine = new GameEngine();
    expect(engine.phase).toBe("COUNTDOWN");
    expect(engine.countdown).toBe(C.match.countdownSeconds);
    expect(engine.player.hp).toBe(C.vanguard.maxHealth);
    expect(engine.enemy.hp).toBe(C.vanguard.maxHealth);
    expect(engine.player.pos).toEqual(C.arena.spawnA);
    expect(engine.enemy.pos).toEqual(C.arena.spawnB);
    expect(engine.mobs).toHaveLength(0);
    expect(engine.camps.every((c) => c.phase === "PENDING")).toBe(true);
    expect(engine.core.active).toBe(false);
  });
});

describe("countdown", () => {
  it("faces the aim direction but neither moves nor casts", () => {
    const engine = new GameEngine();
    advance(engine, 0.5, cmd({ move: { x: 1, y: 0 }, aim: { x: 1, y: 0 }, cast: "basic" }));
    expect(engine.phase).toBe("COUNTDOWN");
    expect(engine.player.pos).toEqual(C.arena.spawnA);
    expect(engine.player.facing).toBeCloseTo(0);
    expect(engine.projectiles).toHaveLength(0);
    expect(engine.time).toBe(0);
  });

  it("announces FIGHT and starts the clock when it expires", () => {
    const engine = new GameEngine();
    advance(engine, C.match.countdownSeconds + 0.1);
    expect(engine.phase).toBe("PLAYING");
    expect(engine.announcement).toBe("FIGHT");
    expect(engine.time).toBeGreaterThan(0);
  });
});

describe("movement", () => {
  it("accelerates toward the commanded direction and decelerates on release", () => {
    const engine = playing();
    advance(engine, 0.3, cmd({ move: { x: 1, y: 0 } }));
    expect(engine.player.vel.x).toBeCloseTo(C.vanguard.movementSpeed, 0);
    expect(engine.player.pos.x).toBeGreaterThan(C.arena.spawnA.x);
    advance(engine, 0.3);
    expect(engine.player.vel.x).toBeCloseTo(0);
  });

  it("normalizes over-long move vectors so diagonals are not faster", () => {
    const engine = playing();
    advance(engine, 0.5, cmd({ move: { x: 5, y: 5 } }));
    expect(Math.hypot(engine.player.vel.x, engine.player.vel.y)).toBeCloseTo(
      C.vanguard.movementSpeed,
      0,
    );
  });

  it("keeps the player inside the arena bounds", () => {
    const engine = playing();
    engine.player.pos = { x: 30, y: 600 };
    advance(engine, 1, cmd({ move: { x: -1, y: 0 } }));
    expect(engine.player.pos.x).toBeCloseTo(C.vanguard.radius);
    expect(engine.debugInfo.playerBlocked).toBe(true);
    expect(engine.player.vel.x).toBe(0);
  });

  it("separates the two fighters when they overlap", () => {
    const engine = new GameEngine();
    engine.phase = "PLAYING";
    engine.player.pos = { x: 800, y: 600 };
    engine.enemy.pos = { x: 810, y: 600 };
    engine.update(0.02, cmd());
    const gap = Math.hypot(
      engine.player.pos.x - engine.enemy.pos.x,
      engine.player.pos.y - engine.enemy.pos.y,
    );
    expect(gap).toBeGreaterThanOrEqual(engine.player.radius + engine.enemy.radius - 0.01);
  });
});

describe("abilities", () => {
  it("spawns a basic projectile and locks the cooldown", () => {
    const engine = playing();
    engine.update(0.02, cast("basic"));
    expect(engine.projectiles).toHaveLength(1);
    const p = engine.projectiles[0]!;
    expect(p.kind).toBe("basic");
    expect(p.damage).toBe(C.vanguard.attackDamage);
    expect(p.team).toBe("A");
    expect(engine.player.cooldowns.basic).toBeCloseTo(C.vanguard.attackCooldown, 1);

    engine.update(0.02, cast("basic"));
    expect(engine.projectiles).toHaveLength(1);
  });

  it("scales cooldowns down with haste upgrades", () => {
    const engine = playing();
    engine.player.essence = 999;
    engine.buyUpgrade("haste");
    engine.update(0.02, cast("basic"));
    expect(engine.player.cooldowns.basic).toBeLessThan(C.vanguard.attackCooldown);
  });

  it("scales damage up with power upgrades", () => {
    const engine = playing();
    engine.player.essence = 999;
    engine.buyUpgrade("power");
    engine.update(0.02, cast("basic"));
    expect(engine.projectiles[0]!.damage).toBeCloseTo(
      C.vanguard.attackDamage * (1 + C.upgrades.power),
    );
  });

  it("delays the Q bolt by its telegraph", () => {
    const engine = playing();
    engine.update(0.02, cast("q"));
    expect(engine.projectiles).toHaveLength(0);
    expect(engine.effects.some((e) => e.kind === "telegraph-line")).toBe(true);
    advance(engine, C.abilities.q.qTelegraphDuration + 0.02);
    const q = engine.projectiles.find((p) => p.kind === "q");
    expect(q).toBeDefined();
    expect(q!.damage).toBe(C.abilities.q.damage);
  });

  it("dashes with W, granting i-frames and a fixed dash speed", () => {
    const engine = playing();
    engine.update(0.02, cast("w", { x: 1, y: 0 }));
    expect(engine.player.dashFor).toBeGreaterThan(0);
    expect(engine.player.invulnFor).toBeCloseTo(C.abilities.w.invulnerable);
    expect(engine.player.vel.x).toBeCloseTo(C.abilities.w.distance / C.abilities.w.duration);
    expect(engine.effects.some((e) => e.kind === "dodge-ring")).toBe(true);
  });

  it("ignores the parked shockwave ability", () => {
    const engine = playing();
    engine.update(0.02, cast("e"));
    expect(engine.player.cooldowns.e).toBe(0);
    expect(engine.effects).toHaveLength(0);
  });

  it("only fires the ult at full charge, and consumes it", () => {
    const engine = playing();
    engine.player.ultCharge = C.abilities.r.chargeMax - 1;
    engine.update(0.02, cast("r"));
    expect(engine.player.ultActiveFor).toBe(0);

    engine.player.ultCharge = C.abilities.r.chargeMax;
    engine.update(0.02, cast("r"));
    expect(engine.player.ultCharge).toBe(0);
    expect(engine.player.ultActiveFor).toBeCloseTo(C.abilities.r.duration);
    expect(engine.announcement).toBe("OVERDRIVE");
  });

  it("boosts ult-window damage and speed", () => {
    const engine = playing();
    engine.player.ultCharge = C.abilities.r.chargeMax;
    engine.update(0.02, cast("r"));
    engine.update(0.02, cast("basic"));
    expect(engine.projectiles[0]!.damage).toBeCloseTo(
      C.vanguard.attackDamage * C.abilities.r.damageMult,
    );
    advance(engine, 0.4, cmd({ move: { x: 1, y: 0 } }));
    expect(engine.player.vel.x).toBeGreaterThan(C.vanguard.movementSpeed);
  });
});

describe("upgrades", () => {
  it("prices every upgrade at the configured cost", () => {
    const engine = playing();
    expect(engine.upgradeCost("power")).toBe(C.upgrades.cost);
    expect(engine.upgradeCost("vitality")).toBe(C.upgrades.cost);
  });

  it("refuses purchases without essence, while dead, or at max level", () => {
    const engine = playing();
    expect(engine.canBuyUpgrade(engine.player, "power")).toBe(false);

    engine.player.essence = C.upgrades.cost;
    expect(engine.canBuyUpgrade(engine.player, "power")).toBe(true);

    engine.player.alive = false;
    expect(engine.canBuyUpgrade(engine.player, "power")).toBe(false);
    engine.player.alive = true;

    engine.player.upgrades.power = C.upgrades.maxLevel;
    expect(engine.canBuyUpgrade(engine.player, "power")).toBe(false);
    expect(engine.buyUpgrade("power")).toBe(false);
  });

  it("spends essence and levels the upgrade up", () => {
    const engine = playing();
    engine.player.essence = C.upgrades.cost + 5;
    expect(engine.buyUpgrade("power")).toBe(true);
    expect(engine.player.essence).toBe(5);
    expect(engine.player.upgrades.power).toBe(1);
    expect(engine.effects.some((e) => e.kind === "text" && e.text === "POWER 1")).toBe(true);
  });

  it("raises max hp and heals by the same amount for vitality", () => {
    const engine = playing();
    engine.player.essence = C.upgrades.cost;
    engine.player.hp = 100;
    engine.buyUpgrade("vitality");
    const expectedMax = C.vanguard.maxHealth * (1 + C.upgrades.vitality);
    expect(engine.player.maxHp).toBeCloseTo(expectedMax);
    expect(engine.player.hp).toBeCloseTo(100 + (expectedMax - C.vanguard.maxHealth));
  });

  it("can buy on behalf of the enemy", () => {
    const engine = playing();
    engine.enemy.alive = true;
    engine.enemy.essence = C.upgrades.cost;
    expect(engine.buyUpgrade("haste", engine.enemy)).toBe(true);
    expect(engine.enemy.upgrades.haste).toBe(1);
    expect(engine.player.upgrades.haste).toBe(0);
  });
});

describe("applyDamage", () => {
  it("reduces hp, records both sides' stats and builds ult charge", () => {
    const engine = playing();
    engine.enemy.alive = true;
    engine.applyDamage(engine.player, engine.enemy, 40);
    expect(engine.enemy.hp).toBe(C.vanguard.maxHealth - 40);
    expect(engine.player.stats.damageDealt).toBe(40);
    expect(engine.enemy.stats.damageTaken).toBe(40);
    expect(engine.player.ultCharge).toBeCloseTo(40 * C.abilities.r.chargePerDamageDealt);
    expect(engine.enemy.ultCharge).toBeCloseTo(40 * C.abilities.r.chargePerDamageTaken);
    expect(engine.hitStop).toBeGreaterThan(0);
  });

  it("clamps negative damage to zero", () => {
    const engine = playing();
    engine.enemy.alive = true;
    engine.applyDamage(engine.player, engine.enemy, -10);
    expect(engine.enemy.hp).toBe(C.vanguard.maxHealth);
  });

  it("ignores damage to something already dead", () => {
    const engine = playing();
    const mob = makeMob("crawler", { x: 0, y: 0 }, 0);
    mob.alive = false;
    engine.applyDamage(engine.player, mob, 50);
    expect(mob.hp).toBe(mob.maxHp);
  });

  it("converts hits during i-frames into a dodge, once per window", () => {
    const engine = playing();
    engine.enemy.alive = true;
    engine.enemy.invulnFor = 1;
    engine.applyDamage(engine.player, engine.enemy, 40);
    engine.applyDamage(engine.player, engine.enemy, 40);
    expect(engine.enemy.hp).toBe(C.vanguard.maxHealth);
    expect(engine.enemy.stats.damageTaken).toBe(0);
    expect(engine.enemy.ultCharge).toBeCloseTo(C.abilities.r.chargePerDodge * 2);
    expect(engine.effects.filter((e) => e.kind === "text" && e.text === "DODGE")).toHaveLength(1);
    expect(engine.effects.filter((e) => e.kind === "dodge-ring")).toHaveLength(2);
  });

  it("pays essence and a kill stat to whoever lands the final blow on a mob", () => {
    const engine = playing();
    const mob = makeMob("crawler", { x: 100, y: 100 }, 0);
    engine.mobs.push(mob);
    engine.applyDamage(engine.player, mob, mob.hp);
    expect(mob.alive).toBe(false);
    expect(mob.state).toBe("DEAD");
    expect(engine.player.stats.mobsKilled).toBe(1);
    expect(engine.player.essence).toBe(C.mobs.crawler.essence);
    expect(engine.player.stats.essenceEarned).toBe(C.mobs.crawler.essence);
  });

  it("grants the guardian buff and an announcement for a guardian kill", () => {
    const engine = playing();
    const guardian = makeMob("guardian", { x: 800, y: 340 }, -1);
    engine.mobs.push(guardian);
    engine.applyDamage(engine.player, guardian, guardian.hp);
    expect(engine.player.buffs.guardianPower).toBeCloseTo(C.mobs.guardian.abilityPowerBonus);
    expect(engine.announcement).toBe("YOU SLEW THE GUARDIAN");
  });

  it("ends the match when a fighter dies", () => {
    const engine = playing();
    engine.enemy.alive = true;
    engine.applyDamage(engine.enemy, engine.player, C.vanguard.maxHealth);
    expect(engine.player.alive).toBe(false);
    expect(engine.player.hp).toBe(0);
    expect(engine.winner).toBe("B");
    expect(engine.phase).toBe("PLAYER_DEAD");
  });

  it("moves from PLAYER_DEAD to RESULTS after the freeze, then stops updating", () => {
    const engine = playing();
    engine.applyDamage(null, engine.player, C.vanguard.maxHealth);
    advance(engine, C.match.freezeOnDeath + 0.1);
    expect(engine.phase).toBe("RESULTS");
    const before = engine.time;
    advance(engine, 1, cmd({ move: { x: 1, y: 0 } }));
    expect(engine.time).toBe(before);
  });
});

describe("projectiles", () => {
  it("damages an enemy on contact and counts an ability hit", () => {
    const engine = new GameEngine();
    engine.phase = "PLAYING";
    engine.player.pos = { x: 800, y: 600 };
    engine.enemy.pos = { x: 880, y: 600 };
    engine.update(0.02, cast("basic", { x: 1, y: 0 }));
    advance(engine, 0.15);
    expect(engine.enemy.hp).toBeLessThan(C.vanguard.maxHealth);
    expect(engine.player.stats.abilitiesHit).toBe(1);
    expect(engine.projectiles).toHaveLength(0);
  });

  it("fizzles against a wall and counts a miss", () => {
    const engine = playing();
    engine.update(0.02, cast("basic", { x: 0, y: -1 }));
    advance(engine, 0.2);
    expect(engine.player.stats.abilitiesMissed).toBe(1);
    expect(engine.effects.some((e) => e.kind === "fizzle")).toBe(true);
    expect(engine.projectiles).toHaveLength(0);
  });

  it("expires at max range and counts a miss", () => {
    const engine = playing();
    engine.player.pos = { x: 800, y: 1090 };
    engine.update(0.02, cast("basic", { x: 1, y: 0 }));
    const p = engine.projectiles[0]!;
    advance(engine, 0.2);
    expect(p.traveled).toBeGreaterThan(0);
    expect(p.trail.length).toBeLessThanOrEqual(p.trailMax);
    advance(engine, 0.5);
    expect(engine.projectiles).toHaveLength(0);
    expect(engine.player.stats.abilitiesMissed).toBe(1);
  });

  it("counts a dodged projectile as neither a hit nor damage", () => {
    const engine = new GameEngine();
    engine.phase = "PLAYING";
    engine.player.pos = { x: 800, y: 600 };
    engine.enemy.pos = { x: 880, y: 600 };
    engine.enemy.invulnFor = 5;
    engine.update(0.02, cast("basic", { x: 1, y: 0 }));
    advance(engine, 0.15);
    expect(engine.enemy.hp).toBe(C.vanguard.maxHealth);
    expect(engine.player.stats.abilitiesHit).toBe(0);
    expect(engine.player.stats.abilitiesMissed).toBe(1);
  });
});

describe("timeline and core", () => {
  it("activates the core on schedule and switches to the core event", () => {
    const engine = playing();
    engine.time = C.timeline.coreActivateAt - 0.01;
    engine.update(0.02, cmd());
    expect(engine.core.active).toBe(true);
    expect(engine.phase).toBe("CORE_EVENT");
    expect(engine.announcement).toBe("THE CORE IS ACTIVE");
  });

  it("captures the core after holding it, granting overcharge", () => {
    const engine = playing();
    engine.time = C.timeline.coreActivateAt - 0.01;
    engine.update(0.02, cmd());
    for (let i = 0; i < C.core.captureSeconds / 0.02 + 5; i++) {
      engine.player.pos = { ...engine.corePos };
      engine.update(0.02, cmd());
    }
    expect(engine.core.ownedBy).toBe("A");
    expect(engine.core.active).toBe(false);
    expect(engine.player.buffs.overchargeFor).toBeGreaterThan(0);
    expect(engine.player.stats.coreCaptures).toBe(1);
    expect(engine.phase).toBe("PLAYING");
    expect(engine.announcement).toBe("YOU CAPTURED THE CORE");
  });

  it("decays capture progress when the core is left empty", () => {
    const engine = playing();
    engine.time = C.timeline.coreActivateAt - 0.01;
    engine.update(0.02, cmd());
    engine.player.pos = { ...engine.corePos };
    advance(engine, 1);
    const held = engine.core.progressA;
    expect(held).toBeGreaterThan(0);
    engine.player.pos = { x: 100, y: 100 };
    advance(engine, 0.5);
    expect(engine.core.progressA).toBeLessThan(held);
  });
});

describe("sudden death", () => {
  it("shrinks the safe ring and burns whoever is outside it", () => {
    const engine = playing();
    engine.time = C.match.durationSeconds;
    engine.player.pos = { x: 60, y: 60 };
    engine.update(0.02, cmd());
    expect(engine.phase).toBe("SUDDEN_DEATH");
    expect(engine.announcement).toBe("CORE OVERLOAD");
    const firstRadius = engine.safeRadius!;
    expect(firstRadius).toBeLessThan(Math.min(C.arena.width, C.arena.height) / 2);
    expect(engine.player.hp).toBeLessThan(C.vanguard.maxHealth);

    advance(engine, 0.5);
    expect(engine.safeRadius!).toBeLessThan(firstRadius);
  });

  it("never shrinks past the configured minimum", () => {
    const engine = playing();
    engine.time = C.match.durationSeconds;
    engine.player.pos = { ...engine.corePos };
    advance(engine, 60);
    expect(engine.safeRadius).toBeCloseTo(C.match.minSafeRadius);
    expect(engine.player.hp).toBe(C.vanguard.maxHealth);
  });
});

describe("snapshot and reset", () => {
  it("exposes the UI-facing view of the match", () => {
    const engine = playing();
    engine.player.essence = 12.7;
    engine.player.upgrades.power = 2;
    engine.time = 30;
    const snap = engine.snapshot();
    expect(snap).toMatchObject({
      phase: "PLAYING",
      time: 30,
      countdown: 0,
      timeLeft: C.match.durationSeconds - 30,
      essence: 12,
      upgrades: { power: 2, vitality: 0, haste: 0 },
      winner: null,
    });
    expect(snap.upgrades).not.toBe(engine.player.upgrades);
  });

  it("clamps the overshot countdown and an overrun clock at zero", () => {
    const engine = playing();
    expect(engine.countdown).toBeLessThan(0);
    engine.time = C.match.durationSeconds + 30;
    const snap = engine.snapshot();
    expect(snap.countdown).toBe(0);
    expect(snap.timeLeft).toBe(0);
  });

  it("restores a fresh match", () => {
    const engine = playing();
    engine.player.hp = 10;
    engine.player.essence = 50;
    engine.mobs.push(makeMob("crawler", { x: 0, y: 0 }, 0));
    engine.camps[0]!.phase = "CLEARED";
    engine.winner = "B";
    engine.update(0.02, cast("basic"));

    engine.reset();
    expect(engine.phase).toBe("COUNTDOWN");
    expect(engine.countdown).toBe(C.match.countdownSeconds);
    expect(engine.time).toBe(0);
    expect(engine.player.hp).toBe(C.vanguard.maxHealth);
    expect(engine.player.essence).toBe(0);
    expect(engine.mobs).toHaveLength(0);
    expect(engine.projectiles).toHaveLength(0);
    expect(engine.effects).toHaveLength(0);
    expect(engine.camps.every((c) => c.phase === "PENDING")).toBe(true);
    expect(engine.winner).toBe(null);
  });
});

describe("effects", () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = playing();
  });

  it("expires effects once their life runs out", () => {
    engine.pushEffect({ kind: "hit", pos: { x: 0, y: 0 }, life: 0.1 });
    expect(engine.effects[0]!.maxLife).toBe(0.1);
    advance(engine, 0.2);
    expect(engine.effects).toHaveLength(0);
  });

  it("caps the effect buffer", () => {
    for (let i = 0; i < 300; i++) {
      engine.pushEffect({ kind: "hit", pos: { x: 0, y: 0 }, life: 10 });
    }
    expect(engine.effects.length).toBeLessThanOrEqual(220);
  });
});
