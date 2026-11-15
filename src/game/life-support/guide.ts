/**
 * What the junior mission guide says. One short line, chosen from the current situation,
 * so the bubble updates after every step or important lever change and never blocks play.
 */
import { content } from "@/game/content";
import { getAct1Objective, type GameState } from "@/game/engine";
import type { AgeMode } from "@/game/state";
import { latestCheer } from "./badges";
import { forecastWarnings } from "./forecast";

export type GuideKey =
  | "welcome"
  | "blackout"
  | "air"
  | "heat"
  | "water"
  | "leaving"
  | "draining"
  | "cheer"
  | "balanced"
  | "stable";

export interface GuideMessage {
  key: GuideKey;
  text: string;
  tone: "calm" | "alert" | "cheer";
}

export function guideMessage(
  mode: AgeMode,
  sim: GameState,
  forecast: GameState | null,
): GuideMessage {
  const g = content.lifeConsole.guide[mode];
  const { zones } = sim.subSystems.cabin;
  const { netKw } = sim.subSystems.power;
  const history = sim.meta.act1History;

  if (
    forecast?.meta.failed &&
    forecast.meta.failure?.code === "POWER_BLACKOUT"
  ) {
    return { key: "blackout", text: g.blackout, tone: "alert" };
  }
  if (zones.co2 !== "SAFE") return { key: "air", text: g.air, tone: "alert" };
  if (zones.temperature !== "SAFE")
    return { key: "heat", text: g.heat, tone: "alert" };
  if (zones.humidity !== "SAFE")
    return { key: "water", text: g.water, tone: "alert" };

  // Everything is safe right now: warn about what is about to change before celebrating.
  const leaving = forecastWarnings(sim, forecast).find((w) =>
    /will leave/.test(w),
  );
  if (leaving) {
    const thing = (["air", "heat", "water"] as const)
      .map((k) => content.lifeConsole.forecast.thingNames[k])
      .find((name) => leaving.includes(name));
    return {
      key: "leaving",
      text: g.leaving(thing ?? "a reading"),
      tone: "alert",
    };
  }
  if (netKw < 0) return { key: "draining", text: g.draining, tone: "alert" };

  if (history.length === 0)
    return { key: "welcome", text: g.welcome, tone: "calm" };

  const cheer = latestCheer(history);
  if (cheer) {
    const text =
      cheer.kind === "recovery"
        ? g.recovery
        : cheer.kind === "streak"
          ? g.streak(cheer.count)
          : g.efficient;
    return { key: "cheer", text, tone: "cheer" };
  }
  const { done, total } = getAct1Objective(sim);
  if (
    done < total &&
    sim.subSystems.power.demandKw <= sim.subSystems.power.generationKw * 0.9
  ) {
    return { key: "balanced", text: g.balanced, tone: "cheer" };
  }
  return { key: "stable", text: g.stable, tone: "calm" };
}
