"use client";

import { useState } from "react";
import type { CustomClass } from "@/types";
import { Sheet } from "@/components/ui/Overlay";
import { Button, Label, Segmented } from "@/components/ui";

// Adds a class the portal does not know about, to one day order. Stored on
// this device only.

function toMin(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  // The shape being right does not make the time real: "25:99" matches the
  // pattern and would sort a class off the end of the day.
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
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
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
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

  function reset() {
    setTitle("");
    setStart("09:00");
    setEnd("10:00");
    setRoom("");
    setError(null);
  }

  function submit() {
    const s = toMin(start);
    const e = toMin(end);
    if (!title.trim()) return setError("Give the class a name.");
    if (s == null || e == null) return setError("Enter valid times.");
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
              onChange={setOrder}
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
          onChange={setTitle}
          placeholder="Makeup lab"
        />

        <div className="grid grid-cols-2 gap-3">
          <TextField
            id="cc-start"
            label="Starts"
            value={start}
            onChange={setStart}
            numeric
          />
          <TextField id="cc-end" label="Ends" value={end} onChange={setEnd} numeric />
        </div>

        <TextField
          id="cc-room"
          label="Room"
          value={room}
          onChange={setRoom}
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

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  numeric = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** A time field: bring up digits, not the alphabet. */
  numeric?: boolean;
}) {
  return (
    <div className="rounded-control border border-line bg-ink-0 px-4 py-3 transition-colors focus-within:border-text-3">
      <label htmlFor={id} className="text-label uppercase text-text-3">
        {label}
      </label>
      <input
        id={id}
        value={value}
        inputMode={numeric ? "numeric" : undefined}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="tnum mt-1.5 w-full bg-transparent text-headline text-text-1 outline-none placeholder:font-sans placeholder:text-text-3"
      />
    </div>
  );
}
