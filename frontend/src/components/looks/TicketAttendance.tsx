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
import { Pass } from "./TicketParts";
import { HandBar, HandNote } from "./hand";

type Filter = "all" | "theory" | "lab";
const STUB = 96;

/**
 * ATTENDANCE, as a term pass and a stack of stubs.
 *
 * The term is one black pass with the margin on its stub. Every subject is a
 * ticket whose stub carries the one number that decides what to do: classes
 * to spare, or classes to attend. A short subject's stub turns red with the
 * word on it, and a safe one stays plain, so the trouble is the only colour in
 * the stack.
 */
export default function TicketAttendance({ onPlan }: { onPlan: () => void }) {
  const { attendance, attendanceSource } = useSession();
  const [filter, setFilter] = useState<Filter>("all");

  const subjects = attendance?.subjects ?? [];
  const attended = subjects.reduce((s, x) => s + x.attended, 0);
  const conducted = subjects.reduce((s, x) => s + x.conducted, 0);
  const overall = conducted > 0 ? (attended / conducted) * 100 : 0;
  const inHand = predict(attended, conducted, THRESHOLD);

  const hasBoth = subjects.some(isLabSubject) && subjects.some((s) => !isLabSubject(s));
  const short = subjects
    .filter((s) => s.conducted > 0 && !s.isSafe)
    .sort((a, b) => a.percentage - b.percentage);
  const ordered = [...short, ...subjects.filter((s) => !short.includes(s))].filter(
    (s) => filter === "all" || (filter === "lab") === isLabSubject(s),
  );

  const verdict = !inHand.isSafe ? "Below the line." : inHand.canSkip <= 1 ? "Right on the line." : "Above the line.";
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

  const list = useRef<HTMLUListElement>(null);
  const firstFilter = useRef(true);
  useLayoutEffect(() => {
    if (firstFilter.current) {
      firstFilter.current = false;
      return;
    }
    const rows = list.current?.querySelectorAll("li");
    if (!rows || rows.length === 0 || prefersReducedMotion()) return;
    const tween = gsap.from(rows, {
      x: 36,
      opacity: 0,
      duration: 0.55,
      ease: "expo.out",
      stagger: 0.06,
      clearProps: "transform,opacity",
    });
    return () => {
      tween.revert();
    };
  }, [filter]);

  const plan = useRef<HTMLButtonElement>(null);
  useEffect(() => pressable(plan.current), []);

  return (
    <div ref={scope} className="flex flex-1 flex-col gap-3.5 pb-10 pt-3">
      {attendanceSource === "portal" && <PortalSourceNote />}

      {/* ---------- the term pass ---------- */}
      <Pass
        dark
        stubWidth={STUB}
        stubClassName={`items-center pt-5 ${
          inHand.isSafe ? "bg-[var(--look-loud)] text-[var(--look-on-loud)]" : "bg-risk text-ink-0"
        }`}
        stub={
          <>
            <span className="tnum font-look text-look-fig">
              {inHand.isSafe ? inHand.canSkip : inHand.mustAttend}
            </span>
            <span className="mt-1.5 text-center text-label uppercase">
              {inHand.isSafe ? "To spare" : "To attend"}
            </span>
            <DotField
              mode="bars"
              colorVar={inHand.isSafe ? "--look-on-loud" : "--color-ink-0"}
              className="absolute inset-x-3 bottom-3.5 h-16 w-[calc(100%-24px)]"
            />
          </>
        }
      >
        <span className="block text-label uppercase text-[var(--look-deep-dim)]">Term pass · admit one</span>
        <div className="mt-2.5 flex items-baseline">
          <span className="block overflow-hidden">
            {/* Display, not the look's big size: the main part of the pass is
                only about 230px wide, and four Unbounded figures at the big
                size were clipped by their own rise mask. */}
            <span data-look-rise className="block font-look text-display">
              <span ref={figure} className="tnum">
                {overall.toFixed(1)}
              </span>
            </span>
          </span>
          <span className="font-look text-title">%</span>
        </div>
        <h1 className="mt-3 font-look text-title">{verdict}</h1>
        <p className="mt-1.5 text-callout text-[var(--look-deep-dim)]">{advice}</p>
        <div className="mt-2">
          <HandBar value={overall} dark tone={inHand.isSafe ? "ink" : "risk"} seed={5} />
        </div>
      </Pass>

      {/* ---------- the filter, as three perforated tabs ---------- */}
      {hasBoth && (
        <div
          data-look-in
          role="group"
          aria-label="Filter subjects"
          className="flex overflow-hidden rounded-[14px] border-2 border-text-1"
        >
          {(["all", "theory", "lab"] as const).map((f, i) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`min-h-11 flex-1 text-body font-bold capitalize ${
                i > 0 ? "border-l-2 border-dashed border-text-1" : ""
              } ${filter === f ? "bg-text-1 text-ink-0" : "text-text-1"}`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      <ul ref={list} className="flex flex-col gap-3">
        {ordered.map((s, i) => (
          <li key={`${s.code}-${s.category}-${i}`}>
            <SubjectPass s={s} />
          </li>
        ))}
      </ul>

      <div data-look-in className="pt-2">
        <button
          ref={plan}
          onClick={onPlan}
          className="relative flex min-h-16 w-full items-stretch rounded-[18px] border-2 border-text-1 bg-[var(--look-loud)] text-left text-[var(--look-on-loud)]"
        >
          <span className="flex flex-1 items-center pl-5 font-look text-headline">Plan a leave</span>
          <span className="grid w-[70px] place-items-center border-l-2 border-dashed border-text-1">
            <IconArrowRight size={22} />
          </span>
        </button>
      </div>
    </div>
  );
}

/** One subject as a ticket: the facts on the left, the decision on the stub. */
function SubjectPass({ s }: { s: Subject }) {
  const p = predict(s.attended, s.conducted, THRESHOLD);
  const none = s.conducted === 0;
  const short = !none && !p.isSafe;
  const tight = !none && p.isSafe && p.canSkip <= 1;

  return (
    <Pass
      stubWidth={88}
      surfaceClassName={short ? "bg-[var(--look-risk-bg)]" : "bg-ink-1"}
      stubClassName={`items-center justify-center px-1.5 text-center ${
        short ? "bg-risk text-ink-0" : tight ? "bg-[var(--look-watch-bg)] text-watch" : "bg-ink-2 text-text-1"
      }`}
      stub={
        none ? (
          <span className="text-label uppercase">No classes</span>
        ) : (
          <>
            <span className="tnum font-look text-title">{p.isSafe ? p.canSkip : p.mustAttend}</span>
            <span className="mt-1.5 text-label uppercase">
              {short ? "To attend" : tight ? "On the line" : "To spare"}
            </span>
          </>
        )
      }
    >
      <p className="text-headline leading-snug">{s.title || s.code}</p>
      <p className={`tnum mt-0.5 text-callout ${short ? "text-risk" : "text-text-3"}`}>
        {[s.code, s.category].filter(Boolean).join(" · ")}
      </p>
      {!none && (
        <>
          <div className="mt-2.5">
            <HandBar compact value={s.percentage} tone={short ? "risk" : tight ? "watch" : "ink"} seed={s.attended + s.conducted} />
          </div>
          <p className={`tnum mt-1.5 text-callout ${short ? "text-risk" : "text-text-3"}`}>
            went {s.attended} · missed {s.conducted - s.attended}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="tnum text-body font-bold">{pctText(s.percentage)}</span>
            <HandNote tilt={-3} className={short ? "text-risk" : tight ? "text-watch" : "text-text-3"}>
              {short ? "short" : tight ? "on the line" : "safe"}
            </HandNote>
          </div>
        </>
      )}
    </Pass>
  );
}
