import { describe, expect, it } from "vitest";

import {
  DEFAULT_NASA_DATASETS,
  createGameState,
  updateLifeSupportControls,
  updateFoodControls,
  applyFoodPreset,
  setShelterMaterials,
  setCmeDecision,
  setSepPowerAllocation,
  advanceStormPhase,
  stepMission,
  advanceAct,
  buildDebriefSummary,
  stepUntilActComplete,
  isActComplete,
  getAdvanceStatus,
  retryAct,
  evaluateMissionFailure,
  MISSION_FAILURE_LIMITS,
} from "@/game/engine/mission";
import type { GameState } from "@/game/engine/types";
import {
  earnedAct2,
  jumpToAct2,
  playAct1Idle,
  playAct1Well,
} from "./helpers/autoplay";

// Debug-jumps past Act 1, plays Act 2 to Day 100 with default settings, then enters Act 3 through the real gate.
const enterAct3 = (state = createGameState()) =>
  advanceAct(stepUntilActComplete(jumpToAct2(state)), 3);

function doseAfterExtraSteps(state: GameState, n: number): number {
  let s = state;
  for (let i = 0; i < n; i += 1) s = stepMission(s);
  return s.subSystems.radiation.cumulativeCrewDoseUGy;
}

describe("Act sequencing guards", () => {
  it("only advances to the next act, never skips, reverses, or accepts junk targets", () => {
    const s1 = createGameState();
    // Act 1 cannot be skipped by any target, including junk that falls back to "next act".
    for (const target of [4, 3, 1, 2, "x", NaN, undefined]) {
      expect(advanceAct(s1, target)).toBe(s1);
    }

    const s2 = earnedAct2();
    expect(s2.meta.currentAct).toBe(2);
    expect(advanceAct(s2, 1)).toBe(s2);
    expect(advanceAct(s2, 3)).toBe(s2);
    expect(getAdvanceStatus(s2).canAdvance).toBe(false);
  });

  it("gates Act 3 -> 4 on the end of the real CRaTER data window", () => {
    const storm = enterAct3();
    expect(advanceAct(storm, 4)).toBe(storm);
    expect(getAdvanceStatus(storm).canAdvance).toBe(false);

    const done = stepUntilActComplete(storm);
    expect(done.subSystems.radiation.stormComplete).toBe(true);
    expect(done.subSystems.radiation.stormPhase).toBe(4);
    expect(advanceAct(done, 4).meta.completed).toBe(true);
  });

  it("ignores Act 1/2/3 controls outside their own act", () => {
    const s1 = createGameState();
    expect(setCmeDecision(s1, false)).toBe(s1);
    expect(setShelterMaterials(s1, [])).toBe(s1);
    expect(setSepPowerAllocation(s1, { shelterKw: 1 })).toBe(s1);
    expect(advanceStormPhase(s1)).toBe(s1);
    expect(updateFoodControls(s1, { redLight: 80 })).toBe(s1);
    expect(applyFoodPreset(s1, "blue_rich")).toBe(s1);

    const s2 = jumpToAct2(s1);
    expect(updateLifeSupportControls(s2, { airFiltration: 10 })).toBe(s2);
  });

  it("enforces strictly sequential storm phases", () => {
    let storm = enterAct3();
    expect(advanceStormPhase(storm, 3)).toBe(storm);
    storm = advanceStormPhase(storm);
    expect(storm.subSystems.radiation.stormPhase).toBe(2);
    expect(advanceStormPhase(storm, 1)).toBe(storm);
    expect(advanceStormPhase(storm, NaN).subSystems.radiation.stormPhase).toBe(
      3,
    );
    let last = storm;
    for (let i = 0; i < 6; i += 1) last = advanceStormPhase(last);
    expect(last.subSystems.radiation.stormPhase).toBe(4);
  });
});

describe("Input sanitising", () => {
  it("never lets NaN/null/strings corrupt controls or resource bars", () => {
    const s1 = updateLifeSupportControls(createGameState(), {
      airFiltration: NaN,
      climateControl: "70",
      waterRecovery: Infinity,
    });
    expect(s1.controls.act1).toEqual({
      airFiltration: 50,
      climateControl: 70,
      waterRecovery: 50,
    });

    const act2 = jumpToAct2();
    const s2 = updateFoodControls(act2, {
      redLight: NaN,
      blueLight: undefined,
      waterFlow: -50,
    });
    expect(s2.controls.act2.redLight).toBe(act2.controls.act2.redLight);
    expect(s2.controls.act2.blueLight).toBe(act2.controls.act2.blueLight);
    expect(s2.controls.act2.waterFlow).toBe(0);
    expect(Object.values(s2.resources).every(Number.isFinite)).toBeTruthy();

    const storm = enterAct3();
    const bad = setSepPowerAllocation(storm, {
      shelterKw: NaN,
      cabinKw: "abc",
      greenhouseKw: null,
      bogus: 9,
    } as Parameters<typeof setSepPowerAllocation>[1]);
    expect(bad.controls.act3.sepPowerAlloc).toEqual(
      storm.controls.act3.sepPowerAlloc,
    );
    expect(Object.values(bad.resources).every(Number.isFinite)).toBeTruthy();

    const over = setSepPowerAllocation(storm, {
      shelterKw: 99,
      cabinKw: 99,
      greenhouseKw: 99,
    });
    const a = over.controls.act3.sepPowerAlloc;
    expect(
      a.shelterKw + a.cabinKw + a.greenhouseKw <=
        over.subSystems.power.stormBudgetKw,
    ).toBeTruthy();
    expect(
      setSepPowerAllocation(storm, { shelterKw: -5 }).controls.act3
        .sepPowerAlloc.shelterKw,
    ).toBe(0);
  });
});

describe("Step caps (no phantom progress past the real data)", () => {
  it("stops Act 1 at the end of the RR-28 window instead of wrapping", () => {
    const done = stepUntilActComplete(createGameState());
    expect(isActComplete(done)).toBe(true);
    expect(stepMission(done)).toBe(done);
    expect(
      done.meta.act1StepsCompleted > 0 && done.meta.act1StepsCompleted <= 16,
    ).toBeTruthy();
    expect(
      done.subSystems.cabin.baselineIndex <
        DEFAULT_NASA_DATASETS.lifeSupport.series.length,
    ).toBeTruthy();
  });

  it("stops Act 2 at Day 100 and Act 3 at the last CRaTER sample", () => {
    const day100 = stepUntilActComplete(jumpToAct2());
    expect(day100.subSystems.greenhouse.day).toBe(100);
    expect(stepMission(day100)).toBe(day100);

    const storm = stepUntilActComplete(advanceAct(day100, 3));
    expect(stepMission(storm)).toBe(storm);
    expect(doseAfterExtraSteps(storm, 20)).toBe(
      storm.subSystems.radiation.cumulativeCrewDoseUGy,
    );
  });

  it("does nothing once the mission is complete", () => {
    const finished = advanceAct(stepUntilActComplete(enterAct3()), 4);
    expect(stepMission(finished)).toBe(finished);
    expect(advanceAct(finished)).toBe(finished);
  });
});

describe("Failure, retry, and debrief gating", () => {
  it("default play survives all three acts", () => {
    let s = advanceAct(playAct1Well(), 2);
    s = stepUntilActComplete(s);
    s = stepUntilActComplete(advanceAct(s, 3));
    s = advanceAct(s, 4);
    expect(s.meta.failed).toBe(false);
    expect(s.meta.completed).toBe(true);
  });

  it("fails Act 1 on a blackout, locks the mission, and retry restores the Act checkpoint", () => {
    let s = updateLifeSupportControls(createGameState(), {
      airFiltration: 100,
      climateControl: 100,
      waterRecovery: 100,
    });
    s = stepUntilActComplete(s);
    expect(s.meta.failed).toBe(true);
    expect(s.meta.failure?.code).toBe("POWER_BLACKOUT");
    expect(stepMission(s)).toBe(s);
    expect(advanceAct(s, 2)).toBe(s);
    expect(updateLifeSupportControls(s, { airFiltration: 10 })).toBe(s);
    expect(buildDebriefSummary(s).rating).toBe("Mission Failed");

    const retry = retryAct(s);
    expect(retry.meta.failed).toBe(false);
    expect(retry.meta.attempts).toBe(2);
    expect(retry.meta.currentAct).toBe(1);
    expect(retry.subSystems.power.batteryPct).toBe(
      createGameState().subSystems.power.batteryPct,
    );
    expect(retryAct(retry)).toBe(retry);
  });

  it("fails Act 3 when the shelter has no shielding material, and retry returns to Act 3 start", () => {
    let s = enterAct3();
    s = setShelterMaterials(setCmeDecision(s, false), []);
    s = stepUntilActComplete(s);
    expect(s.meta.failed).toBe(true);
    expect(s.meta.failure?.code).toBe("RADIATION_OVEREXPOSURE");

    const retry = retryAct(s);
    expect(retry.meta.currentAct).toBe(3);
    expect(retry.subSystems.radiation.cumulativeCrewDoseUGy).toBe(0);
    const good = stepUntilActComplete(retry);
    expect(good.meta.failed).toBe(false);
  });

  it("ratings are earned: a well-stocked shelter is Mission Ready, the usual stock is not, and neither is free", () => {
    const day100 = stepUntilActComplete(earnedAct2());
    const play = (waterFull: boolean) => {
      const start = waterFull
        ? {
            ...day100,
            subSystems: {
              ...day100.subSystems,
              water: { ...day100.subSystems.water, reserveLiters: day100.subSystems.water.maxLiters },
            },
          }
        : day100;
      let s = advanceStormPhase(advanceStormPhase(advanceAct(start, 3)));
      s = advanceStormPhase(setSepPowerAllocation(s, { shelterKw: 3, cabinKw: 4, greenhouseKw: 2 }));
      return stepUntilActComplete(s);
    };
    const best = play(true);
    expect(buildDebriefSummary(advanceAct(best, 4)).rating).toBe("Mission Ready");
    const usual = play(false);
    expect(buildDebriefSummary(advanceAct(usual, 4)).rating).toBe("Outpost Stabilized");
    // earlier water decisions matter: more water kept -> more water to shield with -> less simulated exposure
    expect(best.subSystems.radiation.cumulativeCrewDoseUGy).toBeLessThan(
      usual.subSystems.radiation.cumulativeCrewDoseUGy,
    );
  });

  it("only reports failure at Step/Act boundaries, not while dragging sliders", () => {
    const dragged = updateLifeSupportControls(createGameState(), {
      airFiltration: 0,
    });
    expect(dragged.meta.failed).toBe(false);
    expect(evaluateMissionFailure(createGameState())).toBe(null);
    expect(MISSION_FAILURE_LIMITS.co2Ppm > 0).toBeTruthy();
  });

  it("refuses to build a debrief for an unfinished mission", () => {
    const d = buildDebriefSummary(createGameState());
    expect(d.ready).toBe(false);
    expect(d.rating).toBe(null);
  });

  it("does not mutate previous states", () => {
    const s = createGameState();
    const snap = JSON.stringify(s);
    stepMission(s);
    advanceAct(s, 2);
    jumpToAct2(s);
    updateLifeSupportControls(s, { airFiltration: 10 });
    expect(JSON.stringify(s)).toBe(snap);
  });
});
