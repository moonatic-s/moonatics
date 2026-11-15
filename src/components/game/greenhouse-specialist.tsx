import { ArrowRight, Droplets, Info, RotateCcw, Sprout, Wind } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { content } from "@/game/content";
import { cn } from "@/lib/utils";
import { GreenhousePlant, type WaterState } from "./greenhouse-art";
import { useStages } from "./use-briefing-motion";

const b = content.greenhouse.briefing;
const s = b.specialist;

export type Say = (
  lines: readonly string[],
  onLine?: (index: number) => void,
) => void;

/** An optional extra. It is closed until the player asks, and never opens by itself. */
function LearnMore({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="ghs-more">
      <button
        type="button"
        className="ghs-more-button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <Info size={15} aria-hidden="true" />
        {open ? s.showLess : s.learnMore}
      </button>
      <p id={id} className="ghs-more-text" hidden={!open}>
        {text}
      </p>
    </div>
  );
}

/** The root zone under the plant. Water clings to the roots as droplets; how many depends on the water level. */
function RootZone({ water }: { water: WaterState }) {
  const drops = water === "dry" ? 2 : water === "wet" ? 9 : 5;
  const spots = [
    [30, 22], [52, 40], [74, 20], [96, 44], [118, 24],
    [140, 42], [162, 22], [184, 40], [206, 26],
  ] as const;
  return (
    <div className="ghs-root" data-water={water}>
      <svg viewBox="0 0 236 66" role="img" aria-label={s.one.rootZone}>
        <path className="ghs-root-line" d="M118 0 V18 M118 18 C90 24 60 30 36 52 M118 18 C146 24 176 30 200 52 M118 18 V58 M118 30 C100 40 90 50 84 62 M118 30 C136 40 146 50 152 62" />
        {spots.slice(0, drops).map(([x, y], i) => (
          <ellipse key={i} className="ghs-drop" cx={x} cy={y + 8} rx="4" ry="5.4" style={{ animationDelay: `${i * 90}ms` }} />
        ))}
      </svg>
      <span className="ghs-root-label">{s.one.rootZone}</span>
    </div>
  );
}

function Chamber({
  water,
  light,
  label,
  onReplay,
}: {
  water: WaterState;
  light: "plain" | "red" | "blue";
  label: string;
  onReplay?: (() => void) | undefined;
}) {
  return (
    <figure className="ghs-chamber">
      <figcaption className="ghs-chamber-label">{s.one.chamber}</figcaption>
      <GreenhousePlant water={water} light={light} label={label} />
      <RootZone water={water} />
      {onReplay && (
        <button type="button" className="ghs-tap-replay" onClick={onReplay}>
          <RotateCcw size={13} aria-hidden="true" />
          {b.tapReplay}
        </button>
      )}
    </figure>
  );
}

/* ---------- Screen 1: the chamber ---------- */

// Text appears at roughly the pace of the voice. The voice itself is queued once per screen, so no sentence cuts off another.
const ONE_STAGES = [900, 4200];

export function SpecialistOne({ say, onReplay }: { say: Say; onReplay: () => void }) {
  const stage = useStages(ONE_STAGES, 0);
  useEffect(
    () => say([...s.voice.one.chamber, ...s.voice.one.water, ...s.voice.one.info]),
    [say],
  );
  return (
    <div className="scene gh-scene ghs-scene">
      <h2 className="scene-title">{s.one.title}</h2>
      <div className="ghs-one">
        <Chamber water="ok" light="plain" label={b.plantLabel} onReplay={onReplay} />
        <div className="ghs-facts">
          {stage >= 1 && (
            <p className="ghs-fact">
              <Droplets size={22} aria-hidden="true" />
              {s.one.text}
            </p>
          )}
          {stage >= 1 && (
            <p className="ghs-fact">
              <Wind size={22} aria-hidden="true" />
              <span>
                <b>{s.one.environment}</b> {s.one.environmentText}
              </span>
            </p>
          )}
          {stage >= 2 && <p className="ghs-info">{s.one.info}</p>}
          <LearnMore text={s.one.more} />
        </div>
      </div>
    </div>
  );
}

/* ---------- Screen 2: water balance ---------- */

const LEVELS: WaterState[] = ["dry", "ok", "wet"];
/** Without a voice the three levels follow each other on a reading-pace timer. */
const AUTO_MS = 4200;

export function SpecialistTwo({
  say,
  voiced,
  onReplay,
}: {
  say: Say;
  /** True when narration will actually play, so the voice (not a timer) moves the levels along. */
  voiced: boolean;
  onReplay: () => void;
}) {
  const [water, setWater] = useState<WaterState>("dry");
  const timers = useRef<number[]>([]);
  const stopAuto = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  // The levels play by themselves: dry, balanced, wet. Each one starts as its sentence starts.
  useEffect(() => {
    if (voiced) {
      say(
        LEVELS.map((w) => s.voice.two[w][0]!),
        (i) => setWater(LEVELS[i] ?? "ok"),
      );
    } else {
      LEVELS.forEach((w, i) => {
        if (i > 0) timers.current.push(window.setTimeout(() => setWater(w), i * AUTO_MS));
      });
    }
    return stopAuto;
  }, [say, voiced]);

  // Tapping a level takes over from the automatic story.
  const choose = (w: WaterState) => {
    stopAuto();
    setWater(w);
    say(s.voice.two[w]);
  };
  return (
    <div className="scene gh-scene ghs-scene">
      <h2 className="scene-title">{s.two.title}</h2>
      <div className="ghs-one">
        <Chamber water={water} light="plain" label={b.plantLabel} onReplay={onReplay} />
        <div className="ghs-facts">
          <div className="ghs-seg" role="radiogroup" aria-label={s.two.switchLabel}>
            {LEVELS.map((w) => (
              <button
                key={w}
                type="button"
                role="radio"
                aria-checked={water === w}
                className={cn("ghs-seg-item", water === w && "ghs-seg-on")}
                onClick={() => choose(w)}
              >
                {s.two[w]}
              </button>
            ))}
          </div>
          <p className="ghs-fact ghs-fact-big" aria-live="polite" key={water}>
            {s.two.texts[water]}
          </p>
          <p className="ghs-info">{s.two.droplets}</p>
          <LearnMore text={s.two.more} />
        </div>
      </div>
    </div>
  );
}

/* ---------- Screen 3: light recipes and the mission ---------- */

export function SpecialistThree({ say, onEnter }: { say: Say; onEnter: () => void }) {
  const [blue, setBlue] = useState(false);
  const [parOpen, setParOpen] = useState(false);
  const parId = useId();
  const m = s.three;
  useEffect(
    () => say([...s.voice.three.intro, ...s.voice.three.mission]),
    [say],
  );
  return (
    <div className="scene gh-scene ghs-scene">
      <h2 className="scene-title">{m.title}</h2>
      <div className="ghs-one">
        <Chamber water="ok" light={blue ? "blue" : "red"} label={b.plantLabel} />
        <div className="ghs-facts ghs-facts-center">
          <div className="ghs-par">
            <button
              type="button"
              className="ghs-par-button"
              aria-expanded={parOpen}
              aria-controls={parId}
              onClick={() => setParOpen((o) => !o)}
              onMouseEnter={() => setParOpen(true)}
              onMouseLeave={() => setParOpen(false)}
            >
              {m.par}
              <Info size={14} aria-hidden="true" />
              <span className="sr-only">{m.parLabel}</span>
            </button>
            <span id={parId} role="tooltip" className="ghs-par-tip" hidden={!parOpen}>
              {m.parText}
            </span>
          </div>
          <p className="ghs-fact">{m.text}</p>
          <button
            type="button"
            role="switch"
            aria-checked={blue}
            aria-label={m.recipesLabel}
            className={cn("gh-switch", blue && "gh-switch-blue")}
            onClick={() => setBlue((v) => !v)}
          >
            <span className={cn("gh-switch-label gh-switch-red", !blue && "gh-switch-on")}>
              {m.red}
            </span>
            <span className="gh-switch-track" aria-hidden="true">
              <span className="gh-switch-stop" />
              <span className="gh-switch-stop" />
              <span className="gh-switch-thumb" />
            </span>
            <span className={cn("gh-switch-label gh-switch-blueword", blue && "gh-switch-on")}>
              {m.blue}
            </span>
          </button>
          <p className="gh-mix" aria-live="polite">
            <b>{blue ? m.blue : m.red}</b> {blue ? m.blueMix : m.redMix}
          </p>
          <LearnMore text={m.more} />
        </div>
      </div>
      <section className="gh-mission ghs-mission" aria-label={m.mission.title}>
        <h3>{m.mission.title}</h3>
        <p>{m.mission.body}</p>
        <Button className="mission-cta begin-cta" data-primary onClick={onEnter}>
          <Sprout size={20} aria-hidden="true" />
          {m.cta}
          <ArrowRight size={20} />
        </Button>
      </section>
    </div>
  );
}
