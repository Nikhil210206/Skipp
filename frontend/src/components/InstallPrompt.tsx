"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Overlay";
import { Button } from "@/components/ui";

/**
 * Asks the student to put Skipp on the home screen.
 *
 * It asks rather than insists. There is no way to detect that someone created a
 * shortcut: the only observable fact is whether this page is *running* in
 * standalone mode, and on iOS a home screen app gets its own storage container,
 * so a student blocked until they install would have to sign in a second time
 * inside the installed app, spending another sign-in against the portal's daily
 * cap. So the prompt is loud, repeats, and never blocks.
 */

const KEY = "skipp.install-prompt";
// Shown again after this, so one dismissal is not forever, but it is not
// nagging on every launch either.
const SNOOZE_MS = 5 * 24 * 60 * 60 * 1000;

type BeforeInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS predates the standard and still reports it here.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac, but a Mac has no touch.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function snoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

export default function InstallPrompt() {
  const [open, setOpen] = useState(false);
  const [native, setNative] = useState<BeforeInstallPrompt | null>(null);

  useEffect(() => {
    if (isStandalone() || snoozed()) return;
    // A beat after the app settles, so it never lands on top of the arrival.
    const t = setTimeout(() => setOpen(true), 1400);
    return () => clearTimeout(t);
  }, []);

  // Chrome hands over a real install dialog. Safari has no equivalent, which is
  // why the iOS path is written instructions.
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setNative(e as BeforeInstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const onInstalled = () => setOpen(false);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      // Private mode: it will ask again next launch, which is survivable.
    }
    setOpen(false);
  }

  const ios = isIOS();

  return (
    <Sheet
      open={open}
      onClose={dismiss}
      title="Put Skipp on your home screen"
      footer={
        native ? (
          <Button
            size="lg"
            full
            onClick={async () => {
              await native.prompt();
              await native.userChoice;
              dismiss();
            }}
          >
            Install
          </Button>
        ) : (
          <Button variant="secondary" size="lg" full onClick={dismiss}>
            Got it
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-5 pb-2 pt-1">
        <p className="text-body leading-relaxed text-text-2">
          It opens like a real app, full screen, with no browser bar. Your
          timetable and attendance are already saved on this device, so it starts
          instantly.
        </p>

        {ios && !native && (
          <ol className="flex flex-col gap-3">
            <Step n="1">
              Tap the <span className="text-text-1">Share</span> button at the
              bottom of Safari.
            </Step>
            <Step n="2">
              Scroll down and choose{" "}
              <span className="text-text-1">Add to Home Screen</span>.
            </Step>
            <Step n="3">
              Tap <span className="text-text-1">Add</span>. Open Skipp from the
              icon from now on.
            </Step>
          </ol>
        )}

        {!ios && !native && (
          <ol className="flex flex-col gap-3">
            <Step n="1">
              Open your browser&rsquo;s menu, the three dots.
            </Step>
            <Step n="2">
              Choose <span className="text-text-1">Add to Home screen</span> or{" "}
              <span className="text-text-1">Install app</span>.
            </Step>
          </ol>
        )}

        {ios && (
          <p className="text-callout leading-relaxed text-text-3">
            Signing in once more inside the installed app is normal: iOS keeps a
            home screen app&rsquo;s data separate from Safari&rsquo;s.
          </p>
        )}
      </div>
    </Sheet>
  );
}

function Step({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="tnum shrink-0 text-label uppercase text-text-3">{n}</span>
      <span className="text-body leading-relaxed text-text-2">{children}</span>
    </li>
  );
}
