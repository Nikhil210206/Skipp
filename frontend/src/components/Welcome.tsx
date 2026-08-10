"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import Notebook, { PAPER } from "./entry/Notebook";
import { Ink, Star } from "./entry/paper";
import { INKS } from "./entry/inks";
import { useDeckPages } from "./entry/pages";
import { ProfileFace } from "./ProfileMark";
import { haptic } from "@/lib/haptics";
import { hashSeed } from "@/lib/mark";
import { DUR, EASE, prefersReducedMotion } from "@/lib/motion";

/**
 * The first thing a new student ever sees, after the launch.
 *
 * Its only job is to WELCOME somebody. It shows no attendance figure, no marks
 * and no timetable, because the onboarding chapters that follow are built
 * entirely out of those: an earlier version put a 97.7% card here and it was
 * the same picture as chapter one, two screens early and with none of the
 * explanation. A welcome that previews the product is not a welcome, it is a
 * worse version of the tour.
 *
 * So the stage is PEOPLE. Every student gets a generated character from their
 * registration number, drawn in `lib/mark.ts`, and a crowd of them says who
 * this is for without a word of copy: other students, all a bit different, all
 * already here. It is the same drawing the profile uses, so the very first
 * thing anyone sees is something they will later recognise as their own.
 *
 * The room is warm, and the only warm one in the entry deck: every onboarding
 * chapter is cool, so opening here and moving to the install screen's deep
 * ocean reads as walking somewhere.
 *
 * **The crowd is alive, and that is the whole difference between this screen
 * and the one it replaced.** The faces used to be frozen at fixed rotations,
 * fading up on the deck's generic entrance along with the paragraph beneath
 * them, and eight frozen faces read as wallpaper rather than as people. Now
 * they gather from the middle outward, breathe, blink on their own clocks, and
 * answer when you touch them. The vocabulary is exactly `ProfileMark`'s press
 * blink, because that is the character these already are.
 *
 * Nothing here is a control. Continue is still the only way on, the faces are
 * `aria-hidden` and unfocusable, and pressing one does nothing but delight: a
 * button that leads nowhere is a focus stop a keyboard user lands on for no
 * reason.
 */



/**
 * The tiles. Most of the crowd is painted in the room's own cream: the field
 * here is fixed, so a theme token would be the one thing on screen that did not
 * belong to it. Two are in the accent, because a crowd in a single hue reads as
 * a sticker sheet, and two warm points make it individuals. The value is the
 * deck's `ACCENT`, written out because Tailwind cannot build a class from a
 * runtime constant.
 */
const INK = INKS.welcome;
const PLAIN_TILE = "bg-[rgba(46,16,101,0.09)] text-[#2E1065]";
const ACCENT_TILE = "bg-[rgba(46,16,101,0.88)] text-[#EFE7FA]";

type Person = {
  seed: string;
  size: number;
  /** Placed in the stage box below. */
  x: string;
  y: number;
  rot: number;
  /**
   * 0 far, 1 near. One figure said three ways: how solid the face is, how far
   * out of focus, and how far and how slowly it drifts. Depth carried by
   * opacity alone reads as a flat scatter at different alphas; near faces
   * travelling further and slower than distant ones is what reads as a room.
   */
  depth: number;
  accent?: boolean;
};

/** Seeds picked so the crowd is visibly varied: different tops, eyes, mouths. */
const CROWD: Person[] = [
  { seed: "RA2411003010021", size: 64, x: "2%", y: 22, rot: -8, depth: 0.17 },
  { seed: "RA2411003010144", size: 96, x: "31%", y: 0, rot: 5, depth: 0.75, accent: true },
  { seed: "RA2411003010307", size: 54, x: "78%", y: 48, rot: -5, depth: 0.06 },
  { seed: "RA2411003011574", size: 124, x: "9%", y: 116, rot: -2, depth: 1 },
  { seed: "RA2411003010492", size: 80, x: "62%", y: 142, rot: 9, depth: 0.5, accent: true },
  { seed: "RA2411003010838", size: 56, x: "1%", y: 272, rot: 7, depth: 0.03 },
  { seed: "RA2411003011002", size: 92, x: "33%", y: 256, rot: -6, depth: 0.4 },
  { seed: "RA2411003010676", size: 66, x: "72%", y: 288, rot: 3, depth: 0.2 },
];

const restOpacity = (d: number) => 0.4 + d * 0.6;
/**
 * Deliberately sub-pixel across the whole ramp. A first pass ran to 1.5px and
 * the distant faces stopped being faces: they are also the smallest, so the
 * same blur eats a far larger share of a 54px drawing than of a 124px one, and
 * the eyes and mouth went with it. Blur is the FOURTH depth cue here after
 * size, opacity and drift, so it only has to soften an edge.
 */
const restBlur = (d: number) => (1 - d) * 0.85;

/** What each face's motion is wired to, resolved once and held for the presses. */
type Part = {
  pop: HTMLElement | null;
  head: SVGGElement | null;
  eyes: SVGGElement | null;
  blink: gsap.core.Timeline | null;
};

export default function Welcome({ onNext }: { onNext: () => void }) {
  const pages = useDeckPages();
  return (
    <Notebook page={pages.welcome} total={pages.total} word="WELCOME" ink={INK} onNext={onNext}>
      {/* Two bands, and neither is allowed to leave a hole: the crowd takes
          whatever the writing does not, so the page is full at any height
          rather than parking a block in the middle of a lot of cream. */}
      <div className="flex h-full flex-col">
        <div className="relative min-h-0 flex-1">
          <Stage />
          <Star className="right-[4%] top-[6%]" size={15} />
          <Star className="right-[13%] top-[13%]" size={9} />
        </div>

        {/* One colour, three tools: the aside is pencil because it is an
            afterthought, the word is marker because it is the point, and the
            line under it is biro. */}
        <div className="shrink-0 pb-2">
          <Ink as="p" tool="pencil" colour={INK} size="text-[1.05rem]" className="tracking-wide">
            made for srm students
          </Ink>
          <Ink as="p" tool="pen" colour={INK} size="text-[1.15rem]" className="mt-3 max-w-[26ch]">
            You are one sign in away from never opening the SRM portal again.
          </Ink>
        </div>
      </div>
    </Notebook>
  );
}

/* -------------------------------------------------------------------------- */

/** A crowd of the app's own generated students, scattered at varying depth. */
function Stage() {
  const stage = useRef<HTMLDivElement>(null);
  const parts = useRef<Part[]>([]);
  const live = useRef(false);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;

    const faces = [...el.querySelectorAll<HTMLElement>("[data-face]")];
    parts.current = faces.map((face) => ({
      pop: face.querySelector<HTMLElement>("[data-pop]"),
      head: face.querySelector<SVGGElement>("[data-head]"),
      eyes: face.querySelector<SVGGElement>("[data-eyes]"),
      blink: null,
    }));

    // The resting transform is written by GSAP in both paths, never as an
    // inline `transform` in the markup: a rest state for an animated transform
    // set in the style attribute fights GSAP and the tween silently dies.
    faces.forEach((face, i) => gsap.set(face, { rotation: CROWD[i].rot }));

    if (prefersReducedMotion()) {
      parts.current.forEach((p, i) =>
        gsap.set(p.pop, { scale: 1, opacity: restOpacity(CROWD[i].depth) }),
      );
      return;
    }
    live.current = true;

    const ctx = gsap.context(() => {
      // The gather. Staggered from the middle of the array outward, and the
      // middle of the array is the big near face, so the crowd assembles around
      // the one you were going to look at anyway.
      gsap.fromTo(
        faces.map((f) => f.querySelector("[data-pop]")),
        { scale: 0.55, opacity: 0 },
        {
          scale: 1,
          opacity: (i: number) => restOpacity(CROWD[i].depth),
          duration: 0.9,
          ease: EASE.pop,
          stagger: { each: 0.06, from: "center" },
          delay: 0.1,
        },
      );

      faces.forEach((face, i) => {
        const { seed, rot, depth } = CROWD[i];
        const h = hashSeed(seed);
        /** 0 to 1, from its own slice of the hash, so no two faces are in step. */
        const phase = ((h >>> 5) % 997) / 997;

        // The breath. Near faces travel further and slower than distant ones,
        // which is parallax, and it costs nothing beyond choosing the numbers.
        const amp = 4 + depth * 7;
        const period = 3.4 + depth * 1.8;
        const drift = gsap.fromTo(
          face,
          { y: amp / 2, x: amp * -0.2, rotation: rot - 1.1 },
          {
            y: -amp / 2,
            x: amp * 0.2,
            rotation: rot + 1.1,
            duration: period,
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
          },
        );
        // Seeked into its own part of the cycle, so the crowd never pulses as
        // one. A full lap of a yoyo is two durations.
        drift.totalTime(phase * period * 2);

        // The blink, on its own clock per face. It is a timeline rather than a
        // recursive `delayedCall` deliberately: a call scheduled from inside a
        // later callback is created outside this context's collection window,
        // so `ctx.revert()` would not kill it and it would run for ever after
        // this screen unmounted, which it does the moment Continue is pressed.
        const eyes = parts.current[i].eyes;
        if (eyes) {
          const gap = 2.6 + ((h >>> 13) % 38) / 10;
          const blink = gsap.timeline({
            repeat: -1,
            repeatDelay: gap,
            delay: phase * gap,
          });
          blink
            .to(eyes, { scaleY: 0.08, duration: 0.09, ease: "power2.in" })
            .to(eyes, { scaleY: 1, duration: 0.42, ease: "elastic.out(1, 0.55)" });
          parts.current[i].blink = blink;
        }
      });
    }, el);

    return () => {
      live.current = false;
      ctx.revert();
    };
  }, []);

  const press = useCallback((i: number) => {
    if (!live.current) return;
    const p = parts.current[i];
    haptic("tick");
    gsap.to(p.pop, {
      scale: 0.86,
      duration: DUR.micro,
      ease: EASE.in,
      overwrite: "auto",
    });
    gsap.to(p.head, { y: 1.2, duration: DUR.micro, ease: EASE.out, overwrite: "auto" });
    // The eyes are blinked by RESTARTING their own timeline, never by a fresh
    // tween: a second tween on `scaleY` with `overwrite: "auto"` would kill the
    // loop, and that face would never blink again. One owner per property.
    p.blink?.restart();
  }, []);

  const settle = useCallback((i: number) => {
    if (!live.current) return;
    const p = parts.current[i];
    gsap.to(p.pop, {
      scale: 1,
      duration: 0.55,
      ease: EASE.pop,
      overwrite: "auto",
    });
    gsap.to(p.head, { y: 0, duration: DUR.quick, ease: EASE.out, overwrite: "auto" });
  }, []);

  return (
    <div
      ref={stage}
      className="flex h-full items-center justify-center overflow-hidden py-2"
    >
      {/* **The composition keeps its aspect, and must NOT take `h-full`.**
          Positions here are a share of the box, and the crowd was arranged in
          one 360 by 372. Stretched to the page's height it measured 302 by 532:
          the faces spread apart vertically and closed up sideways until two of
          the eight sat behind their neighbours and read as missing. */}
      <div
        className="relative"
        style={{ width: "min(100%, 330px)", aspectRatio: "360 / 372" }}
      >
        {CROWD.map((p, i) => (
          <span
            key={p.seed}
            data-face
            aria-hidden
            onPointerDown={() => press(i)}
            onPointerUp={() => settle(i)}
            onPointerCancel={() => settle(i)}
            onPointerLeave={() => settle(i)}
            className="absolute"
            style={{ left: p.x, top: `${(p.y / 372) * 100}%` }}
          >
            {/* The split is what keeps one system per property: the outer span
                is the drift's (x, y, rotation), this one is the entrance's and
                the press's (scale, opacity). Neither carries `data-in`, so the
                deck's generic entrance never touches the crowd.

                The out of focus blur rests HERE rather than on the drifting
                parent, and it is a static style rather than a tween: this
                element is untouched for all but the first second, so the filter
                rasterises once and the drift above it still composites. */}
            <span
              data-pop
              className="block"
              style={{
                // The resting opacity is written HERE as well as by the tween,
                // and that is the safety net rather than a duplicate. The
                // entrance is a `fromTo` starting at 0, so a context reverted
                // mid-flight hands the element back to whatever was inline
                // before it: with this, that is a visible face, and without it
                // the crowd would be gone for good. Never let visible content
                // depend on an animation having run.
                opacity: restOpacity(p.depth),
                filter: p.depth < 1 ? `blur(${restBlur(p.depth).toFixed(2)}px)` : undefined,
              }}
            >
              <ProfileFace
                seed={p.seed}
                size={p.size}
                tile={p.accent ? ACCENT_TILE : PLAIN_TILE}
                // Features punched out in the room colour, so they hold at the
                // small sizes where a thin stroke would vanish.
                cut={PAPER}
              />
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
