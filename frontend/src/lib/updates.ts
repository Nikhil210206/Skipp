"use client";

// What moved since the student last looked: attendance a faculty recorded, and
// marks a test was graded for.
//
// **One detector for both sources.** Attendance and marks reach the app from
// academia OR from the student portal, and the effective pair is chosen in
// SessionContext. This compares whatever is actually on screen against what was
// on screen last time, so it does not care which portal produced it. The older
// attendance diff in `reminders.ts` only ever saw academia, which is the portal
// that stopped publishing.
//
// Two stores, both on the device and keyed by registration number:
//
// - **The baseline**: the last numbers seen, per section, stamped with the
//   source they came from. A section with no baseline, or a baseline from the
//   OTHER portal, is seeded silently: a first sign-in is not news, and the two
//   portals name tests differently, so switching would otherwise announce every
//   mark as new.
// - **The pending list**: changes found but not yet shown. The pop-up reads it
//   and clears it on close. Changes found across several refreshes before the
//   student opens the app are merged, keeping the OLDEST "before" and the newest
//   "after", so the pop-up says how far a number moved since they last saw it,
//   not just since the last fetch.
//
// Nothing here leaves the device.

import { useSyncExternalStore } from "react";
import type { Attendance, Marks } from "@/types";
import { predict } from "./predictor";

/** One side of an attendance change. `margin` is classes to spare when safe,
 *  and minus the classes needed to get back when below the line. */
export type AttendanceSide = {
  attended: number;
  conducted: number;
  percentage: number;
  margin: number;
};

export type AttendanceUpdate = {
  kind: "attendance";
  id: string;
  code: string;
  title: string;
  category: string;
  threshold: number;
  before: AttendanceSide;
  after: AttendanceSide;
};

export type MarkUpdate = {
  kind: "mark";
  id: string;
  code: string;
  title: string;
  test: string;
  max: number;
  /** Null when the test is new. */
  before: number | null;
  after: number;
};

export type Update = AttendanceUpdate | MarkUpdate;

type Baseline = {
  attendance?: {
    source: string;
    rows: Record<string, { attended: number; conducted: number }>;
  };
  marks?: {
    source: string;
    rows: Record<string, Record<string, { scored: number; max: number }>>;
  };
};

const baseKey = (reg: string) => `skipp.updates.base.${reg}`;
const pendingKey = (reg: string) => `skipp.updates.pending.${reg}`;

/** Past this, the oldest are dropped. A list that long has stopped being news. */
const PENDING_CAP = 40;

/* ------------------------------------------------------------------ helpers */

export function side(attended: number, conducted: number, threshold: number): AttendanceSide {
  const p = predict(attended, conducted, threshold);
  return {
    attended,
    conducted,
    percentage: p.percentage,
    margin: p.isSafe ? p.canSkip : -p.mustAttend,
  };
}

/**
 * A stable key per row that survives a repeated code.
 *
 * A course has separate Theory and Practical rows sharing one code, and on the
 * marks table they can share a title too, so the n-th occurrence carries its
 * index rather than overwriting the first.
 */
function keyed<T>(items: T[], base: (t: T) => string): [string, T][] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const k = base(item);
    const n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    return [n === 0 ? k : `${k}#${n}`, item];
  });
}

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as T | null) : null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: the worst case is a change announced twice */
  }
}

/* --------------------------------------------------------------------- diff */

function attendanceRows(a: Attendance) {
  const rows: Record<string, { attended: number; conducted: number }> = {};
  const meta: Record<string, { code: string; title: string; category: string }> = {};
  for (const [k, s] of keyed(a.subjects, (s) => `${s.code}::${s.category}`)) {
    rows[k] = { attended: s.attended, conducted: s.conducted };
    meta[k] = { code: s.code, title: s.title || s.code, category: s.category };
  }
  return { rows, meta };
}

function marksRows(m: Marks) {
  const rows: Record<string, Record<string, { scored: number; max: number }>> = {};
  const meta: Record<string, { code: string; title: string }> = {};
  for (const [k, s] of keyed(m.subjects, (s) => s.code)) {
    const comps: Record<string, { scored: number; max: number }> = {};
    for (const [name, c] of keyed(s.components, (c) => c.name)) {
      // A test with no maximum is a placeholder the portal prints before it
      // has anything to say, not a mark.
      if (!(c.max > 0)) continue;
      comps[name] = { scored: c.scored, max: c.max };
    }
    rows[k] = comps;
    meta[k] = { code: s.code, title: s.title || s.code };
  }
  return { rows, meta };
}

/**
 * Compares what is on screen with the baseline, moves the baseline forward, and
 * queues anything that changed for the pop-up.
 *
 * Idempotent by construction: once the baseline has moved, the same data finds
 * nothing. That matters because the caller is an effect keyed on object
 * identity, and the same numbers can arrive as a fresh object more than once.
 *
 * Returns only what is NEW this call, so the caller can notify exactly once.
 */
export function detectUpdates(opts: {
  reg: string;
  attendance: Attendance | null;
  attendanceSource: string | null;
  marks: Marks | null;
  marksSource: string | null;
}): Update[] {
  const base = readJSON<Baseline>(baseKey(opts.reg)) ?? {};
  const next: Baseline = { ...base };
  const found: Update[] = [];

  if (opts.attendance && opts.attendanceSource) {
    const threshold = opts.attendance.threshold || 75;
    const { rows, meta } = attendanceRows(opts.attendance);
    const was = base.attendance;
    if (was && was.source === opts.attendanceSource) {
      for (const [k, now] of Object.entries(rows)) {
        const old = was.rows[k];
        // A subject never seen before is not a change, it is a new row.
        if (!old) continue;
        if (old.attended === now.attended && old.conducted === now.conducted) continue;
        found.push({
          kind: "attendance",
          id: `a:${k}`,
          code: meta[k].code,
          title: meta[k].title,
          category: meta[k].category,
          threshold,
          before: side(old.attended, old.conducted, threshold),
          after: side(now.attended, now.conducted, threshold),
        });
      }
    }
    next.attendance = { source: opts.attendanceSource, rows };
  }

  if (opts.marks && opts.marksSource) {
    const { rows, meta } = marksRows(opts.marks);
    const was = base.marks;
    if (was && was.source === opts.marksSource) {
      for (const [k, comps] of Object.entries(rows)) {
        // Unlike attendance, a subject absent last time IS news here: it is
        // what a subject looks like the day its first test is published.
        const old = was.rows[k] ?? {};
        for (const [name, c] of Object.entries(comps)) {
          const prev = old[name];
          if (prev && prev.scored === c.scored) continue;
          found.push({
            kind: "mark",
            id: `m:${k}::${name}`,
            code: meta[k].code,
            title: meta[k].title,
            // The occurrence suffix is a storage detail, never a test name.
            test: name.replace(/#\d+$/, ""),
            max: c.max,
            before: prev ? prev.scored : null,
            after: c.scored,
          });
        }
      }
    }
    next.marks = { source: opts.marksSource, rows };
  }

  if (JSON.stringify(next) !== JSON.stringify(base)) writeJSON(baseKey(opts.reg), next);
  if (found.length > 0) {
    writeJSON(pendingKey(opts.reg), merge(readPending(opts.reg), found).slice(-PENDING_CAP));
    emit();
  }
  return found;
}

function isNoop(u: Update): boolean {
  return u.kind === "attendance"
    ? u.before.attended === u.after.attended && u.before.conducted === u.after.conducted
    : u.before === u.after;
}

/** Oldest before, newest after. A change that has since undone itself goes. */
function merge(pending: Update[], found: Update[]): Update[] {
  const map = new Map(pending.map((u) => [u.id, u]));
  for (const u of found) {
    const prev = map.get(u.id);
    const merged = prev ? ({ ...u, before: prev.before } as Update) : u;
    map.delete(u.id); // re-inserted last, so the newest news reads last
    if (!isNoop(merged)) map.set(u.id, merged);
  }
  return [...map.values()];
}

/* ------------------------------------------------------------ pending store */

let listeners: (() => void)[] = [];
const emit = () => listeners.forEach((l) => l());

function subscribe(cb: () => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

function readPending(reg: string): Update[] {
  const list = readJSON<Update[]>(pendingKey(reg));
  return Array.isArray(list) ? list : [];
}

const EMPTY: Update[] = [];

/**
 * `useSyncExternalStore` needs the SAME array back while nothing has changed,
 * or it renders for ever. Parsing afresh each read would hand back a new one
 * every time, so the parse is cached against the raw string.
 */
const cache = new Map<string, { raw: string | null; list: Update[] }>();

function snapshot(reg: string | null): Update[] {
  if (!reg) return EMPTY;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(pendingKey(reg));
  } catch {
    return EMPTY;
  }
  const hit = cache.get(reg);
  if (hit && hit.raw === raw) return hit.list;
  const list = raw ? readPending(reg) : EMPTY;
  cache.set(reg, { raw, list });
  return list;
}

/** The changes waiting to be shown. Empty on the server and when signed out. */
export function usePendingUpdates(reg: string | null): Update[] {
  return useSyncExternalStore(
    subscribe,
    () => snapshot(reg),
    () => EMPTY,
  );
}

/** Seen. The baseline already moved when they were found, so they are gone. */
export function clearPendingUpdates(reg: string | null): void {
  if (!reg) return;
  try {
    localStorage.removeItem(pendingKey(reg));
  } catch {
    /* private mode */
  }
  emit();
}

/** Signing out forgets the student's numbers along with everything else. */
export function forgetUpdates(reg: string | null): void {
  if (!reg) return;
  try {
    localStorage.removeItem(baseKey(reg));
    localStorage.removeItem(pendingKey(reg));
  } catch {
    /* private mode */
  }
  emit();
}

/* ------------------------------------------------------------------ wording */

/** "13.5", never "13.50", and never a float artefact like "13.499999". */
export function fmtMark(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/** Classes newly recorded, and how many of those were missed. */
export function attendanceDelta(u: AttendanceUpdate) {
  const held = u.after.conducted - u.before.conducted;
  const present = u.after.attended - u.before.attended;
  return { held, present, missed: held - present };
}

/** What the portal recorded, in words. Shared by the pop-up and the tray. */
export function attendanceWhat(
  held: number,
  present: number,
  missed: number,
  u: AttendanceUpdate,
): string {
  if (held <= 0) return `Corrected to ${u.after.attended} of ${u.after.conducted}`;
  if (held === 1) return missed > 0 ? "Marked absent for 1 class" : "Marked present for 1 class";
  if (missed === 0) return `Present for all ${held} classes`;
  if (missed === held) return `Absent for all ${held} classes`;
  return `Absent for ${missed} of ${held} classes`;
}

/** Whether this change is bad news, which is the only thing that gets colour. */
export function attendanceTone(u: AttendanceUpdate): "risk" | "watch" | "neutral" {
  if (u.after.margin < 0) return "risk";
  if (u.after.percentage < u.before.percentage) return "watch";
  return "neutral";
}
