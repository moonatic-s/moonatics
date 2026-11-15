import {
  ArrowLeft,
  ArrowRight,
  Moon,
  RotateCcw,
  Shield,
  Sun,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { content } from "@/game/content";
import { LEAVE_MS, SKIP_LEAVE_MS } from "@/game/life-support/briefing-data";
import { useGame, type AgeMode } from "@/game/state";
import { cn } from "@/lib/utils";
import { playChime } from "./chime";
import { PowerDiagram, ShelterCutaway, SunMoonScene, type SunStage } from "./storm-art";
import { usePrefersReducedMotion, useStages } from "./use-briefing-motion";
import { useNarrator } from "./use-narration";

const copy = content.storm.briefing;
const SCREENS = 5;
type Say = (lines: readonly string[]) => void;

/** One text, two ages: the layout, pictures and motion are shared; only the words change. */
const pick = <A, B>(v: { explorer: A; specialist: B }, mode: AgeMode): A | B => v[mode];
const lines = (v: string | readonly string[]): readonly string[] => (typeof v === "string" ? [v] : v);

function Chain({ items }: { items: readonly string[] }) {
  return (
    <ol className="chain" aria-label={items.join(", ")}>
      {items.map((c, i) => (
        <li key={c}>
          <span className="chain-chip" style={{ ["--ch" as string]: "var(--primary)" }}>{c}</span>
          {i < items.length - 1 && <ArrowRight size={14} className="chain-arrow" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}

function TapReplay({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="ghs-tap-replay" onClick={onClick}>
      <RotateCcw size={13} aria-hidden="true" />
      {copy.tapReplay}
    </button>
  );
}

/* ---------------------- Screen 1: space weather alert ---------------------- */

function ScreenOne({ mode, say, onReplay }: { mode: AgeMode; say: Say; onReplay: () => void }) {
  const stage = useStages([1400, 2400, 1500], 0); // calm -> flash -> pause -> explain
  useEffect(() => {
    say(lines(pick(copy.voice.one, mode)));
  }, [say, mode]);
  const sun: SunStage = stage === 1 ? "flash" : "calm";
  return (
    <div className="scene storm-scene">
      <h2 className="scene-title">{copy.one.title}</h2>
      <SunMoonScene stage={sun} label={`${copy.sun}. ${copy.moon}.`} />
      {stage >= 3 && (
        <div className="storm-explain">
          <p className="scene-body">{pick(copy.one.text, mode).join(" ")}</p>
          <Chain items={copy.one.chain} />
          {mode === "specialist" && (
            <p className="storm-data"><b>{copy.one.label}</b> <span>{copy.one.detected}</span></p>
          )}
        </div>
      )}
      <TapReplay onClick={onReplay} />
    </div>
  );
}

/* ---------------------- Screen 2: what comes next ---------------------- */

function ScreenTwo({ mode, say, onReplay }: { mode: AgeMode; say: Say; onReplay: () => void }) {
  // CME -> pause -> particles -> pause -> explain. Never both at once.
  const stage = useStages([1100, 5200, 1500, 5200, 1500], 0);
  useEffect(() => {
    say(lines(pick(copy.voice.two, mode)));
  }, [say, mode]);
  const sun: SunStage = stage === 1 ? "cme" : stage === 3 ? "particles" : "calm";
  return (
    <div className="scene storm-scene">
      <h2 className="scene-title">{copy.two.title}</h2>
      <SunMoonScene stage={sun} label={`${copy.sun} ${copy.moon}`} />
      <p className="storm-stagelabel" aria-live="polite">
        {stage === 1 ? copy.two.cme : stage === 3 ? copy.two.particles : " "}
      </p>
      {mode === "specialist" && (stage === 1 || stage === 3) && (
        <p className="storm-data">{stage === 1 ? copy.two.cmeLabel : copy.two.particleLabel}</p>
      )}
      {stage >= 5 && (
        <div className="storm-explain">
          <p className="scene-body">{pick(copy.two.text, mode).join(" ")}</p>
          <Chain items={copy.two.chain} />
        </div>
      )}
      <TapReplay onClick={onReplay} />
    </div>
  );
}

/* ---------------------- Screen 3: shielding ---------------------- */

const SHIELDED: ("water" | "supply" | "equipment" | null)[] = ["water", "water", "water", "water", "supply", "water", "water", "supply"];
const BARE: null[] = Array(8).fill(null);

function ScreenThree({ mode, say, onReplay }: { mode: AgeMode; say: Say; onReplay: () => void }) {
  // particles with no shielding -> pause -> add shielding, same particles -> explain
  const stage = useStages([4200, 1400, 4200, 2400], 0);
  useEffect(() => {
    say(lines(pick(copy.voice.three, mode)));
  }, [say, mode]);
  const shielded = stage >= 2;
  return (
    <div className="scene storm-scene">
      <h2 className="scene-title">{copy.three.title}</h2>
      <p className="storm-part" aria-live="polite">{copy.three.partA}</p>
      <ShelterCutaway
        key={shielded ? "on" : "off"}
        slots={shielded ? SHIELDED : BARE}
        passing={shielded ? 2 : 8}
        streaks={10}
        label={shielded ? copy.three.withShield : copy.three.without}
      >
        <span className="storm-cap">{shielded ? copy.three.withShield : copy.three.without}</span>
      </ShelterCutaway>
      {stage >= 4 && <p className="scene-body">{pick(copy.three.textA, mode).join(" ")}</p>}
      <TapReplay onClick={onReplay} />
    </div>
  );
}

/* ---------------------- Screen 4: power ---------------------- */

function ScreenFour({ mode, say, onReplay }: { mode: AgeMode; say: Say; onReplay: () => void }) {
  // one battery, three systems -> explain -> the one sentence to remember
  const stage = useStages([3200, 3000, 2400], 0);
  useEffect(() => {
    say(lines(pick(copy.voice.four, mode)));
  }, [say, mode]);
  return (
    <div className="scene storm-scene">
      <h2 className="scene-title">{copy.three.shareTitle}</h2>
      <p className="storm-part">{copy.three.partB}</p>
      <PowerDiagram labels={copy.three.systems} showAll />
      {stage >= 1 && <p className="scene-body">{pick(copy.three.textB, mode).join(" ")}</p>}
      {stage >= 2 && <p className="storm-statement">{copy.three.statement}</p>}
      <TapReplay onClick={onReplay} />
    </div>
  );
}

/* ---------------------- Screen 5: your mission ---------------------- */

const STEP_ICONS = [Sun, Shield, Zap, Moon] as const;

function ScreenFive({ mode, say, onEnter }: { mode: AgeMode; say: Say; onEnter: () => void }) {
  // one icon at a time -> tasks -> NASA vs simulation
  const stage = useStages([1000, 1800, 1800, 1800, 1800, 2000, 1600], 0);
  useEffect(() => {
    say(lines(pick(copy.voice.five, mode)));
  }, [say, mode]);
  const f = copy.five;
  return (
    <div className="scene storm-scene">
      <h2 className="scene-title">{f.title}</h2>
      <SunMoonScene stage="calm" label={copy.moon} small />
      <ol className="storm-steps" aria-label={f.steps.join(", ")}>
        {f.steps.map((s, i) => {
          const Icon = STEP_ICONS[i]!;
          return (
            <li key={s} className={cn(stage === i + 1 && "storm-step-now", stage > i + 1 && "storm-step-done")}>
              <Icon size={22} aria-hidden="true" />
              {s}
            </li>
          );
        })}
      </ol>
      {stage >= 5 && (
        <ul className="storm-tasks">
          {pick(f.tasks, mode).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      {stage >= 6 && (
        <div className="storm-compare">
          <div className="storm-compare-nasa">
            <b>{f.nasa}</b>
            <p>{pick(f.nasaText, mode)}</p>
          </div>
          <div className="storm-compare-sim">
            <b>{f.sim}</b>
            <p>{pick(f.simText, mode)}</p>
          </div>
        </div>
      )}
      {stage >= 5 && (
        <Button className="mission-cta begin-cta" data-primary onClick={onEnter}>
          {f.cta}
          <ArrowRight size={20} />
        </Button>
      )}
    </div>
  );
}

/* ------------------------------- the briefing ------------------------------- */

/**
 * Mission 3's five-screen briefing. ONE component for both age groups: the screens, pictures, animation and
 * navigation are identical; only the words (and a few optional NASA labels) change. It never touches game state.
 */
export function StormBriefing({
  onFinish,
  onBack,
}: {
  onFinish: () => void;
  onBack?: (() => void) | undefined;
}) {
  const { ageMode } = useGame();
  const mode: AgeMode = ageMode ?? "explorer";
  const reduced = usePrefersReducedMotion();
  const narrator = useNarrator(copy.voice.lang);
  const { supported, soundOn, speak, stop } = narrator;
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [again, setAgain] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const say = useCallback<Say>(
    (l) => {
      if (supported && soundOn) speak(l, mode);
    },
    [supported, soundOn, speak, mode],
  );
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
      if (soundOn) playChime("done");
      if (reduced) onFinish();
      else timer.current = window.setTimeout(onFinish, ms);
    },
    [leaving, reduced, soundOn, stop, onFinish],
  );
  const go = useCallback(
    (to: number) => {
      const next = Math.max(0, Math.min(SCREENS - 1, to));
      setDirection(next >= index ? "forward" : "back");
      setIndex(next);
      setAgain(0);
    },
    [index],
  );
  useEffect(() => {
    root.current?.querySelector<HTMLElement>("[data-primary]")?.focus({ preventScroll: true });
  }, [index]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") go(index + 1);
    else if (e.key === "ArrowLeft") go(index - 1);
    else if (e.key === "Escape") finish(SKIP_LEAVE_MS);
    else if (e.key === "Tab") {
      const items = [...(root.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? [])];
      const first = items[0];
      const last = items[items.length - 1];
      if (first && last && e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (first && last && !e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const replay = () => setAgain((n) => n + 1);
  const screens: ReactNode[] = [
    <ScreenOne key={`1-${again}`} mode={mode} say={say} onReplay={replay} />,
    <ScreenTwo key={`2-${again}`} mode={mode} say={say} onReplay={replay} />,
    <ScreenThree key={`3-${again}`} mode={mode} say={say} onReplay={replay} />,
    <ScreenFour key={`4-${again}`} mode={mode} say={say} onReplay={replay} />,
    <ScreenFive key={`5-${again}`} mode={mode} say={say} onEnter={() => finish(LEAVE_MS)} />,
  ];
  const last = index === SCREENS - 1;

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={root}
      className={cn("briefing briefing-storm", `briefing-${mode}`, leaving && "briefing-leaving")}
      role="dialog"
      aria-modal="true"
      aria-label={copy.aria}
      onKeyDown={onKeyDown}
    >
      <header className="briefing-top">
        <span className="briefing-label">{copy.label}</span>
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
            <Button variant="ghost" className="briefing-hear" onClick={replay}>
              <RotateCcw size={14} />
              {copy.hear}
            </Button>
          )}
          <Button variant="outline" className="briefing-skip" onClick={() => finish(SKIP_LEAVE_MS)}>
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
          <span className="briefing-count">{copy.progress(index + 1, SCREENS)}</span>
          <span className="briefing-dots" aria-hidden="true">
            {Array.from({ length: SCREENS }, (_, i) => (
              <span key={i} className={cn("briefing-dot", i === index && "briefing-dot-now", i < index && "briefing-dot-done")} />
            ))}
          </span>
        </div>
        {last ? (
          <span className="briefing-spacer" />
        ) : (
          <Button className="briefing-next" data-primary onClick={() => go(index + 1)}>
            {copy.next}
            <ArrowRight size={18} />
          </Button>
        )}
      </footer>
    </div>,
    document.body,
  );
}
