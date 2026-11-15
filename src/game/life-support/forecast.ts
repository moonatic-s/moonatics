/** Heads-up lines for the "Next 6 hours" panel. Pure, so the wording is testable. */
import { content } from "@/game/content";
import type { GameState } from "@/game/engine";

const copy = content.lifeConsole;
const CHANNEL_TO_ZONE = {
  air: "co2",
  heat: "temperature",
  water: "humidity",
} as const;

/** One line for every reading that is safe now but won't be after the next step, plus any failure it would cause. */
export function forecastWarnings(
  now: GameState,
  later: GameState | null,
): string[] {
  if (!later) return [];
  const warnings: string[] = [];
  if (later.meta.failed && later.meta.failure) {
    warnings.push(
      later.meta.failure.code === "POWER_BLACKOUT"
        ? copy.forecast.blackout
        : `${later.meta.failure.title}. Change a lever before you advance.`,
    );
  }
  (["air", "heat", "water"] as const).forEach((channel) => {
    const zone = CHANNEL_TO_ZONE[channel];
    const safeNow = now.subSystems.cabin.zones[zone] === "SAFE";
    const safeLater = later.subSystems.cabin.zones[zone] === "SAFE";
    const thing = copy.forecast.thingNames[channel];
    if (safeNow && !safeLater) warnings.push(copy.forecast.leaving(thing));
    if (!safeNow && !safeLater) warnings.push(copy.forecast.staying(thing));
  });
  return warnings;
}

/** True when every cabin reading is inside its safe zone right now. */
export function allReadingsSafe(state: GameState): boolean {
  const z = state.subSystems.cabin.zones;
  return z.co2 === "SAFE" && z.temperature === "SAFE" && z.humidity === "SAFE";
}
