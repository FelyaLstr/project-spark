import { beforeEach, describe, expect, it, vi } from "vitest";
import { GAME_CONFIG } from "../config/gameConfig";
import type { Vec } from "../core/math";
import type { Camp, Effect, Fighter, Mob } from "../core/types";
import { testFighter } from "../testing/fixtures";
import { updateMobs, type MobContext } from "./MobController";
import { makeCamps, makeMob, resetMobIds } from "./mobs";

const C = GAME_CONFIG.mobs;

type Harness = MobContext & {
  effects: Effect["kind"][];
  damage: { source: Mob; target: Fighter; amount: number }[];
  timers: { seconds: number; fn: () => void }[];
  runTimers: () => void;
};

function harness(over: Partial<Pick<MobContext, "mobs" | "camps" | "fighters">> = {}): Harness {
  const effects: Effect["kind"][] = [];
  const damage: Harness["damage"] = [];
  const timers: Harness["timers"] = [];
  return {
    mobs: over.mobs ?? [],
    camps: over.camps ?? [],
    fighters: over.fighters ?? [],
    applyDamage: (source, target, amount) => {
      damage.push({ source, target, amount });
    },
    collide: (p: Vec) => p,
    pushEffect: (e) => {
      effects.push(e.kind);
    },
    later: (seconds, fn) => {
      timers.push({ seconds, fn });
    },
    effects,
    damage,
    timers,
    runTimers: () => timers.splice(0).forEach((t) => t.fn()),
  };
}

/** A crawler parked at its camp, with the camp already fighting so phases stay put. */
function crawlerAt(home: Vec, campId = 0): Mob {
  return makeMob("crawler", home, campId);
}

beforeEach(() => resetMobIds());

describe("mob aggro and chase", () => {
  it("stays IDLE while every fighter is out of aggro range", () => {
    const mob = crawlerAt({ x: 0, y: 0 });
    const ctx = harness({
      mobs: [mob],
      fighters: [testFighter("A", { x: C.crawler.aggroRange + 50, y: 0 })],
    });
    updateMobs(ctx, 0.1);
    expect(mob.state).toBe("IDLE");
    expect(mob.target).toBe(null);
  });

  it("ignores dead fighters", () => {
    const mob = crawlerAt({ x: 0, y: 0 });
    const ctx = harness({
      mobs: [mob],
      fighters: [testFighter("A", { x: 20, y: 0 }, { alive: false })],
    });
    updateMobs(ctx, 0.1);
    expect(mob.state).toBe("IDLE");
  });

  it("latches onto the nearest fighter in range and waits out the aggro delay", () => {
    const mob = crawlerAt({ x: 0, y: 0 });
    const far = testFighter("A", { x: 150, y: 0 });
    const near = testFighter("B", { x: 60, y: 0 });
    const ctx = harness({ mobs: [mob], fighters: [far, near] });
    updateMobs(ctx, 0.05);
    expect(mob.state).toBe("AGGRO");
    expect(mob.target).toBe(near.id);
    expect(mob.pos).toEqual({ x: 0, y: 0 });
  });

  it("chases once the aggro delay expires", () => {
    const mob = crawlerAt({ x: 0, y: 0 });
    const foe = testFighter("A", { x: 120, y: 0 });
    const ctx = harness({ mobs: [mob], fighters: [foe] });
    updateMobs(ctx, 0.2);
    updateMobs(ctx, 0.2);
    expect(mob.state).toBe("CHASE");
    expect(mob.pos.x).toBeCloseTo(C.crawler.speed * 0.2);
  });

  it("routes movement through the collision callback", () => {
    const mob = crawlerAt({ x: 0, y: 0 });
    const ctx = harness({ mobs: [mob], fighters: [testFighter("A", { x: 120, y: 0 })] });
    const collide = vi.fn(() => ({ x: -5, y: -5 }));
    ctx.collide = collide;
    updateMobs(ctx, 0.2);
    updateMobs(ctx, 0.2);
    expect(collide).toHaveBeenCalledWith(expect.objectContaining({ y: 0 }), mob.radius);
    expect(mob.pos).toEqual({ x: -5, y: -5 });
  });
});

describe("crawler attacks", () => {
  function engaged() {
    const mob = crawlerAt({ x: 0, y: 0 });
    const foe = testFighter("A", { x: mob.radius + GAME_CONFIG.vanguard.radius + 5, y: 0 });
    const ctx = harness({ mobs: [mob], fighters: [foe] });
    updateMobs(ctx, 0.2); // acquire target
    updateMobs(ctx, 0.2); // burn off the aggro delay, then attack
    return { mob, foe, ctx };
  }

  it("damages the fighter immediately and starts the attack cooldown", () => {
    const { mob, foe, ctx } = engaged();
    expect(mob.state).toBe("ATTACK");
    expect(ctx.damage).toEqual([{ source: mob, target: foe, amount: C.crawler.damage }]);
    expect(mob.attackTimer).toBeCloseTo(C.crawler.attackCooldown);
    expect(ctx.effects).toContain("slash");
  });

  it("does not attack again until the cooldown elapses", () => {
    const { ctx } = engaged();
    updateMobs(ctx, C.crawler.attackCooldown / 2);
    expect(ctx.damage).toHaveLength(1);
    updateMobs(ctx, C.crawler.attackCooldown);
    expect(ctx.damage).toHaveLength(2);
  });
});

describe("guardian attacks", () => {
  it("telegraphs, then damages everyone inside the shockwave", () => {
    const guardian = makeMob("guardian", { x: 0, y: 0 }, -1);
    const near = testFighter("A", { x: guardian.radius + 10, y: 0 });
    const far = testFighter("B", { x: 400, y: 0 });
    const ctx = harness({ mobs: [guardian], fighters: [near, far] });
    updateMobs(ctx, 0.2); // acquire target
    updateMobs(ctx, 0.2); // burn off the aggro delay, then attack

    expect(guardian.telegraphFor).toBeCloseTo(C.guardian.telegraph);
    expect(ctx.effects).toContain("shockwave");
    expect(ctx.damage).toHaveLength(0);

    ctx.runTimers();
    expect(ctx.damage).toEqual([{ source: guardian, target: near, amount: C.guardian.damage }]);
  });
});

describe("leash and return", () => {
  it("drops its target and walks home once past the leash", () => {
    const mob = crawlerAt({ x: 0, y: 0 });
    mob.pos = { x: C.crawler.leash + 20, y: 0 };
    mob.target = "fighter_A";
    const ctx = harness({
      mobs: [mob],
      fighters: [testFighter("A", { x: C.crawler.leash + 30, y: 0 })],
    });
    updateMobs(ctx, 0.1);
    expect(mob.state).toBe("RETURN");
    expect(mob.target).toBe(null);
    expect(mob.pos.x).toBeCloseTo(C.crawler.leash + 20 - C.crawler.returnSpeed * 0.1);
  });

  it("ignores nearby fighters while returning", () => {
    const mob = crawlerAt({ x: 0, y: 0 });
    mob.pos = { x: C.crawler.leash + 20, y: 0 };
    const ctx = harness({
      mobs: [mob],
      fighters: [testFighter("A", { x: C.crawler.leash + 30, y: 0 })],
    });
    updateMobs(ctx, 0.1);
    mob.pos = { x: 30, y: 0 };
    updateMobs(ctx, 0.1);
    expect(mob.state).toBe("RETURN");
    expect(mob.target).toBe(null);
  });

  it("resets to full hp when it gets home", () => {
    const mob = crawlerAt({ x: 0, y: 0 });
    mob.state = "RETURN";
    mob.hp = 10;
    mob.pos = { x: 3, y: 0 };
    const ctx = harness({ mobs: [mob], fighters: [] });
    updateMobs(ctx, 0.1);
    expect(mob.state).toBe("IDLE");
    expect(mob.hp).toBe(mob.maxHp);
  });

  it("drifts back onto the idle ring when it loses its target", () => {
    const mob = crawlerAt({ x: 0, y: 0 });
    mob.pos = { x: 50, y: 0 };
    const ctx = harness({ mobs: [mob], fighters: [] });
    updateMobs(ctx, 0.1);
    expect(mob.state).toBe("IDLE");
    expect(mob.pos.x).toBeCloseTo(50 - C.crawler.speed * 0.6 * 0.1);
  });

  it("holds still when already home with no target", () => {
    const mob = crawlerAt({ x: 0, y: 0 });
    const ctx = harness({ mobs: [mob], fighters: [] });
    updateMobs(ctx, 0.1);
    expect(mob.pos).toEqual({ x: 0, y: 0 });
  });
});

describe("dead mobs", () => {
  it("only decays the hit flash", () => {
    const mob = crawlerAt({ x: 0, y: 0 });
    mob.alive = false;
    mob.hitFlash = 0.1;
    const ctx = harness({ mobs: [mob], fighters: [testFighter("A", { x: 10, y: 0 })] });
    updateMobs(ctx, 0.04);
    expect(mob.hitFlash).toBeCloseTo(0.06);
    expect(mob.state).toBe("IDLE");
    expect(ctx.damage).toHaveLength(0);
  });
});

describe("camp phases", () => {
  function pendingCamp(): Camp {
    return makeCamps()[0]!;
  }

  it("stays PENDING until a fighter walks up", () => {
    const camp = pendingCamp();
    const ctx = harness({
      camps: [camp],
      fighters: [testFighter("A", { x: camp.pos.x + 2000, y: camp.pos.y })],
    });
    updateMobs(ctx, 0.1);
    expect(camp.phase).toBe("PENDING");
    expect(ctx.mobs).toHaveLength(0);
  });

  it("activates and spawns the camp when a fighter arrives", () => {
    const camp = pendingCamp();
    const ctx = harness({
      camps: [camp],
      fighters: [testFighter("A", { x: camp.pos.x, y: camp.pos.y })],
    });
    updateMobs(ctx, 0.1);
    expect(camp.phase).toBe("AVAILABLE");
    expect(ctx.mobs).toHaveLength(C.crawlersPerCamp);
    expect(ctx.effects).toContain("core-ring");
  });

  it("flips between COMBAT and AVAILABLE as a fighter enters and leaves", () => {
    const camp = pendingCamp();
    const fighter = testFighter("A", { x: camp.pos.x, y: camp.pos.y });
    const ctx = harness({ camps: [camp], fighters: [fighter] });
    updateMobs(ctx, 0.1); // activation frame
    updateMobs(ctx, 0.1);
    expect(camp.phase).toBe("COMBAT");
    fighter.pos = { x: camp.pos.x + 2000, y: camp.pos.y };
    for (const m of ctx.mobs) m.state = "IDLE";
    updateMobs(ctx, 0.1);
    expect(camp.phase).toBe("AVAILABLE");
  });

  it("goes CLEARED with a respawn timer when the last crawler dies", () => {
    const camp = pendingCamp();
    camp.phase = "AVAILABLE";
    const mob = crawlerAt(camp.pos, camp.id);
    mob.alive = false;
    const ctx = harness({ camps: [camp], mobs: [mob], fighters: [] });
    updateMobs(ctx, 0.1);
    expect(camp.phase).toBe("CLEARED");
    expect(camp.respawnIn).toBe(C.respawnSeconds);
  });

  it("switches CLEARED to RESPAWNING as the timer winds down", () => {
    const camp = pendingCamp();
    camp.phase = "CLEARED";
    camp.respawnIn = C.respawnSeconds;
    const ctx = harness({ camps: [camp], mobs: [], fighters: [] });
    updateMobs(ctx, 1);
    expect(camp.phase).toBe("CLEARED");
    updateMobs(ctx, 2);
    expect(camp.phase).toBe("RESPAWNING");
  });

  it("replaces the old corpses with a fresh camp when the timer ends", () => {
    const camp = pendingCamp();
    camp.phase = "RESPAWNING";
    camp.respawnIn = 0.1;
    const corpse = crawlerAt(camp.pos, camp.id);
    corpse.alive = false;
    const otherCamp = crawlerAt({ x: 0, y: 0 }, 99);
    const ctx = harness({ camps: [camp], mobs: [corpse, otherCamp], fighters: [] });
    updateMobs(ctx, 0.2);
    expect(camp.phase).toBe("AVAILABLE");
    expect(ctx.mobs).toContain(otherCamp);
    expect(ctx.mobs).not.toContain(corpse);
    expect(ctx.mobs.filter((m) => m.campId === camp.id)).toHaveLength(C.crawlersPerCamp);
  });

  it("is COMBAT while its crawlers are chasing, even with nobody standing in it", () => {
    const camp = pendingCamp();
    camp.phase = "AVAILABLE";
    const mob = crawlerAt(camp.pos, camp.id);
    mob.state = "CHASE";
    const ctx = harness({ camps: [camp], mobs: [mob], fighters: [] });
    updateMobs(ctx, 0.1);
    expect(camp.phase).toBe("COMBAT");
  });
});
