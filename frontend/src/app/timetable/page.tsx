"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import StatePanel from "@/components/StatePanel";
import { useSession } from "@/context/SessionContext";
import {
  calendarDay,
  scheduleFor,
  timeline,
  todayISO,
  type TimelineItem,
} from "@/lib/schedule";

export default function TimetablePage() {
  const { timetable } = useSession();
  const dayOrders = timetable?.dayOrders ?? [];
  const todayDO = timetable
    ? (calendarDay(timetable.calendar, todayISO())?.dayOrder ?? null)
    : null;

  const [selected, setSelected] = useState<number>(todayDO ?? 1);

  if (dayOrders.length === 0) {
    return (
      <AppShell title="timetable">
        <StatePanel
          icon="▦"
          title="Timetable unavailable"
          message="Couldn't load the day-order grid. Try again in a bit."
        />
      </AppShell>
    );
  }

  const schedule = scheduleFor(dayOrders, selected);
  const classes = schedule?.classes ?? [];
  const items = timeline(classes);
  const first = classes[0];
  const last = classes.at(-1);

  return (
    <AppShell title="timetable">
      {/* Big day-order number */}
      <div className="mb-4 text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
          current day order
        </p>
        <motion.p
          key={selected}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-7xl font-extrabold tracking-tight"
        >
          {String(selected).padStart(2, "0")}
        </motion.p>
      </div>

      {/* DO selector */}
      <div className="mb-5 flex items-center gap-1 rounded-full bg-surface p-1">
        <span className="px-3 text-xs font-bold uppercase tracking-wider text-accent">
          DO
        </span>
        {dayOrders.map((d) => {
          const active = d.dayOrder === selected;
          return (
            <button
              key={d.dayOrder}
              onClick={() => setSelected(d.dayOrder)}
              className={`relative flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${
                active ? "text-background" : "text-text-muted hover:text-text-primary"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="do-pill"
                  className="absolute inset-0 rounded-full bg-accent"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative">{d.dayOrder}</span>
            </button>
          );
        })}
      </div>

      {/* Day overview */}
      {classes.length > 0 ? (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-accent/30 bg-accent/[0.07] px-4 py-3">
          <span className="text-xs uppercase tracking-widest text-text-muted">
            day overview
          </span>
          <span className="text-sm">
            <span className="font-bold text-accent">{first?.start}</span>
            <span className="text-text-muted"> to </span>
            <span className="font-bold text-accent">{last?.end}</span>
          </span>
          <span className="text-sm">
            <span className="font-bold">{classes.length}</span>
            <span className="text-text-muted"> classes</span>
          </span>
        </div>
      ) : (
        <p className="mb-4 rounded-2xl bg-surface px-4 py-6 text-center text-sm text-text-muted">
          No classes on day order {selected}.
        </p>
      )}

      {/* Timeline */}
      <ul className="relative flex flex-col gap-3 pb-6 pl-4">
        <span className="absolute bottom-6 left-[7px] top-2 w-px bg-white/10" />
        {items.map((item, i) => (
          <TimelineRow key={i} item={item} index={i} />
        ))}
      </ul>
    </AppShell>
  );
}

function TimelineRow({ item, index }: { item: TimelineItem; index: number }) {
  if (item.kind === "break") {
    return (
      <li className="flex items-center gap-3 py-0.5 opacity-50">
        <span className="-ml-4 size-2 rounded-full bg-white/20" />
        <span className="text-xs uppercase tracking-wider text-text-muted">
          short break
        </span>
        <span className="ml-auto text-xs text-text-muted">
          {item.start} – {item.end}
        </span>
      </li>
    );
  }
  const c = item.period;
  return (
    <motion.li
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.25) }}
      className="relative"
    >
      <span className="absolute -left-4 top-4 size-3 rounded-full border-2 border-background bg-accent" />
      <div className="rounded-2xl bg-surface p-4">
        <div className="mb-1 flex items-center gap-2 text-sm text-text-muted">
          <span>🕐</span>
          <span className="font-medium">
            {c.start} – {c.end}
          </span>
          {c.isLab && (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-accent">
              lab
            </span>
          )}
        </div>
        <h3 className="text-2xl font-extrabold tracking-tight">{c.abbrev}</h3>
        <p className="text-sm text-text-muted">{c.title}</p>
        <div className="mt-3 flex items-center gap-4 border-t border-white/5 pt-3 text-xs text-text-muted">
          {c.room && <span>📍 {c.room}</span>}
          {c.faculty && <span className="truncate">👤 {c.faculty}</span>}
        </div>
      </div>
    </motion.li>
  );
}
