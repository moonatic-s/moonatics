import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StormScene } from "@/components/game/storm-scene";
import { content } from "@/game/content";
import { GameProvider, useGame, type AgeMode, type MissionStatus } from "@/game/state";
import {
  PEAK_INDEX,
  SERIES,
  STORM_START,
  enteringLevel,
  passingStreaks,
  radiationWord,
} from "@/game/storm/model";

const g = content.storm.game;
const b = content.storm.briefing;

describe("storm model (NASA observed data, plain words)", () => {
  it("uses the real CRaTER peak and describes the outside radiation in four words", () => {
    expect(SERIES[PEAK_INDEX]!.time).toBe("2024-06-08T08:00:00Z");
    expect(Math.round(SERIES[PEAK_INDEX]!.mean_absorbed_dose_rate_uGy_h)).toBe(20368);
    expect(radiationWord(STORM_START)).toBe("low");
    expect(radiationWord(PEAK_INDEX - 3)).toBe("rising");
    expect(radiationWord(PEAK_INDEX - 1)).toBe("high");
    expect(radiationWord(PEAK_INDEX)).toBe("high");
    expect(radiationWord(PEAK_INDEX + 4)).toBe("high");
    expect(radiationWord(PEAK_INDEX + 12)).toBe("falling");
    expect(radiationWord(SERIES.length - 1)).toBe("low");
    expect(radiationWord(STORM_START + 2)).toBe("rising");
  });

  it("more shielding means fewer particles get in and a lower 'entering' level", () => {
    expect(passingStreaks(0.35)).toBeGreaterThan(passingStreaks(0.6));
    expect(passingStreaks(0.6)).toBeGreaterThan(passingStreaks(0.9));
    expect(enteringLevel(0.35)).toBeGreaterThan(enteringLevel(0.9));
  });
});

/* -------------------------------- the screens -------------------------------- */

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

let statuses: MissionStatus[] = [];
let sim!: ReturnType<typeof useGame>["sim"];
function Setup({ mode }: { mode: AgeMode }) {
  const game = useGame();
  statuses = game.missionStatuses;
  sim = game.sim;
  useEffect(() => game.setAgeMode(mode), [mode, game.setAgeMode]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
function AfterAge() {
  return useGame().ageMode ? <StormScene /> : null;
}
const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const click = (name: RegExp | string) => fireEvent.click(screen.getByRole("button", { name }));
const text = () => document.body.textContent ?? "";

function open(mode: AgeMode, skip = true) {
  render(
    <GameProvider initialStatuses={["completed", "completed", "active"]}>
      <Setup mode={mode} />
      <AfterAge />
    </GameProvider>,
  );
  if (skip) {
    click("SKIP BRIEFING");
    tick(400);
  }
}

describe("Mission 3 briefing: one component, two ages", () => {
  it("has five screens with the same structure for both ages", () => {
    const shape = (mode: AgeMode) => {
      cleanup();
      open(mode, false);
      const out: string[] = [];
      for (let i = 0; i < 5; i++) {
        tick(20000);
        const root = document.querySelector(".briefing")!;
        out.push(
          [
            screen.getByText(`${i + 1} / 5`).textContent,
            root.querySelector(".scene-title")!.textContent,
            String(root.querySelectorAll("svg").length > 0),
            root.className.replace(/briefing-(explorer|specialist)/, ""),
          ].join("|"),
        );
        if (i < 4) click("NEXT");
      }
      return out;
    };
    const explorer = shape("explorer");
    const specialist = shape("specialist");
    expect(explorer).toEqual(specialist);
    expect(explorer[0]).toContain("SPACE WEATHER ALERT");
    expect(explorer[1]).toContain("SPACE WEATHER CAN CHANGE");
    expect(explorer[2]).toContain("PROTECT THE CREW");
    expect(explorer[3]).toContain("SHARE THE POWER");
    expect(explorer[4]).toContain("YOUR FINAL MISSION");
  });

  it("Explorer has no technical numbers; Specialist adds M9.7, UTC time, CME and >100 MeV", () => {
    open("explorer", false);
    tick(6000);
    expect(text()).not.toContain("M9.7");
    expect(text()).not.toContain("UTC");
    click("NEXT");
    tick(15000);
    expect(text()).not.toContain(">100 MeV");
    cleanup();
    open("specialist", false);
    tick(6000);
    expect(text()).toContain("M9.7 SOLAR FLARE");
    expect(text()).toContain("Detected: 01:23 UTC");
    click("NEXT");
    tick(1500);
    expect(text()).toContain(b.two.cmeLabel);
    tick(7000);
    expect(text()).toContain(b.two.particleLabel);
  });

  it("shows one thing at a time: the CME and the particles never run together", () => {
    open("explorer", false);
    click("NEXT");
    const svg = () => document.querySelector(".briefing .sm")!.getAttribute("class")!;
    const seen = new Set<string>();
    for (let t = 0; t < 16; t++) {
      tick(1000);
      const c = svg();
      expect(/sm-st-cme/.test(c) && /sm-st-particles/.test(c)).toBe(false);
      seen.add(c.match(/sm-st-\w+/)![0]);
    }
    expect(seen.has("sm-st-cme")).toBe(true);
    expect(seen.has("sm-st-particles")).toBe(true);
  });

  it("states that shielding protects and power runs systems, and never changes the game", () => {
    open("specialist", false);
    const before = JSON.stringify(sim);
    click("NEXT");
    click("NEXT");
    click("NEXT");
    tick(20000);
    expect(text()).toContain(b.three.statement);
    click("NEXT");
    tick(20000);
    expect(text()).toContain(b.five.nasa);
    expect(text()).toContain(b.five.sim);
    expect(screen.getByRole("button", { name: /BEGIN SOLAR STORM PROTOCOL/ })).toBeTruthy();
    expect(JSON.stringify(sim)).toBe(before);
  });

  it("Back on the first screen is available, and Hear again / Tap to replay exist", () => {
    open("explorer", false);
    expect((screen.getByRole("button", { name: "BACK" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getAllByRole("button", { name: b.tapReplay }).length).toBeGreaterThan(0);
  });
});

function buildShelter() {
  const slots = [1, 2, 3, 4, 5, 6, 7, 8];
  const order = ["WATER CONTAINER", "SUPPLY PACK", "SUPPLY PACK", "SUPPLY PACK", "EQUIPMENT PACK", "EQUIPMENT PACK", "EQUIPMENT PACK", "EQUIPMENT PACK"];
  slots.forEach((n, i) => {
    const item = screen.queryByRole("button", { name: new RegExp(`^${order[i]}`) });
    if (!item || (item as HTMLButtonElement).disabled) return;
    fireEvent.click(item);
    click(`Shielding position ${n}`);
  });
}

describe.each<AgeMode>(["explorer", "specialist"])("Mission 3 gameplay, %s", (mode) => {
  it("walks DETECT > PREPARE > SHELTER > PRIORITIZE > SURVIVE one decision at a time and ends in a debrief", () => {
    open(mode);
    // DETECT: calm, static, then the alert and a single next step
    expect(screen.queryByRole("button", { name: g.detect.cta })).toBeNull();
    tick(3000);
    expect(text()).toContain(g.detect.title);
    expect(text()).toContain(g.detect.message);
    if (mode === "specialist") {
      expect(text()).toContain("M9.7 Solar Flare");
      expect(text()).toContain("01:23 UTC");
    } else expect(text()).not.toContain("M9.7");
    click(g.detect.cta);

    // PREPARE: drag-and-drop shelter (tap-to-place here); earlier decisions are visible
    expect(screen.getByRole("heading", { name: g.prepare.title })).toBeTruthy();
    expect(text()).toContain(g.prepare.matter);
    expect(text()).toContain(g.prepare.rule);
    const att0 = sim.subSystems.radiation.shieldAttenuationFactor;
    expect(att0).toBeCloseTo(0.35, 2); // empty shelter: the bare hull
    buildShelter();
    const att1 = sim.subSystems.radiation.shieldAttenuationFactor;
    expect(att1).toBeGreaterThan(att0);
    click(g.prepare.cta);

    // CME: the observation comes with time to prepare; one decision
    expect(text()).toContain(g.cme.title);
    expect(text()).toContain(g.cme.notYet);
    expect(screen.queryByRole("switch")).toBeNull();
    tick(3500);
    const sw = screen.getByRole("switch", { name: g.cme.decision });
    expect(sw.getAttribute("aria-checked")).toBe("false"); // PROTECT ARRAYS by default
    expect(sim.subSystems.radiation.solarArrayIntegrityPct).toBe(100);
    const budget = sim.subSystems.power.stormBudgetKw;
    fireEvent.click(sw);
    expect(sim.subSystems.power.stormBudgetKw).toBe(budget + 2);
    expect(sim.subSystems.radiation.solarArrayIntegrityPct).toBe(100); // no instant damage
    expect(text()).toContain("Storm vulnerability");
    fireEvent.click(sw);
    expect(sim.subSystems.power.stormBudgetKw).toBe(budget);
    click(g.cme.cta);

    // SEP
    expect(text()).toContain(g.sep.title);
    if (mode === "specialist") expect(text()).toContain(">100 MeV particles detected");
    else expect(text()).not.toContain(">100 MeV");
    click(g.sep.cta);

    // ROUTE: not enough power for everything; the plan must be built, then locked
    expect(screen.getByRole("button", { name: g.route.lock })).toHaveProperty("disabled", true);
    const sockets = (sys: string) => screen.getAllByRole("button", { name: new RegExp(`^${sys} power block`) });
    sockets(g.route.shelter).forEach((s) => fireEvent.click(s));
    sockets(g.route.life).forEach((s) => fireEvent.click(s));
    sockets(g.route.greenhouse).forEach((s) => fireEvent.click(s));
    const a = sim.controls.act3.sepPowerAlloc;
    expect(a.shelterKw + a.cabinKw + a.greenhouseKw).toBe(budget); // every block used, and no more than exist
    expect(a.shelterKw + a.cabinKw + a.greenhouseKw).toBeLessThan(12); // never enough for everything
    // shelter systems power does not change the shielding
    const attBefore = sim.subSystems.radiation.shieldAttenuationFactor;
    fireEvent.click(sockets(g.route.shelter)[0]!);
    expect(sim.subSystems.radiation.shieldAttenuationFactor).toBe(attBefore);
    fireEvent.click(sockets(g.route.shelter)[0]!);
    click(g.route.lock);

    // STORM: manual play, stops at the radiation peak
    expect(sim.subSystems.radiation.stormPhase).toBe(4);
    expect(text()).toContain("NASA OBSERVED");
    expect(text()).toContain("MOONATICS SIMULATED");
    expect(text()).toContain(g.storm.crewSource);
    expect(sim.subSystems.radiation.radSeriesIndex).toBe(STORM_START);
    click(g.storm.play);
    for (let i = 0; i < 12; i++) tick(650);
    expect(sim.subSystems.radiation.radSeriesIndex).toBe(PEAK_INDEX);
    expect(text()).toContain(g.storm.peak);
    expect(text()).toContain(g.storm.shelterHolding);

    // exactly one emergency reroute
    click(g.storm.reroute.open);
    expect(text()).toContain(g.storm.reroute.title);
    fireEvent.click(screen.getAllByRole("button", { name: g.storm.areas.shelter })[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: g.storm.areas.life })[1]!);
    expect(text()).toContain(g.storm.reroute.weaken);
    click(g.storm.reroute.confirm);
    expect(sim.controls.act3.reroute).toEqual({ from: "shelterKw", to: "cabinKw" });
    expect(screen.queryByRole("button", { name: g.storm.reroute.open })).toBeNull();

    // finish the storm
    click(g.storm.play);
    for (let i = 0; i < 40; i++) tick(650);
    expect(sim.subSystems.radiation.stormComplete).toBe(true);
    expect(sim.meta.failed).toBe(false);
    expect(text()).toContain(g.storm.passed);
    expect(text()).toContain(g.storm.passedMessage);
    expect(statuses[2]).toBe("active");
    click(g.storm.debrief);

    // DEBRIEF
    expect(statuses).toEqual(["completed", "completed", "completed"]);
    expect(screen.getByRole("heading", { name: g.debrief.complete })).toBeTruthy();
    // the first view is short: three tiles, one NASA line, one simulation line, one lesson
    expect(document.querySelectorAll(".sg-tile")).toHaveLength(3);
    expect(text()).not.toContain(g.debrief.choices);
    expect(text()).toContain(g.debrief.lesson);
    click(g.debrief.details);
    for (const x of [g.debrief.crew, g.debrief.outpost, g.debrief.greenhouse, g.debrief.choices, g.debrief.shelterProtection, g.debrief.exposure, g.debrief.lifeSupport, g.debrief.power, g.debrief.crop, g.debrief.food, g.debrief.shelterConfig, g.debrief.arrays, g.debrief.plan, g.debrief.reroute])
      expect(text()).toContain(x);
    expect(text()).toContain("M9.7 solar flare");
    expect(text()).toContain("Shelter attenuation");
    expect(screen.getAllByText(g.nasaObserved).length).toBeGreaterThan(0);
    expect(screen.getAllByText(g.simulated).length).toBeGreaterThan(0);
  });

  it("an empty shelter is a gentle failure with a way to try again, never frightening words", () => {
    open(mode);
    tick(3000);
    click(g.detect.cta);
    click(g.prepare.cta); // seal an empty shelter
    tick(3500);
    click(g.cme.cta);
    click(g.sep.cta);
    fireEvent.click(screen.getAllByRole("button", { name: new RegExp(`^${g.route.shelter} power block`) })[0]!);
    click(g.route.lock);
    click(g.storm.play);
    for (let i = 0; i < 60 && !sim.meta.failed; i++) {
      tick(650);
      if (screen.queryByRole("button", { name: g.storm.play })) click(g.storm.play);
    }
    expect(sim.meta.failed).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain(g.storm.failed.title);
    expect(text().toLowerCase()).not.toMatch(/\b(died|death|dead|killed|injur)/);
    click(g.storm.failed.retry);
    expect(screen.getByRole("heading", { name: g.prepare.title })).toBeTruthy();
  });
});
