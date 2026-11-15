import { describe, expect, it } from "vitest";
import {
  createGameState,
  forecastNextStep,
  updateLifeSupportControls,
} from "@/game/engine";
import {
  allReadingsSafe,
  forecastWarnings,
} from "@/game/life-support/forecast";

describe("forecast warnings", () => {
  it("stays quiet when everything is and stays safe", () => {
    const s = createGameState();
    expect(allReadingsSafe(s)).toBe(true);
    expect(forecastWarnings(s, forecastNextStep(s))).toEqual([]);
  });

  it("says so when a reading that is already unsafe will stay unsafe (no false all-clear)", () => {
    const s = updateLifeSupportControls(createGameState(), {
      airFiltration: 0,
    });
    expect(allReadingsSafe(s)).toBe(false);
    const warnings = forecastWarnings(s, forecastNextStep(s));
    expect(warnings.join(" ")).toMatch(/the air stays outside the safe zone/i);
  });

  it("warns before a safe reading leaves the safe zone", () => {
    // Find a lever setting that is safe now but not after the next 6 hours of real data.
    let found: string[] = [];
    for (let air = 0; air <= 100 && found.length === 0; air += 5) {
      for (let heat = 0; heat <= 100 && found.length === 0; heat += 5) {
        const s = updateLifeSupportControls(createGameState(), {
          airFiltration: air,
          climateControl: heat,
        });
        if (!allReadingsSafe(s)) continue;
        found = forecastWarnings(s, forecastNextStep(s)).filter((w) =>
          /will leave the safe zone/.test(w),
        );
      }
    }
    expect(found.length).toBeGreaterThan(0);
  });

  it("warns about a blackout before the player commits to it", () => {
    let s = updateLifeSupportControls(createGameState(), {
      airFiltration: 100,
      climateControl: 0,
      waterRecovery: 100,
    });
    // Advance until the next step would flatten the battery.
    for (let i = 0; i < 10; i += 1) {
      const next = forecastNextStep(s);
      if (next?.meta.failed) break;
      if (!next) break;
      s = next;
    }
    expect(forecastWarnings(s, forecastNextStep(s)).join(" ")).toMatch(
      /battery would run flat/i,
    );
  });

  it("has no warnings when there is nothing to forecast", () => {
    expect(forecastWarnings(createGameState(), null)).toEqual([]);
  });
});
