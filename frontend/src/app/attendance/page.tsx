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
            <div ref={masthead} data-reveal className="pb-10 pt-4">
              <p className="text-label uppercase text-text-3">Term to date</p>
              <Amount
                size="mega"
                className="mt-4"
                value={<span ref={figure}>{overall.toFixed(1)}</span>}
                unit="%"
              />
              <TrackRule
                value={overall}
                threshold={THRESHOLD}
                tone={overall < THRESHOLD ? "accent" : "neutral"}
                className="bleed mt-7"
              />
              <div className="mt-4 flex items-baseline justify-between gap-4">
                <Marginalia>
                  <span className="tnum">
                    {attended} of {conducted} attended
                  </span>
                </Marginalia>
                <p className="tnum text-callout text-text-2">
                  {inHand.isSafe
                    ? `${inHand.canSkip} in hand`
                    : `${inHand.mustAttend} to recover`}
                </p>
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

function Ledger({ s, tone = "neutral" }: { s: Subject; tone?: "neutral" | "accent" }) {
  const p = predict(s.attended, s.conducted, THRESHOLD);
  const none = s.conducted === 0;
  const note = none
    ? "No classes held yet"
    : p.isSafe
      ? p.canSkip > 0
        ? `${p.canSkip} in hand`
        : "Nothing in hand"
      : `Attend ${p.mustAttend} to clear ${THRESHOLD}%`;

  return (
    <div className="pt-6">
      <div className="flex items-baseline justify-between gap-4">
        <span className="min-w-0 flex-1 truncate text-headline">
          {s.title || s.code}
        </span>
        <span className="tnum shrink-0 text-title">
          {none ? (
            <span className="text-text-3">&mdash;</span>
          ) : (
            <>
              {s.percentage.toFixed(0)}
              <span className="text-callout text-text-3">%</span>
            </>
          )}
        </span>
      </div>

      <TrackRule
        value={none ? 0 : s.percentage}
        threshold={THRESHOLD}
        tone={tone}
        className="bleed mt-3.5"
      />

      <div className="mt-2.5 flex items-baseline justify-between gap-4">
        <span className="tnum truncate text-callout text-text-3">
          {s.code}
          {s.category ? ` · ${s.category}` : ""}
          {none ? "" : ` · ${s.attended}/${s.conducted}`}
        </span>
        <span
          className={`shrink-0 text-callout ${
            tone === "accent" ? "text-accent" : "text-text-3"
          }`}
        >
          {note}
        </span>
      </div>
    </div>
  );
}
