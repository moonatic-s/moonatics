import { LockKeyholeOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { sfx } from "@/game/audio/sfx";
import { content } from "@/game/content";
import { useGame } from "@/game/state";

/** A short celebration when finishing a mission opens the next one. It never blocks anything and fades by itself. */
export function UnlockToast() {
  const { justUnlocked } = useGame();
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (justUnlocked === null) return;
    setShown(justUnlocked);
    sfx.unlock();
    const t = window.setTimeout(() => setShown(null), 4800);
    return () => window.clearTimeout(t);
  }, [justUnlocked]);
  const mission = shown === null ? null : content.missions[shown];
  if (!mission) return null;
  return (
    <div className="unlock-toast" role="status" aria-live="polite">
      <span className="unlock-icon" aria-hidden="true">
        <LockKeyholeOpen size={22} />
      </span>
      <span className="unlock-text">
        <b>{content.common.unlocked}</b>
        <span>
          {mission.number} {mission.title}
        </span>
      </span>
    </div>
  );
}
