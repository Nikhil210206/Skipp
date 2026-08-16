"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { DUR, EASE, prefersReducedMotion } from "@/lib/motion";
import type { RefreshOutcome } from "@/context/SessionContext";
import { IconAlert, IconArrowDown, IconCheck } from "./Icons";

// Pull down from the top to refresh. Engages only at scroll position zero.
// The content follows the finger with resistance; past the threshold the
// indicator arms (the arrow flips and the pill takes the accent) and releasing
// triggers the refresh.
//
// The pull always arms, even when the data is too fresh to be worth fetching,
// and the answer comes on release. Refusing to arm would be cheaper but it
// reads as a broken gesture; saying "up to date" reads as an answer. What it
// must never do is spin as though it fetched when it did not, because then the
// one control that means "go and look" stops meaning anything.

const THRESHOLD = 68;
const MAX = 116;
const REST = 52;
/** Progress ring geometry, in the 20 unit box the SVG is drawn in. */
const RING_R = 8;
const RING_C = 2 * Math.PI * RING_R;
/** How long an answer stays up before the pill retracts. */
const NOTE_MS = 1250;

function ago(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.floor((Date.now() - Date.parse(iso)) / 60000);
  if (!Number.isFinite(mins) || mins < 1) return "checked just now";
  if (mins < 60) return `checked ${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  return hrs < 24 ? `checked ${hrs}h ago` : `checked ${Math.floor(hrs / 24)}d ago`;
}

export default function PullToRefresh({
  onRefresh,
  fetchedAt,
  children,
}: {
  onRefresh: () => Promise<RefreshOutcome>;
  /** When the data on screen was fetched, so a refusal can say how fresh it is. */
  fetchedAt: string | null;
  children: React.ReactNode;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const badge = useRef<HTMLDivElement>(null);
  const ring = useRef<SVGCircleElement>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [armed, setArmed] = useState(false);
  const [note, setNote] = useState<{
    title: string;
    detail: string;
    /** A tick only when the data really is fine. A refusal is not a success. */
    ok: boolean;
  } | null>(null);
  const busy = useRef(false);
  // Read inside the gesture without making the listeners depend on it. Written
  // in an effect rather than during render, which the React compiler rejects.
  const at = useRef(fetchedAt);
  useEffect(() => {
    at.current = fetchedAt;
  }, [fetchedAt]);

  useEffect(() => {
    const el = wrap.current;
    const inner = content.current;
    const dot = badge.current;
    if (!el || !inner || !dot) return;

    // Reduced motion drops the page rubber-band and the bottom bounce, which
    // are decoration. It must NOT drop the indicator: a control that tracks
    // your finger is feedback, not flourish, and hiding it left the gesture
    // looking dead on any phone with the setting on. That is the likeliest
    // reason this read as broken while testing fine everywhere else.
    const reduced = prefersReducedMotion();
    // Written straight to the element rather than through GSAP.
    //
    // **This is the iOS bug.** The badge's opacity had TWO owners: the
    // `opacity-0` class it is born with, and a `gsap.quickSetter`. Chrome
    // resolved that in GSAP's favour and Safari did not, so on every iPhone the
    // indicator was positioned perfectly and painted completely transparent for
    // the whole gesture. Measured on an iPhone in both Safari and an installed
    // PWA: at a pull of 88px, where the opacity should be 1, the computed value
    // was 0 on every single frame while the translate was landing correctly.
    //
    // That is why the page moved under the finger and the refresh genuinely
    // ran, yet the gesture read as completely dead: there was nothing to see.
    // One owner, one write, and `translate3d` so the badge gets its own layer
    // instead of being re-rasterised each frame.
    const setBadgeState = (y: number) => {
      const travel = Math.min(y, MAX) * 0.55;
      const scale = 0.6 + Math.min(y / THRESHOLD, 1) * 0.4;
      dot.style.transform = `translate3d(0,${travel}px,0) scale(${scale})`;
      dot.style.opacity = String(Math.min(y / (THRESHOLD * 0.6), 1));
    };
    // Same reasoning for the content: an explicit 3D transform, so iOS gives
    // the scrolling subtree a compositor layer instead of repainting it.
    const setY = (y: number) => {
      inner.style.transform = `translate3d(0,${y}px,0)`;
    };
    const setRing = (p: number) => {
      if (ring.current) {
        ring.current.style.strokeDashoffset = String(RING_C * (1 - p));
      }
    };

    let startY: number | null = null;
    let startX = 0;
    // Locked on the first real movement. Without it a sideways swipe that
    // drifts downward engages the pull and eats the navigation gesture.
    let axis: null | "x" | "y" = null;
    /** Whether this gesture is ours to draw, or an ordinary scroll. */
    let mode: null | "pull" | "scroll" = null;
    let engaged = false;
    let wasArmed = false;
    const scroller = () => document.scrollingElement ?? document.documentElement;
    const scrollTop = () => scroller().scrollTop;


    // How far the finger has travelled, tracked even when we do not animate.
    let pull = 0;
    const paint = (y: number) => {
      pull = y;
      // The page only moves when motion is welcome; the indicator always does.
      if (!reduced) setY(y);
      // Travels DOWN from the safe area edge. It used to start 40px above its
      // anchor, which on a notched phone parks it inside the status bar for
      // most of the pull, so the indicator only appeared right at the end (or
      // not at all). Opacity is what hides it at rest, not position.
      setBadgeState(y);
      setRing(Math.min(y / THRESHOLD, 1));
    };
    const settle = (to: number, done?: () => void) => {
      if (reduced) {
        paint(to);
        done?.();
        return;
      }
      return gsap.to(
        { v: pull },
        {
          v: to,
          duration: DUR.base,
          ease: EASE.emphasis,
          onUpdate() {
            paint(this.targets()[0].v as number);
          },
          onComplete: done,
        },
      );
    };

    const onStart = (e: TouchEvent) => {
      if (busy.current) {
        startY = null;
        return;
      }
      mode = null;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      axis = null;
      engaged = false;
      wasArmed = false;
      setNote(null);
    };
    const onMove = (e: TouchEvent) => {
      if (startY === null || busy.current) return;
      const dy = e.touches[0].clientY - startY;
      const dx = e.touches[0].clientX - startX;

      // Claimed on the FIRST touchmove, before the axis is even locked.
      //
      // Safari decides at the start of a gesture whether the page scrolls, and
      // once it has decided it ignores every later preventDefault. The axis
      // lock below returns early for the first few pixels, which handed iOS the
      // gesture every time: it started its own rubber-band, our transform never
      // got to draw, and the result was a blank band with no indicator. Chrome
      // is forgiving about this, which is exactly why it measured perfectly in
      // every test here and did nothing on a phone.
      //
      // Only a downward drag from the very top is claimed, so upward scrolling
      // and the bounce at the end of the page are untouched.
      if (dy > 0 && Math.abs(dy) >= Math.abs(dx) && scrollTop() <= 0) {
        e.preventDefault();
      }

      if (!axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
      if (axis === "x") return;

      // Which edge this gesture belongs to, decided once. Anything else is an
      // ordinary scroll and must be left alone.
      if (mode === null) {
        // Downward, from the very top, is ours. Everything else is the
        // browser's, including the bounce at the end of the page.
        mode = dy > 0 && scrollTop() <= 0 ? "pull" : "scroll";
      }
      if (mode === "scroll") return;

      engaged = true;
      e.preventDefault();
      // Resistance: the further you pull, the less it gives.
      paint(Math.min(MAX, dy * 0.52));
      if (badge.current) {
      }
      // Announce the moment it becomes releasable, so the threshold is
      // discoverable by feel rather than by guessing.
      const nowArmed = pull >= THRESHOLD;
      if (nowArmed !== wasArmed) {
        wasArmed = nowArmed;
        setArmed(nowArmed);
      }
    };
    const onEnd = async () => {
      if (startY === null) return;
      const pulled = pull;
      startY = null;
      mode = null;


      if (engaged && pulled >= THRESHOLD && !busy.current) {
        busy.current = true;
        setRefreshing(true);
        settle(REST);
        let outcome: RefreshOutcome = "failed";
        try {
          outcome = await onRefresh();
        } finally {
          setRefreshing(false);
          setArmed(false);
        }
        if (outcome === "updated") {
          busy.current = false;
          settle(0);
        } else {
          // Nothing was fetched, so say what is true and hold it long enough
          // to be read before retracting.
          setNote(
            outcome === "fresh"
              ? { title: "Up to date", detail: ago(at.current), ok: true }
              : outcome === "cooldown"
                ? { title: "Portal is busy", detail: "try again shortly", ok: false }
                : {
                    title: "Could not reach Skipp",
                    detail: "showing saved data",
                    ok: false,
                  },
          );
          setTimeout(() => {
            busy.current = false;
            setNote(null);
            settle(0);
          }, NOTE_MS);
        }
      } else {
        setArmed(false);
        settle(0);
      }
      engaged = false;
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [onRefresh]);

  const live = armed || refreshing || note !== null;

  return (
    <div ref={wrap} className="relative flex flex-1 flex-col">
      <div
        ref={badge}
        aria-hidden
        // Anchored BELOW the notch. At top-0 the badge sits behind the status
        // bar on any phone with an inset (59px on a 6.7 inch iPhone), and since
        // it only travels to about 28px at the threshold it was never visible
        // at all: pulling just opened a blank band. Never position a pull
        // indicator against the raw top of a full height wrapper.
        // Opacity starts here and is owned by the gesture from then on. It used
        // to be an `opacity-0` CLASS, which gave the property two owners and is
        // exactly what made the indicator invisible on iOS: the gesture's write
        // never won, so the page moved under the finger with nothing to see.
        style={{ top: "env(safe-area-inset-top)", opacity: 0 }}
        // Above the masthead. At z-20 it tied with AppShell's sticky header and
        // lost, because the header comes later in the DOM: the indicator spent
        // its whole travel behind an opaque bar and was never visible, however
        // correctly it moved. Ties in the same stacking context are decided by
        // document order, so equal z-index is not equal.
        className="pointer-events-none absolute inset-x-0 z-40 flex justify-center"
      >
        {/* The outer element is GSAP's (y, scale, opacity). Everything that
            reacts to state is styled on this inner pill instead, so the two
            never write the same property. */}
        <div
          className={`flex h-9 items-center gap-2 rounded-full border bg-ink-1 px-3 shadow-lift transition-colors duration-200 ${
            live ? "border-accent" : "border-line"
          }`}
        >
          {refreshing ? (
            <span className="size-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
          ) : note ? (
            note.ok ? (
              <IconCheck size={15} className="text-accent" />
            ) : (
              <IconAlert size={15} className="text-watch" />
            )
          ) : (
            <span className="relative flex size-[18px] items-center justify-center">
              {/* Fills as the finger travels, so the gesture is answered the
                  whole way down instead of only once it arms. */}
              <svg viewBox="0 0 20 20" className="absolute inset-0 -rotate-90">
                <circle
                  cx="10"
                  cy="10"
                  r={RING_R}
                  fill="none"
                  strokeWidth="2"
                  className="stroke-line"
                />
                <circle
                  ref={ring}
                  cx="10"
                  cy="10"
                  r={RING_R}
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray={RING_C}
                  strokeDashoffset={RING_C}
                  className="stroke-accent"
                />
              </svg>
              <IconArrowDown
                size={11}
                className={`transition-transform duration-200 ${
                  armed ? "-rotate-180 text-accent" : "text-text-3"
                }`}
              />
            </span>
          )}
          {note && (
            <span className="whitespace-nowrap text-callout text-text-2">
              <span className="text-text-1">{note.title}</span>
              {note.detail ? ` · ${note.detail}` : ""}
            </span>
          )}
        </div>
      </div>
      <div ref={content} className="flex flex-1 flex-col">
        {children}
      </div>
    </div>
  );
}
