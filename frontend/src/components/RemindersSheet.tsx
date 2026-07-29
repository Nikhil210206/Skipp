"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Overlay";
import { Button, Label, Segmented } from "@/components/ui";
import { CLASS_LEAD_MIN } from "@/lib/reminders";
import { Rule } from "@/components/ui/editorial";
import { useSession } from "@/context/SessionContext";
import { todayISO } from "@/lib/schedule";
import type { UserReminder } from "@/lib/reminders";

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-control border border-line bg-ink-0 px-4 py-3 transition-colors focus-within:border-text-3">
      <label htmlFor={id} className="text-label uppercase text-text-3">
        {label}
      </label>
      {children}
    </div>
  );
}

/** `<input type="time">` always yields HH:MM, so this cannot be malformed. */
function toMin(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
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
  const { reminders, addReminder, removeReminder } = useSession();

  const [text, setText] = useState("");
  const [time, setTime] = useState("09:00");
  const [date, setDate] = useState(todayISO());
  const [mode, setMode] = useState<UserReminder["mode"]>("once");
  const [error, setError] = useState<string | null>(null);

  function add() {
    const at = toMin(time);
    if (!text.trim()) return setError("Say what to remind you about.");
    if (at == null) return setError("Enter a valid time.");
    addReminder({
      text: text.trim(),
      mode,
      date: mode === "once" ? date : null,
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
        {/* Not a setting. Stating what already happens is more use than asking
            someone to configure it before the feature does anything. */}
        <p className="text-callout leading-relaxed text-text-3">
          Classes are flagged {CLASS_LEAD_MIN} minutes before they start, and
          attendance is reported the moment the portal marks it. Both automatic.
        </p>

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

          <div className="mt-3">
            <Segmented<UserReminder["mode"]>
              label="Repeat"
              value={mode}
              onChange={setMode}
              options={[
                { value: "once", label: "On a day" },
                { value: "daily", label: "Every day" },
              ]}
            />
          </div>

          {/* Native pickers: a phone gives a proper wheel, and the value can
              never come back malformed. */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field id="rem-time" label="Time">
              <input
                id="rem-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="tnum mt-1.5 w-full bg-transparent text-headline text-text-1 outline-none"
              />
            </Field>
            {mode === "once" ? (
              <Field id="rem-date" label="Date">
                <input
                  id="rem-date"
                  type="date"
                  value={date}
                  min={todayISO()}
                  onChange={(e) => setDate(e.target.value)}
                  className="tnum mt-1.5 w-full bg-transparent text-headline text-text-1 outline-none"
                />
              </Field>
            ) : (
              <div className="flex items-end pb-3 pl-1">
                <p className="text-callout text-text-3">Repeats daily</p>
              </div>
            )}
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
                        {fmt(r.atMin)} ·{" "}
                        {r.mode === "daily"
                          ? "Every day"
                          : r.date === todayISO()
                            ? "Today"
                            : (r.date ?? "")}
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
