"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import Logo from "@/components/Logo";
import { IconArrowRight } from "@/components/Icons";
import { useLockScroll } from "@/components/ui/Overlay";
import { prefersReducedMotion } from "@/lib/motion";
import { onLaunchLifted } from "@/lib/launch";
import { haptic } from "@/lib/haptics";
import PhoneShot from "./PhoneShot";
import { usePaintChrome } from "./chrome";
import { C } from "./kit";
import ticketHome from "@/assets/front/ticket-home.webp";
import brutalAttendance from "@/assets/front/brutal-attendance.webp";
import inkHome from "@/assets/front/ink-home.webp";

/**
 * THE FRONT DOOR.
 *
 * The first thing a new visitor sees, after the launch. It replaced the
 * notebook welcome (2026-10-26), and it is the README banner made to move: the
 * word "skipp" set enormous across the room like a magazine masthead, and three
 * phones dealt up in front of it, each wearing a different look.
 *
 * **The phones overlap the bottom of the word on purpose.** A cover reads its
 * masthead from the top halves of the letters, so the fan can stand in front of
 * the lower half without the name going anywhere, and the overlap is what puts
 * the phones IN the room rather than pasted under a title.
 *
 * It is set in the front door's one language (`kit.tsx`), fixed colours rather
 * than the theme tokens: this screen appears before anybody has chosen
 * anything, and it is the front of the product.
 *
 * Motion, in order: the letters rise from under their own line, the phones are
 * dealt up from below the edge (the sides first, the front last, each with a
 * small overshoot), then the tagline is written on and the rest lifts in. After
 * that the phones float, and on a desktop the word and the fan drift apart a
 * little under the pointer, which is the depth. Reduced motion keeps all of the
 * composition and none of the movement.
 *
 * Every animated thing is its own element: the slot positions, the deal layer
 * is dealt, the bob layer floats, the rotation is static style. Two systems
 * writing one transform is the standing trap in this codebase.
 */


/** Sides first in the markup, so the front phone paints over them. */
const PHONES = [
  {
    key: "brutal",
    src: brutalAttendance,
    alt: "Skipp's attendance screen in the Brutal look",
    screen: "#fdf6e3",
    side: -1,
  },
  {
    key: "ink",
    src: inkHome,
    alt: "Skipp's home screen in the Ink look",
    screen: "#000000",
    side: 1,
  },
  {
    key: "ticket",
    src: ticketHome,
    alt: "Skipp's home screen in the Ticket look",
    screen: "#f6f3ec",
    side: 0,
  },
] as const;

const WORD = ["s", "k", "i", "p", "p"];

export default function Hero({
  onStart,
  onSignIn,
}: {
  onStart: () => void;
  onSignIn: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<gsap.Context | null>(null);
  const leaving = useRef(false);

  usePaintChrome(C.ground);
  useLockScroll(true);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el || prefersReducedMotion()) return;
    const stage = el.querySelector<HTMLElement>("[data-stage]");
    if (!stage) return;

    let stopLaunch = () => {};
    const ctx = gsap.context(() => {
      const w = stage.clientWidth;
      const h = stage.clientHeight;

      const tl = gsap.timeline({ paused: true });
      tl.fromTo(
          "[data-letter]",
          { yPercent: 135 },
          { yPercent: 0, duration: 1, ease: "expo.out", stagger: 0.06 },
          0.05,
        )
        .fromTo(
          "[data-deal]",
          {
            // Dealt from one point below the bottom edge, so each phone has to
            // travel out to its place in the fan rather than just rising.
            x: (_: number, t: HTMLElement) => -Number(t.dataset.side) * w * 0.27,
            y: h * 0.95,
            rotation: (_: number, t: HTMLElement) => -Number(t.dataset.side) * 14,
            scale: 0.86,
            opacity: 0,
          },
          {
            x: 0,
            y: 0,
            rotation: 0,
            scale: 1,
            opacity: 1,
            duration: 1.15,
            ease: "back.out(1.25)",
            stagger: 0.14,
          },
          0.5,
        )
        .fromTo(
          "[data-tag]",
          { clipPath: "inset(-30% 100% -30% -2%)" },
          { clipPath: "inset(-30% -2% -30% -2%)", duration: 0.9, ease: "power2.inOut" },
          0.7,
        )
        .fromTo(
          "[data-swash]",
          { strokeDashoffset: 1 },
          { strokeDashoffset: 0, duration: 0.7, ease: "power2.inOut" },
          1.4,
        )
        .fromTo(
          "[data-up]",
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: 0.7, ease: "expo.out", stagger: 0.08 },
          0.95,
        )
        .call(
          () => {
            // The float starts once the deal has landed, on its own clock per
            // phone, so the three never bob in unison.
            gsap.utils.toArray<HTMLElement>("[data-bob]").forEach((b, i) => {
              gsap.to(b, {
                y: -8,
                duration: 2.3 + i * 0.35,
                ease: "sine.inOut",
                yoyo: true,
                repeat: -1,
              });
            });
          },
          [],
          2,
        );

      stopLaunch = onLaunchLifted(() => tl.play());

      // Depth under the pointer, desktop only. The word and the fan move in
      // opposite directions, by a few pixels, on their own layers.
      if (window.matchMedia("(pointer: fine)").matches) {
        const wx = gsap.quickTo("[data-par-word]", "x", { duration: 0.9, ease: "power3.out" });
        const wy = gsap.quickTo("[data-par-word]", "y", { duration: 0.9, ease: "power3.out" });
        const fx = gsap.quickTo("[data-par-fan]", "x", { duration: 0.9, ease: "power3.out" });
        const fy = gsap.quickTo("[data-par-fan]", "y", { duration: 0.9, ease: "power3.out" });
        const move = (e: PointerEvent) => {
          const nx = e.clientX / window.innerWidth - 0.5;
          const ny = e.clientY / window.innerHeight - 0.5;
          wx(-nx * 16);
          wy(-ny * 8);
          fx(nx * 24);
          fy(ny * 12);
        };
        el.addEventListener("pointermove", move);
        return () => el.removeEventListener("pointermove", move);
      }
    }, el);
    ctxRef.current = ctx;

    return () => {
      stopLaunch();
      ctx.revert();
      ctxRef.current = null;
    };
  }, []);

  const leave = (then: () => void) => {
    if (leaving.current) return;
    leaving.current = true;
    haptic("select");
    const ctx = ctxRef.current;
    if (!ctx || prefersReducedMotion()) {
      then();
      return;
    }
    ctx.add(() => {
      gsap.killTweensOf("[data-bob]");
      gsap
        .timeline({ onComplete: then })
        .to("[data-deal]", { y: -50, opacity: 0, duration: 0.36, ease: "power2.in", stagger: 0.04 }, 0)
        .to("[data-par-word]", { yPercent: -10, opacity: 0, duration: 0.36, ease: "power2.in" }, 0)
        .to("[data-copy]", { opacity: 0, y: 10, duration: 0.26, ease: "power2.in" }, 0);
    });
  };

  return (
    <div
      ref={root}
      className="fixed inset-0 z-40 flex flex-col overflow-hidden font-sans lg:grid lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
      style={{ background: C.ground, color: C.text }}
    >
      <header className="relative z-20 flex shrink-0 items-center justify-between px-6 pt-[max(16px,env(safe-area-inset-top))] lg:absolute lg:inset-x-0 lg:top-0 lg:px-14 lg:pt-9 xl:px-20">
        <div data-up className="flex items-center gap-3">
          <Logo size={30} />
          <span className="font-mono text-[11px] font-semibold tracking-[0.16em]" style={{ color: C.faint }}>
            FOR SRM STUDENTS
          </span>
        </div>
        <button
          data-up
          type="button"
          onClick={() => leave(onSignIn)}
          className="min-h-11 px-1 text-[15px] underline-offset-4 hover:underline lg:hidden"
          style={{ color: C.dim }}
        >
          sign in
        </button>
      </header>

      <div
        data-stage
        className="relative z-10 min-h-0 flex-1 [container-type:size] lg:col-start-2 lg:row-start-1 lg:h-full"
      >
        <div data-par-word className="absolute inset-x-0 top-[6cqh] flex justify-center">
          {/* The clip is what the letters rise out from under, and it needs
              room below the line or it shaves the tails off both p's. */}
          <h1
            className="relative -mb-[0.2em] overflow-hidden pb-[0.2em] font-extrabold leading-[0.86] tracking-[-0.065em]"
            style={{ fontSize: "min(37cqw, 33cqh)" }}
          >
            <span className="sr-only">Skipp</span>
            <span aria-hidden className="flex">
              {WORD.map((ch, i) => (
                <span
                  key={i}
                  data-letter
                  className="inline-block"
                  style={
                    i === WORD.length - 1
                      ? { color: C.accent, marginLeft: "-0.035em" }
                      : undefined
                  }
                >
                  {ch}
                </span>
              ))}
            </span>
          </h1>
        </div>

        <div data-par-fan className="absolute inset-0">
          {PHONES.map((p) => {
            const front = p.side === 0;
            return (
              <div
                key={p.key}
                className="absolute"
                style={{
                  left: front ? "50%" : `calc(50% + ${p.side * 27}cqw)`,
                  top: front ? "24cqh" : "32cqh",
                  width: front ? "min(34cqh, 44cqw)" : "min(28.5cqh, 37cqw)",
                  transform: "translateX(-50%)",
                }}
              >
                <div data-deal data-side={p.side}>
                  <div data-bob>
                    <div style={{ transform: `rotate(${p.side * 10}deg)` }}>
                      <PhoneShot src={p.src} alt={p.alt} screen={p.screen} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        data-copy
        className="relative z-20 shrink-0 px-6 pb-[max(24px,env(safe-area-inset-bottom))] lg:col-start-1 lg:row-start-1 lg:flex lg:flex-col lg:justify-center lg:pb-0 lg:pl-14 lg:pr-4 xl:pl-20"
      >
        <div className="relative inline-block">
          <p data-tag className="font-hand text-[44px] font-bold leading-none max-[380px]:text-[40px] short:text-[38px] lg:text-[70px] xl:text-[80px]">
            know before you bunk.
          </p>
          <svg
            aria-hidden
            viewBox="0 0 300 18"
            preserveAspectRatio="none"
            className="absolute -bottom-3.5 -left-1 h-[18px] w-full overflow-visible"
          >
            <path
              data-swash
              pathLength={1}
              d="M4 13 C 90 6, 196 5, 296 8"
              fill="none"
              stroke={C.accent}
              strokeWidth={4.5}
              strokeLinecap="round"
              strokeDasharray="1"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
        <p data-up className="mt-8 max-w-[30rem] text-[16px] leading-[1.45] short:mt-6 lg:mt-10 lg:text-[19px]" style={{ color: C.dim }}>
          Your SRM <b className="font-semibold" style={{ color: C.text }}>attendance</b>,{" "}
          <b className="font-semibold" style={{ color: C.text }}>marks</b> and{" "}
          <b className="font-semibold" style={{ color: C.text }}>timetable</b>, minus the portal.
          <span className="short:hidden">
            {" "}Know how many you can skip, and what a leave will cost.
          </span>
        </p>
        <div data-up className="mt-6 flex items-center gap-7 short:mt-4 lg:mt-9">
          <button
            type="button"
            onClick={() => leave(onStart)}
            className="group flex h-[58px] w-full items-center justify-between rounded-full pl-[26px] pr-2 text-[18px] font-semibold tracking-[-0.01em] transition-transform duration-[420ms] ease-[cubic-bezier(.34,1.56,.64,1)] active:scale-[0.96] active:duration-[90ms] lg:h-[60px] lg:w-auto lg:gap-5"
            style={{ background: C.accent, color: C.onAccent }}
          >
            get started
            <span
              className="grid size-[42px] place-items-center rounded-full"
              style={{ background: C.onAccent, color: C.accent }}
            >
              <IconArrowRight
                size={18}
                className="transition-transform duration-300 group-hover:translate-x-0.5"
              />
            </span>
          </button>
          <button
            type="button"
            onClick={() => leave(onSignIn)}
            className="hidden min-h-11 text-[16px] underline-offset-4 hover:underline lg:block"
            style={{ color: C.dim }}
          >
            already on skipp? sign in
          </button>
        </div>
        <p
          data-up
          className="mt-9 hidden whitespace-nowrap font-mono text-[11px] font-medium leading-[1.6] tracking-[0.1em] lg:block"
          style={{ color: C.faint }}
        >
          FREE · NOTHING STORED ON A SERVER · NOT AFFILIATED WITH SRM
        </p>
      </div>
    </div>
  );
}
