"use client";

// The single source of truth for motion. Every animation in the app goes
// through these helpers, so timing and easing stay consistent and
// prefers-reduced-motion is honoured in exactly one place.

import { useLayoutEffect, useRef, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

/** Durations, in seconds (GSAP's unit). */
export const DUR = {
  micro: 0.14,
  quick: 0.24,
  base: 0.42,
  slow: 0.62,
} as const;

/** Easing vocabulary. Out for entrances, inOut for moves, in for exits. */
export const EASE = {
  out: "power3.out",
  emphasis: "expo.out",
  inOut: "power2.inOut",
  in: "power2.in",
} as const;

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Scoped GSAP effects with automatic cleanup. Runs in useLayoutEffect so the
 * first painted frame is already the animation's start state (no flash).
 * When the user prefers reduced motion, `reduced` is true: callers should
 * settle elements into their final state instead of animating.
 */
export function useGsap(
  fn: (ctx: { self: HTMLElement; reduced: boolean }) => void,
  deps: unknown[] = [],
): RefObject<HTMLDivElement | null> {
  const scope = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const self = scope.current;
    if (!self) return;
    const reduced = prefersReducedMotion();
    const ctx = gsap.context(() => fn({ self, reduced }), self);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return scope;
}

/**
 * The app's standard entrance: content rises and fades in, staggered in the
 * order it appears. Elements opt in with `data-reveal`.
 */
export function revealIn(
  scope: HTMLElement,
  reduced: boolean,
  opts: { selector?: string; y?: number; stagger?: number; delay?: number } = {},
): void {
  const { selector = "[data-reveal]", y = 14, stagger = 0.055, delay = 0 } = opts;
  const targets = gsap.utils.toArray<HTMLElement>(scope.querySelectorAll(selector));
  if (targets.length === 0) return;
  if (reduced) {
    gsap.set(targets, { opacity: 1, y: 0, clearProps: "transform" });
    return;
  }
  gsap.fromTo(
    targets,
    { opacity: 0, y },
    {
      opacity: 1,
      y: 0,
      duration: DUR.base,
      ease: EASE.out,
      stagger,
      delay,
      clearProps: "transform",
    },
  );
}

/**
 * Counts a number up to its value. Used once per screen, on the one figure
 * that is the point of the screen.
 */
export function countTo(
  el: HTMLElement,
  value: number,
  reduced: boolean,
  format: (n: number) => string,
): void {
  if (reduced || value === 0) {
    el.textContent = format(value);
    return;
  }
  const obj = { n: 0 };
  gsap.to(obj, {
    n: value,
    duration: DUR.slow,
    ease: EASE.emphasis,
    onUpdate: () => {
      el.textContent = format(obj.n);
    },
  });
}

/** Press feedback for anything tappable. Attach to a ref'd element. */
export function pressable(el: HTMLElement | null): () => void {
  if (!el || prefersReducedMotion()) return () => {};
  const to = gsap.quickTo(el, "scale", { duration: DUR.micro, ease: EASE.out });
  const down = () => to(0.972);
  const up = () => to(1);
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointerleave", up);
  el.addEventListener("pointercancel", up);
  return () => {
    el.removeEventListener("pointerdown", down);
    el.removeEventListener("pointerup", up);
    el.removeEventListener("pointerleave", up);
    el.removeEventListener("pointercancel", up);
  };
}

/**
 * A masthead figure that recedes as the page scrolls under it. Used once per
 * screen, on the screen's single focal element, so scrolling feels like moving
 * a sheet of paper rather than sliding a list.
 */
export function recedeOnScroll(el: HTMLElement, reduced: boolean): void {
  if (reduced) return;
  gsap.to(el, {
    opacity: 0.12,
    y: -18,
    scale: 0.97,
    ease: "none",
    scrollTrigger: {
      trigger: el,
      start: "top top+=90",
      end: "+=180",
      scrub: 0.4,
    },
  });
}

/**
 * Rows that arrive as they enter the viewport. Deliberately restrained: a short
 * rise, no fade-out on exit, and nothing re-animates on scroll back.
 */
export function revealRows(
  scope: HTMLElement,
  reduced: boolean,
  selector = "[data-row]",
): void {
  const rows = gsap.utils.toArray<HTMLElement>(scope.querySelectorAll(selector));
  if (rows.length === 0) return;
  if (reduced) {
    gsap.set(rows, { opacity: 1, y: 0 });
    return;
  }
  rows.forEach((row) => {
    gsap.fromTo(
      row,
      { opacity: 0, y: 16 },
      {
        opacity: 1,
        y: 0,
        duration: DUR.base,
        ease: EASE.out,
        scrollTrigger: { trigger: row, start: "top bottom-=40", once: true },
      },
    );
  });
}
