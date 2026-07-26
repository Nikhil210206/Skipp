"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { DUR, EASE, prefersReducedMotion } from "@/lib/motion";

/**
 * A live countdown, always set as two stacked units so the cover keeps the same
 * shape whether the next class is four days or four minutes away. The leading
 * unit is solid and lifts when it changes; the trailing unit is ghosted and
 * simply ticks, which is what makes the screen feel alive without twitching.
 *
 * Both lines are written straight to the DOM, so a screen that updates every
 * second never re-renders React.
 */
export default function Countdown({ target }: { target: number }) {
  const lead = useRef<HTMLSpanElement>(null);
  const trail = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const a = lead.current;
    const b = trail.current;
    if (!a || !b) return;
    const reduced = prefersReducedMotion();
    let lastLead = "";

    const tick = () => {
      const [primary, secondary] = format(target - Date.now());
      b.textContent = secondary;
      if (primary === lastLead) return;
      lastLead = primary;
      a.textContent = primary;
      if (!reduced) {
        gsap.fromTo(
          a,
          { yPercent: 8, opacity: 0.4 },
          { yPercent: 0, opacity: 1, duration: DUR.quick, ease: EASE.out },
        );
      }
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [target]);

  // The units are written by the layout effect above, before the browser
  // paints, so the hero is never blank and render stays free of clock reads.
  return (
    <div className="optical flex flex-col">
      <span ref={lead} className="tnum text-poster" suppressHydrationWarning />
      <span
        ref={trail}
        className="tnum text-poster text-text-1/30"
        suppressHydrationWarning
      />
    </div>
  );
}

/** Always two units: the largest that applies, and the one below it. */
function format(ms: number): [string, string] {
  if (ms <= 0) return ["now", ""];
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return [`${d}d`, `${pad(h)}h`];
  if (h > 0) return [`${h}h`, `${pad(m)}m`];
  return [`${m}m`, `${pad(s)}s`];
}
