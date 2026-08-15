"use client";

// When to ask a student how Skipp is going.
//
// The rules are the interesting part, not the storage. A prompt that arrives
// at the wrong moment is worse than no prompt: asking somebody what they think
// of an app they opened ninety seconds ago produces a shrug, and asking every
// launch produces resentment. So there is exactly one date in localStorage,
// when to next ask, and every path through the sheet pushes it forward.
//
// Read during render through useSyncExternalStore rather than an effect, the
// same as the other first-run flags, so the first paint is already correct and
// React's compiler does not flag a setState in render.

import { useSyncExternalStore } from "react";

/** When we may next ask. Absent means the schedule has not been seeded yet. */
const DUE_KEY = "skipp.feedback.due";

/** The saved session. Read only, and only to tell a new device from an old one. */
const CRED_KEY = "skipp.cred";

const DAY_MS = 86_400_000;

/** How long before we ask again, whatever the answer was. */
export const PROMPT_EVERY_DAYS = 30;

/**
 * How long a brand new student gets before being asked anything.
 *
 * They have no opinion yet. A week is roughly the point at which somebody has
 * seen a real week of their own timetable, missed a class, and watched the
 * number move, which is when they have something to say.
 */
const NEW_DEVICE_DAYS = 7;

let listeners: (() => void)[] = [];

function subscribe(cb: () => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

function announce() {
  listeners.forEach((l) => l());
}

function readDue(): number | null {
  try {
    const raw = localStorage.getItem(DUE_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeDue(at: number) {
  try {
    localStorage.setItem(DUE_KEY, String(at));
  } catch {
    /* private mode: they may be asked again next launch, which is survivable */
  }
  announce();
}

function due(): boolean {
  const at = readDue();
  // An unseeded device is never due. The failure mode of this feature has to
  // be a prompt that does not appear, not one that ambushes somebody on their
  // first launch.
  return at !== null && Date.now() >= at;
}

// The server cannot know, and a prompt that flashes up on hydration and then
// vanishes is worse than one that arrives a frame late.
const getServerSnapshot = () => false;

/** Whether it is time to ask. */
export function useFeedbackDue(): boolean {
  return useSyncExternalStore(subscribe, due, getServerSnapshot);
}

/**
 * Set the first prompt date, on the entry screen, before anybody signs in.
 *
 * **This has to run before sign-in**, for the same reason `claimIfNewDevice`
 * does: a saved session is the only thing that separates a student who already
 * had Skipp from one arriving for the first time, and a minute later they both
 * have one and look identical.
 *
 * A device that already has a session has been using Skipp since before this
 * feature existed, so it is due immediately: those are the students with an
 * opinion worth hearing, and they are the reason the feature was built.
 *
 * Idempotent. It never moves a date that already exists, so it cannot reset a
 * snooze somebody has already earned.
 */
export function seedFeedbackSchedule() {
  if (readDue() !== null) return;
  try {
    const returning = Boolean(localStorage.getItem(CRED_KEY));
    writeDue(Date.now() + (returning ? 0 : NEW_DEVICE_DAYS * DAY_MS));
  } catch {
    /* private mode: nothing to seed */
  }
}

/**
 * The safety net, for a device that never passed through the entry screen.
 *
 * The installed app starts at "/" so `seedFeedbackSchedule` normally runs
 * first, but a deep link or a restored tab can land straight on a signed-in
 * screen. Seeding here treats them as new rather than returning, which is the
 * cautious way round: the worst case is being asked a week later than ideal.
 */
export function ensureFeedbackSchedule() {
  if (readDue() !== null) return;
  writeDue(Date.now() + NEW_DEVICE_DAYS * DAY_MS);
}

/** Asked and answered, one way or the other. Ask again next month. */
export function snoozeFeedback() {
  writeDue(Date.now() + PROMPT_EVERY_DAYS * DAY_MS);
}
