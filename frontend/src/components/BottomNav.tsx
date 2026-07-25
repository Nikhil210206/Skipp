"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconAttendance,
  IconCalendar,
  IconHome,
  IconMarks,
  IconTimetable,
} from "./Icons";

const TABS = [
  { href: "/marks", label: "marks", Icon: IconMarks },
  { href: "/attendance", label: "attnd", Icon: IconAttendance },
  { href: "/dashboard", label: "home", Icon: IconHome },
  { href: "/timetable", label: "time", Icon: IconTimetable },
  { href: "/calendar", label: "cal", Icon: IconCalendar },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 z-20 border-t border-line bg-background/80 backdrop-blur-xl">
      <ul className="mx-auto flex max-w-md px-2 pb-[env(safe-area-inset-bottom)]">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`flex flex-col items-center gap-1 py-3 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                  active ? "text-accent" : "text-text-muted hover:text-text-primary"
                }`}
              >
                <Icon size={20} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
