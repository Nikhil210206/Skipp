"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { prefersReducedMotion } from "@/lib/motion";
import { haptic } from "@/lib/haptics";
import { predict } from "@/lib/predictor";
import { setTheme, THEMES, type Theme } from "@/lib/theme";
import { CREATOR, creatorLinks } from "@/lib/creator";
import { IconInstagram, IconLinkedIn } from "@/components/Icons";
import Notebook, { PAPER } from "@/components/entry/Notebook";
import {
  Ink,
  Mark,
  Sticky,
  Star,
  Tape,
  Underline,
  Arrow as Doodle,
} from "@/components/entry/paper";
import { INKS } from "@/components/entry/inks";
import { useDeckPages } from "@/components/entry/pages";

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

/**
 * The order of the sheets.
 *
 * A chapter used to carry a field colour and the ink to read it, because every
 * screen was its own saturated room. **The pad is one stock throughout**, so a
 * chapter is only an identity and a position: what changes page to page is the
 * colour of the pen and which tools it was written with.
 */
const CHAPTERS = [
  { id: "hello", word: "SKIPP" },
  { id: "does", word: "THE LOT" },
  { id: "line", word: "THE LINE" },
  { id: "look", word: "YOUR LOOK" },
  { id: "who", word: "THE DEV" },
  { id: "ready", word: "LESSSGO" },
] as const;
type Id = (typeof CHAPTERS)[number]["id"];

/** 14 of 15 held. Three in hand, so the fourth skip is the one that crosses. */
const ATTENDED = 14;
const HELD = 15;
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
  const root = useRef<HTMLDivElement>(null);
  const pages = useDeckPages();

  const ch: Id = CHAPTERS[c].id;
  const meter = predict(ATTENDED, HELD + skipped, 75);

  // The pad paints itself and hands the colour back here, on the way out to
  // the sign in, or the app inherits the paper.
  useLayoutEffect(
    () => () => {
      document.documentElement.style.removeProperty("background-color");
      document.body.style.removeProperty("background-color");
      const stored = document.documentElement.dataset.theme as
        Theme | undefined;
      if (stored) setTheme(stored);
    },
    [],
  );

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
    <Notebook
      page={pages.firstChapter + c}
      total={pages.total}
      word={CHAPTERS[c].word}
      ink={INKS[ch]}
      onNext={advance}
      onBack={() => go(c - 1)}
      onSkip={finish}
      last={c === CHAPTERS.length - 1}
    >
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
        className="h-full"
      >
        {ch === "hello" && <Hello />}
        {ch === "does" && <Does />}
        {ch === "line" && (
          <TheLine
            meter={meter}
            skipped={skipped}
            onSkip={() => {
              haptic("select");
              setSkipped((n) => Math.min(5, n + 1));
            }}
            onReset={() => {
              haptic("tick");
              setSkipped(0);
            }}
          />
        )}
        {ch === "look" && (
          <Look
            picked={picked}
            onPick={(t) => {
              haptic("select");
              setPicked(t);
              setTheme(t);
            }}
          />
        )}
        {ch === "who" && <Who />}
        {ch === "ready" && <Ready picked={picked} />}
      </div>
    </Notebook>
  );
}

/* ------------------------------------------------------------- chapter 1 */

/** A fanned stack of the app's own surfaces, standing in real depth. */
function Hello() {
  const INK = INKS.hello;
  const cards = [
    { t: "97.7%", s: "every subject clear", rot: -4, x: -10, y: 4 },
    { t: "Day order 5", s: "Discrete Mathematics, 02:20", rot: 3, x: 12, y: 0 },
    { t: "41 / 60", s: "on track for B plus", rot: -2, x: -4, y: -4 },
  ];
  return (
    <div className="flex h-full flex-col">
      <Ink
        as="p"
        tool="pencil"
        colour={INK}
        size="text-[1.05rem]"
        className="shrink-0"
      >
        everything the portal makes you dig for
      </Ink>

      {/* Centred in whatever the writing leaves, not pinned to the top. Three
          notes stacked from the top of a tall page put a third of the sheet in
          use and left the rest blank. */}
      <div className="relative flex min-h-0 flex-1 flex-col justify-center gap-4">
        {cards.map((k, idx) => (
          <div
            key={k.t}
            // Capped, not full width. A note stuck on a page is a note sized
            // object whatever the window is; stretched to a laptop's width the
            // three of them became slabs lying across each other.
            className="relative w-full max-w-[19rem]"
            style={{
              transform: `translate(${k.x}px, ${k.y}px) rotate(${k.rot}deg)`,
            }}
          >
            <Tape
              className={
                idx === 1 ? "right-8 -top-3 z-10" : "left-7 -top-3 z-10"
              }
              rotate={idx % 2 ? 6 : -7}
              width={idx === 1 ? 54 : 64}
            />
            <div
              className="rounded-[12px] px-5 py-4"
              style={{
                background: INK,
                color: PAPER,
                boxShadow: "0 12px 22px -14px rgba(29,59,139,0.6)",
              }}
            >
              {/* The figure stays in the app's own face: a handwriting face has
                  no tabular figures, so 97.7% would jitter and 41 / 60 would
                  stop lining up. */}
              <p className="tnum text-title leading-none">{k.t}</p>
              <Ink
                tool="pen"
                colour={PAPER}
                size="text-[1.05rem]"
                className="mt-1.5 block opacity-80"
              >
                {k.s}
              </Ink>
            </div>
          </div>
        ))}
        {/* This sheet's only control is the advance, so that is what it aims
            at. In the page's own pen: a purple doodle on a blue page was the
            one mark not written by the same hand as the rest of it. */}
        {/* Kept fully inside the box. Rotating grows the bounding rect, so a
            negative offset that looks fine unrotated hung 17px into the sheet's
            `overflow-hidden` and had its tip cut off at 667. */}
        <Doodle className="bottom-3 right-3 h-12 w-14" rotate={22} colour={INK} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- chapter 2 */

function Does() {
  const INK = INKS.does;
  const rows = [
    ["01", "Attendance", "and how many you can still miss"],
    ["02", "Marks", "internals, and the grade you are on for"],
    ["03", "Schedule", "day orders, breaks, the whole term"],
    ["04", "Leave planner", "book days off and see the damage first"],
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="relative shrink-0 self-start">
        <Ink tool="marker" colour={INK} size="text-[1.65rem]">
          The whole portal,
          <br />
          minus the <Mark>portal.</Mark>
        </Ink>
      </div>
      <Star className="right-3 top-1" size={15} />

      {/* Spread down the sheet rather than stacked at the top. Four rows
          pinned to the top of a tall page used a third of it and left the rest
          blank, which is the fault this whole pass is about. */}
      <div className="mt-5 flex min-h-0 flex-1 flex-col justify-evenly pb-4">
        {rows.map(([n, t, d]) => (
          <div
            key={n}
            className="flex items-start gap-4 border-b py-3.5"
            style={{ borderColor: `${INK}22` }}
          >
            <Ink
              tool="pencil"
              colour={INK}
              size="text-[1.05rem]"
              className="mt-1 w-6 shrink-0"
            >
              {n}
            </Ink>
            <span className="min-w-0 flex-1">
              <Ink
                tool="pen"
                colour={INK}
                size="text-[1.3rem]"
                className="block"
              >
                {t}
              </Ink>
              <Ink
                tool="pencil"
                colour={INK}
                size="text-[1rem]"
                className="mt-0.5 block"
              >
                {d}
              </Ink>
            </span>
          </div>
        ))}
      </div>
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
  const INK = INKS.line;
  return (
    <div className="flex h-full flex-col">
      <div className="relative shrink-0 self-start">
        <Ink tool="marker" colour={INK} size="text-[1.9rem]">
          Attendance
        </Ink>
        <Underline />
      </div>

      {/* One card, taped on, so the reading and the thing that changes it stay
          together instead of drifting apart down the page.

          Floated with `my-auto` rather than centred with `justify-center`: a
          flex container treats auto margins as zero once free space goes
          negative, so on a short phone this settles back to the top instead of
          pushing its own head under the Skip control, which is exactly the trap
          the theme chapter hit. */}
      <div className="relative my-auto shrink-0">
        <Tape className="left-9 -top-3 z-10" rotate={-6} width={66} />
        <Sticky tone="mint" rotate={-1} className="px-5 py-5">
          <div className="flex items-end gap-4">
            {/* Tabular figures, never the hand: this one counts. */}
            <span
              ref={num}
              className="tnum font-bold leading-[0.82]"
              style={{
                fontSize: "clamp(3.3rem,16vw,4.6rem)",
                letterSpacing: "-0.04em",
                color: INK,
              }}
            >
              93.3
            </span>
            <Ink
              tool="pencil"
              colour={INK}
              size="text-[1.05rem]"
              className="pb-2 leading-tight"
            >
              {broken ? (
                <>
                  attend {meter.mustAttend}
                  <br />
                  to come back
                </>
              ) : (
                <>
                  {meter.canSkip} still
                  <br />
                  in hand
                </>
              )}
            </Ink>
          </div>

          {/* The rule and its tick, the app's own device. The track carries its
              alpha as a SIBLING, never as this element's opacity, or a faded
              wrapper drags the fill down and the meter reads full at every
              value. */}
          <div className="relative mt-4 h-[3px] w-full">
            <span
              className="absolute inset-0"
              style={{ background: INK, opacity: 0.2 }}
            />
            <span
              className="absolute inset-y-0 left-0 transition-[width] duration-700 ease-out"
              style={{ width: `${meter.percentage}%`, background: INK }}
            />
            <span
              className="absolute"
              style={{
                left: "75%",
                top: -7,
                width: 2,
                height: 17,
                background: INK,
              }}
            />
          </div>

          <Ink
            as="p"
            tool="pen"
            colour={INK}
            size="text-[1.1rem]"
            className="mt-4 max-w-[26ch]"
          >
            {broken
              ? "Below the line. Skipp tells you exactly how many to sit to climb back."
              : "Skipp works out how many you can miss and still stay above it."}
          </Ink>

          <div className="mt-5 flex flex-wrap items-center gap-1">
            <button
              onClick={onSkip}
              disabled={skipped >= 5}
              className="inline-flex min-h-11 items-center rounded-full px-5 transition-transform duration-200 active:scale-95 disabled:opacity-35"
              style={{ background: INK, color: PAPER }}
            >
              <Ink tool="marker" colour={PAPER} size="text-[1.1rem]">
                Skip a class
              </Ink>
            </button>
            {skipped > 0 && (
              <button
                onClick={onReset}
                className="inline-flex min-h-11 items-center px-3"
              >
                <Ink tool="pencil" colour={INK} size="text-[1.05rem]">
                  Undo
                </Ink>
              </button>
            )}
          </div>
        </Sticky>
        {/* Aimed at "Skip a class", which is the one thing on this sheet worth
            pressing. It used to hang off the card's bottom right corner
            pointing into blank paper, which is why it read as clutter. */}
        <Doodle className="-bottom-12 left-6 h-12 w-14" rotate={198} colour={INK} />
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
      <p
        data-band
        className="text-label uppercase"
        style={{ color: "var(--color-text-3)" }}
      >
        Attendance
      </p>
      <div data-surface className="mt-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-headline">Computer Networks</span>
          <span className="tnum shrink-0 text-headline">92%</span>
        </div>
        <div data-meter className="relative mt-2.5 h-[3px] w-full">
          <span
            className="absolute inset-0"
            style={{ background: "var(--color-line)" }}
          />
          <span
            className="absolute inset-y-0 left-0"
            style={{ width: "92%", background: "var(--color-accent)" }}
          />
          <span
            className="absolute"
            style={{
              left: "75%",
              top: -5,
              width: 2,
              height: 13,
              background: "var(--color-text-1)",
            }}
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
  picked,
  onPick,
}: {
  picked: Theme | null;
  onPick: (t: Theme) => void;
}) {
  return (
    // This chapter carries the most, so it is allowed to scroll rather than
    // running under the Skip control on a short phone.
    //
    // The contents float on `my-auto` instead of the column carrying
    // `justify-center`, and the difference is the whole reason this note
    // exists: centring a flex column that overflows pushes its own top out of
    // reach, which is how the first card once slid under Skip and could not be
    // scrolled back to. Auto margins are treated as ZERO once free space goes
    // negative, so tall content simply top aligns and scrolls.
    <div className="no-scrollbar flex h-full flex-col overflow-y-auto pb-2">
      <div className="my-auto flex flex-col gap-5">
        <div>
          <ThemePreview />
        </div>

        <div>
          <Ink as="p" tool="pencil" colour={INKS.look} size="text-[1.05rem]">
            full looks, rebuilds the UI
          </Ink>
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
                    background: on ? INKS.look : "transparent",
                    color: on ? PAPER : "inherit",
                    border: `1px solid ${on ? INKS.look : `${INKS.look}44`}`,
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
                      <span
                        key={k}
                        className="size-3 rounded-full"
                        style={{ background: sw }}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Ink as="p" tool="pencil" colour={INKS.look} size="text-[1.05rem]">
            colours, {SKIN_TOTAL} of them
          </Ink>
          {/* A rack of three by two, the same at every width.
              Six 44px targets and their gaps measure 324px against the 302 this
              page has at 390 and the 232 it has at 320, so a single row cut the
              last disc off the sheet edge. Wrapping fixed the clipping and left
              a lone disc under a row of five, which reads as the overflow it
              is. Six cannot fit one row at 320 without going under the 44px
              touch floor, so two rows are forced: making them EQUAL is what
              turns the wrap into a composition. */}
          <div data-in className="mt-3 grid w-fit grid-cols-3 gap-3">
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
                    border: `2px solid ${on ? INKS.look : "transparent"}`,
                    transform: on ? "scale(1.08)" : undefined,
                  }}
                >
                  <span
                    className="flex size-8 overflow-hidden rounded-full"
                    style={{ opacity: on ? 1 : 0.8 }}
                  >
                    {t.swatch.map((sw, k) => (
                      <span
                        key={k}
                        className="h-full flex-1"
                        style={{ background: sw }}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
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
function Who() {
  const links = creatorLinks();
  return (
    <div className="flex h-full flex-col justify-center gap-6">
      <div className="relative">
        <Tape className="left-7 -top-3 z-10" rotate={-8} width={74} />
        <Tape className="right-9 -top-2 z-10" rotate={6} width={52} />
        <div
          className="rounded-[14px] p-5"
          style={{
            background: INKS.who,
            color: PAPER,
            transform: "rotate(-1.3deg)",
            boxShadow: "0 14px 26px -16px rgba(122,71,24,0.65)",
          }}
        >
          <Ink as="p" tool="pencil" colour={PAPER} size="text-[1rem]">
            {CREATOR.prefix}
          </Ink>
          <Ink
            tool="marker"
            colour={PAPER}
            size="text-[2rem]"
            className="mt-1 block"
          >
            {CREATOR.name}
          </Ink>
          <Ink
            as="p"
            tool="pen"
            colour={PAPER}
            size="text-[1.05rem]"
            className="mt-3 block opacity-85"
          >
            Third year CSE at SRM. Built Skipp because the portal was three taps
            and a loading spinner away from every answer.
          </Ink>
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
                  style={{ border: `1px solid ${PAPER}`, opacity: 0.8 }}
                >
                  {l.kind === "linkedin" ? (
                    <IconLinkedIn size={17} />
                  ) : (
                    <IconInstagram size={17} />
                  )}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <Ink as="p" tool="pencil" colour={INKS.who} size="text-[1.05rem]">
          why it exists
        </Ink>
        <Ink
          as="p"
          tool="pen"
          colour={INKS.who}
          size="text-[1.1rem]"
          className="mt-2 block max-w-[30ch]"
        >
          Everything here is your own data, read with your own sign in. No
          account, no server, nothing kept. If something breaks, it breaks for
          me too.
        </Ink>
      </div>
    </div>
  );
}

function Ready({ picked }: { picked: Theme | null }) {
  const name = picked ? THEMES.find((t) => t.id === picked)?.name : null;
  return (
    <div className="flex h-full flex-col justify-center px-[var(--gutter)]">
      <p className="self-start">
        <Mark>
          <Ink tool="pencil" colour={INKS.ready} size="text-[1.05rem]">
            one sign in, and it is yours
          </Ink>
        </Mark>
      </p>
      {/* The sign off carries the page, so it is set to carry it. At 2.5rem it
          was the same size as the writing on every other sheet while sitting in
          the emptiest one, and read as small rather than as calm. */}
      <Ink
        tool="marker"
        colour={INKS.ready}
        size="text-[3.3rem]"
        className="mt-4 block max-w-[11ch] leading-[1.02]"
      >
        Your Net ID. Nothing else.
      </Ink>
      <Ink
        as="p"
        tool="pen"
        colour={INKS.ready}
        size="text-[1.3rem]"
        className="mt-6 max-w-[26ch]"
      >
        It goes to the SRM portal to sign you in and nowhere else. No account,
        no server, nothing kept.
      </Ink>
      {name && (
        <Ink
          as="p"
          tool="pencil"
          colour={INKS.ready}
          size="text-[1.05rem]"
          className="mt-6"
        >
          {name} is on. Change it any time in your profile.
        </Ink>
      )}
      {/* Aimed down into the corner where the tick sits, since on the last
          sheet the control is the point of the page. */}
      <Doodle className="bottom-3 right-3 h-14 w-16" rotate={22} colour={INKS.ready} />
    </div>
  );
}
