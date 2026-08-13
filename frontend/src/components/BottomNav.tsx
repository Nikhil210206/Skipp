"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { captureOutgoing, DUR, EASE, prefersReducedMotion } from "@/lib/motion";
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

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const dot = useRef<HTMLSpanElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLUListElement>(null);
  const nav = useRef<HTMLElement>(null);
  /** Whether THIS mount has placed the indicator yet. */
  const placed = useRef(false);

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

  // One measurement drives both markers, so the selection travels as a single
  // movement rather than a dot sliding while a fill jumps. The pill is what a
  // theme fills, outlines or rounds; the dot is the accent riding along.
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

    // React runs mount effects twice in development, and the second run used to
    // overwrite the movement the first had just started with an instant set,
    // which is why the selection appeared to jump. The guard has to be scoped
    // to THIS mount: a module-level one survived a remount and left the new
    // element unplaced entirely. A ref is fresh per mount, so a real navigation
    // always places, and a repeat run never interrupts.
    if (placed.current) return;
    placed.current = true;

    const from = lastPlacement;
    lastPlacement = to;

    // No previous position means a cold start, not a move: place it.
    const animate = from !== null && from.x !== to.x && !prefersReducedMotion();

    if (animate) {
      gsap.set(block, { ...from, opacity: 1 });
      gsap.set(marker, { x: from.x + from.width / 2, opacity: 1 });
    }
    const duration = animate ? DUR.base : 0;

    // The selection springs into its new tab rather than easing to a stop, so
    // the bar has the same character as everything the tabs lead to.
    const ease = animate ? EASE.spring : EASE.emphasis;
    gsap.to(marker, { x: to.x + to.width / 2, opacity: 1, duration, ease });
    gsap.to(block, { ...to, opacity: 1, duration, ease });
  }, [pathname]);

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
                  if (active) return;
                  e.preventDefault();
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
