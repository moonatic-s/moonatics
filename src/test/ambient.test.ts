import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AmbientEngine, MOODS, moodForScene, readAmbientPreference, writeAmbientPreference } from "@/game/audio/ambient";

/** Just enough of Web Audio to watch what the engine does. */
function installFakeAudio() {
  const created = { oscillators: 0, started: 0, resumed: 0, suspended: 0 };
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
  });
  const node = () => ({ connect: (n: unknown) => n, gain: param(), frequency: param(), detune: param(), delayTime: param(), type: "", start: vi.fn(), stop: vi.fn() });
  class FakeCtx {
    currentTime = 0;
    destination = {};
    createGain() { return node(); }
    createBiquadFilter() { return node(); }
    createDelay() { return node(); }
    createOscillator() { created.oscillators += 1; const o = node(); o.start = vi.fn(() => void (created.started += 1)); return o; }
    resume() { created.resumed += 1; return Promise.resolve(); }
    suspend() { created.suspended += 1; return Promise.resolve(); }
  }
  vi.stubGlobal("AudioContext", FakeCtx);
  Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeCtx });
  return created;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, "AudioContext");
});

describe("ambient music", () => {
  it("every part of the game has a mood, with its own sound", () => {
    expect(moodForScene("start")).toBe("calm");
    expect(moodForScene("map")).toBe("calm");
    expect(moodForScene("briefing")).toBe("focus");
    expect(moodForScene("systems")).toBe("focus");
    expect(moodForScene("greenhouse")).toBe("garden");
    expect(moodForScene("storm")).toBe("storm");
    // the storm is the darkest and the garden the brightest
    expect(MOODS.storm.cutoff).toBeLessThan(MOODS.focus.cutoff);
    expect(MOODS.garden.cutoff).toBeGreaterThan(MOODS.calm.cutoff);
    Object.values(MOODS).forEach((m) => {
      expect(m.chords.length).toBeGreaterThan(1);
      expect(m.scale.length).toBeGreaterThan(2);
    });
  });

  it("is silent and harmless when Web Audio is not available", () => {
    const e = new AmbientEngine();
    expect(() => {
      e.start();
      e.setMood("storm");
      e.setIntensity(1);
      e.setDucked(true);
      e.stop();
    }).not.toThrow();
    expect(e.isRunning).toBe(false);
  });

  it("starts, changes mood, and stops without leaving timers running", () => {
    const made = installFakeAudio();
    const e = new AmbientEngine();
    e.start();
    expect(e.isRunning).toBe(true);
    expect(made.resumed).toBe(1);
    const afterStart = made.oscillators;
    expect(afterStart).toBeGreaterThan(3); // a chord is playing
    e.setMood("garden");
    expect(e.currentMood).toBe("garden");
    vi.advanceTimersByTime(20000);
    expect(made.oscillators).toBeGreaterThan(afterStart); // new chords and soft notes keep coming
    e.stop();
    expect(e.isRunning).toBe(false);
    const stopped = made.oscillators;
    vi.advanceTimersByTime(60000);
    expect(made.oscillators).toBe(stopped); // nothing is scheduled any more
    expect(made.suspended).toBe(1);
  });

  it("starting twice does not stack two copies of the music", () => {
    const made = installFakeAudio();
    const e = new AmbientEngine();
    e.start();
    const n = made.oscillators;
    e.start();
    expect(made.oscillators).toBe(n);
  });

  it("remembers whether the player turned it off", () => {
    window.localStorage.clear();
    expect(readAmbientPreference()).toBe(true);
    writeAmbientPreference(false);
    expect(readAmbientPreference()).toBe(false);
    writeAmbientPreference(true);
    expect(readAmbientPreference()).toBe(true);
  });
});
