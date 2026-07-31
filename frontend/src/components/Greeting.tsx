"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * "Hello", cycling through the languages this campus actually speaks.
 *
 * It is the one looping animation in the app, and that is a decision rather
 * than an oversight: the standing rule is that nothing loops beside a password
 * field. A greeting is the case worth breaking it for, so it is kept slow and
 * quiet, and it never moves anything the eye needs in order to type.
 *
 * Three things make it read as one continuous movement rather than a swap:
 *
 * 1. **Every greeting is rendered, stacked in one grid cell.** The box is
 *    therefore always as wide and as tall as the longest and deepest word, so
 *    it can never resize mid-transition. Indic scripts are deeper than Latin
 *    ones, and a box that sizes to its current word makes the whole cover
 *    twitch on every change.
 * 2. **The outgoing and incoming words overlap.** The first version faded one
 *    out, swapped the text, then faded the next in, which leaves a frame with
 *    nothing on it. That gap is what reads as rough, however smooth each half
 *    is on its own.
 * 3. **They travel a short distance on a soft ease**, so the movement is a
 *    drift rather than a jump, and they scale very slightly so the word
 *    arriving feels like it is coming forward.
 *
 * Only the Latin greeting is set in the display face. Bricolage carries no
 * Tamil or Devanagari, so the Indic scripts fall back to the system face
 * deliberately rather than to a mangled substitute.
 */

const GREETINGS = [
  { text: "hello", lang: "en" },
  { text: "வணக்கம்", lang: "ta" },
  { text: "नमस्ते", lang: "hi" },
  { text: "నమస్కారం", lang: "te" },
  { text: "നമസ്കാരം", lang: "ml" },
  { text: "ನಮಸ್ಕಾರ", lang: "kn" },
  { text: "নমস্কার", lang: "bn" },
];

/** How long each greeting holds before the next one takes over, in ms. */
const STEP = 2600;
/** The crossfade itself. Long enough to read as a drift, not a cut. */
const CROSS = 0.9;
/** How far a word travels, as a share of its own height. */
const TRAVEL = 42;

export default function Greeting() {
  const [i, setI] = useState(0);
  const items = useRef<(HTMLSpanElement | null)[]>([]);
  const first = useRef(true);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const id = window.setInterval(
      () => setI((n) => (n + 1) % GREETINGS.length),
      STEP,
    );
    return () => window.clearInterval(id);
  }, []);

  useLayoutEffect(() => {
    const nodes = items.current;
    if (!nodes[0]) return;

    if (prefersReducedMotion()) {
      nodes.forEach((n, k) => n && gsap.set(n, { opacity: k === i ? 1 : 0 }));
      return;
    }

    const incoming = nodes[i];
    const outgoing = nodes[(i - 1 + GREETINGS.length) % GREETINGS.length];

    // The very first pass places the opening word without performing a
    // handover from a word nobody ever saw.
    if (first.current) {
      first.current = false;
      nodes.forEach((n, k) => {
        if (n) gsap.set(n, { opacity: k === i ? 1 : 0, yPercent: 0, scale: 1 });
      });
      return;
    }

    // Both tweens start together and run the same length, so at every instant
    // one word is arriving by exactly as much as the other is leaving.
    if (outgoing) {
      gsap.to(outgoing, {
        opacity: 0,
        yPercent: -TRAVEL,
        scale: 0.94,
        duration: CROSS,
        ease: "power2.inOut",
        overwrite: "auto",
      });
    }
    if (incoming) {
      gsap.fromTo(
        incoming,
        { opacity: 0, yPercent: TRAVEL, scale: 0.94 },
        {
          opacity: 1,
          yPercent: 0,
          scale: 1,
          duration: CROSS,
          ease: "power2.out",
          overwrite: "auto",
        },
      );
    }
  }, [i]);

  return (
    // Grid, with every word in the same cell. The cell is sized by the largest
    // of them, so nothing below can be nudged by a change of script.
    <span className="grid text-title leading-none text-text-2">
      {GREETINGS.map((g, k) => (
        <span
          key={g.lang}
          ref={(el) => {
            items.current[k] = el;
          }}
          lang={g.lang}
          // Only the one on screen is exposed. Without this a screen reader
          // reads all seven in a row, and announcing a decorative greeting on
          // every swap would be chatter rather than information.
          aria-hidden={k !== i}
          style={{ gridArea: "1 / 1", opacity: k === 0 ? 1 : 0 }}
          className="justify-self-start self-center will-change-transform"
        >
          {g.text}
        </span>
      ))}
    </span>
  );
}
