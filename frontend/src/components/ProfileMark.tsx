"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import { DUR, EASE, prefersReducedMotion } from "@/lib/motion";
import { MARK_GRID, markCells } from "@/lib/mark";

/**
 * The profile mark: a figure generated from the student's registration number,
 * inside a tile, with a ring held slightly off it.
 *
 * The figure is nobody's choice and nothing stored: the same number always
 * draws the same mark, so it is recognisably yours, and two students sitting
 * together see two different ones. On press the cells collapse toward the
 * centre in a wave and spring back out, and the ring meets the tile.
 *
 * It is the one piece of chrome with a character of its own, which is why it is
 * a custom component rather than a circular avatar.
 *
 * Handlers are React props rather than listeners bound to a ref: `next/link`
 * does not hand back the underlying anchor, so a ref-bound listener silently
 * never fires.
 */
export default function ProfileMark({ seed }: { seed: string }) {
  const tile = useRef<HTMLSpanElement>(null);
  const ring = useRef<HTMLSpanElement>(null);
  const figure = useRef<SVGSVGElement>(null);
  const live = useRef(false);

  const cells = useMemo(() => markCells(seed), [seed]);

  useEffect(() => {
    const t = tile.current;
    const r = ring.current;
    if (!t || !r) return;
    // GSAP owns the ring's transform outright. A Tailwind `scale-*` class sets
    // the standalone `scale` property, which composes on top of GSAP's
    // `transform` and silently cancels the animation, so the rest state is set
    // here rather than in the markup.
    gsap.set(r, { scale: 1.16, opacity: 0.35 });
    live.current = !prefersReducedMotion();
    const rects = figure.current?.querySelectorAll("rect");
    return () => {
      gsap.killTweensOf([t, r]);
      if (rects) gsap.killTweensOf(rects);
    };
  }, []);

  // `overwrite` keeps a fast double tap from queueing a backlog of tweens.
  const to = useCallback(
    (el: Element | null, vars: gsap.TweenVars, duration: number) => {
      if (!el || !live.current) return;
      gsap.to(el, { ...vars, duration, ease: EASE.out, overwrite: "auto" });
    },
    [],
  );

  /** The wave through the figure: in toward the middle, or back out of it. */
  const wave = useCallback((scale: number, spring: boolean) => {
    const rects = figure.current?.querySelectorAll("rect");
    if (!rects || !live.current) return;
    gsap.to(rects, {
      scale,
      duration: spring ? 0.6 : 0.18,
      ease: spring ? "elastic.out(1, 0.55)" : "power2.out",
      stagger: { each: 0.014, from: "center", grid: [MARK_GRID, MARK_GRID] },
      overwrite: "auto",
    });
  }, []);

  const engage = useCallback(() => {
    to(ring.current, { scale: 1, opacity: 1 }, DUR.quick);
  }, [to]);

  const settle = useCallback(() => {
    to(tile.current, { scale: 1 }, DUR.micro);
    to(ring.current, { scale: 1.16, opacity: 0.35 }, DUR.quick);
    wave(1, true);
  }, [to, wave]);

  const press = useCallback(() => {
    to(tile.current, { scale: 0.9 }, DUR.micro);
    engage();
    wave(0.3, false);
  }, [to, engage, wave]);

  return (
    <Link
      href="/profile"
      aria-label="Your profile"
      onPointerEnter={engage}
      onPointerLeave={settle}
      onPointerDown={press}
      onPointerUp={settle}
      onPointerCancel={settle}
      className="relative -mr-1.5 flex size-11 items-center justify-center"
    >
      {/* Held off the tile at rest, meets it on press. */}
      <span
        ref={ring}
        aria-hidden
        className="pointer-events-none absolute size-8 rounded-[11px] border border-accent/70 opacity-0"
      />
      <span
        ref={tile}
        className="flex size-8 items-center justify-center rounded-[10px] border border-line bg-ink-1"
      >
        <svg
          ref={figure}
          viewBox={`0 0 ${MARK_GRID} ${MARK_GRID}`}
          aria-hidden
          className="size-5 text-text-2"
        >
          {cells.map((c) => (
            <rect
              key={`${c.x}-${c.y}`}
              x={c.x + 0.08}
              y={c.y + 0.08}
              width={0.84}
              height={0.84}
              rx={0.2}
              className={c.accent ? "fill-accent" : "fill-current"}
              // An SVG element scales about the viewBox origin by default,
              // which flings the cells across the tile instead of shrinking
              // them in place.
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />
          ))}
        </svg>
      </span>
    </Link>
  );
}
