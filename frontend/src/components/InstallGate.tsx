"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Logo, { Wordmark } from "./Logo";
import { Button } from "./ui";
import { useLockScroll } from "./ui/Overlay";
import { IconAddSquare, IconCheck, IconMenuDots, IconShare } from "./Icons";

/**
 * The way onto the home screen, as a full screen takeover.
 *
 * It was a dismissible bottom sheet, and a sheet is what you use to ASK. This
 * asks with the whole screen, because the installed app is a genuinely
 * different product: it starts from the copy already on the phone, it has no
 * browser chrome eating a fifth of a 6.7 inch display, and **on iOS it is the
 * only context that can receive a notification at all**. A student left in
 * Safari cannot be told a class is starting, however good the rest of it is.
 *
 * **It still never blocks.** There is no way to observe that somebody made a
 * shortcut, only whether this page is *running* standalone, so a hard wall
 * would trap anyone whose browser cannot install (some in-app browsers, Firefox
 * on iOS) with no route to their own attendance. The way past is deliberately
 * quiet rather than absent.
 *
 * The placement matters as much as the design. Shown to a SIGNED OUT visitor,
 * installing costs nothing: they install, then sign in once, inside the
 * installed app. Shown after sign-in it costs a second sign-in against the
 * portal's daily cap, because iOS gives a home screen app its own storage
 * container and the session in Safari does not follow it. Hence `signedIn`,
 * which only adds the sentence that warns about it.
 */

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

  // The document behind is still a scrolling page, and iOS will happily bounce
  // it into view under a fixed overlay. Same fix as the onboarding deck.
  useLockScroll(true);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setNative(e as BeforeInstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      // Private mode: it asks again next launch, which is survivable.
    }
    listeners.forEach((l) => l());
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
    <div
      className="fixed inset-0 z-50 flex flex-col bg-ink-0 font-display"
      style={{ minHeight: "100dvh" }}
      role="dialog"
      aria-modal="true"
      aria-label="Add Skipp to your home screen"
    >
      {/* The reading half scrolls; the actions below do not. Measured at 899px
          of content against an 844px iPhone viewport, which put "continue in
          browser" at y=831 and off the bottom of anything shorter. A way past
          that has to be discovered by scrolling is not a way past, so the two
          controls are pinned and only the text moves.

          Top aligned, never centred: a centred column that overflows pushes its
          own top out of reach, and the headline would go behind the status bar
          with no way to scroll back up to it. */}
      <div className="no-scrollbar mx-auto flex w-full max-w-md flex-1 flex-col overflow-y-auto px-[var(--gutter)] pt-[max(26px,calc(env(safe-area-inset-top)+16px))]">
        <div className="flex items-center gap-2">
          <Logo size={22} className="text-text-1" />
          <Wordmark className="text-headline text-text-1" />
        </div>

        <p className="mt-8 text-label uppercase tracking-[0.22em] text-text-3">
          the browser is the long way round
        </p>

        <h1 className="mt-4 text-display font-bold leading-[0.95] tracking-[-0.04em] text-text-1">
          Put Skipp on your home screen.
        </h1>

        {/* The rule and its tick: the same device every screen in the app is
            built on, so the way in already looks like the thing itself.

            `shrink-0` is load bearing. This is a flex child in a column that
            overflows on a short phone, and a 1px box with no content inside it
            has nothing to hold it open, so flex shrank it to exactly 0 and the
            rule vanished while its tick still floated in mid air. Measured, not
            guessed: height came back 0 on a 667px viewport. */}
        <div className="bleed relative mt-7 h-px shrink-0 bg-line">
          <span
            aria-hidden
            className="absolute -top-[7px] h-[15px] w-[2px] bg-accent"
            style={{ left: "75%" }}
          />
        </div>

        <p className="mt-6 max-w-[30ch] text-body leading-relaxed text-text-2">
          It opens full screen with no browser bar, starts instantly from the
          copy already on this phone, and it is the only place a class reminder
          can reach you.
        </p>

        <ol className="mt-7 flex flex-col">
          {steps.map(({ Icon, text }, i) => (
            <li
              key={text}
              className="flex items-center gap-4 border-t border-line-soft py-3.5 last:border-b"
            >
              <span className="tnum shrink-0 text-label uppercase text-text-3">
                {String(i + 1).padStart(2, "0")}
              </span>
              <Icon size={19} className="shrink-0 text-accent" />
              <span className="text-body leading-relaxed text-text-2">
                {text}
              </span>
            </li>
          ))}
        </ol>

        {signedIn && ios && (
          <p className="mt-5 text-callout leading-relaxed text-text-3">
            Signing in once more inside the installed app is normal: iOS keeps a
            home screen app&rsquo;s data separate from Safari&rsquo;s.
          </p>
        )}

        {/* So the last line never sits flush against the pinned actions. */}
        <div aria-hidden className="h-6 shrink-0" />
      </div>

      <div className="mx-auto w-full max-w-md shrink-0 border-t border-line-soft px-[var(--gutter)] pb-[max(18px,env(safe-area-inset-bottom))] pt-3">
        {/* Chrome hands over a real install dialog. Safari has no equivalent,
            which is the whole reason the steps above exist. */}
        {native && (
          <Button
            size="lg"
            full
            onClick={async () => {
              await native.prompt();
              await native.userChoice;
              dismiss();
            }}
          >
            Install Skipp
          </Button>
        )}
        <button
          onClick={dismiss}
          className="mx-auto mt-1 flex min-h-11 items-center px-3 text-callout text-text-3 transition-colors hover:text-text-2"
        >
          continue in browser
        </button>
      </div>
    </div>
  );
}
