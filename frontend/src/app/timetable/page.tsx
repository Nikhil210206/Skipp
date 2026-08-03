"use client";

import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import AppShell from "@/components/AppShell";
import CustomClassSheet from "@/components/CustomClassSheet";
import { useSession } from "@/context/SessionContext";
import {
  calendarDay,
  daySchedule,
  fmtTime,
  holidayToday,
  mergeRuns,
  focusDay,
  nextWorkingDay,
  nowMinutes,
  prettyDate,
  scheduleFor,
  todayISO,
  type ScheduleItem,
} from "@/lib/schedule";
import { EASE, prefersReducedMotion, revealIn, useGsap } from "@/lib/motion";
import RollingNumber from "@/components/onboarding/RollingNumber";
import { Button, IconButton, StateView } from "@/components/ui";
import { IconDownload } from "@/components/Icons";
import { Marginalia, SectionHead } from "@/components/ui/editorial";

/**
 * SCHEDULE: the day drawn to scale.
 *
 * Each class occupies vertical space in proportion to its length, and the gaps
 * between them are left genuinely empty, so the shape of the column is the shape
 * of the day. A long lab looks long. A free hour looks free. On today, a hairline
 * marks the current time.
 */
const PX_PER_MIN = 1.05;
const MIN_BLOCK = 62;

export default function TimetablePage() {
  const {
    timetable,
    student,
    attendingDayOrders,
    customClasses,
    addCustomClass,
    removeCustomClass,
    optionalCourses,
    toggleOptional,
  } = useSession();

  const dayOrders = timetable?.dayOrders ?? [];
  const cal = timetable?.calendar ?? [];
  const todayDO = calendarDay(cal, todayISO())?.dayOrder ?? null;
  const holiday = holidayToday(cal);
  // The SAME function Home features its day with, so the two screens can never
  // disagree. It rolls on to the next working day once today's classes are
  // over, which is why Home showed tomorrow while this screen sat on today.
  const focus = timetable ? focusDay(timetable) : null;
  const upcoming =
    focus && focus.label === "UPCOMING" ? focus : todayDO == null ? nextWorkingDay(cal) : null;
  const upcomingDO = upcoming?.dayOrder ?? null;

  const [selected, setSelected] = useState<number | null>(null);
  // What the student tapped, which runs AHEAD of what is on screen. The control
  // answers on the same frame as the touch; the column follows a beat later,
  // once the outgoing classes have left. Without the split the old rows vanish
  // in one frame and the new ones fade up from nothing, and that empty frame in
  // between is what reads as a blink.
  const [target, setTarget] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeDO =
    selected ?? focus?.dayOrder ?? todayDO ?? upcomingDO ?? dayOrders[0]?.dayOrder ?? 1;
  const controlDO = target ?? activeDO;

  const schedule = scheduleFor(dayOrders, activeDO);
  const classes = mergeRuns(
    daySchedule(schedule?.classes ?? [], customClasses, activeDO, optionalCourses),
  );
  const attending = classes.filter((c) => !c.isOptional);
  const isToday = activeDO === todayDO;
  const now = nowMinutes();
  // The next class that has not started yet, marked only while looking at the
  // day it belongs to: "Next" on some other day order would be a lie.
  const lastEnd = classes.at(-1)?.endMin ?? 0;
  const dayDone = isToday && classes.length > 0 && now >= lastEnd;
  const nextId = isToday
    ? (classes.find((c) => c.startMin > now && !c.isOptional)?.id ?? null)
    : null;

  // The whole grid, every day order, not just the day being viewed. Built from
  // the attending schedule so optional courses stay out, with the student's own
  // added classes placed into it.
  const [saving, setSaving] = useState(false);
  async function saveImage() {
    if (saving) return;
    setSaving(true);
    try {
      // Loaded on demand: it is ~300 lines of canvas drawing that only matters
      // once someone actually asks for the picture.
      const { downloadTimetableGrid } = await import("@/lib/timetableImage");
      await downloadTimetableGrid(attendingDayOrders, customClasses, {
        studentName: student?.name ?? "",
        section: student?.section ?? null,
        academicYear: timetable?.academicYear ?? null,
      });
    } finally {
      setSaving(false);
    }
  }

  const scope = useGsap(({ self, reduced }) => {
    revealIn(self, reduced, { y: 14, stagger: 0.05 });
  }, []);

  // Tapping a day order: the classes on screen leave first, then the new ones
  // arrive, so the column is never empty and never jumps.
  function pick(next: number) {
    if (next === controlDO) return;
    setTarget(next);
    const el = list.current;
    if (!el || el.children.length === 0 || prefersReducedMotion()) {
      setSelected(next);
      return;
    }
    // A killed tween never fires onComplete, so a second tap mid-exit simply
    // supersedes the first and only the newest day order is committed.
    dir.current = next > controlDO ? 1 : -1;
    fromHeight.current = el.getBoundingClientRect().height;
    gsap.killTweensOf(el.children);
    gsap.to(el.children, {
      opacity: 0,
      x: -22 * dir.current,
      duration: 0.15,
      ease: "power2.in",
      stagger: 0.014,
      overwrite: true,
      onComplete: () => setSelected(next),
    });
  }

  // Switching day order is a TRANSITION, not a re-entrance. The rows are
  // animated straight from a start state to their final one in the same frame,
  // so the column flows over rather than blanking and rebuilding.
  const list = useRef<HTMLOListElement>(null);
  // The column's height before a swap. Day orders hold different numbers of
  // classes, so without this the section beneath snaps up or down the instant
  // the rows are replaced, however smoothly the rows themselves move.
  const fromHeight = useRef<number | null>(null);
  // Which way the swap is travelling. Fading out and back in reads as a
  // replacement; sliding with the direction of the tap reads as movement
  // through a sequence, which is what makes it feel continuous.
  const dir = useRef(1);
  useLayoutEffect(() => {
    const el = list.current;
    if (!el || el.children.length === 0) return;
    if (prefersReducedMotion()) {
      gsap.set(el.children, { opacity: 1, y: 0 });
      fromHeight.current = null;
      return;
    }

    // The column resizes to its new contents as one movement with the rows,
    // rather than jumping to the new height and then filling it.
    const was = fromHeight.current;
    fromHeight.current = null;
    if (was !== null) {
      const now = el.getBoundingClientRect().height;
      if (Math.abs(now - was) > 2) {
        gsap.fromTo(
          el,
          { height: was, overflow: "hidden" },
          {
            height: now,
            duration: 0.5,
            ease: EASE.emphasis,
            overwrite: "auto",
            // Back to auto height, or the next day order is trapped at this one.
            clearProps: "height,overflow",
          },
        );
      }
    }

    gsap.fromTo(
      el.children,
      { opacity: 0, x: 26 * dir.current, y: 6 },
      {
        opacity: 1,
        x: 0,
        y: 0,
        duration: 0.46,
        ease: EASE.emphasis,
        stagger: 0.028,
        overwrite: true,
      },
    );
  }, [activeDO]);

  // The selected rule slides between day orders instead of blinking from one to
  // the next, so the control moves with the content it is changing.
  const picker = useRef<HTMLDivElement>(null);
  const marker = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);
  useLayoutEffect(() => {
    const box = picker.current;
    const bar = marker.current;
    if (!box || !bar) return;
    const track = box.querySelector<HTMLElement>(`[data-do="${controlDO}"] [data-track]`);
    if (!track) return;
    const b = box.getBoundingClientRect();
    const t = track.getBoundingClientRect();
    const to = { x: t.left - b.left, y: t.top - b.top, width: t.width };
    if (!placed.current || prefersReducedMotion()) {
      placed.current = true;
      gsap.set(bar, to);
      return;
    }
    gsap.to(bar, { ...to, duration: 0.52, ease: EASE.emphasis, overwrite: "auto" });
  }, [controlDO, dayOrders.length]);

  if (dayOrders.length === 0) {
    return (
      <AppShell section="Schedule">
        <StateView
          title="Timetable unavailable"
          message="We could not load your day-order grid. Pull down to try again."
        />
      </AppShell>
    );
  }

  const dayStart = classes[0]?.startMin ?? 0;
  const dayEnd = classes.at(-1)?.endMin ?? 0;

  return (
    <AppShell
      section="Schedule"
      action={
        <IconButton
          label="Download the full timetable"
          variant="quiet"
          disabled={saving}
          onClick={() => void saveImage()}
        >
          <IconDownload size={19} />
        </IconButton>
      }
    >
      <div ref={scope} className="flex flex-1 flex-col">
        {/* The day order, set as the poster. The picker beneath it is small on
            purpose: the numeral is the subject of the page, not the control. */}
        <div data-reveal className="pt-4">
          <p className="text-label uppercase text-text-3">Day order</p>
          <RollingNumber
            value={String(controlDO).padStart(2, "0")}
            className="optical mt-3 text-poster"
          />

          {/* Evenly distributed across the column, each a full-height target,
              with the selection marked by a rule rather than by colour alone. */}
          <div ref={picker} className="relative mt-8 flex items-stretch justify-between">
            <span
              ref={marker}
              aria-hidden
              data-do-marker
              className="pointer-events-none absolute left-0 top-0 h-[2px] bg-text-1"
            />
            {dayOrders.map((d) => {
              const active = d.dayOrder === controlDO;
              return (
                <button
                  key={d.dayOrder}
                  data-do={d.dayOrder}
                  onClick={() => pick(d.dayOrder)}
                  aria-pressed={active}
                  aria-label={`Day order ${d.dayOrder}`}
                  className="group relative flex flex-1 flex-col items-center gap-3 pt-1"
                >
                  <span
                    className={`tnum text-headline transition-colors duration-150 ${
                      active
                        ? "text-text-1"
                        : "text-text-3/50 group-hover:text-text-3"
                    }`}
                  >
                    {d.dayOrder}
                  </span>
                  <span data-track className="h-[2px] w-full bg-line" />
                  {/* Filled marks today, hollow marks the day that comes next,
                      so the two are legible without reading a word. */}
                  <span className="h-1.5">
                    {d.dayOrder === todayDO ? (
                      <span className="block size-1.5 rounded-full bg-accent" />
                    ) : d.dayOrder === upcomingDO ? (
                      <span className="block size-1.5 rounded-full border border-text-3" />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-7 flex items-baseline justify-between gap-4">
            <p
              className={`text-label uppercase ${isToday ? "text-accent" : "text-text-3"}`}
            >
              {isToday
                ? dayDone
                  ? "Today · finished"
                  : "Today"
                : activeDO === upcomingDO
                  ? `Up next · ${prettyDate(upcoming?.date ?? "")}`
                  : "Day order"}
            </p>
            {attending.length > 0 && (
              <p className="tnum text-label uppercase text-text-3">
                {attending[0].start} to {attending.at(-1)?.end} ·{" "}
                {Math.round((dayEnd - dayStart) / 60)}h on campus
              </p>
            )}
          </div>
        </div>

        {holiday && activeDO === upcomingDO && (
          <div data-reveal className="pt-7">
            <Marginalia>
              {holiday.event?.replace(/ - Holiday$/i, "") ?? "Holiday today."} Showing the
              next working day.
            </Marginalia>
          </div>
        )}

        {/* The day, to scale */}
        <section className="pt-9">
          {classes.length === 0 ? (
            <StateView title="No classes" message={`Day order ${activeDO} is clear.`} />
          ) : (
            <ol ref={list} className="relative">
              {classes.map((c, i) => {
                const prev = classes[i - 1];
                const gap = prev ? c.startMin - prev.endMin : 0;
                return (
                  <li key={c.id}>
                    {gap > 0 && <Gap minutes={gap} />}
                    <Block
                      item={c}
                      live={isToday && c.startMin <= now && now < c.endMin}
                      next={c.id === nextId}
                      onRemove={removeCustomClass}
                      onToggleOptional={() =>
                        toggleOptional(activeDO, c.code, c.isLab)
                      }
                    />
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <div data-reveal className="pt-10">
          <SectionHead>Your additions</SectionHead>
          <div className="pt-4">
            <Button variant="secondary" full onClick={() => setSheetOpen(true)}>
              Add a class to day order {activeDO}
            </Button>
          </div>
        </div>
      </div>

      <CustomClassSheet
        open={sheetOpen}
        dayOrder={activeDO}
        dayOrders={dayOrders.map((d) => d.dayOrder)}
        onClose={() => setSheetOpen(false)}
        onAdd={addCustomClass}
      />
    </AppShell>
  );
}

/** Empty time, drawn as empty space rather than described in words. */
function Gap({ minutes }: { minutes: number }) {
  return (
    <div
      className="relative flex items-center"
      style={{ height: Math.max(34, minutes * PX_PER_MIN) }}
    >
      <span data-spine className="absolute left-[52px] top-0 h-full w-px bg-line-soft" />
      <span className="tnum pl-[68px] text-callout text-text-3/70">
        {minutes} min free
      </span>
    </div>
  );
}

function Block({
  item,
  live,
  next,
  onRemove,
  onToggleOptional,
}: {
  item: ScheduleItem;
  live: boolean;
  next: boolean;
  onRemove: (id: string) => void;
  /** Already bound to this class, its day order and its theory/lab side. */
  onToggleOptional: () => void;
}) {
  const muted = item.isOptional;
  const minutes = item.endMin - item.startMin;
  const faculty = item.faculty?.replace(/\s*\(\d+\)\s*$/, "") ?? null;

  return (
    <div
      data-surface
      className={`relative flex gap-5 transition-opacity duration-200 ${
        muted ? "opacity-30" : ""
      }`}
      style={{ minHeight: Math.max(MIN_BLOCK, minutes * PX_PER_MIN) }}
    >
      {/* The spine: solid for the length of the class */}
      <span
        data-spine
        className={`absolute left-[52px] top-0 h-full w-px ${
          live ? "bg-accent" : next ? "bg-text-1/70" : muted ? "bg-text-1/20" : "bg-text-1/35"
        }`}
      />
      <div className="w-[46px] shrink-0 pt-0.5 text-right">
        <p className="tnum text-callout text-text-1">{item.start}</p>
        <p className="tnum mt-1 text-callout text-text-3">{fmtTime(item.endMin)}</p>
      </div>

      <div className="min-w-0 flex-1 pb-6 pl-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="truncate text-headline">{item.title}</h3>
          <span className="tnum shrink-0 text-callout text-text-3">
            {live ? (
              <span className="text-accent">Now</span>
            ) : next ? (
              <span className="text-text-1">Next</span>
            ) : (
              `${minutes}m`
            )}
          </span>
        </div>

        <p className="mt-1.5 truncate text-callout text-text-3">
          {[
            item.abbrev,
            muted ? "Optional" : null,
            item.isLab && "Lab",
            item.room,
            faculty,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>

        <button
          onClick={() =>
            item.isCustom ? onRemove(item.id) : onToggleOptional()
          }
          // 44px of height, with the extra taken as negative margin so the
          // row's rhythm is unchanged. It measured 84x18 before, which is a
          // fiddly target on a phone and under the 44px floor this project
          // sets for itself.
          className="-my-3 mt-1 inline-flex min-h-11 items-center text-callout text-text-3/70 transition-colors hover:text-text-1"
        >
          {item.isCustom
            ? "Remove"
            : muted
              ? "Make required here"
              : "Make optional here"}
        </button>
      </div>
    </div>
  );
}
