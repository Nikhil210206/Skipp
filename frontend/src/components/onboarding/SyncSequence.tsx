"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import RollingNumber from "./RollingNumber";
import { DUR, EASE, prefersReducedMotion } from "@/lib/motion";
import Logo, { Wordmark } from "@/components/Logo";
import NumeralField from "./NumeralField";

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
  // The waiting block outlives `done` by exactly its own exit animation.
  const [waiting, setWaiting] = useState(true);
  const root = useRef<HTMLDivElement>(null);
  const status = useRef<HTMLParagraphElement>(null);
  const sweep = useRef<HTMLSpanElement>(null);
  const head = useRef<HTMLDivElement>(null);
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

  /**
   * The landing. Real numbers, one line at a time, then the app.
   *
   * **THIS THREW, AND IT TOOK THE WHOLE SIGN IN TO THE ERROR BOUNDARY.** The
   * exit used to be written `tl.to([status.current, sweep.current?.parentElement
   * ?? null], ...)`, and by the time this effect runs both of those are null:
   * `done` flipping is what unmounts the waiting block, and React detaches a
   * removed subtree's refs in the mutation phase, before layout effects. So the
   * timeline was handed `[null, null]`.
   *
   * **A bare null target is safe in GSAP and an ARRAY containing one is not**,
   * which is the whole trap. Measured directly: `gsap.to(null, ...)` logs
   * "target not found" and carries on, while `gsap.to([null], ...)` throws
   * `Cannot read properties of null (reading '_gsap')`. So the one shape that
   * looks defensive, defaulting a missing ref to null inside an array, is the
   * one that crashes. Every student reaching this screen got "Not your fault."
   * instead of their name.
   *
   * The fix is not to filter the nulls, which would leave the exit silently
   * animating nothing (it never once played). `waiting` holds the block in the
   * DOM past the flip so it has something to animate, and drops it when the
   * exit is over.
   */
  useLayoutEffect(() => {
    if (!done || played.current) return;
    played.current = true;

    if (prefersReducedMotion() || !root.current) {
      setWaiting(false);
      const id = setTimeout(onFinish, 900);
      return () => clearTimeout(id);
    }

    // Whatever is actually still on screen. Never an array with a hole in it.
    const leaving = [status.current, sweep.current?.parentElement].filter(
      (n): n is HTMLElement => !!n,
    );

    const tl = gsap.timeline({ onComplete: onFinish });
    if (leaving.length) {
      tl.to(leaving, {
        opacity: 0,
        y: -12,
        duration: DUR.quick,
        ease: EASE.in,
        onComplete: () => setWaiting(false),
      });
    } else {
      setWaiting(false);
    }
    /**
     * **The landing needs an entrance of its own, and this is the bug that
     * sharing a grid cell introduced.** Stacked, both halves are mounted for
     * the length of the exit, and the landing had no animation at all, so it
     * rendered at full opacity from its first frame: measured, fifteen straight
     * frames with "Almost there" and the student's name laid over each other,
     * both fully opaque. Sequenced properly it is a handover, the line leaving
     * as the name arrives behind it.
     *
     * The header and the rows are animated separately rather than the block as
     * a whole, so no element ends up with two owners writing its opacity.
     */
    if (head.current) {
      tl.fromTo(
        head.current,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: DUR.base, ease: EASE.emphasis },
        0.16,
      );
    }
    tl.fromTo(
      rows.current?.children ?? [],
      { opacity: 0, y: 18 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        stagger: 0.13,
        ease: EASE.emphasis,
      },
      0.3,
    ).to(root.current, { opacity: 0, duration: DUR.base, ease: EASE.in }, "+=0.8");
    return () => {
      tl.kill();
    };
  }, [done, onFinish]);

  return (
    <div
      ref={root}
      className="font-display fixed inset-0 z-50 flex flex-col overflow-hidden bg-ink-0 px-[var(--gutter)] pb-[max(28px,env(safe-area-inset-bottom))] pt-[max(48px,calc(env(safe-area-inset-top)+28px))]"
    >
      {/* The ambient field, and the two edges that stop it running into the
          screen's own. Painted gradients rather than a mask: this is the same
          answer ScrollEdge already takes, and it costs a paint instead of a
          compositor layer over the whole viewport. */}
      <NumeralField hushed={done} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-40 bg-gradient-to-b from-ink-0 via-ink-0/80 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-40 bg-gradient-to-t from-ink-0 via-ink-0/80 to-transparent"
      />
      {/* A scrim across the band the words sit in. The field is quiet enough to
          be atmosphere and still not quiet enough to have a headline read
          across it: a stray numeral running through the status line is the one
          thing here that would make the screen look broken rather than alive.
          It fades out at both ends, so it never draws an edge of its own. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 z-0 h-72 -translate-y-1/2 bg-gradient-to-b from-transparent via-ink-0/85 to-transparent"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col">
        <span className="flex items-center gap-2">
          <Logo size={20} className="text-text-1" />
          <Wordmark className="text-body text-text-1" />
        </span>

        {/* **The two halves are STACKED IN ONE GRID CELL, not listed.** They
            overlap for the length of the handover, and in a flex column that
            would mean the waiting line and the student's name both taking up
            room and shunting each other down the page on the exact frames both
            are animating. Sharing a cell, one leaves while the other arrives
            over the top of it and nothing moves that was not asked to. It is
            the same device the multilingual greeting uses for its crossfade. */}
        <div className="grid flex-1 content-center items-center pb-16">
          {waiting && (
            <div className="[grid-area:1/1]">
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
            </div>
          )}

          {done && (
            <div className="[grid-area:1/1]">
              <div ref={head}>
                <p className="text-label uppercase text-text-3">Signed in</p>
                <p className="mt-3.5 text-hero">{name}</p>
                <div className="bleed mt-7 h-px bg-line" />
              </div>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
