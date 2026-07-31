"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import LoginForm, { type SignInPhase } from "@/components/LoginForm";
import Onboarding from "@/components/onboarding/Onboarding";
import SyncSequence, { type Fact } from "@/components/onboarding/SyncSequence";
import { markIntroSeen, useSeenIntro } from "@/lib/firstRun";
import CreatorCredit from "@/components/CreatorCredit";
import Logo, { Wordmark } from "@/components/Logo";
import { useSession } from "@/context/SessionContext";
import { playEntrance, useGsap } from "@/lib/motion";
import { WordMask } from "@/components/ui/editorial";
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

          {/* The cover. It grows to take whatever height the phone has and
              centres inside it, so a tall screen gives the type more room to
              breathe instead of opening a dead band above the form. The old
              layout hung the header off the top and the form off the bottom,
              which on a 6.7 inch phone left two voids and read as an empty
              form rather than a cover. */}
          <header className="flex flex-1 flex-col justify-center py-12">
            <h1 className="text-display">
              <WordMask text="Know before" className="block" />
              <WordMask text="you bunk." className="block" />
            </h1>
            {/* Says what the thing actually is. The screen previously asked for
                a password without once naming the product. */}
            <p data-enter className="mt-5 max-w-[24ch] text-body text-text-2">
              Your attendance, marks and timetable, in one place. Minus the
              portal.
            </p>
          </header>

          <div>
            <div data-draw className="bleed mb-9 h-px bg-line" />
            <LoginForm onPhase={setPhase} />
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
