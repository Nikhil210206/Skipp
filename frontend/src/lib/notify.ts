"use client";

// Notifications, raised by the app itself.
//
// **There is no server involved and no push subscription.** The app asks the
// browser for permission once, then raises notifications locally when it
// notices something worth saying: a class about to start, attendance the portal
// has recorded since the last look, or a test that has been marked.
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

import {
  attendanceDelta,
  attendanceTone,
  attendanceWhat,
  fmtMark,
  type Update,
} from "./updates";
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
 * How many changes get a notification of their own. Past this the rest fold
 * into one line, because twelve buzzes in a row on the morning marks land is a
 * phone being taken away from you, not news.
 */
const UPDATE_LIMIT = 5;

/** Bad news first, then marks, then attendance that went the right way. */
function urgency(u: Update): number {
  if (u.kind === "mark") return 1;
  const tone = attendanceTone(u);
  return tone === "risk" ? 0 : tone === "watch" ? 0.5 : 2;
}

/** Title and body for one change. No arrows or dashes: "8 to 9" reads fine. */
export function describeUpdate(u: Update): { title: string; body: string } {
  if (u.kind === "mark") {
    const max = fmtMark(u.max);
    return u.before === null
      ? {
          title: `New marks: ${u.title}`,
          body: `${u.test}: ${fmtMark(u.after)}/${max} scored`,
        }
      : {
          title: `Marks updated: ${u.title}`,
          body: `${u.test}: ${fmtMark(u.before)} to ${fmtMark(u.after)} out of ${max}`,
        };
  }

  const { held, present, missed } = attendanceDelta(u);
  const b = u.before.margin;
  const a = u.after.margin;
  const title =
    missed > 0
      ? `Marked absent: ${u.title}`
      : held > 0
        ? `Attendance up: ${u.title}`
        : `Attendance corrected: ${u.title}`;
  const what = attendanceWhat(held, present, missed, u);
  const t = u.threshold;
  const margin =
    a < 0
      ? `attend ${-a} to get back to ${t}%`
      : b < 0
        ? a === 0
          ? `back above ${t}%, no skips left yet`
          : `back above ${t}%, ${a} to spare`
        : a === 0
          ? `margin ${b} to 0, no skips left`
          : a === b
            ? `margin holds at ${a}`
            : `margin ${b} to ${a}`;
  return { title, body: `${what}, ${margin}. ${u.after.percentage.toFixed(1)}% now` };
}

/**
 * What the portal recorded since the last look, one notification per change.
 *
 * Raised from SessionContext the moment `detectUpdates` finds something, which
 * is once per real change: the detector moves its baseline as it reports, so
 * the same numbers never come back as news. The sent log is belt and braces on
 * top, for a second tab running the same detection.
 *
 * Tagged per change, so a subject that moves twice in a day replaces its own
 * entry in the tray instead of stacking a stale one under the new.
 */
export async function notifyUpdates(updates: Update[]): Promise<number> {
  if (updates.length === 0 || !notificationsOn()) return 0;
  const ordered = [...updates].sort((x, y) => urgency(x) - urgency(y));
  const own = ordered.length > UPDATE_LIMIT ? ordered.slice(0, UPDATE_LIMIT - 1) : ordered;
  const rest = ordered.length - own.length;

  let shown = 0;
  for (const u of own) {
    const sig =
      u.kind === "mark"
        ? `${u.id}:${u.before}:${u.after}`
        : `${u.id}:${u.after.attended}/${u.after.conducted}`;
    const id = `upd-${hash(sig)}`;
    if (alreadySent(id)) continue;
    const { title, body } = describeUpdate(u);
    const ok = await show(title, {
      body,
      tag: `upd-${hash(u.id)}`,
      data: { url: u.kind === "mark" ? "/marks" : "/attendance" },
    });
    if (ok) {
      markSent(id);
      shown += 1;
    }
  }

  if (rest > 0) {
    const id = `upd-more-${hash(ordered.map((u) => u.id).join("|"))}`;
    if (!alreadySent(id)) {
      const ok = await show(`${rest} more update${rest === 1 ? "" : "s"} in Skipp`, {
        body: "Open Skipp to see everything that changed.",
        tag: "upd-more",
        data: { url: "/dashboard" },
      });
      if (ok) {
        markSent(id);
        shown += 1;
      }
    }
  }
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
