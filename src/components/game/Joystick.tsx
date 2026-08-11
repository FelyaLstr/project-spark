import { useRef, useState, type PointerEvent as RPointerEvent } from "react";

type Props = {
  onChange: (v: { x: number; y: number }) => void;
  onEnd?: (lastAim: { x: number; y: number } | null) => void;
};

export function Joystick({ onChange, onEnd }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const activePointer = useRef<number | null>(null);
  const lastNonZero = useRef<{ x: number; y: number } | null>(null);

  const DEADZONE = 0.12; // normalized deadzone radius

  const handle = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const max = r.width / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const d = Math.hypot(dx, dy);
    if (d > max) {
      dx = (dx / d) * max;
      dy = (dy / d) * max;
    }
    setKnob({ x: dx, y: dy });
    const nx = dx / max;
    const ny = dy / max;
    const mag = Math.hypot(nx, ny);
    if (mag < DEADZONE) {
      onChange({ x: 0, y: 0 });
    } else {
      const scale = (mag - DEADZONE) / (1 - DEADZONE);
      const vx = (nx / mag) * scale;
      const vy = (ny / mag) * scale;
      onChange({ x: vx, y: vy });
      lastNonZero.current = { x: vx, y: vy };
    }
  };

  const end = (pointerId?: number) => {
    activePointer.current = null;
    setActive(false);
    setKnob({ x: 0, y: 0 });
    onChange({ x: 0, y: 0 });
    onEnd?.(lastNonZero.current ?? null);
  };

  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        // only capture if not already owned
        if (activePointer.current == null) {
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
          activePointer.current = e.pointerId;
          setActive(true);
          handle(e.clientX, e.clientY);
        }
      }}
      onPointerMove={(e) => {
        if (active && activePointer.current === e.pointerId) handle(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (activePointer.current === e.pointerId) {
          (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
          end(e.pointerId);
        }
      }}
      onPointerCancel={(e) => {
        if (activePointer.current === e.pointerId) {
          (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
          end(e.pointerId);
        }
      }}
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
