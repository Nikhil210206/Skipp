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
  | "terminal"
  | "stone"
  | "rose"
  | "ember"
  | "gold"
  | "fern"
  | "teal"
  | "azure"
  | "indigo"
  | "violet"
  | "bloom"
  | "meadow";

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
    id: "stone",
    name: "Stone",
    note: "Lit plaster, sharp planes",
    // The wall itself, so the phone's status bar matches the page. This was
    // left at a pale grey from an abandoned daylight version of the theme,
    // which would have flashed a light bar over a dark app on every launch.
    bar: "#32322e",
    swatch: ["#32322e", "#3b3c37", "#ffc21f"],
    structural: true,
  },
  {
    id: "ink",
    name: "Ink",
    note: "The original",
    bar: "#000000",
    swatch: ["#000000", "#1e1e1e", "#f2661c"],
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
    note: "No hue, hard contrast",
    bar: "#000000",
    swatch: ["#000000", "#2e2e2e", "#ffffff"],
  },
  {
    id: "paper",
    name: "Paper",
    note: "Plain light",
    bar: "#f9f6f0",
    swatch: ["#f9f6f0", "#e6dfcf", "#c04a07"],
  },
  {
    id: "sand",
    name: "Sand",
    note: "Warm light",
    bar: "#ede6dc",
    swatch: ["#ede6dc", "#cac2b2", "#b0400a"],
  },
  {
    id: "rose",
    name: "Rose",
    note: "Deep pink",
    bar: "#3f0323",
    swatch: ["#3f0323", "#72294a", "#fd64aa"],
  },
  {
    id: "ember",
    name: "Ember",
    note: "Warm orange",
    bar: "#3b1100",
    swatch: ["#3b1100", "#742f07", "#fd7428"],
  },
  {
    id: "gold",
    name: "Gold",
    note: "Bright yellow",
    bar: "#272000",
    swatch: ["#272000", "#534700", "#fee219"],
  },
  {
    id: "fern",
    name: "Fern",
    note: "Living green",
    bar: "#002909",
    swatch: ["#002909", "#0c5622", "#1bd259"],
  },
  {
    id: "teal",
    name: "Teal",
    note: "Cool water",
    bar: "#002727",
    swatch: ["#002727", "#005253", "#1ccbcd"],
  },
  {
    id: "azure",
    name: "Azure",
    note: "True blue",
    bar: "#00223d",
    swatch: ["#00223d", "#004b79", "#20a5fc"],
  },
  {
    id: "indigo",
    name: "Indigo",
    note: "Deep blue violet",
    bar: "#20144a",
    swatch: ["#20144a", "#463b7d", "#9c8dfc"],
  },
  {
    id: "violet",
    name: "Violet",
    note: "Electric purple",
    bar: "#340a3a",
    swatch: ["#340a3a", "#613069", "#e761fd"],
  },
  {
    id: "bloom",
    name: "Bloom",
    note: "Light and pink",
    bar: "#ffe7ef",
    swatch: ["#ffe7ef", "#eeb0c7", "#c60e76"],
  },
  {
    id: "meadow",
    name: "Meadow",
    note: "Light and green",
    bar: "#dcf7df",
    swatch: ["#dcf7df", "#a2d3a8", "#097930"],
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
