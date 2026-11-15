/**
 * Turns raw simulation changes into the small arrows, one-line verdicts and cause-and-effect hints the console shows.
 * Hints say which way something moves, never by how much or by what formula.
 */
import { content } from "@/game/content";
import type { GameState, StepChange } from "@/game/engine";
import { ACT1_NEUTRAL_LEVEL } from "@/game/engine";

export type Trend = "up" | "down" | "flat";
export type ChannelKey = "air" | "heat" | "water";

const trendOf = (value: number, flatBelow: number): Trend =>
  Math.abs(value) < flatBelow ? "flat" : value > 0 ? "up" : "down";

export interface ChangeRow {
  key: "co2" | "temperature" | "humidity" | "battery" | "tank";
  trend: Trend;
  /** Signed number with unit, for Specialist mode. */
  amount: string;
}

const signed = (n: number, digits: number, unit: string) =>
  `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}${unit}`;

export function changeRows(change: StepChange): ChangeRow[] {
  return [
    {
      key: "co2",
      trend: trendOf(change.co2Ppm, 30),
      amount: signed(change.co2Ppm, 0, " ppm"),
    },
    {
      key: "temperature",
      trend: trendOf(change.temperatureDegC, 0.2),
      amount: signed(change.temperatureDegC, 1, " °C"),
    },
    {
      key: "humidity",
      trend: trendOf(change.humidityPct, 0.8),
      amount: signed(change.humidityPct, 1, " %"),
    },
    {
      key: "battery",
      trend: trendOf(change.batteryPct, 0.5),
      amount: signed(change.batteryPct, 1, " %"),
    },
  ];
}

export type Verdict = { tone: "good" | "warn" | "bad"; text: string };

const safeFlags = (s: GameState) => {
  const z = s.subSystems.cabin.zones;
  return {
    air: z.co2 === "SAFE",
    heat: z.temperature === "SAFE",
    water: z.humidity === "SAFE",
  };
};

/** One plain sentence about what the last 6 hours did to the habitat. */
export function interpretStep(before: GameState, after: GameState): Verdict {
  const says = content.lifeConsole.changed.says;
  const b = safeFlags(before);
  const a = safeFlags(after);
  const allSafeAfter = a.air && a.heat && a.water;
  const allSafeBefore = b.air && b.heat && b.water;
  if (allSafeAfter)
    return { tone: "good", text: allSafeBefore ? says.kept : says.recovered };

  // Something is outside the safe zone now. Say which reading just left it, or whether things are improving.
  const wasSafe = (Object.keys(a) as ChannelKey[]).filter((k) => b[k] && !a[k]);
  const first = wasSafe[0];
  if (first === "air") return { tone: "bad", text: says.airWorse };
  if (first === "heat") return { tone: "bad", text: says.heatWorse };
  if (first === "water") return { tone: "bad", text: says.waterWorse };
  const unsafeBefore = Object.values(b).filter((v) => !v).length;
  const unsafeAfter = Object.values(a).filter((v) => !v).length;
  return unsafeAfter < unsafeBefore
    ? { tone: "warn", text: says.improving }
    : { tone: "warn", text: says.stillOff };
}

export type HintTarget = "co2" | "power" | "humidity" | "temperature" | "water";
export interface LeverHint {
  target: HintTarget;
  dir: "up" | "down";
  slight?: boolean;
}

/** How far from "no change" a lever must be before it shows effect hints. */
const HINT_DEADZONE = 6;

/** Which way each effect moves when this lever sits away from the NASA baseline. */
export function leverHints(channel: ChannelKey, value: number): LeverHint[] {
  const delta = value - ACT1_NEUTRAL_LEVEL;
  if (Math.abs(delta) < HINT_DEADZONE) return [];
  const more = delta > 0;
  if (channel === "air") {
    return [
      { target: "co2", dir: more ? "down" : "up" },
      { target: "power", dir: more ? "up" : "down" },
      { target: "humidity", dir: more ? "down" : "up", slight: true },
    ];
  }
  if (channel === "heat") {
    return [
      { target: "temperature", dir: more ? "down" : "up" },
      { target: "power", dir: "up" },
    ];
  }
  return [
    { target: "water", dir: more ? "up" : "down" },
    { target: "humidity", dir: more ? "down" : "up" },
    { target: "power", dir: more ? "up" : "down" },
  ];
}
