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

const TABS = [
  { href: "/marks", label: "Marks", Icon: IconMarks },
  { href: "/attendance", label: "Attendance", Icon: IconAttendance },
  { href: "/dashboard", label: "Home", Icon: IconHome },
  { href: "/timetable", label: "Schedule", Icon: IconTimetable },
  { href: "/calendar", label: "Calendar", Icon: IconCalendar },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const indicator = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLUListElement>(null);

  // A single indicator slides between tabs rather than each tab animating
  // itself: one moving element reads as one object.
  useEffect(() => {
    const list = bar.current;
    const dot = indicator.current;
    if (!list || !dot) return;
    const active = list.querySelector<HTMLElement>('[aria-current="page"]');
    if (!active) {
      gsap.set(dot, { opacity: 0 });
      return;
    }
    const x = active.offsetLeft + active.offsetWidth / 2;
    const first = gsap.getProperty(dot, "opacity") === 0;
    gsap.to(dot, {
      x,
      opacity: 1,
      duration: first || prefersReducedMotion() ? 0 : DUR.base,
      ease: EASE.emphasis,
    });
  }, [pathname]);

  return (
    <nav
      aria-label="Primary"
      className="sticky bottom-0 z-30 border-t border-line bg-ink-0/92 backdrop-blur-2xl"
    >
      <ul
        ref={bar}
        className="relative mx-auto flex max-w-md pb-[max(6px,env(safe-area-inset-bottom))]"
      >
        <span
          ref={indicator}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 -ml-[9px] h-[2px] w-[18px] rounded-full bg-accent opacity-0"
        />
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-1.5 transition-colors ${
                  active ? "text-text-1" : "text-text-3 hover:text-text-2"
                }`}
              >
                <Icon size={21} />
                <span className="text-[10px] font-medium tracking-wide">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
