"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useLockScroll } from "@/components/ui/Overlay";
import { IconInstagram, IconLinkedIn, IconUndo } from "@/components/Icons";
import RollingNumber from "@/components/onboarding/RollingNumber";
import { haptic } from "@/lib/haptics";
import { prefersReducedMotion, useGsap } from "@/lib/motion";
import { predict } from "@/lib/predictor";
import { setTheme, THEMES, useTheme, type Theme } from "@/lib/theme";
import { CREATOR, creatorLinks } from "@/lib/creator";
import RoomFrame from "./RoomFrame";
import Rise from "./Rise";
import { ROOMS, type Room, type RoomId } from "./rooms";
import { usePaintChrome } from "./chrome";

/**
 * THE TOUR.
 *
 * Six chapters, and every one of them is set in a different look: Ink, Brutal,
 * Ticket, then YOUR look, then Terminal and Arcade. The tour is the showcase,
 * so the theme chapter is not a list of names, it is the fifth room you have
 * stood in. Chosen with the user as "C, the rooms" over two other directions
 * (2026-10-27); it replaced the spiral notebook.
 *
 * What each chapter teaches is unchanged from the notebook: what Skipp is, what
 * it does, the line (a live skip demo on the app's own arithmetic), choosing a
 * look, who made it, and that the only thing it asks for is a Net ID.
 *
 * **A chapter opens through a circle grown from the button that was pressed**,
 * in the next room's colour, so moving on reads as walking into the next room
 * rather than as a slide. Both chapters are mounted for the length of the wipe
 * (the old one underneath, inert), which is the only way to show one room
 * opening over another with React holding a single tree. Reduced motion keeps
 * the change and loses the movement: the new room dissolves in, it never cuts.
 *
 * Every chapter's headline rises a letter at a time from under its own line,
 * then the rest lifts in, then the chapter's own object does its own thing:
 * cards are dealt, blocks slam down, the pass drops in, the terminal types.
 * Nothing is hidden in CSS first, so a reveal that never runs leaves a readable
 * page behind it.
 */

const CHAPTERS = [
  { id: "hello", room: "ink" },
  { id: "does", room: "brutal" },
  { id: "line", room: "ticket" },
  { id: "look", room: "look" },
  { id: "who", room: "terminal" },
  { id: "ready", room: "arcade" },
] as const satisfies readonly { id: string; room: RoomId }[];

const TOTAL = CHAPTERS.length;

/** The skip demo's subject. The same numbers the hero's phones show. */
const ATTENDED = 25;
const HELD = 28;
/** Punches on the pass: the margin before any skip. */
const SLOTS = predict(ATTENDED, HELD, 75).canSkip;
const MAX_SKIPS = 7;

type Nav = {
  step: number;
  arrive: number;
  onBack: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onNext: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onSkip: () => void;
};

export default function Tour({ onDone }: { onDone: () => void }) {
  const [c, setC] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [picked, setPicked] = useState<Theme | null>(null);
  const theme = useTheme();
  const top = useRef<HTMLDivElement>(null);
  const origin = useRef({ x: 0, y: 0 });
  const busy = useRef(false);

  useLockScroll(true);
  const roomId: RoomId = CHAPTERS[c].room;
  usePaintChrome(
    ROOMS[roomId].bg,
    roomId === "look"
      ? (THEMES.find((t) => t.id === theme)?.bar ?? "#000000")
      : ROOMS[roomId].bar,
  );

  const finish = useCallback(() => {
    haptic("commit");
    onDone();
  }, [onDone]);

  const go = useCallback(
    (n: number, from?: Element | null) => {
      const next = Math.max(0, Math.min(TOTAL - 1, n));
      if (next === c || busy.current) return;
      const r = from?.getBoundingClientRect();
      origin.current = r
        ? { x: r.left + r.width / 2, y: r.top + r.height / 2 }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      busy.current = true;
      haptic("tick");
      setPrev(c);
      setC(next);
    },
    [c],
  );

  // The wipe. Runs once per chapter change, on the chapter that just mounted.
  useLayoutEffect(() => {
    if (prev === null) return;
    const el = top.current;
    if (!el) return;
    const done = () => {
      busy.current = false;
      setPrev(null);
    };
    if (prefersReducedMotion()) {
      const t = gsap.fromTo(
        el,
        { opacity: 0 },
        { opacity: 1, duration: 0.34, ease: "power1.out", onComplete: done },
      );
      return () => {
        t.kill();
      };
    }
    const { x, y } = origin.current;
    const r =
      Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      ) + 24;
    const t = gsap.fromTo(
      el,
      { clipPath: `circle(0px at ${x}px ${y}px)` },
      {
        clipPath: `circle(${r}px at ${x}px ${y}px)`,
        duration: 0.85,
        ease: "expo.inOut",
        onComplete: () => {
          gsap.set(el, { clearProps: "clipPath" });
          done();
        },
      },
    );
    return () => {
      t.kill();
    };
  }, [prev, c]);

  // Arrow keys on a laptop. The buttons are the control; this is a shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && c < TOTAL - 1) go(c + 1);
      if (e.key === "ArrowLeft") go(c - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [c, go]);

  const chapter = (i: number) => {
    const nav: Nav = {
      step: i + 1,
      arrive: prev !== null ? 0.3 : 0.12,
      onBack: (e) => go(i - 1, e.currentTarget),
      onNext: (e) => go(i + 1, e.currentTarget),
      onSkip: finish,
    };
    switch (CHAPTERS[i].id) {
      case "hello":
        return <Hello nav={nav} />;
      case "does":
        return <Does nav={nav} />;
      case "line":
        return (
          <TheLine
            nav={nav}
            skipped={skipped}
            onSkip={() => {
              haptic("select");
              setSkipped((n) => Math.min(MAX_SKIPS, n + 1));
            }}
            onUndo={() => {
              haptic("tick");
              setSkipped((n) => Math.max(0, n - 1));
            }}
          />
        );
      case "look":
        return (
          <Look
            nav={nav}
            current={picked ?? theme}
            onPick={(t) => {
              haptic("select");
              setPicked(t);
              setTheme(t);
            }}
          />
        );
      case "who":
        return <Who nav={nav} />;
      case "ready":
        return <Ready nav={nav} picked={picked} onStart={finish} />;
    }
  };

  return (
    <div className="fixed inset-0 z-40 overflow-hidden font-sans">
      <FontWarmer />
      {prev !== null && (
        <div key={`ch-${prev}`} aria-hidden inert className="pointer-events-none absolute inset-0">
          {chapter(prev)}
        </div>
      )}
      <div ref={top} key={`ch-${c}`} className="absolute inset-0">
        {chapter(c)}
      </div>
    </div>
  );
}

/**
 * Three of the rooms are set in faces that are `preload: false`, because the
 * app itself only needs them in one theme each. Naming them here as the tour
 * opens starts the downloads while the reader is still in the first room, so
 * the Ticket and Arcade chapters do not open in a fallback face.
 */
function FontWarmer() {
  return (
    <div aria-hidden className="pointer-events-none absolute -left-[9999px] top-0 opacity-0">
      <span style={{ fontFamily: ROOMS.ticket.head, fontWeight: 700 }}>skip</span>
      <span style={{ fontFamily: ROOMS.arcade.head }}>ready</span>
      <span className="font-hand font-bold">look</span>
    </div>
  );
}

/** The shared entrance: the headline rises, then the rest lifts in. */
function useEntrance(
  arrive: number,
  extra?: (tl: gsap.core.Timeline, self: HTMLElement) => void | (() => void),
) {
  return useGsap(({ self, reduced }) => {
    if (reduced) return;
    const tl = gsap.timeline({ delay: arrive });
    const chars = self.querySelectorAll("[data-char]");
    const fades = self.querySelectorAll("[data-f]");
    if (chars.length) {
      tl.fromTo(
        chars,
        { yPercent: 120 },
        { yPercent: 0, duration: 0.95, ease: "expo.out", stagger: 0.016 },
        0,
      );
    }
    if (fades.length) {
      tl.fromTo(
        fades,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.7, ease: "expo.out", stagger: 0.07 },
        0.25,
      );
    }
    return extra?.(tl, self);
  }, []);
}

function Eyebrow({ room, children }: { room: Room; children: React.ReactNode }) {
  return (
    <p
      data-f
      className="font-mono text-[11px] font-semibold tracking-[0.16em]"
      style={{ color: room.faint }}
    >
      {children}
    </p>
  );
}

/* ------------------------------------------------------- 01 · Ink · hello */

function Hello({ nav }: { nav: Nav }) {
  const room = ROOMS.ink;
  const scope = useEntrance(nav.arrive, (tl, self) => {
    const cards = self.querySelectorAll("[data-deal]");
    if (cards.length) {
      tl.fromTo(
        cards,
        { y: 140, rotation: (i: number) => [-14, 11, -8][i] ?? 0, opacity: 0 },
        { y: 0, rotation: 0, opacity: 1, duration: 1.05, ease: "back.out(1.3)", stagger: 0.12 },
        0.15,
      );
    }
    const fill = self.querySelector("[data-fill]");
    if (fill) {
      tl.fromTo(
        fill,
        { scaleX: 0 },
        { scaleX: 1, duration: 1.2, ease: "expo.out", transformOrigin: "left center" },
        0.9,
      );
    }
  });

  const card = (header: string, aside: string, body: React.ReactNode, tilt: number, z: number) => (
    <div data-deal className="relative" style={{ zIndex: z }}>
      <div
        className="overflow-hidden rounded-[24px] border-2"
        style={{
          transform: `rotate(${tilt}deg)`,
          borderColor: room.line,
          background: "#0a0a0a",
          boxShadow: "0 24px 40px -24px rgba(0,0,0,0.9)",
        }}
      >
        <div
          className="flex items-center justify-between border-b-2 px-[18px] py-3 font-mono short:py-2 text-[11px] font-semibold tracking-[0.14em]"
          style={{ borderColor: room.line, color: room.faint }}
        >
          <span>{header}</span>
          <span>{aside}</span>
        </div>
        <div className="px-[18px] pb-[18px] pt-3.5 short:pb-3 short:pt-2.5">{body}</div>
      </div>
    </div>
  );

  return (
    <div ref={scope} className="absolute inset-0">
      <RoomFrame
        room={room}
        step={nav.step}
        total={TOTAL}
        onSkip={nav.onSkip}
        onBack={nav.onBack}
        primary={{ label: "next", onClick: nav.onNext }}
        head={
          <>
            <Eyebrow room={room}>SKIPP · WHAT IT IS</Eyebrow>
            <Rise
              text="the whole portal,"
              className="mt-4 text-[42px] font-extrabold leading-[0.92] tracking-[-0.05em] short:text-[36px] lg:text-[76px]"
              style={{ fontFamily: room.head }}
            />
            <Rise
              text="minus the portal."
              className="font-hand text-[48px] font-bold leading-none short:text-[42px] lg:text-[84px]"
              style={{ color: room.accentText }}
            />
            <p data-f className="mt-5 max-w-[30rem] text-[16px] leading-[1.5] short:hidden lg:text-[18px]" style={{ color: room.dim }}>
              Attendance, marks and your timetable, read from SRM and laid out so
              the answer is the first thing you see.
            </p>
          </>
        }
        object={
          <div className="mx-auto flex w-full max-w-[22rem] flex-col lg:max-w-[26rem]">
            {card(
              "ATTENDANCE",
              "TERM TO DATE",
              <>
                <p className="tnum text-[40px] font-extrabold leading-none tracking-[-0.04em] short:text-[32px]">
                  87.4<span className="text-[22px]" style={{ color: room.faint }}>%</span>
                </p>
                <div className="relative mt-4 h-[3px]" style={{ background: room.line }}>
                  <span data-fill className="absolute inset-y-0 left-0 w-[87.4%]" style={{ background: room.ink }} />
                  <span className="absolute -top-[5px] left-[75%] h-[13px] w-[2px]" style={{ background: room.faint }} />
                </div>
                <p className="mt-3 text-[13px]" style={{ color: room.dim }}>
                  198 of 232 attended, 32 to spare
                </p>
              </>,
              -2,
              1,
            )}
            <div className="-mt-3">
              {card(
                "TODAY",
                "DAY ORDER 1",
                <>
                  <p className="tnum text-[40px] font-extrabold leading-none tracking-[-0.04em] short:text-[32px]">12:30</p>
                  <p className="mt-2 text-[13px]" style={{ color: room.dim }}>
                    Critical Thinking, TP306, in 42 min
                  </p>
                </>,
                1.5,
                2,
              )}
            </div>
            <div className="-mt-3">
              {card(
                "MARKS",
                "INTERNALS",
                <>
                  <p className="tnum text-[40px] font-extrabold leading-none tracking-[-0.04em] short:text-[32px]">
                    174<span className="text-[22px]" style={{ color: room.faint }}>/240</span>
                  </p>
                  <p className="mt-2 text-[13px]" style={{ color: room.dim }}>
                    and the grade each subject is on track for
                  </p>
                </>,
                -1,
                3,
              )}
            </div>
          </div>
        }
      />
    </div>
  );
}

/* ---------------------------------------------------- 02 · Brutal · the lot */

const LOT = [
  ["01", "attendance", "and how many you can still miss"],
  ["02", "leave planner", "see the damage before you book"],
  ["03", "marks", "and the grade you are on track for"],
  ["04", "timetable", "by day order, the way SRM runs"],
] as const;

function Does({ nav }: { nav: Nav }) {
  const room = ROOMS.brutal;
  const scope = useEntrance(nav.arrive, (tl, self) => {
    const tape = self.querySelector("[data-tape]");
    if (tape) {
      tl.fromTo(
        tape,
        { scale: 1.35, opacity: 0, boxShadow: "0px 0px 0 #000" },
        { scale: 1, opacity: 1, boxShadow: "6px 6px 0 #000", duration: 0.55, ease: "back.out(2.4)" },
        0.05,
      );
    }
    const blocks = self.querySelectorAll("[data-slam]");
    if (blocks.length) {
      tl.fromTo(
        blocks,
        {
          scale: 1.12,
          opacity: 0,
          rotation: (i: number) => [-3, 2.5, -2, 3][i] ?? 0,
          boxShadow: "0px 0px 0 #000",
        },
        {
          scale: 1,
          opacity: 1,
          rotation: 0,
          boxShadow: "5px 5px 0 #000",
          duration: 0.5,
          ease: "back.out(2.2)",
          stagger: 0.09,
        },
        0.35,
      );
    }
  });

  return (
    <div ref={scope} className="absolute inset-0">
      <RoomFrame
        room={room}
        step={nav.step}
        total={TOTAL}
        onSkip={nav.onSkip}
        onBack={nav.onBack}
        primary={{ label: "next", onClick: nav.onNext }}
        head={
          <>
            <Eyebrow room={room}>THE LOT · IN BRUTAL</Eyebrow>
            <div className="mt-4 inline-block -rotate-2">
              <div
                data-tape
                className="border-[3px] px-5 pb-2 pt-0.5 font-hand text-[58px] font-bold leading-none text-white short:text-[46px] lg:text-[92px]"
                style={{ background: room.accent, borderColor: room.line, boxShadow: "6px 6px 0 #000" }}
              >
                the lot.
              </div>
            </div>
            <Rise
              text="everything you open the portal for."
              className="mt-5 max-w-[16ch] text-[28px] font-extrabold leading-[0.98] tracking-[-0.04em] short:mt-4 short:text-[24px] lg:mt-6 lg:text-[46px]"
              style={{ fontFamily: room.head }}
            />
            {/* Laptop only: on a phone the four blocks say it, and the room
                has to fit one screen. */}
            <p data-f className="mt-4 hidden max-w-[28rem] text-[18px] leading-[1.5] lg:block" style={{ color: room.dim }}>
              Four things, each one tap from home, none of them behind a loading
              spinner.
            </p>
          </>
        }
        object={
          <div className="grid gap-3.5 short:gap-2.5 sm:grid-cols-2 lg:gap-5">
            {LOT.map(([n, t, d]) => (
              <div
                key={n}
                data-slam
                className="flex items-center gap-3.5 border-[3px] bg-white px-4 py-3.5 short:py-2.5 lg:items-start lg:py-4"
                style={{ borderColor: room.line, boxShadow: "5px 5px 0 #000" }}
              >
                <span
                  className="grid size-9 shrink-0 place-items-center font-mono text-[13px] font-bold"
                  style={{ background: room.line, color: room.bg }}
                >
                  {n}
                </span>
                <span className="min-w-0">
                  <span className="block text-[18px] font-extrabold leading-tight tracking-[-0.02em] lg:text-[19px]">{t}</span>
                  <span className="mt-0.5 block text-[14px] leading-snug" style={{ color: room.dim }}>
                    {d}
                  </span>
                </span>
              </div>
            ))}
          </div>
        }
      />
    </div>
  );
}

/* ---------------------------------------------- 03 · Ticket · the bunk pass */

function TheLine({
  nav,
  skipped,
  onSkip,
  onUndo,
}: {
  nav: Nav;
  skipped: number;
  onSkip: () => void;
  onUndo: () => void;
}) {
  const room = ROOMS.ticket;
  // The app's own arithmetic, so the tour can never quote a margin the
  // attendance screen would disagree with.
  const p = predict(ATTENDED, HELD + skipped, 75);
  const below = !p.isSafe;
  const punched = Math.min(skipped, SLOTS);
  const stamp = below ? "VOID" : p.canSkip === 0 ? "LAST ONE" : null;

  let message: string;
  if (below) message = `Pass void. Attend ${p.mustAttend} in a row and it is valid again.`;
  else if (p.canSkip === 0) message = "Every hole punched. One more skip and the pass is void.";
  else if (p.canSkip === 1) message = "One skip left on this pass. Spend it wisely.";
  else if (skipped === 0)
    message = `Your margin is a pass you can spend. ${p.canSkip} skips left in Computer Networks. Go on, punch one.`;
  else message = `${p.canSkip} left. That is the whole idea: you always know.`;

  const scope = useEntrance(nav.arrive, (tl, self) => {
    const pass = self.querySelector("[data-pass]");
    if (pass) {
      tl.fromTo(
        pass,
        { y: -60, rotation: -7, opacity: 0 },
        { y: 0, rotation: 0, opacity: 1, duration: 0.95, ease: "back.out(1.4)" },
        0.2,
      );
    }
  });

  // A punch, and the stamp. Only on a change after arrival, never on mount.
  const seen = useRef(skipped);
  const root = scope;
  useLayoutEffect(() => {
    const was = seen.current;
    seen.current = skipped;
    const self = root.current;
    if (!self || was === skipped || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      if (skipped > was) {
        gsap.fromTo("[data-shake]", { x: -6 }, { x: 0, duration: 0.5, ease: "elastic.out(1, 0.35)" });
        const slot = self.querySelector(`[data-slot="${skipped - 1}"]`);
        if (slot) gsap.fromTo(slot, { scale: 0.4 }, { scale: 1, duration: 0.45, ease: "back.out(3)" });
      }
      const s = self.querySelector("[data-stamp]");
      if (s) {
        gsap.fromTo(
          s,
          { scale: 1.9, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.45, ease: "back.out(1.8)" },
        );
      }
    }, self);
    return () => ctx.revert();
  }, [skipped, root]);

  const passBg = below ? "#a3162c" : "#141210";
  const notch =
    "radial-gradient(circle 13px at 76% 0, #0000 96%, #000) top / 100% 51% no-repeat, radial-gradient(circle 13px at 76% 100%, #0000 96%, #000) bottom / 100% 51% no-repeat";

  return (
    <div ref={scope} className="absolute inset-0">
      <RoomFrame
        room={room}
        step={nav.step}
        total={TOTAL}
        onSkip={nav.onSkip}
        onBack={nav.onBack}
        onNext={nav.onNext}
        primary={{ label: "punch a skip", onClick: onSkip, arrow: false }}
        head={
          <>
            <Eyebrow room={room}>THE LINE · IN TICKET</Eyebrow>
            <Rise
              text="how many can"
              className="mt-4 text-[34px] font-bold leading-[1.02] tracking-[-0.045em] short:text-[30px] lg:text-[52px]"
              style={{ fontFamily: room.head }}
            />
            <Rise
              text="i skip?"
              className="text-[34px] font-bold leading-[1.02] tracking-[-0.045em] short:text-[30px] lg:text-[52px]"
              style={{ fontFamily: room.head, color: room.accentText }}
            />
            <p
              data-f
              aria-live="polite"
              className="mt-4 min-h-[3em] max-w-[28rem] text-[15px] leading-[1.5] lg:text-[17px]"
              style={{ color: room.dim }}
            >
              {message}
            </p>
          </>
        }
        object={
          <div className="mx-auto w-full max-w-[22.5rem] lg:max-w-[27rem]">
            <div data-pass className="relative">
              <div style={{ transform: "rotate(-1.5deg)" }}>
                <div
                  data-shake
                  className="relative flex h-[270px] overflow-hidden rounded-[24px] text-[#f6f3ec] transition-colors duration-500 short:h-[220px] lg:h-[310px]"
                  style={{ background: passBg, WebkitMask: notch, mask: notch }}
                >
                  <div className="flex w-[76%] flex-col py-5 pl-6">
                    <p className="font-mono text-[10.5px] font-bold tracking-[0.14em] opacity-80">
                      BUNK PASS · COMPUTER NETWORKS
                    </p>
                    <span className="mt-4 block" style={{ fontFamily: room.head }}>
                      <RollingNumber
                        value={String(below ? p.mustAttend : p.canSkip)}
                        className="text-[92px] font-bold leading-[0.85] tracking-[-0.06em] short:text-[72px] lg:text-[112px]"
                      />
                    </span>
                    <p className="mt-3 text-[15px] font-semibold">
                      {below ? "classes to attend in a row" : "classes you can skip"}
                    </p>
                    <div className="mt-auto flex gap-2" aria-hidden>
                      {Array.from({ length: SLOTS }, (_, i) => (
                        <span
                          key={i}
                          data-slot={i}
                          className="h-[30px] w-6 rounded-[6px] transition-colors duration-300"
                          style={
                            i < punched
                              ? { background: passBg, boxShadow: "inset 0 0 0 2px rgba(246,243,236,0.55)" }
                              : { background: room.accent }
                          }
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 border-l-[3px] border-dashed border-[rgba(246,243,236,0.45)]">
                    <span className="tnum text-[20px] font-bold tracking-[-0.03em]" style={{ fontFamily: room.head }}>
                      {p.percentage.toFixed(1)}
                      <span className="text-[11px]">%</span>
                    </span>
                    <span className="font-mono text-[9px] font-bold tracking-[0.12em] opacity-80">ATTENDED</span>
                  </div>
                </div>
              </div>
              {stamp && (
                <span
                  key={stamp}
                  data-stamp
                  className="absolute right-[28%] top-[20%] -rotate-[14deg] rounded-[12px] border-[3px] px-3.5 py-2 text-[22px] font-bold tracking-[-0.02em]"
                  style={{
                    fontFamily: room.head,
                    color: below ? "#f6f3ec" : room.accent,
                    borderColor: below ? "#f6f3ec" : room.accent,
                  }}
                >
                  {stamp}
                </span>
              )}
            </div>
            <div data-f className="mt-6 flex items-center justify-between gap-3 short:mt-4">
              <span className="flex items-center gap-2 font-hand text-[24px] font-bold leading-none">
                <svg aria-hidden width="40" height="28" viewBox="0 0 44 30" className="shrink-0">
                  <path
                    d="M40 24 C 28 24, 16 20, 8 8 M6 18 L7 7 L18 8"
                    fill="none"
                    stroke={room.accent}
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                each skip punches a hole
              </span>
              <button
                type="button"
                onClick={onUndo}
                disabled={skipped === 0}
                className="inline-flex min-h-11 shrink-0 items-center gap-1.5 px-1 text-[15px] font-semibold disabled:opacity-30"
              >
                <IconUndo size={18} />
                undo
              </button>
            </div>
          </div>
        }
      />
    </div>
  );
}

/* ------------------------------------------------ 04 · your look · pick one */

/**
 * A real row from the app, drawn in whatever look is applied. It carries the
 * markers the themes hook into (`data-band`, `data-surface`, `data-meter`) and
 * inherits `--font-sans`, so Brutal turns it into a block on a hard offset,
 * Clay into a soft card and Terminal into mono. A swatch tells you the hues; this
 * tells you what the app will feel like.
 */
function ThemePreview() {
  return (
    <div
      className="relative rounded-card border border-line p-4 short:p-3"
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
          <span className="tnum shrink-0 text-headline">89%</span>
        </div>
        <div data-meter className="relative mt-2.5 h-[3px] w-full">
          <span className="absolute inset-0" style={{ background: "var(--color-line)" }} />
          <span className="absolute inset-y-0 left-0" style={{ width: "89%", background: "var(--color-accent)" }} />
          <span
            className="absolute"
            style={{ left: "75%", top: -5, width: 2, height: 13, background: "var(--color-text-1)" }}
          />
        </div>
      </div>
    </div>
  );
}

const LOOKS = THEMES.filter((t) => t.structural);
const COLOURS = THEMES.filter((t) => !t.structural).slice(0, 6);
const MORE_COLOURS = THEMES.filter((t) => !t.structural).length - COLOURS.length;

function Look({
  nav,
  current,
  onPick,
}: {
  nav: Nav;
  current: Theme;
  onPick: (t: Theme) => void;
}) {
  const room = ROOMS.look;
  const scope = useEntrance(nav.arrive);
  const chip = (on: boolean): React.CSSProperties => ({
    background: on ? "var(--color-text-1)" : "transparent",
    color: on ? "var(--color-ink-0)" : "var(--color-text-1)",
    boxShadow: on ? "none" : "inset 0 0 0 2px var(--color-line)",
  });
  return (
    <div ref={scope} className="absolute inset-0">
      <RoomFrame
        room={room}
        step={nav.step}
        total={TOTAL}
        onSkip={nav.onSkip}
        onBack={nav.onBack}
        primary={{ label: "keep this look", onClick: nav.onNext }}
        head={
          <>
            <Eyebrow room={room}>YOUR LOOK · IN WHATEVER YOU PICK</Eyebrow>
            <Rise
              text="now pick"
              className="mt-4 text-[42px] font-extrabold leading-[0.92] tracking-[-0.05em] short:text-[36px] lg:text-[76px]"
              style={{ fontFamily: room.head }}
            />
            <Rise
              text="your own."
              className="font-hand text-[48px] font-bold leading-none short:text-[42px] lg:text-[84px]"
              style={{ color: room.accentText }}
            />
            <p data-f className="mt-5 max-w-[30rem] text-[16px] leading-[1.5] short:hidden lg:text-[18px]" style={{ color: room.dim }}>
              Seven looks rebuild the whole app and fifteen colours repaint it.
              Tap one and this room becomes it.
            </p>
          </>
        }
        object={
          <div data-f className="mx-auto flex w-full max-w-[24rem] flex-col gap-4 short:gap-3 lg:max-w-[28rem]">
            <ThemePreview />
            <div className="grid grid-cols-2 gap-2">
              {LOOKS.map((t) => {
                const on = current === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onPick(t.id)}
                    aria-pressed={on}
                    className="flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-full px-4 transition-[background-color,color,box-shadow] duration-300 [&:last-child:nth-child(odd)]:col-span-2"
                    style={chip(on)}
                  >
                    <span className="min-w-0 truncate text-[15px] font-semibold">{t.name}</span>
                    <span className="flex shrink-0 gap-1" aria-hidden>
                      {t.swatch.map((sw, k) => (
                        <span key={k} className="size-2.5 rounded-full" style={{ background: sw }} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {COLOURS.map((t) => {
                const on = current === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onPick(t.id)}
                    aria-pressed={on}
                    aria-label={t.name}
                    className="grid size-11 shrink-0 place-items-center rounded-full transition-transform duration-300 active:scale-90"
                    style={{ boxShadow: on ? "inset 0 0 0 2px var(--color-text-1)" : "none" }}
                  >
                    <span className="flex size-8 overflow-hidden rounded-full">
                      {t.swatch.map((sw, k) => (
                        <span key={k} className="h-full flex-1" style={{ background: sw }} />
                      ))}
                    </span>
                  </button>
                );
              })}
              <span className="text-[13px]" style={{ color: room.faint }}>
                +{MORE_COLOURS} more in Profile
              </span>
            </div>
          </div>
        }
      />
    </div>
  );
}

/* -------------------------------------------------- 05 · Terminal · the dev */

function Who({ nav }: { nav: Nav }) {
  const room = ROOMS.terminal;
  const links = creatorLinks();
  const name = CREATOR.name.toLowerCase();

  const scope = useEntrance(nav.arrive, (tl, self) => {
    const cmds = Array.from(self.querySelectorAll<HTMLElement>("[data-cmd]"));
    const outs = Array.from(self.querySelectorAll<HTMLElement>("[data-out]"));
    const cursor = self.querySelector("[data-cursor]");
    if (!cmds.length) return;

    // Typed into the text node, so the original has to be put back on the way
    // out: a revert restores styles, never text. Same as Terminal's own title.
    const restore = () => cmds.forEach((c) => (c.textContent = c.dataset.text ?? ""));

    tl.call(() => cmds.forEach((c) => (c.textContent = "")), [], 0.3);
    tl.set(outs, { opacity: 0 }, 0.3);
    let at = 0.5;
    cmds.forEach((c, i) => {
      const text = c.dataset.text ?? "";
      const o = { n: 0 };
      tl.to(
        o,
        {
          n: text.length,
          duration: text.length * 0.045,
          ease: "none",
          onUpdate: () => {
            c.textContent = text.slice(0, Math.round(o.n));
          },
        },
        at,
      );
      at += text.length * 0.045 + 0.15;
      if (outs[i]) tl.to(outs[i], { opacity: 1, duration: 0.2 }, at);
      at += 0.35;
    });
    if (cursor) {
      gsap.to(cursor, { opacity: 0, duration: 0.5, repeat: -1, yoyo: true, ease: "steps(1)" });
    }
    return restore;
  });

  const lines: [string, React.ReactNode][] = [
    ["whoami", name],
    [
      "cat why.txt",
      "third year cse at srm. built skipp because the portal was three taps and a spinner away from every answer.",
    ],
    [
      "cat promise.txt",
      "your own data, read with your own sign in. no account, no server, nothing kept.",
    ],
  ];

  return (
    <div ref={scope} className="absolute inset-0">
      <RoomFrame
        room={room}
        step={nav.step}
        total={TOTAL}
        onSkip={nav.onSkip}
        onBack={nav.onBack}
        primary={{ label: "next", onClick: nav.onNext }}
        head={
          <>
            <Eyebrow room={room}>THE DEV · IN TERMINAL</Eyebrow>
            <Rise
              text="who made"
              className="mt-4 text-[40px] font-bold leading-[0.95] tracking-[-0.04em] lg:text-[68px]"
              style={{ fontFamily: room.head }}
            />
            <Rise
              text="this?"
              className="text-[40px] font-bold leading-[0.95] tracking-[-0.04em] lg:text-[68px]"
              style={{ fontFamily: room.head, color: room.accentText }}
            />
            <p data-f className="mt-5 max-w-[28rem] text-[15px] leading-[1.55] short:hidden lg:text-[17px]" style={{ color: room.dim, fontFamily: room.head }}>
              One student, not a company. Worth knowing before you hand anything
              your password.
            </p>
          </>
        }
        object={
          <div
            data-f
            className="w-full border-[1.5px] text-[13.5px] leading-[1.6] lg:text-[15px]"
            style={{ borderColor: room.line, background: "#0a100c", fontFamily: room.head }}
          >
            <div
              className="flex items-center justify-between border-b-[1.5px] px-4 py-2.5 text-[11px] tracking-[0.12em]"
              style={{ borderColor: room.line, color: room.faint }}
            >
              <span>~/skipp</span>
              <span>zsh</span>
            </div>
            <div className="space-y-3 p-4 short:space-y-2 short:p-3 lg:p-5">
              {lines.map(([cmd, out], i) => (
                // The promise is said again, plainly, in the last room, so a
                // short phone can drop it here and keep the chapter whole.
                <div key={cmd} className={i === 2 ? "short:hidden" : undefined}>
                  <p>
                    <span style={{ color: room.accent }}>$ </span>
                    <span data-cmd data-text={cmd}>
                      {cmd}
                    </span>
                  </p>
                  <p data-out style={{ color: room.dim }}>
                    {out}
                  </p>
                </div>
              ))}
              {links.length > 0 && (
                <div>
                  <p>
                    <span style={{ color: room.accent }}>$ </span>
                    <span data-cmd data-text="ls links/">
                      ls links/
                    </span>
                  </p>
                  <div data-out className="mt-1.5 flex flex-wrap gap-2">
                    {links.map((l) => (
                      <a
                        key={l.kind}
                        href={l.url}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex min-h-11 items-center gap-2 border-[1.5px] px-3 transition-colors hover:bg-[#101a13]"
                        style={{ borderColor: room.line, color: room.ink }}
                      >
                        {l.kind === "linkedin" ? <IconLinkedIn size={15} /> : <IconInstagram size={15} />}
                        {l.kind}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <p>
                <span style={{ color: room.accent }}>$ </span>
                <span
                  data-cursor
                  aria-hidden
                  className="inline-block h-[1.05em] w-[0.6em] align-[-0.15em]"
                  style={{ background: room.accent }}
                />
              </p>
            </div>
          </div>
        }
      />
    </div>
  );
}

/* -------------------------------------------------- 06 · Arcade · ready */

/** The chomper's mouth, as a wedge cut out of a disc. `--m` is its angle. */
const CHOMPER =
  "conic-gradient(from calc(90deg + var(--m) / 2), #ffe600 0 calc(360deg - var(--m)), #0000 0)";

function Ready({
  nav,
  picked,
  onStart,
}: {
  nav: Nav;
  picked: Theme | null;
  onStart: () => void;
}) {
  const room = ROOMS.arcade;
  const look = THEMES.find((t) => t.id === picked)?.name ?? "Ink";
  const DOTS = 9;

  const scope = useEntrance(nav.arrive, (_tl, self) => {
    const chomp = self.querySelector<HTMLElement>("[data-chomp]");
    const dots = Array.from(self.querySelectorAll<HTMLElement>("[data-dot]"));
    const lane = chomp?.parentElement;
    if (!chomp || !lane || !dots.length) return;
    const w = lane.clientWidth;
    gsap.to(chomp, { "--m": "6deg", duration: 0.13, repeat: -1, yoyo: true, ease: "steps(1)" });
    const run = gsap.timeline({ repeat: -1, repeatDelay: 0.5, delay: nav.arrive + 0.4 });
    run.set(dots, { opacity: 1 }, 0);
    run.fromTo(chomp, { x: -28 }, { x: w + 4, duration: 3.4, ease: "none" }, 0);
    dots.forEach((d) => {
      const at = ((d.offsetLeft + 28) / (w + 32)) * 3.4;
      run.set(d, { opacity: 0 }, at);
    });
  });

  return (
    <div ref={scope} className="absolute inset-0">
      <RoomFrame
        room={room}
        step={nav.step}
        total={TOTAL}
        onSkip={nav.onSkip}
        onBack={nav.onBack}
        primary={{ label: "press start", onClick: () => onStart() }}
        head={
          <>
            <Eyebrow room={room}>READY · IN ARCADE</Eyebrow>
            <Rise
              text="ready,"
              className="mt-5 text-[30px] leading-[1.2] short:mt-3 lg:text-[56px]"
              style={{ fontFamily: room.head }}
            />
            <Rise
              text="player one?"
              className="text-[30px] leading-[1.2] lg:text-[56px]"
              style={{ fontFamily: room.head, color: room.accentText }}
            />
            <p data-f className="mt-6 max-w-[28rem] text-[16px] leading-[1.5] short:mt-4 lg:text-[18px]" style={{ color: room.dim }}>
              Your Net ID goes to the SRM portal to sign you in, and nowhere else.
              No account, no server, nothing kept.
            </p>
          </>
        }
        object={
          <div
            data-f
            className="w-full rounded-[14px] px-5 pb-6 pt-5 short:pb-4 short:pt-4"
            style={{ border: `6px double ${room.line}`, fontFamily: room.head }}
          >
            <div className="flex items-baseline justify-between text-[10px] tracking-[0.04em]" style={{ color: room.faint }}>
              <span>1UP</span>
              <span>SKIPS LEFT</span>
            </div>
            <div className="mt-2.5 flex items-baseline justify-between text-[20px] lg:text-[24px]">
              <span>87.4%</span>
              <span style={{ color: room.accent }}>32</span>
            </div>
            <div className="relative mt-7 h-8 overflow-hidden short:mt-4">
              <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-2" aria-hidden>
                {Array.from({ length: DOTS }, (_, i) => (
                  <span key={i} data-dot className="size-[7px] rounded-[2px] bg-[#ffb897]" />
                ))}
              </div>
              <span
                data-chomp
                aria-hidden
                className="absolute left-0 top-1/2 size-7 -translate-y-1/2 rounded-full"
                style={{ background: CHOMPER, ["--m" as string]: "70deg" }}
              />
            </div>
            <p className="mt-7 text-[10px] leading-[1.8] tracking-[0.04em] short:mt-4" style={{ color: room.faint }}>
              LOOK: <span style={{ color: room.ink }}>{look.toUpperCase()}</span>
              <br />
              CHANGE IT ANY TIME IN PROFILE
            </p>
          </div>
        }
      />
    </div>
  );
}
