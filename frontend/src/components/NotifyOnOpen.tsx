"use client";

import { useEffect, useRef } from "react";
import { useSession } from "@/context/SessionContext";
import {
  calendarDay,
  daySchedule,
  nowMinutes,
  scheduleFor,
  todayISO,
} from "@/lib/schedule";
import { notifyClassSoon } from "@/lib/notify";

/**
 * Raises the "class starting soon" notification when the app is opened.
 *
 * Renders nothing. It lives in `AppShell` rather than on Home so that opening
 * straight to any screen still surfaces it, and it re-checks when the tab is
 * brought back to the foreground, which on a phone is what "opening the app"
 * usually is.
 *
 * The notification itself is tagged per class per day, so checking repeatedly
 * updates one entry in the tray instead of stacking duplicates.
 *
 * Attendance changes are NOT handled here: those are raised from
 * `installSnapshot`, the single door fresh data enters by, so they fire once
 * per real change rather than once per glance.
 */
export default function NotifyOnOpen() {
  const { timetable, attendingDayOrders, customClasses, optionalCourses, isAuthed } =
    useSession();
  // The last thing announced, so a foreground event a minute later does not
  // re-raise the same class.
  const announced = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthed || !timetable) return;

    const check = async () => {
      const iso = todayISO();
      const today = calendarDay(timetable.calendar, iso);
      // A holiday has no day order, and nothing to be late for.
      if (today?.dayOrder == null) return;

      const classes = daySchedule(
        scheduleFor(attendingDayOrders, today.dayOrder)?.classes ?? [],
        customClasses,
        today.dayOrder,
        optionalCourses,
      );
      const now = nowMinutes();
      const next = classes.find((c) => c.startMin > now);
      const key = next ? `${iso}-${next.id}` : null;
      if (!key || key === announced.current) return;

      // Recorded only once something was actually raised. Marking it up front
      // would permanently suppress this class if nothing was shown, which is
      // the ordinary case when notifications are off, or on the very first
      // check before the service worker has registered.
      if (await notifyClassSoon(classes, now, iso)) announced.current = key;
    };

    void check();
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [isAuthed, timetable, attendingDayOrders, customClasses, optionalCourses]);

  return null;
}
