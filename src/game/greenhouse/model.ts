import {
  tuningFor,
  waterUsePerStep,
  applyFoodPreset,
  setCabinAir,
  startFoodMission,
  stepMission,
  updateFoodControls,
  type CarryOver,
  type GameState,
  type LightPreset,
} from "@/game/engine";

/**
 * Mission 2 game layer. The engine keeps one continuous water number; the game only ever offers five
 * rungs of it (one step up or down per decision), so there is no slider and no way to dial in an answer.
 */
export const WATER_RUNGS = [20, 36, 52, 68, 84] as const;
export const START_RUNG = 2;
/** The day each growth checkpoint stands for (NASA VEG-05 milestones), used for the time-lapse. */
export const MILESTONE_DAYS = [1, 10, 30, 60, 100] as const;

/** Checkpoints after setup. The last one (FRUIT -> HARVEST) is the ripening beat on top of the engine's Day 100. */
export const CHECKPOINTS = [
  "start",
  "early",
  "mid",
  "flowering",
  "fruit",
  "harvest",
] as const;
export type Checkpoint = (typeof CHECKPOINTS)[number];

export type RootState = "dry" | "balanced" | "buildup";
export type StressLevel = "healthy" | "mild" | "high";
export type LeafState = "upright" | "curled" | "drooping";
export type FlowerState = "open" | "half" | "closed";

export interface PlantView {
  /** 0 seedling, 1 larger plant, 2 growing, 3 flowering, 4 green fruit, 5 ripe. */
  stage: number;
  checkpoint: Checkpoint;
  root: RootState;
  stress: StressLevel;
  leaves: LeafState;
  flower: FlowerState;
  light: "red" | "blue";
  rung: number;
  ripeCount: number;
  rootStressPct: number;
  hydrationPct: number;
  cropHealthPct: number;
  parUmol: number;
  redPct: number;
  bluePct: number;
  cabinRh: number;
  waterLiters: number;
  waterMaxLiters: number;
  batteryPct: number;
  dryAir: boolean;
}

export const rungOf = (waterFlow: number): number => {
  let best = 0;
  WATER_RUNGS.forEach((r, i) => {
    if (Math.abs(r - waterFlow) < Math.abs(WATER_RUNGS[best]! - waterFlow))
      best = i;
  });
  return best;
};

export function stressOf(rootStressPct: number): StressLevel {
  return rootStressPct < 5 ? "healthy" : rootStressPct < 25 ? "mild" : "high";
}

/** `ripened` is the UI-only ripening beat after the engine reaches Day 100. */
export function plantView(sim: GameState, ripened = false): PlantView {
  const g = sim.subSystems.greenhouse;
  const idx = g.milestoneIndex;
  const stage = idx >= 4 ? (ripened ? 5 : 4) : idx;
  const root: RootState = g.overwateringRisk
    ? "buildup"
    : g.prematureDryingRisk
      ? "dry"
      : "balanced";
  const stress = stressOf(g.rootStressPct);
  return {
    stage,
    checkpoint: CHECKPOINTS[stage] ?? "start",
    root,
    stress,
    leaves:
      stress === "healthy"
        ? "upright"
        : stress === "mild"
          ? "curled"
          : "drooping",
    flower:
      stress === "healthy" ? "open" : stress === "mild" ? "half" : "closed",
    light: g.spectralMix.redPct >= 75 ? "red" : "blue",
    rung: rungOf(sim.controls.act2.waterFlow),
    ripeCount: g.estimatedRipeFruits,
    rootStressPct: g.rootStressPct,
    hydrationPct: g.hydrationPct,
    cropHealthPct: g.cropHealthPct,
    parUmol: g.totalParUmolM2s,
    redPct: g.spectralMix.redPct,
    bluePct: g.spectralMix.bluePct,
    cabinRh: sim.carryOver.airOverlayRhPercent ?? sim.carryOver.endRhPercent,
    waterLiters: sim.subSystems.water.reserveLiters,
    waterMaxLiters: sim.subSystems.water.maxLiters,
    batteryPct: sim.subSystems.power.batteryPct,
    dryAir: sim.carryOver.airOverlayRhPercent !== undefined,
  };
}

/**
 * Starts Mission 2 from the last Life Support result (live, else saved, else baseline), with a neutral set-up:
 * red-rich light and the middle water rung.
 */
export function beginGreenhouseSim(
  sim: GameState,
  saved?: Partial<CarryOver> | null,
): GameState {
  const started = startFoodMission(sim, undefined, saved);
  return updateFoodControls(applyFoodPreset(started, "red_rich"), {
    waterFlow: WATER_RUNGS[START_RUNG],
  });
}

export const setWaterRungSim = (sim: GameState, rung: number): GameState =>
  updateFoodControls(sim, {
    waterFlow: WATER_RUNGS[Math.max(0, Math.min(WATER_RUNGS.length - 1, rung))],
  });

export const setLightSim = (sim: GameState, preset: LightPreset): GameState =>
  applyFoodPreset(sim, preset);

/**
 * One manual growth step. Dry air arrives when the plant reaches Early Growth and leaves again at Mid Growth,
 * so the player has to notice, respond and later undo the response.
 */
export function advanceGreenhouseSim(sim: GameState): GameState {
  const next = stepMission(sim);
  if (next === sim || next.meta.failed) return next;
  const idx = next.subSystems.greenhouse.milestoneIndex;
  if (idx === 1) return setCabinAir(next, "dry");
  if (idx === 2) return setCabinAir(next, "normal");
  return next;
}

/** What one decision would cost, shown before the player commits: water used next step and what would be left. */
export function previewWater(sim: GameState, action: WaterAction): { perStep: number; left: number } {
  const rung = nextRung(rungOf(sim.controls.act2.waterFlow), action);
  const perStep = waterUsePerStep(WATER_RUNGS[rung] ?? WATER_RUNGS[START_RUNG], tuningFor(sim.meta.ageBand).waterUse);
  return { perStep, left: Math.max(0, Math.round((sim.subSystems.water.reserveLiters - perStep) * 10) / 10) };
}

/** The decision waiting at Mid Growth, from what the roots look like now. */
export function rootCheck(
  view: Pick<PlantView, "root">,
): "buildup" | "dry" | "ok" {
  return view.root === "buildup" ? "buildup" : view.root === "dry" ? "dry" : "ok";
}

export type WaterAction = "add" | "hold" | "reduce";

export function nextRung(rung: number, action: WaterAction): number {
  const to = action === "add" ? rung + 1 : action === "reduce" ? rung - 1 : rung;
  return Math.max(0, Math.min(WATER_RUNGS.length - 1, to));
}

/** Whether the roots got better, worse or stayed the same after a decision. Used for the short consequence message. */
export function rootChange(
  before: Pick<PlantView, "root" | "rootStressPct">,
  after: Pick<PlantView, "root" | "rootStressPct">,
): "better" | "worse" | "same" {
  if (after.rootStressPct < before.rootStressPct - 0.5) return "better";
  if (after.rootStressPct > before.rootStressPct + 0.5) return "worse";
  return "same";
}

export function healthWord(pct: number): "Thriving" | "Healthy" | "Struggling" {
  return pct >= 78 ? "Thriving" : pct >= 60 ? "Healthy" : "Struggling";
}
export const stressWord = (s: StressLevel): "Low" | "Some" | "High" =>
  s === "healthy" ? "Low" : s === "mild" ? "Some" : "High";
