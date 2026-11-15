import { describe, expect, it } from "vitest";
import {
  ACT1_CHECKPOINTS,
  ACT1_REQUIRED_STABLE,
  DEFAULT_NASA_DATASETS,
  advanceAct,
  createGameState,
  getAct1Objective,
  getAdvanceStatus,
  retryAct,
  stepMission,
  updateLifeSupportControls,
} from "@/game/engine";
import { playAct1Idle, playAct1Well } from "./helpers/autoplay";

describe("Act 1 starts from the raw NASA observation", () => {
  it("begins with every lever at 'no change', so the habitat equals the real reading", () => {
    const s = createGameState();
    expect(s.controls.act1).toEqual({
      airFiltration: 50,
      climateControl: 50,
      waterRecovery: 50,
    });
    const { cabin } = s.subSystems;
    expect(cabin.co2Ppm).toBe(Math.round(cabin.rawSample.co2_ppm));
    expect(cabin.temperatureDegC).toBeCloseTo(
      cabin.rawSample.temperature_degC,
      1,
    );
    expect(cabin.relativeHumidityPct).toBeCloseTo(
      cabin.rawSample.relative_humidity_percent,
      1,
    );
  });

  it("replays 48 hours as 8 checkpoints of 6 hours, never wrapping past the real data", () => {
    expect(ACT1_CHECKPOINTS).toBe(8);
    const done = playAct1Idle();
    expect(done.meta.act1StepsCompleted).toBe(8);
    expect(done.meta.act1History.map((c) => c.hour)).toEqual([
      6, 12, 18, 24, 30, 36, 42, 48,
    ]);
    expect(stepMission(done)).toBe(done);
    expect(DEFAULT_NASA_DATASETS.lifeSupport.series.length).toBeGreaterThan(
      done.subSystems.cabin.baselineIndex,
    );
  });
});

describe("Act 1 cannot be passed by only pressing Advance", () => {
  it("does not allow leaving Act 1 before all checkpoints are played", () => {
    let s = createGameState();
    for (let i = 0; i < ACT1_CHECKPOINTS - 1; i += 1) {
      s = stepMission(s);
      expect(getAdvanceStatus(s).canAdvance).toBe(false);
      expect(advanceAct(s, 2)).toBe(s);
    }
    expect(getAdvanceStatus(s).reason).toMatch(/Play all 8 checkpoints/);
  });

  it("fails the mission when the player advances without managing the habitat", () => {
    const idle = playAct1Idle();
    const objective = getAct1Objective(idle);
    expect(objective.complete).toBe(true);
    expect(objective.stable).toBeLessThan(ACT1_REQUIRED_STABLE);
    expect(idle.meta.failed).toBe(true);
    expect(idle.meta.failure?.code).toBe("HABITAT_UNSTABLE");
    expect(advanceAct(idle, 2)).toBe(idle);
  });

  it("lets a player who actively balances the habitat through", () => {
    const played = playAct1Well();
    const objective = getAct1Objective(played);
    expect(objective.passed).toBe(true);
    expect(objective.stable).toBeGreaterThanOrEqual(ACT1_REQUIRED_STABLE);
    expect(played.meta.failed).toBe(false);
    expect(getAdvanceStatus(played).canAdvance).toBe(true);
    expect(advanceAct(played, 2).meta.currentAct).toBe(2);
  });

  it("is a genuine puzzle: most random lever settings do not keep the cabin stable", () => {
    let stable = 0;
    let tried = 0;
    for (const air of [0, 25, 50, 75, 100]) {
      for (const heat of [0, 25, 50, 75, 100]) {
        for (const water of [0, 25, 50, 75, 100]) {
          let s = updateLifeSupportControls(createGameState(), {
            airFiltration: air,
            climateControl: heat,
            waterRecovery: water,
          });
          while (!s.meta.failed && s.meta.act1StepsCompleted < ACT1_CHECKPOINTS)
            s = stepMission(s);
          tried += 1;
          if (getAct1Objective(s).passed) stable += 1;
        }
      }
    }
    // Holding one fixed setting for 48 hours should rarely be enough: the data keeps changing.
    expect(stable / tried).toBeLessThan(0.35);
  });

  it("records each checkpoint so the UI can show streaks and badges", () => {
    const s = stepMission(createGameState());
    const [first] = s.meta.act1History;
    expect(first).toMatchObject({ hour: 6 });
    expect(typeof first?.stable).toBe("boolean");
    expect(first?.tankPct).toBeGreaterThan(0);
  });

  it("restores a clean history when the player retries after failing", () => {
    const failed = playAct1Idle();
    const retry = retryAct(failed);
    expect(retry.meta.failed).toBe(false);
    expect(retry.meta.act1History).toEqual([]);
    expect(retry.meta.act1StepsCompleted).toBe(0);
  });
});
