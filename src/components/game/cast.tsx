import type { ReactNode } from "react";
import { CAST, TICKER, pick, type Speaker } from "@/game/story/copy";
import type { AgeMode } from "@/game/state";
import { cn } from "@/lib/utils";

export type Mood = "calm" | "happy" | "worried";

/**
 * The two characters. Luna is mission control (a headset and a teal glow); Nova is the crew astronaut the child
 * looks after (a helmet with an orange suit). Faces change with the mood so the crew visibly reacts.
 */
export function Avatar({ who, mood = "calm", size = 44 }: { who: Speaker; mood?: Mood; size?: number }) {
  const luna = who === "luna";
  return (
    <svg className={cn("avatar", `avatar-${who}`, `avatar-${mood}`)} width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={`${CAST[who].name}, ${mood}`}>
      <circle className="av-bg" cx="24" cy="24" r="23" />
      {luna ? (
        <>
          <path className="av-hair" d="M10 26 C8 10 40 8 38 26 C36 18 12 18 10 26Z" />
          <circle className="av-face" cx="24" cy="26" r="11" />
          <path className="av-headset" d="M11 25 C11 12 37 12 37 25" fill="none" />
          <rect className="av-headset-pad" x="8" y="23" width="5" height="9" rx="2.5" />
          <path className="av-mic" d="M10 31 q4 8 13 7" fill="none" />
        </>
      ) : (
        <>
          <circle className="av-helmet" cx="24" cy="24" r="18" />
          <ellipse className="av-visor" cx="24" cy="25" rx="13" ry="11" />
          <rect className="av-suit" x="8" y="40" width="32" height="8" rx="4" />
        </>
      )}
      {/* the face: eyes and a mouth that change with the mood */}
      <g className="av-features">
        <circle cx="19.5" cy={luna ? 25 : 24} r="1.5" className="av-eye" />
        <circle cx="28.5" cy={luna ? 25 : 24} r="1.5" className="av-eye" />
        {mood === "worried" && (
          <>
            <path d={luna ? "M17 21 l5 1.5 M31 21 l-5 1.5" : "M16.5 20 l5 1.5 M31.5 20 l-5 1.5"} className="av-brow" />
            <path d={luna ? "M20 32 q4 -3 8 0" : "M20 31 q4 -3 8 0"} className="av-mouth" fill="none" />
          </>
        )}
        {mood === "happy" && <path d={luna ? "M19.5 30 q4.5 4 9 0" : "M19.5 29 q4.5 4 9 0"} className="av-mouth" fill="none" />}
        {mood === "calm" && <path d={luna ? "M20.5 31 h7" : "M20.5 30 h7"} className="av-mouth" fill="none" />}
      </g>
    </svg>
  );
}

/** A line spoken by one of the two characters: portrait, name and words. */
export function Comms({
  who,
  mood = "calm",
  children,
  className,
  role,
}: {
  who: Speaker;
  mood?: Mood;
  children: ReactNode;
  className?: string;
  role?: "status" | "alert";
}) {
  return (
    <div className={cn("comms", `comms-${who}`, className)} role={role}>
      <Avatar who={who} mood={mood} />
      <div className="comms-body">
        <span className="comms-name">{CAST[who].name}</span>
        <p>{children}</p>
      </div>
    </div>
  );
}

/** A small mission-control note that foreshadows the storm. It is a note from Luna, not NASA data. */
export function SpaceWeatherTicker({ mission, mode }: { mission: "m1" | "m2" | "m3"; mode: AgeMode }) {
  return (
    <div className="ticker" role="note" aria-label="Space weather note from mission control">
      <span className="ticker-tag">SPACE WEATHER</span>
      <span className="ticker-text">{pick(TICKER[mission], mode)}</span>
    </div>
  );
}
