"use client";

import Link from "next/link";
import { useHomeData } from "@/lib/home";
import { useGsap } from "@/lib/motion";
import { predict } from "@/lib/predictor";
import { dateRange, dayAndDate, daysAway } from "@/lib/holidays";
import { prettyDate } from "@/lib/schedule";
import { DotField, THRESHOLD, lookEntrance, pctText, splitLeft, useMinutesLeft } from "./shared";
import { Pass, SidePass } from "./TicketParts";
import { HandNote } from "./hand";

/** Most coupons the bunk pass tears off before it says "+N". */
const MAX_COUPONS = 8;
const STUB = 102;

/**
 * HOME, as the day's passes.
 *
 * The next class is a boarding pass with the room on its stub and a rubber
 * stamp saying how long is left. The term's margin is a black bunk pass with
 * one tear-off coupon per class you can still miss. The break and the rest of
 * the day are smaller stubs.
 */
export default function TicketHome() {
  const { attendance, attendanceState, focus, cover, later, feed, today, nextBreak } = useHomeData();
  const left = useMinutesLeft(cover.targetMs);
  const [figure, unit] = left === null ? ["", ""] : splitLeft(left);
  const hero = cover.hero;
  const inClass = cover.label.startsWith("In class");

  const subjects = attendance?.subjects ?? [];
  const attended = subjects.reduce((s, x) => s + x.attended, 0);
  const conducted = subjects.reduce((s, x) => s + x.conducted, 0);
  const overall = conducted > 0 ? (attended / conducted) * 100 : 0;
  const inHand = predict(attended, conducted, THRESHOLD);
  const ready = attendanceState === "ready" && conducted > 0;
  const coupons = inHand.isSafe ? Math.min(inHand.canSkip, MAX_COUPONS) : 0;

  const scope = useGsap(({ self, reduced }) => lookEntrance(self, reduced), [cover.hero?.id, ready]);

  return (
    <div ref={scope} className="flex flex-1 flex-col gap-3.5 pb-10 pt-3">
      <div data-look-in className="flex items-center justify-between text-label uppercase text-text-3">
        <span>{focus ? `${focus.label === "TODAY" ? "Today's" : "Next"} pass · ${prettyDate(focus.date)}` : "Today's pass"}</span>
        {focus?.dayOrder != null && <span className="tnum">Day order {focus.dayOrder}</span>}
      </div>

      {/* ---------- the next class ---------- */}
      <Pass
        stubWidth={STUB}
        stubClassName="bg-[var(--look-loud)] text-[var(--look-on-loud)] px-3 pt-4"
        stub={
          <>
            <span className="text-label uppercase">{hero?.isCustom ? "Added" : "Room"}</span>
            {/* Headline size, not title: room codes like "TP306" have no space
                to wrap at, and at title size Unbounded split them mid code. */}
            <span className="mt-2 break-words font-look text-headline">
              {hero?.room ?? (hero ? "TBA" : "Free")}
            </span>
            <DotField
              mode="bars"
              colorVar="--look-on-loud"
              className="absolute inset-x-2.5 bottom-3 h-11 w-[calc(100%-20px)]"
            />
          </>
        }
        className={left !== null ? "mb-8" : ""}
        overlay={
          left !== null && (
            <div
              data-look-stamp
              role="img"
              aria-label={`${inClass ? "Ends" : "Starts"} in ${figure} ${unit}`}
              className="absolute -bottom-9 flex size-24 flex-col items-center justify-center rounded-full border-[3px] border-accent bg-ink-0 leading-none text-accent"
              style={{ right: STUB - 30, transform: "rotate(-12deg)" }}
            >
              <span className="text-label font-extrabold">{inClass ? "ENDS IN" : "STARTS IN"}</span>
              <span className="tnum my-0.5 font-look text-title">{figure}</span>
              <span className="text-label font-extrabold">{unit.toUpperCase() || " "}</span>
            </div>
          )
        }
      >
        <span className="block text-label uppercase text-text-3">{cover.label}</span>
        {hero ? (
          <>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="block overflow-hidden">
                <span data-look-rise className="tnum block font-look text-look-fig">
                  {hero.start}
                </span>
              </span>
              <span className="tnum text-body font-semibold text-text-3">to {hero.end}</span>
            </div>
            <h1 className="mt-3 font-look text-title text-balance">{hero.title}.</h1>
            <p className="tnum mt-2 text-callout text-text-3">
              {[hero.isCustom ? "Added" : hero.isLab ? "Lab" : "Theory", focus?.label === "TODAY" ? null : prettyDate(focus?.date ?? today)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </>
        ) : (
          <h1 className="mt-3 font-look text-look-head">{cover.title}</h1>
        )}
        {cover.note && <p className="mt-2 text-callout text-accent">{cover.note}</p>}
      </Pass>

      {/* ---------- the bunk pass ---------- */}
      <Link href="/attendance" aria-label="Attendance" className="block">
        <Pass
          dark
          stubWidth={STUB}
          stubClassName={`items-center justify-center px-2 text-center ${
            ready && !inHand.isSafe ? "bg-risk text-ink-0" : ""
          }`}
          stub={
            ready ? (
              <>
                <span className="tnum font-look text-title">{pctText(overall)}</span>
                <span className="mt-1.5 text-label uppercase opacity-80">Attended</span>
              </>
            ) : (
              <span className="text-label uppercase opacity-80">No data</span>
            )
          }
        >
          <span className="block text-label uppercase text-[var(--look-deep-dim)]">Bunk pass · this term</span>
          {ready ? (
            <>
              <span className="tnum mt-2 block font-look text-look-big">
                {inHand.isSafe ? inHand.canSkip : inHand.mustAttend}
              </span>
              <span className="mt-1 block text-body font-semibold">
                {inHand.isSafe ? "classes you can skip" : "classes to attend in a row"}
              </span>
              {coupons > 0 && (
                <div className="mt-3.5 flex flex-wrap items-center gap-1.5" aria-hidden>
                  {Array.from({ length: coupons }, (_, i) => (
                    <span
                      key={i}
                      data-look-tick
                      className="box-border h-6 w-4 rounded-[4px] border-[1.5px] border-dashed border-[var(--look-on-deep)] bg-[var(--look-loud)]"
                    />
                  ))}
                  {inHand.canSkip > MAX_COUPONS && (
                    <span className="tnum ml-1 text-callout text-[var(--look-deep-dim)]">
                      +{inHand.canSkip - MAX_COUPONS}
                    </span>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="mt-3 text-body text-[var(--look-deep-dim)]">
              {attendanceState === "gated" ? "Attendance is not published yet." : "Attendance is unavailable right now."}
            </p>
          )}
        </Pass>
      </Link>

      {/* ---------- the next break ---------- */}
      {nextBreak && (
        <Pass
          stubWidth={STUB}
          stubClassName="items-center justify-center bg-ink-2 text-center"
          stub={
            <>
              <span className="tnum font-look text-title">{nextBreak.run}</span>
              <span className="mt-1.5 text-label uppercase">{nextBreak.run > 1 ? "Days off" : "Day off"}</span>
            </>
          }
        >
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-label uppercase text-text-3">Next break</span>
            <HandNote tilt={6} className="text-accent">
              finally
            </HandNote>
          </span>
          <span className="mt-1.5 block truncate font-look text-title">{nextBreak.name}</span>
          <span className="tnum mt-1 block text-callout text-text-3">
            {nextBreak.run > 1
              ? dateRange(nextBreak.runStart, nextBreak.runEnd)
              : dayAndDate(nextBreak.weekday, nextBreak.date)}{" "}
            · {daysAway(today, nextBreak.runStart)}
          </span>
        </Pass>
      )}

      {/* ---------- what wants attention ---------- */}
      {feed.length > 0 && (
        <section className="pt-3">
          <h2 data-look-in className="pb-3 font-look text-title">Heads up.</h2>
          <ul className="flex flex-col gap-2.5">
            {feed.map((r) => (
              <li
                key={r.id}
                data-look-pass
                className="flex overflow-hidden rounded-[16px] border-2 border-text-1 bg-ink-1"
              >
                <span
                  aria-hidden
                  className={`w-2.5 shrink-0 border-r-2 border-dashed border-text-1 ${
                    r.tone === "danger" ? "bg-risk" : r.tone === "warning" ? "bg-[var(--look-loud)]" : "bg-ink-2"
                  }`}
                />
                <span className="min-w-0 px-3.5 py-3">
                  <span className="block text-body text-text-1">{r.title}</span>
                  {r.meta && <span className="tnum mt-0.5 block text-callout text-text-3">{r.meta}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- the rest of the day ---------- */}
      {later.length > 0 && (
        <section className="pt-3">
          <div data-look-in className="flex items-baseline justify-between pb-3">
            <h2 className="font-look text-title">{cover.thenLabel}.</h2>
            <span className="tnum text-callout text-text-3">{later.length} more</span>
          </div>
          <ul className="flex flex-col gap-2.5">
            {later.map((c) => (
              <li key={c.id}>
                <SidePass
                  side={
                    <>
                      <span className="tnum block font-look text-headline">{c.start}</span>
                      <span className="tnum mt-0.5 block text-callout text-text-3">{c.end}</span>
                    </>
                  }
                >
                  <span className="min-w-0">
                    <span className="block truncate text-body font-semibold">{c.title}</span>
                    <span className="mt-0.5 block truncate text-callout text-text-3">
                      {c.isCustom ? "Added" : (c.room ?? c.abbrev)}
                    </span>
                  </span>
                  <span className="shrink-0 text-label uppercase text-text-3">
                    {c.isCustom ? "Added" : c.isLab ? "Lab" : "Theory"}
                  </span>
                </SidePass>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
