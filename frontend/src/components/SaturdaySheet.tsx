"use client";

import { useState } from "react";
import { useSession } from "@/context/SessionContext";
import { fmtTime } from "@/lib/schedule";
import {
  BATCH_LABEL,
  BATCH_WINDOW,
  outOfWindow,
  sortedSaturday,
  suggestedPeriods,
  type SaturdayBatch,
} from "@/lib/saturday";
import { Sheet } from "@/components/ui/Overlay";
import { Button, IconButton, Label, Segmented } from "@/components/ui";
import { ClockField, TextField } from "@/components/ui/fields";
import { Rule } from "@/components/ui/editorial";
import { IconClose } from "@/components/Icons";

/**
 * The student's Saturday, set up once and repeated every Saturday of the term.
 *
 * The portal publishes no Saturday at all, so everything here is typed by the
 * student and stored on this device. It is deliberately NOT a day order, and
 * the batch here is deliberately NOT the portal's batch. See lib/saturday.ts
 * for why both of those matter.
 */

/**
 * Minutes since midnight from a clock reading, with the half of the day taken
 * from the BATCH rather than asked for.
 *
 * That is the whole reason this sheet has no AM/PM control: batch 1 sits in the
 * morning and batch 2 in the afternoon, so a student who has already said which
 * one they are in has already answered it. Asking twice invites them to
 * disagree with themselves, and a class filed at 2 in the morning is the kind
 * of thing nobody notices until their Saturday is empty.
 *
 * Batch 1 reads the hour as written (12 is noon, not midnight). Batch 2 adds
 * twelve, so a "1" typed by an afternoon student is 13:00. Anything that lands
 * outside the batch's window is refused by the caller, which is what catches a
 * 24 hour reading typed out of habit.
 */
function toMin(batch: SaturdayBatch, hh: string, mm: string): number | null {
  if (!/^\d{1,2}$/.test(hh) || !/^\d{1,2}$/.test(mm)) return null;
  const h = Number(hh);
  const m = Number(mm);
  if (m > 59) return null;
  const hour24 = batch === 1 ? h : h >= 1 && h <= 11 ? h + 12 : h;
  return hour24 * 60 + m;
}

/** The hour a batch would print for a time, ready to sit back in the field. */
function toHour(batch: SaturdayBatch, min: number): string {
  const h = Math.floor(min / 60);
  return String(batch === 2 && h > 12 ? h - 12 : h).padStart(2, "0");
}

function toMinute(min: number): string {
  return String(min % 60).padStart(2, "0");
}

function autoAbbrev(title: string): string {
  const words = title.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const stop = new Set(["and", "of", "the", "for", "to", "in", "a", "an"]);
  const initials = words
    .filter((w) => !stop.has(w.toLowerCase()))
    .map((w) => w[0].toUpperCase());
  return initials.join("").slice(0, 4) || title.slice(0, 2).toUpperCase();
}

export default function SaturdaySheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { saturday, setSaturdayBatch, addSaturdayClass, removeSaturdayClass } =
    useSession();
  const batch = saturday.batch;
  const classes = sortedSaturday(saturday);

  const [title, setTitle] = useState("");
  const [room, setRoom] = useState("");
  const [startH, setStartH] = useState("");
  const [startM, setStartM] = useState("");
  const [endH, setEndH] = useState("");
  const [endM, setEndM] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(open);

  /**
   * The sheet stays mounted between openings, so without this a half-typed
   * class and, worse, a stale complaint about it are both still sitting there
   * the next time it is opened, contradicting a form the student has not
   * touched yet. Reset during render, React's documented pattern, rather than
   * in an effect. The same trap `CustomClassSheet` already had to fix.
   *
   * The BATCH is deliberately not reset: it is a saved answer about the
   * student, not a draft.
   */
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTitle("");
      setRoom("");
      setStartH("");
      setStartM("");
      setEndH("");
      setEndM("");
      setError(null);
    }
  }

  // Classes left stranded by a change of batch. Never dropped for them: shown
  // back, marked, so the student decides.
  const stranded = new Set(outOfWindow(saturday).map((c) => c.id));

  /**
   * Every field reports through this, so touching anything clears the error.
   * Without it the complaint is only ever set on submit and never unset, and
   * it sits under the form contradicting the field being fixed. The same
   * wrapper the custom class sheet already needed.
   */
  function edit<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setError(null);
    };
  }

  function reset() {
    setTitle("");
    setRoom("");
    setStartH("");
    setStartM("");
    setEndH("");
    setEndM("");
    setError(null);
  }

  function fill(startMin: number, endMin: number) {
    if (batch == null) return;
    setStartH(toHour(batch, startMin));
    setStartM(toMinute(startMin));
    setEndH(toHour(batch, endMin));
    setEndM(toMinute(endMin));
    setError(null);
  }

  function submit() {
    if (batch == null) return;
    const win = BATCH_WINDOW[batch];
    const s = toMin(batch, startH, startM);
    const e = toMin(batch, endH, endM);
    if (!title.trim()) return setError("Give the class a name.");
    if (s == null || e == null) {
      return setError("Check the times. Hours and minutes, digits only.");
    }
    if (e <= s) return setError("The end time must be after the start.");
    // The window is the point of asking for a batch at all, so a time outside
    // it is refused rather than quietly accepted and then invisible.
    if (s < win.from || e > win.to) {
      return setError(
        `Batch ${batch} runs ${BATCH_LABEL[batch]}. Put the class inside that.`,
      );
    }
    addSaturdayClass({
      startMin: s,
      endMin: e,
      title: title.trim(),
      abbrev: autoAbbrev(title.trim()),
      room: room.trim() || null,
    });
    reset();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Your Saturday"
      footer={
        batch == null ? (
          <Button size="lg" full variant="outline" onClick={onClose}>
            Close
          </Button>
        ) : (
          <Button size="lg" full onClick={submit}>
            Add class
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-6 pb-2 pt-1">
        <div>
          <Label>Saturday batch</Label>
          <div className="mt-3">
            <Segmented<number>
              label="Saturday batch"
              // Null matches neither option, so nothing reads as chosen until
              // the student actually chooses. A default here would be a guess
              // wearing the clothes of an answer.
              value={batch ?? 0}
              onChange={(v) => setSaturdayBatch(v as SaturdayBatch)}
              options={[1, 2].map((n) => ({
                value: n,
                label: (
                  <span className="flex flex-col leading-tight">
                    <span>Batch {n}</span>
                    <span className="text-label uppercase opacity-60">
                      {BATCH_LABEL[n as SaturdayBatch]}
                    </span>
                  </span>
                ),
              }))}
            />
          </div>
          <p className="mt-3 text-callout text-text-3">
            {/* Said plainly, because the numbers are the same and the meaning is
                not. A student who reads this as their usual batch will file a
                whole Saturday into the wrong half of the day. */}
            The Saturday split is its own thing. It is not the batch on your
            profile, so pick the one you actually sit on a Saturday.
          </p>
        </div>

        {batch == null ? null : (
          <>
            <Rule />

            <div>
              <Label>Your classes</Label>
              {classes.length === 0 ? (
                <p className="mt-3 text-callout text-text-3">
                  Nothing here yet. Add your first class below and it will show
                  on every Saturday of the term.
                </p>
              ) : (
                <ul className="mt-3 flex flex-col">
                  {classes.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center gap-3 border-b border-line-soft py-3 last:border-0"
                    >
                      <span
                        className={`tnum w-[104px] shrink-0 text-callout ${
                          stranded.has(c.id) ? "text-watch" : "text-text-2"
                        }`}
                      >
                        {fmtTime(c.startMin)} to {fmtTime(c.endMin)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body text-text-1">
                          {c.title}
                        </span>
                        {/* The time is what is wrong, so the time is what is
                            marked, and the row says why in words rather than
                            leaving an amber figure to be decoded. */}
                        {stranded.has(c.id) ? (
                          <span className="block text-label uppercase text-watch">
                            Outside batch {batch}
                          </span>
                        ) : (
                          c.room && (
                            <span className="block text-label uppercase text-text-3">
                              {c.room}
                            </span>
                          )
                        )}
                      </span>
                      <IconButton
                        label={`Remove ${c.title}`}
                        variant="quiet"
                        onClick={() => removeSaturdayClass(c.id)}
                      >
                        <IconClose size={16} />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              )}

              {stranded.size > 0 && (
                <p role="status" className="mt-3 text-callout text-watch">
                  {/* Nothing has been deleted, and saying so is the point: a
                      student who switched batch by mistake needs to know their
                      work is still here before they can undo it. */}
                  {stranded.size === 1 ? "One class sits" : `${stranded.size} classes sit`}{" "}
                  outside batch {batch}, {batch != null && BATCH_LABEL[batch]}. They are
                  kept as you typed them. Switch back, or remove them and add them again
                  at the right time.
                </p>
              )}
            </div>

            <Rule />

            <div className="flex flex-col gap-5">
              <Label>Add a class</Label>

              {/* Quick fill. Four one hour slots across the batch's window, so
                  the ordinary case is one tap instead of four fields. */}
              <div className="-mx-1 flex flex-wrap gap-2 px-1">
                {suggestedPeriods(batch).map((p) => (
                  <button
                    key={p.startMin}
                    type="button"
                    onClick={() => fill(p.startMin, p.endMin)}
                    data-chip
                    className="tnum min-h-[44px] rounded-full border border-line px-3.5 text-callout text-text-2 transition-colors hover:border-line-strong hover:text-text-1"
                  >
                    {fmtTime(p.startMin)}
                  </button>
                ))}
              </div>

              <TextField
                id="sat-title"
                label="Class name"
                value={title}
                onChange={edit(setTitle)}
                placeholder="Data Structures"
              />

              {/* No AM or PM control: the batch already said which half of the
                  day this is, and asking twice only lets the two disagree. */}
              <div className="grid grid-cols-2 gap-3">
                <ClockField
                  id="sat-start"
                  label="Starts"
                  hour={startH}
                  minute={startM}
                  onHour={edit(setStartH)}
                  onMinute={edit(setStartM)}
                />
                <ClockField
                  id="sat-end"
                  label="Ends"
                  hour={endH}
                  minute={endM}
                  onHour={edit(setEndH)}
                  onMinute={edit(setEndM)}
                />
              </div>

              <TextField
                id="sat-room"
                label="Room"
                value={room}
                onChange={edit(setRoom)}
                placeholder="Optional"
              />

              {error && (
                <p role="alert" className="text-callout text-risk">
                  {error}
                </p>
              )}
            </div>
          </>
        )}

        <p className="text-callout text-text-3">
          {/* The limit, stated where it can be read rather than discovered.
              These classes carry a name you typed, not a course code, so
              nothing here can be charged to a subject's attendance. */}
          Your Saturday stays on this device and never reaches the portal.
          Because the portal does not publish it, these classes do not count
          towards attendance or the leave planner.
        </p>
      </div>
    </Sheet>
  );
}
