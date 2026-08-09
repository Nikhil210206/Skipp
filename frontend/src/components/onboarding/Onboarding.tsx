"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import Logo from "@/components/Logo";
import { prefersReducedMotion } from "@/lib/motion";
import { haptic } from "@/lib/haptics";
import { predict } from "@/lib/predictor";
import { setTheme, THEMES, type Theme } from "@/lib/theme";
import { CREATOR, creatorLinks } from "@/lib/creator";
import { IconInstagram, IconLinkedIn } from "@/components/Icons";
import { useLockScroll } from "@/components/ui/Overlay";

/**
 * THE WAY IN.
 *
 * The frame is fixed and the contents are not. Every chapter carries the same
 * furniture, a small caps eyebrow over an enormous chapter word along the
 * bottom, the mark in one corner and the advance in the other, while the space
 * above it holds a completely different KIND of object each time: a fanned
 * stack of cards, a list of marks, a live meter, a rack of colours.
 *
 * That is the discipline. A deck where every screen has the same silhouette
 * reads as a template no matter how good the colours are, and a deck with no
 * repeated furniture reads as five unrelated screens. The furniture repeats;
 * the content never does.
 *
 * **In the third chapter the room colour IS the attendance**, interpolated live
 * from the percentage. Skipping turns it green through amber to red. Colour as
 * data is the only reason a surface leading into an app built from hairlines is
 * allowed this much of it.
 *
 * Earlier attempts, both rejected, are worth naming so they are not rebuilt: a
 * gradient-and-glass deck of hero titles over feature cards ("looks ai vibe
 * coded"), and a version where progress was a drag with no button, which put
 * the reader in charge of something they had not asked to hold.
 */

const CREAM = "#F7F3EC";
const INK = "#0A0A0C";

type Chapter = {
  id: "hello" | "does" | "line" | "look" | "who" | "ready";
  eyebrow: string;
  word: string;
  field: string;
  ink: string;
};

const CHAPTERS: Chapter[] = [
  { id: "hello", eyebrow: "know before you bunk", word: "SKIPP", field: "#1B0B3B", ink: CREAM },
  { id: "does", eyebrow: "the whole portal, minus the portal", word: "THE LOT", field: "#07302C", ink: CREAM },
  { id: "line", eyebrow: "seventy five percent", word: "THE LINE", field: "#064E3B", ink: CREAM },
  { id: "look", eyebrow: "three looks, fifteen colours", word: "YOUR LOOK", field: "#111A33", ink: CREAM },
  { id: "who", eyebrow: "one person, a lot of evenings", word: "THE DEV", field: "#2A1033", ink: CREAM },
  { id: "ready", eyebrow: "that is everything", word: "LESSSGO", field: INK, ink: CREAM },
];

/** 14 of 15 held. Three in hand, so the fourth skip is the one that crosses. */
const ATTENDED = 14;
const HELD = 15;
const SAFE_FIELD = "#064E3B";
const WATCH_FIELD = "#7A4E06";
const RISK_FIELD = "#7A1220";

/** The three that rebuild the interface, and a taste of the colours. Showing
 *  all eighteen here was clumsy: this is a first impression, not the picker. */
const LOOKS = THEMES.filter((t) => t.structural);
const COLOURS = THEMES.filter((t) => !t.structural).slice(0, 6);
const SKIN_TOTAL = THEMES.filter((t) => !t.structural).length;

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [c, setC] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [picked, setPicked] = useState<Theme | null>(null);
  /**
   * The colours the chosen theme actually paints with, read from the live CSS
   * variables after it is applied. Choosing a look has to CHANGE this chapter,
   * or the student is picking blind: a swatch tells you the hues, it does not
   * tell you what the app will feel like.
   */
  const [preview, setPreview] = useState<{ field: string; ink: string } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const word = useRef<HTMLHeadingElement>(null);

  // The page behind is still a scrolling document. Without this, iOS bounces
  // it under the fixed overlay and the app's own black shows through at the
  // bottom edge, which reads as a gap in the onboarding itself.
  useLockScroll(true);

  const ch = CHAPTERS[c];
  const meter = predict(ATTENDED, HELD + skipped, 75);

  /** Chapter three lights the room from the percentage rather than a constant. */
  const field =
    ch.id === "look" && preview
      ? preview.field
      : ch.id !== "line"
      ? ch.field
      : (() => {
          const t = gsap.utils.clamp(0, 1, (93.3 - meter.percentage) / (93.3 - 73));
          return t < 0.5
            ? (gsap.utils.interpolate(SAFE_FIELD, WATCH_FIELD, t * 2) as string)
            : (gsap.utils.interpolate(WATCH_FIELD, RISK_FIELD, (t - 0.5) * 2) as string);
        })();

  const ink = ch.id === "look" && preview ? preview.ink : ch.ink;

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    gsap.to(el, {
      backgroundColor: field,
      color: ink,
      duration: prefersReducedMotion() ? 0 : 0.85,
      ease: "power2.out",
      overwrite: "auto",
    });
    // The document gets the same colour, in case the overlay ever comes up
    // short of the viewport. **`body` as well as `documentElement`**, because
    // the page canvas, which is what Safari's chrome samples for the bands
    // above and below the page, comes from `body` here: `globals.css` paints
    // `--color-ink-0` there and `html` has no background of its own, so
    // painting the root alone left the canvas the app's near black.
    gsap.to([document.documentElement, document.body], {
      backgroundColor: field,
      duration: prefersReducedMotion() ? 0 : 0.85,
      ease: "power2.out",
      overwrite: "auto",
    });

    // **And the status bar meta, which is what the band at the bottom actually
    // was.** In a standalone PWA iOS paints the area around the web view from
    // `theme-color`, not from the page, so it kept showing the app's theme
    // (black on Ink, cream on Sand) while the deck was a different colour
    // entirely. No amount of covering the viewport fixes that, because it is
    // not the viewport.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", field);
  }, [field, ink]);

  // Handed back on the way out, or the app inherits the last chapter's colour.
  useLayoutEffect(
    () => () => {
      gsap.killTweensOf([document.documentElement, document.body]);
      document.documentElement.style.removeProperty("background-color");
      document.body.style.removeProperty("background-color");
      // Re-applying the theme is what restores the status bar, since that is
      // the only place that knows each theme's bar colour.
      const stored = document.documentElement.dataset.theme as Theme | undefined;
      if (stored) setTheme(stored);
    },
    [],
  );

  // The chapter word is the only thing that moves the same way every time, so
  // the deck has a heartbeat. Everything else arrives on its own terms.
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
        { yPercent: 0, duration: 1, ease: "expo.out", stagger: 0.05 },
      );
      gsap.fromTo(
        `[data-chapter="${c}"] [data-in]`,
        { opacity: 0, y: 34, filter: "blur(10px)" },
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          duration: 0.9,
          ease: "expo.out",
          stagger: 0.07,
          delay: 0.12,
          onComplete: () =>
            gsap.set(`[data-chapter="${c}"] [data-in]`, { clearProps: "filter" }),
        },
      );
    }, el);
    return () => ctx.revert();
  }, [c]);

  // The chapter word is set as large as it can be WITHOUT overflowing its
  // column, measured rather than guessed. "YOUR LOOK" is nine characters and ran
  // 8px past the gutter here and further on a narrower phone, which is what put
  // it under the controls in the corner. A fixed clamp cannot know how long the
  // next word will be; this can.
  useLayoutEffect(() => {
    const h = word.current;
    const box = h?.parentElement;
    if (!h || !box) return;
    // Cleared back to the class clamp, never to nothing: the size lives in the
    // className precisely so this line cannot delete it.
    h.style.fontSize = "";
    const pad = parseFloat(getComputedStyle(box).paddingLeft) || 0;
    const avail = box.clientWidth - pad * 2;
    // `scrollWidth` is useless on an overflow-hidden flex row, it reports the
    // clipped width. The letters know how wide they really are.
    const natural = [...h.querySelectorAll("span")].reduce(
      (a, sp) => a + sp.getBoundingClientRect().width,
      0,
    );
    if (natural > avail && avail > 0) {
      const base = parseFloat(getComputedStyle(h).fontSize);
      h.style.fontSize = `${Math.floor(base * (avail / natural))}px`;
    }
  }, [c]);

  const go = useCallback(
    (n: number) => {
      const next = gsap.utils.clamp(0, CHAPTERS.length - 1, n);
      if (next === c) return;
      haptic("tick");
      setC(next);
    },
    [c],
  );

  const advance = () => (c === CHAPTERS.length - 1 ? finish() : go(c + 1));
  const finish = () => {
    haptic("commit");
    onDone();
  };

  // Swipe is a shortcut, never the only way through: the button is the control.
  const startX = useRef<number | null>(null);

  return (
    <div
      ref={root}
      onTouchStart={(e) => {
        startX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (startX.current === null) return;
        const dx = e.changedTouches[0].clientX - startX.current;
        if (Math.abs(dx) > 70) go(c + (dx < 0 ? 1 : -1));
        startX.current = null;
      }}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden"
      // `100dvh` as well as inset-0: the dynamic viewport unit follows the
      // visible area on iOS, where inset alone can come up short.
      style={{ background: CHAPTERS[0].field, color: CREAM, minHeight: "100dvh" }}
    >
      <button
        onClick={finish}
        className="absolute right-[var(--gutter)] top-[max(20px,env(safe-area-inset-top))] z-30 -mr-2 inline-flex min-h-11 items-center px-2 text-callout opacity-55 transition-opacity hover:opacity-100"
      >
        Skip
      </button>

      {/* The stage. A different kind of object every time. It clips, so a tall
          chapter scrolls inside itself rather than spilling over the chapter
          word and the controls below it. */}
      <div className="relative z-10 min-h-0 flex-1 overflow-hidden">
        {CHAPTERS.map((x, k) =>
          k === c ? (
            <div key={x.id} data-chapter={k} className="absolute inset-0">
              {x.id === "hello" && <Hello />}
              {x.id === "does" && <Does />}
              {x.id === "line" && (
                <TheLine
                  meter={meter}
                  skipped={skipped}
                  onSkip={() => {
                    haptic("select");
                    setSkipped((s) => Math.min(5, s + 1));
                  }}
                  onReset={() => {
                    haptic("tick");
                    setSkipped(0);
                  }}
                />
              )}
              {x.id === "look" && (
                <Look
                  field={field}
                  ink={ink}
                  picked={picked}
                  onPick={(t) => {
                    haptic("select");
                    setPicked(t);
                    setTheme(t);
                    // Read AFTER the attribute lands, so the variables have
                    // resolved to the new theme rather than the old one.
                    requestAnimationFrame(() => {
                      const cs = getComputedStyle(document.documentElement);
                      setPreview({
                        field: cs.getPropertyValue("--color-ink-0").trim(),
                        ink: cs.getPropertyValue("--color-text-1").trim(),
                      });
                    });
                  }}
                />
              )}
              {x.id === "who" && <Who ink={ink} field={field} />}
              {x.id === "ready" && <Ready picked={picked} />}
            </div>
          ) : null,
        )}
      </div>

      {/* The furniture, identical in every chapter. */}
      <div className="relative z-20 shrink-0 px-[var(--gutter)] pb-[max(22px,env(safe-area-inset-bottom))]">
        <p className="text-label uppercase tracking-[0.22em] opacity-55">{ch.eyebrow}</p>
        <h1
          ref={word}
          key={ch.word}
          className="mt-2 flex overflow-hidden font-bold leading-[0.86] [font-size:clamp(3rem,17vw,7rem)]"
          style={{ letterSpacing: "-0.045em" }}
        >
          {ch.word.split("").map((ltr, k) => (
            <span key={k} data-word-part className="inline-block whitespace-pre">
              {ltr}
            </span>
          ))}
        </h1>

        <div className="mt-6 flex items-center justify-between gap-4">
          <span className="flex items-center gap-3">
            <Logo size={20} mono />
            <Rungs count={CHAPTERS.length} active={c} onPick={go} />
          </span>
          <span className="flex shrink-0 items-center gap-2.5">
            {/* Back, so a chapter can be read twice. It holds its place rather
                than unmounting on the first chapter: a control that appears and
                disappears makes the pair jump every time you advance. */}
            <button
              onClick={() => go(c - 1)}
              disabled={c === 0}
              aria-label="Back"
              className="grid size-[52px] place-items-center rounded-full border transition-all duration-300 active:scale-90 disabled:pointer-events-none disabled:opacity-20"
              style={{ borderColor: "currentColor" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" />
                <path d="M11 18l-6-6 6-6" />
              </svg>
            </button>
          <button
            onClick={advance}
            aria-label={c === CHAPTERS.length - 1 ? "Sign in" : "Next"}
            className="grid size-[62px] shrink-0 place-items-center rounded-full transition-transform duration-200 active:scale-90"
            style={{ background: ink, color: field }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              {c === CHAPTERS.length - 1 ? (
                <path d="M20 6L9 17l-5-5" />
              ) : (
                <>
                  <path d="M5 12h14" />
                  <path d="M13 6l6 6-6 6" />
                </>
              )}
            </svg>
          </button>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- chapter 1 */

/** A fanned stack of the app's own surfaces, standing in real depth. */
function Hello() {
  const cards = [
    { t: "97.7%", s: "every subject clear", rot: -9, x: -18, y: 18, z: 0 },
    { t: "Day order 5", s: "Discrete Mathematics, 02:20", rot: 4, x: 14, y: 0, z: 40 },
    { t: "41 / 60", s: "on track for B plus", rot: -3, x: -6, y: -22, z: 80 },
  ];
  return (
    <div className="flex h-full items-center justify-center px-[var(--gutter)]" style={{ perspective: 1100 }}>
      <div className="relative h-[300px] w-full max-w-[330px]" style={{ transformStyle: "preserve-3d" }}>
        {cards.map((k, idx) => (
          <div
            key={k.t}
            data-in
            className="absolute inset-x-0 mx-auto rounded-[22px] px-5 py-5"
            style={{
              top: `${idx * 86}px`,
              background: CREAM,
              color: INK,
              transform: `translate3d(${k.x}px, ${k.y}px, ${k.z}px) rotate(${k.rot}deg)`,
              boxShadow: "0 30px 60px -24px rgba(0,0,0,0.65)",
            }}
          >
            <p className="tnum text-title leading-none">{k.t}</p>
            <p className="mt-1.5 text-callout opacity-60">{k.s}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- chapter 2 */

/** A list that is mostly rule, so it reads as an index rather than as cards. */
function Does() {
  const rows = [
    ["01", "Attendance", "and how many you can still miss"],
    ["02", "Marks", "internals, and the grade you are on for"],
    ["03", "Schedule", "day orders, breaks, the whole term"],
    ["04", "Leave planner", "book days off and see the damage first"],
  ];
  return (
    <div className="flex h-full flex-col justify-center px-[var(--gutter)]">
      {rows.map(([n, t, s]) => (
        <div key={n} data-in className="border-t py-5" style={{ borderColor: "currentColor", borderTopWidth: 1, opacity: 0.999 }}>
          <div className="flex items-baseline gap-4">
            <span className="tnum text-label opacity-45">{n}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-headline">{t}</span>
              <span className="mt-1 block text-callout opacity-60">{s}</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- chapter 3 */

/** The live meter. One labelled button, so nobody has to guess the gesture. */
function TheLine({
  meter,
  skipped,
  onSkip,
  onReset,
}: {
  meter: ReturnType<typeof predict>;
  skipped: number;
  onSkip: () => void;
  onReset: () => void;
}) {
  const num = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const n = num.current;
    if (!n) return;
    if (prefersReducedMotion()) {
      n.textContent = meter.percentage.toFixed(1);
      return;
    }
    const o = { v: Number(n.textContent) || 93.3 };
    const t = gsap.to(o, {
      v: meter.percentage,
      duration: 0.7,
      ease: "expo.out",
      onUpdate: () => {
        n.textContent = o.v.toFixed(1);
      },
    });
    return () => {
      t.kill();
    };
  }, [meter.percentage]);

  const broken = !meter.isSafe;
  return (
    <div className="flex h-full flex-col justify-center px-[var(--gutter)]">
      <div data-in className="flex items-end justify-between gap-4">
        <span ref={num} className="tnum font-bold leading-[0.8]" style={{ fontSize: "clamp(4.5rem,24vw,9rem)", letterSpacing: "-0.05em" }}>
          93.3
        </span>
        <span className="pb-3 text-right text-label uppercase tracking-[0.16em] opacity-60">
          {broken
            ? `attend ${meter.mustAttend} to come back`
            : `${meter.canSkip} still in hand`}
        </span>
      </div>

      {/* The rule and its tick: the app's own device, full bleed. */}
      {/* The track carries its own alpha as a SIBLING, never as this element's
          opacity: a child cannot be more opaque than its parent, so a faded
          wrapper would drag the fill down with it and the meter would read as
          full at every value. */}
      <div data-in className="relative mt-6 h-[3px] w-full">
        <span className="absolute inset-0" style={{ background: "currentColor", opacity: 0.26 }} />
        <span
          className="absolute inset-y-0 left-0 transition-[width] duration-700 ease-out"
          style={{ width: `${meter.percentage}%`, background: "currentColor" }}
        />
        <span className="absolute" style={{ left: "75%", top: -8, width: 2, height: 19, background: "currentColor" }} />
      </div>

      <p data-in className="mt-5 max-w-[24ch] text-body leading-relaxed opacity-75">
        {broken
          ? "Below the line. Skipp tells you exactly how many to sit to climb back."
          : "Skipp works out how many you can miss and still stay above it."}
      </p>

      <div data-in className="mt-7 flex flex-wrap gap-2.5">
        <button
          onClick={onSkip}
          disabled={skipped >= 5}
          className="inline-flex min-h-12 items-center rounded-full border px-5 text-body font-semibold transition-transform duration-200 active:scale-95 disabled:opacity-30"
          style={{ borderColor: "currentColor" }}
        >
          Skip a class
        </button>
        {skipped > 0 && (
          <button
            onClick={onReset}
            className="inline-flex min-h-12 items-center px-3 text-body opacity-55 transition-opacity hover:opacity-100"
          >
            Undo
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- chapter 4 */

/**
 * A real row from the app, drawn in the theme's own tokens.
 *
 * Swapping the page colour was not enough: Brutal, Clay and Terminal differ in
 * **structure**, not hue, and with only a background change all three previewed
 * as the same screen in a different colour. So this carries the actual markers
 * the themes hook into (`data-band`, `data-surface`, `data-meter`) and inherits
 * `--font-sans`, which is how Terminal announces itself as monospace. Brutal
 * turns it into a bordered block on a hard offset, Clay into a soft filled
 * card, Terminal into a drawn box.
 *
 * It sets its own colour and family rather than inheriting the deck's, because
 * the whole point is that it looks like the app and not like the onboarding.
 */
function ThemePreview() {
  return (
    <div
      className="rounded-card border border-line p-4"
      style={{
        background: "var(--color-ink-1)",
        color: "var(--color-text-1)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <p data-band className="text-label uppercase" style={{ color: "var(--color-text-3)" }}>
        Attendance
      </p>
      <div data-surface className="mt-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-headline">Computer Networks</span>
          <span className="tnum shrink-0 text-headline">92%</span>
        </div>
        <div data-meter className="relative mt-2.5 h-[3px] w-full">
          <span className="absolute inset-0" style={{ background: "var(--color-line)" }} />
          <span
            className="absolute inset-y-0 left-0"
            style={{ width: "92%", background: "var(--color-accent)" }}
          />
          <span
            className="absolute"
            style={{ left: "75%", top: -5, width: 2, height: 13, background: "var(--color-text-1)" }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Two kinds of theme, because they are two different things: three that rebuild
 * the interface, and colours that only recolour it. Six of the fifteen are
 * shown; the rest live in the profile, since a first impression is not a picker.
 */
function Look({
  field,
  ink,
  picked,
  onPick,
}: {
  field: string;
  ink: string;
  picked: Theme | null;
  onPick: (t: Theme) => void;
}) {
  return (
    // This chapter carries the most, so it clears the header explicitly and is
    // allowed to scroll rather than running under the Skip control on a short
    // phone. The others are short enough to centre.
    // Top aligned, not centred. A centred flex column that overflows pushes its
    // own top out of reach, so the first card slid under the Skip control and
    // could not be scrolled back to.
    <div className="no-scrollbar flex h-full flex-col justify-start gap-3.5 overflow-y-auto px-[var(--gutter)] pb-1 pt-[max(68px,calc(env(safe-area-inset-top)+56px))]">
      <div data-in>
        <ThemePreview />
      </div>

      <div>
        <p data-in className="text-label uppercase tracking-[0.18em] opacity-45">
          Full looks, rebuilds the UI
        </p>
        <div className="mt-2 flex flex-col gap-1.5">
          {LOOKS.map((t) => {
            const on = picked === t.id;
            return (
              <button
                key={t.id}
                data-in
                onClick={() => onPick(t.id)}
                aria-pressed={on}
                className="flex min-h-[44px] items-center justify-between gap-4 rounded-full px-5 transition-all duration-300"
                // Inverted against whatever the theme actually paints with, so
                // a light theme does not put cream on cream.
                style={{
                  background: on ? ink : "transparent",
                  color: on ? field : "inherit",
                  border: `1px solid ${on ? ink : "currentColor"}`,
                  opacity: on ? 1 : 0.75,
                }}
              >
                {/* Name only. The preview above demonstrates what "hard
                    shadows" or "soft cards" mean far better than the words
                    do, and dropping them is what lets this chapter fit a
                    phone without scrolling. */}
                <span className="min-w-0 truncate text-left text-body font-semibold">
                  {t.name}
                </span>
                <span className="flex shrink-0 gap-1.5">
                  {t.swatch.map((sw, k) => (
                    <span key={k} className="size-3 rounded-full" style={{ background: sw }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p data-in className="text-label uppercase tracking-[0.18em] opacity-45">
          Colours, {SKIN_TOTAL} of them
        </p>
        <div data-in className="mt-3 flex gap-3">
          {COLOURS.map((t) => {
            const on = picked === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onPick(t.id)}
                aria-pressed={on}
                aria-label={t.name}
                className="grid size-11 shrink-0 place-items-center rounded-full transition-transform duration-300 active:scale-90"
                style={{
                  border: `2px solid ${on ? ink : "transparent"}`,
                  transform: on ? "scale(1.08)" : undefined,
                }}
              >
                <span className="flex size-8 overflow-hidden rounded-full" style={{ opacity: on ? 1 : 0.8 }}>
                  {t.swatch.map((sw, k) => (
                    <span key={k} className="h-full flex-1" style={{ background: sw }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- chapter 5 */

/**
 * Who made it. Skipp is one student's evenings, not a company, and saying so
 * plainly is worth more than a page of personality: it tells a stranger exactly
 * how much to trust the thing they are about to hand a password to.
 *
 * The card is the app's own profile mark language, and the links come from
 * `lib/creator`, so a blank URL there simply removes an icon rather than
 * leaving a dead one.
 */
function Who({ ink, field }: { ink: string; field: string }) {
  const links = creatorLinks();
  return (
    <div className="flex h-full flex-col justify-center gap-6 px-[var(--gutter)]">
      <div
        data-in
        className="rounded-[26px] p-5"
        style={{ background: ink, color: field }}
      >
        <p className="text-label uppercase tracking-[0.18em] opacity-55">
          {CREATOR.prefix}
        </p>
        <p className="mt-2 text-hero font-bold leading-[1.02]">{CREATOR.name}</p>
        <p className="mt-3 text-callout leading-relaxed opacity-70">
          Third year CSE at SRM. Built Skipp because the portal was three taps
          and a loading spinner away from every answer.
        </p>
        {links.length > 0 && (
          <div className="mt-5 flex gap-2.5">
            {links.map((l) => (
              <a
                key={l.kind}
                href={l.url}
                target="_blank"
                // `noopener` alone, never `noreferrer`: with the referrer
                // stripped LinkedIn answers with a sign-up wall instead of the
                // profile. This still closes the window.opener hole.
                rel="noopener"
                aria-label={l.kind === "linkedin" ? "LinkedIn" : "Instagram"}
                className="grid size-11 place-items-center rounded-full transition-transform duration-200 active:scale-90"
                style={{ border: `1px solid ${field}`, opacity: 0.75 }}
              >
                {l.kind === "linkedin" ? <IconLinkedIn size={17} /> : <IconInstagram size={17} />}
              </a>
            ))}
          </div>
        )}
      </div>

      <div data-in>
        <p className="text-label uppercase tracking-[0.18em] opacity-45">
          Why it exists
        </p>
        <p className="mt-3 max-w-[30ch] text-body leading-relaxed opacity-80">
          Everything here is your own data, read with your own sign in. No
          account, no server, nothing kept. If something breaks, it breaks for me
          too.
        </p>
      </div>
    </div>
  );
}



function Ready({ picked }: { picked: Theme | null }) {
  const name = picked ? THEMES.find((t) => t.id === picked)?.name : null;
  return (
    <div className="flex h-full flex-col justify-center px-[var(--gutter)]">
      <p data-in className="text-label uppercase tracking-[0.22em] opacity-55">
        one sign in, and it is yours
      </p>
      <p data-in className="mt-5 max-w-[20ch] font-bold leading-[1.02]" style={{ fontSize: "clamp(2rem,10vw,3.6rem)" }}>
        Your Net ID. Nothing else.
      </p>
      <p data-in className="mt-5 max-w-[28ch] text-body leading-relaxed opacity-70">
        It goes to the SRM portal to sign you in and nowhere else. No account, no
        server, nothing kept.
      </p>
      {name && (
        <p data-in className="mt-6 text-callout opacity-55">
          {name} is on. Change it any time in your profile.
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- furniture */

/** Progress as rungs, in the same language as the tick on the rule. */
function Rungs({
  count,
  active,
  onPick,
}: {
  count: number;
  active: number;
  onPick: (i: number) => void;
}) {
  return (
    <span className="flex items-center gap-1.5" role="tablist" aria-label="Onboarding">
      {Array.from({ length: count }, (_, k) => (
        <button
          key={k}
          role="tab"
          aria-selected={k === active}
          aria-label={`Chapter ${k + 1}`}
          onClick={() => onPick(k)}
          className="-my-3 px-0.5 py-3"
        >
          <span
            className="block h-[3px] rounded-full transition-all duration-500 ease-out"
            style={{
              width: k === active ? 26 : 7,
              background: "currentColor",
              opacity: k === active ? 1 : 0.3,
            }}
          />
        </button>
      ))}
    </span>
  );
}
