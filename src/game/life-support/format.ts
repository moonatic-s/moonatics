/** Number formatting shared by the Life Support console. */
export const fmt = (n: number, digits: number): string =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

export const signedFmt = (n: number, digits: number): string =>
  `${n > 0 ? "+" : n < 0 ? "−" : "±"}${fmt(Math.abs(n), digits)}`;
