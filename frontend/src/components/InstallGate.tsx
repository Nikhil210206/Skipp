"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import gsap from "gsap";
import Logo from "./Logo";
import { IconAddSquare, IconCheck, IconMenuDots, IconShare } from "./Icons";
import { useLockScroll } from "./ui/Overlay";
import { useGsap } from "@/lib/motion";
import { haptic } from "@/lib/haptics";
import Rise from "./front/Rise";
import { BackButton, C, DISPLAY, DotField, Eyebrow, GhostPill, PrimaryPill, Receipt } from "./front/kit";
import { usePaintChrome } from "./front/chrome";

/**
 * The way onto the home screen.
 *
 * A full screen ask rather than a sheet, because the installed app is a
 * genuinely different product: it starts from the copy already on the phone,
 * it has no browser chrome eating a fifth of the display, and **on iOS it is
 * the only context that can show a notification at all**.
 *
 * It is set in the front door's one language (`front/kit.tsx`), and it is the
 * one screen of the way in that is not part of the numbered tour: it is a
 * question about where Skipp lives, not a chapter about what it does. The
 * object is a home screen with an empty slot, and the Skipp icon drops into
 * it, which is the whole request drawn. (Rebuilt with the front door and the
 * tour, 2026-10-26; it was a notebook page.)
 *
 * **It still never blocks.** There is no way to observe that somebody made a
 * shortcut, only whether this page is *running* standalone, so a hard wall
 * would trap anyone whose browser cannot install (some in-app browsers, Firefox
 * on iOS) with no route to their own attendance. "Use in browser instead" is
 * always there.
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

export function isStandalone(): boolean {
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
  onBack,
  signedIn = false,
}: {
  onDismiss: () => void;
  /** The way back to the front door. Absent inside the app, where it is an overlay. */
  onBack?: () => void;
  /** Adds the iOS "you will sign in again" caveat, true only inside the app. */
  signedIn?: boolean;
}) {
  const [native, setNative] = useState<BeforeInstallPrompt | null>(null);
  const ios = isIOS();
  const note = signedIn && ios;

  usePaintChrome(C.ground);
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
    haptic("tick");
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
        { Icon: IconAddSquare, text: "Choose Install app or Add to Home screen" },
        { Icon: IconCheck, text: "Open Skipp from the new icon" },
      ];

  const scope = useGsap(({ reduced }) => {
    if (reduced) return;
    const tl = gsap.timeline({ delay: 0.15 });
    tl.fromTo("[data-char]", { yPercent: 120 }, { yPercent: 0, duration: 0.95, ease: "expo.out", stagger: 0.016 }, 0)
      .fromTo("[data-f]", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, ease: "expo.out", stagger: 0.07 }, 0.25)
      .fromTo("[data-app]", { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(2)", stagger: 0.04 }, 0.35)
      // The one that matters lands last, from above, with a bounce.
      .fromTo("[data-skipp]", { y: -90, scale: 1.25, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.8, ease: "bounce.out" }, 0.9);
  }, []);

  return (
    <div
      ref={scope}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden font-sans"
      style={{ background: C.ground, color: C.text }}
    >
      <DotField className="absolute right-0 top-0 h-[42%] w-[85%]" origin={[1, 0]} reach={0.8} />

      <div className="relative z-10 mx-auto flex w-full max-w-[560px] shrink-0 items-center gap-4 px-6 pt-[max(14px,env(safe-area-inset-top))]">
        {onBack && <BackButton onClick={onBack} label="Back to the start" />}
        <Eyebrow>BEFORE YOU START</Eyebrow>
      </div>

      <div className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-[560px] flex-col px-6 pt-5 short:pt-3">
          <Rise
            text="put skipp on"
            className="text-[42px] font-extrabold leading-[0.92] tracking-[-0.045em] short:text-[36px]"
            style={{ fontFamily: DISPLAY }}
          />
          <Rise
            text="your home screen."
            className="font-hand text-[46px] font-bold leading-none short:text-[40px]"
            style={{ color: C.accent }}
          />
          <p data-f className="mt-4 text-[16px] leading-[1.5] short:hidden" style={{ color: C.dim }}>
            Full screen, no browser bar, opens instantly. On iPhone it is also
            the only way Skipp can nudge you before a class.
          </p>

          <div className="my-auto py-6 short:py-3">
            <div
              data-f
              aria-hidden
              className="grid grid-cols-4 gap-x-4 gap-y-3 rounded-[24px] border-2 p-5 short:gap-y-2 short:p-4"
              style={{ borderColor: C.line, background: C.card }}
            >
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i} className="flex flex-col items-center gap-1.5">
                  <span data-app className="aspect-square w-full rounded-[16px]" style={{ background: C.raised }} />
                  <span className="h-1.5 w-3/5 rounded-full" style={{ background: C.raised }} />
                </span>
              ))}
              <span className="flex flex-col items-center gap-1.5">
                <span
                  data-skipp
                  className="grid aspect-square w-full place-items-center rounded-[16px]"
                  style={{ background: C.accent, color: C.onAccent, boxShadow: `0 10px 22px -8px ${C.accent}` }}
                >
                  <Logo size={30} mono />
                </span>
                <span className="text-[11px] font-semibold leading-none">skipp</span>
              </span>
            </div>

            <div data-f className="mt-4">
              <Receipt label="HOW" aside={ios ? "SAFARI" : "YOUR BROWSER"}>
                <ol>
                  {steps.map(({ Icon, text }, i) => (
                    <li
                      key={text}
                      className="flex items-center gap-3.5 border-t-2 px-4 py-3 first:border-t-0 short:py-2"
                      style={{ borderColor: C.line }}
                    >
                      <span className="font-mono text-[11px] font-semibold" style={{ color: C.accent }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1 text-[15px] font-medium leading-snug">{text}</span>
                      <span style={{ color: C.dim }}>
                        <Icon size={18} />
                      </span>
                    </li>
                  ))}
                </ol>
              </Receipt>
            </div>
            {note && (
              <p className="mt-4 text-[14px] leading-[1.5]" style={{ color: C.dim }}>
                Signing in once more inside the installed app is normal: iOS keeps
                a home screen app&rsquo;s data separate from Safari&rsquo;s.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[560px] shrink-0 flex-col gap-2 px-6 pb-[max(18px,env(safe-area-inset-bottom))] pt-2">
        {/* Chrome hands over a real install dialog, so on Android there is a
            genuine action to offer. Safari has no equivalent, which is the
            whole reason the written steps exist, and there the only button is
            the quiet way past: the steps are the action. */}
        {native && (
          <PrimaryPill
            label="install skipp"
            className="w-full"
            onClick={async () => {
              await native.prompt();
              await native.userChoice;
              dismiss();
            }}
          />
        )}
        <GhostPill label="use in browser instead" onClick={dismiss} className="w-full" />
      </div>
    </div>
  );
}
