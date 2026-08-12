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
      className={`relative touch-none select-none rounded-full border font-black uppercase tracking-wide transition-transform ${
        big ? "size-24 text-xl" : "size-[4.5rem] text-lg"
      } ${
        ready
          ? "border-primary/80 bg-[radial-gradient(circle_at_30%_25%,color-mix(in_oklab,var(--color-primary)_45%,transparent),color-mix(in_oklab,var(--color-primary)_12%,transparent))] text-primary shadow-[0_0_28px_color-mix(in_oklab,var(--color-primary)_45%,transparent),inset_0_0_18px_color-mix(in_oklab,var(--color-primary)_25%,transparent)]"
          : "border-border/40 bg-card/40 text-muted-foreground/60"
      } ${drag ? "scale-95" : ""}`}
    >
      <span
        className={`pointer-events-none absolute inset-[3px] rounded-full border ${
          ready ? "border-primary/30" : "border-border/25"
        }`}
      />
      {pct > 0 && (
        <span
          className="pointer-events-none absolute inset-0 rounded-full bg-background/80 backdrop-blur-[1px]"
          style={{ clipPath: `inset(0 0 ${(1 - pct) * 100}% 0)` }}
        />
      )}
      {charge !== undefined && charge < 1 && (
        <span
          className="pointer-events-none absolute inset-0 rounded-full bg-background/80"
          style={{ clipPath: `inset(0 0 ${charge * 100}% 0)` }}
        />
      )}
      {ready && (
        <span className="pointer-events-none absolute -inset-1 animate-pulse rounded-full border border-primary/25" />
      )}
      <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
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

