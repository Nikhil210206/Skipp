"use client";

// ============================================================
// SHARED PIECES FOR THE COMPOSED LOOKS
// Register and Ticket draw Home and Attendance from their own
// pieces (see `useComposition`). What both of them need lives
// here: the dot field, the countdown in whole minutes, the
// notches a ticket is cut with, and the entrance they share.
// ============================================================

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { prefersReducedMotion, settleEntrance } from "@/lib/motion";

export const THRESHOLD = 75;

/** A subject row is a lab when the portal says so in its category or slot. */
export const isLabSubject = (s: { category: string; slot?: string | null }) =>
  /practical|lab/i.test(s.category) || s.slot === "LAB";

/** "93.3%", with no trailing ".0". */
export const pctText = (n: number) => `${Math.round(n * 10) / 10}%`;

// ---------- the dot field -----------------------------------------

/** The ordered dither matrix. Each cell's threshold, out of 16. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/**
 * An ordered dither field of dots in the look's loud colour, drifting slowly.
 *
 * `corner` gathers toward the top right and fades out under whatever text sits
 * to its left. `bars` reads as a barcode, for a ticket's stub.
 *
 * It is a canvas painted in one path per frame at 30fps, and it stops painting
 * when the tab is hidden or the field is scrolled away, so a screen that is not
 * being looked at costs nothing. Reduced motion paints it once and leaves it.
 * The colour is read from the CSS variable once, at mount: a theme change
 * swaps the whole composition, so it can never go stale.
 */
export function DotField({
  mode,
  className = "",
  colorVar = "--look-loud",
}: {
  mode: "corner" | "bars";
  className?: string;
  colorVar?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const reduced = prefersReducedMotion();
    const color = getComputedStyle(cv).getPropertyValue(colorVar).trim() || "#000";
    const G = mode === "bars" ? 5 : 6;
    let W = 0;
    let H = 0;
    let raf = 0;
    let last = -1e4;
    let visible = true;

    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = cv.clientWidth;
      H = cv.clientHeight;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const paint = (t: number) => {
      if (cv.clientWidth !== W || cv.clientHeight !== H) fit();
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = color;
      ctx.beginPath();
      const cols = Math.ceil(W / G);
      const rows = Math.ceil(H / G);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const px = x * G + G / 2;
          const py = y * G + G / 2;
          let d =
            mode === "bars"
              ? ((x * 7919 + 13) % 11 > 4 ? 0.95 : 0.1) + 0.12 * Math.sin(py * 0.09 - t * 0.003 + x)
              : (px / W) * 0.9 + (1 - py / H) * 0.85 - 0.95 +
                0.16 * Math.sin(px * 0.022 - py * 0.017 - t * 0.0016);
          if (d <= 0) continue;
          if (d > 1) d = 1;
          const level = d * 16 - BAYER[(y & 3) * 4 + (x & 3)];
          if (level <= 0) continue;
          const r = (level > 9 ? 2.2 : level > 4 ? 1.55 : 0.95) * (G / 6);
          ctx.moveTo(px + r, py);
          ctx.arc(px, py, r, 0, Math.PI * 2);
        }
      }
      ctx.fill();
    };

    fit();
    paint(0);
    if (reduced) return;

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    io.observe(cv);
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden || t - last < 33) return;
      last = t;
      paint(t);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [mode, colorVar]);

  return <canvas ref={ref} aria-hidden className={`pointer-events-none ${className}`} />;
}

// ---------- time left, in whole minutes ---------------------------

const minutesUntil = (target: number) => Math.max(0, Math.ceil((target - Date.now()) / 60_000));

/**
 * Minutes until a moment, kept live. Everything that shows it is quoted in
 * whole minutes, so it wakes a few times a minute rather than every second.
 */
export function useMinutesLeft(target: number | null): number | null {
  const [left, setLeft] = useState(() => (target === null ? null : minutesUntil(target)));
  useEffect(() => {
    if (target === null) return;
    const tick = () => setLeft(minutesUntil(target));
    const first = window.setTimeout(tick, 0);
    const every = window.setInterval(tick, 15_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
    };
  }, [target]);
  return target === null ? null : left;
}

/** The figure and its unit: "24" "min", "3h" "20m", "2d" "4h". */
export function splitLeft(min: number): [string, string] {
  if (min < 60) return [String(min), "min"];
  if (min < 1440) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return [`${h}h`, m ? `${m}m` : ""];
  }
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  return [`${d}d`, h ? `${h}h` : ""];
}

// ---------- ticket notches ----------------------------------------

/**
 * The half circle bitten out of a ticket where its perforation meets an edge.
 * Painted in the page colour with the ticket's own outline on the cut, so it
 * reads as a hole rather than as a dot laid on top.
 */
export function Notch({
  edge,
  at,
  outline = "var(--color-text-1)",
  size = 24,
}: {
  edge: "top" | "bottom";
  /** Distance of the perforation from the ticket's right edge, in px. */
  at: number;
  outline?: string | null;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className="absolute box-border rounded-full bg-ink-0"
      style={{
        width: size,
        height: size,
        right: at - size / 2,
        [edge]: -size / 2,
        border: outline ? `2px solid ${outline}` : undefined,
        clipPath: edge === "top" ? "inset(50% 0 0 0)" : "inset(0 0 50% 0)",
      }}
    />
  );
}

// ---------- the shared entrance -----------------------------------

/**
 * The composed looks' entrance, built from markers the same way `revealIn` is:
 *
 *   data-look-rise   a figure or a line rising from under its own clip
 *   data-look-in     content lifting and fading in, staggered
 *   data-look-rule   a rule drawn from its left end
 *   data-look-tick   a cell popping in
 *   data-look-pass   a ticket dropping in, settling level
 *   data-look-stamp  a rubber stamp thumped on
 *   data-hand-draw   a pen stroke drawn on from its start
 *   data-hand-hatch  a bar's hatching shaded in from the left
 *
 * It settles on a tab change exactly as the rest of the app does, so the page
 * fade stays the only entrance. Every tween is a `from` that clears itself, so
 * a reverted or skipped entrance leaves everything visible.
 */
export function lookEntrance(self: HTMLElement, reduced: boolean): void {
  if (settleEntrance(reduced)) return;
  const all = (s: string) => Array.from(self.querySelectorAll<HTMLElement>(s));
  const ease = "expo.out";
  const run = (s: string, vars: gsap.TweenVars) => {
    const targets = all(s);
    if (targets.length > 0) gsap.from(targets, vars);
  };
  run("[data-look-rule]", { scaleX: 0, transformOrigin: "0% 50%", duration: 1, ease, stagger: 0.1, clearProps: "transform" });
  run("[data-look-rise]", { yPercent: 105, duration: 1.05, ease, stagger: 0.08, clearProps: "transform" });
  run("[data-look-pass]", { y: 44, rotation: -2.5, opacity: 0, duration: 0.95, ease, stagger: 0.08, clearProps: "transform,opacity" });
  run("[data-look-in]", { y: 20, opacity: 0, duration: 0.7, ease, delay: 0.2, stagger: { amount: 0.4 }, clearProps: "transform,opacity" });
  run("[data-look-tick]", { scale: 0, duration: 0.4, ease: "back.out(2.4)", delay: 0.45, stagger: { amount: 0.6 }, clearProps: "transform" });
  // The pen: a scribble is drawn from its left end, and a bar is hatched in
  // from the left the way you would shade one.
  run("[data-hand-hatch]", { scaleX: 0, transformOrigin: "0% 50%", duration: 1.1, ease, delay: 0.3, clearProps: "transform" });
  const draws = all("[data-hand-draw]");
  if (draws.length > 0) {
    gsap.fromTo(
      draws,
      { strokeDashoffset: 1 },
      { strokeDashoffset: 0, duration: 0.55, ease: "power2.out", delay: 0.45, stagger: 0.08, clearProps: "strokeDashoffset" },
    );
  }
  const stamps = all("[data-look-stamp]");
  if (stamps.length > 0) {
    gsap.fromTo(
      stamps,
      { scale: 1.8, opacity: 0, rotation: -40 },
      { scale: 1, opacity: 1, rotation: -12, duration: 0.55, ease: "back.out(2.2)", delay: 0.75, clearProps: "opacity" },
    );
  }
}
