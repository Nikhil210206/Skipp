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
  Feature,
  Marginalia,
  Rule,
  SectionHead,
  StickyAction,
} from "@/components/ui/editorial";
import type { Subject } from "@/types";

const THRESHOLD = 75;

/**
 * Attendance is a single figure and a table. The one subject in trouble is
 * lifted out into the screen's only solid block; everything else stays quiet
 * type on black.
 */
export default function AttendancePage() {
  const { attendance, attendanceState, attendanceMessage } = useSession();
  const [predictOpen, setPredictOpen] = useState(false);

  const subjects = attendance?.subjects ?? [];
  const attended = subjects.reduce((s, x) => s + x.attended, 0);
  const conducted = subjects.reduce((s, x) => s + x.conducted, 0);
  const overall = conducted > 0 ? (attended / conducted) * 100 : 0;

  const tracked = subjects.filter((s) => s.conducted > 0);
  const worst = [...tracked].sort((a, b) => a.percentage - b.percentage)[0];
  const critical = worst && !worst.isSafe ? worst : null;
  const recover = critical
    ? predict(critical.attended, critical.conducted, THRESHOLD).mustAttend
    : 0;
  const rest = critical ? subjects.filter((s) => s !== critical) : subjects;

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
          <div className="flex flex-col gap-4 pt-6">
            <Skeleton className="h-24 w-2/3" />
            <Skeleton className="h-px w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
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
            {/* Masthead */}
            <div ref={masthead} data-reveal className="pb-9 pt-4">
              <p className="text-label uppercase text-text-3">Term to date</p>
              <Amount
                size="mega"
                className="mt-4"
                value={<span ref={figure}>{overall.toFixed(1)}</span>}
                unit="%"
              />
              <Marginalia>
                <span className="mt-5 block tnum">
                  {attended} of {conducted} classes attended · {THRESHOLD}% required
                </span>
              </Marginalia>
            </div>

            {/* The one thing that needs action */}
            {critical && (
              <div data-reveal className="mb-10">
                <Feature
                  eyebrow="Needs attention"
                  aside={`${worst.percentage.toFixed(0)}%`}
                  figure={
                    <>
                      <span className="tnum text-display">{recover}</span>
                      <span className="pb-3 text-headline opacity-75">
                        {recover === 1 ? "class" : "classes"} in a row
                      </span>
                    </>
                  }
                  caption={`${critical.title || critical.code} is below target. Attend that many in a row to clear ${THRESHOLD}%.`}
                />
              </div>
            )}

            {/* The table */}
            <section>
              <SectionHead aside={`${tracked.length} tracked`}>Subjects</SectionHead>
              <ul className="mt-1">
                {rest.map((s, i) => (
                  <li key={`${s.code}-${s.slot ?? i}`} data-row>
                    <Rule soft={i > 0} />
                    <SubjectLine s={s} />
                  </li>
                ))}
              </ul>
            </section>

            <StickyAction>
              <Button size="lg" full onClick={() => setPredictOpen(true)}>
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

function SubjectLine({ s }: { s: Subject }) {
  const p = predict(s.attended, s.conducted, THRESHOLD);
  const none = s.conducted === 0;
  const note = none
    ? "No classes held"
    : p.isSafe
      ? p.canSkip > 0
        ? `${p.canSkip} to spare`
        : "No room to skip"
      : `Attend ${p.mustAttend} to recover`;

  return (
    <div className="py-4">
      <div className="flex items-baseline justify-between gap-4">
        <span className="min-w-0 flex-1 truncate text-headline">
          {s.title || s.code}
        </span>
        <span className="tnum shrink-0 text-title">
          {none ? <span className="text-text-3">&mdash;</span> : s.percentage.toFixed(0)}
          {!none && <span className="text-callout text-text-3">%</span>}
        </span>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-4">
        <span className="tnum truncate text-callout text-text-3">
          {s.code}
          {s.category ? ` · ${s.category}` : ""}
          {none ? "" : ` · ${s.attended}/${s.conducted}`}
        </span>
        <span
          className={`shrink-0 text-callout ${p.isSafe || none ? "text-text-3" : "text-accent"}`}
        >
          {note}
        </span>
      </div>
    </div>
  );
}
