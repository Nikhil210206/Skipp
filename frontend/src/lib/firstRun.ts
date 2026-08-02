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


/* -------------------------------------------------------------------------- */

/**
 * Whether the profile has ever been opened on this device.
 *
 * The profile holds the themes, the display name, the data controls and sign
 * out, and students were not finding it: the mark in the masthead read as
 * decoration rather than as a door. An unread dot is the cheapest honest nudge,
 * because it answers itself. It appears once, it goes away the first time the
 * page is opened, and it never comes back.
 */
const PROFILE_KEY = "skipp.seen-profile";

let profileListeners: (() => void)[] = [];

function subscribeProfile(cb: () => void) {
  profileListeners.push(cb);
  return () => {
    profileListeners = profileListeners.filter((l) => l !== cb);
  };
}

function profileSnapshot(): boolean {
  try {
    return localStorage.getItem(PROFILE_KEY) === "1";
  } catch {
    return true;
  }
}

// Claim "seen" on the server, so the dot cannot flash on for a student who has
// already been. It appears on hydration for anyone who genuinely has not.
const profileServerSnapshot = () => true;

export function useSeenProfile(): boolean {
  return useSyncExternalStore(subscribeProfile, profileSnapshot, profileServerSnapshot);
}

export function markProfileSeen() {
  try {
    if (localStorage.getItem(PROFILE_KEY) === "1") return;
    localStorage.setItem(PROFILE_KEY, "1");
  } catch {
    /* private mode: the dot stays, which is harmless */
  }
  profileListeners.forEach((l) => l());
}
