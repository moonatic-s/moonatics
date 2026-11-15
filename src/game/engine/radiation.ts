/**
 * Act 3 — Radiation Emergency simulation (NASA DONKI FLR -> CME -> SEP + RadLab CRaTER-D1D2).
 * Implements 4 sequential phases without countdown timers (Pause / Step friendly),
 * visual-only FLR radio static trigger (no 4th bar), CME array trade-off, and constrained SEP power allocator.
 */
import type {
  Act3Controls,
  CabinState,
  CarryOver,
  GameState,
  RadiationDataset,
  RadiationState,
  SepAllocation,
  ShelterInventory,
  ShieldItem,
} from "./types";
import { at, clamp, roundTo } from "./util";

export const STORM_PHASES = Object.freeze(["FLR", "CME", "SEP", "CRaTER"]);

/** Phase label for a 1-based storm phase (1=FLR ... 4=CRaTER). */
export function stormPhaseName(phase: number): string {
  return at(STORM_PHASES, clamp(Math.round(phase), 1, 4) - 1, "storm phase");
}

export const SEP_DEMAND_KW = Object.freeze({
  shelterKw: 5,
  cabinKw: 4,
  greenhouseKw: 3,
  totalKw: 12,
});

/** Shielding positions around the crew compartment. */
export const SHELTER_SLOT_COUNT = 8;
/** Protection units per item. Water is the best simple shield; equipment the weakest. */
export const SHIELD_ITEM_UNITS: Readonly<Record<ShieldItem, number>> = Object.freeze({
  water: 1,
  supply: 0.8,
  equipment: 0.6,
});
/** Attenuation of the bare shelter hull, and the gain per protection unit. Physical material only. */
export const SHELTER_BASE_ATTENUATION = 0.35;
export const SHELTER_UNIT_ATTENUATION = 0.0775;

export const ACT3_INITIAL_CONTROLS = Object.freeze({
  cmeRetractArrays: true,
  sepPowerAlloc: {
    shelterKw: 3,
    cabinKw: 3,
    greenhouseKw: 2,
  },
  shelter: Array.from({ length: SHELTER_SLOT_COUNT }, () => null) as (ShieldItem | null)[],
  reroute: null,
});

/**
 * Shielding material the outpost can spare, from how the earlier missions went:
 * water kept (Life Support and Greenhouse), supplies from the tomato harvest, equipment that is always on hand.
 */
export function computeShelterInventory(
  water: { reserveLiters: number; maxLiters: number },
  carryOver: Partial<CarryOver>,
): ShelterInventory {
  const waterShare = water.maxLiters > 0 ? clamp(water.reserveLiters / water.maxLiters, 0, 1) : 0;
  return {
    water: Math.round(clamp(waterShare * 6, 0, 5)),
    supply: Math.round(clamp(2 + (carryOver.harvestRipeFruits ?? 0) / 2, 2, 4)),
    equipment: 5,
  };
}

/** Keeps a placement honest: right length, no item used more often than it is available. */
export function normalizeShelter(
  slots: readonly (ShieldItem | null | undefined)[] | null | undefined,
  inventory: ShelterInventory,
): (ShieldItem | null)[] {
  const left: Record<ShieldItem, number> = { ...inventory };
  const out: (ShieldItem | null)[] = [];
  for (let i = 0; i < SHELTER_SLOT_COUNT; i += 1) {
    const item = slots?.[i];
    if ((item === "water" || item === "supply" || item === "equipment") && left[item] > 0) {
      left[item] -= 1;
      out.push(item);
    } else out.push(null);
  }
  return out;
}

/** A sensible full placement (best material first). Used for headless play; the game UI starts from empty. */
export function autoStowShelter(inventory: ShelterInventory): (ShieldItem | null)[] {
  const order: ShieldItem[] = [];
  (["water", "supply", "equipment"] as const).forEach((k) => {
    for (let i = 0; i < inventory[k]; i += 1) order.push(k);
  });
  return normalizeShelter(order, inventory);
}

export function shelterUnits(slots: readonly (ShieldItem | null)[]): number {
  return roundTo(
    slots.reduce((sum, s) => sum + (s ? SHIELD_ITEM_UNITS[s] : 0), 0),
    2,
  );
}

// Storm window index starting at 2024-06-08T00:00:00Z inside radiation_series.
const DEFAULT_STORM_SERIES_START_OFFSET_TIME = "2024-06-08T00:00:00Z";

/**
 * Effective storm power budget: what Acts 1-2 left in the battery, plus two blocks if the solar arrays are kept deployed.
 * Deployed arrays make more power but take simulated wear during the storm (never at the moment the CME is observed).
 */
export function computeAvailableStormKw(
  carryOver: Partial<CarryOver>,
  controls: Pick<Act3Controls, "cmeRetractArrays">,
): number {
  const baseBudget = carryOver.stormAvailableKwBudget ?? 8;
  const deployedBonusKw = controls.cmeRetractArrays ? 0 : 2;
  return clamp(baseBudget + deployedBonusKw + (carryOver.supplyBonusKw ?? 0), 4, 12);
}

/**
 * Normalize { shelterKw, cabinKw, greenhouseKw } so allocation stays valid and <= budgetKw.
 */
export function normalizeSepAllocation(
  alloc: Partial<SepAllocation>,
  budgetKw: number,
): SepAllocation {
  // Non-finite values (NaN, Infinity, undefined) fall back to 0 kW rather than poisoning shielding math.
  const safe = (v: number | undefined): number =>
    typeof v === "number" && Number.isFinite(v) ? v : 0;
  let shelterKw = Math.round(
    clamp(safe(alloc.shelterKw), 0, SEP_DEMAND_KW.shelterKw),
  );
  let cabinKw = Math.round(
    clamp(safe(alloc.cabinKw), 0, SEP_DEMAND_KW.cabinKw),
  );
  let greenhouseKw = Math.round(
    clamp(safe(alloc.greenhouseKw), 0, SEP_DEMAND_KW.greenhouseKw),
  );

  let total = shelterKw + cabinKw + greenhouseKw;
  while (total > budgetKw) {
    if (greenhouseKw > 0) {
      greenhouseKw -= 1;
    } else if (cabinKw > 0) {
      cabinKw -= 1;
    } else if (shelterKw > 0) {
      shelterKw -= 1;
    }
    total = shelterKw + cabinKw + greenhouseKw;
  }

  return { shelterKw, cabinKw, greenhouseKw };
}

/**
 * Evaluate live cross-system effects of FLR/CME choices & SEP power allocation across all 3 core systems!
 */
export function evaluateRadiationCouplings(
  controls: Act3Controls,
  radState: Pick<RadiationState, "cumulativeCrewDoseUGy" | "shelterInventory">,
  carryOver: Partial<CarryOver>,
  cabinState: Pick<CabinState, "co2Ppm" | "temperatureDegC">,
  foodScore: number,
  /** 0 at the start of the CRaTER window, 1 at its end; arrays that were kept deployed wear as it advances. */
  stormProgress = 0,
) {
  const budgetKw = computeAvailableStormKw(carryOver, controls);
  const alloc = normalizeSepAllocation(controls.sepPowerAlloc, budgetKw);

  // PHYSICAL SHIELDING: only the material placed around the crew attenuates radiation. Electrical power never does.
  const shelter = normalizeShelter(controls.shelter, radState.shelterInventory);
  const units = shelterUnits(shelter);
  const shieldAttenuationFactor = roundTo(
    clamp(SHELTER_BASE_ATTENUATION + units * SHELTER_UNIT_ATTENUATION, 0.3, 0.92),
    2,
  );
  const shieldReadinessPct = roundTo(shieldAttenuationFactor * 100, 1);
  // ELECTRICAL POWER: shelter systems (ventilation, monitoring, emergency equipment) run on it. It keeps the crew comfortable, nothing more.
  const shelterSystemsPct = Math.round((alloc.shelterKw / SEP_DEMAND_KW.shelterKw) * 100);

  // Coupled Cabin impact during SEP power triage: starving cabinKw raises CO2 (0 kW total shutoff spikes sharply) & drifts Temp!
  const cabinDeficit = Math.max(0, 3 - alloc.cabinKw);
  const co2RisePpm = cabinDeficit === 3 ? 2850 : cabinDeficit * 820;
  const stormCo2Ppm = Math.round(
    clamp((carryOver.endCo2Ppm ?? cabinState.co2Ppm) + co2RisePpm, 450, 9500),
  );
  const stormTempDegC = roundTo(
    clamp(
      (carryOver.endTempC ?? cabinState.temperatureDegC) - cabinDeficit * 0.85,
      16.0,
      29.0,
    ),
    1,
  );
  const cabinPenalty = cabinDeficit * 11;

  // Coupled Food impact during SEP triage: cutting greenhouseKw wilts tomatoes, amplified if Act 2 was sensitive!
  const greenDeficit = Math.max(0, SEP_DEMAND_KW.greenhouseKw - alloc.greenhouseKw);
  const vulnerabilityMultiplier =
    carryOver.cropVulnerability === "SENSITIVE" ? 1.35 : 1.0;
  const stormFoodPenalty = roundTo(
    clamp(greenDeficit * 6 * vulnerabilityMultiplier, 0, 40),
    1,
  );
  const coupledFoodScore = Math.round(
    clamp(
      (carryOver.cropHealthAtStormPct ?? foodScore) - stormFoodPenalty,
      10,
      100,
    ),
  );

  // Radiation Shielding Core Bar scales absorbed cumulative dose against the 55,000 uGy storm failure ceiling.
  const dosePenalty = clamp(
    (radState.cumulativeCrewDoseUGy / 55000) * 46,
    0,
    56,
  );
  // Crew Safety: mostly physical shielding and the dose so far; a little from shelter systems being powered.
  const radiationShieldingScore = Math.round(
    clamp(
      (shieldReadinessPct - dosePenalty) * 0.85 + shelterSystemsPct * 0.15,
      5,
      100,
    ),
  );

  // Arrays kept deployed wear a little as the storm goes on (simulated), never instantly.
  const arrayWearPct = controls.cmeRetractArrays ? 0 : Math.round(clamp(stormProgress, 0, 1) * 32);
  const effectiveBattery = clamp(
    (carryOver.act2BatteryCarryPct ?? 65) - arrayWearPct * 0.45,
    8,
    100,
  );
  const co2PenaltyAct3 = Math.max(0, (stormCo2Ppm - 2800) / 85);
  const coupledPowerScore = Math.round(
    clamp(
      effectiveBattery * 0.45 +
        Math.max(10, 96 - cabinPenalty - co2PenaltyAct3) * 0.55,
      5,
      100,
    ),
  );

  return {
    budgetKw,
    usedKw: alloc.shelterKw + alloc.cabinKw + alloc.greenhouseKw,
    alloc,
    shieldAttenuationFactor,
    shieldReadinessPct,
    shelter,
    shelterUnits: units,
    shelterSystemsPct,
    solarArrayIntegrityPct: controls.cmeRetractArrays ? 100 : 100 - arrayWearPct,
    stormCo2Ppm,
    stormTempDegC,
    effectiveBatteryPct: effectiveBattery,
    coupledPowerScore,
    coupledFoodScore,
    radiationShieldingScore,
  };
}

/**
 * Initialize Act 3 state synced to June 7-9, 2024 CRaTER-D1D2 timeline.
 */
export function buildInitialRadiationState(
  radiationData: RadiationDataset,
  carryOver: Partial<CarryOver>,
  inventory: ShelterInventory = computeShelterInventory({ reserveLiters: 0, maxLiters: 1 }, carryOver),
) {
  const series = radiationData.radiation_series;
  const foundIdx = series.findIndex(
    (row) => row.time >= DEFAULT_STORM_SERIES_START_OFFSET_TIME,
  );
  const startIdx = foundIdx >= 0 ? foundIdx : 0;
  const sample = at(series, startIdx);
  const budgetKw = carryOver.stormAvailableKwBudget ?? 8;

  return {
    controls: {
      ...ACT3_INITIAL_CONTROLS,
      sepPowerAlloc: normalizeSepAllocation(
        ACT3_INITIAL_CONTROLS.sepPowerAlloc,
        budgetKw,
      ),
      shelter: autoStowShelter(inventory),
      reroute: null,
    },
    radiation: {
      shelterInventory: inventory,
      shelterUnits: shelterUnits(autoStowShelter(inventory)),
      shelterSystemsPct: 60,
      stormPhase: 1, // 1=FLR, 2=CME, 3=SEP, 4=CRaTER
      phaseName: stormPhaseName(1),
      radSeriesIndex: startIdx,
      currentTimeUtc: sample.time,
      externalDoseUGyH: sample.mean_absorbed_dose_rate_uGy_h,
      peakObservedDoseUGyH: sample.mean_absorbed_dose_rate_uGy_h,
      cumulativeCrewDoseUGy: 0,
      unshieldedCumulativeUGy: 0,
      shieldAttenuationFactor: 0.78,
      shieldReadinessPct: 86,
      solarArrayIntegrityPct: 100,
      flrRadioStaticActive: false,
      stormComplete: startIdx >= series.length - 1,
    },
  };
}

/**
 * Move the storm phase marker (FLR -> CME -> SEP -> CRaTER) without real-time timers.
 * Non-finite targets keep the current phase. Sequencing rules live in gameState.advanceStormPhase.
 */
export function transitionStormPhase(
  state: GameState,
  nextPhase: number,
): GameState {
  const currentPhase = state.subSystems.radiation.stormPhase ?? 1;
  const clampedPhase = clamp(
    Math.round(Number.isFinite(nextPhase) ? nextPhase : currentPhase),
    1,
    4,
  );
  return {
    ...state,
    subSystems: {
      ...state.subSystems,
      radiation: {
        ...state.subSystems.radiation,
        stormPhase: clampedPhase,
        phaseName: stormPhaseName(clampedPhase),
        // Radio static visual glitch illuminates on entering Phase 1 (FLR), clears afterward.
        flrRadioStaticActive: clampedPhase === 1,
      },
    },
  };
}

/**
 * Advance one timestamped step across CRaTER-D1D2 measurements (honoring irregular 1h/2h intervals!).
 */
export function stepRadiationTick(
  state: GameState,
  radiationData: RadiationDataset,
): GameState {
  const series = radiationData.radiation_series;
  const prevRad = state.subSystems.radiation;
  // The real CRaTER-D1D2 window has ended: stepping further must not invent dose or time.
  if (prevRad.radSeriesIndex >= series.length - 1) {
    return state;
  }
  const nextIdx = prevRad.radSeriesIndex + 1;
  const stormComplete = nextIdx >= series.length - 1;
  const currSample = at(series, prevRad.radSeriesIndex);
  const nextSample = at(series, nextIdx);

  // Integrate using real UTC delta hours between RadLab points (handles both 1h and 2h orbital gaps).
  const msDelta = Date.parse(nextSample.time) - Date.parse(currSample.time);
  const dtHours = msDelta > 0 ? msDelta / 3600000 : 1;

  const stormStart = Math.max(
    0,
    series.findIndex((row) => row.time >= DEFAULT_STORM_SERIES_START_OFFSET_TIME),
  );
  const progressAt = (idx: number) =>
    series.length - 1 > stormStart
      ? clamp((idx - stormStart) / (series.length - 1 - stormStart), 0, 1)
      : 1;
  const evalRes = evaluateRadiationCouplings(
    state.controls.act3,
    prevRad,
    state.carryOver,
    state.subSystems.cabin,
    state.resources.foodProduction,
    progressAt(prevRad.radSeriesIndex),
  );

  const avgExternalDose =
    (currSample.mean_absorbed_dose_rate_uGy_h +
      nextSample.mean_absorbed_dose_rate_uGy_h) /
    2;
  const unshieldedStep = avgExternalDose * dtHours;
  const crewStep = unshieldedStep * (1 - evalRes.shieldAttenuationFactor);

  const nextCumulativeCrew = roundTo(
    prevRad.cumulativeCrewDoseUGy + crewStep,
    2,
  );
  const nextUnshielded = roundTo(
    prevRad.unshieldedCumulativeUGy + unshieldedStep,
    2,
  );
  const nextPeak = Math.max(
    prevRad.peakObservedDoseUGyH,
    nextSample.mean_absorbed_dose_rate_uGy_h,
  );

  const nextRadState = {
    ...prevRad,
    radSeriesIndex: nextIdx,
    currentTimeUtc: nextSample.time,
    externalDoseUGyH: nextSample.mean_absorbed_dose_rate_uGy_h,
    peakObservedDoseUGyH: nextPeak,
    cumulativeCrewDoseUGy: nextCumulativeCrew,
    unshieldedCumulativeUGy: nextUnshielded,
    shieldAttenuationFactor: evalRes.shieldAttenuationFactor,
    shieldReadinessPct: evalRes.shieldReadinessPct,
    shelterUnits: evalRes.shelterUnits,
    shelterSystemsPct: evalRes.shelterSystemsPct,
    solarArrayIntegrityPct: evalRes.solarArrayIntegrityPct,
    flrRadioStaticActive: false,
    stormComplete,
    // Reaching the end of the real data window always lands on the final CRaTER phase.
    ...(stormComplete ? { stormPhase: 4, phaseName: stormPhaseName(4) } : {}),
  };

  const reEval = evaluateRadiationCouplings(
    state.controls.act3,
    nextRadState,
    state.carryOver,
    state.subSystems.cabin,
    state.resources.foodProduction,
    progressAt(nextIdx),
  );

  return {
    ...state,
    meta: {
      ...state.meta,
      tickCount: state.meta.tickCount + 1,
      act3StepsCompleted: state.meta.act3StepsCompleted + 1,
    },
    resources: {
      powerLifeSupport: reEval.coupledPowerScore,
      foodProduction: reEval.coupledFoodScore,
      radiationShielding: reEval.radiationShieldingScore,
    },
    subSystems: {
      ...state.subSystems,
      power: {
        ...state.subSystems.power,
        stormBudgetKw: reEval.budgetKw,
        batteryPct: roundTo(reEval.effectiveBatteryPct, 1),
      },
      cabin: {
        ...state.subSystems.cabin,
        co2Ppm: reEval.stormCo2Ppm,
        temperatureDegC: reEval.stormTempDegC,
      },
      radiation: nextRadState,
    },
  };
}
