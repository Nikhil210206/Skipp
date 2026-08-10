"use client";

import { useShouldOfferInstall } from "@/components/InstallGate";

/**
 * How long the pad is, and which sheet each screen is.
 *
 * The way in is one notebook, but it is built from three components that never
 * co-exist: the welcome, the install offer, and the six chapters. Nobody can
 * count the pages from inside their own sheet, and getting it wrong shows
 * immediately, because the number and the rail are printed in the corner of
 * every page.
 *
 * **The install offer is conditional**, so the pad is eight sheets on a phone
 * and seven on a laptop. It is asked here rather than assumed, from the same
 * hook the offer itself uses, so the two can never disagree about whether that
 * page exists.
 */
export const CHAPTER_COUNT = 6;

export function useDeckPages(): {
  total: number;
  /** 1 based number of the welcome sheet. */
  welcome: number;
  /** 1 based number of the install sheet, if it is in the pad at all. */
  install: number | null;
  /** 1 based number of the first chapter, the rest follow it. */
  firstChapter: number;
} {
  const hasInstall = useShouldOfferInstall();
  return {
    total: CHAPTER_COUNT + (hasInstall ? 2 : 1),
    welcome: 1,
    install: hasInstall ? 2 : null,
    firstChapter: hasInstall ? 3 : 2,
  };
}
