/**
 * Environmental telemetry (NASA-derived later). Replace `mockLifeSupportTelemetry`
 * with an imported local JSON array of the same shape, e.g.
 *   import records from '@/data/life-support.json';
 */
export interface TelemetryRecord { time: string; co2: number; temperature: number; humidity: number }
export type TelemetryKey = 'co2' | 'temperature' | 'humidity';
export type SystemStatus = 'good' | 'watch' | 'critical';
export type Trend = 'rising' | 'falling' | 'steady';

/** Small placeholder series — NOT real NASA measurements. */
export const mockLifeSupportTelemetry: TelemetryRecord[] = [
  { time: '00:00', co2: 1900, temperature: 22.8, humidity: 41 },
  { time: '00:10', co2: 2050, temperature: 23.0, humidity: 40 },
  { time: '00:20', co2: 2240, temperature: 23.3, humidity: 39 },
  { time: '00:30', co2: 2410, temperature: 23.6, humidity: 38 },
  { time: '00:40', co2: 2580, temperature: 23.4, humidity: 38 },
  { time: '00:50', co2: 2460, temperature: 23.1, humidity: 39 },
  { time: '01:00', co2: 2300, temperature: 22.9, humidity: 40 },
  { time: '01:10', co2: 2150, temperature: 22.7, humidity: 41 },
];

/** Game-presentation thresholds (temporary, not NASA limits). */
export const thresholds: Record<TelemetryKey, { good: [number, number]; watch: [number, number] }> = {
  co2: { good: [0, 2500], watch: [0, 3800] },
  temperature: { good: [20, 25], watch: [18, 27.5] },
  humidity: { good: [30, 60], watch: [24, 68] },
};
export function statusOf(key: TelemetryKey, value: number): SystemStatus {
  const t = thresholds[key];
  if (value >= t.good[0] && value <= t.good[1]) return 'good';
  if (value >= t.watch[0] && value <= t.watch[1]) return 'watch';
  return 'critical';
}
export function trendOf(history: number[], tolerance: number): Trend {
  if (history.length < 3) return 'steady';
  const delta = history[history.length - 1]! - history[history.length - 3]!;
  return delta > tolerance ? 'rising' : delta < -tolerance ? 'falling' : 'steady';
}
export const trendTolerance: Record<TelemetryKey, number> = { co2: 40, temperature: 0.15, humidity: 0.6 };
