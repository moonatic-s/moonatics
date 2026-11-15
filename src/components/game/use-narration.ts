import { useCallback, useEffect, useRef, useState } from "react";
import { ambient } from "@/game/audio/ambient";
import type { AgeMode } from "@/game/state";

/**
 * Spoken narration for the briefing, using the browser's built-in speech synthesis.
 * No audio files and no network: the voice you hear depends on the device, and where speech is unavailable
 * everything still works silently, because the on-screen text carries the same meaning.
 */

const PREF_KEY = "moonatics:sound";

export function speechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

function readPreference(): boolean {
  try {
    return window.localStorage.getItem(PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

function writePreference(on: boolean) {
  try {
    window.localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch {
    /* private mode or blocked storage: the choice simply lasts for this visit */
  }
}

const chosen = new Map<string, SpeechSynthesisVoice>();

/** A clear, friendly English voice if the device has one; otherwise the browser default. Once chosen, the same voice is kept for every screen. */
function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const known = chosen.get(lang);
  if (known) return known;
  const family = lang.slice(0, 2).toLowerCase();
  const english = window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith(family));
  const friendly =
    /natural|neural|online|google us english|samantha|zira|aria|jenny|female/i;
  const voice =
    english.find((v) => friendly.test(v.name)) ??
    english.find((v) => v.lang === lang) ??
    english[0];
  if (voice) chosen.set(lang, voice);
  return voice;
}

/**
 * Browsers often load their voice list a moment after the page opens. Speaking before that picks the default voice,
 * and the next screen picks a different one, which sounds like the narrator keeps changing. So wait (briefly) for the list.
 */
function whenVoicesReady(run: () => void): void {
  const synth = window.speechSynthesis;
  if (synth.getVoices().length > 0 || typeof synth.addEventListener !== "function") return run();
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    synth.removeEventListener("voiceschanged", go);
    run();
  };
  synth.addEventListener("voiceschanged", go);
  window.setTimeout(go, 900);
}

export interface Narrator {
  supported: boolean;
  /** The player's sound choice: narration and the soft chimes. Remembered between visits. */
  soundOn: boolean;
  setSoundOn: (on: boolean) => void;
  /** Speak short lines one after another. `onLine` fires as each line starts, so visuals can follow the voice. */
  speak: (
    lines: readonly string[],
    mode: AgeMode,
    onLine?: (index: number) => void,
  ) => void;
  stop: () => void;
}

export function useNarrator(lang = "en-US"): Narrator {
  const supported = speechSupported();
  const [soundOn, setSound] = useState(readPreference);
  const token = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  const stop = useCallback(() => {
    token.current += 1;
    window.clearTimeout(timer.current);
    ambient.setDucked(false);
    if (speechSupported()) window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback(
    (
      lines: readonly string[],
      mode: AgeMode,
      onLine?: (index: number) => void,
    ) => {
      if (!speechSupported()) return;
      stop();
      const mine = token.current;
      // Some browsers drop a speak() issued in the same tick as cancel(), so start just after it.
      timer.current = window.setTimeout(() => whenVoicesReady(() => {
        if (mine !== token.current) return;
        const voice = pickVoice(lang);
        lines.forEach((text, i) => {
          const u = new SpeechSynthesisUtterance(text);
          u.lang = lang;
          if (voice) u.voice = voice;
          // Ages 7-9 get a slightly slower, brighter voice; ages 10-12 a natural pace.
          u.rate = mode === "explorer" ? 0.88 : 0.98;
          u.pitch = mode === "explorer" ? 1.15 : 1;
          u.onstart = () => {
            if (mine !== token.current) return;
            ambient.setDucked(true); // the music steps back while someone is speaking
            onLine?.(i);
          };
          if (i === lines.length - 1) {
            const release = () => {
              if (mine === token.current) ambient.setDucked(false);
            };
            u.onend = release;
            u.onerror = release;
          }
          window.speechSynthesis.speak(u);
        });
      }), 80);
    },
    [lang, stop],
  );

  const setSoundOn = useCallback(
    (on: boolean) => {
      setSound(on);
      writePreference(on);
      if (!on) stop();
    },
    [stop],
  );

  useEffect(() => stop, [stop]);

  return { supported, soundOn, setSoundOn, speak, stop };
}
