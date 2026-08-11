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

/**
 * A strip of tape.
 *
 * **It is torn at the ENDS and straight along the SIDES**, and getting that
 * backwards is what made the first version read as a scrap of tan paper rather
 * than as tape. Tape comes off a roll, so its long edges are the width of the
 * roll: dead straight and parallel. The only rough edges are the two you made
 * yourself, tearing it off. The old clip path did the opposite, ragged along
 * the length and guillotined at the ends, which is the silhouette of a torn
 * strip of paper and of nothing else.
 *
 * **It is stuck down, not laid on.** A drop shadow tight enough to read as
 * contact rather than as float, a sheen down the middle where the plastic
 * catches the light, and a darker line at each long edge where the adhesive
 * gathers. Without those it is a flat rectangle of colour at any geometry.
 *
 * The caller's job is the other half: a piece of tape has to STRADDLE an edge.
 * Half on the note and half on the page is what holds anything down, and tape
 * floating entirely on the paper beside a card is the thing this whole pass was
 * reported for.
 */
export function Tape({
  className = "",
  rotate = -4,
  width = 62,
  height = 24,
}: {
  className?: string;
  rotate?: number;
  width?: number;
  height?: number;
}) {
  return (
    <span
      aria-hidden
      data-paper
      className={`absolute block ${className}`}
      style={{
        width,
        height,
        transform: `rotate(${rotate}deg)`,
        background:
          // Three things at once: the sheen along the top where the plastic
          // catches the light, the adhesive darkening at both long edges, and
          // an alpha low enough that whatever is underneath comes through.
          // **Translucency is not a nicety here.** Every strip in this deck
          // straddles a note, so half of it is over cream and half over a
          // saturated card: an opaque strip reads as a sticker cut to length,
          // and only a strip you can see the card through reads as tape.
          "linear-gradient(to bottom, rgba(120,96,52,0.22) 0 1px, rgba(255,252,244,0.5) 1px 6%, rgba(226,208,171,0.6) 26%, rgba(232,215,180,0.62) 52%, rgba(212,190,150,0.66) 88%, rgba(120,96,52,0.26) calc(100% - 1px) 100%)",
        boxShadow: "0 2px 3px -1px rgba(46,16,101,0.28)",
        // Torn at the two short ends only. The verticals stay put.
        clipPath:
          "polygon(0 0, 4% 14%, 1% 31%, 5% 48%, 1% 66%, 4% 84%, 0 100%, 100% 100%, 96% 85%, 99% 67%, 95% 49%, 99% 32%, 96% 15%, 100% 0)",
      }}
    />
  );
}

/* -------------------------------------------------------- the stationery */

/**
 * The drawer.
 *
 * Tape alone made every page hold its notes down the same way, which is not how
 * a real pad looks: you use whatever is on the desk. A clip on one page, a pin
 * through another, a tack in the corner of a third.
 *
 * **Metal is metal, so these are not drawn in the page's pen.** Everything else
 * in the kit takes the chapter's ink because a person wrote it; a paper clip is
 * an object that was already there, so it stays steel on every sheet and reads
 * as picked up rather than as decoration in the page's colour. The one
 * exception is the tack, whose head is plastic and takes the ink, which is why
 * it is the piece that can sit anywhere without looking borrowed.
 *
 * None of them carries `data-stroke`: that marker draws a path on as though it
 * were being written, and a stapled corner arriving stroke by stroke would look
 * like a doodle of a staple. They take `data-paper` instead, so they drop onto
 * the page and settle, which is how they got there.
 */

/** Steel, lit from the top left on every piece so they agree about the light. */
const STEEL_DARK = "#5C5967";
const STEEL_LIT = "#E4E1EA";

/**
 * A gem clip, biting over an edge.
 *
 * Position it so it STRADDLES whatever it is holding: a clip drawn wholly on a
 * card holds nothing, and one drawn wholly on the page is lying loose. Roughly
 * the top third above the edge and the rest over the note.
 */
export function Clip({
  className = "",
  rotate = -6,
  size = 46,
}: {
  className?: string;
  rotate?: number;
  /** Height in px. The wire's proportions come from the viewBox. */
  size?: number;
}) {
  // One continuous wire: down the outside, round the bottom, up and over the
  // top, back down the inside. Drawn three times, because a single flat stroke
  // is a bent line and not a piece of metal: a shadow cast onto the paper, the
  // wire itself, then a highlight along its lit side.
  const wire =
    "M23.5 68 C23.5 74.5, 12.5 74.5, 12.5 68 L12.5 20 C12.5 11.5, 25.5 11.5, 25.5 20 L25.5 62 C25.5 66.5, 19 66.5, 19 62 L19 26";
  return (
    <span
      aria-hidden
      data-paper
      className={`absolute block ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <svg
        width={size * (38 / 84)}
        height={size}
        viewBox="0 0 38 84"
        fill="none"
      >
        <path
          d={wire}
          stroke="rgba(46,16,101,0.22)"
          strokeWidth="3.6"
          strokeLinecap="round"
          transform="translate(2.2 2.6)"
        />
        <path d={wire} stroke={STEEL_DARK} strokeWidth="3.6" strokeLinecap="round" />
        <path
          d={wire}
          stroke={STEEL_LIT}
          strokeWidth="1.15"
          strokeLinecap="round"
          opacity="0.85"
          transform="translate(-0.75 -0.75)"
        />
      </svg>
    </span>
  );
}

/**
 * A safety pin, closed, pushed through the page.
 *
 * **The shaft breaks where the paper is**, and that break is the whole thing. A
 * pin drawn as one unbroken wire is a pin lying on top of the page; two
 * punctures with nothing between them is a pin that went through it. The guard
 * underneath stays whole, because that half never goes in.
 */
export function Pin({
  className = "",
  rotate = -14,
  size = 78,
}: {
  className?: string;
  rotate?: number;
  /** Width in px. */
  size?: number;
}) {
  return (
    <span
      aria-hidden
      data-paper
      className={`absolute block ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <svg width={size} height={size * (30 / 82)} viewBox="0 0 82 30" fill="none">
        {/* The two slits it went in and came out of, sitting ON the shaft's own
            line. Set even slightly off it they read as two marks beside a pin
            rather than as the holes it went through. */}
        <ellipse
          cx="35.5"
          cy="8.6"
          rx="2.8"
          ry="1.5"
          fill="#2E1065"
          opacity="0.4"
          transform="rotate(-4 35.5 8.6)"
        />
        <ellipse
          cx="51"
          cy="8.6"
          rx="2.8"
          ry="1.5"
          fill="#2E1065"
          opacity="0.4"
          transform="rotate(-4 51 8.6)"
        />

        {/* Cast on the paper, so the pin sits above it rather than in it. */}
        <g transform="translate(1.2 2.2)" opacity="0.13">
          <path
            d="M14 8 L35 8 M51 8 L69 8"
            stroke="#2E1065"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            d="M13 19 L64 19 C71 19, 73 9.5, 66.5 8.6"
            stroke="#2E1065"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <circle cx="11" cy="14" r="7" stroke="#2E1065" strokeWidth="3" />
        </g>

        {/* The spring, the guard, and the shaft in its two visible pieces. */}
        <path
          d="M11.5 7.2 A7 7 0 1 0 11.5 20.8"
          stroke={STEEL_DARK}
          strokeWidth="2.9"
          strokeLinecap="round"
        />
        <path
          d="M11.5 19 L64 19 C70.5 19, 72.5 9.6, 66 8.7"
          stroke={STEEL_DARK}
          strokeWidth="3.1"
          strokeLinecap="round"
        />
        <path
          d="M13.6 8 L35.5 8"
          stroke={STEEL_DARK}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M51 8 L67 8"
          stroke={STEEL_DARK}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* The lit edge, on the same side as every other piece in the drawer. */}
        <path
          d="M12.2 18 L63.6 18 M14.6 7 L34.6 7 M52 7 L66.4 7"
          stroke={STEEL_LIT}
          strokeWidth="0.95"
          strokeLinecap="round"
          opacity="0.8"
        />
      </svg>
    </span>
  );
}

/**
 * A push pin, seen from just off the head.
 *
 * The one piece that takes the page's own colour, because the head is plastic
 * and comes in whatever the box had in it. The barrel and the hard little
 * shadow under it are what stop it reading as a sticker.
 */
export function Tack({
  className = "",
  colour = INK,
  size = 30,
}: {
  className?: string;
  colour?: string;
  size?: number;
}) {
  return (
    <span aria-hidden data-paper className={`absolute block ${className}`}>
      <svg width={size} height={size} viewBox="0 0 34 34" fill="none">
        {/* Short and tight: a tack is pressed flat to the page, so a long soft
            shadow would lift it off. */}
        <ellipse cx="20.5" cy="27" rx="8.5" ry="2.8" fill="#2E1065" opacity="0.26" />
        {/* The barrel, going in. It has to be clearly longer than the dome is
            wide, or the whole thing reads as a balloon on a string. */}
        <path
          d="M16 16 L20.5 26.5"
          stroke={colour}
          strokeWidth="3.6"
          strokeLinecap="round"
          opacity="0.85"
        />
        <circle cx="16" cy="12.5" r="9.2" fill={colour} />
        {/* Where the dome catches the light, and where it turns away. */}
        <path
          d="M16 3.3 A9.2 9.2 0 0 1 24.6 15.6 A9.2 9.2 0 0 0 16 3.3 Z"
          fill="#000"
          opacity="0.16"
        />
        <ellipse
          cx="12.4"
          cy="9"
          rx="3.6"
          ry="2.6"
          fill="#fff"
          opacity="0.5"
          transform="rotate(-28 12.4 9)"
        />
      </svg>
    </span>
  );
}

/**
 * A staple, from the front: the crown, with both legs turning down into the
 * paper at its ends.
 *
 * **The legs are the whole silhouette.** Drawn as a crown alone it is a short
 * grey bar, which at the size a staple actually wants to be is indistinguishable
 * from a dash of pencil. The two turned ends are what make the shape read at a
 * glance, and they are slightly different lengths because a staple that has gone
 * through paper never sits square.
 */
export function Staple({
  className = "",
  rotate = -34,
  size = 30,
}: {
  className?: string;
  rotate?: number;
  /** Width in px. */
  size?: number;
}) {
  const crown = "M5 13.4 L5 8.4 L35 5.4 L35 10.4";
  return (
    <span
      aria-hidden
      data-paper
      className={`absolute block ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <svg width={size} height={size * (18 / 40)} viewBox="0 0 40 18" fill="none">
        <path
          d={crown}
          stroke="#2E1065"
          strokeOpacity="0.22"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          transform="translate(1 2)"
        />
        <path
          d={crown}
          stroke={STEEL_DARK}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6.4 8.2 L33.6 5.5"
          stroke={STEEL_LIT}
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.75"
        />
      </svg>
    </span>
  );
}

/**
 * A sticky note. Takes its own tilt so a set of them reads as stuck on one at a
 * time rather than laid out on a grid.
 *
 * **`className` positions the note; `pad` sets the note's own padding**, and the
 * split is not tidiness. `className` lands on the OUTER element, which is the
 * one a sibling `Tape` is positioned against, so a caller passing `px-5 py-5`
 * meaning "roomier note" instead inset the card 20px inside its own box. The
 * tape then hung about 32px clear of the card it was supposed to be holding
 * down, touching nothing, on both the attendance sheet and the install offer.
 * That is what was reported as the tape not being stuck.
 */
export function Sticky({
  children,
  rotate = -2,
  className = "",
  pad = "px-4 py-3",
  tone = "lilac",
}: {
  children: React.ReactNode;
  rotate?: number;
  /** The outer box: position it here. Anything a `Tape` is measured against. */
  className?: string;
  /** The note's own padding. Never put this in `className`. */
  pad?: string;
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
          className={`relative rounded-[10px] ${pad}`}
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
