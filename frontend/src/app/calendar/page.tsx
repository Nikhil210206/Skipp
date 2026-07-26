"use client";

import { useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useSession } from "@/context/SessionContext";
import { todayISO } from "@/lib/schedule";
import { revealIn, useGsap } from "@/lib/motion";
import { Card, Chip, Divider, IconButton, Label, StateView } from "@/components/ui";
import { IconChevronLeft, IconChevronRight } from "@/components/Icons";
import type { CalendarDay } from "@/types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export default function CalendarPage() {
  const { timetable } = useSession();
  const cal = useMemo(() => timetable?.calendar ?? [], [timetable]);

  const byDate = useMemo(() => {
    const m = new Map<string, CalendarDay>();
    cal.forEach((d) => m.set(d.date, d));
    return m;
  }, [cal]);

  const months = useMemo(() => {
    const set = new Set<string>();
    cal.forEach((d) => set.add(d.date.slice(0, 7)));
    return [...set].sort();
  }, [cal]);

  const today = todayISO();
  const [ym, setYm] = useState(
    () => months.find((m) => m === today.slice(0, 7)) ?? months[0] ?? today.slice(0, 7),
  );
  const [selected, setSelected] = useState(
    () => (byDate.has(today) ? today : (months[0] ? `${months[0]}-01` : today)),
  );

  const scope = useGsap(({ self, reduced }) => revealIn(self, reduced), [ym]);

  if (cal.length === 0) {
    return (
      <AppShell eyebrow="Term" title="Calendar">
        <StateView
          title="Calendar unavailable"
          message="We could not load the academic planner. Pull down to try again."
        />
      </AppShell>
    );
  }

  const [year, month0] = [Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1];
  const monthIdx = months.indexOf(ym);
  const sel = byDate.get(selected);
  const firstDow = (new Date(year, month0, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const iso = (d: number) =>
    `${year}-${String(month0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const workingDays = cells.filter(
    (d) => d !== null && byDate.get(iso(d))?.dayOrder != null,
  ).length;

  // What is actually worth knowing about the rest of the term.
  const upcoming = cal
    .filter((d) => d.isHoliday && d.event && d.date >= today)
    .slice(0, 4);

  return (
    <AppShell
      eyebrow={sel ? fullWeekday(sel.weekday) : "Term"}
      title={
        sel?.dayOrder != null
          ? `Day order ${sel.dayOrder}`
          : sel?.isHoliday
            ? "Holiday"
            : "No classes"
      }
    >
      <div ref={scope} className="flex flex-1 flex-col">
        <div data-reveal className="mb-8 flex items-center gap-3">
          <span className="tnum text-callout text-text-3">
            {MONTH_NAMES[month0].slice(0, 3)} {Number(selected.slice(8))}
          </span>
          {sel?.event && (
            <Chip tone={sel.isHoliday ? "accent" : "neutral"}>
              {sel.event.replace(/ - Holiday$/i, "")}
            </Chip>
          )}
        </div>

        <div data-reveal className="mb-4 flex items-center justify-between">
          <h2 className="text-title">
            {MONTH_NAMES[month0]} <span className="tnum text-text-3">{year}</span>
          </h2>
          <div className="flex gap-1">
            <IconButton
              label="Previous month"
              variant="quiet"
              disabled={monthIdx <= 0}
              onClick={() => monthIdx > 0 && setYm(months[monthIdx - 1])}
            >
              <IconChevronLeft size={18} />
            </IconButton>
            <IconButton
              label="Next month"
              variant="quiet"
              disabled={monthIdx >= months.length - 1}
              onClick={() => monthIdx < months.length - 1 && setYm(months[monthIdx + 1])}
            >
              <IconChevronRight size={18} />
            </IconButton>
          </div>
        </div>

        <div data-reveal className="grid grid-cols-7 gap-y-1">
          {WEEKDAYS.map((w, i) => (
            <div key={i} className="pb-3 text-center text-label uppercase text-text-3">
              {w}
            </div>
          ))}
          {cells.map((d, i) => {
            if (d === null) return <div key={i} />;
            const date = iso(d);
            const day = byDate.get(date);
            const isSel = date === selected;
            const isToday = date === today;
            const working = day?.dayOrder != null;
            return (
              <button
                key={i}
                onClick={() => setSelected(date)}
                aria-label={`${d} ${MONTH_NAMES[month0]}${working ? `, day order ${day!.dayOrder}` : ""}`}
                aria-pressed={isSel}
                className="flex min-h-[46px] flex-col items-center justify-center gap-1 rounded-control"
              >
                <span
                  className={`tnum flex size-8 items-center justify-center rounded-full text-body transition-colors ${
                    isSel
                      ? "bg-text-1 font-semibold text-ink-0"
                      : working
                        ? "text-text-1"
                        : "text-text-3"
                  } ${isToday && !isSel ? "border border-accent" : ""}`}
                >
                  {d}
                </span>
                <span className="tnum h-2 text-[9px] font-semibold leading-none text-text-3">
                  {working && !isSel ? day!.dayOrder : ""}
                </span>
              </button>
            );
          })}
        </div>

        <div data-reveal className="mt-7 flex items-center gap-4">
          <Label>{workingDays} working days</Label>
          <span className="text-callout text-text-3">
            Small figures are day orders
          </span>
        </div>

        {upcoming.length > 0 && (
          <Card data-reveal flush className="mt-6 overflow-hidden" as="section">
            <div className="px-5 pb-1 pt-4">
              <Label>Coming up</Label>
            </div>
            <ul>
              {upcoming.map((d, i) => (
                <li key={d.date}>
                  {i > 0 && <Divider inset={20} />}
                  <button
                    onClick={() => {
                      setYm(d.date.slice(0, 7));
                      setSelected(d.date);
                    }}
                    className="flex w-full items-baseline justify-between gap-4 px-5 py-3.5 text-left"
                  >
                    <span className="min-w-0 flex-1 truncate text-body">
                      {d.event?.replace(/ - Holiday$/i, "")}
                    </span>
                    <span className="tnum shrink-0 text-callout text-text-3">
                      {shortDate(d.date)} · {daysAway(today, d.date)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function fullWeekday(abbr: string): string {
  const map: Record<string, string> = {
    Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday",
    Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
  };
  return map[abbr] ?? abbr;
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTH_NAMES[m - 1].slice(0, 3)} ${d}`;
}

function daysAway(from: string, to: string): string {
  const days = Math.round(
    (Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`)) / 86400000,
  );
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 7) return `in ${days} days`;
  const weeks = Math.round(days / 7);
  return weeks === 1 ? "in a week" : `in ${weeks} weeks`;
}
