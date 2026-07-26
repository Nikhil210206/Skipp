// Kept free of React imports so the server-rendered layout can inline it.

export const THEME_STORAGE_KEY = "skipp.theme";

/**
 * Runs before paint. Marks the document as JS-capable (so animated elements can
 * start hidden without ever hiding content from a no-JS reader) and applies the
 * saved theme, defaulting to dark.
 */
export const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement;d.classList.add("js");try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");d.dataset.theme=t==="light"?"light":"dark"}catch(e){d.dataset.theme="dark"}})();`;
