import { useCallback, useEffect, useRef, useState } from "react";
import { content } from "@/game/content";
import { SHELTER_SLOT_COUNT } from "@/game/engine";
import { FLOW_INDEX, type StormPhase } from "@/game/storm/model";
import { useGame, type AgeMode } from "@/game/state";
import { cn } from "@/lib/utils";
import { SolarArrays } from "./storm-art";
import { DebriefView, StormView } from "./storm-playback";
import { CmeView, DetectView, PrepareView, RouteView, SepView } from "./storm-views";

const g = content.storm.game;

function Flow({ phase }: { phase: StormPhase }) {
  const now = FLOW_INDEX[phase];
  return (
    <ol className="gg-strip" aria-label="Mission flow">
      {g.flow.map((f, i) => (
        <li key={f} aria-current={i === now ? "step" : undefined} className={cn(i < now && "done")}>
          {f}
        </li>
      ))}
    </ol>
  );
}

/**
 * Mission 3 flow: DETECT > PREPARE > SHELTER > PRIORITIZE > SURVIVE, one decision at a time.
 * Every number and effect comes from the engine (shared game state + the NASA datasets); this component only
 * walks the player through it and shows it.
 */
export function StormGame({ replay, active = true }: { replay?: React.ReactNode; /** False while the briefing is open: the game waits quietly underneath. */ active?: boolean }) {
  const { sim, ageMode, beginStorm, setShelter, setStormPower, nextStormPhase, retrySim, completeMission, setScene } = useGame();
  const mode: AgeMode = ageMode ?? "explorer";
  const [phase, setPhase] = useState<StormPhase>("detect");
  const [plan, setPlan] = useState<{ shelterKw: number; cabinKw: number; greenhouseKw: number } | null>(null);
  const prepared = useRef(false);

  // Opening the mission starts the storm on the shared engine, from the results of Missions 1 and 2.
  useEffect(() => beginStorm(), [beginStorm]);
  const ready = sim.meta.currentAct === 3;
  // The game starts from an empty shelter and an empty power board: the player builds both.
  useEffect(() => {
    if (!ready || prepared.current) return;
    prepared.current = true;
    setShelter(Array.from({ length: SHELTER_SLOT_COUNT }, () => null));
    setStormPower({ shelterKw: 0, cabinKw: 0, greenhouseKw: 0 });
  }, [ready, setShelter, setStormPower]);

  const restart = useCallback(() => {
    prepared.current = false;
    beginStorm();
    setPhase("detect");
    setPlan(null);
  }, [beginStorm]);

  if (!ready) return null;
  const toCme = () => {
    nextStormPhase(); // engine: FLR -> CME (shelter is sealed)
    setPhase("cme");
  };
  const toSep = () => {
    nextStormPhase(); // engine: CME -> SEP
    setPhase("sep");
  };
  const lockPlan = () => {
    setPlan({ ...sim.controls.act3.sepPowerAlloc });
    nextStormPhase(); // engine: SEP -> CRaTER playback; the plan is locked
    setPhase("storm");
  };

  return (
    <div className={cn("sg", `sg-${mode}`, `sg-phase-${phase}`)} aria-label={g.aria}>
      <div className="gg-top">
        <Flow phase={phase} />
        {replay}
      </div>
      {phase === "detect" &&
        (active ? (
          <DetectView mode={mode} onNext={() => setPhase("prepare")} />
        ) : (
          <div className="sg-detect">
            <SolarArrays protectedArrays={false} label="The lunar outpost with its solar arrays open" />
          </div>
        ))}
      {phase === "prepare" && <PrepareView mode={mode} onNext={toCme} />}
      {phase === "cme" && <CmeView mode={mode} onNext={toSep} />}
      {phase === "sep" && <SepView mode={mode} onNext={() => setPhase("route")} />}
      {phase === "route" && <RouteView mode={mode} onLock={lockPlan} />}
      {phase === "storm" && (
        <StormView
          mode={mode}
          onPassed={() => {
            completeMission(2);
            setPhase("debrief");
          }}
          onRetry={() => {
            retrySim();
            prepared.current = false;
            setPlan(null);
            setPhase("prepare");
          }}
        />
      )}
      {phase === "debrief" && <DebriefView mode={mode} plan={plan} onAgain={restart} onBack={() => setScene("map")} />}
    </div>
  );
}
