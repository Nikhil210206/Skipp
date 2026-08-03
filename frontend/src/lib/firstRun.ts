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
 * Whether this device has been greeted.
 *
 * The welcome comes before the install offer, because asking a stranger to put
 * something on their home screen before telling them what it is reads as a
 * demand rather than an invitation. It is also where the choice between the
 * installed app and the browser is actually made.
 */
const WELCOME_KEY = "skipp.seen-welcome";

let welcomeListeners: (() => void)[] = [];

function subscribeWelcome(cb: () => void) {
  welcomeListeners.push(cb);
  return () => {
    welcomeListeners = welcomeListeners.filter((l) => l !== cb);
  };
}

function welcomeSnapshot(): boolean {
  try {
    return localStorage.getItem(WELCOME_KEY) === "1";
  } catch {
    return true;
  }
}

// Claim "seen" on the server so a returning student never sees it flash past.
const welcomeServerSnapshot = () => true;

export function useSeenWelcome(): boolean {
  return useSyncExternalStore(subscribeWelcome, welcomeSnapshot, welcomeServerSnapshot);
}

export function markWelcomeSeen() {
  try {
    localStorage.setItem(WELCOME_KEY, "1");
  } catch {
    // Private mode: they get greeted again next launch, which is survivable.
  }
  welcomeListeners.forEach((l) => l());
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
