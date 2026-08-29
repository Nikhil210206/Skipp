"use client";

import { useEffect } from "react";
import { useSession } from "@/context/SessionContext";
import {
  calendarDay,
  daySchedule,
  nowMinutes,
  scheduleFor,
  todayISO,
} from "@/lib/schedule";
import { notifyClassSoon } from "@/lib/notify";
import { saturdayClassesOn } from "@/lib/saturday";

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
  const {
    timetable,
    attendingDayOrders,
    customClasses,
    optionalCourses,
    saturday,
    isAuthed,
  } = useSession();

  useEffect(() => {
    if (!isAuthed || !timetable) return;

    const check = async () => {
      const iso = todayISO();
      const today = calendarDay(timetable.calendar, iso);

      /**
       * A Saturday has no day order, so the guard below would drop it, and a
       * student with a Saturday class would be the one person the reminder
       * never reached.
       *
       * **Asked through the shared predicate, never spelled out here.** This
       * was written inline as `today?.dayOrder == null`, which is TRUE for a
       * date the calendar has never heard of, so it kept announcing Saturday
       * classes every weekend for ever once the term was over. Home refused
       * the same dates. One predicate, so they cannot disagree again.
       *
       * These classes are never merged into the day-order path: they are the
       * whole day here, or they are nothing.
       */
      const sat = saturdayClassesOn(iso, timetable.calendar, saturday);

      // A holiday has no day order, and nothing to be late for.
      if (sat.length === 0 && today?.dayOrder == null) return;

      const classes =
        sat.length > 0
          ? sat
          : daySchedule(
              scheduleFor(attendingDayOrders, today!.dayOrder)?.classes ?? [],
              customClasses,
              today!.dayOrder,
              optionalCourses,
            );
      // "Have I already said this?" is answered inside notifyClassSoon, against
      // a log in localStorage. It cannot live here: this component is remounted
      // on every navigation, so anything held in a ref forgets instantly and
      // announces the same class again on the next tab change.
      await notifyClassSoon(classes, nowMinutes(), iso);
    };

    void check();
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [
    isAuthed,
    timetable,
    attendingDayOrders,
    customClasses,
    optionalCourses,
    saturday,
  ]);

  return null;
}
