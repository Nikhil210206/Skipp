"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

/**
 * The net under every screen.
 *
 * Without one of these, a single render-time exception takes the whole app to a
 * blank white page with no way back, which is the worst possible failure for
 * something a student opens between classes. It matters more here than in most
 * apps: the screens render data scraped from a portal that can change shape
 * without warning, so a field that turns null is a plausible Tuesday.
 *
 * The student's data is untouched by this, it is cached on the device, so the
 * honest thing to say is "this screen broke", not "something went wrong".
 */
export default function ScreenError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // No error service to report to, and there must never be one that could
    // carry portal data off the device. The console is for whoever is looking.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-[var(--gutter)] pb-[max(28px,env(safe-area-inset-bottom))]">
      <p className="text-label uppercase text-text-3">This screen broke</p>
      <h1 className="mt-5 text-display">Not your fault.</h1>
      <div className="bleed mt-7 h-px bg-line" />
      <p className="mt-5 max-w-[30ch] text-body text-text-2">
        Something in this page did not render. Your attendance and timetable are
        saved on this device and are unaffected.
      </p>
      <div className="mt-8 flex flex-wrap gap-2.5">
        <Button onClick={() => unstable_retry()} variant="outline" size="lg">
          Try again
        </Button>
        <Button onClick={() => window.location.assign("/dashboard")} variant="secondary" size="lg">
          Go home
        </Button>
      </div>
      {error.digest && (
        <p className="tnum mt-6 text-callout text-text-3">
          Reference {error.digest}
        </p>
      )}
    </main>
  );
}
