"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";
import gsap from "gsap";
import { DUR, EASE, prefersReducedMotion } from "@/lib/motion";

/**
 * The profile mark: a squircle carrying the student's initial, with a second
 * ring held slightly off it. On press the ring collapses onto the tile and the
 * tile gives, so the two shapes meet for an instant and settle apart again.
 *
 * It is the one piece of chrome with a character of its own, which is why it is
 * a custom component rather than a circular avatar.
 *
 * Handlers are React props rather than listeners bound to a ref: `next/link`
 * does not hand back the underlying anchor, so a ref-bound listener silently
 * never fires.
 */
export default function ProfileMark({ name }: { name: string }) {
  const tile = useRef<HTMLSpanElement>(null);
  const ring = useRef<HTMLSpanElement>(null);
  const live = useRef(false);

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
    return () => {
      gsap.killTweensOf([t, r]);
    };
  }, []);

  // `overwrite` keeps a fast double tap from queueing a backlog of tweens.
  const to = useCallback(
    (el: HTMLElement | null, vars: gsap.TweenVars, duration: number) => {
      if (!el || !live.current) return;
      gsap.to(el, { ...vars, duration, ease: EASE.out, overwrite: "auto" });
    },
    [],
  );

  const engage = useCallback(() => {
    to(ring.current, { scale: 1, opacity: 1 }, DUR.quick);
  }, [to]);

  const settle = useCallback(() => {
    to(tile.current, { scale: 1 }, DUR.micro);
    to(ring.current, { scale: 1.16, opacity: 0.35 }, DUR.quick);
  }, [to]);

  const press = useCallback(() => {
    to(tile.current, { scale: 0.9 }, DUR.micro);
    engage();
  }, [to, engage]);

  const initial = (name.trim()[0] ?? "s").toUpperCase();

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
        className="flex size-8 items-center justify-center rounded-[10px] border border-line bg-ink-1 text-[13px] font-semibold leading-none text-text-2"
      >
        {initial}
      </span>
    </Link>
  );
}
