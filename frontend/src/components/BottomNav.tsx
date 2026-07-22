"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "home", icon: "◆" },
  { href: "/attendance", label: "attnd", icon: "◐" },
  { href: "/timetable", label: "time", icon: "▦" },
  { href: "/calendar", label: "cal", icon: "▤" },
  { href: "/marks", label: "marks", icon: "✦" },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 z-20 border-t border-white/[0.06] bg-background/80 backdrop-blur-xl">
      <ul className="mx-auto flex max-w-md px-2 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                className={`flex flex-col items-center gap-1 py-3 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                  active ? "text-accent" : "text-text-muted hover:text-text-primary"
                }`}
              >
                <span className="text-base leading-none">{t.icon}</span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
