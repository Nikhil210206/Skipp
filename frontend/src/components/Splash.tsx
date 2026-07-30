"use client";

import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { EASE, prefersReducedMotion } from "@/lib/motion";
import { TASSEL_PIVOT } from "@/lib/logo";
import Logo from "./Logo";

/**
 * THE LAUNCH.
 *
 * Mounted once in the root layout, so it plays on a cold start and never on a
 * client navigation: opening the app from the home screen or the app switcher
 * is a fresh document, moving between tabs is not.
 *
 * It plays the mark rather than showing it. The line draws and waits, the cap
 * drops onto it and settles, and the tassel swings from the landing. A cap
 * coming down onto the line is the whole product in one gesture.
 *
 * The wordmark then rises underneath, split per letter, which the entry
 * choreography deliberately avoids everywhere else. Showy is the point here: it
 * is five letters, for under a second, on an element no screen reader sees.
 *
 * It holds for a fixed beat rather than waiting on the session, so a slow
 * portal can never turn the launch into a hang.
 */

const WORD = "skipp".split("");

export default function Splash() {
  const [done, setDone] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;

    if (prefersReducedMotion()) {
      // No performance, just a brief hold so the app does not flash past.
      const t = setTimeout(() => setDone(true), 280);
      return () => clearTimeout(t);
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ onComplete: () => setDone(true) });

      // The line is standing there before anything lands on it.
      tl.fromTo(
        "[data-rule]",
        { scaleX: 0, opacity: 0 },
        {
          scaleX: 1,
          opacity: 1,
          duration: 0.4,
          ease: EASE.emphasis,
          transformOrigin: "center",
        },
      )
        // The cap comes down onto it.
        .fromTo(
          "[data-cap]",
          { y: -26, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, ease: "back.out(1.9)" },
          0.22,
        )
        // The tassel follows the cap down, then swings out and settles. Pivoted
        // where it is tied on, in the SVG's own coordinates.
        .fromTo(
          "[data-tassel]",
          { y: -26, opacity: 0, rotate: -24 },
          {
            y: 0,
            opacity: 1,
            rotate: 0,
            duration: 0.95,
            ease: "elastic.out(1, 0.4)",
            svgOrigin: `${TASSEL_PIVOT.x} ${TASSEL_PIVOT.y}`,
          },
          0.28,
        )
        // The wordmark arrives under the mark, once the cap has landed.
        .fromTo(
          "[data-letter]",
          { yPercent: 115 },
          { yPercent: 0, duration: 0.5, ease: EASE.emphasis, stagger: 0.04 },
          0.6,
        )
        // The whole thing lifts away rather than dissolving: the app is
        // arriving underneath it, not replacing it.
        .to({}, { duration: 0.08 }, 1.25)
        .to("[data-mark-group]", {
          y: -14,
          opacity: 0,
          duration: 0.4,
          ease: EASE.in,
        })
        .to(el, { opacity: 0, duration: 0.32, ease: EASE.in }, "<0.06");
    }, el);

    return () => ctx.revert();
  }, []);

  if (done) return null;

  return (
    <div
      ref={root}
      aria-hidden
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-0"
    >
      <div data-mark-group className="flex flex-col items-center">
        <Logo size={82} className="text-text-1" />
        <div className="mt-5 flex text-title tracking-[-0.06em]">
          {WORD.map((c, i) => (
            <span key={i} className="inline-flex overflow-hidden pb-[0.08em]">
              <span
                data-letter
                // The second p is the wordmark's signature, so it carries the
                // accent here too.
                className={`inline-block font-bold will-change-transform ${
                  i === WORD.length - 1 ? "text-accent" : ""
                }`}
              >
                {c}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
