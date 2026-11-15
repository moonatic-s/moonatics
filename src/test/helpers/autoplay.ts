/**
 * Test helpers that play Act 1 the way a thoughtful player would: before every checkpoint, pick the cheapest
 * lever setting that keeps air, temperature and humidity in the safe zone for the next 6 hours.
 */
import {
  advanceAct,
  createGameState,
  forecastNextStep,
  isActComplete,
  setAgeBand,
  stepMission,
  updateLifeSupportControls,
  type AgeBand,
  type GameState,
} from "@/game/engine";
import { unsafeEnterAct } from "@/game/engine/mission";

const GRID = [0, 20, 40, 50, 60, 80, 100];

const safeCount = (s: GameState) => {
  const z = s.subSystems.cabin.zones;
  return [z.co2, z.temperature, z.humidity].filter((v) => v === "SAFE").length;
};

/** Best lever setting for the next step: most safe readings, then least power drawn. */
export function bestLevers(state: GameState) {
  let best = { air: 50, heat: 50, water: 50, safe: -1, kw: Infinity };
  for (const air of GRID)
    for (const heat of GRID)
      for (const water of GRID) {
        const trial = updateLifeSupportControls(state, {
          airFiltration: air,
          climateControl: heat,
          waterRecovery: water,
        });
        const next = forecastNextStep(trial);
        if (!next || next.meta.failed) continue;
        const safe = safeCount(next);
        const kw = trial.subSystems.power.demandKw;
        if (safe > best.safe || (safe === best.safe && kw < best.kw))
          best = { air, heat, water, safe, kw };
      }
  return best;
}

/** Plays every Act 1 checkpoint with sensible levers. Returns the finished (not yet advanced) Act 1 state. */
export function playAct1Well(start: GameState = createGameState()): GameState {
  let s = start;
  while (!s.meta.failed && !isActComplete(s)) {
    const b = bestLevers(s);
    s = updateLifeSupportControls(s, {
      airFiltration: b.air,
      climateControl: b.heat,
      waterRecovery: b.water,
    });
    s = stepMission(s);
  }
  return s;
}

/**
 * Plays the first N Act 1 checkpoints well, then sets the best levers for the NEXT checkpoint without stepping,
 * so a UI test can press Advance itself for the final one(s).
 */
export function playAct1Until(
  steps: number,
  start: GameState = createGameState(),
): GameState {
  let s = start;
  for (let i = 0; i < steps; i += 1) {
    const b = bestLevers(s);
    s = stepMission(
      updateLifeSupportControls(s, {
        airFiltration: b.air,
        climateControl: b.heat,
        waterRecovery: b.water,
      }),
    );
  }
  const b = bestLevers(s);
  return updateLifeSupportControls(s, {
    airFiltration: b.air,
    climateControl: b.heat,
    waterRecovery: b.water,
  });
}

/** Plays Act 1 by pressing Advance and nothing else. */
export function playAct1Idle(start: GameState = createGameState()): GameState {
  let s = start;
  while (!s.meta.failed && !isActComplete(s)) s = stepMission(s);
  return s;
}

let cachedAct2: GameState | null = null;

/** A real, earned Act 2 start (Act 1 played well, then advanced through the real gate). Cached: states are immutable. */
export function earnedAct2(ageBand: AgeBand = "10-12"): GameState {
  cachedAct2 ??= advanceAct(playAct1Well(), 2);
  return ageBand === "10-12" ? cachedAct2 : setAgeBand(cachedAct2, ageBand);
}

/** Debug jump into Act 2 that skips the Act 1 objective. For tests of Act 2+ behaviour only. */
export const jumpToAct2 = (state: GameState = createGameState()): GameState =>
  unsafeEnterAct(state, 2);
