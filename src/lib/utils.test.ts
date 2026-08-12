import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values and flattens nested lists", () => {
    expect(cn("a", null, undefined, false, ["c", ["d"]])).toBe("a c d");
  });

  it("lets the last conflicting tailwind utility win", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm text-red-500", "text-blue-500")).toBe("text-sm text-blue-500");
  });

  it("returns an empty string for no input", () => {
    expect(cn()).toBe("");
  });
});
