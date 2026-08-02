"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useSession } from "@/context/SessionContext";
import { captureOutgoing, DUR, EASE, prefersReducedMotion } from "@/lib/motion";
import { TAB_HREFS } from "@/lib/tabs";
import Logo, { Wordmark } from "./Logo";
import { ProfileFace } from "./ProfileMark";
import {
  IconAttendance,
  IconCalendar,
  IconHome,
  IconMarks,
  IconTimetable,
} from "./Icons";

/**
 * The desktop nav. Below `lg` there is no touchscreen to swipe and no thumb
 * to reach a bottom bar with, so past that width the bottom bar and swipe
 * gesture hand off to a sidebar rail instead. It is a second INPUT onto the
 * same navigation, not a second system: clicking an item goes through the
 * exact `captureOutgoing` + `router.push` pair `BottomNav` uses, so the page
 * still turns over the same way (a horizontal slide) whichever control sent
 * it there.
 */

const META: Record<string, { label: string; Icon: typeof IconMarks }> = {
  "/marks": { label: "Marks", Icon: IconMarks },
  "/attendance": { label: "Attendance", Icon: IconAttendance },
  "/dashboard": { label: "Home", Icon: IconHome },
  "/timetable": { label: "Schedule", Icon: IconTimetable },
  "/calendar": { label: "Calendar", Icon: IconCalendar },
};

const TABS = TAB_HREFS.map((href) => ({ href, ...META[href] }));

/** Same reasoning as `BottomNav`'s `lastPlacement`: this rail is torn down and
 *  rebuilt on every navigation (AppShell remounts per screen), so without a
 *  remembered position the fresh mount has nothing to travel FROM and would
 *  always just snap the indicator into place. */
let lastPlacement: { y: number; height: number } | null = null;

export default function SideNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { displayName, student } = useSession();
  const list = useRef<HTMLUListElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);

  useEffect(() => {
    const el = list.current;
    const marker = pill.current;
    if (!el || !marker) return;

    const active = el.querySelector<HTMLElement>('[aria-current="page"]');
    if (!active) {
      gsap.set(marker, { opacity: 0 });
      return;
    }
    const to = { y: active.offsetTop, height: active.offsetHeight };

    // Guards the React-runs-effects-twice-in-development case: a ref is fresh
    // per mount, so a real navigation always places the indicator and a
    // repeated effect run never interrupts a movement already under way.
    if (placed.current) return;
    placed.current = true;

    const from = lastPlacement;
    lastPlacement = to;
    const animate = from !== null && from.y !== to.y && !prefersReducedMotion();

    if (animate) gsap.set(marker, { ...from, opacity: 1 });
    gsap.to(marker, {
      ...to,
      opacity: 1,
      duration: animate ? DUR.base : 0,
      ease: animate ? EASE.spring : EASE.emphasis,
    });
  }, [pathname]);

  return (
    <aside
      // `overflow-y-auto` is the insurance, not the expectation: at five tabs
      // this never gets tall enough to need it on any window tested here, but
      // a fixed-height flex column with no overflow handling is a silent trap
      // for whatever combination of browser chrome, zoom or window height
      // eventually makes it too short. Scrolling internally beats clipping.
      className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto border-r border-line-soft px-5 py-6 lg:flex"
      aria-label="Sections"
    >
      <Link href="/dashboard" className="flex items-center gap-2 px-2">
        <Logo size={22} className="text-text-1" />
        <Wordmark className="text-headline text-text-1" />
      </Link>

      <ul ref={list} role="tablist" aria-label="Primary" className="relative mt-10 flex flex-col gap-1">
        <span
          ref={pill}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 z-0 rounded-control bg-ink-2 opacity-0"
        />
        {TABS.map(({ href, label, Icon }, i) => {
          const active = pathname === href;
          const from = TABS.findIndex((t) => t.href === pathname);
          const dir = from === -1 || from === i ? 0 : i > from ? 1 : -1;
          return (
            <li key={href}>
              <Link
                href={href}
                role="tab"
                aria-selected={active}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  if (active) return;
                  e.preventDefault();
                  captureOutgoing(document.querySelector<HTMLElement>("main"), dir);
                  router.push(href);
                }}
                aria-current={active ? "page" : undefined}
                // `relative` lives here, not on the `<li>`: the pill measures
                // `offsetTop` against its nearest positioned ancestor, which
                // has to stay the `<ul>`. Positioning the `<li>` instead makes
                // EACH item its own offset parent, so every measurement comes
                // back ~0 and the pill always lands on the first row.
                className={`relative z-10 flex min-h-11 items-center gap-3 rounded-control px-3 text-body transition-colors ${
                  active ? "text-text-1" : "text-text-3 hover:text-text-2"
                }`}
              >
                <Icon size={19} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>

      <Link
        href="/profile"
        className="mt-auto flex items-center gap-3 rounded-control px-2 py-2 transition-colors hover:bg-ink-1"
      >
        <ProfileFace seed={student?.registrationNumber ?? displayName} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-callout font-semibold text-text-1">
            {displayName}
          </span>
          <span className="block text-label uppercase text-text-3">Profile</span>
        </span>
      </Link>
    </aside>
  );
}
