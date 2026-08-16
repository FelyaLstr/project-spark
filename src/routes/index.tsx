import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArenaScreen, type MatchResult } from "@/components/game/ArenaScreen";
import { matchService } from "@/services/matchService";
import { initTelegram } from "@/services/telegram";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vanguard Arena — 1v1 PvP Mini Game" },
      {
        name: "description",
        content:
          "Fast 1v1 top-down arena duels: dodge skillshots, farm neutral camps for Essence, and contest The Core.",
      },
      { property: "og:title", content: "Vanguard Arena — 1v1 PvP Mini Game" },
      {
        property: "og:description",
        content: "Fast 1v1 top-down arena duels with skillshots, neutral camps and a contested Core objective.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: App,
});

type Screen = "MENU" | "MATCHMAKING" | "ARENA" | "RESULTS";

type Profile = { name: string; rating: number; wins: number; losses: number; streak: number };

const loadProfile = (): Profile => {
  if (typeof window === "undefined") return { name: "Vanguard", rating: 1000, wins: 0, losses: 0, streak: 0 };
  try {
    const raw = localStorage.getItem("va_profile");
    if (raw) return JSON.parse(raw) as Profile;
  } catch {
    /* ignore */
  }
  return { name: "Vanguard", rating: 1000, wins: 0, losses: 0, streak: 0 };
};

function App() {
  const [screen, setScreen] = useState<Screen>("MENU");
  const [opponent, setOpponent] = useState("Nyx");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [matchKey, setMatchKey] = useState(0);

  useEffect(() => {
    const tg = initTelegram();
    if (tg.isTelegram) setProfile((p) => ({ ...p, name: tg.name }));
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("va_profile", JSON.stringify(profile));
  }, [profile]);

  const startSearch = useCallback(async () => {
    setScreen("MATCHMAKING");
    const ticket = await matchService.findMatch();
    setOpponent(ticket.opponentName);
    setMatchKey((k) => k + 1);
    setScreen("ARENA");
  }, []);

  const practice = () => {
    setOpponent("Training Dummy");
    setMatchKey((k) => k + 1);
    setScreen("ARENA");
  };

  const onFinish = useCallback((r: MatchResult) => {
    setResult(r);
    setProfile((p) => ({
      ...p,
      rating: p.rating + (r.won ? 18 : -12),
      wins: p.wins + (r.won ? 1 : 0),
      losses: p.losses + (r.won ? 0 : 1),
      streak: r.won ? p.streak + 1 : 0,
    }));
    setScreen("RESULTS");
  }, []);

  if (screen === "ARENA") {
    return (
      <ArenaScreen key={matchKey} opponentName={opponent} onFinish={onFinish} onQuit={() => setScreen("MENU")} />
    );
  }

  const selfProfile: PlayerProfile = {
    ...MOCK_PLAYERS.self,
    name: profile.name,
    rating: profile.rating,
    wins: MOCK_PLAYERS.self.wins + profile.wins,
    losses: MOCK_PLAYERS.self.losses + profile.losses,
    matches: MOCK_PLAYERS.self.matches + profile.wins + profile.losses,
  };
  const opponentProfile = getPlayerByName(opponent);

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-background px-5 py-8 text-foreground">
      <div className="pointer-events-none absolute -top-32 left-1/2 size-96 -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
      <div className="relative mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col">
        {screen === "MENU" && (
          <Menu
            profile={profile}
            self={selfProfile}
            onPlay={startSearch}
            onPractice={practice}
            onOpenProfile={setViewed}
          />
        )}
        {screen === "MATCHMAKING" && <Searching onCancel={() => setScreen("MENU")} />}
        {screen === "RESULTS" && result && (
          <Results
            result={result}
            self={selfProfile}
            opponent={opponentProfile}
            onOpenProfile={setViewed}
            onRematch={startSearch}
            onMenu={() => setScreen("MENU")}
          />
        )}
      </div>
      <PlayerProfileDialog player={viewed} open={!!viewed} onOpenChange={(o) => !o && setViewed(null)} />
    </main>
  );
}

function Menu({
  profile,
  self,
  onPlay,
  onPractice,
  onOpenProfile,
}: {
  profile: Profile;
  self: PlayerProfile;
  onPlay: () => void;
  onPractice: () => void;
  onOpenProfile: (p: PlayerProfile) => void;
}) {
  const rivals = PLAYER_LIST.filter((p) => p.id !== "self");
  return (
    <>
      <header className="text-center">
        <h1 className="text-4xl font-black uppercase tracking-[0.2em] text-primary drop-shadow-[0_0_24px_var(--color-primary)]">
          Vanguard
        </h1>
        <p className="mt-1 text-xs uppercase tracking-[0.35em] text-muted-foreground">Arena · 1v1</p>
      </header>

      <section className="mt-8">
        <PlayerProfileCard player={self} onClick={onOpenProfile} />
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <Stat label="Wins" value={profile.wins} />
          <Stat label="Losses" value={profile.losses} />
          <Stat label="Streak" value={profile.streak} />
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-2 text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Rivals</div>
        <div className="space-y-2">
          {rivals.map((p) => (
            <PlayerProfileCard key={p.id} player={p} onClick={onOpenProfile} compact />
          ))}
        </div>
      </section>


      <button
        onClick={onPlay}
        className="mt-8 w-full rounded-2xl bg-primary py-5 text-lg font-black uppercase tracking-[0.25em] text-primary-foreground shadow-[0_0_40px_color-mix(in_oklab,var(--color-primary)_40%,transparent)] active:scale-[0.99]"
      >
        Play 1v1
      </button>
      <button
        onClick={onPractice}
        className="mt-3 w-full rounded-2xl border border-border/70 bg-card/50 py-4 text-sm font-bold uppercase tracking-[0.2em] text-foreground"
      >
        Practice
      </button>

      <div className="mt-auto pt-8 text-center text-[11px] leading-relaxed text-muted-foreground">
        Mobile: joystick to move, drag ability buttons to aim, release to cast.
        <br />
        Desktop: WASD move · mouse aim · LMB attack · Q skillshot · Shift dash · R ultimate.
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/40 py-2">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

function Searching({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <div className="size-24 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Searching for opponent…</p>
      <button onClick={onCancel} className="text-xs uppercase tracking-widest text-muted-foreground underline">
        Cancel
      </button>
    </div>
  );
}

function Results({
  result,
  onRematch,
  onMenu,
}: {
  result: MatchResult;
  onRematch: () => void;
  onMenu: () => void;
}) {
  return (
    <div className="relative flex flex-1 flex-col justify-center">
      <div
        className={`pointer-events-none absolute left-1/2 top-16 size-72 -translate-x-1/2 rounded-full blur-[110px] ${
          result.won ? "bg-primary/30" : "bg-destructive/25"
        }`}
      />
      <div className="relative text-center">
        <div className="text-[10px] uppercase tracking-[0.5em] text-muted-foreground">Match result</div>
        <h2
          className={`animate-slam-in mt-2 text-5xl font-black uppercase tracking-[0.18em] ${
            result.won
              ? "text-primary drop-shadow-[0_0_36px_var(--color-primary)]"
              : "text-destructive drop-shadow-[0_0_30px_var(--color-destructive)]"
          }`}
        >
          {result.won ? "Victory" : "Defeat"}
        </h2>
        <div
          className={`mx-auto mt-3 h-px w-40 ${result.won ? "bg-primary/60" : "bg-destructive/60"}`}
        />
      </div>

      <div className="mt-8 space-y-2 rounded-2xl border border-border/60 bg-card/60 p-4">
        <Row label="Damage dealt" value={result.damageDealt} />
        <Row label="Damage received" value={result.damageTaken} />
        <Row label="Abilities hit" value={result.abilitiesHit} />
        <Row label="Abilities missed" value={result.abilitiesMissed} />
      </div>
      <button
        onClick={onRematch}
        className="mt-8 w-full rounded-2xl bg-primary py-4 text-base font-black uppercase tracking-[0.25em] text-primary-foreground"
      >
        Rematch
      </button>
      <button
        onClick={onMenu}
        className="mt-3 w-full rounded-2xl border border-border/70 bg-card/50 py-3 text-sm font-bold uppercase tracking-[0.2em]"
      >
        Return to menu
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
