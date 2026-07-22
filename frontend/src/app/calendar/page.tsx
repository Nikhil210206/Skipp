"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import StatePanel from "@/components/StatePanel";
import { useSession } from "@/context/SessionContext";
import { todayISO } from "@/lib/schedule";
import type { CalendarDay } from "@/types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export default function CalendarPage() {
  const { timetable } = useSession();
  const cal = timetable?.calendar ?? [];

  const byDate = useMemo(() => {
    const m = new Map<string, CalendarDay>();
    cal.forEach((d) => m.set(d.date, d));
    return m;
  }, [cal]);

  // Months present in the calendar, as {year, month0}.
  const months = useMemo(() => {
    const set = new Set<string>();
    cal.forEach((d) => set.add(d.date.slice(0, 7)));
    return [...set].sort();
  }, [cal]);

  const today = todayISO();
  const initialMonth =
    months.find((m) => m === today.slice(0, 7)) ?? months[0] ?? today.slice(0, 7);
  const [ym, setYm] = useState(initialMonth);
  const [selected, setSelected] = useState(
    byDate.has(today) ? today : (months[0] ? months[0] + "-01" : today),
  );

  if (cal.length === 0) {
    return (
      <AppShell title="calendar">
        <StatePanel
          icon="▤"
          title="Calendar unavailable"
          message="Couldn't load the academic planner. Try again in a bit."
        />
      </AppShell>
    );
  }

  const [year, month0] = [Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1];
  const monthIdx = months.indexOf(ym);
  const sel = byDate.get(selected);

  // Build the Monday-first grid.
  const firstDow = (new Date(year, month0, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const iso = (d: number) =>
    `${year}-${String(month0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  return (
    <AppShell title="calendar">
      {/* Selected-day summary */}
      <motion.div
        key={selected}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5 rounded-2xl bg-surface p-5"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-text-muted">
          {sel ? fullWeekday(sel.weekday) : "—"}
        </p>
        <div className="mt-2 flex items-end gap-4">
          <span className="text-6xl font-extrabold leading-none tracking-tight">
            {sel?.dayOrder != null ? String(sel.dayOrder).padStart(2, "0") : "—"}
          </span>
          <div className="pb-1">
            <p className="text-lg font-bold uppercase">
              {MONTH_NAMES[month0].slice(0, 3)} {Number(selected.slice(8))}
            </p>
            <p
              className={`text-sm ${sel?.isHoliday ? "text-danger" : "text-text-muted"}`}
            >
              {sel?.event
                ? sel.event.replace(/ - Holiday$/i, "")
                : sel?.dayOrder != null
                  ? "regular classes"
                  : "no classes"}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Month header + nav */}
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-2xl font-extrabold tracking-tight">
          {MONTH_NAMES[month0]}{" "}
          <span className="text-text-muted">{year}</span>
        </h2>
        <div className="flex gap-2">
          <NavBtn
            disabled={monthIdx <= 0}
            onClick={() => monthIdx > 0 && setYm(months[monthIdx - 1])}
          >
            ‹
          </NavBtn>
          <NavBtn
            disabled={monthIdx >= months.length - 1}
            onClick={() =>
              monthIdx < months.length - 1 && setYm(months[monthIdx + 1])
            }
          >
            ›
          </NavBtn>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-y-2 px-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={i}
            className="pb-1 text-center text-xs font-medium text-text-muted"
          >
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const day = byDate.get(iso(d));
          const isSel = iso(d) === selected;
          const isToday = iso(d) === today;
          const working = day?.dayOrder != null;
          const holiday = day?.isHoliday;
          return (
            <button
              key={i}
              onClick={() => setSelected(iso(d))}
              className="relative flex flex-col items-center py-1"
            >
              <span
                className={`flex size-9 items-center justify-center rounded-xl text-sm font-semibold ${
                  isSel
                    ? "bg-accent text-background"
                    : working
                      ? "text-text-primary"
                      : "text-danger/70"
                } ${isToday && !isSel ? "ring-1 ring-accent" : ""}`}
              >
                {d}
              </span>
              <span className="mt-0.5 h-3 text-[10px] font-bold leading-none">
                {working && !isSel ? (
                  <span className="text-accent">{day!.dayOrder}</span>
                ) : holiday && !isSel ? (
                  <span className="text-danger">•</span>
                ) : (
                  ""
                )}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-5 px-1 text-xs text-text-muted">
        <span className="text-accent">orange</span> = day order ·{" "}
        <span className="text-danger">red</span> = holiday / weekend
      </p>
    </AppShell>
  );
}

function NavBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex size-9 items-center justify-center rounded-full bg-surface text-lg text-text-primary transition-colors hover:bg-white/5 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function fullWeekday(abbr: string): string {
  const map: Record<string, string> = {
    Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday",
    Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
  };
  return map[abbr] ?? abbr;
}
