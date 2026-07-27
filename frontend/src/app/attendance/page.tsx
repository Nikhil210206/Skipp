"use client";

import { useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import PredictModal from "@/components/PredictModal";
import { useSession } from "@/context/SessionContext";
import { predict } from "@/lib/predictor";
import { countTo, recedeOnScroll, revealIn, revealRows, useGsap } from "@/lib/motion";
import { Button, Skeleton, StateView } from "@/components/ui";
import {
  Amount,
  Marginalia,
  SectionHead,
  StickyAction,
  TrackRule,
} from "@/components/ui/editorial";
import type { Subject } from "@/types";

const THRESHOLD = 75;

/**
 * ATTENDANCE: a ledger.
 *
 * Every subject is a line of type with a rule beneath it, and every rule carries
 * the same 75% tick. Because the ticks align down the page, a subject that falls
 * short is visible as a rule that stops before the column, long before anyone
 * reads a percentage. No panels, no bars in boxes: the measurement is the layout.
 */
export default function AttendancePage() {
  const { attendance, attendanceState, attendanceMessage } = useSession();
  const [predictOpen, setPredictOpen] = useState(false);

  const subjects = attendance?.subjects ?? [];
  const attended = subjects.reduce((s, x) => s + x.attended, 0);
  const conducted = subjects.reduce((s, x) => s + x.conducted, 0);
  const overall = conducted > 0 ? (attended / conducted) * 100 : 0;
  const inHand = predict(attended, conducted, THRESHOLD);

  const tracked = subjects.filter((s) => s.conducted > 0);
  const short = tracked.filter((s) => !s.isSafe).sort((a, b) => a.percentage - b.percentage);
  const rest = subjects.filter((s) => !short.includes(s));

  const figure = useRef<HTMLSpanElement>(null);
  const masthead = useRef<HTMLDivElement>(null);
  const scope = useGsap(
    ({ self, reduced }) => {
      revealIn(self, reduced, { y: 16, stagger: 0.07 });
      revealRows(self, reduced);
      if (figure.current) countTo(figure.current, overall, reduced, (n) => n.toFixed(1));
      if (masthead.current) recedeOnScroll(masthead.current, reduced);
    },
    [overall, attendanceState],
  );

  return (
    <AppShell section="Attendance">
      <div ref={scope} className="flex flex-1 flex-col">
        {attendanceState === "loading" && (
          <div className="flex flex-col gap-5 pt-6">
            <Skeleton className="h-24 w-2/3" />
            <Skeleton className="h-[2px] w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {attendanceState === "gated" && (
          <StateView
            tone="watch"
            title="Not published yet"
            message={
              attendanceMessage ??
              "Your department has not opened attendance for this term. It appears here automatically."
            }
          />
        )}

        {attendanceState === "error" && (
          <StateView
            tone="risk"
            title="Could not load attendance"
            message={attendanceMessage ?? "Pull down to try again."}
          />
        )}

        {attendanceState === "ready" && attendance && (
          <>
            {/* The whole term as one measurement */}
            {/* No data-reveal here: recedeOnScroll owns this block's opacity. */}
            <div ref={masthead} className="pb-11 pt-6">
              <p className="text-label uppercase text-text-3">Term to date</p>
              <Amount
                size="poster"
                className="mt-5"
                value={<span ref={figure}>{overall.toFixed(1)}</span>}
                unit="%"
              />
              <TrackRule
                value={overall}
                threshold={THRESHOLD}
                tone={overall < THRESHOLD ? "accent" : "neutral"}
                className="bleed mt-7"
              />
              <div className="mt-5 flex items-end justify-between gap-5">
                <Marginalia>
                  <span className="tnum">
                    {attended} of {conducted} attended · {THRESHOLD}% required
                  </span>
                </Marginalia>
                <div className="shrink-0 text-right">
                  <span
                    className={`tnum block text-title leading-none ${
                      inHand.isSafe ? "text-text-1" : "text-accent"
                    }`}
                  >
                    {inHand.isSafe ? inHand.canSkip : inHand.mustAttend}
                  </span>
                  <span className="mt-1.5 block text-label uppercase text-text-3">
                    {inHand.isSafe ? "Margin" : "Required"}
                  </span>
                </div>
              </div>
            </div>

            {/* Anything short of the mark comes first, in accent ink */}
            {short.length > 0 && (
              <section className="pb-10">
                <SectionHead aside={`${short.length} short`}>
                  Below the line
                </SectionHead>
                <ul className="mt-2">
                  {short.map((s, i) => (
                    <li key={`${s.code}-${s.slot ?? i}`} data-row>
                      <Ledger s={s} tone="accent" />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <SectionHead aside={`${tracked.length} tracked`}>Subjects</SectionHead>
              <ul className="mt-2">
                {rest.map((s, i) => (
                  <li key={`${s.code}-${s.slot ?? i}`} data-row>
                    <Ledger s={s} />
                  </li>
                ))}
              </ul>
            </section>

            <StickyAction>
              <Button
                variant="outline"
                size="lg"
                full
                onClick={() => setPredictOpen(true)}
              >
                Plan a leave
              </Button>
            </StickyAction>
          </>
        )}
      </div>

      <PredictModal open={predictOpen} onClose={() => setPredictOpen(false)} />
    </AppShell>
  );
}

/**
 * A subject row answers "what do I do about this one?" first. The actionable
 * figure is the largest thing in the row; the percentage drops to the meta line
 * beside the code, because it is evidence rather than instruction.
 */
function Ledger({ s, tone = "neutral" }: { s: Subject; tone?: "neutral" | "accent" }) {
  const p = predict(s.attended, s.conducted, THRESHOLD);
  const none = s.conducted === 0;
  const value = none ? null : p.isSafe ? p.canSkip : p.mustAttend;
  const label = none ? "No classes" : p.isSafe ? "Margin" : "Required";

  return (
    <div className="pt-6">
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0 flex-1 pt-1">
          <p className="truncate text-headline">{s.title || s.code}</p>
          <p className="tnum mt-1.5 truncate text-callout text-text-3">
            {[
              s.code,
              s.category,
              none ? null : `${s.attended}/${s.conducted}`,
              none ? null : `${s.percentage.toFixed(0)}%`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        {/* The decision, hung on the right and aligned across every row. */}
        <div className="shrink-0 text-right">
          <span
            className={`tnum block text-hero leading-none ${
              value === null
                ? "text-text-3"
                : tone === "accent"
                  ? "text-accent"
                  : "text-text-1"
            }`}
          >
            {value === null ? "\u2014" : value}
          </span>
          <span className="mt-2 block text-label uppercase text-text-3">{label}</span>
        </div>
      </div>

      <TrackRule
        value={none ? 0 : s.percentage}
        threshold={THRESHOLD}
        tone={tone}
        className="bleed mt-5"
      />
    </div>
  );
}
