import { useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Droplets, Leaf, LockKeyhole, Orbit, Rocket, ShieldCheck, Thermometer, Wind, Zap, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { content } from '@/game/content';
import { useGame, type MissionStatus } from '@/game/state';
import { cn } from '@/lib/utils';
export const missionIcons = [Wind, Leaf, ShieldCheck];
export function MissionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) { return <header className="mission-heading"><div className="eyebrow"><span className="signal-dot" />{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</header>; }
export function ResourceHUD() {
  const { resources } = useGame();
  const entries: { key: keyof typeof resources; icon: LucideIcon; className: string }[] = [{ key: 'power', icon: Zap, className: 'resource-power' }, { key: 'water', icon: Droplets, className: 'resource-water' }, { key: 'food', icon: Leaf, className: 'resource-food' }, { key: 'crewSafety', icon: ShieldCheck, className: 'resource-safety' }];
  return <aside className="resource-hud" aria-label={content.common.resources}><span className="hud-label">{content.common.resources}</span><div className="resource-list">{entries.map(({key, icon: Icon, className}) => <div className={cn('resource', className)} key={key}><Icon size={18}/><div><span>{content.resources[key]}</span><strong>{resources[key]}<small> / 100</small></strong></div><div className="resource-track"><span className="resource-fill" style={{ width: `${resources[key]}%` }} /></div></div>)}</div></aside>;
}
export function MissionProgress({ statuses: given }: { statuses?: MissionStatus[] }) { const { missionStatuses } = useGame(); const statuses = given ?? missionStatuses; return <nav className="mission-progress" aria-label="Mission progression">{content.missions.map((mission, i) => <div key={mission.id} className={cn('progress-step', `progress-${statuses[i]}`)} aria-current={statuses[i] === 'active' ? 'step' : undefined}><span className="progress-number">{statuses[i] === 'completed' ? <Check size={14}/> : statuses[i] === 'locked' ? <LockKeyhole size={12}/> : mission.number}</span><span>{mission.number} {mission.short}</span>{i < 2 && <ChevronRight className="progress-arrow" size={16}/>}</div>)}</nav>; }
export function BackButton({ onClick }: { onClick: () => void }) { return <Button variant="ghost" className="back-button" aria-label={content.common.back} onClick={onClick}><ArrowLeft size={18}/><span>BACK</span></Button>; }
export function AgeModeSelector() {
  const { ageMode, setAgeMode, setScene } = useGame();
  return <><div className="age-options">{(['explorer', 'specialist'] as const).map((mode, i) => { const data = content.ageSelection[mode]; const Icon = i === 0 ? Rocket : Orbit; return <Button variant="outline" className={cn('age-card', ageMode === mode && 'age-selected')} key={mode} onClick={() => setAgeMode(mode)} aria-pressed={ageMode === mode}><div className="age-card-top"><span className={cn('age-illustration', i === 1 && 'specialist-illustration')}><Icon size={54} strokeWidth={1.4}/></span><span className="selection-indicator">{ageMode === mode && <Check size={16}/>}</span></div><span className="eyebrow">{data.ages}</span><h2>{data.name}</h2><p>{data.description}</p><span className="age-detail">{data.detail}</span></Button>; })}</div><Button className="mission-cta" disabled={!ageMode} onClick={() => setScene('map')}>{content.common.continue}<ArrowRight size={20}/></Button></>;
}
export function MissionCard({ index, onSelect }: { index: number; onSelect: () => void }) {
  const mission = content.missions[index]; const Icon = missionIcons[index]; if (!mission || !Icon) return null;
  const { missionStatuses, justUnlocked, clearUnlocked } = useGame(); const locked = missionStatuses[index] === 'locked'; const done = missionStatuses[index] === 'completed'; const unlocking = justUnlocked === index;
  // The card plays its unlock animation once, then the celebration is cleared.
  useEffect(() => { if (!unlocking) return; const t = window.setTimeout(clearUnlocked, 3600); return () => window.clearTimeout(t); }, [unlocking, clearUnlocked]);
  return <Button variant="outline" className={cn('mission-card', locked && 'mission-locked', unlocking && 'mission-unlocking')} disabled={locked} onClick={onSelect}><div className="mission-card-top"><span className="mission-icon"><Icon size={24}/></span><span className={cn('mission-state', locked ? 'state-locked' : 'state-ready')}>{locked ? <LockKeyhole size={11}/> : <span className="signal-dot"/>}{locked ? content.common.locked : done ? content.results.completed : content.common.ready}</span></div><span className="mission-location">{mission.location}</span><h2><span>{mission.number}</span>{mission.title}</h2><p>{mission.description}</p><div className="mission-card-bottom">{locked ? content.common.locked : content.common.select}{locked ? <LockKeyhole size={16}/> : <ArrowRight size={20}/>}</div></Button>;
}
export function MissionBriefing() {
  const { ageMode, setScene } = useGame(); const icons = [Wind, Thermometer, Droplets];
  return <><MissionHeader eyebrow={content.lifeSupport.eyebrow} title={content.lifeSupport.title} description={content.lifeSupport.description}/><div className="concept-grid">{content.lifeSupport.concepts.map((concept, i) => { const Icon = icons[i]; return <div className="concept" key={concept.title}><span className={`concept-icon concept-${i}`}>{Icon && <Icon size={34} strokeWidth={1.5}/>}</span><span className="eyebrow">{concept.name}</span><h2>{concept.title}</h2><p>{ageMode === 'specialist' ? concept.specialist : concept.description}</p></div>; })}</div><Button className="mission-cta" onClick={() => setScene('systems')}>{content.lifeSupport.start}<ArrowRight size={20}/></Button><p className="crew-caption"><ShieldCheck size={15}/>{content.lifeSupport.crew}</p></>;
}
