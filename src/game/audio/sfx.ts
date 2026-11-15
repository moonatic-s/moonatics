/**
 * Small interface sounds, made with the Web Audio API (no files): taps, switches, slider ticks, grabbing, snapping
 * things into place, gentle "no" sounds, confirmations and unlocks. They make actions feel physical.
 * They follow the same on/off choice as the music button, and stay silent where Web Audio is unavailable.
 */
import { readAmbientPreference } from "./ambient";

type Ctor = typeof AudioContext;
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
  if (!Ctx) return null;
  try {
    ctx ??= new Ctx();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

const enabled = () => readAmbientPreference();

interface Tone {
  from: number;
  to?: number;
  type?: OscillatorType;
  /** seconds */
  at?: number;
  length: number;
  gain: number;
}

function play(tones: Tone[], click = 0): void {
  if (!enabled()) return;
  const c = context();
  if (!c) return;
  try {
    const t0 = c.currentTime + 0.005;
    for (const t of tones) {
      const osc = c.createOscillator();
      const g = c.createGain();
      const start = t0 + (t.at ?? 0);
      osc.type = t.type ?? "sine";
      osc.frequency.setValueAtTime(t.from, start);
      if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, start + t.length);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(t.gain, start + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, start + t.length);
      osc.connect(g);
      g.connect(c.destination);
      osc.start(start);
      osc.stop(start + t.length + 0.02);
    }
    if (click > 0) {
      // a tiny burst of noise: the "mechanical" part of a click
      noise ??= (() => {
        const b = c.createBuffer(1, Math.floor(c.sampleRate * 0.03), c.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < d.length; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        return b;
      })();
      const src = c.createBufferSource();
      const hp = c.createBiquadFilter();
      const g = c.createGain();
      src.buffer = noise;
      hp.type = "highpass";
      hp.frequency.value = 2200;
      g.gain.value = click;
      src.connect(hp);
      hp.connect(g);
      g.connect(c.destination);
      src.start(t0);
    }
  } catch {
    /* sound is optional */
  }
}

let lastSlider = 0;

export const sfx = {
  /** An ordinary button. */
  tap: () => play([{ from: 520, to: 430, length: 0.06, gain: 0.05 }], 0.03),
  /** Choosing something (an option, an item, a toggle that stays pressed). */
  select: () => play([{ from: 880, type: "triangle", length: 0.05, gain: 0.05 }]),
  /** A physical two-position switch: up for on, down for off. */
  switchOn: () => play([{ from: 392, to: 587, length: 0.11, gain: 0.06 }], 0.07),
  switchOff: () => play([{ from: 587, to: 392, length: 0.11, gain: 0.06 }], 0.07),
  /** One notch of a slider; the pitch follows the value (0 to 1). */
  slider: (value: number) => {
    const now = performance.now();
    if (now - lastSlider < 35) return;
    lastSlider = now;
    play([{ from: 300 + Math.max(0, Math.min(1, value)) * 520, type: "triangle", length: 0.035, gain: 0.04 }]);
  },
  /** Picking something up to drag it. */
  grab: () => play([{ from: 190, to: 140, length: 0.09, gain: 0.07 }], 0.05),
  /** Something clicks into its place. */
  snap: () =>
    play(
      [
        { from: 660, to: 880, length: 0.1, gain: 0.06 },
        { from: 1320, type: "triangle", at: 0.04, length: 0.12, gain: 0.03 },
      ],
      0.08,
    ),
  /** Taking something back out. */
  pop: () => play([{ from: 520, to: 300, length: 0.09, gain: 0.05 }]),
  /** A soft "not there": gentle, never harsh. */
  reject: () => play([{ from: 230, to: 170, type: "triangle", length: 0.16, gain: 0.05 }]),
  /** A short burst of radio static: mission control keying the microphone. */
  radio: () => {
    if (!enabled()) return;
    const c = context();
    if (!c) return;
    try {
      const len = Math.floor(c.sampleRate * 0.14);
      const b = c.createBuffer(1, len, c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * Math.min(1, (len - i) / (len * 0.6));
      const src = c.createBufferSource();
      const band = c.createBiquadFilter();
      const g = c.createGain();
      src.buffer = b;
      band.type = "bandpass";
      band.frequency.value = 1800;
      band.Q.value = 0.8;
      g.gain.value = 0.05;
      src.connect(band);
      band.connect(g);
      g.connect(c.destination);
      src.start();
    } catch {
      /* sound is optional */
    }
  },
  /** The main button of a screen. */
  confirm: () =>
    play([
      { from: 523.25, length: 0.09, gain: 0.05 },
      { from: 659.25, at: 0.07, length: 0.09, gain: 0.05 },
      { from: 783.99, at: 0.14, length: 0.14, gain: 0.05 },
    ]),
  /** A new mission opens. */
  unlock: () =>
    play([
      { from: 523.25, length: 0.16, gain: 0.05 },
      { from: 659.25, at: 0.1, length: 0.16, gain: 0.05 },
      { from: 783.99, at: 0.2, length: 0.16, gain: 0.05 },
      { from: 1046.5, at: 0.3, length: 0.4, gain: 0.05 },
      { from: 1568, type: "triangle", at: 0.34, length: 0.45, gain: 0.02 },
    ]),
};

/**
 * Wires the sounds to the whole page at once, so every button, switch and slider gets one without being edited:
 * - clicks on switches, options, sockets and buttons;
 * - slider thumbs (watched through their value, so keyboard and pointer both count).
 * Parts that need to know the outcome (drag and drop) call `sfx` themselves and opt out with `data-nosfx`.
 * Returns a function that removes everything.
 */
export function installSfx(root: Document = document): () => void {
  const onClick = (e: Event) => {
    const el = (e.target as Element | null)?.closest<HTMLElement>('button, [role="switch"], [role="radio"]');
    if (!el || el.closest("[data-nosfx]") || (el as HTMLButtonElement).disabled) return;
    if (el.getAttribute("role") === "switch") {
      // the state flips after this click is handled, so read it a moment later
      window.setTimeout(() => (el.getAttribute("aria-checked") === "true" ? sfx.switchOn() : sfx.switchOff()), 0);
    } else if (el.classList.contains("sg-socket")) {
      window.setTimeout(() => (el.classList.contains("on") ? sfx.snap() : sfx.pop()), 0);
    } else if (el.matches("[data-primary], .mission-cta")) sfx.confirm();
    else if (el.hasAttribute("aria-pressed") || el.getAttribute("role") === "radio") sfx.select();
    else sfx.tap();
  };
  root.addEventListener("click", onClick, true);

  let observer: MutationObserver | undefined;
  if (typeof MutationObserver !== "undefined") {
    observer = new MutationObserver((records) => {
      for (const r of records) {
        const el = r.target as HTMLElement;
        if (el.getAttribute("role") !== "slider") continue;
        const min = Number(el.getAttribute("aria-valuemin") ?? 0);
        const max = Number(el.getAttribute("aria-valuemax") ?? 100);
        const v = Number(el.getAttribute("aria-valuenow") ?? min);
        sfx.slider(max > min ? (v - min) / (max - min) : 0);
      }
    });
    observer.observe(root.body, { subtree: true, attributes: true, attributeFilter: ["aria-valuenow"] });
  }
  return () => {
    root.removeEventListener("click", onClick, true);
    observer?.disconnect();
  };
}
