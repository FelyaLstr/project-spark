import { useRef, useState, type PointerEvent as RPointerEvent } from "react";

type Props = { onChange: (v: { x: number; y: number }) => void };

export function Joystick({ onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  const handle = (e: RPointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const max = r.width / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const d = Math.hypot(dx, dy);
    if (d > max) {
      dx = (dx / d) * max;
      dy = (dy / d) * max;
    }
    setKnob({ x: dx, y: dy });
    onChange({ x: dx / max, y: dy / max });
  };

  const end = (e: RPointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setActive(false);
    setKnob({ x: 0, y: 0 });
    onChange({ x: 0, y: 0 });
  };

  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setActive(true);
        handle(e);
      }}
      onPointerMove={(e) => active && handle(e)}
      onPointerUp={end}
      onPointerCancel={end}
      className="relative size-36 touch-none rounded-full border border-border/70 bg-card/40 backdrop-blur-sm"
    >
      <div className="absolute inset-4 rounded-full border border-border/40" />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 size-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/70 shadow-[0_0_24px_var(--color-primary)]"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}
