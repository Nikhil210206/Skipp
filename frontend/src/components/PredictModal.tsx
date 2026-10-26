"use client";

import { useMemo, useRef, useState } from "react";
import { useSession } from "@/context/SessionContext";
import { prettyDate, todayISO } from "@/lib/schedule";
import {
  calculateSubjectMargin,
  projectAttendance,
  type PredictAction,
  type ProjectedSubject,
  type Projection,
} from "@/lib/leavePredictor";
import { countTo, revealIn, useGsap } from "@/lib/motion";
import { Panel } from "@/components/ui/Overlay";
import { Button, Chip, IconButton, Label, Segmented } from "@/components/ui";
import { IconChevronLeft, IconChevronRight } from "@/components/Icons";
import { Amount, SectionHead, TrackRule } from "@/components/ui/editorial";

const TARGET = 75;
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export default function PredictModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { timetable, attendance, attendingDayOrders } = useSession();
  const cal = useMemo(() => timetable?.calendar ?? [], [timetable]);
  const byDate = useMemo(() => new Map(cal.map((d) => [d.date, d])), [cal]);
  const today = todayISO();

  // All months in the calendar, prioritizing from current month onwards
  const months = useMemo(() => {
    const all = [...new Set(cal.map((d) => d.date.slice(0, 7)))].sort();
    return all.length > 0 ? all : [today.slice(0, 7)];
  }, [cal, today]);

  const [ym, setYm] = useState(() => {
    const cur = today.slice(0, 7);
    return months.includes(cur) ? cur : months[0] ?? cur;
  });

  const [action, setAction] = useState<PredictAction>("leave");
  const [mode, setMode] = useState<"single" | "range">("single");
  const [dateActions, setDateActions] = useState<Record<string, PredictAction>>({});
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const selectedDates = useMemo(() => Object.keys(dateActions).sort(), [dateActions]);
  const totalDays = selectedDates.length;

  const monthIdx = months.indexOf(ym);
  const year = Number(ym.slice(0, 4));
  const month0 = Number(ym.slice(5, 7)) - 1;
  const firstDow = (new Date(year, month0, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const iso = (d: number) =>
    `${year}-${String(month0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  // Leaves are for today and future working days.
  // OD/ML can also be applied to past working days to recover absences (Ratio'd feature).
  const isSelectable = (date: string) => {
    const day = byDate.get(date);
    if (!day || day.dayOrder == null || day.isHoliday) return false;
    if (action === "leave") return date >= today;
    return true; // OD/ML can be applied to past working days too
  };

  function toggleDate(date: string) {
    if (!isSelectable(date)) return;

    if (mode === "range") {
      if (!rangeStart) {
        setRangeStart(date);
        setDateActions((prev) => ({ ...prev, [date]: action }));
        return;
      }
      const [a, b] = [rangeStart, date].sort();
      const next = { ...dateActions };
      let cur = new Date(`${a}T00:00:00`);
      const end = new Date(`${b}T00:00:00`);
      while (cur <= end) {
        const ds = todayISO(cur);
        if (isSelectable(ds)) {
          next[ds] = action;
        }
        cur = new Date(cur.getTime() + 86400000);
      }
      setDateActions(next);
      setRangeStart(null);
      return;
    }

    // Single mode toggle
    setDateActions((prev) => {
      const next = { ...prev };
      if (next[date] === action) {
        delete next[date];
      } else {
        next[date] = action;
      }
      return next;
    });
  }

  function reset() {
    setDateActions({});
    setRangeStart(null);
    setShowResult(false);
  }

  const projection =
    attendance && showResult && totalDays > 0
      ? projectAttendance({
          attendance,
          calendar: cal,
          dayOrders: attendingDayOrders,
          dateActions,
          today,
        })
      : null;

  const scope = useGsap(
    ({ self, reduced }) => revealIn(self, reduced, { stagger: 0.045 }),
    [open, showResult, ym, action],
  );

  return (
    <Panel
      open={open}
      onClose={() => {
        onClose();
        reset();
      }}
      eyebrow={showResult ? "Forecast" : "Leave Predictor"}
      title={
        showResult
          ? `${totalDays} day${totalDays === 1 ? "" : "s"} selected`
          : action === "leave"
            ? "Plan your leaves"
            : "Plan your OD / ML"
      }
      footer={
        projection ? (
          <Button
            variant="secondary"
            size="lg"
            full
            onClick={() => setShowResult(false)}
          >
            Change days
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Label>Selected</Label>
              <p className="tnum mt-1 text-title">{totalDays}</p>
            </div>
            {totalDays > 0 && (
              <Button variant="quiet" onClick={reset}>
                Clear
              </Button>
            )}
            <Button
              size="lg"
              disabled={totalDays === 0 || !attendance}
              onClick={() => setShowResult(true)}
            >
              See impact
            </Button>
          </div>
        )
      }
    >
      <div ref={scope} className="pb-6">
        {projection ? (
          <Forecast projection={projection} />
        ) : (
          <>
            {/* Top Action Tabs: Leaves vs OD/ML (Ratio'd style) */}
            <div data-reveal className="mb-4 flex items-center gap-2 rounded-2xl bg-surface p-1">
              <button
                type="button"
                onClick={() => {
                  setAction("leave");
                  setRangeStart(null);
                }}
                className={`flex-1 rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
                  action === "leave"
                    ? "bg-risk text-white shadow-sm"
                    : "text-text-3 hover:text-text-1"
                }`}
              >
                Leaves
              </button>
              <button
                type="button"
                onClick={() => {
                  setAction("od");
                  setRangeStart(null);
                }}
                className={`flex-1 rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${
                  action === "od"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-text-3 hover:text-text-1"
                }`}
              >
                OD / ML
              </button>
            </div>

            {/* Selection Mode: Single vs Range */}
            <div data-reveal className="mb-6">
              <Segmented
                label="Selection mode"
                value={mode}
                onChange={(m) => {
                  setMode(m);
                  setRangeStart(null);
                }}
                options={[
                  { value: "single", label: "Single days" },
                  { value: "range", label: "A range" },
                ]}
              />
            </div>

            {/* Month & Year Navigation */}
            <div data-reveal className="mb-4 flex items-center justify-between">
              <h2 className="text-headline">
                {MONTHS[month0]} <span className="tnum text-text-3">{year}</span>
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
                  onClick={() =>
                    monthIdx < months.length - 1 && setYm(months[monthIdx + 1])
                  }
                >
                  <IconChevronRight size={18} />
                </IconButton>
              </div>
            </div>

            {/* Calendar Day Order Grid */}
            <div data-reveal className="grid grid-cols-7 gap-y-1">
              {WEEKDAYS.map((w, i) => (
                <div
                  key={i}
                  className="pb-3 text-center text-label uppercase text-text-3"
                >
                  {w}
                </div>
              ))}
              {Array.from({ length: firstDow }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                const ds = iso(d);
                const calDay = byDate.get(ds);
                const dayOrder = calDay?.dayOrder;
                const selectable = isSelectable(ds);
                const act = dateActions[ds];
                const isSelected = act != null;
                const isToday = ds === today;

                let tileBg = "text-text-3/45";
                if (isSelected) {
                  tileBg = act === "leave" ? "bg-risk text-white font-bold" : "bg-amber-600 text-white font-bold";
                } else if (selectable) {
                  tileBg = "text-text-1 hover:bg-ink-2";
                }

                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDate(ds)}
                    disabled={!selectable}
                    aria-pressed={isSelected}
                    aria-label={`${d} ${MONTHS[month0]}`}
                    className="flex min-h-[50px] flex-col items-center justify-center p-0.5"
                  >
                    <div
                      className={`relative flex size-10 flex-col items-center justify-center rounded-2xl transition-colors ${tileBg} ${
                        isToday && !isSelected ? "ring-2 ring-accent" : ""
                      } ${rangeStart === ds ? "ring-2 ring-accent ring-offset-1" : ""}`}
                    >
                      <span className="tnum text-body leading-none">{d}</span>
                      {dayOrder != null && (
                        <span
                          className={`mt-0.5 text-[9px] font-bold uppercase leading-none tracking-tighter ${
                            isSelected ? "opacity-90" : "text-text-3"
                          }`}
                        >
                          DO {dayOrder}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <p data-reveal className="mt-6 text-callout text-text-3">
              {action === "leave"
                ? "Tap working days from today onward to plan your leaves."
                : "OD/ML can be applied to past absences or future on-duty dates."}
            </p>
          </>
        )}
      </div>
    </Panel>
  );
}

/**
 * Forecast View: Re-architected to match getratiod.lol (Ratio'd SRM).
 *
 * Highlights:
 * 1. Prominent overall percentage and before -> after delta.
 * 2. Dedicated "ACTION REQUIRED" section for any subjects dropping below 75%,
 *    with exact classes needed to recover and the earliest calendar recovery date.
 * 3. Dedicated "SUBJECTS" section for all safe subjects, with their updated margins.
 */
function Forecast({ projection }: { projection: Projection }) {
  const after = projection.overallAfter;
  const delta = projection.delta;
  const figure = useRef<HTMLSpanElement>(null);

  useGsap(
    ({ reduced }) => {
      if (figure.current) {
        countTo(figure.current, after, reduced, (n) => n.toFixed(1));
      }
    },
    [after],
  );

  return (
    <>
      {/* Overall Attendance Hero */}
      <section data-reveal className="pb-8">
        <Label>
          {projection.through
            ? `Attendance through ${prettyDate(projection.through)}`
            : "Attendance after this"}
        </Label>
        <Amount
          size="poster"
          className={`mt-4 ${
            projection.hasDebarmentRisk ? "text-accent" : "text-text-1"
          }`}
          value={<span ref={figure}>{after.toFixed(1)}</span>}
          unit="%"
        />

        <TrackRule
          value={after}
          threshold={TARGET}
          tone={projection.hasDebarmentRisk ? "accent" : "neutral"}
          className="bleed mt-7"
        />

        <div className="mt-4 flex items-baseline justify-between gap-4">
          <span className="tnum text-callout text-text-3">
            {projection.overallBefore.toFixed(1)}% to {after.toFixed(1)}%
            {Math.abs(delta) >= 0.05
              ? ` · ${delta > 0 ? "up" : "down"} ${Math.abs(delta).toFixed(1)}%`
              : " · no change"}
          </span>
          <Chip tone={projection.hasDebarmentRisk ? "risk" : "safe"}>
            {projection.hasDebarmentRisk ? "Debarment risk" : "Still safe"}
          </Chip>
        </div>

        <p className="mt-4 text-body text-text-2">
          {projection.hasDebarmentRisk
            ? `${projection.atRiskSubjects.length} subject${
                projection.atRiskSubjects.length === 1 ? " drops" : "s drop"
              } below ${TARGET}%. You must attend classes consecutively after this to recover.`
            : `All subjects stay at or above ${TARGET}%. Lowest margin is ${Math.min(
                ...projection.safeSubjects.map((s) => s.marginAfter),
              )} class${
                Math.min(...projection.safeSubjects.map((s) => s.marginAfter)) === 1
                  ? ""
                  : "es"
              }.`}
        </p>

        <p className="mt-2 text-callout text-text-3">
          Misses{" "}
          <span className="tnum font-medium text-accent">
            {projection.totalMissed}
          </span>{" "}
          class{projection.totalMissed === 1 ? "" : "es"} across{" "}
          <span className="tnum font-medium text-text-2">
            {projection.affectedDays}
          </span>{" "}
          working day{projection.affectedDays === 1 ? "" : "s"}.
        </p>
      </section>

      {/* ACTION REQUIRED: Subjects dropping below 75% (Ratio'd Layout) */}
      {projection.atRiskSubjects.length > 0 && (
        <section data-reveal className="mb-8 rounded-3xl border-2 border-dashed border-risk/40 bg-risk/5 p-5">
          <div className="flex items-center justify-between pb-3">
            <span className="text-label font-bold uppercase tracking-widest text-risk">
              Action Required
            </span>
            <span className="text-callout text-risk/80">
              {projection.atRiskSubjects.length} short
            </span>
          </div>

          <ul className="flex flex-col gap-4">
            {projection.atRiskSubjects.map((s, i) => (
              <SubjectCard key={`${s.code}-${i}`} subject={s} isDanger />
            ))}
          </ul>
        </section>
      )}

      {/* SAFE SUBJECTS */}
      {projection.safeSubjects.length > 0 && (
        <section data-reveal>
          <SectionHead aside={`${projection.safeSubjects.length} safe`}>
            Subjects
          </SectionHead>
          <ul className="mt-3 flex flex-col gap-4">
            {projection.safeSubjects.map((s, i) => (
              <SubjectCard key={`${s.code}-${i}`} subject={s} isDanger={false} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function SubjectCard({
  subject: s,
  isDanger,
}: {
  subject: ProjectedSubject;
  isDanger: boolean;
}) {
  return (
    <li
      className={`rounded-2xl border p-4 transition-all ${
        isDanger
          ? "border-risk/30 bg-surface/90 shadow-sm"
          : s.hasChanged
            ? "border-accent/40 bg-surface/80"
            : "border-ink-2 bg-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: Margin / Recovery Count */}
        <div className="flex min-w-[70px] shrink-0 flex-col items-center justify-center text-center">
          <span
            className={`tnum text-[2.75rem] font-bold leading-none tracking-tight ${
              isDanger ? "text-accent" : "text-text-1"
            }`}
          >
            {s.marginAfter}
          </span>
          <span
            className={`mt-1.5 text-label font-bold uppercase tracking-wider ${
              isDanger ? "text-accent" : "text-text-3"
            }`}
          >
            {s.labelAfter}
          </span>

          {/* Margin transition if changed (e.g. 4 -> 2) */}
          {s.hasChanged && (
            <span className="tnum mt-1 text-[11px] font-semibold text-text-3">
              {s.marginBefore} → {s.marginAfter}
            </span>
          )}

          {/* Earliest recovery date if under 75% */}
          {isDanger && s.recoveryDate && (
            <div className="mt-2 rounded-full border border-risk/30 bg-risk/10 px-2 py-0.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-risk">
                Rec: {prettyDate(s.recoveryDate).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Right: Subject Details */}
        <div className="min-w-0 flex-1 pt-0.5 text-right">
          <div className="flex items-center justify-end gap-1.5">
            {s.isPractical && (
              <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-400">
                Practical
              </span>
            )}
            <span
              className={`text-body font-bold uppercase tracking-wide ${
                isDanger ? "text-accent" : "text-text-1"
              }`}
            >
              {s.code}
            </span>
          </div>

          <p className="mt-1 truncate text-callout lowercase text-text-3">
            {s.title}
          </p>

          <div className="mt-2 flex items-center justify-end gap-2 text-callout">
            <span className="tnum text-text-3">
              {s.attendedAfter}/{s.conductedAfter}
            </span>
            <span className="text-text-3">·</span>
            <span
              className={`tnum font-bold ${
                isDanger ? "text-accent" : "text-text-1"
              }`}
            >
              {s.pctAfter.toFixed(1)}%
            </span>
            {s.missed > 0 && (
              <>
                <span className="text-text-3">·</span>
                <span className="tnum font-semibold text-accent">
                  {s.missed} missed
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <TrackRule
        value={s.pctAfter}
        threshold={TARGET}
        tone={isDanger ? "accent" : "neutral"}
        className="mt-3.5"
      />
    </li>
  );
}
