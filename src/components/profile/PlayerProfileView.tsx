import { winRate, type FavouriteHero, type PlayerProfile } from "@/data/players";
import { PlayerAvatar } from "./PlayerAvatar";
import { RankBadge } from "./RankBadge";
import { MiniStat, RecentForm } from "./PlayerProfileCard";

export function PlayerProfileView({ player }: { player: PlayerProfile }) {
  const wr = winRate(player);
  return (
    <div className="space-y-4">
      {/* Identity */}
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/70 p-4">
        <div className="pointer-events-none absolute -top-16 left-1/2 size-56 -translate-x-1/2 rounded-full bg-primary/15 blur-[80px]" />
        <div className="relative flex items-center gap-4">
          <PlayerAvatar player={player} size={72} />
          <div className="min-w-0">
            <h3 className="truncate text-xl font-black uppercase tracking-[0.12em]">{player.name}</h3>
            <div className="mt-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Level {player.level}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <RankBadge rank={player.rank} division={player.division} />
              <span className="font-mono text-sm font-bold tabular-nums text-foreground">
                {player.rating} <span className="text-muted-foreground">RP</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Competitive stats */}
      <section className="rounded-2xl border border-border/60 bg-card/60 p-4">
        <div className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Competitive</div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
          <MiniStat label="Matches" value={player.matches.toLocaleString()} />
          <MiniStat label="Wins" value={player.wins.toLocaleString()} />
          <MiniStat label="Losses" value={player.losses.toLocaleString()} />
          <MiniStat label="Win rate" value={`${wr.toFixed(1)}%`} />
          <MiniStat label="K/D" value={player.kdRatio.toFixed(2)} />
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background/60">
          <div className="h-full rounded-full bg-primary" style={{ width: `${wr}%` }} />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Recent form</span>
          <RecentForm form={player.recentForm} />
        </div>
      </section>

      {/* Favourite heroes */}
      <section className="rounded-2xl border border-border/60 bg-card/60 p-4">
        <div className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Favourite heroes</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {player.favouriteHeroes.map((h) => (
            <HeroRow key={h.id} hero={h} />
          ))}
        </div>
      </section>
    </div>
  );
}

function HeroRow({ hero }: { hero: FavouriteHero }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 p-2.5">
      <div className="grid size-11 shrink-0 place-items-center rounded-lg border border-primary/35 bg-primary/10 text-sm font-black text-primary">
        {hero.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold">{hero.name}</div>
        <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{hero.role}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-mono text-sm font-bold tabular-nums text-primary">{hero.winRate.toFixed(1)}%</div>
        <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{hero.games} games</div>
      </div>
    </div>
  );
}
