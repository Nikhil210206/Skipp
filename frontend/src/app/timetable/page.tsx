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
import { revealIn, useGsap } from "@/lib/motion";
import { Button, Card, Chip, Label, Segmented, StateView } from "@/components/ui";

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
    ({ self, reduced }) => revealIn(self, reduced, { stagger: 0.04 }),
    [activeDO, classes.length],
  );

  const context =
    activeDO === todayDO
      ? "Today"
      : activeDO === upcomingDO
        ? `Next, ${prettyDate(upcoming?.date ?? "")}`
        : "Day order";

  if (dayOrders.length === 0) {
    return (
      <AppShell eyebrow="Schedule" title="Timetable">
        <StateView
          title="Timetable unavailable"
          message="We could not load your day-order grid. Pull down to try again."
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      eyebrow={context}
      title={`Day order ${activeDO}`}
      action={
        <Button variant="secondary" onClick={() => setSheetOpen(true)}>
          Add
        </Button>
      }
    >
      <div ref={scope} className="flex flex-1 flex-col">
        <div data-reveal className="mb-6">
          <Segmented
            label="Day order"
            value={activeDO}
            onChange={setSelected}
            options={dayOrders.map((d) => ({
              value: d.dayOrder,
              label: (
                <span className="tnum">
                  {d.dayOrder}
                  {d.dayOrder === todayDO && (
                    <span className="ml-1 inline-block size-1 rounded-full bg-accent align-middle" />
                  )}
                </span>
              ),
            }))}
          />
        </div>

        {holiday && activeDO === upcomingDO && (
          <div data-reveal className="mb-6">
            <Label tone="accent">Holiday today</Label>
            <p className="mt-2 text-body text-text-2">
              {holiday.event?.replace(/ - Holiday$/i, "") ?? "No classes today."} Showing
              the next working day.
            </p>
          </div>
        )}

        {classes.length === 0 ? (
          <StateView
            title="No classes"
            message={`Day order ${activeDO} is clear. Nothing to attend.`}
          />
        ) : (
          <>
            <div data-reveal className="mb-5 flex items-baseline justify-between">
              <Label>
                {attending[0]?.start} to {attending.at(-1)?.end}
              </Label>
              <span className="tnum text-callout text-text-3">
                {attending.length} {attending.length === 1 ? "class" : "classes"}
              </span>
            </div>

            <ul className="flex flex-col">
              {items.map((item, i) =>
                item.kind === "break" ? (
                  <li
                    key={`b${i}`}
                    data-reveal
                    className="flex items-center gap-3 py-2 pl-[62px]"
                  >
                    <span className="text-callout text-text-3">
                      {item.minutes} min break
                    </span>
                  </li>
                ) : (
                  <li key={item.item.id} data-reveal className="py-1.5">
                    <ClassCard
                      item={item.item}
                      onRemove={removeCustomClass}
                      onToggleOptional={toggleOptional}
                    />
                  </li>
                ),
              )}
            </ul>
          </>
        )}
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

function ClassCard({
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
  const meta = [item.room, faculty].filter(Boolean).join(" · ");

  return (
    <Card flush className={`flex gap-4 px-4 py-3.5 ${muted ? "opacity-45" : ""}`}>
      <div className="w-[42px] shrink-0 pt-0.5">
        <p className="tnum text-callout text-text-1">{item.start}</p>
        <p className="tnum text-callout text-text-3">{item.end}</p>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p
            className={`truncate text-headline ${
              muted ? "line-through decoration-text-3" : ""
            }`}
          >
            {item.abbrev}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {item.isLab && <Chip>Lab</Chip>}
            {item.isCustom && <Chip tone="accent">Added</Chip>}
            {muted && <Chip>Optional</Chip>}
          </div>
        </div>

        <p className="mt-0.5 truncate text-callout text-text-3">{item.title}</p>

        <div className="mt-1.5 flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate text-callout text-text-3">{meta}</p>
          {item.isCustom ? (
            <button
              onClick={() => onRemove(item.id)}
              className="shrink-0 text-callout text-text-3 transition-colors hover:text-risk"
            >
              Remove
            </button>
          ) : (
            <button
              onClick={() => onToggleOptional(item.code)}
              className="shrink-0 text-callout text-text-3 transition-colors hover:text-text-1"
            >
              {muted ? "Make required" : "Make optional"}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
