/** Soft, short mission-control chimes made with the Web Audio API (no audio files). Silent if audio is unavailable. */

type Kind = "start" | "done" | "alert";
const NOTES: Record<Kind, number[]> = {
  start: [523.25, 783.99], // C5, G5: "systems online"
  done: [783.99, 1046.5], // G5, C6: "ready"
  alert: [659.25, 523.25], // E5, C5: a small, gentle "heads up" (not an alarm)
};

let ctx: AudioContext | null = null;

export function playChime(kind: Kind): void {
  try {
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtor) return;
    ctx ??= new AudioCtor();
    void ctx.resume();
    const t0 = ctx.currentTime + 0.02;
    NOTES[kind].forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      const start = t0 + i * 0.16;
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.06, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(start);
      osc.stop(start + 0.65);
    });
  } catch {
    /* audio is optional */
  }
}
