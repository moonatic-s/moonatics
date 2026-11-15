import type { Profile, Run } from "./profile";

export interface Context {
  run: Run;
  profile: Profile;
  overall: number | null;
}

export interface Patch {
  id: string;
  title: string;
  /** What it was earned for, in words a child can read. */
  why: string;
  earned: (c: Context) => boolean;
}

/** Mission patches: collected for things the child did, never for beating anyone. */
export const PATCHES: readonly Patch[] = [
  { id: "air-keeper", title: "Air Keeper", why: "Finished the Life Support mission.", earned: (c) => Boolean(c.run.facts.m1) },
  { id: "steady-hands", title: "Steady Hands", why: "Kept the habitat stable most of the time.", earned: (c) => Boolean(c.run.facts.m1 && c.run.facts.m1.stable / c.run.facts.m1.total >= 0.75) },
  { id: "green-thumb", title: "Green Thumb", why: "Grew a thriving tomato plant.", earned: (c) => Boolean(c.run.facts.m2 && c.run.facts.m2.cropHealthPct >= 78) },
  { id: "balanced-roots", title: "Balanced Roots", why: "Ended with the roots neither too dry nor too wet.", earned: (c) => Boolean(c.run.facts.m2?.rootOk) },
  { id: "storm-shield", title: "Storm Shield", why: "Got the crew through the solar storm.", earned: (c) => Boolean(c.run.facts.m3) },
  { id: "power-planner", title: "Power Planner", why: "Shared the emergency power across all three systems.", earned: (c) => Boolean(c.run.facts.m3?.plan && c.run.facts.m3.plan.cabinKw >= 3 && c.run.facts.m3.plan.greenhouseKw >= 2) },
  { id: "water-saver", title: "Water Saver", why: "Saved enough water to fill the shelter with water containers.", earned: (c) => Boolean(c.run.facts.m3 && c.run.facts.m3.shelter.water >= 2) },
  { id: "calm-crew", title: "Calm Crew", why: "The shelter held steady through the radiation peak.", earned: (c) => Boolean(c.run.facts.m3?.holding) },
  { id: "quick-learner", title: "Quick Learner", why: "Worked out all three mission-control questions.", earned: (c) => c.profile.solved.m1 && c.profile.solved.m2 && c.profile.solved.m3 },
  { id: "resource-saver", title: "Resource Saver", why: "Ran the whole training thriftily.", earned: (c) => (c.overall ?? 0) >= 75 },
  { id: "graduate", title: "Training Graduate", why: "Finished all three missions.", earned: (c) => c.profile.runsFinished > 0 },
];

export interface Card {
  id: string;
  title: string;
  /** A true statement, kept short. NASA facts say where they come from. */
  text: string;
  unlocked: (c: Context) => boolean;
}

/** Science cards: facts that unlock from doing the thing they explain. */
export const CARDS: readonly Card[] = [
  { id: "rr28", title: "Real cabin data", text: "The cabin readings in Mission 1 come from NASA's RR-28 record of the International Space Station: carbon dioxide, temperature and humidity.", unlocked: (c) => Boolean(c.run.facts.m1) },
  { id: "scrubbers", title: "What scrubbers do", text: "Scrubbers remove carbon dioxide from the cabin air. They use power, so every extra bit of scrubbing leaves less for everything else.", unlocked: (c) => Boolean(c.run.facts.m1) },
  { id: "veg05", title: "Tomatoes in space", text: "NASA's VEG-05 experiment grew Red Robin dwarf tomatoes in the Veggie plant chamber on the International Space Station.", unlocked: (c) => Boolean(c.run.facts.m2) },
  { id: "micro-water", title: "Water in microgravity", text: "In microgravity water does not drain down. It clings to roots and surfaces, so too much or too little both stress the plant.", unlocked: (c) => Boolean(c.run.facts.m2) },
  { id: "par", title: "What is PAR?", text: "PAR means photosynthetically active radiation: the light plants use to grow, roughly 400 to 700 nanometres.", unlocked: (c) => Boolean(c.run.facts.m2) },
  { id: "cme", title: "A cloud from the Sun", text: "A coronal mass ejection (CME) is a large eruption of solar material. NASA's DONKI logged one at 1,106 km/s on 8 June 2024.", unlocked: (c) => Boolean(c.run.facts.m3) },
  { id: "sep", title: "Fast particles", text: "Solar energetic particles can raise radiation in space. On 8 June 2024 a GOES instrument detected particles above 100 MeV at 02:25 UTC.", unlocked: (c) => Boolean(c.run.facts.m3) },
  { id: "water-shield", title: "Water as a shield", text: "Materials rich in hydrogen, like water, are good at slowing energetic particles. That is why water makes a smart shield.", unlocked: (c) => Boolean(c.run.facts.m3 && c.run.facts.m3.shelter.water >= 1) },
  { id: "crater", title: "Radiation at the Moon", text: "CRaTER is an instrument that measured radiation around the Moon. In this storm it peaked at about 20,368 micrograys per hour.", unlocked: (c) => Boolean(c.run.facts.m3) },
];
