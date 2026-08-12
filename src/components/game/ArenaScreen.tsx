import { useEffect, useMemo, useRef, useState } from "react";
import { GameEngine } from "@/game/combat/GameEngine";
import { render } from "@/game/rendering/renderer";
import { InputController } from "@/game/input/InputController";
import { GAME_CONFIG } from "@/game/config/gameConfig";
import { clamp } from "@/game/core/math";
import type { AbilityKey, Snapshot, UpgradeKind } from "@/game/core/types";
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

const UPGRADES: { kind: UpgradeKind; label: string }[] = [
  { kind: "power", label: "PWR" },
  { kind: "vitality", label: "VIT" },
  { kind: "haste", label: "HST" },
];

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function getCamera(viewW: number, viewH: number, playerPos: { x: number; y: number }) {
  const zoom = Math.max(0.52, Math.min(0.95, viewW / 900));
  const halfW = viewW / 2 / zoom;
  const halfH = viewH / 2 / zoom;
  return {
    zoom,
    cam: {
      x: clamp(playerPos.x, Math.min(halfW, C.arena.width / 2), Math.max(C.arena.width - halfW, C.arena.width / 2)),
      y: clamp(playerPos.y, Math.min(halfH, C.arena.height / 2), Math.max(C.arena.height - halfH, C.arena.height / 2)),
    },
  };
}

export function ArenaScreen({ opponentName, onFinish, onQuit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engine = useMemo(() => new GameEngine(), []);
  const input = useMemo(() => new InputController(), []);
  const [hud, setHud] = useState<Snapshot | null>(null);
  const [flash, setFlash] = useState<UpgradeKind | null>(null);
  const [fpsDisplay, setFpsDisplay] = useState(60);
  const [isPortrait, setIsPortrait] = useState(() => (typeof window !== "undefined" ? window.innerHeight >= window.innerWidth : false));
  const finished = useRef(false);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let hudTimer = 0;
    let fpsTimer = 0;
    let fps = 60;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    };
    resize();
    const updateOrientation = () => {
      setIsPortrait(window.innerHeight >= window.innerWidth);
    };

    resize();
    updateOrientation();
    window.addEventListener("resize", resize);
    window.addEventListener("resize", updateOrientation);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (dt > 0) fps += (1 / dt - fps) * 0.1;
      fpsTimer -= dt;
      if (fpsTimer <= 0) {
        fpsTimer = 0.5;
        setFpsDisplay(Math.round(fps));
      }
      engine.update(dt, input.consume());
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      render(ctx, engine, canvas.clientWidth, canvas.clientHeight, dpr, fps);


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
      const viewW = r.width || 1;
      const viewH = r.height || 1;
      const { zoom, cam } = getCamera(viewW, viewH, engine.player.pos);
      const worldX = cam.x + (e.clientX - (r.left + viewW / 2)) / zoom;
      const worldY = cam.y + (e.clientY - (r.top + viewH / 2)) / zoom;
      input.setAim({ x: worldX - engine.player.pos.x, y: worldY - engine.player.pos.y });
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
      window.removeEventListener("resize", updateOrientation);
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
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-background/85 via-background/40 to-transparent p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="absolute left-3 top-3 rounded-full border border-border/50 bg-card/60 px-2.5 py-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground backdrop-blur-sm">
          <span className="mr-2">FPS</span>
          <span className="font-mono text-sm font-bold text-foreground">{fpsDisplay}</span>
        </div>
        <div className="flex items-center gap-3">
          <Bar label="YOU" ratio={p ? p.hp / p.maxHp : 1} value={p ? Math.ceil(p.hp) : 0} tone="primary" />
          <div className="shrink-0 rounded-lg border border-border/50 bg-card/60 px-2.5 py-1 text-center backdrop-blur-sm">
            <div className="font-mono text-lg font-black tabular-nums text-foreground">{hud ? fmt(hud.timeLeft) : "--:--"}</div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
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
        <div className="mt-2 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em]">
          <span
            className={`rounded-full border px-2.5 py-1 ${
              ultReady >= 1
                ? "border-accent/70 bg-accent/20 text-accent shadow-[0_0_16px_color-mix(in_oklab,var(--color-accent)_45%,transparent)]"
                : "border-border/50 bg-card/60 text-muted-foreground"
            }`}
          >
            ULT {Math.floor(ultReady * 100)}%
          </span>
          {C.features.essenceUpgrades && (
            <span className="rounded-full border border-cyan-400/50 bg-cyan-400/15 px-2.5 py-1 text-cyan-200 shadow-[0_0_14px_rgba(34,211,238,0.25)]">
              ESSENCE {hud?.essence ?? 0}
            </span>
          )}
          {p && p.ultActiveFor > 0 && <Chip>OVERDRIVE</Chip>}
        </div>
      </div>


      {/* Temporary upgrades (match-only) */}
      {C.features.essenceUpgrades && hud && (
        <div className="absolute left-3 top-1/2 flex -translate-y-1/2 flex-col gap-2">
          {UPGRADES.map((u) => {
            const level = hud.upgrades[u.kind];
            const maxed = level >= C.upgrades.maxLevel;
            const affordable = !maxed && hud.essence >= C.upgrades.cost;
            return (
              <button
                key={u.kind}
                onClick={() => {
                  if (engine.buyUpgrade(u.kind)) {
                    setFlash(u.kind);
                    window.setTimeout(() => setFlash((f) => (f === u.kind ? null : f)), 450);
                  }
                }}
                disabled={!affordable}
                className={`w-[74px] rounded-lg border px-1.5 py-1.5 text-center transition ${
                  flash === u.kind
                    ? "scale-105 border-cyan-300 bg-cyan-400/30"
                    : affordable
                      ? "border-cyan-400/50 bg-card/80"
                      : "border-border/50 bg-card/50 opacity-55"
                }`}
              >
                <div className="text-[10px] font-black uppercase tracking-wider text-foreground">{u.label}</div>
                <div className="mt-1 flex justify-center gap-0.5">
                  {Array.from({ length: C.upgrades.maxLevel }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 w-3.5 rounded-full ${i < level ? "bg-cyan-300" : "bg-muted-foreground/30"}`}
                    />
                  ))}
                </div>
                <div className="mt-1 text-[9px] uppercase tracking-widest text-muted-foreground">
                  {maxed ? "MAX" : `${C.upgrades.cost} ESS`}
                </div>
              </button>
            );
          })}
        </div>
      )}


      {/* Announcement / countdown */}
      {hud?.phase === "COUNTDOWN" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="absolute size-72 animate-[ping_1s_ease-out_infinite] rounded-full border border-primary/25" />
          <span
            key={Math.ceil(hud.countdown)}
            className="animate-scale-in text-8xl font-black tracking-tighter text-primary drop-shadow-[0_0_40px_var(--color-primary)]"
          >
            {Math.ceil(hud.countdown) || "GO"}
          </span>
        </div>
      )}
      {hud?.announcement && hud.phase !== "COUNTDOWN" && (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 text-center">
          <span
            key={hud.announcement}
            className="animate-scale-in inline-block border-y border-primary/40 px-6 py-2 text-3xl font-black uppercase tracking-[0.3em] text-primary drop-shadow-[0_0_28px_var(--color-primary)]"
          >
            {hud.announcement}
          </span>
        </div>
      )}


      {/* Bottom controls */}
      <div className="absolute inset-x-0 bottom-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {isPortrait ? (
          <div className="flex items-end justify-between gap-3">
            <Joystick
              onChange={(v) => {
                input.setMove(v);
                input.setAim(v);
              }}
            />
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
                  onCast={cast}
                />
              </div>
              <div className="flex flex-col items-center gap-3">
                <AbilityButton
                  label="Q"
                  ability="q"
                  cooldown={p?.cooldowns.q ?? 0}
                  maxCooldown={C.abilities.q.cooldown}
                  onCast={cast}
                />
                <AbilityButton
                  label="ATK"
                  ability="basic"
                  big
                  cooldown={p?.cooldowns.basic ?? 0}
                  maxCooldown={C.vanguard.attackCooldown}
                  onCast={cast}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-end justify-between">
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
        )}
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
  return (
    <span className="animate-pulse rounded-full border border-accent/70 bg-accent/25 px-2.5 py-1 text-accent shadow-[0_0_18px_color-mix(in_oklab,var(--color-accent)_55%,transparent)]">
      {children}
    </span>
  );
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
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  const glow = tone === "primary" ? "var(--color-primary)" : "var(--color-destructive)";
  return (
    <div className="min-w-0 flex-1">
      <div
        className={`flex text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground ${reverse ? "justify-end" : ""}`}
      >
        <span className="truncate">{label} · {value}</span>
      </div>
      <div
        className={`mt-1 h-3 w-full overflow-hidden rounded-full border border-border/50 bg-background/70 shadow-[inset_0_1px_3px_rgba(0,0,0,0.7)] ${
          reverse ? "flex justify-end" : ""
        }`}
      >
        <div
          className={`h-full ${tone === "primary" ? "bg-primary" : "bg-destructive"} transition-[width] duration-150`}
          style={{
            width: `${pct}%`,
            boxShadow: `0 0 14px color-mix(in oklab, ${glow} 65%, transparent)`,
          }}
        />
      </div>
    </div>
  );
}

