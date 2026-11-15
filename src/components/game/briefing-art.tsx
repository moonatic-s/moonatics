import type { CSSProperties } from "react";

/**
 * Lightweight SVG illustrations for the Life Support briefing. All motion is CSS (see styles.css, "briefing"),
 * and every element is drawn in its finished state so reduced-motion players still see a complete picture.
 */

const vars = (v: Record<string, string | number>) => v as CSSProperties;

/** A small suited astronaut. `breathing` gently scales the torso. Drawn around (0,0) at the feet. */
export function Astronaut({
  x,
  y,
  scale = 1,
  breathing = true,
}: {
  x: number;
  y: number;
  scale?: number;
  breathing?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} className="astro">
      <g className={breathing ? "astro-breathe" : undefined}>
        <rect
          className="astro-pack"
          x="-23"
          y="-64"
          width="46"
          height="54"
          rx="11"
        />
        <rect
          className="astro-leg"
          x="-16"
          y="-14"
          width="13"
          height="26"
          rx="6"
        />
        <rect
          className="astro-leg"
          x="3"
          y="-14"
          width="13"
          height="26"
          rx="6"
        />
        <rect
          className="astro-body"
          x="-18"
          y="-60"
          width="36"
          height="52"
          rx="13"
        />
        <rect
          className="astro-patch"
          x="-6"
          y="-44"
          width="12"
          height="8"
          rx="2"
        />
        <circle className="astro-helmet" cx="0" cy="-76" r="19" />
        <path
          className="astro-visor"
          d="M-12 -78 a12 10 0 0 1 24 0 v3 a12 9 0 0 1 -24 0 z"
        />
        <path className="astro-glint" d="M-7 -82 q3 -4 8 -4" />
      </g>
    </g>
  );
}

const PARTICLES: {
  x: number;
  y: number;
  dx: number;
  dy: number;
  delay: number;
}[] = [
  { x: 230, y: 250, dx: 60, dy: -50, delay: 0 },
  { x: 270, y: 240, dx: 40, dy: -70, delay: 1.1 },
  { x: 300, y: 230, dx: 20, dy: -60, delay: 2.2 },
  { x: 340, y: 235, dx: -30, dy: -70, delay: 0.6 },
  { x: 380, y: 245, dx: -50, dy: -55, delay: 1.7 },
  { x: 410, y: 250, dx: -60, dy: -40, delay: 2.8 },
  { x: 260, y: 200, dx: 70, dy: -30, delay: 3.3 },
  { x: 370, y: 205, dx: -70, dy: -30, delay: 0.3 },
  { x: 320, y: 215, dx: 0, dy: -75, delay: 2.5 },
];

/** Scene 1: the habitat "wakes up": lights, ventilation, sensors, labels. */
export function BriefingHabitat({
  labels,
}: {
  labels: {
    co2: string;
    temperature: string;
    humidity: string;
    cabin: string;
    vent: string;
    water: string;
    solar: string;
  };
}) {
  return (
    <svg
      className="bh"
      viewBox="0 0 640 340"
      role="img"
      aria-label="Cutaway of a lunar habitat with an astronaut, ventilation, water tank, solar panels and three sensors"
    >
      <path
        className="bh-ground"
        d="M0 300 Q80 286 160 296 T320 298 T480 292 T640 300 V340 H0 Z"
      />
      <ellipse className="bh-crater" cx="90" cy="318" rx="34" ry="6" />
      <ellipse className="bh-crater" cx="560" cy="322" rx="28" ry="5" />

      {/* water system */}
      <g className="bh-water">
        <line className="bh-pipe" x1="96" y1="262" x2="152" y2="262" />
        <rect
          className="bh-tank"
          x="40"
          y="222"
          width="56"
          height="70"
          rx="9"
        />
        <rect
          className="bh-tank-fill"
          x="44"
          y="246"
          width="48"
          height="42"
          rx="6"
        />
        <text className="bh-label" x="68" y="314" textAnchor="middle">
          {labels.water}
        </text>
      </g>

      {/* solar power */}
      <g className="bh-solar">
        <path className="bh-wire" d="M522 252 Q506 262 490 262" />
        <polygon
          className="bh-panel"
          points="520,196 600,184 612,234 530,248"
        />
        <path
          className="bh-panel-grid"
          d="M547 192 L557 241 M574 188 L584 238 M524 222 L606 209"
        />
        <path
          className="bh-bolt"
          d="M566 206 l-8 14 h7 l-4 12 l12 -17 h-7 l5 -9 z"
        />
        <text className="bh-label" x="566" y="270" textAnchor="middle">
          {labels.solar}
        </text>
      </g>

      {/* cabin */}
      <g className="bh-cabin">
        <path
          className="bh-shell"
          d="M150 298 V196 A170 120 0 0 1 490 196 V298 Z"
        />
        <path
          className="bh-interior"
          d="M158 296 V196 A162 112 0 0 1 482 196 V296 Z"
        />
        <ellipse className="bh-glow" cx="320" cy="150" rx="120" ry="60" />
        <rect
          className="bh-light"
          x="250"
          y="104"
          width="140"
          height="6"
          rx="3"
        />
        <line className="bh-floor" x1="158" y1="284" x2="482" y2="284" />
        <rect
          className="bh-prop"
          x="184"
          y="252"
          width="70"
          height="30"
          rx="5"
        />
        <rect
          className="bh-prop"
          x="404"
          y="258"
          width="58"
          height="24"
          rx="5"
        />
        <Astronaut x={320} y={284} scale={0.95} />

        {/* ventilation */}
        <g className="bh-vent">
          <rect
            className="bh-duct"
            x="186"
            y="150"
            width="96"
            height="24"
            rx="7"
          />
          <g transform="translate(210 162)">
            <g className="bh-fan">
              <circle className="bh-fan-hub" r="3" />
              <path className="bh-blade" d="M0 0 L9 -3 L9 3 Z" />
              <path className="bh-blade" d="M0 0 L-9 3 L-9 -3 Z" />
              <path className="bh-blade" d="M0 0 L3 9 L-3 9 Z" />
              <path className="bh-blade" d="M0 0 L-3 -9 L3 -9 Z" />
            </g>
          </g>
          <text className="bh-label" x="234" y="146" textAnchor="middle">
            {labels.vent}
          </text>
        </g>

        {/* drifting air */}
        {PARTICLES.map((p, i) => (
          <circle
            key={i}
            className="bh-particle"
            cx={p.x}
            cy={p.y}
            r="2.4"
            style={vars({
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              "--delay": `${p.delay}s`,
            })}
          />
        ))}

        {/* sensors */}
        <g className="bh-sensor bh-sensor-air" style={vars({ "--s": "1.5s" })}>
          <circle className="bh-ping" cx="240" cy="218" r="6" />
          <circle className="bh-dot" cx="240" cy="218" r="4" />
          <text className="bh-sensor-label" x="240" y="204" textAnchor="middle">
            {labels.co2}
          </text>
        </g>
        <g className="bh-sensor bh-sensor-heat" style={vars({ "--s": "1.9s" })}>
          <circle className="bh-ping" cx="320" cy="150" r="6" />
          <circle className="bh-dot" cx="320" cy="150" r="4" />
          <text className="bh-sensor-label" x="320" y="138" textAnchor="middle">
            {labels.temperature}
          </text>
        </g>
        <g
          className="bh-sensor bh-sensor-water"
          style={vars({ "--s": "2.3s" })}
        >
          <circle className="bh-ping" cx="412" cy="222" r="6" />
          <circle className="bh-dot" cx="412" cy="222" r="4" />
          <text className="bh-sensor-label" x="412" y="208" textAnchor="middle">
            {labels.humidity}
          </text>
        </g>
      </g>
      <text
        className="bh-label bh-label-cabin"
        x="320"
        y="320"
        textAnchor="middle"
      >
        {labels.cabin}
      </text>
    </svg>
  );
}

/** Scene 2, CO₂: exhale, particles build up, the scrubber removes some. */
export function Co2Demo({
  state,
}: {
  state: { build: string; clean: string };
}) {
  return (
    <svg
      className="demo demo-co2"
      viewBox="0 0 240 160"
      role="img"
      aria-label={`${state.build}. ${state.clean}.`}
    >
      <rect
        className="demo-room"
        x="6"
        y="10"
        width="228"
        height="130"
        rx="14"
      />
      <Astronaut x={44} y={134} scale={0.62} />
      <path className="co2-breath" d="M62 84 q10 -4 18 0" />
      {[0, 1, 2, 3].map((i) => (
        <circle
          key={`s${i}`}
          className="co2-dot co2-stay"
          cx={92 + i * 12}
          cy={72 + (i % 2) * 14}
          r="4"
          style={vars({ "--i": i })}
        />
      ))}
      {[0, 1, 2].map((i) => (
        <circle
          key={`g${i}`}
          className="co2-dot co2-go"
          cx={118 + i * 12}
          cy={90 - i * 9}
          r="4"
          style={vars({ "--i": i })}
        />
      ))}
      <g className="co2-scrubber">
        <rect
          className="demo-box"
          x="176"
          y="52"
          width="48"
          height="62"
          rx="8"
        />
        <g transform="translate(200 83)">
          <g className="co2-fan">
            <circle className="bh-fan-hub" r="3" />
            <path className="bh-blade" d="M0 0 L10 -3 L10 3 Z" />
            <path className="bh-blade" d="M0 0 L-10 3 L-10 -3 Z" />
            <path className="bh-blade" d="M0 0 L3 10 L-3 10 Z" />
            <path className="bh-blade" d="M0 0 L-3 -10 L3 -10 Z" />
          </g>
        </g>
      </g>
      <text className="demo-tag demo-tag-a" x="66" y="156" textAnchor="middle">
        {state.build}
      </text>
      <text className="demo-tag demo-tag-b" x="172" y="156" textAnchor="middle">
        {state.clean}
      </text>
    </svg>
  );
}

/** Scene 2, temperature: the same room shifting cool, comfortable, warm. */
export function TempDemo({
  state,
}: {
  state: { cool: string; neutral: string; warm: string };
}) {
  return (
    <svg
      className="demo demo-temp"
      viewBox="0 0 240 160"
      role="img"
      aria-label={`${state.cool}, ${state.neutral}, ${state.warm}`}
    >
      <rect
        className="demo-room temp-room"
        x="6"
        y="10"
        width="190"
        height="130"
        rx="14"
      />
      <Astronaut x={78} y={134} scale={0.62} breathing={false} />
      <rect
        className="demo-box temp-bulb"
        x="212"
        y="96"
        width="16"
        height="16"
        rx="8"
      />
      <rect
        className="demo-box temp-tube"
        x="216"
        y="30"
        width="8"
        height="74"
        rx="4"
      />
      <rect
        className="temp-level"
        x="218"
        y="40"
        width="4"
        height="62"
        rx="2"
      />
      <text
        className="demo-tag temp-tag temp-tag-a"
        x="40"
        y="156"
        textAnchor="middle"
      >
        {state.cool}
      </text>
      <text
        className="demo-tag temp-tag temp-tag-b"
        x="101"
        y="156"
        textAnchor="middle"
      >
        {state.neutral}
      </text>
      <text
        className="demo-tag temp-tag temp-tag-c"
        x="162"
        y="156"
        textAnchor="middle"
      >
        {state.warm}
      </text>
    </svg>
  );
}

/** Scene 2, humidity: dry air, normal air, then small droplets condensing on a cool pane. */
export function HumidityDemo({
  state,
}: {
  state: { dry: string; normal: string; damp: string };
}) {
  return (
    <svg
      className="demo demo-hum"
      viewBox="0 0 240 160"
      role="img"
      aria-label={`${state.dry}, ${state.normal}, ${state.damp}`}
    >
      <rect
        className="demo-room"
        x="6"
        y="10"
        width="228"
        height="130"
        rx="14"
      />
      <rect
        className="hum-pane"
        x="150"
        y="34"
        width="68"
        height="84"
        rx="10"
      />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <circle
          key={`m${i}`}
          className="hum-mist"
          cx={40 + i * 28}
          cy={96 - (i % 3) * 18}
          r={10 + (i % 3) * 3}
          style={vars({ "--i": i })}
        />
      ))}
      {[
        [164, 52],
        [186, 66],
        [172, 84],
        [200, 92],
        [160, 104],
      ].map(([x, y], i) => (
        <path
          key={`d${i}`}
          className="hum-drop"
          d={`M${x} ${y} q-5 8 0 11 q5 -3 0 -11 z`}
          style={vars({ "--i": i })}
        />
      ))}
      <text
        className="demo-tag hum-tag hum-tag-a"
        x="44"
        y="156"
        textAnchor="middle"
      >
        {state.dry}
      </text>
      <text
        className="demo-tag hum-tag hum-tag-b"
        x="118"
        y="156"
        textAnchor="middle"
      >
        {state.normal}
      </text>
      <text
        className="demo-tag hum-tag hum-tag-c"
        x="192"
        y="156"
        textAnchor="middle"
      >
        {state.damp}
      </text>
    </svg>
  );
}
