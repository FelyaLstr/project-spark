export type Vec = { x: number; y: number };

export const vec = (x = 0, y = 0): Vec => ({ x, y });
export const len = (v: Vec) => Math.hypot(v.x, v.y);
export const norm = (v: Vec): Vec => {
  const l = len(v);
  return l < 1e-6 ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l };
};
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s });
export const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Count a timer down without letting it go negative. */
export const decay = (v: number, dt: number) => Math.max(0, v - dt);

export type Rect = { x: number; y: number; w: number; h: number };

/** Point of `rect` closest to `p` — the basis of every circle/rect test here. */
export const closestPointOnRect = (p: Vec, rect: Rect): Vec => ({
  x: clamp(p.x, rect.x, rect.x + rect.w),
  y: clamp(p.y, rect.y, rect.y + rect.h),
});

/** Closest entity to `p`, ignoring dead ones. */
export function nearest<T extends { pos: Vec; alive?: boolean }>(
  items: readonly T[],
  p: Vec,
  maxDist = Infinity,
): T | null {
  let best: T | null = null;
  let bd = maxDist;
  for (const item of items) {
    if (item.alive === false) continue;
    const d = dist(item.pos, p);
    if (d < bd) {
      bd = d;
      best = item;
    }
  }
  return best;
}

/** Push a circle out of an axis-aligned rect. Returns corrected position. */
export function resolveCircleRect(p: Vec, r: number, rect: Rect): Vec {
  const { x: cx, y: cy } = closestPointOnRect(p, rect);
  const dx = p.x - cx;
  const dy = p.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 > r * r) return p;
  if (d2 > 1e-6) {
    const d = Math.sqrt(d2);
    return { x: cx + (dx / d) * r, y: cy + (dy / d) * r };
  }
  // center inside rect: push along smallest axis
  const left = Math.abs(p.x - rect.x);
  const right = Math.abs(rect.x + rect.w - p.x);
  const top = Math.abs(p.y - rect.y);
  const bottom = Math.abs(rect.y + rect.h - p.y);
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { x: rect.x - r, y: p.y };
  if (m === right) return { x: rect.x + rect.w + r, y: p.y };
  if (m === top) return { x: p.x, y: rect.y - r };
  return { x: p.x, y: rect.y + rect.h + r };
}

export function circleHitsRect(p: Vec, r: number, rect: Rect) {
  const { x: cx, y: cy } = closestPointOnRect(p, rect);
  return (p.x - cx) ** 2 + (p.y - cy) ** 2 <= r * r;
}

export function angleDiff(a: number, b: number) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
