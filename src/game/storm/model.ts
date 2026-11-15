import {
  DEFAULT_NASA_DATASETS,
  SEP_DEMAND_KW,
  type GameState,
  type ShieldItem,
} from "@/game/engine";

/** The mission's screens. Each is one idea; the flow strip groups them as DETECT > PREPARE > SHELTER > PRIORITIZE > SURVIVE. */
export type StormPhase = "detect" | "prepare" | "cme" | "sep" | "route" | "storm" | "debrief";
export const FLOW_INDEX: Record<StormPhase, number> = {
  detect: 0,
  prepare: 1,
  cme: 1,
  sep: 2,
  route: 3,
  storm: 4,
  debrief: 4,
};

/** NASA CRaTER-D1D2 series (as bundled). This is OBSERVED data; nothing here is invented. */
export const SERIES = DEFAULT_NASA_DATASETS.radiation.radiation_series;
export const STORM_START = Math.max(
  0,
  SERIES.findIndex((r) => r.time >= "2024-06-08T00:00:00Z"),
);
export const PEAK_INDEX = SERIES.reduce(
  (best, r, i) =>
    r.mean_absorbed_dose_rate_uGy_h > SERIES[best]!.mean_absorbed_dose_rate_uGy_h ? i : best,
  STORM_START,
);
export const PEAK_RATE = SERIES[PEAK_INDEX]!.mean_absorbed_dose_rate_uGy_h;

export type RadiationWord = "low" | "rising" | "high" | "falling";

/** Plain words for the outside radiation (NASA data): relative to the storm's own peak. */
export function radiationWord(index: number): RadiationWord {
  const rate = SERIES[Math.min(index, SERIES.length - 1)]!.mean_absorbed_dose_rate_uGy_h;
  const share = rate / PEAK_RATE;
  if (share < 0.02) return "low";
  if (index < PEAK_INDEX) return share >= 0.35 ? "high" : "rising";
  return share >= 0.5 ? "high" : "falling";
}

/** 0 (quiet) .. 1 (the peak): drives how many particles are drawn outside. Visual only. */
export const particleLevel = (index: number): number =>
  Math.min(1, Math.sqrt(SERIES[Math.min(index, SERIES.length - 1)]!.mean_absorbed_dose_rate_uGy_h / PEAK_RATE));

/** Observed samples from the storm start up to `index`, scaled 0..1 for a simple graph. */
export function graphPoints(index: number): { x: number; y: number }[] {
  const end = SERIES.length - 1;
  const pts: { x: number; y: number }[] = [];
  for (let i = STORM_START; i <= Math.min(index, end); i += 1) {
    pts.push({
      x: (i - STORM_START) / (end - STORM_START),
      y: Math.sqrt(SERIES[i]!.mean_absorbed_dose_rate_uGy_h / PEAK_RATE),
    });
  }
  return pts;
}

export const ENTERING_LEVELS = 5;
/** How much simulated radiation gets into the shelter: 0 very low .. 4 very high. */
export function enteringLevel(attenuation: number): number {
  const entering = 1 - attenuation;
  return entering < 0.15 ? 0 : entering < 0.3 ? 1 : entering < 0.45 ? 2 : entering < 0.6 ? 3 : 4;
}

export const STREAKS = 12;
/** How many of the drawn particles get inside: the rest stop at the shielding. */
export const passingStreaks = (attenuation: number, level = 1): number =>
  Math.round(STREAKS * (1 - attenuation) * (0.55 + 0.45 * level));

export interface PowerView {
  budget: number;
  alloc: { shelterKw: number; cabinKw: number; greenhouseKw: number };
  used: number;
  free: number;
}
export function powerView(sim: GameState): PowerView {
  const alloc = sim.controls.act3.sepPowerAlloc;
  const budget = sim.subSystems.power.stormBudgetKw;
  const used = alloc.shelterKw + alloc.cabinKw + alloc.greenhouseKw;
  return { budget, alloc, used, free: Math.max(0, budget - used) };
}

export const SYSTEM_CAP = {
  shelterKw: SEP_DEMAND_KW.shelterKw,
  cabinKw: SEP_DEMAND_KW.cabinKw,
  greenhouseKw: SEP_DEMAND_KW.greenhouseKw,
} as const;

export interface StormStatus {
  attenuation: number;
  holding: boolean;
  systemsPct: number;
  co2Rising: boolean;
  co2Ppm: number;
  greenhousePowerLow: boolean;
  /** 0..1 brightness for the grow lights, from the power the greenhouse got. */
  growLight: number;
  crewDoseUGy: number;
  outsideRate: number;
  index: number;
  peakSeen: boolean;
  complete: boolean;
  arraysProtected: boolean;
  shelterCounts: Record<ShieldItem, number>;
  batteryPct: number;
  foodScore: number;
  cropHealthPct: number;
}

export function stormStatus(sim: GameState): StormStatus {
  const rad = sim.subSystems.radiation;
  const a = sim.controls.act3;
  const counts: Record<ShieldItem, number> = { water: 0, supply: 0, equipment: 0 };
  a.shelter.forEach((s) => {
    if (s) counts[s] += 1;
  });
  return {
    attenuation: rad.shieldAttenuationFactor,
    holding: rad.shieldAttenuationFactor >= 0.6,
    systemsPct: rad.shelterSystemsPct,
    co2Rising: a.sepPowerAlloc.cabinKw < 3,
    co2Ppm: sim.subSystems.cabin.co2Ppm,
    greenhousePowerLow: a.sepPowerAlloc.greenhouseKw < SEP_DEMAND_KW.greenhouseKw,
    growLight: Math.max(0.15, a.sepPowerAlloc.greenhouseKw / SEP_DEMAND_KW.greenhouseKw),
    crewDoseUGy: rad.cumulativeCrewDoseUGy,
    outsideRate: rad.externalDoseUGyH,
    index: rad.radSeriesIndex,
    peakSeen: rad.radSeriesIndex >= PEAK_INDEX,
    complete: rad.stormComplete,
    arraysProtected: a.cmeRetractArrays,
    shelterCounts: counts,
    batteryPct: sim.subSystems.power.batteryPct,
    foodScore: sim.resources.foodProduction,
    cropHealthPct: sim.subSystems.greenhouse.cropHealthPct,
  };
}

/** A plain word for a 0-100 score. */
export const scoreWord = (pct: number): "good" | "fair" | "low" =>
  pct >= 70 ? "good" : pct >= 45 ? "fair" : "low";
