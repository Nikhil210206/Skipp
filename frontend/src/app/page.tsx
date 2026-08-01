"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import LoginForm, { type SignInPhase } from "@/components/LoginForm";
import Onboarding from "@/components/onboarding/Onboarding";
import SyncSequence, { type Fact } from "@/components/onboarding/SyncSequence";
import { markIntroSeen, useSeenIntro } from "@/lib/firstRun";
import CreatorCredit from "@/components/CreatorCredit";
import Logo, { Wordmark } from "@/components/Logo";
import Greeting from "@/components/Greeting";
import { useSession } from "@/context/SessionContext";
import { playEntrance, useGsap } from "@/lib/motion";
import { Spinner } from "@/components/ui";

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
  const [dismissed, setDismissed] = useState(false);
  const showIntro = !seenIntro && !dismissed;

  // While the sign-in sequence is playing we are authenticated but deliberately
  // still here, so the redirect below has to stand down until it finishes.
  const [phase, setPhase] = useState<SignInPhase>("idle");
  /** How much of the form is done, 0 to 2, drawn as the rule above it. */
  const [filled, setFilled] = useState(0);

  useEffect(() => {
    if (isAuthed && phase === "idle") router.replace("/dashboard");
  }, [isAuthed, phase, router]);

  const scope = useGsap(
    ({ self, reduced }) => {
      if (restoring || isAuthed || showIntro) return;
      playEntrance(self, reduced);
    },
    [restoring, isAuthed, showIntro],
  );

  const finish = useCallback(() => router.replace("/dashboard"), [router]);

  // What the sequence lands on: the student's own numbers, read straight from
  // the snapshot that just arrived. Anything the portal gated is left out
  // rather than shown as a zero.
  const facts: Fact[] = [];
  if (timetable) {
    facts.push({ label: "Courses", value: String(timetable.courses.length) });
    facts.push({
      label: "Day orders",
      value: String(timetable.dayOrders.length),
    });
    if (attendance) {
      facts.push({
        label: "Attendance",
        value: `${attendance.overallPercentage.toFixed(1)}%`,
      });
    }
    facts.push({ label: "Term days", value: String(timetable.calendar.length) });
  }

  if (restoring || (isAuthed && phase === "idle")) {
    return (
      <main className="flex min-h-full flex-1 items-center justify-center">
        <Spinner label="Opening Skipp" />
      </main>
    );
  }

  if (showIntro) {
    return (
      <Onboarding
        onDone={() => {
          markIntroSeen();
          setDismissed(true);
        }}
      />
    );
  }

  return (
    <>
      <main className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col font-display px-[var(--gutter)] pb-[max(28px,env(safe-area-inset-bottom))] pt-[max(48px,calc(env(safe-area-inset-top)+28px))] md:border-x md:border-line-soft">
        <div ref={scope} className="flex flex-1 flex-col">
          <div data-mark className="flex items-center gap-2 pt-2">
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
          <header className="flex flex-1 flex-col justify-center py-8">
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
              <Greeting className="text-accent optical font-bold tracking-[-0.05em] [font-size:clamp(3.25rem,19vw,5.25rem)]" />
            </div>

            <p data-enter className="mt-7 max-w-[24ch] text-body leading-relaxed text-text-2">
              Your attendance, marks and timetable, in one place. Minus the
              portal.
            </p>
          </header>

          <div>
            <div data-draw className="bleed relative mb-9 h-px bg-line">
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
              never stored on our servers.
            </p>
          </div>

          <div
            data-enter
            className="mt-10 flex items-baseline justify-between gap-4"
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
