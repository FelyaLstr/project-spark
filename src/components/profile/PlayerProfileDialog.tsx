import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PlayerProfile } from "@/data/players";
import { PlayerProfileView } from "./PlayerProfileView";

type Props = {
  player: PlayerProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PlayerProfileDialog({ player, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto border-border/70 bg-background/95 backdrop-blur">
        <DialogHeader>
          <DialogTitle className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
            Player profile
          </DialogTitle>
        </DialogHeader>
        {player && <PlayerProfileView player={player} />}
      </DialogContent>
    </Dialog>
  );
}
