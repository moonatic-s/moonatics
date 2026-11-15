import { Droplet, Info, Minus, Plus } from "lucide-react";
import { useId, useState } from "react";
import { content } from "@/game/content";
import {
  CHECKPOINTS,
  WATER_RUNGS,
  type PlantView,
  type WaterAction,
} from "@/game/greenhouse/model";
import type { AgeMode } from "@/game/state";
import { cn } from "@/lib/utils";
import type { Spot } from "./gh-plant";

const t = content.greenhouse.game;

/** START -> EARLY GROWTH -> ... -> HARVEST. Exactly one stage is highlighted. */
export function StageStrip({ stage }: { stage: number }) {
  return (
    <ol className="gg-strip" aria-label={t.stage.label}>
      {CHECKPOINTS.map((c, i) => (
        <li key={c} aria-current={i === stage ? "step" : undefined} className={cn(i < stage && "done")}>
          {t.stage[c]}
        </li>
      ))}
    </ol>
  );
}

/** Three discrete choices. No slider: a decision moves the supply by one rung and the plant answers. */
export function WaterPanel({
  view,
  chosen,
  feedback,
  mode,
  onChoose,
}: {
  view: PlantView;
  chosen: WaterAction | null;
  feedback: string;
  mode: AgeMode;
  onChoose: (a: WaterAction) => void;
}) {
  const w = t.water;
  const items: { id: WaterAction; label: string; icon: typeof Plus; off: boolean }[] = [
    { id: "add", label: w.add, icon: Plus, off: view.rung >= WATER_RUNGS.length - 1 },
    { id: "hold", label: w.hold, icon: Droplet, off: false },
    { id: "reduce", label: w.reduce, icon: Minus, off: view.rung <= 0 },
  ];
  return (
    <section className="gg-card" aria-label={w.title}>
      <h3>{w.title}</h3>
      <div className="gg-actions" role="group" aria-label={w.title}>
        {items.map(({ id, label, icon: Icon, off }) => (
          <button
            key={id}
            type="button"
            className="gg-act"
            aria-pressed={chosen === id}
            disabled={off}
            onClick={() => onChoose(id)}
          >
            <Icon size={mode === "explorer" ? 24 : 18} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
      <div
        className="gg-pips"
        role="img"
        aria-label={`${w.level} ${view.rung + 1} / ${WATER_RUNGS.length}`}
      >
        <span>{w.level}</span>
        {WATER_RUNGS.map((_, i) => (
          <Droplet key={i} size={24} aria-hidden="true" data-on={i <= view.rung} />
        ))}
      </div>
      <p className="gg-feedback" role="status" aria-live="polite">
        {feedback || w.hint[mode]}
      </p>
    </section>
  );
}

/** A physical two-position switch (not a slider): RED-RICH or BLUE-RICH, with each recipe's mix written on its side. */
export function LightSwitch({
  blue,
  note,
  onToggle,
}: {
  blue: boolean;
  note: boolean;
  onToggle: () => void;
}) {
  const l = t.light;
  return (
    <div className="gg-light">
      <button
        type="button"
        role="switch"
        aria-checked={blue}
        aria-label={l.label}
        className={cn("gh-switch gg-switch", blue && "gh-switch-blue")}
        onClick={onToggle}
      >
        <span className={cn("gh-switch-label gh-switch-red gg-recipe", !blue && "gh-switch-on")}>
          {l.red}
          <small>{l.redMix}</small>
        </span>
        <span className="gh-switch-track" aria-hidden="true">
          <span className="gh-switch-stop" />
          <span className="gh-switch-stop" />
          <span className="gh-switch-thumb" />
        </span>
        <span className={cn("gh-switch-label gh-switch-blueword gg-recipe", blue && "gh-switch-on")}>
          {l.blue}
          <small>{l.blueMix}</small>
        </span>
      </button>
      {note && <p className="gg-note">{l.note}</p>}
    </div>
  );
}

function RootView({ view }: { view: PlantView }) {
  const drops = view.root === "buildup" ? 9 : view.root === "dry" ? 0 : 3;
  const spots = [[44, 30], [70, 62], [96, 24], [120, 70], [146, 34], [172, 66], [198, 28], [224, 58], [246, 38]] as const;
  return (
    <div className="gg-root-view" data-root={view.root}>
      <svg viewBox="0 0 290 130" role="img" aria-label={t.inspect.root.label[view.root]}>
        <path
          d="M145 0 V30 M145 30 C112 40 80 52 50 96 M145 30 C178 40 210 52 240 96 M145 30 V116 M145 50 C124 66 112 90 104 120 M145 50 C166 66 178 90 186 120"
          fill="none"
          stroke={view.root === "dry" ? "oklch(0.62 0.06 70)" : "oklch(0.84 0.08 80)"}
          strokeWidth="3"
          strokeLinecap="round"
        />
        {spots.slice(0, drops).map(([x, y], i) => (
          <ellipse key={i} cx={x} cy={y} rx="5" ry="7" fill="oklch(0.75 0.13 235)" stroke="oklch(0.92 0.06 235)" />
        ))}
      </svg>
    </div>
  );
}

function flowerText(view: PlantView, mode: AgeMode): string {
  const f = t.inspect.flower;
  if (view.stage === 0) return f.none;
  if (view.stage <= 2) return f.buds;
  if (view.stage === 3) return f[view.flower][mode];
  return view.stage === 4 ? f.green : f.ripe;
}

/** The small panel that opens when a plant spot is tapped. */
export function InspectPanel({
  spot,
  view,
  mode,
  onClose,
}: {
  spot: Spot;
  view: PlantView;
  mode: AgeMode;
  onClose: () => void;
}) {
  const i = t.inspect;
  return (
    <section className="gg-card" aria-label={t.hotspot[spot]}>
      <h3>{t.hotspot[spot]}</h3>
      {spot === "leaves" && <p className="gg-status">{i.leaves[view.leaves][mode]}</p>}
      {spot === "roots" && (
        <>
          <RootView view={view} />
          <p className="gg-status">
            <b>{i.root.label[view.root]}</b> {i.root[view.root][mode]}
          </p>
          {mode === "specialist" && (
            <p className="gg-note">
              {t.facts.stress}: {Math.round(view.rootStressPct)}%
            </p>
          )}
        </>
      )}
      {spot === "flower" && <p className="gg-status">{flowerText(view, mode)}</p>}
      <button type="button" className="ghs-more-button" onClick={onClose}>
        {t.hotspot.close}
      </button>
    </section>
  );
}

/** Specialist only: the numbers behind what you see. Same game, more precise context. */
export function FactsCard({ view }: { view: PlantView }) {
  const [par, setPar] = useState(false);
  const id = useId();
  const f = t.facts;
  return (
    <section className="gg-card" aria-label="Details">
      <dl className="gg-facts">
        <dt>{f.stress}</dt>
        <dd>{Math.round(view.rootStressPct)}%</dd>
        <dt>{f.light}</dt>
        <dd>
          {view.redPct}% red / {view.bluePct}% blue
        </dd>
        <dt>{f.par}</dt>
        <dd>{Math.round(view.parUmol)} {"µ"}mol/m{"²"}/s</dd>
        <dt>{f.humidity}</dt>
        <dd>{Math.round(view.cabinRh)}%</dd>
        <dt>{f.water}</dt>
        <dd>
          {view.waterLiters.toFixed(1)} / {view.waterMaxLiters} L
        </dd>
      </dl>
      <button
        type="button"
        className="ghs-more-button"
        aria-expanded={par}
        aria-controls={id}
        onClick={() => setPar((p) => !p)}
      >
        <Info size={15} aria-hidden="true" />
        {f.par}
      </button>
      <p id={id} className="gg-note" hidden={!par}>
        {f.parNote}
      </p>
    </section>
  );
}
