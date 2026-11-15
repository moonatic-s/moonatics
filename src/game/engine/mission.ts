/**
 * Global Coupled Game State & Pause/Step Simulation Engine
 * Wires bundled NASA datasets (RR-28, OSD-766/767, DONKI + CRaTER-D1D2) through:
 *   NASA JSON -> global gameState -> coupled resource calculations -> Act 1 / Act 2 / Act 3
 * Designed without countdown timers (100% Pause / Step friendly for ages 7-12).
 */

import lifeSupportJson from "../data/life-support.json";
import foodJson from "../data/food.json";
import radiationJson from "../data/radiation.json";

import type {
  Act1Checkpoint,
  ActNumber,
  AgeBand,
  Act3Controls,
  CarryOver,
  EventLogEntry,
  GameState,
  GameStateSnapshot,
  LightPreset,
  MissionFailure,
  NasaDatasets,
  Resources,
  PowerSystem,
  SepAllocation,
  ShieldItem,
} from "./types";
import { doseLimitFor, tuningFor } from "./difficulty";
import { at, clamp, roundTo, toNum } from "./util";

import {
  ACT1_HOUR_STRIDE,
  ACT1_REQUIRED_STABLE,
  getAct1MaxSteps,
  buildInitialLifeSupportState,
  evaluateLifeSupport,
  stepLifeSupportTick,
  captureLifeSupportCarryOver,
} from "./life-support";

import {
  buildInitialFoodState,
  evaluateFoodProduction,
  getVeg05PresetControls,
  stepFoodTick,
  captureFoodCarryOver,
} from "./food";

import {
  stormPhaseName,
  SEP_DEMAND_KW,
  computeAvailableStormKw,
  buildInitialRadiationState,
  computeShelterInventory,
  autoStowShelter,
  normalizeShelter,
  evaluateRadiationCouplings,
  transitionStormPhase,
  stepRadiationTick,
} from "./radiation";

export const DEFAULT_NASA_DATASETS: Readonly<NasaDatasets> = Object.freeze({
  lifeSupport: lifeSupportJson as NasaDatasets["lifeSupport"],
  food: foodJson as unknown as NasaDatasets["food"],
  radiation: radiationJson as NasaDatasets["radiation"],
});

export const ROLES_BY_ACT: Readonly<
  Record<ActNumber, Readonly<Record<AgeBand, string>>>
> = Object.freeze({
  1: { "7-9": "Cabin Caretaker", "10-12": "Environmental Control Officer" },
  2: { "7-9": "Space Gardener", "10-12": "Botanical Systems Lead" },
  3: {
    "7-9": "Storm Shield Captain",
    "10-12": "Radiation Operations Commander",
  },
  4: { "7-9": "Junior Lunar Graduate", "10-12": "Mission Telemetry Analyst" },
});

const MAX_LOG_ENTRIES = 30;

/**
 * Game-balance failure thresholds (NOT medical limits). They make "no choice is free" real:
 * an unmanaged outpost can fail, and a failed Act can be retried from its checkpoint.
 *  - batteryPct: total blackout risk (battery floor in the sim is 8-12%).
 *  - co2Ppm: OSHA 8-hour exposure ceiling (5,000 ppm); RR-28 ISS telemetry peaked far higher on an actively scrubbed station.
 *  - cropHealthPct: greenhouse collapse (crop model floors near 15%).
 *  - crewDoseUGy: scaled game threshold inspired by NASA's 30-day crew dose limits for a short 3-day storm window.
 */
export const MISSION_FAILURE_LIMITS = Object.freeze({
  batteryPct: 10,
  co2Ppm: 5000,
  cropHealthPct: 15,
  crewDoseUGy: 55000,
});

// "Mission Ready" requires strong storm shelter priority plus balanced Act 1-2 air/food stewardship.
const READY_AVERAGE_SCORE = 82;

const isLocked = (state: GameStateSnapshot): boolean =>
  Boolean(state.meta.failed || state.meta.completed);

function appendLog(
  state: GameStateSnapshot,
  code: string,
  summary: string,
): EventLogEntry[] {
  const entry: EventLogEntry = {
    tick: state.meta.tickCount,
    act: state.meta.currentAct,
    code,
    summary,
  };
  const nextLog = [...state.eventLog, entry];
  return nextLog.length > MAX_LOG_ENTRIES
    ? nextLog.slice(nextLog.length - MAX_LOG_ENTRIES)
    : nextLog;
}

function getRoleTitle(act: number, ageBand: AgeBand): string {
  const actRoles = ROLES_BY_ACT[act as ActNumber] ?? ROLES_BY_ACT[1];
  return actRoles[ageBand] ?? actRoles["10-12"];
}

/**
 * Recompute Act 3 coupled metrics & 3 core resource bars deterministically from current Act 3 controls.
 */
function applyAct3Couplings(
  state: GameState,
  nextAct3Controls: Act3Controls,
  code?: string,
  logSummary?: string,
): GameState {
  const evalRes = evaluateRadiationCouplings(
    nextAct3Controls,
    state.subSystems.radiation,
    state.carryOver,
    state.subSystems.cabin,
    state.carryOver.cropHealthAtStormPct ?? state.resources.foodProduction,
  );

  const normalizedControls = {
    ...nextAct3Controls,
    sepPowerAlloc: evalRes.alloc,
    shelter: evalRes.shelter,
  };

  const nextState: GameState = {
    ...state,
    controls: {
      ...state.controls,
      act3: normalizedControls,
    },
    resources: {
      powerLifeSupport: evalRes.coupledPowerScore,
      foodProduction: evalRes.coupledFoodScore,
      radiationShielding: evalRes.radiationShieldingScore,
    },
    subSystems: {
      ...state.subSystems,
      power: {
        ...state.subSystems.power,
        stormBudgetKw: evalRes.budgetKw,
      },
      cabin: {
        ...state.subSystems.cabin,
        co2Ppm: evalRes.stormCo2Ppm,
        temperatureDegC: evalRes.stormTempDegC,
      },
      radiation: {
        ...state.subSystems.radiation,
        shieldAttenuationFactor: evalRes.shieldAttenuationFactor,
        shieldReadinessPct: evalRes.shieldReadinessPct,
        shelterUnits: evalRes.shelterUnits,
        shelterSystemsPct: evalRes.shelterSystemsPct,
        solarArrayIntegrityPct: evalRes.solarArrayIntegrityPct,
      },
    },
  };

  return code
    ? { ...nextState, eventLog: appendLog(nextState, code, logSummary ?? code) }
    : nextState;
}

/**
 * Create a fresh coupled Outpost state hydrated from the bundled NASA JSON datasets.
 */
export interface CreateGameOptions {
  ageBand?: AgeBand | string;
  paused?: boolean;
  datasets?: NasaDatasets;
}

export function createGameState(options: CreateGameOptions = {}): GameState {
  const ageBand: AgeBand = options.ageBand === "7-9" ? "7-9" : "10-12";
  const paused = options.paused ?? true;
  const datasets = options.datasets ?? DEFAULT_NASA_DATASETS;

  const lifeInit = buildInitialLifeSupportState(datasets.lifeSupport);
  const initialLifeEval = evaluateLifeSupport(
    lifeInit.controls,
    lifeInit.cabin.rawSample,
    lifeInit.power,
    lifeInit.water,
  );

  const initialCarryOver: CarryOver = {
    endCo2Ppm: lifeInit.cabin.co2Ppm,
    endTempC: lifeInit.cabin.temperatureDegC,
    endRhPercent: lifeInit.cabin.relativeHumidityPct,
    dryCabinAirRisk: lifeInit.cabin.dryCabinAirRisk,
    act1BatteryCarryPct: lifeInit.power.batteryPct,
    act1WaterCarryLiters: lifeInit.water.reserveLiters,
    act2BatteryCarryPct: lifeInit.power.batteryPct,
    stormAvailableKwBudget: 8,
    cropHealthAtStormPct: 72,
    cropVulnerability: "RESILIENT",
    harvestRipeFruits: 0,
  };

  const foodInit = buildInitialFoodState(
    datasets.food,
    initialCarryOver,
    lifeInit.power,
    lifeInit.water,
  );
  const carryWithFood: CarryOver = {
    ...initialCarryOver,
    cropHealthAtStormPct: foodInit.greenhouse.cropHealthPct,
    harvestRipeFruits: foodInit.greenhouse.estimatedRipeFruits,
  };

  const radInit = buildInitialRadiationState(
    datasets.radiation,
    carryWithFood,
    computeShelterInventory(lifeInit.water, carryWithFood),
  );
  const radEval = evaluateRadiationCouplings(
    radInit.controls,
    radInit.radiation,
    carryWithFood,
    lifeInit.cabin,
    foodInit.foodProductionScore,
  );

  const initialState: GameStateSnapshot = {
    meta: {
      currentAct: 1,
      ageBand,
      roleTitle: getRoleTitle(1, ageBand),
      tickCount: 0,
      act1StepsCompleted: 0,
      act2StepsCompleted: 0,
      act3StepsCompleted: 0,
      completed: false,
      failed: false,
      failure: null,
      attempts: 1,
      act1History: [],
    },
    simulation: {
      paused: Boolean(paused),
      mode: "MANUAL_STEP",
    },
    resources: {
      powerLifeSupport: Math.round(lifeInit.powerLifeSupportScore),
      foodProduction: Math.round(foodInit.foodProductionScore),
      radiationShielding: radEval.radiationShieldingScore,
    },
    controls: {
      act1: lifeInit.controls,
      act2: foodInit.controls,
      act3: {
        ...radInit.controls,
        sepPowerAlloc: radEval.alloc,
      },
    },
    subSystems: {
      power: {
        ...lifeInit.power,
        generationKw: initialLifeEval.generationKw,
        demandKw: initialLifeEval.demandKw,
        netKw: initialLifeEval.netKw,
      },
      water: lifeInit.water,
      cabin: lifeInit.cabin,
      greenhouse: foodInit.greenhouse,
      radiation: {
        ...radInit.radiation,
        shieldAttenuationFactor: radEval.shieldAttenuationFactor,
        shieldReadinessPct: radEval.shieldReadinessPct,
        solarArrayIntegrityPct: radEval.solarArrayIntegrityPct,
      },
    },
    carryOver: carryWithFood,
    eventLog: [
      {
        tick: 0,
        act: 1,
        code: "MISSION_INIT",
        summary:
          "Lunar Outpost online. Quiet radiation ~4.8 uGy/h; OSDR RR-28 cabin telemetry active.",
      },
    ],
  };
  // Act-entry snapshots let a failed Act be retried without replaying the whole mission.
  return { ...initialState, checkpoints: { 1: initialState } };
}

/**
 * Return null while the outpost is survivable, or a failure descriptor once a limit is crossed.
 * Only evaluated on Step / Act transitions so dragging a slider to explore never ends the game.
 */
export function evaluateMissionFailure(
  state: GameStateSnapshot,
  datasets: NasaDatasets = DEFAULT_NASA_DATASETS,
): MissionFailure | null {
  const { power, cabin, greenhouse, radiation } = state.subSystems;
  const act = state.meta.currentAct;
  const L = MISSION_FAILURE_LIMITS;
  const base = { act, tick: state.meta.tickCount };

  if (act >= 1 && act <= 2 && power.batteryPct <= L.batteryPct) {
    return {
      ...base,
      code: "POWER_BLACKOUT",
      title: "Battery ran flat",
      lesson:
        "Life support and grow lights both draw power. Running everything at full blast drains the battery faster than the solar arrays recharge it.",
    };
  }
  if (act >= 1 && act <= 3 && cabin.co2Ppm >= L.co2Ppm) {
    return {
      ...base,
      code: "CABIN_AIR_UNSAFE",
      title: "Cabin air became unsafe",
      lesson:
        "CO2 builds up when the scrubbers slow down. Saving scrubber power is a trade-off, because the crew breathes that air.",
    };
  }
  if (act === 1) {
    const objective = getAct1Objective(state, datasets);
    if (objective.complete && !objective.passed) {
      return {
        ...base,
        code: "HABITAT_UNSTABLE",
        title: "The habitat wasn't stable enough",
        lesson: `Air, temperature and humidity were all in the safe zone at only ${objective.stable} of ${objective.total} checkpoints. You need ${objective.required}. When a gauge drifts, use its lever, and watch the power budget while you do.`,
      };
    }
  }
  if (act === 2 && greenhouse.cropHealthPct <= L.cropHealthPct) {
    return {
      ...base,
      code: "CROPS_FAILED",
      title: "The greenhouse crops collapsed",
      lesson:
        "Plants need the right water and light. Too little or too much stresses roots and leaves, as in the real VEG-05 tomato experiment.",
    };
  }
  if (act === 3 && radiation.cumulativeCrewDoseUGy >= doseLimitFor(state.meta.ageBand)) {
    return {
      ...base,
      code: "RADIATION_OVEREXPOSURE",
      title: "The crew absorbed too much radiation",
      lesson:
        "Material placed around the shelter is what reduces the radiation that reaches the crew. With too little shielding, too much simulated radiation got in. Try placing more water and supplies around the shelter.",
    };
  }
  return null;
}

function markFailed(state: GameState, failure: MissionFailure): GameState {
  const failed = { ...state, meta: { ...state.meta, failed: true, failure } };
  return {
    ...failed,
    eventLog: appendLog(
      failed,
      "MISSION_FAILED",
      `${failure.title}. ${failure.lesson}`,
    ),
  };
}

/**
 * Whether the current Act has reached its natural end (Act 1: RR-28 window; Act 2: Day 100; Act 3: CRaTER window).
 */
export function isActComplete(
  state: GameStateSnapshot,
  datasets: NasaDatasets = DEFAULT_NASA_DATASETS,
): boolean {
  switch (state.meta.currentAct) {
    case 1:
      return (
        state.meta.act1StepsCompleted >= getAct1MaxSteps(datasets.lifeSupport)
      );
    case 2:
      return state.subSystems.greenhouse.day >= 100;
    case 3:
      return Boolean(state.subSystems.radiation.stormComplete);
    default:
      return true;
  }
}

/**
 * Tell the UI whether "Next Act" is allowed and, if not, why.
 */
export interface AdvanceStatus {
  canAdvance: boolean;
  nextAct: ActNumber | null;
  reason: string | null;
}

/** Progress against the Act 1 pass rule: keep the habitat stable on enough of the 8 checkpoints. */
export function getAct1Objective(
  state: GameStateSnapshot,
  datasets: NasaDatasets = DEFAULT_NASA_DATASETS,
) {
  const total = getAct1MaxSteps(datasets.lifeSupport);
  const done = state.meta.act1StepsCompleted;
  const stable = state.meta.act1History.filter((c) => c.stable).length;
  const complete = done >= total;
  return {
    total,
    done,
    stable,
    required: ACT1_REQUIRED_STABLE,
    complete,
    passed: complete && stable >= ACT1_REQUIRED_STABLE,
    /** Can the remaining checkpoints still reach the required count? */
    reachable: stable + (total - done) >= ACT1_REQUIRED_STABLE,
  };
}

export function getAdvanceStatus(state: GameStateSnapshot): AdvanceStatus {
  const act = state.meta.currentAct;
  if (state.meta.failed)
    return {
      canAdvance: false,
      nextAct: null,
      reason: "Mission failed. Retry this Act to continue.",
    };
  if (state.meta.completed || act >= 4)
    return {
      canAdvance: false,
      nextAct: null,
      reason: "Mission already complete.",
    };
  if (act === 1) {
    const objective = getAct1Objective(state);
    if (!objective.complete) {
      return {
        canAdvance: false,
        nextAct: 2,
        reason: `Play all ${objective.total} checkpoints first (${objective.done} done).`,
      };
    }
    if (!objective.passed) {
      return {
        canAdvance: false,
        nextAct: 2,
        reason: `Keep the habitat stable on at least ${objective.required} checkpoints to move on.`,
      };
    }
  }
  if (act === 2 && state.subSystems.greenhouse.day < 100) {
    return {
      canAdvance: false,
      nextAct: 3,
      reason: "Grow the tomatoes to Day 100 before the storm arrives.",
    };
  }
  if (act === 3 && !state.subSystems.radiation.stormComplete) {
    return {
      canAdvance: false,
      nextAct: 4,
      reason: "Ride out the storm to the end of the CRaTER data window.",
    };
  }
  return { canAdvance: true, nextAct: (act + 1) as ActNumber, reason: null };
}

/**
 * Restart a failed Act from its entry checkpoint (attempt counter keeps the learning visible, no penalty).
 */
export function retryAct(state: GameState): GameState {
  if (!state.meta.failed) return state;
  const act = state.meta.currentAct;
  const checkpoint = state.checkpoints?.[act];
  if (!checkpoint) return state;
  const restored = {
    ...checkpoint,
    meta: {
      ...checkpoint.meta,
      ageBand: state.meta.ageBand,
      roleTitle: getRoleTitle(act, state.meta.ageBand),
      attempts: state.meta.attempts + 1,
    },
    simulation: state.simulation,
    checkpoints: state.checkpoints,
  };
  return {
    ...restored,
    eventLog: appendLog(
      restored,
      "ACT_RETRY",
      `Retrying Act ${act} (attempt ${restored.meta.attempts}). Try a different balance this time.`,
    ),
  };
}

/**
 * Toggle Pause / Step execution flag (no background countdown timers used).
 */
export function togglePaused(
  state: GameState,
  forcedPaused?: boolean,
): GameState {
  const nextPaused =
    typeof forcedPaused === "boolean" ? forcedPaused : !state.simulation.paused;
  return {
    ...state,
    simulation: {
      ...state.simulation,
      paused: nextPaused,
    },
  };
}

/**
 * Switch reading/telemetry presentation between '7-9' and '10-12' without resetting mission progress.
 */
export function setAgeBand(
  state: GameState,
  nextAgeBand: AgeBand | string,
): GameState {
  const normalizedBand = nextAgeBand === "7-9" ? "7-9" : "10-12";
  return {
    ...state,
    meta: {
      ...state.meta,
      ageBand: normalizedBand,
      roleTitle: getRoleTitle(state.meta.currentAct, normalizedBand),
    },
  };
}

/**
 * Live Act 1 slider update: recomputes CO2, Temp, RH, Safe Zones, net kW, and Act 2 drying preview.
 */
export function updateLifeSupportControls(
  state: GameState,
  patch: Partial<Record<keyof GameState["controls"]["act1"], unknown>>,
  datasets: NasaDatasets = DEFAULT_NASA_DATASETS,
): GameState {
  if (isLocked(state) || state.meta.currentAct !== 1) return state;
  const cur = state.controls.act1;
  const nextAct1 = {
    airFiltration: clamp(toNum(patch.airFiltration, cur.airFiltration), 0, 100),
    climateControl: clamp(
      toNum(patch.climateControl, cur.climateControl),
      0,
      100,
    ),
    waterRecovery: clamp(toNum(patch.waterRecovery, cur.waterRecovery), 0, 100),
  };

  const evalRes = evaluateLifeSupport(
    nextAct1,
    state.subSystems.cabin.rawSample,
    state.subSystems.power,
    state.subSystems.water,
  );

  const updatedPower = {
    ...state.subSystems.power,
    generationKw: evalRes.generationKw,
    demandKw: evalRes.demandKw,
    netKw: evalRes.netKw,
  };
  const updatedCabin = {
    ...state.subSystems.cabin,
    co2Ppm: evalRes.co2Ppm,
    temperatureDegC: evalRes.temperatureDegC,
    relativeHumidityPct: evalRes.relativeHumidityPct,
    dryCabinAirRisk: evalRes.dryCabinAirRisk,
    zones: evalRes.zones,
    habitabilityScore: evalRes.habitabilityScore,
  };

  let nextState: GameState = {
    ...state,
    controls: {
      ...state.controls,
      act1: nextAct1,
    },
    resources: {
      ...state.resources,
      powerLifeSupport: Math.round(evalRes.powerLifeSupportScore),
    },
    subSystems: {
      ...state.subSystems,
      power: updatedPower,
      cabin: updatedCabin,
    },
  };

  if (state.meta.currentAct === 1) {
    const nextCarry = captureLifeSupportCarryOver(nextState);
    const previewFood = evaluateFoodProduction(
      nextState.controls.act2,
      nextState.subSystems.greenhouse,
      updatedPower,
      nextState.subSystems.water,
      nextCarry,
      datasets.food,
      tuningFor(state.meta.ageBand).waterUse,
    );
    nextState = {
      ...nextState,
      carryOver: nextCarry,
      resources: {
        ...nextState.resources,
        foodProduction: Math.round(previewFood.foodProductionScore),
      },
      subSystems: {
        ...nextState.subSystems,
        greenhouse: {
          ...nextState.subSystems.greenhouse,
          cropHealthPct: previewFood.cropHealthPct,
          hydrationPct: previewFood.hydrationPct,
          rootStressPct: previewFood.rootStressPct,
          oxidativeStressPct: previewFood.oxidativeStressPct,
          prematureDryingRisk: previewFood.prematureDryingRisk,
          overwateringRisk: previewFood.overwateringRisk,
        },
      },
    };
  }

  if (!state.subSystems.cabin.dryCabinAirRisk && evalRes.dryCabinAirRisk) {
    nextState = {
      ...nextState,
      eventLog: appendLog(
        nextState,
        "ACT1_DRY_AIR_WARNING",
        `Cabin RH dropped to ${evalRes.relativeHumidityPct}% (< 37.6% OSD-766 threshold); early crop drying risk increased.`,
      ),
    };
  } else if (evalRes.netKw < 0 && state.subSystems.power.netKw >= 0) {
    nextState = {
      ...nextState,
      eventLog: appendLog(
        nextState,
        "ACT1_POWER_DEFICIT",
        `Life support draw (${evalRes.demandKw} kW) exceeds solar supply (${evalRes.generationKw} kW); batteries draining.`,
      ),
    };
  }

  return nextState;
}

/**
 * Live Act 2 slider update: recomputes PAR, spectral recipe, root/oxidative stress, ripe count, and LED power draw.
 */
export function updateFoodControls(
  state: GameState,
  patch: Partial<Record<keyof GameState["controls"]["act2"], unknown>>,
  datasets: NasaDatasets = DEFAULT_NASA_DATASETS,
): GameState {
  if (isLocked(state) || state.meta.currentAct !== 2) return state;
  const cur = state.controls.act2;
  const nextAct2 = {
    waterFlow: clamp(toNum(patch.waterFlow, cur.waterFlow), 0, 100),
    redLight: clamp(toNum(patch.redLight, cur.redLight), 5, 100),
    blueLight: clamp(toNum(patch.blueLight, cur.blueLight), 5, 100),
  };

  const evalRes = evaluateFoodProduction(
    nextAct2,
    state.subSystems.greenhouse,
    state.subSystems.power,
    state.subSystems.water,
    state.carryOver,
    datasets.food,
    tuningFor(state.meta.ageBand).waterUse,
  );

  const projectedBattery = clamp(
    state.subSystems.power.batteryPct + evalRes.batteryDeltaPerStep * 0.35,
    12,
    100,
  );
  const updatedPowerBar = Math.round(
    clamp(
      projectedBattery * 0.55 + state.subSystems.cabin.habitabilityScore * 0.45,
      5,
      100,
    ),
  );

  let nextState: GameState = {
    ...state,
    controls: {
      ...state.controls,
      act2: nextAct2,
    },
    resources: {
      ...state.resources,
      powerLifeSupport:
        state.meta.currentAct === 2
          ? updatedPowerBar
          : state.resources.powerLifeSupport,
      foodProduction: Math.round(evalRes.foodProductionScore),
    },
    subSystems: {
      ...state.subSystems,
      power:
        state.meta.currentAct === 2
          ? {
              ...state.subSystems.power,
              generationKw: 4.2,
              demandKw: roundTo(evalRes.ledKw + 1.5, 2),
              netKw: roundTo(4.2 - (evalRes.ledKw + 1.5), 2),
            }
          : state.subSystems.power,
      greenhouse: {
        ...state.subSystems.greenhouse,
        cropHealthPct: evalRes.cropHealthPct,
        hydrationPct: evalRes.hydrationPct,
        rootStressPct: evalRes.rootStressPct,
        oxidativeStressPct: evalRes.oxidativeStressPct,
        totalParUmolM2s: evalRes.totalParUmolM2s,
        spectralMix: evalRes.spectralMix,
        estimatedRipeFruits: evalRes.estimatedRipeFruits,
        prematureDryingRisk: evalRes.prematureDryingRisk,
        overwateringRisk: evalRes.overwateringRisk,
        ledKw: evalRes.ledKw,
      },
    },
  };

  if (state.meta.currentAct === 2) {
    nextState = {
      ...nextState,
      carryOver: captureFoodCarryOver(nextState),
    };
  }

  return nextState;
}

/**
 * Apply OSD-766 flight lighting preset ('red_rich' 90R:10B or 'blue_rich' 50R:50B).
 */
export function applyFoodPreset(
  state: GameState,
  presetKey: LightPreset,
  datasets: NasaDatasets = DEFAULT_NASA_DATASETS,
): GameState {
  if (isLocked(state) || state.meta.currentAct !== 2) return state;
  const preset = getVeg05PresetControls(datasets.food, presetKey);
  const updated = updateFoodControls(state, preset, datasets);
  const label =
    presetKey === "blue_rich" ? "50R:50B Blue-Rich" : "90R:10B Red-Rich";
  return {
    ...updated,
    eventLog: appendLog(
      updated,
      "ACT2_SPECTRUM_PRESET",
      `Applied VEG-05 flight recipe: ${label}.`,
    ),
  };
}

/**
 * Act 3 phase 1 (FLR): place shielding material around the crew shelter. Only the physical material
 * attenuates radiation; nothing here uses power. Items are limited by what the earlier missions left.
 */
export function setShelterMaterials(
  state: GameState,
  slots: readonly (ShieldItem | null | undefined)[] | null | undefined,
): GameState {
  if (isLocked(state) || state.meta.currentAct !== 3) return state;
  if (state.subSystems.radiation.stormPhase > 1) return state;
  const shelter = normalizeShelter(slots, state.subSystems.radiation.shelterInventory);
  const units = shelter.filter(Boolean).length;
  return applyAct3Couplings(
    state,
    { ...state.controls.act3, shelter },
    "ACT3_SHELTER",
    `Shelter reinforced with ${units} item${units === 1 ? "" : "s"} (physical shielding only).`,
  );
}

/**
 * Acknowledge/clear the visual FLR HF radio static alert banner.
 */
export function dismissFlrStatic(state: GameState): GameState {
  if (isLocked(state) || state.meta.currentAct !== 3) return state;
  return {
    ...state,
    subSystems: {
      ...state.subSystems,
      radiation: {
        ...state.subSystems.radiation,
        flrRadioStaticActive: false,
      },
    },
  };
}

/**
 * Act 3 phase 2 (CME observed): a preparation trade-off, decided before the storm particles arrive.
 * PROTECT ARRAYS: no wear, fewer power blocks. KEEP DEPLOYED: two more power blocks, simulated wear later.
 * Nothing is damaged at the moment the CME is observed.
 */
export function setCmeDecision(
  state: GameState,
  cmeRetractArrays: boolean,
): GameState {
  if (isLocked(state) || state.meta.currentAct !== 3) return state;
  if (state.subSystems.radiation.stormPhase >= 4) return state;
  const retract = Boolean(cmeRetractArrays);
  const nextAct3 = {
    ...state.controls.act3,
    cmeRetractArrays: retract,
  };
  const msg = retract
    ? "1,106 km/s CME observed: solar arrays moved to a protected configuration (less power, no wear)."
    : "1,106 km/s CME observed: arrays kept deployed (+2 power blocks, simulated wear during the storm).";
  return applyAct3Couplings(state, nextAct3, "ACT3_CME_DECISION", msg);
}

/**
 * Act 3 phase 3 (SEP): share limited storm power across shelter systems, life support and greenhouse.
 * Power runs systems; it does not change how much radiation the shelter blocks. Locked once the storm plays (phase 4).
 */
export function setSepPowerAllocation(
  state: GameState,
  partialAlloc:
    Partial<Record<keyof SepAllocation, unknown>> | null | undefined,
): GameState {
  if (isLocked(state) || state.meta.currentAct !== 3) return state;
  if (state.subSystems.radiation.stormPhase >= 4) return state;
  const cur = state.controls.act3.sepPowerAlloc;
  const patch = partialAlloc ?? {};
  const nextAct3 = {
    ...state.controls.act3,
    sepPowerAlloc: {
      shelterKw: toNum(patch.shelterKw, cur.shelterKw),
      cabinKw: toNum(patch.cabinKw, cur.cabinKw),
      greenhouseKw: toNum(patch.greenhouseKw, cur.greenhouseKw),
    },
  };
  return applyAct3Couplings(state, nextAct3);
}

/**
 * The ONE emergency reroute: move a single power block from one system to another while the storm plays.
 * Refused (state unchanged) if it was already used, if the source has no block, or if the target is already full.
 */
export function rerouteStormPower(
  state: GameState,
  from: PowerSystem,
  to: PowerSystem,
): GameState {
  if (isLocked(state) || state.meta.currentAct !== 3) return state;
  const rad = state.subSystems.radiation;
  if (rad.stormPhase !== 4 || rad.stormComplete) return state;
  const act3 = state.controls.act3;
  if (act3.reroute || from === to) return state;
  const names: Record<PowerSystem, string> = {
    shelterKw: "shelter systems",
    cabinKw: "life support",
    greenhouseKw: "greenhouse",
  };
  const alloc = act3.sepPowerAlloc;
  const cap = { shelterKw: SEP_DEMAND_KW.shelterKw, cabinKw: SEP_DEMAND_KW.cabinKw, greenhouseKw: SEP_DEMAND_KW.greenhouseKw };
  if (!(from in alloc) || !(to in alloc)) return state;
  if (alloc[from] < 1 || alloc[to] >= cap[to]) return state;
  const sepPowerAlloc = { ...alloc, [from]: alloc[from] - 1, [to]: alloc[to] + 1 };
  return applyAct3Couplings(
    state,
    { ...act3, sepPowerAlloc, reroute: { from, to } },
    "ACT3_REROUTE",
    `Emergency reroute: one power block moved from ${names[from]} to ${names[to]}.`,
  );
}

/**
 * Manually step storm phase in Act 3 (1 FLR -> 2 CME -> 3 SEP -> 4 CRaTER) without timers.
 */
export function advanceStormPhase(
  state: GameState,
  nextPhase?: unknown,
): GameState {
  if (isLocked(state) || state.meta.currentAct !== 3) return state;
  const current = state.subSystems.radiation.stormPhase;
  // Phases are strictly sequential (FLR -> CME -> SEP -> CRaTER): no skipping, no going back.
  const target = toNum(nextPhase, current + 1);
  if (current >= 4 || target !== current + 1) return state;
  const transitioned = transitionStormPhase(state, target);
  const phaseLabel = stormPhaseName(
    transitioned.subSystems.radiation.stormPhase,
  );
  return {
    ...transitioned,
    eventLog: appendLog(
      transitioned,
      `ACT3_PHASE_${phaseLabel}`,
      `Storm phase entered: ${transitioned.subSystems.radiation.stormPhase}/4 (${phaseLabel}).`,
    ),
  };
}

/**
 * Advance one manual discrete simulation step within the active Act.
 * Pause/Step friendly: explicitly triggered by user/test, zero real-time intervals.
 */
function stepActRaw(state: GameState, datasets: NasaDatasets): GameState {
  const act = state.meta.currentAct;
  if (act === 1) {
    if (isActComplete(state, datasets)) return state;
    const ticked = stepLifeSupportTick(state, datasets.lifeSupport);
    const zones = ticked.subSystems.cabin.zones;
    const checkpoint: Act1Checkpoint = {
      hour: ticked.meta.act1StepsCompleted * ACT1_HOUR_STRIDE,
      airOk: zones.co2 === "SAFE",
      heatOk: zones.temperature === "SAFE",
      waterOk: zones.humidity === "SAFE",
      stable:
        zones.co2 === "SAFE" &&
        zones.temperature === "SAFE" &&
        zones.humidity === "SAFE",
      netKw: ticked.subSystems.power.netKw,
      batteryPct: ticked.subSystems.power.batteryPct,
      tankPct: Math.round(
        (ticked.subSystems.water.reserveLiters /
          ticked.subSystems.water.maxLiters) *
          100,
      ),
    };
    const stepped: GameState = {
      ...ticked,
      meta: {
        ...ticked.meta,
        act1History: [...ticked.meta.act1History, checkpoint],
      },
    };
    const updatedCarry = captureLifeSupportCarryOver(stepped);
    return {
      ...stepped,
      carryOver: updatedCarry,
      eventLog: appendLog(
        stepped,
        "ACT1_STEP",
        `RR-28 +6h step -> CO2 ${stepped.subSystems.cabin.co2Ppm} ppm, Temp ${stepped.subSystems.cabin.temperatureDegC} C, RH ${stepped.subSystems.cabin.relativeHumidityPct}%, Batt ${stepped.subSystems.power.batteryPct}%.`,
      ),
    };
  }

  if (act === 2) {
    if (isActComplete(state, datasets)) return state;
    const stepped = stepFoodTick(state, datasets.food);
    const updatedCarry = captureFoodCarryOver(stepped);
    return {
      ...stepped,
      carryOver: updatedCarry,
      eventLog: appendLog(
        stepped,
        "ACT2_STEP",
        `VEG-05 Day ${stepped.subSystems.greenhouse.day} -> Health ${stepped.subSystems.greenhouse.cropHealthPct}%, Ripe ${stepped.subSystems.greenhouse.estimatedRipeFruits}, Batt ${stepped.subSystems.power.batteryPct}%.`,
      ),
    };
  }

  if (act === 3) {
    const stepped = stepRadiationTick(state, datasets.radiation);
    if (stepped === state) return state;
    return {
      ...stepped,
      eventLog: appendLog(
        stepped,
        "ACT3_CRATER_STEP",
        `CRaTER-D1D2 ${stepped.subSystems.radiation.currentTimeUtc}: ${stepped.subSystems.radiation.externalDoseUGyH} uGy/h (Crew Dose ${stepped.subSystems.radiation.cumulativeCrewDoseUGy} uGy).`,
      ),
    };
  }

  return state;
}

/**
 * Advance one manual step. No-op once the mission is failed/complete or the current Act's data window has ended
 * (check `isActComplete` / `getAdvanceStatus`). A step that crosses a failure limit fails the Act.
 */
export function stepMission(
  state: GameState,
  datasets: NasaDatasets = DEFAULT_NASA_DATASETS,
): GameState {
  if (isLocked(state)) return state;
  const stepped = stepActRaw(state, datasets);
  if (stepped === state) return state;
  const failure = evaluateMissionFailure(stepped, datasets);
  return failure ? markFailed(stepped, failure) : stepped;
}

/**
 * Step repeatedly until the current Act's natural end (or failure). Handy for UI "fast forward" and tests.
 */
export function stepUntilActComplete(
  state: GameState,
  datasets: NasaDatasets = DEFAULT_NASA_DATASETS,
): GameState {
  let current = state;
  for (
    let i = 0;
    i < 500 && !isLocked(current) && !isActComplete(current, datasets);
    i += 1
  ) {
    const next = stepMission(current, datasets);
    if (next === current) break;
    current = next;
  }
  return current;
}

/**
 * Lock current Act outcomes into carry-over and move to the NEXT act only (1 -> 2 -> 3 -> 4).
 * Skipping, going back, bad targets, failed missions, and unfinished Acts 2/3 all return the state unchanged;
 * `getAdvanceStatus` explains why. Leaving an Act while a failure limit is crossed fails that Act instead.
 */
export function advanceAct(
  state: GameState,
  targetAct?: unknown,
  datasets: NasaDatasets = DEFAULT_NASA_DATASETS,
): GameState {
  if (isLocked(state)) return state;
  const nextAct = toNum(targetAct, state.meta.currentAct + 1);
  if (nextAct !== state.meta.currentAct + 1) return state;
  if (!getAdvanceStatus(state).canAdvance) return state;

  const failure = evaluateMissionFailure(state);
  if (failure) return markFailed(state, failure);

  return enterActWithCheckpoint(state, nextAct as ActNumber, datasets);
}

function enterActWithCheckpoint(
  state: GameState,
  nextAct: ActNumber,
  datasets: NasaDatasets,
): GameState {
  const next = advanceActRaw(state, nextAct, datasets);
  if (next.meta.currentAct === 4 || next === state) return next;
  const { checkpoints, ...snapshot } = next;
  return {
    ...next,
    checkpoints: { ...(checkpoints ?? {}), [nextAct]: snapshot },
  };
}

/**
 * Jump straight into the next act, skipping the objective gates and the failure check.
 * For tests, debugging tools and level design only. It is deliberately NOT exported from the engine barrel,
 * so the game UI cannot reach it: players must go through `advanceAct`.
 */
export function unsafeEnterAct(
  state: GameState,
  nextAct: ActNumber,
  datasets: NasaDatasets = DEFAULT_NASA_DATASETS,
): GameState {
  if (nextAct !== state.meta.currentAct + 1) return state;
  return enterActWithCheckpoint(state, nextAct, datasets);
}

function advanceActRaw(
  state: GameState,
  nextAct: ActNumber,
  datasets: NasaDatasets,
): GameState {
  const nextRole = getRoleTitle(nextAct, state.meta.ageBand);

  if (nextAct === 2) {
    const carryFromAct1 = captureLifeSupportCarryOver(state);
    const evalGreen = evaluateFoodProduction(
      state.controls.act2,
      state.subSystems.greenhouse,
      state.subSystems.power,
      state.subSystems.water,
      carryFromAct1,
      datasets.food,
      tuningFor(state.meta.ageBand).waterUse,
    );
    const nextState: GameState = {
      ...state,
      meta: {
        ...state.meta,
        currentAct: 2,
        roleTitle: nextRole,
        completed: false,
      },
      resources: {
        ...state.resources,
        foodProduction: Math.round(evalGreen.foodProductionScore),
      },
      subSystems: {
        ...state.subSystems,
        power: {
          ...state.subSystems.power,
          generationKw: 4.2,
          demandKw: roundTo(evalGreen.ledKw + 1.5, 2),
          netKw: roundTo(4.2 - (evalGreen.ledKw + 1.5), 2),
        },
        greenhouse: {
          ...state.subSystems.greenhouse,
          cropHealthPct: evalGreen.cropHealthPct,
          hydrationPct: evalGreen.hydrationPct,
          rootStressPct: evalGreen.rootStressPct,
          oxidativeStressPct: evalGreen.oxidativeStressPct,
          totalParUmolM2s: evalGreen.totalParUmolM2s,
          spectralMix: evalGreen.spectralMix,
          estimatedRipeFruits: evalGreen.estimatedRipeFruits,
          prematureDryingRisk: evalGreen.prematureDryingRisk,
          overwateringRisk: evalGreen.overwateringRisk,
          ledKw: evalGreen.ledKw,
        },
      },
      carryOver: carryFromAct1,
    };
    return {
      ...nextState,
      eventLog: appendLog(
        nextState,
        "ENTER_ACT_2",
        `Entered Act 2 (Greenhouse) with carried Cabin RH ${carryFromAct1.endRhPercent}%, Batt ${carryFromAct1.act1BatteryCarryPct}%, Water ${carryFromAct1.act1WaterCarryLiters} L.`,
      ),
    };
  }

  if (nextAct === 3) {
    const captured = captureFoodCarryOver(state);
    // Difficulty: the storm starts with more or fewer power blocks.
    const carryFromAct2: CarryOver = {
      ...captured,
      stormAvailableKwBudget: clamp(captured.stormAvailableKwBudget + tuningFor(state.meta.ageBand).stormBudgetOffset, 4, 9),
    };
    const prepared: GameState = {
      ...state,
      meta: {
        ...state.meta,
        currentAct: 3,
        roleTitle: nextRole,
        completed: false,
      },
      carryOver: carryFromAct2,
    };
    const inventory = computeShelterInventory(
      state.subSystems.water,
      carryFromAct2,
    );
    const withInventory: GameState = {
      ...prepared,
      controls: {
        ...prepared.controls,
        act3: {
          ...prepared.controls.act3,
          shelter: autoStowShelter(inventory),
          reroute: null,
        },
      },
      subSystems: {
        ...prepared.subSystems,
        radiation: {
          ...prepared.subSystems.radiation,
          shelterInventory: inventory,
        },
      },
    };
    const phased = transitionStormPhase(withInventory, 1);
    const budgetKw = computeAvailableStormKw(
      carryFromAct2,
      phased.controls.act3,
    );
    const coupled = applyAct3Couplings(
      phased,
      phased.controls.act3,
      "ENTER_ACT_3",
      `Entered Act 3 (Solar Storm) with ${budgetKw} kW storm budget. M9.7 FLR triggered HF radio static alert. Shelter material available: ${inventory.water} water, ${inventory.supply} supply, ${inventory.equipment} equipment.`,
    );
    return coupled;
  }

  if (nextAct === 4) {
    const finalState: GameState = {
      ...state,
      meta: {
        ...state.meta,
        currentAct: 4,
        roleTitle: nextRole,
        completed: true,
      },
      subSystems: {
        ...state.subSystems,
        radiation: {
          ...state.subSystems.radiation,
          flrRadioStaticActive: false,
        },
      },
    };
    return {
      ...finalState,
      eventLog: appendLog(
        finalState,
        "MISSION_COMPLETE",
        "Completed 3-Act Lunar Outpost simulation; Mission Debrief ready.",
      ),
    };
  }

  return state;
}

/**
 * Dual-Age Adapter (REQ-04):
 * - Ages 7-9: Plain language, visual Safe Zones, concrete tomato counts & radio-static story cues.
 * - Ages 10-12: Exact NASA quantitative metrics, units, PAR values, DONKI storm classes, and uGy doses.
 */
export function getAgeAdaptedTelemetry(state: GameState) {
  const { cabin, greenhouse, power, water, radiation } = state.subSystems;
  const isYounger = state.meta.ageBand === "7-9";

  if (isYounger) {
    const airCue =
      cabin.zones.co2 === "SAFE"
        ? "Fresh Air: Safe"
        : cabin.zones.co2 === "CAUTION"
          ? "Air Getting Stuffy"
          : "Air Needs Scrubbing!";
    const humidityCue = cabin.dryCabinAirRisk
      ? "Air Too Dry — plants may dry out!"
      : cabin.zones.humidity === "SAFE"
        ? "Moisture: Comfortable"
        : `Moisture: ${cabin.zones.humidity}`;

    return {
      ageBand: "7-9",
      roleTitle: state.meta.roleTitle,
      act1Cards: [
        { label: "Cabin Air", status: cabin.zones.co2, text: airCue },
        {
          label: "Cabin Warmth",
          status: cabin.zones.temperature,
          text: `Temperature: ${cabin.zones.temperature}`,
        },
        {
          label: "Air Moisture",
          status: cabin.zones.humidity,
          text: humidityCue,
        },
        {
          label: "Battery & Water",
          status: power.batteryPct >= 45 ? "SAFE" : "CAUTION",
          text:
            power.netKw >= 0
              ? "Solar Charging Surplus"
              : "Using Battery Backup",
        },
      ],
      act2Cards: [
        {
          label: "Daylight Plan",
          status: greenhouse.prematureDryingRisk ? "CAUTION" : "SAFE",
          text: `Growing Day ${greenhouse.day} of 100`,
        },
        {
          label: "Plant Stress",
          status:
            greenhouse.rootStressPct < 30 && greenhouse.oxidativeStressPct < 35
              ? "SAFE"
              : "CAUTION",
          text: greenhouse.prematureDryingRisk
            ? "Seedlings Dry Early!"
            : "Roots & Leaves Doing Well",
        },
        {
          label: "Tomato Harvest",
          status: greenhouse.estimatedRipeFruits >= 5 ? "SAFE" : "CAUTION",
          text: `${greenhouse.estimatedRipeFruits} Ripe Space Tomatoes`,
        },
      ],
      act3Cards: [
        {
          label: "Storm Phase",
          status: radiation.flrRadioStaticActive ? "CAUTION" : "SAFE",
          text: `${radiation.phaseName} (${radiation.stormPhase}/4)`,
        },
        {
          label: "Crew Shelter",
          status: radiation.shieldReadinessPct >= 65 ? "SAFE" : "CAUTION",
          text: `Shielding: ${radiation.shieldReadinessPct >= 75 ? "Strong" : "Needs More Material"}`,
        },
        {
          label: "Solar Wings",
          status: radiation.solarArrayIntegrityPct === 100 ? "SAFE" : "CAUTION",
          text:
            radiation.solarArrayIntegrityPct === 100
              ? "Safely Tucked In"
              : "Taking Storm Hits",
        },
      ],
    };
  }

  return {
    ageBand: "10-12",
    roleTitle: state.meta.roleTitle,
    act1Cards: [
      {
        label: "CO2 (RR-28)",
        status: cabin.zones.co2,
        text: `${cabin.co2Ppm} ppm`,
      },
      {
        label: "Temperature",
        status: cabin.zones.temperature,
        text: `${cabin.temperatureDegC} °C`,
      },
      {
        label: "Rel. Humidity",
        status: cabin.zones.humidity,
        text: `${cabin.relativeHumidityPct}% RH`,
      },
      {
        label: "Power / Water",
        status: power.netKw >= 0 ? "SAFE" : "CAUTION",
        text: `${power.batteryPct}% Batt (${power.netKw >= 0 ? "+" : ""}${power.netKw} kW) | ${water.reserveLiters} L`,
      },
    ],
    act2Cards: [
      {
        label: "VEG-05 Timeline",
        status: "SAFE",
        text: `Day ${greenhouse.day} / 100 (${greenhouse.spectralMix.redPct}R:${greenhouse.spectralMix.bluePct}B, ${greenhouse.totalParUmolM2s} µmol/m²/s)`,
      },
      {
        label: "Plant Stress",
        status:
          greenhouse.rootStressPct < 30 && greenhouse.oxidativeStressPct < 35
            ? "SAFE"
            : "CAUTION",
        text: `Root ${greenhouse.rootStressPct}% | Oxidative ${greenhouse.oxidativeStressPct}%`,
      },
      {
        label: "Yield & Draw",
        status: greenhouse.estimatedRipeFruits >= 5 ? "SAFE" : "CAUTION",
        text: `${greenhouse.estimatedRipeFruits} ripe fruits | LED ${greenhouse.ledKw} kW`,
      },
    ],
    act3Cards: [
      {
        label: "DONKI Storm",
        status: radiation.stormPhase >= 3 ? "HIGH" : "CAUTION",
        text: `Phase ${radiation.stormPhase}/4: ${radiation.phaseName} (${computeAvailableStormKw(state.carryOver, state.controls.act3)}/${SEP_DEMAND_KW.totalKw} kW max)`,
      },
      {
        label: "CRaTER-D1D2 Rate",
        status: radiation.externalDoseUGyH > 500 ? "HIGH" : "SAFE",
        text: `${radiation.externalDoseUGyH} µGy/h (Peak ${radiation.peakObservedDoseUGyH} µGy/h)`,
      },
      {
        label: "Shielded Crew Dose",
        status: radiation.shieldAttenuationFactor >= 0.65 ? "SAFE" : "CAUTION",
        text: `${radiation.cumulativeCrewDoseUGy} µGy absorbed (${Math.round(radiation.shieldAttenuationFactor * 100)}% blocked)`,
      },
    ],
  };
}

/**
 * Build end-of-mission reflection comparing player choices against real NASA RR-28, OSD-766/767, & CRaTER data.
 */
export function buildDebriefSummary(state: GameState) {
  if (!state.meta.completed && !state.meta.failed) {
    return {
      ready: false as const,
      rating: null,
      reason: "Finish the mission (or fail an Act) to see the debrief.",
    };
  }
  const { powerLifeSupport, foodProduction, radiationShielding } =
    state.resources;
  const averageScore = Math.round(
    (powerLifeSupport + foodProduction + radiationShielding) / 3,
  );
  const { radiation, greenhouse } = state.subSystems;

  const doseSavedUGy = roundTo(
    Math.max(
      0,
      radiation.unshieldedCumulativeUGy - radiation.cumulativeCrewDoseUGy,
    ),
    2,
  );
  const doseReductionPct =
    radiation.unshieldedCumulativeUGy > 0
      ? Math.round((doseSavedUGy / radiation.unshieldedCumulativeUGy) * 100)
      : Math.round(radiation.shieldAttenuationFactor * 100);

  const rating = state.meta.failed
    ? "Mission Failed"
    : averageScore >= READY_AVERAGE_SCORE && radiation.shieldReadinessPct >= 65
      ? "Mission Ready"
      : averageScore >= 55
        ? "Outpost Stabilized"
        : "Needs Recalibration";

  return {
    ready: true as const,
    failure: state.meta.failure,
    attempts: state.meta.attempts,
    rating,
    averageScore,
    finalResources: { ...state.resources },
    doseSavedUGy,
    doseReductionPct,
    comparisons: {
      act1: {
        dataset: "OSDR RR-28 (ISS 5-day cabin telemetry)",
        endTempC: state.carryOver.endTempC,
        endRhPercent: state.carryOver.endRhPercent,
        endCo2Ppm: state.carryOver.endCo2Ppm,
        triggeredDryAirRisk: Boolean(state.carryOver.dryCabinAirRisk),
      },
      act2: {
        dataset: "OSDR OSD-766 & OSD-767 (VEG-05 Dwarf Tomato, 101 days)",
        spectralMix: greenhouse.spectralMix,
        estimatedRipeFruits: greenhouse.estimatedRipeFruits,
        cropHealthPct: greenhouse.cropHealthPct,
        cropVulnerability: state.carryOver.cropVulnerability,
      },
      act3: {
        dataset:
          "NASA DONKI (2024-06-08 M9.7 FLR / 1,106 km/s CME / >100 MeV SEP) + RadLab CRaTER-D1D2",
        cmeArraysRetracted: state.controls.act3.cmeRetractArrays,
        shelter: [...state.controls.act3.shelter],
        shelterUnits: radiation.shelterUnits,
        shelterAttenuationPct: Math.round(radiation.shieldAttenuationFactor * 100),
        reroute: state.controls.act3.reroute ? { ...state.controls.act3.reroute } : null,
        sepPowerAlloc: { ...state.controls.act3.sepPowerAlloc },
        stormBudgetKw: computeAvailableStormKw(
          state.carryOver,
          state.controls.act3,
        ),
        peakObservedDoseUGyH: radiation.peakObservedDoseUGyH,
        cumulativeCrewDoseUGy: radiation.cumulativeCrewDoseUGy,
        unshieldedCumulativeUGy: radiation.unshieldedCumulativeUGy,
      },
    },
  };
}

/**
 * Exact preview of "what happens if the player advances now": runs the real step on a copy of the state,
 * so the forecast can never disagree with the result. Null when stepping is not possible.
 */
export function forecastNextStep(
  state: GameState,
  datasets: NasaDatasets = DEFAULT_NASA_DATASETS,
): GameState | null {
  if (
    isLocked(state) ||
    state.meta.currentAct !== 1 ||
    isActComplete(state, datasets)
  )
    return null;
  const next = stepMission(state, datasets);
  return next === state ? null : next;
}

/** Everything the Life Support console needs to explain the current readings and power budget. */
export function getLifeSupportBreakdown(state: GameState) {
  const { cabin, power, water } = state.subSystems;
  const evaluated = evaluateLifeSupport(
    state.controls.act1,
    cabin.rawSample,
    power,
    water,
  );
  return {
    /** Raw real-world readings before any lever is applied (NASA RR-28 telemetry). */
    baseline: {
      co2Ppm: cabin.rawSample.co2_ppm,
      temperatureDegC: cabin.rawSample.temperature_degC,
      humidityPct: cabin.rawSample.relative_humidity_percent,
    },
    effects: evaluated.effects,
    power: {
      generationKw: evaluated.generationKw,
      drawKw: evaluated.drawKw,
      demandKw: evaluated.demandKw,
      netKw: evaluated.netKw,
      batteryDeltaPerStep: evaluated.batteryDeltaPerStep,
    },
    water: {
      reserveLiters: water.reserveLiters,
      maxLiters: water.maxLiters,
      deltaPerStepLiters: evaluated.waterDeltaPerStep,
    },
  };
}

/* ------------------------------ Mission 2 entry & events ------------------------------ */

/** Relative humidity (%) during the dry-air event. It sits well under the 37.6% drying threshold. */
export const DRY_AIR_RH_PCT = 20;

/**
 * Start the greenhouse mission (Act 2) from the player's last Life Support result:
 *  1. a Life Support run just passed in this game -> carry that habitat in;
 *  2. otherwise the result saved from an earlier visit (`saved`, checked and clamped) -> rebuild that habitat;
 *  3. otherwise the baseline habitat.
 * An unfinished or failed Act 1 is never trusted, so nothing can be skipped or exploited.
 */
export function startFoodMission(
  state: GameState,
  datasets: NasaDatasets = DEFAULT_NASA_DATASETS,
  saved?: Partial<CarryOver> | null,
): GameState {
  if (state.meta.currentAct === 1 && getAdvanceStatus(state).canAdvance)
    return advanceAct(state, 2, datasets);
  const base = createGameState({ ageBand: state.meta.ageBand, datasets });
  const { cabin, power, water } = base.subSystems;
  const num = (v: unknown, lo: number, hi: number, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? clamp(v, lo, hi) : fallback;
  const rebuilt: GameState = saved
    ? {
        ...base,
        subSystems: {
          ...base.subSystems,
          power: { ...power, batteryPct: num(saved.act1BatteryCarryPct, 12, 100, power.batteryPct) },
          water: { ...water, reserveLiters: num(saved.act1WaterCarryLiters, 0, water.maxLiters, water.reserveLiters) },
          cabin: {
            ...cabin,
            co2Ppm: num(saved.endCo2Ppm, 0, 5000, cabin.co2Ppm),
            temperatureDegC: num(saved.endTempC, 10, 40, cabin.temperatureDegC),
            relativeHumidityPct: num(saved.endRhPercent, 0, 100, cabin.relativeHumidityPct),
            dryCabinAirRisk: typeof saved.dryCabinAirRisk === "boolean" ? saved.dryCabinAirRisk : cabin.dryCabinAirRisk,
          },
        },
      }
    : base;
  return unsafeEnterAct(rebuilt, 2, datasets);
}

/**
 * Cabin air event for the greenhouse: "dry" is the early dry-air spell that dries the plant pillow faster
 * (OSD-766 Day 0-2 finding); "normal" is the air coming back. Re-evaluates the crop straight away.
 */
export function setCabinAir(
  state: GameState,
  air: "dry" | "normal",
  datasets: NasaDatasets = DEFAULT_NASA_DATASETS,
): GameState {
  if (isLocked(state) || state.meta.currentAct !== 2) return state;
  // The event is an overlay: Act 1's own humidity (endRhPercent) is never overwritten.
  const { airOverlayRhPercent: _gone, ...rest } = state.carryOver;
  void _gone;
  const changed: GameState = {
    ...state,
    carryOver:
      air === "dry" ? { ...rest, airOverlayRhPercent: DRY_AIR_RH_PCT } : rest,
  };
  const evaluated = updateFoodControls(changed, {}, datasets);
  return {
    ...evaluated,
    eventLog: appendLog(
      evaluated,
      air === "dry" ? "ACT2_DRY_AIR" : "ACT2_AIR_RECOVERED",
      air === "dry"
        ? `Dry cabin air (${DRY_AIR_RH_PCT}% RH) is drying the plant pillow faster than expected.`
        : `Cabin air is back to its Act 1 level (${state.carryOver.endRhPercent}% RH).`,
    ),
  };
}

/**
 * Start the solar storm mission (Act 3) from the player's earlier results.
 *  1. Greenhouse just finished in this game (Day 100) -> carry that outpost straight in;
 *  2. otherwise rebuild it: the saved Life Support result, then a default-care greenhouse run, then the saved
 *     greenhouse result (crop health, battery, water kept, harvest) laid over it, so earlier choices still count;
 *  3. with nothing saved, the baseline outpost.
 */
export function startStormMission(
  state: GameState,
  datasets: NasaDatasets = DEFAULT_NASA_DATASETS,
  savedAct1?: Partial<CarryOver> | null,
  savedAct2?: Partial<CarryOver> | null,
): GameState {
  if (
    state.meta.currentAct === 2 &&
    !state.meta.failed &&
    isActComplete(state, datasets)
  )
    return advanceAct(state, 3, datasets);
  const grown = stepUntilActComplete(
    startFoodMission(state, datasets, savedAct1),
    datasets,
  );
  const num = (v: unknown, lo: number, hi: number, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? clamp(v, lo, hi) : fallback;
  const { greenhouse, power, water } = grown.subSystems;
  const patched: GameState = savedAct2
    ? {
        ...grown,
        resources: {
          ...grown.resources,
          foodProduction: Math.round(num(savedAct2.cropHealthAtStormPct, 0, 100, grown.resources.foodProduction)),
        },
        subSystems: {
          ...grown.subSystems,
          power: { ...power, batteryPct: num(savedAct2.act2BatteryCarryPct, 12, 100, power.batteryPct) },
          water: { ...water, reserveLiters: num(savedAct2.act2WaterCarryLiters, 0, water.maxLiters, water.reserveLiters) },
          greenhouse: {
            ...greenhouse,
            cropHealthPct: num(savedAct2.cropHealthAtStormPct, 0, 100, greenhouse.cropHealthPct),
            estimatedRipeFruits: Math.round(num(savedAct2.harvestRipeFruits, 0, 50, greenhouse.estimatedRipeFruits)),
            rootStressPct: savedAct2.cropVulnerability === "SENSITIVE" ? 40 : 0,
            oxidativeStressPct: 0,
          },
        },
      }
    : grown;
  return advanceAct(patched, 3, datasets);
}

/**
 * The once-per-run supply drop from Earth: extra water in the greenhouse (Act 2) or one extra power block in the
 * storm (Act 3, before the plan is locked). It never touches progress. The game counts it against the efficiency rating.
 */
export function applySupplyDrop(state: GameState): GameState {
  if (isLocked(state) || state.meta.supplyDropUsed) return state;
  const act = state.meta.currentAct;
  let next: GameState | null = null;
  if (act === 2) {
    const w = state.subSystems.water;
    next = { ...state, subSystems: { ...state.subSystems, water: { ...w, reserveLiters: roundTo(Math.min(w.maxLiters, w.reserveLiters + 12), 1) } } };
  } else if (act === 3 && state.subSystems.radiation.stormPhase < 4) {
    next = applyAct3Couplings(
      { ...state, carryOver: { ...state.carryOver, supplyBonusKw: (state.carryOver.supplyBonusKw ?? 0) + 1 } },
      state.controls.act3,
    );
  }
  if (!next) return state;
  const marked: GameState = { ...next, meta: { ...next.meta, supplyDropUsed: true } };
  return { ...marked, eventLog: appendLog(marked, "SUPPLY_DROP", act === 2 ? "Supply drop from Earth: +12 L of water." : "Supply drop from Earth: +1 storm power block.") };
}
