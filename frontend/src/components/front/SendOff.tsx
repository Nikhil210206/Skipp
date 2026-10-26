"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { prefersReducedMotion } from "@/lib/motion";
import { C } from "./kit";

/**
 * THE SEND-OFF: the tour's last button opens onto sign in.
 *
 * The orange grows out of the arch's button until it is the whole screen, the
 * hand writes "let's go." across it, and then the field lifts away like a
 * curtain with the sign in already standing behind it. The orange that floods
 * the screen is the arch's own, so it reads as the arch rising rather than as
 * a new thing arriving.
 *
 * It lives in the PAGE, not the tour, because it has to outlive the tour: the
 * moment the field covers the screen (`onCovered`) the page swaps the tour for
 * the sign in underneath, and the field then has to keep going.
 *
 * Reduced motion keeps the moment and loses the movement: the field fades up,
 * holds the words, and fades away. It never cuts.
 */
export default function SendOff({
  from,
  onCovered,
  onFinished,
}: {
  from: { x: number; y: number };
  onCovered: () => void;
  onFinished: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  // Held in refs so a parent re-render cannot restart the timeline.
  const covered = useRef(onCovered);
  const finished = useRef(onFinished);
  useLayoutEffect(() => {
    covered.current = onCovered;
    finished.current = onFinished;
  });

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const field = el.querySelector("[data-so-field]");
    const word = el.querySelector("[data-so-word]");
    const swash = el.querySelector("[data-so-swash]");
    if (!field || !word || !swash) return;

    const tl = gsap.timeline();
    if (prefersReducedMotion()) {
      tl.fromTo(field, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power1.out" })
        .call(() => covered.current())
        .to({}, { duration: 0.8 })
        .to(field, { opacity: 0, duration: 0.4, ease: "power1.in" })
        .call(() => finished.current());
    } else {
      const { x, y } = from;
      const r =
        Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) + 24;
      tl.fromTo(
        field,
        { clipPath: `circle(0px at ${x}px ${y}px)` },
        { clipPath: `circle(${r}px at ${x}px ${y}px)`, duration: 0.8, ease: "expo.inOut" },
      )
        .call(() => covered.current())
        .fromTo(
          word,
          { clipPath: "inset(-30% 100% -30% -4%)" },
          { clipPath: "inset(-30% -4% -30% -4%)", duration: 0.7, ease: "power2.inOut" },
          "-=0.1",
        )
        .fromTo(swash, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5, ease: "power2.inOut" }, "-=0.15")
        .to({}, { duration: 0.35 })
        .to(field, { yPercent: -100, duration: 0.85, ease: "expo.inOut" })
        .call(() => finished.current());
    }
    return () => {
      tl.kill();
    };
    // The send-off plays once, from where it was pressed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={root} aria-hidden className="pointer-events-none fixed inset-0 z-[70]">
      <div
        data-so-field
        className="absolute inset-0 grid place-items-center"
        style={{ background: C.accent, color: C.onAccent }}
      >
        <div className="relative">
          <p data-so-word className="font-hand text-[76px] font-bold leading-none lg:text-[140px]">
            let&rsquo;s go.
          </p>
          <svg viewBox="0 0 300 18" preserveAspectRatio="none" className="absolute -bottom-4 left-0 h-[18px] w-full overflow-visible">
            <path
              data-so-swash
              pathLength={1}
              d="M4 12 C 90 5, 196 4, 296 8"
              fill="none"
              stroke={C.onAccent}
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray="1"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
