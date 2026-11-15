import { useId } from "react";
import { cn } from "@/lib/utils";

export type WaterState = "ok" | "dry" | "wet";
export type LightState = "plain" | "red" | "blue";

/**
 * The one Red Robin tomato seedling used on every screen of the Space Greenhouse briefing.
 * It is drawn in its healthy, finished pose; CSS (see styles.css, "greenhouse briefing") eases it into
 * the gently stressed poses (drooping leaves, a flower that closes) and back. It never wilts to death.
 */
export function GreenhousePlant({
  water,
  light,
  growIn = false,
  bright = false,
  label,
}: {
  water: WaterState;
  light: LightState;
  /** Play the slow "growing a little taller" entrance once when the picture first appears. */
  growIn?: boolean;
  /** The extra-bright "all is well" look at the end of the balance story. */
  bright?: boolean;
  label: string;
}) {
  const fade = useId();
  return (
    <svg
      className={cn(
        "gh",
        water !== "ok" && "plant-stressed",
        water === "dry" && "plant-dry",
        water === "wet" && "plant-wet",
        bright && "plant-bright",
        growIn && "plant-growing",
      )}
      data-light={light}
      data-water={water}
      viewBox="0 0 320 300"
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id={fade} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.9" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* greenhouse glass and ribs */}
      <path
        className="gh-glass"
        d="M26 268 V128 A134 112 0 0 1 294 128 V268 Z"
      />
      <path
        className="gh-rib"
        d="M90 268 V86 M160 268 V16 M230 268 V86 M26 150 H294"
      />

      {/* grow light and its glow */}
      <path
        className="gh-beam"
        d="M114 42 L206 42 L266 252 L54 252 Z"
        fill={`url(#${fade})`}
      />
      <rect className="gh-lamp" x="108" y="32" width="104" height="10" rx="5" />

      {/* planter with a see-through soil cutaway so the roots show */}
      <rect
        className="gh-planter"
        x="68"
        y="246"
        width="184"
        height="36"
        rx="9"
      />
      <rect className="gh-soil" x="80" y="222" width="160" height="46" rx="7" />
      <rect className="gh-soak" x="80" y="244" width="160" height="24" rx="7" />
      <path
        className="gh-crack"
        d="M104 232 l10 8 l-4 10 M206 236 l-10 8 l6 8 M150 252 l8 6"
      />
      <ellipse className="gh-pool" cx="160" cy="223" rx="78" ry="9" />
      <path
        className="gh-root"
        d="M160 224 C156 238 148 246 140 258 M160 224 C162 240 170 248 178 260 M160 226 C160 242 158 252 160 262 M158 230 C148 236 130 240 118 250 M162 230 C172 236 190 240 202 250"
      />

      {/* the plant */}
      <g className="gh-plant">
        <path className="gh-stem" d="M160 222 C158 196 163 172 160 136" />
        <path
          className="gh-leaf gh-leaf-l1"
          style={{ transformOrigin: "160px 204px" }}
          d="M160 204 C140 188 118 190 106 204 C124 214 146 214 160 204 Z"
        />
        <path
          className="gh-leaf gh-leaf-r1"
          style={{ transformOrigin: "160px 204px" }}
          d="M160 204 C180 188 202 190 214 204 C196 214 174 214 160 204 Z"
        />
        <path
          className="gh-leaf gh-leaf-l2"
          style={{ transformOrigin: "160px 170px" }}
          d="M160 170 C142 154 122 156 112 168 C128 178 148 178 160 170 Z"
        />
        <path
          className="gh-leaf gh-leaf-r2"
          style={{ transformOrigin: "160px 170px" }}
          d="M160 170 C178 154 198 156 208 168 C192 178 172 178 160 170 Z"
        />
        <g className="gh-flower" style={{ transformOrigin: "160px 136px" }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <ellipse
              key={i}
              className="gh-petal"
              cx="160"
              cy="119"
              rx="6.5"
              ry="12"
              transform={`rotate(${i * 72} 160 131)`}
            />
          ))}
          <circle className="gh-bloom-center" cx="160" cy="131" r="5.5" />
        </g>
      </g>
    </svg>
  );
}
