import { Award, BookOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { sfx } from "@/game/audio/sfx";
import { useGame, type AgeMode } from "@/game/state";
import { CARDS, PATCHES } from "@/game/story/collection";
import { EARTH, REFLECTIONS, RECALLS, pick, pickQuestion, type Question } from "@/game/story/copy";
import type { MissionKey } from "@/game/story/profile";
import { cn } from "@/lib/utils";
import { Avatar, Comms, type Mood } from "./cast";
import { useStormVoice } from "./storm-views";

/** A calm full-screen layer for mission control's questions. It never blocks anything: every question can be skipped. */
function Overlay({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[data-primary]")?.focus({ preventScroll: true });
  });
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="wrap" role="dialog" aria-modal="true" aria-label={label} ref={ref}>
      <div className="wrap-card">{children}</div>
    </div>,
    document.body,
  );
}

/**
 * One question. The child answers, then sees the explanation and the right answer, whether they were right or not.
 * There is no retry and no skip, and a miss is never marked as a failure.
 */
function QuestionCard({
  q,
  mode,
  extra,
  onResolve,
  onContinue,
}: {
  q: Question;
  mode: AgeMode;
  /** Something to show with the answer (the "see it happen" part). */
  extra?: ((revealed: boolean) => React.ReactNode) | undefined;
  onResolve: (solved: boolean) => void;
  onContinue: () => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [sides, setSides] = useState<(0 | 1 | null)[]>(() => (q.kind === "sort" ? q.items.map(() => null) : []));
  const [verdict, setVerdict] = useState<"idle" | "right" | "wrong">("idle");
  const revealed = verdict !== "idle";

  const check = () => {
    const right = q.kind === "choice" ? picked === q.correct : q.items.every((it, i) => sides[i] === it.side);
    setVerdict(right ? "right" : "wrong");
    if (right) sfx.confirm();
    else sfx.pop();
    onResolve(right);
  };
  const ready = q.kind === "choice" ? picked !== null : sides.every((s) => s !== null);
  const mood: Mood = verdict === "right" ? "happy" : "calm";
  const answer =
    q.kind === "choice"
      ? pick(q.options, mode)[q.correct]
      : q.items.map((it) => `${it.label}: ${q.sides[it.side]}`).join(" \u00B7 ");

  return (
    <div className="wrap-q">
      <div className="wrap-ask">
        <Avatar who="luna" mood={mood} size={52} />
        <p>{pick(q.q, mode)}</p>
      </div>
      {q.kind === "choice" ? (
        <div className="wrap-options" role="radiogroup" aria-label={pick(q.q, mode)}>
          {pick(q.options, mode).map((o, i) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={picked === i}
              disabled={revealed}
              className={cn("wrap-option", picked === i && "on", revealed && i === q.correct && "good", revealed && picked === i && i !== q.correct && "miss")}
              onClick={() => setPicked(i)}
            >
              {o}
            </button>
          ))}
        </div>
      ) : (
        <div className="wrap-sort">
          {q.items.map((it, i) => (
            <div key={it.label} className="wrap-sort-row">
              <span>{it.label}</span>
              <div role="group" aria-label={it.label}>
                {q.sides.map((s, side) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={sides[i] === side}
                    disabled={revealed}
                    className={cn("wrap-option small", sides[i] === side && "on", revealed && it.side === side && "good", revealed && sides[i] === side && it.side !== side && "miss")}
                    onClick={() => setSides((cur) => cur.map((v, j) => (j === i ? (side as 0 | 1) : v)))}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {extra?.(revealed)}
      {revealed && (
        <div className={cn("wrap-note", verdict === "right" && "wrap-yes")} role="status">
          <p>
            <b>{verdict === "right" ? "Yes!" : "Not quite."}</b> {pick(q.why, mode)}
          </p>
          {verdict === "wrong" && (
            <p>
              The answer: <b>{answer}</b>
            </p>
          )}
        </div>
      )}
      <div className="wrap-actions">
        {revealed ? (
          <Button className="mission-cta" data-primary onClick={onContinue}>
            CONTINUE
          </Button>
        ) : (
          <Button className="mission-cta" data-primary disabled={!ready} onClick={check}>
            CHECK
          </Button>
        )}
      </div>
    </div>
  );
}

/** The "see it happen" part of Mission 1's question: power left falls as the scrubbers go up. */
function PowerReveal({ show }: { show: boolean }) {
  return (
    <div className={cn("wrap-reveal", show && "on")} aria-hidden="true">
      <span>Scrubbers normal</span>
      <i style={{ width: "70%" }} />
      <span>Scrubbers at maximum</span>
      <i className="low" style={{ width: show ? "38%" : "70%" }} />
    </div>
  );
}

/** A student's question from Earth, answered by Luna. */
function EarthMessage({ mission, mode }: { mission: MissionKey; mode: AgeMode }) {
  const { noteEarthRead } = useGame();
  const m = EARTH[mission];
  useEffect(() => noteEarthRead(), [noteEarthRead]);
  return (
    <div className="wrap-earth">
      <p className="wrap-from">MESSAGE FROM EARTH · {m.from}</p>
      <p className="wrap-kid">“{pick(m.question, mode)}”</p>
      <Comms who="luna">{pick(m.answer, mode)}</Comms>
    </div>
  );
}

/** What the child just earned. */
export function Earned({ ids }: { ids: { kind: "patch" | "card"; id: string }[] }) {
  if (ids.length === 0) return null;
  return (
    <ul className="earned" aria-label="Just earned">
      {ids.map((r) => {
        const p = r.kind === "patch" ? PATCHES.find((x) => x.id === r.id) : null;
        const c = r.kind === "card" ? CARDS.find((x) => x.id === r.id) : null;
        const title = p?.title ?? c?.title ?? r.id;
        return (
          <li key={`${r.kind}-${r.id}`} className={cn("earned-item", `earned-${r.kind}`)}>
            {r.kind === "patch" ? <Award size={18} aria-hidden="true" /> : <BookOpen size={18} aria-hidden="true" />}
            <span>
              <b>{r.kind === "patch" ? "New patch" : "New science card"}</b> {title}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * After each mission: one gentle question from mission control, then a message from Earth and what was earned.
 * The question counts as understanding in the skills, but it never blocks and never takes anything away.
 */
export function MissionWrapUp({ mission, onClose }: { mission: MissionKey; onClose: () => void }) {
  const { ageMode, answerReflection, rewards, clearRewards, story } = useGame();
  const mode: AgeMode = ageMode ?? "explorer";
  const [step, setStep] = useState<0 | 1>(0);
  // every finished training moves on to the next question in the pool
  const q = pickQuestion(REFLECTIONS[mission], story.profile.runsFinished);
  useStormVoice(step === 0 ? [pick(q.q, mode)] : null, mode);
  const close = () => {
    clearRewards();
    onClose();
  };
  return (
    <Overlay label="Mission control debrief">
      {step === 0 ? (
        <QuestionCard
          q={q}
          mode={mode}
          extra={mission === "m1" && q === REFLECTIONS.m1[0] ? (done) => <PowerReveal show={done} /> : undefined}
          onResolve={(solved) => answerReflection(mission, solved)}
          onContinue={() => setStep(1)}
        />
      ) : (
        <div className="wrap-q">
          <EarthMessage mission={mission} mode={mode} />
          <Earned ids={rewards} />
          <div className="wrap-actions">
            <Button className="mission-cta" data-primary onClick={close}>
              CONTINUE
            </Button>
          </div>
        </div>
      )}
    </Overlay>
  );
}

/** A quick look back at the start of the next mission. Remembering a little later is real learning. */
export function RecallPrompt({ mission, onClose }: { mission: "m2" | "m3"; onClose: () => void }) {
  const { ageMode, answerRecall, story } = useGame();
  const mode: AgeMode = ageMode ?? "explorer";
  const q = pickQuestion(RECALLS[mission], story.profile.runsFinished);
  useStormVoice([pick(q.q, mode)], mode);
  return (
    <Overlay label="Quick recall">
      <QuestionCard
        q={q}
        mode={mode}
        onResolve={() => answerRecall(mission)}
        onContinue={onClose}
      />
    </Overlay>
  );
}
