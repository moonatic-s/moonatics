import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LifeSupportSim } from "@/components/game/life-support-sim";
import { createGameState } from "@/game/engine";
import {
  LEAVE_MS,
  SKIP_LEAVE_MS,
  buildBriefingData,
} from "@/game/life-support/briefing-data";
import { GameProvider, useGame, type AgeMode } from "@/game/state";

const realMatchMedia = window.matchMedia;
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.matchMedia = realMatchMedia;
});

function ModeSetter({ mode }: { mode: AgeMode }) {
  const { setAgeMode } = useGame();
  useEffect(() => setAgeMode(mode), [mode, setAgeMode]);
  return null;
}

function renderBriefing(mode: AgeMode = "explorer") {
  return render(
    <GameProvider>
      <ModeSetter mode={mode} />
      <LifeSupportSim />
    </GameProvider>,
  );
}

const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const next = () =>
  fireEvent.click(screen.getByRole("button", { name: "NEXT" }));
const back = () =>
  fireEvent.click(screen.getByRole("button", { name: "BACK" }));
const skip = () =>
  fireEvent.click(screen.getByRole("button", { name: "SKIP BRIEFING" }));
const goTo = (scene: number) => {
  for (let i = 1; i < scene; i += 1) next();
};
const briefing = () =>
  screen.queryByRole("dialog", { name: "Life Support training briefing" });
const prefersReducedMotion = () => {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("reduce"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
};

describe("Briefing structure", () => {
  it("opens on scene 1 with progress, back/next and an always-visible skip", () => {
    renderBriefing();
    expect(briefing()).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "LIFE SUPPORT ONLINE" }),
    ).toBeTruthy();
    expect(screen.getByText("Welcome to your lunar habitat.")).toBeTruthy();
    expect(screen.getByText("1 / 5")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "BACK" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(screen.getByRole("button", { name: "SKIP BRIEFING" })).toBeTruthy();
  });

  it("walks through all five scenes with Next and Back, and keeps Skip on every one", () => {
    renderBriefing();
    const titles = [
      "LIFE SUPPORT ONLINE",
      "THREE THINGS TO WATCH",
      "EVERY CHOICE HAS A COST",
      "REAL DATA. YOUR DECISIONS.",
      "YOUR MISSION",
    ];
    titles.forEach((title, i) => {
      expect(screen.getByRole("heading", { name: title })).toBeTruthy();
      expect(screen.getByText(`${i + 1} / 5`)).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "SKIP BRIEFING" }),
      ).toBeTruthy();
      if (i < titles.length - 1) next();
    });
    // last scene: the big call to action replaces Next
    expect(screen.queryByRole("button", { name: "NEXT" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "BEGIN LIFE SUPPORT TRAINING" }),
    ).toBeTruthy();
    back();
    expect(screen.getByText("4 / 5")).toBeTruthy();
  });

  it("works from the keyboard: arrows move, Escape skips", () => {
    renderBriefing();
    const dialog = briefing()!;
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(screen.getByText("2 / 5")).toBeTruthy();
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(screen.getByText("1 / 5")).toBeTruthy();
    fireEvent.keyDown(dialog, { key: "Escape" });
    tick(SKIP_LEAVE_MS + 50);
    expect(briefing()).toBeNull();
  });

  it("has no countdown or timer language", () => {
    renderBriefing();
    for (let i = 0; i < 5; i += 1) {
      expect(briefing()!.textContent).not.toMatch(
        /countdown|seconds left|time left|hurry/i,
      );
      if (i < 4) next();
    }
  });
});

describe("Age-adapted text, same visuals", () => {
  it("Explorer gets the short sentences, Specialist the units", () => {
    renderBriefing("explorer");
    next();
    expect(
      screen.getByText(
        "We breathe out CO₂. In a closed home, it can build up in the air.",
      ),
    ).toBeTruthy();
    expect(briefing()!.textContent).not.toMatch(/parts per million/);
    cleanup();
    renderBriefing("specialist");
    next();
    expect(
      screen.getByText(/measured in parts per million — ppm/),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /compared with how much the air could hold at that temperature/,
      ),
    ).toBeTruthy();
  });

  it("uses the same scenes and animations in both modes", () => {
    renderBriefing("explorer");
    next();
    const explorerDemos = document.querySelectorAll(".demo").length;
    cleanup();
    renderBriefing("specialist");
    next();
    expect(document.querySelectorAll(".demo").length).toBe(explorerDemos);
    expect(explorerDemos).toBe(3);
  });

  it("labels sensors with units for Specialist only", () => {
    renderBriefing("explorer");
    expect(screen.queryByText("CO₂ · ppm")).toBeNull();
    cleanup();
    renderBriefing("specialist");
    expect(screen.getByText("CO₂ · ppm")).toBeTruthy();
    expect(screen.getByText("Humidity · RH %")).toBeTruthy();
  });
});

describe("Teaching the trade-off (scene 3)", () => {
  it("shows the three systems, their effect chains and the power cost", () => {
    renderBriefing("specialist");
    goTo(3);
    for (const name of ["AIR SCRUBBERS", "THERMOSTAT", "WATER RECYCLER"]) {
      expect(screen.getByRole("region", { name })).toBeTruthy();
    }
    expect(screen.getAllByText(/Power Use/).length).toBe(3);
    expect(screen.getByText(/humidity can also change/i)).toBeTruthy();
    expect(screen.getByText(/part of the game model/i)).toBeTruthy();
  });

  it("animates everything to maximum, then drops the battery and states the lesson", () => {
    renderBriefing();
    goTo(3);
    const width = () =>
      Number.parseFloat(
        (document.querySelector(".power-fill") as HTMLElement).style.width,
      );
    const start = width();
    expect(start).toBe(buildBriefingData().batteryStart);
    expect(screen.queryByText("POWER RESERVE ↓")).toBeNull();
    tick(5000);
    expect(width()).toBeLessThan(start);
    expect(width()).toBe(buildBriefingData().batteryEnd);
    expect(screen.getByText("POWER RESERVE ↓")).toBeTruthy();
    expect(screen.getByText("There is no perfect setting.")).toBeTruthy();
    expect(screen.getByText("Your job is to find a balance.")).toBeTruthy();
  });

  it("never reveals a formula or the best setting", () => {
    renderBriefing("specialist");
    goTo(3);
    tick(5000);
    expect(briefing()!.textContent).not.toMatch(
      /× ?\d|formula|optimal|best setting|\b42\b/i,
    );
  });
});

describe("NASA data vs your simulation (scene 4)", () => {
  it("shows NASA's number and an identical habitat number, then only the habitat changes", () => {
    renderBriefing();
    goTo(4);
    const data = buildBriefingData();
    const nasa = () =>
      document.querySelector(".split-nasa .split-value")?.textContent ?? "";
    const habitat = () =>
      document.querySelector(".split-habitat .split-value")?.textContent ?? "";
    expect(within(briefing()!).getByText("NASA DATA")).toBeTruthy();
    expect(within(briefing()!).getByText("SIMULATED")).toBeTruthy();
    expect(nasa()).toBe(habitat());
    const before = nasa();
    tick(4000);
    expect(nasa()).toBe(before);
    expect(habitat()).not.toBe(before);
    expect(screen.getByText("Unchanged")).toBeTruthy();
    expect(data.habitatCo2).toBeLessThan(data.nasaCo2);
    // a real, unclamped response (420 ppm is the simulation floor)
    expect(data.habitatCo2).toBeGreaterThan(420);
  });

  it("takes its numbers from the real simulation, not from made-up values", () => {
    const data = buildBriefingData();
    const fresh = createGameState();
    expect(data.nasaCo2).toBe(fresh.subSystems.cabin.rawSample.co2_ppm);
    expect(data.scrubbersFrom).toBe(fresh.controls.act1.airFiltration);
    expect(data.batteryStart).toBe(fresh.subSystems.power.batteryPct);
    renderBriefing();
    goTo(4);
    expect(
      document.querySelector(".split-nasa .split-value")?.textContent,
    ).toContain(Math.round(data.nasaCo2).toLocaleString("en-US"));
  });

  it("draws the three-layer flow and explains it in the right age voice", () => {
    renderBriefing("specialist");
    goTo(4);
    const flow = screen.getByRole("list", { name: "How the layers connect" });
    expect(
      within(flow)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["NASA Observation", "Training Simulation", "Your Decision"]);
    expect(screen.getByText(/NASA observations remain unchanged/)).toBeTruthy();
  });
});

describe("Your mission (scene 5) and the hand-over to gameplay", () => {
  it("shows the three steps, the loop and the baseline note, without medical claims", () => {
    renderBriefing("specialist");
    goTo(5);
    expect(screen.getByText("1. OBSERVE")).toBeTruthy();
    expect(screen.getByText("2. ADJUST")).toBeTruthy();
    expect(screen.getByText("3. ADVANCE 6 HOURS")).toBeTruthy();
    const loop = screen.getByRole("list", { name: "The gameplay loop" });
    expect(within(loop).getByText("SEE THE CONSEQUENCES")).toBeTruthy();
    expect(
      screen.getByText(
        "NASA RR-28 environmental telemetry is used as the mission baseline.",
      ),
    ).toBeTruthy();
    expect(briefing()!.textContent).not.toMatch(
      /safety limit|medical|official NASA/i,
    );
  });

  it("keeps the live console inert while the briefing is open, then fades away to reveal it", () => {
    renderBriefing();
    const consoleEl = () =>
      document.querySelector(".life-console") as HTMLElement;
    expect(consoleEl().hasAttribute("inert")).toBe(true);
    goTo(5);
    fireEvent.click(
      screen.getByRole("button", { name: "BEGIN LIFE SUPPORT TRAINING" }),
    );
    expect(briefing()?.className).toMatch(/briefing-leaving/);
    tick(LEAVE_MS + 50);
    expect(briefing()).toBeNull();
    expect(consoleEl().hasAttribute("inert")).toBe(false);
    expect(consoleEl().className).toMatch(/is-revealing/);
    expect(
      screen.getByRole("button", { name: /Advance 6 hours/ }),
    ).toBeTruthy();
  });

  it("skipping goes straight to the same live console", () => {
    renderBriefing();
    skip();
    tick(SKIP_LEAVE_MS + 50);
    expect(briefing()).toBeNull();
    expect(screen.getByRole("slider", { name: "Air scrubbers" })).toBeTruthy();
  });

  it("does not touch the simulation: levers, hour and NASA baseline are exactly as at the start", () => {
    renderBriefing();
    goTo(5);
    fireEvent.click(
      screen.getByRole("button", { name: "BEGIN LIFE SUPPORT TRAINING" }),
    );
    tick(LEAVE_MS + 50);
    const fresh = createGameState();
    expect(screen.getAllByText("Step 1 / 8").length).toBeGreaterThan(0);
    expect(
      screen
        .getByRole("slider", { name: "Air scrubbers" })
        .getAttribute("aria-valuenow"),
    ).toBe(String(fresh.controls.act1.airFiltration));
    const nasa = document.querySelector(
      ".value-nasa .value-number",
    )?.textContent;
    const habitat = document.querySelector(
      ".value-habitat .value-number",
    )?.textContent;
    expect(nasa).toBe(habitat);
  });

  it("reaches the same place with a keyboard alone: focus lands on the main action", () => {
    renderBriefing();
    expect(document.activeElement?.textContent).toMatch(/NEXT/);
    goTo(5);
    expect(document.activeElement?.textContent).toMatch(
      /BEGIN LIFE SUPPORT TRAINING/,
    );
  });
});

describe("Reduced motion", () => {
  it("shows finished states at once and hands over without waiting", () => {
    prefersReducedMotion();
    renderBriefing();
    goTo(4);
    const data = buildBriefingData();
    expect(
      document.querySelector(".split-habitat .split-value")?.textContent,
    ).toContain(Math.round(data.habitatCo2).toLocaleString("en-US"));
    next();
    fireEvent.click(
      screen.getByRole("button", { name: "BEGIN LIFE SUPPORT TRAINING" }),
    );
    expect(briefing()).toBeNull();
  });
});
