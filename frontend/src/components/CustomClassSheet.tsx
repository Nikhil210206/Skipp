"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CustomClass } from "@/types";

// Bottom-sheet form to add a custom class to a given day order.

function toMin(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
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
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [room, setRoom] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    if (e <= s) return setError("End time must be after start.");
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
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className="relative w-full max-w-md rounded-t-3xl border-t border-white/10 bg-surface p-5 pb-8"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
            <h2 className="mb-4 text-xl font-extrabold lowercase tracking-tight">
              add a custom class
            </h2>

            {/* Day order */}
            <p className="mb-1.5 text-xs uppercase tracking-wider text-text-muted">
              day order
            </p>
            <div className="mb-4 flex gap-2">
              {dayOrders.map((d) => (
                <button
                  key={d}
                  onClick={() => setOrder(d)}
                  className={`size-10 rounded-xl text-sm font-semibold transition-colors ${
                    order === d
                      ? "bg-accent text-background"
                      : "bg-surface-2 text-text-muted"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            <Field label="class name">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Extra ML Lab"
                className="w-full rounded-xl border border-white/10 bg-background px-4 py-3 outline-none focus:border-accent"
              />
            </Field>

            <div className="flex gap-3">
              <Field label="start">
                <input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-background px-3 py-3 outline-none focus:border-accent [color-scheme:dark]"
                />
              </Field>
              <Field label="end">
                <input
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-background px-3 py-3 outline-none focus:border-accent [color-scheme:dark]"
                />
              </Field>
            </div>

            <Field label="room (optional)">
              <input
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="e.g. TP101"
                className="w-full rounded-xl border border-white/10 bg-background px-4 py-3 outline-none focus:border-accent"
              />
            </Field>

            {error && <p className="mb-3 text-sm text-danger">{error}</p>}

            <div className="mt-2 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl bg-surface-2 py-3 font-semibold text-text-muted"
              >
                cancel
              </button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={submit}
                className="flex-[2] rounded-xl bg-accent py-3 font-semibold text-background"
              >
                add class
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-xs uppercase tracking-wider text-text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
