import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  freshProgress,
  loadProgress,
  mergeProgress,
  parseProgress,
} from "@/game/progress";
import { GameProvider, useGame } from "@/game/state";

afterEach(cleanup);

describe("progress rules", () => {
  it("starts with only Life Support open and no briefing seen", () => {
    expect(freshProgress()).toEqual({
      missions: ["active", "locked", "locked"],
      briefingsSeen: { lifeSupport: false, greenhouse: false, storm: false },
      results: { act1: null, act2: null },
    });
  });

  it("bad or hand-edited saves can never skip or break the game", () => {
    expect(parseProgress(null)).toEqual(freshProgress());
    expect(parseProgress("hello")).toEqual(freshProgress());
    expect(parseProgress({ missions: ["nope", 5, null] })).toEqual(freshProgress());
    // Mission 3 done without Mission 2 or 1: the chain is repaired, not trusted
    expect(parseProgress({ missions: ["locked", "locked", "completed"] }).missions).toEqual([
      "completed",
      "completed",
      "completed",
    ]);
  });

  it("merging only moves forward and never relocks a mission", () => {
    const done = { ...freshProgress(), missions: ["completed", "active", "locked"] as const };
    const merged = mergeProgress(freshProgress(), { ...done, missions: [...done.missions] });
    expect(merged.missions).toEqual(["completed", "active", "locked"]);
    expect(mergeProgress(merged, freshProgress()).missions).toEqual(["completed", "active", "locked"]);
  });

  it("a seen briefing stays seen", () => {
    const a = { ...freshProgress(), briefingsSeen: { lifeSupport: true, greenhouse: false, storm: false } };
    const b = { ...freshProgress(), briefingsSeen: { lifeSupport: false, greenhouse: true, storm: false } };
    expect(mergeProgress(a, b).briefingsSeen).toEqual({ lifeSupport: true, greenhouse: true, storm: false });
  });
});

function Probe({ onGame }: { onGame: (g: ReturnType<typeof useGame>) => void }) {
  onGame(useGame());
  return null;
}
const mount = () => {
  let game!: ReturnType<typeof useGame>;
  render(
    <GameProvider>
      <Probe onGame={(g) => (game = g)} />
    </GameProvider>,
  );
  return () => game;
};

describe("progress is kept between visits", () => {
  it("a player who finished Life Support finds Mission 2 open on the next visit", () => {
    const first = mount();
    act(() => first().completeMission(0));
    expect(first().missionStatuses).toEqual(["completed", "active", "locked"]);
    expect(loadProgress().missions).toEqual(["completed", "active", "locked"]);
    cleanup();

    const second = mount();
    expect(second().missionStatuses).toEqual(["completed", "active", "locked"]);
  });

  it("briefing flags are saved, and a fresh visit cannot lock things again", () => {
    const first = mount();
    act(() => first().completeMission(0));
    act(() => first().markBriefingSeen("greenhouse"));
    cleanup();
    const second = mount();
    expect(second().briefingsSeen).toEqual({ lifeSupport: false, greenhouse: true, storm: false });
    expect(second().missionStatuses[1]).toBe("active");
  });

  it("reset clears everything", () => {
    const g = mount();
    act(() => g().completeMission(0));
    act(() => g().resetProgress());
    expect(g().missionStatuses).toEqual(["active", "locked", "locked"]);
    expect(loadProgress()).toEqual(freshProgress());
  });

  it("works when storage is blocked", () => {
    const real = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
    try {
      const g = mount();
      expect(g().missionStatuses).toEqual(["active", "locked", "locked"]);
    } finally {
      Storage.prototype.getItem = real;
    }
  });
});
