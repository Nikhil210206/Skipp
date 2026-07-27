"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import gsap from "gsap";
import { EASE, playEntrance, prefersReducedMotion } from "@/lib/motion";
import {
  AttendancePreview,
  PrivacyPreview,
  TodayPreview,
} from "./IntroPreviews";
import { WordMask } from "@/components/ui/editorial";
import { Button } from "@/components/ui";

/**
 * The first-run onboarding: three panels on a draggable track, then never again.
 *
 * It exists because the app asks for an SRM password on the very first screen.
 * Someone sent a link by a friend deserves to know what this is, what it gives
 * them, and where their password goes, before being asked to type it.
 *
 * The track follows the finger rather than paging on release, and the progress
 * rail fills fractionally as you drag, so the gesture feels attached to the
 * content instead of triggering it.
 */

const SEEN_KEY = "skipp.seen-intro";

function readSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true; // storage blocked: do not trap anyone behind the intro
  }
}

/**
 * Whether the intro has already been shown. Through useSyncExternalStore rather
 * than an effect: this is client-only state read during render, and the server
 * snapshot says "seen" so a returning user never sees the intro flash.
 */
export function useSeenIntro(): boolean {
  return useSyncExternalStore(
    () => () => {},
    readSeen,
    () => true,
  );
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* non-fatal */
  }
}

const PANELS = [
  {
    eyebrow: "Skipp",
    title: "Know exactly how many classes you can miss.",
    body: "The maths runs for every subject, every day, so you never guess whether one more bunk is safe.",
  },
  {
    eyebrow: "One screen",
    title: "Attendance, marks and your day.",
    body: "Straight from the SRM portal, with the day order already worked out. No menus, no logging in twice.",
  },
  {
    eyebrow: "Before you sign in",
    title: "Your password never touches our servers.",
    body: "It goes to SRM to sign you in, then stays encrypted on this device. Skipp is not affiliated with SRM.",
  },
] as const;

export default function Intro({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const rails = useRef<(HTMLSpanElement | null)[]>([]);
  const panels = useRef<(HTMLDivElement | null)[]>([]);
  const art = useRef<(HTMLDivElement | null)[]>([]);

  const drag = useRef({ startX: 0, base: 0, active: false, width: 0 });
  const last = index === PANELS.length - 1;

  /** Rails fill fractionally, so the gesture reads as attached to the content. */
  const paintRails = useCallback((progress: number) => {
    rails.current.forEach((rail, i) => {
      if (!rail) return;
      const fill = Math.max(0, Math.min(1, progress - i + 1));
      gsap.set(rail, { scaleX: fill });
    });
  }, []);

  /**
   * The artwork trails its panel by 35%, so the graphic sits behind the words
   * rather than moving locked to them. This is what gives the drag depth
   * instead of the feel of a slideshow.
   */
  const paintParallax = useCallback((trackX: number, width: number) => {
    if (width === 0) return;
    art.current.forEach((layer, i) => {
      if (!layer) return;
      gsap.set(layer, { x: -0.35 * (trackX + i * width) });
    });
  }, []);

  const settleTo = useCallback(
    (next: number, animate = true) => {
      const el = track.current;
      const width = viewport.current?.clientWidth ?? 0;
      if (!el || width === 0) return;
      const target = -next * width;
      if (!animate || prefersReducedMotion()) {
        gsap.set(el, { x: target });
        paintRails(next);
        paintParallax(target, width);
        return;
      }
      gsap.to(el, {
        x: target,
        duration: 0.62,
        ease: EASE.emphasis,
        overwrite: true,
        onUpdate: () => {
          const x = gsap.getProperty(el, "x") as number;
          paintRails(-x / width);
          paintParallax(x, width);
        },
      });
    },
    [paintRails, paintParallax],
  );

  // Keep the track aligned when the viewport changes size.
  useEffect(() => {
    const onResize = () => settleTo(index, false);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [index, settleTo]);

  // Each panel plays the same entrance as the sign-in screen, so arriving at the
  // form feels like the end of one sequence rather than a different screen.
  useEffect(() => {
    const el = panels.current[index];
    if (!el) return;
    const text = playEntrance(el, prefersReducedMotion());
    return () => {
      text?.kill();
    };
  }, [index]);

  function go(next: number) {
    const clamped = Math.max(0, Math.min(PANELS.length - 1, next));
    setIndex(clamped);
    settleTo(clamped);
  }

  function finish() {
    markSeen();
    onDone();
  }

  // ---- drag ---------------------------------------------------------------
  function onPointerDown(e: React.PointerEvent) {
    const width = viewport.current?.clientWidth ?? 0;
    drag.current = {
      startX: e.clientX,
      base: (gsap.getProperty(track.current, "x") as number) ?? 0,
      active: true,
      width,
    };
    gsap.killTweensOf(track.current);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d.active || !track.current || d.width === 0) return;
    let x = d.base + (e.clientX - d.startX);
    // Resistance past the ends, so the track never feels broken.
    const min = -(PANELS.length - 1) * d.width;
    if (x > 0) x *= 0.35;
    if (x < min) x = min + (x - min) * 0.35;
    gsap.set(track.current, { x });
    paintRails(-x / d.width);
    paintParallax(x, d.width);
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    const dx = e.clientX - d.startX;
    // A short flick counts as much as a long drag.
    const moved = Math.abs(dx) > d.width * 0.18 || Math.abs(dx) > 64;
    go(moved ? index + (dx < 0 ? 1 : -1) : index);
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col px-[var(--gutter)] pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(36px,calc(env(safe-area-inset-top)+20px))] md:border-x md:border-line-soft">
      <header className="flex shrink-0 items-center justify-between">
        <div className="flex gap-1.5" aria-hidden>
          {PANELS.map((_, i) => (
            <span key={i} className="h-[2px] w-8 overflow-hidden rounded-full bg-line">
              <span
                ref={(el) => {
                  rails.current[i] = el;
                }}
                className="block h-full origin-left scale-x-0 bg-text-1"
              />
            </span>
          ))}
        </div>
        {!last && (
          <button
            onClick={finish}
            className="text-callout text-text-3 transition-colors hover:text-text-1"
          >
            Skip
          </button>
        )}
      </header>

      <div
        ref={viewport}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="-mx-[var(--gutter)] flex min-h-0 flex-1 touch-pan-y overflow-hidden"
      >
        <div ref={track} className="flex w-full shrink-0 will-change-transform">
          {PANELS.map((p, i) => (
            <div
              key={p.eyebrow}
              ref={(el) => {
                panels.current[i] = el;
              }}
              className="flex w-full shrink-0 flex-col justify-center overflow-hidden px-[var(--gutter)]"
            >
              <p data-mark className="text-label uppercase text-accent">
                {p.eyebrow}
              </p>
              <h1 className="mt-4 text-title">
                <WordMask text={p.title} />
              </h1>
              <p data-enter className="mt-4 max-w-[34ch] text-body text-text-2">
                {p.body}
              </p>
              <div
                ref={(el) => {
                  art.current[i] = el;
                }}
                data-enter
                className="mt-8 will-change-transform"
              >
                {i === 0 && <AttendancePreview />}
                {i === 1 && <TodayPreview />}
                {i === 2 && <PrivacyPreview />}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="shrink-0 pt-6">
        <div className="flex items-center gap-3">
          {/* Kept in the layout on the first panel rather than removed, so the
              primary button does not change width when it appears. `invisible`
              also takes it out of the tab order and the a11y tree. */}
          <Button
            variant="quiet"
            onClick={() => go(index - 1)}
            className={index === 0 ? "invisible" : ""}
          >
            Back
          </Button>
          <div className="flex-1">
            <Button
              variant="outline"
              size="lg"
              full
              onClick={() => (last ? finish() : go(index + 1))}
            >
              {last ? "Sign in" : "Next"}
            </Button>
          </div>
        </div>
        <p className="mt-3 text-center text-callout text-text-3">
          {last ? "Takes about ten seconds" : `${index + 1} of ${PANELS.length}`}
        </p>
      </div>
    </main>
  );
}
