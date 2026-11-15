/**
 * Shared types for the Moonatics simulation engine.
 * Raw NASA metrics (RR-28, OSD-766/767, DONKI, CRaTER-D1D2) stay separate from game interpretation.
 */

export type AgeBand = "7-9" | "10-12";
export type ActNumber = 1 | 2 | 3 | 4;
export type SafeZone = "LOW" | "SAFE" | "CAUTION" | "HIGH";
/** What can be placed around the crew shelter. Physical material only: it is what attenuates radiation. */
export type ShieldItem = "water" | "supply" | "equipment";
export type PowerSystem = keyof SepAllocation;
export type LightPreset = "red_rich" | "blue_rich";
export type CropVulnerability = "RESILIENT" | "SENSITIVE";

/* ----------------------------- NASA datasets ----------------------------- */

/** OSDR RR-28 hourly cabin telemetry sample. */
export interface LifeSupportSample {
  time: string;
  temperature_degC: number;
  relative_humidity_percent: number;
  co2_ppm: number;
}

export interface LifeSupportDataset {
  metadata: Record<string, unknown>;
  series: LifeSupportSample[];
}

export interface LightRecipe {
  nominal_recipe_percent: { red: number; blue: number };
}

/** OSDR OSD-766 / OSD-767 VEG-05 tomato experiment (only fields the engine reads are typed strictly). */
export interface FoodDataset {
  metadata: Record<string, unknown>;
  experiment: {
    duration_days: number;
    harvest_days_planned: number[];
    lighting_treatments?: Partial<Record<LightPreset, LightRecipe>>;
  } & Record<string, unknown>;
  water_management_observations_osd766?: Record<string, unknown>;
  plant_and_fruit_outcomes_osd766?: {
    red_rich_flight?: { ripe_fruits_produced?: number };
    blue_rich_flight?: { ripe_fruits_by_day_100?: number };
  } & Record<string, unknown>;
  lighting_and_stress_findings_osd767?: Record<string, unknown>;
}

export interface StormEvent {
  type: string;
  id?: string;
  class?: string;
  speed_km_s?: number;
  energy_threshold?: string;
  begin_time?: string;
  peak_time?: string;
  end_time?: string;
  [key: string]: unknown;
}

export interface RadiationSample {
  time: string;
  mean_absorbed_dose_rate_uGy_h: number;
  max_absorbed_dose_rate_uGy_h: number;
  sample_count: number;
}

/** CCMC DONKI June 7-9 2024 storm events + RadLab CRaTER-D1D2 dose-rate series. */
export interface RadiationDataset {
  metadata: Record<string, unknown>;
  events: StormEvent[];
  radiation_series: RadiationSample[];
}

export interface NasaDatasets {
  lifeSupport: LifeSupportDataset;
  food: FoodDataset;
  radiation: RadiationDataset;
}

/* ------------------------------ Game state ------------------------------- */

export interface Act1Controls {
  airFiltration: number;
  climateControl: number;
  waterRecovery: number;
}

export interface Act2Controls {
  waterFlow: number;
  redLight: number;
  blueLight: number;
}

export interface SepAllocation {
  shelterKw: number;
  cabinKw: number;
  greenhouseKw: number;
}

export interface Act3Controls {
  /** true = PROTECT ARRAYS (less power, no wear); false = KEEP DEPLOYED (more power, simulated wear). */
  cmeRetractArrays: boolean;
  /** Power blocks for shelter systems, life support and greenhouse. Power runs systems; it never shields. */
  sepPowerAlloc: SepAllocation;
  /** The shielding positions around the crew compartment: PHYSICAL material, the only thing that attenuates radiation. */
  shelter: (ShieldItem | null)[];
  /** The one emergency reroute allowed during the storm, once it has been used. */
  reroute: { from: PowerSystem; to: PowerSystem } | null;
}

export interface ShelterInventory {
  water: number;
  supply: number;
  equipment: number;
}

/** The three persistent core resource bars (0-100). */
export interface Resources {
  powerLifeSupport: number;
  foodProduction: number;
  radiationShielding: number;
}

export interface PowerState {
  batteryPct: number;
  generationKw: number;
  demandKw: number;
  netKw: number;
  stormBudgetKw: number;
}

export interface WaterState {
  reserveLiters: number;
  maxLiters: number;
}

export interface CabinZones {
  co2: SafeZone;
  temperature: SafeZone;
  humidity: SafeZone;
}

export interface CabinState {
  baselineIndex: number;
  baselineTimeUtc: string;
  rawSample: LifeSupportSample;
  co2Ppm: number;
  temperatureDegC: number;
  relativeHumidityPct: number;
  dryCabinAirRisk: boolean;
  zones: CabinZones;
  habitabilityScore: number;
}

export interface SpectralMix {
  redPct: number;
  bluePct: number;
  recipeLabel: string;
}

/** Day / milestone bookkeeping the crop model needs before it is evaluated. */
export interface GreenhouseBase {
  day: number;
  milestoneIndex: number;
  baseCropHealthPct: number;
  waterUsedLiters: number;
}

export interface GreenhouseState extends GreenhouseBase {
  cropHealthPct: number;
  hydrationPct: number;
  rootStressPct: number;
  oxidativeStressPct: number;
  totalParUmolM2s: number;
  spectralMix: SpectralMix;
  estimatedRipeFruits: number;
  prematureDryingRisk: boolean;
  overwateringRisk: boolean;
  ledKw: number;
}

export interface RadiationState {
  /** Shielding material available from earlier missions (water kept, supplies grown). */
  shelterInventory: ShelterInventory;
  /** Protection units placed around the crew (physical shielding only). */
  shelterUnits: number;
  /** Power given to shelter systems (ventilation, monitoring, emergency equipment), 0-100. */
  shelterSystemsPct: number;
  stormPhase: number;
  phaseName: string;
  radSeriesIndex: number;
  currentTimeUtc: string;
  externalDoseUGyH: number;
  peakObservedDoseUGyH: number;
  cumulativeCrewDoseUGy: number;
  unshieldedCumulativeUGy: number;
  shieldAttenuationFactor: number;
  shieldReadinessPct: number;
  solarArrayIntegrityPct: number;
  flrRadioStaticActive: boolean;
  stormComplete: boolean;
}

export interface CarryOver {
  endCo2Ppm: number;
  endTempC: number;
  endRhPercent: number;
  dryCabinAirRisk: boolean;
  act1BatteryCarryPct: number;
  act1WaterCarryLiters: number;
  act2BatteryCarryPct: number;
  stormAvailableKwBudget: number;
  cropHealthAtStormPct: number;
  cropVulnerability: CropVulnerability;
  harvestRipeFruits: number;
  /** Water left in the shared reserve when the greenhouse finished. It becomes shielding material in Act 3. */
  act2WaterCarryLiters?: number;
  /** A temporary cabin-humidity event in the greenhouse. It overlays `endRhPercent` and never replaces it. */
  airOverlayRhPercent?: number;
}

export interface MissionFailure {
  act: number;
  tick: number;
  code:
    | "HABITAT_UNSTABLE"
    | "POWER_BLACKOUT"
    | "CABIN_AIR_UNSAFE"
    | "CROPS_FAILED"
    | "RADIATION_OVEREXPOSURE";
  title: string;
  lesson: string;
}

export interface EventLogEntry {
  tick: number;
  act: number;
  code: string;
  summary: string;
}

/** One 6-hour Act 1 checkpoint: which readings were inside the mission safe zone, and the power picture. */
export interface Act1Checkpoint {
  /** Mission hour at the end of this checkpoint (6, 12, ... 48). */
  hour: number;
  airOk: boolean;
  heatOk: boolean;
  waterOk: boolean;
  /** Air, temperature and humidity were all safe. */
  stable: boolean;
  netKw: number;
  batteryPct: number;
  tankPct: number;
}

export interface MissionMeta {
  currentAct: ActNumber;
  ageBand: AgeBand;
  roleTitle: string;
  tickCount: number;
  act1StepsCompleted: number;
  act2StepsCompleted: number;
  act3StepsCompleted: number;
  completed: boolean;
  failed: boolean;
  failure: MissionFailure | null;
  attempts: number;
  /** Per-checkpoint record of Act 1, used for the pass rule, badges and guide messages. */
  act1History: Act1Checkpoint[];
}

export interface SimulationFlags {
  paused: boolean;
  mode: "MANUAL_STEP";
}

export interface SubSystems {
  power: PowerState;
  water: WaterState;
  cabin: CabinState;
  greenhouse: GreenhouseState;
  radiation: RadiationState;
}

export interface Controls {
  act1: Act1Controls;
  act2: Act2Controls;
  act3: Act3Controls;
}

/** Everything except the act-entry snapshots (which themselves never nest). */
export interface GameStateSnapshot {
  meta: MissionMeta;
  simulation: SimulationFlags;
  resources: Resources;
  controls: Controls;
  subSystems: SubSystems;
  carryOver: CarryOver;
  eventLog: EventLogEntry[];
}

export interface GameState extends GameStateSnapshot {
  checkpoints: Partial<Record<ActNumber, GameStateSnapshot>>;
}
