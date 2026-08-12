import { describe, expect, it } from "vitest";
import {
  add,
  angleDiff,
  circleHitsRect,
  clamp,
  dist,
  len,
  lerp,
  norm,
  resolveCircleRect,
  scale,
  sub,
  vec,
  type Rect,
} from "./math";

describe("vector helpers", () => {
  it("builds vectors with zero defaults", () => {
    expect(vec()).toEqual({ x: 0, y: 0 });
    expect(vec(3, -4)).toEqual({ x: 3, y: -4 });
  });

  it("measures length and distance", () => {
    expect(len({ x: 3, y: 4 })).toBe(5);
    expect(dist({ x: 1, y: 1 }, { x: 4, y: 5 })).toBe(5);
  });

  it("normalizes to unit length", () => {
    expect(norm({ x: 0, y: 5 })).toEqual({ x: 0, y: 1 });
    expect(len(norm({ x: 3, y: 4 }))).toBeCloseTo(1);
  });

  it("normalizes degenerate vectors to zero instead of NaN", () => {
    expect(norm({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(norm({ x: 1e-9, y: -1e-9 })).toEqual({ x: 0, y: 0 });
  });

  it("adds, subtracts and scales", () => {
    expect(add({ x: 1, y: 2 }, { x: 3, y: -5 })).toEqual({ x: 4, y: -3 });
    expect(sub({ x: 1, y: 2 }, { x: 3, y: -5 })).toEqual({ x: -2, y: 7 });
    expect(scale({ x: 2, y: -3 }, 2.5)).toEqual({ x: 5, y: -7.5 });
  });
});

describe("clamp / lerp", () => {
  it("clamps into range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it("interpolates including the endpoints", () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 1)).toBe(20);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
    expect(lerp(10, 20, 2)).toBe(30);
  });
});

describe("resolveCircleRect", () => {
  const rect: Rect = { x: 0, y: 0, w: 100, h: 50 };

  it("leaves a circle that is clear of the rect untouched", () => {
    const p = { x: 200, y: 200 };
    expect(resolveCircleRect(p, 10, rect)).toBe(p);
  });

  it("pushes an overlapping circle out to exactly its radius", () => {
    const out = resolveCircleRect({ x: 50, y: 55 }, 10, rect);
    expect(out).toEqual({ x: 50, y: 60 });
    expect(circleHitsRect(out, 9.99, rect)).toBe(false);
  });

  it("pushes diagonally when the nearest point is a corner", () => {
    const out = resolveCircleRect({ x: 103, y: 53 }, 10, rect);
    expect(dist(out, { x: 100, y: 50 })).toBeCloseTo(10);
    expect(out.x).toBeGreaterThan(100);
    expect(out.y).toBeGreaterThan(50);
  });

  it("ejects a center inside the rect along the closest edge", () => {
    // closest edge is the top (y = 0)
    expect(resolveCircleRect({ x: 50, y: 5 }, 10, rect)).toEqual({ x: 50, y: -10 });
    // closest edge is the bottom (y = 50)
    expect(resolveCircleRect({ x: 50, y: 45 }, 10, rect)).toEqual({ x: 50, y: 60 });
    // closest edge is the left (x = 0)
    expect(resolveCircleRect({ x: 3, y: 25 }, 10, rect)).toEqual({ x: -10, y: 25 });
    // closest edge is the right (x = 100)
    expect(resolveCircleRect({ x: 97, y: 25 }, 10, rect)).toEqual({ x: 110, y: 25 });
  });
});

describe("circleHitsRect", () => {
  const rect: Rect = { x: 0, y: 0, w: 100, h: 50 };

  it("detects overlap, touching and separation", () => {
    expect(circleHitsRect({ x: 50, y: 25 }, 1, rect)).toBe(true);
    expect(circleHitsRect({ x: 50, y: 60 }, 10, rect)).toBe(true);
    expect(circleHitsRect({ x: 50, y: 61 }, 10, rect)).toBe(false);
  });

  it("uses the corner distance rather than the bounding box", () => {
    expect(circleHitsRect({ x: 108, y: 58 }, 10, rect)).toBe(false);
    expect(circleHitsRect({ x: 105, y: 55 }, 10, rect)).toBe(true);
  });
});

describe("angleDiff", () => {
  it("returns the signed shortest difference", () => {
    expect(angleDiff(0.5, 0.2)).toBeCloseTo(0.3);
    expect(angleDiff(0.2, 0.5)).toBeCloseTo(-0.3);
  });

  it("wraps across the +/-PI seam", () => {
    expect(angleDiff(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(-0.2);
    expect(angleDiff(-Math.PI + 0.1, Math.PI - 0.1)).toBeCloseTo(0.2);
  });

  it("keeps the result within +/-PI for multi-turn inputs", () => {
    const d = angleDiff(7 * Math.PI, 0);
    expect(Math.abs(d)).toBeLessThanOrEqual(Math.PI);
    expect(Math.abs(d)).toBeCloseTo(Math.PI);
  });
});
