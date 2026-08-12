import { useEffect, useMemo, useRef, useState } from "react";
import { GameEngine } from "@/game/combat/GameEngine";
import { render } from "@/game/rendering/renderer";
import { InputController } from "@/game/input/InputController";
import { GAME_CONFIG } from "@/game/config/gameConfig";
import { clamp } from "@/game/core/math";
import type { AbilityKey, CampStatus, Snapshot, UpgradeKind } from "@/game/core/types";
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
      x: clamp(
        playerPos.x,
        Math.min(halfW, C.arena.width / 2),
        Math.max(C.arena.width - halfW, C.arena.width / 2),
      ),
      y: clamp(
        playerPos.y,
        Math.min(halfH, C.arena.height / 2),
        Math.max(C.arena.height - halfH, C.arena.height / 2),
      ),
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
  const [isPortrait, setIsPortrait] = useState(() =>
    typeof window !== "undefined" ? window.innerHeight >= window.innerWidth : false,
  );
  const finished = useRef(false);
  const flashTimer = useRef(0);
  // kept in a ref so a parent re-render never tears down the game loop and its listeners
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

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
        onFinishRef.current({
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
    const preventMenu = (e: Event) => e.preventDefault();
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    canvas.addEventListener("mousemove", mm);
    canvas.addEventListener("mousedown", md);
    canvas.addEventListener("contextmenu", preventMenu);
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
      canvas.removeEventListener("contextmenu", preventMenu);
      document.removeEventListener("touchmove", preventScroll);
      window.clearTimeout(flashTimer.current);
    };
  }, [engine, input]);

  const cast = (a: AbilityKey) => input.queue(a);
  const aimStart = (a: AbilityKey) => {
    engine.aimPreview = { active: true, ability: a };
  };
  const aimEnd = () => {
    engine.aimPreview = { active: false, ability: null };
  };
  const buy = (kind: UpgradeKind) => {
    if (!engine.buyUpgrade(kind)) return;
    // refresh straight away: the throttled HUD tick would show stale pips/essence
    setHud({ ...engine.snapshot() });
    setFlash(kind);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash((f) => (f === kind ? null : f)), 450);
  };

  const p = hud?.player;
  const ultReady = p ? p.ultCharge / C.abilities.r.chargeMax : 0;

  return (
    <div className="relative h-[100dvh] w-full touch-none overflow-hidden overscroll-none bg-background">
      <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" />

      {/* Top HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="absolute left-3 top-3 rounded-full border border-border/60 bg-card/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground shadow-sm">
          <span className="mr-2">FPS</span>
          <span className="font-mono text-sm font-bold text-foreground">{fpsDisplay}</span>
        </div>
        <div className="flex items-center gap-3">
          <Bar
            label="YOU"
            ratio={p ? p.hp / p.maxHp : 1}
            value={p ? Math.ceil(p.hp) : 0}
            tone="primary"
          />
          <div className="shrink-0 text-center">
            <div className="font-mono text-lg font-bold text-foreground">
              {hud ? fmt(hud.timeLeft) : "--:--"}
            </div>
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
          {C.features.essenceUpgrades && (
            <span className="rounded bg-cyan-400/15 px-2 py-1 font-bold text-cyan-300">
              ESSENCE {hud?.essence ?? 0}
            </span>
          )}
          {p && p.ultActiveFor > 0 && <Chip>OVERDRIVE</Chip>}
        </div>
        {hud && (
          <div className="mt-2 flex items-center justify-center gap-2">
            {hud.camps.map((c, i) => (
              <CampChip key={c.id} camp={c} label={i === 0 ? "CAMP W" : "CAMP E"} />
            ))}
          </div>
        )}
        {hud && (
          <div className="mt-2 text-center">
            <span
              className={`rounded px-2 py-1 text-[11px] font-bold uppercase tracking-wider ${
                hud.inCombat ? "bg-amber-400/20 text-amber-200" : "bg-card/70 text-muted-foreground"
              }`}
            >
              {nextStep(hud)}
            </span>
          </div>
        )}
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
                onClick={() => buy(u.kind)}
                disabled={!affordable}
                className={`w-[74px] rounded-lg border px-1.5 py-1.5 text-center transition ${
                  flash === u.kind
                    ? "scale-105 border-cyan-300 bg-cyan-400/30"
                    : affordable
                      ? "border-cyan-400/50 bg-card/80"
                      : "border-border/50 bg-card/50 opacity-55"
                }`}
              >
                <div className="text-[10px] font-black uppercase tracking-wider text-foreground">
                  {u.label}
                </div>
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
  return <span className="rounded bg-primary/15 px-2 py-1 text-primary">{children}</span>;
}

/** The single most useful thing the player can do right now. */
function nextStep(hud: Snapshot): string {
  if (hud.phase === "COUNTDOWN") return "GET READY";
  if (hud.phase === "SUDDEN_DEATH") return "STAY IN THE SAFE ZONE";
  const canUpgrade =
    C.features.essenceUpgrades &&
    hud.essence >= C.upgrades.cost &&
    UPGRADES.some((u) => hud.upgrades[u.kind] < C.upgrades.maxLevel);
  if (canUpgrade) return "UPGRADE READY";
  if (hud.inCombat) return "FIGHTING";
  if (hud.core.active) return "CONTEST THE CORE";
  if (hud.camps.some((c) => c.mobsAlive > 0 || c.phase === "PENDING"))
    return "FARM A CAMP FOR ESSENCE";
  return "HUNT THE ENEMY";
}

function CampChip({ camp, label }: { camp: CampStatus; label: string }) {
  const respawning = camp.phase === "CLEARED" || camp.phase === "RESPAWNING";
  const tone =
    camp.phase === "COMBAT"
      ? "bg-amber-400/20 text-amber-200"
      : camp.phase === "AVAILABLE"
        ? "bg-lime-400/15 text-lime-300"
        : "bg-card/70 text-muted-foreground";
  const detail = respawning
    ? `RESPAWN ${Math.ceil(camp.respawnIn)}s`
    : camp.phase === "PENDING"
      ? "DORMANT"
      : `${camp.mobsAlive}/${camp.mobsTotal}`;
  return (
    <span className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${tone}`}>
      {label} · {detail}
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
  const ghost = useDamageGhost(pct);
  return (
    <div className="min-w-0 flex-1">
      <div
        className={`flex text-[10px] uppercase tracking-widest text-muted-foreground ${reverse ? "justify-end" : ""}`}
      >
        <span className="truncate">
          {label} · {value}
        </span>
      </div>
      <div className="relative mt-1 h-2.5 w-full overflow-hidden rounded-full bg-card/80">
        {/* recently lost health, so a hit reads even between HUD ticks */}
        <div
          className={`absolute inset-y-0 bg-foreground/45 transition-[width] duration-300 ${reverse ? "right-0" : "left-0"}`}
          style={{ width: `${ghost}%` }}
        />
        <div
          className={`absolute inset-y-0 ${reverse ? "right-0" : "left-0"} ${
            tone === "primary" ? "bg-primary" : "bg-destructive"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Holds the previous health percentage briefly so damage is visible as a trailing bar. */
function useDamageGhost(pct: number) {
  const [ghost, setGhost] = useState(pct);
  useEffect(() => {
    if (pct >= ghost) {
      setGhost(pct);
      return;
    }
    const t = window.setTimeout(() => setGhost(pct), 260);
    return () => window.clearTimeout(t);
  }, [pct, ghost]);
  return ghost;
}
