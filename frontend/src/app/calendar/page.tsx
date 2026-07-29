"use client";

import { useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useSession } from "@/context/SessionContext";
import { todayISO } from "@/lib/schedule";
import { revealIn, useGsap } from "@/lib/motion";
import { IconButton, StateView } from "@/components/ui";
import { Marginalia, Rule, SectionHead, TrackRule } from "@/components/ui/editorial";
import { IconChevronLeft, IconChevronRight } from "@/components/Icons";
import type { CalendarDay } from "@/types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * The term as one full-bleed grid. The selected day is written out above it in
 * words rather than boxed in a card, so the grid itself is the whole screen.
 */
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
    () => (byDate.has(today) ? today : months[0] ? `${months[0]}-01` : today),
  );

  const scope = useGsap(({ self, reduced }) => revealIn(self, reduced, { y: 12 }), [ym]);

  if (cal.length === 0) {
    return (
      <AppShell section="Calendar">
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

  const working = cells.filter(
    (d) => d !== null && byDate.get(iso(d))?.dayOrder != null,
  ).length;
  const upcoming = cal
    .filter((d) => d.isHoliday && d.event && d.date >= today)
    .slice(0, 3);

  // How far through the term we are, counted in working days rather than dates,
  // because only working days cost attendance.
  const workingAll = cal.filter((d) => d.dayOrder != null);
  const workingDone = workingAll.filter((d) => d.date < today).length;
  const termPct = workingAll.length > 0 ? (workingDone / workingAll.length) * 100 : 0;

  return (
    <AppShell section="Calendar">
      <div ref={scope} className="flex flex-1 flex-col">
        {/* The term as one measurement */}
        <div data-reveal className="pb-9 pt-3">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-label uppercase text-text-3">Term progress</p>
            <p className="tnum text-label uppercase text-text-3">
              {workingAll.length - workingDone} working days left
            </p>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="tnum text-title">{termPct.toFixed(0)}</span>
            <span className="text-callout text-text-3">%</span>
          </div>
          <TrackRule value={termPct} className="bleed mt-4" />
          <Marginalia>
            <span className="mt-4 block tnum">
              {workingDone} of {workingAll.length} working days behind you
            </span>
          </Marginalia>
        </div>

        {/* The selected day, written out */}
        <div data-reveal className="pb-8">
          <p className="text-label uppercase text-text-3">
            {sel ? fullWeekday(sel.weekday) : "Term"} · {shortDate(selected)}
          </p>
          <h1 className="mt-3 text-title">
            {sel?.dayOrder != null
              ? `Day order ${sel.dayOrder}`
              : sel?.isHoliday
                ? "Holiday"
                : "No classes"}
          </h1>
          {sel?.event && (
            <Marginalia>
              <span className="mt-3 block">
                {sel.event.replace(/ - Holiday$/i, "")}
              </span>
            </Marginalia>
          )}
        </div>

        {/* Month rail */}
        <div data-reveal className="flex items-end justify-between gap-4 pb-6">
          <h2 className="optical text-poster leading-[0.78]">
            {MONTHS[month0].slice(0, 3)}
            <span className="tnum block text-title text-text-3">{year}</span>
          </h2>
          <div className="-mr-2 flex">
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

        {/* Full-bleed grid */}
        <div data-reveal className="bleed bleed-pad">
          <div className="grid grid-cols-7">
            {WEEKDAYS.map((w, i) => (
              <div
                key={i}
                className="pb-4 text-center text-label uppercase text-text-3/70"
              >
                {w}
              </div>
            ))}
            {cells.map((d, i) => {
              if (d === null) return <div key={i} />;
              const date = iso(d);
              const day = byDate.get(date);
              const isSel = date === selected;
              const isToday = date === today;
              const works = day?.dayOrder != null;
              return (
                <button
                  key={i}
                  onClick={() => setSelected(date)}
                  aria-pressed={isSel}
                  aria-label={`${d} ${MONTHS[month0]}${works ? `, day order ${day!.dayOrder}` : ""}`}
                  data-day
                  className="relative flex h-[52px] flex-col items-center justify-center"
                >
                  <span
                    className={`tnum text-body transition-colors ${
                      isSel
                        ? "font-semibold text-accent"
                        : works
                          ? "text-text-1"
                          : "text-text-3/45"
                    }`}
                  >
                    {d}
                  </span>
                  <span className="tnum mt-1 h-2 text-[9px] font-semibold leading-none text-text-3/70">
                    {works ? day!.dayOrder : ""}
                  </span>
                  {isToday && (
                    <span className="absolute bottom-1.5 h-px w-5 bg-accent" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div data-reveal className="pt-6">
          <Marginalia>
            <span className="tnum">{working} working days</span> · small figures are day
            orders
          </Marginalia>
        </div>

        {upcoming.length > 0 && (
          <section data-reveal className="pt-10">
            <SectionHead>Coming up</SectionHead>
            <ul className="mt-1">
              {upcoming.map((d, i) => (
                <li key={d.date}>
                  <Rule soft={i > 0} />
                  <button
                    onClick={() => {
                      setYm(d.date.slice(0, 7));
                      setSelected(d.date);
                    }}
                    className="flex w-full items-baseline justify-between gap-4 py-3.5 text-left"
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
          </section>
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
  return `${MONTHS[m - 1].slice(0, 3)} ${d}`;
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
