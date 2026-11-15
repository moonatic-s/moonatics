import { Award, BookOpen, Lock, Star } from "lucide-react";
import { useGame, type AgeMode } from "@/game/state";
import { efficiencyOf, starsOf } from "@/game/story/evidence";
import type { MissionKey } from "@/game/story/profile";
import { CARDS, PATCHES } from "@/game/story/collection";
import { GOAL_TEXT } from "@/game/story/copy";
import { GOALS, type GoalId } from "@/game/story/profile";
import { cn } from "@/lib/utils";

export function Stars({ value }: { value: number }) {
  return (
    <span className="stars" role="img" aria-label={`${value} of 3 stars`}>
      {[1, 2, 3].map((i) => (
        <Star key={i} size={18} className={cn(i <= value && "on")} aria-hidden="true" />
      ))}
    </span>
  );
}

/** How thriftily this mission was run, as stars. It rewards spending less, even when everything still passed. */
export function EfficiencyLine({ mission }: { mission: MissionKey }) {
  const { story } = useGame();
  const e = efficiencyOf(mission, story.run.facts, story.run.supplyDropUsed);
  if (e === null) return null;
  return (
    <p className="eff-line">
      <span>Resource efficiency</span> <Stars value={starsOf(e)} /> <b>{e}%</b>
      {story.run.supplyDropUsed && <small> · supply drop used</small>}
    </p>
  );
}

/** Three filled dots at best. A way to see growth, not a grade. */
export function Dots({ level, label }: { level: number; label: string }) {
  return (
    <span className="dots" role="img" aria-label={`${label}: ${level} of 3`}>
      {[1, 2, 3].map((i) => (
        <i key={i} className={cn(i <= level && "on")} />
      ))}
    </span>
  );
}

/** What the child has learned, shown as skills. Used by the crew log and the training-complete screen. */
export function Skills({ levels, best }: { levels?: Record<GoalId, number>; best?: Record<GoalId, number> }) {
  return (
    <ul className="skills">
      {GOALS.map((g) => {
        const now = levels?.[g] ?? best?.[g] ?? 0;
        return (
          <li key={g}>
            <div>
              <b>{GOAL_TEXT[g].title}</b>
              <p>{GOAL_TEXT[g].text}</p>
            </div>
            <Dots level={now} label={GOAL_TEXT[g].title} />
          </li>
        );
      })}
    </ul>
  );
}

export function PatchGrid({ earned, fresh = [] }: { earned: string[]; fresh?: string[] }) {
  return (
    <ul className="patches" aria-label="Mission patches">
      {PATCHES.map((p) => {
        const has = earned.includes(p.id);
        return (
          <li key={p.id} className={cn("patch", has ? "patch-on" : "patch-off", fresh.includes(p.id) && "patch-new")}>
            <span className="patch-badge" aria-hidden="true">
              {has ? <Award size={22} /> : <Lock size={18} />}
            </span>
            <b>{has ? p.title : "???"}</b>
            <p>{has ? p.why : "Keep playing to find out."}</p>
          </li>
        );
      })}
    </ul>
  );
}

export function CardGrid({ unlocked }: { unlocked: string[] }) {
  return (
    <ul className="cards" aria-label="Science cards">
      {CARDS.map((c) => {
        const has = unlocked.includes(c.id);
        return (
          <li key={c.id} className={cn("sci", has ? "sci-on" : "sci-off")}>
            <b>
              {has ? <BookOpen size={14} aria-hidden="true" /> : <Lock size={14} aria-hidden="true" />} {has ? c.title : "Locked card"}
            </b>
            <p>{has ? c.text : "Unlocks when you try the thing it explains."}</p>
          </li>
        );
      })}
    </ul>
  );
}

/** The crew log: everything the child has collected. Personal bests only; nobody else's. */
export function CrewLog({ mode }: { mode: AgeMode }) {
  const { story, setScene } = useGame();
  const p = story.profile;
  return (
    <section className="log" aria-label="Crew log">
      <h2 className="log-title">CREW LOG</h2>
      <p className="log-sub">{mode === "explorer" ? "Everything you have collected. Keep playing to fill it!" : "Your patches, science cards and best results across every run."}</p>
      <div className="log-bests">
        <span>
          <b>{p.runsFinished}</b> training{p.runsFinished === 1 ? "" : "s"} finished
        </span>
        <span>
          Best resource efficiency <b>{p.bestEfficiency}%</b>
        </span>
        <span>
          <b>{p.patches.length}</b>/{PATCHES.length} patches
        </span>
        <span>
          <b>{p.cards.length}</b>/{CARDS.length} science cards
        </span>
      </div>
      <h3>WHAT YOU HAVE LEARNED</h3>
      <Skills best={p.bestSkills} />
      <h3>MISSION PATCHES</h3>
      <PatchGrid earned={p.patches} />
      <h3>SCIENCE CARDS</h3>
      <CardGrid unlocked={p.cards} />
      <button type="button" className="log-back" onClick={() => setScene("map")}>
        BACK TO THE MISSION MAP
      </button>
    </section>
  );
}
