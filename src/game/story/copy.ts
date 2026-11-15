import type { AgeMode } from "@/game/state";
import type { Facts, GoalId, MissionKey } from "./profile";

type Both<T> = { explorer: T; specialist: T };
export const pick = <T,>(v: Both<T>, mode: AgeMode): T => v[mode];

/** The two voices of the game. Everything the game says comes from one of them. */
export const CAST = {
  luna: { id: "luna", name: "CAPCOM Luna", role: "Mission control" },
  nova: { id: "nova", name: "Nova", role: "Crew astronaut" },
} as const;
export type Speaker = keyof typeof CAST;

export const GOAL_TEXT: Record<GoalId, { title: string; text: string }> = {
  warning: { title: "Using the warning", text: "A solar event gives a warning, and the crew used it to prepare." },
  shielding: { title: "Shielding", text: "Material around the crew reduces how much radiation gets in." },
  limited: { title: "Limited resources", text: "Water and power run out, so every choice has a cost." },
  prioritise: { title: "Sharing power", text: "When there is not enough for everything, power goes where it matters most." },
  earlier: { title: "Earlier choices", text: "What you did in earlier missions changed what you had later." },
  nasa: { title: "NASA data and simulation", text: "NASA measured what really happened. The game simulates what your choices would do." },
};

/** Space weather notes from mission control: the storm is foreshadowed before it arrives. These are mission-control notes, not NASA data. */
export const TICKER: Record<"m1" | "m2" | "m3", Both<string>> = {
  m1: {
    explorer: "Luna: The Sun is quiet today. Good day to learn the habitat.",
    specialist: "CAPCOM Luna: Space weather is quiet. No solar events expected during this shift.",
  },
  m2: {
    explorer: "Luna: The Sun is getting busier. Our space-weather team is keeping a close eye on it.",
    specialist: "CAPCOM Luna: Our space-weather team is watching a growing sunspot group. Stay ready for a solar event.",
  },
  m3: {
    explorer: "Luna: This is the Sun activity we told you about. Time to use your training!",
    specialist: "CAPCOM Luna: This is the active sunspot group we have been watching. Time to use your training.",
  },
};

export const MAP_GREETING: Both<string[]> = {
  explorer: ["Welcome back to Moon Base Alpha! I'm Luna, your mission control.", "Nova is waiting at the outpost. Pick a mission and let's go."],
  specialist: ["Welcome back to Moon Base Alpha. CAPCOM Luna here.", "Nova is on station. Select a mission to continue the training."],
};

export interface EarthMessage {
  from: string;
  question: Both<string>;
  answer: Both<string>;
}
export const EARTH: Record<MissionKey, EarthMessage> = {
  m1: {
    from: "Lena, a student on Earth",
    question: { explorer: "Why can't the crew just open a window to get fresh air?", specialist: "Why can't the crew just open a window? How does the outpost keep its air breathable?" },
    answer: {
      explorer: "There are no windows to open on the Moon! The air is used again and again. Scrubbers take out the carbon dioxide, and every system costs power, just like you saw.",
      specialist: "The Moon has no air outside, so the habitat recycles its own. Scrubbers remove carbon dioxide, but every system draws from a limited power budget, which is why you had to balance them.",
    },
  },
  m2: {
    from: "Omar, a student on Earth",
    question: { explorer: "Do tomatoes grow the same way in space as at home?", specialist: "Do plants really grow differently in microgravity? What did NASA have to watch for?" },
    answer: {
      explorer: "Almost! But in space water doesn't drain down. It sticks to the roots. That's why the VEG-05 crew had to watch the water so carefully.",
      specialist: "In microgravity water does not drain down; it clings to roots and surfaces. In NASA's VEG-05 the crew faced both drying and excess water, which is the balance you managed.",
    },
  },
  m3: {
    from: "Sofia, a student on Earth",
    question: { explorer: "Why can't a spaceship just hide from a solar storm?", specialist: "Why can't a habitat just avoid a solar storm? What protects the crew?" },
    answer: {
      explorer: "On the Moon there's no thick air to help. So the crew puts material around themselves. And real storms give a warning, so there's time to get ready.",
      specialist: "The Moon has no atmosphere to absorb particles, so shielding material around the crew does the work. Solar events also give hours of warning, which is time to prepare.",
    },
  },
};

export interface ChoiceQuestion {
  kind: "choice";
  goal: GoalId;
  q: Both<string>;
  options: Both<string[]>;
  correct: number;
  why: Both<string>;
}
export interface SortQuestion {
  kind: "sort";
  goal: GoalId;
  q: Both<string>;
  items: { label: string; side: 0 | 1 }[];
  sides: [string, string];
  why: Both<string>;
}
export type Question = ChoiceQuestion | SortQuestion;

/** Two-option questions (and one with three, as written for Mission 2) in both age versions. */
const choice = (
  goal: GoalId,
  q: [string, string],
  options: [string[], string[]],
  correct: number,
  why: [string, string],
): ChoiceQuestion => ({
  kind: "choice",
  goal,
  q: { explorer: q[0], specialist: q[1] },
  options: { explorer: options[0], specialist: options[1] },
  correct,
  why: { explorer: why[0], specialist: why[1] },
});
const sort = (
  goal: GoalId,
  q: [string, string],
  sides: [string, string],
  items: [string, 0 | 1][],
  why: [string, string],
): SortQuestion => ({
  kind: "sort",
  goal,
  q: { explorer: q[0], specialist: q[1] },
  items: items.map(([label, side]) => ({ label, side })),
  sides,
  why: { explorer: why[0], specialist: why[1] },
});

const MC = "Mission control question: ";
const QUICK = "Quick one: ";

/**
 * Questions after each mission. There are several per mission; which one a child gets depends on how many times
 * they have finished the training, so playing again asks something different. Every question is answered (no skipping);
 * a wrong answer gets the explanation and the answer, never a mark.
 */
export const REFLECTIONS: Record<MissionKey, Question[]> = {
  m1: [
    choice("limited", [MC + "if you turn the air scrubbers all the way up, what happens to the power budget?", MC + "if scrubber power is raised to maximum, what happens to the net power budget?"],
      [["Less power is left", "More power is left"], ["Net power drops", "Net power rises"]], 0,
      ["Every system costs power. More scrubbing means less power for everything else.", "Each system draws from the same limited supply, so raising one lowers what is left for the rest."]),
    choice("nasa", [MC + "do the cabin readings in Mission 1 come from real NASA data?", MC + "where do the Mission 1 cabin readings (CO\u2082, temperature, humidity) come from?"],
      [["No, they are all made up", "Yes, from the International Space Station"], ["Random numbers made for the game", "NASA's RR-28 record of the International Space Station"]], 1,
      ["The readings are real data from the International Space Station. What your levers do to them is simulated.", "RR-28 is real ISS cabin data replayed in the game. The effect of your levers is simulated."]),
    choice("limited", [MC + "what do the scrubbers take out of the air?", MC + "what do CO\u2082 scrubbers remove from the cabin air?"],
      [["Carbon dioxide", "Water"], ["Oxygen", "Carbon dioxide"]], 0,
      ["Scrubbers take out carbon dioxide, the gas we breathe out.", "Scrubbers remove carbon dioxide (CO\u2082), the gas the crew breathes out. They run on power."]),
    choice("limited", [MC + "when you press Advance, what happens?", MC + "what moves time forward in Mission 1?"],
      [["Six hours of habitat time pass", "A timer runs out"], ["A real-time countdown", "Pressing Advance, six hours at a time"]], 0,
      ["Time only moves when you press the button. There is no timer, so there is no rush.", "Time only advances when you press Advance. There is no countdown."]),
  ],
  m2: [
    choice("nasa", ["NASA grew real tomatoes in space. In this game, what decides how YOUR plant does?", "NASA's VEG-05 measured real plants. In MOONATICS, which one does NOT decide how your plant does? (These are things you can manage here.)"],
      [["Luck", "Power", "Water"], ["Manage Water", "Choose Light", "Radiation"]], 2,
      ["Water decides it: too little or too much stresses the plant. Your plant is a simulation, so your choices matter.", "Radiation does not directly affect the plant here. Water and light are the things you manage in the greenhouse."]),
    choice("nasa", [MC + "where does water go when you water a plant in space?", MC + "in microgravity, what happens to water around the roots?"],
      [["It sticks to the roots", "It falls to the floor"], ["It drains away downward", "It clings to roots and surfaces"]], 0,
      ["In space water does not fall down. It sticks to the roots.", "In microgravity water does not drain down. It clings to roots and surfaces."]),
    choice("limited", [MC + "what can too much water do to the plant?", MC + "too much water in the root zone can\u2026"],
      [["Always make it grow faster", "Stress the roots"], ["Leave less air for the roots", "Give the roots extra oxygen"]], 1,
      ["Too much water stresses the roots. More is not always better. Balance matters.", "Water around the roots leaves less room for air. More is not always better."]),
    choice("nasa", [MC + "which two light recipes did NASA test on the space tomatoes?", MC + "VEG-05 compared which two light treatments?"],
      [["Red-rich and blue-rich", "Green-rich and yellow-rich"], ["90% red and 10% blue, and 50% red and 50% blue", "100% red and 100% blue"]], 0,
      ["NASA compared a red-rich light and a blue-rich light.", "VEG-05 compared a red-rich recipe (90% red, 10% blue) with a blue-rich recipe (50% red, 50% blue)."]),
    choice("nasa", [MC + "is the tomato plant in the game a real plant?", MC + "your plant's result in MOONATICS is\u2026"],
      [["Yes, a real plant on the Station", "No, it is a simulation of your choices"], ["A NASA measurement of your plant", "A simulation based on your decisions"]], 1,
      ["The plant in the game is a simulation. NASA measured real plants; the game shows what your choices would do.", "NASA's data is what was observed. Your plant's outcome is simulated from your own decisions."]),
  ],
  m3: [
    sort("shielding", [MC + "which things SHIELD the crew, and which just RUN systems?", MC + "sort each item by what it does: block radiation, or run a system."], ["SHIELDS", "RUNS SYSTEMS"],
      [["Water container", 0], ["Supply pack", 0], ["Life support power", 1], ["Grow-light power", 1]],
      ["Material around the crew shields them. Power only runs systems.", "Shielding is physical material that attenuates radiation. Power operates systems and does not change attenuation."]),
    sort("nasa", [MC + "which of these did NASA observe, and which does the game simulate?", MC + "sort each item: observed by NASA, or simulated by MOONATICS."], ["NASA OBSERVED", "SIMULATED"],
      [["The M9.7 solar flare", 0], ["Radiation outside, from CRaTER", 0], ["Crew exposure in your shelter", 1], ["Your water containers", 1]],
      ["NASA measured the flare and the radiation outside. The game works out what it would do to your crew and your shelter.", "The flare and the CRaTER readings are observations. Crew exposure and your shelter's contents are simulated from your choices."]),
    sort("shielding", [MC + "which of these protect the crew, and which just keep things running?", MC + "sort each item: it shields, or it runs a system."], ["SHIELDS", "RUNS SYSTEMS"],
      [["Equipment pack", 0], ["Water container", 0], ["Ventilation fans", 1], ["Radiation monitors", 1]],
      ["Packs and water around the crew shield them. Fans and monitors need power to run.", "Material attenuates radiation. Fans and monitors are systems that run on power."]),
    sort("warning", [MC + "which of these is a warning, and which is a way to prepare?", MC + "sort each item: a warning sign, or a preparation."], ["WARNING", "PREPARATION"],
      [["A solar flare is detected", 0], ["A CME is observed", 0], ["Fill the shelter with material", 1], ["Share the emergency power", 1]],
      ["The flare and the CME are early warnings. Filling the shelter and sharing power is how the crew prepares.", "Solar events give warning; the crew uses the time to prepare the shelter and the power."]),
  ],
};

/** A quick look back at the start of the next mission. Two options each; also rotates with each new training. */
export const RECALLS: Record<"m2" | "m3", ChoiceQuestion[]> = {
  m2: [
    choice("limited", [QUICK + "when you turn a system up, what does it cost?", "Quick recall from Mission 1: what does turning a system up cost the outpost?"],
      [["Power", "Nothing"], ["Power from a shared budget", "Nothing"]], 0,
      ["Every system costs power, and there is only so much.", "All systems share one limited power budget."]),
    choice("limited", [QUICK + "what do scrubbers take out of the air?", "Quick recall: what do scrubbers remove from the cabin air?"],
      [["Water", "Carbon dioxide"], ["Carbon dioxide", "Nitrogen"]], 1,
      ["Scrubbers take out carbon dioxide.", "Scrubbers remove carbon dioxide (CO\u2082) from the cabin air."]),
    choice("limited", [QUICK + "who decides when time moves forward?", "Quick recall: what moved time forward in Mission 1?"],
      [["You, by pressing Advance", "A countdown timer"], ["A real-time countdown", "Pressing Advance"]], 0,
      ["Time only moves when you press the button.", "Time advanced only when you pressed Advance."]),
    choice("nasa", [QUICK + "the cabin numbers in Mission 1 came from\u2026", "Quick recall: the Mission 1 cabin data came from\u2026"],
      [["Real NASA data from the Space Station", "A guess made for the game"], ["A random generator", "NASA's RR-28 record of the ISS"]], 0,
      ["The readings are real data from the International Space Station.", "The readings come from NASA's RR-28 record of the International Space Station."]),
  ],
  m3: [
    choice("limited", [QUICK + "what can too much water do to the plant?", "Quick recall from Mission 2: what can too much water do in microgravity?"],
      [["Stress the roots", "Always help the plant"], ["Stress the roots and leave less air", "Always improve growth"]], 0,
      ["More is not always better. Balance matters.", "Water clings around roots and leaves less air for them. Balance matters."]),
    choice("nasa", [QUICK + "which two light recipes did NASA test?", "Quick recall: which two light treatments did VEG-05 compare?"],
      [["Blue-rich and green-rich", "Red-rich and blue-rich"], ["Red-rich and blue-rich", "Green-rich and yellow-rich"]], 1,
      ["NASA tested a red-rich and a blue-rich light.", "VEG-05 compared red-rich and blue-rich light."]),
    choice("nasa", [QUICK + "where does water go in space?", "Quick recall: how does water behave around roots in microgravity?"],
      [["It sticks to the roots", "It falls to the floor"], ["It drains away", "It clings to roots and surfaces"]], 0,
      ["In space water does not fall. It sticks to the roots.", "Water does not drain down in microgravity. It clings to roots and surfaces."]),
    choice("limited", [QUICK + "when the cabin air got dry, what happened to the plant pillow?", "Quick recall: dry cabin air made the plant pillow\u2026"],
      [["It dried out faster", "It got wetter"], ["Hold more water", "Dry out faster"]], 0,
      ["Dry air dries the plant pillow out faster, so the plant needs more water.", "Dry cabin air dried the pillow faster, which is why the plant needed more water."]),
  ],
};

/** Which question this training gets: every finished training moves on to the next one, so playing again asks something new. */
export function pickQuestion<T>(pool: readonly T[], trainingsFinished: number): T {
  return pool[((trainingsFinished % pool.length) + pool.length) % pool.length]!;
}

const n = (x: number) => Math.round(x);

/** The epilogue: the child's own decisions, replayed as cause and effect. */
export function epilogue(facts: Facts, mode: AgeMode): string[] {
  const out: string[] = [];
  const { m1, m2, m3 } = facts;
  const spec = mode === "specialist";
  if (m1) out.push(spec ? `In Mission 1 you kept the habitat stable at ${m1.stable} of ${m1.total} checkpoints, with ${n(m1.batteryPct)}% battery left.` : `In Mission 1 you kept the air stable ${m1.stable} times out of ${m1.total}.`);
  if (m2) out.push(spec ? `In Mission 2 you finished with ${m2.waterLiters.toFixed(1)} L of water and ${m2.ripe} ripe tomatoes.` : `In Mission 2 you grew ${m2.ripe} ripe tomatoes and kept some water.`);
  if (m3) {
    const w = m3.inventory.water;
    out.push(w > 0 ? `Because you kept ${m2 ? `${m2.waterLiters.toFixed(1)} L of` : "some"} water, the shelter had ${w} water container${w === 1 ? "" : "s"}.` : "Because the water ran low, the shelter had no water containers. That is why earlier choices matter.");
    out.push(`Your ${m2?.ripe ?? 0} ripe tomatoes became ${m3.inventory.supply} supply pack${m3.inventory.supply === 1 ? "" : "s"}.`);
    out.push(m3.arraysProtected ? "You folded the solar arrays away, so they stayed safe." : "You kept the solar arrays open for extra power, and they took a little wear.");
    if (m3.plan) out.push(m3.plan.cabinKw >= 3 ? "Life support got enough power, so the air stayed steady." : "Life support was short of power, so the air got stuffy.");
    out.push(m3.holding ? "The shelter held through the radiation peak. Nova felt safe." : "The shelter had thin shielding, so the exposure rose. More material would help next time.");
  }
  return out;
}
