/**
 * THE ROOMS.
 *
 * Every chapter of the tour is set in a different look, so the tour doubles as
 * the showcase: by the time a student reaches "pick a look" they have already
 * stood in four of them. Chosen with the user from three mocked directions
 * (2026-10-27), as "C, the rooms".
 *
 * These are the looks' own colours, copied from their blocks in `globals.css`,
 * and they have to be: the themes are scoped to `<html>`, so a chapter cannot
 * borrow Brutal's tokens while the app underneath is still Ink. If a look's
 * palette moves, its room here should move with it.
 *
 * The one exception is `look`, which paints with the LIVE tokens on purpose:
 * that chapter is where you choose, and the room has to become your choice.
 */

export type Control = "pill" | "block" | "bracket" | "pixel";

export type Room = {
  /** The field. */
  bg: string;
  /** What `theme-color` gets. A real colour, never `var()`. */
  bar: string;
  ink: string;
  dim: string;
  faint: string;
  line: string;
  /** The loud colour, as a FILL: the primary button, the punch slots. */
  accent: string;
  onAccent: string;
  /** The accent when it has to be read as text on `bg`. */
  accentText: string;
  /** The headline face. */
  head: string;
  /** How this look draws a button. */
  control: Control;
};

export const ROOMS = {
  ink: {
    bg: "#000000",
    bar: "#000000",
    ink: "#f5f5f5",
    dim: "#a1a1a1",
    faint: "#6f6f6f",
    line: "#262626",
    accent: "#f2661c",
    onAccent: "#140700",
    accentText: "#f2661c",
    head: "var(--font-geist-sans), sans-serif",
    control: "pill",
  },
  brutal: {
    bg: "#fdf6e3",
    bar: "#fdf6e3",
    ink: "#000000",
    dim: "#2b2b2b",
    faint: "#575757",
    line: "#000000",
    accent: "#ff4a00",
    // Black, not Brutal's own white: white on this orange is 3.6:1, and a
    // button label is not large text.
    onAccent: "#000000",
    accentText: "#c43800",
    head: "var(--font-geist-sans), sans-serif",
    control: "block",
  },
  ticket: {
    bg: "#f6f3ec",
    bar: "#f6f3ec",
    ink: "#141210",
    dim: "#3d3832",
    faint: "#6b655b",
    line: "#d9d2c4",
    // Ticket keeps two oranges for the reason recorded in CLAUDE.md: the loud
    // one fails as text on cream, so it is only ever a fill.
    accent: "#ff6b1f",
    onAccent: "#141210",
    accentText: "#b03f05",
    head: "var(--font-ticket-src), var(--font-geist-sans), sans-serif",
    control: "pill",
  },
  look: {
    bg: "var(--color-ink-0)",
    bar: "#000000",
    ink: "var(--color-text-1)",
    dim: "var(--color-text-2)",
    faint: "var(--color-text-3)",
    line: "var(--color-line)",
    accent: "var(--color-accent)",
    onAccent: "var(--color-accent-ink)",
    accentText: "var(--color-accent)",
    head: "var(--font-sans)",
    control: "pill",
  },
  terminal: {
    bg: "#040705",
    bar: "#040705",
    ink: "#d7f6e4",
    dim: "#7fb094",
    faint: "#4e7861",
    line: "#1e2f24",
    accent: "#3ef08c",
    onAccent: "#041209",
    accentText: "#3ef08c",
    head: "var(--font-geist-mono), monospace",
    control: "bracket",
  },
  arcade: {
    bg: "#000000",
    bar: "#000000",
    ink: "#f4f4ff",
    dim: "#b4b4dc",
    faint: "#8080b0",
    line: "#2121ff",
    accent: "#ffe600",
    onAccent: "#000000",
    accentText: "#ffe600",
    head: "var(--font-pixel-src), var(--font-geist-mono), monospace",
    control: "pixel",
  },
  clay: {
    bg: "#eceefa",
    bar: "#eceefa",
    ink: "#23243a",
    dim: "#5f6386",
    faint: "#7a7fa3",
    line: "#dfe3f7",
    accent: "#6b4dff",
    onAccent: "#ffffff",
    accentText: "#5a3cf0",
    head: "var(--font-puffy-src), var(--font-geist-sans), sans-serif",
    control: "pill",
  },
} as const satisfies Record<string, Room>;

export type RoomId = keyof typeof ROOMS;
