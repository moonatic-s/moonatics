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
import { GreenhouseScene } from "@/components/game/greenhouse-scene";
import { content } from "@/game/content";
import { createGameState } from "@/game/engine";
import { LEAVE_MS, SKIP_LEAVE_MS } from "@/game/life-support/briefing-data";
import { GameProvider, useGame, type AgeMode } from "@/game/state";

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
const realMatchMedia = window.matchMedia;

beforeEach(() => {
  vi.useFakeTimers();
  queue = [];
  synth.speak.mockClear();
  synth.cancel.mockClear();
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, "speechSynthesis");
  window.matchMedia = realMatchMedia;
});

const installSpeech = () => {
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  Object.defineProperty(window, "speechSynthesis", {
    value: synth,
    configurable: true,
  });
};
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

function Setup({ mode }: { mode: AgeMode }) {
  const { setAgeMode } = useGame();
  useEffect(() => setAgeMode(mode), [mode, setAgeMode]);
  return null;
}
/** In the real app the age is chosen before any mission opens, so only show the scene once it is set. */
function AfterAgeChosen() {
  return useGame().ageMode ? <GreenhouseScene /> : null;
}
const renderBriefing = (mode: AgeMode = "explorer") =>
  render(
    <GameProvider>
      <Setup mode={mode} />
      <AfterAgeChosen />
    </GameProvider>,
  );

const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const next = () =>
  fireEvent.click(screen.getByRole("button", { name: "NEXT" }));
const dialog = () =>
  screen.queryByRole("dialog", { name: "Space Greenhouse briefing" });
const plant = () => document.querySelector("svg.gh") as SVGElement;
const hasClass = (cls: string) => plant().classList.contains(cls);
const spoken = () => queue.map((u) => u.text);
const copy = content.greenhouse.briefing;

describe("Briefing structure", () => {
  it("is exactly three screens with Next, Back, progress and a skip", () => {
    renderBriefing();
    expect(dialog()).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "SPACE GREENHOUSE" }),
    ).toBeTruthy();
    expect(screen.getByText("1 / 3")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "BACK" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    next();
    expect(
      screen.getByRole("heading", { name: "FIND THE BALANCE" }),
    ).toBeTruthy();
    expect(screen.getByText("2 / 3")).toBeTruthy();
    next();
    expect(
      screen.getByRole("heading", { name: "CHOOSE A LIGHT RECIPE" }),
    ).toBeTruthy();
    expect(screen.getByText("3 / 3")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "NEXT" })).toBeNull();
    expect(screen.getByRole("button", { name: "SKIP BRIEFING" })).toBeTruthy();
  });

  it("uses one plant on every screen", () => {
    renderBriefing();
    for (let i = 0; i < 3; i += 1) {
      expect(document.querySelectorAll("svg.gh")).toHaveLength(1);
      if (i < 2) next();
    }
  });

  it("works from the keyboard and Escape skips", () => {
    renderBriefing();
    fireEvent.keyDown(dialog()!, { key: "ArrowRight" });
    expect(screen.getByText("2 / 3")).toBeTruthy();
    fireEvent.keyDown(dialog()!, { key: "ArrowLeft" });
    expect(screen.getByText("1 / 3")).toBeTruthy();
    fireEvent.keyDown(dialog()!, { key: "Escape" });
    tick(SKIP_LEAVE_MS + 50);
    expect(dialog()).toBeNull();
  });

  it("is written for Explorer: plain words, no charts, numbers or technical vocabulary", () => {
    renderBriefing();
    const seen: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      tick(20000);
      seen.push(dialog()!.textContent ?? "");
      if (i < 2) next();
    }
    const all = seen.join(" ");
    expect(all).not.toMatch(
      /ppm|chart|graph|telemetry|µmol|PAR|oxidative|transcript|spectral|quiz|question/i,
    );
    expect(all).not.toMatch(/better|best|worse/i);
    expect(document.querySelector("canvas, table")).toBeNull();
  });
});

describe("Screen 1: Space Greenhouse", () => {
  it("shows the seedling growing first, then the two icons, then the words, one after another", () => {
    renderBriefing();
    expect(hasClass("plant-growing")).toBe(true);
    expect(screen.queryByText("WATER")).toBeNull();
    expect(screen.queryByText(copy.one.text)).toBeNull();
    tick(3400 + 700 - 100); // growing finished, still pausing: nothing new yet
    expect(screen.queryByText("WATER")).toBeNull();
    tick(200);
    expect(screen.getByText("WATER")).toBeTruthy();
    expect(screen.getByText("LIGHT")).toBeTruthy();
    expect(screen.queryByText(copy.one.text)).toBeNull();
    tick(700);
    expect(
      screen.getByText("Plants need water and light to grow."),
    ).toBeTruthy();
  });

  it("shows only the two icons, nothing else", () => {
    renderBriefing();
    tick(5000);
    expect(document.querySelectorAll(".gh-needs li")).toHaveLength(2);
  });
});

describe("Screen 2: Find the balance", () => {
  const states = () => ({
    dry: hasClass("plant-dry"),
    wet: hasClass("plant-wet"),
    bright: hasClass("plant-bright"),
  });
  const words = () => document.querySelector(".gh-line")?.textContent ?? "";

  it("dries, rests, resets, floods, rests, then returns brighter, with words only while resting", () => {
    renderBriefing();
    next();
    expect(states()).toEqual({ dry: false, wet: false, bright: false });
    expect(words()).toBe("");
    tick(600 + 100); // drying starts
    expect(states().dry).toBe(true);
    expect(words()).toBe(""); // no words while the plant is moving
    tick(1800); // dry and resting
    expect(words()).toBe("Too little water can make the plant dry out.");
    tick(2000); // resets to healthy: words are gone before the plant moves
    expect(states()).toEqual({ dry: false, wet: false, bright: false });
    expect(words()).toBe("");
    tick(1200 + 100); // too wet
    expect(states().wet).toBe(true);
    expect(words()).toBe("");
    tick(1800);
    expect(words()).toBe("Too much water can also stress the plant.");
    tick(2000); // healthy and bright again
    expect(states()).toEqual({ dry: false, wet: false, bright: true });
    expect(words()).toBe("");
    tick(1600);
    expect(words()).toBe("Not too little. Not too much.");
  });

  it("never shows more than one sentence at once and never shows the plant dying", () => {
    renderBriefing();
    next();
    for (let t = 0; t < 14000; t += 250) {
      tick(250);
      expect(document.querySelectorAll(".gh-line")).toHaveLength(1);
      expect(document.body.textContent).not.toMatch(/dead|dying|dies|wilt/i);
      expect(dialog()!.className).not.toMatch(/alert|warning/);
    }
  });

  it("a stressed plant has drooping leaves and a closing flower, both gentle classes on the same plant", () => {
    renderBriefing();
    next();
    tick(700);
    expect(hasClass("plant-stressed")).toBe(true);
    expect(plant().querySelectorAll(".gh-leaf")).toHaveLength(4);
    expect(plant().querySelector(".gh-flower")).not.toBeNull();
  });

  it("tapping the plant plays the story again", () => {
    renderBriefing();
    next();
    tick(14000);
    expect(words()).toBe("Not too little. Not too much.");
    fireEvent.click(screen.getByRole("button", { name: copy.replay }));
    expect(words()).toBe("");
    expect(states()).toEqual({ dry: false, wet: false, bright: false });
  });
});

describe("Screen 3: Choose a light recipe", () => {
  const goToLight = () => {
    next();
    next();
  };

  it("starts on the red-rich recipe with a warm red-pink greenhouse", () => {
    renderBriefing();
    goToLight();
    const sw = screen.getByRole("switch", { name: "Light recipe" });
    expect(sw.getAttribute("aria-checked")).toBe("false");
    expect(plant().getAttribute("data-light")).toBe("red");
    expect(screen.getByText("90% Red / 10% Blue")).toBeTruthy();
    expect(screen.getByText("RED-RICH", { selector: "b" })).toBeTruthy();
  });

  it("one tap on the switch turns the light purple-blue, and tapping again goes back", () => {
    renderBriefing();
    goToLight();
    const sw = screen.getByRole("switch", { name: "Light recipe" });
    fireEvent.click(sw);
    expect(sw.getAttribute("aria-checked")).toBe("true");
    expect(plant().getAttribute("data-light")).toBe("blue");
    expect(screen.getByText("50% Red / 50% Blue")).toBeTruthy();
    expect(screen.getByText("BLUE-RICH", { selector: "b" })).toBeTruthy();
    fireEvent.click(sw);
    expect(plant().getAttribute("data-light")).toBe("red");
  });

  it("says NASA tested two recipes and never says one is better", () => {
    renderBriefing();
    goToLight();
    expect(
      screen.getByText("NASA tested two light recipes for space tomatoes."),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("switch", { name: "Light recipe" }));
    tick(3000);
    expect(dialog()!.textContent).not.toMatch(
      /better|best|worse|winner|more healthy|healthier|grows faster/i,
    );
  });

  it("reveals the mission a beat after the first tap, with three icons and a large button", () => {
    renderBriefing();
    goToLight();
    expect(screen.queryByText("YOUR MISSION")).toBeNull();
    fireEvent.click(screen.getByRole("switch", { name: "Light recipe" }));
    tick(1000);
    expect(screen.queryByText("YOUR MISSION")).toBeNull(); // the light is still changing: wait
    tick(900);
    const mission = screen.getByRole("region", { name: "YOUR MISSION" });
    expect(
      within(mission).getByText("Keep the tomato plant healthy until harvest."),
    ).toBeTruthy();
    expect(
      within(mission)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Manage Water", "Choose Light", "Watch the Plant"]);
    expect(
      within(mission).getByRole("button", { name: "ENTER THE GREENHOUSE" }),
    ).toBeTruthy();
  });

  it("reveals the mission on its own if nobody taps the switch", () => {
    renderBriefing();
    goToLight();
    tick(9100);
    expect(screen.getByRole("region", { name: "YOUR MISSION" })).toBeTruthy();
  });
});

describe("Leaving the briefing and the game state", () => {
  it("entering the greenhouse fades the briefing away to the greenhouse page", () => {
    renderBriefing();
    next();
    next();
    fireEvent.click(screen.getByRole("switch", { name: "Light recipe" }));
    tick(2000);
    fireEvent.click(
      screen.getByRole("button", { name: "ENTER THE GREENHOUSE" }),
    );
    expect(dialog()?.className).toMatch(/briefing-leaving/);
    tick(LEAVE_MS + 50);
    expect(dialog()).toBeNull();
    expect(
      screen.getByRole("heading", {
        name: "BUILD YOUR GREENHOUSE",
      }),
    ).toBeTruthy();
  });

  it("skipping goes to the same place", () => {
    renderBriefing();
    fireEvent.click(screen.getByRole("button", { name: "SKIP BRIEFING" }));
    tick(SKIP_LEAVE_MS + 50);
    expect(dialog()).toBeNull();
    expect(
      screen.getByRole("heading", {
        name: "BUILD YOUR GREENHOUSE",
      }),
    ).toBeTruthy();
  });

  it("changes no game state: the greenhouse is exactly as it was when the mission opened", () => {
    let seen = createGameState();
    function Probe() {
      seen = useGame().sim;
      return null;
    }
    render(
      <GameProvider>
        <Setup mode="explorer" />
        <Probe />
        <AfterAgeChosen />
      </GameProvider>,
    );
    const before = JSON.stringify(seen);
    next();
    tick(15000);
    next();
    fireEvent.click(screen.getByRole("switch", { name: "Light recipe" }));
    tick(2500);
    fireEvent.click(
      screen.getByRole("button", { name: "ENTER THE GREENHOUSE" }),
    );
    tick(LEAVE_MS + 50);
    expect(JSON.stringify(seen)).toBe(before);
  });

  it("Mission Specialists get their own briefing, not the Explorer one", () => {
    renderBriefing("specialist");
    expect(dialog()).toBeTruthy();
    expect(dialog()!.className).toMatch(/briefing-specialist/);
    expect(screen.getByText("ROOT ZONE", { selector: "span" })).toBeTruthy();
  });
});

describe("Sound", () => {
  it("speaks each line only when its words appear, in a gentle child-friendly voice", () => {
    installSpeech();
    renderBriefing();
    tick(100);
    expect(spoken()).toEqual(["Welcome to the space greenhouse!"]);
    expect(queue[0]!.rate).toBeLessThan(1);
    expect(queue[0]!.pitch).toBeGreaterThan(1);
    tick(5000);
    tick(100);
    expect(spoken()).toEqual(["Plants need water and light to grow."]);
    next();
    tick(100);
    expect(spoken()).toEqual([]); // nothing until the dry words appear
    tick(600 + 1800 + 100);
    tick(100);
    expect(spoken()).toEqual(["Too little water can make the plant dry out."]);
  });

  it("can be turned off, is remembered, and stops when the briefing is skipped", () => {
    installSpeech();
    renderBriefing();
    tick(100);
    fireEvent.click(screen.getByRole("button", { name: "Sound on" }));
    expect(window.localStorage.getItem("moonatics:sound")).toBe("off");
    expect(synth.cancel).toHaveBeenCalled();
    cleanup();
    queue = [];
    renderBriefing();
    tick(100);
    expect(spoken()).toEqual([]);
    synth.cancel.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "SKIP BRIEFING" }));
    expect(synth.cancel).toHaveBeenCalled();
  });

  it("works silently where the browser has no speech", () => {
    renderBriefing();
    expect(screen.queryByRole("button", { name: /Sound o/ })).toBeNull();
    next();
    expect(
      screen.getByRole("heading", { name: "FIND THE BALANCE" }),
    ).toBeTruthy();
  });
});

describe("Reduced motion", () => {
  it("shows each screen's finished picture and words at once", () => {
    prefersReducedMotion();
    renderBriefing();
    expect(
      screen.getByText("Plants need water and light to grow."),
    ).toBeTruthy();
    expect(screen.getByText("WATER")).toBeTruthy();
    next();
    expect(screen.getByText("Not too little. Not too much.")).toBeTruthy();
    expect(hasClass("plant-stressed")).toBe(false);
    next();
    expect(screen.getByRole("region", { name: "YOUR MISSION" })).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "ENTER THE GREENHOUSE" }),
    );
    expect(dialog()).toBeNull();
  });
});
