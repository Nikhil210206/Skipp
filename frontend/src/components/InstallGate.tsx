"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import gsap from "gsap";
import Logo from "./Logo";
import { IconAddSquare, IconCheck, IconMenuDots, IconShare } from "./Icons";
import { useLockScroll } from "./ui/Overlay";
import { useGsap } from "@/lib/motion";
import { haptic } from "@/lib/haptics";
import Rise from "./front/Rise";
import { RoomButton } from "./front/RoomFrame";
import { ROOMS } from "./front/rooms";
import { usePaintChrome } from "./front/chrome";

/**
 * The way onto the home screen.
 *
 * A full screen ask rather than a sheet, because the installed app is a
 * genuinely different product: it starts from the copy already on the phone,
 * it has no browser chrome eating a fifth of the display, and **on iOS it is
 * the only context that can show a notification at all**.
 *
 * Its room is CLAY, the soft look, and it is the one screen of the way in that
 * is not part of the numbered tour: it is a question about where Skipp lives,
 * not a chapter about what it does. The object is a home screen with an empty
 * slot, and the Skipp icon drops into it, which is the whole request drawn.
 * (Rebuilt with the front door and the tour, 2026-10-27; it was a notebook
 * page.)
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
  signedIn = false,
}: {
  onDismiss: () => void;
  /** Adds the iOS "you will sign in again" caveat, true only inside the app. */
  signedIn?: boolean;
}) {
  const room = ROOMS.clay;
  const [native, setNative] = useState<BeforeInstallPrompt | null>(null);
  const ios = isIOS();
  const note = signedIn && ios;

  usePaintChrome(room.bg);
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
    tl.fromTo(
      "[data-char]",
      { yPercent: 120 },
      { yPercent: 0, duration: 0.95, ease: "expo.out", stagger: 0.016 },
      0,
    )
      .fromTo(
        "[data-f]",
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.7, ease: "expo.out", stagger: 0.07 },
        0.25,
      )
      .fromTo(
        "[data-app]",
        { scale: 0.6, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(2)", stagger: 0.04 },
        0.35,
      )
      // The one that matters lands last, from above, with a bounce.
      .fromTo(
        "[data-skipp]",
        { y: -90, scale: 1.25, opacity: 0 },
        { y: 0, scale: 1, opacity: 1, duration: 0.8, ease: "bounce.out" },
        0.9,
      )
      .fromTo(
        "[data-step]",
        { opacity: 0, y: 24, scale: 0.94 },
        { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "back.out(1.6)", stagger: 0.09 },
        0.75,
      );
  }, []);

  /** The other apps on the screen: pale tiles, so the one in colour is Skipp. */
  const tiles = ["#d9ddf7", "#cfd4f5", "#e2e5fa", "#d4d9f6", "#c8cef3", "#dde1f8", "#d0d5f5"];

  return (
    <div
      ref={scope}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      style={{ background: room.bg, color: room.ink }}
    >
      <div className="mx-auto flex w-full max-w-[560px] shrink-0 items-center px-6 pt-[max(18px,env(safe-area-inset-top))]">
        <p data-f className="font-mono text-[11px] font-semibold tracking-[0.16em]" style={{ color: room.faint }}>
          BEFORE YOU START
        </p>
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-[560px] flex-col px-6 pt-5">
          <Rise
            text="put skipp on"
            className="text-[38px] font-bold leading-[1] tracking-[-0.03em] short:text-[34px]"
            style={{ fontFamily: room.head }}
          />
          <Rise
            text="your home screen."
            className="text-[38px] font-bold leading-[1.05] tracking-[-0.03em] short:text-[34px]"
            style={{ fontFamily: room.head, color: room.accentText }}
          />
          <p data-f className="mt-4 text-[16px] leading-[1.5] short:hidden" style={{ color: room.dim }}>
            Full screen, no browser bar, opens instantly. On iPhone it is also
            the only way Skipp can nudge you before a class.
          </p>

          <div className="my-auto py-6 short:py-3">
            <div
              data-f
              className="grid grid-cols-4 gap-x-4 gap-y-3 rounded-[28px] p-5 short:gap-y-2 short:p-4"
              style={{ background: "#f6f7fe", boxShadow: "0 18px 36px -22px rgba(107,77,255,0.45)" }}
              aria-hidden
            >
              {tiles.map((c, i) => (
                <span key={i} className="flex flex-col items-center gap-1.5">
                  <span data-app className="aspect-square w-full rounded-[16px]" style={{ background: c }} />
                  <span className="h-1.5 w-3/5 rounded-full" style={{ background: "#e3e6f8" }} />
                </span>
              ))}
              <span className="flex flex-col items-center gap-1.5">
                <span
                  data-skipp
                  className="grid aspect-square w-full place-items-center rounded-[16px]"
                  style={{ background: "#f2661c", color: "#140700", boxShadow: "0 10px 18px -8px rgba(242,102,28,0.6)" }}
                >
                  <Logo size={30} mono />
                </span>
                <span className="text-[11px] font-semibold leading-none" style={{ color: room.ink }}>
                  skipp
                </span>
              </span>
            </div>

            <ol className="mt-5 flex flex-col gap-2.5 short:mt-3 short:gap-2">
              {steps.map(({ Icon, text }, i) => (
                <li
                  key={text}
                  data-step
                  className="flex items-center gap-3.5 rounded-[22px] px-4 py-3 short:py-2"
                  style={{ background: "#f6f7fe", boxShadow: "0 10px 22px -16px rgba(107,77,255,0.5)" }}
                >
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-full"
                    style={{ background: "#e6e9fb", color: room.accentText }}
                  >
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1 text-[15px] font-medium leading-snug">{text}</span>
                  <span className="font-mono text-[11px] font-semibold" style={{ color: room.faint }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </li>
              ))}
            </ol>
            {note && (
              <p className="mt-4 text-[14px] leading-[1.5]" style={{ color: room.dim }}>
                Signing in once more inside the installed app is normal: iOS keeps
                a home screen app&rsquo;s data separate from Safari&rsquo;s.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[560px] shrink-0 flex-col gap-2 px-6 pb-[max(18px,env(safe-area-inset-bottom))] pt-2">
        {/* Chrome hands over a real install dialog, so on Android there is a
            genuine action to offer. Safari has no equivalent, which is the
            whole reason the written steps exist, and there the only button is
            the way past. */}
        {native && (
          <RoomButton
            room={room}
            label="install skipp"
            onClick={async () => {
              await native.prompt();
              await native.userChoice;
              dismiss();
            }}
          />
        )}
        <RoomButton
          room={room}
          label="use in browser instead"
          solid={false}
          arrow={false}
          onClick={dismiss}
        />
      </div>
    </div>
  );
}
