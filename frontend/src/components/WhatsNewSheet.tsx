"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/Overlay";
import { Button } from "@/components/ui";
import { Rule } from "@/components/ui/editorial";
import { useSession } from "@/context/SessionContext";
import { todayISO } from "@/lib/schedule";
import {
  dateRange,
  dayAndDate,
  daysAway,
  isLongBreak,
  termHolidays,
} from "@/lib/holidays";
import { markHolidaysUpdateSeen } from "@/lib/whatsNew";

/**
 * How long to hold before rising.
 *
 * The launch overlay runs about 1.8s at `z-100`, and this sheet lives at
 * `z-50`, so without the wait it slides up entirely behind the splash and is
 * simply THERE when the splash lifts. Arriving a beat after the screen settles
 * is also the better order: you see your own dashboard first, then the notice.
 */
const HOLD_MS = 2100;

/**
 * When the hold expires, held at module scope on purpose.
 *
 * AppShell remounts on every navigation, so a timer owned by this component
 * would restart each time a tab was tapped and could be outrun indefinitely.
 * Measured once from the first mount of the session instead.
 */
let riseAt: number | null = null;

/**
 * Shown once, to students who already had Skipp before the calendar learned
 * about holidays.
 *
 * It shows THEIR next break rather than describing the feature, because a
 * screenshot of somebody else's term is an advert and their own four day
 * weekend is a reason to open the calendar. If the portal has not given us a
 * calendar yet it falls back to plain description rather than inventing one.
 */
export default function WhatsNewSheet({ open }: { open: boolean }) {
  const router = useRouter();
  const { timetable } = useSession();
  const today = todayISO();

  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!open) return;
    riseAt ??= Date.now() + HOLD_MS;
    // Always through a timer, never a synchronous setState: the compiler lint
    // rejects setting state during an effect, and 0ms behaves identically.
    const t = setTimeout(() => setHeld(true), Math.max(0, riseAt - Date.now()));
    return () => clearTimeout(t);
  }, [open]);

  const holidays = timetable ? termHolidays(timetable.calendar, today) : [];
  // The best thing we can show them: a real long weekend still to come, or
  // failing that simply the next day off.
  const feature = holidays.find(isLongBreak) ?? holidays.find((h) => !h.past);

  const close = () => markHolidaysUpdateSeen();

  return (
    <Sheet
      open={open && held}
      onClose={close}
      title="Holidays are on the calendar"
      footer={
        <div className="flex items-center gap-3">
          <Button
            full
            onClick={() => {
              close();
              router.push("/calendar");
            }}
          >
            Show me
          </Button>
          <Button variant="quiet" onClick={close}>
            Later
          </Button>
        </div>
      }
    >
      <p className="pb-5 pt-1 text-body leading-relaxed text-text-2">
        The calendar now marks every day off in the month you are looking at,
        and says how long each break actually runs. Because a holiday on a
        Friday is worth three days and one on a Wednesday is worth one.
      </p>

      {feature && (
        <>
          <Rule />
          {/* Their own, not an example. */}
          <p className="pt-4 text-label uppercase text-text-3">
            {isLongBreak(feature) ? "Your next long weekend" : "Your next day off"}
          </p>
          <div className="flex items-baseline justify-between gap-4 pb-1 pt-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-headline">{feature.name}</span>
              <span className="tnum mt-1 block text-callout text-text-3">
                {dayAndDate(feature.weekday, feature.date)} ·{" "}
                {daysAway(today, feature.date)}
              </span>
            </span>
            {isLongBreak(feature) && (
              <span className="shrink-0 text-right">
                <span className="tnum block text-callout text-text-1">
                  {feature.run} days off
                </span>
                <span className="tnum mt-1 block text-callout text-text-3">
                  {dateRange(feature.runStart, feature.runEnd)}
                </span>
              </span>
            )}
          </div>
          <div className="pt-4">
            <Rule soft />
          </div>
        </>
      )}

      <p className="py-5 text-callout leading-relaxed text-text-3">
        The whole term is behind &ldquo;See all days off&rdquo; at the bottom of
        the calendar.
      </p>
    </Sheet>
  );
}
