/**
 * One colour per sheet.
 *
 * The pad is a single stock, so the journey lives in the ink instead of in the
 * paper: you turn the page and somebody has picked up a different pen. Each
 * page keeps to its own colour throughout, and only the TOOL changes within a
 * page, because a page written in three colours reads as a mess rather than as
 * notes.
 *
 * All eight are dark enough to clear 4.5:1 on the cream, which is the ceiling
 * on how bright any of them can go.
 *
 * **This module imports nothing, deliberately.** It was first written into
 * `pages.ts`, which imports the install offer hook from `InstallGate`, which
 * imports the inks back: a genuine cycle that failed at runtime with "cannot
 * access INKS before initialization" and took the whole entry screen to the
 * error boundary. Constants that everything wants belong somewhere with no
 * edges out.
 */
export const INKS = {
  welcome: "#2E1065",
  hello: "#1D3B8B",
  install: "#0E6B63",
  does: "#98122F",
  line: "#1B5E37",
  look: "#5B21B6",
  who: "#7A4718",
  ready: "#33333D",
} as const;
