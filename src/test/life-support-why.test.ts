import { describe, expect, it } from "vitest";
import {
  createGameState,
  getLifeSupportBreakdown,
  updateLifeSupportControls,
} from "@/game/engine";
import {
  explainCo2,
  explainHumidity,
  explainTemperature,
} from "@/game/life-support/why";

const why = (levers: Parameters<typeof updateLifeSupportControls>[1]) =>
  getLifeSupportBreakdown(updateLifeSupportControls(createGameState(), levers));

describe("Explorer why sentences", () => {
  it("name the one lever that matters, in plain words", () => {
    expect(explainCo2(why({ airFiltration: 100 }))).toMatch(
      /cleaning the air/i,
    );
    expect(explainCo2(why({ airFiltration: 0 }))).toMatch(/too low/i);
    expect(explainTemperature(why({ climateControl: 0 }))).toMatch(/warm/i);
    expect(explainTemperature(why({ climateControl: 100 }))).toMatch(/cool/i);
    expect(explainHumidity(why({ waterRecovery: 100 }))).toMatch(
      /water recycler pulls water/i,
    );
    expect(explainHumidity(why({ waterRecovery: 0 }))).toMatch(
      /more moisture stays/i,
    );
  });

  it("say things are steady at the NASA baseline", () => {
    const baseline = why({});
    expect(explainCo2(baseline)).toMatch(/match/i);
    expect(explainTemperature(baseline)).toMatch(/steady/i);
    expect(explainHumidity(baseline)).toMatch(/steady/i);
  });
});
