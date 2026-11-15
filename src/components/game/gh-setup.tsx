import { ArrowRight, Droplets, Lightbulb, Sprout } from "lucide-react";
import { useCallback, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { content } from "@/game/content";
import type { PlantView } from "@/game/greenhouse/model";
import type { AgeMode } from "@/game/state";
import { cn } from "@/lib/utils";
import { sfx } from "@/game/audio/sfx";
import { GamePlant, type Installed } from "./gh-plant";

const t = content.greenhouse.game;
type PartId = keyof Installed;
const PARTS: PartId[] = ["pillow", "water", "light"];
const ICONS = { pillow: Sprout, water: Droplets, light: Lightbulb } as const;
const SLOT_POS: Record<PartId, { left: string; top: string }> = {
  pillow: { left: "50%", top: "86%" },
  water: { left: "11%", top: "78%" },
  light: { left: "50%", top: "11%" },
};
const NONE: Installed = { pillow: false, water: false, light: false };

/**
 * The only drag-and-drop in the mission: put the plant pillow, water supply and light unit in place.
 * Dragging is the main way, but selecting a part and then its spot (tap or keyboard) does the same, so nobody is locked out.
 */
export function GreenhouseSetup({
  view,
  mode,
  onStart,
}: {
  view: PlantView;
  mode: AgeMode;
  onStart: () => void;
}) {
  const [installed, setInstalled] = useState<Installed>(NONE);
  const [selected, setSelected] = useState<PartId | null>(null);
  const [drag, setDrag] = useState<{ id: PartId; x: number; y: number } | null>(null);
  const [over, setOver] = useState<PartId | null>(null);
  const [shake, setShake] = useState<PartId | null>(null);
  const [message, setMessage] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const ready = PARTS.every((p) => installed[p]);

  const slotAt = useCallback((x: number, y: number): PartId | null => {
    const slots = root.current?.querySelectorAll<HTMLElement>("[data-slot]") ?? [];
    for (const el of slots) {
      const r = el.getBoundingClientRect();
      const pad = 24;
      if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad)
        return el.dataset["slot"] as PartId;
    }
    return null;
  }, []);

  const tryPlace = useCallback((part: PartId, slot: PartId | null) => {
    if (slot === part) {
      sfx.snap();
      setInstalled((i) => ({ ...i, [part]: true }));
      setSelected(null);
      setMessage(t.setup.done(t.setup.parts[part]));
    } else if (slot) {
      sfx.reject();
      setShake(slot);
      window.setTimeout(() => setShake(null), 450);
    }
  }, []);

  const onPartDown = (part: PartId) => (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const sx = e.clientX;
    const sy = e.clientY;
    let moved = false;
    const move = (m: globalThis.PointerEvent) => {
      if (!moved && Math.hypot(m.clientX - sx, m.clientY - sy) < 6) return;
      moved = true;
      setDrag({ id: part, x: m.clientX, y: m.clientY });
      setOver(slotAt(m.clientX, m.clientY));
    };
    const up = (u: globalThis.PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      setDrag(null);
      setOver(null);
      if (moved) {
        tryPlace(part, slotAt(u.clientX, u.clientY));
        suppressClick.current = true;
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  // A finished drag must not also count as a click-to-select.
  const suppressClick = useRef(false);
  const onPartClick = (part: PartId) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (selected !== part) sfx.select();
    setSelected((s) => (s === part ? null : part));
    setMessage(selected === part ? "" : t.setup.selected(t.setup.parts[part]));
  };

  return (
    <div className="gg-setup" ref={root}>
      <h2 className="gg-title">{t.setup.title}</h2>
      <p className="gg-hint">{t.setup.hint[mode]}</p>
      <GamePlant view={view} installed={installed}>
        {PARTS.filter((p) => !installed[p]).map((p) => (
          <button
            key={p}
            type="button"
            data-slot={p}
            data-nosfx
            className={cn("gg-slot", over === p && "gg-slot-over", shake === p && "gg-slot-shake")}
            style={SLOT_POS[p]}
            aria-label={`${t.setup.slots[p]}`}
            onClick={() => (selected ? tryPlace(selected, p) : setMessage(t.setup.hint[mode]))}
          >
            {t.setup.slots[p]}
          </button>
        ))}
      </GamePlant>
      <div className="gg-parts" role="group" aria-label={t.setup.title}>
        {PARTS.filter((p) => !installed[p]).map((p) => {
          const Icon = ICONS[p];
          return (
            <button
              key={p}
              type="button"
              className="gg-part"
              data-nosfx
              aria-pressed={selected === p}
              onPointerDown={onPartDown(p)}
              onClick={() => onPartClick(p)}
            >
              <Icon size={20} aria-hidden="true" />
              {t.setup.parts[p]}
            </button>
          );
        })}
      </div>
      <p className="gg-hint" role="status" aria-live="polite">
        {message}
      </p>
      {drag &&
        createPortal(
          <div className="gg-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
            <span className="gg-part">{t.setup.parts[drag.id]}</span>
          </div>,
          document.body,
        )}
      {ready && (
        <>
          <p className="gg-ready" role="status">
            {t.setup.ready}
          </p>
          <Button className="mission-cta" data-primary onClick={onStart}>
            {t.setup.start}
            <ArrowRight size={20} />
          </Button>
        </>
      )}
    </div>
  );
}
