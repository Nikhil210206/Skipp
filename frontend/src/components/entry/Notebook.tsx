"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { haptic } from "@/lib/haptics";
import { prefersReducedMotion } from "@/lib/motion";
import { useLockScroll } from "@/components/ui/Overlay";

/**
 * THE NOTEBOOK.
 *
 * The way in is one spiral bound pad: cream stock, faint rules, a wire down the
 * left edge, and sheets you turn.
 *
 * **The sheet is INSET from the screen, and that is the whole trick.** A first
 * attempt drew the paper edge to edge and put the coils on top of it, which
 * gave a column of punched holes and no wire: a ring needs somewhere to go
 * behind the paper and come back, and if the paper fills the screen there is no
 * behind. So the desk shows down the left, the sheet starts after it, and each
 * ring is drawn in two halves, one under the sheet and one over it. That, and
 * nothing else, is what makes it read as bound rather than as perforated.
 */

/** Cream stock. Warm enough to read as paper, not as a beige rectangle. */
export const PAPER = "#F6F1E4";
/** The ink everything is written in. */
export const INK = "#2E1065";
/** The desk the pad is lying on, visible only in the strip down the left. */
const DESK = "#E4DACB";

/** Where the sheet's left edge is. The wire wraps around this line. */
const EDGE = 22;
/** Centre of the punched holes, measured from the screen's left edge. */
const HOLE_X = 40;
/** Where writing starts. Clear of the holes with a margin of its own. */
const TEXT_X = 66;
/** One turn of wire to the next. */
const PITCH = 30;

/** How long a page turn takes. */
const TURN = 0.66;

export default function Notebook({
  page,
  total,
  children,
  onNext,
  onBack,
  onSkip,
  word,
  ink = INK,
  last = false,
}: {
  /** 1 based, for the number in the corner. */
  page: number;
  total: number;
  /** The enormous word along the bottom of the sheet. */
  word: string;
  /** The pen this page is written in. The word takes it too. */
  ink?: string;
  children: React.ReactNode;
  onNext: () => void;
  onBack?: () => void;
  onSkip?: () => void;
  /** The last sheet signs off rather than pointing on. */
  last?: boolean;
}) {
  const sheet = useRef<HTMLDivElement>(null);
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
   * Two things it has to get right, both found by measuring at 320:
   *
   * - **Measured against the heading's own content box**, never the parent's
   *   `clientWidth`, which includes the page's left and right margins and so
   *   grants the word about 70px it does not have.
   * - **Measured again once the hand has loaded.** A layout effect runs while
   *   Caveat is still a fallback face, and the fallback is narrower, so a word
   *   that will overflow measures as fitting and is never shrunk at all.
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
      const natural = h.scrollWidth;
      if (natural > avail && avail > 0) {
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
   * Turn the sheet, then change the page.
   *
   * The clone is what turns, and it is appended to `document.body` rather than
   * animated in place. React only ever has one page mounted and the pages are
   * separate components, so a sheet animated inside the tree is torn out mid
   * rotation the moment its owner unmounts. Out on the body it finishes its
   * turn while the next page mounts underneath it.
   */
  const turn = useCallback((dir: 1 | -1, then: () => void) => {
    const el = sheet.current;
    haptic("tick");
    if (!el || prefersReducedMotion()) {
      then();
      return;
    }
    if (turning.current) return;
    turning.current = true;

    const box = el.getBoundingClientRect();
    const stage = document.createElement("div");
    stage.style.cssText =
      "position:fixed;inset:0;z-index:60;pointer-events:none;perspective:1500px";
    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.position = "fixed";
    clone.style.left = `${box.left}px`;
    clone.style.top = `${box.top}px`;
    clone.style.width = `${box.width}px`;
    clone.style.height = `${box.height}px`;
    clone.style.margin = "0";
    // Hinged on the wire, so the sheet swings about the binding and not about
    // its own middle.
    clone.style.transformOrigin = dir === 1 ? `${EDGE}px center` : `${box.width - 8}px center`;
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
      {/* The sheet. Inset from the left so the wire has an edge to wrap. */}
      <div
        ref={sheet}
        className="absolute inset-y-0 right-0 flex flex-col"
        style={{
          left: EDGE,
          background: PAPER,
          color: INK,
          transformStyle: "preserve-3d",
          boxShadow: "-1px 0 0 rgba(46,16,101,0.10), 3px 0 14px -6px rgba(46,16,101,0.18)",
        }}
      >
        <Rules />

        {onSkip && (
          <button
            onClick={onSkip}
            className="absolute right-[var(--gutter)] top-[max(16px,env(safe-area-inset-top))] z-30 -mr-2 inline-flex min-h-11 items-center px-2 text-callout opacity-60 transition-opacity hover:opacity-100"
          >
            Skip
          </button>
        )}

        {/* A page has a top margin. Without one the content starts flush at
            the sheet's edge, which clipped the first thing on it and put every
            page under the Skip control. */}
        <div
          className="relative z-10 min-h-0 flex-1 overflow-hidden"
          style={{
            paddingLeft: TEXT_X - EDGE,
            paddingRight: "var(--gutter)",
            paddingTop: "max(58px, calc(env(safe-area-inset-top) + 44px))",
          }}
        >
          {children}
        </div>

        {/* The enormous word. It is the deck's oldest device and the thing
            that makes a sheet feel like a chapter rather than a slide, so it
            survived the move onto paper: same position, written by hand. */}
        <div
          className="relative z-20 shrink-0 overflow-hidden"
          style={{ paddingLeft: TEXT_X - EDGE, paddingRight: "var(--gutter)" }}
        >
          <div
            ref={heading}
            // Steps up on a laptop, where the sheet is three times as wide and
            // a phone sized word reads as a caption in the corner of it. The
            // fit below still owns the ceiling, so a long word simply comes
            // back down rather than running off the page.
            className="whitespace-nowrap text-[4.2rem] leading-[0.92] lg:text-[7.5rem]"
            style={{
              fontFamily: "var(--font-hand)",
              fontWeight: 700,
              color: ink,
              textShadow: `0 0 0.6px ${ink}`,
            }}
          >
            {word}
          </div>
        </div>

        <div
          className="relative z-20 mt-1 flex shrink-0 items-center gap-3 pb-[max(16px,env(safe-area-inset-bottom))] pt-1"
          style={{ paddingLeft: TEXT_X - EDGE, paddingRight: "var(--gutter)" }}
        >
          <span className="tnum text-label tabular-nums opacity-40">
            {String(page).padStart(2, "0")}
          </span>
          <Rail page={page} total={total} />
          <span className="ml-auto flex shrink-0 items-center gap-2.5">
            {onBack && page > 1 && (
              <button
                onClick={() => turn(-1, onBack)}
                aria-label="Back"
                className="grid size-[44px] place-items-center rounded-full border transition-transform duration-200 active:scale-90"
                style={{ borderColor: "rgba(46,16,101,0.22)" }}
              >
                <Arrow back />
              </button>
            )}
            <button
              onClick={() => turn(1, onNext)}
              aria-label={last ? "Sign in" : "Next"}
              className="grid size-[52px] place-items-center rounded-full transition-transform duration-200 active:scale-90"
              style={{ background: INK, color: PAPER }}
            >
              {last ? <Tick /> : <Arrow />}
            </button>
          </span>
        </div>
      </div>

      {/* The wire, drawn last so its front halves lie over the sheet. */}
      <Wire />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The feint, and the margin rule beside the holes.
 *
 * Faint on purpose. Real ruled paper is darker, but real ruled paper also has
 * handwriting on it rather than 13px type, and a rule crossing an x-height at
 * full strength is the quickest way to make a page unreadable.
 */
function Rules() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent 0 33px, rgba(46,16,101,0.05) 33px 34px)",
          backgroundPositionY: "14px",
        }}
      />
      <div
        className="absolute inset-y-0"
        style={{
          left: TEXT_X - EDGE - 16,
          width: 1,
          background: "rgba(196,74,96,0.22)",
        }}
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
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
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

/** How far through the pad you are. */
function Rail({ page, total }: { page: number; total: number }) {
  return (
    <span className="flex items-center gap-1.5" aria-hidden>
      {Array.from({ length: total }, (_, k) => (
        <span
          key={k}
          className="block h-[2px] rounded-full transition-all duration-500 ease-out"
          style={{
            width: k === page - 1 ? 20 : 7,
            background: INK,
            opacity: k === page - 1 ? 0.85 : 0.2,
          }}
        />
      ))}
    </span>
  );
}

function Arrow({ back = false }: { back?: boolean }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {back ? (
        <>
          <path d="M19 12H5" />
          <path d="M11 18l-6-6 6-6" />
        </>
      ) : (
        <>
          <path d="M5 12h14" />
          <path d="M13 6l6 6-6 6" />
        </>
      )}
    </svg>
  );
}

function Tick() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
