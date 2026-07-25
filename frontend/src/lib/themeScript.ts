// Kept free of React imports so the server-rendered layout can inline it.

export const THEME_STORAGE_KEY = "skipp.theme";

/** Runs before paint: applies the saved theme, defaulting to dark. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");document.documentElement.dataset.theme=t==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}})();`;
