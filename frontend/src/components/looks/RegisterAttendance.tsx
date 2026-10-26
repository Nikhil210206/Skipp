"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useSession } from "@/context/SessionContext";
import { PortalSourceNote } from "@/components/ImportAttendance";
import { IconArrowRight } from "@/components/Icons";
import { countTo, pressable, prefersReducedMotion, useGsap } from "@/lib/motion";
import { predict } from "@/lib/predictor";
import type { Subject } from "@/types";
import { DotField, THRESHOLD, isLabSubject, lookEntrance, pctText } from "./shared";
import { HandBar, HandNote, HandRule } from "./hand";

type Filter = "all" | "theory" | "lab";

/**
 * ATTENDANCE, as a register you kept yourself.
 *
 * The term is one bar drawn in pen, hatched in to where you are, with the 75%
 * line across it and an arrow at your mark. Underneath, every subject gets the
 * same bar in miniature and one plain line saying how many it went to and
 * missed: the drawing shows the distance to the line, the words give the
 * counts, and nothing has to be counted off a row of marks.
 *
 * Counts, not a timeline: the portal says how many classes were missed, never
 * which, so the crosses follow the tallies instead of pretending to dates.
 */
export default function RegisterAttendance({ onPlan }: { onPlan: () => void }) {
  const { attendance, attendanceSource } = useSession();
  const [filter, setFilter] = useState<Filter>("all");

  const subjects = attendance?.subjects ?? [];
  const attended = subjects.reduce((s, x) => s + x.attended, 0);
  const conducted = subjects.reduce((s, x) => s + x.conducted, 0);
  const overall = conducted > 0 ? (attended / conducted) * 100 : 0;
  const inHand = predict(attended, conducted, THRESHOLD);
  const needed = Math.ceil((THRESHOLD / 100) * conducted - 1e-9);

  const hasBoth = subjects.some(isLabSubject) && subjects.some((s) => !isLabSubject(s));
  // Anything short of the line comes first, worst first, and the rest keep
  // the portal's order.
  const short = subjects
    .filter((s) => s.conducted > 0 && !s.isSafe)
    .sort((a, b) => a.percentage - b.percentage);
  const ordered = [...short, ...subjects.filter((s) => !short.includes(s))].filter(
    (s) => filter === "all" || (filter === "lab") === isLabSubject(s),
  );

  const verdict = !inHand.isSafe
    ? "Below the line."
    : inHand.canSkip <= 1
      ? "Right on the line."
      : "Above the line.";
  const advice = !inHand.isSafe
    ? `Attend the next ${inHand.mustAttend} to get back to ${THRESHOLD}%.`
    : `Skip ${inHand.canSkip} more and you still stay above ${THRESHOLD}%.`;

  const figure = useRef<HTMLSpanElement>(null);
  const scope = useGsap(
    ({ self, reduced }) => {
      lookEntrance(self, reduced);
      if (figure.current) countTo(figure.current, overall, reduced, (n) => n.toFixed(1));
    },
    [overall],
  );

  // A filter change re-lays the list only, never the whole screen.
  const list = useRef<HTMLDivElement>(null);
  const firstFilter = useRef(true);
  useLayoutEffect(() => {
    if (firstFilter.current) {
      firstFilter.current = false;
      return;
    }
    const rows = list.current?.querySelectorAll("[data-row-in]");
    if (!rows || rows.length === 0 || prefersReducedMotion()) return;
    const tween = gsap.from(rows, {
      y: 14,
      opacity: 0,
      duration: 0.5,
      ease: "expo.out",
      stagger: 0.05,
      clearProps: "transform,opacity",
    });
    return () => {
      tween.revert();
    };
  }, [filter]);

  const plan = useRef<HTMLButtonElement>(null);
  useEffect(() => pressable(plan.current), []);

  return (
    <div ref={scope} className="flex flex-1 flex-col pb-10">
      {attendanceSource === "portal" && (
        <div className="pt-5">
          <PortalSourceNote />
        </div>
      )}
      <HandRule strong className="bleed" />

      {/* ---------- the term, as one figure ---------- */}
      <section className="relative pb-2 pt-5">
        <DotField mode="corner" className="absolute -right-[var(--gutter)] top-0 size-56 opacity-60" />
        <div className="relative">
          <p data-look-in className="text-label uppercase text-text-3">
            Term to date
          </p>
          <div className="mt-3 flex items-baseline">
            <span className="block overflow-hidden">
              <span data-look-rise className="block font-look text-look-big">
                <span ref={figure} className="tnum">
                  {overall.toFixed(1)}
                </span>
              </span>
            </span>
            <span className="block overflow-hidden">
              <span data-look-rise className="block font-look text-look-head">
                %
              </span>
            </span>
          </div>
          <h1 className="mt-4 font-look text-look-head">
            <span className="block overflow-hidden pb-[0.06em]">
              <span data-look-rise className="block">
                {verdict}
              </span>
            </span>
          </h1>
          <p data-look-in className="mt-3 text-body text-text-3">
            {advice}
          </p>
        </div>
      </section>

      {/* ---------- the term, drawn ---------- */}
      <section data-look-in className="pb-7 pt-4">
        <HandBar value={overall} tone={inHand.isSafe ? "ink" : "risk"} />
        <p className="tnum mt-3 text-callout text-text-3">
          You need {needed} of {conducted} to stay on the line. You have{" "}
          <span className="font-bold text-text-1">{attended}</span>.
        </p>
      </section>

      {/* ---------- every subject, as a line of the register ---------- */}
      <div data-look-in className="flex items-end justify-between gap-3 pb-2">
        <h2 className="font-look text-title">Subject by subject.</h2>
        {hasBoth && (
          <div role="group" aria-label="Filter subjects" className="flex shrink-0 gap-3">
            {(["all", "theory", "lab"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`relative min-h-11 px-0.5 font-hand text-note capitalize ${
                  filter === f ? "text-text-1" : "text-text-3"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
      <HandRule strong />
      <div ref={list}>
        {ordered.map((s, i) => (
          <SubjectLine key={`${s.code}-${s.category}-${i}`} s={s} seed={i} />
        ))}
      </div>

      <div data-look-in className="pt-6">
        <button
          ref={plan}
          onClick={onPlan}
          className="hand-edge flex min-h-[60px] w-full items-center justify-between bg-text-1 pl-5 pr-2 text-headline font-bold text-ink-0"
        >
          Plan a leave
          <span className="hand-edge grid size-11 place-items-center bg-[var(--look-loud)] text-[var(--look-on-loud)]">
            <IconArrowRight size={20} />
          </span>
        </button>
      </div>
    </div>
  );
}

/** One subject: what to do about it, then its line of the register. */
function SubjectLine({ s, seed }: { s: Subject; seed: number }) {
  const p = predict(s.attended, s.conducted, THRESHOLD);
  const none = s.conducted === 0;
  const short = !none && !p.isSafe;
  const tight = !none && p.isSafe && p.canSkip <= 1;
  const tag = none ? "no classes yet" : short ? "short" : tight ? "on the line" : "safe";

  return (
    <div
      data-row-in
      data-look-in
      className={`bleed bleed-pad relative py-4 ${short ? "bg-[var(--look-risk-bg)]" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-headline text-text-1">{s.title || s.code}</p>
          <p className={`tnum mt-1 text-callout ${short ? "text-risk" : "text-text-3"}`}>
            {[s.code, s.category, none ? null : pctText(s.percentage)].filter(Boolean).join(" · ")}
          </p>
        </div>
        {!none && (
          <div className="shrink-0 text-right">
            <div className={`tnum font-look text-look-fig ${short ? "text-risk" : "text-text-1"}`}>
              {p.isSafe ? p.canSkip : p.mustAttend}
            </div>
            <div className={`mt-1 text-callout ${short ? "text-risk" : "text-text-3"}`}>
              {p.isSafe ? "can skip" : "must attend"}
            </div>
          </div>
        )}
      </div>
      {!none && (
        <div className="mt-2.5">
          <HandBar compact value={s.percentage} tone={short ? "risk" : tight ? "watch" : "ink"} seed={seed + 21} />
          <p className={`tnum mt-1.5 text-callout ${short ? "text-risk" : "text-text-3"}`}>
            went {s.attended} · missed {s.conducted - s.attended}
          </p>
        </div>
      )}
      <HandNote
        tilt={seed % 2 === 0 ? -4 : 3}
        className={`mt-2.5 ${short ? "text-risk" : tight ? "text-watch" : "text-text-3"}`}
      >
        {tag}
      </HandNote>
      <HandRule className="absolute inset-x-[var(--gutter)] bottom-0" />
    </div>
  );
}
