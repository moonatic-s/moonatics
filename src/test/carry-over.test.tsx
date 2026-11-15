import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  captureFoodCarryOver,
  captureLifeSupportCarryOver,
  createGameState,
  setCabinAir,
  startFoodMission,
} from "@/game/engine";
import { beginGreenhouseSim } from "@/game/greenhouse/model";
import { loadProgress, parseResult } from "@/game/progress";
import { GameProvider, useGame } from "@/game/state";

afterEach(cleanup);

const act1Result = () => ({
  ...captureLifeSupportCarryOver(createGameState()),
  act1BatteryCarryPct: 61,
  act1WaterCarryLiters: 33.5,
  endRhPercent: 36,
  endCo2Ppm: 2100,
  endTempC: 24,
  dryCabinAirRisk: true,
});

describe("Mission 2 starts from your last Act 1 result", () => {
  it("rebuilds the habitat from a saved result", () => {
    const sim = startFoodMission(createGameState(), undefined, act1Result());
    expect(sim.meta.currentAct).toBe(2);
    expect(sim.subSystems.power.batteryPct).toBe(61);
    expect(sim.subSystems.water.reserveLiters).toBe(33.5);
    expect(sim.carryOver.endRhPercent).toBe(36);
    expect(sim.carryOver.act1BatteryCarryPct).toBe(61);
  });

  it("a saved result is clamped, so edited storage cannot break the engine", () => {
    const sim = startFoodMission(createGameState(), undefined, {
      ...act1Result(),
      act1BatteryCarryPct: 9999,
      act1WaterCarryLiters: -50,
      endRhPercent: Number.NaN,
    });
    expect(sim.subSystems.power.batteryPct).toBe(100);
    expect(sim.subSystems.water.reserveLiters).toBe(0);
    expect(Number.isFinite(sim.carryOver.endRhPercent)).toBe(true);
  });

  it("without a saved result it falls back to the baseline habitat", () => {
    const baseline = startFoodMission(createGameState());
    expect(baseline.meta.currentAct).toBe(2);
    expect(beginGreenhouseSim(createGameState(), null).subSystems.power.batteryPct).toBe(
      baseline.subSystems.power.batteryPct,
    );
  });

  it("the humidity event is a temporary overlay: Act 1's humidity returns and reaches Act 3", () => {
    let sim = startFoodMission(createGameState(), undefined, act1Result());
    sim = setCabinAir(sim, "dry");
    expect(sim.carryOver.endRhPercent).toBe(36);
    expect(sim.carryOver.airOverlayRhPercent).toBe(20);
    sim = setCabinAir(sim, "normal");
    expect(sim.carryOver.endRhPercent).toBe(36);
    expect(sim.carryOver.airOverlayRhPercent).toBeUndefined();
    expect(captureFoodCarryOver(sim).endRhPercent).toBe(36);
  });
});

describe("results are saved with progress", () => {
  it("validates saved results", () => {
    expect(parseResult(null)).toBeNull();
    expect(parseResult({ endCo2Ppm: "x" })).toBeNull();
    expect(parseResult(act1Result())).toEqual(act1Result());
    expect(parseResult({ ...act1Result(), act1BatteryCarryPct: 500 })).toBeNull();
  });

  it("a finished mission's result survives a reload, and the newest result replaces the old one", () => {
    let game!: ReturnType<typeof useGame>;
    const Probe = () => {
      game = useGame();
      return null;
    };
    render(
      <GameProvider>
        <Probe />
      </GameProvider>,
    );
    act(() => game.recordResult(1, act1Result()));
    act(() => game.recordResult(1, { ...act1Result(), act1BatteryCarryPct: 40 }));
    expect(loadProgress().results.act1?.act1BatteryCarryPct).toBe(40);
    cleanup();
    render(
      <GameProvider>
        <Probe />
      </GameProvider>,
    );
    expect(game.results.act1?.act1BatteryCarryPct).toBe(40);
    act(() => game.recordResult(2, { ...act1Result(), harvestRipeFruits: 5 }));
    expect(loadProgress().results.act2?.harvestRipeFruits).toBe(5);
  });
});
