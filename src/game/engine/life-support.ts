/**
 * Act 1 — Power & Life Support simulation (OSDR RR-28 grounded).
 * Balances cabin CO2, temperature, relative humidity, battery reserve, and water recovery
 * while exporting carry-over state that directly alters Act 2 greenhouse performance.
 */
import type {
  Act1Controls,
  CabinZones,
  CarryOver,
  GameState,
  GameStateSnapshot,
  LifeSupportDataset,
  LifeSupportSample,
  PowerState,
  WaterState,
} from "./types";
import { at, clamp, roundTo } from "./util";

/**
 * Act 1 replays 48 hours of real RR-28 cabin telemetry, starting at hour 63 of the 120-hour record so the window
 * contains the station's real CO2 climb and humidity dips. A do-nothing run only keeps the cabin safe on ~3 of 8 checkpoints.
 */
export const ACT1_SERIES_START_INDEX = 63;
export const ACT1_HOUR_STRIDE = 6;
/** Checkpoints (6 h each) in the mission: 8 x 6 h = 48 h. */
export const ACT1_CHECKPOINTS = 8;
/** Checkpoints with air, temperature and humidity all in the mission safe zone needed to pass Act 1. */
export const ACT1_REQUIRED_STABLE = 6;

/**
 * Number of +6h steps available in Act 1: the mission length, capped by what the RR-28 series can supply (no wrap-around).
 */
export function getAct1MaxSteps(lifeSupportData: LifeSupportDataset): number {
  const len = lifeSupportData.series.length;
  const startIndex = Math.min(ACT1_SERIES_START_INDEX, len - 1);
  return Math.min(
    ACT1_CHECKPOINTS,
    Math.floor((len - 1 - startIndex) / ACT1_HOUR_STRIDE),
  );
}

/** Every lever starts at 50% = "no change": the habitat begins exactly as NASA observed it. */
export const ACT1_NEUTRAL_LEVEL = 50;
export const ACT1_INITIAL_CONTROLS = Object.freeze({
  airFiltration: ACT1_NEUTRAL_LEVEL,
  climateControl: ACT1_NEUTRAL_LEVEL,
  waterRecovery: ACT1_NEUTRAL_LEVEL,
});

export const LIFE_SUPPORT_SAFE_ZONES = Object.freeze({
  co2Ppm: { safeMax: 2800, cautionMax: 4500, rr28Min: 451, rr28Max: 8886 },
  temperatureDegC: {
    safeMin: 20.0,
    safeMax: 24.5,
    rr28Min: 17.7,
    rr28Max: 26.9,
  },
  relativeHumidityPct: {
    safeMin: 38.0,
    safeMax: 62.0,
    dryWarningBelow: 37.6,
    rr28Min: 31.0,
    rr28Max: 71.0,
  },
});

/**
 * Compute live coupled cabin metrics for the current RR-28 hourly sample and sliders.
 * Pure calculation: does not mutate permanent step accumulators so dragging sliders cannot farm points.
 */
export function evaluateLifeSupport(
  controls: Act1Controls,
  baselineSample: LifeSupportSample,
  powerState: Pick<PowerState, "batteryPct">,
  waterState: WaterState,
) {
  const airFiltration = clamp(controls.airFiltration, 0, 100);
  const climateControl = clamp(controls.climateControl, 0, 100);
  const waterRecovery = clamp(controls.waterRecovery, 0, 100);

  // Scrubber removes CO2 relative to the 50% neutral fan speed (50% = the raw NASA reading).
  const co2Delta = (airFiltration - ACT1_NEUTRAL_LEVEL) * 42;
  const co2Ppm = Math.round(
    clamp(baselineSample.co2_ppm - co2Delta, 420, 9500),
  );

  // Climate control < 50 warms cabin; > 50 cools cabin relative to RR-28 baseline temperature.
  const tempOffset = (50 - climateControl) * 0.14;
  const temperatureDegC = roundTo(
    clamp(baselineSample.temperature_degC + tempOffset, 15.0, 31.0),
    1,
  );

  // Relative humidity couples to temperature, scrubber airflow, and water reclamation extraction.
  const fanDrying = (airFiltration - 50) * 0.05;
  const hvacDrying =
    Math.max(0, climateControl - 55) * 0.14 -
    Math.max(0, 45 - climateControl) * 0.08;
  const recoveryDrying = (waterRecovery - ACT1_NEUTRAL_LEVEL) * 0.25;
  const relativeHumidityPct = roundTo(
    clamp(
      baselineSample.relative_humidity_percent -
        fanDrying -
        hvacDrying -
        recoveryDrying,
      24.0,
      82.0,
    ),
    1,
  );

  // Coupled power demand (kW) against quiet lunar daylight solar array output (~4.2 kW).
  const generationKw = 4.2;
  const fanKw = 0.55 + (airFiltration / 100) * 2.35;
  const hvacKw = 0.65 + Math.abs(climateControl - 50) * 0.045;
  const waterKw = 0.4 + (waterRecovery / 100) * 1.8;
  const demandKw = roundTo(fanKw + hvacKw + waterKw, 2);
  const netKw = roundTo(generationKw - demandKw, 2);

  // Per-step accumulators when user advances +1 Step (water recovery breaks even around ~53.5%).
  const batteryDeltaPerStep = roundTo(netKw * 3.4, 1);
  const recoveredWaterLiters = roundTo(
    Math.max(0, (waterRecovery - 34) * 0.072),
    2,
  );
  const cabinWaterUseL = 1.4;
  const waterDeltaPerStep = roundTo(recoveredWaterLiters - cabinWaterUseL, 2);

  // Classify Safe Zones (LOW | SAFE | HIGH).
  const zones: CabinZones = {
    co2:
      co2Ppm <= LIFE_SUPPORT_SAFE_ZONES.co2Ppm.safeMax
        ? "SAFE"
        : co2Ppm <= LIFE_SUPPORT_SAFE_ZONES.co2Ppm.cautionMax
          ? "CAUTION"
          : "HIGH",
    temperature:
      temperatureDegC < LIFE_SUPPORT_SAFE_ZONES.temperatureDegC.safeMin
        ? "LOW"
        : temperatureDegC > LIFE_SUPPORT_SAFE_ZONES.temperatureDegC.safeMax
          ? "HIGH"
          : "SAFE",
    humidity:
      relativeHumidityPct < LIFE_SUPPORT_SAFE_ZONES.relativeHumidityPct.safeMin
        ? "LOW"
        : relativeHumidityPct >
            LIFE_SUPPORT_SAFE_ZONES.relativeHumidityPct.safeMax
          ? "HIGH"
          : "SAFE",
  };

  // Composite Act 1 resource score (0-100) combining battery reserve + cabin habitability.
  const co2Penalty = Math.max(
    0,
    (co2Ppm - LIFE_SUPPORT_SAFE_ZONES.co2Ppm.safeMax) / 140,
  );
  const tempPenalty =
    temperatureDegC < 20
      ? (20 - temperatureDegC) * 4.5
      : temperatureDegC > 24.5
        ? (temperatureDegC - 24.5) * 4.5
        : 0;
  const rhPenalty =
    relativeHumidityPct < 38
      ? (38 - relativeHumidityPct) * 1.4
      : relativeHumidityPct > 62
        ? (relativeHumidityPct - 62) * 1.4
        : 0;
  const habitabilityScore = clamp(
    100 - co2Penalty - tempPenalty - rhPenalty,
    10,
    100,
  );

  const projectedBatteryPct = clamp(
    powerState.batteryPct + batteryDeltaPerStep * 0.35,
    5,
    100,
  );
  const powerLifeSupportScore = roundTo(
    clamp(projectedBatteryPct * 0.55 + habitabilityScore * 0.45, 5, 100),
    1,
  );

  return {
    co2Ppm,
    temperatureDegC,
    relativeHumidityPct,
    generationKw,
    demandKw,
    netKw,
    /** Power drawn by each lever (kW); these three always add up to `demandKw`. */
    drawKw: {
      scrubbers: roundTo(fanKw, 2),
      thermostat: roundTo(hvacKw, 2),
      recycler: roundTo(waterKw, 2),
    },
    /**
     * What each lever adds to or removes from the real RR-28 reading, before safety clamping.
     * Positive raises the value, negative lowers it. Used for the on-screen "why" lines.
     */
    effects: {
      co2Ppm: { scrubbers: -co2Delta },
      temperatureDegC: { thermostat: tempOffset },
      humidityPct: {
        scrubbers: -fanDrying,
        thermostat: -hvacDrying,
        recycler: -recoveryDrying,
      },
    },
    batteryDeltaPerStep,
    waterDeltaPerStep,
    recoveredWaterLiters,
    projectedWaterL: roundTo(
      clamp(
        waterState.reserveLiters + waterDeltaPerStep * 0.25,
        0,
        waterState.maxLiters,
      ),
      1,
    ),
    dryCabinAirRisk:
      relativeHumidityPct <
      LIFE_SUPPORT_SAFE_ZONES.relativeHumidityPct.dryWarningBelow,
    zones,
    habitabilityScore: roundTo(habitabilityScore, 1),
    powerLifeSupportScore,
  };
}

/**
 * Initialize Act 1 baseline fields using real RR-28 hourly telemetry.
 */
export function buildInitialLifeSupportState(
  lifeSupportData: LifeSupportDataset,
) {
  const series = lifeSupportData.series;
  const startIndex = Math.min(ACT1_SERIES_START_INDEX, series.length - 1);
  const sample = at(series, startIndex);
  const power = {
    batteryPct: 76,
    generationKw: 4.2,
    demandKw: 3.1,
    netKw: 1.1,
    stormBudgetKw: 8,
  };
  const water = { reserveLiters: 36, maxLiters: 60 };
  const evaluated = evaluateLifeSupport(
    ACT1_INITIAL_CONTROLS,
    sample,
    power,
    water,
  );

  return {
    controls: { ...ACT1_INITIAL_CONTROLS },
    power,
    water,
    cabin: {
      baselineIndex: startIndex,
      baselineTimeUtc: sample.time,
      rawSample: { ...sample },
      co2Ppm: evaluated.co2Ppm,
      temperatureDegC: evaluated.temperatureDegC,
      relativeHumidityPct: evaluated.relativeHumidityPct,
      dryCabinAirRisk: evaluated.dryCabinAirRisk,
      zones: evaluated.zones,
      habitabilityScore: evaluated.habitabilityScore,
    },
    powerLifeSupportScore: evaluated.powerLifeSupportScore,
  };
}

/**
 * Advance one discrete simulation step in Act 1 (+6h along RR-28 telemetry curve)
 * and lock battery/water accumulation into state.
 */
export function stepLifeSupportTick(
  state: GameState,
  lifeSupportData: LifeSupportDataset,
): GameState {
  const series = lifeSupportData.series;
  if (state.meta.act1StepsCompleted >= getAct1MaxSteps(lifeSupportData)) {
    return state;
  }
  const nextIndex = state.subSystems.cabin.baselineIndex + ACT1_HOUR_STRIDE;
  const sample = at(series, nextIndex);
  const controls = state.controls.act1;

  const currentEval = evaluateLifeSupport(
    controls,
    state.subSystems.cabin.rawSample,
    state.subSystems.power,
    state.subSystems.water,
  );

  const nextBattery = roundTo(
    clamp(
      state.subSystems.power.batteryPct + currentEval.batteryDeltaPerStep,
      8,
      100,
    ),
    1,
  );
  const nextWater = roundTo(
    clamp(
      state.subSystems.water.reserveLiters + currentEval.waterDeltaPerStep,
      6,
      state.subSystems.water.maxLiters,
    ),
    1,
  );

  const updatedPower = {
    ...state.subSystems.power,
    batteryPct: nextBattery,
    generationKw: currentEval.generationKw,
    demandKw: currentEval.demandKw,
    netKw: currentEval.netKw,
  };
  const updatedWater = {
    ...state.subSystems.water,
    reserveLiters: nextWater,
  };

  const nextEval = evaluateLifeSupport(
    controls,
    sample,
    updatedPower,
    updatedWater,
  );

  return {
    ...state,
    meta: {
      ...state.meta,
      tickCount: state.meta.tickCount + 1,
      act1StepsCompleted: state.meta.act1StepsCompleted + 1,
    },
    resources: {
      ...state.resources,
      powerLifeSupport: Math.round(nextEval.powerLifeSupportScore),
    },
    subSystems: {
      ...state.subSystems,
      power: updatedPower,
      water: updatedWater,
      cabin: {
        baselineIndex: nextIndex,
        baselineTimeUtc: sample.time,
        rawSample: { ...sample },
        co2Ppm: nextEval.co2Ppm,
        temperatureDegC: nextEval.temperatureDegC,
        relativeHumidityPct: nextEval.relativeHumidityPct,
        dryCabinAirRisk: nextEval.dryCabinAirRisk,
        zones: nextEval.zones,
        habitabilityScore: nextEval.habitabilityScore,
      },
    },
  };
}

/**
 * Snapshot Act 1 outcomes as immutable carry-over into Act 2 (Greenhouse) & Act 3 (Storm).
 */
export function captureLifeSupportCarryOver(
  state: Pick<GameStateSnapshot, "subSystems" | "carryOver">,
): CarryOver {
  const { cabin, power, water } = state.subSystems;
  return {
    ...state.carryOver,
    endCo2Ppm: cabin.co2Ppm,
    endTempC: cabin.temperatureDegC,
    endRhPercent: cabin.relativeHumidityPct,
    dryCabinAirRisk: cabin.dryCabinAirRisk,
    act1BatteryCarryPct: power.batteryPct,
    act1WaterCarryLiters: water.reserveLiters,
  };
}
