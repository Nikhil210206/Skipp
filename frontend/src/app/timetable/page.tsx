"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import StatePanel from "@/components/StatePanel";
import CustomClassSheet from "@/components/CustomClassSheet";
import { useSession } from "@/context/SessionContext";
import {
  calendarDay,
  daySchedule,
  scheduleFor,
  timeline,
  todayISO,
  type ScheduleItem,
  type TimelineItem,
} from "@/lib/schedule";

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
  const todayDO = timetable
    ? (calendarDay(timetable.calendar, todayISO())?.dayOrder ?? null)
    : null;

  // `selected` is null until the user picks a day order — so the view always
  // defaults to today's day order (resolved once the snapshot loads), and a
  // reload/relaunch lands on today again rather than sticking on a stale DO.
  const [selected, setSelected] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeDO = selected ?? todayDO ?? dayOrders[0]?.dayOrder ?? 1;

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

  const schedule = scheduleFor(dayOrders, activeDO);
  const classes = daySchedule(
    schedule?.classes ?? [],
    customClasses,
    activeDO,
    optionalCourses,
  );
  const items = timeline(classes);
  // The day-overview reflects classes you actually attend (optional excluded).
  const attending = classes.filter((c) => !c.isOptional);
  const first = attending[0];
  const last = attending.at(-1);

  return (
    <AppShell title="timetable">
      {/* Big day-order number */}
      <div className="mb-4 text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
          {activeDO === todayDO ? (
            <>
              <span className="text-accent">today</span> · day order
            </>
          ) : (
            "day order"
          )}
        </p>
        <motion.p
          key={activeDO}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-7xl font-extrabold tracking-tight"
        >
          {String(activeDO).padStart(2, "0")}
        </motion.p>
      </div>

      {/* DO selector */}
      <div className="mb-4 flex items-center gap-1 rounded-full bg-surface p-1">
        <span className="px-3 text-xs font-bold uppercase tracking-wider text-accent">
          DO
        </span>
        {dayOrders.map((d) => {
          const active = d.dayOrder === activeDO;
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
              {d.dayOrder === todayDO && !active && (
                <span className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-accent" />
              )}
            </button>
          );
        })}
      </div>

      {/* Add custom class */}
      <button
        onClick={() => setSheetOpen(true)}
        className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-dashed border-white/15 px-4 py-3 text-left transition-colors hover:border-accent/50"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-lg text-accent">
          +
        </span>
        <span>
          <span className="block font-semibold lowercase">custom class</span>
          <span className="block text-xs text-text-muted">
            add an extra class to day order {activeDO}
          </span>
        </span>
      </button>

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
            <span className="font-bold">{attending.length}</span>
            <span className="text-text-muted"> classes</span>
          </span>
        </div>
      ) : (
        <p className="mb-4 rounded-2xl bg-surface px-4 py-6 text-center text-sm text-text-muted">
          No classes on day order {activeDO}.
        </p>
      )}

      {/* Timeline */}
      <ul className="relative flex flex-col gap-3 pb-6 pl-4">
        <span className="absolute bottom-6 left-[7px] top-2 w-px bg-white/10" />
        {items.map((item, i) => (
          <TimelineRow
            key={i}
            item={item}
            index={i}
            onRemove={removeCustomClass}
            onToggleOptional={toggleOptional}
          />
        ))}
      </ul>

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

function TimelineRow({
  item,
  index,
  onRemove,
  onToggleOptional,
}: {
  item: TimelineItem;
  index: number;
  onRemove: (id: string) => void;
  onToggleOptional: (code: string) => void;
}) {
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
  const c: ScheduleItem = item.item;
  const dot = c.isCustom
    ? "bg-warning"
    : c.isOptional
      ? "bg-white/25"
      : "bg-accent";
  return (
    <motion.li
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.25) }}
      className="relative"
    >
      <span
        className={`absolute -left-4 top-4 size-3 rounded-full border-2 border-background ${dot}`}
      />
      <div
        className={`rounded-2xl p-4 transition-opacity ${
          c.isCustom
            ? "border border-warning/25 bg-warning/[0.06]"
            : "bg-surface"
        } ${c.isOptional ? "opacity-45" : ""}`}
      >
        <div className="mb-1 flex items-center gap-2 text-sm text-text-muted">
          <span>🕐</span>
          <span className="font-medium">
            {c.start} – {c.end}
          </span>
          {c.isLab && <Tag>lab</Tag>}
          {c.isCustom && <Tag tone="warning">custom</Tag>}
          {c.isOptional && <Tag tone="muted">optional</Tag>}
          {c.isCustom ? (
            <button
              onClick={() => onRemove(c.id)}
              className="ml-auto text-xs text-text-muted hover:text-danger"
              aria-label="Remove custom class"
            >
              remove
            </button>
          ) : (
            <button
              onClick={() => onToggleOptional(c.code)}
              className="ml-auto text-xs text-text-muted hover:text-text-primary"
            >
              {c.isOptional ? "make required" : "mark optional"}
            </button>
          )}
        </div>
        <h3
          className={`text-2xl font-extrabold tracking-tight ${
            c.isOptional ? "line-through decoration-white/30" : ""
          }`}
        >
          {c.abbrev}
        </h3>
        <p className="text-sm text-text-muted">{c.title}</p>
        {(c.room || c.faculty) && (
          <div className="mt-3 flex items-center gap-4 border-t border-white/5 pt-3 text-xs text-text-muted">
            {c.room && <span>📍 {c.room}</span>}
            {c.faculty && <span className="truncate">👤 {c.faculty}</span>}
          </div>
        )}
      </div>
    </motion.li>
  );
}

function Tag({
  children,
  tone = "accent",
}: {
  children: React.ReactNode;
  tone?: "accent" | "warning" | "muted";
}) {
  const cls =
    tone === "warning"
      ? "bg-warning/15 text-warning"
      : tone === "muted"
        ? "bg-white/10 text-text-muted"
        : "bg-accent/15 text-accent";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${cls}`}
    >
      {children}
    </span>
  );
}
