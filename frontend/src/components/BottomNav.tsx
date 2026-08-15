"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { captureOutgoing, DUR, EASE, prefersReducedMotion } from "@/lib/motion";
import { haptic } from "@/lib/haptics";
import { TAB_HREFS } from "@/lib/tabs";
import {
  IconAttendance,
  IconCalendar,
  IconHome,
  IconMarks,
  IconTimetable,
} from "./Icons";

// Icons only. The labels were repeating what the screen already says in its
// masthead, and five words along the bottom edge added noise to every screen.

const META: Record<string, { label: string; Icon: typeof IconMarks }> = {
  "/marks": { label: "Marks", Icon: IconMarks },
  "/attendance": { label: "Attendance", Icon: IconAttendance },
  "/dashboard": { label: "Home", Icon: IconHome },
  "/timetable": { label: "Schedule", Icon: IconTimetable },
  "/calendar": { label: "Calendar", Icon: IconCalendar },
};

const TABS = TAB_HREFS.map((href) => ({ href, ...META[href] }));

/**
 * Where the selection was last time, remembered across mounts.
 *
 * Every screen renders its own AppShell, so this bar is torn down and rebuilt
 * on each navigation: the fresh mount has no idea where the indicator was and
 * would always place it instantly. Holding the last position here is what lets
 * it travel from the tab you left to the tab you chose.
 */
let lastPlacement: { x: number; y: number; width: number; height: number } | null =
  null;

/** How far a finger must travel along the bar before it counts as a drag. */
const DRAG_SLOP = 6;

type Box = { x: number; y: number; width: number; height: number };

/** Every tab's position, measured from the bar it sits in. */
function tabBoxes(list: HTMLUListElement): { el: HTMLElement; box: Box }[] {
  return Array.from(list.querySelectorAll<HTMLElement>("[data-nav-item]")).map((el) => ({
    el,
    box: {
      x: el.offsetLeft,
      y: el.offsetTop,
      width: el.offsetWidth,
      height: el.offsetHeight,
    },
  }));
}

/**
 * Move the selection to a tab. One measurement drives both markers, so it reads
 * as a single object travelling rather than a dot sliding while a fill jumps.
 * The pill is what a theme fills, outlines or rounds; the dot is the accent
 * riding along.
 */
function placeIndicator(
  marker: HTMLElement,
  block: HTMLElement,
  to: Box,
  animate: boolean,
): void {
  lastPlacement = to;
  const duration = animate ? DUR.base : 0;
  // Springs into the new tab rather than easing to a stop, so the bar has the
  // same character as the screens the tabs lead to.
  const ease = animate ? EASE.spring : EASE.emphasis;
  const opts = { duration, ease, overwrite: "auto" as const };
  gsap.to(marker, { x: to.x + to.width / 2, opacity: 1, ...opts });
  gsap.to(block, { ...to, opacity: 1, ...opts });
}

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const dot = useRef<HTMLSpanElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLUListElement>(null);
  const nav = useRef<HTMLElement>(null);
  /** Which route the indicator has already been settled onto. */
  const placedFor = useRef<string | null>(null);
  /**
   * Set when a drag has just navigated, so the click the browser synthesises
   * afterwards does not navigate a second time.
   */
  const handledByDrag = useRef(false);

  // The bar publishes its own height as --nav-h, because anything anchored
  // above it (StickyAction) needs the real number. It was a hand-maintained
  // constant of 58px against a real height of 65px on a desktop and 91px on a
  // phone with a home indicator, which put the primary action underneath the
  // bar. A measurement cannot drift; a constant already had.
  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    const apply = (h: number) =>
      document.documentElement.style.setProperty("--nav-h", `${Math.round(h)}px`);
    apply(el.getBoundingClientRect().height);
    const ro = new ResizeObserver(([entry]) => apply(entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Settle the selection on whatever the route now is.
  //
  // Usually there is nothing left to do here: a tap moves the indicator before
  // it navigates and a drag has already carried it, so by the time this runs
  // the marker is where it belongs and this is a zero duration confirmation.
  // It still matters for the cases nothing led: a cold start, a back button, a
  // deep link.
  useEffect(() => {
    const list = bar.current;
    const marker = dot.current;
    const block = pill.current;
    if (!list || !marker || !block) return;

    const active = list.querySelector<HTMLElement>('[aria-current="page"]');
    if (!active) {
      gsap.set([marker, block], { opacity: 0 });
      return;
    }

    const to = {
      x: active.offsetLeft,
      y: active.offsetTop,
      width: active.offsetWidth,
      height: active.offsetHeight,
    };

    // React runs mount effects twice in development, and the second run would
    // otherwise overwrite a movement the first had just started with an instant
    // set, which is what used to make the selection jump. Keyed on the PATHNAME
    // rather than on the mount: this bar lives in the layout now and no longer
    // rebuilds per navigation, so a plain "have I run yet" ref would answer yes
    // for ever and the indicator would never move again after the first tab.
    if (placedFor.current === pathname) return;
    placedFor.current = pathname;

    const from = lastPlacement;

    // No previous position means a cold start, not a move: place it.
    const animate = from !== null && from.x !== to.x && !prefersReducedMotion();
    if (animate) {
      gsap.set(block, { ...from, opacity: 1 });
      gsap.set(marker, { x: from.x + from.width / 2, opacity: 1 });
    }
    placeIndicator(marker, block, to, animate);
  }, [pathname]);

  /**
   * Drag along the bar and the selection comes with your finger.
   *
   * It is magnetic rather than free: the indicator tracks the nearest tab
   * instead of sitting wherever the finger happens to be. That is not a
   * simplification, it is what keeps the gesture honest across nineteen themes,
   * because Brutal fills the pill and Clay rounds it, and a filled block
   * straddling two tabs states a selection that does not exist. Snapping means
   * every frame of the drag shows a real, choosable answer.
   *
   * Nothing here re-renders React. Positions are written straight to the two
   * marker elements by GSAP, and the tab under the finger is marked with a data
   * attribute the stylesheet reads, so a finger moving across five tabs costs
   * five tweens and no renders at all.
   */
  useEffect(() => {
    const list = bar.current;
    const marker = dot.current;
    const block = pill.current;
    if (!list || !marker || !block) return;

    const home = () => TAB_HREFS.indexOf(pathname as (typeof TAB_HREFS)[number]);

    let boxes: { el: HTMLElement; box: Box }[] = [];
    let left = 0;
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let dragging = false;
    let current = -1;

    /** Nearest tab to a point, in the bar's own coordinates. */
    const indexAt = (clientX: number) => {
      const x = clientX - left;
      let best = 0;
      let bestDistance = Infinity;
      boxes.forEach(({ box }, i) => {
        const distance = Math.abs(box.x + box.width / 2 - x);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = i;
        }
      });
      return best;
    };

    const mark = (i: number) => {
      boxes.forEach(({ el }, k) => {
        if (k === i) el.setAttribute("data-drag-active", "");
        else el.removeAttribute("data-drag-active");
      });
    };

    const clear = () => {
      list.removeAttribute("data-dragging");
      boxes.forEach(({ el }) => el.removeAttribute("data-drag-active"));
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      boxes = tabBoxes(list);
      if (boxes.length === 0) return;
      // Measured once per gesture. Reading the rect on every move is a forced
      // layout on the frame a finger is already moving.
      left = list.getBoundingClientRect().left;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      current = home();
      tracking = true;
      dragging = false;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      // Engaged only once the movement is clearly along the bar, so a tap stays
      // a tap and is left to the link's own click handler.
      if (!dragging) {
        if (Math.abs(dx) < DRAG_SLOP || Math.abs(dx) <= Math.abs(dy)) return;
        dragging = true;
        list.setAttribute("data-dragging", "");
        mark(current);
      }
      e.preventDefault();

      const i = indexAt(touch.clientX);
      if (i === current) return;
      current = i;
      // One tick per tab crossed, so the bar can be felt as well as seen.
      haptic("tick");
      mark(i);
      // Reduced motion takes the TWEEN away, never the tracking. Returning
      // early here instead left the whole gesture dead for anyone with the
      // setting on: the bar engaged, lit the tab it was already on, and then
      // ignored the finger and refused to navigate on release. Same rule pull
      // to refresh had to learn: a control that follows your finger is
      // feedback, not decoration, so it still answers, it just answers at once.
      placeIndicator(marker, block, boxes[i].box, !prefersReducedMotion());
    };

    /**
     * The gesture was taken away rather than finished: a system edge swipe, an
     * incoming call, a second finger. Committing on this would navigate someone
     * to a tab they never released on, so it abandons and puts the indicator
     * back on the route that is actually open.
     */
    const onCancel = () => {
      if (!tracking) return;
      tracking = false;
      clear();
      if (!dragging) return;
      dragging = false;
      const from = home();
      if (from >= 0 && boxes[from]) {
        placeIndicator(marker, block, boxes[from].box, !prefersReducedMotion());
      }
    };

    const onEnd = () => {
      if (!tracking) return;
      tracking = false;
      clear();
      if (!dragging) return; // a tap: the link handles it
      dragging = false;

      const href = TAB_HREFS[current];
      const from = home();
      if (!href || current === from) {
        // Came back to where it started, so put the indicator back honestly
        // rather than leaving it parked on a tab nobody chose.
        if (from >= 0 && boxes[from]) {
          placeIndicator(marker, block, boxes[from].box, !prefersReducedMotion());
        }
        return;
      }
      // The indicator is already on the target, so the screen is the only thing
      // left to move: the bar led and the content follows it.
      handledByDrag.current = true;
      window.setTimeout(() => {
        handledByDrag.current = false;
      }, 400);
      captureOutgoing(document.querySelector<HTMLElement>("main"), current > from ? 1 : -1);
      router.push(href);
    };

    list.addEventListener("touchstart", onStart, { passive: true });
    list.addEventListener("touchmove", onMove, { passive: false });
    list.addEventListener("touchend", onEnd, { passive: true });
    list.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      list.removeEventListener("touchstart", onStart);
      list.removeEventListener("touchmove", onMove);
      list.removeEventListener("touchend", onEnd);
      list.removeEventListener("touchcancel", onCancel);
      clear();
    };
  }, [pathname, router]);

  return (
    <nav
      ref={nav}
      data-nav
      aria-label="Primary"
      // SideNav takes over past `lg`, where there is a rail instead of a thumb
      // to reach the bottom of the screen with.
      // Opaque, with NO backdrop-filter, and that is a bug fix rather than a
      // taste change. A `backdrop-filter` element has to sample everything
      // painted behind it, so it depends on the compositing structure of the
      // page staying still. `captureOutgoing` appends a `position: fixed`
      // composited clone to the body the instant a swipe commits and removes it
      // when the transition ends, which changes the backdrop root twice per
      // navigation. Chrome on Android drops the blurred layer while that
      // happens, so the whole bar disappeared for the length of the swipe and
      // came back on landing.
      //
      // Nothing is lost: the app is flat and hairline based, and glassmorphism
      // was already considered and rejected here on the grounds that a near
      // black app has no wallpaper worth revealing. Brutal, Clay and Terminal
      // each paint their own opaque `[data-nav]` background anyway, so this
      // only ever affected the default themes.
      className="sticky bottom-0 z-30 bg-ink-0 lg:hidden"
    >
      <div className="rule" />
      <ul
        ref={bar}
        // The bar owns every touch that lands on it. `none` rather than leaving
        // it to the axis lock the content swipe uses, because iOS decides at
        // the START of a gesture whether the page scrolls and ignores every
        // later preventDefault: declaring it up front is the only reliable way
        // to claim a horizontal drag on a sticky element.
        style={{ touchAction: "none" }}
        className="relative mx-auto flex max-w-md pb-[max(8px,env(safe-area-inset-bottom))] pt-1"
      >
        {/* Behind the icons, so a filled theme can colour the whole tab without
            hiding what it is. Invisible until a theme gives it a look. */}
        <span
          ref={pill}
          data-nav-pill
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 z-0 opacity-0"
        />
        {/* Marked, so a theme can drive it: Stone gives each tab one of its
            four colours and repaints this as it travels, which is what makes
            the selection read as arriving somewhere rather than just moving. */}
        <span
          ref={dot}
          data-nav-dot
          aria-hidden
          className="pointer-events-none absolute left-0 top-2 -ml-[3px] size-1.5 rounded-full bg-accent opacity-0"
        />
        {TABS.map(({ href, label, Icon }, i) => {
          const active = pathname === href;
          const from = TABS.findIndex((t) => t.href === pathname);
          // Which way the eye should travel: right along the bar means the old
          // screen leaves to the left and the new one arrives from the right.
          const dir = from === -1 || from === i ? 0 : i > from ? 1 : -1;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                onClick={(e) => {
                  // Leave modified clicks alone: they are the browser's, for
                  // opening in a tab or a window.
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  // A drag has already navigated; this is just the click the
                  // browser synthesises behind it.
                  if (handledByDrag.current) {
                    e.preventDefault();
                    return;
                  }
                  if (active) return;
                  e.preventDefault();
                  // THE BAR LEADS. The selection springs to the tapped tab on
                  // this frame, before the route changes, so the eye is already
                  // at the destination when the screen arrives behind it.
                  // Placing it after navigation instead made the indicator look
                  // like it was catching up with a decision already taken.
                  const list = bar.current;
                  const marker = dot.current;
                  const block = pill.current;
                  if (list && marker && block && !prefersReducedMotion()) {
                    const box = tabBoxes(list)[i];
                    if (box) placeIndicator(marker, block, box.box, true);
                  }
                  // Freeze the current screen and navigate in the same frame.
                  // Waiting for an exit to finish first is what put a hole in
                  // the middle of the transition.
                  captureOutgoing(document.querySelector<HTMLElement>("main"), dir);
                  router.push(href);
                }}
                data-nav-item
                aria-current={active ? "page" : undefined}
                aria-label={label}
                title={label}
                className={`relative z-10 flex min-h-[52px] items-center justify-center transition-colors ${
                  active ? "text-text-1" : "text-text-3 hover:text-text-2"
                }`}
              >
                <Icon size={22} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
