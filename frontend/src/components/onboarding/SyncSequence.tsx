"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import RollingNumber from "./RollingNumber";
import { DUR, EASE, prefersReducedMotion } from "@/lib/motion";
import Logo, { Wordmark } from "@/components/Logo";

export type Fact = { label: string; value: string };

/**
 * THE SECOND HALF OF THE OPENING.
 *
 * Signing in to the portal genuinely takes several seconds: we log in to Zoho,
 * follow the handoff, and pull three Creator pages. That wait is the one moment
 * the app has the student's full attention, so it is staged rather than spent
 * on a spinner.
 *
 * While the work is in flight the screen says only what is true and vague. It
 * ticks nothing off, because nothing has arrived. The moment the snapshot lands,
 * the student's own numbers drop into place one line at a time, and that is the
 * dashboard assembling itself: every figure here is the real one, read from the
 * snapshot, not a placeholder.
 */

const STATUS = [
  "Signing in to SRM",
  "Following the handoff",
  "Reading your portal",
  "Almost there",
];

export default function SyncSequence({
  done,
  name,
  facts,
  onFinish,
}: {
  done: boolean;
  /** The student's own name, the first proof that the fetch worked. */
  name: string;
  facts: Fact[];
  onFinish: () => void;
}) {
  const [step, setStep] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const status = useRef<HTMLParagraphElement>(null);
  const sweep = useRef<HTMLSpanElement>(null);
  const rows = useRef<HTMLUListElement>(null);
  const played = useRef(false);

  // Status advances on its own while we wait. It never claims a stage is
  // complete, only what is being attempted, so a slow portal cannot make it lie.
  useEffect(() => {
    if (done) return;
    const id = setInterval(
      () => setStep((s) => Math.min(s + 1, STATUS.length - 1)),
      2200,
    );
    return () => clearInterval(id);
  }, [done]);

  // Arrival, and the waiting sweep.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0 },
        { opacity: 1, duration: DUR.quick, ease: EASE.out },
      );
      if (sweep.current) {
        gsap.fromTo(
          sweep.current,
          { xPercent: -100 },
          {
            xPercent: 400,
            duration: 1.5,
            ease: "power1.inOut",
            repeat: -1,
            repeatDelay: 0.15,
          },
        );
      }
    }, el);
    return () => ctx.revert();
  }, []);

  // Each status change is a swap, not a fade: the old line leaves upward and
  // the new one comes up behind it, so the wait reads as progress.
  useLayoutEffect(() => {
    if (!status.current || prefersReducedMotion()) return;
    gsap.fromTo(
      status.current,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: DUR.base, ease: EASE.emphasis },
    );
  }, [step]);

  // The landing. Real numbers, one line at a time, then the app.
  useLayoutEffect(() => {
    if (!done || played.current) return;
    played.current = true;

    if (prefersReducedMotion() || !root.current) {
      const id = setTimeout(onFinish, 900);
      return () => clearTimeout(id);
    }

    const tl = gsap.timeline({ onComplete: onFinish });
    tl.to([status.current, sweep.current?.parentElement ?? null], {
      opacity: 0,
      y: -12,
      duration: DUR.quick,
      ease: EASE.in,
    })
      .fromTo(
        rows.current?.children ?? [],
        { opacity: 0, y: 18 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.13,
          ease: EASE.emphasis,
        },
        0.12,
      )
      .to(root.current, { opacity: 0, duration: DUR.base, ease: EASE.in }, "+=0.8");
    return () => {
      tl.kill();
    };
  }, [done, onFinish]);

  return (
    <div
      ref={root}
      className="fixed inset-0 z-50 flex flex-col bg-ink-0 px-[var(--gutter)] pb-[max(28px,env(safe-area-inset-bottom))] pt-[max(48px,calc(env(safe-area-inset-top)+28px))]"
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <span className="flex items-center gap-2">
          <Logo size={20} className="text-text-1" />
          <Wordmark className="text-body text-text-1" />
        </span>

        <div className="flex flex-1 flex-col justify-center pb-16">
          {!done && (
            <>
              <p ref={status} className="text-hero text-text-1">
                {STATUS[step]}
              </p>
              {/* A hairline with something moving along it: the portal is slow
                  and pretending otherwise with a percentage would be a fiction. */}
              <div className="bleed relative mt-8 h-px overflow-hidden bg-line">
                <span
                  ref={sweep}
                  className="absolute inset-y-0 left-0 w-1/5 bg-accent"
                />
              </div>
              <p className="mt-6 text-callout text-text-3">
                One sign-in covers the whole session.
              </p>
            </>
          )}

          {done && (
            <>
              <p className="text-label uppercase text-text-3">Signed in</p>
              <p className="mt-3.5 text-hero">{name}</p>
              <div className="bleed mt-7 h-px bg-line" />
            </>
          )}

          {done && (
            <ul ref={rows} className="mt-1">
              {facts.map((f) => (
                <li
                  key={f.label}
                  className="flex items-baseline justify-between gap-4 border-b border-line-soft py-4 last:border-b-0"
                >
                  <span className="text-label uppercase text-text-3">
                    {f.label}
                  </span>
                  <RollingNumber value={f.value} className="text-title" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
