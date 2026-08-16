import { RANK_ACCENT, type PlayerProfile } from "@/data/players";
import { cn } from "@/lib/utils";

type Props = { player: PlayerProfile; size?: number; className?: string };

export function PlayerAvatar({ player, size = 56, className }: Props) {
  const accent = RANK_ACCENT[player.rank];
  return (
    <div
      className={cn("relative grid shrink-0 place-items-center rounded-xl border", className)}
      style={{
        width: size,
        height: size,
        borderColor: `color-mix(in oklab, ${accent} 50%, transparent)`,
        background:
          "radial-gradient(circle at 50% 25%, color-mix(in oklab, var(--color-primary) 22%, transparent), transparent 70%), color-mix(in oklab, var(--color-card) 85%, black)",
        boxShadow: `0 0 22px color-mix(in oklab, ${accent} 22%, transparent)`,
      }}
    >
      <span
        className="font-black leading-none"
        style={{ fontSize: size * 0.42, color: accent, textShadow: `0 0 16px ${accent}` }}
      >
        {player.name.slice(0, 1).toUpperCase()}
      </span>
      <span
        className="absolute -bottom-2 rounded-full border border-border/70 bg-background px-1.5 py-px text-[9px] font-bold tracking-widest text-muted-foreground"
        style={{ fontSize: Math.max(8, size * 0.15) }}
      >
        {player.level}
      </span>
    </div>
  );
}
