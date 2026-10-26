"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import LoginForm, { type SignInPhase } from "@/components/LoginForm";
import Tour from "@/components/front/Tour";
import SyncSequence, { type Fact } from "@/components/onboarding/SyncSequence";
import { markIntroSeen, useSeenIntro } from "@/lib/firstRun";
import InstallGate, { useShouldOfferInstall } from "@/components/InstallGate";
import Hero from "@/components/front/Hero";
import SendOff from "@/components/front/SendOff";
import CreatorCredit from "@/components/CreatorCredit";
import Logo, { Wordmark } from "@/components/Logo";
import Greeting from "@/components/Greeting";
import { useSession } from "@/context/SessionContext";
import { playEntrance, useGsap } from "@/lib/motion";
import { claimIfNewDevice } from "@/lib/whatsNew";
import { seedFeedbackSchedule } from "@/lib/feedback";
import { IconButton, Spinner } from "@/components/ui";
import { IconChevronLeft } from "@/components/Icons";

/**
 * The way in, in three movements: the opening (play the decision), the ask
 * (credentials), and the landing (your own numbers arriving). It is one
 * continuous black screen from first paint to the dashboard, with no route
 * change until the very end.
 */
export default function LoginPage() {
  const router = useRouter();
  const { isAuthed, restoring, timetable, attendance, displayName } =
    useSession();

  const seenIntro = useSeenIntro();

  /**
   * Where a signed out visitor is in the way in. The front door is shown on
   * EVERY visit, not just the first (asked for, 2026-10-26): it is the front of
   * the product, and somebody typing skipp.life should land on it. A student
   * who is signed in never sees any of this; they are sent to the dashboard.
   *
   * After the hero comes the install offer on a phone, ahead of the tour, on
   * purpose. On iOS an installed app gets its own storage container, so a
   * student who plays the tour in Safari and only then installs plays it a
   * second time inside the real app. Then the tour, once per device, then sign
   * in. Every one of them has a way back.
   */
  type Step = "hero" | "install" | "tour" | "signin";
  const [step, setStep] = useState<Step>("hero");
  const canOfferInstall = useShouldOfferInstall();
  /** Whether the visitor asked to sign in from the hero, so the install offer
   *  knows where to send them next. */
  const wantsSignIn = useRef(false);
  /** The send-off is playing, from this point, over whatever is underneath. */
  const [sendOff, setSendOff] = useState<{ x: number; y: number } | null>(null);

  const afterInstall = (): Step => (wantsSignIn.current || seenIntro ? "signin" : "tour");
  const leaveHero = (signIn: boolean) => {
    wantsSignIn.current = signIn;
    setStep(canOfferInstall ? "install" : afterInstall());
  };

  // While the sign-in sequence is playing we are authenticated but deliberately
  // still here, so the redirect below has to stand down until it finishes.
  const [phase, setPhase] = useState<SignInPhase>("idle");
  /** How much of the form is done, 0 to 2, drawn as the rule above it. */
  const [filled, setFilled] = useState(0);

  useEffect(() => {
    if (isAuthed && phase === "idle") router.replace("/dashboard");
  }, [isAuthed, phase, router]);

  // Date the device before anybody signs in. This is the only moment that can
  // tell a student who already had Skipp from one arriving for the first time:
  // a minute later they both have a saved session and look identical. See
  // claimIfNewDevice, and seedFeedbackSchedule, which reads the same signal for
  // the opposite purpose: notices are claimed for a new device, while the
  // feedback prompt is held back for one and due at once for a returning one.
  useEffect(() => {
    claimIfNewDevice();
    seedFeedbackSchedule();
  }, []);

  const scope = useGsap(
    ({ self, reduced }) => {
      // Held while the send-off is over the form: its entrance plays as the
      // field lifts off it, not underneath where nobody can see it.
      if (restoring || isAuthed || step !== "signin" || sendOff) return;
      playEntrance(self, reduced);
    },
    // Everything that can hide the form is a dependency, for the reason
    // documented in CLAUDE.md: the form does not exist while any of these
    // screens is up, so a missing one means this effect runs once against
    // nothing, never runs again, and the sign-in screen stays permanently at
    // its hidden CSS start state.
    [restoring, isAuthed, step, sendOff],
  );

  const finish = useCallback(() => router.replace("/dashboard"), [router]);

  // What the sequence lands on: the student's own numbers, read straight from
  // the snapshot that just arrived. Anything the portal gated is left out
  // rather than shown as a zero.
  const facts: Fact[] = [];
  if (timetable) {
    facts.push({ label: "Courses", value: String(timetable.courses.length) });
    if (timetable.dayOrders.length > 0) {
      facts.push({
        label: "Day orders",
        value: String(timetable.dayOrders.length),
      });
    }
    if (attendance) {
      facts.push({
        label: "Attendance",
        value: `${attendance.overallPercentage.toFixed(1)}%`,
      });
    }
    if (timetable.calendar.length > 0) {
      facts.push({ label: "Term days", value: String(timetable.calendar.length) });
    }
  }

  if (restoring || (isAuthed && phase === "idle")) {
    return (
      <main className="flex min-h-full flex-1 items-center justify-center">
        <Spinner label="Opening Skipp" />
      </main>
    );
  }

  // Behind the authed redirect above: a signed in student is on their way to
  // the dashboard. "Get started" goes on to the tour; "sign in" is for somebody
  // who already uses Skipp, so it skips the tour but NOT the install offer,
  // which on iOS is about where the sign in happens.
  let view: React.ReactNode;
  if (step === "hero") {
    view = <Hero onStart={() => leaveHero(false)} onSignIn={() => leaveHero(true)} />;
  } else if (step === "install") {
    view = (
      <InstallGate
        onBack={() => setStep("hero")}
        onDismiss={() => setStep(afterInstall())}
      />
    );
  } else if (step === "tour") {
    view = (
      <Tour
        onBack={() => setStep("hero")}
        onSkip={() => {
          markIntroSeen();
          setStep("signin");
        }}
        onDone={(from) => {
          markIntroSeen();
          setSendOff(from);
        }}
      />
    );
  } else {
    view = (
    <>
      {/* On a phone this is one column, exactly as it always was. Past `lg` it
          becomes a SPLIT: the cover on the left, the form on the right.
          
          This route predates the desktop pass that widened the authenticated
          shell (AppShell.tsx), so on a laptop it was a 448px phone column
          adrift in a 1400px+ window. Merely widening the column does not fix
          that, it just makes a stretched phone: a login form reads badly at
          full width, so the honest desktop treatment is to give the empty half
          something to do. The cover already exists and wants the room. */}
      <main className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col font-display px-[var(--gutter)] pb-[max(28px,env(safe-area-inset-bottom))] pt-[max(48px,calc(env(safe-area-inset-top)+28px))] md:border-x md:border-line-soft lg:max-w-none lg:px-12 xl:px-20">
        <div
          ref={scope}
          className="flex flex-1 flex-col lg:grid lg:min-h-0 lg:grid-cols-2 lg:items-center lg:gap-16"
        >
          <div data-mark className="flex items-center gap-3 lg:col-span-2">
            {/* The way back to the front door, the same place it sits on every
                page of the way in. */}
            <IconButton label="Back to the start" onClick={() => setStep("hero")}>
              <IconChevronLeft size={20} />
            </IconButton>
            <Logo size={22} className="text-text-1" />
            <Wordmark className="text-headline text-text-1" />
          </div>

          {/* The cover. The greeting is the poster and it is set in the
              ACCENT, which is the one thing that differs between all eighteen
              themes, so the look somebody just chose pays off the instant they
              land here rather than waiting for the dashboard.
              It is also tappable: touch it and it hands over to the next
              language early. A greeting that answers you is worth more than a
              greeting that only performs. */}
          <header className="flex flex-1 flex-col justify-center py-8 lg:py-0">
            <p
              data-enter
              className="text-label uppercase tracking-[0.22em] text-text-3"
            >
              know before you bunk
            </p>

            {/* The greeting owns the space between the eyebrow and the line
                below it. Its box is a fixed height whatever the script, so the
                gaps do not breathe as the languages turn. */}
            <div data-enter className="mt-5">
              <Greeting className="text-accent optical font-bold tracking-[-0.05em] [font-size:clamp(3.25rem,19vw,5.25rem)] lg:[font-size:7rem]" />
            </div>

            <p data-enter className="mt-7 max-w-[24ch] text-body leading-relaxed text-text-2">
              Your attendance, marks and timetable, in one place. Minus the
              portal.
            </p>
          </header>

          <div className="lg:flex lg:flex-col lg:justify-center">
            <div data-draw className="bleed relative mb-9 h-px bg-line lg:mx-0 lg:w-full lg:px-0">
              {/* Fills as the two fields are completed, in the same language as
                  every other measurement in the app: a rule that reaches its
                  mark. Width only, so it can never fight the entrance tween
                  that owns this element's scaleX. */}
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-500 ease-out"
                style={{ width: `${(filled / 2) * 100}%` }}
              />
            </div>
            <LoginForm onPhase={setPhase} onFilled={setFilled} />
            <p
              data-enter
              className="mt-5 text-callout leading-relaxed text-text-3"
            >
              Your Net ID and password go to the SRM portal to sign in. They are
              never stored on my server.
            </p>
          </div>

          <div
            data-enter
            className="mt-10 flex items-baseline justify-between gap-4 lg:col-span-2 lg:mt-0 lg:pb-2"
          >
            <p className="text-callout text-text-3">Not affiliated with SRM.</p>
            <CreatorCredit />
          </div>
        </div>
      </main>

      {phase !== "idle" && (
        <SyncSequence
          done={phase === "done"}
          name={displayName}
          facts={facts}
          onFinish={finish}
        />
      )}
    </>
    );
  }

  // The send-off sits in ONE place whatever the step, so swapping the tour for
  // the sign in underneath it does not remount it and restart the curtain.
  return (
    <>
      {view}
      {sendOff && (
        <SendOff
          from={sendOff}
          onCovered={() => setStep("signin")}
          onFinished={() => setSendOff(null)}
        />
      )}
    </>
  );
}
