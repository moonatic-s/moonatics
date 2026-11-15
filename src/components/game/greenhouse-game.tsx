import { ArrowRight, Droplets, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { content } from "@/game/content";
import {
  MILESTONE_DAYS,
  healthWord,
  nextRung,
  plantView,
  previewWater,
  rootChange,
  rootCheck,
  setWaterRungSim,
  stressWord,
  type PlantView,
  type WaterAction,
} from "@/game/greenhouse/model";
import { captureFoodCarryOver } from "@/game/engine";
import { useGame, type AgeMode } from "@/game/state";
import { cn } from "@/lib/utils";
import { Comms, SpaceWeatherTicker } from "./cast";
import { EfficiencyLine } from "./crew-log";
import { Ledger } from "./ledger";
import { GamePlant, type Spot } from "./gh-plant";
import { MissionWrapUp } from "./wrapup";
import { FactsCard, InspectPanel, LightSwitch, StageStrip, WaterPanel } from "./gh-panels";
import { GreenhouseSetup } from "./gh-setup";

const t = content.greenhouse.game;
type Phase = "setup" | "grow" | "harvest" | "report";
type Alert =
  | { kind: "dryAir"; acted: boolean }
  | { kind: "rootOk" }
  | { kind: "rootCheck"; step: "look" | "decide" | "done"; problem: "buildup" | "dry" }
  | null;

function statusText(view: PlantView, mode: AgeMode): string {
  if (view.root === "dry") return t.inspect.status.dry;
  if (view.root === "buildup") return t.inspect.status.wet;
  return view.stress === "healthy" ? t.inspect.status.healthy : t.inspect.leaves[view.leaves][mode];
}

/** A harvested tomato flies in an arc to the harvest container, then the container sparkles. */
function flyTomato(from: HTMLElement, to: HTMLElement | null, landed: () => void): void {
  if (!to || typeof from.animate !== "function") {
    landed();
    return;
  }
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const dot = document.createElement("span");
  dot.className = "gg-fly";
  dot.style.left = `${a.left + a.width / 2 - 11}px`;
  dot.style.top = `${a.top + a.height / 2 - 11}px`;
  document.body.appendChild(dot);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const move = dot.animate(
    [
      { transform: "translate(0, 0) scale(1)", offset: 0 },
      { transform: `translate(${dx * 0.5}px, ${Math.min(dy, 0) - 70}px) scale(1.25)`, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.8)`, offset: 1 },
    ],
    { duration: 750, easing: "ease-in-out" },
  );
  move.onfinish = () => {
    dot.remove();
    landed();
  };
}

/**
 * Mission 2: care for one tomato plant. INSPECT -> DECIDE -> WATCH THE PLANT RESPOND -> ADVANCE GROWTH.
 * All decisions are discrete and manual (no sliders, no timers) and run on the same engine as the rest of the game.
 */
export function GreenhouseGame({ replay }: { replay?: ReactNode } = {}) {
  const { sim, recap, ageMode, beginGreenhouse, setWaterRung, setLightRecipe, advanceGreenhouse, completeMission, recordResult, recordFacts, story, setScene } = useGame();
  const mode: AgeMode = ageMode ?? "explorer";
  const [phase, setPhase] = useState<Phase>("setup");
  const [ripened, setRipened] = useState(false);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [chosen, setChosen] = useState<WaterAction | null>(null);
  const [feedback, setFeedback] = useState("");
  const [alert, setAlert] = useState<Alert>(null);
  const [lightChanged, setLightChanged] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set());
  const [plus, setPlus] = useState(0);
  const [wrapOpen, setWrapOpen] = useState(false);
  const dryAirHandled = useRef(false);
  // time-lapse after each checkpoint: the plant grows quickly while the day counter runs
  const [lapse, setLapse] = useState<{ from: number; to: number } | null>(null);
  const [day, setDay] = useState(0);
  useEffect(() => {
    if (!lapse) return;
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDay(lapse.to);
      const t = window.setTimeout(() => setLapse(null), 400);
      return () => window.clearTimeout(t);
    }
    const started = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - started) / 1800);
      setDay(Math.round(lapse.from + (lapse.to - lapse.from) * k));
      if (k < 1) raf = requestAnimationFrame(tick);
      else window.setTimeout(() => setLapse(null), 500);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lapse]);
  const basket = useRef<HTMLDivElement>(null);
  const [sparkle, setSparkle] = useState(0);

  // Opening the mission starts the greenhouse on the shared engine.
  useEffect(() => beginGreenhouse(), [beginGreenhouse]);

  const idx = sim.subSystems.greenhouse.milestoneIndex;
  const ready = sim.meta.currentAct === 2;
  // New checkpoint: the plant meets its next event (dry air at Early Growth, a root check at Mid Growth).
  useEffect(() => {
    if (phase !== "grow") return;
    setChosen(null);
    setFeedback("");
    setSpot(null);
    if (idx === 1) setAlert({ kind: "dryAir", acted: false });
    else if (idx === 2) {
      const k = rootCheck(plantView(sim));
      setAlert(k === "ok" ? { kind: "rootOk" } : { kind: "rootCheck", step: "look", problem: k });
    } else setAlert(null);
    // sim is read once per checkpoint on purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, phase]);

  const restart = useCallback(() => {
    beginGreenhouse();
    setPhase("setup");
    setRipened(false);
    setSpot(null);
    setChosen(null);
    setFeedback("");
    setAlert(null);
    setLightChanged(false);
    setPicked(new Set());
    setPlus(0);
  }, [beginGreenhouse]);

  if (!ready) return null;
  const view = plantView(sim, ripened);

  const choose = (action: WaterAction) => {
    const rung = nextRung(view.rung, action);
    const after = plantView(setWaterRungSim(sim, rung), ripened);
    const change = rootChange(view, after);
    const w = t.water;
    setFeedback(
      action === "hold" && change === "same"
        ? w.kept
        : change === "better"
          ? w.better[mode]
          : change === "worse"
            ? (action === "add" ? w.wetter : w.drier)[mode]
            : w.same[mode],
    );
    setWaterRung(rung);
    setChosen(action);
    if (alert?.kind === "dryAir") dryAirHandled.current = true;
    setAlert((a) => (a?.kind === "dryAir" ? { ...a, acted: true } : a?.kind === "rootCheck" ? { ...a, step: "done" } : a));
  };

  const onSpot = (s: Spot) => {
    setSpot((cur) => (cur === s ? null : s));
    setAlert((a) => (a?.kind === "rootCheck" && a.step === "look" && s === "roots" ? { ...a, step: "decide" } : a));
  };

  const blocked = (alert?.kind === "dryAir" && !alert.acted) || (alert?.kind === "rootCheck" && alert.step !== "done");
  const next = idx < 4 ? () => { setLapse({ from: MILESTONE_DAYS[idx] ?? 1, to: MILESTONE_DAYS[idx + 1] ?? 100 }); advanceGreenhouse(); } : () => { setRipened(true); setPhase("harvest"); setSpot(null); };
  const dPower = recap ? Math.round(recap.after.subSystems.power.batteryPct - recap.before.subSystems.power.batteryPct) : null;
  const dWater = recap ? Math.round((recap.after.subSystems.water.reserveLiters - recap.before.subSystems.water.reserveLiters) * 10) / 10 : null;
  const nextName = t.stage[idx >= 4 ? "harvest" : (["early", "mid", "flowering", "fruit"] as const)[idx] ?? "early"];

  const chips = (
    <div className="gg-chips" aria-label="Resources">
      <span className="gg-chip">
        <Zap size={14} aria-hidden="true" />
        {t.resources.power} {Math.round(view.batteryPct)}%
        {dPower !== null && phase === "grow" && idx > 0 && <small>{t.resources.powerNote(dPower)}</small>}
      </span>
      <span className="gg-chip">
        <Droplets size={14} aria-hidden="true" />
        {t.resources.water} {mode === "specialist" ? `${view.waterLiters.toFixed(1)} L` : `${Math.round((view.waterLiters / view.waterMaxLiters) * 100)}%`}
        {dWater !== null && phase === "grow" && idx > 0 && mode === "specialist" && <small>{t.resources.waterNote(dWater)}</small>}
      </span>
    </div>
  );

  if (sim.meta.failed && sim.meta.failure)
    return (
      <div className={cn("gg", `gg-${mode}`)} aria-label={t.aria}>
        <section className="gg-card gg-alert" role="alert">
          <h3>{t.failed.title}</h3>
          <p className="gg-status">{sim.meta.failure.lesson}</p>
          <Button className="mission-cta" onClick={restart}>{t.failed.retry}</Button>
        </section>
      </div>
    );

  if (phase === "setup")
    return (
      <div className={cn("gg", `gg-${mode}`)} aria-label={t.aria}>
        <div style={{ gridColumn: "1 / -1" }}>
          <SpaceWeatherTicker mission="m2" mode={mode} />
        </div>
        <div className="gg-top">{chips}{replay}</div>
        <div style={{ gridColumn: "1 / -1" }}>
          <GreenhouseSetup view={view} mode={mode} onStart={() => setPhase("grow")} />
        </div>
      </div>
    );

  const title = content.greenhouse.briefing.one.title;

  if (phase === "report")
    return (
      <div className={cn("gg", `gg-${mode}`)} aria-label={t.aria}>
        <div className="gg-top">
          <h2 className="gg-title">{t.report.title}</h2>
          {replay}
        </div>
        {wrapOpen && <MissionWrapUp mission="m2" onClose={() => setWrapOpen(false)} />}
        <div className="gg-plant">
          <GamePlant view={view} picked={picked} />
        </div>
        <div className="gg-side">
          <section className="gg-card" aria-label={t.report.title}>
            <dl className="gg-report">
              <dt>{t.report.crop}</dt>
              <dd>{healthWord(view.cropHealthPct)}{mode === "specialist" ? ` (${Math.round(view.cropHealthPct)}%)` : ""}</dd>
              <dt>{t.report.water}</dt>
              <dd>{view.waterLiters.toFixed(1)} L</dd>
              <dt>{t.report.light}</dt>
              <dd>{view.light === "red" ? t.light.red : t.light.blue}</dd>
              <dt>{t.report.stress}</dt>
              <dd>{stressWord(view.stress)}</dd>
              <dt>{t.report.tomatoes}</dt>
              <dd>{picked.size}</dd>
            </dl>
            <EfficiencyLine mission="m2" />
            <p className="gg-lesson">{t.report.lesson}</p>
          </section>
          <section className="gg-card" aria-label={t.report.nasaTitle}>
            <h3>{t.report.nasaTitle}</h3>
            <p className="gg-note">{t.report.nasa}</p>
          </section>
          <div className="gg-two">
            <Button variant="outline" onClick={restart}>{t.report.replay}</Button>
            <Button className="mission-cta" onClick={() => setScene("map")}>
              {t.report.back}
              <ArrowRight size={18} />
            </Button>
          </div>
        </div>
      </div>
    );

  const harvesting = phase === "harvest";
  const total = Math.min(view.ripeCount, 6);
  const rc = alert?.kind === "rootCheck" ? alert : null;
  return (
    <div className={cn("gg", `gg-${mode}`)} aria-label={t.aria}>
      <div style={{ gridColumn: "1 / -1" }}>
        <SpaceWeatherTicker mission="m2" mode={mode} />
      </div>
      <div className="gg-top">
        <h2 className="gg-title">{harvesting ? t.harvest.title : title}</h2>
        <StageStrip stage={view.stage} />
        {replay}
      </div>

      <div className="gg-plant">
        {lapse && <p className="gg-day" role="status">DAY {day}</p>}
        <GamePlant
          view={view}
          spots={!harvesting}
          active={spot}
          pulse={rc?.step === "look" ? "roots" : null}
          onSpot={onSpot}
          picked={picked}
          lapse={lapse !== null}
          onPick={harvesting ? (i, el) => { flyTomato(el, basket.current, () => setSparkle((n) => n + 1)); setPicked((p) => new Set(p).add(i)); setPlus((n) => n + 1); } : undefined}
          pickLabel={t.harvest.pick}
        />
        {!harvesting && (
          <div style={{ width: "100%", maxWidth: 440 }}>
            <LightSwitch
              blue={view.light === "blue"}
              note={lightChanged && idx >= 1}
              onToggle={() => {
                setLightRecipe(view.light === "red" ? "blue_rich" : "red_rich");
                if (idx >= 1) setLightChanged(true);
              }}
            />
          </div>
        )}
      </div>

      <div className="gg-side">
        {harvesting ? (
          <>
            <section className="gg-card" aria-label={t.harvest.title}>
              <p className="gg-status">{total === 0 ? t.harvest.none : t.harvest.hint[mode]}</p>
              <h3>{t.harvest.container}</h3>
              <div className={cn("gg-basket", sparkle > 0 && "gg-sparkle")} key={`b${sparkle}`} ref={basket} aria-live="polite">
                {Array.from(picked).map((i) => <span key={i} className="gg-basket-tomato" />)}
                {plus > 0 && <span key={plus} className="gg-plus">{t.harvest.plus}</span>}
              </div>
              {total === 0 && <p className="gg-lesson">{t.report.lesson}</p>}
              <Comms who="nova" mood={total === 0 ? "worried" : "happy"}>{total === 0 ? "No tomatoes this time. Next time we will water more carefully." : "Fresh tomatoes! Thank you for taking such good care of them."}</Comms>
            </section>
            {chips}
            {picked.size >= total && (
              <Button className="mission-cta gg-advance" data-primary onClick={() => {
                  completeMission(1);
                  recordResult(2, captureFoodCarryOver(sim));
                  recordFacts({
                    m2: {
                      waterLeftPct: Math.round((view.waterLiters / view.waterMaxLiters) * 100),
                      waterLiters: view.waterLiters,
                      cropHealthPct: Math.round(view.cropHealthPct),
                      ripe: picked.size,
                      respondedDryAir: dryAirHandled.current,
                      rootOk: view.root === "balanced",
                      light: view.light,
                    },
                  });
                  setPhase("report");
                  if (story.run.answered.m2 === undefined) window.setTimeout(() => setWrapOpen(true), 1200);
                }}>
                {t.harvest.finish}
                <ArrowRight size={18} />
              </Button>
            )}
          </>
        ) : (
          <>
            {/* One slot: the inspect panel takes the place of the status card, so the page never grows. */}
            {!spot && (
              <section className="gg-card" aria-label="Plant status">
                <p className="gg-status" aria-live="polite">{statusText(view, mode)}</p>
                <p className="gg-hint">{t.hotspot.hint}</p>
              </section>
            )}

            {alert?.kind === "dryAir" && (
              <section className="gg-card gg-alert" role="alert">
                <h3>{t.events.dryAir.title}</h3>
                <p className="gg-status">{t.events.dryAir.text}</p>
              </section>
            )}
            {alert?.kind === "rootOk" && (
              <section className="gg-card" role="status">
                <h3>{t.events.rootCheck.title}</h3>
                <p className="gg-status">{t.events.airBack} {t.events.rootCheck.ok}</p>
              </section>
            )}
            {rc && rc.step === "look" && (
              <section className="gg-card gg-alert" role="alert">
                <h3>{t.events.rootCheck.title}</h3>
                <p className="gg-status">{t.events.rootCheck.prompt}</p>
              </section>
            )}
            {rc && rc.step === "decide" && (
              <section className="gg-card gg-alert" role="alert">
                <h3>{t.events[rc.problem].title}</h3>
                <p className="gg-status">{t.events[rc.problem].text}</p>
                <div className="gg-two">
                  <button type="button" className="gg-act" onClick={() => choose(rc.problem === "buildup" ? "reduce" : "add")}>
                    {t.events[rc.problem].act}
                  </button>
                  <button type="button" className="gg-act" onClick={() => choose("hold")}>
                    {t.events[rc.problem].keep}
                  </button>
                </div>
              </section>
            )}

            {spot && <InspectPanel spot={spot} view={view} mode={mode} onClose={() => setSpot(null)} />}

            {!(rc && rc.step !== "done") && (
              <WaterPanel view={view} chosen={chosen} feedback={feedback} mode={mode} onChoose={choose} preview={{ add: previewWater(sim, "add"), hold: previewWater(sim, "hold"), reduce: previewWater(sim, "reduce") }} />
            )}
            {mode === "specialist" && <FactsCard view={view} />}
            <Ledger mission="m2" mode={mode} />
            {chips}

            <Button className="mission-cta gg-advance" data-primary disabled={blocked} onClick={next}>
              {idx >= 4 ? t.advance.ripen : t.advance.next}
              <ArrowRight size={18} />
            </Button>
            <p className="gg-hint">{blocked ? t.advance.blocked : idx >= 4 ? t.stage.harvest : t.advance.toNext(nextName)}</p>
          </>
        )}
      </div>
    </div>
  );
}
