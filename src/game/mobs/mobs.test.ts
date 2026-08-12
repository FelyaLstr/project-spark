import { beforeEach, describe, expect, it } from "vitest";
import { GAME_CONFIG } from "../config/gameConfig";
import { makeCamps, makeMob, resetMobIds, spawnCampMobs, spawnGuardian } from "./mobs";

const M = GAME_CONFIG.mobs;

describe("makeMob", () => {
  beforeEach(() => resetMobIds());

  it("seeds a crawler from config, idle and at full hp", () => {
    const mob = makeMob("crawler", { x: 10, y: 20 }, 3);
    expect(mob).toMatchObject({
      kind: "crawler",
      campId: 3,
      state: "IDLE",
      pos: { x: 10, y: 20 },
      home: { x: 10, y: 20 },
      hp: M.crawler.hp,
      maxHp: M.crawler.hp,
      radius: M.crawler.radius,
      target: null,
      alive: true,
    });
  });

  it("seeds a guardian from the guardian config", () => {
    const mob = makeMob("guardian", { x: 0, y: 0 }, -1);
    expect(mob.hp).toBe(M.guardian.hp);
    expect(mob.radius).toBe(M.guardian.radius);
  });

  it("copies the home position instead of aliasing it", () => {
    const home = { x: 5, y: 5 };
    const mob = makeMob("crawler", home, 0);
    home.x = 999;
    expect(mob.pos).toEqual({ x: 5, y: 5 });
    expect(mob.home).toEqual({ x: 5, y: 5 });
    expect(mob.pos).not.toBe(mob.home);
  });

  it("hands out unique ids that resetMobIds rewinds", () => {
    const a = makeMob("crawler", { x: 0, y: 0 }, 0);
    const b = makeMob("crawler", { x: 0, y: 0 }, 0);
    expect(a.id).not.toBe(b.id);
    resetMobIds();
    expect(makeMob("crawler", { x: 0, y: 0 }, 0).id).toBe(a.id);
  });
});

describe("makeCamps", () => {
  it("mirrors the configured camps, all pending", () => {
    const camps = makeCamps();
    expect(camps).toHaveLength(M.camps.length);
    camps.forEach((camp, i) => {
      expect(camp).toEqual({
        id: i,
        pos: { x: M.camps[i]!.x, y: M.camps[i]!.y },
        radius: M.campRadius,
        phase: "PENDING",
        respawnIn: 0,
      });
    });
  });

  it("returns fresh objects on every call", () => {
    const first = makeCamps();
    first[0]!.phase = "CLEARED";
    expect(makeCamps()[0]!.phase).toBe("PENDING");
  });
});

describe("spawnCampMobs", () => {
  beforeEach(() => resetMobIds());

  it("spawns the configured crawler count tagged with the camp id", () => {
    const camp = makeCamps()[0]!;
    const mobs = spawnCampMobs(camp);
    expect(mobs).toHaveLength(M.crawlersPerCamp);
    expect(mobs.every((m) => m.kind === "crawler" && m.campId === camp.id)).toBe(true);
  });

  it("places them on a ring of campSpread around the camp", () => {
    const camp = makeCamps()[1]!;
    for (const m of spawnCampMobs(camp)) {
      expect(Math.hypot(m.pos.x - camp.pos.x, m.pos.y - camp.pos.y)).toBeCloseTo(M.campSpread);
    }
  });

  it("spreads them evenly, starting straight above the camp", () => {
    const camp = makeCamps()[0]!;
    const mobs = spawnCampMobs(camp);
    expect(mobs[0]!.pos.x).toBeCloseTo(camp.pos.x);
    expect(mobs[0]!.pos.y).toBeCloseTo(camp.pos.y - M.campSpread);
    const angles = mobs.map((m) => Math.atan2(m.pos.y - camp.pos.y, m.pos.x - camp.pos.x));
    expect(new Set(angles.map((a) => a.toFixed(4))).size).toBe(mobs.length);
  });
});

describe("spawnGuardian", () => {
  it("spawns above the arena center with no camp", () => {
    const g = spawnGuardian();
    expect(g.kind).toBe("guardian");
    expect(g.campId).toBe(-1);
    expect(g.pos).toEqual({
      x: GAME_CONFIG.arena.width / 2,
      y: GAME_CONFIG.arena.height / 2 - 260,
    });
  });
});
