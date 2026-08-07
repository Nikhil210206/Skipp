"use client";

import { useMemo } from "react";
import { Sheet } from "@/components/ui/Overlay";
import { Rule, SectionHead } from "@/components/ui/editorial";
import { MONTH_NAMES, isLongBreak, type Holiday } from "@/lib/holidays";
import HolidayRow from "./HolidayRow";

/**
 * The whole term's days off, in date order under month headings.
 *
 * Deliberately a plain chronological list rather than a ranking. The calendar
 * screen already answers "what is coming next" for the month you are looking
 * at; this is the reference you open when you are planning a trip home and need
 * the actual dates, and a list sorted by anything other than time is a list you
 * have to search rather than read.
 */
export default function HolidaysSheet({
  open,
  onClose,
  holidays,
  today,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  holidays: Holiday[];
  today: string;
  onPick: (date: string) => void;
}) {
  const months = useMemo(() => {
    const m = new Map<string, Holiday[]>();
    for (const h of holidays) {
      const ym = h.date.slice(0, 7);
      m.set(ym, [...(m.get(ym) ?? []), h]);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [holidays]);

  const left = holidays.filter((h) => !h.past).length;
  const breaks = holidays.filter(isLongBreak).length;

  return (
    <Sheet open={open} onClose={onClose} title="Days off">
      {/* The two numbers a student is actually after, before any list: how many
          are left, and how many of them are worth travelling for. */}
      <div className="flex items-baseline gap-6 pb-2">
        <Figure value={left} label={left === 1 ? "day off left" : "days off left"} />
        <Figure
          value={breaks}
          label={breaks === 1 ? "long weekend" : "long weekends"}
          muted={breaks === 0}
        />
      </div>

      {months.map(([ym, list]) => {
        const [y, m] = ym.split("-").map(Number);
        const gone = list.every((h) => h.past);
        return (
          <section key={ym} className="pt-6">
            <SectionHead aside={gone ? "gone" : undefined}>
              {MONTH_NAMES[m - 1]} {y}
            </SectionHead>
            <ul>
              {list.map((h, i) => (
                <li key={h.date}>
                  <Rule soft={i > 0} />
                  <HolidayRow
                    h={h}
                    today={today}
                    onClick={() => {
                      onPick(h.date);
                      onClose();
                    }}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <p className="py-6 text-callout leading-relaxed text-text-3">
        Straight from SRM&rsquo;s academic planner. Tap one to open it on the
        calendar.
      </p>
    </Sheet>
  );
}

function Figure({
  value,
  label,
  muted = false,
}: {
  value: number;
  label: string;
  muted?: boolean;
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className={`tnum text-title ${muted ? "text-text-3" : "text-text-1"}`}>
        {value}
      </span>
      <span className="text-callout text-text-3">{label}</span>
    </span>
  );
}
