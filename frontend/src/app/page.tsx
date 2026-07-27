"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import LoginForm from "@/components/LoginForm";
import { useSession } from "@/context/SessionContext";
import { revealIn, useGsap } from "@/lib/motion";
import { Spinner } from "@/components/ui";
import CreatorCredit from "@/components/CreatorCredit";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthed, restoring } = useSession();

  useEffect(() => {
    if (isAuthed) router.replace("/dashboard");
  }, [isAuthed, router]);

  const scope = useGsap(({ self, reduced }) =>
    revealIn(self, reduced, { y: 18, stagger: 0.08 }),
  );

  if (restoring || isAuthed) {
    return (
      <main className="flex min-h-full flex-1 items-center justify-center">
        <Spinner label="Opening Skipp" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-between px-[var(--gutter)] md:border-x md:border-line-soft pb-[max(28px,env(safe-area-inset-bottom))] pt-[max(56px,calc(env(safe-area-inset-top)+32px))]">
      <div ref={scope} className="flex flex-1 flex-col">
        <header data-reveal className="pt-10">
          <h1 className="text-display lowercase">skipp</h1>
          <p className="mt-4 text-title text-text-2">Know before you bunk.</p>
        </header>

        <div data-reveal className="mt-auto pt-12">
          <LoginForm />
        </div>
      </div>

      <div className="mt-8">
        <p className="text-callout leading-relaxed text-text-3">
          Not affiliated with SRM. Your credentials are sent to the portal for this
          sign-in only, never stored on our servers.
        </p>
        <CreatorCredit className="mt-6" />
      </div>
    </main>
  );
}
