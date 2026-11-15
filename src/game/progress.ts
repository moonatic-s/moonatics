import type { CarryOver } from "@/game/engine";
import type { MissionStatus } from "@/game/state";
import { freshStory, mergeStory, parseStory, type Story } from "@/game/story/profile";

/** What the player has finished. Only ever moves forward, so nothing relocks. */
export interface Progress {
  missions: MissionStatus[];
  briefingsSeen: { lifeSupport: boolean; greenhouse: boolean; storm: boolean };
  /** Resources each finished mission handed on. The latest result replaces the earlier one. */
  results: { act1: CarryOver | null; act2: CarryOver | null };
  /** Patches, science cards, best skills and the current run's facts. */
  story: Story;
}
export type BriefingKey = keyof Progress["briefingsSeen"];

export const PROGRESS_KEY = "moonatics:progress";
const COUNT = 3;
const RANK: Record<MissionStatus, number> = { locked: 0, active: 1, completed: 2 };
const STATUSES = Object.keys(RANK) as MissionStatus[];

export const freshProgress = (): Progress => ({
  missions: ["active", "locked", "locked"],
  briefingsSeen: { lifeSupport: false, greenhouse: false, storm: false },
  results: { act1: null, act2: null },
  story: freshStory(),
});

/** Repairs the chain: a finished mission opens the next one, and earlier ones count as done. */
function repair(missions: MissionStatus[]): MissionStatus[] {
  const out = missions.slice();
  out[0] = out[0] === "locked" ? "active" : out[0]!;
  for (let i = COUNT - 1; i > 0; i--) {
    if (RANK[out[i]!] > 0 && out[i - 1] !== "completed") out[i - 1] = "completed";
  }
  for (let i = 0; i < COUNT - 1; i++) {
    if (out[i] === "completed" && out[i + 1] === "locked") out[i + 1] = "active";
  }
  return out;
}

/** Combines two saves, keeping the furthest state of each. Nothing moves backwards. */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const missions = repair(
    a.missions.map((s, i) => (RANK[b.missions[i] ?? "locked"] > RANK[s] ? b.missions[i]! : s)),
  );
  return {
    missions,
    briefingsSeen: {
      lifeSupport: a.briefingsSeen.lifeSupport || b.briefingsSeen.lifeSupport,
      greenhouse: a.briefingsSeen.greenhouse || b.briefingsSeen.greenhouse,
      storm: a.briefingsSeen.storm || b.briefingsSeen.storm,
    },
    // `a` is the newer, in-memory state, so its result wins; otherwise keep what was saved.
    results: {
      act1: a.results.act1 ?? b.results.act1,
      act2: a.results.act2 ?? b.results.act2,
    },
    story: mergeStory(a.story, b.story),
  };
}

const NUMBERS = [
  ["endCo2Ppm", 0, 5000],
  ["endTempC", 10, 40],
  ["endRhPercent", 0, 100],
  ["act1BatteryCarryPct", 0, 100],
  ["act1WaterCarryLiters", 0, 1000],
  ["act2BatteryCarryPct", 0, 100],
  ["stormAvailableKwBudget", 0, 50],
  ["cropHealthAtStormPct", 0, 100],
  ["harvestRipeFruits", 0, 50],
] as const;

const OPTIONAL_NUMBERS = [["act2WaterCarryLiters", 0, 1000]] as const;

/** A saved resource result is only used if every number is real and in range; anything else is dropped. */
export function parseResult(raw: unknown): CarryOver | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, lo, hi] of NUMBERS) {
    const v = r[key];
    if (typeof v !== "number" || !Number.isFinite(v) || v < lo || v > hi) return null;
    out[key] = v;
  }
  if (typeof r["dryCabinAirRisk"] !== "boolean") return null;
  if (r["cropVulnerability"] !== "SENSITIVE" && r["cropVulnerability"] !== "RESILIENT") return null;
  for (const [key, lo, hi] of OPTIONAL_NUMBERS) {
    const v = r[key];
    if (v === undefined) continue;
    if (typeof v !== "number" || !Number.isFinite(v) || v < lo || v > hi) return null;
    out[key] = v;
  }
  out["dryCabinAirRisk"] = r["dryCabinAirRisk"];
  out["cropVulnerability"] = r["cropVulnerability"];
  return out as unknown as CarryOver;
}

/** Turns anything read from storage into safe progress; bad data gives a fresh start. */
export function parseProgress(raw: unknown): Progress {
  const base = freshProgress();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as { missions?: unknown; briefingsSeen?: unknown; results?: unknown; story?: unknown };
  const missions = base.missions.map((fallback, i) => {
    const v = Array.isArray(r.missions) ? r.missions[i] : undefined;
    return STATUSES.includes(v as MissionStatus) ? (v as MissionStatus) : fallback;
  });
  const seen = (r.briefingsSeen ?? {}) as Record<string, unknown>;
  return {
    missions: repair(missions),
    briefingsSeen: { lifeSupport: seen["lifeSupport"] === true, greenhouse: seen["greenhouse"] === true, storm: seen["storm"] === true },
    results: {
      act1: parseResult((r.results as Record<string, unknown> | undefined)?.["act1"]),
      act2: parseResult((r.results as Record<string, unknown> | undefined)?.["act2"]),
    },
    story: parseStory(r.story),
  };
}

export function loadProgress(): Progress {
  try {
    const text = window.localStorage.getItem(PROGRESS_KEY);
    return text ? parseProgress(JSON.parse(text)) : freshProgress();
  } catch {
    return freshProgress();
  }
}

export function saveProgress(progress: Progress) {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    /* storage can be blocked; the game still works for this visit */
  }
}

export function clearProgress() {
  try {
    window.localStorage.removeItem(PROGRESS_KEY);
  } catch {
    /* nothing to clear */
  }
}
