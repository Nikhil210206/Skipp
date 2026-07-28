"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { EASE, prefersReducedMotion } from "@/lib/motion";

/**
 * A figure whose digits roll like a counter rather than being replaced.
 *
 * Each digit is a column of 0 to 9 inside a one-line clip; changing the value
 * slides the column. Digits that did not change do not move, so 95.2 to 90.9
 * rolls only the two that actually differ, which is what makes it read as a
 * mechanism rather than an animation.
 */
export default function RollingNumber({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) {
  const chars = value.split("");
  const cols = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const reduced = prefersReducedMotion();
    chars.forEach((c, i) => {
      const col = cols.current[i];
      if (!col || !/\d/.test(c)) return;
      const to = -Number(c) * 10;
      if (reduced) {
        gsap.set(col, { yPercent: to });
        return;
      }
      gsap.to(col, {
        yPercent: to,
        duration: 0.72,
        ease: EASE.emphasis,
        overwrite: "auto",
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span className={`tnum inline-flex items-end -mb-[0.15em] ${className}`}>
      {/* Every digit column is aria-hidden, and aria-label on a generic span is
          not reliably announced, so the value is carried as real text. */}
      <span className="sr-only">{value}</span>
      {chars.map((c, i) =>
        /\d/.test(c) ? (
          <span
            key={i}
            aria-hidden
            className="inline-block h-[1em] overflow-hidden leading-none"
          >
            <span
              ref={(el) => {
                cols.current[i] = el;
              }}
              className="flex flex-col will-change-transform"
            >
              {Array.from({ length: 10 }, (_, d) => (
                <span key={d} className="h-[1em] leading-none">
                  {d}
                </span>
              ))}
            </span>
          </span>
        ) : (
          // Separators and the unit ride in the same alignment system as the
          // digits, and sit back a step so the figure reads first.
          <span
            key={i}
            aria-hidden
            className="inline-block h-[1em] leading-none opacity-40"
          >
            {c}
          </span>
        ),
      )}
    </span>
  );
}
