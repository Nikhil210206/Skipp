"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useSession } from "@/context/SessionContext";
import { daySchedule, fmtTime, mergeRuns, scheduleFor, todayISO } from "@/lib/schedule";
import { useNowMinutes } from "@/lib/useNow";
import { fullWeekday, holidayName, shortDate } from "@/lib/holidays";
import { EASE, prefersReducedMotion } from "@/lib/motion";
import { IconButton } from "@/components/ui";
import { IconClose } from "@/components/Icons";
import type { CalendarDay } from "@/types";

/**
 * A date's classes, popped up over the Calendar right where the date was
 * tapped: when each class is, what it is and where.
 *
 * Small on purpose. A day sheet that also listed the free gaps between classes
 * and a styled empty state was built here once and removed on request (see
 * CLAUDE.md), so this is a card at the date rather than a sheet, the day's
 * classes and nothing else. Tapping the same date again closes it, another
 * date moves it there, and anywhere else closes it.
 *
 * The classes come from exactly what Schedule builds for that day order, so
 * the two screens cannot disagree: theory hours stay separate, labs stay
 * whole, the student's own classes are in, and optional ones are shown faded,
 * the way Schedule shows them.
 *
 * It is placed inside the grid's box rather than portalled, so it scrolls with
 * the date it belongs to. Nothing in it is `position: fixed`, so the portal
 * rule in `ui/Overlay.tsx` does not apply.
 */

/** Between the date and the card. */
const GAP = 8;
/** The card never comes closer than this to the edge of the grid. */
const EDGE = 8;

export default function DayPeek({
  date,
  days,
  term,
  container,
  onClose,
}: {
  /** The date to show, or null when closed. */
  date: string | null;
  days: Map<string, CalendarDay>;
  /** The first and last working days, to tell a weekend from the end of term. */
  term: { first: string; last: string } | null;
  /** The positioned box the grid sits in. The card is placed inside it. */
  container: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  const { timetable, customClasses, optionalCourses } = useSession();
  const now = useNowMinutes();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Held through the exit, so the card fades out still showing its own day.
  const [shown, setShown] = useState(date);
  const [prev, setPrev] = useState(date);
  if (date !== prev) {
    setPrev(date);
    if (date) setShown(date);
  }

  // The latest onClose, without making the listeners below resubscribe.
  const close = useRef(onClose);
  useLayoutEffect(() => {
    close.current = onClose;
  });

  // Placed against its date before the first paint, then popped in, or faded
  // out once there is no date to show.
  useLayoutEffect(() => {
    const el = ref.current;
    const box = container.current;
    if (!el || !box) return;
    if (!date) {
      const t = gsap.to(el, {
        opacity: 0,
        duration: 0.12,
        ease: EASE.in,
        onComplete: () => setShown(null),
      });
      return () => {
        t.kill();
      };
    }
    const anchor = box.querySelector<HTMLElement>(`[data-date="${date}"]`);
    if (!anchor) {
      close.current();
      return;
    }
    const { above, originX } = place(el, anchor, box);
    // Into the card, so a screen reader reads the day out. It holds nothing to
    // type into, so no keyboard comes up on a phone.
    el.focus({ preventScroll: true });
    gsap.set(el, { transformOrigin: `${originX}px ${above ? "100%" : "0%"}` });
    const t = prefersReducedMotion()
      ? gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.16, ease: EASE.out })
      : gsap.fromTo(
          el,
          // Out of the date it belongs to: from the edge nearest it, a little
          // small, with the house spring.
          { opacity: 0, scale: 0.94, y: above ? 6 : -6 },
          { opacity: 1, scale: 1, y: 0, duration: 0.26, ease: EASE.spring },
        );
    return () => {
      t.kill();
    };
  }, [date, container]);

  // Closing: anywhere that is not the card or a date, and Escape, which hands
  // focus back to the date. A date answers for itself, the same one closing
  // this and another moving it. It also follows its date if the grid resizes.
  useEffect(() => {
    if (!date) return;
    const el = ref.current;
    const box = container.current;
    const anchor = () => box?.querySelector<HTMLElement>(`[data-date="${date}"]`) ?? null;
    const onDown = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Element) || el?.contains(t)) return;
      if (box?.contains(t) && t.closest("[data-date]")) return;
      close.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      close.current();
      anchor()?.focus();
    };
    const ro = new ResizeObserver(() => {
      const a = anchor();
      if (el && box && a) place(el, a, box);
    });
    if (box) ro.observe(box);
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      ro.disconnect();
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [date, container]);

  if (!shown) return null;

  const day = days.get(shown);
  const today = todayISO();
  const isToday = shown === today;
  const dayOrder = day?.dayOrder ?? null;
  const classes =
    dayOrder == null
      ? []
      : mergeRuns(
          daySchedule(
            scheduleFor(timetable?.dayOrders ?? [], dayOrder)?.classes ?? [],
            customClasses,
            dayOrder,
            optionalCourses,
          ),
          { labsOnly: true },
        );
  const attending = classes.filter((c) => !c.isOptional).length;
  const optional = classes.length - attending;
  const weekday = day?.weekday ?? weekdayOf(shown);
  const outOfTerm = term != null && (shown < term.first || shown > term.last);

  // On a holiday the name leads, as it does above the grid: which holiday it
  // is, is what you tapped to find out.
  const title = day?.isHoliday
    ? day.event
      ? holidayName(day.event)
      : "Holiday"
    : dayOrder != null
      ? `Day order ${dayOrder}`
      : "No classes";
  // The span of the day rides with the count, because the rows below give only
  // start times: this is where "when does my day end" is answered.
  const span =
    classes.length > 0
      ? `${fmtTime(classes[0].startMin)} to ${fmtTime(Math.max(...classes.map((c) => c.endMin)))}`
      : "";
  const sub = day?.isHoliday
    ? "Holiday, no classes"
    : dayOrder != null
      ? classes.length > 0
        ? `${attending} ${attending === 1 ? "class" : "classes"}${optional ? `, ${optional} optional` : ""}, ${span}`
        : "Nothing on this day order"
      : outOfTerm
        ? "Outside the term"
        : fullWeekday(weekday);
  const note = day?.event && !day.isHoliday ? holidayName(day.event) : null;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-day-peek
      // A column, so that when `place` cuts its height to fit the screen the
      // header stays and only the list scrolls. `shadow-(--shadow-float)`,
      // not `shadow-float`: Tailwind bakes a theme shadow's value into that
      // utility, so it stayed Ink's soft shadow under every look, where the
      // variable form lets Brutal's hard offset and Clay's puff through.
      className="absolute z-10 flex w-[min(22.5rem,calc(100%-1rem))] flex-col rounded-card border border-line bg-ink-1 p-4 pt-3 shadow-(--shadow-float)"
    >
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0 pt-2.5">
          <p className="tnum text-label uppercase text-text-3">
            {isToday ? "Today" : weekday}, {shortDate(shown)}
          </p>
          <h2 id={titleId} className="mt-1 text-headline">
            {title}
          </h2>
          <p className="tnum mt-0.5 text-callout text-text-3">{sub}</p>
          {note && <p className="mt-0.5 text-callout text-text-2">{note}</p>}
        </div>
        <div className="-mr-2 shrink-0">
          <IconButton label="Close" variant="quiet" onClick={() => close.current()}>
            <IconClose size={16} />
          </IconButton>
        </div>
      </div>

      {/* One line a class: when it starts, what it is, where. A first build
          gave every class two lines (start over end, title over details) and
          the card came out 463px tall on a phone, which is most of the month
          it is meant to sit over. The day's span in the header answers the
          end. */}
      {classes.length > 0 && (
        <ol className="-mx-1 mt-2.5 min-h-0 overflow-y-auto overscroll-contain px-1">
          {classes.map((c) => {
            const live = isToday && now >= c.startMin && now < c.endMin;
            // Beside the name rather than in the right column: there it made
            // the column so wide that "Database Management Systems" broke
            // over three lines. The right column is the room and nothing else.
            const kind = [c.isLab && "Lab", c.isOptional && "Optional"].filter(Boolean).join(", ");
            return (
              <li
                key={c.id}
                // Faded rather than left out, the way Schedule shows them:
                // the class still happens, you have just said you skip it.
                className={`grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-baseline gap-x-3 py-1.5 ${
                  c.isOptional ? "opacity-40" : ""
                }`}
              >
                {/* Through fmtTime, not the start as the portal wrote it, so it
                    matches the span above and is never 24 hour beside 12. */}
                <span className="tnum text-body text-text-1">{fmtTime(c.startMin)}</span>
                {/* Wraps rather than truncating: SRM course names are long, and
                    the name is what you are scanning for. */}
                <span className="text-body text-text-1">
                  {c.title}
                  {kind && (
                    <span className="whitespace-nowrap text-callout text-text-3"> · {kind}</span>
                  )}
                  {live && (
                    <span className="ml-2 whitespace-nowrap text-label uppercase text-accent">
                      Now
                    </span>
                  )}
                </span>
                <span className="tnum text-right text-callout text-text-3">{c.room}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/**
 * Puts the card against its date: above it where it fits, so a thumb on the
 * date does not cover it, then below, and when it fits neither, on the roomier
 * side with its list cut to fit and scrolling inside.
 *
 * The room is measured between the sticky masthead and the tab bar, both of
 * which sit on top of the page, not between the edges of the screen. A first
 * version measured only the masthead, so a date in the middle of the screen
 * sent the card down under the tab bar with its last two classes hidden. The
 * tab bar is `lg:hidden` on a laptop, where it measures nothing, so the
 * window's bottom stands in for it there.
 */
function place(el: HTMLElement, anchor: HTMLElement, box: HTMLElement) {
  const b = box.getBoundingClientRect();
  const a = anchor.getBoundingClientRect();
  const nav = document.querySelector("[data-nav]")?.getBoundingClientRect();
  const ceiling = (document.querySelector("[data-masthead]")?.getBoundingClientRect().bottom ?? 0) + EDGE;
  const floor = (nav && nav.height > 0 ? nav.top : window.innerHeight) - EDGE;
  const roomAbove = a.top - GAP - ceiling;
  const roomBelow = floor - a.bottom - GAP;

  el.style.maxHeight = "";
  const natural = el.offsetHeight;
  const above = natural <= roomAbove || (natural > roomBelow && roomAbove >= roomBelow);
  const room = Math.max(0, above ? roomAbove : roomBelow);
  const h = Math.min(natural, room);
  if (natural > room) el.style.maxHeight = `${Math.floor(room)}px`;

  const w = el.offsetWidth;
  const centre = a.left + a.width / 2 - b.left;
  const left = Math.min(Math.max(centre - w / 2, EDGE), b.width - w - EDGE);
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(above ? a.top - b.top - GAP - h : a.bottom - b.top + GAP)}px`;
  return { above, originX: Math.round(centre - left) };
}

/** "Tue", for a date the academic planner does not cover. */
function weekdayOf(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short" });
}
