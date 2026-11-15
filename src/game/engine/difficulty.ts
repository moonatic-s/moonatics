import type { AgeBand } from "./types";

/**
 * Difficulty is a set of numbers, never different rules. Explorer (7-9) keeps the forgiving margins;
 * Mission Specialist (10-12) plays the same game with tighter budgets.
 */
export interface Tuning {
  /** Multiplier on the greenhouse water used each step. */
  waterUse: number;
  /** Storm power blocks added (negative: removed) when the storm starts. */
  stormBudgetOffset: number;
  /** Multiplier on the simulated crew dose limit. */
  doseLimitScale: number;
}

export const TUNING: Readonly<Record<AgeBand, Tuning>> = Object.freeze({
  "7-9": { waterUse: 1, stormBudgetOffset: 0, doseLimitScale: 1 },
  "10-12": { waterUse: 1.25, stormBudgetOffset: -1, doseLimitScale: 0.9 },
});

export const tuningFor = (ageBand: AgeBand): Tuning => TUNING[ageBand] ?? TUNING["10-12"];
export const BASE_DOSE_LIMIT_UGY = 55000;
export const doseLimitFor = (ageBand: AgeBand): number => BASE_DOSE_LIMIT_UGY * tuningFor(ageBand).doseLimitScale;
