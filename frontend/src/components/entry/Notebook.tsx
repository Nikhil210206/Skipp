"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { haptic } from "@/lib/haptics";
import { prefersReducedMotion } from "@/lib/motion";
import { useLockScroll } from "@/components/ui/Overlay";
import { driftPaper, playSheet, pressPaper } from "./handwriting";

/**
 * THE NOTEBOOK.
 *
 * The way in is one spiral bound pad: cream stock, faint rules, a wire down the
 * left edge, and sheets you turn.
 *
 * **On a phone the sheet is INSET from the screen, and that is the whole
 * trick.** A first attempt drew the paper edge to edge and put the coils on top
 * of it, which gave a column of punched holes and no wire: a ring needs
 * somewhere to go behind the paper and come back, and if the paper fills the
 * screen there is no behind. So the desk shows down the left, the sheet starts
 * after it, and each ring is drawn in two halves, one under the sheet and one
 * over it. That, and nothing else, is what makes it read as bound rather than
 * as perforated.
 *
 * **Past `lg` the pad is OPEN, and that is a different object.** A single sheet
 * stretched to a laptop is not a bigger notebook, it is the same notebook
 * zoomed: the writing clusters in the left quarter, an index rule runs five
 * times past its own text, a sticky note becomes a 1400px banner, and the page
 * number ends up a full screen away from the arrow that turns the page. So the
 * wire moves to the MIDDLE and the pad becomes a spread. The left page takes
 * the chapter's contents, the right page takes the enormous word and the
 * controls, and each is a proper measure by construction rather than by a cap.
 *
 * Nothing below `lg` changed: every edit here is behind the breakpoint.
 */

/** Cream stock. Warm enough to read as paper, not as a beige rectangle. */
export const PAPER = "#F6F1E4";
/** The ink everything is written in. */
export const INK = "#2E1065";
/** The desk the pad is lying on, visible only in the strip down the left. */
const DESK = "#E4DACB";

/** Where the sheet's left edge is on a phone. The wire wraps around this line. */
const EDGE = 22;
/** Centre of the punched holes, measured from the screen's left edge. */
const HOLE_X = 40;
/** Where writing starts. Clear of the holes with a margin of its own. */
const TEXT_X = 66;
/** One turn of wire to the next. */
const PITCH = 30;

/** How long a page turn takes. */
const TURN = 0.66;

/**
 * The spread, past `lg`. Distances from the spine and from the outer edges.
 *
 * **The pitch is wider than the shut pad's and the bars are steep, and both
 * numbers are load bearing.** A first pass reused the 30px pitch with a bar
 * that rose only 14px across the gutter: nearly flat bars stacked that close
 * merge into one striped band and the binding reads as a zip fastener. A coil
 * crossing an open pad climbs roughly one full turn per turn, so the rise is
 * most of the pitch, and that is what separates the bars into a helix.
 */
const SPREAD_HOLE = 21;
const SPREAD_PITCH = 34;
const SPREAD_RISE = 22;
const SPREAD_TILE = SPREAD_HOLE * 2 + 22;
/** The outer margin of each page, and the inner one that clears the wire. */
const PAGE_OUT = 72;
const PAGE_IN = 84;

/** Everything past this width is a spread. Matches Tailwind's `lg`. */
const SPREAD_QUERY = "(min-width: 1024px)";
const isSpread = () => window.matchMedia(SPREAD_QUERY).matches;

/**
 * The feint, shared by the page and by the clone that turns.
 *
 * It has to be a string rather than a component, because the turning page is a
 * `cloneNode` appended to the body: it takes the paper with it, so the paper
 * has to be something that can be written onto an element.
 */
const FEINT =
  "repeating-linear-gradient(to bottom, transparent 0 33px, rgba(46,16,101,0.05) 33px 34px)";

export default function Notebook({
  page,
  total,
  children,
  onNext,
  onBack,
  onSkip,
  word,
  ink = INK,
  actionLabel,
  mark,
  last = false,
}: {
  /** 1 based, for the number in the corner. */
  page: number;
  total: number;
  /** The enormous word along the bottom of the sheet. */
  word: string;
  /** The pen this page is written in. The word and the controls take it too. */
  ink?: string;
  /**
   * Give the way on a name, and it is written out instead of drawn as the
   * round arrow. For a sheet whose action is not simply "the next page".
   */
  actionLabel?: string;
  /**
   * One object for the right page of the spread, positioned absolutely.
   *
   * A title page in a real pad is where the stationery ends up, because it is
   * the page with room on it. It is passed in rather than drawn here for two
   * reasons: no two chapters should be held down the same way, and this shell
   * must not import the paper kit, which imports it back. That cycle has
   * already taken this deck to the error boundary once.
   */
  mark?: React.ReactNode;
  children: React.ReactNode;
  onNext: () => void;
  onBack?: () => void;
  onSkip?: () => void;
  /** The last sheet signs off rather than pointing on. */
  last?: boolean;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const pageL = useRef<HTMLDivElement>(null);
  const pageR = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLDivElement>(null);
  const turning = useRef(false);

  useLockScroll(true);

  // Safari tints the bands around the web view from `theme-color` and from the
  // page canvas, and the canvas is `body`, so the pad claims all three or it
  // sits inside two strips of the app's near black.
  useLayoutEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", DESK);
    document.documentElement.style.backgroundColor = DESK;
    document.body.style.backgroundColor = DESK;
  }, []);

  /**
   * Fit the chapter word to the sheet.
   *
   * A fixed clamp cannot do this, because it cannot know how long the next word
   * is: "SKIPP" and "YOUR LOOK" want very different sizes, and the short ones
   * should get the full display size rather than being cut down to whatever the
   * longest one can bear.
   *
   * Three things it has to get right, the first two found by measuring at 320:
   *
   * - **Measured against the heading's own content box**, never the parent's
   *   `clientWidth`, which includes the page's left and right margins and so
   *   grants the word about 70px it does not have.
   * - **Measured again once the hand has loaded.** A layout effect runs while
   *   Caveat is still a fallback face, and the fallback is narrower, so a word
   *   that will overflow measures as fitting and is never shrunk at all.
   * - **The words are measured, not the box.** On the spread each word is its
   *   own line, so the width to beat is the LONGEST of them, not their sum; on
   *   a phone they share one line, so it is the sum. `scrollWidth` cannot tell
   *   the two apart and is useless inside `overflow-hidden` anyway, which is
   *   the trap the entry chapters already recorded: it reports the clipped
   *   width, so nothing ever measures as too wide.
   */
  useLayoutEffect(() => {
    const h = heading.current;
    if (!h) return;
    let alive = true;
    const fit = () => {
      if (!alive) return;
      // Cleared back to the class size, never to nothing: the size lives in the
      // className precisely so this line cannot delete it.
      h.style.fontSize = "";
      const avail = h.clientWidth;
      const parts = [...h.querySelectorAll("span")].map(
        (s) => s.getBoundingClientRect().width,
      );
      if (!parts.length || avail <= 0) return;
      const natural = isSpread()
        ? Math.max(...parts)
        : parts.reduce((a, w) => a + w, 0);
      if (natural > avail) {
        const base = parseFloat(getComputedStyle(h).fontSize);
        h.style.fontSize = `${Math.floor(base * (avail / natural))}px`;
      }
    };
    fit();
    document.fonts.ready.then(fit);
    window.addEventListener("resize", fit);
    return () => {
      alive = false;
      window.removeEventListener("resize", fit);
    };
  }, [word]);

  /**
   * Write the sheet on, every time the page changes.
   *
   * Keyed on `page` rather than run once: the three screens that make up the
   * pad are separate components, but the six chapters are ONE component whose
   * contents swap, so a mount-only entrance would play for chapter one and
   * never again.
   *
   * It deliberately starts as the new sheet mounts, which is 46% through the
   * turn, so the writing is already under way when the turning sheet lifts off
   * it. The alternative, waiting for the turn to finish, is the mistake this
   * project already made once and reverted: an arrival that glides in and then
   * sits there before anything moves reads as dead.
   */
  useLayoutEffect(() => {
    const el = sheet.current;
    if (!el) return;
    let release = () => {};
    const ctx = gsap.context(() => {
      playSheet(el);
      driftPaper(el);
      release = pressPaper(el);
    }, el);
    return () => {
      release();
      ctx.revert();
    };
  }, [page]);

  /**
   * Turn the sheet, then change the page.
   *
   * The clone is what turns, and it is appended to `document.body` rather than
   * animated in place. React only ever has one page mounted and the pages are
   * separate components, so a sheet animated inside the tree is torn out mid
   * rotation the moment its owner unmounts. Out on the body it finishes its
   * turn while the next page mounts underneath it.
   *
   * **On the spread only ONE page turns, which is what a page turn is.** Going
   * on, the right page lifts and falls to the left across the spine; going
   * back, the left page comes the other way. The page that stays put swaps its
   * contents underneath, and that is not a compromise: the sheet's entrance
   * writes the new page on line by line, so what you see beside the turning
   * leaf is the next page being written, which is the effect this deck is
   * built on everywhere else.
   */
  const turn = useCallback((dir: 1 | -1, then: () => void) => {
    const el = sheet.current;
    haptic("tick");
    if (!el || prefersReducedMotion()) {
      then();
      return;
    }
    if (turning.current) return;

    // The leaf that moves: one page of the spread, or the whole pad on a phone,
    // where there is only ever one page to turn.
    const spread = isSpread();
    const leaf = spread ? (dir === 1 ? pageR.current : pageL.current) : el;
    if (!leaf) {
      then();
      return;
    }
    turning.current = true;

    const box = leaf.getBoundingClientRect();
    const stage = document.createElement("div");
    stage.style.cssText =
      "position:fixed;inset:0;z-index:60;pointer-events:none;perspective:1500px";
    const clone = leaf.cloneNode(true) as HTMLElement;
    clone.style.position = "fixed";
    clone.style.left = `${box.left}px`;
    clone.style.top = `${box.top}px`;
    clone.style.width = `${box.width}px`;
    clone.style.height = `${box.height}px`;
    clone.style.margin = "0";
    // A page carries no paper of its own: the pad under it does. The clone is
    // off on the body with nothing beneath it, so it has to bring the stock and
    // the feint with it or it turns over as a pane of glass.
    if (spread) {
      clone.style.background = `${FEINT}, ${PAPER}`;
      clone.style.backgroundPositionY = "14px";
      clone.style.overflow = "hidden";
    }
    // Hinged on the wire, so the leaf swings about the binding and never about
    // its own middle: on the spread that is the spine, which is the page's
    // inner edge and therefore a different edge for each direction.
    clone.style.transformOrigin = spread
      ? dir === 1
        ? "0 center"
        : "100% center"
      : dir === 1
        ? `${EDGE}px center`
        : `${box.width - 8}px center`;
    stage.appendChild(clone);
    document.body.appendChild(stage);

    let swapped = false;
    const tl = gsap.timeline({
      onComplete: () => {
        stage.remove();
        turning.current = false;
      },
    });

    tl.to(clone, {
      rotateY: dir === 1 ? -172 : 172,
      duration: TURN,
      ease: "power2.inOut",
      onUpdate() {
        // Swapped while the sheet is edge on: any earlier and the incoming
        // page is visible through the turning one.
        if (!swapped && this.progress() > 0.46) {
          swapped = true;
          then();
        }
      },
    });
    // The lift. A sheet rises off the pad before it falls, and the shadow
    // travelling with it is most of what sells the third dimension.
    tl.to(
      clone,
      {
        boxShadow: "26px 24px 54px -20px rgba(46,16,101,0.5)",
        duration: TURN * 0.45,
        ease: "power2.out",
        yoyo: true,
        repeat: 1,
      },
      0,
    );
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      style={{ background: DESK, minHeight: "100dvh", perspective: "1500px" }}
    >
      {/* The pad. Inset from the left on a phone so the wire has an edge to
          wrap; edge to edge past `lg`, where the wire runs down the middle and
          the two halves are facing pages. */}
      <div
        ref={sheet}
        className="absolute inset-y-0 left-[22px] right-0 flex flex-col lg:left-0 lg:grid lg:grid-cols-2"
        style={{
          background: PAPER,
          color: INK,
          transformStyle: "preserve-3d",
          boxShadow: "-1px 0 0 rgba(46,16,101,0.10), 3px 0 14px -6px rgba(46,16,101,0.18)",
          // One value, two pages: the top margin that keeps the first thing on
          // a sheet clear of the notch and of the Skip control, and the two
          // margins the spread's pages are set to.
          ["--page-top" as string]: "max(58px, calc(env(safe-area-inset-top) + 44px))",
          ["--page-out" as string]: `${PAGE_OUT}px`,
          ["--page-in" as string]: `${PAGE_IN}px`,
        }}
      >
        {/* On a phone one feint runs the height of the pad. On the spread each
            page rules itself, because a page is what turns, and a leaf cloned
            off a pad that owns the paper turns over blank. */}
        <div className="lg:hidden">
          <Rules margin={TEXT_X - EDGE - 16} />
        </div>

        {onSkip && (
          <button
            onClick={onSkip}
            className="absolute right-[var(--gutter)] top-[max(16px,env(safe-area-inset-top))] z-30 -mr-2 inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-callout opacity-60 transition-opacity hover:opacity-100 lg:right-[var(--page-out)] lg:mr-0"
          >
            Skip
          </button>
        )}

        {/* THE LEFT PAGE: whatever this chapter is made of.

            **The children stay DIRECT children of this box**, with only the
            zero-height feint before them. Every chapter is written as a
            `h-full` column, and `height: 100%` needs a parent with a definite
            height: wrapping them in an intermediate div gave them an auto
            height parent instead and collapsed the lot. This box has a definite
            height in both layouts, as a flex child on a phone and a stretched
            grid item on the spread, so it is the one they have to sit in. */}
        <div
          ref={pageL}
          // `md:max-w` is the tablet band's answer to the same complaint the
          // spread answers past `lg`: between about 768 and 1023 the pad is one
          // page a thousand pixels wide, and without a measure an index rule
          // runs five times past its own text again. A wide page with a column
          // of writing and a wide right margin is what a real one looks like.
          className="relative z-10 min-h-0 flex-1 overflow-hidden pl-[44px] pr-[var(--gutter)] pt-[var(--page-top)] md:max-w-[38rem] lg:col-start-1 lg:max-w-none lg:pl-[var(--page-out)] lg:pr-[var(--page-in)]"
        >
          <div className="hidden lg:block">
            <Rules margin={PAGE_OUT - 18} />
          </div>
          {children}
        </div>

        {/* THE RIGHT PAGE: the enormous word and the controls. On a phone these
            are simply the foot of the one sheet, which is why the wrapper is
            inert until `lg` gives it a column of its own. */}
        <div
          ref={pageR}
          // Capped with the page above it on a tablet, so the page number and
          // the arrow that turns the sheet stay within reach of each other
          // instead of sitting at opposite ends of a thousand pixels.
          className="relative z-20 shrink-0 md:max-w-[38rem] lg:col-start-2 lg:flex lg:min-h-0 lg:max-w-none lg:flex-col lg:overflow-hidden lg:pt-[var(--page-top)]"
        >
          <div className="hidden lg:block">
            <Rules margin={PAGE_IN - 18} />
          </div>
          {mark && (
            <div className="pointer-events-none absolute inset-0 z-20 hidden lg:block">
              {mark}
            </div>
          )}

          {/* The enormous word. It is the deck's oldest device and the thing
              that makes a sheet feel like a chapter rather than a slide, so it
              survived the move onto paper: same position, written by hand.

              On the spread it floats on `my-auto` rather than being pinned to
              the foot: a page whose only object sits along its bottom edge is a
              page with a screen of nothing above it, which is the fault this
              whole layout exists to fix. Auto margins and not `justify-center`,
              for the reason recorded twice already in this deck: a flex
              container treats them as zero once free space goes negative, so a
              word too tall for the page top aligns instead of pushing its own
              head off it. */}
          <div
            className="relative z-20 shrink-0 overflow-hidden pl-[44px] pr-[var(--gutter)] lg:my-auto lg:pl-[var(--page-in)] lg:pr-[var(--page-out)]"
          >
            <div
              ref={heading}
              data-headline
              // One line on a phone, one word per line on the spread, where the
              // word is the right page's whole reason to exist and a single
              // line of it reads as a caption along the foot. The fit above
              // owns the ceiling either way, so a long word comes back down
              // rather than running off the page.
              className="whitespace-nowrap text-[4.2rem] leading-[0.92] md:text-[5.4rem] lg:whitespace-normal lg:text-[10rem] lg:leading-[0.82]"
              style={{
                fontFamily: "var(--font-hand)",
                fontWeight: 700,
                color: ink,
                textShadow: `0 0 0.6px ${ink}`,
              }}
            >
              {word.split(" ").map((part, i) => (
                <span key={i} className="whitespace-pre lg:block lg:w-fit">
                  {i > 0 ? " " : ""}
                  {part}
                </span>
              ))}
            </div>
          </div>

        <div
          className="relative z-20 mt-1 shrink-0 pb-[max(16px,env(safe-area-inset-bottom))] pl-[44px] pr-[var(--gutter)] pt-1 lg:pb-[max(30px,env(safe-area-inset-bottom))] lg:pl-[var(--page-in)] lg:pr-[var(--page-out)]"
        >
          {/* A sheet that names its own way on gets a written control instead
              of the round one. The install offer is the case: an arrow there
              read as "next slide" on a page whose whole point is that you might
              leave and come back, so it says what it does. */}
          {actionLabel && (
            <button
              onClick={() => turn(1, onNext)}
              className="mb-2.5 mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full px-6 transition-transform duration-200 active:scale-[0.97]"
              style={{ background: ink, color: PAPER }}
            >
              <span
                style={{ fontFamily: "var(--font-hand)", fontWeight: 700 }}
                className="text-[1.2rem]"
              >
                {actionLabel}
              </span>
            </button>
          )}

          <div className="flex items-center gap-3">
            <span className="tnum text-label tabular-nums opacity-40">
              {String(page).padStart(2, "0")}
            </span>
            <Rail page={page} total={total} ink={ink} />
            <span className="ml-auto flex shrink-0 items-center gap-2">
              {onBack && page > 1 && (
                <button
                  onClick={() => turn(-1, onBack)}
                  aria-label="Back"
                  className="grid size-[44px] place-items-center transition-transform duration-200 active:scale-90"
                >
                  <PenArrow ink={ink} back />
                </button>
              )}
              {!actionLabel && (
                <button
                  onClick={() => turn(1, onNext)}
                  aria-label={last ? "Sign in" : "Next"}
                  className="grid size-[54px] place-items-center transition-transform duration-200 active:scale-90"
                >
                  <PenArrow ink={ink} tick={last} ringed />
                </button>
              )}
            </span>
          </div>
        </div>
        </div>
      </div>

      {/* The binding, drawn last so its front halves lie over the paper. Which
          one depends entirely on whether the pad is shut or open. */}
      <Wire />
      <Spine />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The feint, and the margin rule where the writing starts.
 *
 * Faint on purpose. Real ruled paper is darker, but real ruled paper also has
 * handwriting on it rather than 13px type, and a rule crossing an x-height at
 * full strength is the quickest way to make a page unreadable.
 *
 * The margin's position is passed in because the spread's two pages start their
 * writing at different distances from their own left edges: the left page is
 * measured from the outside of the pad, the right page from the spine.
 */
function Rules({ margin }: { margin: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ backgroundImage: FEINT, backgroundPositionY: "14px" }}
      />
      <div
        className="absolute inset-y-0"
        style={{ left: margin, width: 1, background: "rgba(196,74,96,0.22)" }}
      />
    </div>
  );
}

/**
 * The binding.
 *
 * Each coil is drawn TWICE: a back half behind the sheet, and a front half over
 * it, with the punched hole in between. Drawing the whole ring on one side is
 * what produced a row of holes and no wire, because a ring that never passes
 * behind anything is just a line lying on the page.
 */
function Wire() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden"
    >
      {/* Behind: the half of each ring that disappears under the sheet. It is
          painted first and the sheet covers most of it, leaving the bit that
          shows on the desk. */}
      <div
        className="absolute inset-y-0 left-0 -z-10"
        style={{
          width: HOLE_X + 30,
          backgroundImage: `url("${COIL_BACK}")`,
          backgroundRepeat: "repeat-y",
          backgroundSize: `${HOLE_X + 30}px ${PITCH}px`,
        }}
      />
      {/* In front: the half that lies over the paper, ending in the hole. */}
      <div
        className="absolute inset-y-0 left-0 z-30"
        style={{
          width: HOLE_X + 30,
          backgroundImage: `url("${COIL_FRONT}")`,
          backgroundRepeat: "repeat-y",
          backgroundSize: `${HOLE_X + 30}px ${PITCH}px`,
        }}
      />
    </div>
  );
}

/**
 * The binding of an OPEN pad, which is a different drawing entirely.
 *
 * Lying flat and open, you do not see rings looping around an edge: you see the
 * coil crossing the gutter as a row of diagonal bars, each rising from a hole
 * punched in the left page to the next hole in the right page. So the tile is
 * one bar and two holes, and the bar's ends are covered by the holes, which is
 * how a wire that passes THROUGH the paper has to be drawn.
 *
 * The crease matters as much as the wire. Two pages of a bound pad curve down
 * into the spine, so each carries a gradient darkening toward the middle. Take
 * that away and the spread reads as two rectangles that happen to be adjacent.
 */
function Spine() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-30 hidden overflow-hidden lg:block"
    >
      {/* The crease: the paper turning away on both sides of the middle. It has
          to be deep enough for the wire to sit IN something, or the coil is a
          row of bars lying on a flat sheet. */}
      <div
        className="absolute inset-y-0 left-1/2 -translate-x-1/2"
        style={{
          width: 104,
          background:
            "linear-gradient(to right, rgba(46,16,101,0) 0%, rgba(46,16,101,0.035) 32%, rgba(46,16,101,0.09) 46%, rgba(46,16,101,0.14) 50%, rgba(46,16,101,0.09) 54%, rgba(46,16,101,0.035) 68%, rgba(46,16,101,0) 100%)",
        }}
      />
      {/* The outer edges of the block of paper underneath, which is what says
          this is a pad lying open rather than one flat sheet. */}
      <div
        className="absolute inset-y-0 left-0 w-3"
        style={{
          background:
            "linear-gradient(to right, rgba(46,16,101,0.13), rgba(46,16,101,0))",
        }}
      />
      <div
        className="absolute inset-y-0 right-0 w-3"
        style={{
          background:
            "linear-gradient(to left, rgba(46,16,101,0.13), rgba(46,16,101,0))",
        }}
      />
      <div
        className="absolute inset-y-0 left-1/2 -translate-x-1/2"
        style={{
          width: SPREAD_TILE,
          backgroundImage: `url("${COIL_OPEN}")`,
          backgroundRepeat: "repeat-y",
          backgroundSize: `${SPREAD_TILE}px ${SPREAD_PITCH}px`,
        }}
      />
    </div>
  );
}

const W = HOLE_X + 24;

/**
 * The loop, out on the desk.
 *
 * It carries on to the right past the paper's edge, and the sheet simply covers
 * that part, which is what gives the wire something to disappear behind. A ring
 * that stops at the edge reads as a hook, not as a binding.
 */
const COIL_BACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${PITCH}">
      <path d="M26 7 C 12 3, 2 8, 3 15 C 4 23, 14 26, 30 21"
            fill="none" stroke="#8F849C" stroke-width="4.4" stroke-linecap="round"/>
    </svg>`,
  );

/**
 * The lit half of the loop, over the sheet, plus the hole it dives into.
 *
 * The hole is drawn here rather than with the paper so it always sits on top of
 * the back half of the wire and under the front half, which is the stacking a
 * real punched ring has.
 */
const COIL_FRONT =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${PITCH}">
      <defs>
        <linearGradient id="m" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#CFC6DA"/>
          <stop offset="0.4" stop-color="#7E7290"/>
          <stop offset="1" stop-color="#4A4056"/>
        </linearGradient>
      </defs>
      <ellipse cx="${HOLE_X}" cy="16" rx="4.6" ry="4.1" fill="#2E1065" opacity="0.26"/>
      <ellipse cx="${HOLE_X}" cy="17.2" rx="4.6" ry="4.1" fill="#FFFCF4" opacity="0.92"/>
      <path d="M${HOLE_X} 16 L 24 7" fill="none" stroke="url(%23m)"
            stroke-width="4.4" stroke-linecap="round"/>
      <path d="M${HOLE_X - 3} 14.4 L 25 6.6" fill="none" stroke="#E6E0EE"
            stroke-width="1.1" stroke-linecap="round" opacity="0.75"/>
    </svg>`,
  );

/**
 * One bar of the open pad's coil, with the hole at each end it dives into.
 *
 * Drawn in the order a real one is stacked: the shadow the bar throws on the
 * paper, then the bar, then its lit edge, then the two punched holes OVER the
 * bar's ends. Putting the holes last is the whole of it, because a wire whose
 * tip stops short of a hole is a wire lying on the page.
 */
const COIL_OPEN = (() => {
  const cx = SPREAD_TILE / 2;
  const lx = cx - SPREAD_HOLE;
  const rx = cx + SPREAD_HOLE;
  /** The bar's low end (left page) and high end (right page). */
  const ly = SPREAD_PITCH - 7;
  const ry = ly - SPREAD_RISE;
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${SPREAD_TILE}" height="${SPREAD_PITCH}">
      <defs>
        <linearGradient id="o" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stop-color="#3B3346"/>
          <stop offset="0.5" stop-color="#726781"/>
          <stop offset="1" stop-color="#B0A6BE"/>
        </linearGradient>
      </defs>
      <path d="M${lx} ${ly + 2.6} L ${rx} ${ry + 2.6}" fill="none" stroke="#2E1065"
            stroke-opacity="0.15" stroke-width="5" stroke-linecap="round"/>
      <path d="M${lx} ${ly} L ${rx} ${ry}" fill="none" stroke="url(%23o)"
            stroke-width="4.2" stroke-linecap="round"/>
      <path d="M${lx + 4} ${ly - 1.6} L ${rx - 4} ${ry - 1.6}" fill="none"
            stroke="#EFEBF4" stroke-width="1" stroke-linecap="round" opacity="0.55"/>
      <ellipse cx="${lx}" cy="${ly - 1}" rx="4.6" ry="4" fill="#2E1065" opacity="0.28"/>
      <ellipse cx="${lx}" cy="${ly + 0.4}" rx="4.6" ry="4" fill="#FBF6E9" opacity="0.95"/>
      <ellipse cx="${rx}" cy="${ry - 1}" rx="4.6" ry="4" fill="#2E1065" opacity="0.28"/>
      <ellipse cx="${rx}" cy="${ry + 0.4}" rx="4.6" ry="4" fill="#FBF6E9" opacity="0.95"/>
    </svg>`,
    )
  );
})();

/**
 * How far through the pad you are, in the page's own pen.
 *
 * **`min-w-0 flex-1`, so the rungs give way rather than the row.** Sized to its
 * own content, an eight rung rail plus the number and both controls measured
 * 261px against the 232px a 320 wide phone has, and the overflow pushed the
 * advance 2px off the screen edge. A progress rail is the one thing here that
 * can afford to lose a pixel per rung.
 */
function Rail({ page, total, ink }: { page: number; total: number; ink: string }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1.5" aria-hidden>
      {Array.from({ length: total }, (_, k) => (
        <span
          key={k}
          className="block h-[2px] rounded-full transition-all duration-500 ease-out"
          style={{
            width: k === page - 1 ? 20 : 7,
            background: k === page - 1 ? ink : INK,
            opacity: k === page - 1 ? 0.9 : 0.2,
          }}
        />
      ))}
    </span>
  );
}

/**
 * The way on, drawn rather than rendered.
 *
 * A filled disc with a geometric chevron was reported as not suiting the pad,
 * and it did not: it was the one object on a page of handwriting that looked
 * like a piece of app furniture, and it was the same deep purple on every
 * sheet, so it clashed with the teal and the green.
 *
 * So it is **circled in the page's own pen**, the way you would ring the thing
 * to do next in a notebook. The ring is a single path with unequal curves and a
 * deliberate overshoot at the join, because a true circle reads as a border.
 * Nothing is filled, which is what keeps it ink rather than a button, and the
 * whole mark takes `ink` so every sheet's control matches its writing.
 */
function PenArrow({
  ink,
  back = false,
  tick = false,
  ringed = false,
}: {
  ink: string;
  back?: boolean;
  tick?: boolean;
  ringed?: boolean;
}) {
  const size = ringed ? 54 : 44;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 54 54"
      fill="none"
      aria-hidden
      style={{ transform: back ? "scaleX(-1)" : undefined }}
    >
      {/* The ring, drawn as one stroke that starts and finishes past itself. */}
      <path
        data-stroke
        d="M34 6.5 C 47 9, 51.5 19, 50 29 C 48.4 40, 39 48.5, 26 48.5
           C 14 48.5, 4.5 41, 4 30 C 3.5 18.5, 13 6.5, 27.5 5.6
           C 33 5.3, 38 6.4, 41 8.2"
        stroke={ink}
        strokeWidth={ringed ? 2.4 : 1.9}
        strokeLinecap="round"
        opacity={ringed ? 0.9 : 0.42}
      />
      {tick ? (
        <path
          data-stroke
          d="M17 27.5 L 24.5 35.5 L 38 19"
          stroke={ink}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <>
          {/* The shaft rides up a touch, the way a hand draws it. */}
          <path
            data-stroke
            d="M16 28.4 C 23 27.8, 30 27.2, 36.5 26.6"
            stroke={ink}
            strokeWidth={ringed ? 3 : 2.4}
            strokeLinecap="round"
            opacity={ringed ? 1 : 0.75}
          />
          <path
            data-stroke
            d="M30.5 20.8 L 37.5 26.5 L 31.5 33"
            stroke={ink}
            strokeWidth={ringed ? 3 : 2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={ringed ? 1 : 0.75}
          />
        </>
      )}
    </svg>
  );
}
