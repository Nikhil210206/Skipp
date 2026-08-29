"use client";

import { useState } from "react";
import type { CustomClass } from "@/types";
import { Sheet } from "@/components/ui/Overlay";
import { Button, Label, Segmented } from "@/components/ui";
import { ClockField, TextField } from "@/components/ui/fields";

// Adds a class the portal does not know about, to one day order. Stored on
// this device only.

type Half = "AM" | "PM";

/**
 * Minutes since midnight from a clock reading plus the half of the day.
 *
 * **The hour is read as it is WRITTEN on a clock face, not as 24 hour time**,
 * because that is how the whole app shows times: the portal prints a 2:20 PM
 * class as "02:20" and Skipp mirrors it. Parsing that same string as 24 hour
 * put every afternoon class the student typed at 2:20 in the MORNING, twelve
 * hours early and sorted above their real day, which is what made custom
 * classes land in the wrong place.
 *
 * The hour and the minute arrive as separate fields, so there is no format to
 * get wrong and nothing here has to parse a separator. **That is not a tidiness
 * choice, it is the only version that can be typed on a phone**: these fields
 * raise the digits-only keypad, which on iOS has no colon key at all, so the
 * single `HH:MM` box this replaced was literally impossible to complete on an
 * iPhone. The shape still has to be checked, because on a clock face there is
 * no hour 0 or 13 and no minute 70.
 */
function toMin(hh: string, mm: string, half: Half): number | null {
  if (!/^\d{1,2}$/.test(hh) || !/^\d{1,2}$/.test(mm)) return null;
  const h = Number(hh);
  const min = Number(mm);
  if (h < 1 || h > 12 || min > 59) return null;
  // 12 is the odd one: 12 AM is midnight (hour 0) and 12 PM is noon (hour 12).
  const hour24 = half === "AM" ? (h === 12 ? 0 : h) : h === 12 ? 12 : h + 12;
  return hour24 * 60 + min;
}

function autoAbbrev(title: string): string {
  const words = title.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const stop = new Set(["and", "of", "the", "for", "to", "in", "a", "an"]);
  const initials = words
    .filter((w) => !stop.has(w.toLowerCase()))
    .map((w) => w[0].toUpperCase());
  return initials.join("").slice(0, 4) || title.slice(0, 2).toUpperCase();
}

export default function CustomClassSheet({
  open,
  dayOrder,
  dayOrders,
  onClose,
  onAdd,
}: {
  open: boolean;
  dayOrder: number;
  dayOrders: number[];
  onClose: () => void;
  onAdd: (c: Omit<CustomClass, "id">) => void;
}) {
  const [order, setOrder] = useState(dayOrder);
  const [title, setTitle] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  const [startH, setStartH] = useState("09");
  const [startM, setStartM] = useState("00");
  const [startHalf, setStartHalf] = useState<Half>("AM");
  const [endH, setEndH] = useState("10");
  const [endM, setEndM] = useState("00");
  const [endHalf, setEndHalf] = useState<Half>("AM");
  const [room, setRoom] = useState("");
  const [error, setError] = useState<string | null>(null);

  // The sheet stays mounted between openings, so the day order picked up at
  // mount would stick: opening it from day order 5 still offered day order 3.
  // Reset during render (React's documented pattern) rather than in an effect.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setOrder(dayOrder);
      setError(null);
    }
  }

  /**
   * Every field reports through this, so **touching anything clears the error**.
   * Without it the complaint was only ever set on submit and never unset, so it
   * sat under the form contradicting the field the student was in the middle of
   * fixing: typing the first digit of a corrected time still read "enter times
   * as hours and minutes".
   */
  function edit<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setError(null);
    };
  }

  function reset() {
    setTitle("");
    setStartH("09");
    setStartM("00");
    setStartHalf("AM");
    setEndH("10");
    setEndM("00");
    setEndHalf("AM");
    setRoom("");
    setError(null);
  }

  function submit() {
    const s = toMin(startH, startM, startHalf);
    const e = toMin(endH, endM, endHalf);
    if (!title.trim()) return setError("Give the class a name.");
    if (s == null || e == null) {
      return setError("Check the times. Hours are 1 to 12, minutes 0 to 59.");
    }
    if (e <= s) return setError("The end time must be after the start.");
    onAdd({
      dayOrder: order,
      startMin: s,
      endMin: e,
      title: title.trim(),
      abbrev: autoAbbrev(title.trim()),
      room: room.trim() || null,
      faculty: null,
    });
    reset();
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add a class"
      footer={
        <Button size="lg" full onClick={submit}>
          Add to day order {order}
        </Button>
      }
    >
      <div className="flex flex-col gap-5 pb-2 pt-1">
        <div>
          <Label>Day order</Label>
          <div className="mt-3">
            <Segmented
              label="Day order"
              value={order}
              onChange={edit(setOrder)}
              options={dayOrders.map((d) => ({
                value: d,
                label: <span className="tnum">{d}</span>,
              }))}
            />
          </div>
        </div>

        <TextField
          id="cc-title"
          label="Class name"
          value={title}
          onChange={edit(setTitle)}
          placeholder="Makeup lab"
        />

        {/* Hour and minute are their own boxes, with the half of the day stated
            rather than guessed. */}
        <div className="grid grid-cols-2 gap-3">
          <HalfDayTime
            id="cc-start"
            label="Starts"
            hour={startH}
            minute={startM}
            onHour={edit(setStartH)}
            onMinute={edit(setStartM)}
            half={startHalf}
            onHalfChange={edit(setStartHalf)}
          />
          <HalfDayTime
            id="cc-end"
            label="Ends"
            hour={endH}
            minute={endM}
            onHour={edit(setEndH)}
            onMinute={edit(setEndM)}
            half={endHalf}
            onHalfChange={edit(setEndHalf)}
          />
        </div>

        <TextField
          id="cc-room"
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

        <p className="text-callout text-text-3">
          Custom classes are yours alone. They stay on this device and never reach the
          portal.
        </p>
      </div>
    </Sheet>
  );
}

/** A clock reading plus the half of the day, which this sheet has to ask for
 *  because a custom class can land anywhere in the day. The Saturday sheet
 *  deliberately does not: there, the batch already says which half it is. */
function HalfDayTime({
  id,
  label,
  hour,
  minute,
  onHour,
  onMinute,
  half,
  onHalfChange,
}: {
  id: string;
  label: string;
  hour: string;
  minute: string;
  onHour: (v: string) => void;
  onMinute: (v: string) => void;
  half: Half;
  onHalfChange: (h: Half) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <ClockField
        id={id}
        label={label}
        hour={hour}
        minute={minute}
        onHour={onHour}
        onMinute={onMinute}
      />
      <Segmented
        label={`${label}, morning or afternoon`}
        value={half}
        onChange={onHalfChange}
        options={[
          { value: "AM" as Half, label: "AM" },
          { value: "PM" as Half, label: "PM" },
        ]}
      />
    </div>
  );
}
