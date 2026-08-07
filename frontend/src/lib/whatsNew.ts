"use client";

// The one-time notice that the calendar now shows holidays.
//
// Read during render through useSyncExternalStore rather than an effect, the
// same as the other first-run flags, so the first paint is already correct and
// React's compiler does not flag a setState in render.

import { useSyncExternalStore } from "react";

const KEY = "skipp.seen-holidays-update";
/** Where the saved session lives. Read only, and only to date the device. */
const CRED_KEY = "skipp.cred";

let listeners: (() => void)[] = [];

function subscribe(cb: () => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

function getSnapshot(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    // Private mode: claim seen. A notice nobody can dismiss permanently is
    // worse than one nobody sees.
    return true;
  }
}

// The server cannot know, so claim seen: a sheet that flashes up on hydration
// and then disappears is worse than one that arrives a frame late.
const getServerSnapshot = () => true;

export function useSeenHolidaysUpdate(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function markHolidaysUpdateSeen() {
  try {
    if (localStorage.getItem(KEY) === "1") return;
    localStorage.setItem(KEY, "1");
  } catch {
    /* private mode: it may appear again next launch, which is survivable */
  }
  listeners.forEach((l) => l());
}

/**
 * Silently mark the notice as seen on a device that has never run Skipp.
 *
 * "Skipp is updated" is meaningless to somebody signing in for the first time:
 * they have never seen a Skipp without holidays on the calendar, so the notice
 * would be an interruption during their first run announcing the absence of a
 * change they cannot perceive.
 *
 * There is no record of which build a device last ran, so the proxy is whether
 * a saved session already exists. **This has to be called BEFORE they sign in**,
 * because a minute later a brand new student has credentials too and the two
 * become indistinguishable. The entry screen is the only place that can tell.
 */
export function claimIfNewDevice() {
  try {
    if (localStorage.getItem(KEY) === "1") return;
    if (localStorage.getItem(CRED_KEY)) return; // had Skipp already: let it show
    localStorage.setItem(KEY, "1");
    listeners.forEach((l) => l());
  } catch {
    /* private mode: nothing to claim */
  }
}
