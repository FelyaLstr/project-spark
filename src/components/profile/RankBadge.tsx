import { RANK_ACCENT, type RankTier } from "@/data/players";
import { cn } from "@/lib/utils";

type Props = { rank: RankTier; division?: string; size?: "sm" | "md"; className?: string };

export function RankBadge({ rank, division, size = "md", className }: Props) {
  const accent = RANK_ACCENT[rank];
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-2 py-1 backdrop-blur-sm",
        size === "sm" ? "text-[9px]" : "text-[10px]",
        className,
      )}
      style={{
        borderColor: `color-mix(in oklab, ${accent} 45%, transparent)`,
        background: `color-mix(in oklab, ${accent} 12%, transparent)`,
        boxShadow: `0 0 18px color-mix(in oklab, ${accent} 18%, transparent) inset`,
      }}
    >
      <span
        className={cn("block rotate-45 rounded-[2px]", size === "sm" ? "size-2" : "size-2.5")}
        style={{ background: accent, boxShadow: `0 0 10px ${accent}` }}
      />
      <span className="font-bold uppercase tracking-[0.22em]" style={{ color: accent }}>
        {rank}
        {division ? ` ${division}` : ""}
      </span>
    </div>
  );
}
