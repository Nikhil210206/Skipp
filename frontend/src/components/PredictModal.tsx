"use client";

import { useMemo, useRef, useState } from "react";
import { useSession } from "@/context/SessionContext";
import { todayISO } from "@/lib/schedule";
import { projectAttendance } from "@/lib/leavePredictor";
import { predict } from "@/lib/predictor";
import { countTo, revealIn, useGsap } from "@/lib/motion";
import { Panel } from "@/components/ui/Overlay";
import { Button, Card, Chip, Divider, IconButton, Label, Meter, Segmented } from "@/components/ui";
import { IconChevronLeft, IconChevronRight } from "@/components/Icons";

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
  const { timetable, attendance } = useSession();
  const cal = useMemo(() => timetable?.calendar ?? [], [timetable]);
  const byDate = useMemo(() => new Map(cal.map((d) => [d.date, d])), [cal]);
  const today = todayISO();

  // Only months from this one on: planning a day that already happened is
  // meaningless.
  const months = useMemo(() => {
    const all = [...new Set(cal.map((d) => d.date.slice(0, 7)))].sort();
    const future = all.filter((m) => m >= today.slice(0, 7));
    return future.length > 0 ? future : all;
  }, [cal, today]);

  const [ym, setYm] = useState(() => months[0] ?? today.slice(0, 7));
  const [mode, setMode] = useState<"single" | "range">("single");
  const [dates, setDates] = useState<string[]>([]);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const monthIdx = months.indexOf(ym);
  const year = Number(ym.slice(0, 4));
  const month0 = Number(ym.slice(5, 7)) - 1;
  const firstDow = (new Date(year, month0, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const iso = (d: number) =>
    `${year}-${String(month0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const isSelectable = (date: string) =>
    byDate.get(date)?.dayOrder != null && date >= today;

  function toggle(date: string) {
    if (!isSelectable(date)) return;
    if (mode === "range") {
      if (!rangeStart) {
        setRangeStart(date);
        setDates((s) => (s.includes(date) ? s : [...s, date]));
        return;
      }
      const [a, b] = [rangeStart, date].sort();
      const next = new Set(dates);
      let cur = new Date(`${a}T00:00:00`);
      const end = new Date(`${b}T00:00:00`);
      while (cur <= end) {
        const ds = todayISO(cur);
        if (isSelectable(ds)) next.add(ds);
        cur = new Date(cur.getTime() + 86400000);
      }
      setDates([...next].sort());
      setRangeStart(null);
      return;
    }
    setDates((s) =>
      s.includes(date) ? s.filter((d) => d !== date) : [...s, date].sort(),
    );
  }

  function reset() {
    setDates([]);
    setRangeStart(null);
    setShowResult(false);
  }

  const projection =
    attendance && showResult
      ? projectAttendance({
          attendance,
          calendar: cal,
          dayOrders: timetable?.dayOrders ?? [],
          leaveDates: dates,
        })
      : null;

  const scope = useGsap(
    ({ self, reduced }) => revealIn(self, reduced, { stagger: 0.045 }),
    [showResult, ym],
  );

  return (
    <Panel
      open={open}
      onClose={() => {
        onClose();
        reset();
      }}
      eyebrow={showResult ? "Forecast" : "Plan leave"}
      title={
        showResult
          ? `${dates.length} day${dates.length === 1 ? "" : "s"} off`
          : "Which days?"
      }
      footer={
        projection ? (
          <Button variant="secondary" size="lg" full onClick={() => setShowResult(false)}>
            Change days
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Label>Selected</Label>
              <p className="tnum mt-1 text-title">{dates.length}</p>
            </div>
            {dates.length > 0 && (
              <Button variant="quiet" onClick={reset}>
                Clear
              </Button>
            )}
            <Button
              size="lg"
              disabled={dates.length === 0 || !attendance}
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
                <div key={`e${i}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                const ds = iso(d);
                const selectable = isSelectable(ds);
                const sel = dates.includes(ds);
                return (
                  <button
                    key={d}
                    onClick={() => toggle(ds)}
                    disabled={!selectable}
                    aria-pressed={sel}
                    aria-label={`${d} ${MONTHS[month0]}`}
                    className="flex min-h-[46px] items-center justify-center"
                  >
                    <span
                      className={`tnum flex size-9 items-center justify-center rounded-full text-body transition-colors ${
                        sel
                          ? "bg-accent font-semibold text-accent-ink"
                          : selectable
                            ? "text-text-1 hover:bg-ink-2"
                            : "text-text-3/45"
                      } ${rangeStart === ds ? "ring-2 ring-accent" : ""}`}
                    >
                      {d}
                    </span>
                  </button>
                );
              })}
            </div>

            <p data-reveal className="mt-6 text-callout text-text-3">
              Only working days from today onward can be selected.
            </p>
          </>
        )}
      </div>
    </Panel>
  );
}

function Forecast({
  projection,
}: {
  projection: ReturnType<typeof projectAttendance>;
}) {
  const after = projection.overallAfter;
  const drop = projection.overallBefore - after;
  const totalA = projection.subjects.reduce((x, s) => x + s.attendedAfter, 0);
  const totalC = projection.subjects.reduce((x, s) => x + s.conductedAfter, 0);
  const rec = predict(totalA, totalC, TARGET);
  const pctRef = useRef<HTMLSpanElement>(null);

  useGsap(({ reduced }) => {
    if (pctRef.current) countTo(pctRef.current, after, reduced, (n) => n.toFixed(1));
  }, [after]);

  return (
    <>
      <section data-reveal className="pb-8">
        <Label>Attendance after</Label>
        <div className="mt-3 flex items-baseline gap-2">
          <span ref={pctRef} className="tnum text-display">
            {after.toFixed(1)}
          </span>
          <span className="text-title text-text-3">%</span>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <Chip tone={after >= TARGET ? "safe" : "risk"}>
            {after >= TARGET ? "Still safe" : "Below target"}
          </Chip>
          <span className="tnum text-callout text-text-3">
            down {drop.toFixed(1)} points from {projection.overallBefore.toFixed(1)}%
          </span>
        </div>
        <Meter
          value={after}
          tone={after >= TARGET ? "neutral" : "risk"}
          className="mt-5"
        />
        <p className="mt-5 text-body text-text-2">
          {!rec.isSafe
            ? `You would need to attend ${rec.mustAttend} classes in a row to get back to ${TARGET}%.`
            : rec.canSkip === 0
              ? "That uses up all your headroom. One more miss puts you below target."
              : `You would still have ${rec.canSkip} class${rec.canSkip === 1 ? "" : "es"} in hand.`}
        </p>
      </section>

      <Card flush className="overflow-hidden" as="section">
        <div className="px-5 pb-1 pt-4">
          <Label>By subject</Label>
        </div>
        <ul>
          {projection.subjects
            .filter((s) => s.conductedAfter > 0)
            .map((s, i) => {
              const safe = s.pctAfter >= TARGET;
              const r = predict(s.attendedAfter, s.conductedAfter, TARGET);
              return (
                <li key={`${s.code}-${i}`} data-reveal>
                  {i > 0 && <Divider inset={20} />}
                  <div className="px-5 py-4">
                    <div className="flex items-baseline gap-4">
                      <p className="min-w-0 flex-1 truncate text-headline">{s.title}</p>
                      <p className="shrink-0 tnum text-headline">
                        {s.pctAfter.toFixed(0)}
                        <span className="text-text-3">%</span>
                      </p>
                    </div>
                    <p className="mt-1 tnum text-callout text-text-3">
                      {s.attendedAfter}/{s.conductedAfter} ·{" "}
                      {safe ? (
                        r.canSkip > 0 ? (
                          `${r.canSkip} to spare`
                        ) : (
                          "no room left"
                        )
                      ) : (
                        <span className="text-risk">attend {r.mustAttend} to recover</span>
                      )}
                    </p>
                    <Meter
                      value={s.pctAfter}
                      tone={safe ? "neutral" : "risk"}
                      className="mt-3"
                    />
                  </div>
                </li>
              );
            })}
        </ul>
      </Card>
    </>
  );
}
