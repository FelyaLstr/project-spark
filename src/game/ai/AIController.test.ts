import { afterEach, describe, expect, it, vi } from "vitest";
import { GAME_CONFIG } from "../config/gameConfig";
import type { Rect, Vec } from "../core/math";
import type { Camp, Mob, Projectile, UpgradeKind } from "../core/types";
import { makeCamps, makeMob } from "../mobs/mobs";
import { testFighter } from "../testing/fixtures";
import { createAIController, type AIWorld } from "./AIController";

const C = GAME_CONFIG;
const AI = C.ai;

/** Locks Math.random so every probability gate in the controller is decided up front. */
function seedRandom(value: number) {
  vi.spyOn(Math, "random").mockReturnValue(value);
}

function world(over: Partial<AIWorld> = {}): AIWorld & { bought: UpgradeKind[] } {
  const bought: UpgradeKind[] = [];
  return {
    self: over.self ?? testFighter("B", { x: 800, y: 400 }),
    foe: over.foe ?? testFighter("A", { x: 800, y: 800 }),
    mobs: over.mobs ?? [],
    camps: over.camps ?? [],
    projectiles: over.projectiles ?? [],
    walls: over.walls ?? ([] as readonly Rect[]),
    coreActive: over.coreActive ?? false,
    corePos: over.corePos ?? { x: 800, y: 600 },
    buy: over.buy ?? ((k) => (bought.push(k), true)),
    bought,
  };
}

/** Runs the controller until it emits a cast, or gives up. */
function castWithin(
  ai: ReturnType<typeof createAIController>,
  w: AIWorld,
  seconds: number,
  dt = 0.05,
) {
  for (let t = 0; t < seconds; t += dt) {
    const cmd = ai.think(w, dt);
    if (cmd.cast) return cmd;
  }
  return null;
}

afterEach(() => vi.restoreAllMocks());

describe("movement", () => {
  it("emits a normalized move vector", () => {
    seedRandom(0.5);
    const ai = createAIController("normal");
    const w = world();
    const { move } = ai.think(w, 0.05);
    expect(Math.hypot(move.x, move.y)).toBeCloseTo(1);
  });

  it("closes the gap when the foe is beyond its preferred range", () => {
    seedRandom(0.99); // never farm, never contest
    const ai = createAIController("normal");
    const self = testFighter("B", { x: 800, y: 200 });
    const w = world({ self, foe: testFighter("A", { x: 800, y: 1000 }) });
    const { move } = ai.think(w, 0.05);
    expect(move.y).toBeGreaterThan(0.5);
  });

  it("backs off when the foe is far inside its preferred range", () => {
    seedRandom(0.99);
    const ai = createAIController("normal");
    const self = testFighter("B", { x: 800, y: 780 });
    const w = world({ self, foe: testFighter("A", { x: 800, y: 800 }) });
    const { move } = ai.think(w, 0.05);
    expect(move.y).toBeLessThan(0);
  });

  it("strafes sideways while sitting at its preferred range", () => {
    seedRandom(0.99);
    const ai = createAIController("normal");
    const self = testFighter("B", { x: 800, y: 800 - AI.levels.normal.preferredRange });
    const w = world({ self, foe: testFighter("A", { x: 800, y: 800 }) });
    const { move } = ai.think(w, 0.05);
    expect(Math.abs(move.x)).toBeCloseTo(1);
    expect(move.y).toBeCloseTo(0);
  });

  it("pushes away from a wall it is hugging", () => {
    seedRandom(0.99);
    const ai = createAIController("normal");
    const self = testFighter("B", { x: 800, y: 795 });
    const wall: Rect = { x: 700, y: 800, w: 200, h: 40 };
    const w = world({ self, foe: testFighter("A", { x: 800, y: 1400 }), walls: [wall] });
    const { move } = ai.think(w, 0.05);
    expect(move.y).toBeLessThan(0); // away from the wall despite the foe being below it
  });

  it("retreats from the foe on low health", () => {
    seedRandom(0.99);
    const ai = createAIController("normal");
    const self = testFighter("B", { x: 800, y: 500 }, { hp: C.vanguard.maxHealth * 0.1 });
    const w = world({ self, foe: testFighter("A", { x: 800, y: 800 }) });
    const { move } = ai.think(w, 0.05);
    expect(move.y).toBeLessThan(0);
  });
});

describe("essence spending", () => {
  it("buys on its own cadence, prioritizing power while healthy", () => {
    seedRandom(0.99);
    const ai = createAIController("normal");
    const w = world();
    ai.think(w, 0.05);
    expect(w.bought).toEqual([]);
    ai.think(w, AI.levels.normal.buyInterval);
    expect(w.bought).toEqual(["power"]);
  });

  it("prioritizes vitality when hurt", () => {
    seedRandom(0.99);
    const ai = createAIController("normal");
    const self = testFighter("B", { x: 800, y: 400 }, { hp: C.vanguard.maxHealth * 0.4 });
    const w = world({ self });
    ai.think(w, AI.levels.normal.buyInterval);
    expect(w.bought).toEqual(["vitality"]);
  });

  it("falls through the priority list when a purchase is refused", () => {
    seedRandom(0.99);
    const ai = createAIController("normal");
    const attempts: UpgradeKind[] = [];
    const w = world({
      buy: (kind) => {
        attempts.push(kind);
        return kind === "haste";
      },
    });
    ai.think(w, AI.levels.normal.buyInterval);
    expect(attempts).toEqual(["power", "haste"]);
  });
});

describe("farming", () => {
  function farmWorld() {
    const camps = makeCamps();
    camps[0]!.phase = "AVAILABLE";
    camps[1]!.phase = "AVAILABLE";
    const mob = makeMob("crawler", camps[0]!.pos, camps[0]!.id);
    const self = testFighter("B", { x: camps[0]!.pos.x, y: camps[0]!.pos.y - 400 });
    const foe = testFighter("A", { x: camps[0]!.pos.x, y: camps[0]!.pos.y + 1200 });
    return world({ self, foe, camps, mobs: [mob] });
  }

  it("walks to the nearest camp when the foe is far away", () => {
    seedRandom(0); // always farm
    const ai = createAIController("normal");
    const w = farmWorld();
    const { move } = ai.think(w, 0.05);
    expect(move.y).toBeGreaterThan(0); // toward the camp below it
  });

  it("abandons a camp once it has been cleared", () => {
    seedRandom(0);
    const ai = createAIController("normal");
    const w = farmWorld();
    ai.think(w, 0.05);
    w.camps[0]!.phase = "CLEARED";
    w.camps[1]!.phase = "CLEARED";
    w.mobs[0]!.alive = false;
    const { move } = ai.think(w, 0.05);
    expect(move.y).toBeGreaterThan(0); // back to duelling the distant foe
  });

  it("shoots at the camp crawler rather than the distant foe", () => {
    seedRandom(0);
    const ai = createAIController("hard");
    const w = farmWorld();
    const cmd = castWithin(ai, w, 3);
    expect(cmd).not.toBeNull();
    expect(cmd!.aim.y).toBeGreaterThan(0); // the crawler is below, the foe much further below
  });

  it("does not farm while the foe is close", () => {
    seedRandom(0);
    const ai = createAIController("normal");
    const camps = makeCamps();
    camps[0]!.phase = "AVAILABLE";
    const self = testFighter("B", { x: camps[0]!.pos.x, y: camps[0]!.pos.y - 400 });
    const foe = testFighter("A", { x: self.pos.x, y: self.pos.y + 100 });
    const w = world({ self, foe, camps, mobs: [makeMob("crawler", camps[0]!.pos, 0)] });
    const { move } = ai.think(w, 0.05);
    // it holds duelling distance from the nearby foe instead of walking into the camp
    expect(move.y).toBeLessThan(0);
  });
});

describe("casting", () => {
  it("opens with the basic attack in poke range", () => {
    seedRandom(0.99); // no ult, no Q roll, no farming
    const ai = createAIController("normal");
    const self = testFighter("B", { x: 800, y: 600 });
    const w = world({ self, foe: testFighter("A", { x: 800, y: 800 }) });
    const cmd = castWithin(ai, w, 2);
    expect(cmd?.cast).toBe("basic");
  });

  it("fires the ult when charged and in range", () => {
    seedRandom(0); // every probability gate opens
    const ai = createAIController("hard");
    const self = testFighter("B", { x: 800, y: 600 }, { ultCharge: C.abilities.r.chargeMax });
    const w = world({ self, foe: testFighter("A", { x: 800, y: 800 }) });
    const cmd = castWithin(ai, w, 2);
    expect(cmd?.cast).toBe("r");
  });

  it("never casts an ability that is still on cooldown", () => {
    seedRandom(0);
    const ai = createAIController("hard");
    const self = testFighter("B", { x: 800, y: 600 });
    self.cooldowns = { basic: 5, q: 5, w: 5, e: 5, r: 5 };
    const w = world({ self, foe: testFighter("A", { x: 800, y: 800 }) });
    expect(castWithin(ai, w, 2)).toBeNull();
  });

  it("leads a moving target with its shot", () => {
    seedRandom(0.5); // aim error term becomes exactly zero
    const ai = createAIController("hard");
    const self = testFighter("B", { x: 800, y: 600 });
    const foe = testFighter("A", { x: 800, y: 800 }, { vel: { x: 400, y: 0 } });
    const w = world({ self, foe });
    const cmd = castWithin(ai, w, 2);
    expect(cmd?.cast).toBeTruthy();
    expect(cmd!.aim.x).toBeGreaterThan(0.1); // aiming ahead of the sideways-moving foe
  });
});

describe("dodging", () => {
  function incoming(pos: Vec, dir: Vec): Projectile {
    return {
      id: "p1",
      owner: "fighter_A",
      team: "A",
      kind: "basic",
      pos,
      dir,
      speed: C.vanguard.attackProjectileSpeed,
      radius: C.vanguard.attackProjectileRadius,
      damage: C.vanguard.attackDamage,
      traveled: 0,
      range: C.vanguard.attackRange,
      trail: [],
      trailMax: 4,
      tracked: true,
      resolved: false,
    };
  }

  it("dashes away from a projectile on a collision course", () => {
    seedRandom(0);
    const ai = createAIController("hard");
    const self = testFighter("B", { x: 800, y: 600 });
    const w = world({
      self,
      foe: testFighter("A", { x: 800, y: 800 }),
      projectiles: [incoming({ x: 800, y: 700 }, { x: 0, y: -1 })],
    });
    const cmd = castWithin(ai, w, 1);
    expect(cmd?.cast).toBe("w");
    expect(cmd!.move).toEqual(cmd!.aim); // dash vector doubles as the aim
  });

  it("ignores its own team's projectiles and shots that will miss", () => {
    seedRandom(0);
    const ai = createAIController("hard");
    const self = testFighter(
      "B",
      { x: 800, y: 600 },
      { cooldowns: { basic: 5, q: 5, w: 0, e: 0, r: 5 } },
    );
    const own = incoming({ x: 800, y: 700 }, { x: 0, y: -1 });
    own.team = "B";
    const wide = incoming({ x: 800, y: 700 }, { x: 0, y: 1 }); // travelling away
    const w = world({ self, foe: testFighter("A", { x: 800, y: 800 }), projectiles: [own, wide] });
    expect(castWithin(ai, w, 1)).toBeNull();
  });
});

describe("difficulty presets", () => {
  it("defaults to the configured difficulty", () => {
    seedRandom(0.5);
    const ai = createAIController();
    expect(ai.think(world(), 0.05)).toHaveProperty("aim");
  });

  it.each(["easy", "normal", "hard"] as const)("runs the %s preset", (difficulty) => {
    seedRandom(0.5);
    const ai = createAIController(difficulty);
    const w = world();
    for (let i = 0; i < 40; i++) {
      const cmd = ai.think(w, 0.05);
      expect(Number.isFinite(cmd.aim.x) && Number.isFinite(cmd.aim.y)).toBe(true);
      expect(Number.isFinite(cmd.move.x) && Number.isFinite(cmd.move.y)).toBe(true);
    }
  });
});

describe("contesting", () => {
  it("moves onto a camp the foe is farming", () => {
    seedRandom(0); // contest roll always succeeds
    const ai = createAIController("hard");
    const camps: Camp[] = makeCamps();
    camps[0]!.phase = "COMBAT";
    const mobs: Mob[] = [makeMob("crawler", camps[0]!.pos, camps[0]!.id)];
    const self = testFighter("B", { x: camps[0]!.pos.x, y: camps[0]!.pos.y - 900 });
    const foe = testFighter("A", { x: camps[0]!.pos.x, y: camps[0]!.pos.y });
    const { move } = ai.think(world({ self, foe, camps, mobs }), 0.05);
    expect(move.y).toBeGreaterThan(0.5);
  });
});
