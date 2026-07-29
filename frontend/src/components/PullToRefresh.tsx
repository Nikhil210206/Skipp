"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { DUR, EASE, prefersReducedMotion } from "@/lib/motion";

// Pull down from the top to refresh. Engages only at scroll position zero.
// The content follows the finger with resistance; past the threshold the
// indicator locks in and releasing triggers the refresh.

const THRESHOLD = 68;
const MAX = 116;
const REST = 52;

export default function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const badge = useRef<HTMLDivElement>(null);
  const [refreshing, setRefreshing] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    const el = wrap.current;
    const inner = content.current;
    const dot = badge.current;
    if (!el || !inner || !dot) return;

    // Reduced motion removes the rubber-band, not the gesture: the pull still
    // refreshes, it just does not move the page.
    const reduced = prefersReducedMotion();
    const setY = gsap.quickSetter(inner, "y", "px");
    const setBadge = gsap.quickSetter(dot, "y", "px");
    const setScale = gsap.quickSetter(dot, "scale");
    const setOpacity = gsap.quickSetter(dot, "opacity");

    let startY: number | null = null;
    let startX = 0;
    // Locked on the first real movement. Without it a sideways swipe that
    // drifts downward engages the pull and eats the navigation gesture.
    let axis: null | "x" | "y" = null;
    let engaged = false;
    const scrollTop = () =>
      (document.scrollingElement ?? document.documentElement).scrollTop;

    // How far the finger has travelled, tracked even when we do not animate.
    let pull = 0;
    const paint = (y: number) => {
      pull = y;
      if (reduced) {
        setOpacity(y > 0 ? 1 : 0);
        return;
      }
      setY(y);
      setBadge(Math.min(y, MAX) - 40);
      setScale(0.6 + Math.min(y / THRESHOLD, 1) * 0.4);
      setOpacity(Math.min(y / (THRESHOLD * 0.6), 1));
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
      if (busy.current || scrollTop() > 0) {
        startY = null;
        return;
      }
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      axis = null;
      engaged = false;
    };
    const onMove = (e: TouchEvent) => {
      if (startY === null || busy.current) return;
      const dy = e.touches[0].clientY - startY;
      const dx = e.touches[0].clientX - startX;
      if (!axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
      if (axis === "x") return;
      if (dy <= 0 || scrollTop() > 0) {
        if (engaged) paint(0);
        return;
      }
      engaged = true;
      e.preventDefault();
      // Resistance: the further you pull, the less it gives.
      paint(Math.min(MAX, dy * 0.52));
    };
    const onEnd = async () => {
      if (startY === null) return;
      const pulled = pull;
      startY = null;
      if (engaged && pulled >= THRESHOLD && !busy.current) {
        busy.current = true;
        setRefreshing(true);
        settle(REST);
        try {
          await onRefresh();
        } finally {
          busy.current = false;
          setRefreshing(false);
          settle(0);
        }
      } else {
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

  return (
    <div ref={wrap} className="relative flex flex-1 flex-col">
      <div
        ref={badge}
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center opacity-0"
      >
        <div className="flex size-9 items-center justify-center rounded-full border border-line bg-ink-1 shadow-lift">
          <span
            className={`size-3.5 rounded-full border-2 border-line border-t-accent ${
              refreshing ? "animate-spin" : ""
            }`}
          />
        </div>
      </div>
      <div ref={content} className="flex flex-1 flex-col">
        {children}
      </div>
    </div>
  );
}
