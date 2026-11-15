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
import { ResourceHUD } from "@/components/game/mission-ui";
import type { GameState } from "@/game/engine";
import { BANNER_MS, RESULT_OPEN_MS } from "@/game/life-support/timing";
import { GameProvider, useGame, type AgeMode } from "@/game/state";
import { playAct1Until } from "./helpers/autoplay";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function ModeSetter({ mode }: { mode: AgeMode }) {
  const { setAgeMode } = useGame();
  useEffect(() => setAgeMode(mode), [mode, setAgeMode]);
  return null;
}

function renderSim(mode: AgeMode = "explorer", initialSim?: GameState) {
  return render(
    <GameProvider {...(initialSim ? { initialSim } : {})}>
      <ModeSetter mode={mode} />
      <LifeSupportSim briefing={false} />
      <ResourceHUD />
    </GameProvider>,
  );
}

/** Radix sliders respond to the keyboard: Home / End jump to the ends. */
const lever = (name: string) => screen.getByRole("slider", { name });
const press = (name: string, key: string) =>
  fireEvent.keyDown(lever(name), { key });
const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const advanceButton = () =>
  screen.getByRole("button", { name: /Advance 6 hours/ });
/** Press Advance and let the "6 hours later" beat finish. */
const advance = () => {
  fireEvent.click(advanceButton());
  tick(BANNER_MS + 50);
};
const hudPower = () =>
  screen.getByText("Power").nextElementSibling?.textContent ?? "";

describe("Mission objective and layout", () => {
  it("opens with the mission title, a progress count and the three systems", () => {
    renderSim();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "KEEP THE HABITAT STABLE",
      }),
    ).toBeTruthy();
    expect(screen.getAllByText("Step 1 / 8").length).toBeGreaterThan(0);
    expect(screen.getByText(/Stable checkpoints: 0 \(need 6\)/)).toBeTruthy();
    expect(lever("Air scrubbers")).toBeTruthy();
    expect(lever("Thermostat")).toBeTruthy();
    expect(lever("Water recycler")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Power budget" })).toBeTruthy();
  });

  it("shows progress as dots through the NASA record, not a countdown", () => {
    renderSim();
    const dots = screen.getByRole("progressbar", { name: /NASA RR-28 record/ });
    expect(dots.children.length).toBe(8);
    expect(screen.queryByText(/countdown|remaining|seconds/i)).toBeNull();
  });
});

describe("NASA observation vs the player's habitat", () => {
  it("starts with the habitat exactly equal to the NASA reading, with no maths on screen", () => {
    renderSim("specialist");
    const gauges = document.querySelectorAll(".gauge");
    expect(gauges.length).toBe(3);
    for (const gauge of gauges) {
      const nasa = gauge.querySelector(
        ".value-nasa .value-number",
      )?.textContent;
      const habitat = gauge.querySelector(
        ".value-habitat .value-number",
      )?.textContent;
      expect(nasa).toBe(habitat);
    }
    expect(screen.queryByText(/Real reading/)).toBeNull();
    expect(screen.getAllByText("NASA DATA").length).toBe(3);
    expect(screen.getAllByText("SIMULATED").length).toBe(3);
  });

  it("shows the player's change next to NASA's number once a lever moves", () => {
    renderSim("specialist");
    press("Air scrubbers", "End");
    expect(screen.getByText(/ppm from your systems/)).toBeTruthy();
  });

  it("labels the safe zones for Explorer and names them a training target for Specialist", () => {
    renderSim("explorer");
    expect(screen.getAllByText("GOOD ZONE").length).toBe(3);
    expect(screen.getAllByText("TOO HIGH").length).toBe(3);
    cleanup();
    renderSim("specialist");
    expect(screen.getAllByText(/Mission safe zone:/).length).toBe(3);
    expect(screen.queryByText(/NASA safety limit|official/i)).toBeNull();
  });
});

describe("Cause-and-effect hints", () => {
  it("shows direction hints when a lever moves, and none at the NASA baseline", () => {
    renderSim();
    expect(screen.getAllByText("No change from NASA data").length).toBe(3);
    press("Air scrubbers", "End");
    expect(screen.getByTitle("CO₂ goes down")).toBeTruthy();
    expect(screen.getByTitle("Power use goes up")).toBeTruthy();
    expect(screen.getByTitle("Humidity slightly goes down")).toBeTruthy();
  });

  it("makes power a visible trade-off: heavy levers overdraw solar and drain the battery", () => {
    renderSim();
    const before = Number.parseInt(hudPower(), 10);
    press("Air scrubbers", "End");
    press("Thermostat", "Home");
    press("Water recycler", "End");
    expect(screen.getByText(/battery is draining/i)).toBeTruthy();
    advance();
    expect(Number.parseInt(hudPower(), 10)).toBeLessThan(before);
  });
});

describe("Advance 6 hours", () => {
  it("shows a short '6 HOURS LATER' beat, then updates the habitat, and cannot be double-pressed", () => {
    renderSim();
    fireEvent.click(advanceButton());
    expect(screen.getByText("6 HOURS LATER")).toBeTruthy();
    expect((advanceButton() as HTMLButtonElement).disabled).toBe(true);
    tick(BANNER_MS + 50);
    expect(screen.queryByText("6 HOURS LATER")).toBeNull();
    expect((advanceButton() as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getAllByText("Step 2 / 8").length).toBeGreaterThan(0);
  });

  it("explains what changed with arrows and a one-line verdict, collapses itself, and can be reopened", () => {
    renderSim("specialist");
    advance();
    const card = screen.getByRole("region", { name: "6 hours later" });
    expect(within(card).getByText("CO₂")).toBeTruthy();
    expect(within(card).getByText("Battery")).toBeTruthy();
    expect(
      card.querySelector(".changed-says")?.textContent?.length,
    ).toBeGreaterThan(10);

    tick(RESULT_OPEN_MS + 50);
    expect(screen.queryByRole("region", { name: "6 hours later" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "What changed?" }));
    expect(screen.getByRole("region", { name: "6 hours later" })).toBeTruthy();
  });

  it("Explorer sees arrows without numbers; Specialist sees the amounts", () => {
    renderSim("explorer");
    advance();
    expect(document.querySelector(".changed-amount")).toBeNull();
    cleanup();
    renderSim("specialist");
    advance();
    expect(document.querySelector(".changed-amount")).not.toBeNull();
  });
});

describe("Mission guide", () => {
  it("greets the player, then reacts to what is happening, in each age voice", () => {
    renderSim("explorer");
    expect(screen.getByText(/real NASA readings/i)).toBeTruthy();
    cleanup();
    renderSim("specialist");
    expect(screen.getByText(/Baseline loaded/i)).toBeTruthy();
  });

  it("warns about the battery before the player commits to a draining step", () => {
    renderSim();
    press("Air scrubbers", "End");
    press("Thermostat", "Home");
    press("Water recycler", "End");
    for (
      let i = 0;
      i < 8 && !screen.queryByText(/Stop! The battery would run flat/);
      i += 1
    )
      advance();
    expect(screen.getByText(/Stop! The battery would run flat/)).toBeTruthy();
  });
});

describe("Science terms", () => {
  it("opens a short explanation in place, with why it matters", () => {
    renderSim("explorer");
    fireEvent.click(
      screen.getAllByRole("button", {
        name: /What is Carbon dioxide|What is CO₂/,
      })[0]!,
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("CO₂ — Carbon dioxide")).toBeTruthy();
    expect(within(dialog).getByText("WHY IT MATTERS")).toBeTruthy();
    expect(dialog.textContent?.split(/\s+/).length).toBeLessThan(70);
  });

  it("has a '?' for CO₂, temperature, humidity, air scrubbers and the water recycler", () => {
    renderSim();
    expect(screen.getAllByRole("button", { name: /^What is / }).length).toBe(5);
  });

  it("gives Specialist the unit and a bit more detail", () => {
    renderSim("specialist");
    fireEvent.click(screen.getAllByRole("button", { name: /^What is / })[0]!);
    expect(within(screen.getByRole("dialog")).getByText(/ppm/)).toBeTruthy();
  });
});

describe("Habitat illustration", () => {
  it("shows airflow when scrubbers run hard and dims when the battery drains", () => {
    renderSim();
    expect(
      document.querySelector(".hab-airflow")?.getAttribute("data-active"),
    ).toBe("false");
    press("Air scrubbers", "End");
    expect(
      document.querySelector(".hab-airflow")?.getAttribute("data-active"),
    ).toBe("true");
    expect(screen.getByRole("img", { name: /Lunar habitat/ })).toBeTruthy();
  });
});

describe("Passing the level takes real play", () => {
  it("fails with a lesson when the player only presses Advance, and lets them retry", () => {
    renderSim();
    for (let i = 0; i < 8 && !screen.queryByRole("alert"); i += 1) advance();
    const alert = screen.getByRole("alert");
    expect(
      within(alert).getByText("The habitat wasn't stable enough"),
    ).toBeTruthy();
    expect(within(alert).getByText(/need 6/)).toBeTruthy();
    fireEvent.click(within(alert).getByRole("button", { name: /Try again/ }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getAllByText("Step 1 / 8").length).toBeGreaterThan(0);
  });

  it("completes the level for a player who keeps the habitat stable, and shows their patches", () => {
    renderSim("explorer", playAct1Until(7));
    expect(screen.getAllByText("Step 8 / 8").length).toBeGreaterThan(0);
    advance();
    expect(screen.getByText(/stayed safe for four days/i)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /RETURN TO MISSION MAP/ }),
    ).toBeTruthy();
    expect(document.querySelectorAll(".badge-earned").length).toBeGreaterThan(
      0,
    );
  });

  it("awards patches during play, not only at the end", () => {
    renderSim("explorer", playAct1Until(5));
    expect(document.querySelectorAll(".badge-earned").length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("BALANCE MASTER")).toBeTruthy();
  });
});
