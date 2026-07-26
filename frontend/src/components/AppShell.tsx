"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/context/SessionContext";
import BottomNav from "./BottomNav";
import PullToRefresh from "./PullToRefresh";
import { Skeleton } from "./ui";

/**
 * The frame: auth guard, a thin masthead, pull to refresh, tab bar.
 *
 * The masthead is deliberately minimal and identical everywhere, so the chrome
 * stays constant while each screen composes its own opening below it. That is
 * what lets Home, Attendance and Timetable feel like different pages of one
 * publication rather than one template repainted.
 */
export default function AppShell({
  section,
  children,
}: {
  /** Small caps section name in the masthead. */
  section: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthed, restoring, displayName, refresh } = useSession();

  useEffect(() => {
    if (!restoring && !isAuthed) router.replace("/");
  }, [isAuthed, restoring, router]);

  if (restoring) return <RestoringFrame />;
  if (!isAuthed) return null;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col md:border-x md:border-line-soft">
      <PullToRefresh onRefresh={refresh}>
        <header className="flex h-14 shrink-0 items-center justify-between px-[var(--gutter)] pt-[env(safe-area-inset-top)]">
          <span className="text-label uppercase text-text-3">{section}</span>
          {pathname !== "/profile" && <ProfileButton name={displayName} />}
        </header>
        <main className="flex flex-1 flex-col px-[var(--gutter)] pb-10">
          {children}
        </main>
      </PullToRefresh>
      <BottomNav />
    </div>
  );
}

function RestoringFrame() {
  return (
    <div
      className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col md:border-x md:border-line-soft"
      aria-busy="true"
      aria-label="Loading your data"
    >
      <div className="flex h-14 items-center px-[var(--gutter)] pt-[env(safe-area-inset-top)]">
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="flex flex-1 flex-col gap-4 px-[var(--gutter)] pt-6">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-20 w-3/4" />
        <Skeleton className="mt-6 h-px w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
      <BottomNav />
    </div>
  );
}

function ProfileButton({ name }: { name: string }) {
  const initial = (name.trim()[0] ?? "s").toUpperCase();
  return (
    <Link
      href="/profile"
      aria-label="Your profile"
      className="-mr-2 flex size-11 items-center justify-center text-callout font-semibold text-text-3 transition-colors hover:text-text-1"
    >
      <span className="flex size-7 items-center justify-center rounded-full border border-line">
        {initial}
      </span>
    </Link>
  );
}
