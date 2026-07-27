"use client";

// Whether this device has been through the opening. Read during render via
// useSyncExternalStore rather than an effect, so the first paint is already
// correct and React's compiler does not flag a setState in render.

import { useSyncExternalStore } from "react";

const KEY = "skipp.seen-intro";

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
    return true;
  }
}

// The server has no idea; claim "seen" so a returning user never sees the
// opening flash past on hydration. The page shows its restore spinner first
// either way, so a first-time user still gets it.
const getServerSnapshot = () => true;

export function useSeenIntro(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function markIntroSeen() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Private mode: the opening plays again next time, which is survivable.
  }
  listeners.forEach((l) => l());
}
