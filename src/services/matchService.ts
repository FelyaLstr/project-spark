/**
 * Abstraction over matchmaking. Today it resolves instantly with a local
 * simulated opponent; later a WebSocket implementation can replace it without
 * touching gameplay code.
 */
export type MatchTicket = {
  matchId: string;
  opponentName: string;
  mode: "local-ai" | "remote";
};

export interface MatchService {
  findMatch(signal?: AbortSignal): Promise<MatchTicket>;
}

export class MatchAbortedError extends Error {
  constructor() {
    super("Match search was cancelled");
    this.name = "MatchAbortedError";
  }
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new MatchAbortedError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new MatchAbortedError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export class LocalMatchService implements MatchService {
  async findMatch(signal?: AbortSignal): Promise<MatchTicket> {
    const delay = 1200 + Math.random() * 1200;
    await wait(delay, signal);
    const names = ["Nyx", "Ravager", "Kestrel", "Ashvein", "Volt", "Sable"];
    return {
      matchId: `local_${Date.now()}`,
      opponentName: names[Math.floor(Math.random() * names.length)] ?? "Nyx",
      mode: "local-ai",
    };
  }
}

export const matchService: MatchService = new LocalMatchService();
