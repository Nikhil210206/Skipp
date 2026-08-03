"use client";

import EntryChapter, { ACCENT, Advance, CREAM } from "./entry/EntryChapter";
import { Wordmark } from "./Logo";

/**
 * The first thing a new student ever sees, after the launch.
 *
 * Its only job is to say hello and say what Skipp is. It asks for nothing: the
 * install offer is the screen after this one, and the sign in is three after,
 * so putting a decision here would make the very first impression a demand.
 *
 * **The room is warm, and it is the only warm one in the whole entry deck.**
 * Every onboarding chapter is cool (indigo, teal, green, navy, purple, black),
 * so opening here and moving to the install screen's deep ocean reads as
 * walking somewhere, which is the point of giving each screen a field at all.
 *
 * The stage is the app's own surfaces, scattered rather than fanned. Chapter
 * one of the deck fans three cards from a single stack; these sit apart at
 * different depths with the real one in front, so the two are the same family
 * without being the same picture.
 */

const FIELD = "#331206";

export default function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <EntryChapter
      field={FIELD}
      eyebrow="know before you bunk"
      word="HELLO"
      actions={
        <div data-in className="flex items-center justify-between gap-4">
          <p className="min-w-0 flex-1 text-callout leading-relaxed opacity-70">
            Your attendance, marks and timetable, read from your own SRM
            account.
          </p>
          <Advance onClick={onNext} label="Continue" field={FIELD} />
        </div>
      }
    >
      <Stage />
    </EntryChapter>
  );
}

/* -------------------------------------------------------------------------- */

function Stage() {
  return (
    <div
      className="flex h-full items-center justify-center px-[var(--gutter)]"
      style={{ perspective: 1100 }}
    >
      <div
        className="relative h-[330px] w-full max-w-[340px]"
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* The wordmark, set in the room's own cream, so the brand is stated
            once and properly before anything is asked of anyone. */}
        <p
          data-in
          className="absolute inset-x-0 top-0 text-center"
          style={{ transform: "translate3d(0,0,90px)" }}
        >
          <Wordmark className="text-[2.6rem] font-bold" />
        </p>

        {/* A held figure, tilted back and to the left. */}
        <div
          data-in
          className="absolute left-0 top-[86px] rounded-[22px] px-5 py-4"
          style={{
            background: "rgba(247,243,236,0.10)",
            transform: "translate3d(0,0,10px) rotate(-7deg)",
          }}
        >
          <p className="tnum text-title leading-none">41 / 60</p>
          <p className="mt-1.5 text-callout opacity-60">on track for B plus</p>
        </div>

        {/* The one real surface, in front and barely turned: the whole product
            in a single object, a figure and the line it must stay above. */}
        <div
          data-in
          className="absolute inset-x-0 top-[150px] rounded-[26px] px-6 py-6"
          style={{
            background: CREAM,
            color: FIELD,
            transform: "translate3d(0,0,80px) rotate(-2deg)",
            boxShadow: "0 40px 70px -28px rgba(0,0,0,0.7)",
          }}
        >
          <p className="text-label uppercase tracking-[0.16em] opacity-50">
            Term to date
          </p>
          <p
            className="tnum mt-2 font-bold leading-[0.82]"
            style={{ fontSize: "clamp(3rem,17vw,4.25rem)", letterSpacing: "-0.05em" }}
          >
            97.7<span className="text-title align-top opacity-40">%</span>
          </p>

          {/* The rule and its tick, the app's own device. The alpha sits on a
              SIBLING track, never on this element: a child cannot be more
              opaque than its parent, so a faded wrapper would drag the fill
              down with it and the meter would read as full at every value. */}
          <div className="relative mt-5 h-[4px] w-full">
            <span
              className="absolute inset-0 rounded-full"
              style={{ background: FIELD, opacity: 0.18 }}
            />
            <span
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: "97.7%", background: FIELD }}
            />
            <span
              className="absolute"
              style={{ left: "75%", top: -7, width: 2, height: 18, background: ACCENT }}
            />
          </div>

          <div className="mt-4 flex items-baseline justify-between gap-4">
            <p className="text-callout opacity-60">Every subject clear</p>
            <p className="tnum text-headline font-semibold">3 in hand</p>
          </div>
        </div>
      </div>
    </div>
  );
}
