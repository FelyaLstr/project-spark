import { GAME_CONFIG } from "@/game/config/gameConfig";
import type { Vec } from "@/game/core/math";
import type { AbilityKey, Fighter } from "@/game/core/types";
import { AbilityButton } from "./AbilityButton";

const C = GAME_CONFIG;

export type AimHandlers = {
  onAim: (v: Vec) => void;
  onAimStart: (ability: AbilityKey) => void;
  onAimEnd: () => void;
};

type Props = {
  cooldowns: Fighter["cooldowns"] | undefined;
  ultReady: number;
  onCast: (ability: AbilityKey) => void;
  /** omitted in portrait, where the joystick owns aiming */
  aim?: AimHandlers;
};

/** R/W/Q/ATK cluster. Drag-aiming is opt-in so portrait and landscape share one layout. */
export function ControlPad({ cooldowns, ultReady, onCast, aim }: Props) {
  return (
    <div className="flex items-end gap-3">
      <div className="flex flex-col items-center gap-3">
        <AbilityButton
          label="R"
          ability="r"
          cooldown={0}
          maxCooldown={0}
          charge={ultReady}
          onCast={onCast}
          aimable={false}
        />
        <AbilityButton
          label="W"
          ability="w"
          cooldown={cooldowns?.w ?? 0}
          maxCooldown={C.abilities.w.cooldown}
          onCast={onCast}
          {...aim}
        />
      </div>
      <div className="flex flex-col items-center gap-3">
        <AbilityButton
          label="Q"
          ability="q"
          cooldown={cooldowns?.q ?? 0}
          maxCooldown={C.abilities.q.cooldown}
          onCast={onCast}
          {...aim}
        />
        <AbilityButton
          label="ATK"
          ability="basic"
          big
          cooldown={cooldowns?.basic ?? 0}
          maxCooldown={C.vanguard.attackCooldown}
          onCast={onCast}
          {...aim}
        />
      </div>
    </div>
  );
}
