import {
  ArrowDown,
  ArrowUp,
  Droplets,
  Minus,
  Thermometer,
  Wind,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { content } from "@/game/content";
import type { ChangeRow, Trend, Verdict } from "@/game/life-support/interpret";
import type { AgeMode } from "@/game/state";
import { cn } from "@/lib/utils";

const copy = content.lifeConsole;
const ROW_ICONS: Record<ChangeRow["key"], LucideIcon> = {
  co2: Wind,
  temperature: Thermometer,
  humidity: Droplets,
  battery: Zap,
  tank: Droplets,
};
const TREND_ICON: Record<Trend, LucideIcon> = {
  up: ArrowUp,
  down: ArrowDown,
  flat: Minus,
};
const TREND_WORD: Record<Trend, string> = {
  up: "went up",
  down: "went down",
  flat: "stayed the same",
};

/** "6 hours later" results card. It collapses to a small chip so it never crowds the controls, and can be reopened. */
export function StepResult({
  mode,
  rows,
  verdict,
  open,
  onOpenChange,
}: {
  mode: AgeMode;
  rows: ChangeRow[];
  verdict: Verdict;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!open) {
    return (
      <Button
        variant="outline"
        className="changed-chip"
        onClick={() => onOpenChange(true)}
      >
        {copy.changed.reopen}
      </Button>
    );
  }
  return (
    <section
      className="changed"
      aria-label={copy.changed.title}
      data-tone={verdict.tone}
    >
      <header className="changed-head">
        <h2>{copy.changed.title}</h2>
        <Button
          variant="ghost"
          size="icon"
          className="changed-close"
          aria-label={copy.changed.hide}
          onClick={() => onOpenChange(false)}
        >
          <X size={16} />
        </Button>
      </header>
      <ul className="changed-rows">
        {rows.map((row) => {
          const Icon = ROW_ICONS[row.key];
          const Arrow = TREND_ICON[row.trend];
          return (
            <li
              key={row.key}
              className={cn("changed-row", `trend-${row.trend}`)}
            >
              <Icon size={16} aria-hidden="true" />
              <span className="changed-label">
                {copy.changed.rows[row.key]}
              </span>
              <Arrow size={16} aria-hidden="true" />
              <span className="sr-only">{TREND_WORD[row.trend]}</span>
              {mode === "specialist" && (
                <b className="changed-amount">
                  {row.trend === "flat" ? copy.changed.steady : row.amount}
                </b>
              )}
            </li>
          );
        })}
      </ul>
      <p className="changed-says">{verdict.text}</p>
    </section>
  );
}
