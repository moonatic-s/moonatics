/**
 * Plain-language "why is this reading what it is?" sentences for Explorer mode.
 * Specialist mode shows NASA's value next to the simulated value instead of a sentence.
 * Pure functions over the engine breakdown, so wording can change without touching the simulation.
 */
import { content } from "@/game/content";
import type { getLifeSupportBreakdown } from "@/game/engine";

type Breakdown = ReturnType<typeof getLifeSupportBreakdown>;

const copy = content.lifeConsole.why.explorer;

export function explainCo2(b: Breakdown): string {
  const effect = b.effects.co2Ppm.scrubbers;
  if (effect <= -150) return copy.co2.cleaning;
  if (effect >= 150) return copy.co2.building;
  return copy.co2.steady;
}

export function explainTemperature(b: Breakdown): string {
  const effect = b.effects.temperatureDegC.thermostat;
  if (effect >= 0.7) return copy.temperature.warming;
  if (effect <= -0.7) return copy.temperature.cooling;
  return copy.temperature.steady;
}

export function explainHumidity(b: Breakdown): string {
  const { thermostat, recycler } = b.effects.humidityPct;
  if (recycler <= -1.5) return copy.humidity.recyclerDrying;
  if (recycler >= 1.5) return copy.humidity.recyclerOff;
  if (thermostat <= -1.5) return copy.humidity.coldDrying;
  return copy.humidity.steady;
}
