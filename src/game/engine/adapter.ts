/**
 * Bridge between the simulation engine (3 core bars, 0-100 sliders, '7-9' | '10-12' age bands)
 * and the Moonatics UI vocabulary (4 HUD bars, 'explorer' | 'specialist' modes).
 * The UI should only read engine state through these helpers, so presentation can change without touching the sim.
 */
import type { AgeMode } from "../state";
import type { AgeBand, GameState } from "./types";
import { clamp, roundTo } from "./util";

export const AGE_MODE_TO_BAND: Readonly<Record<AgeMode, AgeBand>> =
  Object.freeze({
    explorer: "7-9",
    specialist: "10-12",
  });

export const AGE_BAND_TO_MODE: Readonly<Record<AgeBand, AgeMode>> =
  Object.freeze({
    "7-9": "explorer",
    "10-12": "specialist",
  });

/** The four HUD bars the UI shows. All values are 0-100. */
export interface HudResources {
  power: number;
  water: number;
  food: number;
  crewSafety: number;
}

/**
 * - power: battery charge (%).
 * - water: shared reserve as a share of tank capacity.
 * - food: the Food Production core bar.
 * - crewSafety: cabin habitability in Acts 1-2, and the Radiation Shielding core bar once the storm starts.
 */
export function toHudResources(state: GameState): HudResources {
  const { power, water, cabin } = state.subSystems;
  const stormActive = state.meta.currentAct >= 3;
  return {
    power: Math.round(clamp(power.batteryPct, 0, 100)),
    water: Math.round(
      clamp((water.reserveLiters / water.maxLiters) * 100, 0, 100),
    ),
    food: Math.round(clamp(state.resources.foodProduction, 0, 100)),
    crewSafety: Math.round(
      clamp(
        stormActive
          ? state.resources.radiationShielding
          : cabin.habitabilityScore,
        0,
        100,
      ),
    ),
  };
}

/** Snapshot shaped like the prototype's `LifeSupportState` (minus chart history, which the UI keeps itself). */
export interface LifeSupportView {
  tick: number;
  co2: number;
  temperature: number;
  humidity: number;
  power: number;
  water: number;
  safety: number;
}

export function toLifeSupportView(state: GameState): LifeSupportView {
  const hud = toHudResources(state);
  const { cabin } = state.subSystems;
  return {
    tick: state.meta.tickCount,
    co2: cabin.co2Ppm,
    temperature: cabin.temperatureDegC,
    humidity: cabin.relativeHumidityPct,
    power: hud.power,
    water: hud.water,
    safety: hud.crewSafety,
  };
}

/** What changed between two Life Support readings (after minus before). */
export interface StepChange {
  co2Ppm: number;
  temperatureDegC: number;
  humidityPct: number;
  batteryPct: number;
  waterLiters: number;
}

export function summarizeStep(before: GameState, after: GameState): StepChange {
  const b = before.subSystems;
  const a = after.subSystems;
  return {
    co2Ppm: Math.round(a.cabin.co2Ppm - b.cabin.co2Ppm),
    temperatureDegC: roundTo(
      a.cabin.temperatureDegC - b.cabin.temperatureDegC,
      1,
    ),
    humidityPct: roundTo(
      a.cabin.relativeHumidityPct - b.cabin.relativeHumidityPct,
      1,
    ),
    batteryPct: roundTo(a.power.batteryPct - b.power.batteryPct, 1),
    waterLiters: roundTo(a.water.reserveLiters - b.water.reserveLiters, 1),
  };
}
