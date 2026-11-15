import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { content } from "@/game/content";
import {
  LEAVE_MS,
  SKIP_LEAVE_MS,
  buildBriefingData,
} from "@/game/life-support/briefing-data";
import { useGame } from "@/game/state";
import { cn } from "@/lib/utils";
import {
  SceneFive,
  SceneFour,
  SceneOne,
  SceneThree,
  SceneTwo,
} from "./briefing-scenes";
import { playChime } from "./chime";
import { usePrefersReducedMotion } from "./use-briefing-motion";
import { useNarrator } from "./use-narration";

const copy = content.lifeConsole.briefing;
const SCENES = 5;
/**
 * The pre-mission training briefing: five short scenes laid over the real Life Support screen.
 * It teaches the ideas, never touches the simulation, and can be skipped at any moment.
 */
export function LifeSupportBriefing({
  onLeaveStart,
  onFinish,
  onBack,
}: {
  onLeaveStart?: () => void;
  onFinish: () => void;
  /** Back on the first scene leaves the briefing for the mission map. */
  onBack?: (() => void) | undefined;
}) {
  const { ageMode } = useGame();
  const mode = ageMode ?? "explorer";
  const reduced = usePrefersReducedMotion();
  const data = useMemo(buildBriefingData, []);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [leaving, setLeaving] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const narrator = useNarrator(copy.voice.lang);
  const { supported, soundOn, speak, stop } = narrator;
  /** Which narration line is being spoken, so the picture can follow the voice. */
  const [line, setLine] = useState<number | null>(null);
  const [hearAgain, setHearAgain] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const finish = useCallback(
    (ms: number) => {
      if (leaving) return;
      setLeaving(true);
      stop();
      if (soundOn) playChime("done");
      onLeaveStart?.();
      if (reduced) onFinish();
      else timer.current = window.setTimeout(onFinish, ms);
    },
    [leaving, reduced, soundOn, stop, onLeaveStart, onFinish],
  );
  const go = useCallback(
    (to: number) => {
      const next = Math.max(0, Math.min(SCENES - 1, to));
      setDirection(next >= index ? "forward" : "back");
      setIndex(next);
    },
    [index],
  );

  useEffect(() => {
    root.current
      ?.querySelector<HTMLElement>("[data-primary]")
      ?.focus({ preventScroll: true });
  }, [index]);

  // Narrate each scene when it opens (and again on request). Stops the moment the player moves on or leaves.
  useEffect(() => {
    setLine(null);
    if (!supported || !soundOn || leaving) return;
    speak(copy.voice.lines[mode][index] ?? [], mode, setLine);
    return stop;
  }, [index, mode, supported, soundOn, leaving, hearAgain, speak, stop]);

  // A soft "systems online" chime when the briefing opens.
  useEffect(() => {
    if (soundOn) playChime("start");
    // once, on opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") go(index + 1);
    else if (e.key === "ArrowLeft") go(index - 1);
    else if (e.key === "Escape") finish(SKIP_LEAVE_MS);
    else if (e.key === "Tab") {
      // Keep keyboard focus inside the briefing while it is open.
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

  const scenes = [
    <SceneOne key="1" mode={mode} />,
    <SceneTwo key="2" mode={mode} line={line} />,
    <SceneThree key="3" mode={mode} data={data} />,
    <SceneFour key="4" mode={mode} data={data} />,
    <SceneFive key="5" mode={mode} onBegin={() => finish(LEAVE_MS)} />,
  ];
  const last = index === SCENES - 1;

  // Portal to <body>: a transformed ancestor (the scene entrance animation) would otherwise re-anchor this fixed overlay.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={root}
      className={cn(
        "briefing",
        `briefing-${mode}`,
        leaving && "briefing-leaving",
      )}
      role="dialog"
      aria-modal="true"
      aria-label={copy.aria}
      onKeyDown={onKeyDown}
    >
      <header className="briefing-top">
        <span className="briefing-label">{copy.label}</span>
        <div className="briefing-tools">
          {supported && (
            <>
              <Button
                variant="outline"
                className="briefing-sound"
                aria-pressed={soundOn}
                onClick={() => narrator.setSoundOn(!soundOn)}
              >
                {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
                {soundOn ? copy.voice.on : copy.voice.off}
              </Button>
              {soundOn && (
                <Button
                  variant="ghost"
                  className="briefing-hear"
                  onClick={() => setHearAgain((n) => n + 1)}
                >
                  <RotateCcw size={14} />
                  {copy.voice.hear}
                </Button>
              )}
            </>
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
        {scenes[index]}
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
            {copy.progress(index + 1, SCENES)}
          </span>
          <span className="briefing-dots" aria-hidden="true">
            {Array.from({ length: SCENES }, (_, i) => (
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
