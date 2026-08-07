"use client";

import { useMemo, useRef, useState } from "react";
import { useSession } from "@/context/SessionContext";
import { prettyDate, todayISO } from "@/lib/schedule";
import { projectAttendance } from "@/lib/leavePredictor";
import { predict } from "@/lib/predictor";
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
          dayOrders: attendingDayOrders,
          leaveDates: dates,
        })
      : null;

  // `open` MUST be a dependency: this scope lives inside Panel, which renders
  // nothing while closed, so on the first run the element does not exist yet.
  // Without it the reveal never ran for the mounted panel and every row stayed
  // at the CSS start state's opacity 0, i.e. a blank sheet.
  const scope = useGsap(
    ({ self, reduced }) => revealIn(self, reduced, { stagger: 0.045 }),
    [open, showResult, ym],
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

/**
 * The forecast answers "what will this cost me?" in the same language as the
 * attendance page: the margin or recovery figure is the hero, and the resulting
 * percentage is the evidence beneath it.
 */
function Forecast({
  projection,
}: {
  projection: ReturnType<typeof projectAttendance>;
}) {
  const after = projection.overallAfter;
  // Signed, because the forecast now plays the term forward: attending the days
  // between here and your leave can outweigh the days you take off, so a plan
  // can genuinely leave you HIGHER than today. Saying "down -1.2" for that was
  // a double negative that read like a bug.
  const delta = after - projection.overallBefore;
  const totalA = projection.subjects.reduce((x, s) => x + s.attendedAfter, 0);
  const totalC = projection.subjects.reduce((x, s) => x + s.conductedAfter, 0);
  const rec = predict(totalA, totalC, TARGET);
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
      <section data-reveal className="pb-9">
        {/* The percentage is the hero. A count of classes in hand is the right
            answer to "can I skip one more", but this screen answers "where does
            this leave me", and a student thinks about that in per cent: it is
            the number on the portal, on the attendance screen, and the one the
            75% rule is written in. */}
        <Label>
          {projection.through
            ? `Attendance on ${prettyDate(projection.through)}`
            : "Attendance after this"}
        </Label>
        <Amount
          size="poster"
          className={`mt-4 ${after >= TARGET ? "text-text-1" : "text-accent"}`}
          value={<span ref={figure}>{after.toFixed(1)}</span>}
          unit="%"
        />

        <TrackRule
          value={after}
          threshold={TARGET}
          tone={after >= TARGET ? "neutral" : "accent"}
          className="bleed mt-7"
        />

        <div className="mt-4 flex items-baseline justify-between gap-4">
          <span className="tnum text-callout text-text-3">
            {projection.overallBefore.toFixed(1)}% to {after.toFixed(1)}%
            {Math.abs(delta) >= 0.05
              ? ` · ${delta > 0 ? "up" : "down"} ${Math.abs(delta).toFixed(1)}`
              : " · no change"}
          </span>
          <Chip tone={after >= TARGET ? "safe" : "risk"}>
            {after >= TARGET ? "Still safe" : "Below target"}
          </Chip>
        </div>

        {/* What the figure above is actually made of. The forecast plays the
            term forward to the last date picked, so it has to say how many
            classes that covers and how many of them are missed, otherwise the
            percentage looks like it came from nowhere. */}
        <p className="mt-4 text-body text-text-2">
          {rec.isSafe
            ? `${rec.canSkip} class${rec.canSkip === 1 ? "" : "es"} still in hand after that.`
            : `Attend ${rec.mustAttend} in a row after that to clear ${TARGET}%.`}
        </p>

        <p className="mt-3 text-callout leading-relaxed text-text-3">
          By{" "}
          <span className="text-text-2">{prettyDate(projection.through ?? "")}</span>{" "}
          <span className="tnum text-text-2">{projection.totalHeld}</span> more
          {projection.totalHeld === 1 ? " class" : " classes"} will have been held.
          You attend{" "}
          <span className="tnum text-text-2">
            {projection.totalHeld - projection.totalMissed}
          </span>{" "}
          of them across{" "}
          <span className="tnum">{projection.attendedDays}</span> day
          {projection.attendedDays === 1 ? "" : "s"} and miss{" "}
          <span className="tnum text-accent">{projection.totalMissed}</span>.
        </p>
      </section>

      <section>
        <SectionHead aside={`${projection.affectedDays} day${projection.affectedDays === 1 ? "" : "s"}`}>
          By subject
        </SectionHead>
        <ul className="mt-2">
          {projection.subjects
            .filter((s) => s.conductedAfter > 0)
            // Trouble first, then whatever this leave actually touches. A
            // subject it never touches is context, not news, so it sinks.
            .toSorted((a, b) => {
              const risk = Number(a.pctAfter < TARGET) - Number(b.pctAfter < TARGET);
              if (risk !== 0) return -risk;
              if (a.missed !== b.missed) return b.missed - a.missed;
              return a.pctAfter - b.pctAfter;
            })
            .map((s, i) => {
              const safe = s.pctAfter >= TARGET;
              const r = predict(s.attendedAfter, s.conductedAfter, TARGET);
              const value = safe ? r.canSkip : r.mustAttend;
              return (
                <li key={`${s.code}-${i}`} data-reveal className="pt-6">
                  <div className="flex items-start justify-between gap-5">
                    <div className="min-w-0 flex-1 pt-1">
                      <p className="truncate text-headline">{s.title}</p>
                      <p className="tnum mt-1.5 truncate text-callout text-text-3">
                        {s.attendedAfter}/{s.conductedAfter} · {s.pctAfter.toFixed(0)}%
                        {s.missed > 0 ? (
                          <>
                            {" · "}
                            <span className="text-accent">{s.missed} missed</span>
                          </>
                        ) : (
                          " · not affected"
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className={`tnum block text-hero leading-none ${
                          safe ? "text-text-1" : "text-accent"
                        }`}
                      >
                        {value}
                      </span>
                      <span className="mt-2 block text-label uppercase text-text-3">
                        {safe ? "Margin" : "Required"}
                      </span>
                    </div>
                  </div>
                  <TrackRule
                    value={s.pctAfter}
                    threshold={TARGET}
                    tone={safe ? "neutral" : "accent"}
                    className="bleed mt-5"
                  />
                </li>
              );
            })}
        </ul>
      </section>
    </>
  );
}
