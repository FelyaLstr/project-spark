import type { Team } from "./types";

export const byTeam = <T>(team: Team, a: T, b: T): T => (team === "A" ? a : b);

/** Per-team effect colours. Keep every team-tinted colour here so A/B stay symmetric. */
export const TEAM_COLORS = {
  A: {
    body: "#38bdf8",
    dashTrail: "#38bdf8",
    muzzleBasic: "#67e8f9",
    muzzleQ: "#c4b5fd",
    telegraph: "#a78bfa",
    shockwave: "#60a5fa",
    fizzle: "#38bdf8",
    projectileCore: "#a5f3fc",
    projectileGlow: "#22d3ee",
    projectileCoreQ: "#ddd6fe",
    projectileGlowQ: "#8b5cf6",
    damageText: "#fca5a5",
  },
  B: {
    body: "#fb7185",
    dashTrail: "#fb7185",
    muzzleBasic: "#fda4af",
    muzzleQ: "#fdba74",
    telegraph: "#fb923c",
    shockwave: "#fb7185",
    fizzle: "#fb7185",
    projectileCore: "#fecdd3",
    projectileGlow: "#f43f5e",
    projectileCoreQ: "#fed7aa",
    projectileGlowQ: "#f97316",
    damageText: "#fde68a",
  },
} as const;

export const teamColors = (team: Team) => TEAM_COLORS[team];
