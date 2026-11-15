import { GOALS, MISSION_KEYS, type Facts, type GoalId, type MissionKey, type Profile, type Run, type Story } from "./profile";
import { CARDS, PATCHES } from "./collection";

const clampLevel = (n: number): number => Math.max(0, Math.min(3, Math.round(n)));

/** Best shielding units the outpost could have placed: the best 8 items from what was available. */
function bestUnits(inv: Record<"water" | "supply" | "equipment", number>): number {
  const order: number[] = [];
  for (let i = 0; i < inv.water; i += 1) order.push(1);
  for (let i = 0; i < inv.supply; i += 1) order.push(0.8);
  for (let i = 0; i < inv.equipment; i += 1) order.push(0.6);
  return order.slice(0, 8).reduce((a, b) => a + b, 0);
}

/**
 * Skills earned from what the child did, 0-3 each. Never shown as a grade: three filled dots at best.
 * A solved reflection question adds one, so understanding counts as well as doing.
 */
export function skillsOf(facts: Facts, solved: Record<MissionKey, boolean>): Record<GoalId, number> {
  const s: Record<GoalId, number> = { warning: 0, shielding: 0, limited: 0, prioritise: 0, earlier: 0, nasa: 0 };
  const m3 = facts.m3;
  if (m3) {
    const placed = m3.shelter.water + m3.shelter.supply + m3.shelter.equipment;
    s.warning = placed >= 6 ? 3 : placed >= 3 ? 2 : placed >= 1 ? 1 : 0;
    const units = m3.shelter.water * 1 + m3.shelter.supply * 0.8 + m3.shelter.equipment * 0.6;
    const best = bestUnits(m3.inventory) || 1;
    const share = units / best;
    s.shielding = share >= 0.9 ? 3 : share >= 0.6 ? 2 : share > 0 ? 1 : 0;
    const p = m3.plan;
    if (p) {
      const used = p.shelterKw + p.cabinKw + p.greenhouseKw;
      s.prioritise = p.cabinKw >= 3 && p.greenhouseKw >= 2 && p.shelterKw >= 2 ? 3 : p.cabinKw >= 3 && (p.greenhouseKw >= 2 || p.shelterKw >= 2) ? 2 : used > 0 ? 1 : 0;
    }
    s.earlier = clampLevel(m3.shelter.water);
  }
  let limited = 0;
  if (facts.m1 && facts.m1.batteryPct >= 60) limited += 1;
  if (facts.m2 && facts.m2.waterLeftPct >= 25) limited += 1;
  if (m3 && m3.plan && m3.plan.shelterKw + m3.plan.cabinKw + m3.plan.greenhouseKw >= m3.budget) limited += 1;
  s.limited = clampLevel(limited);
  s.nasa = clampLevel((facts.briefingsFinished >= 1 ? 1 : 0) + (facts.detailsViewed ? 1 : 0) + (facts.earthRead >= 2 ? 1 : 0));
  // understanding counts too: a solved reflection adds one to the goal it is about
  if (solved.m1) s.limited = clampLevel(s.limited + 1);
  if (solved.m2) s.nasa = clampLevel(s.nasa + 1);
  if (solved.m3) s.shielding = clampLevel(s.shielding + 1);
  return s;
}

/** How thriftily a mission was run, 0-100. Using the supply drop costs a little: it helps, but it is not free. */
export function efficiencyOf(key: MissionKey, facts: Facts, supplyDropUsed: boolean): number | null {
  const penalty = supplyDropUsed ? 15 : 0;
  if (key === "m1" && facts.m1) return Math.max(0, Math.round(facts.m1.batteryPct * 0.5 + facts.m1.waterPct * 0.5));
  if (key === "m2" && facts.m2) return Math.max(0, Math.round(Math.min(100, facts.m2.waterLeftPct * 2) * 0.5 + facts.m2.cropHealthPct * 0.5 - penalty));
  if (key === "m3" && facts.m3) {
    const used = facts.m3.plan ? facts.m3.plan.shelterKw + facts.m3.plan.cabinKw + facts.m3.plan.greenhouseKw : 0;
    const spent = facts.m3.budget > 0 ? Math.min(100, (used / facts.m3.budget) * 100) : 0;
    const safe = 100 - Math.min(100, (facts.m3.crewDoseUGy / facts.m3.doseLimit) * 100);
    return Math.max(0, Math.round(safe * 0.5 + spent * 0.5 - penalty));
  }
  return null;
}

/** Overall efficiency once all three missions have a result. */
export function overallEfficiency(run: Run): number | null {
  const parts = MISSION_KEYS.map((k) => efficiencyOf(k, run.facts, run.supplyDropUsed));
  if (parts.some((p) => p === null)) return null;
  return Math.round((parts as number[]).reduce((a, b) => a + b, 0) / parts.length);
}
export const starsOf = (efficiency: number): 1 | 2 | 3 => (efficiency >= 75 ? 3 : efficiency >= 50 ? 2 : 1);

/**
 * Recomputes everything the profile keeps (patches, cards, best skills, best efficiency) from the current run.
 * Safe to call as often as needed: it only ever adds.
 */
export function refreshStory(story: Story): Story {
  const { run } = story;
  const skills = skillsOf(run.facts, story.profile.solved);
  const bestSkills = { ...story.profile.bestSkills };
  for (const g of GOALS) bestSkills[g] = Math.max(bestSkills[g], skills[g]);
  const overall = overallEfficiency(run);
  const draft: Profile = {
    ...story.profile,
    bestSkills,
    bestEfficiency: Math.max(story.profile.bestEfficiency, overall ?? 0),
  };
  const ctx = { run, profile: draft, overall };
  const patches = [...new Set([...draft.patches, ...PATCHES.filter((p) => p.earned(ctx)).map((p) => p.id)])];
  const cards = [...new Set([...draft.cards, ...CARDS.filter((c) => c.unlocked(ctx)).map((c) => c.id)])];
  if (patches.length === draft.patches.length && cards.length === draft.cards.length && JSON.stringify(bestSkills) === JSON.stringify(story.profile.bestSkills) && draft.bestEfficiency === story.profile.bestEfficiency) return story;
  return { ...story, profile: { ...draft, patches, cards } };
}
