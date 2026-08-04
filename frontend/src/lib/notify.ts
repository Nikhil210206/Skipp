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
import { todayISO, type ScheduleItem } from "./schedule";

/**
 * How long before a class to buzz, in minutes. Both fire, once each.
 *
 * The wider one is the plan-ahead nudge, the tighter one is the "leave now".
 */
export const LEADS = [30, 5] as const;

/** The widest window, i.e. how early a class starts being worth mentioning. */
export const CLASS_LEAD_MIN = Math.max(...LEADS);

/* ----------------------------------------------------------- sent once only */

/**
 * What has already been announced today.
 *
 * **This has to outlive the component, and that was the whole bug.** It used to
 * be a `useRef` in `NotifyOnOpen`, but every screen renders its own `AppShell`,
 * so the component is torn down and rebuilt on EVERY navigation. The memory of
 * having already told you went with it, and switching tabs five times told you
 * five times. Bringing the app to the foreground did it again.
 *
 * Keyed per class per LEAD per day, so the 30 minute and the 5 minute warnings
 * are separate one-time events and tomorrow starts clean. The log is stamped
 * with the day so it prunes itself rather than growing for ever.
 */
const SENT_KEY = "skipp.notified";

type SentLog = { day: string; ids: string[] };

function loadSent(): SentLog {
  const day = todayISO();
  try {
    const raw = localStorage.getItem(SENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as SentLog | null) : null;
    if (parsed && parsed.day === day && Array.isArray(parsed.ids)) return parsed;
  } catch {
    /* unreadable, treat as nothing sent */
  }
  return { day, ids: [] };
}

function alreadySent(id: string): boolean {
  return loadSent().ids.includes(id);
}

function markSent(id: string): void {
  try {
    const log = loadSent();
    if (log.ids.includes(id)) return;
    log.ids.push(id);
    localStorage.setItem(SENT_KEY, JSON.stringify(log));
  } catch {
    // Private mode. The worst case is a repeat, which is what it was before.
  }
}

/** FNV-1a, so an attendance signature stays short in storage. */
function hash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

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
 * Raised from `installSnapshot`, the single door fresh data enters by. The
 * signature guard is belt and braces on top of that: a refresh that re-reports
 * the same marks, or a second install of an identical snapshot, says nothing a
 * second time.
 */
export async function notifyAttendanceChanges(
  changes: AttendanceChange[],
): Promise<boolean> {
  if (changes.length === 0) return false;

  const id = `attn-${hash(
    changes
      .map((c) => `${c.title}:${c.held}:${c.present}:${c.percentage.toFixed(1)}`)
      .sort()
      .join("|"),
  )}`;
  if (alreadySent(id)) return false;

  const missed = changes.filter((c) => c.held - c.present > 0);
  const title =
    missed.length > 0
      ? `${missed.length === 1 ? missed[0].title : `${missed.length} subjects`} marked absent`
      : "Attendance updated";
  const body =
    changes.length === 1
      ? `${changes[0].held} class${changes[0].held === 1 ? "" : "es"} recorded, now at ${changes[0].percentage.toFixed(0)}%`
      : `${changes.length} subjects updated since you last looked`;

  const shown = await show(title, {
    body,
    tag: "attendance-change",
    data: { url: "/attendance" },
  });
  if (shown) markSent(id);
  return shown;
}

/**
 * The next class, if it is close enough to matter. At most one notification
 * per class per lead, per day.
 */
export async function notifyClassSoon(
  todayClasses: ScheduleItem[],
  nowMin: number | null,
  day: string,
): Promise<boolean> {
  if (nowMin === null) return false;
  const soon = todayClasses.find(
    (c) => c.startMin > nowMin && c.startMin - nowMin <= CLASS_LEAD_MIN,
  );
  if (!soon) return false;

  const mins = soon.startMin - nowMin;
  // The TIGHTEST window that applies. Three minutes before a class is the five
  // minute warning, not a late thirty minute one.
  const lead = [...LEADS].sort((a, b) => a - b).find((l) => mins <= l);
  if (lead === undefined) return false;

  const id = `class-${day}-${soon.id}-${lead}`;
  if (alreadySent(id)) return false;

  const shown = await show(`${soon.title || soon.code} in ${mins} min`, {
    body: [`${soon.start} to ${soon.end}`, soon.room].filter(Boolean).join(" · "),
    // Per lead, not per class: one shared tag would make the five minute
    // warning silently REPLACE the thirty minute one instead of alerting, and
    // the second reminder is the one people actually move for.
    tag: id,
    data: { url: "/dashboard" },
  });
  if (shown) markSent(id);
  return shown;
}
