"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { prefersReducedMotion } from "@/lib/motion";
import { useTheme, type Theme } from "@/lib/theme";

/**
 * The screen's name in the masthead, set differently by each full look.
 *
 * It replaced an 11px small caps label that was too small to read at a glance.
 * Ink, the skins, Paper and Sand WRITE it, in the entry notebook's pen, so the
 * app and the way in read as one hand. The five full looks each get their own
 * version, because each of them replaces the art direction rather than tinting
 * it, and a handwritten word in a phosphor terminal reads as a different app:
 *
 * | look     | the title                                               |
 * | -------- | ------------------------------------------------------- |
 * | hand     | written on, then underlined with an accent swash        |
 * | brutal   | the same hand, on a strip of accent tape with a slab    |
 * | stone    | cut into the wall a letter at a time, screen colour bar |
 * | clay     | puffy, and it squishes into place                       |
 * | terminal | typed as a shell path, with a blinking block cursor     |
 * | arcade   | the chomper eats a row of dots and leaves the word      |
 *
 * **Every one fits the 56px bar, level.** A first pass of the hand was 40px and
 * tilted -2 degrees: the tilt lifted the end of the word into the top edge of
 * the bar and shaved its ascenders off on a phone. Nothing here tilts except
 * Brutal's tape, by a degree, and that tape is short enough to clear the bar.
 *
 * **Visible content never depends on the animation.** No look has a CSS start
 * state for its word: each tween sets its own, and reverting the context mid
 * flight hands the element back to plain CSS, which shows it. The decorations
 * that exist only for the entrance (Arcade's dots and chomper) rest hidden
 * instead, so a skipped entrance leaves no debris. Reduced motion skips all of
 * it. The typography lives in `globals.css` under `[data-mt]`.
 */
type Look = "hand" | "brutal" | "stone" | "clay" | "terminal" | "arcade";

function lookFor(theme: Theme): Look {
  switch (theme) {
    case "brutal":
    case "stone":
    case "clay":
    case "terminal":
    case "arcade":
      return theme;
    default:
      return "hand";
  }
}

/** A screen name as a path: "Sat, Sep 19" becomes "sat-sep-19". */
function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** A left to right wipe that clears itself, so nothing is left inline. */
function wipe(el: Element, duration: number, ease: string) {
  return gsap.fromTo(
    el,
    // Negative insets top and bottom, or long ascenders and descenders are
    // shaved off while the word is still arriving.
    { clipPath: "inset(-40% 100% -40% -6%)" },
    { clipPath: "inset(-40% -6% -40% -6%)", duration, ease, clearProps: "clipPath" },
  );
}

/** Grows a bar or strip from its left end. */
function grow(el: Element, duration: number) {
  return gsap.fromTo(
    el,
    { scaleX: 0 },
    { scaleX: 1, duration, ease: "power3.out", transformOrigin: "0% 50%", clearProps: "transform" },
  );
}

export default function MastheadTitle({ text }: { text: string }) {
  const look = lookFor(useTheme());
  const root = useRef<HTMLSpanElement>(null);
  const shown = look === "terminal" ? slug(text) : text;

  useLayoutEffect(() => {
    const el = root.current;
    if (!el || prefersReducedMotion()) return;
    const word = el.querySelector<HTMLElement>("[data-mt-word]");
    if (!word) return;
    const part = (selector: string) => el.querySelector<HTMLElement | SVGElement>(selector);
    let typed = false;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      switch (look) {
        case "hand": {
          tl.add(wipe(word, 0.26 + shown.length * 0.035, "power1.inOut"));
          // You underline a word once you have written it.
          const swash = part("[data-mt-swash] path");
          if (swash) {
            tl.fromTo(
              swash,
              { strokeDashoffset: 1 },
              { strokeDashoffset: 0, duration: 0.34, ease: "power2.out" },
              "-=0.08",
            );
          }
          break;
        }
        case "brutal": {
          // The tape goes down first, then it is written on: the reverse order
          // reads as a label printed onto tape rather than a note stuck up.
          const tape = part("[data-mt-tape]");
          if (tape) tl.add(grow(tape, 0.28));
          tl.add(wipe(word, 0.24 + shown.length * 0.03, "power1.inOut"), "-=0.04");
          break;
        }
        case "stone": {
          // Struck a letter at a time: a stepped wipe, one step per character,
          // so each letter lands whole the way a chisel cut does.
          tl.add(wipe(word, shown.length * 0.055, `steps(${Math.max(1, shown.length)})`));
          const bar = part("[data-mt-bar]");
          if (bar) tl.add(grow(bar, 0.3));
          break;
        }
        case "clay": {
          // Squashed flat and wide, then it springs up: a blob of clay dropped
          // onto the bar rather than a word written on it.
          tl.fromTo(
            word,
            { scaleX: 1.22, scaleY: 0.55, opacity: 0, y: 6 },
            {
              scaleX: 1,
              scaleY: 1,
              opacity: 1,
              y: 0,
              duration: 0.75,
              ease: "elastic.out(1, 0.45)",
              transformOrigin: "0% 100%",
              clearProps: "transform,opacity",
            },
          );
          break;
        }
        case "terminal": {
          // Typed out. The text is written straight to the node rather than
          // through React, so a prompt never re-renders the tree per keystroke,
          // and it is put back in full on cleanup, since a revert restores
          // styles and not text.
          typed = true;
          const counter = { n: 0 };
          word.textContent = "";
          tl.to(counter, {
            n: shown.length,
            duration: 0.12 + shown.length * 0.045,
            ease: `steps(${Math.max(1, shown.length)})`,
            onUpdate: () => {
              word.textContent = shown.slice(0, Math.round(counter.n));
            },
          });
          break;
        }
        case "arcade": {
          // The chomper runs along a row of dots, and the word is what it
          // leaves behind. Dots, word and chomper share one linear clock, so
          // the mouth is always exactly at the edge of the word.
          const dots = part("[data-mt-dots]");
          const chomper = part("[data-mt-chomper]");
          const width = word.offsetWidth;
          const run = 0.2 + shown.length * 0.06;
          if (dots) {
            tl.fromTo(
              dots,
              { clipPath: "inset(0% 0% 0% 0%)" },
              { clipPath: "inset(0% 0% 0% 100%)", duration: run, ease: "none" },
              0,
            );
          }
          tl.fromTo(
            word,
            // Negative on the left too, or the halo is cut to a hard edge.
            { clipPath: "inset(-40% 100% -40% -20%)" },
            { clipPath: "inset(-40% 0% -40% -20%)", duration: run, ease: "none", clearProps: "clipPath" },
            0,
          );
          if (chomper) {
            // Its back sits on the edge of the word, so the mouth is always
            // on the next dot and never on a letter it has just left.
            tl.fromTo(
              chomper,
              { x: -2, opacity: 1 },
              { x: width - 2, duration: run, ease: "none" },
              0,
            ).to(chomper, { opacity: 0, duration: 0.18 });
          }
          break;
        }
      }
    }, el);

    return () => {
      ctx.revert();
      if (typed) word.textContent = shown;
    };
  }, [look, shown]);

  return (
    // Keyed by look and text, so a theme change rebuilds the markup rather
    // than asking React to reconcile one look's children into another's.
    <span key={`${look}:${shown}`} ref={root} data-mt={look}>
      {look === "brutal" && <span data-mt-tape aria-hidden />}
      {look === "terminal" && (
        <span data-mt-path aria-hidden>
          ~/
        </span>
      )}
      <span data-mt-word>{shown}</span>
      {look === "terminal" && <span data-mt-cursor aria-hidden />}
      {look === "stone" && <span data-mt-bar aria-hidden />}
      {look === "arcade" && (
        <>
          <span data-mt-dots aria-hidden />
          <span data-mt-chomper aria-hidden />
        </>
      )}
      {look === "hand" && (
        <svg data-mt-swash aria-hidden viewBox="0 0 200 8" preserveAspectRatio="none">
          {/* pathLength 1 lets the draw run from 1 to 0 without measuring the
              path, whatever width the word stretches it to. */}
          <path
            d="M3 5 C 50 2, 110 7, 197 3"
            pathLength={1}
            strokeDasharray="1"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )}
    </span>
  );
}
