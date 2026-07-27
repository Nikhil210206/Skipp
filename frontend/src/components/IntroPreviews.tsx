"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { EASE, prefersReducedMotion } from "@/lib/motion";
import { TrackRule } from "@/components/ui/editorial";

/**
 * Fragments of the real interface, shown at panel scale.
 *
 * Built from the same primitives as the screens they represent, so the
 * onboarding shows the product rather than an illustration standing in for it.
 * Figures are sample data and say so: there is nothing to show before sign-in,
 * and pretending otherwise would be a lie on the screen that asks for trust.
 */

function Frame({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-line-soft bg-ink-1 p-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-label uppercase text-text-3">{label}</p>
        <span className="rounded-full border border-line px-2 py-0.5 text-label uppercase text-text-3">
          Example
        </span>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

/** Counts a figure up once, the way the real screens do on arrival. */
function useCountUp(to: number, format: (n: number) => string, delay = 0.35) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      el.textContent = format(to);
      return;
    }
    const obj = { n: 0 };
    const tw = gsap.to(obj, {
      n: to,
      duration: 0.9,
      delay,
      ease: EASE.emphasis,
      onUpdate: () => {
        el.textContent = format(obj.n);
      },
    });
    return () => {
      tw.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to]);
  return ref;
}

/** The attendance screen: the figure, the target tick, and the decision. */
export function AttendancePreview() {
  const pct = useCountUp(95.2, (n) => n.toFixed(1));
  const margin = useCountUp(5, (n) => String(Math.round(n)), 0.5);

  return (
    <Frame label="Attendance">
      <div className="flex items-end justify-between gap-4">
        <span className="flex items-baseline">
          <span ref={pct} className="tnum text-hero">
            95.2
          </span>
          <span className="text-title text-text-3">%</span>
        </span>
        <div className="shrink-0 pb-1 text-right">
          <span ref={margin} className="tnum block text-title leading-none">
            5
          </span>
          <span className="mt-1 block text-label uppercase text-text-3">
            Margin
          </span>
        </div>
      </div>
      <TrackRule value={95.2} threshold={75} tone="neutral" className="mt-4" />
      <p className="tnum mt-3 text-callout text-text-3">
        20 of 21 attended · the tick is 75%
      </p>
    </Frame>
  );
}

/** The home screen: what is next, then the rest of the day. */
export function TodayPreview() {
  const rows = [
    { time: "03:10", name: "Machine Learning", room: "CLS824" },
    { time: "04:00", name: "Formal Language", room: "CLS824" },
  ];
  return (
    <Frame label="Today">
      <p className="text-label uppercase text-accent">Next class in</p>
      <p className="tnum mt-2 text-hero leading-none">16h 07m</p>
      <div className="mt-4 h-px bg-line" />
      {rows.map((r, i) => (
        <div key={r.time}>
          {i > 0 && <div className="h-px bg-line-soft" />}
          <div className="flex items-baseline gap-4 py-3">
            <span className="tnum w-[46px] shrink-0 text-callout text-text-3">
              {r.time}
            </span>
            <span className="min-w-0 flex-1 truncate text-callout text-text-1">
              {r.name}
            </span>
            <span className="shrink-0 text-callout text-text-3">{r.room}</span>
          </div>
        </div>
      ))}
    </Frame>
  );
}

/** Not a screen: the one thing about the app you cannot see by using it. */
export function PrivacyPreview() {
  const rows = [
    { label: "Sent to", value: "SRM only", accent: false },
    { label: "Held for", value: "One request", accent: false },
    { label: "Stored by Skipp", value: "Nothing", accent: true },
  ];
  return (
    <div className="rounded-card border border-line-soft bg-ink-1 p-5">
      <p className="text-label uppercase text-text-3">Where your password goes</p>
      <dl className="mt-3">
        {rows.map((r, i) => (
          <div key={r.label}>
            {i > 0 && <div className="h-px bg-line-soft" />}
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-callout text-text-3">{r.label}</dt>
              <dd
                className={`text-headline ${r.accent ? "text-accent" : "text-text-1"}`}
              >
                {r.value}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}
