import { useCallback, useEffect, useRef, useState } from "react";
import { content } from "@/game/content";
import { SHELTER_SLOT_COUNT, doseLimitFor } from "@/game/engine";
import { FLOW_INDEX, stormStatus, type StormPhase } from "@/game/storm/model";
import { MissionWrapUp } from "./wrapup";
import { useGame, type AgeMode } from "@/game/state";
import { cn } from "@/lib/utils";
import { SpaceWeatherTicker } from "./cast";
import { Ledger } from "./ledger";
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
  const { sim, ageMode, beginStorm, setShelter, setStormPower, nextStormPhase, retrySim, completeMission, recordFacts, story, setScene } = useGame();
  const mode: AgeMode = ageMode ?? "explorer";
  const [phase, setPhase] = useState<StormPhase>("detect");
  const [plan, setPlan] = useState<{ shelterKw: number; cabinKw: number; greenhouseKw: number } | null>(null);
  const prepared = useRef(false);
  const [wrapOpen, setWrapOpen] = useState(false);

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
      {phase === "detect" && <SpaceWeatherTicker mission="m3" mode={mode} />}
      <div className="gg-top">
        <Flow phase={phase} />
        {replay}
      </div>
      {(phase === "prepare" || phase === "cme" || phase === "sep" || phase === "route") && <Ledger mission="m3" mode={mode} />}
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
            const st = stormStatus(sim);
            completeMission(2);
            recordFacts({
              m3: {
                shelter: st.shelterCounts,
                inventory: { ...sim.subSystems.radiation.shelterInventory },
                arraysProtected: st.arraysProtected,
                plan,
                budget: sim.subSystems.power.stormBudgetKw,
                rerouted: sim.controls.act3.reroute !== null,
                crewDoseUGy: Math.round(sim.subSystems.radiation.cumulativeCrewDoseUGy),
                doseLimit: doseLimitFor(sim.meta.ageBand),
                holding: st.holding,
              },
            });
            setPhase("debrief");
            if (story.run.answered.m3 === undefined) window.setTimeout(() => setWrapOpen(true), 1200);
          }}
          onRetry={() => {
            retrySim();
            prepared.current = false;
            setPlan(null);
            setPhase("prepare");
          }}
        />
      )}
      {wrapOpen && <MissionWrapUp mission="m3" onClose={() => setWrapOpen(false)} />}
      {phase === "debrief" && <DebriefView mode={mode} plan={plan} onAgain={restart} onBack={() => setScene("map")} />}
    </div>
  );
}
