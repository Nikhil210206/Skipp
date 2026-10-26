"use client";

import Link from "next/link";
import { useRef } from "react";
import gsap from "gsap";
import Countdown from "@/components/Countdown";
import RegisterHome from "@/components/looks/RegisterHome";
import TicketHome from "@/components/looks/TicketHome";
import { greeting, useHomeData } from "@/lib/home";
import { useComposition } from "@/lib/theme";
import { countTo, revealIn, useGsap } from "@/lib/motion";
import { IconChevronRight } from "@/components/Icons";
import { SectionHead, TrackRule } from "@/components/ui/editorial";

/**
 * HOME: a cover, not a dashboard.
 *
 * The screen is built as three beats rather than a stack of cards:
 *   1. The cover. A live countdown is the hero, set against the day-order
 *      numeral blown up and bled off the right edge.
 *   2. A full-bleed accent band carrying attendance, the one other number that
 *      changes a student's behaviour.
 *   3. The rest of the day, led by time rather than by course name, so the
 *      column of numerals gives the section its own rhythm.
 */
const THRESHOLD = 75;

export default function DashboardPage() {
  // Register and Ticket compose Home from their own pieces. Every other look
  // is the cover below, restyled by its CSS.
  const look = useComposition();
  if (look === "register") return <RegisterHome />;
  if (look === "ticket") return <TicketHome />;
  return <CoverHome />;
}

function CoverHome() {
  const { attendanceState, displayName, focus, cover, later, overall, belowTarget, feed } =
    useHomeData();

  const pct = useRef<HTMLSpanElement>(null);
  const ghost = useRef<HTMLDivElement>(null);

  const scope = useGsap(
    ({ self, reduced }) => {
      revealIn(self, reduced, { y: 18, stagger: 0.08 });
      if (pct.current && attendanceState === "ready") {
        countTo(pct.current, overall, reduced, (n) => n.toFixed(1));
      }
      // The day-order numeral drifts as the page moves under it, so the cover
      // has depth without any shadow or gradient.
      if (ghost.current && !reduced) {
        gsap.to(ghost.current, {
          yPercent: -14,
          ease: "none",
          scrollTrigger: { trigger: self, start: "top top", end: "+=420", scrub: 0.5 },
        });
      }
    },
    [overall, attendanceState, cover.hero?.id, cover.targetMs],
  );

  return (
    <>
      <div ref={scope} className="flex flex-1 flex-col">
        {/* ---------- 1. THE COVER ---------- */}
        <section className="bleed bleed-pad relative flex min-h-[42dvh] flex-col justify-end overflow-hidden pb-9 pt-2">
          {focus?.dayOrder != null && (
            <div
              ref={ghost}
              aria-hidden
              className="pointer-events-none absolute right-0 -top-2 select-none text-right"
            >
              {/* Steps down below 360px. At 11rem the numeral is 176px tall and
                  about a third of the width of a 320px column, which leaves the
                  greeting beside it too narrow to set even one word of. */}
              <span data-do-numeral className="block text-[8rem] font-bold leading-[0.78] tracking-[-0.06em] text-ink-2 min-[360px]:text-[11rem]">
                {focus.dayOrder}
              </span>
              {/* The numeral is the day order, so it says so. Unlabelled it would
                  be ornament, and ornament is what we are avoiding. */}
              <span data-do-label className="mt-2 block text-label uppercase text-text-3/60">
                Day order
              </span>
            </div>
          )}

          <div className="relative">
            {/* Set as a line of type, not as a caption. It is the only thing on
                the screen addressed to a person rather than about a schedule.

                **The right padding is what keeps it off the day-order numeral.**
                That numeral is an absolutely positioned sibling pinned to the
                right of this same band, so this line has to be told where to
                stop or it simply runs underneath and paints on top of it.
                Measured on a 384px Android at the greeting's own size, six of
                eight ordinary first names collided, by up to 82px, so this was
                the common case and not a long-name edge case. Reserved only
                while the numeral is actually on screen: a holiday has no day
                order, and then the line should have the full width back. */}
            <h1
              data-reveal
              className={`text-hero ${
                focus?.dayOrder != null
                  ? "break-words pr-[5.25rem] min-[360px]:pr-[7.5rem]"
                  : ""
              }`}
            >
              <span className="text-text-2">{greeting()}, </span>
              {displayName}
            </h1>
            <p data-reveal className="mt-7 text-label uppercase text-accent">
              {cover.label}
            </p>

            <div className="mt-3.5">
              {cover.targetMs !== null ? (
                <Countdown key={cover.targetMs} target={cover.targetMs} />
              ) : (
                <p className="text-poster">&mdash;</p>
              )}
            </div>

            <div data-reveal className="mt-8 h-px w-full bg-line" />

            <h1 data-reveal className="mt-7 text-balance text-title">
              {cover.title}
            </h1>
            <p data-reveal className="mt-2 tnum text-callout text-text-3">
              {cover.meta}
            </p>
            {cover.note && (
              <p data-reveal className="mt-1.5 text-callout text-accent">
                {cover.note}
              </p>
            )}
          </div>
        </section>

        {/* ---------- 2. THE MEASURE ---------- */}
        <Link href="/attendance" data-reveal className="group block pt-9">
          <div className="flex items-baseline justify-between">
            <span className="text-label uppercase text-text-3">Attendance</span>
            <span className="flex items-center gap-1.5 text-label uppercase text-text-3 transition-colors group-hover:text-text-1">
              All subjects
              <IconChevronRight size={14} />
            </span>
          </div>

          {attendanceState === "ready" ? (
            <>
              <div className="mt-5 flex items-end justify-between gap-4">
                <span className="flex items-baseline">
                  <span ref={pct} className="tnum text-display">
                    {overall.toFixed(1)}
                  </span>
                  <span className="text-title text-text-3">%</span>
                </span>
                <span className="pb-2 text-callout text-text-3">
                  {belowTarget > 0 ? (
                    <span className="text-accent">
                      {belowTarget} below target
                    </span>
                  ) : (
                    "Every subject clear"
                  )}
                </span>
              </div>
              {/* The 75% mark is a tick on the rule, so the gap between where you
                  are and where you must be is a distance, not a number. */}
              <TrackRule
                value={overall}
                threshold={THRESHOLD}
                tone={overall < THRESHOLD ? "accent" : "neutral"}
                className="bleed mt-6"
              />
            </>
          ) : (
            <p className="mt-5 text-title text-text-3">
              {attendanceState === "gated" ? "Not published yet" : "Unavailable"}
            </p>
          )}
        </Link>

        {/* ---------- 3. WHAT WANTS ATTENTION ---------- */}
        <section className="pt-12">
          {/* The aside slot is for counts, the way every other section on
              every other screen uses it. The action is a real control below. */}
          <div data-reveal>
            <SectionHead aside={feed.length > 0 ? `${feed.length} active` : undefined}>
              Reminders
            </SectionHead>
          </div>
          {feed.length === 0 ? (
            <p data-reveal className="pt-5 text-body text-text-3">
              Nothing needs you right now.
            </p>
          ) : (
            <ul className="mt-5 flex flex-col gap-5">
              {feed.map((r) => (
                <li key={r.id} data-reveal className="flex items-start gap-4">
                  <span
                    aria-hidden
                    className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                      r.tone === "danger"
                        ? "bg-risk"
                        : r.tone === "warning"
                          ? "bg-accent"
                          : "bg-text-3"
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-body text-text-1">{r.title}</span>
                    {r.meta && (
                      <span className="tnum mt-1 block text-callout text-text-3">
                        {r.meta}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ---------- 4. THE REST OF THE DAY ---------- */}
        {later.length > 0 && (
          <section className="pt-12">
            <div data-reveal className="flex items-baseline justify-between">
              <h2 className="text-label uppercase text-text-3">
                {cover.thenLabel}
              </h2>
              <span className="tnum text-label uppercase text-text-3">
                {later.length} more
              </span>
            </div>
            <ul className="mt-7 flex flex-col gap-7">
              {later.map((c) => (
                <li key={c.id} data-reveal className="flex items-baseline gap-5">
                  <span className="tnum w-[74px] shrink-0 text-title text-text-1">
                    {c.start}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body text-text-2">
                      {c.title}
                    </span>
                    <span className="mt-1 block truncate text-callout text-text-3">
                      {[
                        c.abbrev,
                        `until ${c.end}`,
                        c.isCustom ? "Added" : c.room,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

    </>
  );
}

