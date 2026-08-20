"use client";

import { useEffect, type RefObject } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { captureOutgoing, DUR, EASE, prefersReducedMotion } from "./motion";
import { TAB_HREFS } from "./tabs";

/** How far a swipe must travel, measured on the FINGER, before it counts. */
const COMMIT = 68;
/**
 * How far the screen is allowed to fall behind the finger, and how quickly it
 * gives that ground up.
 *
 * It used to be a flat 45% of the finger's travel, and a flat fraction is the
 * one thing a drag must never be: at 45% the screen moves at a different speed
 * from the hand holding it, from the very first pixel, and the eye reads that
 * as the app being slow rather than as the gesture resisting. It is the same
 * complaint whatever the frame rate.
 *
 * So the follow is 1:1 where it is judged, in the opening pixels, and gives way
 * only as the pull gets long: `LIMIT * (1 - e^(-d / LIMIT))` is exactly the
 * finger's own travel near zero and never passes LIMIT however hard it is
 * pulled. At 20px the screen has moved 18.6, at the commit point 52.9, and at
 * 200px it has settled at about 102 and stopped chasing.
 *
 * `EDGE` is the same curve with almost no room in it, for the ends of the bar
 * where there is nowhere to go.
 */
const LIMIT = 130;
const EDGE = 34;
/**
 * How far a finger travels before the gesture is read as horizontal.
 *
 * Deliberately short. Every pixel spent undecided is a pixel where neither we
 * nor the browser is drawing anything, and on iOS it is worse than idle: the
 * page decides at the START of a gesture whether it is going to scroll, so a
 * long undecided window is a window in which the scroller can take the gesture
 * away for good. `touch-action` below is what really settles that, and this
 * just stops the screen sitting still while the finger is already moving.
 */
const SLOP = 6;

/** How far the screen has fallen behind, for a finger that has travelled `d`. */
function follow(d: number, room: number): number {
  const sign = d < 0 ? -1 : 1;
  return sign * room * (1 - Math.exp(-Math.abs(d) / room));
}

/**
 * Swipe left or right to move between tabs.
 *
 * The screen follows the finger rather than waiting for release, so the gesture
 * is answered immediately and the commit threshold is discoverable by feel.
 * Past the threshold it hands over to the same `pageOut` the tab bar uses, so a
 * swipe and a tap end in exactly the same movement.
 *
 * **The shell declares `touch-action: pan-y`, and that is what makes any of
 * this smooth.** Without it the browser owns every axis until JavaScript says
 * otherwise, so a horizontal drag begins as a scroll the browser is trying to
 * start and we are trying to cancel: on iOS the cancel arrives too late to be
 * honoured at all (the same lesson `PullToRefresh` learned the hard way), and
 * in a WebView the compositor waits on our handler before it will move a pixel.
 * Declaring the axis up front means the browser never enters the argument:
 * vertical stays its, horizontal is ours from the first pixel, and neither has
 * to ask the other.
 */
export function useSwipeNav(
  scope: RefObject<HTMLElement | null>,
  pathname: string,
  /**
   * Whether the shell is actually rendered. Required: AppShell shows a restore
   * frame first, so without it this effect runs once against a null ref and
   * never again, and the gesture silently never attaches.
   */
  ready: boolean,
): void {
  const router = useRouter();

  useEffect(() => {
    const el = scope.current;
    if (!ready || !el) return;

    const index = TAB_HREFS.indexOf(pathname as (typeof TAB_HREFS)[number]);
    if (index === -1) return; // not a tab screen, so there is nothing to swipe between

    const main = () => document.querySelector<HTMLElement>("main:not([aria-hidden])");
    /**
     * Resolved once per gesture, with a quickSetter bound to it.
     *
     * The drag used to run `document.querySelector` AND `gsap.set` on **every
     * touchmove**, which is a DOM query plus a full property parse per frame
     * while the finger is moving. A quickSetter skips the parsing entirely and
     * writes straight to the element, which is the whole reason it exists.
     */
    let dragEl: HTMLElement | null = null;
    let setX: ((v: number) => void) | null = null;
    let startX = 0;
    let startY = 0;
    let axis: null | "x" | "y" = null;
    let tracking = false;
    /** Read once per gesture: `matchMedia` is not free, and this cannot change mid swipe. */
    let reduced = false;

    /**
     * One write per FRAME, not one per touch event.
     *
     * A phone digitiser samples faster than the screen draws (120Hz and up on
     * plenty of Android hardware, and iOS coalesces several samples into one
     * event of its own accord), so a handler that writes as it is called sets
     * the same property two or three times between paints. Every one of those
     * writes costs a style recalculation and only the last is ever seen.
     */
    let frame = 0;
    let pending = 0;
    const draw = () => {
      frame = 0;
      setX?.(pending);
    };
    const schedule = (v: number) => {
      pending = v;
      if (!frame) frame = requestAnimationFrame(draw);
    };
    /** Land the last scheduled value now, so a tween starts from what is on screen. */
    const flush = () => {
      if (!frame) return;
      cancelAnimationFrame(frame);
      frame = 0;
      setX?.(pending);
    };

    const targetFor = (dx: number) => index + (dx < 0 ? 1 : -1);
    const inRange = (i: number) => i >= 0 && i < TAB_HREFS.length;

    const onStart = (e: TouchEvent) => {
      // An open sheet or panel owns the gesture; so does a second finger.
      if (e.touches.length !== 1) return;
      if (document.querySelector("[role=dialog]")) return;
      // The tab bar is inside this scope and runs its own horizontal drag, so
      // without this a finger moving along the bar would be read as a swipe
      // between screens at the same time as a drag along the bar, and the two
      // would each navigate.
      if ((e.target as Element | null)?.closest?.("[data-nav]")) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      axis = null;
      tracking = true;
      reduced = prefersReducedMotion();
      pending = 0;
      dragEl = main();
      if (dragEl) {
        // **`force3D`, and it is not a detail.** A quickSetter renders a plain
        // 2D `translate()` unless the cache says otherwise (GSAP only reaches
        // for 3D part way through a tween), and a 2D translate is not a
        // compositor move: the browser re-rasterises the whole screen of text
        // on every frame of the drag. On a phone that is the difference between
        // a gesture that glides and one that crawls. `main` also carries a
        // standing `will-change: transform`, so the layer is already there and
        // this cannot cost a promotion mid gesture.
        gsap.set(dragEl, { force3D: true });
        setX = gsap.quickSetter(dragEl, "x", "px") as (v: number) => void;
      } else {
        setX = null;
      }
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      // Locked once, on the first real movement, so a swipe that drifts never
      // turns into a scroll and a scroll never turns into a navigation.
      if (!axis) {
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (axis === "y") {
          // The page's, and it stays the page's for the rest of this touch.
          // Standing down here rather than testing the axis on every later move
          // is what keeps an ordinary scroll from paying for this gesture at
          // all: the handler returns on its first line from now on.
          tracking = false;
          return;
        }
      }

      // `touch-action` has already told the browser this axis is ours, so this
      // is the belt to that pair of braces: it costs nothing, and it is the one
      // thing that still works if a WebView ever ignores the declaration.
      e.preventDefault();
      if (reduced) return;
      schedule(follow(dx, inRange(targetFor(dx)) ? LIMIT : EDGE));
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      if (axis !== "x") return;
      flush();

      const dx = e.changedTouches[0].clientX - startX;
      const next = targetFor(dx);
      if (Math.abs(dx) >= COMMIT && inRange(next)) {
        // Snapshot where the finger left it and navigate at once, so the
        // arriving screen picks the movement up rather than starting over.
        captureOutgoing(dragEl, dx < 0 ? 1 : -1);
        router.push(TAB_HREFS[next]);
        return;
      }
      // Springs back, matching everything else the app does on release.
      gsap.to(dragEl, {
        x: 0,
        duration: DUR.slow,
        ease: EASE.spring,
        overwrite: "auto",
      });
    };

    /**
     * The gesture was taken away rather than finished: a system edge swipe, an
     * incoming call, a second finger. Wired to `onEnd` this navigated people to
     * tabs they never released on, which is the same bug the tab bar's own drag
     * had to be corrected for. A cancelled swipe abandons and puts the screen
     * back where it started.
     */
    const onCancel = () => {
      if (!tracking) return;
      tracking = false;
      if (axis !== "x") return;
      flush();
      gsap.to(dragEl, { x: 0, duration: DUR.base, ease: EASE.emphasis, overwrite: "auto" });
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [scope, pathname, router, ready]);
}
