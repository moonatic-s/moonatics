import { useEffect, useRef, useState } from 'react';
import { ArrowRight, AudioLines, Check, Crosshair, Globe2, Leaf, LockKeyhole, Moon, Orbit, Rocket, ShieldCheck, Volume2, VolumeX, Wind } from 'lucide-react';
import lunarBase from '@/assets/lunar-base.jpg';
import { Button } from '@/components/ui/button';
import { content } from '@/game/content';
import { GameProvider, useGame } from '@/game/state';
import { AgeModeSelector, BackButton, MissionBriefing, MissionCard, MissionHeader, MissionProgress, ResourceHUD } from './mission-ui';
import { LifeSupportSim } from './life-support-sim';
import { GreenhouseScene } from './greenhouse-scene';
import { StormScene } from './storm-scene';
import { Comms } from './cast';
import { CrewLog } from './crew-log';
import { LivingOutpost } from './outpost';
import { TrainingComplete } from './training-complete';
import { MAP_GREETING, pick as pickText } from '@/game/story/copy';
import { UnlockToast } from './unlock-toast';
import { installSfx } from '@/game/audio/sfx';
import { ambient, moodForScene, readAmbientPreference, writeAmbientPreference } from '@/game/audio/ambient';
/** The music button: ambient music for every part of the game. It starts on the first tap or key press (browsers require one) unless it was switched off. */
function AmbientControl() {
  const [enabled, setEnabled] = useState(readAmbientPreference);
  useEffect(() => {
    if (!enabled) { ambient.stop(); return; }
    const begin = () => { ambient.start(); };
    if (ambient.isRunning) return;
    window.addEventListener('pointerdown', begin, { once: true });
    window.addEventListener('keydown', begin, { once: true });
    return () => { window.removeEventListener('pointerdown', begin); window.removeEventListener('keydown', begin); };
  }, [enabled]);
  function toggle() {
    const next = !enabled;
    writeAmbientPreference(next);
    setEnabled(next);
    if (next) ambient.start(); else ambient.stop();
  }
  return <Button variant="ghost" size="icon" className="sound-control" title={enabled ? content.common.soundOff : content.common.soundOn} aria-label={enabled ? content.common.soundOff : content.common.soundOn} aria-pressed={enabled} onClick={toggle}>{enabled ? <Volume2/> : <VolumeX/>}</Button>;
}
function GameShell() {
  const { scene, setScene, ageMode, setAgeMode, resetProgress, missionStatuses, justUnlocked, story } = useGame();
  // Mission 2 is not on the map yet: this link opens its briefing for review (e.g. /#greenhouse).
  useEffect(() => { const hash = window.location.hash; if (hash === '#storm' || hash === '#storm-specialist') { setAgeMode(hash === '#storm' ? 'explorer' : 'specialist'); setScene('storm'); } else if (hash === '#greenhouse' || hash === '#greenhouse-specialist') { setAgeMode(hash === '#greenhouse' ? 'explorer' : 'specialist'); setScene('greenhouse'); } else if (hash === '#reset') { resetProgress(); window.history.replaceState(null, '', window.location.pathname); } }, [setAgeMode, setScene, resetProgress]);
  // Every button, switch and slider gets its small interface sound.
  useEffect(() => installSfx(), []);
  // Each part of the game has its own mood of music.
  useEffect(() => { ambient.setMood(moodForScene(scene)); }, [scene]);
  const start = scene === 'start';
  const back = () => setScene(scene === 'age' ? 'start' : scene === 'map' ? 'age' : scene === 'briefing' || scene === 'greenhouse' || scene === 'storm' || scene === 'log' || scene === 'complete' ? 'map' : 'briefing');
  return <main className={`game-shell scene-${scene}`}><img className="lunar-background" src={lunarBase} width={1920} height={1088} alt="Moon Base Alpha, with connected lunar habitats, a greenhouse, and Earth above the Moon"/><div className="scene-shade"/><div className="ambient-star star-one"/><div className="ambient-star star-two"/>
    <header className="game-topbar"><Button variant="ghost" className="brand-mark" onClick={() => setScene('start')} aria-label={content.common.home}><span className="brand-symbol"><Orbit size={24}/></span><span>{content.brand}<small>MISSION CONTROL</small></span></Button><div className="topbar-right"><span className="base-online"><span className="signal-dot"/>{content.start.location}</span>{ageMode && !start && <span className="mode-chip">{content.ageSelection[ageMode].name}</span>}<AmbientControl/></div></header>
    <UnlockToast/>
    <div className="scene-content" key={scene}>
    {start ? <section className="start-scene"><div className="start-copy"><div className="eyebrow start-eyebrow"><span className="eyebrow-line"/>{content.start.eyebrow}</div><h1>{content.brand}<span className="title-dot">.</span></h1><h2>{content.subtitle}</h2><p className="start-tagline">{content.start.tagline}<br/><span>{content.start.taglineEnd}</span></p><Button className="mission-cta start-cta" onClick={() => setScene('age')}><Rocket size={20}/>{content.start.begin}<ArrowRight size={20}/></Button><div className="start-details"><span><Orbit size={15}/>{content.start.missionCount}</span><span className="detail-divider"/><span>{content.start.ageRange}</span></div></div><div className="start-bottom"><span><Globe2 size={16}/>{content.start.footer}</span><span className="surface-coordinates">LUNAR SURFACE <span>25.9° N / 0.0° E</span></span></div></section> : <>
      <div className="scene-toolbar"><BackButton onClick={back}/><span className="scene-stage">{scene === 'age' ? '01 / CREW REGISTRATION' : scene === 'map' ? '02 / MISSION SELECTION' : scene === 'complete' ? '04 / TRAINING COMPLETE' : scene === 'log' ? 'CREW LOG' : scene === 'storm' ? '03 / STORM SHELTER' : scene === 'greenhouse' ? '03 / GREENHOUSE MODULE' : '03 / HABITAT MODULE'}</span></div>
      {scene === 'age' && <section className="center-scene age-scene"><MissionHeader eyebrow={content.ageSelection.eyebrow} title={content.ageSelection.title} description={content.ageSelection.description}/><AgeModeSelector/></section>}
      {scene === 'map' && <section className="map-scene"><MissionHeader eyebrow={content.missionMap.eyebrow} title={content.missionMap.title} description={content.missionMap.description}/><div className="map-area"><span className="map-label"><Crosshair size={14}/>{content.missionMap.mapLabel}</span>{[['pin-life', Wind, '01'], ['pin-food', Leaf, '02'], ['pin-radiation', ShieldCheck, '03']].map(([cls, Icon, num], i) => { const PinIcon = Icon as typeof Wind; const st = missionStatuses[i]; return <div key={cls as string} className={`map-pin ${cls as string} ${st === 'locked' ? 'pin-locked' : st === 'completed' ? 'pin-done' : 'pin-open'} ${justUnlocked === i ? 'pin-unlocking' : ''}`}><PinIcon size={20}/>{st === 'locked' ? <LockKeyhole size={12}/> : st === 'completed' ? <Check size={12}/> : <span>{num as string}</span>}</div>; })}<span className="map-connection"><span className="signal-dot"/>{content.missionMap.baseStatus}</span></div><div className="mission-cards">{content.missions.map((mission, i) => <MissionCard key={mission.id} index={i} onSelect={() => setScene(i === 1 ? 'greenhouse' : i === 2 ? 'storm' : 'briefing')}/>)}</div><div className="map-extras"><Comms who="luna">{pickText(MAP_GREETING, ageMode ?? 'explorer').join(' ')}</Comms><LivingOutpost compact facts={story.run.facts} done={[missionStatuses[0] === 'completed', missionStatuses[1] === 'completed', missionStatuses[2] === 'completed']}/><div className="map-buttons"><Button variant="outline" onClick={() => setScene('log')}>CREW LOG</Button>{missionStatuses[2] === 'completed' && <Button variant="outline" onClick={() => setScene('complete')}>TRAINING RECORD</Button>}</div></div></section>}
      {scene === 'briefing' && <section className="center-scene briefing-scene"><MissionBriefing/></section>}
      {scene === 'systems' && <section className="center-scene systems-scene sim-scene"><LifeSupportSim/></section>}
      {scene === 'greenhouse' && <GreenhouseScene/>}
      {scene === 'storm' && <StormScene/>}
      {scene === 'log' && <section className="center-scene log-scene"><CrewLog mode={ageMode ?? 'explorer'}/></section>}
      {scene === 'complete' && <section className="center-scene log-scene"><TrainingComplete mode={ageMode ?? 'explorer'}/></section>}
      {scene !== 'age' && <footer className="game-footer"><ResourceHUD/><MissionProgress/></footer>}
    </>}
    </div>{start && <div className="training-strip"><span className="training-caption">{content.start.training}</span><div>{content.missions.map((mission, i) => <span key={mission.id}><span className="strip-number">{mission.number}</span>{mission.title}{i < 2 && <ArrowRight size={16}/>}</span>)}</div><Moon size={19}/></div>}
  </main>;
}
export function Moonatics() { return <GameProvider><GameShell/></GameProvider>; }
