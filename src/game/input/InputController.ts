import type { AbilityKey, InputCommand } from "../core/types";
import { norm, type Vec } from "../core/math";

/**
 * Shared input abstraction: mobile joystick/buttons and desktop WASD+mouse both
 * write into this controller, and the engine only ever reads InputCommand.
 */
export class InputController {
  private moveVec: Vec = { x: 0, y: 0 };
  /** current explicit look aim (from mouse or joystick while active). null = none (use lastLook) */
  private lookVec: Vec | null = { x: 0, y: -1 };
  /** last non-zero look direction to preserve aim after joystick release */
  private lastLookVec: Vec = { x: 0, y: -1 };
  private abilityAim: Vec | null = null;
  private queued: AbilityKey | null = null;
  /** when true, continuously queue basic attack while there's an aim present */
  private autoFire = false;
  private keys = new Set<string>();

  setMove(v: Vec) {
    this.moveVec = v;
  }
  /** Set the current look aim. Pass null to indicate "no active look source" (keep last look). */
  setLook(v: Vec | null) {
    if (v === null) {
      this.lookVec = null;
      return;
    }
    const n = norm(v);
    if (n.x || n.y) {
      this.lookVec = n;
      this.lastLookVec = n;
    }
  }
  /** Directly set the last-look vector (useful on joystick release) */
  setLastLook(v: Vec) {
    const n = norm(v);
    if (n.x || n.y) this.lastLookVec = n;
  }
  /** Aim coming from ability-button drag; used for casting but should not change facing */
  setAbilityAim(v: Vec | null) {
    this.abilityAim = v ? norm(v) : null;
  }
  setAutoFire(active: boolean) {
    this.autoFire = active;
  }
  queue(key: AbilityKey) {
    this.queued = key;
  }

  keyDown(code: string) {
    this.keys.add(code);
    const map: Record<string, AbilityKey> = { KeyQ: "q", KeyW2: "w", KeyE: "e", KeyR: "r", Space: "basic" };
    if (code === "KeyQ") this.queue("q");
    if (code === "ShiftLeft" || code === "KeyF") this.queue("w");
    if (code === "KeyE") this.queue("e");
    if (code === "KeyR") this.queue("r");
    if (code === "Space") this.queue("basic");
    void map;
  }
  keyUp(code: string) {
    this.keys.delete(code);
  }

  private keyboardMove(): Vec {
    let x = 0;
    let y = 0;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) x -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) x += 1;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) y -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) y += 1;
    return { x, y };
  }

  consume(): InputCommand {
    const kb = this.keyboardMove();
    const move = kb.x || kb.y ? norm(kb) : this.moveVec;
    const look = this.lookVec ?? this.lastLookVec;
    const castAim = this.abilityAim ?? null;

    // auto-fire: if enabled and we have an aim vector, queue basic attack
    const aimForFire = castAim ?? look;
    if (this.queued == null && this.autoFire && (aimForFire.x || aimForFire.y)) {
      this.queued = "basic";
    }

    const cmd: InputCommand = { move, aim: look, castAim, cast: this.queued };
    this.queued = null;
    return cmd;
  }
}
