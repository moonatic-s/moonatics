import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Battery,
  Droplets,
  Lock,
  RotateCcw,
  Thermometer,
  Wind,
  Zap,
} from "lucide-react";
import { useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { content } from "@/game/content";
import type { BriefingData } from "@/game/life-support/briefing-data";
import { fmt } from "@/game/life-support/format";
import type { AgeMode } from "@/game/state";
import { cn } from "@/lib/utils";
import {
  BriefingHabitat,
  Co2Demo,
  HumidityDemo,
  TempDemo,
} from "./briefing-art";
import { MissionGuide } from "./mission-header";
import { useStages } from "./use-briefing-motion";

const copy = content.lifeConsole.briefing.scenes;

const guide = (text: string) => (
  <MissionGuide message={{ key: "welcome", text, tone: "calm" }} />
);

/** A small "tap to replay" affordance shared by the animated scenes. */
function Replay({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="briefing-replay"
      onClick={onClick}
    >
      <RotateCcw size={14} />
      {content.lifeConsole.briefing.replay}
    </Button>
  );
}

/* ---------------------------- Scene 1 ---------------------------- */

export function SceneOne({ mode }: { mode: AgeMode }) {
  const c = copy.one;
  const [replay, setReplay] = useState(0);
  const sensors = c.sensors[mode];
  return (
    <div className="scene scene-one">
      <div className="scene-text">
        <h2 className="scene-title">{c.title}</h2>
        <p className="scene-lead">{c.welcome}</p>
        <p className="scene-body">
          {mode === "explorer" ? c.sealedExplorer : c.sealed}
        </p>
        <ul className="scene-groups" aria-label="What the habitat watches">
          <li className="group-air" style={{ "--d": "1.5s" } as CSSProperties}>
            <Wind size={16} /> {c.groups.air}
          </li>
          <li className="group-heat" style={{ "--d": "1.9s" } as CSSProperties}>
            <Thermometer size={16} /> {c.groups.temperature}
          </li>
          <li
            className="group-water"
            style={{ "--d": "2.3s" } as CSSProperties}
          >
            <Droplets size={16} /> {c.groups.humidity}
          </li>
        </ul>
        {guide(c.guide)}
      </div>
      <div className="scene-art">
        <BriefingHabitat
          key={replay}
          labels={{
            ...sensors,
            cabin: c.parts.cabin,
            vent: c.parts.vent,
            water: c.parts.water,
            solar: c.parts.solar,
          }}
        />
        <Replay onClick={() => setReplay((n) => n + 1)} />
      </div>
    </div>
  );
}

/* ---------------------------- Scene 2 ---------------------------- */

export function SceneTwo({
  mode,
  line,
}: {
  mode: AgeMode;
  /** Index of the narration line being spoken (line 0 is the intro; lines 1-3 are the three concepts). */
  line: number | null;
}) {
  const c = copy.two;
  const explorer = mode === "explorer";
  const [keys, setKeys] = useState([0, 0, 0]);
  const [tapped, setTapped] = useState<number | null>(null);
  // With nobody speaking, Explorer still moves through the concepts slowly, one at a time.
  const auto = useStages(explorer ? [6000, 6000] : [], 0);
  const spoken = line !== null && line >= 1 ? Math.min(2, line - 1) : null;
  const focus = explorer ? (tapped ?? spoken ?? auto) : null;
  const replay = (i: number) =>
    setKeys((k) => k.map((v, j) => (j === i ? v + 1 : v)));
  const cards = [
    {
      id: "co2",
      cls: "concept-air",
      data: c.co2,
      demo: <Co2Demo key={keys[0]} state={c.states.co2} />,
    },
    {
      id: "temperature",
      cls: "concept-heat",
      data: c.temperature,
      demo: <TempDemo key={keys[1]} state={c.states.temperature} />,
    },
    {
      id: "humidity",
      cls: "concept-water",
      data: c.humidity,
      demo: <HumidityDemo key={keys[2]} state={c.states.humidity} />,
    },
  ];
  return (
    <div className="scene scene-two">
      <h2 className="scene-title">{c.title}</h2>
      <div className="concept-row">
        {cards.map((card, i) => (
          <button
            type="button"
            className={cn(
              "concept-card",
              card.cls,
              explorer && (focus === i ? "concept-focus" : "concept-still"),
            )}
            key={card.id}
            onClick={() => {
              if (explorer) setTapped(i);
              replay(i);
            }}
            aria-label={`${card.data.title}. ${content.lifeConsole.briefing.replay}`}
          >
            {card.demo}
            <h3>{card.data.title}</h3>
            <p>{card.data[mode]}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------- Scene 3 ---------------------------- */

const SYSTEMS = [
  { id: "air", icon: Wind, cls: "sys-air" },
  { id: "heat", icon: Thermometer, cls: "sys-heat" },
  { id: "water", icon: Droplets, cls: "sys-water" },
] as const;

/** Stage 0: idle. 1: levers slide to maximum. 2: everything improves. 3: the battery drops. 4: the lesson. */
const TRADEOFF_STAGES = [1000, 1100, 1000, 1200];

export function SceneThree({
  mode,
  data,
}: {
  mode: AgeMode;
  data: BriefingData;
}) {
  const c = copy.three;
  const [replay, setReplay] = useState(0);
  const stage = useStages(TRADEOFF_STAGES, replay);
  const battery = stage >= 3 ? data.batteryEnd : data.batteryStart;
  return (
    <div className="scene scene-three">
      <h2 className="scene-title">{c.title}</h2>
      <div className={cn("power-panel", stage >= 3 && "power-dropping")}>
        <Battery size={20} aria-hidden="true" />
        <span className="power-label">{c.battery}</span>
        <div
          className="power-track"
          role="img"
          aria-label={`${c.battery} ${Math.round(battery)} percent`}
        >
          <span className="power-fill" style={{ width: `${battery}%` }} />
        </div>
        {stage >= 3 && <b className="power-drop">{c.drop}</b>}
        <span className="power-sub">{c.maxCaption[mode]}</span>
      </div>
      <div className="system-row">
        {SYSTEMS.map(({ id, icon: Icon, cls }) => {
          const sys = c.systems[id];
          const chain = mode === "explorer" ? sys.chain.slice(0, 2) : sys.chain;
          return (
            <section
              className={cn("system-card", cls)}
              key={id}
              aria-label={sys.name}
            >
              <span className="energy-line" aria-hidden="true" />
              <h3>
                <Icon size={18} aria-hidden="true" /> {sys.name}
              </h3>
              <ol className="chain">
                {chain.map((step, i) => (
                  <li key={step.text}>
                    <span className="chain-chip">
                      {step.text}
                      {step.dir === "up" && (
                        <ArrowUp size={14} aria-label="goes up" />
                      )}
                      {step.dir === "down" && (
                        <ArrowDown size={14} aria-label="goes down" />
                      )}
                    </span>
                    {i < chain.length - 1 && (
                      <ArrowRight
                        className="chain-arrow"
                        size={14}
                        aria-hidden="true"
                      />
                    )}
                  </li>
                ))}
              </ol>
              <div
                className={cn("mini-lever", stage >= 1 && "mini-lever-max")}
                aria-hidden="true"
              >
                <span className="mini-track" />
                <span className="mini-thumb" />
              </div>
              {mode === "specialist" && (
                <p className={cn("benefit", stage >= 2 && "benefit-on")}>
                  {c.benefits[id]}
                </p>
              )}
              {mode === "specialist" && id === "water" && (
                <p className="system-note">{c.waterNote}</p>
              )}
            </section>
          );
        })}
      </div>
      {mode === "specialist" && <p className="scene-note">{c.unitsNote}</p>}
      {mode === "explorer" && (
        <p className="power-note">
          <Zap size={18} aria-hidden="true" /> {c.explorerNote}
        </p>
      )}
      <div
        className={cn("lesson", stage >= 4 && "lesson-on")}
        aria-live="polite"
      >
        <p className="lesson-big">{c.noPerfect}</p>
        <p className="lesson-small">{c.balance}</p>
      </div>
      <div className="scene-foot">
        {guide(c.guide)}
        <Replay onClick={() => setReplay((n) => n + 1)} />
      </div>
    </div>
  );
}

/* ---------------------------- Scene 4 ---------------------------- */

/** Stage 0: both match. 1: the scrubber lever moves. 2: only the simulated value changes. 3: the flow lights up. */
const SPLIT_STAGES = [1000, 1100, 900];

export function SceneFour({
  mode,
  data,
}: {
  mode: AgeMode;
  data: BriefingData;
}) {
  const c = copy.four;
  const [replay, setReplay] = useState(0);
  const stage = useStages(SPLIT_STAGES, replay);
  const habitat = stage >= 2 ? data.habitatCo2 : data.nasaCo2;
  const lever = stage >= 1 ? data.scrubbersTo : data.scrubbersFrom;
  return (
    <div className="scene scene-four">
      <h2 className="scene-title">{c.title}</h2>
      <div className={cn("split", mode === "explorer" && "split-simple")}>
        <section className="split-card split-nasa" aria-label={c.nasa}>
          <p className="split-tag">
            {c.nasa} <b className="value-badge badge-nasa">{c.nasaBadge}</b>
          </p>
          <p className="split-reading">{c.reading}</p>
          <p className="split-value">
            {fmt(data.nasaCo2, 0)} <small>ppm</small>
          </p>
          <p className="split-lock">
            <Lock size={13} aria-hidden="true" /> {c.nasaUnchanged}
          </p>
        </section>
        {mode === "specialist" && (
          <div className="split-middle" aria-hidden="true">
            <span className="split-lever-name">{c.control}</span>
            <span className="split-track">
              <span className="split-fill" style={{ width: `${lever}%` }} />
              <span className="split-thumb" style={{ left: `${lever}%` }} />
            </span>
            <ArrowRight size={18} />
          </div>
        )}
        <section
          className={cn(
            "split-card split-habitat",
            stage >= 2 && "split-changed",
          )}
          aria-label={c.habitat}
        >
          <p className="split-tag">
            {c.habitat}{" "}
            <b className="value-badge badge-sim">{c.habitatBadge}</b>
          </p>
          <p className="split-reading">{c.reading}</p>
          <p className="split-value" key={habitat}>
            {fmt(habitat, 0)} <small>ppm</small>
          </p>
        </section>
      </div>
      <p className="scene-body split-text">{c[mode]}</p>
      {mode === "specialist" && (
        <ol
          className={cn("flow", stage >= 3 && "flow-on")}
          aria-label="How the layers connect"
        >
          {c.flow.map((step, i) => (
            <li key={step} style={{ "--i": i } as CSSProperties}>
              <span className="flow-chip">{step}</span>
              {i < c.flow.length - 1 && (
                <ArrowRight size={16} aria-hidden="true" />
              )}
            </li>
          ))}
        </ol>
      )}
      <Replay onClick={() => setReplay((n) => n + 1)} />
    </div>
  );
}

/* ---------------------------- Scene 5 ---------------------------- */

export function SceneFive({
  mode,
  onBegin,
}: {
  mode: AgeMode;
  onBegin: () => void;
}) {
  const c = copy.five;
  const explorer = mode === "explorer";
  return (
    <div className="scene scene-five">
      <h2 className="scene-title">{c.title}</h2>
      <p className="scene-lead">{explorer ? c.mainExplorer : c.main}</p>
      <ol className="mission-steps">
        {(explorer ? c.stepsExplorer : c.steps).map((step, i) => (
          <li key={step.n} style={{ "--i": i } as CSSProperties}>
            <h3>{step.n}</h3>
            <p>{step.body}</p>
          </li>
        ))}
      </ol>
      {!explorer && (
        <ol className="loop" aria-label="The gameplay loop">
          {c.loop.map((step, i) => (
            <li key={step} style={{ "--i": i } as CSSProperties}>
              <span className="loop-chip">{step}</span>
              <ArrowRight size={15} aria-hidden="true" className="loop-arrow" />
            </li>
          ))}
          <li className="loop-back" aria-hidden="true">
            <RotateCcw size={16} />
          </li>
        </ol>
      )}
      <Button className="mission-cta begin-cta" data-primary onClick={onBegin}>
        {c.cta}
        <ArrowRight size={20} />
      </Button>
      <p className="scene-note">{c.footnote}</p>
      {guide(c.guide)}
    </div>
  );
}
