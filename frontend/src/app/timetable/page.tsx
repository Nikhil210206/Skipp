"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell";
import CustomClassSheet from "@/components/CustomClassSheet";
import { useSession } from "@/context/SessionContext";
import {
  calendarDay,
  daySchedule,
  holidayToday,
  nextWorkingDay,
  prettyDate,
  scheduleFor,
  timeline,
  todayISO,
  type ScheduleItem,
} from "@/lib/schedule";
import { revealIn, revealRows, useGsap } from "@/lib/motion";
import { Button, Chip, StateView } from "@/components/ui";
import { Marginalia, Rule, SectionHead } from "@/components/ui/editorial";

/**
 * The schedule is drawn as a time axis: hours in a fixed left column, classes
 * hung off it, gaps left genuinely empty. The day-order picker is a row of
 * numerals rather than a control, because the numeral is the content.
 */
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
  const classes = daySchedule(
    schedule?.classes ?? [],
    customClasses,
    activeDO,
    optionalCourses,
  );
  const items = timeline(classes);
  const attending = classes.filter((c) => !c.isOptional);

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

  const context =
    activeDO === todayDO
      ? "Today"
      : activeDO === upcomingDO
        ? `Next working day · ${prettyDate(upcoming?.date ?? "")}`
        : "Day order";

  return (
    <AppShell section="Schedule">
      <div ref={scope} className="flex flex-1 flex-col">
        {/* Day-order picker: numerals, not chrome */}
        <div data-reveal className="pt-2">
          <div className="no-scrollbar bleed bleed-pad flex items-end gap-6 overflow-x-auto pb-1">
            {dayOrders.map((d) => {
              const active = d.dayOrder === activeDO;
              return (
                <button
                  key={d.dayOrder}
                  onClick={() => setSelected(d.dayOrder)}
                  aria-pressed={active}
                  aria-label={`Day order ${d.dayOrder}`}
                  className="group relative shrink-0 pb-2"
                >
                  <span
                    className={`tnum block text-hero transition-colors ${
                      active ? "text-text-1" : "text-text-3/40 hover:text-text-3"
                    }`}
                  >
                    {d.dayOrder}
                  </span>
                  {d.dayOrder === todayDO && (
                    <span className="absolute -right-2 top-1 size-1.5 rounded-full bg-accent" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-4">
            <p
              className={`text-label uppercase ${
                activeDO === todayDO ? "text-accent" : "text-text-3"
              }`}
            >
              {context}
            </p>
            <p className="tnum text-label uppercase text-text-3">
              {attending.length} {attending.length === 1 ? "class" : "classes"}
              {attending.length > 0 &&
                ` · ${attending[0].start} to ${attending.at(-1)?.end}`}
            </p>
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

        {/* The axis */}
        <section className="pt-8">
          {classes.length === 0 ? (
            <StateView
              title="No classes"
              message={`Day order ${activeDO} is clear.`}
            />
          ) : (
            <ul>
              {items.map((item, i) =>
                item.kind === "break" ? (
                  <li key={`b${i}`} data-row className="flex gap-5 py-3">
                    <span className="tnum w-[46px] shrink-0" />
                    <span className="text-callout text-text-3">
                      {item.minutes} minute break
                    </span>
                  </li>
                ) : (
                  <li key={item.item.id} data-row>
                    <Rule soft={i > 0} />
                    <ClassEntry
                      item={item.item}
                      onRemove={removeCustomClass}
                      onToggleOptional={toggleOptional}
                    />
                  </li>
                ),
              )}
            </ul>
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

function ClassEntry({
  item,
  onRemove,
  onToggleOptional,
}: {
  item: ScheduleItem;
  onRemove: (id: string) => void;
  onToggleOptional: (code: string) => void;
}) {
  const muted = item.isOptional;
  // The portal appends a staff id to every name. Nobody needs to read it.
  const faculty = item.faculty?.replace(/\s*\(\d+\)\s*$/, "") ?? null;

  return (
    <div className={`flex gap-5 py-5 ${muted ? "opacity-40" : ""}`}>
      <div className="w-[46px] shrink-0">
        <p className="tnum text-callout text-text-1">{item.start}</p>
        <p className="tnum mt-0.5 text-callout text-text-3">{item.end}</p>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <h3
            className={`truncate text-headline ${
              muted ? "line-through decoration-line" : ""
            }`}
          >
            {item.title}
          </h3>
          <div className="flex shrink-0 items-center gap-1.5">
            {item.isLab && <Chip>Lab</Chip>}
            {item.isCustom && <Chip tone="accent">Added</Chip>}
          </div>
        </div>

        <p className="mt-1.5 truncate text-callout text-text-3">
          {[item.abbrev, item.room, faculty].filter(Boolean).join(" · ")}
        </p>

        <button
          onClick={() =>
            item.isCustom ? onRemove(item.id) : onToggleOptional(item.code)
          }
          className="mt-2 text-callout text-text-3/70 transition-colors hover:text-text-1"
        >
          {item.isCustom ? "Remove" : muted ? "Mark as required" : "Mark as optional"}
        </button>
      </div>
    </div>
  );
}
