/**
 * Act 2 — Food Production simulation (OSDR OSD-766 & OSD-767 VEG-05 grounded).
 * Couples Act 1 cabin environment (RH drying, temp, CO2) + shared water/battery reserves
 * against Water Flow and Red/Blue LED spectral choices across Days 1 -> 10 -> 30 -> 60 -> 100.
 */
import type {
  Act2Controls,
  CarryOver,
  FoodDataset,
  GameState,
  GameStateSnapshot,
  GreenhouseBase,
  LightPreset,
  PowerState,
  WaterState,
} from "./types";
import { tuningFor } from "./difficulty";
import { at, clamp, roundTo } from "./util";

export const VEG05_MILESTONES = Object.freeze([1, 10, 30, 60, 100]);

export const ACT2_INITIAL_CONTROLS = Object.freeze({
  waterFlow: 55,
  redLight: 75,
  blueLight: 25,
});

/** Litres of water one growth step uses at a given water flow (0-100). Used to show the cost before the player chooses. */
export function waterUsePerStep(waterFlow: number, waterUse = 1): number {
  return roundTo((1.2 + (clamp(waterFlow, 0, 100) / 100) * 4.6) * waterUse, 1);
}

/**
 * Calculate live coupled VEG-05 greenhouse response from current sliders + Act 1 cabin carry-over.
 */
export function evaluateFoodProduction(
  controls: Act2Controls,
  greenState: GreenhouseBase,
  powerState: Pick<PowerState, "batteryPct">,
  waterState: WaterState,
  carryOver: Partial<CarryOver>,
  foodData?: FoodDataset,
  /** Difficulty: multiplier on water used per step (1 = Explorer). */
  waterUse = 1,
) {
  const waterFlow = clamp(controls.waterFlow, 0, 100);
  const redLight = clamp(controls.redLight, 5, 100);
  const blueLight = clamp(controls.blueLight, 5, 100);

  // Convert slider levels into approximate PAR scale aligned to OSD-766 flight LED measurements (~277-280 total at 100%).
  const redRatioRaw = redLight / (redLight + blueLight);
  const redPct = Math.round(redRatioRaw * 100);
  const bluePct = 100 - redPct;
  const totalParUmolM2s = roundTo(((redLight + blueLight) / 115) * 278, 1);

  const ledIntensityAvg = (redLight + blueLight) / 2;
  const ledKw = roundTo(0.95 + (ledIntensityAvg / 100) * 3.15, 2);
  const waterDemandLPerStep = roundTo((1.2 + (waterFlow / 100) * 4.6) * waterUse, 2);

  // Effective water delivered depends on shared Act 1 water reserve.
  const waterShortageFactor =
    waterState.reserveLiters < waterDemandLPerStep
      ? clamp(waterState.reserveLiters / waterDemandLPerStep, 0.25, 1)
      : 1;
  const deliveredWaterFlow = waterFlow * waterShortageFactor;

  // Act 1 RH < 37.6% accelerates early pillow drying (OSD-766 DAY 0-2 finding).
  // A temporary dry-air event overlays Act 1's humidity; when it ends, Act 1's own value is back.
  const cabinRh = carryOver.airOverlayRhPercent ?? carryOver.endRhPercent ?? 40;
  const cabinTempC = carryOver.endTempC ?? 23.0;
  const cabinCo2 = carryOver.endCo2Ppm ?? 1946;

  const dryAirPenalty = cabinRh < 37.6 ? (37.6 - cabinRh) * 1.45 : 0;
  const hydrationPct = roundTo(
    clamp(deliveredWaterFlow - dryAirPenalty + 12, 10, 100),
    1,
  );

  // Two-sided stress curve: too dry causes wilting/drying; too wet in microgravity causes wicking/root stress.
  const dryingStress = hydrationPct < 46 ? (46 - hydrationPct) * 1.35 : 0;
  const humidBoost = cabinRh > 56 ? (cabinRh - 56) * 0.55 : 0;
  const overwateringStress =
    deliveredWaterFlow > 72 ? (deliveredWaterFlow - 72) * 1.55 + humidBoost : 0;
  const rootStressPct = roundTo(
    clamp(dryingStress + overwateringStress, 0, 100),
    1,
  );

  // Light recipe is deliberately neutral: OSD-766/767 are too small and confounded to rank one recipe above the other,
  // so neither recipe gets a yield bonus or a stress penalty here. Light matters only through total PAR.
  const excessTempStress = Math.abs(cabinTempC - 23.0) * 3.8;
  const co2Penalty =
    cabinCo2 > 4200
      ? (cabinCo2 - 4200) * 0.008
      : cabinCo2 < 700
        ? (700 - cabinCo2) * 0.025
        : 0;
  const oxidativeStressPct = roundTo(
    clamp(excessTempStress + dryingStress * 0.25, 0, 100),
    1,
  );

  // Canopy growth & fruit outcome shaped by PAR, CO2, and stress mitigation (dark rooms/flooding collapse crop).
  const parFactor = clamp(totalParUmolM2s / 260, 0.14, 1.05);
  const insufficientLightStress =
    totalParUmolM2s < 120 ? (120 - totalParUmolM2s) * 0.42 : 0;
  const excessParStress =
    totalParUmolM2s > 340 ? (totalParUmolM2s - 340) * 0.16 : 0;
  const combinedStress =
    rootStressPct * 0.68 +
    oxidativeStressPct * 0.36 +
    co2Penalty +
    insufficientLightStress +
    excessParStress;
  const milestoneFactor =
    0.42 + (greenState.milestoneIndex / (VEG05_MILESTONES.length - 1)) * 0.58;

  const cropHealthPct = roundTo(
    clamp(
      greenState.baseCropHealthPct * 0.42 +
        (94 * parFactor - combinedStress) * 0.58,
      15,
      100,
    ),
    1,
  );
  const foodProductionScore = roundTo(
    clamp(
      cropHealthPct *
        (0.76 + milestoneFactor * 0.24),
      12,
      100,
    ),
    1,
  );

  // Ripe-fruit ceiling: the midpoint of the two observed counts (5 and 6), the same for every recipe.
  const observedRipe = foodData?.plant_and_fruit_outcomes_osd766;
  const maxFruits =
    ((observedRipe?.red_rich_flight?.ripe_fruits_produced ?? 5) +
      (observedRipe?.blue_rich_flight?.ripe_fruits_by_day_100 ?? 6)) /
    2;
  const fruitHealthRatio =
    cropHealthPct < 35 || totalParUmolM2s < 90
      ? 0
      : clamp((cropHealthPct - 35) / 42, 0, 1.04);
  const rootYieldGuard = rootStressPct > 35 ? 0.65 : 1.0;
  const estimatedRipeFruits = Math.max(
    0,
    Math.round(maxFruits * fruitHealthRatio * milestoneFactor * rootYieldGuard),
  );

  // Couple LED electrical draw across multi-week VEG-05 milestones back into Outpost Battery carry-over.
  const generationKw = 4.2;
  const netKw = roundTo(generationKw - (ledKw + 1.5), 2);
  const batteryDeltaPerStep = roundTo(netKw * 7.2, 1);

  return {
    totalParUmolM2s,
    spectralMix: {
      redPct,
      bluePct,
      recipeLabel:
        redPct >= 75
          ? "Red-Rich (90R:10B)"
          : bluePct >= 38
            ? "Blue-Rich (50R:50B)"
            : "Custom Mix",
    },
    ledKw,
    waterDemandLPerStep,
    batteryDeltaPerStep,
    hydrationPct,
    rootStressPct,
    oxidativeStressPct,
    cropHealthPct,
    foodProductionScore,
    estimatedRipeFruits,
    prematureDryingRisk:
      hydrationPct < 45 || (cabinRh < 37.6 && waterFlow < 60),
    overwateringRisk: deliveredWaterFlow > 74,
  };
}

/**
 * Initialize Act 2 greenhouse state using Act 1 cabin carry-over values.
 */
export function buildInitialFoodState(
  foodData: FoodDataset,
  carryOver: Partial<CarryOver>,
  powerState: Pick<PowerState, "batteryPct">,
  waterState: WaterState,
) {
  const baseGreen = {
    day: at(VEG05_MILESTONES, 0, "milestone"),
    milestoneIndex: 0,
    baseCropHealthPct: 72,
    waterUsedLiters: 0,
  };
  const evaluated = evaluateFoodProduction(
    ACT2_INITIAL_CONTROLS,
    baseGreen,
    powerState,
    waterState,
    carryOver,
    foodData,
  );

  return {
    controls: { ...ACT2_INITIAL_CONTROLS },
    greenhouse: {
      ...baseGreen,
      cropHealthPct: evaluated.cropHealthPct,
      hydrationPct: evaluated.hydrationPct,
      rootStressPct: evaluated.rootStressPct,
      oxidativeStressPct: evaluated.oxidativeStressPct,
      totalParUmolM2s: evaluated.totalParUmolM2s,
      spectralMix: evaluated.spectralMix,
      estimatedRipeFruits: evaluated.estimatedRipeFruits,
      prematureDryingRisk: evaluated.prematureDryingRisk,
      overwateringRisk: evaluated.overwateringRisk,
      ledKw: evaluated.ledKw,
    },
    foodProductionScore: evaluated.foodProductionScore,
  };
}

/**
 * Apply OSD-766 flight lighting preset ('red_rich' 90R:10B or 'blue_rich' 50R:50B).
 */
export function getVeg05PresetControls(
  foodData: FoodDataset | undefined,
  presetKey: LightPreset,
) {
  const recipe =
    foodData?.experiment?.lighting_treatments?.[presetKey]
      ?.nominal_recipe_percent;
  if (!recipe) {
    return presetKey === "blue_rich"
      ? { redLight: 50, blueLight: 50 }
      : { redLight: 90, blueLight: 10 };
  }
  return {
    redLight: recipe.red,
    blueLight: recipe.blue,
  };
}

/**
 * Advance one milestone step in Act 2 (Day 1 -> 10 -> 30 -> 60 -> 100),
 * spending shared water liters & battery power from Act 1 carry-over.
 */
export function stepFoodTick(
  state: GameState,
  foodData: FoodDataset,
): GameState {
  const prevGreen = state.subSystems.greenhouse;
  // Day 100 is the final milestone: further steps must not keep draining power and water.
  if (prevGreen.milestoneIndex >= VEG05_MILESTONES.length - 1) {
    return state;
  }
  const nextIdx = prevGreen.milestoneIndex + 1;
  const nextDay = at(VEG05_MILESTONES, nextIdx, "milestone");

  const curEval = evaluateFoodProduction(
    state.controls.act2,
    prevGreen,
    state.subSystems.power,
    state.subSystems.water,
    state.carryOver,
    foodData,
    tuningFor(state.meta.ageBand).waterUse,
  );

  const nextBattery = roundTo(
    clamp(
      state.subSystems.power.batteryPct + curEval.batteryDeltaPerStep,
      12,
      100,
    ),
    1,
  );
  const actualWaterSpent = roundTo(
    Math.min(state.subSystems.water.reserveLiters, curEval.waterDemandLPerStep),
    2,
  );
  const nextWater = roundTo(
    clamp(
      state.subSystems.water.reserveLiters - actualWaterSpent,
      0,
      state.subSystems.water.maxLiters,
    ),
    1,
  );

  const updatedPower = {
    ...state.subSystems.power,
    batteryPct: nextBattery,
    generationKw: 4.2,
    demandKw: roundTo(curEval.ledKw + 1.5, 2),
    netKw: roundTo(4.2 - (curEval.ledKw + 1.5), 2),
  };
  const updatedWater = {
    ...state.subSystems.water,
    reserveLiters: nextWater,
  };

  const steppedGreen = {
    ...prevGreen,
    day: nextDay,
    milestoneIndex: nextIdx,
    baseCropHealthPct: roundTo(
      clamp((prevGreen.baseCropHealthPct + curEval.cropHealthPct) / 2, 15, 100),
      1,
    ),
    waterUsedLiters: roundTo(prevGreen.waterUsedLiters + actualWaterSpent, 1),
  };

  const nextEval = evaluateFoodProduction(
    state.controls.act2,
    steppedGreen,
    updatedPower,
    updatedWater,
    state.carryOver,
    foodData,
    tuningFor(state.meta.ageBand).waterUse,
  );

  // Also nudge Power & Life Support bar cleanly if greenhouse drained batteries!
  const updatedPowerBar = Math.round(
    clamp(
      nextBattery * 0.55 + state.subSystems.cabin.habitabilityScore * 0.45,
      5,
      100,
    ),
  );

  return {
    ...state,
    meta: {
      ...state.meta,
      tickCount: state.meta.tickCount + 1,
      act2StepsCompleted: state.meta.act2StepsCompleted + 1,
    },
    resources: {
      ...state.resources,
      powerLifeSupport: updatedPowerBar,
      foodProduction: Math.round(nextEval.foodProductionScore),
    },
    subSystems: {
      ...state.subSystems,
      power: updatedPower,
      water: updatedWater,
      greenhouse: {
        ...steppedGreen,
        cropHealthPct: nextEval.cropHealthPct,
        hydrationPct: nextEval.hydrationPct,
        rootStressPct: nextEval.rootStressPct,
        oxidativeStressPct: nextEval.oxidativeStressPct,
        totalParUmolM2s: nextEval.totalParUmolM2s,
        spectralMix: nextEval.spectralMix,
        estimatedRipeFruits: nextEval.estimatedRipeFruits,
        prematureDryingRisk: nextEval.prematureDryingRisk,
        overwateringRisk: nextEval.overwateringRisk,
        ledKw: nextEval.ledKw,
      },
    },
  };
}

/**
 * Snapshot Act 2 harvest + remaining storm power budget into carry-over entering Act 3.
 */
export function captureFoodCarryOver(
  state: Pick<GameStateSnapshot, "subSystems" | "carryOver">,
): CarryOver {
  const { power, greenhouse } = state.subSystems;
  // Converts carried battery % (12..100%) into constrained storm budget (5..9 kW < 12 kW full demand).
  const stormBudgetKw = Math.round(
    clamp(5 + (power.batteryPct - 35) * 0.065, 5, 9),
  );

  return {
    ...state.carryOver,
    act2BatteryCarryPct: power.batteryPct,
    stormAvailableKwBudget: stormBudgetKw,
    cropHealthAtStormPct: greenhouse.cropHealthPct,
    cropVulnerability:
      greenhouse.rootStressPct > 35 || greenhouse.oxidativeStressPct > 35
        ? "SENSITIVE"
        : "RESILIENT",
    harvestRipeFruits: greenhouse.estimatedRipeFruits,
    act2WaterCarryLiters: (state.subSystems as { water?: { reserveLiters: number } }).water?.reserveLiters ?? 0,
  };
}
