"use client";

import { useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import PredictModal from "@/components/PredictModal";
import { useSession } from "@/context/SessionContext";
import { predict } from "@/lib/predictor";
import { countTo, revealIn, useGsap } from "@/lib/motion";
import { Button, Card, Chip, Divider, Label, Meter, Skeleton, StateView } from "@/components/ui";
import type { Subject } from "@/types";

const THRESHOLD = 75;

/**
 * Attendance reads in three bands. The word always states the band; colour is
 * reserved for the two bands that need action, so a screen of healthy subjects
 * stays quiet and problems stand out.
 */
function band(pct: number, conducted: number) {
  if (conducted === 0)
    return { tone: "neutral" as const, meter: "neutral" as const, word: "No classes" };
  if (pct >= THRESHOLD)
    return { tone: "safe" as const, meter: "neutral" as const, word: "Safe" };
  if (pct >= THRESHOLD - 5)
    return { tone: "watch" as const, meter: "watch" as const, word: "Borderline" };
  return { tone: "risk" as const, meter: "risk" as const, word: "At risk" };
}

export default function AttendancePage() {
  const { attendance, attendanceState, attendanceMessage } = useSession();
  const [predictOpen, setPredictOpen] = useState(false);

  const subjects = attendance?.subjects ?? [];
  const attended = subjects.reduce((s, x) => s + x.attended, 0);
  const conducted = subjects.reduce((s, x) => s + x.conducted, 0);
  const overall = conducted > 0 ? (attended / conducted) * 100 : 0;
  const status = band(overall, conducted);

  const pctRef = useRef<HTMLSpanElement>(null);
  const scope = useGsap(
    ({ self, reduced }) => {
      revealIn(self, reduced);
      if (pctRef.current) countTo(pctRef.current, overall, reduced, (n) => n.toFixed(1));
    },
    [overall, attendanceState],
  );

  return (
    <AppShell
      eyebrow="Term to date"
      title="Attendance"
      action={
        attendanceState === "ready" ? (
          <Button size="md" onClick={() => setPredictOpen(true)}>
            Plan leave
          </Button>
        ) : undefined
      }
    >
      <div ref={scope} className="flex flex-1 flex-col">
        {attendanceState === "loading" && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        )}

        {attendanceState === "gated" && (
          <StateView
            tone="watch"
            title="Not published yet"
            message={
              attendanceMessage ??
              "Your department has not opened attendance for this term. It will appear here automatically."
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
            {/* The headline figure, stated once, with the verdict in words. */}
            <section data-reveal className="pb-8">
              <div className="flex items-baseline gap-2">
                <span ref={pctRef} className="tnum text-display">
                  {overall.toFixed(1)}
                </span>
                <span className="text-title text-text-3">%</span>
              </div>
              <div className="mt-5 flex items-center gap-3">
                <Chip tone={status.tone}>{status.word}</Chip>
                <span className="tnum text-callout text-text-3">
                  {attended} of {conducted} classes · target {THRESHOLD}%
                </span>
              </div>
              <Meter value={overall} tone={status.meter} className="mt-5" />
            </section>

            <Card flush className="overflow-hidden" as="section">
              <div className="px-5 pb-1 pt-4">
                <Label>By subject</Label>
              </div>
              <ul>
                {attendance.subjects.map((s, i) => (
                  <li key={`${s.code}-${s.slot ?? i}`} data-reveal>
                    {i > 0 && <Divider inset={20} />}
                    <SubjectRow s={s} />
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </div>

      <PredictModal open={predictOpen} onClose={() => setPredictOpen(false)} />
    </AppShell>
  );
}

function SubjectRow({ s }: { s: Subject }) {
  const p = predict(s.attended, s.conducted, THRESHOLD);
  const status = band(s.percentage, s.conducted);
  const headroom = s.conducted === 0 ? null : p.isSafe ? p.canSkip : p.mustAttend;

  return (
    <div className="px-5 py-4">
      <div className="flex items-baseline gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-headline">{s.title || s.code}</p>
          <p className="mt-0.5 tnum text-callout text-text-3">
            {s.code}
            {s.category ? ` · ${s.category}` : ""} · {s.attended}/{s.conducted}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {s.conducted === 0 ? (
            <span className="text-title text-text-3">&mdash;</span>
          ) : (
            <>
              <span className="tnum text-title">{s.percentage.toFixed(0)}</span>
              <span className="text-callout text-text-3">%</span>
            </>
          )}
        </div>
      </div>
      {s.conducted > 0 && (
        <Meter value={s.percentage} tone={status.meter} className="mt-3" />
      )}
      {headroom !== null && (
        <p className="mt-2.5 text-callout text-text-3">
          {p.isSafe ? (
            headroom > 0 ? (
              <>
                Can skip <span className="tnum text-text-1">{headroom}</span> more
              </>
            ) : (
              // Early in the term everything is one class from the edge, so
              // this is information, not an alarm.
              "No room to skip yet"
            )
          ) : (
            <>
              Attend <span className="tnum text-risk">{headroom}</span> to recover
            </>
          )}
        </p>
      )}
    </div>
  );
}
