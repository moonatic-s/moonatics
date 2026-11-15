/**
 * The numbers the Life Support briefing shows. Everything comes from the real simulation, computed with the same
 * functions the game uses, so the briefing never invents a measurement and can never drift from the game.
 */
import {
  ACT1_HOUR_STRIDE,
  createGameState,
  getLifeSupportBreakdown,
  updateLifeSupportControls,
} from "@/game/engine";

export interface BriefingData {
  /** NASA's observed CO₂ at the mission start (ppm). It never changes in the briefing. */
  nasaCo2: number;
  /** What the simulated habitat reads after the scrubbers are raised (ppm). */
  habitatCo2: number;
  scrubbersFrom: number;
  scrubbersTo: number;
  /** Battery before, and after one day with every system at maximum (%). */
  batteryStart: number;
  batteryEnd: number;
}

/** Length of the fade into the live console. Short on purpose; skipping is even quicker. */
export const LEAVE_MS = 600;
export const SKIP_LEAVE_MS = 250;

/** Example lever position for the NASA-vs-simulation scene: a clear change that stays clear of the sensor floor. */
const SCRUBBERS_TO = 65;

export function buildBriefingData(): BriefingData {
  const start = createGameState();
  const nasaCo2 = getLifeSupportBreakdown(start).baseline.co2Ppm;
  const raised = updateLifeSupportControls(start, {
    airFiltration: SCRUBBERS_TO,
  });
  const maxed = updateLifeSupportControls(start, {
    airFiltration: 100,
    climateControl: 100,
    waterRecovery: 100,
  });
  const perStep = getLifeSupportBreakdown(maxed).power.batteryDeltaPerStep;
  const stepsInADay = 24 / ACT1_HOUR_STRIDE;
  const batteryStart = start.subSystems.power.batteryPct;
  return {
    nasaCo2,
    habitatCo2: raised.subSystems.cabin.co2Ppm,
    scrubbersFrom: start.controls.act1.airFiltration,
    scrubbersTo: SCRUBBERS_TO,
    batteryStart,
    batteryEnd: Math.max(
      8,
      Math.min(100, batteryStart + perStep * stepsInADay),
    ),
  };
}
