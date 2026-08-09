import { useEffect, useMemo, useRef, useState } from "react";
import { GameEngine } from "@/game/combat/GameEngine";
import { render } from "@/game/rendering/renderer";
import { InputController } from "@/game/input/InputController";
import { GAME_CONFIG } from "@/game/config/gameConfig";
import type { AbilityKey, Snapshot } from "@/game/core/types";
import { Joystick } from "./Joystick";
import { AbilityButton } from "./AbilityButton";

const C = GAME_CONFIG;

export type MatchResult = {
  won: boolean;
  damageDealt: number;
  damageTaken: number;
  abilitiesHit: number;
  abilitiesMissed: number;
  mobsKilled: number;
  essenceEarned: number;
  coreCaptures: number;
};

type Props = { opponentName: string; onFinish: (r: MatchResult) => void; onQuit: () => void };

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function ArenaScreen({ opponentName, onFinish, onQuit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engine = useMemo(() => new GameEngine(), []);
  const input = useMemo(() => new InputController(), []);
  const [hud, setHud] = useState<Snapshot | null>(null);
  const finished = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let hudTimer = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      engine.update(dt, input.consume());
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      render(ctx, engine, canvas.clientWidth, canvas.clientHeight, dpr);

      hudTimer -= dt;
      if (hudTimer <= 0) {
        hudTimer = 0.08;
        setHud({ ...engine.snapshot() });
      }
      if (engine.phase === "RESULTS" && !finished.current) {
        finished.current = true;
        const p = engine.player;
        onFinish({
          won: engine.winner === "A",
          damageDealt: Math.round(p.stats.damageDealt),
          damageTaken: Math.round(p.stats.damageTaken),
          abilitiesHit: p.stats.abilitiesHit,
          abilitiesMissed: p.stats.abilitiesMissed,
          mobsKilled: p.stats.mobsKilled,
          essenceEarned: Math.round(p.stats.essenceEarned),
          coreCaptures: p.stats.coreCaptures,
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const kd = (e: KeyboardEvent) => {
      if (e.code === "Space") e.preventDefault();
      input.keyDown(e.code);
    };
    const ku = (e: KeyboardEvent) => input.keyUp(e.code);
    const mm = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      input.setAim({ x: e.clientX - (r.left + r.width / 2), y: e.clientY - (r.top + r.height / 2) });
    };
    const md = (e: MouseEvent) => {
      if (e.button === 0) input.queue("basic");
      if (e.button === 2) input.queue("q");
    };
    const preventScroll = (e: TouchEvent) => e.preventDefault();
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    canvas.addEventListener("mousemove", mm);
    canvas.addEventListener("mousedown", md);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("touchmove", preventScroll, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      canvas.removeEventListener("mousemove", mm);
      canvas.removeEventListener("mousedown", md);
      document.removeEventListener("touchmove", preventScroll);
    };
  }, [engine, input, onFinish]);

  const cast = (a: AbilityKey) => input.queue(a);
  const aimStart = (a: AbilityKey) => {
    engine.aimPreview = { active: true, ability: a };
  };
  const aimEnd = () => {
    engine.aimPreview = { active: false, ability: null };
  };
  const p = hud?.player;
  const ultReady = p ? p.ultCharge / C.abilities.r.chargeMax : 0;

  return (
    <div className="relative h-[100dvh] w-full touch-none overflow-hidden overscroll-none bg-background">
      <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" />

      {/* Top HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <Bar label="YOU" ratio={p ? p.hp / p.maxHp : 1} value={p ? Math.ceil(p.hp) : 0} tone="primary" />
          <div className="shrink-0 text-center">
            <div className="font-mono text-lg font-bold text-foreground">{hud ? fmt(hud.timeLeft) : "--:--"}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {hud?.core.active ? "CORE ACTIVE" : "CORE IDLE"}
            </div>
          </div>
          <Bar
            label={opponentName}
            ratio={hud ? hud.enemy.hp / hud.enemy.maxHp : 1}
            value={hud ? Math.ceil(hud.enemy.hp) : 0}
            tone="destructive"
            reverse
          />
        </div>
        <div className="mt-2 flex items-center justify-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <span className="rounded bg-card/70 px-2 py-1">ULT {Math.floor(ultReady * 100)}%</span>
          {p && p.ultActiveFor > 0 && <Chip>OVERDRIVE</Chip>}
        </div>
      </div>

      {/* Announcement / countdown */}
      {hud?.phase === "COUNTDOWN" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-7xl font-black text-primary drop-shadow-[0_0_30px_var(--color-primary)]">
            {Math.ceil(hud.countdown) || "GO"}
          </span>
        </div>
      )}
      {hud?.announcement && hud.phase !== "COUNTDOWN" && (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 text-center">
          <span className="text-2xl font-black uppercase tracking-[0.25em] text-primary drop-shadow-[0_0_20px_var(--color-primary)]">
            {hud.announcement}
          </span>
        </div>
      )}

      {/* Bottom controls */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Joystick onChange={(v) => input.setMove(v)} />
        <div className="flex items-end gap-3">
          <div className="flex flex-col items-center gap-3">
            <AbilityButton
              label="R"
              ability="r"
              cooldown={0}
              maxCooldown={0}
              charge={ultReady}
              onCast={cast}
              aimable={false}
            />
            <AbilityButton
              label="W"
              ability="w"
              cooldown={p?.cooldowns.w ?? 0}
              maxCooldown={C.abilities.w.cooldown}
              onAim={(v) => input.setAim(v)}
              onAimStart={aimStart}
              onAimEnd={aimEnd}
              onCast={cast}
            />
          </div>
          <div className="flex flex-col items-center gap-3">
            <AbilityButton
              label="Q"
              ability="q"
              cooldown={p?.cooldowns.q ?? 0}
              maxCooldown={C.abilities.q.cooldown}
              onAim={(v) => input.setAim(v)}
              onAimStart={aimStart}
              onAimEnd={aimEnd}
              onCast={cast}
            />
            <AbilityButton
              label="ATK"
              ability="basic"
              big
              cooldown={p?.cooldowns.basic ?? 0}
              maxCooldown={C.vanguard.attackCooldown}
              onAim={(v) => input.setAim(v)}
              onAimStart={aimStart}
              onAimEnd={aimEnd}
              onCast={cast}
            />
          </div>
        </div>
      </div>

      <button
        onClick={onQuit}
        className="absolute left-3 top-24 rounded-md border border-border/60 bg-card/70 px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground"
      >
        Quit
      </button>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-primary/15 px-2 py-1 text-primary">{children}</span>;
}

function Bar({
  label,
  ratio,
  value,
  tone,
  reverse,
}: {
  label: string;
  ratio: number;
  value: number;
  tone: "primary" | "destructive";
  reverse?: boolean;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className={`flex text-[10px] uppercase tracking-widest text-muted-foreground ${reverse ? "justify-end" : ""}`}>
        <span className="truncate">{label} · {value}</span>
      </div>
      <div className={`mt-1 h-2.5 w-full overflow-hidden rounded-full bg-card/80 ${reverse ? "flex justify-end" : ""}`}>
        <div
          className={`h-full ${tone === "primary" ? "bg-primary" : "bg-destructive"}`}
          style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }}
        />
      </div>
    </div>
  );
}
