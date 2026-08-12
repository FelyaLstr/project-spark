import { GAME_CONFIG } from "../config/gameConfig";
import { add, clamp, dist, norm, resolveCircleRect, scale, sub, type Vec } from "../core/math";
import type {
  AbilityKey,
  AimPreview,
  Camp,
  CampStatus,
  CoreState,
  Effect,
  Fighter,
  InputCommand,
  MatchPhase,
  Mob,
  Projectile,
  ProjectileKind,
  Snapshot,
  Team,
  UpgradeKind,
} from "../core/types";
import { emptyCommand } from "../core/types";
import { makeCamps, resetMobIds, spawnGuardian } from "../mobs/mobs";
import { updateMobs } from "../mobs/MobController";
import { createAIController, type AIController } from "../ai/AIController";

const C = GAME_CONFIG;
let idc = 0;
const nid = (p: string) => `${p}_${++idc}`;

function makeFighter(team: Team, pos: Vec): Fighter {
  const v = C.vanguard;
  return {
    id: `fighter_${team}`,
    team,
    pos: { ...pos },
    vel: { x: 0, y: 0 },
    facing: team === "A" ? -Math.PI / 2 : Math.PI / 2,
    radius: v.radius,
    hp: v.maxHealth,
    maxHp: v.maxHealth,
    alive: true,
    cooldowns: { basic: 0, q: 0, w: 0, e: 0, r: 0 },
    ultCharge: 0,
    ultActiveFor: 0,
    dashFor: 0,
    invulnFor: 0,
    hitFlash: 0,
    knockback: { x: 0, y: 0 },
    essence: 0,
    upgrades: { power: 0, vitality: 0, haste: 0 },
    buffs: { overchargeFor: 0, guardianPower: 0 },
    stats: {
      damageDealt: 0,
      damageTaken: 0,
      mobsKilled: 0,
      essenceEarned: 0,
      coreCaptures: 0,
      abilitiesHit: 0,
      abilitiesMissed: 0,
    },
  };
}

export type MatchStats = Fighter["stats"];

type Timer = { left: number; fn: () => void };

export class GameEngine {
  phase: MatchPhase = "COUNTDOWN";
  time = 0;
  countdown = C.match.countdownSeconds;
  player = makeFighter("A", C.arena.spawnA);
  enemy = makeFighter("B", C.arena.spawnB);
  mobs: Mob[] = [];
  camps: Camp[] = makeCamps();

  projectiles: Projectile[] = [];
  effects: Effect[] = [];
  core: CoreState = { active: false, progressA: 0, progressB: 0, ownedBy: null };
  safeRadius: number | null = null;
  winner: Team | null = null;
  announcement: string | null = null;
  /** UI-driven aiming preview (drag on an ability button) */
  aimPreview: AimPreview = { active: false, ability: null };
  aimDir: Vec = { x: 0, y: -1 };

  private announceTimer = 0;
  private ai: AIController = createAIController(C.ai.difficulty);
  private timers: Timer[] = [];
  private guardianSpawned = false;
  private coreWave = 0;
  private freeze = 0;
  /** real-time remaining of the current hit pause */
  hitStop = 0;
  private dodgeTextCd: Record<string, number> = {};
  /** last frame's collision state, for the debug overlay */
  debugInfo = { playerBlocked: false, enemyBlocked: false, fighterContact: false };

  readonly corePos: Vec = { x: C.arena.width / 2, y: C.arena.height / 2 };

  reset() {
    idc = 0;
    this.phase = "COUNTDOWN";
    this.time = 0;
    this.countdown = C.match.countdownSeconds;
    this.player = makeFighter("A", C.arena.spawnA);
    this.enemy = makeFighter("B", C.arena.spawnB);
    resetMobIds();
    this.mobs = [];
    this.camps = makeCamps();

    this.projectiles = [];
    this.effects = [];
    this.timers = [];
    this.core = { active: false, progressA: 0, progressB: 0, ownedBy: null };
    this.safeRadius = null;
    this.winner = null;
    this.announcement = null;
    this.aimPreview = { active: false, ability: null };
    this.guardianSpawned = false;
    this.coreWave = 0;
    this.freeze = 0;
    this.hitStop = 0;
    this.dodgeTextCd = {};
    this.ai = createAIController(C.ai.difficulty);
  }

  announce(text: string) {
    this.announcement = text;
    this.announceTimer = 2.2;
  }

  private later(seconds: number, fn: () => void) {
    if (seconds <= 0) fn();
    else this.timers.push({ left: seconds, fn });
  }

  private updateTimers(dt: number) {
    if (!this.timers.length) return;
    const keep: Timer[] = [];
    for (const t of this.timers) {
      t.left -= dt;
      if (t.left <= 0) t.fn();
      else keep.push(t);
    }
    this.timers = keep;
  }

  /** Cost of the NEXT level of an upgrade (flat for now, but centralized). */
  upgradeCost(_kind: UpgradeKind) {
    return C.upgrades.cost;
  }

  canBuyUpgrade(f: Fighter, kind: UpgradeKind) {
    return (
      C.features.essenceUpgrades &&
      f.alive &&
      f.upgrades[kind] < C.upgrades.maxLevel &&
      f.essence >= this.upgradeCost(kind)
    );
  }

  /** Buys one level. Same entry point for the human HUD and the AI. */
  buyUpgrade(kind: UpgradeKind, who: Fighter = this.player) {
    if (!this.canBuyUpgrade(who, kind)) return false;
    who.essence -= this.upgradeCost(kind);
    who.upgrades[kind] += 1;
    if (kind === "vitality") {
      const newMax = C.vanguard.maxHealth * (1 + who.upgrades.vitality * C.upgrades.vitality);
      who.hp = Math.min(newMax, who.hp + (newMax - who.maxHp));
      who.maxHp = newMax;
    }
    this.pushEffect({
      kind: "text",
      pos: { ...who.pos },
      text: `${kind.toUpperCase()} ${who.upgrades[kind]}`,
      life: 1.1,
      color: "#7dd3fc",
    });
    this.pushEffect({
      kind: "impact-ring",
      pos: { ...who.pos },
      radius: who.radius + 30,
      life: 0.45,
      color: "#38bdf8",
    });
    return true;
  }

  /** Essence is only ever granted here so the popup and stats stay in sync. */
  private grantEssence(f: Fighter, amount: number, at: Vec) {
    if (amount <= 0) return;
    f.essence += amount;
    f.stats.essenceEarned += amount;
    this.pushEffect({
      kind: "text",
      pos: { x: at.x, y: at.y - 12 },
      text: `+${amount} ESSENCE`,
      life: 1,
      color: "#67e8f9",
    });
  }

  // ---------- main loop ----------
  update(rawDt: number, playerCmd: InputCommand) {
    let dt = Math.min(rawDt, 0.05);
    if (this.phase === "RESULTS") return;

    // hit stop: scale simulation time for a few tens of milliseconds
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - dt);
      dt *= C.feedback.hitStopScale;
    }

    if (playerCmd.aim.x || playerCmd.aim.y) this.aimDir = norm(playerCmd.aim);

    if (this.phase === "COUNTDOWN") {
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.phase = "PLAYING";
        this.announce("FIGHT");
      }
      // face the aim direction while waiting, but no casting/moving
      this.player.facing = Math.atan2(this.aimDir.y, this.aimDir.x);
      this.updateEffects(dt);
      return;
    }

    if (this.phase === "PLAYER_DEAD") {
      this.freeze -= dt;
      const reacting = this.freeze > C.match.freezeOnDeath - C.feedback.deathReactionSeconds;
      if (reacting) {
        // short slow-motion death reaction: projectiles keep flying, nobody acts
        const slow = dt * 0.35;
        this.updateProjectiles(slow);
        this.updateTimers(slow);
      }
      this.updateEffects(dt);
      if (this.freeze <= 0) this.phase = "RESULTS";
      return;
    }

    this.time += dt;
    for (const k of Object.keys(this.dodgeTextCd)) {
      this.dodgeTextCd[k] = Math.max(0, (this.dodgeTextCd[k] ?? 0) - dt);
    }

    if (this.announceTimer > 0) {
      this.announceTimer -= dt;
      if (this.announceTimer <= 0) this.announcement = null;
    }

    this.runTimeline();

    const aiCmd = this.enemy.alive
      ? this.ai.think(
          {
            self: this.enemy,
            foe: this.player,
            mobs: this.mobs,
            camps: this.camps,
            projectiles: this.projectiles,
            walls: C.arena.walls,
            coreActive: this.core.active,
            corePos: this.corePos,
            buy: (kind) => this.buyUpgrade(kind, this.enemy),
          },
          dt,
        )
      : emptyCommand();

    this.updateFighter(this.player, playerCmd, dt);
    this.updateFighter(this.enemy, aiCmd, dt);
    this.separateFighters();
    this.updateMobs(dt);
    this.updateProjectiles(dt);
    this.updateCore(dt);
    this.updateSuddenDeath(dt);
    this.updateTimers(dt);
    this.updateEffects(dt);
    this.checkTimeUp();
  }

  private checkTimeUp() {
    if (this.phase === "PLAYER_DEAD" || this.phase === "RESULTS") return;
    if (this.time < C.match.durationSeconds) return;
    if (C.features.suddenDeath) return;
    const a = this.player.hp / this.player.maxHp;
    const b = this.enemy.hp / this.enemy.maxHp;
    this.winner = a >= b ? "A" : "B";
    this.phase = "PLAYER_DEAD";
    this.freeze = C.match.freezeOnDeath;
    this.announce("TIME UP");
  }

  private runTimeline() {
    if (!C.features.neutralMobs && !C.features.coreObjective) return;
    const t = this.time;
    const T = C.timeline;
    if (C.features.neutralMobs) {
      if (C.features.guardian && !this.guardianSpawned && t >= T.guardianAt) {
        this.guardianSpawned = true;
        this.mobs.push(spawnGuardian());
        this.announce("GUARDIAN AWAKENS");
      }
    }

    if (C.features.coreObjective) {
      if (this.coreWave === 0 && t >= T.coreActivateAt) {
        this.coreWave = 1;
        this.activateCore();
      }
      if (this.coreWave === 1 && t >= T.coreReactivateAt) {
        this.coreWave = 2;
        this.activateCore();
      }
    }
  }

  private activateCore() {
    this.core = { active: true, progressA: 0, progressB: 0, ownedBy: null };
    if (this.phase === "PLAYING") this.phase = "CORE_EVENT";
    this.announce("THE CORE IS ACTIVE");
  }

  // ---------- fighters ----------
  private speedOf(f: Fighter) {
    let s = C.vanguard.movementSpeed;
    if (f.ultActiveFor > 0) s *= C.abilities.r.speedMult;
    if (f.buffs.overchargeFor > 0) s *= 1 + C.core.speedBonus;
    return s;
  }

  private damageMult(f: Fighter) {
    let m = 1 + f.upgrades.power * C.upgrades.power + f.buffs.guardianPower;
    if (f.ultActiveFor > 0) m *= C.abilities.r.damageMult;
    if (f.buffs.overchargeFor > 0) m *= 1 + C.core.damageBonus;
    return m;
  }

  private cdMult(f: Fighter) {
    let m = 1 / (1 + f.upgrades.haste * C.upgrades.haste);
    if (f.ultActiveFor > 0) m *= 1 / C.abilities.r.attackSpeedMult;
    return m;
  }

  private updateFighter(f: Fighter, cmd: InputCommand, dt: number) {
    if (!f.alive) return;
    for (const k of Object.keys(f.cooldowns) as AbilityKey[]) {
      f.cooldowns[k] = Math.max(0, f.cooldowns[k] - dt);
    }
    f.ultActiveFor = Math.max(0, f.ultActiveFor - dt);
    f.dashFor = Math.max(0, f.dashFor - dt);
    f.invulnFor = Math.max(0, f.invulnFor - dt);
    f.hitFlash = Math.max(0, f.hitFlash - dt);
    f.buffs.overchargeFor = Math.max(0, f.buffs.overchargeFor - dt);

    const aim = norm(cmd.aim);
    if (aim.x || aim.y) f.facing = Math.atan2(aim.y, aim.x);

    // --- movement with acceleration / deceleration ---
    let move = cmd.move;
    const ml = Math.hypot(move.x, move.y);
    if (ml > 1) move = { x: move.x / ml, y: move.y / ml };

    if (f.dashFor > 0) {
      // dash keeps its own velocity, leaves a dense readable trail
      this.pushEffect({
        kind: "dash-trail",
        pos: { ...f.pos },
        radius: f.radius,
        life: 0.26,
        color: f.team === "A" ? "#38bdf8" : "#fb7185",
      });
    } else {
      const maxSpeed = this.speedOf(f);
      const target = scale(move, maxSpeed * Math.min(1, ml || 0));
      let rate: number = ml > 0.02 ? C.vanguard.acceleration : C.vanguard.deceleration;
      // bleed off dash overspeed over the recovery window instead of snapping
      const speed = Math.hypot(f.vel.x, f.vel.y);
      if (speed > maxSpeed * 1.05)
        rate = Math.max(rate, (speed - maxSpeed) / Math.max(0.01, C.abilities.w.recovery));

      const diff = sub(target, f.vel);
      const dl = Math.hypot(diff.x, diff.y);
      const maxStep = rate * dt;
      f.vel =
        dl <= maxStep ? target : add(f.vel, scale({ x: diff.x / dl, y: diff.y / dl }, maxStep));
    }

    let step = scale(f.vel, dt);
    step = add(step, scale(f.knockback, dt));
    f.knockback = scale(f.knockback, Math.max(0, 1 - dt * 6));

    const wanted = add(f.pos, step);
    const resolved = this.collide(wanted, f.radius);
    const blocked =
      Math.abs(resolved.x - wanted.x) > 0.01 || Math.abs(resolved.y - wanted.y) > 0.01;
    if (f.team === "A") this.debugInfo.playerBlocked = blocked;
    else this.debugInfo.enemyBlocked = blocked;
    // if a wall stopped us, kill the velocity component into it
    if (f.dashFor <= 0 && blocked) {
      if (Math.abs(resolved.x - wanted.x) > 0.01) f.vel.x = 0;
      if (Math.abs(resolved.y - wanted.y) > 0.01) f.vel.y = 0;
    }
    f.pos = resolved;

    if (cmd.cast) this.tryCast(f, cmd.cast, aim);
  }

  /** Player vs player collision — simple circle separation. */
  private separateFighters() {
    const a = this.player;
    const b = this.enemy;
    if (!a.alive || !b.alive) return;
    const d = dist(a.pos, b.pos);
    const min = a.radius + b.radius;
    if (d >= min || d < 1e-4) return;
    const push = scale(norm(sub(b.pos, a.pos)), (min - d) / 2);
    a.pos = this.collide(sub(a.pos, push), a.radius);
    b.pos = this.collide(add(b.pos, push), b.radius);
  }

  private collide(p: Vec, r: number): Vec {
    let out = { ...p };
    for (const wall of C.arena.walls) out = resolveCircleRect(out, r, wall);
    out.x = clamp(out.x, r, C.arena.width - r);
    out.y = clamp(out.y, r, C.arena.height - r);
    return out;
  }

  private spawnProjectile(
    f: Fighter,
    kind: ProjectileKind,
    dir: Vec,
    opts: { speed: number; radius: number; damage: number; range: number; trailMax: number },
  ) {
    const origin = add(f.pos, scale(dir, f.radius + 6));
    this.projectiles.push({
      id: nid("p"),
      owner: f.id,
      team: f.team,
      kind,
      pos: origin,
      dir,
      speed: opts.speed,
      radius: opts.radius,
      damage: opts.damage,
      traveled: 0,
      range: opts.range,
      trail: [],
      trailMax: opts.trailMax,
      tracked: true,
      resolved: false,
    });
    this.pushEffect({
      kind: "muzzle",
      pos: origin,
      dir,
      radius: kind === "q" ? 30 : 15,
      life: kind === "q" ? 0.2 : 0.12,
      color:
        f.team === "A"
          ? kind === "q"
            ? "#c4b5fd"
            : "#67e8f9"
          : kind === "q"
            ? "#fdba74"
            : "#fda4af",
    });
  }

  private tryCast(f: Fighter, key: AbilityKey, aim: Vec) {
    if (key === "e" && !C.features.shockwaveAbility) return;
    if (f.cooldowns[key] > 0) return;
    const dir = aim.x || aim.y ? aim : { x: Math.cos(f.facing), y: Math.sin(f.facing) };
    const cdm = this.cdMult(f);
    const v = C.vanguard;

    if (key === "basic") {
      f.cooldowns.basic = v.attackCooldown * cdm;
      this.spawnProjectile(f, "basic", dir, {
        speed: v.attackProjectileSpeed,
        radius: v.attackProjectileRadius,
        damage: v.attackDamage * this.damageMult(f),
        range: v.attackRange,
        trailMax: v.attackTrailLength,
      });
      return;
    }

    if (key === "q") {
      const q = C.abilities.q;
      f.cooldowns.q = q.cooldown * cdm;
      this.pushEffect({
        kind: "telegraph-line",
        pos: { ...f.pos },
        dir,
        radius: q.range,
        life: q.qTelegraphDuration,
        color: f.team === "A" ? "#a78bfa" : "#fb923c",
      });
      const damage = q.damage * this.damageMult(f);
      this.later(q.qTelegraphDuration, () => {
        if (!f.alive) return;
        this.spawnProjectile(f, "q", dir, {
          speed: q.speed,
          radius: q.radius,
          damage,
          range: q.range,
          trailMax: q.trailLength,
        });
      });
      return;
    }

    if (key === "w") {
      const w = C.abilities.w;
      f.cooldowns.w = w.cooldown * cdm;
      f.dashFor = w.duration;
      f.invulnFor = w.invulnerable;
      // instant, fully predictable dash vector (no acceleration ramp)
      f.vel = scale(dir, w.distance / w.duration);
      f.knockback = { x: 0, y: 0 };
      this.pushEffect({
        kind: "dodge-ring",
        pos: { ...f.pos },
        radius: 44,
        life: 0.28,
        color: "#a5f3fc",
      });
      return;
    }

    if (key === "e") {
      const e = C.abilities.e;
      f.cooldowns.e = e.cooldown * cdm;
      this.pushEffect({
        kind: "shockwave",
        pos: { ...f.pos },
        radius: e.radius,
        life: e.telegraph + 0.2,
        color: f.team === "A" ? "#60a5fa" : "#fb7185",
      });
      const mult = this.damageMult(f);
      const origin = { ...f.pos };
      this.later(e.telegraph, () => {
        for (const t of this.hittableTargets(f)) {
          if (dist(origin, t.pos) > e.radius + t.radius) continue;
          this.applyDamage(f, t, e.damage * mult);
          const push = scale(norm(sub(t.pos, origin)), e.knockback);
          if ("knockback" in t) (t as Fighter).knockback = push;
          else t.pos = add(t.pos, scale(push, 0.12));
        }
      });
      return;
    }

    if (key === "r") {
      if (f.ultCharge < C.abilities.r.chargeMax) return;
      f.ultCharge = 0;
      f.ultActiveFor = C.abilities.r.duration;
      this.pushEffect({ kind: "hit", pos: { ...f.pos }, radius: 130, life: 0.7, color: "#fbbf24" });
      this.pushEffect({
        kind: "shockwave",
        pos: { ...f.pos },
        radius: 110,
        life: 0.5,
        color: "#fbbf24",
      });
      this.pushEffect({
        kind: "text",
        pos: { ...f.pos },
        text: "OVERDRIVE",
        life: 1.4,
        color: "#fbbf24",
      });
      this.announce(f.team === "A" ? "OVERDRIVE" : "ENEMY OVERDRIVE");
    }
  }

  private foeOf(f: Fighter) {
    return f.team === "A" ? this.enemy : this.player;
  }

  private hittableTargets(f: Fighter): (Fighter | Mob)[] {
    const out: (Fighter | Mob)[] = [];
    const foe = this.foeOf(f);
    if (foe.alive) out.push(foe);
    for (const m of this.mobs) if (m.alive) out.push(m);
    return out;
  }

  private isFighter(t: Fighter | Mob): t is Fighter {
    return (t as Fighter).team !== undefined;
  }

  /** Central damage entry point — nothing else should touch hp. Same path for player and AI. */
  applyDamage(source: Fighter | Mob | null, target: Fighter | Mob, amount: number) {
    if (!target.alive) return;
    // a dead attacker deals nothing: in-flight projectiles and queued telegraphs
    // must not resolve after their owner died
    if (source && !source.alive) return;
    const R = C.abilities.r;
    const F = C.feedback;
    if (this.isFighter(target) && (target.invulnFor > 0 || target.dashFor > 0)) {
      // i-frame dodge: one popup per window, plus a soft ring pulse
      if ((this.dodgeTextCd[target.id] ?? 0) <= 0) {
        this.dodgeTextCd[target.id] = F.dodgeTextCooldown;
        this.pushEffect({
          kind: "text",
          pos: { ...target.pos },
          text: "DODGE",
          life: 0.6,
          color: "#a3e635",
        });
      }
      this.pushEffect({
        kind: "dodge-ring",
        pos: { ...target.pos },
        radius: target.radius + 16,
        life: 0.3,
        color: "#a3e635",
      });
      target.ultCharge = Math.min(R.chargeMax, target.ultCharge + R.chargePerDodge);
      return;
    }
    const dmg = Math.max(0, amount);
    const vsMob = !this.isFighter(target);
    // mob hits use the same feedback systems, just dialled down
    const fs = vsMob ? C.mobs.feedbackScale : 1;
    target.hp -= dmg;
    target.hitFlash = F.hitFlashDuration;
    const heavy = !vsMob && dmg >= C.abilities.q.damage * 0.8;
    this.hitStop = Math.max(this.hitStop, (heavy ? F.hitStopSecondsHeavy : F.hitStopSeconds) * fs);
    this.pushEffect({
      kind: "hit",
      pos: { ...target.pos },
      radius: 18 * fs,
      life: 0.18 * fs,
      color: vsMob ? "#d9f99d" : "#fff7c2",
    });
    this.pushEffect({
      kind: "impact-ring",
      pos: { ...target.pos },
      radius: target.radius + (heavy ? 26 : 14) * fs,
      life: (heavy ? 0.32 : 0.22) * fs,
      color: vsMob ? "#bef264" : heavy ? "#fbbf24" : "#fde68a",
    });
    this.pushEffect({
      kind: "text",
      pos: { x: target.pos.x + (Math.random() - 0.5) * 16, y: target.pos.y },
      text: `${Math.round(dmg)}`,
      life: C.feedback.damageTextLife * (vsMob ? 0.75 : 1),
      color: vsMob
        ? "#d9f99d"
        : this.isFighter(target) && target.team === "A"
          ? "#fca5a5"
          : "#fde68a",
    });

    if (source && this.isFighter(source)) {
      source.stats.damageDealt += dmg;
      source.ultCharge = Math.min(R.chargeMax, source.ultCharge + dmg * R.chargePerDamageDealt);
    }
    if (this.isFighter(target)) {
      target.stats.damageTaken += dmg;
      target.ultCharge = Math.min(R.chargeMax, target.ultCharge + dmg * R.chargePerDamageTaken);
    }

    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;
      if (this.isFighter(target)) {
        this.onFighterDeath(target);
      } else {
        const mob = target;
        mob.state = "DEAD";
        mob.target = null;
        // essence goes to the final blow only
        if (source && this.isFighter(source)) {
          source.stats.mobsKilled += 1;
          const cfg = mob.kind === "crawler" ? C.mobs.crawler : C.mobs.guardian;
          this.grantEssence(source, cfg.essence, mob.pos);
          if (mob.kind === "guardian") {
            source.buffs.guardianPower += C.mobs.guardian.abilityPowerBonus;
            this.announce(
              source.team === "A" ? "YOU SLEW THE GUARDIAN" : "ENEMY SLEW THE GUARDIAN",
            );
          }
        }
        this.pushEffect({
          kind: "hit",
          pos: { ...mob.pos },
          radius: mob.radius * 2,
          life: 0.4,
          color: "#84cc16",
        });
        this.pushEffect({
          kind: "impact-ring",
          pos: { ...mob.pos },
          radius: mob.radius + 22,
          life: 0.35,
          color: "#a3e635",
        });
      }
    }
  }

  private onFighterDeath(f: Fighter) {
    // the first death decides the match; a later one must not flip the winner or
    // restart the freeze
    if (this.winner) return;
    this.winner = f.team === "A" ? "B" : "A";
    // the loser's bolts stay visible but no longer count toward accuracy
    for (const p of this.projectiles) if (p.owner === f.id) p.tracked = false;
    this.phase = "PLAYER_DEAD";
    this.freeze = C.match.freezeOnDeath;
    this.hitStop = Math.max(this.hitStop, 0.09);
    f.vel = { x: 0, y: 0 };
    this.pushEffect({ kind: "hit", pos: { ...f.pos }, radius: 110, life: 1.2, color: "#ef4444" });
    this.pushEffect({
      kind: "shockwave",
      pos: { ...f.pos },
      radius: 90,
      life: 0.6,
      color: "#ef4444",
    });
    this.pushEffect({
      kind: "impact-ring",
      pos: { ...f.pos },
      radius: 150,
      life: 0.9,
      color: "#f87171",
    });
  }

  // ---------- mobs ----------
  private updateMobs(dt: number) {
    if (!C.features.neutralMobs) return;
    updateMobs(
      {
        mobs: this.mobs,
        camps: this.camps,
        fighters: [this.player, this.enemy],
        applyDamage: (s, t, a) => this.applyDamage(s, t, a),
        collide: (p, r) => this.collide(p, r),
        pushEffect: (e) => this.pushEffect(e),
        later: (s, fn) => this.later(s, fn),
      },
      dt,
    );
  }

  // ---------- projectiles ----------
  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      if (p.resolved) continue;
      const step = scale(p.dir, p.speed * dt);
      p.trail.push({ ...p.pos });
      if (p.trail.length > p.trailMax) p.trail.shift();
      p.pos = add(p.pos, step);
      p.traveled += Math.hypot(step.x, step.y);

      let dead = false;
      let hit = false;

      const owner = p.owner === this.player.id ? this.player : this.enemy;
      for (const t of this.hittableTargets(owner)) {
        if (!t.alive) continue;
        if (dist(p.pos, t.pos) <= p.radius + t.radius) {
          const dodged = this.isFighter(t) && (t.invulnFor > 0 || t.dashFor > 0);
          this.applyDamage(owner, t, p.damage);
          dead = true;
          hit = !dodged;
          break;
        }
      }

      if (!dead) {
        for (const wall of C.arena.walls) {
          if (
            p.pos.x > wall.x - p.radius &&
            p.pos.x < wall.x + wall.w + p.radius &&
            p.pos.y > wall.y - p.radius &&
            p.pos.y < wall.y + wall.h + p.radius
          ) {
            dead = true;
            this.pushEffect({
              kind: "fizzle",
              pos: { ...p.pos },
              radius: p.radius * 2,
              life: 0.22,
              color: "#94a3b8",
            });
            break;
          }
        }
      }
      if (
        !dead &&
        (p.traveled > p.range ||
          p.pos.x < 0 ||
          p.pos.y < 0 ||
          p.pos.x > C.arena.width ||
          p.pos.y > C.arena.height)
      ) {
        dead = true;
        // subtle miss puff — never a damage number
        this.pushEffect({
          kind: "fizzle",
          pos: { ...p.pos },
          radius: p.radius * 1.6,
          life: 0.2,
          color: p.team === "A" ? "#38bdf8" : "#fb7185",
        });
      }

      if (dead) {
        p.resolved = true;

        if (p.tracked) {
          if (hit) owner.stats.abilitiesHit += 1;
          else owner.stats.abilitiesMissed += 1;
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.resolved);
  }

  // ---------- core ----------
  private updateCore(dt: number) {
    if (!C.features.coreObjective) return;
    if (!this.core.active) return;
    const inA = this.player.alive && dist(this.player.pos, this.corePos) < C.arena.coreRadius;
    const inB = this.enemy.alive && dist(this.enemy.pos, this.corePos) < C.arena.coreRadius;
    if (inA && !inB) this.core.progressA += dt;
    else if (inB && !inA) this.core.progressB += dt;
    else if (!inA && !inB) {
      this.core.progressA = Math.max(0, this.core.progressA - dt * 0.5);
      this.core.progressB = Math.max(0, this.core.progressB - dt * 0.5);
    }

    const capture = (f: Fighter) => {
      f.buffs.overchargeFor = C.core.buffDuration;
      f.stats.coreCaptures += 1;
      this.core = { active: false, progressA: 0, progressB: 0, ownedBy: f.team };
      if (this.phase === "CORE_EVENT") this.phase = "PLAYING";
      this.announce(f.team === "A" ? "YOU CAPTURED THE CORE" : "ENEMY CAPTURED THE CORE");
      this.pushEffect({
        kind: "core-ring",
        pos: { ...this.corePos },
        radius: C.arena.coreRadius,
        life: 0.9,
        color: "#38bdf8",
      });
    };
    if (this.core.progressA >= C.core.captureSeconds) capture(this.player);
    else if (this.core.progressB >= C.core.captureSeconds) capture(this.enemy);
  }

  // ---------- sudden death ----------
  private updateSuddenDeath(dt: number) {
    if (!C.features.suddenDeath) return;
    const elapsedLimit = C.match.durationSeconds;
    if (this.time < elapsedLimit) return;
    if (this.phase !== "SUDDEN_DEATH") {
      this.phase = "SUDDEN_DEATH";
      this.safeRadius = Math.min(C.arena.width, C.arena.height) / 2;
      this.announce("CORE OVERLOAD");
    }
    this.safeRadius = Math.max(
      C.match.minSafeRadius,
      (this.safeRadius ?? 600) - C.match.suddenDeathShrinkPerSecond * dt,
    );
    for (const f of [this.player, this.enemy]) {
      if (f.alive && dist(f.pos, this.corePos) > this.safeRadius) {
        this.applyDamage(null, f, C.match.suddenDeathDps * dt);
      }
    }
  }

  // ---------- effects ----------
  pushEffect(e: Omit<Effect, "id" | "maxLife"> & { life: number }) {
    this.effects.push({ id: nid("fx"), maxLife: e.life, ...e });
    if (this.effects.length > 220) this.effects.splice(0, this.effects.length - 220);
  }

  private updateEffects(dt: number) {
    for (const e of this.effects) e.life -= dt;
    this.effects = this.effects.filter((e) => e.life > 0);
  }

  /** True while a mob is on the player, or the enemy fighter is close enough to trade. */
  private playerInCombat() {
    const p = this.player;
    if (!p.alive) return false;
    for (const m of this.mobs) {
      if (
        m.alive &&
        m.target === p.id &&
        (m.state === "CHASE" || m.state === "ATTACK" || m.state === "AGGRO")
      ) {
        return true;
      }
    }
    return this.enemy.alive && dist(p.pos, this.enemy.pos) < C.vanguard.attackRange;
  }

  private campStatuses(): CampStatus[] {
    return this.camps.map((c) => {
      const mine = this.mobs.filter((m) => m.campId === c.id);
      return {
        id: c.id,
        phase: c.phase,
        respawnIn: c.respawnIn,
        mobsAlive: mine.filter((m) => m.alive).length,
        mobsTotal: C.mobs.crawlersPerCamp,
      };
    });
  }

  snapshot(): Snapshot {
    return {
      phase: this.phase,
      time: this.time,
      countdown: Math.max(0, this.countdown),
      timeLeft: Math.max(0, C.match.durationSeconds - this.time),
      player: this.player,
      enemy: this.enemy,
      essence: Math.floor(this.player.essence),
      upgrades: { ...this.player.upgrades },
      core: this.core,
      camps: this.campStatuses(),
      inCombat: this.playerInCombat(),

      safeRadius: this.safeRadius,
      winner: this.winner,
      announcement: this.announcement,
    };
  }
}
