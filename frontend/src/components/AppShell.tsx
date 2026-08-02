"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSession } from "@/context/SessionContext";
import BottomNav from "./BottomNav";
import SideNav from "./SideNav";
import PullToRefresh from "./PullToRefresh";
import ProfileMark from "./ProfileMark";
import InstallPrompt from "./InstallPrompt";
import { CREATOR } from "@/lib/creator";
import { Skeleton } from "./ui";
import { pageIn, prefersReducedMotion, revealWord } from "@/lib/motion";
import { useSwipeNav } from "@/lib/useSwipeNav";

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
  const { isAuthed, restoring, displayName, student, refresh, fetchedAt } =
    useSession();

  // A signature rather than a feature: tap the masthead label five times and the
  // credit appears for a few seconds, then puts itself away.
  const taps = useRef(0);
  const timer = useRef<number | null>(null);
  const [signature, setSignature] = useState(false);
  // Runs once per mount, which is every navigation: AppShell remounts on every
  // route change, so this is the masthead's equivalent of the onboarding
  // chapter word arriving fresh each time the section name changes.
  const label = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    revealWord(label.current, prefersReducedMotion());
  }, []);
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

  // The arriving screen slides in from the side it was navigated towards.
  // Layout effect, so the first painted frame is already the start state.
  const main = useRef<HTMLElement>(null);
  // Swipe left or right to move between tabs, using the same exit the bar does.
  const shell = useRef<HTMLDivElement>(null);
  useSwipeNav(shell, pathname, !restoring && isAuthed);
  useLayoutEffect(() => {
    if (!restoring && isAuthed) pageIn(main.current);
  }, [restoring, isAuthed]);

  if (restoring) return <RestoringFrame />;
  if (!isAuthed) return null;

  return (
    // Row past `lg`: there is no thumb to reach a bottom bar with on a
    // laptop, so the tab bar and swipe gesture hand off to a sidebar rail.
    // Below `lg` this is a no-op column exactly as it always was.
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <SideNav />
      <div
        ref={shell}
        className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col md:border-x md:border-line-soft lg:mx-0 lg:max-w-none lg:border-0"
      >
        <PullToRefresh onRefresh={refresh} fetchedAt={fetchedAt}>
          {/* The inset is padding on the wrapper, never on the bar itself: with
              box-sizing: border-box a 59px notch inset would eat the whole 56px
              bar and leave the content with zero height to sit in.

              Sticky, so the scroll edge has something to happen against. The blur
              has to live on this element rather than on a sibling overlay: the
              masthead sits inside PullToRefresh's transformed wrapper, which is
              its own stacking context, so any overlay raised above the content
              would also cover the profile mark and stop it being tappable. */}
          <header className="sticky top-0 z-20 shrink-0 pt-[env(safe-area-inset-top)]">
            <ScrollEdge />
            <div className="relative flex h-14 items-center justify-between px-[var(--gutter)] lg:mx-auto lg:max-w-5xl">
              <button
                onClick={tapMasthead}
                aria-label="Skipp"
                // The full bar height, so the signature tap target clears 44px
                // without changing where the label sits.
                className="-my-2 inline-flex min-h-11 items-center py-2 text-label uppercase text-text-3"
              >
                {signature ? (
                  <span className="font-signature normal-case tracking-normal text-accent">
                    {CREATOR.prefix} {CREATOR.name}
                  </span>
                ) : (
                  <span className="inline-block overflow-hidden pb-[0.06em] align-bottom">
                    <span ref={label} data-word className="inline-block will-change-transform">
                      {section}
                    </span>
                  </span>
                )}
              </button>
              <div className="flex items-center gap-1">
                {action}
                {/* The sidebar carries its own profile row past `lg`, so this
                    would be a second way to the same place sitting right next
                    to the first. */}
                {pathname !== "/profile" && (
                <span className="lg:hidden">
                  {/* Seeded by the registration number, not the display name:
                      the mark should be stable even when someone renames
                      themselves. */}
                  <ProfileMark seed={student?.registrationNumber ?? displayName} />
                </span>
              )}
              </div>
            </div>
          </header>
          <main
            ref={main}
            // Permanently lifted and opaque, which is what lets a page
            // transition work at all: the outgoing snapshot sits at z-index 1
            // behind this, so the arriving screen genuinely covers what it
            // replaces. Doing it per transition left a window between the new
            // page mounting and the tween starting, and in that window the old
            // page showed through.
            //
            // Capped at `lg`, not left to bleed: the poster figures this app
            // is built from (a 13rem percentage, a day-order numeral) are
            // sized to a phone column on purpose, and stretching that column
            // across a 1440px window would not read as "more app", it would
            // read as the same page zoomed past its own scale.
            className="relative z-[2] flex flex-1 flex-col bg-ink-0 px-[var(--gutter)] pb-10 lg:mx-auto lg:w-full lg:max-w-5xl"
          >
            {children}
          </main>
        </PullToRefresh>
        <BottomNav />
        {/* Asks once the student is actually in and looking at their own data,
            which is the only moment the offer means anything. */}
        <InstallPrompt />
      </div>
    </div>
  );
}

/**
 * The scroll edge: content fades out under the masthead as it goes.
 *
 * It is absent at rest and arrives with the scroll. A gradient sitting there
 * from the start dims the top of every screen before anything has moved, which
 * on Home meant the greeting was being faded out while still the first thing
 * you read. There is nothing to fade until something is behind the bar.
 *
 * Written straight to the element on a passive listener, so scrolling never
 * re-renders React.
 */
const EDGE_TRAVEL = 44;

function ScrollEdge() {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    let frame = 0;
    const paint = () => {
      frame = 0;
      const y = window.scrollY;
      node.style.opacity = String(Math.min(1, Math.max(0, y / EDGE_TRAVEL)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={el}
      aria-hidden
      style={{ opacity: 0 }}
      className="pointer-events-none absolute inset-x-0 top-0 h-[calc(100%+34px)] bg-gradient-to-b from-ink-0 from-40% via-ink-0/35 via-75% to-transparent"
    />
  );
}

function RestoringFrame() {
  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      {/* A placeholder of the same shape as `SideNav`, not the real thing: it
          reads from `useSession`, which has nothing to show yet while this is
          up. Matching the WIDTH is what matters here, so the sidebar does not
          pop into existence and shove the content column over once the real
          data lands. */}
      <div
        aria-hidden
        className="hidden h-dvh w-64 shrink-0 flex-col gap-8 border-r border-line-soft px-5 py-6 lg:flex"
      >
        <Skeleton className="h-6 w-24" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
      <div
        className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col md:border-x md:border-line-soft lg:mx-0 lg:max-w-none lg:border-0"
        aria-busy="true"
        aria-label="Loading your data"
      >
        <div className="pt-[env(safe-area-inset-top)]">
          <div className="flex h-14 items-center px-[var(--gutter)] lg:mx-auto lg:max-w-5xl">
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-4 px-[var(--gutter)] pt-6 lg:mx-auto lg:w-full lg:max-w-5xl">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-20 w-3/4" />
          <Skeleton className="mt-6 h-px w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
        <BottomNav />
      </div>
    </div>
  );
}
