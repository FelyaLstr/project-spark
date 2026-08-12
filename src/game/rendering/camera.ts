import { GAME_CONFIG } from "../config/gameConfig";
import { clamp, type Vec } from "../core/math";

const C = GAME_CONFIG;

export type Camera = { zoom: number; cam: Vec };

/**
 * Single source of truth for the arena camera, shared by the canvas renderer and
 * the DOM layer that turns pointer positions back into world coordinates.
 */
export function getCamera(viewW: number, viewH: number, playerPos: Vec): Camera {
  const zoom = clamp(viewW / 900, 0.52, 0.95);
  const halfW = viewW / 2 / zoom;
  const halfH = viewH / 2 / zoom;
  return {
    zoom,
    cam: {
      x: clamp(
        playerPos.x,
        Math.min(halfW, C.arena.width / 2),
        Math.max(C.arena.width - halfW, C.arena.width / 2),
      ),
      y: clamp(
        playerPos.y,
        Math.min(halfH, C.arena.height / 2),
        Math.max(C.arena.height - halfH, C.arena.height / 2),
      ),
    },
  };
}
