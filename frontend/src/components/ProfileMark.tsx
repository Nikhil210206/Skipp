"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import { DUR, EASE, prefersReducedMotion } from "@/lib/motion";
import { FACE_BOX, faceFor } from "@/lib/mark";
import { markProfileSeen, useSeenProfile } from "@/lib/firstRun";
import { haptic } from "@/lib/haptics";

/**
 * The profile character: a little face generated from the registration number.
 *
 * It was an identicon before, a grid of dots, and students were not pressing
 * it. **An abstract pattern in a corner reads as decoration; a face reads as a
 * person and as a button.** The figure is nobody's choice and nothing stored:
 * the same number always draws the same character, so it is recognisably yours
 * and two students sitting together see two different ones.
 *
 * **It blinks when you press it.** That is the whole reason it is worth
 * pressing twice: the eyes squash shut, the head ducks, and everything springs
 * back. A control that reacts is a control people go back to.
 *
 * Handlers are React props rather than listeners bound to a ref: `next/link`
 * does not hand back the underlying anchor, so a ref-bound listener silently
 * never fires.
 */
export default function ProfileMark({ seed }: { seed: string }) {
  const tile = useRef<HTMLSpanElement>(null);
  const ring = useRef<HTMLSpanElement>(null);
  const head = useRef<SVGGElement>(null);
  const eyes = useRef<SVGGElement>(null);
  const live = useRef(false);

  const face = useMemo(() => faceFor(seed), [seed]);
  const seen = useSeenProfile();

  useEffect(() => {
    const t = tile.current;
    const r = ring.current;
    if (!t || !r) return;
    // GSAP owns the ring's transform outright. A Tailwind `scale-*` class sets
    // the standalone `scale` property, which composes on top of GSAP's
    // `transform` and silently cancels the animation, so the rest state is set
    // here rather than in the markup.
    gsap.set(r, { scale: 1.16, opacity: 0.35 });
    live.current = !prefersReducedMotion();
    const h = head.current;
    const e = eyes.current;
    return () => {
      gsap.killTweensOf([t, r]);
      if (h) gsap.killTweensOf(h);
      if (e) gsap.killTweensOf(e);
    };
  }, []);

  const to = useCallback(
    (el: Element | null, vars: gsap.TweenVars, duration: number) => {
      if (!el || !live.current) return;
      gsap.to(el, { ...vars, duration, ease: EASE.out, overwrite: "auto" });
    },
    [],
  );

  const engage = useCallback(() => {
    to(ring.current, { scale: 1, opacity: 1 }, DUR.quick);
  }, [to]);

  const settle = useCallback(() => {
    to(tile.current, { scale: 1 }, DUR.micro);
    to(ring.current, { scale: 1.16, opacity: 0.35 }, DUR.quick);
    // The eyes spring back open, which is the half people notice.
    if (eyes.current && live.current) {
      gsap.to(eyes.current, {
        scaleY: 1,
        duration: 0.5,
        ease: "elastic.out(1, 0.5)",
        overwrite: "auto",
      });
    }
    to(head.current, { y: 0 }, DUR.quick);
  }, [to]);

  const press = useCallback(() => {
    haptic("tick");
    to(tile.current, { scale: 0.9 }, DUR.micro);
    engage();
    // A blink: the eyes squash about their own centre, and the head ducks.
    if (eyes.current && live.current) {
      gsap.to(eyes.current, {
        scaleY: 0.12,
        duration: 0.1,
        ease: "power2.in",
        overwrite: "auto",
      });
    }
    to(head.current, { y: 1.1 }, DUR.micro);
  }, [to, engage]);

  return (
    <Link
      href="/profile"
      aria-label="Your profile"
      onPointerEnter={engage}
      onPointerLeave={settle}
      onPointerDown={press}
      onPointerUp={settle}
      onPointerCancel={settle}
      onClick={markProfileSeen}
      className="relative -mr-1.5 flex size-11 items-center justify-center"
    >
      {/* Held off the tile at rest, meets it on press. */}
      <span
        ref={ring}
        aria-hidden
        className="pointer-events-none absolute size-9 rounded-full border border-accent/70 opacity-0"
      />
      <span
        ref={tile}
        className="flex size-9 items-center justify-center overflow-hidden rounded-full border border-accent/35 bg-accent/12"
      >
        <svg
          viewBox={`0 0 ${FACE_BOX} ${FACE_BOX}`}
          aria-hidden
          className="size-9 text-accent"
        >
          {/* Shoulders, cropped by the tile, which is what makes the whole
              thing read as an avatar rather than as a floating head. */}
          <path
            d="M2.5 25c0-5 4.2-8.4 9.5-8.4S21.5 20 21.5 25z"
            fill="currentColor"
            opacity={0.55}
          />
          {face.collar && (
            <path d="M12 16.6l-2.1 3.1h4.2z" fill="currentColor" opacity={0.9} />
          )}

          {/* Everything above the neck moves together on a press. */}
          <g ref={head} transform={`rotate(${face.tilt} 12 11)`}>
            <circle cx="12" cy="9.6" r="5.9" fill="currentColor" />
            <Top variant={face.top} />

            {/* Features are punched out in the page colour, so they read at
                this size where thin strokes would disappear. */}
            <g
              ref={eyes}
              // The blink has to squash about the eyes' own centre. Without
              // `fill-box` an SVG group scales about the viewBox origin and
              // the eyes fly off the face instead of closing.
              style={{ transformOrigin: "center", transformBox: "fill-box" }}
            >
              <Eyes variant={face.eyes} />
            </g>
            <Mouth variant={face.mouth} />
          </g>
        </svg>
      </span>

      {/* The unread dot. It answers itself: one visit and it is gone forever. */}
      {!seen && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 size-2.5 rounded-full bg-accent ring-2 ring-ink-0"
        />
      )}
    </Link>
  );
}

/* -------------------------------------------------------------------------- */

/** Features are cut out in the page colour rather than drawn in a second hue. */
const CUT = "var(--color-ink-0)";

function Top({ variant }: { variant: 0 | 1 | 2 | 3 }) {
  if (variant === 1) {
    return (
      <path
        d="M11.4 3.9c.2-1.6 2.1-1.9 2.7-.6-1 .1-1.9.3-2.7.6z"
        fill="currentColor"
      />
    );
  }
  if (variant === 2) {
    return (
      <path
        d="M6.7 7.6C7.5 4.8 10 3.5 12.7 4c1.9.4 3.2 1.6 3.7 3-2.4-1.6-6.6-1.5-9.7.6z"
        fill="currentColor"
      />
    );
  }
  if (variant === 3) {
    // A cap brim, a nod to the app's own mark.
    return <path d="M5.7 7.3h12.6a6.3 6.3 0 00-12.6 0z" fill="currentColor" />;
  }
  return null;
}

function Eyes({ variant }: { variant: 0 | 1 | 2 }) {
  if (variant === 1) {
    return (
      <>
        <path
          d="M8.7 9.6q1 -1.2 2 0"
          stroke={CUT}
          strokeWidth="1.1"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M13.3 9.6q1 -1.2 2 0"
          stroke={CUT}
          strokeWidth="1.1"
          fill="none"
          strokeLinecap="round"
        />
      </>
    );
  }
  const r = variant === 2 ? 1.35 : 1.05;
  return (
    <>
      <circle cx="9.7" cy="9.2" r={r} fill={CUT} />
      <circle cx="14.3" cy="9.2" r={r} fill={CUT} />
    </>
  );
}

function Mouth({ variant }: { variant: 0 | 1 | 2 | 3 }) {
  if (variant === 1) {
    return (
      <path d="M10.3 12.6h3.4" stroke={CUT} strokeWidth="1.1" strokeLinecap="round" fill="none" />
    );
  }
  if (variant === 2) {
    return <ellipse cx="12" cy="12.7" rx="1.4" ry="1.15" fill={CUT} />;
  }
  if (variant === 3) {
    return (
      <path
        d="M10.2 12.5q1.6 1.3 3.2 0"
        stroke={CUT}
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        transform="rotate(-8 12 12.5)"
      />
    );
  }
  return (
    <path d="M9.9 12.2q2.1 2 4.2 0" stroke={CUT} strokeWidth="1.15" strokeLinecap="round" fill="none" />
  );
}
