"use client";

// Notifications, raised by the app itself.
//
// **There is no server involved and no push subscription.** The app asks the
// browser for permission once, then raises notifications locally when it
// notices something worth saying: a class about to start, or attendance the
// portal has recorded since the last look.
//
// **What that means, stated plainly, because the UI has to say it too:** these
// arrive when Skipp is OPENED, not while it is closed. The web has no way to
// schedule a notification for later on device (Notification Triggers never
// shipped, Safari never had it), so waking a closed app needs a server holding
// push subscriptions and a schedule. That was built and then removed on
// request, deliberately: it is a real database of other people's class times,
// and the version that would also announce attendance the instant it changed
// would need every student's password plus dozens of portal sign-ins a day
// against a hard cap (SI503). Do not rebuild either without being asked.
//
// So the honest framing is a notification that persists in the tray after you
// glance at the app, not an alarm clock.

import type { AttendanceChange } from "./reminders";
import type { ScheduleItem } from "./schedule";

/** How close a class has to be before it is worth a notification, in minutes. */
export const CLASS_LEAD_MIN = 30;

/**
 * Whether the student has asked for notifications.
 *
 * Kept as our own flag rather than reading `Notification.permission` alone,
 * because **permission cannot be revoked from JavaScript**. Without a local
 * preference, "turn off" would be a button that does nothing: the only honest
 * off switch is to stop raising them ourselves.
 */
const PREF_KEY = "skipp.notify";

export function notificationsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator
  );
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

export function notificationsOn(): boolean {
  if (!notificationsSupported() || Notification.permission !== "granted") return false;
  try {
    return localStorage.getItem(PREF_KEY) === "1";
  } catch {
    return false;
  }
}

/** Asks for permission and records the preference. False on any refusal. */
export async function enableNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;
  try {
    localStorage.setItem(PREF_KEY, "1");
  } catch {
    return false;
  }
  return true;
}

/** Stops raising them. The browser permission itself stays granted, since no
 *  page can withdraw it; this is the part we actually control. */
export function disableNotifications(): void {
  try {
    localStorage.removeItem(PREF_KEY);
  } catch {
    /* private mode */
  }
}

/**
 * iOS refuses notifications entirely until the app is on the home screen, so
 * the setting can point at the install steps rather than showing a dead
 * switch.
 */
export function blockedUntilInstalled(): boolean {
  if (!notificationsSupported()) return false;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const ios =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios && !standalone;
}

/** Returns whether a notification was actually raised. */
async function show(
  title: string,
  options: NotificationOptions & { tag: string },
): Promise<boolean> {
  if (!notificationsOn()) return false;
  try {
    // `getRegistration`, never `ready`. **`navigator.serviceWorker.ready` does
    // not settle when no worker is registered**: it waits for one to activate,
    // so it neither resolves nor rejects, and a try/catch cannot save you. In a
    // dev build (where the worker is registered in production only) or after a
    // failed registration, awaiting it hangs for ever. This resolves either way.
    const reg = await navigator.serviceWorker.getRegistration();
    // A notification must go through the worker: mobile browsers do not
    // support the `new Notification()` constructor at all.
    if (!reg) return false;
    await reg.showNotification(title, {
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      ...options,
    });
    return true;
  } catch {
    // Turned off at the OS level. The in-app Reminders feed still says
    // everything this would have.
    return false;
  }
}

/**
 * What the portal recorded since the last snapshot.
 *
 * Raised from `installSnapshot`, which is the single door fresh data enters
 * by, so it fires exactly once per genuine change.
 */
export async function notifyAttendanceChanges(
  changes: AttendanceChange[],
): Promise<boolean> {
  if (changes.length === 0) return false;

  const missed = changes.filter((c) => c.held - c.present > 0);
  const title =
    missed.length > 0
      ? `${missed.length === 1 ? missed[0].title : `${missed.length} subjects`} marked absent`
      : "Attendance updated";
  const body =
    changes.length === 1
      ? `${changes[0].held} class${changes[0].held === 1 ? "" : "es"} recorded, now at ${changes[0].percentage.toFixed(0)}%`
      : `${changes.length} subjects updated since you last looked`;

  return show(title, { body, tag: "attendance-change", data: { url: "/attendance" } });
}

/**
 * The next class, if it is close enough to matter.
 *
 * The tag is per class per day, so opening the app five times in twenty
 * minutes updates one notification in the tray rather than stacking five.
 * `renotify` is left off for the same reason.
 */
export async function notifyClassSoon(
  todayClasses: ScheduleItem[],
  nowMin: number | null,
  todayISO: string,
): Promise<boolean> {
  if (nowMin === null) return false;
  const soon = todayClasses.find(
    (c) => c.startMin > nowMin && c.startMin - nowMin <= CLASS_LEAD_MIN,
  );
  if (!soon) return false;

  return show(`${soon.title || soon.code} in ${soon.startMin - nowMin} min`, {
    body: [`${soon.start} to ${soon.end}`, soon.room].filter(Boolean).join(" · "),
    tag: `class-${todayISO}-${soon.id}`,
    data: { url: "/dashboard" },
  });
}
