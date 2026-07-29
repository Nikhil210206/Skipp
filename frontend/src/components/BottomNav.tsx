"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { DUR, EASE, prefersReducedMotion } from "@/lib/motion";
import {
  IconAttendance,
  IconCalendar,
  IconHome,
  IconMarks,
  IconTimetable,
} from "./Icons";

// Icons only. The labels were repeating what the screen already says in its
// masthead, and five words along the bottom edge added noise to every screen.

const TABS = [
  { href: "/marks", label: "Marks", Icon: IconMarks },
  { href: "/attendance", label: "Attendance", Icon: IconAttendance },
  { href: "/dashboard", label: "Home", Icon: IconHome },
  { href: "/timetable", label: "Schedule", Icon: IconTimetable },
  { href: "/calendar", label: "Calendar", Icon: IconCalendar },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const dot = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLUListElement>(null);
  const nav = useRef<HTMLElement>(null);

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

  useEffect(() => {
    const list = bar.current;
    const marker = dot.current;
    if (!list || !marker) return;
    const active = list.querySelector<HTMLElement>('[aria-current="page"]');
    if (!active) {
      gsap.set(marker, { opacity: 0 });
      return;
    }
    const x = active.offsetLeft + active.offsetWidth / 2;
    const first = gsap.getProperty(marker, "opacity") === 0;
    gsap.to(marker, {
      x,
      opacity: 1,
      duration: first || prefersReducedMotion() ? 0 : DUR.base,
      ease: EASE.emphasis,
    });
  }, [pathname]);

  return (
    <nav
      ref={nav}
      data-nav
      aria-label="Primary"
      className="sticky bottom-0 z-30 bg-ink-0/90 backdrop-blur-2xl"
    >
      <div className="rule" />
      <ul
        ref={bar}
        className="relative mx-auto flex max-w-md pb-[max(8px,env(safe-area-inset-bottom))] pt-1"
      >
        <span
          ref={dot}
          aria-hidden
          className="pointer-events-none absolute left-0 top-2 -ml-[3px] size-1.5 rounded-full bg-accent opacity-0"
        />
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                data-nav-item
                aria-current={active ? "page" : undefined}
                aria-label={label}
                title={label}
                className={`flex min-h-[52px] items-center justify-center transition-colors ${
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
