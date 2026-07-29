"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Overlay";
import { Button, Label, Segmented } from "@/components/ui";
import { Rule } from "@/components/ui/editorial";
import { useSession } from "@/context/SessionContext";
import { todayISO } from "@/lib/schedule";
import type { UserReminder } from "@/lib/reminders";

const OFFSETS = [10, 30, 60] as const;

function toMin(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

const fmt = (min: number) => {
  let h = Math.floor(min / 60);
  if (h > 12) h -= 12;
  return `${String(h).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
};

export default function RemindersSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const {
    reminders,
    addReminder,
    removeReminder,
    reminderPrefs,
    setReminderPrefs,
  } = useSession();

  const [text, setText] = useState("");
  const [time, setTime] = useState("09:00");
  const [mode, setMode] = useState<UserReminder["mode"]>("once");
  const [error, setError] = useState<string | null>(null);

  function add() {
    const at = toMin(time);
    if (!text.trim()) return setError("Say what to remind you about.");
    if (at == null) return setError("Enter a valid time.");
    addReminder({
      text: text.trim(),
      mode,
      date: mode === "once" ? todayISO() : null,
      atMin: at,
    });
    setText("");
    setError(null);
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Reminders"
      footer={
        <Button size="lg" full onClick={add} disabled={!text.trim()}>
          Add reminder
        </Button>
      }
    >
      <div className="flex flex-col gap-6 pb-2 pt-1">
        <div>
          <Label>Before a class</Label>
          <div className="mt-3">
            <Segmented<number>
              label="Class reminder"
              value={reminderPrefs.classOffsetMin ?? 0}
              onChange={(v) =>
                setReminderPrefs({ classOffsetMin: v === 0 ? null : v })
              }
              options={[
                { value: 0, label: "Off" },
                ...OFFSETS.map((o) => ({ value: o as number, label: `${o}m` })),
              ]}
            />
          </div>
          <p className="mt-3 text-callout leading-relaxed text-text-3">
            Flags a class this long before it starts, whenever you open Skipp.
          </p>
        </div>

        <div>
          <Label>Your own</Label>

          <div className="mt-3 rounded-control border border-line bg-ink-0 px-4 py-3 transition-colors focus-within:border-text-3">
            <label htmlFor="rem-text" className="text-label uppercase text-text-3">
              Remind me to
            </label>
            <input
              id="rem-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Submit the DBMS record"
              className="mt-1.5 w-full bg-transparent text-headline text-text-1 outline-none placeholder:text-text-3"
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-control border border-line bg-ink-0 px-4 py-3 transition-colors focus-within:border-text-3">
              <label htmlFor="rem-time" className="text-label uppercase text-text-3">
                At
              </label>
              <input
                id="rem-time"
                value={time}
                inputMode="numeric"
                autoComplete="off"
                onChange={(e) => setTime(e.target.value)}
                className="tnum mt-1.5 w-full bg-transparent text-headline text-text-1 outline-none"
              />
            </div>
            <div>
              <Segmented<UserReminder["mode"]>
                label="Repeat"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "once", label: "Today" },
                  { value: "daily", label: "Daily" },
                ]}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-3 text-callout text-risk">
              {error}
            </p>
          )}
        </div>

        {reminders.length > 0 && (
          <div>
            <Label>Set</Label>
            <ul className="mt-1">
              {reminders.map((r, i) => (
                <li key={r.id}>
                  <Rule soft={i > 0} />
                  <div className="flex items-baseline justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-body">{r.text}</p>
                      <p className="tnum mt-1 text-callout text-text-3">
                        {fmt(r.atMin)} · {r.mode === "daily" ? "Every day" : "Today"}
                      </p>
                    </div>
                    <button
                      onClick={() => removeReminder(r.id)}
                      className="shrink-0 text-callout text-text-3 transition-colors hover:text-risk"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-callout leading-relaxed text-text-3">
          Reminders appear here in Skipp when you open it. They stay on this
          device and are never sent anywhere.
        </p>
      </div>
    </Sheet>
  );
}
