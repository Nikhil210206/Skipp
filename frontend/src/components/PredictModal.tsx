"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "@/context/SessionContext";
import { todayISO } from "@/lib/schedule";
import { projectAttendance, type DayKind } from "@/lib/leavePredictor";
import { predict } from "@/lib/predictor";
import NumBadge from "@/components/NumBadge";
import {
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconTrendDown,
  IconTrendUp,
} from "@/components/Icons";

const RECOVER_TARGET = 75;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

const TABS: { kind: DayKind; label: string }[] = [
  { kind: "leave", label: "leaves" },
  { kind: "attending", label: "attending" },
  { kind: "odml", label: "od·ml" },
];

const KIND_BG: Record<DayKind, string> = {
  leave: "bg-danger",
  attending: "bg-success",
  odml: "bg-accent",
};
const KIND_TEXT: Record<DayKind, string> = {
  leave: "text-danger",
  attending: "text-success",
  odml: "text-accent",
};

export default function PredictModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { timetable, attendance } = useSession();
  const cal = useMemo(() => timetable?.calendar ?? [], [timetable]);

  const byDate = useMemo(() => {
    const m = new Map(cal.map((d) => [d.date, d]));
    return m;
  }, [cal]);
  const months = useMemo(() => {
    const set = new Set(cal.map((d) => d.date.slice(0, 7)));
    return [...set].sort();
  }, [cal]);

  const today = todayISO();
  const [ym, setYm] = useState(
    () => months.find((m) => m === today.slice(0, 7)) ?? months[0] ?? today.slice(0, 7),
  );
  const [tab, setTab] = useState<DayKind>("leave");
  const [mode, setMode] = useState<"single" | "range">("single");
  const [selections, setSelections] = useState<Record<string, DayKind>>({});
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const monthIdx = months.indexOf(ym);
  const year = Number(ym.slice(0, 4));
  const month0 = Number(ym.slice(5, 7)) - 1;
  const firstDow = (new Date(year, month0, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const iso = (d: number) =>
    `${year}-${String(month0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const selectedCount = Object.keys(selections).length;
  const isWorking = (date: string) => byDate.get(date)?.dayOrder != null;

  function toggle(date: string) {
    if (!isWorking(date)) return;
    if (mode === "range") {
      if (!rangeStart) {
        setRangeStart(date);
        setSelections((s) => ({ ...s, [date]: tab }));
        return;
      }
      const [a, b] = [rangeStart, date].sort();
      const next = { ...selections };
      let cur = new Date(a + "T00:00:00");
      const end = new Date(b + "T00:00:00");
      while (cur <= end) {
        const ds = todayISO(cur);
        if (isWorking(ds)) next[ds] = tab;
        cur = new Date(cur.getTime() + 86400000);
      }
      setSelections(next);
      setRangeStart(null);
      return;
    }
    setSelections((s) => {
      const next = { ...s };
      if (next[date] === tab) delete next[date];
      else next[date] = tab;
      return next;
    });
  }

  const projection =
    attendance && showResult
      ? projectAttendance({
          attendance,
          calendar: cal,
          dayOrders: timetable?.dayOrders ?? [],
          selections,
        })
      : null;

  function reset() {
    setSelections({});
    setRangeStart(null);
    setShowResult(false);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex flex-col bg-background"
        >
          <div className="mx-auto flex h-full w-full max-w-md flex-col px-5 pt-8">
            {/* Header */}
            <div className="mb-6 flex shrink-0 items-start justify-between">
              <div>
                <h1 className="text-4xl font-extrabold uppercase tracking-tight">
                  predict
                </h1>
                <p className={`text-sm lowercase ${KIND_TEXT[tab]}`}>
                  {showResult ? "your forecast" : "plan your leaves"}
                </p>
              </div>
              <button
                onClick={() => {
                  onClose();
                  reset();
                }}
                className="flex size-11 items-center justify-center rounded-full bg-surface text-text-muted"
                aria-label="Close"
              >
                <IconClose size={20} />
              </button>
            </div>

            {projection ? (
              <ResultView projection={projection} onBack={() => setShowResult(false)} />
            ) : (
              <>
                {/* Tabs */}
                <div className="mb-5 flex shrink-0 gap-1 rounded-full bg-surface p-1">
                  {TABS.map((t) => {
                    const active = t.kind === tab;
                    return (
                      <button
                        key={t.kind}
                        onClick={() => setTab(t.kind)}
                        className={`relative flex-1 rounded-full py-2.5 text-sm font-bold uppercase tracking-wide transition-colors ${
                          active ? "text-background" : "text-text-muted"
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId="predict-tab"
                            className={`absolute inset-0 rounded-full ${KIND_BG[t.kind]}`}
                            transition={{ type: "spring", stiffness: 400, damping: 32 }}
                          />
                        )}
                        <span className="relative">{t.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Scrollable middle */}
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                {/* Month nav */}
                <div className="mb-3 flex items-center justify-between">
                  <NavBtn
                    disabled={monthIdx <= 0}
                    onClick={() => monthIdx > 0 && setYm(months[monthIdx - 1])}
                  >
                    <IconChevronLeft size={18} />
                  </NavBtn>
                  <h2 className="text-lg font-extrabold uppercase tracking-wide">
                    {MONTHS[month0]} {year}
                  </h2>
                  <NavBtn
                    disabled={monthIdx >= months.length - 1}
                    onClick={() =>
                      monthIdx < months.length - 1 && setYm(months[monthIdx + 1])
                    }
                  >
                    <IconChevronRight size={18} />
                  </NavBtn>
                </div>

                {/* Calendar */}
                <div className="rounded-3xl bg-surface p-4">
                  <div className="grid grid-cols-7 gap-y-1">
                    {WEEKDAYS.map((w, i) => (
                      <div
                        key={i}
                        className="pb-2 text-center text-xs font-medium text-text-muted"
                      >
                        {w}
                      </div>
                    ))}
                    {Array.from({ length: firstDow }).map((_, i) => (
                      <div key={`e${i}`} />
                    ))}
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                      const ds = iso(d);
                      const working = isWorking(ds);
                      const sel = selections[ds];
                      const isStart = rangeStart === ds;
                      const isToday = ds === today;
                      return (
                        <button
                          key={d}
                          onClick={() => toggle(ds)}
                          disabled={!working}
                          className="flex flex-col items-center py-1"
                        >
                          <span
                            className={`flex size-9 items-center justify-center rounded-xl text-sm font-semibold ${
                              sel
                                ? `${KIND_BG[sel]} text-background`
                                : working
                                  ? "text-text-primary"
                                  : "text-text-muted/40"
                            } ${isStart ? "ring-2 ring-accent" : ""} ${
                              isToday && !sel ? "ring-1 ring-line-strong" : ""
                            }`}
                          >
                            {d}
                          </span>
                          <span className="mt-0.5 h-1.5">
                            {working && !sel && (
                              <span className="block size-1 rounded-full bg-danger/70" />
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Single / range */}
                <div className="mt-4 flex gap-1 rounded-full bg-surface p-1">
                  {(["single", "range"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setMode(m);
                        setRangeStart(null);
                      }}
                      className={`flex-1 rounded-full py-2.5 text-sm font-bold uppercase tracking-wide transition-colors ${
                        mode === m
                          ? "bg-surface-2 text-text-primary"
                          : "text-text-muted"
                      }`}
                    >
                      {m === "single" ? "single day" : "date range"}
                    </button>
                  ))}
                </div>

                </div>

                {/* Confirm bar */}
                <div className="mb-6 mt-4 flex shrink-0 items-center gap-3 rounded-3xl bg-surface p-4">
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-wider text-text-muted">
                      total days
                    </p>
                    <p className="text-3xl font-extrabold">{selectedCount}</p>
                  </div>
                  {selectedCount > 0 && (
                    <button
                      onClick={reset}
                      className="rounded-xl px-3 py-2 text-sm text-text-muted"
                    >
                      clear
                    </button>
                  )}
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    disabled={selectedCount === 0 || !attendance}
                    onClick={() => setShowResult(true)}
                    className="flex items-center gap-2 rounded-2xl bg-accent px-7 py-4 font-bold uppercase tracking-wide text-background disabled:opacity-40"
                  >
                    predict
                    <IconCheck size={18} />
                  </motion.button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ResultView({
  projection,
  onBack,
}: {
  projection: ReturnType<typeof projectAttendance>;
  onBack: () => void;
}) {
  const drop = projection.overallAfter - projection.overallBefore;
  const totalA = projection.subjects.reduce((x, s) => x + s.attendedAfter, 0);
  const totalC = projection.subjects.reduce((x, s) => x + s.conductedAfter, 0);
  const overallRec = predict(totalA, totalC, RECOVER_TARGET);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Overall: the recovery count is the hero */}
      <div className="mb-3 shrink-0 rounded-3xl bg-surface p-5 text-center">
        <p className="text-xs uppercase tracking-widest text-text-muted">
          overall after {projection.affectedDays} day
          {projection.affectedDays === 1 ? "" : "s"}
        </p>
        {overallRec.isSafe ? (
          <>
            <p className="mt-1 text-7xl font-extrabold leading-none text-success">
              {overallRec.canSkip}
            </p>
            <p className="mt-2 text-sm font-medium text-success">
              classes you can still skip
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 text-7xl font-extrabold leading-none text-danger">
              {overallRec.mustAttend}
            </p>
            <p className="mt-2 text-sm font-medium text-danger">
              classes required to reach {RECOVER_TARGET}%
            </p>
          </>
        )}
        <p className="mt-2 text-xs text-text-muted">
          {projection.overallBefore.toFixed(1)}% to{" "}
          {projection.overallAfter.toFixed(1)}%
          <span
            className={`ml-1 inline-flex items-center gap-1 align-middle ${
              drop < 0 ? "text-danger" : "text-success"
            }`}
          >
            {drop < 0 ? <IconTrendDown size={13} /> : <IconTrendUp size={13} />}
            {Math.abs(drop).toFixed(1)}%
          </span>
        </p>
      </div>

      {/* Per subject: big required number, tiny percentage */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ul className="flex flex-col gap-2 pb-4">
          {projection.subjects
            .filter((s) => s.conductedAfter > 0)
            .map((s, i) => {
              const rec = predict(s.attendedAfter, s.conductedAfter, RECOVER_TARGET);
              return (
                <li
                  key={`${s.code}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.title}</p>
                    <p className="text-xs text-text-muted">
                      {s.attendedAfter}/{s.conductedAfter} · {s.pctAfter.toFixed(0)}%
                    </p>
                  </div>
                  {!rec.isSafe ? (
                    <NumBadge n={rec.mustAttend} label="required" tone="text-danger" />
                  ) : (
                    <NumBadge
                      n={rec.canSkip}
                      label="can skip"
                      tone={rec.canSkip > 0 ? "text-success" : "text-warning"}
                    />
                  )}
                </li>
              );
            })}
        </ul>
      </div>

      <button
        onClick={onBack}
        className="mb-6 mt-2 flex w-full shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-surface py-4 font-bold uppercase tracking-wide text-text-primary"
      >
        <IconChevronLeft size={18} />
        edit days
      </button>
    </div>
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
      className="flex size-11 items-center justify-center rounded-full bg-surface text-xl text-text-primary disabled:opacity-30"
    >
      {children}
    </button>
  );
}
