import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GreenhouseScene } from "@/components/game/greenhouse-scene";
import { content } from "@/game/content";
import { GameProvider, useGame } from "@/game/state";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Setup() {
  const { setAgeMode } = useGame();
  useEffect(() => setAgeMode("specialist"), [setAgeMode]);
  return null;
}
function AfterAge() {
  return useGame().ageMode ? <GreenhouseScene /> : null;
}
const renderIt = () =>
  render(
    <GameProvider>
      <Setup />
      <AfterAge />
    </GameProvider>,
  );
const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const next = () => fireEvent.click(screen.getByRole("button", { name: "NEXT" }));
const s = content.greenhouse.briefing.specialist;
const text = () => document.querySelector(".briefing")!.textContent ?? "";

describe("Specialist Mission 2 briefing (ages 10-12)", () => {
  it("has three screens and the Veggie chamber with a root zone label", () => {
    renderIt();
    expect(screen.getByText("1 / 3")).toBeTruthy();
    expect(text()).toContain("PLANT CHAMBER");
    expect(text()).toContain("ROOT ZONE");
    expect(document.querySelectorAll(".ghs-drop").length).toBeGreaterThan(0);
    next();
    expect(screen.getByText("2 / 3")).toBeTruthy();
    next();
    expect(screen.getByText("3 / 3")).toBeTruthy();
    expect(screen.getByRole("button", { name: /ENTER THE GREENHOUSE/ })).toBeTruthy();
  });

  it("shows the environment note and VEG-05 info once the chamber has settled", () => {
    renderIt();
    expect(text()).not.toContain("VEG-05");
    tick(900 + 4200 + 100);
    expect(text()).toContain("ENVIRONMENT");
    expect(text()).toContain("VEG-05");
  });

  it("keeps Learn more closed until the player asks", () => {
    renderIt();
    tick(3000);
    const more = screen.getByRole("button", { name: s.learnMore });
    expect(more.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText(s.one.more).hasAttribute("hidden")).toBe(true);
    fireEvent.click(more);
    expect(more.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(s.one.more).hasAttribute("hidden")).toBe(false);
  });

  it("water screen starts by itself: dry, then balanced, then wet, with no tapping", () => {
    renderIt();
    next();
    const on = () => document.querySelector(".ghs-seg-on")!.textContent;
    const drops = () => document.querySelectorAll(".ghs-drop").length;
    expect(on()).toBe(s.two.dry);
    const dry = drops();
    tick(4200 + 50);
    expect(on()).toBe(s.two.ok);
    tick(4200);
    expect(on()).toBe(s.two.wet);
    expect(drops()).toBeGreaterThan(dry);
    expect(text()).toContain(s.two.texts.wet);
  });

  it("with the voice on, each level starts as its sentence starts", () => {
    const utterances: { text: string; onstart: (() => void) | null }[] = [];
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        text: string;
        onstart: (() => void) | null = null;
        constructor(t: string) {
          this.text = t;
        }
      },
    );
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { speak: (u: (typeof utterances)[number]) => utterances.push(u), cancel: vi.fn(), getVoices: () => [] },
    });
    renderIt();
    next();
    tick(200);
    const on = () => document.querySelector(".ghs-seg-on")!.textContent;
    expect(utterances.map((u) => u.text)).toEqual([s.voice.two.dry[0], s.voice.two.ok[0], s.voice.two.wet[0]]);
    act(() => utterances[1]!.onstart!());
    expect(on()).toBe(s.two.ok);
    act(() => utterances[2]!.onstart!());
    expect(on()).toBe(s.two.wet);
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, "speechSynthesis");
  });

  it("tapping a level still works, and tap to replay restarts the screen", () => {
    renderIt();
    next();
    fireEvent.click(screen.getByRole("radio", { name: s.two.wet }));
    tick(9000);
    expect(document.querySelector(".ghs-seg-on")!.textContent).toBe(s.two.wet);
    fireEvent.click(screen.getByRole("button", { name: content.greenhouse.briefing.tapReplay }));
    expect(document.querySelector(".ghs-seg-on")!.textContent).toBe(s.two.dry);
  });

  it("explains PAR in a tooltip that opens on request", () => {
    renderIt();
    next();
    next();
    const par = screen.getByRole("button", { name: /PAR/ });
    expect(screen.getByRole("tooltip", { hidden: true }).hasAttribute("hidden")).toBe(true);
    fireEvent.click(par);
    expect(screen.getByRole("tooltip").textContent).toContain("photosynthetically active radiation");
  });

  it("light recipes use the same switch as the Explorer briefing and keep both mixes", () => {
    renderIt();
    next();
    next();
    const sw = screen.getByRole("switch");
    expect(sw.getAttribute("aria-checked")).toBe("false");
    expect(text()).toContain("90% Red / 10% Blue");
    fireEvent.click(sw);
    expect(sw.getAttribute("aria-checked")).toBe("true");
    expect(text()).toContain("50% Red / 50% Blue");
    expect(text().toLowerCase()).not.toMatch(/better|best|higher yield|more yield/);
  });

  it("entering the greenhouse closes the briefing and remembers it was seen", () => {
    renderIt();
    next();
    next();
    fireEvent.click(screen.getByRole("button", { name: /ENTER THE GREENHOUSE/ }));
    tick(700);
    expect(screen.queryByRole("dialog")).toBeNull();
    // the briefing plays every time the mission opens, and the small replay icon brings it back
    fireEvent.click(screen.getByRole("button", { name: content.common.replayBriefing }));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("queues the narration once per screen so no sentence cuts off another", () => {
    const spokenLines: string[] = [];
    vi.stubGlobal("SpeechSynthesisUtterance", class { text: string; constructor(t: string) { this.text = t; } });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { speak: (u: { text: string }) => spokenLines.push(u.text), cancel: vi.fn(), getVoices: () => [] },
    });
    renderIt();
    tick(100);
    expect(spokenLines).toHaveLength(3);
    tick(9000);
    expect(spokenLines).toHaveLength(3); // nothing else spoke over them
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, "speechSynthesis");
  });
});
