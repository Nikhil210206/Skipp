"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/context/SessionContext";
import BottomNav from "./BottomNav";
import PullToRefresh from "./PullToRefresh";
import ProfileMark from "./ProfileMark";
import InstallPrompt from "./InstallPrompt";
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
        {/* The inset is padding on the wrapper, never on the bar itself: with
            box-sizing: border-box a 59px notch inset would eat the whole 56px
            bar and leave the content with zero height to sit in. */}
        <header className="shrink-0 pt-[env(safe-area-inset-top)]">
          <div className="flex h-14 items-center justify-between px-[var(--gutter)]">
            <button
              onClick={tapMasthead}
              aria-label="Skipp"
              className="-my-2 py-2 text-label uppercase text-text-3"
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
          </div>
        </header>
        <main className="flex flex-1 flex-col px-[var(--gutter)] pb-10">
          {children}
        </main>
      </PullToRefresh>
      <BottomNav />
      {/* Asks once the student is actually in and looking at their own data,
          which is the only moment the offer means anything. */}
      <InstallPrompt />
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
      <div className="pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 items-center px-[var(--gutter)]">
          <Skeleton className="h-3 w-16" />
        </div>
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
