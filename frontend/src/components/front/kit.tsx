"use client";

import { useEffect, useRef } from "react";
import { IconArrowRight, IconChevronLeft } from "@/components/Icons";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * THE FRONT DOOR'S ONE LANGUAGE.
 *
 * The hero, the install offer, every tour chapter and the send-off share ONE
 * design, and it is the house style rather than any of the app's themes: a
 * warm near-black ground, one loud orange used as a fill, a heavy lowercase
 * display face with the second line of a headline in the hand, mono eyebrows,
 * receipt cards, pills, an ordered dither dot field, and an arch at the end.
 * The hero is the one screen WITHOUT the dot field, on request: the giant
 * word and the phones are already the whole picture there.
 *
 * Two earlier versions are the reason for that sentence. One set every chapter
 * in a different theme of the app ("the rooms") and was rejected because a way
 * in has to read as one place. The fix was then about to be "all in Ink", and
 * that was stopped as too plain. So: one language, and it is a creative one.
 *
 * Fixed colours, not the theme tokens. This is seen before anybody has chosen
 * anything, and the look chapter changes the app's tokens live, which must not
 * repaint the tour.
 */
export const C = {
  /**
   * True black, the way Ink is. A warm near black (#0b0a08) was tried here and
   * reported as the hero no longer being black: on an OLED phone it is a lit,
   * tinted backdrop, and the orange glow on it read as a gradient.
   */
  ground: "#000000",
  card: "#13110e",
  raised: "#1c1915",
  line: "#2e2a24",
  text: "#f3efe6",
  dim: "#aaa398",
  faint: "#76706a",
  accent: "#f2661c",
  onAccent: "#140700",
  paper: "#f3efe6",
  onPaper: "#0b0a08",
} as const;

export const DISPLAY = "var(--font-display-src), var(--font-geist-sans), sans-serif";

const PRESS =
  "transition-transform duration-[420ms] ease-[cubic-bezier(.34,1.56,.64,1)] active:scale-[0.96] active:duration-[90ms]";

/** The one action: an orange pill, with the arrow in a disc at its end. */
export function PrimaryPill({
  label,
  onClick,
  className = "",
  inverse = false,
}: {
  label: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  /** Ink on orange, for a pill that sits on an orange field (the arch). */
  inverse?: boolean;
}) {
  const fill = inverse ? C.onAccent : C.accent;
  const ink = inverse ? C.accent : C.onAccent;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex h-[58px] items-center justify-between gap-4 rounded-full pl-[26px] pr-2 text-[17px] font-semibold tracking-[-0.01em] ${PRESS} ${className}`}
      style={{ background: fill, color: inverse ? C.text : ink }}
    >
      {label}
      <span
        className="grid size-[42px] shrink-0 place-items-center rounded-full"
        style={{ background: inverse ? C.accent : C.onAccent, color: inverse ? C.onAccent : C.accent }}
      >
        <IconArrowRight
          size={18}
          className="transition-transform duration-300 group-hover:translate-x-0.5"
        />
      </span>
    </button>
  );
}

/** A quiet pill, ringed rather than filled, for the second choice. */
export function GhostPill({
  label,
  onClick,
  className = "",
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-[52px] items-center justify-center rounded-full px-6 text-[16px] font-semibold ${PRESS} ${className}`}
      style={{ color: C.text, boxShadow: `inset 0 0 0 2px ${C.line}` }}
    >
      {label}
    </button>
  );
}

/**
 * The way back, top left on every page of the way in. Always the same place
 * and the same shape, so it is found by reflex rather than by looking.
 */
export function BackButton({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`grid size-11 shrink-0 place-items-center rounded-full ${PRESS}`}
      style={{ color: C.text, boxShadow: `inset 0 0 0 2px ${C.line}` }}
    >
      <IconChevronLeft size={20} />
    </button>
  );
}

/** The numbered mono label above a headline. Numbered only because it is one. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p data-f className="font-mono text-[11px] font-semibold tracking-[0.16em]" style={{ color: C.faint }}>
      {children}
    </p>
  );
}

/**
 * A receipt card: a 2px rule, generous corners, and a mono header strip under
 * the same rule. Used wherever the way in shows evidence rather than talk.
 */
export function Receipt({
  label,
  aside,
  children,
  className = "",
  fill,
  style,
}: {
  label: string;
  aside?: string;
  children: React.ReactNode;
  className?: string;
  /** "accent" paints the card orange: the one fill on a screen. */
  fill?: "accent";
  style?: React.CSSProperties;
}) {
  const loud = fill === "accent";
  const rule = loud ? "rgba(20,7,0,0.22)" : C.line;
  return (
    <div
      className={`overflow-hidden rounded-[22px] border-2 ${className}`}
      style={{
        borderColor: loud ? C.accent : C.line,
        background: loud ? C.accent : C.card,
        color: loud ? C.onAccent : C.text,
        ...style,
      }}
    >
      <div
        className="flex items-center justify-between gap-2 border-b-2 px-4 py-2.5 font-mono text-[10px] font-semibold tracking-[0.14em]"
        style={{ borderColor: rule, color: loud ? "rgba(20,7,0,0.7)" : C.faint }}
      >
        <span className="truncate">{label}</span>
        {aside && <span className="shrink-0">{aside}</span>}
      </div>
      {children}
    </div>
  );
}

/** The 4x4 ordered dither matrix, as thresholds out of 16. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/**
 * An ordered dither dot field: a grid of dots whose sizes come from a 4x4
 * Bayer matrix against a soft field that falls away from one corner, with slow
 * rings moving through it (about one wavelength every four seconds).
 *
 * Drawn on a canvas as ONE path per frame, at 20 frames a second, and only
 * while it is on screen. Reduced motion draws it once and leaves it. It is
 * decoration, so it is `aria-hidden` and takes no pointer.
 */
export function DotField({
  className = "",
  origin = [1, 0],
  reach = 0.85,
  cell = 10,
  color = C.accent,
  opacity = 0.75,
}: {
  className?: string;
  /** Where the field is densest, as fractions of the box. */
  origin?: [number, number];
  /** How far the field reaches, as a fraction of the box's diagonal. */
  reach?: number;
  cell?: number;
  color?: string;
  opacity?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ox, oy] = origin;

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const reduced = prefersReducedMotion();
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let last = 0;
    let visible = true;
    const t0 = performance.now();

    const size = () => {
      const r = cv.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width;
      h = r.height;
      cv.width = Math.max(1, Math.round(w * dpr));
      cv.height = Math.max(1, Math.round(h * dpr));
    };

    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;
      const cx = ox * w;
      const cy = oy * h;
      const reachPx = Math.hypot(w, h) * reach;
      const phase = (t / 4000) * Math.PI * 2;
      ctx.beginPath();
      for (let j = 0, y = 0; y < h + cell; j++, y += cell) {
        for (let i = 0, x = 0; x < w + cell; i++, x += cell) {
          const d = Math.hypot(x - cx, y - cy);
          let v = 1 - d / reachPx;
          if (v <= 0) continue;
          v *= 0.78 + 0.22 * Math.sin(d / 42 - phase);
          const threshold = (BAYER[(j % 4) * 4 + (i % 4)] + 0.5) / 16;
          if (v <= threshold) continue;
          const k = v - threshold;
          const r = k > 0.4 ? cell * 0.24 : k > 0.17 ? cell * 0.17 : cell * 0.1;
          const px = x + cell / 2;
          const py = y + cell / 2;
          ctx.moveTo(px + r, py);
          ctx.arc(px, py, r, 0, Math.PI * 2);
        }
      }
      ctx.fill();
    };

    size();
    draw(0);
    const ro = new ResizeObserver(() => {
      size();
      draw(performance.now() - t0);
    });
    ro.observe(cv);
    if (reduced) return () => ro.disconnect();

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    io.observe(cv);
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || now - last < 50) return;
      last = now;
      draw(now - t0);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [ox, oy, reach, cell, color]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`pointer-events-none ${className}`}
      style={{ opacity }}
    />
  );
}
