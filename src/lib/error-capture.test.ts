import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consumeLastCapturedError, describeError } from "./error-capture";

describe("describeError", () => {
  it("keeps the stack of a plain Error", () => {
    const error = new Error("boom");
    const described = describeError(error);
    expect(described).toContain("boom");
    expect(described).toContain(error.stack!);
  });

  it("falls back to name and message when there is no stack", () => {
    const error = new Error("stackless");
    delete error.stack;
    expect(describeError(error)).toBe("Error: stackless");
  });

  it("appends an http status when the error carries one", () => {
    const withStatus = Object.assign(new Error("nope"), { stack: undefined, status: 404 });
    expect(describeError(withStatus)).toBe("Error: nope (status 404)");

    const withStatusCode = Object.assign(new Error("nope"), { stack: undefined, statusCode: 503 });
    expect(describeError(withStatusCode)).toBe("Error: nope (status 503)");
  });

  it("unwraps the cause chain", () => {
    const root = Object.assign(new Error("root"), { stack: undefined });
    const middle = Object.assign(new Error("middle"), { stack: undefined, cause: root });
    const top = Object.assign(new Error("top"), { stack: undefined, cause: middle });
    expect(describeError(top)).toBe("Error: top\ncaused by: Error: middle\ncaused by: Error: root");
  });

  it("stops after the cause depth limit", () => {
    let error = Object.assign(new Error("depth-0"), { stack: undefined });
    for (let i = 1; i < 10; i++) {
      error = Object.assign(new Error(`depth-${i}`), { stack: undefined, cause: error });
    }
    const lines = describeError(error).split("\n");
    expect(lines).toHaveLength(5);
    expect(lines[0]).toContain("depth-9");
  });

  it("renders non-Error values", () => {
    expect(describeError("just a string")).toBe("just a string");
    expect(describeError({ status: 500 })).toBe('{"status":500}');
    expect(describeError(undefined)).toBe("");
  });

  it("survives values that cannot be serialized", () => {
    const circular: Record<string, unknown> = {};
    circular["self"] = circular;
    expect(describeError(circular)).toBe("[object Object]");
    expect(describeError(() => {})).toContain("=>");
  });

  it("truncates very long descriptions", () => {
    const error = new Error("x".repeat(20_000));
    delete error.stack;
    expect(describeError(error)).toHaveLength(8_000);
  });
});

describe("consumeLastCapturedError", () => {
  // console.error is deliberately left unmocked: the module under test wraps it at
  // import time, and replacing it would bypass the capture path being tested.
  const quiet = (error: unknown) => {
    const write = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    console.error(error);
    write.mockRestore();
  };

  beforeEach(() => {
    consumeLastCapturedError();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns undefined when nothing was captured", () => {
    expect(consumeLastCapturedError()).toBeUndefined();
  });

  it("captures errors logged through console.error", () => {
    const error = new Error("logged");
    quiet(error);
    expect(consumeLastCapturedError()).toBe(error);
  });

  it("only hands the error out once", () => {
    const error = new Error("logged once");
    quiet(error);
    expect(consumeLastCapturedError()).toBe(error);
    expect(consumeLastCapturedError()).toBeUndefined();
  });

  it("does not capture non-Error log arguments", () => {
    quiet("just a message");
    expect(consumeLastCapturedError()).toBeUndefined();
  });

  it("drops errors older than the ttl", () => {
    vi.useFakeTimers();
    quiet(new Error("stale"));
    vi.advanceTimersByTime(6_000);
    expect(consumeLastCapturedError()).toBeUndefined();
  });
});
