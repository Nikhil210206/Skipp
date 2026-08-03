"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import EntryChapter, { ACCENT, CREAM } from "./entry/EntryChapter";
import { IconAddSquare, IconCheck, IconMenuDots, IconShare } from "./Icons";

/**
 * The way onto the home screen, as the second chapter of the entry deck.
 *
 * It was a bottom sheet, and a sheet is what you use to ASK quietly. This asks
 * with the whole screen, because the installed app is a genuinely different
 * product: it starts from the copy already on the phone, it has no browser
 * chrome eating a fifth of a 6.7 inch display, and **on iOS it is the only
 * context that can show a notification at all**.
 *
 * Built from the same furniture as the welcome before it and the onboarding
 * chapters after it, so the whole way in reads as one publication. Its room is
 * a deep ocean against the welcome's warm ember, so advancing feels like moving
 * somewhere rather than reskinning the same screen.
 *
 * **It still never blocks.** There is no way to observe that somebody made a
 * shortcut, only whether this page is *running* standalone, so a hard wall
 * would trap anyone whose browser cannot install (some in-app browsers, Firefox
 * on iOS) with no route to their own attendance. "Use in browser instead" is
 * deliberately quiet rather than absent.
 *
 * The placement matters as much as the design. Shown to a SIGNED OUT visitor,
 * installing costs nothing: they install, then sign in once, inside the
 * installed app. Shown after sign-in it costs a second sign-in against the
 * portal's daily cap, because iOS gives a home screen app its own storage
 * container and the session in Safari does not follow it. Hence `signedIn`,
 * which only adds the sentence that warns about it.
 */

const FIELD = "#052A44";

const KEY = "skipp.install-prompt";
/** One dismissal is not forever, but it is not a nag on every launch either. */
const SNOOZE_MS = 5 * 24 * 60 * 60 * 1000;

type BeforeInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS predates the standard and still reports it here.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac, but a Mac has no touch.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Phones and tablets only. The desktop layout is a first class thing now, with
 * its own sidebar, so telling a laptop to install would be nonsense. A coarse
 * pointer alone is not enough (touch laptops exist), so it is paired with the
 * width below which the sidebar does not appear.
 */
function isHandheld(): boolean {
  return window.matchMedia("(pointer: coarse) and (max-width: 1023px)").matches;
}

function snoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

/** Stand the offer down for the usual snooze, from anywhere. */
export function snoozeInstallOffer(): void {
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* private mode */
  }
  listeners.forEach((l) => l());
}

// Read through useSyncExternalStore rather than an effect: the answer depends on
// facts the server cannot know, and a setState in an effect both flashes the
// wrong frame and is rejected by the React compiler lint.
let listeners: (() => void)[] = [];

function subscribe(cb: () => void) {
  listeners.push(cb);
  window.addEventListener("resize", cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
    window.removeEventListener("resize", cb);
  };
}

function snapshot(): boolean {
  try {
    return isHandheld() && !isStandalone() && !snoozed();
  } catch {
    return false;
  }
}

/** The server has no user agent worth trusting, so it never renders the gate. */
const serverSnapshot = () => false;

export function useShouldOfferInstall(): boolean {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

export default function InstallGate({
  onDismiss,
  signedIn = false,
}: {
  onDismiss: () => void;
  /** Adds the iOS "you will sign in again" caveat, true only inside the app. */
  signedIn?: boolean;
}) {
  const [native, setNative] = useState<BeforeInstallPrompt | null>(null);
  const ios = isIOS();

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setNative(e as BeforeInstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    snoozeInstallOffer();
    onDismiss();
  }

  const steps = ios
    ? [
        { Icon: IconShare, text: "Tap Share in the Safari toolbar" },
        { Icon: IconAddSquare, text: "Choose Add to Home Screen" },
        { Icon: IconCheck, text: "Open Skipp from the new icon" },
      ]
    : [
        { Icon: IconMenuDots, text: "Open the browser menu" },
        { Icon: IconAddSquare, text: "Choose Install app, or Add to Home screen" },
        { Icon: IconCheck, text: "Open Skipp from the new icon" },
      ];

  return (
    <EntryChapter
      field={FIELD}
      eyebrow="the browser is the long way round"
      word="ON HOME"
      actions={
        <div data-in className="flex flex-col gap-1">
          {/* Chrome hands over a real install dialog. Safari has no equivalent,
              which is the whole reason the steps above exist. */}
          {native && (
            <button
              onClick={async () => {
                await native.prompt();
                await native.userChoice;
                dismiss();
              }}
              className="inline-flex min-h-[52px] items-center justify-center rounded-full text-body font-semibold transition-transform duration-200 active:scale-[0.97]"
              style={{ background: CREAM, color: FIELD }}
            >
              Install Skipp
            </button>
          )}
          <button
            onClick={dismiss}
            className="mx-auto inline-flex min-h-11 items-center px-3 text-callout opacity-60 transition-opacity hover:opacity-100"
          >
            Use in browser instead
          </button>
        </div>
      }
    >
      <Stage steps={steps} note={signedIn && ios} />
    </EntryChapter>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The stage: a numbered index of the taps to make.
 *
 * A list that is mostly rule, so it reads as instructions rather than as
 * decoration, and unlike any other stage in the deck: the welcome is surfaces
 * in depth, chapter one is a fanned stack, chapter three is a live meter.
 */
function Stage({
  steps,
  note,
}: {
  steps: { Icon: (p: { size?: number; className?: string }) => React.ReactNode; text: string }[];
  note: boolean;
}) {
  return (
    <div className="no-scrollbar flex h-full flex-col justify-center overflow-y-auto px-[var(--gutter)] pt-[max(56px,calc(env(safe-area-inset-top)+40px))]">
      <p data-in className="max-w-[26ch] text-body leading-relaxed opacity-75">
        It opens full screen with no browser bar, and starts instantly from the
        copy already on this phone.
      </p>

      <ol className="mt-7 flex flex-col">
        {steps.map(({ Icon, text }, i) => (
          <li
            key={text}
            data-in
            className="flex items-center gap-4 border-t py-4 last:border-b"
            style={{ borderColor: "currentColor", borderTopWidth: 1, opacity: 0.999 }}
          >
            <span className="tnum text-label uppercase opacity-45">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span style={{ color: ACCENT }}>
              <Icon size={19} />
            </span>
            <span className="min-w-0 flex-1 text-body leading-relaxed">{text}</span>
          </li>
        ))}
      </ol>

      {note && (
        <p data-in className="mt-5 max-w-[30ch] text-callout leading-relaxed opacity-55">
          Signing in once more inside the installed app is normal: iOS keeps a
          home screen app&rsquo;s data separate from Safari&rsquo;s.
        </p>
      )}
    </div>
  );
}
