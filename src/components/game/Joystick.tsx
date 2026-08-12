import { useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { capturePointer, clampedPointerOffset, releasePointer } from "@/lib/pointer";

type Props = { onChange: (v: { x: number; y: number }) => void };

export function Joystick({ onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  const handle = (e: RPointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const { x, y, radius } = clampedPointerOffset(el, e);
    setKnob({ x, y });
    onChange({ x: x / radius, y: y / radius });
  };

  const end = (e: RPointerEvent<HTMLDivElement>) => {
    releasePointer(e);
    setActive(false);
    setKnob({ x: 0, y: 0 });
    onChange({ x: 0, y: 0 });
  };

  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        capturePointer(e);
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
