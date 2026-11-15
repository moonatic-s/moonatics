import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LifeSupportSim } from "@/components/game/life-support-sim";
import { MissionCard, MissionProgress } from "@/components/game/mission-ui";
import { BANNER_MS } from "@/game/life-support/timing";
import {
  GameProvider,
  canOpenMission,
  initialMissionStatuses,
  markMissionComplete,
  type MissionStatus,
} from "@/game/state";
import { createGameState } from "@/game/engine";
import { playAct1Idle, playAct1Until } from "./helpers/autoplay";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Mission progression rules", () => {
  it("starts with only Life Support open", () => {
    expect(initialMissionStatuses).toEqual(["active", "locked", "locked"]);
    expect([0, 1, 2].map((i) => canOpenMission(i))).toEqual([
      true,
      false,
      false,
    ]);
  });

  it("completing Life Support completes it and unlocks the Space Greenhouse, nothing more", () => {
    const next = markMissionComplete(initialMissionStatuses, 0);
    expect(next).toEqual(["completed", "active", "locked"]);
    expect([0, 1, 2].map((i) => canOpenMission(i, next))).toEqual([
      true,
      true,
      false,
    ]);
  });

  it("does not change the original list, and repeating it changes nothing", () => {
    const original = [...initialMissionStatuses];
    const once = markMissionComplete(initialMissionStatuses, 0);
    expect(initialMissionStatuses).toEqual(original);
    expect(markMissionComplete(once, 0)).toBe(once);
  });

  it("a locked mission cannot be completed, so nothing can be skipped", () => {
    expect(markMissionComplete(initialMissionStatuses, 1)).toBe(
      initialMissionStatuses,
    );
    expect(markMissionComplete(initialMissionStatuses, 2)).toBe(
      initialMissionStatuses,
    );
    expect(markMissionComplete(initialMissionStatuses, 9)).toBe(
      initialMissionStatuses,
    );
  });

  it("completing a later mission never relocks an earlier one", () => {
    const afterTwo = markMissionComplete(
      markMissionComplete(initialMissionStatuses, 0),
      1,
    );
    expect(afterTwo).toEqual(["completed", "completed", "active"]);
  });
});

function Screen({
  initialSim,
}: {
  initialSim?: ReturnType<typeof createGameState>;
}) {
  return (
    <GameProvider {...(initialSim ? { initialSim } : {})}>
      <LifeSupportSim briefing={false} />
      <MissionCard index={0} onSelect={() => {}} />
      <MissionCard index={1} onSelect={() => {}} />
      <MissionProgress />
    </GameProvider>
  );
}
const card = (title: RegExp) => screen.getByRole("button", { name: title });
const step = (i: number) => document.querySelectorAll(".progress-step")[i]!;

describe("Unlocking Mission 2 after Life Support", () => {
  it("Space Greenhouse is locked until Life Support is done", () => {
    render(<Screen />);
    expect((card(/FOOD PRODUCTION/) as HTMLButtonElement).disabled).toBe(true);
    expect((card(/LIFE SUPPORT/) as HTMLButtonElement).disabled).toBe(false);
    expect(step(0).className).toMatch(/progress-active/);
    expect(step(1).className).toMatch(/progress-locked/);
  });

  it("finishing Life Support well opens Mission 2 and updates the progress strip", () => {
    render(<Screen initialSim={playAct1Until(7)} />);
    expect((card(/FOOD PRODUCTION/) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Advance 6 hours/ }));
    act(() => void vi.advanceTimersByTime(BANNER_MS + 50));
    expect(screen.getByText(/stayed safe for four days/i)).toBeTruthy();
    expect((card(/FOOD PRODUCTION/) as HTMLButtonElement).disabled).toBe(false);
    expect(step(0).className).toMatch(/progress-completed/);
    expect(step(1).className).toMatch(/progress-active/);
    expect(step(2).className).toMatch(/progress-locked/);
    // Life Support can still be replayed, and its card says it is done
    expect((card(/LIFE SUPPORT/) as HTMLButtonElement).disabled).toBe(false);
    expect(card(/LIFE SUPPORT/).textContent).toMatch(/MISSION COMPLETE/);
  });

  it("failing Life Support does not unlock anything", () => {
    render(<Screen initialSim={playAct1Idle()} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect((card(/FOOD PRODUCTION/) as HTMLButtonElement).disabled).toBe(true);
    expect(step(1).className).toMatch(/progress-locked/);
  });

  it("an unlocked Mission 2 card can be opened", () => {
    const onSelect = vi.fn();
    const statuses: MissionStatus[] = ["completed", "active", "locked"];
    render(
      <GameProvider initialStatuses={statuses}>
        <MissionCard index={1} onSelect={onSelect} />
      </GameProvider>,
    );
    fireEvent.click(card(/FOOD PRODUCTION/));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
