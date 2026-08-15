import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalMatchService, matchService } from "./matchService";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("LocalMatchService", () => {
  it("resolves a local-ai ticket after a simulated queue delay", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const pending = new LocalMatchService().findMatch();
    let settled = false;
    void pending.then(() => (settled = true));

    await vi.advanceTimersByTimeAsync(1000);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);

    const ticket = await pending;
    expect(ticket.mode).toBe("local-ai");
    expect(ticket.matchId).toMatch(/^local_\d+$/);
    expect(ticket.opponentName).toBeTruthy();
  });

  it("stays inside the configured delay window", async () => {
    vi.useFakeTimers();
    for (const roll of [0, 0.999]) {
      vi.spyOn(Math, "random").mockReturnValue(roll);
      const pending = new LocalMatchService().findMatch();
      await vi.advanceTimersByTimeAsync(2400);
      await expect(pending).resolves.toMatchObject({ mode: "local-ai" });
    }
  });

  it("picks the opponent name by the random roll", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const first = new LocalMatchService().findMatch();
    await vi.advanceTimersByTimeAsync(2400);
    expect((await first).opponentName).toBe("Nyx");

    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const last = new LocalMatchService().findMatch();
    await vi.advanceTimersByTimeAsync(2400);
    expect((await last).opponentName).toBe("Sable");
  });

  it("exports a ready-to-use singleton", () => {
    expect(matchService).toBeInstanceOf(LocalMatchService);
  });
});
