import type { CSSProperties, ReactNode } from "react";
import type { ShieldItem } from "@/game/engine";
import { STREAKS } from "@/game/storm/model";
import { cn } from "@/lib/utils";
import { Astronaut } from "./briefing-art";

const v = (o: Record<string, string | number>) => o as CSSProperties;

/* ------------------------------------------------------------------ */
/* Sun and Moon outpost: the same calm scene for the briefing and the CME view */
/* ------------------------------------------------------------------ */

export type SunStage = "calm" | "flash" | "cme" | "particles";

/**
 * Sun on the left, Moon outpost on the right. One thing moves at a time: a single flash, OR the CME cloud,
 * OR the fast particles. Everything is drawn in its finished state so reduced-motion still reads clearly.
 */
export function SunMoonScene({
  stage,
  label,
  small = false,
}: {
  stage: SunStage;
  label: string;
  small?: boolean;
}) {
  return (
    <svg className={cn("sm", `sm-st-${stage}`, small && "sm-small")} viewBox="0 0 640 260" role="img" aria-label={label}>
      <defs>
        <radialGradient id="sm-glow">
          <stop offset="0" stopColor="oklch(0.92 0.17 95)" stopOpacity="0.9" />
          <stop offset="1" stopColor="oklch(0.8 0.17 70)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* stars */}
      {[[210, 30], [260, 80], [330, 40], [400, 110], [460, 50], [520, 90], [300, 150], [380, 190]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.6" className="sm-star" />
      ))}
      {/* the Sun */}
      <g className="sm-sun">
        <circle className="sm-sunglow" cx="90" cy="130" r="110" fill="url(#sm-glow)" />
        <circle className="sm-sunbody" cx="90" cy="130" r="48" />
        <circle className="sm-flash" cx="90" cy="130" r="48" />
      </g>
      {/* CME: a big expanding cloud, drifting out but never reaching the Moon in this picture */}
      <g className="sm-cme" aria-hidden="true">
        <path className="sm-cme-ring sm-cme-1" d="M150 60 Q300 130 150 200" />
        <path className="sm-cme-ring sm-cme-2" d="M170 40 Q360 130 170 220" />
        <path className="sm-cme-ring sm-cme-3" d="M190 24 Q420 130 190 236" />
      </g>
      {/* fast particles crossing space */}
      <g className="sm-particles" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <line key={i} className="sm-particle" x1="180" y1={70 + i * 20} x2="236" y2={78 + i * 20} style={v({ "--i": i })} />
        ))}
      </g>
      {/* the Moon outpost */}
      <g className="sm-moon">
        <path className="sm-ground" d="M330 232 Q420 214 500 226 T640 228 V260 H330 Z" />
        <path className="sm-dome" d="M470 226 a46 40 0 0 1 92 0 Z" />
        <rect className="sm-hab" x="440" y="206" width="52" height="22" rx="6" />
        <rect className="sm-hab" x="556" y="210" width="44" height="18" rx="6" />
        <rect className="sm-panel" x="410" y="196" width="22" height="32" rx="2" />
        <rect className="sm-panel" x="606" y="196" width="22" height="32" rx="2" />
        <line className="sm-mast" x1="516" y1="186" x2="516" y2="160" />
        <circle className="sm-mast-top" cx="516" cy="158" r="3.5" />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Shelter cutaway: 8 shielding positions around the crew compartment */
/* ------------------------------------------------------------------ */

/** Slot centres on the 480 x 320 canvas. The overlay buttons use the same numbers. */
export const SLOT_POSITIONS = [
  { x: 168, y: 138 }, { x: 240, y: 118 }, { x: 312, y: 138 },
  { x: 146, y: 198 }, { x: 334, y: 198 },
  { x: 168, y: 258 }, { x: 240, y: 276 }, { x: 312, y: 258 },
] as const;

export function ItemGlyph({ kind, x = 0, y = 0 }: { kind: ShieldItem; x?: number; y?: number }) {
  return (
    <g transform={`translate(${x} ${y})`} className={cn("sl-item", `sl-${kind}`)}>
      {kind === "water" && (
        <>
          <rect x="-17" y="-18" width="34" height="36" rx="9" className="sl-body" />
          <path d="M0 -10 C6 -2 8 2 0 8 C-8 2 -6 -2 0 -10Z" className="sl-mark" />
        </>
      )}
      {kind === "supply" && (
        <>
          <rect x="-19" y="-15" width="38" height="30" rx="4" className="sl-body" />
          <rect x="-19" y="-3" width="38" height="6" className="sl-mark" />
          <rect x="-4" y="-15" width="8" height="30" className="sl-mark" />
        </>
      )}
      {kind === "equipment" && (
        <>
          <rect x="-19" y="-14" width="38" height="28" rx="5" className="sl-body" />
          <rect x="-12" y="-8" width="14" height="9" rx="2" className="sl-mark" />
          <circle cx="10" cy="-3" r="3.5" className="sl-mark" />
          <rect x="-12" y="5" width="24" height="3" rx="1.5" className="sl-mark" />
        </>
      )}
    </g>
  );
}

const SKY: { x: number; y: number }[] = Array.from({ length: STREAKS }, (_, i) => ({
  x: 40 + ((i * 41) % 400),
  y: i % 3 === 0 ? 6 : 14 + (i % 3) * 6,
}));

/**
 * The crew shelter in cutaway. Material placed around the crew stops particles; the rest get in.
 * `passing` streaks reach the crew compartment, the others stop at the shielding: the child can SEE shielding work.
 */
export function ShelterCutaway({
  slots,
  passing,
  streaks = STREAKS,
  calm = false,
  label,
  children,
}: {
  slots: readonly (ShieldItem | null)[];
  /** How many of the drawn particles get through. */
  passing: number;
  /** How many particles are drawn at all (outside radiation). */
  streaks?: number;
  /** Peak moment: movement is reduced. */
  calm?: boolean;
  label: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("sh", calm && "sh-calm")}>
      <svg viewBox="0 0 480 320" role="img" aria-label={label}>
        <path className="sh-ground" d="M0 292 Q120 280 240 288 T480 286 V320 H0 Z" />
        {/* particles from the sky */}
        <g aria-hidden="true">
          {SKY.slice(0, Math.max(0, Math.min(STREAKS, streaks))).map((p, i) => {
            const through = i < passing;
            const tx = 240;
            const ty = 200;
            const k = through ? 0.92 : 0.58;
            return (
              <line
                key={i}
                className={cn("sh-streak", through ? "sh-through" : "sh-stopped")}
                x1={p.x}
                y1={p.y}
                x2={p.x + (tx - p.x) * k}
                y2={p.y + (ty - p.y) * k}
                style={v({ "--i": i })}
              />
            );
          })}
        </g>
        {/* shelter shell and crew compartment */}
        <path className="sh-shell" d="M110 290 V196 A130 112 0 0 1 370 196 V290 Z" />
        <rect className="sh-room" x="186" y="156" width="108" height="100" rx="14" />
        <Astronaut x={240} y={252} scale={0.62} />
        {/* the placed material */}
        {slots.map((item, i) => (item ? <ItemGlyph key={i} kind={item} x={SLOT_POSITIONS[i]!.x} y={SLOT_POSITIONS[i]!.y} /> : null))}
      </svg>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Solar arrays: PROTECT ARRAYS folds the wings in, KEEP DEPLOYED opens them */
/* ------------------------------------------------------------------ */

export function SolarArrays({ protectedArrays, label }: { protectedArrays: boolean; label: string }) {
  return (
    <svg className={cn("sa", protectedArrays ? "sa-protected" : "sa-deployed")} viewBox="0 0 420 200" role="img" aria-label={label}>
      <path className="sm-ground" d="M0 176 Q110 164 210 172 T420 170 V200 H0 Z" />
      <path className="sm-dome" d="M164 172 a46 40 0 0 1 92 0 Z" />
      <rect className="sm-hab" x="140" y="150" width="140" height="24" rx="8" />
      <g className="sa-wing sa-left">
        <rect className="sa-panel" x="-120" y="-26" width="120" height="52" rx="3" />
        <path className="sa-grid" d="M-80 -26 V26 M-40 -26 V26 M-120 0 H0" />
      </g>
      <g className="sa-wing sa-right">
        <rect className="sa-panel" x="0" y="-26" width="120" height="52" rx="3" />
        <path className="sa-grid" d="M40 -26 V26 M80 -26 V26 M0 0 H120" />
      </g>
      <rect className="sa-hub" x="196" y="96" width="28" height="22" rx="5" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Briefing only: one battery feeding three systems */
/* ------------------------------------------------------------------ */

export function PowerDiagram({
  labels,
  showAll,
}: {
  labels: { shelter: string; life: string; greenhouse: string };
  showAll: boolean;
}) {
  const nodes = [
    { y: 40, label: labels.shelter, icon: "shield" },
    { y: 110, label: labels.life, icon: "fan" },
    { y: 180, label: labels.greenhouse, icon: "leaf" },
  ] as const;
  return (
    <svg className={cn("pd", showAll && "pd-on")} viewBox="0 0 420 220" role="img" aria-label={`${labels.shelter}, ${labels.life}, ${labels.greenhouse}`}>
      <g className="pd-battery">
        <rect x="14" y="76" width="64" height="68" rx="10" className="pd-cell" />
        <rect x="78" y="98" width="8" height="24" rx="3" className="pd-cell" />
        <path d="M44 88 L34 114 H48 L40 134 L62 106 H48 Z" className="pd-bolt" />
      </g>
      {nodes.map((n, i) => (
        <g key={n.label} className="pd-node" style={v({ "--i": i })}>
          <path className="pd-wire" d={`M86 110 C140 110 150 ${n.y} 200 ${n.y}`} />
          <rect x="200" y={n.y - 22} width="206" height="44" rx="12" className="pd-box" />
          <circle cx="226" cy={n.y} r="10" className={cn("pd-icon", `pd-${n.icon}`)} />
          <text x="246" y={n.y + 5} className="pd-text">{n.label}</text>
        </g>
      ))}
    </svg>
  );
}
