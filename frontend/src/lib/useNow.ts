"use client";

import { useEffect, useState } from "react";
import { nowMinutes } from "./schedule";

/**
 * Minutes since midnight, kept live.
 *
 * The Schedule screen read the clock once during render, so "Now", "Next" and
 * every countdown froze at whatever second the screen happened to mount and
 * only ever corrected on a re-render for some unrelated reason. A class could
 * sit marked live half an hour after it ended.
 *
 * Ticking on the minute boundary rather than every 30s: everything derived from
 * this is quoted in whole minutes, so a mid-minute wake-up re-renders the tree
 * to paint identical text. The first timeout is short by however far through
 * the current minute we already are, so the display changes AS the minute
 * turns rather than up to a minute late.
 */
export function useNowMinutes(): number {
  const [mins, setMins] = useState(() => nowMinutes());
  useEffect(() => {
    let timer: number;
    const tick = () => {
      setMins(nowMinutes());
      const now = new Date();
      const msToNextMinute = 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds());
      timer = window.setTimeout(tick, msToNextMinute + 20);
    };
    const now = new Date();
    timer = window.setTimeout(
      tick,
      60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 20,
    );
    return () => window.clearTimeout(timer);
  }, []);
  return mins;
}
