import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GreenhouseScene } from "@/components/game/greenhouse-scene";
import { content } from "@/game/content";
import {
  DRY_AIR_RH_PCT,
  createGameState,
  setCabinAir,
  startFoodMission,
  stepMission,
} from "@/game/engine";
import {
  START_RUNG,
  WATER_RUNGS,
  advanceGreenhouseSim,
  beginGreenhouseSim,
  nextRung,
  plantView,
  rungOf,
  setLightSim,
  setWaterRungSim,
} from "@/game/greenhouse/model";
import { GameProvider, useGame, type AgeMode, type MissionStatus } from "@/game/state";

const g = content.greenhouse.game;

describe("Greenhouse game model (no sliders, discrete decisions)", () => {
  it("starts from a safe neutral set-up on the engine's Act 2", () => {
    const sim = beginGreenhouseSim(createGameState({ ageBand: "10-12" }));
    expect(sim.meta.currentAct).toBe(2);
    expect(rungOf(sim.controls.act2.waterFlow)).toBe(START_RUNG);
    const v = plantView(sim);
    expect(v.light).toBe("red");
    expect(v.stage).toBe(0);
    expect(v.root).toBe("balanced");
    expect(v.leaves).toBe("upright");
    expect(v.flower).toBe("open");
  });

  it("water only moves one rung at a time and stays inside the ladder", () => {
    expect(nextRung(2, "add")).toBe(3);
    expect(nextRung(2, "reduce")).toBe(1);
    expect(nextRung(2, "hold")).toBe(2);
    expect(nextRung(4, "add")).toBe(4);
    expect(nextRung(0, "reduce")).toBe(0);
    expect(WATER_RUNGS.length).toBe(5);
  });

  it("the light switch gives exactly the two NASA recipes", () => {
    let sim = beginGreenhouseSim(createGameState());
    sim = setLightSim(sim, "blue_rich");
    expect([plantView(sim).redPct, plantView(sim).bluePct]).toEqual([50, 50]);
    expect(plantView(sim).light).toBe("blue");
    sim = setLightSim(sim, "red_rich");
    expect([plantView(sim).redPct, plantView(sim).bluePct]).toEqual([90, 10]);
  });

  it("dry air arrives at Early Growth and leaves at Mid Growth", () => {
    let sim = beginGreenhouseSim(createGameState());
    sim = advanceGreenhouseSim(sim);
    expect(plantView(sim).checkpoint).toBe("early");
    const act1Rh = sim.carryOver.endRhPercent;
    expect(sim.carryOver.airOverlayRhPercent).toBe(DRY_AIR_RH_PCT);
    expect(act1Rh).not.toBe(DRY_AIR_RH_PCT); // the overlay never overwrites Act 1
    // holding the water now leaves the plant pillow dry
    expect(plantView(sim).root).toBe("dry");
    sim = advanceGreenhouseSim(sim);
    expect(plantView(sim).checkpoint).toBe("mid");
    expect(sim.carryOver.airOverlayRhPercent).toBeUndefined();
    expect(sim.carryOver.endRhPercent).toBe(act1Rh); // Act 1's humidity is back
  });

  it("responding to dry air helps, and too much water builds up later", () => {
    let careful = beginGreenhouseSim(createGameState());
    careful = advanceGreenhouseSim(careful);
    careful = setWaterRungSim(careful, 3); // one add
    expect(plantView(careful).root).toBe("balanced");

    let heavy = beginGreenhouseSim(createGameState());
    heavy = advanceGreenhouseSim(heavy);
    heavy = setWaterRungSim(heavy, 4); // two adds
    heavy = advanceGreenhouseSim(heavy);
    expect(plantView(heavy).root).toBe("buildup"); // air is normal again, so the extra water now shows
  });

  it("a whole run reaches Day 100 without failing and stays inside the engine's rules", () => {
    let sim = beginGreenhouseSim(createGameState());
    for (let i = 0; i < 4; i++) sim = advanceGreenhouseSim(sim);
    expect(sim.subSystems.greenhouse.day).toBe(100);
    expect(sim.meta.failed).toBe(false);
    expect(sim.subSystems.water.reserveLiters).toBeGreaterThan(0);
    expect(advanceGreenhouseSim(sim)).toBe(sim); // no stepping past the end
  });

  it("engine entry never trusts an unfinished Life Support: it starts from the baseline habitat", () => {
    const fresh = createGameState();
    const entered = startFoodMission(fresh);
    expect(entered.meta.currentAct).toBe(2);
    expect(fresh.meta.currentAct).toBe(1); // original untouched
    expect(setCabinAir(fresh, "dry")).toBe(fresh); // events only work inside Act 2
    expect(stepMission(entered)).not.toBe(entered);
  });
});

/* ------------------------------ the screens ------------------------------ */

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

let statuses: MissionStatus[] = [];
function Setup({ mode }: { mode: AgeMode }) {
  const { setAgeMode, missionStatuses } = useGame();
  statuses = missionStatuses;
  useEffect(() => setAgeMode(mode), [mode, setAgeMode]);
  return null;
}
function AfterAge() {
  return useGame().ageMode ? <GreenhouseScene /> : null;
}
const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const btn = (name: RegExp | string) => screen.getByRole("button", { name });
const click = (name: RegExp | string) => fireEvent.click(btn(name));
const text = () => document.body.textContent ?? "";

function openGame(mode: AgeMode) {
  render(
    <GameProvider initialStatuses={["completed", "active", "locked"]}>
      <Setup mode={mode} />
      <AfterAge />
    </GameProvider>,
  );
  click("SKIP BRIEFING"); // the briefing is tested on its own
  tick(400);
}
function buildGreenhouse() {
  for (const part of ["PLANT PILLOW", "WATER SUPPLY", "LIGHT UNIT"]) {
    click(new RegExp(`^${part}$`));
    const slot = { "PLANT PILLOW": "GROW TRAY", "WATER SUPPLY": "WATER SYSTEM", "LIGHT UNIT": "ABOVE THE PLANT" }[part]!;
    click(slot);
  }
}
const advance = () => click(/ADVANCE GROWTH|LET THE FRUIT RIPEN/);

describe.each<AgeMode>(["explorer", "specialist"])("Greenhouse mission, %s", (mode) => {
  it("starts with an empty chamber and unlocks START GROWTH only after all three parts are placed", () => {
    openGame(mode);
    expect(screen.getByRole("heading", { name: g.setup.title })).toBeTruthy();
    expect(screen.queryByRole("button", { name: g.setup.start })).toBeNull();
    click(/^PLANT PILLOW$/);
    click("GROW TRAY");
    click(/^WATER SUPPLY$/);
    click("WATER SYSTEM");
    expect(screen.queryByText(g.setup.ready)).toBeNull();
    click(/^LIGHT UNIT$/);
    click("ABOVE THE PLANT");
    expect(screen.getByText(g.setup.ready)).toBeTruthy();
    expect(btn(g.setup.start)).toBeTruthy();
  });

  it("a part only snaps into its own spot", () => {
    openGame(mode);
    click(/^PLANT PILLOW$/);
    click("ABOVE THE PLANT");
    expect(btn("ABOVE THE PLANT")).toBeTruthy(); // still empty
    expect(btn(/^PLANT PILLOW$/)).toBeTruthy();
  });

  it("uses no sliders anywhere in the mission", () => {
    openGame(mode);
    buildGreenhouse();
    click(g.setup.start);
    expect(screen.queryAllByRole("slider")).toHaveLength(0);
    expect(screen.getByRole("switch", { name: g.light.label })).toBeTruthy();
  });

  it("plays the whole loop: dry air, water decision, root check, harvest, report and completion", () => {
    openGame(mode);
    buildGreenhouse();
    click(g.setup.start);

    // light switch: two positions, with the simulated-change note once growth has started
    const sw = screen.getByRole("switch", { name: g.light.label });
    expect(sw.getAttribute("aria-checked")).toBe("false");
    advance(); // -> EARLY GROWTH
    expect(screen.getByRole("alert").textContent).toContain(g.events.dryAir.title);
    expect((btn(/ADVANCE GROWTH/) as HTMLButtonElement).disabled).toBe(true); // must respond first
    fireEvent.click(sw);
    expect(sw.getAttribute("aria-checked")).toBe("true");
    expect(text()).toContain("MOONATICS simulated light change");
    expect(text().toLowerCase()).not.toMatch(/\b(better|best)\b/);
    fireEvent.click(sw);

    click(g.water.add);
    expect((btn(/ADVANCE GROWTH/) as HTMLButtonElement).disabled).toBe(false);
    click(g.water.add); // too much water: it will show up once the air recovers
    advance(); // -> MID GROWTH

    expect(text()).toContain(g.events.rootCheck.title);
    expect((btn(/ADVANCE GROWTH/) as HTMLButtonElement).disabled).toBe(true);
    click(/ROOT ZONE/); // inspect the roots
    expect(text()).toContain(g.events.buildup.title);
    click(g.events.buildup.act);
    expect((btn(/ADVANCE GROWTH/) as HTMLButtonElement).disabled).toBe(false);

    advance(); // -> FLOWERING
    advance(); // -> FRUIT
    expect(document.querySelector(".gp")!.getAttribute("data-stage")).toBe("4");
    click(/LET THE FRUIT RIPEN/); // -> HARVEST
    expect(screen.getByRole("heading", { name: g.harvest.title })).toBeTruthy();

    const picks = screen.queryAllByRole("button", { name: /Pick ripe tomato/ });
    expect(picks.length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: g.harvest.finish })).toBeNull();
    for (const p of picks) fireEvent.click(p);
    expect(text()).toContain(g.harvest.plus);
    expect(statuses[1]).toBe("active"); // not complete before the harvest is finished
    click(g.harvest.finish);

    expect(screen.getByRole("heading", { name: g.report.title })).toBeTruthy();
    for (const row of [g.report.crop, g.report.water, g.report.light, g.report.stress, g.report.tomatoes])
      expect(text()).toContain(row);
    expect(text()).toContain(g.report.nasaTitle);
    expect(text()).toContain(g.report.lesson);
    expect(text().toLowerCase()).not.toContain("blue-rich produces more");
    expect(statuses).toEqual(["completed", "completed", "active"]); // Mission 3 opens, nothing relocks
  });

  it("the NASA comparison only appears after the mission ends", () => {
    openGame(mode);
    buildGreenhouse();
    click(g.setup.start);
    expect(text()).not.toContain(g.report.nasaTitle);
  });

  it("a root zone that is already balanced needs no decision", () => {
    openGame(mode);
    buildGreenhouse();
    click(g.setup.start);
    advance();
    click(g.water.add); // one add answers the dry air
    advance();
    expect(text()).toContain(g.events.rootCheck.ok);
    expect((btn(/ADVANCE GROWTH/) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("age adaptation", () => {
  it("Explorer sees simple words; Specialist also sees the numbers behind them", () => {
    openGame("explorer");
    buildGreenhouse();
    click(g.setup.start);
    expect(text()).toContain(g.inspect.status.healthy);
    expect(text()).not.toContain("PAR");
    cleanup();
    openGame("specialist");
    buildGreenhouse();
    click(g.setup.start);
    expect(text()).toContain("PAR");
    expect(text()).toContain("Cabin humidity");
    expect(text()).toContain("Root stress");
  });

  it("inspecting each plant spot opens a small panel", () => {
    openGame("explorer");
    buildGreenhouse();
    click(g.setup.start);
    click(/^LEAVES$/);
    expect(text()).toContain(g.inspect.leaves.upright.explorer);
    click(/ROOT ZONE/);
    expect(text()).toContain(g.inspect.root.balanced.explorer);
    click(/FLOWERS/);
    expect(text()).toContain(g.inspect.flower.none);
  });
});
