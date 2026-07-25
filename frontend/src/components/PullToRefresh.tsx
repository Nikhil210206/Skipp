"use client";

import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";

// Pull-down-from-the-top to refresh. Engages only when the page is scrolled to
// the very top; drag past the threshold and release to trigger onRefresh. The
// content rubber-bands down and a spinner reveals — all spring-animated.

const THRESHOLD = 70; // px of pull needed to trigger
const MAX = 120; // max rubber-band travel
const REST = 54; // where the content parks while refreshing

export default function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}) {
  const y = useMotionValue(0);
  const [refreshing, setRefreshing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const engaged = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const scrollTop = () =>
      (document.scrollingElement ?? document.documentElement).scrollTop;
    const spring = { type: "spring" as const, stiffness: 260, damping: 26 };

    function onStart(e: TouchEvent) {
      if (refreshing || scrollTop() > 0) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0].clientY;
      engaged.current = false;
    }
    function onMove(e: TouchEvent) {
      if (startY.current === null || refreshing) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0 || scrollTop() > 0) {
        if (engaged.current) y.set(0);
        return;
      }
      engaged.current = true;
      e.preventDefault(); // suppress native scroll/overscroll while pulling
      y.set(Math.min(MAX, dy * 0.5));
    }
    async function onEnd() {
      if (startY.current === null) return;
      const pulled = y.get();
      startY.current = null;
      if (engaged.current && pulled >= THRESHOLD && !refreshing) {
        setRefreshing(true);
        animate(y, REST, spring);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
          animate(y, 0, spring);
        }
      } else {
        animate(y, 0, spring);
      }
      engaged.current = false;
    }

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
  }, [onRefresh, refreshing, y]);

  const opacity = useTransform(y, [0, THRESHOLD * 0.4, THRESHOLD], [0, 0.5, 1]);
  const rotate = useTransform(y, [0, THRESHOLD], [0, 180]);
  const scale = useTransform(y, [0, THRESHOLD], [0.7, 1]);
  const badgeY = useTransform(y, (v) => Math.min(v, MAX) - 42);

  return (
    <div ref={ref} className="relative flex flex-1 flex-col">
      <motion.div
        style={{ y: badgeY, opacity }}
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center"
      >
        <motion.div
          style={{ scale }}
          className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-surface shadow-lg shadow-black/50"
        >
          {refreshing ? (
            <span className="size-4 animate-spin rounded-full border-2 border-white/20 border-t-accent" />
          ) : (
            <motion.span style={{ rotate }} className="text-lg text-accent">
              ↓
            </motion.span>
          )}
        </motion.div>
      </motion.div>
      <motion.div style={{ y }} className="flex flex-1 flex-col">
        {children}
      </motion.div>
    </div>
  );
}
