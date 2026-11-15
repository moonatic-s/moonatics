/**
 * Temporary mock reactions for the Life Support prototype.
 * Swap `stepLifeSupport` for the real game engine later; UI only reads LifeSupportState.
 */
import type { TelemetryRecord } from './telemetry';
export type ControlLevel = 0 | 1 | 2 | 3;
export interface LifeSupportControls { filtrationLevel: ControlLevel; climateLevel: ControlLevel; humiditySupportLevel: ControlLevel }
export interface LifeSupportState {
  tick: number; co2: number; temperature: number; humidity: number;
  power: number; water: number; safety: number;
  history: { co2: number[]; temperature: number[]; humidity: number[] };
}
export const HISTORY_LENGTH = 12;
/** Game cost per level per tick — not a scientific value. */
export const POWER_COST_PER_LEVEL = 0.35;
export const POWER_RECHARGE = 1;
export function projectedPowerUse(c: LifeSupportControls) { return (c.filtrationLevel + c.climateLevel + c.humiditySupportLevel) * POWER_COST_PER_LEVEL; }
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const toward = (v: number, target: number, rate: number) => v + (target - v) * rate;
const push = (arr: number[], v: number) => [...arr, v].slice(-HISTORY_LENGTH);

export function createLifeSupportState(first: TelemetryRecord, resources: { power: number; water: number; crewSafety: number }): LifeSupportState {
  return { tick: 0, co2: first.co2, temperature: first.temperature, humidity: first.humidity, power: resources.power, water: resources.water, safety: resources.crewSafety, history: { co2: [first.co2], temperature: [first.temperature], humidity: [first.humidity] } };
}

export function stepLifeSupport(s: LifeSupportState, c: LifeSupportControls, record: TelemetryRecord, wobble = 0): LifeSupportState {
  const hasPower = s.power > 0;
  const f = hasPower ? c.filtrationLevel : 0, cl = hasPower ? c.climateLevel : 0, h = hasPower ? c.humiditySupportLevel : 0;
  const co2 = clamp(toward(s.co2, record.co2 + 1500 - f * 650, 0.18) + wobble * 30, 400, 6000);
  const temperature = clamp(toward(s.temperature, record.temperature + 3 - cl * 1.6, 0.15) + wobble * 0.05, 10, 35);
  const humidity = clamp(toward(s.humidity, record.humidity - 12 + h * 7, 0.15) + wobble * 0.3, 5, 95);
  const power = clamp(s.power + POWER_RECHARGE - projectedPowerUse(c) * 3.2, 0, 100);
  const water = clamp(s.water - h * 0.08, 0, 100);
  const danger = co2 > 3800 || temperature < 18 || temperature > 27.5 || humidity < 24 || humidity > 68;
  const safety = clamp(s.safety + (danger ? -1.5 : 0.4), 0, 100);
  return { tick: s.tick + 1, co2, temperature, humidity, power, water, safety, history: { co2: push(s.history.co2, co2), temperature: push(s.history.temperature, temperature), humidity: push(s.history.humidity, humidity) } };
}
