import type { ShieldItem } from "@/game/engine";

/** The six things the training teaches. Skills are earned from what the child DID, never graded. */
export type GoalId = "warning" | "shielding" | "limited" | "prioritise" | "earlier" | "nasa";
export const GOALS: readonly GoalId[] = ["warning", "shielding", "limited", "prioritise", "earlier", "nasa"];

export type MissionKey = "m1" | "m2" | "m3";
export const MISSION_KEYS: readonly MissionKey[] = ["m1", "m2", "m3"];

type Items = Record<ShieldItem, number>;

/** What happened in each mission. Written when a mission ends; the epilogue, skills and patches all read it. */
export interface Facts {
  m1?: { stable: number; total: number; batteryPct: number; waterLiters: number; waterPct: number };
  m2?: {
    waterLeftPct: number;
    waterLiters: number;
    cropHealthPct: number;
    ripe: number;
    respondedDryAir: boolean;
    rootOk: boolean;
    light: "red" | "blue";
  };
  m3?: {
    shelter: Items;
    inventory: Items;
    arraysProtected: boolean;
    plan: { shelterKw: number; cabinKw: number; greenhouseKw: number } | null;
    budget: number;
    rerouted: boolean;
    crewDoseUGy: number;
    doseLimit: number;
    holding: boolean;
  };
  detailsViewed: boolean;
  briefingsFinished: number;
  earthRead: number;
}

/** The current attempt at the whole training. A new run starts fresh; the profile keeps the best of all runs. */
export interface Run {
  facts: Facts;
  supplyDropUsed: boolean;
  answered: Partial<Record<MissionKey, boolean>>;
  recalled: Partial<Record<"m2" | "m3", boolean>>;
  /** True once the training-complete screen has counted this run. */
  finished: boolean;
}

/** What the child keeps between runs. */
export interface Profile {
  patches: string[];
  cards: string[];
  bestSkills: Record<GoalId, number>;
  bestEfficiency: number;
  runsFinished: number;
  solved: Record<MissionKey, boolean>;
}

export interface Story {
  profile: Profile;
  run: Run;
}

export const freshFacts = (): Facts => ({ detailsViewed: false, briefingsFinished: 0, earthRead: 0 });
export const freshRun = (): Run => ({
  facts: freshFacts(),
  supplyDropUsed: false,
  answered: {},
  recalled: {},
  finished: false,
});
export const freshProfile = (): Profile => ({
  patches: [],
  cards: [],
  bestSkills: { warning: 0, shielding: 0, limited: 0, prioritise: 0, earlier: 0, nasa: 0 },
  bestEfficiency: 0,
  runsFinished: 0,
  solved: { m1: false, m2: false, m3: false },
});
export const freshStory = (): Story => ({ profile: freshProfile(), run: freshRun() });

const isNum = (v: unknown, lo: number, hi: number): v is number => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
const isBool = (v: unknown): v is boolean => typeof v === "boolean";
const strings = (v: unknown, max = 64): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length < 40).slice(0, max) : [];

/** Anything read from storage is checked; bad data is dropped rather than trusted. */
export function parseStory(raw: unknown): Story {
  const base = freshStory();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as { profile?: Record<string, unknown>; run?: Record<string, unknown> };
  const p = r.profile ?? {};
  const profile: Profile = {
    patches: strings(p["patches"]),
    cards: strings(p["cards"]),
    bestSkills: { ...base.profile.bestSkills },
    bestEfficiency: isNum(p["bestEfficiency"], 0, 100) ? p["bestEfficiency"] : 0,
    runsFinished: isNum(p["runsFinished"], 0, 1000) ? Math.floor(p["runsFinished"]) : 0,
    solved: { m1: false, m2: false, m3: false },
  };
  const skills = (p["bestSkills"] ?? {}) as Record<string, unknown>;
  for (const g of GOALS) if (isNum(skills[g], 0, 3)) profile.bestSkills[g] = Math.floor(skills[g] as number);
  const solved = (p["solved"] ?? {}) as Record<string, unknown>;
  for (const k of MISSION_KEYS) profile.solved[k] = solved[k] === true;

  const u = r.run ?? {};
  const run = freshRun();
  run.supplyDropUsed = u["supplyDropUsed"] === true;
  run.finished = u["finished"] === true;
  const ans = (u["answered"] ?? {}) as Record<string, unknown>;
  for (const k of MISSION_KEYS) if (isBool(ans[k])) run.answered[k] = ans[k] as boolean;
  const rec = (u["recalled"] ?? {}) as Record<string, unknown>;
  for (const k of ["m2", "m3"] as const) if (isBool(rec[k])) run.recalled[k] = rec[k] as boolean;
  const f = (u["facts"] ?? {}) as Record<string, unknown>;
  run.facts.detailsViewed = f["detailsViewed"] === true;
  run.facts.briefingsFinished = isNum(f["briefingsFinished"], 0, 20) ? Math.floor(f["briefingsFinished"]) : 0;
  run.facts.earthRead = isNum(f["earthRead"], 0, 20) ? Math.floor(f["earthRead"]) : 0;
  const items = (x: unknown): Items | null => {
    const o = (x ?? {}) as Record<string, unknown>;
    return isNum(o["water"], 0, 50) && isNum(o["supply"], 0, 50) && isNum(o["equipment"], 0, 50)
      ? { water: o["water"], supply: o["supply"], equipment: o["equipment"] }
      : null;
  };
  const m1 = (f["m1"] ?? {}) as Record<string, unknown>;
  if (isNum(m1["stable"], 0, 100) && isNum(m1["total"], 1, 100) && isNum(m1["batteryPct"], 0, 100) && isNum(m1["waterLiters"], 0, 1000) && isNum(m1["waterPct"], 0, 100))
    run.facts.m1 = { stable: m1["stable"], total: m1["total"], batteryPct: m1["batteryPct"], waterLiters: m1["waterLiters"], waterPct: m1["waterPct"] };
  const m2 = (f["m2"] ?? {}) as Record<string, unknown>;
  if (isNum(m2["waterLeftPct"], 0, 100) && isNum(m2["waterLiters"], 0, 1000) && isNum(m2["cropHealthPct"], 0, 100) && isNum(m2["ripe"], 0, 50) && isBool(m2["respondedDryAir"]) && isBool(m2["rootOk"]) && (m2["light"] === "red" || m2["light"] === "blue"))
    run.facts.m2 = { waterLeftPct: m2["waterLeftPct"], waterLiters: m2["waterLiters"], cropHealthPct: m2["cropHealthPct"], ripe: m2["ripe"], respondedDryAir: m2["respondedDryAir"], rootOk: m2["rootOk"], light: m2["light"] };
  const m3 = (f["m3"] ?? {}) as Record<string, unknown>;
  const shelter = items(m3["shelter"]);
  const inventory = items(m3["inventory"]);
  if (shelter && inventory && isBool(m3["arraysProtected"]) && isNum(m3["budget"], 0, 20) && isBool(m3["rerouted"]) && isNum(m3["crewDoseUGy"], 0, 1e7) && isNum(m3["doseLimit"], 1, 1e7) && isBool(m3["holding"])) {
    const pl = (m3["plan"] ?? null) as Record<string, unknown> | null;
    const plan = pl && isNum(pl["shelterKw"], 0, 20) && isNum(pl["cabinKw"], 0, 20) && isNum(pl["greenhouseKw"], 0, 20) ? { shelterKw: pl["shelterKw"], cabinKw: pl["cabinKw"], greenhouseKw: pl["greenhouseKw"] } : null;
    run.facts.m3 = { shelter, inventory, arraysProtected: m3["arraysProtected"], plan, budget: m3["budget"], rerouted: m3["rerouted"], crewDoseUGy: m3["crewDoseUGy"], doseLimit: m3["doseLimit"], holding: m3["holding"] };
  }
  return { profile, run };
}

const union = <T,>(a: readonly T[], b: readonly T[]): T[] => [...new Set([...a, ...b])];

/** Combines a newer in-memory story with a saved one. Patches, cards and bests only ever grow. */
export function mergeStory(a: Story, b: Story): Story {
  const skills = { ...a.profile.bestSkills };
  for (const g of GOALS) skills[g] = Math.max(a.profile.bestSkills[g], b.profile.bestSkills[g]);
  const hasFacts = (s: Story) => Boolean(s.run.facts.m1 || s.run.facts.m2 || s.run.facts.m3);
  return {
    profile: {
      patches: union(a.profile.patches, b.profile.patches),
      cards: union(a.profile.cards, b.profile.cards),
      bestSkills: skills,
      bestEfficiency: Math.max(a.profile.bestEfficiency, b.profile.bestEfficiency),
      runsFinished: Math.max(a.profile.runsFinished, b.profile.runsFinished),
      solved: { m1: a.profile.solved.m1 || b.profile.solved.m1, m2: a.profile.solved.m2 || b.profile.solved.m2, m3: a.profile.solved.m3 || b.profile.solved.m3 },
    },
    // the in-memory run is the newer one, unless it is still empty
    run: hasFacts(a) || a.run.supplyDropUsed ? a.run : b.run,
  };
}
