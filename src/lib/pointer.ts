export type PointerLike = { clientX: number; clientY: number };

export type PointerOffset = {
  /** offset from the element centre, in CSS pixels */
  x: number;
  y: number;
  distance: number;
  /** half the element's width — the natural "full deflection" distance */
  radius: number;
};

/** Where a pointer sits relative to the centre of a round control. */
export function pointerOffset(el: Element, e: PointerLike): PointerOffset {
  const r = el.getBoundingClientRect();
  const x = e.clientX - (r.left + r.width / 2);
  const y = e.clientY - (r.top + r.height / 2);
  return { x, y, distance: Math.hypot(x, y), radius: r.width / 2 };
}

/** Same offset, clamped to the control's radius (joystick-style knob travel). */
export function clampedPointerOffset(el: Element, e: PointerLike): PointerOffset {
  const o = pointerOffset(el, e);
  if (o.distance <= o.radius) return o;
  const k = o.radius / o.distance;
  return { x: o.x * k, y: o.y * k, distance: o.radius, radius: o.radius };
}

type CapturingEvent = { currentTarget: Element; pointerId: number };

export const capturePointer = (e: CapturingEvent) => e.currentTarget.setPointerCapture(e.pointerId);
export const releasePointer = (e: CapturingEvent) =>
  e.currentTarget.releasePointerCapture?.(e.pointerId);
