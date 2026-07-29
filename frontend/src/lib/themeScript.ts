// Kept free of React imports so the server-rendered layout can inline it.

export const THEME_STORAGE_KEY = "skipp.theme";

/** The two values that existed before themes were named. */
export const LEGACY_THEMES: Record<string, string> = {
  dark: "ink",
  light: "paper",
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
  ink: "#08080a",
  slate: "#0a0f16",
  mono: "#000000",
  paper: "#ffffff",
  sand: "#faf6ef",
  brutal: "#fdf6e3",
  clay: "#eceefa",
  terminal: "#040705",
  rose: "#0c0709",
  ember: "#0b0705",
  gold: "#0a0904",
  fern: "#050a07",
  teal: "#04090a",
  azure: "#05080d",
  indigo: "#07070f",
  violet: "#0a060f",
  bloom: "#fff7f8",
  meadow: "#f6fbf7",
};

/**
 * Runs before paint. Marks the document as JS-capable (so animated elements can
 * start hidden without ever hiding content from a no-JS reader) and applies the
 * saved theme, defaulting to dark.
 */
export const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement;d.classList.add("js");var L=${JSON.stringify(LEGACY_THEMES)},V=${JSON.stringify(
  VALID,
)},B=${JSON.stringify(BARS)};try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");t=L[t]||t;t=V.indexOf(t)>-1?t:"ink";d.dataset.theme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",B[t])}catch(e){d.dataset.theme="ink"}})();`;
