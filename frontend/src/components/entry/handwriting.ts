"use client";

import gsap from "gsap";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * THE PAGE BEING WRITTEN.
 *
 * The pad had no content entrance at all: the turn animated, the crowd on the
 * welcome moved, and everything else simply appeared, which is why a deck full
 * of handwriting still read as printed.
 *
 * A sheet now arrives the way a page gets filled. Objects are stuck down first,
 * then the writing goes on line by line, then the marks that annotate it are
 * drawn last, because you underline a heading after you have written it and you
 * circle the thing to do next after that.
 *
 * **Markers, not per screen code.** Every sheet is composed from the same paper
 * kit, so the kit carries the markers and any new page is animated the moment
 * it is built out of `Sticky`, `Ink`, `Underline` and the rest:
 *
 *     [data-paper]     something stuck on the page: lands, then holds
 *     [data-tilt]      the drift and press layer inside it
 *     [data-write]     writing: wiped on left to right
 *     [data-stroke]    an SVG path: drawn from one end
 *     [data-headline]  the enormous chapter word, which gets its own moment
 *
 * **One system per property, which is why the objects are two elements.**
 * `Sticky` keeps its own inline tilt, the wrapper's rotation is the drift's
 * alone, and the press only ever writes scale. Three systems on one transform
 * is the trap this codebase has hit more times than any other.
 */

/** Roughly the speed of a hand, not of a UI. */
const WIPE = 0.42;
const DRAW = 0.5;

/**
 * Put every marked element in its finished state.
 *
 * Called on the reduced motion path, and it is also the reason the entrance is
 * safe: nothing here is decoration that content depends on, so a deck that
 * never animates is a deck that simply looks written already.
 */
function settle(q: gsap.utils.SelectorFunc) {
  // Guarded, because a sheet need not use every marker: the welcome has no
  // paper on it at all, and `gsap.set` on an empty selection warns to the
  // console rather than doing nothing quietly.
  const set = (sel: string, vars: gsap.TweenVars) => {
    const els = q(sel);
    if (els.length) gsap.set(els, vars);
  };
  set("[data-paper]", { opacity: 1, y: 0 });
  set("[data-write], [data-headline]", { opacity: 1, clipPath: "none" });
  set("[data-stroke]", { strokeDasharray: "none", strokeDashoffset: 0 });
}

/**
 * Play a sheet in. Call inside a `gsap.context` so it is reverted with the page.
 *
 * The caller passes the sheet root, and everything is found beneath it, so the
 * shell never has to know what any particular chapter is made of.
 */
export function playSheet(root: HTMLElement): void {
  const q = gsap.utils.selector(root);

  if (prefersReducedMotion()) {
    settle(q);
    return;
  }

  const paper = q("[data-paper]");
  const write = q("[data-write]");
  const strokes = q("[data-stroke]") as unknown as SVGPathElement[];
  const headline = q("[data-headline]");

  const tl = gsap.timeline();

  // Stuck down first. A short drop and a settle, never a slide: paper arrives
  // onto a page, it does not travel across it.
  if (paper.length) {
    tl.fromTo(
      paper,
      { opacity: 0, y: -12 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: "back.out(2.2)",
        stagger: 0.07,
        clearProps: "y",
      },
      0,
    );
  }

  // Then the writing, wiped on rather than faded. The inset is negative top and
  // bottom so ascenders and descenders are never shaved by the clip.
  if (write.length) {
    tl.fromTo(
      write,
      { clipPath: "inset(-30% 100% -30% -2%)", opacity: 1 },
      {
        clipPath: "inset(-30% -2% -30% -2%)",
        duration: WIPE,
        ease: "power1.inOut",
        stagger: 0.09,
        clearProps: "clipPath",
      },
      0.12,
    );
  }

  // Then the marks that annotate what is now on the page.
  strokes.forEach((path, i) => {
    // A path with no geometry yet (display none, or not laid out) reports 0 and
    // would be dashed into invisibility.
    const len = path.getTotalLength?.() ?? 0;
    if (!len) return;
    tl.fromTo(
      path,
      { strokeDasharray: len, strokeDashoffset: len },
      {
        strokeDashoffset: 0,
        duration: DRAW,
        ease: "power2.out",
        // Left as drawn: an offset of zero with a full length dash paints the
        // whole path, and clearing the dash mid-revert is what would flash.
      },
      0.3 + i * 0.05,
    );
  });

  // The word last, and slower. It is the sheet's signature, so it is written
  // rather than revealed: a wipe at the pace of a marker stroke.
  if (headline.length) {
    tl.fromTo(
      headline,
      { clipPath: "inset(-25% 100% -25% -1%)" },
      {
        clipPath: "inset(-25% -1% -25% -1%)",
        duration: 0.72,
        ease: "power2.inOut",
        clearProps: "clipPath",
      },
      0.34,
    );
  }
}

/**
 * The idle life: paper that is not quite stuck down.
 *
 * Deliberately breaking the standing rule against looping motion, and kept
 * within the terms that made the sign in greeting worth breaking it for: it is
 * slow, it is sub-degree, and it never moves anything you are in the middle of
 * reading, because it rotates the note rather than the line.
 *
 * Each note is seeded from its own index and SEEKED into its cycle, so a page
 * of them never breathes in unison, which is what would read as a page wobble
 * rather than as paper.
 */
export function driftPaper(root: HTMLElement): void {
  if (prefersReducedMotion()) return;

  gsap.utils.toArray<HTMLElement>(root.querySelectorAll("[data-tilt]")).forEach((el, i) => {
    const period = 5.5 + (i % 3) * 1.4;
    const swing = 0.5 + (i % 2) * 0.35;
    const t = gsap.to(el, {
      rotation: i % 2 ? swing : -swing,
      duration: period,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    });
    // Offset into the cycle rather than staggering the start, so nothing waits
    // motionless for its turn on a page that is already still.
    t.totalTime(((i * 0.37) % 1) * period * 2);
  });
}

/**
 * A note presses under a finger.
 *
 * Delegated from the sheet root rather than wired per component, so the paper
 * kit stays free of handlers and a new page gets it for nothing.
 *
 * **Scale only.** The drift above owns rotation on this exact element, and a
 * press that also wrote rotation would kill the loop and leave that note dead
 * for the rest of the sheet.
 */
export function pressPaper(root: HTMLElement): () => void {
  if (prefersReducedMotion()) return () => {};

  const to = (el: Element, scale: number) =>
    gsap.to(el, { scale, duration: scale < 1 ? 0.12 : 0.5, ease: scale < 1 ? "power2.out" : "back.out(2.6)", overwrite: "auto" });

  const down = (e: PointerEvent) => {
    const el = (e.target as Element | null)?.closest?.("[data-tilt]");
    if (el) to(el, 0.975);
  };
  const up = (e: PointerEvent) => {
    const el = (e.target as Element | null)?.closest?.("[data-tilt]");
    if (el) to(el, 1);
  };

  root.addEventListener("pointerdown", down);
  root.addEventListener("pointerup", up);
  root.addEventListener("pointercancel", up);
  root.addEventListener("pointerleave", up, true);
  return () => {
    root.removeEventListener("pointerdown", down);
    root.removeEventListener("pointerup", up);
    root.removeEventListener("pointercancel", up);
    root.removeEventListener("pointerleave", up, true);
  };
}
