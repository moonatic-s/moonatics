import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { content } from "@/game/content";
import type { PowerSystem, ShieldItem } from "@/game/engine";
import {
  ENTERING_LEVELS,
  SYSTEM_CAP,
  STREAKS,
  enteringLevel,
  passingStreaks,
  powerView,
  stormStatus,
} from "@/game/storm/model";
import { useGame, type AgeMode } from "@/game/state";
import { cn } from "@/lib/utils";
import { playChime } from "./chime";
import { ItemGlyph, ShelterCutaway, SLOT_POSITIONS, SolarArrays, SunMoonScene } from "./storm-art";
import { useStages } from "./use-briefing-motion";
import { sfx } from "@/game/audio/sfx";
import { useNarrator } from "./use-narration";
import { useDragPlace } from "./use-drag";

const g = content.storm.game;

/** Reads a screen's key message aloud once (when sound is on and the browser has a voice). Silent otherwise. */
export function useStormVoice(lines: readonly string[] | null, mode: AgeMode) {
  const { supported, soundOn: on, speak, stop } = useNarrator("en-US");
  const key = lines?.join("|") ?? "";
  useEffect(() => {
    if (!lines || !supported || !on) return;
    speak(lines, mode);
    return stop;
    // speak again only when the message itself changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, supported, on, mode]);
}

const soundOn = (): boolean => {
  try {
    return window.localStorage.getItem("moonatics:sound") !== "off";
  } catch {
    return true;
  }
};

/** Labels say where the data comes from, so NASA observations and the MOONATICS simulation are never mixed up. */
export const Source = ({ nasa, children }: { nasa: boolean; children?: React.ReactNode }) => (
  <span className={cn("sg-source", nasa ? "sg-source-nasa" : "sg-source-sim")}>{children ?? (nasa ? g.nasaObserved : g.simulated)}</span>
);

/* ---------------------------- PHASE 1: detect ---------------------------- */

/** Normal outpost, brief radio static and a small screen glitch, a gentle alert, slightly different light, then the message. */
export function DetectView({ mode, onNext }: { mode: AgeMode; onNext: () => void }) {
  const stage = useStages([1100, 1400], 0); // normal -> static + glitch -> alert
  const { clearFlrStatic } = useGame();
  useEffect(() => {
    if (stage === 1 && soundOn()) playChime("alert");
    if (stage === 2) clearFlrStatic();
  }, [stage, clearFlrStatic]);
  const d = g.detect;
  useStormVoice(stage >= 2 ? [d.title, ...(mode === "specialist" ? [`${d.flare}, ${d.time}`] : []), d.message] : null, mode);
  return (
    <div className={cn("sg-detect", stage === 1 && "sg-static", stage >= 2 && "sg-amber")}>
      <div className="sg-noise" aria-hidden="true" />
      <SolarArrays protectedArrays={false} label="The lunar outpost with its solar arrays open" />
      <div className="sg-alert" role={stage >= 2 ? "alert" : undefined}>
        {stage >= 2 ? (
          <>
            <h2 className="sg-title">{d.title}</h2>
            {mode === "specialist" && (
              <p className="sg-data">
                <Source nasa />
                <b>{d.flare}</b> <span>{d.time}</span>
              </p>
            )}
            <p className="sg-message">{d.message}</p>
            <Button className="mission-cta" data-primary onClick={onNext}>
              {d.cta}
              <ArrowRight size={20} />
            </Button>
          </>
        ) : (
          <p className="sg-quiet" aria-hidden="true">&nbsp;</p>
        )}
      </div>
    </div>
  );
}

/* ---------------------------- PHASE 2: prepare ---------------------------- */

const ITEMS: ShieldItem[] = ["water", "supply", "equipment"];

export function PrepareView({ mode, onNext }: { mode: AgeMode; onNext: () => void }) {
  const { sim, setShelter } = useGame();
  const root = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<ShieldItem | null>(null);
  const [shake, setShake] = useState<number | null>(null);
  const slots = sim.controls.act3.shelter;
  const inv = sim.subSystems.radiation.shelterInventory;
  const placed = stormStatus(sim).shelterCounts;
  const left = (k: ShieldItem) => inv[k] - placed[k];
  const att = sim.subSystems.radiation.shieldAttenuationFactor;
  const level = enteringLevel(att);

  const place = (item: ShieldItem, i: number) => {
    if (slots[i] || left(item) <= 0) {
      sfx.reject();
      setShake(i);
      window.setTimeout(() => setShake(null), 400);
      return;
    }
    const next = [...slots];
    next[i] = item;
    sfx.snap();
    setShelter(next);
    setSelected(null);
  };
  const take = (i: number) => {
    const next = [...slots];
    next[i] = null;
    sfx.pop();
    setShelter(next);
  };
  const { drag, over, press, wasDrag } = useDragPlace<ShieldItem>({
    root,
    onDrop: (item, slot) => {
      if (slot !== null) place(item, Number(slot));
    },
  });
  const p = g.prepare;
  useStormVoice([p.title, p.hint[mode], p.rule], mode);
  const liters = sim.subSystems.water.reserveLiters;
  const ripe = sim.carryOver.harvestRipeFruits;

  return (
    <div className="sg-prepare" ref={root}>
      <h2 className="sg-title">{p.title}</h2>
      <p className="sg-hint">{p.hint[mode]}</p>
      <div className="sg-prepare-grid">
        <ShelterCutaway
          slots={slots}
          passing={passingStreaks(att, 1)}
          streaks={STREAKS}
          label="Cutaway of the crew shelter with eight shielding positions around the crew"
        >
          {SLOT_POSITIONS.map((pos, i) => (
            <button
              key={i}
              type="button"
              data-slot={i}
              data-nosfx
              className={cn("sg-slot", slots[i] && "sg-slot-filled", over === String(i) && "sg-slot-over", shake === i && "sg-slot-shake")}
              style={{ left: `${(pos.x / 480) * 100}%`, top: `${(pos.y / 320) * 100}%` }}
              aria-label={slots[i] ? p.slotFilled(i + 1, p.items[slots[i]!]) : p.slot(i + 1)}
              onClick={() => (selected ? place(selected, i) : slots[i] ? take(i) : undefined)}
            />
          ))}
        </ShelterCutaway>
        <div className="sg-side">
          <div className="sg-items" role="group" aria-label={p.title}>
            {ITEMS.map((k) => (
              <button
                key={k}
                type="button"
                className="sg-item"
                data-nosfx
                aria-pressed={selected === k}
                disabled={left(k) <= 0}
                onPointerDown={press(k)}
                onClick={() => {
                  if (wasDrag()) return;
                  if (selected !== k) sfx.select();
                  setSelected((s) => (s === k ? null : k));
                }}
              >
                <svg viewBox="-24 -22 48 44" width="44" height="40" aria-hidden="true">
                  <ItemGlyph kind={k} />
                </svg>
                <span>{p.items[k]}</span>
                <b>{left(k) > 0 ? `×${left(k)}` : p.none}</b>
              </button>
            ))}
          </div>
          <div className="sg-meter" role="img" aria-label={`${p.entering}: ${p.levels[level]}`}>
            <Source nasa={false} />
            <span className="sg-meter-label">{p.entering}</span>
            <span className="sg-meter-bar" aria-hidden="true">
              {Array.from({ length: ENTERING_LEVELS }, (_, i) => (
                <i key={i} className={cn(i <= level && "on", i <= level && level >= 3 && "hot")} />
              ))}
            </span>
            <b>{p.levels[level]}</b>
          </div>
          <p className="sg-rule">{p.rule}</p>
          <ul className="sg-earlier">
            <li>
              {p.earlier.water[mode]}
              {mode === "specialist" ? " " : " "}
              <b>{p.waterNote(inv.water, liters)}</b>
            </li>
            <li>
              {p.earlier.supply[mode]}
              <b>{p.supplyNote(inv.supply, ripe)}</b>
            </li>
            <li>{p.earlier.equipment}</li>
          </ul>
          <p className="sg-matter">{p.matter}</p>
          <Button className="mission-cta" data-primary onClick={onNext}>
            {p.cta}
            <ArrowRight size={20} />
          </Button>
        </div>
      </div>
      {drag &&
        createPortal(
          <div className="gg-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
            <span className="gg-part">{p.items[drag.item]}</span>
          </div>,
          document.body,
        )}
    </div>
  );
}

/* ----------------------------- PHASE 3: CME ----------------------------- */

export function CmeView({ mode, onNext }: { mode: AgeMode; onNext: () => void }) {
  const stage = useStages([3000], 0);
  const { sim, setArrays } = useGame();
  const st = stormStatus(sim);
  const c = g.cme;
  useStormVoice([c.title, ...(mode === "specialist" ? [c.speed] : []), c.message, c.notYet], mode);
  const feedback = st.arraysProtected ? c.protectFeedback : c.keepFeedback;
  return (
    <div className="sg-cme">
      <h2 className="sg-title">{c.title}</h2>
      {mode === "specialist" && (
        <p className="sg-data">
          <Source nasa />
          <b>{c.speed}</b>
        </p>
      )}
      <SunMoonScene stage="cme" label="A large cloud of solar material leaving the Sun, far from the Moon" />
      <p className="sg-message">{c.message}</p>
      <p className="sg-hint">{c.notYet}</p>
      {stage >= 1 && (
        <section className="sg-decision" aria-label={c.decision}>
          <h3>{c.decision}</h3>
          <SolarArrays protectedArrays={st.arraysProtected} label={st.arraysProtected ? c.protect : c.keep} />
          <button
            type="button"
            role="switch"
            aria-checked={!st.arraysProtected}
            aria-label={c.decision}
            className={cn("gh-switch gg-switch", !st.arraysProtected && "gh-switch-blue")}
            onClick={() => setArrays(!st.arraysProtected)}
          >
            <span className={cn("gh-switch-label gh-switch-red", st.arraysProtected && "gh-switch-on")}>{c.protect}</span>
            <span className="gh-switch-track" aria-hidden="true">
              <span className="gh-switch-stop" />
              <span className="gh-switch-stop" />
              <span className="gh-switch-thumb" />
            </span>
            <span className={cn("gh-switch-label gh-switch-blueword", !st.arraysProtected && "gh-switch-on")}>{c.keep}</span>
          </button>
          <p className="sg-feedback" aria-live="polite">
            {feedback.join("   ")}
            {mode === "specialist" && (
              <span> ({sim.subSystems.power.stormBudgetKw} kW storm power)</span>
            )}
          </p>
          <Button className="mission-cta" data-primary onClick={onNext}>
            {c.cta}
            <ArrowRight size={20} />
          </Button>
        </section>
      )}
    </div>
  );
}

/* ----------------------------- PHASE 4: SEP ----------------------------- */

export function SepView({ mode, onNext }: { mode: AgeMode; onNext: () => void }) {
  const s = g.sep;
  useEffect(() => {
    if (soundOn()) playChime("alert");
  }, []);
  useStormVoice([s.title, ...(mode === "specialist" ? [`${s.detail}, ${s.time}`] : []), s.message[mode]], mode);
  return (
    <div className="sg-sep sg-amber">
      <h2 className="sg-title">{s.title}</h2>
      {mode === "specialist" && (
        <p className="sg-data">
          <Source nasa />
          <b>{s.detail}</b> <span>{s.time}</span>
        </p>
      )}
      <SunMoonScene stage="particles" label="Fast energetic particles crossing space toward the Moon" />
      <p className="sg-message" role="alert">{s.message[mode]}</p>
      <Button className="mission-cta" data-primary onClick={onNext}>
        {s.cta}
        <ArrowRight size={20} />
      </Button>
    </div>
  );
}

/* ------------------------ PHASE 5: emergency power ------------------------ */

const SYSTEMS: { key: PowerSystem; name: "shelter" | "life" | "greenhouse"; note: "shelterNote" | "lifeNote" | "greenhouseNote" }[] = [
  { key: "shelterKw", name: "shelter", note: "shelterNote" },
  { key: "cabinKw", name: "life", note: "lifeNote" },
  { key: "greenhouseKw", name: "greenhouse", note: "greenhouseNote" },
];

/** Power is shared out in blocks by tapping sockets: there is never enough for everything. */
export function RouteView({ mode, onLock }: { mode: AgeMode; onLock: () => void }) {
  const { sim, shiftStormPower } = useGame();
  const pv = powerView(sim);
  const r = g.route;
  useStormVoice([r.title, r.hint[mode]], mode);
  const toggle = (sys: PowerSystem, i: number) => {
    const have = pv.alloc[sys];
    if (i < have) shiftStormPower(sys, -1);
    else if (pv.free > 0 && have < SYSTEM_CAP[sys]) shiftStormPower(sys, 1);
  };
  return (
    <div className="sg-route">
      <h2 className="sg-title">{r.title}</h2>
      <p className="sg-hint">{r.hint[mode]}</p>
      <section className="sg-pool" aria-label={r.available}>
        <h3>{r.available}</h3>
        <div className="sg-cells" role="img" aria-label={r.left(pv.free)}>
          {Array.from({ length: pv.budget }, (_, i) => (
            <span key={i} className={cn("sg-cell", i < pv.free ? "on" : "used")} />
          ))}
        </div>
        <p className="sg-hint">{r.left(pv.free)}{mode === "specialist" ? ` · ${pv.budget} kW` : ""}</p>
      </section>
      <div className="sg-systems">
        {SYSTEMS.map(({ key, name, note }) => (
          <section key={key} className="sg-system" aria-label={r[name]}>
            <h3>{r[name]}</h3>
            <p className="sg-hint">{r[note][mode]}</p>
            <div className="sg-sockets">
              {Array.from({ length: SYSTEM_CAP[key] }, (_, i) => {
                const filled = i < pv.alloc[key];
                return (
                  <button
                    key={i}
                    type="button"
                    className={cn("sg-socket", filled && "on")}
                    aria-label={r.socket(r[name], i + 1, filled)}
                    onClick={() => toggle(key, i)}
                  />
                );
              })}
            </div>
            {mode === "specialist" && <p className="sg-kw">{r.kw(pv.alloc[key], SYSTEM_CAP[key])}</p>}
          </section>
        ))}
      </div>
      <Button className="mission-cta" data-primary disabled={pv.used === 0} onClick={onLock}>
        {r.lock}
        <ArrowRight size={20} />
      </Button>
    </div>
  );
}
