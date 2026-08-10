"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Notebook from "./entry/Notebook";
import { Ink, Sticky, Star, Tape } from "./entry/paper";
import { INKS } from "./entry/inks";
import { markInstallOffered, useDeckPages } from "./entry/pages";
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

const INK = INKS.install;

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
  const pages = useDeckPages();
  const note = signedIn && ios;

  // This sheet is now part of the pad, and stays part of it once turned, or
  // dismissing the offer shortens the notebook under the reader. Only from the
  // entry deck: the copy shown inside the signed in app is not a sheet at all.
  useEffect(() => {
    if (!signedIn) markInstallOffered();
  }, [signedIn]);

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
    <Notebook
      page={pages.install ?? 2}
      total={pages.total}
      word="ON HOME"
      ink={INK}
      // No round arrow on this sheet. An arrow means "the next page", and this
      // page is not asking you to read on, it is asking you to leave, install,
      // and come back. The way past is therefore named: carrying on without
      // installing is a choice, so it says which choice it is.
      actionLabel="Use in browser instead"
      onNext={dismiss}
      onSkip={dismiss}
    >
      <div className="flex h-full flex-col">
        {/* Taped on rather than written: this page is an offer stuck into the
            pad, not part of the argument the rest of it is making. */}
        <div className="relative shrink-0 self-start">
          <Tape className="-left-3 -top-4 z-10" rotate={-9} width={72} />
          <Tape className="-right-4 -top-2 z-10" rotate={6} width={56} />
          <Sticky rotate={-1.5} tone="paper" className="px-5 py-4">
            <Ink tool="marker" colour={INK} size="text-[1.5rem]">
              Get Skipp on
              <br />
              your Home Screen
            </Ink>
          </Sticky>
        </div>
        <Star className="right-2 top-2" size={14} />

        {/* The steps float in whatever the heading and the sign off leave,
            rather than stacking under the heading and leaving half the sheet
            blank. Auto margins on the outer items rather than `justify-center`
            on the list: once free space goes negative a flex container treats
            them as zero, so on a short phone the list top aligns and scrolls
            instead of pushing its own first step out of reach. */}
        <ol className="no-scrollbar mt-7 flex min-h-0 flex-1 flex-col overflow-y-auto [&>*:first-child]:mt-auto [&>*:last-child]:mb-auto">
          {steps.map(({ Icon, text }, i) => (
            <li
              key={text}
              className="flex items-center gap-4 border-b py-4"
              style={{ borderColor: `${INK}22` }}
            >
              {/* The number is written, the icon is stamped. */}
              <Ink tool="pencil" colour={INK} size="text-[1.1rem]" className="w-6 shrink-0">
                {String(i + 1).padStart(2, "0")}
              </Ink>
              <span
                className="grid size-10 shrink-0 place-items-center rounded-xl"
                style={{ background: `${INK}18`, color: INK }}
              >
                <Icon size={18} />
              </span>
              <Ink tool="pen" colour={INK} size="text-[1.1rem]" className="min-w-0 flex-1">
                {text}
              </Ink>
            </li>
          ))}
          {note && (
            <li className="pt-4">
              <Ink tool="pencil" colour={INK} size="text-[1rem]" className="max-w-[30ch]">
                Signing in once more inside the installed app is normal: iOS keeps
                a home screen app&rsquo;s data separate from Safari&rsquo;s.
              </Ink>
            </li>
          )}
        </ol>

        {/* Chrome hands over a real install dialog, so on Android there is a
            genuine action to offer. Safari has no equivalent, which is the
            whole reason the written steps above exist, and on iOS this sheet
            correctly has no button of its own: the only way on is the named
            one in the footer. */}
        {native && (
          <div className="shrink-0 pb-1 pt-4">
            <button
              onClick={async () => {
                await native.prompt();
                await native.userChoice;
                dismiss();
              }}
              className="inline-flex min-h-12 items-center justify-center rounded-full px-7 transition-transform duration-200 active:scale-[0.97]"
              style={{ background: INK, color: "#F6F1E4" }}
            >
              <Ink tool="marker" colour="#F6F1E4" size="text-[1.15rem]">
                Install Skipp
              </Ink>
            </button>
          </div>
        )}
      </div>
    </Notebook>
  );
}
