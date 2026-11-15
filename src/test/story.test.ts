import { describe, expect, it } from "vitest";
import { efficiencyOf, overallEfficiency, refreshStory, skillsOf, starsOf } from "@/game/story/evidence";
import { CARDS, PATCHES } from "@/game/story/collection";
import { EARTH, REFLECTIONS, RECALLS, epilogue, pickQuestion } from "@/game/story/copy";
import { freshProfile, freshRun, freshStory, mergeStory, parseStory, type Facts, type Story } from "@/game/story/profile";

const strong: Facts = {
  detailsViewed: true,
  briefingsFinished: 2,
  earthRead: 3,
  m1: { stable: 7, total: 8, batteryPct: 80, waterLiters: 30, waterPct: 50 },
  m2: { waterLeftPct: 40, waterLiters: 24, cropHealthPct: 85, ripe: 5, respondedDryAir: true, rootOk: true, light: "red" },
  m3: {
    shelter: { water: 3, supply: 3, equipment: 2 },
    inventory: { water: 3, supply: 3, equipment: 5 },
    arraysProtected: true,
    plan: { shelterKw: 2, cabinKw: 3, greenhouseKw: 3 },
    budget: 8,
    rerouted: false,
    crewDoseUGy: 20000,
    doseLimit: 55000,
    holding: true,
  },
};
const none = { m1: false, m2: false, m3: false };

describe("skills come from what the child did", () => {
  it("a careful run earns high skills, an empty one earns none", () => {
    const s = skillsOf(strong, none);
    expect(s.shielding).toBe(3);
    expect(s.prioritise).toBe(3);
    expect(s.earlier).toBe(3);
    expect(s.warning).toBe(3);
    expect(s.limited).toBe(3);
    expect(s.nasa).toBe(3);
    const empty = skillsOf({ detailsViewed: false, briefingsFinished: 0, earthRead: 0 }, none);
    expect(Object.values(empty).every((v) => v === 0)).toBe(true);
  });

  it("an empty shelter and no power plan earn no shielding or sharing skills", () => {
    const f: Facts = { ...strong, m3: { ...strong.m3!, shelter: { water: 0, supply: 0, equipment: 0 }, plan: null } };
    const s = skillsOf(f, none);
    expect([s.shielding, s.prioritise, s.warning, s.earlier]).toEqual([0, 0, 0, 0]);
  });

  it("solved reflection questions add understanding, never more than three", () => {
    const f: Facts = { detailsViewed: false, briefingsFinished: 0, earthRead: 0 };
    expect(skillsOf(f, { m1: true, m2: true, m3: true })).toMatchObject({ limited: 1, nasa: 1, shielding: 1 });
    expect(skillsOf(strong, { m1: true, m2: true, m3: true }).shielding).toBe(3);
  });
});

describe("efficiency and stars", () => {
  it("rewards thrift, and the supply drop costs a little", () => {
    const plain = efficiencyOf("m2", strong, false)!;
    const dropped = efficiencyOf("m2", strong, true)!;
    expect(dropped).toBe(plain - 15);
    expect(efficiencyOf("m3", { detailsViewed: false, briefingsFinished: 0, earthRead: 0 }, false)).toBeNull();
    const run = { ...freshRun(), facts: strong };
    expect(overallEfficiency(run)).toBeGreaterThan(50);
    expect([starsOf(80), starsOf(60), starsOf(10)]).toEqual([3, 2, 1]);
  });
});

describe("patches and science cards", () => {
  it("unlock from doing the thing they are about, only ever adding", () => {
    let s: Story = { ...freshStory(), run: { ...freshRun(), facts: { ...freshRun().facts, m1: strong.m1! } } };
    s = refreshStory(s);
    expect(s.profile.patches).toContain("air-keeper");
    expect(s.profile.cards).toContain("scrubbers");
    expect(s.profile.patches).not.toContain("storm-shield");
    const full = refreshStory({ profile: s.profile, run: { ...s.run, facts: strong } });
    expect(full.profile.patches).toEqual(expect.arrayContaining(["storm-shield", "water-saver", "power-planner", "calm-crew", "green-thumb"]));
    expect(full.profile.cards).toContain("water-shield");
    // a worse later run takes nothing away
    const worse = refreshStory({ profile: full.profile, run: freshRun() });
    expect(worse.profile.patches.length).toBe(full.profile.patches.length);
    expect(worse.profile.bestSkills.shielding).toBe(3);
  });

  it("every patch and card has a unique id and readable text", () => {
    for (const list of [PATCHES, CARDS]) expect(new Set(list.map((x) => x.id)).size).toBe(list.length);
    PATCHES.forEach((p) => expect(p.why.length).toBeGreaterThan(10));
    CARDS.forEach((c) => expect(c.text.length).toBeGreaterThan(20));
  });
});

describe("saving", () => {
  it("bad data becomes a fresh start and good data survives", () => {
    expect(parseStory(null)).toEqual(freshStory());
    expect(parseStory({ profile: { patches: [5, "ok"], bestSkills: { warning: 99 } } }).profile.bestSkills.warning).toBe(0);
    const s = refreshStory({ ...freshStory(), run: { ...freshRun(), facts: strong } });
    const back = parseStory(JSON.parse(JSON.stringify(s)));
    expect(back.run.facts.m3?.shelter.water).toBe(3);
    expect(back.profile.patches).toEqual(s.profile.patches);
  });

  it("merging keeps the most the child ever earned", () => {
    const a = { ...freshStory(), profile: { ...freshProfile(), patches: ["a"], bestEfficiency: 40 } };
    const b = { ...freshStory(), profile: { ...freshProfile(), patches: ["b"], bestEfficiency: 70, runsFinished: 2 } };
    const m = mergeStory(a, b);
    expect(m.profile.patches.sort()).toEqual(["a", "b"]);
    expect([m.profile.bestEfficiency, m.profile.runsFinished]).toEqual([70, 2]);
  });
});

describe("story copy", () => {
  it("the epilogue replays the child's own decisions", () => {
    const e = epilogue(strong, "explorer").join(" ");
    expect(e).toContain("3 water containers");
    expect(e).toContain("5 ripe tomatoes became 3 supply packs");
    const poor = epilogue({ ...strong, m3: { ...strong.m3!, inventory: { ...strong.m3!.inventory, water: 0 } } }, "specialist").join(" ");
    expect(poor).toContain("no water containers");
  });

  it("every mission has a message from Earth", () => {
    for (const k of ["m1", "m2", "m3"] as const) {
      expect(EARTH[k].answer.explorer.length).toBeGreaterThan(20);
      expect(EARTH[k].answer.specialist.length).toBeGreaterThan(20);
    }
  });

  it("each mission has a pool of at least four questions, and recalls do too", () => {
    for (const k of ["m1", "m2", "m3"] as const) expect(REFLECTIONS[k].length).toBeGreaterThanOrEqual(4);
    for (const k of ["m2", "m3"] as const) expect(RECALLS[k].length).toBeGreaterThanOrEqual(4);
  });

  it("questions have two options (the first Mission 2 question has three), a valid answer and no marking language", () => {
    const all = [...REFLECTIONS.m1, ...REFLECTIONS.m2, ...REFLECTIONS.m3, ...RECALLS.m2, ...RECALLS.m3];
    for (const q of all) {
      if (q.kind === "choice") {
        for (const mode of ["explorer", "specialist"] as const) {
          expect(q.options[mode].length === 2 || q === REFLECTIONS.m2[0]).toBe(true);
          expect(q.correct).toBeLessThan(q.options[mode].length);
        }
      } else {
        expect(q.sides).toHaveLength(2);
        expect(q.items.length).toBeGreaterThanOrEqual(4);
        expect(new Set(q.items.map((i) => i.side)).size).toBe(2); // both sides are used
      }
      expect(q.why.explorer.length).toBeGreaterThan(10);
      expect(JSON.stringify(q).toLowerCase()).not.toMatch(/wrong|incorrect|fail|stupid/);
    }
    // Mission 3 asks sorting questions; recalls and Missions 1-2 ask choices
    expect(REFLECTIONS.m3.every((q) => q.kind === "sort")).toBe(true);
    expect([...REFLECTIONS.m1, ...REFLECTIONS.m2, ...RECALLS.m2, ...RECALLS.m3].every((q) => q.kind === "choice")).toBe(true);
  });

  it("Mission 2 opens with the water question, written for each age", () => {
    const q = REFLECTIONS.m2[0] as Extract<(typeof REFLECTIONS.m2)[number], { kind: "choice" }>;
    expect(q.q.explorer).toBe("NASA grew real tomatoes in space. In this game, what decides how YOUR plant does?");
    expect(q.options.explorer).toEqual(["Luck", "Power", "Water"]);
    expect(q.options.explorer[q.correct]).toBe("Water");
    expect(q.q.specialist).toContain("does NOT decide");
    expect(q.options.specialist).toEqual(["Manage Water", "Choose Light", "Radiation"]);
    expect(q.options.specialist[q.correct]).toBe("Radiation");
    expect(q.why.specialist).toContain("Radiation does not directly affect the plant");
  });

  it("playing the training again asks the next question, and comes back round after the pool", () => {
    for (const pool of [REFLECTIONS.m1, REFLECTIONS.m2, REFLECTIONS.m3, RECALLS.m2, RECALLS.m3]) {
      const asked = Array.from({ length: pool.length }, (_, run) => pickQuestion(pool, run));
      expect(new Set(asked).size).toBe(pool.length); // a different question every training
      expect(pickQuestion(pool, pool.length)).toBe(pool[0]);
    }
    expect(pickQuestion(REFLECTIONS.m1, 0)).not.toBe(pickQuestion(REFLECTIONS.m1, 1));
  });

});
