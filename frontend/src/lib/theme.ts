"use client";

// Themes. The switch is a `data-theme` attribute on <html>; globals.css swaps
// the tokens under it. THEME_INIT_SCRIPT (in themeScript.ts) applies the stored
// choice before first paint, so there is no flash of the wrong theme.
//
// Two of these are looks rather than palettes: brutal and clay also move
// radius, shadow and border weight, which is why those are tokens.

import { useSyncExternalStore } from "react";
import {
  LEGACY_THEMES,
  THEME_STORAGE_KEY,
  ZINE_NIGHT_BAR,
  ZINE_STOCK_KEY,
} from "./themeScript";

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
  | "register"
  | "ticket"
  | "zine"
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
  // The full looks, in the order they are offered everywhere: Zine, the
  // newest, then Ticket and Brutal, Terminal and Register, Clay and Stone.
  {
    id: "zine",
    name: "Zine",
    note: "Two inks, day or night",
    // The COMPOSITED page, not ink-0: the paper grain is multiplied into the
    // page and does not reach the status bar, so ink-0 there would paint a
    // brighter strip above a duller page. Same rule Paper and Stone follow.
    bar: "#eed7dc",
    swatch: ["#eed7dc", "#26246f", "#b51f30"],
    structural: true,
  },
  {
    id: "ticket",
    name: "Ticket",
    note: "Passes, stubs, a bunk pass",
    bar: "#f6f3ec",
    swatch: ["#f6f3ec", "#121110", "#ff6b1f"],
    structural: true,
  },
  {
    id: "brutal",
    name: "Brutal",
    note: "Blocks, hard shadows, filled labels",
    bar: "#fdf6e3",
    swatch: ["#fdf6e3", "#ffd54a", "#ff4a00"],
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
    id: "register",
    name: "Register",
    note: "Tick boxes and ruled rows",
    bar: "#eefafc",
    swatch: ["#eefafc", "#05262e", "#22c7e8"],
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

/** The status bar for a theme, which for Zine depends on its stock. */
function barFor(t: Theme): string | undefined {
  if (t === "zine" && readStock() === "night") return ZINE_NIGHT_BAR;
  return THEMES.find((x) => x.id === t)?.bar;
}

export function setTheme(t: Theme): void {
  document.documentElement.dataset.theme = t;
  const bar = barFor(t);
  if (bar) {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", bar);
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

/**
 * ZINE'S TWO STOCKS. The day print is blue ink on pink stock; the night run is
 * a cyanotype, the stock itself gone blueprint blue and the print left cream.
 * The same two drums run in both: one prints everything, the other prints
 * trouble (red by day, coral by night) and nothing else.
 *
 * It is a property of Zine rather than a theme of its own, so Profile offers
 * it once Zine is chosen and the look order stays one tile long. The colours
 * here paint the proofs in the picker; the stylesheet owns the real tokens.
 */
export type ZineStock = "day" | "night";

export const ZINE_STOCKS: {
  id: ZineStock;
  name: string;
  note: string;
  paper: string;
  ink: string;
  trouble: string;
}[] = [
  { id: "day", name: "Day print", note: "Blue on pink", paper: "#eed7dc", ink: "#26246f", trouble: "#b51f30" },
  { id: "night", name: "Night run", note: "Cream on blueprint", paper: ZINE_NIGHT_BAR, ink: "#f2ede0", trouble: "#ff8f7a" },
];

function readStock(): ZineStock {
  return document.documentElement.dataset.stock === "night" ? "night" : "day";
}

export function setZineStock(s: ZineStock): void {
  const root = document.documentElement;
  if (s === "night") root.dataset.stock = "night";
  else delete root.dataset.stock;
  const bar = barFor(readTheme());
  if (bar) {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", bar);
  }
  try {
    if (s === "night") localStorage.setItem(ZINE_STOCK_KEY, "night");
    else localStorage.removeItem(ZINE_STOCK_KEY);
  } catch {
    /* storage unavailable, the stock still applies for this session */
  }
  for (const l of listeners) l();
}

/** Zine's stock, whether or not Zine is the look on screen. */
export function useZineStock(): ZineStock {
  return useSyncExternalStore(subscribe, readStock, () => "day" as ZineStock);
}

/**
 * The full looks that change how Home and Attendance are COMPOSED, not only
 * how they are styled.
 *
 * Every other look is CSS over the shared screens, through the markers on the
 * primitives. These three need pieces the shared markup cannot draw: Register's
 * tick box grid and period strip, Ticket's passes with their stubs and stamp,
 * Zine's printed objects (keys, a matchbox, a strand of barbed wire) and its
 * rubber stamps. So those two screens swap in their own composition, and every
 * other screen stays shared and is restyled by CSS like any other look.
 */
export type Composition = "register" | "ticket" | "zine";

export function useComposition(): Composition | null {
  const t = useTheme();
  return t === "register" || t === "ticket" || t === "zine" ? t : null;
}
