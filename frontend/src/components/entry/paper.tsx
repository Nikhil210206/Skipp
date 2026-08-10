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
        data-stroke
        d="M3 7 C 48 3, 96 9, 150 5 S 190 6, 197 4"
        fill="none"
        stroke={INK}
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        data-stroke
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
      data-paper
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
  // Three elements, and each one is a single system's to write. The outer is
  // the entrance's (opacity, y), the middle is the drift's (rotation) and the
  // press's (scale), and the note itself keeps its own inline tilt. Collapsing
  // any two of these puts two owners on one transform, which is the trap this
  // codebase keeps rediscovering.
  return (
    <div data-paper className={className}>
      <div data-tilt>
        <div
          className="relative rounded-[10px] px-4 py-3"
          style={{
            background: fill,
            transform: `rotate(${rotate}deg)`,
            // A note lifts off the page at one corner, so the shadow is uneven.
            boxShadow:
              "0 10px 18px -12px rgba(46,16,101,0.45), 0 1px 0 rgba(255,255,255,0.6) inset",
            border: `1px solid ${LILAC_EDGE}`,
          }}
        >
          {children}
        </div>
      </div>
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
  rotate = 0,
  colour = INK,
}: {
  className?: string;
  flip?: boolean;
  /**
   * Degrees, so the mark can be aimed at the thing it is about.
   * A doodle that points at nothing is the worst of both worlds: it carries
   * the weight of an instruction and delivers none, which is exactly how these
   * were reported from a real phone.
   */
  rotate?: number;
  /** The pen. Defaults to the pad's ink; pass the page's so it is one hand. */
  colour?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 60 48"
      className={`absolute ${className}`}
      style={{
        transform: `${flip ? "scaleX(-1) " : ""}${rotate ? `rotate(${rotate}deg)` : ""}`.trim() || undefined,
      }}
    >
      <path
        data-stroke
        d="M6 4 C 30 2, 52 14, 48 40"
        fill="none"
        stroke={colour}
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        data-stroke
        d="M40 30 L48 42 L56 31"
        fill="none"
        stroke={colour}
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

/* ------------------------------------------------------------------ inks */

/**
 * The instruments.
 *
 * A page written entirely in one pen is a page nobody wrote. Real notes are
 * mixed: the heading goes down in marker, the aside in pencil because you were
 * thinking, the label in biro because that was what was to hand. Giving each
 * page ONE colour and several tools is what makes it read as somebody's
 * notebook rather than as a stylesheet.
 *
 * The textures are genuine, not just weights. **Pencil is grain punched out of
 * the letterform** with `background-clip: text`: specks in the paper's own
 * colour eat into the stroke, which is what graphite on tooth actually looks
 * like. Marker bleeds a hair past its edge. Biro is thin and slightly starved,
 * the way a cheap pen goes.
 */
export type Tool = "marker" | "pencil" | "pen" | "fine";

/** Graphite tooth: paper-coloured specks that punch holes in the stroke. */
const GRAIN =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42">
      <filter id="g">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch"/>
        <feColorMatrix type="matrix"
          values="0 0 0 0 0.965  0 0 0 0 0.945  0 0 0 0 0.894  0 0 0 -1.5 1.05"/>
      </filter>
      <rect width="42" height="42" filter="url(#g)"/>
    </svg>`,
  );

export function inkStyle(tool: Tool, colour: string): React.CSSProperties {
  if (tool === "pencil") {
    return {
      // The colour sits under the grain, and the specks are paper, so they read
      // as the sheet showing through the stroke rather than as dust on it.
      backgroundImage: `url("${GRAIN}"), linear-gradient(${colour}, ${colour})`,
      backgroundClip: "text",
      WebkitBackgroundClip: "text",
      color: "transparent",
      // Graphite never quite reaches the darkness of ink.
      opacity: 0.92,
    };
  }
  if (tool === "marker") {
    return {
      color: colour,
      // A hair of bleed past the edge, the way a felt tip sinks into paper.
      textShadow: `0 0 0.6px ${colour}, 0 0 2.5px ${colour}22`,
    };
  }
  if (tool === "pen") {
    return { color: colour, opacity: 0.88 };
  }
  return { color: colour };
}

/**
 * Something written on the page, in a named hand and a named tool.
 *
 * **Numbers never get this.** `Caveat` has no tabular figures, so an attendance
 * percentage set in it jitters as it counts and a fraction like 41 / 60 stops
 * lining up. Figures stay in the app's own face.
 */
export function Ink({
  children,
  tool = "pen",
  colour,
  size = "text-body",
  className = "",
  as: Tag = "span",
}: {
  children: React.ReactNode;
  tool?: Tool;
  colour: string;
  size?: string;
  className?: string;
  as?: "span" | "p" | "h1" | "h2";
}) {
  return (
    <Tag
      data-write
      className={`${size} ${className}`}
      style={{
        fontFamily: "var(--font-hand)",
        fontWeight: tool === "marker" ? 700 : tool === "fine" ? 500 : 600,
        lineHeight: 1.25,
        ...inkStyle(tool, colour),
      }}
    >
      {children}
    </Tag>
  );
}
