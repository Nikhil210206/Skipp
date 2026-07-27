"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell";
import CustomClassSheet from "@/components/CustomClassSheet";
import { useSession } from "@/context/SessionContext";
import {
  calendarDay,
  daySchedule,
  fmtTime,
  holidayToday,
  mergeRuns,
  nextWorkingDay,
  nowMinutes,
  prettyDate,
  scheduleFor,
  todayISO,
  type ScheduleItem,
} from "@/lib/schedule";
import { revealIn, revealRows, useGsap } from "@/lib/motion";
import { Button, StateView } from "@/components/ui";
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
  const upcoming = todayDO == null ? nextWorkingDay(cal) : null;
  const upcomingDO = upcoming?.dayOrder ?? null;

  const [selected, setSelected] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeDO = selected ?? todayDO ?? upcomingDO ?? dayOrders[0]?.dayOrder ?? 1;

  const schedule = scheduleFor(dayOrders, activeDO);
  const classes = mergeRuns(
    daySchedule(schedule?.classes ?? [], customClasses, activeDO, optionalCourses),
  );
  const attending = classes.filter((c) => !c.isOptional);
  const isToday = activeDO === todayDO;
  const now = nowMinutes();

  const scope = useGsap(
    ({ self, reduced }) => {
      revealIn(self, reduced, { y: 14, stagger: 0.05 });
      revealRows(self, reduced);
    },
    [activeDO, classes.length],
  );

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
    <AppShell section="Schedule">
      <div ref={scope} className="flex flex-1 flex-col">
        {/* The day order, set as the poster. The picker beneath it is small on
            purpose: the numeral is the subject of the page, not the control. */}
        <div data-reveal className="pt-4">
          <p className="text-label uppercase text-text-3">Day order</p>
          <p className="tnum optical mt-3 text-poster">
            {String(activeDO).padStart(2, "0")}
          </p>

          {/* Evenly distributed across the column, each a full-height target,
              with the selection marked by a rule rather than by colour alone. */}
          <div className="mt-8 flex items-stretch justify-between">
            {dayOrders.map((d) => {
              const active = d.dayOrder === activeDO;
              return (
                <button
                  key={d.dayOrder}
                  onClick={() => setSelected(d.dayOrder)}
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
                  <span
                    className={`h-[2px] w-full transition-colors duration-150 ${
                      active ? "bg-text-1" : "bg-line"
                    }`}
                  />
                  <span className="h-1.5">
                    {d.dayOrder === todayDO && (
                      <span className="block size-1.5 rounded-full bg-accent" />
                    )}
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
                ? "Today"
                : activeDO === upcomingDO
                  ? `Next · ${prettyDate(upcoming?.date ?? "")}`
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
            <ol className="relative">
              {classes.map((c, i) => {
                const prev = classes[i - 1];
                const gap = prev ? c.startMin - prev.endMin : 0;
                return (
                  <li key={c.id} data-row>
                    {gap > 0 && <Gap minutes={gap} />}
                    <Block
                      item={c}
                      live={isToday && c.startMin <= now && now < c.endMin}
                      past={isToday && now >= c.endMin}
                      onRemove={removeCustomClass}
                      onToggleOptional={toggleOptional}
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
      <span className="absolute left-[52px] top-0 h-full w-px bg-line-soft" />
      <span className="tnum pl-[68px] text-callout text-text-3/70">
        {minutes} min free
      </span>
    </div>
  );
}

function Block({
  item,
  live,
  past,
  onRemove,
  onToggleOptional,
}: {
  item: ScheduleItem;
  live: boolean;
  past: boolean;
  onRemove: (id: string) => void;
  onToggleOptional: (code: string) => void;
}) {
  const muted = item.isOptional;
  const minutes = item.endMin - item.startMin;
  const faculty = item.faculty?.replace(/\s*\(\d+\)\s*$/, "") ?? null;

  return (
    <div
      className={`relative flex gap-5 transition-opacity duration-200 ${
        muted ? "opacity-30" : past ? "opacity-60" : ""
      }`}
      style={{ minHeight: Math.max(MIN_BLOCK, minutes * PX_PER_MIN) }}
    >
      {/* The spine: solid for the length of the class */}
      <span
        className={`absolute left-[52px] top-0 h-full w-px ${
          live ? "bg-accent" : muted ? "bg-text-1/20" : "bg-text-1/35"
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
            {live ? <span className="text-accent">Now</span> : `${minutes}m`}
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
            item.isCustom ? onRemove(item.id) : onToggleOptional(item.code)
          }
          className="mt-2 text-callout text-text-3/70 transition-colors hover:text-text-1"
        >
          {item.isCustom ? "Remove" : muted ? "Make required" : "Make optional"}
        </button>
      </div>
    </div>
  );
}
