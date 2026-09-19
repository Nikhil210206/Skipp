"use client";

// The single source of truth for motion. Every animation in the app goes
// through these helpers, so timing and easing stay consistent and
// prefers-reduced-motion is honoured in exactly one place.

import { useLayoutEffect, useRef, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { haptic } from "./haptics";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
  // A mobile browser resizes its own viewport as the address bar hides and
  // shows, and ScrollTrigger treats a resize as a reason to remeasure the whole
  // document. That is a full refresh landing in the middle of the scroll that
  // caused it, which is precisely the moment there is nothing to spare. The
  // flag exists for exactly this and ignores the vertical resizes a mobile
  // browser makes on its own, while still honouring a real orientation change.
  ScrollTrigger.config({ ignoreMobileResize: true });
}

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

/**
 * How long the arriving screen takes to fade up on a tab change.
 *
 * **Tabs switch, they do not slide.** Six passes went into tuning a full screen
 * push (a snapshot of the old screen cloned into the body, parallax, springs,
 * 0.62s then 0.3s) and it was still reported as laggy on every device. That is
 * structural rather than a matter of timing: a push moves two whole screens
 * across the display on the exact frames the new one is mounting and running
 * its entrance, and cloning the old screen is itself a full DOM copy and a
 * fresh raster on the tap frame. Native tab bars on iOS and Android do not
 * slide at all, they swap, which is why they feel instant.
 *
 * So the new screen is in place on its first frame and fades up from a short
 * nudge in the direction of travel: one opacity and one small translate on a
 * layer that already exists, and nothing else moving.
 */
const PAGE = 0.2;
/** How far the arriving screen is nudged, in px, so the switch still has a direction. */
const NUDGE = 14;

/** Durations, in seconds (GSAP's unit). */
export const DUR = {
  micro: 0.14,
  quick: 0.24,
  base: 0.42,
  slow: 0.62,
} as const;

/**
 * Easing vocabulary. Out for entrances, inOut for moves, in for exits, and the
 * two springs for anything that should feel alive.
 *
 * The springs overshoot and settle, which is the difference between an app that
 * moves and an app that feels like it enjoys being used. They are deliberately
 * mild: `back.out(1.7)` is a nudge past the target, not a cartoon.
 */
export const EASE = {
  out: "power3.out",
  emphasis: "expo.out",
  inOut: "power2.inOut",
  in: "power2.in",
  /** Arrivals: content settling into place. */
  spring: "back.out(1.7)",
  /** Controls: a quick pop, tighter and slightly cheekier. */
  pop: "back.out(3)",
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

    // Built immediately. Deferring the WHOLE entrance until the slide finished
    // was tried and it made every arrival feel dead: the screen glided in and
    // then sat there before anything moved. Only the ScrollTrigger creation
    // inside `revealRows` waits now, because that is the part that measures the
    // document and costs the frames.
    const ctx = gsap.context(() => fn({ self, reduced }), self);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return scope;
}

/**
 * The app's standard entrance: content rises and fades in, staggered in the
 * order it appears. Elements opt in with `data-reveal`.
 *
 * **No blur, and that is a performance decision rather than a taste one.** This
 * used to animate `filter: blur(10px)` to zero, borrowed from the onboarding
 * deck so a tab change read as the same publication as the way in. A filter
 * forces the element onto its own offscreen buffer and re-rasterises it every
 * single frame, and this fires on up to twelve elements at once on Home, on
 * every arrival. It was the most expensive thing in the app, running at exactly
 * the moment there was least to spare.
 *
 * Transform and opacity only, which is the rule the rest of the codebase
 * already holds itself to (see the greeting's handover, and `pageIn`). Both
 * stay on the compositor, so the whole entrance costs about as much as one
 * blurred element used to.
 *
 * **The stagger is a total, not a per element gap.** `{ amount }` distributes
 * the whole stagger across however many targets there are, so a screen with
 * twelve rows settles in the same time as one with three. A per element gap
 * silently made the busiest screen the slowest, which is backwards.
 */
export function revealIn(
  scope: HTMLElement,
  reduced: boolean,
  opts: {
    selector?: string;
    y?: number;
    /** Total time the stagger is spread over, in seconds. */
    stagger?: number;
    delay?: number;
  } = {},
): void {
  const { selector = "[data-reveal]", y = 16, stagger = 0.14, delay = 0.05 } = opts;
  const targets = gsap.utils.toArray<HTMLElement>(scope.querySelectorAll(selector));
  if (targets.length === 0) return;
  if (settleEntrance(reduced)) {
    gsap.set(targets, { opacity: 1, y: 0, clearProps: "transform" });
    return;
  }
  gsap.fromTo(
    targets,
    { opacity: 0, y },
    {
      opacity: 1,
      y: 0,
      duration: 0.3,
      ease: EASE.out,
      stagger: { amount: stagger },
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
  if (settleEntrance(reduced) || value === 0) {
    el.textContent = format(value);
    return;
  }
  const obj = { n: 0 };
  gsap.to(obj, {
    n: value,
    // Counters must NOT spring: `back` overshoots past the value, so a
    // percentage would visibly tick above the real number and come back.
    // Wrong in a way nobody would forgive on an attendance figure.
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
  // Down is fast and flat, release springs past 1 and settles. A control that
  // only shrinks feels like a picture of a button; the overshoot on the way
  // back is the part that reads as physical. 0.972 was too small to see at all,
  // which is why every tap in the app felt inert.
  const down = () =>
    gsap.to(el, { scale: 0.94, duration: 0.09, ease: EASE.in, overwrite: "auto" });
  const up = () =>
    gsap.to(el, { scale: 1, duration: 0.5, ease: EASE.pop, overwrite: "auto" });
  const press = () => {
    haptic("tick");
    down();
  };
  el.addEventListener("pointerdown", press);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointerleave", up);
  el.addEventListener("pointercancel", up);
  return () => {
    el.removeEventListener("pointerdown", press);
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
  // Its own layer for as long as the screen is up. This is the poster figure,
  // the largest piece of type on the page, and its opacity is rewritten on
  // every frame of every scroll: unpromoted, that is a full re-rasterisation of
  // the biggest glyphs in the app, once a frame, on the phone that has least to
  // give. Promoted, opacity is a compositor property and the scroll costs
  // nothing. There is one of these per screen and it lives and dies with the
  // screen, so there is no layer churn to pay for.
  gsap.set(el, { willChange: "opacity" });
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
  if (settleEntrance(reduced)) {
    gsap.set(rows, { opacity: 1, y: 0 });
    return;
  }
  // ONE batch rather than a ScrollTrigger per row, and no longer deferred.
  //
  // Both halves of that were the same bug. A trigger per row meant N separate
  // measurements of the document, which a trace once caught putting 51ms of
  // forced reflow inside GSAP's computed style reads during a page change, and
  // the fix at the time was to hold them all until the transition had finished.
  // That traded jank for lateness: rows below the fold could not begin until
  // the slide was over. `batch` shares one refresh cycle and one callback
  // across the whole set, which is cheap enough to simply run when asked.
  gsap.set(rows, { opacity: 0, y: 14 });
  ScrollTrigger.batch(rows, {
    start: "top bottom-=40",
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, {
        opacity: 1,
        y: 0,
        duration: 0.34,
        ease: EASE.out,
        stagger: { amount: 0.12 },
        overwrite: "auto",
      }),
  });
}

/**
 * Which way the last navigation travelled: 1 to the right, -1 to the left, 0
 * when it was not a move along the tab bar. Module scope because the tab bar or
 * the swipe sets it and `pageIn`, run by the shell once the route commits,
 * reads it.
 */
let navDirection = 0;

/**
 * True from the moment a tab change is asked for until the new screen has
 * arrived.
 *
 * The screens' own entrances (`revealIn`, `revealRows`, `countTo`) read it and
 * settle instantly instead of animating. On a tab change the page fade IS the
 * entrance: stacking a staggered reveal of seventeen elements and a counter
 * running up from zero on top of it is what made every switch trickle in over
 * half a second after the screen had already arrived, which reads as lag
 * however smooth each frame is. They still play on the first arrival after
 * launch, where there is no page fade.
 *
 * **It is held open briefly PAST the arrival, not cleared by it.** The shell
 * sees the new pathname a commit or two before the route's page content
 * commits, so a screen's entrance can run after `pageIn` has already fired.
 * Measured: with the flag cleared in `pageIn`, every row on Attendance still
 * faded in on its own after the screen had arrived.
 */
let switching = false;
let switchingUntil = 0;
const SETTLE_WINDOW = 600;

/** Whether a screen's entrance should settle rather than play. */
function settleEntrance(reduced: boolean): boolean {
  return reduced || switching || performance.now() < switchingUntil;
}

/**
 * A tab change has been asked for. Records the direction and, for a swipe,
 * carries the dragged screen on out of the way while the route commits.
 *
 * There is deliberately no snapshot any more. The old screen used to be cloned
 * into the body so it could slide off while the new one slid in; cloning a
 * full screen of DOM on the tap frame and rasterising it as a fresh layer was
 * the single most expensive thing a tap did. The live screen simply stays put
 * until React swaps its contents, which for a prefetched tab is a frame or two.
 */
export function captureOutgoing(el: HTMLElement | null, dir: number): void {
  navDirection = dir;
  switching = dir !== 0;
  if (!el || dir === 0 || prefersReducedMotion()) return;

  // Only a swipe leaves the screen off centre. Finish that gesture: keep it
  // travelling the way the finger was going and fade it, so the handover from
  // "following my finger" to "the next screen" never stops dead. A tap has no
  // offset, and the old screen just holds still until it is replaced.
  const x = Number(gsap.getProperty(el, "x")) || 0;
  if (x === 0) return;
  gsap.to(el, {
    x: x - dir * 40,
    // Not to zero: if the route is slow to commit (a cold dev compile, a tab
    // that was never prefetched) a fully faded screen would sit there blank.
    opacity: 0.3,
    duration: 0.12,
    ease: EASE.in,
    force3D: true,
    overwrite: "auto",
  });
}

/**
 * The screen you asked for fades up from a short nudge. Runs once the route has
 * committed, against `main`, whose children have just been swapped.
 */
export function pageIn(el: HTMLElement | null): void {
  const dir = navDirection;
  navDirection = 0;
  if (switching) switchingUntil = performance.now() + SETTLE_WINDOW;
  switching = false;
  if (!el) return;

  if (dir === 0 || prefersReducedMotion()) {
    gsap.set(el, { x: 0, opacity: 1, clearProps: "opacity" });
    return;
  }

  gsap.fromTo(
    el,
    { x: NUDGE * dir, opacity: 0 },
    {
      x: 0,
      opacity: 1,
      duration: PAGE,
      ease: EASE.out,
      // Pinned to 3D so the layer `main` already carries is reused: on `auto`
      // GSAP drops to a 2D translate at both ends of the tween and the screen
      // is re-rasterised on its first and last frames.
      force3D: true,
      overwrite: "auto",
      // Leave no inline opacity behind: a later effect writing opacity to
      // `main` must not have to fight a stale 1.
      clearProps: "opacity",
    },
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
    const settled = [...mark, ...words, ...rest];
    if (settled.length) gsap.set(settled, { opacity: 1, y: 0, yPercent: 0 });
    if (rules.length) gsap.set(rules, { scaleX: 1, opacity: 1 });
    return null;
  }

  // Each part is optional: not every entry screen uses every marker, and the
  // sign in uses only some of them. `fromTo` on an empty selection warns to the
  // console on every visit rather than doing nothing quietly.
  const tl = gsap.timeline({ delay: opts.delay ?? 0 });
  const part = (
    targets: NodeListOf<Element>,
    from: gsap.TweenVars,
    to: gsap.TweenVars,
    at: number,
  ) => {
    if (targets.length) tl.fromTo(targets, from, to, at);
  };

  part(mark, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: DUR.base, ease: EASE.out }, 0);
  part(
    words,
    { yPercent: 110 },
    { yPercent: 0, duration: 0.72, ease: EASE.emphasis, stagger: 0.045 },
    0.08,
  );
  part(
    rules,
    { scaleX: 0, opacity: 1 },
    { scaleX: 1, duration: 0.7, ease: EASE.emphasis, transformOrigin: "left center" },
    0.34,
  );
  part(
    rest,
    { opacity: 0, y: 14 },
    { opacity: 1, y: 0, duration: DUR.base, ease: EASE.out, stagger: 0.07 },
    0.44,
  );
  return tl;
}

