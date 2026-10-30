"use client";

import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { EASE, prefersReducedMotion } from "@/lib/motion";
import {
  BOARD,
  BODY,
  BOX,
  CAP_CENTRE,
  CAP_FOOT,
  RULE,
  TASSEL_CORD,
  TASSEL_CORD_W,
  TASSEL_PIVOT,
  TUFT,
} from "@/lib/logo";
import { markLaunchLifted } from "@/lib/launch";

/**
 * THE LAUNCH: THE TOSS.
 *
 * Mounted once in the root layout, so it plays on a cold start and never on a
 * client navigation: opening the app from the home screen or the app switcher
 * is a fresh document, moving between tabs is not.
 *
 * Graduation day, in under two seconds. The line is drawn and waits, the cap
 * is thrown up from below the screen, tumbling, and comes down onto the line,
 * which gives under it like a trampoline and springs back. Dots burst off the
 * line, the tassel whips, and the word jumps up from the middle out. Chosen
 * from three directions mocked on a canvas
 * (claude.ai/artifact/NmEuvSZf7tt9sAXY8EEZLa).
 *
 * It draws its own mark rather than using `Logo`, because the toss needs the
 * pieces nested the way they move: the flight carries the tumble, the tumble
 * carries the squash, and the tassel swings inside all three, so it stays
 * tied to the board however the cap turns. Every tween moves in the mark's
 * own 32 unit space; `u()` turns screen pixels into it.
 *
 * The moving parts start hidden in CSS (`data-toss-hide`), so the first frame
 * a phone paints, before any JS has run, is the empty ground the toss starts
 * from, and the same black the native launch screens show. Without that the
 * finished mark was painted from the server's HTML and then vanished as the
 * timeline took over.
 *
 * It holds for a fixed beat rather than waiting on the session, so a slow
 * portal can never turn the launch into a hang, and a failsafe takes it away
 * if the timeline never gets to finish.
 */

const WORD = "skipp".split("");

/** The mark's size on the launch, in px. */
const SIZE = 96;
/** Screen pixels into the mark's 32 unit space, which every tween moves in. */
const u = (px: number) => (px * BOX) / SIZE;

/** The middle of the line, where its two halves meet and the cap lands. */
const MID = RULE.x + RULE.w / 2;
const LINE_Y = RULE.y + RULE.h / 2;
/** How far each half reaches past the middle, so the seam never opens. */
const SEAM = 0.6;
/** How far the line turns under the cap, each half about its outer end... */
const BEND = 12.8;
/** ...which is how far its middle gives. */
const GIVE = (MID - RULE.x - RULE.r) * Math.sin((BEND * Math.PI) / 180);
/** The cap rests above the line; it has to fall this much further to meet it. */
const DROP = RULE.y - CAP_FOOT.y;

/** When it is thrown, how long it rises and falls, and so when it lands. */
const THROW = 0.1;
const RISE = 0.4;
const FALL = 0.2;
const LAND = THROW + RISE + FALL;
/** When the overlay starts to leave. */
const LIFT = 1.45;

/**
 * The burst off the line as the cap lands: where each dot ends up, in the
 * mark's units, and one of the house dither's three dot sizes. Alternate dots
 * take the accent.
 */
const BURST = [
  { x: 24.7, y: -8, r: 1.2 },
  { x: 16, y: -9.6, r: 0.7 },
  { x: 22.1, y: -21.3, r: 0.95 },
  { x: 11.6, y: -17.9, r: 1.2 },
  { x: 9.6, y: -26.3, r: 0.7 },
  { x: 2.4, y: -19.2, r: 0.95 },
  { x: -3.6, y: -29.1, r: 1.2 },
  { x: -7.1, y: -19.4, r: 0.7 },
  { x: -16.3, y: -25.2, r: 0.95 },
  { x: -14.4, y: -13.9, r: 0.95 },
  { x: -22.9, y: -13.7, r: 1.2 },
  { x: -17.1, y: -5.6, r: 0.7 },
] as const;

const origin = (p: { x: number; y: number }) => `${p.x} ${p.y}`;

export default function Splash() {
  const [done, setDone] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      markLaunchLifted();
      setDone(true);
    };
    // A launch that cannot finish (a hidden tab draws no frames, a tween can
    // throw) must still get out of the way of the app.
    const failsafe = window.setTimeout(finish, 4000);

    const ctx = gsap.context(() => {
      if (prefersReducedMotion()) {
        // The mark stands still, then fades. Nothing moves, and nothing cuts.
        gsap
          .timeline({ onComplete: finish })
          .to({}, { duration: 0.35 })
          .call(markLaunchLifted)
          .to(el, { opacity: 0, duration: 0.3, ease: EASE.in });
        return;
      }

      const q = (s: string) => el.querySelector(s);
      const svg = q("svg");
      const line = q("[data-toss-line]");
      const lineL = q("[data-toss-line-l]");
      const lineR = q("[data-toss-line-r]");
      const flight = q("[data-toss-flight]");
      const tumble = q("[data-toss-tumble]");
      const squash = q("[data-toss-squash]");
      const tassel = q("[data-toss-tassel]");
      const group = q("[data-mark-group]");
      const dots = el.querySelectorAll("[data-toss-dot]");
      const letters = el.querySelectorAll("[data-letter]");
      if (!svg || !line || !lineL || !lineR || !flight || !tumble || !squash || !tassel || !group) {
        finish();
        return;
      }

      const box = svg.getBoundingClientRect();
      // Thrown from just below the bottom edge, wherever that is on this
      // screen, up to a peak that still clears the top of a short one.
      const from = u(window.innerHeight - box.top + 40);
      const peak = -u(Math.min(170, Math.max(36, box.top - 16)));
      const pivot = origin(TASSEL_PIVOT);

      gsap.set(tumble, { rotation: -35, scaleY: 1, svgOrigin: origin(CAP_CENTRE) });
      gsap.set(tassel, { rotation: 20, svgOrigin: pivot });

      const tl = gsap.timeline({ onComplete: finish });

      // The line is drawn first, and waits.
      tl.fromTo(
        line,
        { scaleX: 0, opacity: 1, svgOrigin: `${MID} ${LINE_Y}` },
        { scaleX: 1, duration: 0.4, ease: EASE.emphasis, svgOrigin: `${MID} ${LINE_Y}` },
        0,
      )
        // The throw: up from below the screen to the top of its arc, the way a
        // thrown thing slows as it climbs...
        .fromTo(
          flight,
          { y: from, opacity: 1 },
          { y: peak, duration: RISE, ease: "power1.out" },
          THROW,
        )
        // ...and down onto the line, quickening as it falls,
        .to(flight, { y: DROP, duration: FALL, ease: "power1.in" })
        // riding it down as it gives,
        .to(flight, { y: DROP + GIVE, duration: 0.08, ease: "power1.out" })
        // flung back up as it springs,
        .to(flight, { y: -u(14), duration: 0.12, ease: "power1.inOut" })
        // and settling where the mark sits.
        .to(flight, { y: 0, duration: 0.12, ease: "power1.in" });

      // Tumbling end over end on the way up, which is a scale through zero
      // rather than a 3D flip, and upright again by the time it lands.
      tl.to(
        tumble,
        {
          keyframes: {
            "14%": { rotation: -20, scaleY: 0.1 },
            "26%": { rotation: -5, scaleY: -1 },
            "40%": { rotation: 5, scaleY: -0.1 },
            "55%": { rotation: 12, scaleY: 1 },
            "67%": { rotation: 16, scaleY: 0.55 },
            "84%": { rotation: 6, scaleY: 1 },
            "100%": { rotation: 0, scaleY: 1 },
            easeEach: "sine.inOut",
          },
          duration: RISE + FALL,
          svgOrigin: origin(CAP_CENTRE),
        },
        THROW,
      )
        .to(
          tassel,
          {
            keyframes: {
              "60%": { rotation: -15 },
              "100%": { rotation: 0 },
              easeEach: "sine.inOut",
            },
            duration: RISE + FALL,
            svgOrigin: pivot,
          },
          THROW,
        );

      // The landing. The cap squashes about the point that met the line...
      tl.to(
        squash,
        {
          keyframes: {
            "12.5%": { scaleX: 1.22, scaleY: 0.78 },
            "50%": { scaleX: 0.93, scaleY: 1.09 },
            "81%": { scaleX: 1.03, scaleY: 0.98 },
            "100%": { scaleX: 1, scaleY: 1 },
            easeEach: "sine.inOut",
          },
          duration: 0.32,
          svgOrigin: origin(CAP_FOOT),
        },
        LAND,
      );

      // ...the line gives, each half turning about its outer end, then
      // springs past flat and settles...
      const give = (sign: 1 | -1, about: string) => ({
        keyframes: {
          "25%": { rotation: sign * BEND },
          "62.5%": { rotation: sign * -5 },
          "81%": { rotation: sign * 2 },
          "100%": { rotation: 0 },
          easeEach: "sine.inOut",
        },
        duration: 0.32,
        svgOrigin: about,
      });
      tl.to(lineL, give(1, `${RULE.x + RULE.r} ${LINE_Y}`), LAND).to(
        lineR,
        give(-1, `${RULE.x + RULE.w - RULE.r} ${LINE_Y}`),
        LAND,
      );

      // ...the tassel whips, and the dots burst off the line. They keep their
      // speed out and fade late, so they read as thrown rather than dissolving.
      tl.to(
        tassel,
        {
          keyframes: {
            "14%": { rotation: -38 },
            "34%": { rotation: 22 },
            "54%": { rotation: -11 },
            "74%": { rotation: 5 },
            "88%": { rotation: -2 },
            "100%": { rotation: 0 },
            easeEach: "sine.inOut",
          },
          duration: 0.75,
          svgOrigin: pivot,
        },
        LAND,
      );
      if (dots.length) {
        tl.fromTo(
          dots,
          { x: 0, y: 0, scale: 1, transformOrigin: "50% 50%" },
          {
            x: (i: number) => BURST[i].x,
            y: (i: number) => BURST[i].y,
            scale: 0.3,
            duration: 0.62,
            ease: EASE.emphasis,
          },
          LAND,
        ).fromTo(
          dots,
          { opacity: 1 },
          // A fromTo renders its from state the moment it is made, wherever it
          // sits in the timeline, which left every dot showing on the line for
          // the whole throw. These stay at their attribute's 0 until the burst.
          { opacity: 0, duration: 0.62, ease: "power2.in", immediateRender: false },
          LAND,
        );
      }

      // The word jumps up out of its line from the middle out, as if the
      // landing knocked it up. It starts well below the clip: the clip has
      // room under the line for the p's tail, so at 115% the dot of the i
      // was still showing in it.
      if (letters.length) {
        tl.fromTo(
          letters,
          { yPercent: 170, opacity: 1 },
          {
            yPercent: 0,
            duration: 0.5,
            ease: EASE.spring,
            // `amount`, not `each`: from the centre GSAP spends `each` per
            // letter but steps out by two, so the ends came in 0.24s late and
            // were still settling as the launch lifted away.
            stagger: { amount: 0.12, from: "center" },
          },
          LAND + 0.1,
        );
      }

      // The screen underneath starts its own entrance as this begins to leave,
      // so it is already moving as the overlay clears. The whole thing lifts
      // away rather than dissolving: the app is arriving underneath it.
      tl.call(markLaunchLifted, [], LIFT)
        .to(group, { y: -14, opacity: 0, duration: 0.4, ease: EASE.in }, LIFT)
        .to(el, { opacity: 0, duration: 0.32, ease: EASE.in }, LIFT + 0.06);
    }, el);

    return () => {
      window.clearTimeout(failsafe);
      ctx.revert();
    };
  }, []);

  if (done) return null;

  return (
    <div
      ref={root}
      aria-hidden
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-0"
    >
      {/* `data-mark-group > div > span > [data-letter]` is the shape Stone's
          four coloured letters are written against in globals.css. */}
      <div data-mark-group className="flex flex-col items-center">
        <svg
          viewBox={`0 0 ${BOX} ${BOX}`}
          width={SIZE}
          height={SIZE}
          className="overflow-visible text-text-1"
        >
          {/* The line, in two halves so it can give under the landing. */}
          <g data-toss-line data-toss-hide>
            <rect
              data-toss-line-l
              x={RULE.x}
              y={RULE.y}
              width={RULE.w / 2 + SEAM}
              height={RULE.h}
              rx={RULE.r}
              fill="currentColor"
            />
            <rect
              data-toss-line-r
              x={MID - SEAM}
              y={RULE.y}
              width={RULE.w / 2 + SEAM}
              height={RULE.h}
              rx={RULE.r}
              fill="currentColor"
            />
          </g>
          {/* Never seen at rest: only for the moment of the burst. */}
          <g>
            {BURST.map((d, i) => (
              <circle
                key={i}
                data-toss-dot
                cx={CAP_FOOT.x}
                cy={RULE.y}
                r={d.r}
                opacity={0}
                className={i % 2 ? "fill-current" : "fill-accent"}
              />
            ))}
          </g>
          <g data-toss-flight data-toss-hide>
            <g data-toss-tumble>
              <g data-toss-squash>
                <path d={BOARD} fill="currentColor" />
                <path d={BODY} fill="currentColor" />
                <g data-toss-tassel>
                  <path
                    d={TASSEL_CORD}
                    strokeWidth={TASSEL_CORD_W}
                    strokeLinecap="round"
                    fill="none"
                    className="stroke-accent"
                  />
                  <rect
                    x={TUFT.x}
                    y={TUFT.y}
                    width={TUFT.w}
                    height={TUFT.h}
                    rx={TUFT.r}
                    className="fill-accent"
                  />
                </g>
              </g>
            </g>
          </g>
        </svg>
        {/* No margin: the mark's box already has room under the line, and the
            word's own line box adds the rest, about 19px of air in all. */}
        <div className="flex text-hero tracking-[-0.06em] text-text-1">
          {WORD.map((c, i) => (
            // The clip reaches past the letter's own box on every side, pulled
            // back out so nothing moves: the tracking makes each box narrower
            // than its glyph, and the p's tail hangs below the line.
            <span
              key={i}
              className="-mx-[0.08em] -mb-[0.22em] inline-flex overflow-hidden px-[0.08em] pb-[0.22em]"
            >
              <span
                data-letter
                data-toss-hide
                // The first p is tracked tighter so the pair reads as one, as
                // in the wordmark, and the second carries the accent.
                className={`inline-block will-change-transform ${
                  i === 3 ? "tracking-[-0.09em]" : ""
                } ${i === WORD.length - 1 ? "text-accent" : ""}`}
              >
                {c}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
