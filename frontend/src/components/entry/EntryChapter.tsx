"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import Logo from "@/components/Logo";
import { prefersReducedMotion } from "@/lib/motion";
import { setTheme, type Theme } from "@/lib/theme";
import { useLockScroll } from "@/components/ui/Overlay";

/**
 * The shared furniture of the entry deck.
 *
 * The welcome and the install offer come before the onboarding chapters and are
 * built from the same parts, so the whole way in reads as one publication: a
 * saturated field, one object on a stage, and along the bottom a small caps
 * eyebrow over an enormous word with the controls beneath it.
 *
 * That is the discipline the deck already follows. **The furniture repeats so
 * it feels like one place; the contents never repeat so it never feels like a
 * template.** Each screen brings its own field colour and its own KIND of
 * object, and no two are alike.
 */

export const CREAM = "#F7F3EC";
export const ACCENT = "#F2661C";

export default function EntryChapter({
  field,
  ink = CREAM,
  eyebrow,
  word,
  children,
  actions,
}: {
  /** The room colour. Deliberately unlike any onboarding chapter's. */
  field: string;
  ink?: string;
  eyebrow: string;
  /** The enormous word along the bottom. */
  word: string;
  /** The stage: one object, and a different kind on every screen. */
  children: React.ReactNode;
  /** Whatever moves the reader on. */
  actions: React.ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  // The page behind is still a scrolling document, and iOS bounces it into view
  // under a fixed overlay, which shows as a band of the app's own colour.
  useLockScroll(true);

  // In a standalone PWA iOS paints the chrome around the web view from
  // `theme-color`, not from the page, so without this the band around a warm
  // screen keeps showing the app's near black. Restored by re-applying the
  // theme, the only place that knows each theme's bar colour.
  useLayoutEffect(() => {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", field);
    return () => {
      const stored = document.documentElement.dataset.theme as Theme | undefined;
      if (stored) setTheme(stored);
    };
  }, [field]);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      gsap.set(el.querySelectorAll("[data-word-part], [data-in]"), {
        opacity: 1,
        y: 0,
        yPercent: 0,
        filter: "none",
      });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-word-part]",
        { yPercent: 118 },
        { yPercent: 0, duration: 1, ease: "expo.out", stagger: 0.05, delay: 0.1 },
      );
      gsap.fromTo(
        "[data-in]",
        { opacity: 0, y: 34, filter: "blur(10px)" },
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 0.9,
          ease: "expo.out",
          stagger: 0.07,
          delay: 0.12,
          // Cleared so nothing is left holding a filter it would have to
          // animate FROM next time, which does not interpolate and snaps.
          onComplete: () => gsap.set("[data-in]", { clearProps: "filter" }),
        },
      );
    }, el);
    return () => ctx.revert();
  }, []);

  // The word is set as large as it can be WITHOUT overflowing its column,
  // measured rather than guessed: a fixed clamp cannot know how long the next
  // word is, and a long one runs under the controls in the corner.
  useLayoutEffect(() => {
    const h = heading.current;
    const box = h?.parentElement;
    if (!h || !box) return;
    // Cleared back to the class clamp, never to nothing: the size lives in the
    // className precisely so this line cannot delete it.
    h.style.fontSize = "";
    const pad = parseFloat(getComputedStyle(box).paddingLeft) || 0;
    const avail = box.clientWidth - pad * 2;
    // `scrollWidth` is useless on an overflow-hidden flex row: it reports the
    // clipped width, so nothing ever looks too wide. The letters know.
    const natural = [...h.querySelectorAll("span")].reduce(
      (a, sp) => a + sp.getBoundingClientRect().width,
      0,
    );
    if (natural > avail && avail > 0) {
      const base = parseFloat(getComputedStyle(h).fontSize);
      h.style.fontSize = `${Math.floor(base * (avail / natural))}px`;
    }
  }, [word]);

  return (
    <div
      ref={root}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden font-display"
      style={{ background: field, color: ink, minHeight: "100dvh" }}
    >
      {/* The stage. It clips, so a tall object scrolls inside itself rather
          than spilling over the word and the controls below it. */}
      <div className="relative z-10 min-h-0 flex-1 overflow-hidden">
        {children}
      </div>

      <div className="relative z-20 shrink-0 px-[var(--gutter)] pb-[max(22px,env(safe-area-inset-bottom))]">
        <p data-in className="text-label uppercase tracking-[0.22em] opacity-55">
          {eyebrow}
        </p>
        <h1
          ref={heading}
          className="mt-2 flex overflow-hidden font-bold leading-[0.86] [font-size:clamp(3rem,17vw,7rem)]"
          style={{ letterSpacing: "-0.045em" }}
        >
          {word.split("").map((letter, i) => (
            <span key={i} data-word-part className="inline-block whitespace-pre">
              {letter}
            </span>
          ))}
        </h1>

        <div className="mt-6 flex items-center gap-3">
          <Logo size={20} mono />
          <div className="min-w-0 flex-1">{actions}</div>
        </div>
      </div>
    </div>
  );
}

/** The deck's round advance, in the same shape the chapters use. */
export function Advance({
  onClick,
  label,
  field,
  ink = CREAM,
}: {
  onClick: () => void;
  label: string;
  field: string;
  ink?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="grid size-[62px] shrink-0 place-items-center rounded-full transition-transform duration-200 active:scale-90"
      style={{ background: ink, color: field }}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12h14" />
        <path d="M13 6l6 6-6 6" />
      </svg>
    </button>
  );
}
