import {
  ArrowLeft,
  ArrowRight,
  Droplets,
  Lightbulb,
  RotateCcw,
  Sprout,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { content } from "@/game/content";
import { LEAVE_MS, SKIP_LEAVE_MS } from "@/game/life-support/briefing-data";
import { cn } from "@/lib/utils";
import { playChime } from "./chime";
import { GreenhousePlant, type WaterState } from "./greenhouse-art";
import { SpecialistOne, SpecialistThree, SpecialistTwo } from "./greenhouse-specialist";
import { usePrefersReducedMotion, useStages } from "./use-briefing-motion";
import { useGame } from "@/game/state";
import { useNarrator } from "./use-narration";

const copy = content.greenhouse.briefing;
const SCREENS = 3;

type Say = (
  lines: readonly string[],
  onLine?: (index: number) => void,
) => void;

/** A tappable plant: tapping replays the little story. */
function PlantButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="gh-plant-button"
      onClick={onClick}
      aria-label={copy.replay}
    >
      {children}
      <span className="ghs-tap-replay" aria-hidden="true">
        <RotateCcw size={13} />
        {copy.tapReplay}
      </span>
    </button>
  );
}

/* ----------------------- Screen 1: space greenhouse ----------------------- */

/** show (the seedling grows) -> pause -> icons -> pause -> words. Never two things at once. */
const ONE_STAGES = [3400, 700, 700];

function ScreenOne({
  say,
  replay,
  onReplay,
}: {
  say: Say;
  replay: number;
  onReplay: () => void;
}) {
  const stage = useStages(ONE_STAGES, replay);
  useEffect(() => {
    if (stage === 0) say(copy.voice.one.welcome);
    if (stage === 3) say(copy.voice.one.text);
  }, [stage, say]);
  return (
    <div className="scene gh-scene">
      <h2 className="scene-title">{copy.one.title}</h2>
      <PlantButton onClick={onReplay}>
        <GreenhousePlant
          key={replay}
          water="ok"
          light="plain"
          growIn
          label={copy.plantLabel}
        />
      </PlantButton>
      {stage >= 2 && (
        <ul className="gh-needs" aria-label="What plants need">
          <li className="gh-need-water">
            <Droplets size={26} aria-hidden="true" />
            {copy.one.water}
          </li>
          <li className="gh-need-light">
            <Lightbulb size={26} aria-hidden="true" />
            {copy.one.light}
          </li>
        </ul>
      )}
      <p
        className={cn("gh-line", stage >= 3 && "gh-line-on")}
        aria-live="polite"
      >
        {stage >= 3 ? copy.one.text : ""}
      </p>
    </div>
  );
}

/* ----------------------- Screen 2: find the balance ----------------------- */

/**
 * 0 healthy, 1 drying, 2 dry (words), 3 back to healthy, 4 too wet, 5 wet (words), 6 healthy and bright, 7 final (words).
 * Words only ever appear while the plant is resting, and vanish before it moves again.
 */
const TWO_STAGES = [600, 1800, 2000, 1200, 1800, 2000, 1600];
const WATER_BY_STAGE: WaterState[] = [
  "ok",
  "dry",
  "dry",
  "ok",
  "wet",
  "wet",
  "ok",
  "ok",
];

function ScreenTwo({
  say,
  replay,
  onReplay,
}: {
  say: Say;
  replay: number;
  onReplay: () => void;
}) {
  const stage = useStages(TWO_STAGES, replay);
  const text =
    stage === 2
      ? copy.two.dry
      : stage === 5
        ? copy.two.wet
        : stage === 7
          ? copy.two.balance
          : "";
  useEffect(() => {
    if (stage === 2) say(copy.voice.two.dry);
    if (stage === 5) say(copy.voice.two.wet);
    if (stage === 7) say(copy.voice.two.balance);
  }, [stage, say]);
  return (
    <div className="scene gh-scene">
      <h2 className="scene-title">{copy.two.title}</h2>
      <PlantButton onClick={onReplay}>
        <GreenhousePlant
          water={WATER_BY_STAGE[stage] ?? "ok"}
          light="plain"
          bright={stage >= 6}
          label={copy.plantLabel}
        />
      </PlantButton>
      <p
        className={cn(
          "gh-line",
          text && "gh-line-on",
          stage === 7 && "gh-line-final",
        )}
        aria-live="polite"
        key={text}
      >
        {text}
      </p>
    </div>
  );
}

/* ------------------------ Screen 3: choose the light ------------------------ */

function ScreenThree({ say, onEnter }: { say: Say; onEnter: () => void }) {
  const reduced = usePrefersReducedMotion();
  const [blue, setBlue] = useState(false);
  const [touched, setTouched] = useState(false);
  const [revealed, setRevealed] = useState(reduced);
  const m = copy.three;
  const missionRef = useRef<HTMLElement>(null);

  useEffect(() => say(copy.voice.three.intro), [say]);
  // The mission appears a beat after the first tap (so the light has finished changing), or on its own if nobody taps.
  useEffect(() => {
    if (revealed) return;
    const t = window.setTimeout(() => setRevealed(true), touched ? 1800 : 9000);
    return () => window.clearTimeout(t);
  }, [touched, revealed]);
  useEffect(() => {
    if (revealed && !reduced) say(copy.voice.three.mission);
  }, [revealed, reduced, say]);
  // On small screens the big button can sit below the fold: bring it into view once it appears.
  useEffect(() => {
    if (revealed)
      missionRef.current?.scrollIntoView?.({
        block: "nearest",
        behavior: reduced ? "auto" : "smooth",
      });
  }, [revealed, reduced]);

  return (
    <div className="scene gh-scene gh-scene-three">
      <h2 className="scene-title">{m.title}</h2>
      <div className="gh-light-row">
        <GreenhousePlant
          water="ok"
          light={blue ? "blue" : "red"}
          label={copy.plantLabel}
        />
        <div className="gh-controls">
          <button
            type="button"
            role="switch"
            aria-checked={blue}
            aria-label={m.switchLabel}
            className={cn("gh-switch", blue && "gh-switch-blue")}
            onClick={() => {
              setBlue((b) => !b);
              setTouched(true);
            }}
          >
            <span
              className={cn(
                "gh-switch-label gh-switch-red",
                !blue && "gh-switch-on",
              )}
            >
              {m.red}
            </span>
            <span className="gh-switch-track" aria-hidden="true">
              <span className="gh-switch-stop" />
              <span className="gh-switch-stop" />
              <span className="gh-switch-thumb" />
            </span>
            <span
              className={cn(
                "gh-switch-label gh-switch-blueword",
                blue && "gh-switch-on",
              )}
            >
              {m.blue}
            </span>
          </button>
          <p className="gh-mix" aria-live="polite">
            <b>{blue ? m.blue : m.red}</b> {blue ? m.blueMix : m.redMix}
          </p>
          <p className="gh-line gh-line-on">{m.text}</p>
          {!touched && !revealed && <p className="gh-hint">{m.hint}</p>}
        </div>
      </div>
      {revealed && (
        <section
          className="gh-mission"
          aria-label={m.mission.title}
          ref={missionRef}
        >
          <h3>{m.mission.title}</h3>
          <p>{m.mission.body}</p>
          <ul>
            <li>
              <Droplets size={26} aria-hidden="true" />
              {m.mission.icons.water}
            </li>
            <li>
              <Lightbulb size={26} aria-hidden="true" />
              {m.mission.icons.light}
            </li>
            <li>
              <Sprout size={26} aria-hidden="true" />
              {m.mission.icons.plant}
            </li>
          </ul>
          <Button
            className="mission-cta begin-cta"
            data-primary
            onClick={onEnter}
          >
            {m.cta}
            <ArrowRight size={20} />
          </Button>
        </section>
      )}
    </div>
  );
}

/* ------------------------------- the briefing ------------------------------- */

/**
 * Mission 2's three-screen briefing for Explorer mode (ages 7-9): about half a minute, one idea per screen,
 * one animation at a time. It only explains; it never touches the game state, and every screen can be skipped.
 */
export function GreenhouseBriefing({
  onFinish,
  onBack,
  variant = "explorer",
}: {
  onFinish: () => void;
  /** Back on the first screen leaves the briefing for the mission map. */
  onBack?: (() => void) | undefined;
  variant?: "explorer" | "specialist";
}) {
  const reduced = usePrefersReducedMotion();
  const narrator = useNarrator(copy.voice.lang);
  const { supported, soundOn, speak, stop } = narrator;
  const { noteBriefingFinished } = useGame();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [replay, setReplay] = useState(0);
  /** "Hear again" starts the whole screen over, so the picture and the voice stay together. */
  const [again, setAgain] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const say = useCallback<Say>(
    (lines, onLine) => {
      if (supported && soundOn) speak(lines, variant, onLine);
    },
    [supported, soundOn, speak, variant],
  );
  // Each screen starts with silence; whatever it was saying stops when the player moves on.
  useEffect(() => stop, [index, stop]);
  useEffect(() => {
    if (soundOn) playChime("start");
    // once, on opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = useCallback(
    (ms: number) => {
      if (leaving) return;
      setLeaving(true);
      stop();
      if (index === SCREENS - 1) noteBriefingFinished();
      if (soundOn) playChime("done");
      if (reduced) onFinish();
      else timer.current = window.setTimeout(onFinish, ms);
    },
    [leaving, reduced, soundOn, stop, onFinish, index, noteBriefingFinished],
  );
  const go = useCallback(
    (to: number) => {
      const next = Math.max(0, Math.min(SCREENS - 1, to));
      setDirection(next >= index ? "forward" : "back");
      setIndex(next);
      setReplay(0);
      setAgain(0);
    },
    [index],
  );

  useEffect(() => {
    root.current
      ?.querySelector<HTMLElement>("[data-primary]")
      ?.focus({ preventScroll: true });
  }, [index]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") go(index + 1);
    else if (e.key === "ArrowLeft") go(index - 1);
    else if (e.key === "Escape") finish(SKIP_LEAVE_MS);
    else if (e.key === "Tab") {
      const items = [
        ...(root.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled])",
        ) ?? []),
      ];
      const first = items[0];
      const last = items[items.length - 1];
      if (first && last && e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (
        first &&
        last &&
        !e.shiftKey &&
        document.activeElement === last
      ) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const onReplay = () => setReplay((n) => n + 1);
  const screens =
    variant === "specialist"
      ? [
          <SpecialistOne key={`1-${again}`} say={say} onReplay={() => setAgain((n) => n + 1)} />,
          <SpecialistTwo
            key={`2-${again}`}
            say={say}
            voiced={supported && soundOn}
            onReplay={() => setAgain((n) => n + 1)}
          />,
          <SpecialistThree key={`3-${again}`} say={say} onEnter={() => finish(LEAVE_MS)} />,
        ]
      : [
          <ScreenOne key={`1-${again}`} say={say} replay={replay} onReplay={onReplay} />,
          <ScreenTwo key={`2-${again}`} say={say} replay={replay} onReplay={onReplay} />,
          <ScreenThree key={`3-${again}`} say={say} onEnter={() => finish(LEAVE_MS)} />,
        ];
  const last = index === SCREENS - 1;

  // Portal to <body> so the page's entrance animation cannot re-anchor this fixed overlay.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={root}
      className={cn(
        "briefing briefing-greenhouse",
        variant === "specialist" ? "briefing-specialist" : "briefing-explorer",
        leaving && "briefing-leaving",
      )}
      role="dialog"
      aria-modal="true"
      aria-label={copy.aria}
      onKeyDown={onKeyDown}
    >
      <header className="briefing-top">
        <span className="briefing-label">
          {variant === "specialist" ? copy.specialist.label : copy.label}
        </span>
        <div className="briefing-tools">
          {supported && (
            <Button
              variant="outline"
              className="briefing-sound"
              aria-pressed={soundOn}
              onClick={() => narrator.setSoundOn(!soundOn)}
            >
              {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
              {soundOn ? copy.sound.on : copy.sound.off}
            </Button>
          )}
          {supported && soundOn && (
            <Button
              variant="ghost"
              className="briefing-hear"
              onClick={() => setAgain((n) => n + 1)}
            >
              <RotateCcw size={14} />
              {copy.hear}
            </Button>
          )}
          <Button
            variant="outline"
            className="briefing-skip"
            onClick={() => finish(SKIP_LEAVE_MS)}
          >
            {copy.skip}
          </Button>
        </div>
      </header>

      <div className={cn("briefing-stage", `go-${direction}`)} key={index}>
        {screens[index]}
      </div>

      <footer className="briefing-bottom">
        <Button
          variant="ghost"
          className="briefing-back"
          onClick={() => {
            if (index === 0) {
              stop();
              onBack?.();
            } else go(index - 1);
          }}
          disabled={index === 0 && !onBack}
        >
          <ArrowLeft size={18} />
          {copy.back}
        </Button>
        <div className="briefing-progress" aria-live="polite">
          <span className="briefing-count">
            {copy.progress(index + 1, SCREENS)}
          </span>
          <span className="briefing-dots" aria-hidden="true">
            {Array.from({ length: SCREENS }, (_, i) => (
              <span
                key={i}
                className={cn(
                  "briefing-dot",
                  i === index && "briefing-dot-now",
                  i < index && "briefing-dot-done",
                )}
              />
            ))}
          </span>
        </div>
        {last ? (
          <span className="briefing-spacer" />
        ) : (
          <Button
            className="briefing-next"
            data-primary
            onClick={() => go(index + 1)}
          >
            {copy.next}
            <ArrowRight size={18} />
          </Button>
        )}
      </footer>
    </div>,
    document.body,
  );
}
