"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * The screen's name, written in the masthead by hand.
 *
 * It replaced an 11px small caps label that was too small to read at a glance,
 * and it borrows the entry notebook's pen (`--font-hand`) so the app and the
 * way in read as one hand. Lowercase, to match the voice.
 *
 * **Sized to the 56px bar, and level.** A first pass was 40px and tilted -2
 * degrees: the tilt lifted the end of the word into the top edge of the bar and
 * shaved its ascenders off on a phone, and the glyphs filled the bar so fully
 * that the swash was squeezed against the page. 34px, untilted, leaves room
 * above the ascenders and a clear gap for the swash.
 *
 * **It is written on each time the screen changes**: the word is wiped in left
 * to right at a steady speed, the way a pen moves, and the swash under it is
 * drawn after, because you underline a word once you have written it.
 *
 * **Visible content never depends on the animation.** There is no CSS start
 * state: the tween sets its own, and reverting the context mid flight hands the
 * element back to plain CSS, which shows it. Reduced motion simply skips it.
 *
 * Terminal and Arcade keep their own faces: `globals.css` sets this back to the
 * small caps label there and hides the swash (`[data-hand-title]`).
 */
export default function MastheadTitle({ text }: { text: string }) {
  const word = useRef<HTMLSpanElement>(null);
  const swash = useRef<SVGPathElement>(null);

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      tl.fromTo(
        word.current,
        // Negative insets top and bottom, or the hand's long ascenders and
        // descenders are shaved off while it is being written.
        { clipPath: "inset(-40% 100% -40% -6%)" },
        {
          clipPath: "inset(-40% -6% -40% -6%)",
          duration: 0.26 + text.length * 0.035,
          ease: "power1.inOut",
          clearProps: "clipPath",
        },
      );
      if (swash.current) {
        tl.fromTo(
          swash.current,
          { strokeDashoffset: 1 },
          { strokeDashoffset: 0, duration: 0.34, ease: "power2.out" },
          "-=0.08",
        );
      }
    });
    return () => ctx.revert();
  }, [text]);

  return (
    <span data-hand-title className="relative inline-block pb-1">
      <span
        ref={word}
        className="block font-hand text-scrawl lowercase tracking-normal whitespace-nowrap text-text-1"
      >
        {text}
      </span>
      <svg
        data-hand-swash
        aria-hidden
        viewBox="0 0 200 8"
        preserveAspectRatio="none"
        className="absolute -bottom-0.5 left-0 h-2 w-[92%] overflow-visible"
      >
        {/* pathLength 1 lets the draw run from 1 to 0 without measuring the
            path, whatever width the word stretches it to. One stroke: a
            second loop at the end read as a scribble at this size. */}
        <path
          ref={swash}
          d="M3 5 C 50 2, 110 7, 197 3"
          pathLength={1}
          strokeDasharray="1"
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
