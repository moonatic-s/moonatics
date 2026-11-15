import deckCss from "./styles.css?inline";
import classicCss from "./styles-classic.css?inline";

/** "deck": the field-manual look (default). "classic": the original dark navy look. */
export type Theme = "deck" | "classic";
const KEY = "moonatics:theme";

export function readTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === "classic" ? "classic" : "deck";
  } catch {
    return "deck";
  }
}

/** Swaps the stylesheet. Only one look is loaded at a time, so they never mix. */
export function applyTheme(theme: Theme): void {
  let el = document.getElementById("theme-css") as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = "theme-css";
    document.head.appendChild(el);
  }
  el.textContent = theme === "classic" ? classicCss : deckCss;
  document.documentElement.dataset["theme"] = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* the choice just isn't remembered */
  }
}
