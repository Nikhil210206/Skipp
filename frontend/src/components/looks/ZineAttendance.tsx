"use client";

import { useRef } from "react";
import { useSession } from "@/context/SessionContext";
import { PortalSourceNote } from "@/components/ImportAttendance";
import { IconArrowRight } from "@/components/Icons";
import { Button } from "@/components/ui";
import { StickyAction } from "@/components/ui/editorial";
import { countTo, useGsap } from "@/lib/motion";
import { predict } from "@/lib/predictor";
import type { Subject } from "@/types";
import { THRESHOLD, isLabSubject, lookEntrance, pctText } from "./shared";
import { Misprint, Printed, RowMeter, Stamp, WireMeter } from "./ZineParts";

/**
 * ATTENDANCE, as a page of the zine.
 *
 * The term is one inked figure over a strand of barbed wire, its barb at 75%.
 * The margin is a box of SAFETY SKIPS with the count on its label: a full box,
 * a nearly empty one, or an empty one printed in red. The matches only agree
 * with the number, they never stand in for it: a count you have to count off a
 * row of marks is not an answer, which is why the tallies were removed from
 * Register.
 *
 * Subjects come trouble first. A short one is stamped solid in the red drum
 * with its figure misprinted; one on the line gets a hollow red stamp; a safe
 * one gets no stamp and no colour at all.
 */
export default function ZineAttendance({ onPlan }: { onPlan: () => void }) {
  const { attendance, attendanceSource } = useSession();

  const subjects = attendance?.subjects ?? [];
  const attended = subjects.reduce((s, x) => s + x.attended, 0);
  const conducted = subjects.reduce((s, x) => s + x.conducted, 0);
  const overall = conducted > 0 ? (attended / conducted) * 100 : 0;
  const inHand = predict(attended, conducted, THRESHOLD);

  // Short first (worst first), then on the line, then the rest as the portal
  // lists them, and a course with no classes yet at the end.
  const rank = (s: Subject) => {
    if (s.conducted === 0) return 3;
    const p = predict(s.attended, s.conducted, THRESHOLD);
    return !p.isSafe ? 0 : p.canSkip <= 1 ? 1 : 2;
  };
  const ordered = subjects
    .map((s, i) => ({ s, i, r: rank(s) }))
    .sort((a, b) => a.r - b.r || (a.r === 0 ? a.s.percentage - b.s.percentage : a.i - b.i))
    .map((x) => x.s);

  const box = !inHand.isSafe || inHand.canSkip === 0 ? "matchbox-empty" : inHand.canSkip < 6 ? "matchbox-low" : "matchbox-full";
  const advice = !inHand.isSafe
    ? `Attend the next ${inHand.mustAttend} to get back to ${THRESHOLD}%.`
    : inHand.canSkip === 0
      ? `Right on the line. Miss one more and you drop below ${THRESHOLD}%.`
      : `You can miss ${inHand.canSkip} more and stay above ${THRESHOLD}%.`;

  const figure = useRef<HTMLSpanElement>(null);
  const scope = useGsap(
    ({ self, reduced }) => {
      lookEntrance(self, reduced);
      if (figure.current) countTo(figure.current, overall, reduced, (n) => n.toFixed(1));
    },
    [overall],
  );

  return (
    <div ref={scope} className="flex flex-1 flex-col pt-2">
      {attendanceSource === "portal" && (
        <div className="pb-4">
          <PortalSourceNote />
        </div>
      )}

      {/* ---------- the term ---------- */}
      <div className="overflow-hidden">
        <span
          data-look-rise
          className={`zine-print zine-grain block text-[clamp(5.5rem,36vw,8.5rem)] leading-[0.75] ${
            inHand.isSafe ? "" : "text-risk"
          }`}
        >
          <span ref={figure} className="tnum">
            {overall.toFixed(1)}
          </span>
          %
        </span>
      </div>
      <p
        data-look-in
        className="zine-typed tnum mt-3 text-[10.5px] uppercase tracking-[0.08em]"
      >
        Term to date · {attended} of {conducted} classes
      </p>
      <WireMeter value={overall} short={!inHand.isSafe} label="the line" className="mt-3" />

      {/* ---------- the margin, as a box of matches ---------- */}
      <div className="relative mt-6 flex items-start gap-3">
        <div
          data-look-in
          className={`@container relative w-[min(70%,240px)] shrink-0 ${inHand.isSafe ? "" : "text-risk"}`}
          style={{ rotate: "-4deg" }}
        >
          <Printed name={box} className="aspect-[340/142] w-full" />
          {/* The label sits on the sleeve's face in the drawing (8 to 208 of
              its 340 across, 62 to 182 of its frame's 44 to 186 down), inset a
              hair. Sized in cqw so it scales with the box on any phone. */}
          <div className="absolute left-[3.4%] top-[15.5%] flex h-[78.9%] w-[56.4%] border-2 border-current bg-ink-0 p-[1.3cqw]">
            <div className="flex flex-1 flex-col items-center justify-center gap-[1.4cqw] border border-current">
              <span className="zine-print bg-current px-[2.4cqw] pb-[0.5cqw] pt-[0.9cqw] text-[5.2cqw] uppercase leading-none tracking-[0.08em]">
                <span className="text-ink-0">{inHand.isSafe ? "Safety skips" : "Out of skips"}</span>
              </span>
              <span className="zine-print zine-grain tnum text-[17cqw] leading-[0.8]">
                {inHand.isSafe ? inHand.canSkip : inHand.mustAttend}
              </span>
              <span className="zine-typed text-[3.1cqw] uppercase leading-none tracking-[0.05em]">
                {inHand.isSafe ? "Avg. contents · this term" : `Attend the next ${inHand.mustAttend}`}
              </span>
            </div>
          </div>
        </div>
        <p
          data-look-in
          className="zine-typed ml-auto pt-[3%] text-right text-[11px] uppercase leading-[15px] tracking-[0.08em]"
        >
          {inHand.isSafe && inHand.canSkip > 0 ? (
            <>
              One skip,
              <br />
              one match.
            </>
          ) : (
            <>
              No matches
              <br />
              left.
            </>
          )}
        </p>
      </div>
      <p data-look-in className="mt-4 text-callout text-text-2">
        {advice}
      </p>

      {/* ---------- every subject, trouble first ---------- */}
      <div
        data-look-in
        className="zine-typed mt-8 flex items-baseline justify-between text-[10.5px] uppercase tracking-[0.08em]"
      >
        <span className="tnum">Subjects · {subjects.length}</span>
        <span>Trouble first</span>
      </div>
      <div data-look-rule className="mt-1.5 h-[2px] bg-text-1" />
      <ul>
        {/* The category and the index are part of the key: a course's theory
            and lab rows share a code, and the portal may list one twice. */}
        {ordered.map((s, i) => (
          <li key={`${s.code}-${s.category}-${i}`}>
            <SubjectRow s={s} />
          </li>
        ))}
      </ul>

      <StickyAction>
        <Button variant="primary" size="lg" full onClick={onPlan}>
          Plan a leave
          <IconArrowRight size={18} />
        </Button>
      </StickyAction>
    </div>
  );
}

/** One subject: its name and figure, the facts, then the meter and the verdict. */
function SubjectRow({ s }: { s: Subject }) {
  const p = predict(s.attended, s.conducted, THRESHOLD);
  const none = s.conducted === 0;
  const short = !none && !p.isSafe;
  const line = !none && p.isSafe && p.canSkip <= 1;

  return (
    <div data-look-in className="border-b-[1.5px] border-text-1/35 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 pt-0.5 text-[0.9375rem] font-semibold leading-[1.25]">{s.title || s.code}</p>
        {none ? null : short ? (
          <Misprint className="zine-print tnum text-[1.875rem] leading-[0.8]">{pctText(s.percentage)}</Misprint>
        ) : (
          <span className="zine-print zine-grain tnum shrink-0 text-[1.875rem] leading-[0.8]">
            {pctText(s.percentage)}
          </span>
        )}
      </div>
      <p className="zine-typed tnum mt-1.5 text-[10.5px] uppercase leading-[1.35] tracking-[0.04em] text-text-3">
        {[
          s.code,
          isLabSubject(s) ? "Lab" : "Theory",
          none ? "no classes yet" : `went ${s.attended}`,
          none ? null : `missed ${s.conducted - s.attended}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {!none && (
        <div className="mt-2 flex items-center gap-3">
          <RowMeter value={s.percentage} short={short} />
          {short ? (
            <Stamp tone="red" solid>
              Short · attend {p.mustAttend}
            </Stamp>
          ) : line ? (
            <Stamp tone="red">On the line · {p.canSkip === 0 ? "none" : p.canSkip} left</Stamp>
          ) : (
            <span className="zine-print tnum shrink-0 text-[0.8125rem] uppercase leading-none tracking-[0.04em]">
              {p.canSkip} left
            </span>
          )}
        </div>
      )}
    </div>
  );
}
