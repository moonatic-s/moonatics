import { describe, expect, it } from "vitest";
import {
  AGE_BAND_TO_MODE,
  AGE_MODE_TO_BAND,
  advanceAct,
  createGameState,
  forecastNextStep,
  getLifeSupportBreakdown,
  stepMission,
  stepUntilActComplete,
  summarizeStep,
  toHudResources,
  toLifeSupportView,
  updateLifeSupportControls,
} from "@/game/engine";
import { jumpToAct2 } from "./helpers/autoplay";
import { initialResources } from "@/game/state";

describe("engine adapter (UI vocabulary)", () => {
  it("maps Explorer / Specialist to the 7-9 and 10-12 age bands and back", () => {
    expect(AGE_MODE_TO_BAND.explorer).toBe("7-9");
    expect(AGE_MODE_TO_BAND.specialist).toBe("10-12");
    expect(AGE_BAND_TO_MODE["7-9"]).toBe("explorer");
    expect(AGE_BAND_TO_MODE["10-12"]).toBe("specialist");
  });

  it("exposes four finite 0-100 HUD bars through the whole mission", () => {
    let s = createGameState();
    const seen = [toHudResources(s)];
    s = stepUntilActComplete(s);
    seen.push(toHudResources(s));
    s = stepUntilActComplete(jumpToAct2(s));
    seen.push(toHudResources(s));
    s = stepUntilActComplete(advanceAct(s, 3));
    seen.push(toHudResources(s));
    for (const hud of seen) {
      expect(Object.keys(hud).sort()).toEqual([
        "crewSafety",
        "food",
        "power",
        "water",
      ]);
      for (const value of Object.values(hud)) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    }
  });

  it("starts healthy and shows power cost when systems are maxed", () => {
    const start = createGameState();
    expect(toHudResources(start).power).toBeGreaterThan(
      initialResources.power - 30,
    );
    const maxed = updateLifeSupportControls(start, {
      airFiltration: 100,
      climateControl: 100,
      waterRecovery: 100,
    });
    const after = stepMission(maxed);
    expect(toLifeSupportView(after).power).toBeLessThan(
      toLifeSupportView(start).power,
    );
    expect(toLifeSupportView(after).tick).toBe(1);
  });
});

describe("console data: forecast, power breakdown and step summary", () => {
  it("forecast is exactly what the next step produces, for any lever setting", () => {
    for (const levers of [
      { airFiltration: 0, climateControl: 0, waterRecovery: 0 },
      { airFiltration: 55, climateControl: 52, waterRecovery: 55 },
      { airFiltration: 100, climateControl: 100, waterRecovery: 100 },
      { airFiltration: 33, climateControl: 80, waterRecovery: 12 },
    ]) {
      const s = updateLifeSupportControls(createGameState(), levers);
      expect(forecastNextStep(s)).toEqual(stepMission(s));
    }
  });

  it("has no forecast once stepping is impossible", () => {
    const done = stepUntilActComplete(createGameState());
    expect(forecastNextStep(done)).toBeNull();
    expect(forecastNextStep(jumpToAct2(done))).toBeNull();
  });

  it("splits power draw per lever so the pieces add up to the total", () => {
    for (const levers of [
      { airFiltration: 0, climateControl: 50, waterRecovery: 0 },
      { airFiltration: 80, climateControl: 20, waterRecovery: 65 },
      { airFiltration: 100, climateControl: 100, waterRecovery: 100 },
    ]) {
      const { power } = getLifeSupportBreakdown(
        updateLifeSupportControls(createGameState(), levers),
      );
      const sum =
        power.drawKw.scrubbers +
        power.drawKw.thermostat +
        power.drawKw.recycler;
      expect(Math.abs(sum - power.demandKw)).toBeLessThan(0.02);
      expect(power.netKw).toBeCloseTo(power.generationKw - power.demandKw, 1);
    }
  });

  it("explains each reading as the real baseline plus lever effects", () => {
    const s = updateLifeSupportControls(createGameState(), {
      airFiltration: 60,
      climateControl: 30,
      waterRecovery: 80,
    });
    const b = getLifeSupportBreakdown(s);
    const { cabin } = s.subSystems;
    expect(Math.round(b.baseline.co2Ppm + b.effects.co2Ppm.scrubbers)).toBe(
      cabin.co2Ppm,
    );
    expect(
      Math.round(
        (b.baseline.temperatureDegC + b.effects.temperatureDegC.thermostat) *
          10,
      ) / 10,
    ).toBe(cabin.temperatureDegC);
    const h = b.effects.humidityPct;
    expect(
      Math.round(
        (b.baseline.humidityPct + h.scrubbers + h.thermostat + h.recycler) * 10,
      ) / 10,
    ).toBe(cabin.relativeHumidityPct);
  });

  it("summarises what a step changed", () => {
    const before = createGameState();
    const after = stepMission(before);
    const change = summarizeStep(before, after);
    expect(change.co2Ppm).toBe(
      Math.round(
        after.subSystems.cabin.co2Ppm - before.subSystems.cabin.co2Ppm,
      ),
    );
    expect(change.batteryPct).toBeCloseTo(
      after.subSystems.power.batteryPct - before.subSystems.power.batteryPct,
      1,
    );
  });
});
