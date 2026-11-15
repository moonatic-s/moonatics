/** Small pure helpers shared by the simulation modules. */

/** Clamp to [min, max]. Callers sanitise input with `toNum` first, so NaN never reaches here from the UI. */
export const clamp = (val: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, val));

export const roundTo = (val: number, decimals = 1): number => {
  const factor = 10 ** decimals;
  return Math.round(val * factor) / factor;
};

/** Coerce UI input to a finite number; null/undefined/''/NaN/Infinity fall back to `fallback`. */
export function toNum(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Index into a dataset array that is known to be in range; fails loudly if the data is malformed. */
export function at<T>(items: readonly T[], index: number, label = "series"): T {
  const item = items[index];
  if (item === undefined) {
    throw new RangeError(
      `Missing ${label} entry at index ${index} (length ${items.length})`,
    );
  }
  return item;
}
