"use client";

import { INK } from "./Notebook";

/**
 * The things you put on a page.
 *
 * The pad's stock never changes colour, so all of the deck's colour lives here
 * instead: in the notes stuck to it, the tape holding them down and the ink
 * they are written in. That is what keeps eight pages feeling like one book
 * while still letting each one look like a different afternoon.
 *
 * Everything here tilts a degree or two. Nothing a person sticks on a page is
 * ever square to it, and a perfectly aligned sticky note reads as a div.
 */

/** The lilac of the notes, and the wash behind a highlighted word. */
export const LILAC = "#EADCFB";
export const LILAC_EDGE = "rgba(46,16,101,0.14)";

/**
 * A handwritten heading, with the underline you would actually draw under it.
 *
 * The hand is only ever used here and on the margin notes. A number never gets
 * it: `Caveat` has no tabular figures, so an attendance percentage set in it
 * would jitter as it counts.
 */
export function Hand({
  children,
  size = "text-[2rem]",
  rule = true,
  className = "",
}: {
  children: React.ReactNode;
  size?: string;
  /** The sketched underline. Off for a line that is already the point. */
  rule?: boolean;
  className?: string;
}) {
  return (
    <span className={`relative inline-block ${className}`}>
      <span
        className={`font-hand font-bold leading-[1.1] ${size}`}
        style={{ fontFamily: "var(--font-hand)" }}
      >
        {children}
      </span>
      {rule && <Underline />}
    </span>
  );
}

/**
 * A hand drawn rule. Two overlapping strokes at slightly different lengths,
 * because one clean stroke is a border and nobody underlines like that.
 */
export function Underline({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 12"
      preserveAspectRatio="none"
      className={`absolute -bottom-1 left-0 h-2.5 w-full ${className}`}
    >
      <path
        d="M3 7 C 48 3, 96 9, 150 5 S 190 6, 197 4"
        fill="none"
        stroke={INK}
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M10 10 C 60 7, 110 11, 178 8"
        fill="none"
        stroke={INK}
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.35"
      />
    </svg>
  );
}

/** A strip of washi tape. Slightly translucent, so the rules show through. */
export function Tape({
  className = "",
  rotate = -4,
  width = 62,
}: {
  className?: string;
  rotate?: number;
  width?: number;
}) {
  return (
    <span
      aria-hidden
      className={`absolute block ${className}`}
      style={{
        width,
        height: 22,
        transform: `rotate(${rotate}deg)`,
        background: "rgba(233,214,180,0.75)",
        boxShadow: "0 1px 2px rgba(46,16,101,0.12)",
        // Torn rather than cut: a straight edge reads as a rectangle of colour.
        clipPath:
          "polygon(0 12%, 6% 0, 22% 9%, 44% 2%, 68% 10%, 88% 3%, 100% 11%, 100% 88%, 86% 97%, 62% 90%, 38% 99%, 16% 91%, 4% 98%, 0 87%)",
      }}
    />
  );
}

/**
 * A sticky note. Takes its own tilt so a set of them reads as stuck on one at a
 * time rather than laid out on a grid.
 */
export function Sticky({
  children,
  rotate = -2,
  className = "",
  tone = "lilac",
}: {
  children: React.ReactNode;
  rotate?: number;
  className?: string;
  /** `paper` is a plainer card, for the pages that already have a lot of lilac. */
  tone?: "lilac" | "paper" | "mint";
}) {
  const fill =
    tone === "mint" ? "#DCEFE2" : tone === "paper" ? "#FBF7EC" : LILAC;
  return (
    <div
      className={`relative rounded-[10px] px-4 py-3 ${className}`}
      style={{
        background: fill,
        transform: `rotate(${rotate}deg)`,
        // A note lifts off the page at one corner, so the shadow is not even.
        boxShadow: "0 10px 18px -12px rgba(46,16,101,0.45), 0 1px 0 rgba(255,255,255,0.6) inset",
        border: `1px solid ${LILAC_EDGE}`,
      }}
    >
      {children}
    </div>
  );
}

/** A marker highlight behind a word, the way you would run a pen over it. */
export function Mark({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="relative inline-block px-1"
      style={{
        background: "rgba(234,220,251,0.9)",
        boxDecorationBreak: "clone",
        WebkitBoxDecorationBreak: "clone",
      }}
    >
      {children}
    </span>
  );
}

/** A doodled arrow, for pointing at the thing that matters on the page. */
export function Arrow({
  className = "",
  flip = false,
}: {
  className?: string;
  flip?: boolean;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 60 48"
      className={`absolute ${className}`}
      style={{ transform: flip ? "scaleX(-1)" : undefined }}
    >
      <path
        d="M6 4 C 30 2, 52 14, 48 40"
        fill="none"
        stroke={INK}
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M40 30 L48 42 L56 31"
        fill="none"
        stroke={INK}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
    </svg>
  );
}

/** A four point sparkle. The only ornament, used no more than twice a page. */
export function Star({ className = "", size = 18 }: { className?: string; size?: number }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`absolute ${className}`}
    >
      <path
        d="M12 1 C 13 9, 15 11, 23 12 C 15 13, 13 15, 12 23 C 11 15, 9 13, 1 12 C 9 11, 11 9, 12 1 Z"
        fill={INK}
        opacity="0.35"
      />
    </svg>
  );
}
