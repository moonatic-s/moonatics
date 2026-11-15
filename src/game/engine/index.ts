/**
 * Moonatics simulation engine (TypeScript port of the NASA-data-grounded 3-act model).
 * Import from '@/game/engine'; internals live in life-support.ts, food.ts, radiation.ts, mission.ts.
 */
export * from "./types";
export * from "./adapter";
export {
  DEFAULT_NASA_DATASETS,
  MISSION_FAILURE_LIMITS,
  ROLES_BY_ACT,
  createGameState,
  togglePaused,
  setAgeBand,
  updateLifeSupportControls,
  updateFoodControls,
  applyFoodPreset,
  startFoodMission,
  startStormMission,
  applySupplyDrop,
  setCabinAir,
  DRY_AIR_RH_PCT,
  setShelterMaterials,
  rerouteStormPower,
  dismissFlrStatic,
  setCmeDecision,
  setSepPowerAllocation,
  advanceStormPhase,
  stepMission,
  stepUntilActComplete,
  advanceAct,
  isActComplete,
  getAdvanceStatus,
  getAct1Objective,
  retryAct,
  evaluateMissionFailure,
  forecastNextStep,
  getLifeSupportBreakdown,
  getAgeAdaptedTelemetry,
  buildDebriefSummary,
} from "./mission";
export { TUNING, tuningFor, doseLimitFor, BASE_DOSE_LIMIT_UGY } from "./difficulty";
export { SEP_DEMAND_KW, SHELTER_SLOT_COUNT, SHIELD_ITEM_UNITS } from "./radiation";
export { captureLifeSupportCarryOver } from "./life-support";
export { captureFoodCarryOver, waterUsePerStep } from "./food";
export {
  getAct1MaxSteps,
  ACT1_HOUR_STRIDE,
  ACT1_CHECKPOINTS,
  ACT1_REQUIRED_STABLE,
  ACT1_NEUTRAL_LEVEL,
  LIFE_SUPPORT_SAFE_ZONES,
} from "./life-support";
export type { AdvanceStatus, CreateGameOptions } from "./mission";
