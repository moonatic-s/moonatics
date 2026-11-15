import { useEffect, useState, useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener?.("change", onChange);
  return () => mq.removeEventListener?.("change", onChange);
}

/** True when the player's system asks for less motion. Every animated scene then shows its finished state at once. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

/**
 * Steps through animation stages: stage 0 immediately, then stage i after `delaysMs[i - 1]` more milliseconds.
 * Changing `replayKey` restarts from stage 0. With reduced motion it jumps straight to the last stage.
 */
export function useStages(
  delaysMs: readonly number[],
  replayKey: unknown = 0,
): number {
  const reduced = usePrefersReducedMotion();
  const last = delaysMs.length;
  const [stage, setStage] = useState(reduced ? last : 0);

  useEffect(() => {
    if (reduced) {
      setStage(last);
      return;
    }
    setStage(0);
    const timers: number[] = [];
    let at = 0;
    delaysMs.forEach((delay, i) => {
      at += delay;
      timers.push(window.setTimeout(() => setStage(i + 1), at));
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
    // delaysMs is a constant array per scene; replayKey and reduced are the real triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayKey, reduced, last]);

  return stage;
}
