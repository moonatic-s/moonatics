import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CrewLog } from "@/components/game/crew-log";
import { GreenhouseScene } from "@/components/game/greenhouse-scene";
import { StormScene } from "@/components/game/storm-scene";
import { TrainingComplete } from "@/components/game/training-complete";
import { MissionWrapUp, RecallPrompt } from "@/components/game/wrapup";
import { createGameState } from "@/game/engine";
import { beginGreenhouseSim, previewWater } from "@/game/greenhouse/model";
import { GameProvider, useGame, type AgeMode, type MissionStatus } from "@/game/state";
import type { Facts } from "@/game/story/profile";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const facts: Facts = {
  detailsViewed: true,
  briefingsFinished: 2,
  earthRead: 2,
  m1: { stable: 7, total: 8, batteryPct: 80, waterLiters: 30, waterPct: 50 },
  m2: { waterLeftPct: 40, waterLiters: 24, cropHealthPct: 85, ripe: 5, respondedDryAir: true, rootOk: true, light: "red" },
  m3: {
    shelter: { water: 3, supply: 3, equipment: 2 },
    inventory: { water: 3, supply: 3, equipment: 5 },
    arraysProtected: true,
    plan: { shelterKw: 2, cabinKw: 3, greenhouseKw: 3 },
    budget: 8,
    rerouted: false,
    crewDoseUGy: 20000,
    doseLimit: 55000,
    holding: true,
  },
};

let game!: ReturnType<typeof useGame>;
function Probe({ mode = "explorer", seed = false }: { mode?: AgeMode; seed?: boolean }) {
  game = useGame();
  useEffect(() => game.setAgeMode(mode), [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (seed) game.recordFacts(facts);
  }, [seed]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
const done: MissionStatus[] = ["completed", "completed", "completed"];
const text = () => document.body.textContent ?? "";
const click = (name: RegExp | string) => fireEvent.click(screen.getByRole("button", { name }));
const radio = (name: RegExp | string) => fireEvent.click(screen.getByRole("radio", { name }));

describe("mission-control questions", () => {
  it("a right answer is celebrated, explained, and leads to a message from Earth", () => {
    render(
      <GameProvider initialStatuses={done}>
        <Probe />
        <MissionWrapUp mission="m1" onClose={() => {}} />
      </GameProvider>,
    );
    expect(text()).toContain("power budget");
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    radio("Less power is left");
    click("CHECK");
    expect(text()).toContain("Yes!");
    expect(game.story.profile.solved.m1).toBe(true);
    click("CONTINUE");
    expect(text()).toContain("MESSAGE FROM EARTH");
    expect(text()).toContain("open a window");
    expect(game.story.run.facts.earthRead).toBe(1);
  });

  it("a wrong answer gets the explanation and the answer: no second go, and no mark against the child", () => {
    render(
      <GameProvider initialStatuses={done}>
        <Probe />
        <MissionWrapUp mission="m1" onClose={() => {}} />
      </GameProvider>,
    );
    radio("More power is left");
    click("CHECK");
    expect(text()).toContain("Not quite.");
    expect(text()).toContain("Every system costs power");
    expect(text()).toContain("The answer: Less power is left");
    expect(text().toLowerCase()).not.toMatch(/wrong|incorrect|fail/);
    expect(screen.queryByRole("button", { name: /TRY AGAIN|CHECK/ })).toBeNull();
    // the options are locked, so there is nothing to try again
    expect((screen.getByRole("radio", { name: "Less power is left" }) as HTMLButtonElement).disabled).toBe(true);
    expect(game.story.profile.solved.m1).toBe(false);
    click("CONTINUE");
    expect(text()).toContain("MESSAGE FROM EARTH");
  });

  it("cannot be skipped: the only way on is to answer", () => {
    render(
      <GameProvider initialStatuses={done}>
        <Probe />
        <MissionWrapUp mission="m1" onClose={() => {}} />
      </GameProvider>,
    );
    expect(screen.queryByRole("button", { name: /SKIP/i })).toBeNull();
    expect((screen.getByRole("button", { name: "CHECK" }) as HTMLButtonElement).disabled).toBe(true);
    radio("Less power is left");
    expect((screen.getByRole("button", { name: "CHECK" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("the sorting question shows the right sorting when it is answered wrongly", () => {
    render(
      <GameProvider initialStatuses={done}>
        <Probe />
        <MissionWrapUp mission="m3" onClose={() => {}} />
      </GameProvider>,
    );
    const press = (label: string, side: 1 | 2) =>
      fireEvent.click(screen.getByRole("group", { name: label }).querySelector(`button:nth-child(${side})`)!);
    press("Water container", 2);
    press("Supply pack", 1);
    press("Life support power", 2);
    press("Grow-light power", 2);
    click("CHECK");
    expect(text()).toContain("Not quite.");
    expect(text()).toContain("Water container: SHIELDS");
    expect(game.story.profile.solved.m3).toBe(false);
  });

  it("the sorting question can be solved", () => {
    render(
      <GameProvider initialStatuses={done}>
        <Probe />
        <MissionWrapUp mission="m3" onClose={() => {}} />
      </GameProvider>,
    );
    const press = (label: string, side: 1 | 2) =>
      fireEvent.click(screen.getByRole("group", { name: label }).querySelector(`button:nth-child(${side})`)!);
    press("Water container", 1);
    press("Supply pack", 1);
    press("Life support power", 2);
    press("Grow-light power", 2);
    click("CHECK");
    expect(game.story.profile.solved.m3).toBe(true);
  });

  it("a second training asks a different question", () => {
    // finish a training (the finish screen counts it), then open the same mission's question in the same game
    function Flow() {
      const [step, setStep] = useState(0);
      useEffect(() => setStep(1), []);
      return step === 0 ? <TrainingComplete mode="explorer" /> : <MissionWrapUp mission="m1" onClose={() => {}} />;
    }
    render(
      <GameProvider initialStatuses={done}>
        <Probe seed />
        <Flow />
      </GameProvider>,
    );
    expect(game.story.profile.runsFinished).toBe(1);
    expect(text()).toContain("cabin readings"); // the second question in the pool
    expect(text()).not.toContain("power budget"); // not the first one again
  });

  it("the quick recall at the start of the next mission is answered, then closes", () => {
    const close = vi.fn();
    render(
      <GameProvider initialStatuses={done}>
        <Probe />
        <RecallPrompt mission="m2" onClose={close} />
      </GameProvider>,
    );
    expect(text()).toContain("Quick one");
    expect(screen.queryByRole("button", { name: /SKIP/i })).toBeNull();
    radio("Power");
    click("CHECK");
    expect(game.story.run.recalled.m2).toBe(true);
    click("CONTINUE");
    expect(close).toHaveBeenCalled();
  });
});

describe("training complete", () => {
  it("celebrates, replays the decisions, shows what was learned and offers to play again", () => {
    render(
      <GameProvider initialStatuses={done}>
        <Probe seed />
        <TrainingComplete mode="explorer" />
      </GameProvider>,
    );
    expect(text()).toContain("CONGRATULATIONS, TRAINING COMPLETE!");
    expect(text()).toContain("play again to get even better results");
    expect(text()).toContain("3 water containers");
    expect(text()).toContain("WHAT YOU LEARNED");
    expect(text()).toContain("Using the warning");
    expect(game.story.profile.runsFinished).toBe(1);
    expect(game.story.profile.patches).toContain("graduate");
    expect(screen.getByRole("button", { name: /PLAY AGAIN FOR BETTER RESULTS/ })).toBeTruthy();
  });

  it("playing again restarts the missions but keeps patches, cards and bests", () => {
    render(
      <GameProvider initialStatuses={done}>
        <Probe seed />
        <TrainingComplete mode="specialist" />
      </GameProvider>,
    );
    const patches = game.story.profile.patches.length;
    expect(patches).toBeGreaterThan(5);
    click(/PLAY AGAIN FOR BETTER RESULTS/);
    expect(game.missionStatuses).toEqual(["active", "locked", "locked"]);
    expect(game.story.run.facts.m1).toBeUndefined();
    expect(game.story.profile.patches.length).toBe(patches);
    expect(game.story.profile.runsFinished).toBe(1);
    expect(game.scene).toBe("map");
  });

  it("the progress strip stays horizontal: finished steps are not styled like the finish screen", () => {
    // the finish screen has its own class, so a finished step in the strip is never mistaken for it
    document.body.innerHTML = '<ol class="gg-strip"><li class="done">A</li></ol>';
    expect(document.querySelector(".gg-strip li")!.className).toBe("done");
    expect(document.querySelector(".finish")).toBeNull();
    document.body.innerHTML = "";
  });

  it("the crew log shows what has been collected and what is still to find", () => {
    render(
      <GameProvider initialStatuses={done}>
        <Probe seed />
        <CrewLog mode="explorer" />
      </GameProvider>,
    );
    expect(text()).toContain("Air Keeper");
    expect(text()).toContain("???");
    expect(text()).toContain("Water as a shield");
    expect(text()).not.toContain("CHALLENGES");
  });
});

describe("resources are visible before they are spent", () => {
  it("each water decision shows what it would cost next step", () => {
    const sim = beginGreenhouseSim(createGameState({ ageBand: "10-12" }));
    const add = previewWater(sim, "add");
    const reduce = previewWater(sim, "reduce");
    expect(add.perStep).toBeGreaterThan(reduce.perStep);
    expect(add.left).toBeLessThan(reduce.left);
  });
});

describe("space weather through-line", () => {
  const open = (scene: "g" | "s", mode: AgeMode) =>
    render(
      <GameProvider initialStatuses={["completed", "completed", "active"]}>
        <Probe mode={mode} />
        {scene === "g" ? <GreenhouseScene /> : <StormScene />}
      </GameProvider>,
    );
  it("mission control hints at the Sun getting active before the storm, then names it", () => {
    open("g", "explorer");
    act(() => void vi.advanceTimersByTime(100));
    fireEvent.click(screen.getByRole("button", { name: "SKIP BRIEFING" }));
    act(() => void vi.advanceTimersByTime(400));
    expect(text()).toContain("The Sun is getting busier");
    cleanup();
    open("s", "specialist");
    fireEvent.click(screen.getByRole("button", { name: "SKIP BRIEFING" }));
    act(() => void vi.advanceTimersByTime(400));
    expect(text()).toContain("This is the active sunspot group we have been watching");
  });
});
