"use client";

// One-time notices, keyed.
//
// This started as a single hardcoded flag for the holidays notice. It is keyed
// now because there is more than one announcement, and the alternative was a
// second copy of the same subtle rules: the new-device claim below is the part
// that is easy to get wrong, and it should exist once.
//
// Read during render through useSyncExternalStore rather than an effect, the
// same as the other first-run flags, so the first paint is already correct and
// React's compiler does not flag a setState in render.

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * How long a notice holds before rising.
 *
 * The launch overlay runs about 1.8s at `z-100` and a Sheet lives at `z-50`, so
 * without the wait it slides up entirely behind the splash and is simply THERE
 * when the splash lifts. Arriving a beat after the screen settles is also the
 * better order: you see your own dashboard first, then the notice.
 */
const HOLD_MS = 2100;

/**
 * When the hold expires, held at module scope on purpose, and SHARED by every
 * notice.
 *
 * AppShell remounts on every navigation, so a timer owned by a component would
 * restart each time a tab was tapped and could be outrun indefinitely. Measured
 * once from the first mount of the session instead. Sharing it across notices
 * is correct rather than merely convenient: it is one fact, when the launch is
 * over, not one per sheet.
 */
let riseAt: number | null = null;

/** True once the launch has had its beat. */
export function useNoticeHold(open: boolean): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!open) return;
    riseAt ??= Date.now() + HOLD_MS;
    // Always through a timer, never a synchronous setState: the compiler lint
    // rejects setting state during an effect, and 0ms behaves identically.
    const t = setTimeout(() => setHeld(true), Math.max(0, riseAt - Date.now()));
    return () => clearTimeout(t);
  }, [open]);
  return held;
}

/** The notices this app can show. The value is the localStorage key. */
export const NOTICE = {
  holidays: "skipp.seen-holidays-update",
  stone: "skipp.seen-stone-theme",
  attendance: "skipp.seen-attendance-back",
} as const;

export type Notice = (typeof NOTICE)[keyof typeof NOTICE];

/** Where the saved session lives. Read only, and only to date the device. */
const CRED_KEY = "skipp.cred";

let listeners: (() => void)[] = [];

function subscribe(cb: () => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

function seen(key: Notice): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    // Private mode: claim seen. A notice nobody can dismiss permanently is
    // worse than one nobody sees.
    return true;
  }
}

// The server cannot know, so claim seen: a sheet that flashes up on hydration
// and then disappears is worse than one that arrives a frame late.
const getServerSnapshot = () => true;

export function useSeenNotice(key: Notice): boolean {
  return useSyncExternalStore(subscribe, () => seen(key), getServerSnapshot);
}

export function markNoticeSeen(key: Notice) {
  try {
    if (localStorage.getItem(key) === "1") return;
    localStorage.setItem(key, "1");
  } catch {
    /* private mode: it may appear again next launch, which is survivable */
  }
  listeners.forEach((l) => l());
}

/**
 * Silently mark EVERY notice as seen on a device that has never run Skipp.
 *
 * "Skipp is updated" is meaningless to somebody signing in for the first time:
 * they have never seen the Skipp before the change, so the notice would be an
 * interruption during their first run announcing something they cannot
 * perceive.
 *
 * There is no record of which build a device last ran, so the proxy is whether
 * a saved session already exists. **This has to be called BEFORE they sign in**,
 * because a minute later a brand new student has credentials too and the two
 * become indistinguishable. The entry screen is the only place that can tell.
 */
export function claimIfNewDevice() {
  try {
    if (localStorage.getItem(CRED_KEY)) return; // had Skipp already: let them show
    let changed = false;
    for (const key of Object.values(NOTICE)) {
      if (localStorage.getItem(key) === "1") continue;
      localStorage.setItem(key, "1");
      changed = true;
    }
    if (changed) listeners.forEach((l) => l());
  } catch {
    /* private mode: nothing to claim */
  }
}
