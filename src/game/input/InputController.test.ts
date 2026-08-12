import { beforeEach, describe, expect, it } from "vitest";
import { InputController } from "./InputController";

describe("InputController", () => {
  let input: InputController;

  beforeEach(() => {
    input = new InputController();
  });

  it("starts neutral, aiming up", () => {
    expect(input.aim).toEqual({ x: 0, y: -1 });
    expect(input.consume()).toEqual({ move: { x: 0, y: 0 }, aim: { x: 0, y: -1 }, cast: null });
  });

  it("passes the analog move vector through unnormalized", () => {
    input.setMove({ x: 0.3, y: -0.4 });
    expect(input.consume().move).toEqual({ x: 0.3, y: -0.4 });
  });

  it("normalizes the aim vector", () => {
    input.setAim({ x: 0, y: 8 });
    expect(input.aim).toEqual({ x: 0, y: 1 });
  });

  it("keeps the previous aim when handed a zero vector", () => {
    input.setAim({ x: 1, y: 0 });
    input.setAim({ x: 0, y: 0 });
    expect(input.aim).toEqual({ x: 1, y: 0 });
  });

  it("returns a queued cast exactly once", () => {
    input.queue("q");
    expect(input.consume().cast).toBe("q");
    expect(input.consume().cast).toBe(null);
  });

  it("keeps only the latest queued cast", () => {
    input.queue("q");
    input.queue("r");
    expect(input.consume().cast).toBe("r");
  });

  it.each([
    ["KeyQ", "q"],
    ["ShiftLeft", "w"],
    ["KeyF", "w"],
    ["KeyE", "e"],
    ["KeyR", "r"],
    ["Space", "basic"],
  ])("maps %s to the %s ability", (code, ability) => {
    input.keyDown(code);
    expect(input.consume().cast).toBe(ability);
  });

  it("ignores keys with no ability binding", () => {
    input.keyDown("KeyZ");
    expect(input.consume().cast).toBe(null);
  });

  it.each([
    ["KeyA", { x: -1, y: 0 }],
    ["ArrowLeft", { x: -1, y: 0 }],
    ["KeyD", { x: 1, y: 0 }],
    ["ArrowRight", { x: 1, y: 0 }],
    ["KeyW", { x: 0, y: -1 }],
    ["ArrowUp", { x: 0, y: -1 }],
    ["KeyS", { x: 0, y: 1 }],
    ["ArrowDown", { x: 0, y: 1 }],
  ])("translates %s into a unit move vector", (code, expected) => {
    input.keyDown(code);
    expect(input.consume().move).toEqual(expected);
  });

  it("normalizes diagonal keyboard movement", () => {
    input.keyDown("KeyW");
    input.keyDown("KeyD");
    const move = input.consume().move;
    expect(move.x).toBeCloseTo(Math.SQRT1_2);
    expect(move.y).toBeCloseTo(-Math.SQRT1_2);
  });

  it("cancels opposing keys and falls back to the joystick vector", () => {
    input.setMove({ x: 0.5, y: 0.5 });
    input.keyDown("KeyA");
    input.keyDown("KeyD");
    expect(input.consume().move).toEqual({ x: 0.5, y: 0.5 });
  });

  it("prefers keyboard movement over the joystick while a key is held", () => {
    input.setMove({ x: 0.5, y: 0 });
    input.keyDown("KeyA");
    expect(input.consume().move).toEqual({ x: -1, y: 0 });
    input.keyUp("KeyA");
    expect(input.consume().move).toEqual({ x: 0.5, y: 0 });
  });

  it("keeps reporting keyboard movement while the key stays down", () => {
    input.keyDown("KeyD");
    expect(input.consume().move).toEqual({ x: 1, y: 0 });
    expect(input.consume().move).toEqual({ x: 1, y: 0 });
  });
});
