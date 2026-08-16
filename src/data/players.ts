export type HeroRole = "VANGUARD" | "ASSASSIN" | "CASTER" | "BRUISER";

export type RankTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND" | "ASCENDED";

export type FavouriteHero = {
  id: string;
  name: string;
  role: HeroRole;
  games: number;
  winRate: number;
};

export type PlayerProfile = {
  id: string;
  name: string;
  level: number;
  rank: RankTier;
  division: string;
  rating: number;
  matches: number;
  wins: number;
  losses: number;
  kdRatio: number;
  /** Most recent match first. */
  recentForm: ("W" | "L")[];
  favouriteHeroes: FavouriteHero[];
};

export const RANK_ACCENT: Record<RankTier, string> = {
  BRONZE: "#b07445",
  SILVER: "#b9c2cf",
  GOLD: "#e2b348",
  PLATINUM: "#63d5c4",
  DIAMOND: "#8f7bff",
  ASCENDED: "#d867ff",
};

export const winRate = (p: PlayerProfile) => (p.matches ? (p.wins / p.matches) * 100 : 0);

export const MOCK_PLAYERS = {
  self: {
    id: "self",
    name: "Vanguard",
    level: 42,
    rank: "DIAMOND",
    division: "IV",
    rating: 2480,
    matches: 1248,
    wins: 783,
    losses: 465,
    kdRatio: 1.89,
    recentForm: ["W", "W", "L", "W", "W"],
    favouriteHeroes: [
      { id: "riftwarden", name: "Riftwarden", role: "VANGUARD", games: 512, winRate: 64.1 },
      { id: "shadowstalker", name: "Shadowstalker", role: "ASSASSIN", games: 268, winRate: 58.7 },
      { id: "stoneguard", name: "Stoneguard", role: "VANGUARD", games: 141, winRate: 55.2 },
    ],
  },
  nyx: {
    id: "nyx",
    name: "Nyx",
    level: 37,
    rank: "PLATINUM",
    division: "II",
    rating: 2120,
    matches: 964,
    wins: 528,
    losses: 436,
    kdRatio: 1.42,
    recentForm: ["L", "W", "W", "L", "W"],
    favouriteHeroes: [
      { id: "shadowstalker", name: "Shadowstalker", role: "ASSASSIN", games: 430, winRate: 59.3 },
      { id: "obsidian", name: "Obsidian", role: "CASTER", games: 301, winRate: 52.8 },
      { id: "bloodhorn", name: "Bloodhorn", role: "BRUISER", games: 122, winRate: 49.1 },
    ],
  },
  bloodhorn: {
    id: "bloodhorn",
    name: "Bloodhorn",
    level: 55,
    rank: "GOLD",
    division: "II",
    rating: 1740,
    matches: 2103,
    wins: 1012,
    losses: 1091,
    kdRatio: 1.08,
    recentForm: ["L", "L", "W", "L", "W"],
    favouriteHeroes: [
      { id: "bloodhorn", name: "Bloodhorn", role: "BRUISER", games: 1180, winRate: 51.4 },
      { id: "ironsentinel", name: "Iron Sentinel", role: "VANGUARD", games: 604, winRate: 47.9 },
      { id: "stoneguard", name: "Stoneguard", role: "VANGUARD", games: 214, winRate: 45.6 },
    ],
  },
  seraph: {
    id: "seraph",
    name: "Seraph",
    level: 68,
    rank: "ASCENDED",
    division: "I",
    rating: 3140,
    matches: 3287,
    wins: 2211,
    losses: 1076,
    kdRatio: 2.34,
    recentForm: ["W", "W", "W", "W", "L"],
    favouriteHeroes: [
      { id: "obsidian", name: "Obsidian", role: "CASTER", games: 1502, winRate: 71.2 },
      { id: "riftwarden", name: "Riftwarden", role: "VANGUARD", games: 998, winRate: 66.4 },
      { id: "shadowstalker", name: "Shadowstalker", role: "ASSASSIN", games: 511, winRate: 62.0 },
    ],
  },
} satisfies Record<string, PlayerProfile>;

export const PLAYER_LIST: PlayerProfile[] = Object.values(MOCK_PLAYERS);

export const getPlayerByName = (name: string): PlayerProfile => {
  const found = PLAYER_LIST.find((p) => p.name.toLowerCase() === name.toLowerCase());
  return found ?? { ...MOCK_PLAYERS.nyx, id: `guest-${name}`, name };
};

