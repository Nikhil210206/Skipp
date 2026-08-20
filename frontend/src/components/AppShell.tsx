"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSession } from "@/context/SessionContext";
import BottomNav from "./BottomNav";
import SideNav from "./SideNav";
import PullToRefresh from "./PullToRefresh";
import ProfileMark from "./ProfileMark";
import InstallGate, { useShouldOfferInstall } from "./InstallGate";
import NotifyOnOpen from "./NotifyOnOpen";
import WhatsNewSheet from "./WhatsNewSheet";
import NewThemeSheet from "./NewThemeSheet";
import AttendanceBackSheet from "./AttendanceBackSheet";
import { CREATOR } from "@/lib/creator";
import { Skeleton } from "./ui";
import { pageIn, prefersReducedMotion, revealWord } from "@/lib/motion";
import { useSwipeNav } from "@/lib/useSwipeNav";
import { NOTICE, useSeenNotice } from "@/lib/whatsNew";
import { ensureFeedbackSchedule, useFeedbackDue } from "@/lib/feedback";
import { FeedbackPrompt } from "./FeedbackSheet";
import { actionSlotRef } from "./ShellAction";
import { prettyDate, todayISO } from "@/lib/schedule";

/**
 * The section name shown in the masthead, per route.
 *
 * It is derived here rather than passed in because this shell now mounts ONCE,
 * from the route group's layout, and a layout cannot take props from the page
 * inside it. That is the whole point of the move: every screen used to render
 * its own copy of this component, so each tab change tore down the masthead,
 * the tab bar, pull to refresh, the sidebar and three sheets and built them all
 * again on exactly the frames the page transition was trying to animate.
 */
const SECTIONS: Record<string, string> = {
  "/attendance": "Attendance",
  "/marks": "Marks",
  "/timetable": "Schedule",
  "/calendar": "Calendar",
  "/profile": "Profile",
};

/**
 * The frame: auth guard, a thin masthead, pull to refresh, tab bar.
 *
 * The masthead is deliberately minimal and identical everywhere, so the chrome
 * stays constant while each screen composes its own opening below it. That is
 * what lets Home, Attendance and Timetable feel like different pages of one
 * publication rather than one template repainted.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthed, restoring, displayName, student, refresh, fetchedAt } =
    useSession();

  // A signature rather than a feature: tap the masthead label five times and the
  // credit appears for a few seconds, then puts itself away.
  const taps = useRef(0);
  const timer = useRef<number | null>(null);
  const [signature, setSignature] = useState(false);
  // Home's masthead is the date, which is a fact about today rather than a name
  // for the screen. Everything else is simply what the tab is called.
  const section =
    pathname === "/dashboard" ? prettyDate(todayISO()) : (SECTIONS[pathname] ?? "Skipp");
  // Keyed on the section rather than on the mount, now that the mount happens
  // once: the label still rises fresh each time the screen changes, which is
  // the masthead's echo of the onboarding deck's chapter word.
  const label = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    revealWord(label.current, prefersReducedMotion());
  }, [section]);

  // The install offer, for a student already signed in through a browser. The
  // entry screen offers it first and more cheaply (see InstallGate), so by the
  // time this fires it is either a returning user or someone who declined, and
  // the snooze is shared between the two places.
  const canOfferInstall = useShouldOfferInstall();
  const [installDismissed, setInstallDismissed] = useState(false);
  const seenHolidays = useSeenNotice(NOTICE.holidays);
  const seenTheme = useSeenNotice(NOTICE.stone);
  const seenAttendance = useSeenNotice(NOTICE.attendance);
  const feedbackDue = useFeedbackDue();
  // A device that reached a signed-in screen without passing the entry screen
  // (a deep link, a restored tab) has no schedule yet. Seeding it here treats
  // them as new, which is the cautious way round.
  useEffect(() => {
    ensureFeedbackSchedule();
  }, []);
  /** The install gate is a takeover, so nothing else may rise underneath it. */
  const gateUp = canOfferInstall && !installDismissed;
  // Attendance leads the queue: it is the only notice here about the app's own
  // core number being readable again, and it asks for an action. A skin and a
  // calendar feature can wait a launch.
  const showAttendance = !seenAttendance && !gateUp;
  const showTheme = !seenTheme && !showAttendance && !gateUp;
  const showHolidays = !seenHolidays && !showTheme && !showAttendance && !gateUp;
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
  // Keyed on the pathname, because `main` is now a persistent element whose
  // children swap rather than a fresh one per navigation. The tween therefore
  // runs against the same node every time, which is exactly what makes the
  // arrival cheap: nothing above the content has to be built again.
  useLayoutEffect(() => {
    if (!restoring && isAuthed) pageIn(main.current);
  }, [restoring, isAuthed, pathname]);

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
        // Marked so the stylesheet can hand this column's horizontal axis to
        // the swipe gesture (`touch-action: pan-y`, in globals.css). Without
        // that declaration the browser owns both axes until JavaScript argues
        // otherwise, and on iOS the argument arrives too late to be heard: the
        // scroller has already taken the gesture. See `useSwipeNav`.
        data-shell
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
            <div className="relative flex h-14 items-center justify-between px-[var(--gutter)] lg:px-10 xl:px-16">
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
                  // No `data-word` here, deliberately. That attribute is hidden
                  // by CSS until GSAP reveals it, which made the only label
                  // saying which screen you are on vanish entirely when the
                  // reveal did not run. The animation now sets its own start
                  // state, so the worst it can do is not play.
                  <span className="inline-block overflow-hidden pb-[0.06em] align-bottom">
                    <span ref={label} className="inline-block will-change-transform">
                      {section}
                    </span>
                  </span>
                )}
              </button>
              <div className="flex items-center gap-1">
                {/* Where a screen puts its own control (Schedule's download).
                    A portal, because the page can no longer hand this shell a
                    prop: see ShellAction. */}
                <span ref={actionSlotRef} className="flex items-center gap-1" />
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
            // `will-change-transform` is standing, not per gesture, and that is
            // deliberate. This element is translated on EVERY navigation and
            // on every swipe, so promoting it on the way in and demoting it on
            // the way out would re-rasterise a screenful of text twice per tab
            // change, at the two moments the eye is most on it. One permanent
            // layer costs a little memory once; the churn costs frames for
            // ever. It is safe here because `main` is opaque (`bg-ink-0`) and
            // holds nothing `position: fixed`: every overlay in the app is
            // already portalled to the body, for the neighbouring reason that
            // PullToRefresh's transform would otherwise contain it.
            className="relative z-[2] flex flex-1 flex-col bg-ink-0 px-[var(--gutter)] pb-10 will-change-transform lg:px-10 xl:px-16"
          >
            {children}
          </main>
        </PullToRefresh>
        <BottomNav />
        {/* Renders nothing: raises the "class starting soon" notification when
            the app is opened or brought back to the foreground. */}
        <NotifyOnOpen />
        {canOfferInstall && !installDismissed && (
          <InstallGate signedIn onDismiss={() => setInstallDismissed(true)} />
        )}
        {/* ONE AT A TIME, and in a stated order. The install gate is a full
            screen takeover, so a sheet raised behind it would be dismissed
            unseen and marked as read. Between the two notices the newest wins,
            because a student who has neither should hear the current news
            first. Whatever is not shown this launch is still waiting on the
            next.

            The feedback prompt is LAST of all, and deliberately so: every
            other sheet here is telling them something, and this one is asking
            them for something. Being asked for an opinion in the same breath
            as being handed news reads as a survey, and it would also be asking
            what they think of a change they had not seen yet. Its date is not
            consumed when it loses, so it simply comes round next launch. */}
        <AttendanceBackSheet open={showAttendance} />
        <NewThemeSheet open={showTheme} />
        <WhatsNewSheet open={showHolidays} />
        <FeedbackPrompt
          open={
            feedbackDue && !showAttendance && !showTheme && !showHolidays && !gateUp
          }
        />
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
      // Its own layer, because its opacity is rewritten on every scroll frame
      // and a gradient this size is not free to repaint. Promoted, the change
      // is a compositor property and costs nothing at all.
      style={{ opacity: 0, willChange: "opacity" }}
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
          <div className="flex h-14 items-center px-[var(--gutter)] lg:px-10 xl:px-16">
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-4 px-[var(--gutter)] pt-6 lg:px-10 xl:px-16">
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
