import { describe, expect, it } from "vitest";

import {
  DEFAULT_NASA_DATASETS,
  createGameState,
  togglePaused,
  setAgeBand,
  updateLifeSupportControls,
  updateFoodControls,
  applyFoodPreset,
  setShelterMaterials,
  rerouteStormPower,
  applySupplyDrop,
  dismissFlrStatic,
  setCmeDecision,
  setSepPowerAllocation,
  advanceStormPhase,
  stepMission,
  advanceAct,
  getAgeAdaptedTelemetry,
  buildDebriefSummary,
  stepUntilActComplete,
  isActComplete,
  getAdvanceStatus,
  retryAct,
  evaluateMissionFailure,
  MISSION_FAILURE_LIMITS,
} from "@/game/engine/mission";
import { jumpToAct2 } from "./helpers/autoplay";

// Plays Act 1 (default settings) and Act 2 to Day 100, then enters Act 3.
const enterAct3 = (state = createGameState()) =>
  advanceAct(stepUntilActComplete(jumpToAct2(state)), 3);

describe("NASA JSON dataset hydration", () => {
  it("loads expected counts and mission anchors from bundled src/data/*.json", () => {
    const { lifeSupport, food, radiation } = DEFAULT_NASA_DATASETS;

    expect(lifeSupport.series.length).toBe(120);
    expect(food.experiment.duration_days).toBe(101);
    expect(food.experiment.harvest_days_planned).toEqual([83, 90, 100]);
    expect(radiation.radiation_series.length).toBe(54);

    const maxPeak = Math.max(
      ...radiation.radiation_series.map((r) => r.mean_absorbed_dose_rate_uGy_h),
    );
    expect(maxPeak).toBe(20367.9167);
    const flr = radiation.events.find((e) => e.type === "FLR");
    const cme = radiation.events.find((e) => e.type === "CME");
    const sep = radiation.events.find((e) => e.type === "SEP");

    expect(flr?.class).toBe("M9.7");
    expect(cme?.speed_km_s).toBe(1106);
    expect(sep?.energy_threshold).toBe(">100 MeV");
  });

  it("initializes strictly 3 persistent resource bars in Manual Pause/Step mode", () => {
    const state = createGameState();

    expect(Object.keys(state.resources).sort()).toEqual([
      "foodProduction",
      "powerLifeSupport",
      "radiationShielding",
    ]);
    expect(state.simulation.paused).toBe(true);
    expect(state.simulation.mode).toBe("MANUAL_STEP");
    expect(state.meta.currentAct).toBe(1);
    expect(state.subSystems.radiation.flrRadioStaticActive).toBe(false);
  });
});

describe("Act 1 -> Act 2 cabin & greenhouse couplings", () => {
  it("couples Act 1 scrubber/water sliders to CO2, net kW, and <37.6% RH dry-air risk into Act 2", () => {
    const initial = createGameState();

    // High air filtration lowers CO2 but draws extra electrical power
    const scrubbed = updateLifeSupportControls(initial, {
      airFiltration: 95,
      waterRecovery: 55,
    });
    expect(
      scrubbed.subSystems.cabin.co2Ppm < initial.subSystems.cabin.co2Ppm,
    ).toBeTruthy();
    expect(
      scrubbed.subSystems.power.netKw < initial.subSystems.power.netKw,
    ).toBeTruthy();

    // Cranking water recovery aggressively dries cabin air below the OSD-766 37.6% warning threshold
    const overRecovered = updateLifeSupportControls(initial, {
      waterRecovery: 98,
      airFiltration: 85,
    });
    expect(
      overRecovered.subSystems.cabin.relativeHumidityPct < 37.6,
    ).toBeTruthy();
    expect(overRecovered.subSystems.cabin.dryCabinAirRisk).toBe(true);

    // Carry that dry cabin into Act 2 (Greenhouse) and confirm premature drying stress propagates
    const act2Dry = jumpToAct2(overRecovered);
    const moistAct1 = updateLifeSupportControls(initial, {
      waterRecovery: 35,
      airFiltration: 55,
    });
    const act2Moist = jumpToAct2(moistAct1);

    expect(act2Dry.carryOver.dryCabinAirRisk).toBe(true);
    expect(act2Dry.subSystems.greenhouse.prematureDryingRisk).toBe(true);
    expect(
      act2Dry.subSystems.greenhouse.hydrationPct <
        act2Moist.subSystems.greenhouse.hydrationPct,
    ).toBeTruthy();
  });

  it("is idempotent when dragging sliders back to original values without stepping", () => {
    const initial = createGameState();
    const dragged = updateLifeSupportControls(initial, {
      airFiltration: 90,
      climateControl: 30,
      waterRecovery: 80,
    });
    const reverted = updateLifeSupportControls(dragged, initial.controls.act1);

    expect(reverted.resources.powerLifeSupport).toBe(
      initial.resources.powerLifeSupport,
    );
    expect(reverted.subSystems.cabin.co2Ppm).toBe(
      initial.subSystems.cabin.co2Ppm,
    );
    expect(reverted.subSystems.cabin.relativeHumidityPct).toBe(
      initial.subSystems.cabin.relativeHumidityPct,
    );
  });
});

describe("Act 2 lighting presets, Day 1->100 steps, and carry-over into Act 3", () => {
  it("models 90R:10B vs 50R:50B oxidative trade-off and LED battery drain into storm budget", () => {
    const state = jumpToAct2();

    const redRich = applyFoodPreset(state, "red_rich");
    const blueRich = applyFoodPreset(state, "blue_rich");
    expect(redRich.subSystems.greenhouse.spectralMix.redPct).toBe(90);
    expect(blueRich.subSystems.greenhouse.spectralMix.bluePct).toBe(50);
    expect(
      blueRich.subSystems.greenhouse.oxidativeStressPct >
        redRich.subSystems.greenhouse.oxidativeStressPct,
    ).toBeTruthy();

    // Crank both LEDs to 100% and step through milestones Day 1 -> 10 -> 30 -> 60 -> 100
    let drained = updateFoodControls(state, {
      redLight: 100,
      blueLight: 100,
      waterFlow: 65,
    });
    for (let i = 0; i < 4; i += 1) {
      drained = stepMission(drained);
    }
    expect(drained.subSystems.greenhouse.day).toBe(100);
    expect(drained.meta.act2StepsCompleted).toBe(4);
    expect(
      drained.subSystems.power.batteryPct < state.subSystems.power.batteryPct,
    ).toBeTruthy();

    // Compare storm budget entering Act 3 vs low-power conservative greenhouse run
    let conserved = updateFoodControls(state, {
      redLight: 50,
      blueLight: 15,
      waterFlow: 55,
    });
    for (let i = 0; i < 4; i += 1) {
      conserved = stepMission(conserved);
    }

    const stormFromDrained = advanceAct(drained, 3);
    const stormFromConserved = advanceAct(conserved, 3);
    expect(
      stormFromDrained.subSystems.power.stormBudgetKw <
        stormFromConserved.subSystems.power.stormBudgetKw,
    ).toBeTruthy();
  });

  it("reproduces VEG-05 5 vs 6 ripe fruit contrast and prevents dark-room or flooding exploits", () => {
    const base = jumpToAct2();

    const redEnd = stepUntilActComplete(
      updateFoodControls(applyFoodPreset(base, "red_rich"), { waterFlow: 58 }),
    );
    const blueEnd = stepUntilActComplete(
      updateFoodControls(applyFoodPreset(base, "blue_rich"), { waterFlow: 58 }),
    );
    expect(redEnd.subSystems.greenhouse.estimatedRipeFruits).toBe(5);
    expect(blueEnd.subSystems.greenhouse.estimatedRipeFruits).toBe(6);
    expect(
      blueEnd.subSystems.greenhouse.oxidativeStressPct >
        redEnd.subSystems.greenhouse.oxidativeStressPct,
    ).toBeTruthy();

    const darkFail = stepUntilActComplete(
      updateFoodControls(base, { redLight: 5, blueLight: 5, waterFlow: 50 }),
    );
    expect(darkFail.meta.failed).toBe(true);
    expect(darkFail.meta.failure?.code).toBe("CROPS_FAILED");
    expect(darkFail.subSystems.greenhouse.estimatedRipeFruits).toBe(0);

    const floodedEnd = stepUntilActComplete(
      updateFoodControls(base, {
        waterFlow: 100,
        redLight: 100,
        blueLight: 100,
      }),
    );
    expect(
      floodedEnd.subSystems.greenhouse.cropHealthPct <
        redEnd.subSystems.greenhouse.cropHealthPct,
    ).toBeTruthy();
    expect(
      floodedEnd.subSystems.greenhouse.estimatedRipeFruits <
        redEnd.subSystems.greenhouse.estimatedRipeFruits,
    ).toBeTruthy();
    expect(floodedEnd.carryOver.cropVulnerability).toBe("SENSITIVE");
  });
});

describe("Act 3 DONKI storm phases, constrained SEP triage & CRaTER-D1D2 integration", () => {
  it("activates visual FLR radio static without adding a 4th bar, and keeps shielding and power separate", () => {
    let act3 = enterAct3();

    // Phase 1 FLR illuminates visual radio static alert
    expect(act3.subSystems.radiation.stormPhase).toBe(1);
    expect(act3.subSystems.radiation.flrRadioStaticActive).toBe(true);
    expect(Object.keys(act3.resources).sort()).toEqual([
      "foodProduction",
      "powerLifeSupport",
      "radiationShielding",
    ]);
    act3 = dismissFlrStatic(act3);
    expect(act3.subSystems.radiation.flrRadioStaticActive).toBe(false);

    // The shelter material available comes from the earlier missions
    const inv = act3.subSystems.radiation.shelterInventory;
    expect(inv.equipment).toBeGreaterThan(0);
    expect(inv.supply).toBeGreaterThan(0);

    // PHYSICAL SHIELDING: only material changes attenuation
    const bare = setShelterMaterials(act3, []);
    const stocked = setShelterMaterials(act3, [
      "water", "water", "supply", "supply", "equipment", "equipment", "equipment", "equipment",
    ]);
    expect(bare.subSystems.radiation.shieldAttenuationFactor).toBe(0.35);
    expect(
      stocked.subSystems.radiation.shieldAttenuationFactor,
    ).toBeGreaterThan(bare.subSystems.radiation.shieldAttenuationFactor);
    // material can never exceed what the outpost has
    const greedy = setShelterMaterials(act3, Array(8).fill("water"));
    expect(
      greedy.controls.act3.shelter.filter((x) => x === "water").length,
    ).toBeLessThanOrEqual(inv.water);

    // ELECTRICAL POWER: shelter power does not change attenuation, only shelter systems
    const lowPower = setSepPowerAllocation(act3, { shelterKw: 0 });
    const highPower = setSepPowerAllocation(act3, { shelterKw: 5, cabinKw: 0, greenhouseKw: 0 });
    expect(lowPower.subSystems.radiation.shieldAttenuationFactor).toBe(
      highPower.subSystems.radiation.shieldAttenuationFactor,
    );
    expect(highPower.subSystems.radiation.shelterSystemsPct).toBeGreaterThan(
      lowPower.subSystems.radiation.shelterSystemsPct,
    );

    // Materials are only placed during preparation (phase 1)
    expect(setShelterMaterials(advanceStormPhase(act3, 2), [])).toEqual(
      advanceStormPhase(act3, 2),
    );

    // CME: nothing is damaged when it is observed; deployed arrays give two more blocks
    const cme = advanceStormPhase(act3, 2);
    const retracted = setCmeDecision(cme, true);
    const deployed = setCmeDecision(cme, false);
    expect(deployed.subSystems.radiation.solarArrayIntegrityPct).toBe(100);
    expect(deployed.subSystems.power.stormBudgetKw).toBe(
      retracted.subSystems.power.stormBudgetKw + 2,
    );

    // SEP allocator caps total kW <= budgetKw and propagates starved cabin/greenhouse effects
    const sep = advanceStormPhase(cme, 3);
    const starved = setSepPowerAllocation(sep, {
      shelterKw: 5,
      cabinKw: 0,
      greenhouseKw: 0,
    });
    const budget = starved.subSystems.power.stormBudgetKw;
    const alloc = starved.controls.act3.sepPowerAlloc;
    expect(alloc.shelterKw + alloc.cabinKw + alloc.greenhouseKw <= budget).toBeTruthy();
    expect(starved.subSystems.cabin.co2Ppm > sep.carryOver.endCo2Ppm).toBeTruthy();
    expect(starved.resources.foodProduction < sep.carryOver.cropHealthAtStormPct).toBeTruthy();
  });

  it("Mission Specialist plays the same game with tighter numbers than Explorer", () => {
    const play = (band: "7-9" | "10-12") => {
      let s = advanceAct(stepUntilActComplete(jumpToAct2(createGameState({ ageBand: band }))), 3);
      return { budget: s.subSystems.power.stormBudgetKw, water: s.subSystems.water.reserveLiters };
    };
    const easy = play("7-9");
    const hard = play("10-12");
    expect(hard.budget).toBe(easy.budget - 1); // one fewer storm power block
    expect(hard.water).toBeLessThan(easy.water); // the greenhouse used more water
  });

  it("the supply drop helps once and never touches progress", () => {
    const g = advanceAct(stepUntilActComplete(jumpToAct2(createGameState())), 3);
    const before = g.subSystems.power.stormBudgetKw;
    const dropped = applySupplyDrop(g);
    expect(dropped.subSystems.power.stormBudgetKw).toBe(before + 1);
    expect(dropped.meta.supplyDropUsed).toBe(true);
    expect(applySupplyDrop(dropped)).toBe(dropped); // only once
    const act2 = jumpToAct2(createGameState());
    const wet = applySupplyDrop(act2);
    expect(wet.subSystems.water.reserveLiters).toBeGreaterThan(act2.subSystems.water.reserveLiters);
    expect(applySupplyDrop(createGameState())).toBeTruthy(); // Act 1 has no drop: unchanged
  });

  it("allows exactly one emergency reroute, only while the storm plays", () => {
    let s = enterAct3();
    s = setSepPowerAllocation(advanceStormPhase(advanceStormPhase(s)), { shelterKw: 2, cabinKw: 3, greenhouseKw: 2 });
    expect(rerouteStormPower(s, "shelterKw", "cabinKw")).toBe(s); // not before the storm plays
    s = advanceStormPhase(s);
    const once = rerouteStormPower(s, "shelterKw", "cabinKw");
    expect(once.controls.act3.sepPowerAlloc).toEqual({ shelterKw: 1, cabinKw: 4, greenhouseKw: 2 });
    expect(rerouteStormPower(once, "cabinKw", "greenhouseKw")).toBe(once); // only one
    expect(setSepPowerAllocation(once, { shelterKw: 5 })).toBe(once); // plan is locked
    // never into a full system, never from an empty one
    expect(rerouteStormPower(s, "shelterKw", "cabinKw").controls.act3.reroute).not.toBeNull();
    const empty = setSepPowerAllocation(advanceStormPhase(advanceStormPhase(enterAct3())), { shelterKw: 0, cabinKw: 3, greenhouseKw: 3 });
    expect(rerouteStormPower(advanceStormPhase(empty), "shelterKw", "cabinKw").controls.act3.reroute).toBeNull();
  });

  it("integrates cumulative dose accurately across 1h and 2h CRaTER-D1D2 timestamp gaps", () => {
    let act3 = enterAct3();
    for (let i = 0; i < 3; i += 1) act3 = advanceStormPhase(act3);
    expect(act3.subSystems.radiation.stormPhase).toBe(4);

    // Locate an exact 2-hour gap in the CRaTER series (e.g. 2024-06-08T01:00Z -> 03:00Z)
    const series = DEFAULT_NASA_DATASETS.radiation.radiation_series;
    const twoHourIdx = series.findIndex((row, idx) => {
      if (idx >= series.length - 1) return false;
      return (
        Date.parse(series[idx + 1]!.time) - Date.parse(row.time) === 2 * 3600000
      );
    });
    expect(twoHourIdx >= 0).toBeTruthy();

    const preparedAtGap = {
      ...act3,
      subSystems: {
        ...act3.subSystems,
        radiation: {
          ...act3.subSystems.radiation,
          radSeriesIndex: twoHourIdx,
          currentTimeUtc: series[twoHourIdx]!.time,
          cumulativeCrewDoseUGy: 0,
          unshieldedCumulativeUGy: 0,
        },
      },
    };

    const steppedGap = stepMission(preparedAtGap);
    const expectedUnshielded =
      ((series[twoHourIdx]!.mean_absorbed_dose_rate_uGy_h +
        series[twoHourIdx + 1]!.mean_absorbed_dose_rate_uGy_h) /
        2) *
      2;

    expect(
      Math.abs(
        steppedGap.subSystems.radiation.unshieldedCumulativeUGy -
          expectedUnshielded,
      ) < 0.05,
    ).toBeTruthy();
    expect(
      steppedGap.subSystems.radiation.cumulativeCrewDoseUGy <
        steppedGap.subSystems.radiation.unshieldedCumulativeUGy,
    ).toBeTruthy();
  });
});

describe("Pause/Step, Age-Band formatting, and Debrief summary", () => {
  it("supports Pause toggling, dual age telemetry, and NASA debrief generation", () => {
    let state = createGameState({ ageBand: "7-9", paused: true });
    expect(state.simulation.paused).toBe(true);

    // Stepping while paused works deterministically
    state = stepMission(state);
    expect(state.meta.act1StepsCompleted).toBe(1);

    const youngerView = getAgeAdaptedTelemetry(state);
    expect(youngerView.ageBand).toBe("7-9");
    expect(youngerView.roleTitle).toBe("Cabin Caretaker");
    expect(!youngerView.act1Cards[0]!.text.includes("ppm")).toBeTruthy();

    state = setAgeBand(togglePaused(state, false), "10-12");
    expect(state.simulation.paused).toBe(false);
    const olderView = getAgeAdaptedTelemetry(state);
    expect(olderView.ageBand).toBe("10-12");
    expect(olderView.roleTitle).toBe("Environmental Control Officer");
    expect(olderView.act1Cards[0]!.text.includes("ppm")).toBeTruthy();

    // Walk Acts 2 -> 3 -> Debrief (Act 4)
    state = stepUntilActComplete(jumpToAct2(state));
    state = stepUntilActComplete(advanceAct(state, 3));
    const finished = advanceAct(state, 4);
    expect(finished.meta.completed).toBe(true);

    const debrief = buildDebriefSummary(finished);
    if (!debrief.ready)
      throw new Error("debrief should be ready after mission completion");
    expect(
      ["Mission Ready", "Outpost Stabilized", "Needs Recalibration"].includes(
        debrief.rating,
      ),
    ).toBeTruthy();
    expect(debrief.doseReductionPct > 0).toBeTruthy();
    expect(
      debrief.comparisons.act2.spectralMix.redPct +
        debrief.comparisons.act2.spectralMix.bluePct,
    ).toBe(100);
  });
});
