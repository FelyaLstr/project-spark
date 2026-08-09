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

export class LocalMatchService implements MatchService {
  async findMatch(): Promise<MatchTicket> {
    const delay = 1200 + Math.random() * 1200;
    await new Promise((r) => setTimeout(r, delay));
    const names = ["Nyx", "Ravager", "Kestrel", "Ashvein", "Volt", "Sable"];
    return {
      matchId: `local_${Date.now()}`,
      opponentName: names[Math.floor(Math.random() * names.length)] ?? "Nyx",
      mode: "local-ai",
    };
  }
}

export const matchService: MatchService = new LocalMatchService();
