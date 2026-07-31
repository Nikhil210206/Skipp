"use client";

// The single source of truth for motion. Every animation in the app goes
// through these helpers, so timing and easing stay consistent and
// prefers-reduced-motion is honoured in exactly one place.

import { useLayoutEffect, useRef, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

/**
 * Failsafe for the entrance system.
 *
 * Elements opt into an entrance by starting hidden in CSS (`[data-reveal]`,
 * `[data-word]` and friends) and are revealed by a GSAP timeline. That couples
 * *visible content* to *an animation running*, and when the animation does not
 * run the screen is not merely unanimated, it is blank. It has happened twice:
 * a scope that mounts later than its effect's dependencies, and a context
 * revert that hands the element back to its hidden CSS state.
 *
 * So anything still hidden a beat after load is shown. It only ever touches
 * elements GSAP has not written to, so it cannot fight a running tween: this
 * layer still owns the property, it just refuses to leave content invisible.
 */
function revealStragglers() {
  const hidden = document.querySelectorAll<HTMLElement>(
    "[data-reveal], [data-mark], [data-enter], [data-word], [data-draw]",
  );
  hidden.forEach((el) => {
    if (gsap.isTweening(el)) return;
    const style = getComputedStyle(el);
    const invisible = Number(style.opacity) < 0.99;
    // A word sits in a clipping box; off its own baseline means still hidden.
    const shifted = style.transform !== "none" && style.transform !== "matrix(1, 0, 0, 1, 0, 0)";
    if (invisible || shifted) {
      // No clearProps: removing the inline transform hands the element back to
      // the very CSS rule that hides it. The final state has to be written.
      gsap.set(el, { opacity: 1, x: 0, y: 0, xPercent: 0, yPercent: 0, scaleX: 1 });
    }
  });
}

if (typeof window !== "undefined") {
  // Swept twice, and the second pass is not optional. The first is late enough
  // not to interrupt an entrance and early enough that a failure reads as a
  // beat rather than a blank screen, but it lands while the launch overlay is
  // still up (that runs ~1.8s), so anything still tweening at 900ms is skipped
  // and never looked at again. An entrance that is created late, or reverted by
  // a re-render after the first sweep, would stay invisible for good.
  window.setTimeout(revealStragglers, 900);
  window.setTimeout(revealStragglers, 2400);
}

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

/**
 * Press feedback for anything tappable. Attach to a ref'd element.
 *
 * Uses gsap.to rather than quickTo: quickTo does not reliably apply the `scale`
 * transform shorthand, so the press was silently doing nothing.
 */
export function pressable(el: HTMLElement | null): () => void {
  if (!el || prefersReducedMotion()) return () => {};
  const to = (scale: number) =>
    gsap.to(el, { scale, duration: DUR.micro, ease: EASE.out, overwrite: "auto" });
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
    gsap.killTweensOf(el);
  };
}

/**
 * A masthead figure that recedes as the page scrolls under it. Used once per
 * screen, on the screen's single focal element.
 *
 * Opacity only, and the element must NOT also be a `data-reveal` target: two
 * systems writing the same property is what made this fade stick.
 */
export function recedeOnScroll(el: HTMLElement, reduced: boolean): void {
  if (reduced) return;
  gsap.fromTo(
    el,
    { opacity: 1 },
    {
      opacity: 0.12,
      ease: "none",
      // Without this the tween captures whatever opacity happens to be set when
      // it is built, so a re-run starts from the faded value and compounds.
      immediateRender: false,
      overwrite: "auto",
      scrollTrigger: {
        trigger: el,
        // Begins only once the block has actually reached the top of the
        // viewport, so it is fully opaque at rest.
        start: "top top",
        end: "+=200",
        scrub: 0.4,
        // Positions are measured while the page is still settling, so let them
        // be recomputed rather than trusting the first measurement.
        invalidateOnRefresh: true,
      },
    },
  );
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

/**
 * Which way the last navigation travelled: 1 to the right, -1 to the left, 0
 * when it was not a move along the tab bar. Module scope because the outgoing
 * screen sets it and the incoming screen, a different mount entirely, reads it.
 */
let navDirection = 0;

/**
 * A still of the screen being left, held in the DOM so both surfaces can move
 * together.
 *
 * Animating the old screen out, then navigating, then animating the new one in
 * cannot glide: nothing is ever moving at the same time, and the mount sits in
 * the gap. React only ever has one screen mounted, so the other one has to be a
 * snapshot.
 */
let outgoing: HTMLElement | null = null;

/**
 * Freeze the screen being left exactly where it is, including any distance the
 * finger has already dragged it, and navigate immediately. `pageIn` moves this
 * and the arriving screen as one gesture.
 */
export function captureOutgoing(el: HTMLElement | null, dir: number): void {
  navDirection = dir;
  outgoing?.remove();
  outgoing = null;
  if (!el || dir === 0 || prefersReducedMotion()) return;

  // The rect already includes the drag offset, so pinning to it and clearing
  // the transform continues from wherever the finger let go.
  const r = el.getBoundingClientRect();
  const clone = el.cloneNode(true) as HTMLElement;
  clone.setAttribute("aria-hidden", "true");
  clone.style.cssText =
    `position:fixed;left:${r.left}px;top:${r.top}px;` +
    `width:${r.width}px;height:${r.height}px;margin:0;` +
    `overflow:hidden;pointer-events:none;z-index:25;` +
    `transform:translateZ(0);will-change:transform;`;
  document.body.appendChild(clone);
  outgoing = clone;
}

/**
 * Slide the snapshot off one side while the arriving screen comes in from the
 * other, on one tween each with identical timing, so the two read as a single
 * surface turning over. Translate only: no opacity, which keeps it on the
 * compositor and off the paint path.
 */
export function pageIn(el: HTMLElement | null): void {
  const dir = navDirection;
  const prev = outgoing;
  navDirection = 0;
  outgoing = null;

  if (!el || dir === 0 || prefersReducedMotion()) {
    prev?.remove();
    if (el) gsap.set(el, { x: 0, opacity: 1 });
    return;
  }

  const width = el.getBoundingClientRect().width || window.innerWidth;
  const travel = width * dir;

  if (prev) {
    gsap.to(prev, {
      x: -travel,
      duration: DUR.slow,
      ease: EASE.emphasis,
      onComplete: () => prev.remove(),
    });
  }
  gsap.fromTo(
    el,
    { x: travel, opacity: 1 },
    { x: 0, duration: DUR.slow, ease: EASE.emphasis, overwrite: "auto" },
  );
}

/**
 * The entrance choreography shared by the intro and the sign-in screen.
 *
 * One timeline so the beats stay in proportion to each other: the mark, then the
 * headline sliding up out of its own clipping boxes, then a rule drawn left to
 * right, then everything else. It runs once and stops; nothing here loops.
 */
export function playEntrance(
  scope: HTMLElement,
  reduced: boolean,
  opts: { delay?: number } = {},
): gsap.core.Timeline | null {
  const mark = scope.querySelectorAll("[data-mark]");
  const words = scope.querySelectorAll("[data-word]");
  const rules = scope.querySelectorAll("[data-draw]");
  const rest = scope.querySelectorAll("[data-enter]");

  if (reduced) {
    gsap.set([...mark, ...words, ...rest], { opacity: 1, y: 0, yPercent: 0 });
    gsap.set(rules, { scaleX: 1, opacity: 1 });
    return null;
  }

  const tl = gsap.timeline({ delay: opts.delay ?? 0 });
  tl.fromTo(
    mark,
    { opacity: 0, y: 8 },
    { opacity: 1, y: 0, duration: DUR.base, ease: EASE.out },
  )
    .fromTo(
      words,
      { yPercent: 110 },
      { yPercent: 0, duration: 0.72, ease: EASE.emphasis, stagger: 0.045 },
      0.08,
    )
    .fromTo(
      rules,
      { scaleX: 0, opacity: 1 },
      { scaleX: 1, duration: 0.7, ease: EASE.emphasis, transformOrigin: "left center" },
      0.34,
    )
    .fromTo(
      rest,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: DUR.base, ease: EASE.out, stagger: 0.07 },
      0.44,
    );
  return tl;
}
