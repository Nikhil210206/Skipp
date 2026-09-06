"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * THE FIELD BEHIND THE WAIT.
 *
 * Signing in to the portal genuinely takes several seconds, and that wait used
 * to be a line of text and a hairline with a bar sweeping along it. Nothing
 * about it was untrue, and it read as a spinner with better manners.
 *
 * This is what stands behind it now: columns of the numbers this app is made
 * of, drifting past at different speeds. It is deliberately ABSTRACT. None of
 * these figures is the student's, none of them is claimed to be, and nothing
 * here counts up toward anything, because the one thing a loading screen must
 * never do is imply a progress it cannot know. It is weather, not a gauge.
 *
 * **The depth is the whole effect, and it comes from four things moving
 * together, never one.** A column that is nearer is larger, faster, and dimmer
 * than one that is further off, and it drifts the other way. Change only the
 * speed and you get a list scrolling; change all four and the eye reads a
 * space with something in it.
 */

/**
 * The vocabulary. Percentages, day orders, marks out of sixty, class times: the
 * shapes a student actually sees in Skipp, with none of the values meaning
 * anything. Kept to figures alone, so it never reads as text you were supposed
 * to have caught.
 */
const NUMERALS = [
  "93.3", "2", "41/60", "75.0", "09:00", "4", "88.2", "23/25",
  "1", "02:20", "66.7", "5", "100", "3", "81.5", "12/15",
  "97.1", "10:50", "3", "54/60", "72.4", "1", "11:40", "5",
];

/** How many figures a column holds before it repeats. */
const PER_COLUMN = 8;

/**
 * The four planes. `size` is in rem, `dim` is the resting opacity, `secs` is
 * one full pass, and `up` is which way it goes.
 *
 * Nearest first. Note that the nearest plane is the DIMMEST: a big pale figure
 * sliding past reads as close and out of focus, where a big bright one just
 * reads as the thing you are meant to be looking at, and the thing you are
 * meant to be looking at is the status line in front of all this.
 */
const PLANES = [
  { size: 5.5, dim: 0.05, secs: 26, up: true },
  { size: 3.25, dim: 0.06, secs: 34, up: false },
  { size: 2, dim: 0.08, secs: 44, up: true },
  { size: 1.25, dim: 0.07, secs: 58, up: false },
];

export default function NumeralField({ hushed }: { hushed: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const cols = useRef<(HTMLDivElement | null)[]>([]);
  const tweens = useRef<gsap.core.Tween[]>([]);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    // Reduced motion keeps the composition and loses the drift. There is
    // nothing here that has to move for the screen to make sense, so this one
    // really can just stand still.
    if (prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      cols.current.forEach((col, i) => {
        if (!col) return;
        const plane = PLANES[i % PLANES.length];
        /**
         * Each column holds its figures twice, so travelling exactly half its
         * own height lands the copy precisely where the original started and
         * the loop has no seam to find. `linear` for the same reason: an eased
         * drift would visibly hesitate at every wrap.
         */
        const t = gsap.fromTo(
          col,
          { yPercent: plane.up ? 0 : -50 },
          {
            yPercent: plane.up ? -50 : 0,
            duration: plane.secs,
            ease: "none",
            repeat: -1,
            force3D: true,
          },
        );
        // Seeded into its own cycle, or four columns that start together stay
        // together and the field pulses as one instead of drifting.
        t.progress((i * 0.37 + 0.11) % 1);
        tweens.current.push(t);
      });
    }, el);
    return () => {
      tweens.current = [];
      ctx.revert();
    };
  }, []);

  /**
   * When the snapshot lands the field stands down rather than being cut. It
   * decelerates instead of stopping, because the student's own figures are
   * arriving in front of it on the same frames and two things stopping dead at
   * once reads as a glitch.
   */
  useLayoutEffect(() => {
    if (!hushed || !root.current) return;
    if (prefersReducedMotion()) {
      gsap.set(root.current, { opacity: 0.25 });
      return;
    }
    const anims = [
      ...tweens.current.map((t) =>
        gsap.to(t, { timeScale: 0.08, duration: 1.1, ease: "power2.out" }),
      ),
      gsap.to(root.current, { opacity: 0.28, duration: 0.8, ease: "power2.out" }),
    ];
    return () => anims.forEach((a) => a.kill());
  }, [hushed]);

  return (
    <div
      ref={root}
      aria-hidden
      // Behind everything, and untouchable. `font-sans` deliberately, against
      // the display face the rest of this screen is set in: these are meant to
      // read as readouts drifting past, not as more of the headline.
      /**
       * **The field is WIDER than the screen, and that is not a detail.** Sized
       * to the viewport, the outer columns were cut through the middle of a
       * glyph at exactly the screen edge, and four figures sheared off on the
       * same vertical line does not read as a photograph bleeding, it reads as
       * text overflowing its box. Standing the outer planes half off the screen
       * makes the same clip deliberate.
       */
      className="tnum pointer-events-none absolute -inset-x-24 inset-y-0 z-0 flex select-none justify-between overflow-hidden font-sans tabular-nums"
    >
      {PLANES.map((plane, i) => {
        const items = Array.from(
          { length: PER_COLUMN },
          (_, k) => NUMERALS[(i * PER_COLUMN + k) % NUMERALS.length],
        );
        // The one point of colour in the whole field, and only in one plane, so
        // it arrives about once a pass rather than being a pattern.
        const accentAt = i === 1 ? 3 : -1;
        /**
         * **The plane's opacity is set per figure, not on the column, and that
         * is forced rather than tidy.** A child cannot be more opaque than its
         * parent, so with the alpha on the column the accent figure was capped
         * at the same 0.06 as everything around it and the one point of colour
         * in the field was not perceptibly coloured. Carried by each span, the
         * accent can stand clear of its own plane and still sit far below the
         * status line in front of it.
         */
        const stack = (copy: boolean) =>
          items.map((n, k) => (
            <span
              key={`${copy ? "b" : "a"}-${k}`}
              className={k === accentAt ? "text-accent" : "text-text-1"}
              style={{
                fontSize: `${plane.size}rem`,
                lineHeight: 1.9,
                opacity: k === accentAt ? Math.min(0.4, plane.dim * 3.2) : plane.dim,
              }}
            >
              {n}
            </span>
          ));
        return (
          <div key={i} className="flex flex-1 flex-col items-center">
            <div
              ref={(n) => {
                cols.current[i] = n;
              }}
              className="flex flex-col items-center will-change-transform"
            >
              {stack(false)}
              {stack(true)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
