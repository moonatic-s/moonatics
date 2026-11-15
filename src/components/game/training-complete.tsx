import { ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { sfx } from "@/game/audio/sfx";
import { useGame, type AgeMode } from "@/game/state";
import { PATCHES } from "@/game/story/collection";
import { epilogue } from "@/game/story/copy";
import { efficiencyOf, overallEfficiency, skillsOf, starsOf } from "@/game/story/evidence";
import { MISSION_KEYS } from "@/game/story/profile";
import { Avatar, Comms } from "./cast";
import { PatchGrid, Skills, Stars } from "./crew-log";
import { LivingOutpost } from "./outpost";
import { useStormVoice } from "./storm-views";

const NAMES = ["Life Support", "Space Greenhouse", "Solar Storm"];

/**
 * After the third mission: a proper finish. Congratulations, the outpost as the child left it, their decisions replayed
 * as cause and effect, what they learned, how thriftily they ran it, and an invitation to play again for better results.
 */
export function TrainingComplete({ mode }: { mode: AgeMode }) {
  const { story, rewards, clearRewards, finishTraining, startNewRun, setScene, missionStatuses } = useGame();
  const { run, profile } = story;
  const skills = skillsOf(run.facts, profile.solved);
  const overall = overallEfficiency(run);
  const lines = epilogue(run.facts, mode);
  const fresh = rewards.filter((r) => r.kind === "patch").map((r) => r.id);

  useEffect(() => {
    finishTraining();
    sfx.unlock();
    return () => clearRewards();
    // once, when the screen opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useStormVoice(["Congratulations! You finished the training.", "If you wish, you can play again for better results."], mode);

  return (
    <section className="finish" aria-label="Training complete">
      <div className="done-hero">
        <Avatar who="nova" mood="happy" size={64} />
        <div>
          <h2 className="done-title">CONGRATULATIONS, TRAINING COMPLETE!</h2>
          <p className="done-sub">You kept the crew safe, the air steady and the tomatoes growing. If you wish, play again to get even better results.</p>
        </div>
        <Avatar who="luna" mood="happy" size={64} />
      </div>

      <LivingOutpost facts={run.facts} done={[missionStatuses[0] === "completed", missionStatuses[1] === "completed", missionStatuses[2] === "completed"]} />

      <h3>YOUR STORY</h3>
      <div className="done-story">
        {lines.map((l, i) => (
          <Comms key={l} who={i % 2 === 0 ? "luna" : "nova"} mood="happy">
            {l}
          </Comms>
        ))}
      </div>

      <h3>WHAT YOU LEARNED</h3>
      <Skills levels={skills} />

      <h3>HOW THRIFTILY YOU RAN THE OUTPOST</h3>
      <ul className="eff">
        {MISSION_KEYS.map((k, i) => {
          const e = efficiencyOf(k, run.facts, run.supplyDropUsed);
          return (
            <li key={k}>
              <span>{NAMES[i]}</span>
              {e === null ? <em>not played this run</em> : <><Stars value={starsOf(e)} /><b>{e}%</b></>}
            </li>
          );
        })}
        <li className="eff-all">
          <span>Overall</span>
          {overall === null ? <em>—</em> : <><Stars value={starsOf(overall)} /><b>{overall}%</b></>}
          <small>Your best: {profile.bestEfficiency}%{run.supplyDropUsed ? " · a supply drop was used" : ""}</small>
        </li>
      </ul>

      <h3>PATCHES</h3>
      <PatchGrid earned={profile.patches} fresh={fresh} />
      <p className="done-count">
        {profile.patches.length} of {PATCHES.length} patches collected · {profile.cards.length} science cards
      </p>

      <div className="wrap-actions done-actions">
        <Button variant="outline" onClick={() => setScene("log")}>
          OPEN THE CREW LOG
        </Button>
        <Button variant="outline" onClick={() => setScene("map")}>
          RETURN TO THE MISSION MAP
        </Button>
        <Button className="mission-cta" data-primary onClick={() => startNewRun()}>
          PLAY AGAIN FOR BETTER RESULTS
          <ArrowRight size={18} />
        </Button>
      </div>
    </section>
  );
}
