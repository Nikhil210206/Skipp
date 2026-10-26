"use client";

import { useLayoutEffect } from "react";
import { setTheme, type Theme } from "@/lib/theme";

/**
 * Paints everything around the page in the room's colour, and hands it back.
 *
 * Safari's status bar and toolbar are tinted from `theme-color` and from the
 * page CANVAS, which here is `body` (it carries `--color-ink-0`, `html` carries
 * nothing). A full screen overlay in another colour therefore sits between two
 * bands of the app's own black unless all three are repainted. That was found
 * on a real iPhone twice; see CLAUDE.md, the entry deck's black bands.
 *
 * Two effects on purpose: the paint follows the colour as the rooms change,
 * while the hand back runs once, on the way out, and re-applies the stored
 * theme because that is the only place that knows each theme's bar colour.
 *
 * `bar` is what `theme-color` gets. It must be a real colour, never `var()`,
 * which is why it is separate from `bg`: the look chapter paints with the live
 * theme tokens but still has to name a hex for the browser.
 */
export function usePaintChrome(bg: string, bar: string = bg) {
  useLayoutEffect(() => {
    document.documentElement.style.backgroundColor = bg;
    document.body.style.backgroundColor = bg;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", bar);
  }, [bg, bar]);

  useLayoutEffect(
    () => () => {
      const root = document.documentElement;
      root.style.removeProperty("background-color");
      document.body.style.removeProperty("background-color");
      const stored = root.dataset.theme as Theme | undefined;
      if (stored) setTheme(stored);
    },
    [],
  );
}
