import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MissionCard } from "@/components/game/mission-ui";
import { StormScene } from "@/components/game/storm-scene";
import { UnlockToast } from "@/components/game/unlock-toast";
import { content } from "@/game/content";
import { GameProvider, useGame, type AgeMode } from "@/game/state";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, "speechSynthesis");
});

describe("unlocking the next mission", () => {
  it("finishing a mission celebrates the mission it opens, once", () => {
    let game!: ReturnType<typeof useGame>;
    const Probe = () => {
      game = useGame();
      return null;
    };
    render(
      <GameProvider initialStatuses={["active", "locked", "locked"]}>
        <Probe />
        <UnlockToast />
        <MissionCard index={1} onSelect={() => {}} />
      </GameProvider>,
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect(document.querySelector(".mission-unlocking")).toBeNull();
    act(() => game.completeMission(0));
    expect(screen.getByRole("status").textContent).toContain(content.common.unlocked);
    expect(screen.getByRole("status").textContent).toContain("FOOD PRODUCTION");
    expect(document.querySelector(".mission-unlocking")).not.toBeNull();
    // completing it again opens nothing new, so nothing is celebrated again
    act(() => game.clearUnlocked());
    act(() => game.completeMission(0));
    expect(game.justUnlocked).toBeNull();
    // the toast and the card celebration fade away on their own
    act(() => game.completeMission(1));
    act(() => void vi.advanceTimersByTime(6000));
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("storm briefing narration", () => {
  it("every screen has a voice, and the two key sentences are spoken", () => {
    const spoken: string[] = [];
    vi.stubGlobal("SpeechSynthesisUtterance", class { text: string; constructor(t: string) { this.text = t; } });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { speak: (u: { text: string }) => spoken.push(u.text), cancel: vi.fn(), getVoices: () => [] },
    });
    const Setup = ({ mode }: { mode: AgeMode }) => {
      const { setAgeMode } = useGame();
      useEffect(() => setAgeMode(mode), [mode, setAgeMode]);
      return null;
    };
    const After = () => (useGame().ageMode ? <StormScene /> : null);
    render(
      <GameProvider initialStatuses={["completed", "completed", "active"]}>
        <Setup mode="explorer" />
        <After />
      </GameProvider>,
    );
    const perScreen: string[][] = [];
    for (let i = 0; i < 5; i++) {
      spoken.length = 0;
      act(() => void vi.advanceTimersByTime(300));
      perScreen.push([...spoken]);
      if (i < 4) fireEvent.click(screen.getByRole("button", { name: "NEXT" }));
    }
    perScreen.forEach((lines) => expect(lines.length).toBeGreaterThan(1));
    expect(perScreen[3]!.join(" ")).toContain("Shielding protects. Power runs systems.");
    expect(perScreen[4]!.join(" ")).toContain("NASA tells us what was measured.");
  });
});
