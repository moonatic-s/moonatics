import { ArrowRight, Pause, Play, StepForward } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { content } from "@/game/content";
import { MISSION_FAILURE_LIMITS, type PowerSystem } from "@/game/engine";
import { plantView } from "@/game/greenhouse/model";
import {
  PEAK_INDEX,
  SYSTEM_CAP,
  graphPoints,
  particleLevel,
  passingStreaks,
  powerView,
  radiationWord,
  scoreWord,
  stormStatus,
} from "@/game/storm/model";
import { useGame, type AgeMode } from "@/game/state";
import { cn } from "@/lib/utils";
import { Avatar, Comms, type Mood } from "./cast";
import { EfficiencyLine } from "./crew-log";
import { GamePlant } from "./gh-plant";
import { ShelterCutaway } from "./storm-art";
import { ambient } from "@/game/audio/ambient";
import { Source, useStormVoice } from "./storm-views";

const g = content.storm.game;
const NAMES: Record<PowerSystem, string> = { shelterKw: g.route.shelter, cabinKw: g.route.life, greenhouseKw: g.route.greenhouse };
const SHORT: Record<PowerSystem, string> = { shelterKw: g.storm.areas.shelter, cabinKw: g.storm.areas.life, greenhouseKw: g.storm.areas.greenhouse };
const STEP_MS = 650;

function Graph({ index }: { index: number }) {
  const pts = graphPoints(index);
  const path = pts.map((p) => `${(p.x * 196 + 2).toFixed(1)},${(56 - p.y * 50).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg className="sg-graph" viewBox="0 0 200 60" role="img" aria-label={`${g.nasaObserved}: ${g.storm.outside}`}>
      <line x1="2" y1="56" x2="198" y2="56" className="sg-graph-axis" />
      {pts.length > 1 && <polyline points={path} className="sg-graph-line" fill="none" />}
      {last && <circle cx={last.x * 196 + 2} cy={56 - last.y * 50} r="3.4" className="sg-graph-dot" />}
    </svg>
  );
}

/** One emergency reroute, with its cost shown before it is confirmed. */
function Reroute({ onClose }: { onClose: () => void }) {
  const { sim, rerouteStorm } = useGame();
  const pv = powerView(sim);
  const [from, setFrom] = useState<PowerSystem | null>(null);
  const [to, setTo] = useState<PowerSystem | null>(null);
  const r = g.storm.reroute;
  const keys: PowerSystem[] = ["shelterKw", "cabinKw", "greenhouseKw"];
  return (
    <section className="sg-reroute" aria-label={r.title}>
      <h3>{r.title}</h3>
      <p className="sg-hint">{r.note}</p>
      <p className="sg-chiplabel">{r.from}</p>
      <div className="sg-chips" role="group" aria-label={r.from}>
        {keys.map((k) => (
          <button key={k} type="button" className="gg-act" aria-pressed={from === k} disabled={pv.alloc[k] < 1} onClick={() => { setFrom(k); if (to === k) setTo(null); }}>
            {SHORT[k]}
          </button>
        ))}
      </div>
      <p className="sg-chiplabel">{r.to}</p>
      <div className="sg-chips" role="group" aria-label={r.to}>
        {keys.map((k) => (
          <button key={k} type="button" className="gg-act" aria-pressed={to === k} disabled={from === k || pv.alloc[k] >= SYSTEM_CAP[k]} onClick={() => setTo(k)}>
            {SHORT[k]}
          </button>
        ))}
      </div>
      {from && to && <p className="sg-feedback" role="status">{r.weaken}</p>}
      <div className="gg-two">
        <Button variant="outline" onClick={onClose}>{r.cancel}</Button>
        <Button
          className="mission-cta"
          data-primary
          disabled={!from || !to}
          onClick={() => {
            if (from && to) rerouteStorm(from, to);
            onClose();
          }}
        >
          {r.confirm}
        </Button>
      </div>
    </section>
  );
}

/**
 * The storm: real CRaTER-D1D2 data is the outside radiation (NASA OBSERVED); the crew's exposure is derived from the
 * player's shelter (MOONATICS SIMULATED). Play, pause and step are all manual; nothing counts down.
 */
export function StormView({
  mode,
  onPassed,
  onRetry,
}: {
  mode: AgeMode;
  onPassed: () => void;
  onRetry: () => void;
}) {
  const { sim, stepSim } = useGame();
  const st = stormStatus(sim);
  const [playing, setPlaying] = useState(false);
  const [rerouting, setRerouting] = useState(false);
  const peakStopped = useRef(false);
  const failed = sim.meta.failed;
  const s = g.storm;
  const rerouteUsed = sim.controls.act3.reroute !== null;

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => stepSim(), STEP_MS);
    return () => window.clearInterval(t);
  }, [playing, stepSim]);
  // Playback stops by itself at the radiation peak (once), when the storm is over, or if the mission fails.
  useEffect(() => {
    if (!playing) return;
    if (st.complete || failed) setPlaying(false);
    else if (st.index >= PEAK_INDEX && !peakStopped.current) {
      peakStopped.current = true;
      setPlaying(false);
    }
  }, [playing, st.index, st.complete, failed]);

  const word = radiationWord(st.index);
  const level = particleLevel(st.index);
  const atPeak = st.index === PEAK_INDEX;
  const calm = st.index >= PEAK_INDEX - 1 && st.index <= PEAK_INDEX + 1;
  const streaks = Math.max(3, Math.round(3 + level * 9));
  const passing = Math.min(streaks, passingStreaks(st.attenuation, level));
  const exposure = Math.min(1, st.crewDoseUGy / MISSION_FAILURE_LIMITS.crewDoseUGy);
  const gh = sim.controls.act3.sepPowerAlloc.greenhouseKw;
  const deficit = Math.max(0, SYSTEM_CAP.greenhouseKw - gh);
  const base = plantView(sim, true);
  const view = {
    ...base,
    leaves: deficit === 0 ? ("upright" as const) : deficit === 1 ? ("curled" as const) : ("drooping" as const),
    flower: deficit === 0 ? ("open" as const) : deficit === 1 ? ("half" as const) : ("closed" as const),
  };
  const time = sim.subSystems.radiation.currentTimeUtc.slice(11, 16);
  // the crew visibly reacts: worried while exposure rises with thin shielding, relieved when the shelter holds
  const novaMood: Mood = st.complete || (st.holding && st.index >= PEAK_INDEX - 1) ? "happy" : !st.holding && (exposure > 0.35 || st.index >= PEAK_INDEX - 2) ? "worried" : "calm";
  // the music follows the storm: it builds with the radiation, holds steady at the peak and relaxes when it has passed
  useEffect(() => {
    ambient.setIntensity(st.complete ? 0 : atPeak ? 0.85 : level);
    return () => ambient.setIntensity(0);
  }, [st.complete, atPeak, level]);
  useStormVoice(atPeak ? [s.peak, s.peakNote] : st.complete ? [s.passed, s.passedMessage] : null, mode);

  if (failed)
    return (
      <div className="sg-storm">
        <section className="gg-card gg-alert" role="alert">
          <h3>{s.failed.title}</h3>
          <p className="gg-status">{sim.meta.failure?.lesson}</p>
          <Button className="mission-cta" onClick={onRetry}>{s.failed.retry}</Button>
        </section>
      </div>
    );

  return (
    <div className={cn("sg-storm", calm && "sg-calm", st.complete && "sg-passed")} style={{ ["--lvl" as string]: st.complete ? 0 : level }}>
      <div className="sg-stage">
        <ShelterCutaway
          slots={sim.controls.act3.shelter}
          passing={st.complete ? 0 : passing}
          streaks={st.complete ? 0 : streaks}
          calm={calm}
          label="The crew shelter during the storm. Particles that the shielding stops fade out before reaching the crew."
        />
        <div className="sg-crew" aria-live="polite">
          <Avatar who="nova" mood={novaMood} size={56} />
          <span>{novaMood === "happy" ? "Nova feels safe" : novaMood === "worried" ? "Nova is worried" : "Nova is waiting"}</span>
        </div>
        <div className="sg-controls">
          {!st.complete && (
            <>
              <Button className="mission-cta" data-primary onClick={() => setPlaying((p) => !p)}>
                {playing ? <Pause size={18} /> : <Play size={18} />}
                {playing ? s.pause : s.play}
              </Button>
              <Button variant="outline" onClick={() => stepSim()} disabled={playing}>
                <StepForward size={16} />
                {s.step}
              </Button>
              {!rerouteUsed && (
                <Button variant="outline" onClick={() => setRerouting((r) => !r)}>
                  {s.reroute.open}
                </Button>
              )}
              {rerouteUsed && <span className="sg-hint">{s.reroute.used}</span>}
            </>
          )}
        </div>
        {rerouting && !rerouteUsed && <Reroute onClose={() => setRerouting(false)} />}
        {!rerouteUsed && !rerouting && !st.complete && <p className="sg-hint">{s.reroute.title}</p>}
      </div>

      <div className="sg-panels">
        {atPeak && (
          <section className="gg-card sg-peak" role="status">
            <h3>{s.peak}</h3>
            <p className="gg-status">{s.peakNote}</p>
            <Comms who="nova" mood={st.holding ? "happy" : "worried"}>
              {st.holding ? "It is loud outside, but I feel safe in here." : "It is getting uncomfortable in here. More shielding would help."}
            </Comms>
          </section>
        )}
        {st.complete && (
          <section className="gg-card sg-passedcard" role="status">
            <h3>{s.passed}</h3>
            <p className="gg-status">{s.passedMessage}</p>
            <Button className="mission-cta" data-primary onClick={onPassed}>
              {s.debrief}
              <ArrowRight size={18} />
            </Button>
          </section>
        )}
        <section className="gg-card" aria-label={s.outside}>
          <Source nasa />
          <h3>{s.outside}</h3>
          <p className="sg-source-line">{s.outsideSource}</p>
          <p className="sg-big" aria-live="polite">
            {s.words[word]}
            {mode === "specialist" && (
              <small>
                {" "}{Math.round(st.outsideRate).toLocaleString()} {"µ"}Gy/h
              </small>
            )}
          </p>
          <Graph index={st.index} />
          {mode === "specialist" && <p className="gg-note">{sim.subSystems.radiation.currentTimeUtc.slice(0, 10)} {time} UTC</p>}
        </section>
        <section className="gg-card" aria-label={s.crew}>
          <Source nasa={false} />
          <h3>{s.crew}</h3>
          <div className="sg-bar" role="img" aria-label={s.crew}>
            <i style={{ width: `${Math.round(exposure * 100)}%` }} className={cn(exposure > 0.6 && "hot")} />
          </div>
          <p className="gg-status">
            <b>{st.holding ? s.shelterHolding : s.exposureRising}</b>
            {mode === "specialist" && <small> {Math.round(st.crewDoseUGy).toLocaleString()} {"µ"}Gy</small>}
          </p>
          <p className="gg-note">{s.crewSource}</p>
        </section>
        <div className="sg-areas">
          <section className="gg-card sg-area" aria-label={s.areas.shelter}>
            <h3>{s.areas.shelter}</h3>
            <p className="gg-status">{st.systemsPct >= 60 ? s.systemsOk : s.systemsLow}</p>
            {mode === "specialist" && <p className="gg-note">{st.systemsPct}%</p>}
          </section>
          <section className="gg-card sg-area" aria-label={s.areas.life}>
            <h3>{s.areas.life}</h3>
            <p className={cn("gg-status", st.co2Rising && "sg-warn")} role={st.co2Rising ? "status" : undefined}>
              {st.co2Rising ? s.co2 : s.lifeOk}
            </p>
            {mode === "specialist" && <p className="gg-note">{Math.round(st.co2Ppm).toLocaleString()} ppm</p>}
          </section>
          <section className="gg-card sg-area sg-plant" aria-label={s.areas.greenhouse}>
            <h3>{s.areas.greenhouse}</h3>
            <GamePlant view={view} dim={st.growLight} />
            <p className={cn("gg-status", st.greenhousePowerLow && "sg-warn")}>
              {st.greenhousePowerLow ? s.greenhouseLow : s.greenhouseOk}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- debrief --------------------------------- */

export function DebriefView({
  mode,
  plan,
  onAgain,
  onBack,
}: {
  mode: AgeMode;
  plan: { shelterKw: number; cabinKw: number; greenhouseKw: number } | null;
  onAgain: () => void;
  onBack: () => void;
}) {
  const { sim, noteDetailsViewed, setScene } = useGame();
  const st = stormStatus(sim);
  const d = g.debrief;
  const rad = sim.subSystems.radiation;
  const rise = st.co2Ppm - sim.carryOver.endCo2Ppm;
  const life = rise < 300 ? d.lifeWords.stable : rise < 1500 ? d.lifeWords.watch : d.lifeWords.high;
  const ripe = sim.carryOver.harvestRipeFruits;
  const food = ripe >= 4 ? d.foodWords.good : ripe >= 2 ? d.foodWords.fair : d.foodWords.low;
  const crop = d.cropWords[scoreWord(st.foodScore)];
  const reroute = sim.controls.act3.reroute;
  const protectPct = Math.round(st.attenuation * 100);
  const blocks = (n: number, cap: number) => (mode === "specialist" ? g.route.kw(n, cap) : `${n}`);
  const [details, setDetails] = useState(false);
  const five = content.storm.briefing.five;
  const protectWord = protectPct >= 75 ? "Strong" : protectPct >= 55 ? "Good" : "Thin";
  const tiles = [
    { key: "crew", title: d.crew, word: protectWord, note: mode === "specialist" ? `${protectPct}%` : d.shelterProtection },
    { key: "outpost", title: d.outpost, word: life, note: mode === "specialist" ? `${d.power} ${Math.round(st.batteryPct)}%` : d.lifeSupport },
    { key: "greenhouse", title: d.greenhouse, word: crop, note: d.crop },
  ];
  return (
    <div className="sg-debrief">
      <h2 className="sg-title">{d.complete}</h2>
      <Comms who="luna" mood="happy">{g.storm.passedMessage}</Comms>
      <div className="sg-tiles">
        {tiles.map((t) => (
          <section key={t.key} className="gg-card sg-tile" aria-label={t.title}>
            <h3>{t.title}</h3>
            <p className="sg-big">{t.word}</p>
            <p className="gg-note">{t.note}</p>
          </section>
        ))}
      </div>
      <div className="sg-compare sg-compare-short">
        <div className="sg-compare-nasa">
          <Source nasa />
          <p>{five.nasaText[mode]}</p>
        </div>
        <div className="sg-compare-sim">
          <Source nasa={false} />
          <p>{five.simText[mode]}</p>
        </div>
      </div>
      <EfficiencyLine mission="m3" />
      <p className="gg-lesson">{d.lesson}</p>
      <div className="sg-debrief-actions">
        <Button className="mission-cta" data-primary onClick={() => setScene("complete")}>
          FINISH TRAINING
          <ArrowRight size={18} />
        </Button>
        <Button variant="outline" onClick={onBack}>{d.back}</Button>
        <Button variant="outline" onClick={onAgain}>{d.again}</Button>
        <Button variant="ghost" aria-expanded={details} onClick={() => {
            setDetails((v) => !v);
            noteDetailsViewed();
          }}>
          {details ? d.hideDetails : d.details}
        </Button>
      </div>
      {details && (
        <div className="sg-details">
          <div className="sg-debrief-grid">
            <section className="gg-card" aria-label={d.crew}>
              <h3>{d.crew}</h3>
              <dl className="gg-report">
                <dt>{d.shelterProtection}</dt>
                <dd>{mode === "specialist" ? `${protectPct}%` : protectWord}</dd>
                <dt>{d.exposure}</dt>
                <dd>{mode === "specialist" ? `${Math.round(rad.cumulativeCrewDoseUGy).toLocaleString()} µGy` : st.crewDoseUGy / MISSION_FAILURE_LIMITS.crewDoseUGy < 0.5 ? "Low" : "Medium"}</dd>
              </dl>
              <Source nasa={false} />
            </section>
            <section className="gg-card" aria-label={d.outpost}>
              <h3>{d.outpost}</h3>
              <dl className="gg-report">
                <dt>{d.lifeSupport}</dt>
                <dd>{life}</dd>
                <dt>{d.power}</dt>
                <dd>{Math.round(st.batteryPct)}%</dd>
              </dl>
              <Source nasa={false} />
            </section>
            <section className="gg-card" aria-label={d.greenhouse}>
              <h3>{d.greenhouse}</h3>
              <dl className="gg-report">
                <dt>{d.crop}</dt>
                <dd>{crop}</dd>
                <dt>{d.food}</dt>
                <dd>{food}</dd>
              </dl>
              <Source nasa={false} />
            </section>
          </div>
          <section className="gg-card" aria-label={d.choices}>
            <h3>{d.choices}</h3>
            <dl className="gg-report">
              <dt>{d.shelterConfig}</dt>
              <dd>{`${st.shelterCounts.water} water · ${st.shelterCounts.supply} supply · ${st.shelterCounts.equipment} equipment`}</dd>
              <dt>{d.arrays}</dt>
              <dd>{st.arraysProtected ? d.protectedArrays : d.keptDeployed}</dd>
              <dt>{d.plan}</dt>
              <dd>{plan ? `${blocks(plan.shelterKw, SYSTEM_CAP.shelterKw)} / ${blocks(plan.cabinKw, SYSTEM_CAP.cabinKw)} / ${blocks(plan.greenhouseKw, SYSTEM_CAP.greenhouseKw)}` : "—"}</dd>
              <dt>{d.reroute}</dt>
              <dd>{reroute ? `${SHORT[reroute.from]} → ${SHORT[reroute.to]}` : d.noReroute}</dd>
            </dl>
          </section>
          <div className="sg-compare">
            <section className="gg-card sg-compare-nasa" aria-label={d.nasaCard}>
              <Source nasa />
              <ul>{d.nasa.map((x) => <li key={x}>{x}</li>)}</ul>
            </section>
            <section className="gg-card sg-compare-sim" aria-label={d.simCard}>
              <Source nasa={false} />
              <ul>{d.sim.map((x) => <li key={x}>{x}</li>)}</ul>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
