"use client";

import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import RollingNumber from "./RollingNumber";
import { Button } from "@/components/ui";
import { DUR, EASE, prefersReducedMotion, useGsap } from "@/lib/motion";
import { predict } from "@/lib/predictor";
import Logo, { Wordmark } from "@/components/Logo";

/**
 * THE OPENING.
 *
 * Not a tutorial. The first thing a student does in Skipp is the thing Skipp is
 * for: decide what to skip. So that is the opening, played on a sample week
 * before anyone has signed in.
 *
 * Tap a class and it comes out of your attendance. The figure rolls down, the
 * bar loses ground, the count of classes you have in hand drops by one. There
 * are exactly five classes and exactly four to spare, so the last tap is the
 * one that breaks the line. Nothing on this screen explains attendance
 * percentages, margins, thresholds or recovery, and by the time the sixth tap
 * lands the student knows all four.
 *
 * The arithmetic is the app's own `predict`, on invented numbers, so this
 * screen can never quote a margin the attendance page would disagree with.
 */

const ATTENDED = 17;
const HELD = 18;
const TARGET = 75;

const WEEK = [
  { time: "08:00", title: "Data Structures", note: "TP 605" },
  { time: "09:00", title: "Operating Systems", note: "TP 605" },
  { time: "10:00", title: "Computer Networks", note: "TP 402" },
  { time: "11:50", title: "Data Structures Lab", note: "Lab 3" },
  { time: "14:00", title: "Software Engineering", note: "TP 311" },
];

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [skipped, setSkipped] = useState<number[]>([]);
  const [flash, setFlash] = useState<{ id: number; text: string } | null>(null);
  const leaving = useRef(false);
  // A plain counter rather than a timestamp: it only has to be unique enough to
  // remount the flash, and Date.now during a render is not allowed.
  const tick = useRef(0);

  const held = HELD + skipped.length;
  const {
    percentage: pct,
    canSkip: margin,
    mustAttend: recover,
    isSafe,
  } = predict(ATTENDED, held, TARGET);
  const below = !isSafe;

  const root = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const figure = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);

  // Arrival. The rule draws, the figure rolls up from zero on its own (the
  // digit columns start at 0), the bar chases it, then the week arrives row by
  // row. One continuous move, about a second and a half.
  const scope = useGsap(({ self, reduced }) => {
    if (reduced) {
      gsap.set(self.querySelectorAll("[data-enter], [data-row]"), { opacity: 1 });
      return;
    }
    const tl = gsap.timeline({ defaults: { ease: EASE.out } });
    tl.fromTo(
      self.querySelectorAll("[data-enter]"),
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: DUR.base, stagger: 0.07 },
    ).fromTo(
      self.querySelectorAll("[data-row]"),
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: DUR.base, stagger: 0.055 },
      0.5,
    );
  }, []);

  // The bar tracks the figure. Kept in GSAP rather than a CSS transition so it
  // shares the app's easing and cannot fight a transform written elsewhere.
  useLayoutEffect(() => {
    const el = fill.current;
    if (!el) return;
    const to = { scaleX: Math.max(0, Math.min(1, pct / 100)) };
    if (prefersReducedMotion()) {
      gsap.set(el, to);
      return;
    }
    gsap.to(el, { ...to, duration: 0.7, ease: EASE.emphasis, overwrite: "auto" });
  }, [pct]);

  function toggle(i: number) {
    if (leaving.current) return;
    const on = skipped.includes(i);
    const next = on ? skipped.filter((x) => x !== i) : [...skipped, i];
    const delta = predict(ATTENDED, HELD + next.length, TARGET).percentage - pct;
    setSkipped(next);
    setFlash({
      id: ++tick.current,
      text: `${delta < 0 ? "−" : "+"}${Math.abs(delta).toFixed(1)}`,
    });
    if (figure.current && !prefersReducedMotion()) {
      gsap.fromTo(
        figure.current,
        { x: on ? 3 : -3 },
        { x: 0, duration: 0.5, ease: "elastic.out(1, 0.45)" },
      );
    }
  }

  // Handing over: the week clears itself out from the bottom up, the figure
  // rises and goes, and the sign-in takes the same black screen.
  function handoff() {
    if (leaving.current) return;
    leaving.current = true;
    if (prefersReducedMotion() || !root.current) {
      onDone();
      return;
    }
    gsap
      .timeline({ onComplete: onDone })
      .to(list.current?.children ?? [], {
        opacity: 0,
        y: -10,
        duration: DUR.quick,
        stagger: { each: 0.035, from: "end" },
        ease: EASE.in,
      })
      .to(
        root.current.querySelectorAll("[data-enter]"),
        { opacity: 0, y: -14, duration: DUR.base, stagger: 0.03, ease: EASE.in },
        0.1,
      );
  }

  const touched = skipped.length > 0;

  return (
    <main
      ref={root}
      className="font-display mx-auto flex min-h-full w-full max-w-md flex-1 flex-col px-[var(--gutter)] pb-[max(22px,env(safe-area-inset-bottom))] pt-[max(40px,calc(env(safe-area-inset-top)+22px))] md:border-x md:border-line-soft"
    >
      <div ref={scope} className="flex flex-1 flex-col">
        <header data-enter className="flex items-baseline justify-between">
          <span className="flex items-center gap-2">
          <Logo size={20} className="text-text-1" />
          <Wordmark className="text-body text-text-1" />
        </span>
          <button
            onClick={handoff}
            className="text-callout text-text-3 transition-colors hover:text-text-1"
          >
            Sign in
          </button>
        </header>

        {/* The instruction is four words and it is the only instruction. */}
        <p data-enter className="mt-8 text-label uppercase text-text-3">
          Tap a class to skip it
        </p>

        <div className="mt-4 flex items-end justify-between gap-4">
          <div ref={figure} className="will-change-transform">
            <RollingNumber
              value={`${pct.toFixed(1)}%`}
              className={`optical text-poster transition-colors duration-300 ${
                below ? "text-risk" : "text-text-1"
              }`}
            />
          </div>
          <div className="pb-3">
            {flash && <Flash key={flash.id} text={flash.text} down={below} />}
          </div>
        </div>

        {/* The line you are arguing with, drawn where it actually falls. */}
        <div data-enter className="bleed relative mt-5 h-px bg-line">
          <span
            ref={fill}
            className={`absolute inset-0 origin-left ${below ? "bg-risk" : "bg-text-1"}`}
          />
          <span
            className="absolute -top-[5px] h-[11px] w-px bg-text-3"
            style={{ left: `${TARGET}%` }}
          />
          <span
            className="tnum absolute top-2.5 text-label uppercase text-text-3"
            style={{ left: `${TARGET}%`, transform: "translateX(-50%)" }}
          >
            {TARGET}
          </span>
        </div>

        <p data-enter className="mt-8 text-body text-text-2">
          {below ? (
            <>
              <span className="text-risk">Below the line.</span> Attend{" "}
              <span className="tnum text-text-1">{recover}</span> to come back.
            </>
          ) : margin === 0 ? (
            <>
              <span className="text-text-1">No room left.</span> One more and you
              are under.
            </>
          ) : (
            <>
              <span className="tnum text-text-1">{margin}</span> more{" "}
              {margin === 1 ? "class" : "classes"} in hand.
            </>
          )}
        </p>

        <ul ref={list} className="mt-6">
          {WEEK.map((c, i) => (
            <Row
              key={c.title}
              {...c}
              off={skipped.includes(i)}
              onTap={() => toggle(i)}
            />
          ))}
        </ul>

        <div className="mt-auto pt-7">
          {/* Held back until the first tap, and inert until then so it is not
              a focus stop nobody can see. */}
          <div
            inert={!touched}
            className={`transition-opacity duration-500 ${
              touched ? "opacity-100" : "opacity-0"
            }`}
          >
            <Button variant="outline" size="lg" full onClick={handoff}>
              Now do it with mine
            </Button>
          </div>
          <p data-enter className="mt-4 text-callout text-text-3">
            Sample week. Yours arrives when you sign in.
          </p>
        </div>
      </div>
    </main>
  );
}

/** One class. Skipping it strikes it through and greys it out, in place. */
function Row({
  time,
  title,
  note,
  off,
  onTap,
}: {
  time: string;
  title: string;
  note: string;
  off: boolean;
  onTap: () => void;
}) {
  const strike = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = strike.current;
    if (!el) return;
    const to = { scaleX: off ? 1 : 0 };
    if (prefersReducedMotion()) {
      gsap.set(el, to);
      return;
    }
    gsap.to(el, {
      ...to,
      duration: 0.34,
      ease: off ? EASE.emphasis : EASE.in,
      overwrite: "auto",
    });
  }, [off]);

  return (
    <li>
      <button
        onClick={onTap}
        aria-pressed={off}
        className="group flex w-full items-baseline gap-4 border-b border-line-soft py-3 text-left"
      >
        <span
          className={`tnum w-11 shrink-0 text-callout transition-colors duration-200 ${
            off ? "text-text-3/50" : "text-text-3"
          }`}
        >
          {time}
        </span>
        <span className="relative min-w-0 flex-1">
          <span
            className={`block truncate text-headline transition-colors duration-200 ${
              off ? "text-text-3/50" : "text-text-1 group-hover:text-text-1"
            }`}
          >
            {title}
          </span>
          <span
            ref={strike}
            aria-hidden
            className="absolute left-0 top-1/2 h-px w-full origin-left bg-text-3"
          />
        </span>
        <span
          className={`shrink-0 text-callout transition-colors duration-200 ${
            off ? "text-text-3/50" : "text-text-3"
          }`}
        >
          {off ? "Skipped" : note}
        </span>
      </button>
    </li>
  );
}

/** The cost of the tap, thrown off the figure and gone. */
function Flash({ text, down }: { text: string; down: boolean }) {
  const el = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (!el.current || prefersReducedMotion()) return;
    gsap
      .timeline()
      .fromTo(
        el.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: DUR.quick, ease: EASE.out },
      )
      .to(el.current, {
        opacity: 0,
        y: -12,
        duration: DUR.base,
        delay: 0.75,
        ease: EASE.in,
      });
  }, []);
  return (
    <span
      ref={el}
      className={`tnum block text-title ${down ? "text-risk" : "text-text-2"}`}
    >
      {text}
    </span>
  );
}
