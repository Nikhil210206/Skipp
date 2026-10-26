"use client";

import Link from "next/link";
import { useRef } from "react";
import { useHomeData } from "@/lib/home";
import { countTo, useGsap } from "@/lib/motion";
import { predict } from "@/lib/predictor";
import { dateRange, dayAndDate, daysAway } from "@/lib/holidays";
import { nowMinutes } from "@/lib/schedule";
import { IconChevronRight } from "@/components/Icons";
import { DotField, THRESHOLD, lookEntrance, splitLeft, useMinutesLeft } from "./shared";
import { HandBar, HandNote, HandRule } from "./hand";

/**
 * HOME, as a page of the register you keep yourself.
 *
 * The countdown is set straight on the page with the dot field behind it, the
 * day is a strip of periods with "up next" written over the one that is, and
 * attendance is the same pen-drawn bar as the Attendance screen. Rules are
 * drawn by hand rather than by a ruler, and the margin has notes in it.
 */
export default function RegisterHome() {
  const { attendance, attendanceState, focus, classes, cover, later, overall, feed, today, nextBreak } =
    useHomeData();
  const left = useMinutesLeft(cover.targetMs);
  const [figure, unit] = left === null ? ["", ""] : splitLeft(left);

  const subjects = attendance?.subjects ?? [];
  const attended = subjects.reduce((s, x) => s + x.attended, 0);
  const conducted = subjects.reduce((s, x) => s + x.conducted, 0);
  const inHand = predict(attended, conducted, THRESHOLD);
  const short = subjects.filter((s) => s.conducted > 0 && !s.isSafe).length;

  const isToday = focus?.label === "TODAY";
  const now = isToday ? nowMinutes() : -1;
  const periods = classes.map((c) => ({
    c,
    span: Math.max(1, c.covers.length),
    state: c === cover.hero ? "next" : isToday && c.endMin <= now ? "done" : "up",
  }));
  const columns = periods.reduce((n, p) => n + p.span, 0);
  // Where "up next" is written: over the hero's own column, worked out from
  // the spans before it so a two period lab shifts it correctly.
  const heroAt = periods.findIndex((p) => p.state === "next");
  const heroStart = periods.slice(0, Math.max(0, heroAt)).reduce((n, p) => n + p.span, 0) + 1;
  const inClass = cover.label.startsWith("In class");

  const pct = useRef<HTMLSpanElement>(null);
  const scope = useGsap(
    ({ self, reduced }) => {
      lookEntrance(self, reduced);
      if (pct.current && attendanceState === "ready") {
        countTo(pct.current, overall, reduced, (n) => n.toFixed(1));
      }
    },
    [attendanceState, overall, cover.hero?.id],
  );

  return (
    <div ref={scope} className="flex flex-1 flex-col pb-10">
      <HandRule strong className="bleed" />
      <div data-look-in className="flex items-center justify-between py-2.5 text-label uppercase text-text-3">
        <span>{cover.label}</span>
        {focus?.dayOrder != null && <span className="tnum">Day order {focus.dayOrder}</span>}
      </div>

      {/* ---------- the countdown, on the page ---------- */}
      <section className="relative pb-7 pt-3">
        <DotField mode="corner" className="absolute -right-[var(--gutter)] top-0 size-60 opacity-60" />
        <div className="relative">
          {left !== null ? (
            <div className="flex items-baseline gap-2.5">
              <span className="block overflow-hidden">
                <span data-look-rise className="tnum block font-look text-look-giant">
                  {figure}
                </span>
              </span>
              {unit && (
                <span className="block overflow-hidden">
                  <span data-look-rise className="block font-look text-look-head">
                    {unit}
                  </span>
                </span>
              )}
            </div>
          ) : null}
          <h1 className="mt-5 font-look text-look-head text-balance">
            <span className="block overflow-hidden pb-[0.06em]">
              <span data-look-rise className="block">
                {cover.title}
                {left !== null ? "." : ""}
              </span>
            </span>
          </h1>
          <p data-look-in className="tnum mt-3 text-callout text-text-3">
            {cover.meta}
          </p>
          {cover.note && (
            <p data-look-in className="mt-1.5 text-callout text-accent">
              {cover.note}
            </p>
          )}
        </div>
      </section>

      {/* ---------- the day as a register ruling ---------- */}
      {periods.length > 0 && (
        <section className="pb-7">
          <div data-look-in className="mb-1 flex items-baseline justify-between">
            <span className="text-label uppercase text-text-3">
              {isToday ? "Today's register" : `${focus?.weekday ?? "Next"} register`}
            </span>
            <span className="tnum text-callout text-text-3">
              {classes.length} {classes.length === 1 ? "class" : "classes"}
            </span>
          </div>
          {heroAt >= 0 && (
            <div
              data-look-in
              aria-hidden
              className="grid h-9 items-end"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
              <span
                className="flex items-end justify-center gap-0.5 whitespace-nowrap text-accent"
                style={{ gridColumn: `${heroStart} / span ${periods[heroAt].span}` }}
              >
                <HandNote tilt={-6}>{inClass ? "you're here" : "up next"}</HandNote>
                <svg width="18" height="20" viewBox="0 0 18 20" className="-mb-0.5 shrink-0 overflow-visible">
                  <path d="M3 2 C 9 5, 12 9, 11 17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M7 13.5 L 11 18 L 14.5 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          )}
          <div
            className="hand-edge grid overflow-hidden border-2 border-text-1"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {periods.map(({ c, span, state }, i) => (
              <div
                key={c.id}
                data-look-in
                className={`flex h-16 min-w-0 flex-col justify-between px-1.5 py-1.5 ${
                  i > 0 ? "border-l-2 border-text-1" : ""
                } ${
                  state === "next"
                    ? "bg-[var(--look-loud)] text-[var(--look-on-loud)]"
                    : state === "done"
                      ? "bg-ink-2 text-text-3"
                      : "bg-ink-1 text-text-1"
                }`}
                style={{ gridColumn: `span ${span}` }}
              >
                <span className="tnum truncate text-label">{c.start}</span>
                <span className={`truncate text-body font-bold ${state === "done" ? "line-through decoration-2" : ""}`}>
                  {c.abbrev || c.title}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------- attendance, drawn ---------- */}
      <Link href="/attendance" data-look-in className="group block pb-2">
        <HandRule strong className="bleed" />
        <div className="flex items-end justify-between gap-4 pt-4">
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-label uppercase text-text-3">
              Attendance
              <IconChevronRight size={13} />
            </span>
            {attendanceState === "ready" ? (
              <span className="mt-1.5 flex items-baseline">
                <span ref={pct} className="tnum font-look text-look-fig">
                  {overall.toFixed(1)}
                </span>
                <span className="font-look text-title">%</span>
              </span>
            ) : (
              <span className="mt-1.5 block text-title text-text-3">
                {attendanceState === "gated" ? "Not published yet" : "Unavailable"}
              </span>
            )}
          </span>
          {attendanceState === "ready" && (
            <span className="tnum shrink-0 pb-1 text-right text-callout text-text-3">
              {short > 0
                ? `${short} below the line`
                : inHand.isSafe
                  ? `${inHand.canSkip} you can skip`
                  : `${inHand.mustAttend} to attend`}
            </span>
          )}
        </div>
        {attendanceState === "ready" && (
          <div className="pt-1">
            <HandBar value={overall} tone={inHand.isSafe ? "ink" : "risk"} seed={11} />
          </div>
        )}
      </Link>

      {/* ---------- what wants attention ---------- */}
      {feed.length > 0 && (
        <section className="pt-6">
          <div data-look-in className="flex items-baseline justify-between">
            <h2 className="font-look text-title">Heads up.</h2>
            <span className="tnum text-callout text-text-3">{feed.length}</span>
          </div>
          <ul>
            {feed.map((r) => (
              <li key={r.id} data-look-in className="relative flex items-start gap-3.5 py-3.5">
                <span
                  aria-hidden
                  className={`hand-edge mt-1 size-3 shrink-0 ${
                    r.tone === "danger" ? "bg-risk" : r.tone === "warning" ? "bg-accent" : "bg-text-3"
                  }`}
                />
                <span className="min-w-0">
                  <span className="block text-body text-text-1">{r.title}</span>
                  {r.meta && <span className="tnum mt-0.5 block text-callout text-text-3">{r.meta}</span>}
                </span>
                <HandRule className="absolute inset-x-0 bottom-0" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- the rest of the day ---------- */}
      {later.length > 0 && (
        <section className="pt-7">
          <div data-look-in className="flex items-baseline justify-between">
            <h2 className="font-look text-title">{cover.thenLabel}.</h2>
            <span className="tnum text-callout text-text-3">{later.length} more</span>
          </div>
          <ul>
            {later.map((c) => (
              <li key={c.id} data-look-in className="relative flex items-center gap-4 py-3.5">
                <span className="tnum w-14 shrink-0 text-headline font-bold">{c.start}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-semibold text-text-1">{c.title}</span>
                  <span className="tnum mt-0.5 block truncate text-callout text-text-3">
                    {[c.isCustom ? "Added" : c.room, `till ${c.end}`].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <HandNote tilt={-4} className="shrink-0 text-text-2">
                  {c.isCustom ? "added" : c.isLab ? "lab" : "theory"}
                </HandNote>
                <HandRule className="absolute inset-x-0 bottom-0" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- the next break ---------- */}
      {nextBreak && (
        <div
          data-look-in
          className="hand-edge relative mt-7 flex items-center gap-3.5 border-2 border-text-1 bg-ink-1 px-4 py-3.5"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-label uppercase text-text-3">Next break</span>
            <span className="mt-1 block truncate font-look text-title">{nextBreak.name}</span>
            <span className="tnum mt-0.5 block text-callout text-text-3">
              {nextBreak.run > 1
                ? dateRange(nextBreak.runStart, nextBreak.runEnd)
                : dayAndDate(nextBreak.weekday, nextBreak.date)}{" "}
              · {daysAway(today, nextBreak.runStart)}
            </span>
          </span>
          <span className="tnum shrink-0 text-headline font-bold">
            {nextBreak.run > 1 ? `${nextBreak.run} days off` : "Day off"}
          </span>
          <HandNote tilt={8} className="absolute -top-4 right-3 text-accent">
            finally
          </HandNote>
        </div>
      )}
    </div>
  );
}
