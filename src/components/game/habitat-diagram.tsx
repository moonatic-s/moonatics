import type { SafeZone } from "@/game/engine";
import { cn } from "@/lib/utils";

export interface HabitatState {
  co2Zone: SafeZone;
  /** Air, temperature and humidity are all inside the mission safe zone. */
  stable: boolean;
  /** Air scrubber lever, 0-100. Above neutral the fans run harder and airflow lines appear. */
  scrubbers: number;
  batteryPct: number;
  netKw: number;
  tankPct: number;
}

const zoneTone = (zone: SafeZone) =>
  zone === "SAFE" ? "ok" : zone === "CAUTION" ? "warn" : "bad";

/**
 * A small lunar habitat that reacts to the simulation: airflow when scrubbers run hard, dim lights on low power,
 * an air-system lamp that follows CO₂, calm window glow when stable, and a water tank that drops. CSS/SVG only.
 */
export function HabitatDiagram({ state }: { state: HabitatState }) {
  const lowPower = state.batteryPct < 35 || state.netKw < -1;
  const airflow = state.scrubbers > 60;
  const tankFill = Math.max(0, Math.min(1, state.tankPct / 100));
  const tankH = 46 * tankFill;
  const summary = `Lunar habitat. Air system ${state.co2Zone === "SAFE" ? "normal" : "needs attention"}. Power ${lowPower ? "low" : "ok"}. Water tank ${Math.round(state.tankPct)} percent.`;
  return (
    <svg
      className={cn(
        "habitat",
        state.stable && "habitat-stable",
        lowPower && "habitat-dim",
      )}
      viewBox="0 0 360 200"
      role="img"
      aria-label={summary}
    >
      {/* lunar ground */}
      <ellipse className="hab-ground" cx="180" cy="176" rx="170" ry="16" />

      {/* solar power */}
      <g className="hab-solar" data-low={lowPower}>
        <line className="hab-wire" x1="92" y1="94" x2="128" y2="124" />
        <polygon className="hab-panel" points="24,72 96,60 104,92 32,104" />
        <path className="hab-panel-grid" d="M48 68 L56 100 M72 64 L80 96" />
        <path
          className="hab-bolt"
          d="M62 78 l-7 12 h6 l-3 10 l10 -14 h-6 l4 -8 z"
        />
        <text className="hab-label" x="64" y="124" textAnchor="middle">
          Solar power
        </text>
      </g>

      {/* air system */}
      <g className="hab-air" data-tone={zoneTone(state.co2Zone)}>
        <rect
          className="hab-module"
          x="24"
          y="132"
          width="58"
          height="34"
          rx="6"
        />
        <circle className="hab-lamp" cx="40" cy="149" r="6" />
        <rect
          className="hab-vent"
          x="54"
          y="142"
          width="20"
          height="14"
          rx="3"
        />
        <text className="hab-label" x="53" y="186" textAnchor="middle">
          Air system
        </text>
      </g>
      <g className="hab-airflow" data-active={airflow} aria-hidden="true">
        <path d="M82 140 C 100 132, 108 132, 124 136" />
        <path d="M82 148 C 100 148, 108 148, 124 148" />
        <path d="M82 156 C 100 164, 108 164, 124 160" />
      </g>

      {/* crew cabin */}
      <g className="hab-cabin">
        <path
          className="hab-module hab-dome"
          d="M126 166 V118 a54 54 0 0 1 108 0 V166 z"
        />
        <rect
          className="hab-window"
          x="148"
          y="108"
          width="20"
          height="20"
          rx="4"
        />
        <rect
          className="hab-window"
          x="176"
          y="100"
          width="20"
          height="28"
          rx="4"
        />
        <rect
          className="hab-window"
          x="204"
          y="108"
          width="20"
          height="20"
          rx="4"
        />
        <text className="hab-label" x="180" y="186" textAnchor="middle">
          Crew cabin
        </text>
      </g>

      {/* water system */}
      <g className="hab-water">
        <line className="hab-wire" x1="234" y1="150" x2="268" y2="150" />
        <rect
          className="hab-tank"
          x="268"
          y="116"
          width="46"
          height="50"
          rx="6"
        />
        <rect
          className="hab-tank-fill"
          x="270"
          y={164 - tankH}
          width="42"
          height={tankH}
          rx="4"
        />
        <text className="hab-label" x="291" y="186" textAnchor="middle">
          Water system
        </text>
      </g>
    </svg>
  );
}
