import type { Facts } from "@/game/story/profile";
import { cn } from "@/lib/utils";

/**
 * The outpost as a place, not a menu. It shows what the child did: windows light up when Life Support is done,
 * the greenhouse glows when the plants did well, the solar arrays are open or folded, and the storm shelter is lit
 * once the storm has been survived.
 */
export function LivingOutpost({ facts, done, compact = false }: { facts: Facts; done: [boolean, boolean, boolean]; compact?: boolean }) {
  const [m1, m2, m3] = done;
  const crop = facts.m2?.cropHealthPct ?? 0;
  const protectedArrays = facts.m3?.arraysProtected ?? true;
  const label = `The Moon outpost: life support ${m1 ? "running" : "waiting"}, greenhouse ${m2 ? "growing" : "waiting"}, storm shelter ${m3 ? "ready" : "waiting"}.`;
  return (
    <svg className={cn("lo", compact && "lo-compact", m1 && "lo-m1", m2 && "lo-m2", m3 && "lo-m3", crop >= 78 && "lo-thrive")} viewBox="0 0 560 240" role="img" aria-label={label}>
      <defs>
        <radialGradient id="lo-earth" cx="40%" cy="40%">
          <stop offset="0" stopColor="oklch(0.7 0.12 235)" />
          <stop offset="1" stopColor="oklch(0.3 0.08 250)" />
        </radialGradient>
      </defs>
      {[[40, 30], [110, 60], [200, 20], [300, 50], [380, 25], [470, 70], [520, 20]].map(([x, y], i) => (
        <circle key={i} className="lo-star" cx={x} cy={y} r="1.6" style={{ animationDelay: `${i * 0.6}s` }} />
      ))}
      <circle cx="470" cy="46" r="22" fill="url(#lo-earth)" />
      <path className="lo-ground" d="M0 200 Q140 184 280 194 T560 192 V240 H0 Z" />
      {/* life support habitat */}
      <g className="lo-hab">
        <rect className="lo-body" x="70" y="150" width="110" height="46" rx="14" />
        {[88, 112, 136, 160].map((x) => (
          <rect key={x} className="lo-window" x={x} y="164" width="12" height="14" rx="3" />
        ))}
        <path className="lo-vent" d="M96 150 v-14 M150 150 v-18" />
      </g>
      {/* greenhouse dome */}
      <g className="lo-greenhouse">
        <path className="lo-dome" d="M200 196 a56 48 0 0 1 112 0 Z" />
        <path className="lo-plants" d="M226 194 v-12 M244 194 v-22 M260 194 v-16 M278 194 v-24 M294 194 v-10" />
        <circle className="lo-glow" cx="256" cy="172" r="40" />
      </g>
      {/* storm shelter */}
      <g className="lo-shelter">
        <path className="lo-shell" d="M340 196 v-26 a34 30 0 0 1 68 0 v26 Z" />
        <rect className="lo-door" x="364" y="176" width="20" height="20" rx="4" />
      </g>
      {/* solar arrays: open, or folded when the child protected them */}
      <g className={cn("lo-arrays", protectedArrays ? "lo-folded" : "lo-open")}>
        <rect className="lo-panel lo-panel-a" x="424" y="164" width="56" height="30" rx="2" />
        <rect className="lo-panel lo-panel-b" x="484" y="164" width="56" height="30" rx="2" />
        <path className="lo-mast" d="M482 194 v-30" />
      </g>
    </svg>
  );
}
