/**
 * Positive feedback for Act 1: streaks and mission patches earned from the checkpoint history.
 * Purely visual rewards. Nothing here feeds back into the simulation.
 */
import type { Act1Checkpoint } from "@/game/engine";

export type BadgeId =
  "AIR_KEEPER" | "POWER_SAVER" | "BALANCE_MASTER" | "WATER_WATCHER";
export const BADGE_IDS: readonly BadgeId[] = [
  "AIR_KEEPER",
  "POWER_SAVER",
  "BALANCE_MASTER",
  "WATER_WATCHER",
];

export type Cheer =
  | { kind: "recovery" }
  | { kind: "streak"; count: number }
  | { kind: "efficient" };

/** Start of the mission: the tank begins at 70% (42 of 60 L), so "topped up" means getting back to that. */
const TANK_TOPPED_UP_PCT = 70;

const longestRun = (
  history: readonly Act1Checkpoint[],
  test: (c: Act1Checkpoint) => boolean,
) => {
  let best = 0;
  let run = 0;
  for (const c of history) {
    run = test(c) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
};

/** How many of the latest checkpoints in a row were stable. */
export function currentStableStreak(
  history: readonly Act1Checkpoint[],
): number {
  let n = 0;
  for (let i = history.length - 1; i >= 0 && history[i]?.stable; i -= 1) n += 1;
  return n;
}

export function evaluateBadges(
  history: readonly Act1Checkpoint[],
): Record<BadgeId, boolean> {
  return {
    AIR_KEEPER: longestRun(history, (c) => c.airOk) >= 3,
    POWER_SAVER: longestRun(history, (c) => c.netKw >= 0) >= 3,
    BALANCE_MASTER: longestRun(history, (c) => c.stable) >= 4,
    WATER_WATCHER: history.some(
      (c, i) => i >= 3 && c.tankPct >= TANK_TOPPED_UP_PCT,
    ),
  };
}

/** The one short cheer that fits the latest checkpoint, or null when there is nothing to celebrate. */
export function latestCheer(history: readonly Act1Checkpoint[]): Cheer | null {
  const last = history[history.length - 1];
  if (!last || !last.stable) return null;
  const previous = history[history.length - 2];
  if (previous && !previous.stable) return { kind: "recovery" };
  const streak = currentStableStreak(history);
  if (streak >= 3) return { kind: "streak", count: streak };
  if (last.netKw >= 0 && previous && previous.netKw >= 0)
    return { kind: "efficient" };
  return null;
}
