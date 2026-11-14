"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { useSession } from "@/context/SessionContext";
import { Modal } from "@/components/ui/Overlay";
import { Button, Label } from "@/components/ui";
import { SectionHead, TrackRule } from "@/components/ui/editorial";
import { IconArrowRight, IconCheck } from "@/components/Icons";
import { DUR, EASE, prefersReducedMotion } from "@/lib/motion";
import { haptic } from "@/lib/haptics";
import { useNoticeHold } from "@/lib/whatsNew";
import {
  attendanceDelta,
  attendanceTone,
  attendanceWhat,
  clearPendingUpdates,
  fmtMark,
  usePendingUpdates,
  type AttendanceUpdate,
  type MarkUpdate,
  type Update,
} from "@/lib/updates";
import {
  blockedUntilInstalled,
  enableNotifications,
  notificationPermission,
  notificationsOn,
  notificationsSupported,
} from "@/lib/notify";

/**
 * WHAT CHANGED, the first time Skipp is opened after the portal moves.
 *
 * Every change is a row that arrives already showing the OLD number, which is
 * then struck through while the digits roll over to the new one, like a
 * departures board updating in front of you. The track under each row slides
 * from where it was to where it is, and the margin beside it rolls with it. The
 * rows go one after another, so a morning with five changes reads as five
 * separate pieces of news rather than one wall.
 *
 * The old number is rendered first and the new one replaces it, rather than the
 * new one simply appearing, because "from this to this" is the whole message:
 * a figure on its own says where you are, the roll says what just happened.
 *
 * Colour follows the house rule. A rise stays neutral; a drop is amber; a drop
 * that crosses below the line is red. A healthy morning is quiet.
 *
 * The markup is rendered at the NEW values. The animation winds it back to the
 * old ones before the first paint and rolls it forward, so if the animation
 * never runs (reduced motion, or anything going wrong) the student is still
 * looking at the right numbers.
 */
export default function WhatChanged({ blocked }: { blocked: boolean }) {
  const router = useRouter();
  const { student } = useSession();
  const reg = student?.registrationNumber ?? null;
  const pending = usePendingUpdates(reg);

  const waiting = pending.length > 0 && !blocked;
  // After the launch, and never on top of another dialog: the portal prompt,
  // the leave planner or a notice may already be up, and two modals stacked is
  // one too many. It waits for the stage to clear rather than queueing in a
  // list every other overlay would have to know about.
  const held = useNoticeHold(waiting);
  const clear = useClearStage(waiting && held);

  // Latched, so that once it is up nothing else can pull it down, and the rows
  // survive the exit animation after the pending list has been cleared.
  const [risen, setRisen] = useState(false);
  const [shown, setShown] = useState<Update[]>([]);
  if (waiting && held && clear && !risen) setRisen(true);
  if (risen && pending.length === 0) setRisen(false);
  if (pending.length > 0 && pending !== shown) setShown(pending);
  const open = risen && pending.length > 0;

  const { attendance, marks } = useMemo(() => split(shown), [shown]);
  const total = attendance.length + marks.length;

  const close = () => clearPendingUpdates(reg);
  const go = (href: string) => {
    close();
    router.push(href);
  };

  const root = useRef<HTMLDivElement>(null);
  const sig = shown.map((u) => u.id).join("|");
  useLayoutEffect(() => {
    const el = root.current;
    if (!open || !el) return;
    const ctx = gsap.context(() => play(el), el);
    // Killed, not reverted: a revert would wind every figure back to its old
    // value in full view as the pop-up leaves.
    return () => ctx.kill();
  }, [open, sig]);

  const notify = useNotifyOffer(open);

  return (
    <Modal
      open={open}
      onClose={close}
      label="What changed"
      maxWidth="max-w-sm"
      footer={
        <div className="flex items-center gap-2">
          {notify.state === "off" && (
            <Button variant="quiet" onClick={notify.turnOn} disabled={notify.busy}>
              Notify me
            </Button>
          )}
          {notify.state === "on" && (
            <span className="inline-flex min-h-11 items-center gap-1.5 px-2 text-callout text-text-3">
              <IconCheck size={16} />
              Notifications on
            </span>
          )}
          <Button onClick={close} className="ml-auto min-w-28">
            Got it
          </Button>
        </div>
      }
    >
      <div ref={root}>
        <Label className="pt-1">
          <span data-wc-in className="inline-block">
            Since you last looked
          </span>
        </Label>
        {/* Short on purpose: it is one line at 320 wide, where "5 things
            moved" broke in two with the count stranded on the second line. */}
        <h2 className="mt-2 flex items-end gap-[0.25em] whitespace-nowrap text-hero" data-wc-in>
          <Odometer from="" to={String(total)} />
          <span>{total === 1 ? "update" : "updates"}</span>
        </h2>
        <p data-wc-in className="mt-2 text-callout text-text-2">
          {summary(attendance, marks)}
        </p>

        {attendance.length > 0 && (
          <section className="mt-6">
            <div data-wc-in>
              <SectionHead aside={attendance.length}>Attendance</SectionHead>
            </div>
            <ul>
              {attendance.map((u) => (
                <AttendanceRow key={u.id} u={u} onOpen={() => go("/attendance")} />
              ))}
            </ul>
          </section>
        )}

        {marks.length > 0 && (
          <section className="mt-6">
            <div data-wc-in>
              <SectionHead aside={marks.length}>Marks</SectionHead>
            </div>
            <ul>
              {marks.map((u) => (
                <MarkRow key={u.id} u={u} onOpen={() => go("/marks")} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------- rows */

const TONE_TEXT = { risk: "text-risk", watch: "text-watch", neutral: "text-text-1" } as const;

function AttendanceRow({ u, onOpen }: { u: AttendanceUpdate; onOpen: () => void }) {
  const tone = attendanceTone(u);
  const { held, present, missed } = attendanceDelta(u);
  const lab = /lab|practical/i.test(u.category);
  const before = u.before.percentage.toFixed(1);
  const after = u.after.percentage.toFixed(1);
  const short = u.after.margin < 0;
  const what = attendanceWhat(held, present, missed, u);
  const verdict =
    u.after.margin < 0
      ? `attend ${-u.after.margin} to get back to ${u.threshold}%`
      : u.before.margin < 0
        ? `back above ${u.threshold}%`
        : u.after.margin === 0
          ? "no skips left"
          : null;

  return (
    <li data-wc-row className="border-b border-line-soft last:border-b-0">
      <button
        onClick={onOpen}
        className="block w-full py-4 text-left"
        aria-label={`${u.title}, ${before}% to ${after}%. ${what}.`}
      >
        <span className="flex items-start justify-between gap-4">
          <span className="min-w-0">
            <span className="block text-body text-text-1">
              {u.title}
              {lab && <span className="text-text-3"> · Lab</span>}
            </span>
            <span className="mt-1.5 flex items-end gap-2">
              <Was>{before}%</Was>
              <IconArrowRight size={14} className="mb-[0.15em] shrink-0 text-text-3" />
              <Odometer
                from={`${before}%`}
                to={`${after}%`}
                className={`text-title ${TONE_TEXT[tone]}`}
              />
            </span>
          </span>
          {/* The margin hangs on the right, as it does on Attendance, because
              it is the decision: how many more you can miss. */}
          <span className="flex shrink-0 flex-col items-end">
            <Odometer
              from={String(Math.abs(u.before.margin))}
              to={String(Math.abs(u.after.margin))}
              className={`text-title ${short ? "text-risk" : "text-text-1"}`}
            />
            <span data-wc-pop className="mt-1 text-label uppercase text-text-3">
              {short ? "Short" : "To spare"}
            </span>
          </span>
        </span>
        <span className="mt-3 block">
          <Track from={u.before.percentage} to={u.after.percentage} threshold={u.threshold} />
        </span>
        <span className="mt-2.5 block text-callout text-text-3">
          {what}
          {verdict && (
            // Faded in, never scaled: a transform needs an inline block,
            // and an inline block cannot break, so a long verdict jumped to a
            // line of its own with its comma at the front.
            <span data-wc-soft className={tone === "risk" ? "text-risk" : undefined}>
              , {verdict}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

function MarkRow({ u, onOpen }: { u: MarkUpdate; onOpen: () => void }) {
  const [from, to] = pairDecimals(u.before, u.after);
  const pct = u.max > 0 ? (u.after / u.max) * 100 : 0;
  const was = u.before === null ? 0 : (u.before / u.max) * 100;
  // A bad score is trouble too. Half marks is the line the grade scale itself
  // fails at, so it is the honest place to start colouring.
  const low = pct < 50;
  return (
    <li data-wc-row className="border-b border-line-soft last:border-b-0">
      <button
        onClick={onOpen}
        className="block w-full py-4 text-left"
        aria-label={`${u.title}, ${u.test}: ${fmtMark(u.after)} out of ${fmtMark(u.max)}${
          u.before === null ? ", new" : `, was ${fmtMark(u.before)}`
        }.`}
      >
        <span className="flex items-start justify-between gap-4">
          <span className="min-w-0">
            <span className="block text-body text-text-1">{u.title}</span>
            <span className="mt-1 flex items-center gap-2 text-callout text-text-3">
              {u.test}
              {u.before === null ? (
                <span data-wc-pop className="inline-block text-label uppercase text-text-2">
                  New
                </span>
              ) : (
                <>
                  <span className="text-label uppercase">was</span>
                  <Was>{fmtMark(u.before)}</Was>
                </>
              )}
            </span>
          </span>
          <span className="flex shrink-0 items-end gap-0.5">
            <Odometer from={from} to={to} className={`text-title ${low ? "text-watch" : "text-text-1"}`} />
            <span className="mb-[0.1em] text-callout leading-none text-text-3">
              /{fmtMark(u.max)}
            </span>
          </span>
        </span>
        <span className="mt-3 block">
          <Track from={was} to={pct} />
        </span>
      </button>
    </li>
  );
}

/** The old value, about to be crossed out. */
function Was({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-block tnum text-callout leading-none text-text-3 mb-[0.15em]">
      {children}
      <span
        data-wc-strike
        aria-hidden
        className="absolute inset-x-[-2px] top-1/2 h-px origin-left bg-current"
      />
    </span>
  );
}

/** The house meter, rendered at the new value and wound back by `play`. */
function Track({ from, to, threshold }: { from: number; to: number; threshold?: number }) {
  return (
    <span className="block" data-wc-track data-from={clampPct(from)} data-to={clampPct(to)}>
      <TrackRule value={to} threshold={threshold} />
    </span>
  );
}

/* --------------------------------------------------------------- odometer */

/** Cell 0 is blank, cells 1 to 10 are the digits 0 to 9. */
const CELLS = 11;
const cell = (ch: string | undefined) => (ch && /\d/.test(ch) ? Number(ch) + 1 : 0);
const rollable = (ch: string | undefined) => ch === undefined || ch === " " || /\d/.test(ch);

/**
 * Digits on reels, wound from one value to another.
 *
 * Both strings are right aligned, so 9.5% against 10.2% lines its decimal
 * points up, and a reel can roll in from blank, which is how a mark that did
 * not exist yesterday arrives. Separators and units that are the same on both
 * sides stand still; one that only exists on the new side fades in.
 */
function Odometer({ from, to, className = "" }: { from: string; to: string; className?: string }) {
  const n = Math.max(from.length, to.length);
  const a = from.padStart(n, " ");
  const b = to.padStart(n, " ");
  return (
    <span className={`tnum inline-flex leading-none ${className}`}>
      <span className="sr-only">{to}</span>
      {Array.from(b).map((ch, i) => {
        const was = a[i];
        if (ch === " " && was === " ") return null;
        if (rollable(ch) && rollable(was)) {
          const end = cell(ch);
          return (
            <span key={i} aria-hidden className="inline-block h-[1em] overflow-hidden">
              <span
                data-odo-col
                data-from={cell(was)}
                data-to={end}
                className="flex flex-col will-change-transform"
                style={{ transform: `translateY(${(-end * 100) / CELLS}%)` }}
              >
                {Array.from({ length: CELLS }, (_, d) => (
                  <span key={d} className="block h-[1em]">
                    {d === 0 ? " " : d - 1}
                  </span>
                ))}
              </span>
            </span>
          );
        }
        return (
          <span
            key={i}
            aria-hidden
            data-odo-fade={was !== ch ? "" : undefined}
            className="inline-block h-[1em]"
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
}

/* -------------------------------------------------------------- the show */

function play(el: HTMLElement) {
  const reduced = prefersReducedMotion();
  const cols = (scope: ParentNode) => scope.querySelectorAll<HTMLElement>("[data-odo-col]");
  const fills = (scope: ParentNode) =>
    Array.from(scope.querySelectorAll<HTMLElement>("[data-wc-track]"));
  const pos = (c: HTMLElement, key: "from" | "to") => (-Number(c.dataset[key]) * 100) / CELLS;
  const setFill = (t: HTMLElement, key: "from" | "to") => {
    const fill = t.querySelector<HTMLElement>("[data-meter-fill]");
    if (fill) gsap.set(fill, { width: `${t.dataset[key]}%`, "--v": `${t.dataset[key]}%` });
  };

  if (reduced) {
    // The figures already stand at their new values. Nothing moves.
    return;
  }

  // Wind everything back to how it was. Layout effect, so this is the first
  // frame the student sees.
  // `y: 0` as well. The reels are rendered with an inline translate at their
  // NEW value, and GSAP reads that back as a pixel `y`, then stacks `yPercent`
  // on top of it: every reel landed on the wrong digit until this was zeroed.
  cols(el).forEach((c) => gsap.set(c, { y: 0, yPercent: pos(c, "from") }));
  fills(el).forEach((t) => setFill(t, "from"));
  gsap.set(el.querySelectorAll("[data-wc-strike]"), { scaleX: 0 });
  gsap.set(el.querySelectorAll("[data-odo-fade]"), { opacity: 0 });
  gsap.set(el.querySelectorAll("[data-wc-pop]"), { opacity: 0, scale: 0.6 });
  gsap.set(el.querySelectorAll("[data-wc-soft]"), { opacity: 0 });

  const tl = gsap.timeline({ delay: 0.12 });
  tl.fromTo(
    el.querySelectorAll("[data-wc-in]"),
    { opacity: 0, y: 10 },
    { opacity: 1, y: 0, duration: DUR.base, ease: EASE.out, stagger: 0.05 },
    0,
  );

  // The header count rolls up first: how much news, before the news.
  const head = el.querySelector("h2");
  if (head) {
    tl.to(cols(head), { yPercent: (_i, c: HTMLElement) => pos(c, "to"), duration: 0.8, ease: EASE.emphasis, stagger: 0.05 }, 0.1);
    tl.to(head.querySelectorAll("[data-odo-fade]"), { opacity: 1, duration: DUR.quick }, 0.1);
  }

  const rows = Array.from(el.querySelectorAll<HTMLElement>("[data-wc-row]"));
  // Each row gets its own beat, but a busy morning cannot take all day: the
  // gap shrinks as the list grows, and the whole run stays under two seconds.
  const step = Math.min(0.32, 1.7 / Math.max(1, rows.length));
  rows.forEach((row, i) => {
    const at = 0.4 + i * step;
    tl.fromTo(row, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: EASE.spring }, at);
    // The old number is crossed out, then the reels turn.
    tl.to(row.querySelectorAll("[data-wc-strike]"), { scaleX: 1, duration: 0.26, ease: EASE.out }, at + 0.22);
    tl.call(() => haptic("tick"), [], at + 0.4);
    tl.to(
      cols(row),
      { yPercent: (_i, c: HTMLElement) => pos(c, "to"), duration: 0.95, ease: EASE.emphasis, stagger: 0.035 },
      at + 0.4,
    );
    tl.to(row.querySelectorAll("[data-odo-fade]"), { opacity: 1, duration: DUR.quick }, at + 0.5);
    fills(row).forEach((t) => {
      const fill = t.querySelector<HTMLElement>("[data-meter-fill]");
      if (!fill) return;
      tl.to(fill, { width: `${t.dataset.to}%`, "--v": `${t.dataset.to}%`, duration: 0.95, ease: EASE.emphasis }, at + 0.4);
    });
    tl.to(
      row.querySelectorAll("[data-wc-pop]"),
      { opacity: 1, scale: 1, duration: 0.42, ease: EASE.pop, stagger: 0.06 },
      at + 0.75,
    );
    tl.to(row.querySelectorAll("[data-wc-soft]"), { opacity: 1, duration: DUR.base, ease: EASE.out }, at + 0.85);
  });
}

/* ---------------------------------------------------------------- helpers */

function split(list: Update[]) {
  const rank = { risk: 0, watch: 1, neutral: 2 } as const;
  const attendance = list
    .filter((u): u is AttendanceUpdate => u.kind === "attendance")
    .sort((x, y) => rank[attendanceTone(x)] - rank[attendanceTone(y)]);
  // New tests first: a score that changed is a correction, a new one is news.
  const marks = list
    .filter((u): u is MarkUpdate => u.kind === "mark")
    .sort((x, y) => Number(x.before !== null) - Number(y.before !== null));
  return { attendance, marks };
}

function summary(att: AttendanceUpdate[], marks: MarkUpdate[]): string {
  const parts: string[] = [];
  const subjects = (n: number) => `${n} subject${n === 1 ? "" : "s"}`;
  if (att.length > 0) {
    const down = att.filter((u) => attendanceDelta(u).missed > 0).length;
    parts.push(
      down === 0
        ? `attendance went up in ${subjects(att.length)}`
        : down === att.length
          ? `marked absent in ${subjects(down)}`
          : `attendance moved in ${subjects(att.length)}, absent in ${down}`,
    );
  }
  if (marks.length > 0) {
    const fresh = marks.filter((u) => u.before === null).length;
    const changed = marks.length - fresh;
    parts.push(
      changed === 0
        ? `${fresh} new mark${fresh === 1 ? "" : "s"}`
        : fresh === 0
          ? `${changed} mark${changed === 1 ? "" : "s"} changed`
          : `${fresh} new mark${fresh === 1 ? "" : "s"} and ${changed} changed`,
    );
  }
  const line = parts.join("; ");
  return `${line.charAt(0).toUpperCase()}${line.slice(1)}. Tap one to open it.`;
}

/** Same number of decimals on both sides, so the reels line up. */
function pairDecimals(before: number | null, after: number): [string, string] {
  const dec = (n: number) => (Number.isInteger(n) ? 0 : fmtMark(n).split(".")[1]?.length ?? 0);
  const d = Math.min(2, Math.max(dec(after), before === null ? 0 : dec(before)));
  return [before === null ? "" : before.toFixed(d), after.toFixed(d)];
}

const clampPct = (n: number) => Math.max(0, Math.min(100, n));

/**
 * True while no other modal is open.
 *
 * Asked of the page rather than of a shared store, because the overlays that
 * could be up (the portal prompt, the leave planner, a notice) each own their
 * own state and none of them should have to know this one exists.
 */
function useClearStage(active: boolean): boolean {
  const [clear, setClear] = useState(false);
  useEffect(() => {
    if (!active) return;
    const check = () =>
      setClear(document.querySelector('[role="dialog"][aria-modal="true"]') === null);
    const t = window.setTimeout(check, 0);
    const watch = new MutationObserver(check);
    watch.observe(document.body, { childList: true });
    return () => {
      window.clearTimeout(t);
      watch.disconnect();
    };
  }, [active]);
  return active && clear;
}

/**
 * The quiet offer to get these as notifications next time, shown only where
 * it would work: supported, not refused, and (on an iPhone) installed.
 */
function useNotifyOffer(open: boolean) {
  const [state, setState] = useState<"hidden" | "off" | "on">("hidden");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    // After an await, never synchronously in the effect: the compiler lint
    // rejects a setState in an effect body.
    void Promise.resolve().then(() => {
      if (!alive) return;
      const offerable =
        notificationsSupported() &&
        !blockedUntilInstalled() &&
        notificationPermission() !== "denied" &&
        !notificationsOn();
      setState(offerable ? "off" : "hidden");
    });
    return () => {
      alive = false;
    };
  }, [open]);

  async function turnOn() {
    setBusy(true);
    try {
      const ok = await enableNotifications();
      setState(ok ? "on" : "hidden");
      if (ok) haptic("select");
    } finally {
      setBusy(false);
    }
  }
  return { state, busy, turnOn };
}
