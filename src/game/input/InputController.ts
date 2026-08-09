import type { AbilityKey, InputCommand } from "../core/types";
import { norm, type Vec } from "../core/math";

/**
 * Shared input abstraction: mobile joystick/buttons and desktop WASD+mouse both
 * write into this controller, and the engine only ever reads InputCommand.
 */
export class InputController {
  private moveVec: Vec = { x: 0, y: 0 };
  private aimVec: Vec = { x: 0, y: -1 };
  private queued: AbilityKey | null = null;
  private keys = new Set<string>();

  setMove(v: Vec) {
    this.moveVec = v;
  }
  setAim(v: Vec) {
    const n = norm(v);
    if (n.x || n.y) this.aimVec = n;
  }
  queue(key: AbilityKey) {
    this.queued = key;
  }
  get aim() {
    return this.aimVec;
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
    const cmd: InputCommand = { move, aim: this.aimVec, cast: this.queued };
    this.queued = null;
    return cmd;
  }
}
