"use client";

// Dark/light theme. The switch is a `data-theme` attribute on <html>;
// globals.css swaps the colour tokens under it. THEME_INIT_SCRIPT (in
// themeScript.ts) applies the stored choice before first paint, so there is no
// flash of the wrong theme.

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "./themeScript";

export type Theme = "dark" | "light";
const BAR_COLOR: Record<Theme, string> = { dark: "#08080a", light: "#ffffff" };

const listeners = new Set<() => void>();

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function setTheme(t: Theme): void {
  document.documentElement.dataset.theme = t;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", BAR_COLOR[t]);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, t);
  } catch {
    /* storage unavailable, the theme still applies for this session */
  }
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** The active theme, kept in sync with the DOM attribute. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => "dark" as Theme);
}
