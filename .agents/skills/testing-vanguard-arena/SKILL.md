---
name: testing-vanguard-arena
description: How to run and manually test the Vanguard Arena (project-spark) canvas game locally — dev server startup, unit tests, UI paths, key bindings, and tricks for testing gameplay systems despite slow agent reaction time.
---

# Testing Vanguard Arena (project-spark)

## Running the app
- Package manager is **bun** (`export PATH=$HOME/.bun/bin:$PATH`), deps via `bun install`.
- `bun run dev` may fail with `ERR_REQUIRE_ESM` / "Vite requires Node.js 20.19+ or 22.12+" if the shell's
  default node is 20.x. Use node 22 explicitly, e.g.
  `export PATH=$HOME/.nvm/versions/node/v22.12.0/bin:$HOME/.bun/bin:$PATH && bun run dev`.
- The dev server listens on **http://localhost:8080** (not 3000).
- Unit tests: `bun run test` / `bun run test:coverage` (vitest, node environment).
- `bun run lint` has many pre-existing prettier failures — not a signal of regression.

## UI paths (src/routes/index.tsx)
- Menu → **PLAY 1V1** → "Searching for opponent…" (1.2–2.4s, `LocalMatchService`) → arena.
  **PRACTICE** skips matchmaking (opponent "Training Dummy"), same AI.
- Arena → 3s countdown overlay → "FIGHT" announcement.
- Results screen after death/time-up: **REMATCH** (re-runs matchmaking) / **RETURN TO MENU**.
- In-arena **QUIT** button is top-left, under the FPS chip.
- Profile (rating/wins/losses) is persisted in `localStorage` under `va_profile`; clear it to reset stats.

## Controls (src/game/input/InputController.ts)
WASD or arrows move · mouse moves aim · `Space` or LMB basic attack · `Q` (or RMB) skillshot
(0.3s telegraph) · `ShiftLeft` **or** `F` dash (0.3s i-frames → green "DODGE" popups) · `R` Overdrive
(needs ULT 100%). `E` is parked (feature flag off).

## Gameplay systems worth checking (src/game/config/gameConfig.ts is the single source of truth)
- Neutral camps at world (320,600) and (1280,600); walking within ~270 units flips them to
  COMBAT and spawns 3 crawlers each. Each crawler kill = **+5 essence** (only to the killing blow —
  the AI can steal kills, so your essence may be lower than 5 × crawlers killed nearby).
- Upgrades PWR/VIT/HST cost **20 essence** each (left HUD column); buttons stay disabled below 20.
  One camp only yields 15, so plan on two camps or a camp respawn (25s).
- Timeline: core activates at t=90s, sudden death after 180s.

## Testing tricks
- Agent reaction latency (~8s per tool round-trip) means the default AI kills the 300 HP player in
  under 2 minutes, which makes camp farming / upgrade tests nearly impossible. Temporarily edit
  `GAME_CONFIG.vanguard.maxHealth` (e.g. 4000) and/or `GAME_CONFIG.ai.difficulty = "easy"`, then
  `git checkout src/game/config/gameConfig.ts` and reload before doing the final "default config"
  pass. Always disclose such tweaks in the report.
- Vite HMR picks up config edits, but the engine reads config at construction — start a **new match**
  after editing.
- Batch inputs in one computer-use call (`mouse_move` → several `key space` with 0.65s waits, matching
  the 0.62s attack cooldown) to actually kill things between screenshots.
- Known pre-existing console error on load: React hydration mismatch on the `<html>` element
  (`--tg-viewport-height` style injected by the Telegram WebApp script). Not caused by game code.

## Devin Secrets Needed
None.
