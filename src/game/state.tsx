import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { clearProgress, freshProgress, loadProgress, mergeProgress, saveProgress, type BriefingKey, type Progress } from '@/game/progress';
import { AGE_MODE_TO_BAND, createGameState, type CarryOver, retryAct, setAgeBand, stepMission, toHudResources, updateLifeSupportControls, type Act1Controls, type GameState as SimState, type LightPreset, type PowerSystem, type SepAllocation, type ShieldItem, advanceStormPhase, applySupplyDrop, dismissFlrStatic, rerouteStormPower, setCmeDecision, setSepPowerAllocation, setShelterMaterials, startStormMission } from '@/game/engine';
import { refreshStory } from '@/game/story/evidence';
import { freshProfile, freshRun, freshStory, mergeStory, type Facts, type MissionKey, type Story } from '@/game/story/profile';
import { advanceGreenhouseSim, beginGreenhouseSim, setLightSim, setWaterRungSim } from '@/game/greenhouse/model';
/** The last step the player took, kept so the console can show what changed. */
export interface StepRecap { before: SimState; after: SimState }
export type AgeMode = 'explorer' | 'specialist';
export type Scene = 'start' | 'age' | 'map' | 'briefing' | 'systems' | 'greenhouse' | 'storm' | 'log' | 'complete';
/** Something the child just earned: shown once as a small celebration. */
export interface Reward { kind: 'patch' | 'card'; id: string }
export type MissionStatus = 'active' | 'completed' | 'locked';
export const initialResources = { power: 100, water: 100, food: 50, crewSafety: 100 };
export const initialMissionStatuses: MissionStatus[] = ['active', 'locked', 'locked'];
export const ageRanges = { explorer: [7, 9], specialist: [10, 12] } as const;
/** A mission can be opened once it is unlocked (active) and stays open after it is completed, so it can be replayed. */
export function canOpenMission(index: number, statuses: MissionStatus[] = initialMissionStatuses) { const s = statuses[index]; return s === 'active' || s === 'completed'; }
/** Completing a mission marks it done and unlocks the next one. Locked missions cannot be completed; nothing else changes. */
export function markMissionComplete(statuses: MissionStatus[], index: number): MissionStatus[] {
  if (statuses[index] === undefined || statuses[index] === 'locked') return statuses;
  const next = statuses.slice();
  next[index] = 'completed';
  if (next[index + 1] === 'locked') next[index + 1] = 'active';
  return next.every((s, i) => s === statuses[i]) ? statuses : next;
}
interface GameState { scene: Scene; setScene: (scene: Scene) => void; ageMode: AgeMode | null; setAgeMode: (mode: AgeMode) => void; resources: typeof initialResources; sim: SimState; missionStatuses: MissionStatus[]; completeMission: (index: number) => void; story: Story; rewards: Reward[]; clearRewards: () => void; updateStory: (fn: (s: Story) => Story) => void; recordFacts: (patch: Partial<Facts>) => void; noteEarthRead: () => void; noteBriefingFinished: () => void; noteDetailsViewed: () => void; answerReflection: (key: MissionKey, solved: boolean) => void; answerRecall: (key: 'm2' | 'm3') => void; markSupplyDropUsed: () => void; finishTraining: () => void; startNewRun: () => void; callSupplyDrop: () => void; justUnlocked: number | null; clearUnlocked: () => void; briefingsSeen: Progress['briefingsSeen']; results: Progress['results']; recordResult: (act: 1 | 2, carry: CarryOver) => void; markBriefingSeen: (key: BriefingKey) => void; resetProgress: () => void; recap: StepRecap | null; setLifeSupportControls: (patch: Partial<Act1Controls>) => void; stepSim: () => void; retrySim: () => void; resetSim: () => void; beginGreenhouse: () => void; setWaterRung: (rung: number) => void; setLightRecipe: (preset: LightPreset) => void; advanceGreenhouse: () => void; beginStorm: () => void; setShelter: (slots: (ShieldItem | null)[]) => void; setArrays: (retract: boolean) => void; setStormPower: (alloc: Partial<SepAllocation>) => void; shiftStormPower: (system: PowerSystem, delta: number) => void; nextStormPhase: () => void; clearFlrStatic: () => void; rerouteStorm: (from: PowerSystem, to: PowerSystem) => void; }
const GameContext = createContext<GameState | null>(null);
/** `initialSim` lets tests and tools start a screen from a mid-mission state. */
export function GameProvider({ children, initialSim, initialStatuses }: { children: ReactNode; initialSim?: SimState; initialStatuses?: MissionStatus[] }) {
  const [scene, setScene] = useState<Scene>('start');
  const [ageMode, setAgeModeState] = useState<AgeMode | null>(null);
  const [core, setCore] = useState<{ sim: SimState; recap: StepRecap | null }>(() => ({ sim: initialSim ?? createGameState(), recap: null }));
  const { sim, recap } = core;
  const [missionStatuses, setMissionStatuses] = useState<MissionStatus[]>(initialStatuses ?? initialMissionStatuses);
  const [briefingsSeen, setBriefingsSeen] = useState(freshProgress().briefingsSeen);
  const [results, setResults] = useState(freshProgress().results);
  const resultsRef = useRef(results);
  resultsRef.current = results;
  /** What a finished mission handed on (battery, water, cabin air, crop). The newest result replaces the old one. */
  const recordResult = useCallback((act: 1 | 2, carry: CarryOver) => setResults(r => (act === 1 ? { ...r, act1: carry } : { ...r, act2: carry })), []);
  /** The mission that has just opened, so the map card and a toast can celebrate it once. */
  const [justUnlocked, setJustUnlocked] = useState<number | null>(null);
  const statusesRef = useRef(missionStatuses);
  statusesRef.current = missionStatuses;
  const completeMission = useCallback((index: number) => { const cur = statusesRef.current; const next = markMissionComplete(cur, index); if (next === cur) return; setMissionStatuses(next); if (cur[index + 1] === 'locked' && next[index + 1] === 'active') setJustUnlocked(index + 1); }, []);
  const clearUnlocked = useCallback(() => setJustUnlocked(null), []);
  /** Everything the story keeps: patches, science cards, best skills (the profile) and this attempt's facts (the run). Rewards are noticed when they appear. */
  const [story, setStory] = useState<Story>(freshStory);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const prevStory = useRef(story);
  const updateStory = useCallback((fn: (s: Story) => Story) => setStory(s => refreshStory(fn(s))), []);
  useEffect(() => {
    const prev = prevStory.current; prevStory.current = story;
    if (!loaded.current) return;
    const added: Reward[] = [...story.profile.patches.filter(p => !prev.profile.patches.includes(p)).map(id => ({ kind: 'patch' as const, id })), ...story.profile.cards.filter(c => !prev.profile.cards.includes(c)).map(id => ({ kind: 'card' as const, id }))];
    if (added.length) setRewards(r => [...r, ...added]);
  }, [story]);
  const clearRewards = useCallback(() => setRewards([]), []);
  const recordFacts = useCallback((patch: Partial<Facts>) => updateStory(s => ({ ...s, run: { ...s.run, facts: { ...s.run.facts, ...patch } } })), [updateStory]);
  const noteEarthRead = useCallback(() => updateStory(s => ({ ...s, run: { ...s.run, facts: { ...s.run.facts, earthRead: Math.min(20, s.run.facts.earthRead + 1) } } })), [updateStory]);
  const noteBriefingFinished = useCallback(() => updateStory(s => ({ ...s, run: { ...s.run, facts: { ...s.run.facts, briefingsFinished: Math.min(20, s.run.facts.briefingsFinished + 1) } } })), [updateStory]);
  const noteDetailsViewed = useCallback(() => updateStory(s => (s.run.facts.detailsViewed ? s : { ...s, run: { ...s.run, facts: { ...s.run.facts, detailsViewed: true } } })), [updateStory]);
  const answerReflection = useCallback((key: MissionKey, solved: boolean) => updateStory(s => ({ profile: { ...s.profile, solved: { ...s.profile.solved, [key]: s.profile.solved[key] || solved } }, run: { ...s.run, answered: { ...s.run.answered, [key]: solved } } })), [updateStory]);
  const answerRecall = useCallback((key: 'm2' | 'm3') => updateStory(s => ({ ...s, run: { ...s.run, recalled: { ...s.run.recalled, [key]: true } } })), [updateStory]);
  const markSupplyDropUsed = useCallback(() => updateStory(s => ({ ...s, run: { ...s.run, supplyDropUsed: true } })), [updateStory]);
  const finishTraining = useCallback(() => updateStory(s => s.run.finished ? s : { profile: { ...s.profile, runsFinished: s.profile.runsFinished + 1 }, run: { ...s.run, finished: true } }), [updateStory]);
  const markBriefingSeen = useCallback((key: BriefingKey) => setBriefingsSeen(s => (s[key] ? s : { ...s, [key]: true })), []);
  /** Progress lives in the browser. It is read after the first paint (so server and browser agree), merged forward only, then saved on every change. */
  const persist = initialStatuses === undefined;
  const loaded = useRef(false);
  useEffect(() => {
    if (!persist) return;
    const saved = loadProgress();
    setMissionStatuses(s => mergeProgress({ ...freshProgress(), missions: s }, saved).missions);
    setBriefingsSeen(s => mergeProgress({ ...freshProgress(), briefingsSeen: s }, saved).briefingsSeen);
    setResults(r => mergeProgress({ ...freshProgress(), results: r }, saved).results);
    setStory(s => { const m = refreshStory(mergeStory(s, saved.story)); prevStory.current = m; return m; });
    loaded.current = true;
  }, [persist]);
  useEffect(() => { if (persist && loaded.current) saveProgress({ missions: missionStatuses, briefingsSeen, results, story }); }, [persist, missionStatuses, briefingsSeen, results, story]);
  const resetProgress = useCallback(() => { clearProgress(); setMissionStatuses(initialMissionStatuses); setBriefingsSeen(freshProgress().briefingsSeen); setResults(freshProgress().results); setStory(freshStory()); }, []);
  /** Play the training again: missions, results and this attempt's facts start over. Patches, cards and best scores stay. */
  const startNewRun = useCallback(() => { setMissionStatuses(initialMissionStatuses); setResults(freshProgress().results); setStory(s => ({ profile: s.profile, run: freshRun() })); setCore(c => ({ sim: createGameState({ ageBand: c.sim.meta.ageBand }), recap: null })); setScene('map'); }, []);
  const setAgeMode = useCallback((mode: AgeMode) => { setAgeModeState(mode); setCore(c => ({ ...c, sim: setAgeBand(c.sim, AGE_MODE_TO_BAND[mode]) })); }, []);
  const setLifeSupportControls = useCallback((patch: Partial<Act1Controls>) => setCore(c => ({ ...c, sim: updateLifeSupportControls(c.sim, patch) })), []);
  const stepSim = useCallback(() => setCore(c => { const next = stepMission(c.sim); return next === c.sim ? c : { sim: next, recap: { before: c.sim, after: next } }; }), []);
  const retrySim = useCallback(() => setCore(c => ({ sim: retryAct(c.sim), recap: null })), []);
  const resetSim = useCallback(() => setCore(c => ({ sim: createGameState({ ageBand: c.sim.meta.ageBand }), recap: null })), []);
  const storyRef2 = useRef(story);
  storyRef2.current = story;
  /** The once-per-run supply drop. */
  const callSupplyDrop = useCallback(() => { if (storyRef2.current.run.supplyDropUsed) return; setCore(c => ({ ...c, sim: applySupplyDrop(c.sim) })); markSupplyDropUsed(); }, [markSupplyDropUsed]);
  /** Mission 2: the greenhouse runs on the same engine state, so the HUD bars stay live. Every change keeps a recap for the resource chips. */
  const beginGreenhouse = useCallback(() => setCore(c => ({ sim: beginGreenhouseSim(c.sim, resultsRef.current.act1), recap: null })), []);
  const setWaterRung = useCallback((rung: number) => setCore(c => ({ ...c, sim: setWaterRungSim(c.sim, rung) })), []);
  const setLightRecipe = useCallback((preset: LightPreset) => setCore(c => ({ ...c, sim: setLightSim(c.sim, preset) })), []);
  const advanceGreenhouse = useCallback(() => setCore(c => { const next = advanceGreenhouseSim(c.sim); return next === c.sim ? c : { sim: next, recap: { before: c.sim, after: next } }; }), []);
  /** Mission 3: the storm runs on the same engine state, started from the saved results of Missions 1 and 2. */
  const beginStorm = useCallback(() => setCore(c => ({ sim: startStormMission(c.sim, undefined, resultsRef.current.act1, resultsRef.current.act2), recap: null })), []);
  const setShelter = useCallback((slots: (ShieldItem | null)[]) => setCore(c => ({ ...c, sim: setShelterMaterials(c.sim, slots) })), []);
  const setArrays = useCallback((retract: boolean) => setCore(c => ({ ...c, sim: setCmeDecision(c.sim, retract) })), []);
  const setStormPower = useCallback((alloc: Partial<SepAllocation>) => setCore(c => ({ ...c, sim: setSepPowerAllocation(c.sim, alloc) })), []);
  const shiftStormPower = useCallback((system: PowerSystem, delta: number) => setCore(c => ({ ...c, sim: setSepPowerAllocation(c.sim, { [system]: c.sim.controls.act3.sepPowerAlloc[system] + delta }) })), []);
  const nextStormPhase = useCallback(() => setCore(c => ({ ...c, sim: advanceStormPhase(c.sim) })), []);
  const clearFlrStatic = useCallback(() => setCore(c => ({ ...c, sim: dismissFlrStatic(c.sim) })), []);
  const rerouteStorm = useCallback((from: PowerSystem, to: PowerSystem) => setCore(c => ({ ...c, sim: rerouteStormPower(c.sim, from, to) })), []);
  /** HUD bars come from the engine, so every screen shows the same live numbers. */
  const resources = toHudResources(sim);
  return <GameContext.Provider value={{ scene, setScene, ageMode, setAgeMode, resources, sim, missionStatuses, completeMission, story, rewards, clearRewards, updateStory, recordFacts, noteEarthRead, noteBriefingFinished, noteDetailsViewed, answerReflection, answerRecall, markSupplyDropUsed, finishTraining, startNewRun, callSupplyDrop, justUnlocked, clearUnlocked, briefingsSeen, results, recordResult, markBriefingSeen, resetProgress, recap, setLifeSupportControls, stepSim, retrySim, resetSim, beginGreenhouse, setWaterRung, setLightRecipe, advanceGreenhouse, beginStorm, setShelter, setArrays, setStormPower, shiftStormPower, nextStormPhase, clearFlrStatic, rerouteStorm }}>{children}</GameContext.Provider>;
}
export function useGame() { const context = useContext(GameContext); if (!context) throw new Error('Game UI requires GameProvider'); return context; }
