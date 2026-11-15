import { useId, type CSSProperties, type ReactNode } from "react";
import { content } from "@/game/content";
import type { PlantView } from "@/game/greenhouse/model";
import { cn } from "@/lib/utils";

const t = content.greenhouse.game;

export type Spot = "leaves" | "roots" | "flower";
export interface Installed {
  pillow: boolean;
  water: boolean;
  light: boolean;
}
export const ALL_INSTALLED: Installed = { pillow: true, water: true, light: true };

/** Where things sit on the 400 x 440 canvas. The same numbers place the click targets, so art and buttons stay together. */
const LEAVES = [
  { x: 200, y: 322, side: -1, from: 0, size: 0.8 },
  { x: 200, y: 316, side: 1, from: 0, size: 0.8 },
  { x: 200, y: 280, side: -1, from: 1, size: 1 },
  { x: 200, y: 274, side: 1, from: 1, size: 1 },
  { x: 200, y: 236, side: -1, from: 2, size: 1.05 },
  { x: 200, y: 230, side: 1, from: 2, size: 1.05 },
] as const;
const FLOWERS = [
  { x: 200, y: 196 },
  { x: 150, y: 244 },
  { x: 252, y: 240 },
] as const;
export const TOMATOES = [
  { x: 156, y: 276 },
  { x: 246, y: 270 },
  { x: 130, y: 316 },
  { x: 272, y: 312 },
  { x: 188, y: 236 },
  { x: 214, y: 292 },
] as const;
const SPOT_POS: Record<Spot, { left: string; top: string }> = {
  leaves: { left: "22%", top: "56%" },
  roots: { left: "50%", top: "89%" },
  flower: { left: "50%", top: "43%" },
};

function Flower({ x, y, i, bud }: { x: number; y: number; i: number; bud: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={cn("gp-flower", bud && "gp-bud")} style={{ "--i": i } as CSSProperties}>
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} className="gp-petal" cx="0" cy="-11" rx="6" ry="11" transform={`rotate(${a})`} />
        ))}
        <circle className="gp-bloom" r="5.5" />
      </g>
    </g>
  );
}

/**
 * The tomato plant: the one big object of Mission 2. Everything about its health is shown, not told:
 * leaves rise and droop, the flower opens and closes, tomatoes turn from green to red, and the light
 * in the chamber changes colour with the recipe. All changes ease over about a second.
 */
export function GamePlant({
  view,
  installed = ALL_INSTALLED,
  spots = false,
  active = null,
  pulse = null,
  onSpot,
  picked,
  onPick,
  pickLabel,
  dim,
  lapse = false,
  children,
}: {
  view: PlantView;
  installed?: Installed;
  /** Show the three tappable inspection spots. */
  spots?: boolean;
  active?: Spot | null;
  pulse?: Spot | null;
  onSpot?: ((spot: Spot) => void) | undefined;
  /** Harvest: tomatoes already picked, and the click handler that makes the rest pickable. */
  picked?: ReadonlySet<number> | undefined;
  onPick?: ((index: number, el: HTMLElement) => void) | undefined;
  pickLabel?: ((n: number) => string) | undefined;
  /** Play the growth time-lapse (the plant grows quickly, then settles). */
  lapse?: boolean;
  /** Grow-light brightness 0..1 (Mission 3 dims the lights when the greenhouse gets less power). */
  dim?: number | undefined;
  /** Extra content laid over the chamber (setup slots). */
  children?: ReactNode;
}) {
  const fade = useId();
  const { stage } = view;
  const grown = installed.pillow;
  const tomatoes = stage >= 4 ? Math.min(view.ripeCount, TOMATOES.length) : 0;
  return (
    <div
      className={cn(
        "gp",
        `gp-light-${view.light}`,
        `gp-leaves-${view.leaves}`,
        `gp-flower-${view.flower}`,
        `gp-root-${view.root}`,
        `gp-stage-${stage}`,
        installed.light && "gp-lit",
        dim !== undefined && "gp-dimmed",
        lapse && "gp-lapse",
      )}
      style={dim !== undefined ? ({ "--dim": dim } as CSSProperties) : undefined}
      data-stage={stage}
    >
      <svg viewBox="0 0 400 440" role="img" aria-label={content.greenhouse.briefing.plantLabel}>
        <defs>
          <linearGradient id={fade} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.55" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path className="gp-glass" d="M44 404 V180 A156 144 0 0 1 356 180 V404 Z" />
        <path className="gp-rib" d="M122 404 V86 M200 404 V38 M278 404 V86 M44 190 H356" />

        {/* light unit and beam */}
        {installed.light && (
          <g className="gp-lightunit">
            <polygon className="gp-beam" points="140,64 260,64 346,372 54,372" fill={`url(#${fade})`} />
            <rect className="gp-lamp" x="132" y="44" width="136" height="20" rx="10" />
          </g>
        )}

        {/* water system: tank and pipe */}
        {installed.water && (
          <g className="gp-watersys">
            <rect className="gp-tank" x="8" y="330" width="38" height="74" rx="9" />
            <rect className="gp-tank-fill" x="13" y="352" width="28" height="48" rx="6" />
            <path className="gp-pipe" d="M46 392 H126" />
          </g>
        )}

        {/* grow tray and plant pillow */}
        <rect className="gp-tray" x="112" y="384" width="176" height="22" rx="9" />
        {grown && (
          <g>
            <rect className="gp-pillow" x="132" y="352" width="136" height="38" rx="10" />
            <path className="gp-crack" d="M160 360 l8 12 -6 8 M206 358 l-5 14 7 10 M240 362 l7 11" />
            <g className="gp-wetspots">
              <circle cx="152" cy="374" r="4" /><circle cx="186" cy="380" r="3.5" /><circle cx="224" cy="372" r="4" /><circle cx="252" cy="380" r="3.5" />
            </g>
          </g>
        )}

        {/* the plant */}
        {grown && (
          <g className="gp-plant">
            <g className="gp-stem-wrap">
              <path className="gp-stem" d="M200 354 C204 320 196 280 200 190" />
            </g>
            {LEAVES.map((l, i) => (
              <g key={i} transform={`translate(${l.x} ${l.y}) scale(${l.side * l.size} ${l.size})`}>
                <g className={cn("gp-leaf", stage >= l.from ? "gp-on" : "gp-off")} style={{ "--i": i } as CSSProperties}>
                  <path className="gp-leafshape" d="M0 0 C-26 -22 -62 -14 -70 6 C-48 18 -16 14 0 0Z" />
                  <path className="gp-vein" d="M0 0 C-22 -4 -44 -2 -60 4" />
                </g>
              </g>
            ))}
            {/* flowers (buds early, open flowers while flowering, gone once fruit sets) */}
            <g className={cn("gp-flowers", stage >= 1 && stage <= 3 ? "gp-on" : "gp-off")}>
              {FLOWERS.map((f, i) => (
                <Flower key={i} x={f.x} y={f.y} i={i} bud={stage < 3} />
              ))}
            </g>
            {/* tomatoes */}
            {TOMATOES.slice(0, tomatoes).map((p, i) => (
              <g key={i} transform={`translate(${p.x} ${p.y})`} className={cn("gp-tomato-wrap", picked?.has(i) && "gp-picked")}>
                <g className={cn("gp-tomato", stage >= 5 ? "gp-ripe" : "gp-green")} style={{ "--i": i } as CSSProperties}>
                  <circle className="gp-fruit" r="15" />
                  <path className="gp-calyx" d="M-8 -11 L0 -6 L8 -11 L2 -15 L0 -19 L-2 -15Z" />
                </g>
              </g>
            ))}
          </g>
        )}
      </svg>

      {spots &&
        (["leaves", "roots", "flower"] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={cn("gp-spot", active === s && "gp-spot-on", pulse === s && "gp-spot-pulse")}
            style={SPOT_POS[s]}
            aria-pressed={active === s}
            onClick={() => onSpot?.(s)}
          >
            <span className="gp-spot-dot" aria-hidden="true" />
            <span className="gp-spot-label">{t.hotspot[s]}</span>
          </button>
        ))}

      {onPick &&
        TOMATOES.slice(0, tomatoes).map((p, i) =>
          picked?.has(i) ? null : (
            <button
              key={i}
              type="button"
              className="gp-pick"
              style={{ left: `${(p.x / 400) * 100}%`, top: `${(p.y / 440) * 100}%` }}
              aria-label={pickLabel?.(i + 1) ?? `Pick tomato ${i + 1}`}
              onClick={(e) => onPick(i, e.currentTarget)}
            />
          ),
        )}
      {children}
    </div>
  );
}
