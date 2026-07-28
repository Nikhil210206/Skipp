"use client";

import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { EASE, prefersReducedMotion } from "@/lib/motion";

/**
 * THE LAUNCH.
 *
 * Mounted once in the root layout, so it plays on a cold start and never on a
 * client navigation: opening the app from the home screen or the app switcher
 * is a fresh document, moving between tabs is not.
 *
 * The wordmark is split per letter, which the entry choreography deliberately
 * avoids elsewhere ("characters are showy"). Showy is the point here: it is
 * five letters, for under a second, on an element no screen reader ever sees.
 * The rule beneath carries the 75% tick, so even the launch is the one idea
 * the whole app is about.
 *
 * It holds the screen for a fixed beat rather than waiting on the session, so a
 * slow portal can never turn the launch into a hang.
 */

const MARK = "skipp".split("");
const THRESHOLD = 75;

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
      tl.fromTo(
        "[data-letter]",
        { yPercent: 115 },
        { yPercent: 0, duration: 0.66, ease: EASE.emphasis, stagger: 0.05 },
      )
        .fromTo(
          "[data-rule]",
          { scaleX: 0 },
          { scaleX: 1, duration: 0.62, ease: EASE.emphasis },
          0.22,
        )
        .fromTo(
          "[data-tick]",
          { opacity: 0, scaleY: 0 },
          { opacity: 1, scaleY: 1, duration: 0.34, ease: EASE.out },
          0.62,
        )
        // The whole mark lifts away rather than dissolving: the app is arriving
        // underneath it, not replacing it.
        .to({}, { duration: 0.24 })
        .to("[data-mark-group]", {
          y: -14,
          opacity: 0,
          duration: 0.42,
          ease: EASE.in,
        })
        .to(el, { opacity: 0, duration: 0.34, ease: EASE.in }, "<0.08");
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
      <div data-mark-group className="w-[min(62vw,240px)]">
        <div className="flex justify-center">
          {MARK.map((c, i) => (
            <span key={i} className="inline-flex overflow-hidden pb-[0.08em]">
              <span
                data-letter
                className="inline-block text-hero font-bold tracking-[-0.045em] will-change-transform"
              >
                {c}
              </span>
            </span>
          ))}
        </div>

        <div className="relative mt-4 h-px w-full bg-line">
          <span
            data-rule
            className="absolute inset-0 origin-left bg-text-1/70"
          />
          {/* The line the whole app is about. */}
          <span
            data-tick
            className="absolute -top-[3px] h-2 w-px origin-center bg-accent"
            style={{ left: `${THRESHOLD}%` }}
          />
        </div>
      </div>
    </div>
  );
}
