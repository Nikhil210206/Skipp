"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import LoginForm from "@/components/LoginForm";
import Intro, { useSeenIntro } from "@/components/Intro";
import CreatorCredit from "@/components/CreatorCredit";
import { useSession } from "@/context/SessionContext";
import { playEntrance, useGsap } from "@/lib/motion";
import { WordMask } from "@/components/ui/editorial";
import { Spinner } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthed, restoring } = useSession();

  const seenIntro = useSeenIntro();
  const [dismissed, setDismissed] = useState(false);
  const showIntro = !seenIntro && !dismissed;

  useEffect(() => {
    if (isAuthed) router.replace("/dashboard");
  }, [isAuthed, router]);

  // The signature moment: the promise slides up out of its own edge, a rule is
  // drawn under it, and the form arrives after. Once, then still.
  const scope = useGsap(
    ({ self, reduced }) => {
      if (restoring || isAuthed || showIntro) return;
      playEntrance(self, reduced);
    },
    [restoring, isAuthed, showIntro],
  );

  if (restoring || isAuthed) {
    return (
      <main className="flex min-h-full flex-1 items-center justify-center">
        <Spinner label="Opening Skipp" />
      </main>
    );
  }

  if (showIntro) return <Intro onDone={() => setDismissed(true)} />;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-between px-[var(--gutter)] pb-[max(28px,env(safe-area-inset-bottom))] pt-[max(48px,calc(env(safe-area-inset-top)+28px))] md:border-x md:border-line-soft">
      <div ref={scope} className="flex flex-1 flex-col">
        <header className="pt-6">
          <p data-mark className="text-label uppercase text-text-3">
            Skipp
          </p>
          <h1 className="mt-4 text-hero">
            <WordMask text="Know before" className="block" />
            <WordMask text="you bunk." className="block" />
          </h1>
          <div data-draw className="bleed mt-7 h-px bg-line" />
        </header>

        <div className="mt-auto pt-12">
          <LoginForm />
          <p data-enter className="mt-5 text-callout leading-relaxed text-text-3">
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
  );
}
