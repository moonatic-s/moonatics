import { Droplets, Scale, Wind, Zap, type LucideIcon } from "lucide-react";
import { content } from "@/game/content";
import { ACT1_CHECKPOINTS, type GameState } from "@/game/engine";
import {
  BADGE_IDS,
  evaluateBadges,
  type BadgeId,
} from "@/game/life-support/badges";
import type { GuideMessage } from "@/game/life-support/guide";
import { cn } from "@/lib/utils";

const copy = content.lifeConsole;

/** Compact helmeted guide with a speech bubble. Updates in place and never covers the controls. */
export function MissionGuide({ message }: { message: GuideMessage }) {
  return (
    <div className="guide" data-tone={message.tone}>
      <svg
        className="guide-avatar"
        viewBox="0 0 48 48"
        role="img"
        aria-label={copy.guide.name}
      >
        <circle className="guide-helmet" cx="24" cy="24" r="20" />
        <path
          className="guide-visor"
          d="M12 24 a12 11 0 0 1 24 0 v3 a12 9 0 0 1 -24 0 z"
        />
        <path className="guide-glint" d="M17 20 q3 -4 8 -4" />
        <rect
          className="guide-patch"
          x="20"
          y="40"
          width="8"
          height="5"
          rx="1.5"
        />
      </svg>
      <p
        key={message.text}
        className="guide-bubble"
        role="status"
        aria-live="polite"
      >
        <span className="guide-name">{copy.guide.name}</span>
        {message.text}
      </p>
    </div>
  );
}

/** Mission title, one-line goal and progress through the NASA data. Progress dots, not a countdown. */
export function ObjectiveStrip({
  done,
  total,
  stable,
  required,
}: {
  done: number;
  total: number;
  stable: number;
  required: number;
}) {
  const o = copy.objective;
  return (
    <div className="objective">
      <p className="objective-badge">{o.badge}</p>
      <h1 className="objective-title">{o.title}</h1>
      <p className="objective-text">{o.description}</p>
      <div className="objective-progress">
        <div
          className="objective-dots"
          role="progressbar"
          aria-label={o.progress}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
        >
          {Array.from({ length: total || ACT1_CHECKPOINTS }, (_, i) => (
            <span
              key={i}
              className={cn("objective-dot", i < done && "objective-dot-done")}
            />
          ))}
        </div>
        <span className="objective-step">
          {o.step(Math.min(done + 1, total), total)}
        </span>
        <span className="objective-stable">{o.stable(stable, required)}</span>
      </div>
    </div>
  );
}

const BADGE_ICONS: Record<BadgeId, LucideIcon> = {
  AIR_KEEPER: Wind,
  POWER_SAVER: Zap,
  BALANCE_MASTER: Scale,
  WATER_WATCHER: Droplets,
};

/** Mission patches earned so far. Visual only. */
export function BadgeRow({
  history,
}: {
  history: GameState["meta"]["act1History"];
}) {
  const earned = evaluateBadges(history);
  return (
    <ul className="badges" aria-label={copy.badges.title}>
      {BADGE_IDS.map((id) => {
        const Icon = BADGE_ICONS[id];
        const info = copy.badges[id];
        return (
          <li
            key={id}
            className={cn("badge-patch", earned[id] && "badge-earned")}
            title={earned[id] ? info.how : copy.badges.locked}
          >
            <span className="badge-icon">
              <Icon size={16} />
            </span>
            <span className="badge-name">{info.name}</span>
            <span className="sr-only">
              {earned[id] ? `Earned: ${info.how}` : copy.badges.locked}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
