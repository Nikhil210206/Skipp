"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useLockScroll } from "@/components/ui/Overlay";
import { CREATOR_ICONS, IconLock, IconPhone, IconPortal, IconServer } from "@/components/Icons";
import { ProfileFace } from "@/components/ProfileMark";
import { haptic } from "@/lib/haptics";
import { prefersReducedMotion, useGsap } from "@/lib/motion";
import { setTheme, THEMES, useTheme, type Theme } from "@/lib/theme";
import { CREATOR, LINK_NAMES, creatorLinks } from "@/lib/creator";
import { predict } from "@/lib/predictor";
import { BackButton, C, DISPLAY, DotField, Eyebrow, PrimaryPill, Receipt } from "./kit";
import { PhoneFrame, Shot } from "./PhoneShot";
import Rise from "./Rise";
import { usePaintChrome } from "./chrome";
import ticketHome from "@/assets/front/ticket-home.webp";
import brutalHome from "@/assets/front/brutal-home.webp";
import terminalHome from "@/assets/front/terminal-home.webp";
import registerHome from "@/assets/front/register-home.webp";
import clayHome from "@/assets/front/clay-home.webp";
import stoneHome from "@/assets/front/stone-home.webp";
import inkHome from "@/assets/front/ink-home.webp";

/**
 * THE TOUR.
 *
 * Four chapters in ONE language (see `kit.tsx`): what Skipp is, where your
 * password goes, who made it, and your look. Then the arch, and the send-off
 * into sign in, which the parent plays (`SendOff`) because it has to outlive
 * this component.
 *
 * The furniture never moves: the dot field in the corner, the back button and
 * the progress at the top, the action at the bottom. Only the chapter between
 * them changes, and it changes by travelling: the chapter you leave slides off
 * one way as the next arrives from the other, both mounted for the length of
 * the move, so there is never an empty frame. Each chapter carries its own
 * enormous outlined numeral behind it, which travels with it.
 *
 * Every headline rises a letter at a time from under its own line, then the
 * rest lifts in, then the chapter's own object does its own thing: receipts
 * are dealt, the password is encrypted on its way down the route, the ID card
 * swings in on its lanyard. Nothing is hidden in CSS first, so an entrance that
 * never runs leaves a readable page behind it.
 *
 * Reduced motion keeps every change and drops the travel: chapters dissolve,
 * they never cut.
 */

const TOTAL = 4;

type Nav = { arrive: number };

export default function Tour({
  onBack,
  onSkip,
  onDone,
}: {
  /** Back from the first chapter, to wherever the visitor came from. */
  onBack: () => void;
  /** Skip intro: straight to sign in. */
  onSkip: () => void;
  /** "let's go", with the point the send-off grows from. */
  onDone: (from: { x: number; y: number }) => void;
}) {
  const [c, setC] = useState(0);
  const [prev, setPrev] = useState<{ i: number; dir: number } | null>(null);
  const cur = useRef<HTMLDivElement>(null);
  const old = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const move = useRef<gsap.core.Timeline | null>(null);

  useLockScroll(true);
  usePaintChrome(C.ground);

  const go = useCallback(
    (n: number) => {
      if (n < 0) {
        onBack();
        return;
      }
      const next = Math.min(TOTAL - 1, n);
      if (next === c) return;
      // A tap during a move finishes that move rather than being dropped: a
      // quick double tap on "next" should go two chapters, not one.
      if (busy.current) move.current?.progress(1);
      busy.current = true;
      haptic("tick");
      setPrev({ i: c, dir: next > c ? 1 : -1 });
      setC(next);
    },
    [c, onBack],
  );

  // The move between chapters. Runs on the chapter that just mounted.
  useLayoutEffect(() => {
    if (!prev) return;
    const a = cur.current;
    const b = old.current;
    const done = () => {
      busy.current = false;
      setPrev(null);
    };
    if (!a) {
      done();
      return;
    }
    const tl = gsap.timeline({ onComplete: done });
    move.current = tl;
    if (prefersReducedMotion()) {
      tl.fromTo(a, { opacity: 0 }, { opacity: 1, duration: 0.34, ease: "power1.out" }, 0);
      if (b) tl.to(b, { opacity: 0, duration: 0.34, ease: "power1.out" }, 0);
    } else {
      if (b) tl.to(b, { x: -56 * prev.dir, opacity: 0, duration: 0.36, ease: "power2.in" }, 0);
      tl.fromTo(
        a,
        { x: 64 * prev.dir, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.75, ease: "expo.out", clearProps: "transform" },
        0.12,
      );
    }
    return () => {
      tl.kill();
      if (move.current === tl) move.current = null;
    };
  }, [prev]);

  // Arrow keys on a laptop. The buttons are the control; this is a shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && c < TOTAL - 1) go(c + 1);
      if (e.key === "ArrowLeft" && c > 0) go(c - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [c, go]);

  const chapter = (i: number) => {
    const nav: Nav = { arrive: prev ? 0.28 : 0.12 };
    if (i === 0) return <What nav={nav} />;
    if (i === 1) return <Password nav={nav} />;
    if (i === 2) return <Maker nav={nav} />;
    return <Look nav={nav} />;
  };

  const last = c === TOTAL - 1;

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col overflow-hidden font-sans"
      style={{ background: C.ground, color: C.text }}
    >
      <DotField className="absolute right-0 top-0 h-[46%] w-[85%] lg:w-[60%]" origin={[1, 0]} reach={0.8} />

      <header className="relative z-10 mx-auto flex w-full max-w-[1180px] shrink-0 items-center gap-4 px-6 pt-[max(14px,env(safe-area-inset-top))] lg:px-14 lg:pt-8">
        <BackButton onClick={() => go(c - 1)} label={c === 0 ? "Back to the start" : "Previous chapter"} />
        <span className="font-mono text-[12px] font-semibold tracking-[0.12em]" style={{ color: C.dim }}>
          {String(c + 1).padStart(2, "0")} / {String(TOTAL).padStart(2, "0")}
        </span>
        <div className="grid flex-1 grid-cols-4 gap-1.5 lg:max-w-[220px]" aria-hidden>
          {Array.from({ length: TOTAL }, (_, i) => (
            <span
              key={i}
              className="h-[3px] rounded-full transition-colors duration-500"
              style={{ background: i < c ? C.text : i === c ? C.accent : C.line }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="ml-auto min-h-11 shrink-0 text-[14px] underline-offset-4 hover:underline"
          style={{ color: C.dim }}
        >
          skip intro
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        {prev && (
          <div key={`ch-${prev.i}`} ref={old} aria-hidden inert className="pointer-events-none absolute inset-0">
            {chapter(prev.i)}
          </div>
        )}
        <div key={`ch-${c}`} ref={cur} className="absolute inset-0">
          {chapter(c)}
        </div>
      </div>

      {last ? (
        <Arch
          onGo={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            haptic("commit");
            onDone({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
          }}
        />
      ) : (
        <footer className="relative z-10 mx-auto flex w-full max-w-[1180px] shrink-0 px-6 pb-[max(18px,env(safe-area-inset-bottom))] pt-3 lg:justify-end lg:px-14 lg:pb-10">
          <PrimaryPill label="next" onClick={() => go(c + 1)} className="w-full lg:w-[300px]" />
        </footer>
      )}
    </div>
  );
}

/**
 * The closing call to action, on an arch: an orange dome rising from the
 * bottom edge, which is where the house style always ends. It rises as the
 * last chapter arrives, and its button is where the send-off grows from, so
 * the orange that floods the screen is the arch's own.
 */
function Arch({ onGo }: { onGo: (e: React.MouseEvent<HTMLButtonElement>) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const t = gsap.fromTo(
      el,
      { yPercent: 100 },
      { yPercent: 0, duration: 0.9, ease: "expo.out", delay: 0.15, clearProps: "transform" },
    );
    return () => {
      t.kill();
    };
  }, []);
  return (
    <div ref={ref} className="relative z-10 shrink-0">
      <div
        aria-hidden
        className="absolute bottom-0 left-1/2 h-full w-[170%] -translate-x-1/2 rounded-t-[100%] lg:w-[130%]"
        style={{ background: C.accent }}
      />
      <div className="relative mx-auto flex w-full max-w-[560px] flex-col items-center gap-2.5 px-6 pb-[max(18px,env(safe-area-inset-bottom))] pt-10 short:pt-8">
        <PrimaryPill label="let's go" inverse onClick={onGo} className="w-full max-w-[340px]" />
        <p className="font-mono text-[10.5px] font-semibold tracking-[0.14em]" style={{ color: "rgba(20,7,0,0.72)" }}>
          NEXT: SIGN IN, ONCE
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- shared */

/** The shared entrance: the numeral, the headline rising, then the rest. */
function useEntrance(
  arrive: number,
  extra?: (tl: gsap.core.Timeline, self: HTMLElement) => void | (() => void),
) {
  return useGsap(({ self, reduced }) => {
    if (reduced) return;
    const tl = gsap.timeline({ delay: arrive });
    const numeral = self.querySelector("[data-numeral]");
    const chars = self.querySelectorAll("[data-char]");
    const fades = self.querySelectorAll("[data-f]");
    if (numeral) {
      tl.fromTo(numeral, { yPercent: 18, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.1, ease: "expo.out" }, 0);
    }
    if (chars.length) {
      tl.fromTo(chars, { yPercent: 120 }, { yPercent: 0, duration: 0.95, ease: "expo.out", stagger: 0.016 }, 0);
    }
    if (fades.length) {
      tl.fromTo(fades, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, ease: "expo.out", stagger: 0.07 }, 0.25);
    }
    return extra?.(tl, self);
  }, []);
}

/**
 * The words half of a chapter: eyebrow, the two part headline (heavy display,
 * then the hand in orange), and one short paragraph that drops on a short
 * phone so the chapter still fits a single screen.
 */
function Head({
  eyebrow,
  lead,
  hand,
  children,
}: {
  eyebrow: string;
  lead: string;
  hand: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Rise
        text={lead}
        className="mt-4 text-[42px] font-extrabold leading-[0.92] tracking-[-0.045em] short:text-[36px] lg:text-[78px]"
        style={{ fontFamily: DISPLAY }}
      />
      <Rise
        text={hand}
        className="font-hand text-[48px] font-bold leading-none short:text-[42px] lg:text-[86px]"
        style={{ color: C.accent }}
      />
      <p data-f className="mt-5 max-w-[30rem] text-[16px] leading-[1.5] short:hidden lg:text-[18px]" style={{ color: C.dim }}>
        {children}
      </p>
    </>
  );
}

/** A chapter: its numeral behind, its words, its object. */
function Body({
  scope,
  numeral,
  head,
  object,
}: {
  scope: React.RefObject<HTMLDivElement | null>;
  numeral: string;
  head: React.ReactNode;
  object: React.ReactNode;
}) {
  return (
    <div ref={scope} className="no-scrollbar absolute inset-0 overflow-y-auto">
      <span
        data-numeral
        aria-hidden
        className="pointer-events-none absolute -right-3 top-1 select-none text-[190px] font-extrabold leading-none tracking-[-0.06em] lg:right-6 lg:top-0 lg:text-[340px]"
        style={{ fontFamily: DISPLAY, color: "transparent", WebkitTextStroke: `2px ${C.line}` }}
      >
        {numeral}
      </span>
      <div className="relative mx-auto flex min-h-full w-full max-w-[1180px] flex-col px-6 lg:grid lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-14">
        <div className="pt-6 short:pt-3 lg:pt-0">{head}</div>
        <div className="my-auto py-6 short:py-3 lg:my-0 lg:py-10">{object}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- 01 · what it is */

/**
 * The portal's own attendance table, as cramped as the real one: nine columns
 * in the order SRM prints them. The courses and staff are invented, but the
 * arithmetic is not: the answers are `predict()` over exactly these rows, so
 * the chapter can never quote a figure the app would disagree with.
 */
const PORTAL_COLS = ["CODE", "COURSE TITLE", "CATEGORY", "FACULTY", "SLOT", "ROOM", "HRS", "ABS", "ATTN %"];
const PORTAL = [
  { code: "21CSC302J", title: "Computer Networks", cat: "Theory", fac: "Dr. R. K.", slot: "A", room: "TP306", hrs: 28, abs: 3 },
  { code: "21CSE742P", title: "Database Systems Lab", cat: "Practical", fac: "Dr. S. M.", slot: "P37", room: "TP1004", hrs: 24, abs: 2 },
  { code: "21MAB302T", title: "Discrete Mathematics", cat: "Theory", fac: "Dr. A. V.", slot: "B", room: "TP506", hrs: 28, abs: 9 },
  { code: "21CSC303J", title: "Software Engineering", cat: "Theory", fac: "Dr. P. N.", slot: "C", room: "TP307", hrs: 24, abs: 4 },
  { code: "21CSE356T", title: "Machine Learning", cat: "Theory", fac: "Dr. K. L.", slot: "D", room: "TP402", hrs: 26, abs: 2 },
  { code: "21LEM302T", title: "Critical Thinking", cat: "Theory", fac: "Dr. M. J.", slot: "E", room: "TP306", hrs: 20, abs: 2 },
];
const PORTAL_GRID = "grid grid-cols-[46px_minmax(0,1fr)_32px_34px_20px_30px_16px_16px_28px] gap-x-1 lg:grid-cols-[60px_minmax(0,1fr)_46px_44px_24px_40px_20px_20px_36px]";

const held = PORTAL.reduce((n, r) => n + r.hrs, 0);
const went = PORTAL.reduce((n, r) => n + r.hrs - r.abs, 0);
const overall = predict(went, held, 75);
const worst = PORTAL.reduce((w, r) => ((r.hrs - r.abs) / r.hrs < (w.hrs - w.abs) / w.hrs ? r : w));
const worstPct = ((worst.hrs - worst.abs) / worst.hrs) * 100;
const fix = predict(worst.hrs - worst.abs, worst.hrs, 75);

/**
 * What the table above actually means. Three answers out of nine columns, and
 * the orange goes on the one that is trouble, the way it does in the app.
 */
const ANSWERS = [
  { label: "ATTENDED", note: "Term to date, all six subjects.", figure: overall.percentage.toFixed(1), unit: "%" },
  {
    label: "MUST ATTEND",
    note: `${worst.title} is at ${worstPct.toFixed(1)}%. This many in a row clears 75%.`,
    figure: String(fix.mustAttend),
    unit: "",
    loud: true,
  },
  { label: "NEXT CLASS", note: "Critical Thinking, TP306.", figure: "12:30", unit: "" },
];

/** Where each struck row lands as it falls out of the window. */
const FALL_TILT = [-13, 9, -6, 12, -9, 7, -4];

function What({ nav }: { nav: Nav }) {
  const scope = useEntrance(nav.arrive, (tl, self) => {
    const portal = self.querySelector("[data-portal]");
    const frame = self.querySelector("[data-frame]");
    const rows = self.querySelectorAll("[data-prow]");
    const strikes = self.querySelectorAll("[data-strike]");
    const answers = self.querySelectorAll("[data-answer]");
    if (!portal || !frame || !rows.length || !strikes.length || !answers.length) return;

    // The chapter is RENDERED as its ending, the answers with no portal, so a
    // story that never plays still leaves a readable page. These two sets turn
    // it back to the beginning before the first paint.
    gsap.set(portal, { autoAlpha: 1 });
    gsap.set(answers, { autoAlpha: 0 });

    // The portal loads, a marker goes through every row, the rows drop out of
    // the window, the empty window goes, and the answers are what is left.
    tl.fromTo(frame, { y: 36, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: "expo.out" }, 0.2)
      .fromTo(rows, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "power1.out", stagger: 0.05 }, 0.45)
      .fromTo(strikes, { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: "power2.inOut", stagger: 0.08 }, 1.05)
      .to(
        rows,
        {
          y: (i: number) => 80 + ((i * 41) % 70),
          rotation: (i: number) => FALL_TILT[i % FALL_TILT.length],
          opacity: 0,
          duration: 0.65,
          ease: "power2.in",
          stagger: { each: 0.045, from: "random" },
        },
        1.95,
      )
      .to(frame, { opacity: 0, scale: 0.94, duration: 0.4, ease: "power2.in" }, 2.4)
      .set(portal, { autoAlpha: 0 })
      .fromTo(answers, { autoAlpha: 0, y: 34 }, { autoAlpha: 1, y: 0, duration: 0.85, ease: "expo.out", stagger: 0.12 }, 2.55);
  });

  return (
    <Body
      scope={scope}
      numeral="01"
      head={
        <Head eyebrow="01 · WHAT IT IS" lead="the whole portal," hand="minus the portal.">
          Attendance, marks and your timetable, read from SRM and set out so the
          answer is the first thing you see.
        </Head>
      }
      object={
        <div className="mx-auto grid w-full max-w-[24rem] lg:max-w-[31rem]">
          {/* The portal: decoration, hidden at rest (see above), and shown
              only for as long as the story needs it. */}
          <div data-portal aria-hidden className="invisible self-center [grid-area:1/1]">
            <div data-frame className="rounded-[18px] border-2 px-3 pb-3 pt-2.5" style={{ borderColor: C.line, background: C.card }}>
              <div data-prow className="flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[9.5px] lg:text-[11px]" style={{ background: C.raised, color: C.faint }}>
                <IconLock size={10} />
                <span className="truncate">academia.srmist.edu.in / My_Attendance</span>
              </div>
              <div data-prow className={`${PORTAL_GRID} mt-2.5 px-1 font-mono text-[7px] font-semibold tracking-[0.04em] lg:text-[8.5px]`} style={{ color: C.faint }}>
                {PORTAL_COLS.map((c) => (
                  <span key={c} className="truncate">
                    {c}
                  </span>
                ))}
              </div>
              {PORTAL.map((r, i) => (
                <div
                  key={r.code}
                  data-prow
                  className={`${PORTAL_GRID} relative mt-1 rounded-[4px] px-1 py-[3px] font-mono text-[8px] leading-tight lg:text-[9.5px]`}
                  style={{ color: C.dim, background: i % 2 ? "transparent" : C.raised }}
                >
                  {[r.code, r.title, r.cat, r.fac, r.slot, r.room, r.hrs, r.abs, (((r.hrs - r.abs) / r.hrs) * 100).toFixed(2)].map((v, k) => (
                    <span key={k} className="truncate">
                      {v}
                    </span>
                  ))}
                  <span
                    data-strike
                    className="absolute inset-x-0 top-[calc(50%-1.5px)] h-[3px] origin-left rounded-full"
                    style={{ background: C.accent, rotate: `${FALL_TILT[i] / 10}deg` }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="[grid-area:1/1]">
            {ANSWERS.map((a, i) => (
              <div
                key={a.label}
                data-answer
                className={`flex items-end justify-between gap-4 py-3.5 short:py-2.5 lg:py-5 ${i ? "border-t-2" : "pt-0 short:pt-0 lg:pt-0"}`}
                // Each row is painted, not the column: on a laptop the outlined
                // numeral and the dots stand behind this column and ran through
                // the figures. The column itself stays clear, because it sits
                // above the portal and would black it out mid story.
                style={{ borderColor: C.line, background: C.ground }}
              >
                <div className="min-w-0 pb-1">
                  <p className="font-mono text-[10px] font-semibold tracking-[0.14em] lg:text-[11px]" style={{ color: a.loud ? C.accent : C.faint }}>
                    {a.label}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-snug lg:text-[15px]" style={{ color: C.dim }}>
                    {a.note}
                  </p>
                </div>
                <p
                  className="tnum shrink-0 text-[52px] font-extrabold leading-[0.9] tracking-[-0.05em] short:text-[42px] lg:text-[72px]"
                  style={{ fontFamily: DISPLAY, color: a.loud ? C.accent : C.text }}
                >
                  {a.figure}
                  {a.unit && (
                    <span className="text-[0.42em] tracking-[-0.02em]" style={{ opacity: 0.55 }}>
                      {a.unit}
                    </span>
                  )}
                </p>
              </div>
            ))}
            <p data-answer className="pt-2 font-mono text-[10px] font-semibold tracking-[0.14em] lg:text-[11px]" style={{ color: C.faint, background: C.ground }}>
              NINE COLUMNS IN, THREE ANSWERS OUT
            </p>
          </div>
        </div>
      }
    />
  );
}

/* ---------------------------------------------------- 02 · your password */

const CIPHER = "x7Qe9#vL2kZ";
const SCRAMBLE = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789#$%&*";

function Password({ nav }: { nav: Nav }) {
  const scope = useEntrance(nav.arrive, (tl, self) => {
    const field = self.querySelector<HTMLElement>("[data-cipher]");
    const lock = self.querySelector("[data-lock]");
    const packet = self.querySelector("[data-packet]");
    const rail = self.querySelector<HTMLElement>("[data-rail]");
    const stops = self.querySelectorAll("[data-stop]");
    if (stops.length) {
      tl.fromTo(stops, { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.6, ease: "expo.out", stagger: 0.12 }, 0.45);
    }
    // The password is encrypted on the phone before it goes anywhere: the dots
    // scramble, then settle into ciphertext, then the lock closes.
    if (field) {
      const dots = field.textContent ?? "";
      const o = { p: 0 };
      tl.to(
        o,
        {
          p: 1,
          duration: 0.9,
          ease: "power1.inOut",
          onUpdate: () => {
            const settled = Math.floor(o.p * CIPHER.length);
            let s = CIPHER.slice(0, settled);
            for (let i = settled; i < CIPHER.length; i++) {
              s += SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)];
            }
            field.textContent = s;
          },
        },
        0.95,
      );
      if (lock) tl.fromTo(lock, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: "back.out(2.6)" }, 1.75);
      // The route, on a slow loop: one request, down to the portal and gone.
      if (packet && rail) {
        const run = gsap.timeline({ repeat: -1, repeatDelay: 1.1, delay: arrivalEnd(nav.arrive) });
        run
          .fromTo(packet, { y: 0, opacity: 0 }, { opacity: 1, duration: 0.2 }, 0)
          .to(packet, { y: rail.offsetHeight - 10, duration: 1.7, ease: "power1.inOut" }, 0)
          .to(packet, { opacity: 0, duration: 0.25 }, 1.55);
      }
      // A revert restores styles, never text, so the dots go back by hand.
      return () => {
        field.textContent = dots;
      };
    }
  });

  const stops = [
    { Icon: IconPhone, title: "THIS PHONE", text: "Encrypted with a key that cannot be read back out, not even by Skipp." },
    { Icon: IconServer, title: "SKIPP'S SERVER", text: "Holds it for one request to sign you in, then forgets it. Nothing written down.", dashed: true },
    { Icon: IconPortal, title: "SRM PORTAL", text: "Where you actually sign in. The only place your password is checked." },
  ];

  return (
    <Body
      scope={scope}
      numeral="02"
      head={
        <Head eyebrow="02 · YOUR PASSWORD" lead="your password" hand="stays yours.">
          No accounts and no database. This is exactly where it goes, and how
          long it stays there.
        </Head>
      }
      object={
        <div data-f className="mx-auto w-full max-w-[24rem] lg:max-w-[28rem]">
          <Receipt label="WHERE IT GOES" aside="ONE REQUEST">
            <div className="p-4 short:p-3">
              <div className="flex items-center gap-3 rounded-[14px] px-4 py-3" style={{ background: C.raised }}>
                <span className="font-mono text-[10px] font-semibold tracking-[0.14em]" style={{ color: C.faint }}>
                  PASSWORD
                </span>
                <span data-cipher className="tnum min-w-0 flex-1 truncate text-right font-mono text-[15px] tracking-[0.12em]">
                  •••••••••••
                </span>
                <span data-lock className="grid size-7 shrink-0 place-items-center rounded-full" style={{ background: C.accent, color: C.onAccent }}>
                  <IconLock size={14} />
                </span>
              </div>
              <ol className="relative mt-4 flex flex-col gap-3.5 short:gap-2.5">
                <span data-rail aria-hidden className="absolute bottom-5 left-[19px] top-5 w-[2px]" style={{ background: C.line }}>
                  <span data-packet className="absolute -left-[4px] top-0 size-[10px] rounded-full opacity-0" style={{ background: C.accent, boxShadow: `0 0 12px ${C.accent}` }} />
                </span>
                {stops.map(({ Icon, title, text, dashed }) => (
                  <li key={title} data-stop className="relative flex gap-3.5">
                    <span
                      className="grid size-10 shrink-0 place-items-center rounded-full"
                      style={{ background: C.card, color: C.text, border: `2px ${dashed ? "dashed" : "solid"} ${C.line}` }}
                    >
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0 pt-0.5">
                      <span className="block font-mono text-[10.5px] font-semibold tracking-[0.14em]">{title}</span>
                      <span className="mt-1 block text-[13.5px] leading-snug" style={{ color: C.dim }}>
                        {text}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="border-t-2 px-4 py-2.5 text-center font-mono text-[10px] font-semibold tracking-[0.14em]" style={{ borderColor: C.line, color: C.accent }}>
              NO ACCOUNT · NO DATABASE · NO LOGS
            </div>
          </Receipt>
        </div>
      }
    />
  );
}

/** When a chapter's entrance has finished, for loops that start after it. */
function arrivalEnd(arrive: number): number {
  return arrive + 2.1;
}

/* ------------------------------------------------------- 03 · who made it */

/** A barcode that is the same every time: it is a drawing, not a code. */
const BARS = [2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 1, 3, 2, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 3, 2, 1, 2, 3];

function Maker({ nav }: { nav: Nav }) {
  const links = creatorLinks();
  const [first, ...rest] = CREATOR.name.split(" ");

  const scope = useEntrance(nav.arrive, (tl, self) => {
    const swing = self.querySelector("[data-swing]");
    if (!swing) return;
    // Dropped in from above on its lanyard, then it swings and settles from
    // the strap, the way a card on a lanyard actually comes to rest.
    tl.fromTo(swing, { y: -260, rotation: -18 }, { y: 0, duration: 0.7, ease: "power3.out" }, 0.15).fromTo(
      swing,
      { rotation: -18 },
      { rotation: 0, duration: 1.8, ease: "elastic.out(1, 0.32)" },
      0.3,
    );
    const sway = gsap.to(swing, {
      rotation: 1.4,
      duration: 2.6,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
      delay: arrivalEnd(nav.arrive),
      immediateRender: false,
    });
    return () => {
      sway.kill();
    };
  });

  return (
    <Body
      scope={scope}
      numeral="03"
      head={
        <Head eyebrow="03 · THE DEV" lead="who made" hand="this?">
          One student, not a company. Worth knowing before you hand anything
          your password.
        </Head>
      }
      object={
        <div className="mx-auto flex w-full max-w-[21rem] flex-col items-center lg:max-w-[23rem]">
          <div data-swing className="flex w-full flex-col items-center" style={{ transformOrigin: "50% 0%" }}>
            <div
              aria-hidden
              className="relative -mt-6 flex h-[78px] w-[30px] justify-center overflow-hidden short:h-[40px]"
              // Faded at the top so the strap hangs from somewhere out of
              // frame, rather than starting at a hard edge in mid air.
              style={{
                background: C.accent,
                maskImage: "linear-gradient(to bottom, transparent, black 45%)",
                WebkitMaskImage: "linear-gradient(to bottom, transparent, black 45%)",
              }}
            >
              <span
                className="whitespace-nowrap font-mono text-[9px] font-bold tracking-[0.32em] [writing-mode:vertical-rl]"
                style={{ color: C.onAccent }}
              >
                SKIPP · SKIPP · SKIPP · SKIPP
              </span>
            </div>
            <div aria-hidden className="h-[16px] w-[44px] rounded-[6px]" style={{ background: "linear-gradient(#cfcac0, #8d887f)" }} />
            <div
              className="relative mt-1.5 w-full overflow-hidden rounded-[22px] px-5 pb-5 pt-6 short:pb-4 short:pt-5"
              style={{ background: C.paper, color: C.onPaper, boxShadow: "0 40px 70px -34px rgba(0,0,0,0.95)" }}
            >
              <span aria-hidden className="absolute left-1/2 top-2.5 h-[7px] w-[44px] -translate-x-1/2 rounded-full" style={{ background: "#d8d2c5" }} />
              <div className="flex items-center justify-between">
                <span className="text-[22px] font-extrabold leading-none tracking-[-0.06em]" style={{ fontFamily: DISPLAY }}>
                  skip<span style={{ color: C.accent }}>p</span>
                </span>
                <span className="font-mono text-[10px] font-bold tracking-[0.16em]" style={{ color: "#6b655b" }}>
                  THE DEV
                </span>
              </div>
              <div aria-hidden className="mt-3 h-[6px] rounded-full" style={{ background: C.accent }} />
              <div className="mt-4 flex gap-4">
                <span className="grid size-[84px] shrink-0 place-items-center rounded-[16px]" style={{ background: C.accent }}>
                  <ProfileFace seed={CREATOR.name} size={66} tile="bg-[#140700] text-[#f2661c]" cut="#140700" />
                </span>
                <div className="min-w-0">
                  <p className="text-[25px] font-extrabold leading-[0.95] tracking-[-0.04em]" style={{ fontFamily: DISPLAY }}>
                    {first}
                  </p>
                  <p className="text-[17px] font-extrabold leading-tight tracking-[-0.03em]" style={{ fontFamily: DISPLAY }}>
                    {rest.join(" ")}
                  </p>
                  <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-[10.5px] font-semibold tracking-[0.06em]">
                    <dt style={{ color: "#857f72" }}>DEPT</dt>
                    <dd>CSE</dd>
                    <dt style={{ color: "#857f72" }}>CAMPUS</dt>
                    <dd>SRM</dd>
                    <dt style={{ color: "#857f72" }}>ROLE</dt>
                    <dd>built skipp</dd>
                  </dl>
                </div>
              </div>
              <div className="mt-4 flex items-end justify-between gap-3 short:mt-3">
                <div aria-hidden className="flex h-[34px] items-stretch gap-[2px]">
                  {BARS.map((w, i) => (
                    <span key={i} style={{ width: w, background: i % 3 === 2 ? "transparent" : C.onPaper }} />
                  ))}
                </div>
                <span className="-rotate-6 font-hand text-[26px] font-bold leading-none">{first.toLowerCase()}</span>
              </div>
            </div>
          </div>
          {links.length > 0 && (
            <div data-f className="mt-6 grid w-full gap-2 short:mt-4" style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}>
              {links.map((l) => {
                const Icon = CREATOR_ICONS[l.kind];
                return (
                  <a
                    key={l.kind}
                    href={l.url}
                    target="_blank"
                    // `noreferrer` is deliberately absent: LinkedIn answers
                    // referrer-less traffic with a sign-up wall.
                    rel="noopener"
                    className="flex h-12 min-w-0 items-center justify-center gap-2 rounded-full px-2 text-[13.5px] font-semibold transition-colors hover:bg-[#1c1915]"
                    style={{ boxShadow: `inset 0 0 0 2px ${C.line}` }}
                  >
                    <Icon size={16} />
                    <span className="truncate">{LINK_NAMES[l.kind]}</span>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      }
    />
  );
}

/* --------------------------------------------------------- 04 · your look */

/** In the order they are offered everywhere, then the default. */
const LOOKS = [
  { id: "ticket", src: ticketHome, screen: "#f6f3ec" },
  { id: "brutal", src: brutalHome, screen: "#fdf6e3" },
  { id: "terminal", src: terminalHome, screen: "#040705" },
  { id: "register", src: registerHome, screen: "#eefafc" },
  { id: "clay", src: clayHome, screen: "#eceefa" },
  { id: "stone", src: stoneHome, screen: "#32322e" },
  { id: "ink", src: inkHome, screen: "#000000" },
] as const satisfies readonly { id: Theme; src: unknown; screen: string }[];

const MORE = THEMES.filter((t) => !t.structural && t.id !== "ink").length;

function Look({ nav }: { nav: Nav }) {
  const theme = useTheme();
  const shown = LOOKS.find((l) => l.id === theme) ?? LOOKS[LOOKS.length - 1];

  const scope = useEntrance(nav.arrive, (tl, self) => {
    const phone = self.querySelector("[data-phone]");
    if (phone) {
      tl.fromTo(phone, { y: 90, rotation: 6, opacity: 0 }, { y: 0, rotation: 0, opacity: 1, duration: 1.05, ease: "back.out(1.3)" }, 0.2);
    }
    const chips = self.querySelectorAll("[data-chip-look]");
    if (chips.length) {
      tl.fromTo(chips, { opacity: 0, x: 18 }, { opacity: 1, x: 0, duration: 0.55, ease: "expo.out", stagger: 0.05 }, 0.4);
    }
  });

  return (
    <Body
      scope={scope}
      numeral="04"
      head={
        <Head eyebrow="04 · YOUR LOOK" lead="now make it" hand="yours.">
          Six looks rebuild the whole app, and {MORE} more colours wait in
          Profile. Tap one to try it on.
        </Head>
      }
      object={
        <div className="mx-auto flex w-full max-w-[24rem] items-center gap-4 lg:max-w-[30rem] lg:gap-8">
          <div data-phone className="w-[46%] max-w-[176px] shrink-0 lg:max-w-[230px]">
            <PhoneFrame screen={shown.screen}>
              {LOOKS.map((l) => {
                const name = THEMES.find((t) => t.id === l.id)?.name ?? l.id;
                return (
                  <Shot
                    key={l.id}
                    src={l.src}
                    alt={`Skipp in the ${name} look`}
                    className="transition-opacity duration-500"
                    style={{ opacity: l.id === shown.id ? 1 : 0 }}
                  />
                );
              })}
            </PhoneFrame>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 short:gap-1">
            {LOOKS.map((l) => {
              const info = THEMES.find((t) => t.id === l.id);
              const on = l.id === shown.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  data-chip-look
                  aria-pressed={on}
                  onClick={() => {
                    haptic("select");
                    setTheme(l.id);
                  }}
                  className="flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-full px-4 text-left transition-[background-color,color,box-shadow] duration-300"
                  style={
                    on
                      ? { background: C.paper, color: C.onPaper }
                      : // Filled, not clear: the chapter's numeral stands behind
                        // this column, and its outline ran through clear chips.
                        { background: C.ground, color: C.text, boxShadow: `inset 0 0 0 2px ${C.line}` }
                  }
                >
                  <span className="min-w-0 truncate text-[14.5px] font-semibold">
                    {info?.name}
                    {l.id === "ink" && (
                      <span className="font-normal" style={{ opacity: 0.6 }}>
                        {" "}
                        default
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 gap-1" aria-hidden>
                    {info?.swatch.map((sw, k) => (
                      <span
                        key={k}
                        className="size-2.5 rounded-full"
                        // The ring flips with the chip, or a cream swatch on
                        // the selected (cream) chip has no edge at all.
                        style={{ background: sw, boxShadow: `0 0 0 1px ${on ? "rgba(11,10,8,0.28)" : "rgba(255,255,255,0.12)"}` }}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      }
    />
  );
}
