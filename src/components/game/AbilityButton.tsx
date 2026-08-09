import { useRef, useState, type PointerEvent as RPointerEvent } from "react";
import type { AbilityKey } from "@/game/core/types";

type Props = {
  label: string;
  ability: AbilityKey;
  cooldown: number;
  maxCooldown: number;
  charge?: number;
  aimable?: boolean;
  onAim?: (v: { x: number; y: number }) => void;
  onAimStart?: (ability: AbilityKey) => void;
  onAimEnd?: () => void;
  onCast: (ability: AbilityKey) => void;
  big?: boolean;
};

export function AbilityButton({
  label,
  ability,
  cooldown,
  maxCooldown,
  charge,
  aimable = true,
  onAim,
  onAimStart,
  onAimEnd,
  onCast,
  big,
}: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const [drag, setDrag] = useState(false);
  const ready = cooldown <= 0 && (charge === undefined || charge >= 1);
  const pct = maxCooldown > 0 ? cooldown / maxCooldown : 0;

  const move = (e: RPointerEvent<HTMLButtonElement>) => {
    if (!aimable) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) > 10) onAim?.({ x: dx, y: dy });
  };

  const end = (e: RPointerEvent<HTMLButtonElement>) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setDrag(false);
    onAimEnd?.();
  };

  return (
    <button
      ref={ref}
      aria-label={`Ability ${label}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag(true);
        if (aimable) onAimStart?.(ability);
        move(e);
      }}
      onPointerMove={(e) => drag && move(e)}
      onPointerUp={(e) => {
        end(e);
        if (ready) onCast(ability);
      }}
      onPointerCancel={end}
      className={`relative touch-none select-none rounded-full border-2 font-bold uppercase tracking-wide transition-transform ${
        big ? "size-24 text-xl" : "size-[4.5rem] text-lg"
      } ${
        ready
          ? "border-primary bg-primary/25 text-primary shadow-[0_0_24px_color-mix(in_oklab,var(--color-primary)_55%,transparent)]"
          : "border-border/50 bg-card/40 text-muted-foreground/70"
      } ${drag ? "scale-95" : ""}`}
    >
      {pct > 0 && (
        <span
          className="pointer-events-none absolute inset-0 rounded-full bg-background/75"
          style={{ clipPath: `inset(0 0 ${(1 - pct) * 100}% 0)` }}
        />
      )}
      {charge !== undefined && charge < 1 && (
        <span
          className="pointer-events-none absolute inset-0 rounded-full bg-background/75"
          style={{ clipPath: `inset(0 0 ${charge * 100}% 0)` }}
        />
      )}
      <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span>{label}</span>
        {cooldown > 0 && (
          <span className="mt-0.5 font-mono text-[11px] font-semibold text-foreground/80">{cooldown.toFixed(1)}</span>
        )}
        {charge !== undefined && charge < 1 && cooldown <= 0 && (
          <span className="mt-0.5 font-mono text-[11px] font-semibold text-foreground/70">
            {Math.floor(charge * 100)}%
          </span>
        )}
      </span>
    </button>
  );
}
