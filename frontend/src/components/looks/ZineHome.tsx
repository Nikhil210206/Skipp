"use client";

import Link from "next/link";
import { useRef } from "react";
import { useSession } from "@/context/SessionContext";
import { greeting, useHomeData } from "@/lib/home";
import { countTo, useGsap } from "@/lib/motion";
import { predict } from "@/lib/predictor";
import { daysAway } from "@/lib/holidays";
import type { ScheduleItem } from "@/lib/schedule";
import { THRESHOLD, isLabSubject, lookEntrance, splitLeft, useMinutesLeft } from "./shared";
import { Barcode, Printed, Stamp, WireMeter } from "./ZineParts";

/**
 * HOME, as the cover of a zine.
 *
 * The issue line is your semester. The cover star is the countdown, with a set
 * of keys hanging from the rule above it and today's day order on one of the
 * key caps. Attendance is a strand of barbed wire with its barb at 75%. The
 * foot of the cover carries a barcode of your registration number and a price
 * box that holds the disclaimer.
 *
 * Everything prints in the blue drum. A class in a subject you are short in is
 * stamped "must go" in the red one, which makes it the only red on the cover.
 */
export default function ZineHome() {
  const { timetable } = useSession();
  const { attendance, attendanceState, displayName, focus, cover, later, overall, feed, today, nextBreak } =
    useHomeData();
  const left = useMinutesLeft(cover.targetMs);
  const [figure, unit] = left === null ? ["", ""] : splitLeft(left);

  const subjects = attendance?.subjects ?? [];
  const attended = subjects.reduce((s, x) => s + x.attended, 0);
  const conducted = subjects.reduce((s, x) => s + x.conducted, 0);
  const inHand = predict(attended, conducted, THRESHOLD);
  const ready = attendanceState === "ready" && conducted > 0;

  // A course's theory and lab are separate attendance rows sharing one code,
  // so "short" is looked up by code AND side, or a short lab would stamp the
  // theory hour too.
  const shortSides = new Set(
    subjects.filter((s) => s.conducted > 0 && !s.isSafe).map((s) => `${s.code}::${isLabSubject(s)}`),
  );
  const mustGo = (c: ScheduleItem) => !c.isCustom && shortSides.has(`${c.code}::${c.isLab}`);

  const inClass = cover.label.startsWith("In class");
  const semester = timetable?.student.semester;
  const reg = timetable?.student.registrationNumber ?? null;

  const pct = useRef<HTMLSpanElement>(null);
  const scope = useGsap(
    ({ self, reduced }) => {
      lookEntrance(self, reduced);
      if (pct.current && ready) countTo(pct.current, overall, reduced, (n) => n.toFixed(1));
    },
    [ready, overall, cover.hero?.id],
  );

  return (
    <div ref={scope} className="flex flex-1 flex-col pb-10 pt-2">
      {/* ---------- the issue line ---------- */}
      <div
        data-look-in
        className="zine-typed flex items-baseline justify-between gap-3 text-[10.5px] uppercase leading-[14px] tracking-[0.08em]"
      >
        <span>
          {semester ? `Issue ${semester.padStart(2, "0")} · ` : ""}
          {focus?.dayOrder != null ? `Day order ${focus.dayOrder}` : "Day off"}
        </span>
        <span className="shrink-0">{semester ? `Sem ${semester} · Free` : "Free"}</span>
      </div>
      <div data-look-rule className="mt-2 h-[2px] bg-text-1" />

      {/* ---------- the cover ---------- */}
      <section className="relative">
        {/* The keys hang from the rule: pulled up by the ring's own margin in
            the drawing, so the ring sits on the line rather than under it.
            Decorative, and the labels on the caps are live text, so today's
            day order is printed on a key. */}
        <div
          aria-hidden
          className="@container pointer-events-none absolute -right-1.5 top-0 w-[min(54%,210px)] -translate-y-[4.6%]"
        >
          <Printed name="keys" className="aspect-[300/350] w-full" />
          <span className="zine-print absolute left-[47.88%] top-[40.12%] -translate-x-1/2 -translate-y-1/2 rotate-[40deg] whitespace-nowrap text-[6.7cqw] leading-none tracking-[0.06em] text-ink-0">
            SKIPP
          </span>
          <span className="zine-print absolute left-[77.08%] top-[42.67%] -translate-x-1/2 -translate-y-1/2 -rotate-[8deg] whitespace-nowrap text-[6.2cqw] leading-none tracking-[0.04em] text-ink-0">
            {focus?.dayOrder != null ? `DO ${focus.dayOrder}` : "OFF"}
          </span>
        </div>

        {/* Kept clear of the keys: the right of the line is theirs, and a long
            name wraps rather than running under them. */}
        <h1
          data-look-in
          className="zine-print relative break-words pr-[42%] pt-4 text-[clamp(2.5rem,13vw,3.125rem)] leading-[0.92]"
        >
          {greeting()},
          <br />
          {displayName}.
        </h1>

        <p
          data-look-in
          className="zine-typed relative mt-5 text-[11px] uppercase leading-none tracking-[0.08em]"
        >
          {cover.label}
        </p>
        {left !== null ? (
          <div className="relative mt-1.5 flex items-baseline gap-2.5">
            <span className="block overflow-hidden">
              {/* Sized by its length, because the keys' lowest tip hangs just
                  right of it. Two characters ("28", "3h") are 0.88em wide and
                  clear the tip at full size; three ("12h", "14d") are 1.32em,
                  and at full size the blade cut into the "h". */}
              <span
                data-look-rise
                className="zine-print zine-grain block leading-[0.75]"
                style={{ fontSize: figure.length > 2 ? "clamp(4.5rem, 30vw, 7.5rem)" : "clamp(7rem, 44vw, 10.625rem)" }}
              >
                {figure}
              </span>
            </span>
            {unit && (
              <span className="block overflow-hidden">
                <span
                  data-look-rise
                  className="zine-print block text-[clamp(2.25rem,12vw,3rem)] leading-[0.75]"
                >
                  {unit === "min" ? "MIN" : unit}
                </span>
              </span>
            )}
          </div>
        ) : (
          <p className="zine-print relative mt-2 text-[3rem] uppercase leading-[0.9]">{cover.title}</p>
        )}

        {left !== null && (
          <h2
            data-look-in
            className="zine-print relative mt-4 text-[1.625rem] uppercase leading-[0.95] text-balance"
          >
            {cover.title}
          </h2>
        )}
        <div data-look-in className="relative mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {/* The class coming up is in a subject you are short in. Not while
              you are sitting in it: then you are already doing the thing the
              stamp would ask. */}
          {cover.hero && mustGo(cover.hero) && !inClass && (
            <Stamp tone="red" solid className="text-[0.6875rem]">
              Must go
            </Stamp>
          )}
          <p className="zine-typed tnum text-[11px] uppercase leading-[1.4] tracking-[0.06em]">{cover.meta}</p>
        </div>
        {cover.note && (
          <p
            data-look-in
            className="zine-typed relative mt-1 text-[11px] uppercase leading-[1.4] tracking-[0.06em]"
          >
            {cover.note}
          </p>
        )}
      </section>

      <div data-look-rule className="mt-5 h-[1.5px] bg-text-1/35" />

      {/* ---------- attendance, as wire ---------- */}
      <Link href="/attendance" data-look-in className="block pt-4">
        {ready ? (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex items-baseline gap-2">
                <span className="zine-print text-[1.875rem] leading-[0.8]">
                  <span ref={pct} className="tnum">
                    {overall.toFixed(1)}
                  </span>
                  %
                </span>
                <span className="zine-typed text-[10.5px] uppercase tracking-[0.08em]">attended</span>
              </span>
              <span className={`flex items-baseline gap-2 ${inHand.isSafe ? "" : "text-risk"}`}>
                <span className="zine-print tnum text-[1.875rem] leading-[0.8]">
                  {inHand.isSafe ? inHand.canSkip : inHand.mustAttend}
                </span>
                <span className="zine-typed text-[10.5px] uppercase tracking-[0.08em]">
                  {inHand.isSafe ? "skips in hand" : "to attend"}
                </span>
              </span>
            </div>
            <WireMeter value={overall} short={!inHand.isSafe} className="mt-1.5" />
          </>
        ) : (
          <p className="zine-typed text-[11px] uppercase tracking-[0.08em]">
            Attendance · {attendanceState === "gated" ? "not published yet" : "unavailable"}
          </p>
        )}
      </Link>

      {/* ---------- the rest of the day ---------- */}
      {later.length > 0 && (
        <section className="pt-5">
          <div
            data-look-in
            className="zine-typed flex items-baseline justify-between text-[10.5px] uppercase tracking-[0.08em]"
          >
            <span>{cover.thenLabel}</span>
            <span className="tnum">{later.length} more</span>
          </div>
          <ul className="mt-1.5 border-t-[1.5px] border-text-1/35">
            {later.map((c) => (
              <li
                key={c.id}
                data-look-in
                className="flex min-h-11 items-center gap-3 border-b-[1.5px] border-text-1/35 py-1.5"
              >
                <span className="zine-print tnum w-11 shrink-0 text-[1.125rem] leading-none">{c.start}</span>
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[0.875rem] font-semibold leading-[1.2]">{c.title}</span>
                  {mustGo(c) && (
                    <Stamp tone="red" solid className="text-[0.6875rem]">
                      Must go
                    </Stamp>
                  )}
                </span>
                <span className="zine-typed shrink-0 text-[11px] uppercase tracking-[0.04em]">
                  {c.isCustom ? "Added" : c.room}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- what wants attention ---------- */}
      {feed.length > 0 && (
        <section className="pt-6">
          <div
            data-look-in
            className="zine-typed flex items-baseline justify-between text-[10.5px] uppercase tracking-[0.08em]"
          >
            <span>Heads up</span>
            <span className="tnum">{feed.length}</span>
          </div>
          <ul className="mt-1.5 border-t-[1.5px] border-text-1/35">
            {feed.map((r) => (
              <li
                key={r.id}
                data-look-in
                className="flex items-start gap-3 border-b-[1.5px] border-text-1/35 py-2.5"
              >
                <span
                  aria-hidden
                  className={`mt-1 size-2.5 shrink-0 ${r.tone === "danger" ? "bg-risk" : "bg-text-1"}`}
                />
                <span className="min-w-0">
                  <span className="block text-[0.875rem] font-semibold leading-[1.25]">{r.title}</span>
                  {r.meta && (
                    <span className="zine-typed tnum mt-0.5 block text-[10.5px] uppercase tracking-[0.04em] text-text-3">
                      {r.meta}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- the next break ---------- */}
      {nextBreak && (
        <p
          data-look-in
          className="zine-typed mt-5 text-[10.5px] uppercase leading-[1.5] tracking-[0.06em]"
        >
          Next break · <b>{nextBreak.name}</b> ·{" "}
          {nextBreak.run > 1 ? `${nextBreak.run} days off` : "a day off"} ·{" "}
          {daysAway(today, nextBreak.runStart)}
        </p>
      )}

      {/* ---------- the foot of the cover ---------- */}
      <div data-look-in className="mt-7 flex items-end justify-between gap-4">
        {reg ? (
          <div className="min-w-0">
            <Barcode value={reg} className="h-[25px] w-[116px]" />
            <p className="zine-typed mt-1 text-[9.5px] leading-none tracking-[0.14em]">{reg}</p>
          </div>
        ) : (
          <span />
        )}
        {/* No grain on this one: it is the disclaimer, so it is words to read,
            and grain breaks small type up. */}
        <p
          className="zine-typed shrink-0 border-[1.5px] border-text-1 px-[7px] pb-[3px] pt-1 text-right text-[9.5px] uppercase leading-[1.3] tracking-[0.06em]"
          style={{ rotate: "1.5deg" }}
        >
          Free
          <br />
          Not affiliated with SRM
        </p>
      </div>
    </div>
  );
}
