import { ArrowRight, RotateCcw } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Button } from "@/components/ui/button";
import { content } from "@/game/content";
import {
  captureLifeSupportCarryOver,
  forecastNextStep,
  getAct1Objective,
  getLifeSupportBreakdown,
  summarizeStep,
} from "@/game/engine";
import { guideMessage } from "@/game/life-support/guide";
import {
  BANNER_MS,
  RESULT_OPEN_MS,
  STEP_DELAY_MS,
} from "@/game/life-support/timing";
import {
  allReadingsSafe,
  forecastWarnings,
} from "@/game/life-support/forecast";
import {
  changeRows,
  interpretStep,
  type ChannelKey,
} from "@/game/life-support/interpret";
import {
  explainCo2,
  explainHumidity,
  explainTemperature,
} from "@/game/life-support/why";
import { useGame } from "@/game/state";
import { cn } from "@/lib/utils";
import { Gauge, Lever, type GaugeKind } from "./console-parts";
import { HabitatDiagram } from "./habitat-diagram";
import { SpaceWeatherTicker } from "./cast";
import { LifeSupportBriefing } from "./life-support-briefing";
import { MissionWrapUp } from "./wrapup";
import { BadgeRow, MissionGuide, ObjectiveStrip } from "./mission-header";
import { MissionHeader } from "./mission-ui";
import { PowerLedger } from "./power-ledger";
import { StepResult } from "./step-result";
import { ScienceTerm, type ScienceTermKey } from "./science-term";

const copy = content.lifeConsole;

/**
 * Life Support mission console. The player observes the NASA reading, adjusts three systems, sees the power trade-off,
 * advances 6 hours, sees what changed, and adjusts again. No timers drive the simulation.
 */
/** How long the "controls appear" reveal animation keeps its class after the briefing fades. */
const REVEAL_MS = 2000;

/**
 * `briefing` shows the training briefing over the console on first view (default). The console stays mounted
 * underneath, inactive, so finishing the briefing simply fades it away to reveal the live controls.
 */
export function LifeSupportSim({ briefing = true }: { briefing?: boolean }) {
  const {
    sim,
    ageMode,
    recap,
    setLifeSupportControls,
    stepSim,
    retrySim,
    resetSim,
    setScene,
    completeMission,
    markBriefingSeen,
    recordResult,
    recordFacts,
    story,
  } = useGame();
  const mode = ageMode ?? "explorer";
  // Coming back from the greenhouse: the shared engine is in Act 2, so start Life Support fresh.
  useEffect(() => {
    if (sim.meta.currentAct !== 1) resetSim();
    // only when the screen opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { failed, failure } = sim.meta;
  const objective = getAct1Objective(sim);
  const complete = !failed && objective.complete;
  // Finishing Life Support marks Mission 1 done and unlocks Mission 2 on the map.
  useEffect(() => {
    if (complete) {
      completeMission(0);
      recordResult(1, captureLifeSupportCarryOver(sim));
      recordFacts({
        m1: {
          stable: objective.stable,
          total: objective.total,
          batteryPct: Math.round(sim.subSystems.power.batteryPct),
          waterLiters: sim.subSystems.water.reserveLiters,
          waterPct: Math.round((sim.subSystems.water.reserveLiters / sim.subSystems.water.maxLiters) * 100),
        },
      });
    }
    // record once per finished run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete, completeMission, recordResult]);
  // After the result, mission control asks one gentle question (skippable, once per run).
  const [wrapOpen, setWrapOpen] = useState(false);
  const asked = story.run.answered.m1 !== undefined;
  useEffect(() => {
    if (!complete || asked) return;
    const t = window.setTimeout(() => setWrapOpen(true), 1400);
    return () => window.clearTimeout(t);
  }, [complete, asked]);
  const controls = sim.controls.act1;

  const breakdown = useMemo(() => getLifeSupportBreakdown(sim), [sim]);
  const forecast = useMemo(() => forecastNextStep(sim), [sim]);
  const warnings = forecastWarnings(sim, forecast);
  const guide = guideMessage(mode, sim, forecast);

  // "6 hours later" beat: show the banner, apply the step halfway through, then clear it.
  const [advancing, setAdvancing] = useState(false);
  const timers = useRef<number[]>([]);
  // open: briefing covers a hidden console. leaving: the briefing fades while the console appears beneath it.
  // gone: only the live console remains.
  const [briefingPhase, setBriefingPhase] = useState<
    "open" | "leaving" | "gone"
  >(briefing ? "open" : "gone");
  const [revealing, setRevealing] = useState(false);
  const startLeaving = useCallback(() => {
    setBriefingPhase("leaving");
    setRevealing(true);
    timers.current.push(
      window.setTimeout(() => setRevealing(false), REVEAL_MS),
    );
  }, []);
  const endBriefing = useCallback(() => {
    markBriefingSeen("lifeSupport");
    setBriefingPhase("gone");
  }, [markBriefingSeen]);
  useEffect(
    () => () => timers.current.forEach((t) => window.clearTimeout(t)),
    [],
  );
  const advance = useCallback(() => {
    if (advancing) return;
    setAdvancing(true);
    timers.current.push(
      window.setTimeout(stepSim, STEP_DELAY_MS),
      window.setTimeout(() => setAdvancing(false), BANNER_MS),
    );
  }, [advancing, stepSim]);

  // What-changed card: opens after every step, collapses by itself, and can be reopened.
  const [resultOpen, setResultOpen] = useState(false);
  useEffect(() => {
    if (!recap) {
      setResultOpen(false);
      return;
    }
    setResultOpen(true);
    const t = window.setTimeout(() => setResultOpen(false), RESULT_OPEN_MS);
    return () => window.clearTimeout(t);
  }, [recap]);

  if (failed && failure) {
    return (
      <section className="sim-panel sim-result" role="alert">
        <MissionHeader
          eyebrow={copy.failed.eyebrow}
          title={failure.title}
          description={failure.lesson}
        />
        <Button className="mission-cta" onClick={retrySim}>
          {copy.failed.retry}
          <RotateCcw size={20} />
        </Button>
      </section>
    );
  }

  if (complete) {
    return (
      <section className="sim-panel sim-result">
        <MissionHeader
          eyebrow={copy.done.eyebrow}
          title={copy.done.title}
          description={copy.done.description}
        />
        <BadgeRow history={sim.meta.act1History} />
        <Button
          className="mission-cta"
          onClick={() => {
            resetSim();
            setScene("map");
          }}
        >
          {copy.done.back}
          <ArrowRight size={20} />
        </Button>
        <p className="sim-source">{copy.source}</p>
        <button
          type="button"
          className="replay-briefing"
          title={content.common.replayBriefing}
          aria-label={content.common.replayBriefing}
          onClick={() => setBriefingPhase("open")}
        >
          <RotateCcw size={16} aria-hidden="true" />
        </button>
        {wrapOpen && <MissionWrapUp mission="m1" onClose={() => setWrapOpen(false)} />}
      </section>
    );
  }

  const { cabin, power, water } = sim.subSystems;
  const later = forecast?.subSystems;

  const channels: {
    key: ChannelKey;
    kind: GaugeKind;
    term: ScienceTermKey;
    leverTerm?: ScienceTermKey;
    value: number;
    set: (value: number) => void;
    nasa: number;
    now: number;
    next: number | null;
    zone: typeof cabin.zones.co2;
    nextZone: typeof cabin.zones.co2 | null;
    why: string;
  }[] = [
    {
      key: "air",
      kind: "co2",
      term: "co2",
      leverTerm: "scrubbers",
      value: controls.airFiltration,
      set: (v) => setLifeSupportControls({ airFiltration: v }),
      nasa: breakdown.baseline.co2Ppm,
      now: cabin.co2Ppm,
      next: later?.cabin.co2Ppm ?? null,
      zone: cabin.zones.co2,
      nextZone: later?.cabin.zones.co2 ?? null,
      why: explainCo2(breakdown),
    },
    {
      key: "heat",
      kind: "temperature",
      term: "temperature",
      value: controls.climateControl,
      set: (v) => setLifeSupportControls({ climateControl: v }),
      nasa: breakdown.baseline.temperatureDegC,
      now: cabin.temperatureDegC,
      next: later?.cabin.temperatureDegC ?? null,
      zone: cabin.zones.temperature,
      nextZone: later?.cabin.zones.temperature ?? null,
      why: explainTemperature(breakdown),
    },
    {
      key: "water",
      kind: "humidity",
      term: "humidity",
      leverTerm: "recycler",
      value: controls.waterRecovery,
      set: (v) => setLifeSupportControls({ waterRecovery: v }),
      nasa: breakdown.baseline.humidityPct,
      now: cabin.relativeHumidityPct,
      next: later?.cabin.relativeHumidityPct ?? null,
      zone: cabin.zones.humidity,
      nextZone: later?.cabin.zones.humidity ?? null,
      why: explainHumidity(breakdown),
    },
  ];

  return (
    <>
      <section
        className={cn(
          "life-console",
          `console-${mode}`,
          revealing && "is-revealing",
          briefingPhase === "open" && "briefing-hidden",
        )}
        aria-label={copy.objective.title}
        inert={briefingPhase !== "gone"}
        aria-hidden={briefingPhase !== "gone" || undefined}
      >
        <SpaceWeatherTicker mission="m1" mode={mode} />
        <div className="console-top">
          <div className="top-objective">
            <ObjectiveStrip
              done={objective.done}
              total={objective.total}
              stable={objective.stable}
              required={objective.required}
            />
          </div>
          <div className="top-guide">
            <MissionGuide message={guide} />
          </div>
          <div className="top-habitat">
            <HabitatDiagram
              state={{
                co2Zone: cabin.zones.co2,
                stable: allReadingsSafe(sim),
                scrubbers: controls.airFiltration,
                batteryPct: power.batteryPct,
                netKw: power.netKw,
                tankPct: (water.reserveLiters / water.maxLiters) * 100,
              }}
            />
          </div>
          <div className="top-badges">
            <BadgeRow history={sim.meta.act1History} />
          </div>
        </div>

        <div className="console-channels">
          {channels.map((ch) => {
            const info = copy.channels[ch.key];
            return (
              <section
                className="channel"
                style={{ "--ch": `var(--ch-${ch.key})` } as CSSProperties}
                key={ch.key}
                aria-label={info.name}
              >
                <h2 className="channel-title">
                  {info.name}
                  <ScienceTerm term={ch.term} label={info.gauge} mode={mode} />
                </h2>
                <Gauge
                  kind={ch.kind}
                  label={info.gauge}
                  unit={info.unit}
                  mode={mode}
                  nasa={ch.nasa}
                  now={ch.now}
                  later={ch.next}
                  zone={ch.zone}
                  laterZone={ch.nextZone}
                />
                {mode === "explorer" && <p className="why">{ch.why}</p>}
                <Lever
                  channel={ch.key}
                  name={info.lever}
                  value={ch.value}
                  mode={mode}
                  lowEnd={info.lowEnd}
                  highEnd={info.highEnd}
                  science={ch.leverTerm}
                  onChange={ch.set}
                />
              </section>
            );
          })}
        </div>

        <div className="console-lower">
          <PowerLedger
            mode={mode}
            power={breakdown.power}
            battery={{
              pct: power.batteryPct,
              waterL: water.reserveLiters,
              waterMaxL: water.maxLiters,
              waterDelta: breakdown.water.deltaPerStepLiters,
            }}
          />
          <aside className="forecast" aria-label={copy.forecast.title}>
            <h2 className="panel-title">{copy.forecast.title}</h2>
            {warnings.length > 0 ? (
              <ul className="warnings" role="status">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p className="forecast-ok" role="status">
                {
                  (allReadingsSafe(sim)
                    ? copy.forecast.ok
                    : copy.forecast.recovering)[mode]
                }
              </p>
            )}
            <div className="advance-dock">
              <span className="dock-step">
                {copy.objective.step(
                  Math.min(objective.done + 1, objective.total),
                  objective.total,
                )}
              </span>
              <Button
                className="mission-cta advance"
                onClick={advance}
                disabled={advancing}
              >
                {copy.advance.label}
                <ArrowRight size={20} />
              </Button>
            </div>
            <p className="sim-hint">{copy.advance.sub}</p>
          </aside>
        </div>

        {recap && (
          <div className="console-result">
            <StepResult
              mode={mode}
              rows={changeRows(summarizeStep(recap.before, recap.after))}
              verdict={interpretStep(recap.before, recap.after)}
              open={resultOpen}
              onOpenChange={setResultOpen}
            />
          </div>
        )}

        {advancing && (
          <div className="later-banner" aria-hidden="true">
            <span>{copy.advance.later}</span>
          </div>
        )}
        <p className="sim-source">{copy.source}</p>
      </section>
      {briefingPhase !== "gone" && (
        <LifeSupportBriefing
          onLeaveStart={startLeaving}
          onFinish={endBriefing}
          onBack={() => setScene("map")}
        />
      )}
    </>
  );
}
