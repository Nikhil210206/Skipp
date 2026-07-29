"use client";

// Themes. The switch is a `data-theme` attribute on <html>; globals.css swaps
// the tokens under it. THEME_INIT_SCRIPT (in themeScript.ts) applies the stored
// choice before first paint, so there is no flash of the wrong theme.
//
// Two of these are looks rather than palettes: brutal and clay also move
// radius, shadow and border weight, which is why those are tokens.

import { useSyncExternalStore } from "react";
import { LEGACY_THEMES, THEME_STORAGE_KEY } from "./themeScript";

export type Theme =
  | "ink"
  | "slate"
  | "mono"
  | "paper"
  | "sand"
  | "brutal"
  | "clay"
  | "terminal";

export type ThemeInfo = {
  id: Theme;
  name: string;
  note: string;
  /** Drives the browser/status bar colour, so the chrome matches the page. */
  bar: string;
  /** Three tones for the picker swatch: page, surface, accent. */
  swatch: [string, string, string];
  /** True when the theme changes structure, not just colour. */
  structural?: true;
};

export const THEMES: ThemeInfo[] = [
  {
    id: "brutal",
    name: "Brutal",
    note: "Blocks, hard shadows, filled labels",
    bar: "#fdf6e3",
    swatch: ["#fdf6e3", "#ffd54a", "#ff4a00"],
    structural: true,
  },
  {
    id: "clay",
    name: "Clay",
    note: "Soft cards, round everything",
    bar: "#eceefa",
    swatch: ["#eceefa", "#d9ddf7", "#6b4dff"],
    structural: true,
  },
  {
    id: "terminal",
    name: "Terminal",
    note: "Monospace, phosphor, drawn boxes",
    bar: "#040705",
    swatch: ["#040705", "#17251b", "#3ef08c"],
    structural: true,
  },
  {
    id: "ink",
    name: "Ink",
    note: "The original",
    bar: "#08080a",
    swatch: ["#08080a", "#1f1f25", "#f2661c"],
  },
  {
    id: "slate",
    name: "Slate",
    note: "Cool and dim",
    bar: "#0a0f16",
    swatch: ["#0a0f16", "#21303f", "#38bdf8"],
  },
  {
    id: "mono",
    name: "Mono",
    note: "No hue unless something is wrong",
    bar: "#000000",
    swatch: ["#000000", "#1f1f1f", "#ffffff"],
  },
  {
    id: "paper",
    name: "Paper",
    note: "Plain light",
    bar: "#ffffff",
    swatch: ["#ffffff", "#e5e5e9", "#d2530b"],
  },
  {
    id: "sand",
    name: "Sand",
    note: "Warm light",
    bar: "#faf6ef",
    swatch: ["#faf6ef", "#ded2be", "#b8430b"],
  },
];

const IDS = new Set<string>(THEMES.map((t) => t.id));

/** Accepts the old dark/light values, so a saved preference survives. */
export function normalizeTheme(value: string | null): Theme {
  if (!value) return "ink";
  const migrated = LEGACY_THEMES[value] ?? value;
  return IDS.has(migrated) ? (migrated as Theme) : "ink";
}

const listeners = new Set<() => void>();

function readTheme(): Theme {
  return normalizeTheme(document.documentElement.dataset.theme ?? null);
}

export function setTheme(t: Theme): void {
  document.documentElement.dataset.theme = t;
  const info = THEMES.find((x) => x.id === t);
  if (info) {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", info.bar);
  }
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
  return useSyncExternalStore(subscribe, readTheme, () => "ink" as Theme);
}
