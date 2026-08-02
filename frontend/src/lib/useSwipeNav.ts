"use client";

import { useEffect, type RefObject } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { captureOutgoing, DUR, EASE, prefersReducedMotion } from "./motion";
import { TAB_HREFS } from "./tabs";

// How far a swipe must travel to count, and how much of the finger's movement
// the screen follows on the way there.
const COMMIT = 68;
const FOLLOW = 0.45;
/** At the ends of the bar there is nowhere to go, so the screen barely moves. */
const RUBBER = 0.16;

/**
 * Swipe left or right to move between tabs.
 *
 * The screen follows the finger a little rather than waiting for release, so
 * the gesture is answered immediately and the commit threshold is discoverable
 * by feel. Past the threshold it hands over to the same `pageOut` the tab bar
 * uses, so a swipe and a tap end in exactly the same movement.
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

    const targetFor = (dx: number) => index + (dx < 0 ? 1 : -1);
    const inRange = (i: number) => i >= 0 && i < TAB_HREFS.length;

    const onStart = (e: TouchEvent) => {
      // An open sheet or panel owns the gesture; so does a second finger.
      if (e.touches.length !== 1) return;
      if (document.querySelector("[role=dialog]")) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      axis = null;
      tracking = true;
      dragEl = main();
      setX = dragEl ? gsap.quickSetter(dragEl, "x", "px") as (v: number) => void : null;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      // Locked once, on the first real movement, so a swipe that drifts never
      // turns into a scroll and a scroll never turns into a navigation.
      if (!axis) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
      if (axis !== "x") return;

      e.preventDefault();
      if (prefersReducedMotion()) return;
      const resist = inRange(targetFor(dx)) ? FOLLOW : RUBBER;
      setX?.(dx * resist);
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      if (axis !== "x") return;

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

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [scope, pathname, router, ready]);
}
