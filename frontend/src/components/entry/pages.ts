"use client";

import { useSyncExternalStore } from "react";
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
 *
 * **And a sheet that has been turned stays in the pad.** Turning past the
 * install offer snoozes it, which switches that hook off, which used to take a
 * sheet out of the pad the reader was holding: the deck ran 01, 02, then back
 * to 02, and signed off on 07 having just been an eight page pad, with a rung
 * disappearing from the rail on the way.
 *
 * So the offer latches on the first time it is actually shown, for the life of
 * the page load. It is module scope for the usual reason: the three screens are
 * separate components mounting at different moments, so a memory held by any
 * one of them would just capture the answer after the dismissal.
 *
 * It is a store rather than a variable written during render because a render
 * that mutates module state is impure, and the React compiler lint says so.
 */
export const CHAPTER_COUNT = 6;

let offered = false;
const listeners = new Set<() => void>();

/**
 * Record that the install sheet is part of this pad.
 *
 * Called by the sheet itself as it mounts, which is the only moment that knows
 * the offer was really made. Reading the offer's own live answer is not enough,
 * since by the time the chapters ask, the turn has already snoozed it.
 */
export function markInstallOffered(): void {
  if (offered) return;
  offered = true;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const read = () => offered;
/** The server renders no pad, and it has no user agent worth trusting either. */
const readOnServer = () => false;

export function useDeckPages(): {
  total: number;
  /** 1 based number of the welcome sheet. */
  welcome: number;
  /** 1 based number of the install sheet, if it is in the pad at all. */
  install: number | null;
  /** 1 based number of the first chapter, the rest follow it. */
  firstChapter: number;
} {
  const live = useShouldOfferInstall();
  const latched = useSyncExternalStore(subscribe, read, readOnServer);
  const hasInstall = live || latched;
  return {
    total: CHAPTER_COUNT + (hasInstall ? 2 : 1),
    welcome: 1,
    install: hasInstall ? 2 : null,
    firstChapter: hasInstall ? 3 : 2,
  };
}
