import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { content } from "@/game/content";
import { useGame } from "@/game/state";
import { GreenhouseBriefing } from "./greenhouse-briefing";
import { GreenhouseGame } from "./greenhouse-game";

/**
 * Mission 2 entry. The briefing plays every time the mission opens (the small replay icon brings it back),
 * with the greenhouse game waiting underneath. Each age group has its own briefing; the game uses the same
 * mechanics for both and only changes its wording and detail.
 */
export function GreenhouseScene() {
  const { ageMode, setScene, markBriefingSeen } = useGame();
  const [briefingOpen, setBriefingOpen] = useState(true);
  return (
    <section className="center-scene systems-scene greenhouse-scene">
      <div
        className={briefingOpen ? "gh-cover-open" : "gh-cover-done"}
        inert={briefingOpen}
        aria-hidden={briefingOpen || undefined}
      >
        <GreenhouseGame
          replay={
            <button
              type="button"
              className="replay-briefing gg-replay"
              title={content.common.replayBriefing}
              aria-label={content.common.replayBriefing}
              onClick={() => setBriefingOpen(true)}
            >
              <RotateCcw size={16} aria-hidden="true" />
            </button>
          }
        />
      </div>
      {briefingOpen && (
        <GreenhouseBriefing
          variant={ageMode === "specialist" ? "specialist" : "explorer"}
          onBack={() => setScene("map")}
          onFinish={() => {
            markBriefingSeen("greenhouse");
            setBriefingOpen(false);
          }}
        />
      )}
    </section>
  );
}
