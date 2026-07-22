"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Home", icon: "◇" },
  { href: "/attendance", label: "Attendance", icon: "◐" },
  { href: "/marks", label: "Marks", icon: "◆" },
  { href: "/timetable", label: "Timetable", icon: "▤" },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 z-10 border-t border-white/10 bg-surface/90 backdrop-blur">
      <ul className="mx-auto flex max-w-md">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] transition-colors ${
                  active ? "text-accent" : "text-text-muted hover:text-text-primary"
                }`}
              >
                <span className="text-lg leading-none">{t.icon}</span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
