import * as SliderPrimitive from "@radix-ui/react-slider";
import {
  ArrowDown,
  ArrowUp,
  Droplet,
  Droplets,
  Thermometer,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { content } from "@/game/content";
import {
  ACT1_NEUTRAL_LEVEL,
  LIFE_SUPPORT_SAFE_ZONES,
  MISSION_FAILURE_LIMITS,
  type SafeZone,
} from "@/game/engine";
import { fmt } from "@/game/life-support/format";
import {
  leverHints,
  type ChannelKey,
  type HintTarget,
} from "@/game/life-support/interpret";
import type { AgeMode } from "@/game/state";
import { ScienceTerm, type ScienceTermKey } from "./science-term";

export type GaugeKind = "co2" | "temperature" | "humidity";

const copy = content.lifeConsole;
const SAFE = LIFE_SUPPORT_SAFE_ZONES;

/** Gauge scales. Zone edges come from the engine's own safe zones so the picture can never disagree with the rules. */
const GAUGES: Record<
  GaugeKind,
  {
    min: number;
    max: number;
    edges: [number, number];
    tones: [string, string, string];
    digits: number;
    safeText: string;
  }
> = {
  co2: {
    min: 400,
    max: Math.max(6000, MISSION_FAILURE_LIMITS.co2Ppm),
    edges: [SAFE.co2Ppm.safeMax, SAFE.co2Ppm.cautionMax],
    tones: ["safe", "caution", "high"],
    digits: 0,
    safeText: `up to ${fmt(SAFE.co2Ppm.safeMax, 0)} ppm`,
  },
  temperature: {
    min: 15,
    max: 31,
    edges: [SAFE.temperatureDegC.safeMin, SAFE.temperatureDegC.safeMax],
    tones: ["low", "safe", "high"],
    digits: 1,
    safeText: `${fmt(SAFE.temperatureDegC.safeMin, 1)}–${fmt(SAFE.temperatureDegC.safeMax, 1)} °C`,
  },
  humidity: {
    min: 24,
    max: 82,
    edges: [SAFE.relativeHumidityPct.safeMin, SAFE.relativeHumidityPct.safeMax],
    tones: ["low", "safe", "high"],
    digits: 1,
    safeText: `${fmt(SAFE.relativeHumidityPct.safeMin, 0)}–${fmt(SAFE.relativeHumidityPct.safeMax, 0)} %`,
  },
};

const position = (kind: GaugeKind, value: number) => {
  const g = GAUGES[kind];
  return `${Math.min(100, Math.max(0, ((value - g.min) / (g.max - g.min)) * 100))}%`;
};

/* ------------------------------- Gauge ------------------------------- */

/**
 * One reading, shown twice on purpose: what NASA actually observed, and what the player's habitat reads after their levers.
 * The bar marks the habitat now and in 6 hours against the mission safe zone (a training target, not an official limit).
 */
export function Gauge({
  kind,
  label,
  unit,
  mode,
  nasa,
  now,
  later,
  zone,
  laterZone,
}: {
  kind: GaugeKind;
  label: string;
  unit: string;
  mode: AgeMode;
  nasa: number;
  now: number;
  later: number | null;
  zone: SafeZone;
  laterZone: SafeZone | null;
}) {
  const g = GAUGES[kind];
  const spans = [
    g.edges[0] - g.min,
    g.edges[1] - g.edges[0],
    g.max - g.edges[1],
  ];
  const statusCopy = copy.status[kind] as Record<string, string>;
  const phrase = statusCopy[zone] ?? zone;
  const laterPhrase = laterZone ? (statusCopy[laterZone] ?? laterZone) : null;
  const labels = copy.zoneLabels[kind];
  const delta = Math.round((now - nasa) * 10 ** g.digits) / 10 ** g.digits;
  return (
    <div className="gauge" data-zone={zone.toLowerCase()}>
      <div className="gauge-values">
        <div className="value value-nasa">
          <span className="value-tag">
            {copy.values.nasa}
            <b className="value-badge badge-nasa">{copy.values.nasaBadge}</b>
          </span>
          <strong className="value-number">
            {fmt(nasa, g.digits)} <small>{unit}</small>
          </strong>
        </div>
        <div className="value value-habitat">
          <span className="value-tag">
            {copy.values.habitat}
            <b className="value-badge badge-sim">{copy.values.habitatBadge}</b>
          </span>
          {mode === "explorer" && (
            <strong className="gauge-phrase">{phrase}</strong>
          )}
          <strong
            className={
              mode === "explorer"
                ? "value-number value-number-small"
                : "value-number gauge-number"
            }
          >
            {fmt(now, g.digits)} <small>{unit}</small>
          </strong>
          {mode === "specialist" && (
            <span className="value-delta">
              {delta === 0
                ? "No change from your systems"
                : `${delta > 0 ? "+" : "−"}${fmt(Math.abs(delta), g.digits)} ${unit} from your systems`}
            </span>
          )}
        </div>
      </div>
      <div
        className="gauge-bar"
        role="img"
        aria-label={`${label}: NASA observed ${fmt(nasa, g.digits)} ${unit}. Your habitat ${fmt(now, g.digits)} ${unit}, ${phrase}${later !== null ? `. In 6 hours: ${fmt(later, g.digits)} ${unit}, ${laterPhrase}` : ""}`}
      >
        {spans.map((span, i) => (
          <span
            className={`gauge-zone zone-${g.tones[i]}`}
            style={{ flexGrow: span }}
            key={g.tones[i]! + i}
          >
            {mode === "explorer" && (
              <span className="zone-name">{labels[i]}</span>
            )}
          </span>
        ))}
        <span
          className="gauge-mark mark-nasa"
          style={{ left: position(kind, nasa) }}
        />
        {later !== null && (
          <span
            className="gauge-mark mark-later"
            style={{ left: position(kind, later) }}
          />
        )}
        <span
          className="gauge-mark mark-now"
          style={{ left: position(kind, now) }}
        />
      </div>
      <div className="gauge-legend" aria-hidden="true">
        <span>
          <i className="key-nasa" />
          NASA
        </span>
        <span>
          <i className="key-now" />
          {copy.markers.now}
        </span>
        {later !== null && (
          <span>
            <i className="key-later" />
            {copy.markers.later}
            {mode === "specialist"
              ? `: ${fmt(later, g.digits)} ${unit}`
              : laterPhrase && laterZone !== zone
                ? `: ${laterPhrase}`
                : ""}
          </span>
        )}
        {mode === "specialist" && (
          <span className="gauge-safe">
            {copy.values.safeZone}: {g.safeText}
          </span>
        )}
      </div>
    </div>
  );
}

/* -------------------------------- Lever ------------------------------- */

const HINT_ICONS: Record<HintTarget, LucideIcon> = {
  co2: Wind,
  power: Zap,
  humidity: Droplets,
  temperature: Thermometer,
  water: Droplet,
};

export function Lever({
  channel,
  name,
  value,
  mode,
  lowEnd,
  highEnd,
  science,
  onChange,
}: {
  channel: ChannelKey;
  name: string;
  value: number;
  mode: AgeMode;
  lowEnd: string;
  highEnd: string;
  science?: ScienceTermKey | undefined;
  onChange: (value: number) => void;
}) {
  const explorer = mode === "explorer";
  const shown = explorer ? Math.round(value / 25) * 25 : Math.round(value);
  const stops = copy.explorerStops;
  const hints = leverHints(channel, shown);
  return (
    <div className="lever">
      <div className="lever-head">
        <span className="lever-name">
          {name}
          {science && <ScienceTerm term={science} label={name} mode={mode} />}
        </span>
        <span className="lever-value">
          {explorer ? stops[Math.round(shown / 25)] : `${shown} %`}
        </span>
      </div>
      <div className="lever-hints" aria-live="polite">
        {hints.length === 0 ? (
          <span className="hint hint-neutral">{copy.hints.neutral}</span>
        ) : (
          hints.map((hint) => {
            const Icon = HINT_ICONS[hint.target];
            const Arrow = hint.dir === "up" ? ArrowUp : ArrowDown;
            const label = copy.hints.label[hint.target];
            const meaning = `${hint.slight ? `${copy.hints.slightly} ` : ""}${hint.dir === "up" ? copy.hints.up : copy.hints.down}`;
            return (
              <span
                className="hint"
                data-target={hint.target}
                key={hint.target}
                title={`${label} ${meaning}`}
              >
                <Icon size={13} aria-hidden="true" />
                <span>{label}</span>
                <Arrow size={13} aria-hidden="true" />
                <span className="sr-only">{meaning}</span>
                {hint.slight && (
                  <i className="hint-slight">{copy.hints.slightly}</i>
                )}
              </span>
            );
          })
        )}
      </div>
      <SliderPrimitive.Root
        className="lever-root"
        min={0}
        max={100}
        step={explorer ? 25 : 1}
        value={[shown]}
        onValueChange={([next]) => next !== undefined && onChange(next)}
      >
        <SliderPrimitive.Track className="lever-track">
          <SliderPrimitive.Range className="lever-fill" />
          <span
            className="lever-neutral"
            style={{ left: `${ACT1_NEUTRAL_LEVEL}%` }}
            aria-hidden="true"
          />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="lever-thumb" aria-label={name} />
      </SliderPrimitive.Root>
      <div className="lever-scale" aria-hidden="true">
        {explorer ? (
          stops.map((stop) => <span key={stop}>{stop}</span>)
        ) : (
          <>
            <span>{lowEnd}</span>
            <span className="lever-neutral-label">NASA baseline</span>
            <span>{highEnd}</span>
          </>
        )}
      </div>
    </div>
  );
}
