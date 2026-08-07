"use client";

import { dayAndDate, daysAway, holidayNote, type Holiday } from "@/lib/holidays";

/**
 * One day off, as it reads under the calendar grid and in the full-term sheet.
 *
 * Shared deliberately: the month list and the sheet are two views of the same
 * thing, and a row that says "4 days off" in one place and something else in
 * the other is how two screens start disagreeing about the same term.
 */
export default function HolidayRow({
  h,
  today,
  selected,
  onClick,
}: {
  h: Holiday;
  today: string;
  selected?: boolean;
  onClick: () => void;
}) {
  const note = holidayNote(h);
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-baseline justify-between gap-4 py-3.5 text-left ${
        h.past ? "opacity-45" : ""
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body">{h.name}</span>
        <span className="tnum mt-1 block text-callout text-text-3">
          {dayAndDate(h.weekday, h.date)}
          {!h.past && ` · ${daysAway(today, h.date)}`}
        </span>
      </span>

      {h.past ? (
        <span className="shrink-0 text-callout text-text-3">gone</span>
      ) : note ? (
        <span className="shrink-0 text-right">
          <span
            className={`tnum block text-callout ${
              note.strong ? "text-text-1" : "text-text-3"
            }`}
          >
            {note.text}
          </span>
          {note.range && (
            <span className="tnum mt-1 block text-callout text-text-3">
              {note.range}
            </span>
          )}
        </span>
      ) : null}
    </button>
  );
}
