// Kept free of React imports so the server-rendered layout can inline it.

export const THEME_STORAGE_KEY = "skipp.theme";

/** Renames. A saved preference must survive one, or the student silently gets
 *  Ink back on their next launch. */
export const LEGACY_THEMES: Record<string, string> = {
  dark: "ink",
  light: "paper",
  concrete: "stone",
};

const VALID = [
  "ink",
  "slate",
  "mono",
  "paper",
  "sand",
  "brutal",
  "clay",
  "terminal",
  "stone",
  "rose",
  "ember",
  "gold",
  "fern",
  "teal",
  "azure",
  "indigo",
  "violet",
  "bloom",
  "meadow",
];

/** Status bar colour per theme, applied before paint so it never flashes. */
const BARS: Record<string, string> = {
  ink: "#000000",
  slate: "#0a0f16",
  mono: "#000000",
  paper: "#f9f6f0",
  sand: "#ede6dc",
  brutal: "#fdf6e3",
  clay: "#eceefa",
  terminal: "#040705",
  stone: "#32322e",
  rose: "#3f0323",
  ember: "#3b1100",
  gold: "#272000",
  fern: "#002909",
  teal: "#002727",
  azure: "#00223d",
  indigo: "#20144a",
  violet: "#340a3a",
  bloom: "#ffe7ef",
  meadow: "#dcf7df",
};

/**
 * Runs before paint. Marks the document as JS-capable (so animated elements can
 * start hidden without ever hiding content from a no-JS reader) and applies the
 * saved theme, defaulting to dark.
 */
export const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement;d.classList.add("js");var L=${JSON.stringify(LEGACY_THEMES)},V=${JSON.stringify(
  VALID,
)},B=${JSON.stringify(BARS)};try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");t=L[t]||t;t=V.indexOf(t)>-1?t:"ink";d.dataset.theme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",B[t])}catch(e){d.dataset.theme="ink"}})();`;
