import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GreenhouseSetup } from "@/components/game/gh-setup";
import { writeAmbientPreference } from "@/game/audio/ambient";
import { installSfx, sfx } from "@/game/audio/sfx";
import { createGameState } from "@/game/engine";
import { beginGreenhouseSim, plantView } from "@/game/greenhouse/model";
import { GameProvider } from "@/game/state";

function installFakeAudio() {
  const made = { oscillators: 0 };
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
  const node = () => ({ connect: (n: unknown) => n, gain: param(), frequency: param(), type: "", start: vi.fn(), stop: vi.fn(), buffer: null as unknown });
  class FakeCtx {
    currentTime = 0;
    sampleRate = 8000;
    state = "running";
    destination = {};
    createGain() { return node(); }
    createBiquadFilter() { return { ...node(), frequency: { value: 0 } }; }
    createOscillator() { made.oscillators += 1; return node(); }
    createBuffer(_c: number, len: number) { return { getChannelData: () => new Float32Array(len) }; }
    createBufferSource() { return node(); }
    resume() { return Promise.resolve(); }
  }
  Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeCtx });
  return made;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "AudioContext");
});

describe("interface sounds", () => {
  it("are silent and harmless without Web Audio", () => {
    expect(() => Object.values(sfx).forEach((f) => (f as (v?: number) => void)(0.5))).not.toThrow();
  });

  it("play when sound is on, and stay quiet when it is switched off", () => {
    const made = installFakeAudio();
    sfx.snap();
    expect(made.oscillators).toBeGreaterThan(0);
    const before = made.oscillators;
    writeAmbientPreference(false);
    sfx.snap();
    sfx.switchOn();
    expect(made.oscillators).toBe(before);
  });

  it("give every kind of control its own sound without editing each one", () => {
    const spies = {
      tap: vi.spyOn(sfx, "tap").mockImplementation(() => {}),
      select: vi.spyOn(sfx, "select").mockImplementation(() => {}),
      confirm: vi.spyOn(sfx, "confirm").mockImplementation(() => {}),
      on: vi.spyOn(sfx, "switchOn").mockImplementation(() => {}),
      off: vi.spyOn(sfx, "switchOff").mockImplementation(() => {}),
      snap: vi.spyOn(sfx, "snap").mockImplementation(() => {}),
      pop: vi.spyOn(sfx, "pop").mockImplementation(() => {}),
    };
    document.body.innerHTML = `
      <button id="plain">Plain</button>
      <button id="main" data-primary>Main</button>
      <button id="pressed" aria-pressed="false">Option</button>
      <button id="sw" role="switch" aria-checked="false">Switch</button>
      <button id="sock" class="sg-socket">Socket</button>
      <div data-nosfx><button id="quiet">Quiet</button></div>`;
    const stop = installSfx();
    const $ = (id: string) => document.getElementById(id)!;
    fireEvent.click($("plain"));
    fireEvent.click($("main"));
    fireEvent.click($("pressed"));
    fireEvent.click($("quiet"));
    expect([spies.tap, spies.confirm, spies.select].map((s) => s.mock.calls.length)).toEqual([1, 1, 1]);
    // a switch sounds "on" or "off" by what it became
    $("sw").addEventListener("click", () => $("sw").setAttribute("aria-checked", String($("sw").getAttribute("aria-checked") !== "true")));
    fireEvent.click($("sw"));
    act(() => void vi.advanceTimersByTime(5));
    expect(spies.on).toHaveBeenCalledTimes(1);
    fireEvent.click($("sw"));
    act(() => void vi.advanceTimersByTime(5));
    expect(spies.off).toHaveBeenCalledTimes(1);
    // a power socket snaps in when filled and pops out when emptied
    $("sock").addEventListener("click", () => $("sock").classList.toggle("on"));
    fireEvent.click($("sock"));
    act(() => void vi.advanceTimersByTime(5));
    fireEvent.click($("sock"));
    act(() => void vi.advanceTimersByTime(5));
    expect([spies.snap.mock.calls.length, spies.pop.mock.calls.length]).toEqual([1, 1]);
    stop();
    fireEvent.click($("plain"));
    expect(spies.tap).toHaveBeenCalledTimes(1); // removed cleanly
    document.body.innerHTML = "";
  });

  it("tick when a slider moves, higher as the value rises", async () => {
    vi.useRealTimers();
    const slider = vi.spyOn(sfx, "slider").mockImplementation(() => {});
    document.body.innerHTML = '<span role="slider" aria-valuemin="0" aria-valuemax="100" aria-valuenow="10"></span>';
    const stop = installSfx();
    document.querySelector("[role=slider]")!.setAttribute("aria-valuenow", "75");
    await new Promise((r) => setTimeout(r, 0));
    expect(slider).toHaveBeenCalledWith(0.75);
    stop();
    document.body.innerHTML = "";
  });

  it("drag and drop has its own sounds: select, snap into the right place, a soft no for the wrong one", () => {
    const snap = vi.spyOn(sfx, "snap").mockImplementation(() => {});
    const reject = vi.spyOn(sfx, "reject").mockImplementation(() => {});
    const select = vi.spyOn(sfx, "select").mockImplementation(() => {});
    const tap = vi.spyOn(sfx, "tap").mockImplementation(() => {});
    const view = plantView(beginGreenhouseSim(createGameState()));
    render(
      <GameProvider initialStatuses={["completed", "active", "locked"]}>
        <GreenhouseSetup view={view} mode="explorer" onStart={() => {}} />
      </GameProvider>,
    );
    const stop = installSfx();
    fireEvent.click(screen.getByRole("button", { name: /^PLANT PILLOW$/ }));
    expect(select).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "ABOVE THE PLANT" })); // wrong spot
    expect(reject).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "GROW TRAY" })); // right spot
    expect(snap).toHaveBeenCalledTimes(1);
    expect(tap).not.toHaveBeenCalled(); // no extra generic click on top of these
    stop();
  });
});
