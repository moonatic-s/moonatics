import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { content } from "@/game/content";
import { useGame } from "@/game/state";
import { StormBriefing } from "./storm-briefing";
import { StormGame } from "./storm-game";

/**
 * Mission 3 entry. The four-screen briefing plays every time the mission opens (the small replay icon brings it
 * back), with the storm game waiting underneath. One briefing component serves both age groups.
 */
export function StormScene() {
  const { setScene, markBriefingSeen } = useGame();
  const [briefingOpen, setBriefingOpen] = useState(true);
  return (
    <section className="center-scene systems-scene storm-scene-page">
      <div
        className={briefingOpen ? "gh-cover-open" : "gh-cover-done"}
        inert={briefingOpen}
        aria-hidden={briefingOpen || undefined}
      >
        <StormGame
          active={!briefingOpen}
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
        <StormBriefing
          onBack={() => setScene("map")}
          onFinish={() => {
            markBriefingSeen("storm");
            setBriefingOpen(false);
          }}
        />
      )}
    </section>
  );
}
