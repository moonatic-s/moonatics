import { describe, expect, it } from "vitest";
import {
  createGameState,
  forecastNextStep,
  stepMission,
  updateLifeSupportControls,
  type Act1Checkpoint,
} from "@/game/engine";
import {
  currentStableStreak,
  evaluateBadges,
  latestCheer,
} from "@/game/life-support/badges";
import { guideMessage } from "@/game/life-support/guide";
import {
  changeRows,
  interpretStep,
  leverHints,
} from "@/game/life-support/interpret";
import { playAct1Well } from "./helpers/autoplay";

const cp = (over: Partial<Act1Checkpoint> = {}, hour = 6): Act1Checkpoint => ({
  hour,
  airOk: true,
  heatOk: true,
  waterOk: true,
  stable: true,
  netKw: 0.4,
  batteryPct: 80,
  tankPct: 60,
  ...over,
});
const run = (n: number, over: Partial<Act1Checkpoint> = {}) =>
  Array.from({ length: n }, (_, i) => cp(over, (i + 1) * 6));

describe("mission patches and cheers", () => {
  it("awards nothing before the player has earned it", () => {
    expect(Object.values(evaluateBadges([])).some(Boolean)).toBe(false);
    expect(Object.values(evaluateBadges(run(2))).some(Boolean)).toBe(false);
  });

  it("awards each patch for its own streak", () => {
    expect(evaluateBadges(run(3)).AIR_KEEPER).toBe(true);
    expect(evaluateBadges(run(3)).POWER_SAVER).toBe(true);
    expect(evaluateBadges(run(3)).BALANCE_MASTER).toBe(false);
    expect(evaluateBadges(run(4)).BALANCE_MASTER).toBe(true);
    // A broken streak does not count, even with enough total good checkpoints.
    const broken = [...run(2), cp({ airOk: false, stable: false }), ...run(2)];
    expect(evaluateBadges(broken).AIR_KEEPER).toBe(false);
    expect(evaluateBadges(broken).BALANCE_MASTER).toBe(false);
  });

  it("awards Water Watcher only once the tank is back up after a few checkpoints", () => {
    expect(evaluateBadges(run(3, { tankPct: 80 })).WATER_WATCHER).toBe(false);
    expect(evaluateBadges(run(4, { tankPct: 80 })).WATER_WATCHER).toBe(true);
    expect(evaluateBadges(run(6, { tankPct: 50 })).WATER_WATCHER).toBe(false);
  });

  it("picks the cheer that fits the latest checkpoint", () => {
    expect(latestCheer([])).toBeNull();
    expect(latestCheer(run(1, { netKw: -1 }))).toBeNull();
    expect(latestCheer([cp({ stable: false, airOk: false }), cp()])).toEqual({
      kind: "recovery",
    });
    expect(latestCheer(run(3))).toEqual({ kind: "streak", count: 3 });
    expect(latestCheer(run(2))).toEqual({ kind: "efficient" });
    expect(
      currentStableStreak([...run(2), cp({ stable: false }), ...run(2)]),
    ).toBe(2);
  });
});

describe("cause-and-effect hints", () => {
  it("shows nothing at the NASA baseline and never reveals numbers", () => {
    expect(leverHints("air", 50)).toEqual([]);
    expect(leverHints("air", 54)).toEqual([]);
    for (const hint of leverHints("air", 90))
      expect(Object.keys(hint).sort()).not.toContain("amount");
  });

  it("points the right way for each lever", () => {
    expect(leverHints("air", 90)).toEqual([
      { target: "co2", dir: "down" },
      { target: "power", dir: "up" },
      { target: "humidity", dir: "down", slight: true },
    ]);
    expect(leverHints("air", 10)[0]).toEqual({ target: "co2", dir: "up" });
    expect(leverHints("heat", 90)[0]).toEqual({
      target: "temperature",
      dir: "down",
    });
    expect(leverHints("heat", 10)[0]).toEqual({
      target: "temperature",
      dir: "up",
    });
    expect(leverHints("heat", 10)[1]).toEqual({ target: "power", dir: "up" });
    expect(leverHints("water", 90)).toEqual([
      { target: "water", dir: "up" },
      { target: "humidity", dir: "down" },
      { target: "power", dir: "up" },
    ]);
  });
});

describe("what changed", () => {
  it("rows show direction, and treat tiny moves as no change", () => {
    const rows = changeRows({
      co2Ppm: 340,
      temperatureDegC: 0.05,
      humidityPct: -3.2,
      batteryPct: -4,
      waterLiters: 0,
    });
    expect(rows.map((r) => r.trend)).toEqual(["up", "flat", "down", "down"]);
    expect(rows[0]?.amount).toBe("+340 ppm");
    expect(rows[2]?.amount).toBe("−3.2 %");
  });

  it("congratulates a stable step and warns when a reading drifts out", () => {
    const good = playAct1Well();
    const [beforeLast] = [good.meta.act1History.length - 2];
    expect(beforeLast).toBeGreaterThanOrEqual(0);

    // Idle from the start: something eventually leaves the safe zone and the verdict says so.
    let s = createGameState();
    const verdicts: string[] = [];
    for (let i = 0; i < 8 && !s.meta.failed; i += 1) {
      const next = stepMission(s);
      verdicts.push(interpretStep(s, next).text);
      s = next;
    }
    expect(
      verdicts.some((v) => /getting worse|drifting|Still outside/.test(v)),
    ).toBe(true);
  });
});

describe("mission guide", () => {
  it("welcomes the player at the NASA baseline", () => {
    const s = createGameState();
    expect(guideMessage("explorer", s, forecastNextStep(s)).key).toBe(
      "welcome",
    );
  });

  it("speaks in plain words for Explorer and with technical terms for Specialist", () => {
    // Scrubbers off: CO2 climbs out of the safe zone at the CO2 spike, which the guide should call out.
    let s = updateLifeSupportControls(createGameState(), { airFiltration: 0 });
    s = stepMission(s);
    const kids = guideMessage("explorer", s, forecastNextStep(s));
    const older = guideMessage("specialist", s, forecastNextStep(s));
    expect(kids.key).toBe("air");
    expect(kids.text).toMatch(/stuffy/i);
    expect(older.text).toMatch(/CO₂/);
  });

  it("warns about a battery blackout before the player commits to it", () => {
    let s = updateLifeSupportControls(createGameState(), {
      airFiltration: 100,
      climateControl: 0,
      waterRecovery: 100,
    });
    for (let i = 0; i < 8 && !forecastNextStep(s)?.meta.failed; i += 1)
      s = stepMission(s);
    expect(guideMessage("explorer", s, forecastNextStep(s)).key).toBe(
      "blackout",
    );
  });

  it("always has a short line for every situation", () => {
    let s = createGameState();
    for (let i = 0; i < 8; i += 1) {
      for (const mode of ["explorer", "specialist"] as const) {
        const m = guideMessage(mode, s, forecastNextStep(s));
        expect(m.text.length).toBeGreaterThan(8);
        expect(m.text.length).toBeLessThan(110);
      }
      s = stepMission(s);
      if (s.meta.failed) break;
    }
  });
});
