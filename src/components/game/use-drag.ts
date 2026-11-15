import { useCallback, useRef, useState, type PointerEvent, type RefObject } from "react";
import { sfx } from "@/game/audio/sfx";

/**
 * Pointer drag-and-drop for "put this part in that spot". A press that never moves is an ordinary click, so the
 * same buttons also work by tap/keyboard (select the part, then select the spot).
 * Drop spots are any elements inside `root` with a `data-slot` attribute.
 */
export function useDragPlace<T extends string>({
  root,
  onDrop,
}: {
  root: RefObject<HTMLElement | null>;
  /** Called with the dragged item and the `data-slot` value under the pointer (null if dropped on nothing). */
  onDrop: (item: T, slot: string | null) => void;
}) {
  const [drag, setDrag] = useState<{ item: T; x: number; y: number } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const suppressClick = useRef(false);

  const slotAt = useCallback(
    (x: number, y: number): string | null => {
      const slots = root.current?.querySelectorAll<HTMLElement>("[data-slot]") ?? [];
      for (const el of slots) {
        const r = el.getBoundingClientRect();
        const pad = 18;
        if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad)
          return el.dataset["slot"] ?? null;
      }
      return null;
    },
    [root],
  );

  const press = (item: T) => (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const sx = e.clientX;
    const sy = e.clientY;
    let moved = false;
    const move = (m: globalThis.PointerEvent) => {
      if (!moved && Math.hypot(m.clientX - sx, m.clientY - sy) < 6) return;
      if (!moved) sfx.grab();
      moved = true;
      setDrag({ item, x: m.clientX, y: m.clientY });
      setOver(slotAt(m.clientX, m.clientY));
    };
    const up = (u: globalThis.PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      setDrag(null);
      setOver(null);
      if (moved) {
        suppressClick.current = true;
        onDrop(item, slotAt(u.clientX, u.clientY));
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  /** Call from onClick: returns true if this click was really the end of a drag (so it must be ignored). */
  const wasDrag = (): boolean => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return true;
    }
    return false;
  };

  return { drag, over, press, wasDrag };
}
