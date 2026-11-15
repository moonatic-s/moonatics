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
import { content } from "@/game/content";
import { SKIP_LEAVE_MS } from "@/game/life-support/briefing-data";
import { GameProvider, useGame, type AgeMode } from "@/game/state";

/** A minimal stand-in for the browser's speech engine that records what would be spoken. */
class FakeUtterance {
  text: string;
  lang = "";
  rate = 1;
  pitch = 1;
  voice: unknown = null;
  onstart: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}
let queue: FakeUtterance[] = [];
const synth = {
  speak: vi.fn((u: FakeUtterance) => void queue.push(u)),
  cancel: vi.fn(() => void (queue = [])),
  getVoices: () => [],
};
const installSpeech = () => {
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  Object.defineProperty(window, "speechSynthesis", {
    value: synth,
    configurable: true,
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  queue = [];
  synth.speak.mockClear();
  synth.cancel.mockClear();
  window.localStorage.clear();
  installSpeech();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, "speechSynthesis");
});

function ModeSetter({ mode }: { mode: AgeMode }) {
  const { setAgeMode } = useGame();
  useEffect(() => setAgeMode(mode), [mode, setAgeMode]);
  return null;
}
const renderBriefing = (mode: AgeMode) =>
  render(
    <GameProvider>
      <ModeSetter mode={mode} />
      <LifeSupportSim />
    </GameProvider>,
  );

const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const next = () => {
  fireEvent.click(screen.getByRole("button", { name: "NEXT" }));
  tick(100);
};
const spokenText = () => queue.map((u) => u.text);
const briefing = () =>
  screen.queryByRole("dialog", { name: "Life Support training briefing" });
/** Pretend the voice has just started a line. */
const startLine = (i: number) => act(() => queue[i]?.onstart?.());

describe("Narration for both age groups", () => {
  it("reads the first scene aloud as soon as the briefing opens, in Explorer's simple words", () => {
    renderBriefing("explorer");
    tick(100);
    expect(spokenText()).toEqual(
      content.lifeConsole.briefing.voice.lines.explorer[0],
    );
    expect(spokenText()[0]).toBe("Welcome aboard, Junior Astronaut!");
  });

  it("gives ages 10-12 their own, more technical script", () => {
    renderBriefing("specialist");
    tick(100);
    expect(spokenText()).toEqual(
      content.lifeConsole.briefing.voice.lines.specialist[0],
    );
    expect(spokenText().join(" ")).toMatch(
      /carbon dioxide, temperature, and humidity/,
    );
    next();
    expect(spokenText().join(" ")).toMatch(/parts per million/);
  });

  it("speaks Explorer a little slower and brighter than Specialist", () => {
    renderBriefing("explorer");
    tick(100);
    const kid = queue[0]!;
    cleanup();
    queue = [];
    renderBriefing("specialist");
    tick(100);
    const older = queue[0]!;
    expect(kid.rate).toBeLessThan(older.rate);
    expect(kid.pitch).toBeGreaterThan(older.pitch);
    expect(kid.lang).toBe("en-US");
  });

  it("stops the old scene's voice and starts the new one on Next", () => {
    renderBriefing("explorer");
    tick(100);
    const before = synth.cancel.mock.calls.length;
    next();
    expect(synth.cancel.mock.calls.length).toBeGreaterThan(before);
    expect(spokenText()).toEqual(
      content.lifeConsole.briefing.voice.lines.explorer[1],
    );
  });

  it("has a script for every scene, in short plain lines for Explorer", () => {
    const { explorer, specialist } = content.lifeConsole.briefing.voice.lines;
    expect(explorer).toHaveLength(5);
    expect(specialist).toHaveLength(5);
    for (const scene of explorer) {
      expect(scene.length).toBeGreaterThan(0);
      for (const line of scene)
        expect(line.split(/\s+/).length).toBeLessThanOrEqual(22);
    }
    const everything = [...explorer, ...specialist].flat().join(" ");
    expect(everything).not.toMatch(
      /safety limit|medical|official NASA|countdown/i,
    );
    expect(specialist[3]?.join(" ")).toMatch(
      /NASA observations remain unchanged/,
    );
  });
});

describe("Sound controls", () => {
  it("can be turned off, which silences the voice and is remembered", () => {
    renderBriefing("explorer");
    tick(100);
    expect(queue.length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Sound on" }));
    expect(synth.cancel).toHaveBeenCalled();
    expect(
      screen
        .getByRole("button", { name: "Sound off" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
    queue = [];
    next();
    expect(spokenText()).toEqual([]);
    expect(window.localStorage.getItem("moonatics:sound")).toBe("off");
  });

  it("starts silent for a player who chose sound off last time", () => {
    window.localStorage.setItem("moonatics:sound", "off");
    renderBriefing("explorer");
    tick(100);
    expect(spokenText()).toEqual([]);
    expect(screen.getByRole("button", { name: "Sound off" })).toBeTruthy();
  });

  it("lets the player hear a scene again", () => {
    renderBriefing("explorer");
    tick(100);
    fireEvent.click(screen.getByRole("button", { name: "Hear again" }));
    tick(100);
    expect(spokenText()).toEqual(
      content.lifeConsole.briefing.voice.lines.explorer[0],
    );
    expect(synth.cancel).toHaveBeenCalled();
  });

  it("goes quiet when the briefing is skipped", () => {
    renderBriefing("explorer");
    tick(100);
    synth.cancel.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "SKIP BRIEFING" }));
    tick(SKIP_LEAVE_MS + 50);
    expect(synth.cancel).toHaveBeenCalled();
    expect(briefing()).toBeNull();
  });

  it("works silently, with no sound controls, where the browser has no speech", () => {
    Reflect.deleteProperty(window, "speechSynthesis");
    vi.unstubAllGlobals();
    renderBriefing("explorer");
    tick(100);
    expect(screen.queryByRole("button", { name: /Sound o/ })).toBeNull();
    expect(
      screen.getByRole("heading", { name: "LIFE SUPPORT ONLINE" }),
    ).toBeTruthy();
    next();
    expect(
      screen.getByRole("heading", { name: "THREE THINGS TO WATCH" }),
    ).toBeTruthy();
  });
});

describe("Ages 7-9 get a calmer, simpler briefing", () => {
  it("scene 2: only one concept moves at a time, and it follows the voice", () => {
    renderBriefing("explorer");
    next();
    const focused = () =>
      [...document.querySelectorAll(".concept-focus")].map((e) => e.className);
    expect(document.querySelectorAll(".concept-focus")).toHaveLength(1);
    expect(document.querySelectorAll(".concept-still")).toHaveLength(2);
    expect(focused()[0]).toMatch(/concept-air/);
    startLine(2); // "Next, temperature."
    expect(focused()[0]).toMatch(/concept-heat/);
    startLine(3); // "Last, humidity."
    expect(focused()[0]).toMatch(/concept-water/);
  });

  it("scene 2: without a voice it still moves through the concepts slowly, one at a time", () => {
    window.localStorage.setItem("moonatics:sound", "off");
    renderBriefing("explorer");
    next();
    expect(document.querySelector(".concept-focus")?.className).toMatch(
      /concept-air/,
    );
    tick(6100);
    expect(document.querySelector(".concept-focus")?.className).toMatch(
      /concept-heat/,
    );
    expect(document.querySelectorAll(".concept-focus")).toHaveLength(1);
  });

  it("scene 2: a tap picks the concept and keeps it", () => {
    renderBriefing("explorer");
    next();
    fireEvent.click(
      screen.getAllByRole("button", { name: /Tap to replay/ })[2]!,
    );
    expect(document.querySelector(".concept-focus")?.className).toMatch(
      /concept-water/,
    );
    startLine(2);
    expect(document.querySelector(".concept-focus")?.className).toMatch(
      /concept-water/,
    );
  });

  it("scene 1: shorter wording and no drifting-particle clutter", () => {
    renderBriefing("explorer");
    expect(
      screen.getByText("We keep the air, the warmth and the water just right."),
    ).toBeTruthy();
    expect(briefing()!.textContent).not.toMatch(/carefully controlled/);
  });

  it("scene 3: two-step chains and one line about power, without the extra notes", () => {
    renderBriefing("explorer");
    next();
    next();
    const dialog = within(briefing()!);
    expect(dialog.getByText("Every machine uses power.")).toBeTruthy();
    expect(document.querySelectorAll(".chain-chip")).toHaveLength(6);
    expect(document.querySelector(".benefit")).toBeNull();
    expect(document.querySelector(".system-note")).toBeNull();
    expect(briefing()!.textContent).not.toMatch(/game model/);
  });

  it("scene 4: just two cards and one sentence", () => {
    renderBriefing("explorer");
    next();
    next();
    next();
    expect(document.querySelector(".split-simple")).not.toBeNull();
    expect(document.querySelector(".split-middle")).toBeNull();
    expect(
      screen.queryByRole("list", { name: "How the layers connect" }),
    ).toBeNull();
    expect(screen.getByText(/NASA's number never changes/)).toBeTruthy();
  });

  it("scene 5: three plain steps and no loop diagram", () => {
    renderBriefing("explorer");
    for (let i = 0; i < 4; i += 1) next();
    expect(screen.getByText("1. LOOK")).toBeTruthy();
    expect(screen.getByText("2. CHANGE")).toBeTruthy();
    expect(screen.getByText("3. ADVANCE 6 HOURS")).toBeTruthy();
    expect(
      screen.queryByRole("list", { name: "The gameplay loop" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "BEGIN LIFE SUPPORT TRAINING" }),
    ).toBeTruthy();
  });

  it("keeps ages 10-12 exactly as before: full chains, loop, flow, and no focus dimming", () => {
    renderBriefing("specialist");
    next();
    expect(
      document.querySelectorAll(".concept-still, .concept-focus"),
    ).toHaveLength(0);
    next();
    expect(document.querySelectorAll(".chain-chip").length).toBeGreaterThan(6);
    expect(document.querySelector(".benefit")).not.toBeNull();
    next();
    expect(document.querySelector(".split-middle")).not.toBeNull();
    expect(
      screen.getByRole("list", { name: "How the layers connect" }),
    ).toBeTruthy();
    next();
    expect(
      screen.getByRole("list", { name: "The gameplay loop" }),
    ).toBeTruthy();
  });
});
