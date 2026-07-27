"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/context/SessionContext";
import BottomNav from "./BottomNav";
import PullToRefresh from "./PullToRefresh";
import ProfileMark from "./ProfileMark";
import { CREATOR } from "@/lib/creator";
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
  action,
  children,
}: {
  /** Small caps section name in the masthead. */
  section: string;
  /** Optional screen-level control, shown beside the profile mark. */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthed, restoring, displayName, refresh } = useSession();

  // A signature rather than a feature: tap the masthead label five times and the
  // credit appears for a few seconds, then puts itself away.
  const taps = useRef(0);
  const timer = useRef<number | null>(null);
  const [signature, setSignature] = useState(false);
  function tapMasthead() {
    taps.current += 1;
    if (timer.current) window.clearTimeout(timer.current);
    if (taps.current >= 5) {
      taps.current = 0;
      setSignature(true);
      timer.current = window.setTimeout(() => setSignature(false), 4000);
      return;
    }
    // Taps have to be deliberate: a slow series does not count.
    timer.current = window.setTimeout(() => {
      taps.current = 0;
    }, 900);
  }

  useEffect(() => {
    if (!restoring && !isAuthed) router.replace("/");
  }, [isAuthed, restoring, router]);

  if (restoring) return <RestoringFrame />;
  if (!isAuthed) return null;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col md:border-x md:border-line-soft">
      <PullToRefresh onRefresh={refresh}>
        <header className="flex h-14 shrink-0 items-center justify-between px-[var(--gutter)] pt-[env(safe-area-inset-top)]">
          <button
            onClick={tapMasthead}
            aria-label="Skipp"
            className="text-label uppercase text-text-3"
          >
            {signature ? (
              <span className="font-signature normal-case tracking-normal text-accent">
                {CREATOR.prefix} {CREATOR.name}
              </span>
            ) : (
              section
            )}
          </button>
          <div className="flex items-center gap-1">
            {action}
            {pathname !== "/profile" && <ProfileMark name={displayName} />}
          </div>
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
