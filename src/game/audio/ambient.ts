/**
 * Ambient background music, made live with the Web Audio API: no audio files, no network.
 * A slow chord pad, a few soft notes and a gentle echo. Each part of the game has its own mood, and the music
 * glides from one to the next. It ducks under the narrator and (in the storm) grows a little with the radiation.
 * Silent and harmless where Web Audio is unavailable.
 */

export type Mood = "calm" | "focus" | "garden" | "storm";
export type SceneName = "start" | "age" | "map" | "briefing" | "systems" | "greenhouse" | "storm";

/** Which mood plays in which part of the game. */
export function moodForScene(scene: SceneName): Mood {
  switch (scene) {
    case "briefing":
    case "systems":
      return "focus";
    case "greenhouse":
      return "garden";
    case "storm":
      return "storm";
    default:
      return "calm";
  }
}

const mtof = (note: number) => 440 * Math.pow(2, (note - 69) / 12);

interface MoodSpec {
  /** Chords as MIDI notes, played in turn. */
  chords: number[][];
  /** Notes the soft plucks may use (MIDI). */
  scale: number[];
  /** Seconds between plucks (min, max). */
  pluckEvery: [number, number];
  /** Low-pass cutoff (Hz): lower is darker. */
  cutoff: number;
  /** Seconds each chord lasts. */
  chordSeconds: number;
  pad: number;
  pluck: number;
}

export const MOODS: Record<Mood, MoodSpec> = {
  // wide open, a little wistful: the mission map and the start screen
  calm: {
    chords: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 55, 60, 64], [55, 59, 62, 66]],
    scale: [69, 72, 74, 76, 79, 81],
    pluckEvery: [3, 6],
    cutoff: 1500,
    chordSeconds: 14,
    pad: 0.5,
    pluck: 0.22,
  },
  // steady and clear: Life Support and the briefings
  focus: {
    chords: [[50, 57, 62, 65], [48, 55, 60, 64], [46, 53, 58, 62], [48, 55, 60, 65]],
    scale: [62, 65, 67, 69, 72, 74],
    pluckEvery: [4, 8],
    cutoff: 1100,
    chordSeconds: 16,
    pad: 0.5,
    pluck: 0.16,
  },
  // brighter and softer, a little more movement: the greenhouse
  garden: {
    chords: [[60, 64, 67, 71], [57, 62, 66, 69], [55, 60, 64, 67], [62, 67, 71, 74]],
    scale: [72, 74, 76, 79, 81, 83],
    pluckEvery: [2, 4.5],
    cutoff: 2200,
    chordSeconds: 12,
    pad: 0.42,
    pluck: 0.26,
  },
  // low and dark but never harsh: the solar storm
  storm: {
    chords: [[40, 47, 52, 55], [36, 43, 48, 52], [45, 52, 57, 60], [43, 50, 55, 59]],
    scale: [52, 55, 57, 59, 62],
    pluckEvery: [5, 9],
    cutoff: 800,
    chordSeconds: 15,
    pad: 0.62,
    pluck: 0.12,
  },
};

const MASTER = 0.16;
const DUCKED = 0.35;

type Ctor = typeof AudioContext;
const audioCtor = (): Ctor | undefined =>
  typeof window === "undefined"
    ? undefined
    : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext);

export class AmbientEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private duck: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private echo: DelayNode | null = null;
  private pulse: GainNode | null = null;
  private chordTimer: number | undefined;
  private pluckTimer: number | undefined;
  private chordIndex = 0;
  private running = false;
  private mood: Mood = "calm";
  private intensity = 0;
  private ducked = false;

  get isRunning(): boolean {
    return this.running;
  }
  get currentMood(): Mood {
    return this.mood;
  }

  /** Starts (or resumes) the music. Call from a click or key press so the browser allows sound. */
  start(): void {
    if (this.running) return;
    const Ctx = audioCtor();
    if (!Ctx) return;
    try {
      if (!this.ctx) this.build(new Ctx());
      void this.ctx!.resume();
      this.running = true;
      this.fade(MASTER, 3);
      this.nextChord();
      this.nextPluck();
    } catch {
      this.running = false;
    }
  }

  /** Fades out and stops. */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    window.clearTimeout(this.chordTimer);
    window.clearTimeout(this.pluckTimer);
    this.fade(0.0001, 1.2);
    const ctx = this.ctx;
    window.setTimeout(() => {
      if (!this.running) void ctx?.suspend();
    }, 1500);
  }

  setMood(mood: Mood): void {
    if (mood === this.mood) return;
    this.mood = mood;
    if (this.filter && this.ctx) this.filter.frequency.setTargetAtTime(MOODS[mood].cutoff, this.ctx.currentTime, 1.5);
    if (this.running) {
      // let the new mood begin with the next chord change, sooner than usual
      window.clearTimeout(this.chordTimer);
      this.chordTimer = window.setTimeout(() => this.nextChord(), 600);
    }
  }

  /** 0..1. In the storm, a slow low pulse grows with it. Everywhere else it does nothing. */
  setIntensity(level: number): void {
    this.intensity = Math.max(0, Math.min(1, level));
    if (this.pulse && this.ctx) this.pulse.gain.setTargetAtTime(this.mood === "storm" ? this.intensity * 0.09 : 0, this.ctx.currentTime, 0.8);
  }

  /** Lowers the music while someone is speaking. */
  setDucked(on: boolean): void {
    this.ducked = on;
    if (this.duck && this.ctx) this.duck.gain.setTargetAtTime(on ? DUCKED : 1, this.ctx.currentTime, 0.3);
  }

  private build(ctx: AudioContext): void {
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.0001;
    const duck = ctx.createGain();
    duck.gain.value = this.ducked ? DUCKED : 1;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = MOODS[this.mood].cutoff;
    const echo = ctx.createDelay(1.5);
    echo.delayTime.value = 0.55;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.38;
    const wet = ctx.createGain();
    wet.gain.value = 0.45;
    filter.connect(duck);
    filter.connect(echo);
    echo.connect(feedback);
    feedback.connect(echo);
    echo.connect(wet);
    wet.connect(duck);
    duck.connect(master);
    master.connect(ctx.destination);
    // storm only: a slow low pulse that follows the radiation
    const pulse = ctx.createGain();
    pulse.gain.value = 0;
    const low = ctx.createOscillator();
    low.type = "sine";
    low.frequency.value = 55;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.22;
    const depth = ctx.createGain();
    depth.gain.value = 0.5;
    lfo.connect(depth);
    depth.connect(pulse.gain);
    low.connect(pulse);
    pulse.connect(duck);
    low.start();
    lfo.start();
    this.master = master;
    this.duck = duck;
    this.filter = filter;
    this.echo = echo;
    this.pulse = pulse;
  }

  private fade(to: number, seconds: number): void {
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(to, this.ctx.currentTime, seconds / 3);
  }

  private nextChord(): void {
    if (!this.running || !this.ctx || !this.filter) return;
    const spec = MOODS[this.mood];
    const chord = spec.chords[this.chordIndex % spec.chords.length]!;
    this.chordIndex += 1;
    const start = this.ctx.currentTime + 0.05;
    const hold = spec.chordSeconds;
    chord.forEach((note, i) => {
      for (const detune of [-5, 5]) {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = i === 0 ? "sine" : "triangle";
        osc.frequency.value = mtof(note);
        osc.detune.value = detune;
        const level = (i === 0 ? 0.16 : 0.08) * spec.pad;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(level, start + hold * 0.3);
        gain.gain.setValueAtTime(level, start + hold * 0.7);
        gain.gain.linearRampToValueAtTime(0.0001, start + hold + 3);
        osc.connect(gain);
        gain.connect(this.filter!);
        osc.start(start);
        osc.stop(start + hold + 3.2);
      }
    });
    this.chordTimer = window.setTimeout(() => this.nextChord(), hold * 1000);
  }

  private nextPluck(): void {
    if (!this.running) return;
    const spec = MOODS[this.mood];
    const [min, max] = spec.pluckEvery;
    this.pluckTimer = window.setTimeout(() => {
      this.pluckNow();
      this.nextPluck();
    }, (min + Math.random() * (max - min)) * 1000);
  }

  private pluckNow(): void {
    if (!this.running || !this.ctx || !this.filter) return;
    const spec = MOODS[this.mood];
    const note = spec.scale[Math.floor(Math.random() * spec.scale.length)]!;
    const t = this.ctx.currentTime + 0.02;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = mtof(note);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(spec.pluck * 0.35, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 3);
    osc.connect(gain);
    gain.connect(this.filter);
    osc.start(t);
    osc.stop(t + 3.1);
  }
}

/** The one music player for the whole game. */
export const ambient = new AmbientEngine();

const KEY = "moonatics:ambient";
export function readAmbientPreference(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}
export function writeAmbientPreference(on: boolean): void {
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* the choice then lasts for this visit only */
  }
}
