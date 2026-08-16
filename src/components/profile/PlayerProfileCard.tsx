import { winRate, type PlayerProfile } from "@/data/players";
import { cn } from "@/lib/utils";
import { PlayerAvatar } from "./PlayerAvatar";
import { RankBadge } from "./RankBadge";

type Props = {
  player: PlayerProfile;
  onClick?: (player: PlayerProfile) => void;
  compact?: boolean;
  className?: string;
};

export function RecentForm({ form, size = "md" }: { form: ("W" | "L")[]; size?: "sm" | "md" }) {
  return (
    <div className="flex gap-1">
      {form.map((r, i) => (
        <span
          key={i}
          className={cn(
            "grid place-items-center rounded-[4px] border font-black",
            size === "sm" ? "size-4 text-[8px]" : "size-5 text-[10px]",
            r === "W"
              ? "border-primary/50 bg-primary/15 text-primary"
              : "border-destructive/50 bg-destructive/15 text-destructive",
          )}
        >
          {r}
        </span>
      ))}
    </div>
  );
}

/** Compact reusable profile card: results screen, player lists, opponent preview, leaderboard. */
export function PlayerProfileCard({ player, onClick, compact = false, className }: Props) {
  const wr = winRate(player);
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick: () => onClick(player) } : {})}
      className={cn(
        "group relative w-full overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-3 text-left backdrop-blur transition-colors",
        onClick && "hover:border-primary/50 active:scale-[0.995]",
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full bg-primary/10 blur-2xl" />
      <div className="relative flex items-center gap-3">
        <PlayerAvatar player={player} size={compact ? 44 : 56} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-bold leading-tight">{player.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <RankBadge rank={player.rank} division={player.division} size="sm" />
            <span className="font-mono text-xs font-bold tabular-nums text-muted-foreground">
              {player.rating} RP
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-lg font-black tabular-nums text-primary">{wr.toFixed(1)}%</div>
          <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Win rate</div>
        </div>
      </div>

      {!compact && (
        <div className="relative mt-3 grid grid-cols-3 gap-2 text-center">
          <MiniStat label="Matches" value={player.matches.toLocaleString()} />
          <MiniStat label="K/D" value={player.kdRatio.toFixed(2)} />
          <MiniStat label="W / L" value={`${player.wins}/${player.losses}`} />
        </div>
      )}

      <div className="relative mt-3 flex items-center justify-between gap-2">
        <span className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">Recent form</span>
        <RecentForm form={player.recentForm} size="sm" />
      </div>
    </Tag>
  );
}

export function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/40 py-2">
      <div className="font-mono text-sm font-bold tabular-nums">{value}</div>
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}
