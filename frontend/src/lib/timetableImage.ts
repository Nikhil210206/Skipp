"use client";

// Exports the whole timetable as one printable grid: day orders down the side,
// periods across the top, the way a timetable is pinned to a wall.
//
// Drawn by hand on a canvas rather than screenshotting the DOM: no dependency,
// independent of scroll position and viewport, and it can be laid out landscape
// for a grid instead of following the app's phone column.

import type { CustomClass, DayOrderSchedule } from "@/types";
import { fmtTime } from "./schedule";

const PAD = 64;
const LABEL_W = 150;
const COL_W = 178;
const TITLE_H = 132;
const HEAD_H = 88;
const ROW_H = 156;
const FOOT_H = 104;
const SCALE = 2; // export at 2x so it stays crisp when zoomed or printed

type Meta = {
  studentName: string;
  section: string | null;
  academicYear: string | null;
};

function token(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/** The portal stores names in caps; a shared sheet should not shout. */
function tidyName(name: string): string {
  if (!name || name !== name.toUpperCase()) return name;
  return name.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

type Placed = { item: CustomClass; from: number; to: number };

/**
 * Classes the student added carry a real time but no period number. Each one is
 * spanned across every column its time actually overlaps, so a 09:00 to 10:00
 * class reads across the periods it really covers instead of being collapsed
 * into whichever period happens to contain its start.
 */
function placeCustom(
  custom: CustomClass[],
  periods: Map<number, { start: string; end: string; startMin: number; endMin: number }>,
  hours: number[],
): Map<number, Placed[]> {
  const byDay = new Map<number, Placed[]>();
  for (const c of custom) {
    const covered = hours
      .map((h, i) => ({ h, i, p: periods.get(h)! }))
      .filter(({ p }) => c.startMin < p.endMin && c.endMin > p.startMin)
      .map(({ i }) => i);

    let from: number;
    let to: number;
    if (covered.length > 0) {
      from = covered[0];
      to = covered[covered.length - 1];
    } else {
      // Outside the official day entirely: sit against the nearest period.
      const nearest = hours.reduce(
        (best, h, i) =>
          Math.abs(periods.get(h)!.startMin - c.startMin) <
          Math.abs(periods.get(hours[best])!.startMin - c.startMin)
            ? i
            : best,
        0,
      );
      from = nearest;
      to = nearest;
    }
    byDay.set(c.dayOrder, [...(byDay.get(c.dayOrder) ?? []), { item: c, from, to }]);
  }
  return byDay;
}

export async function downloadTimetableGrid(
  dayOrders: DayOrderSchedule[],
  custom: CustomClass[],
  meta: Meta,
): Promise<void> {
  if (dayOrders.length === 0) return;
  // Without this the first export can land in a fallback face.
  if (document.fonts?.ready) await document.fonts.ready;

  // Periods are the columns. Collect every hour that any day order uses, so a
  // day with an extra late period still gets a column.
  const periods = new Map<
    number,
    { start: string; end: string; startMin: number; endMin: number }
  >();
  for (const d of dayOrders) {
    for (const c of d.classes) {
      if (!periods.has(c.hour)) {
        periods.set(c.hour, {
          start: c.start,
          end: c.end,
          startMin: c.startMin,
          endMin: c.endMin,
        });
      }
    }
  }
  const hours = [...periods.keys()].sort((a, b) => a - b);
  if (hours.length === 0) return;

  const customByDay = placeCustom(custom, periods, hours);
  const rows = [...dayOrders].sort((a, b) => a.dayOrder - b.dayOrder);
  const gridW = LABEL_W + hours.length * COL_W;
  const W = PAD * 2 + gridW;
  const H = PAD * 2 + TITLE_H + HEAD_H + rows.length * ROW_H + FOOT_H;

  const family = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  const ink = token("--color-ink-0", "#08080a");
  const line = token("--color-line", "#24242b");
  const soft = token("--color-line-soft", "#17171c");
  const text1 = token("--color-text-1", "#f4f4f6");
  const text3 = token("--color-text-3", "#6b6b75");
  const accent = token("--color-accent", "#f2661c");
  // Not a theme token: this blue exists only to mark the student's own classes
  // in the export, where the accent already means "lab".
  const mineBlue =
    document.documentElement.dataset.theme === "light" ? "#1D6FE0" : "#5A9DFF";

  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = ink;
  ctx.fillRect(0, 0, W, H);

  const gridX = PAD;
  const gridY = PAD + TITLE_H;

  // ---- Title ---------------------------------------------------------------
  ctx.fillStyle = text3;
  ctx.font = `600 24px ${family}`;
  ctx.letterSpacing = "2px";
  ctx.fillText("TIMETABLE", PAD, PAD + 34);
  ctx.letterSpacing = "0px";

  ctx.fillStyle = text1;
  ctx.font = `700 60px ${family}`;
  ctx.fillText(tidyName(meta.studentName) || "My timetable", PAD - 3, PAD + 100);

  const sub = [meta.section, meta.academicYear].filter(Boolean).join("  ·  ");
  if (sub) {
    ctx.fillStyle = text3;
    ctx.font = `400 26px ${family}`;
    const w = ctx.measureText(sub).width;
    ctx.fillText(sub, PAD + gridW - w, PAD + 100);
  }

  // ---- Column headers ------------------------------------------------------
  hours.forEach((h, i) => {
    const x = gridX + LABEL_W + i * COL_W;
    const p = periods.get(h)!;
    ctx.fillStyle = text3;
    ctx.font = `600 21px ${family}`;
    ctx.letterSpacing = "1.5px";
    ctx.fillText(`P${h}`, x + 18, gridY + 34);
    ctx.letterSpacing = "0px";
    ctx.font = `400 21px ${family}`;
    ctx.fillText(`${p.start}`, x + 18, gridY + 64);
  });

  // A heavier rule closes the header band.
  ctx.fillStyle = line;
  ctx.fillRect(gridX, gridY + HEAD_H - 1, gridW, 2);

  // ---- Rows ----------------------------------------------------------------
  rows.forEach((row, r) => {
    const y = gridY + HEAD_H + r * ROW_H;
    const byHour = new Map(row.classes.map((c) => [c.hour, c]));

    if (r > 0) {
      ctx.fillStyle = soft;
      ctx.fillRect(gridX, y, gridW, 1);
    }

    // Day order label
    ctx.fillStyle = text3;
    ctx.font = `600 20px ${family}`;
    ctx.letterSpacing = "1.5px";
    ctx.fillText("DAY ORDER", gridX, y + 54);
    ctx.letterSpacing = "0px";
    ctx.fillStyle = text1;
    ctx.font = `700 62px ${family}`;
    ctx.fillText(String(row.dayOrder), gridX, y + 120);

    hours.forEach((h, i) => {
      const x = gridX + LABEL_W + i * COL_W;
      const c = byHour.get(h);
      if (!c) return;

      ctx.fillStyle = c.isLab ? accent : text1;
      ctx.font = `700 34px ${family}`;
      ctx.fillText(fit(ctx, c.abbrev, COL_W - 34), x + 18, y + 66);

      ctx.fillStyle = text3;
      ctx.font = `400 21px ${family}`;
      ctx.fillText(fit(ctx, c.room ?? "", COL_W - 34), x + 18, y + 98);
    });

    // Added classes are drawn last so their outline sits above the grid, and
    // spanned across the columns their real time covers.
    for (const { item, from, to } of customByDay.get(row.dayOrder) ?? []) {
      const left = gridX + LABEL_W + from * COL_W - 12 + 8;
      const right = gridX + LABEL_W + (to + 1) * COL_W - 12 - 8;
      const top = y + 14;
      const bottom = y + ROW_H - 14;

      ctx.save();
      ctx.strokeStyle = mineBlue;
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.roundRect(left, top, right - left, bottom - top, 10);
      ctx.stroke();
      ctx.restore();

      const innerW = right - left - 28;
      ctx.fillStyle = mineBlue;
      ctx.font = `700 26px ${family}`;
      ctx.fillText(fit(ctx, item.title || item.abbrev, innerW), left + 14, top + 42);

      // The real time, and the venue where the official cells carry theirs.
      ctx.font = `400 20px ${family}`;
      const detail = [
        `${fmtTime(item.startMin)} to ${fmtTime(item.endMin)}`,
        item.room,
      ]
        .filter(Boolean)
        .join("  ·  ");
      ctx.fillText(fit(ctx, detail, innerW), left + 14, top + 72);
    }
  });

  // Column separators, drawn over the rows so the grid reads as one object.
  ctx.fillStyle = soft;
  for (let i = 0; i <= hours.length; i++) {
    const x = gridX + LABEL_W + i * COL_W;
    ctx.fillRect(x - 12, gridY + HEAD_H, 1, rows.length * ROW_H);
  }

  // ---- Footer --------------------------------------------------------------
  const footY = gridY + HEAD_H + rows.length * ROW_H;
  ctx.fillStyle = line;
  ctx.fillRect(gridX, footY + 32, gridW, 1);

  ctx.fillStyle = text1;
  ctx.font = `700 30px ${family}`;
  ctx.fillText("skipp", gridX, footY + 84);

  ctx.fillStyle = text3;
  ctx.font = `400 22px ${family}`;
  const note =
    custom.length > 0
      ? "Accent marks a lab · dotted blue is a class you added · optional courses excluded"
      : "Accent marks a lab · optional courses excluded";
  const nw = ctx.measureText(note).width;
  ctx.fillText(note, gridX + gridW - nw, footY + 82);

  // ---- Save ----------------------------------------------------------------
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "skipp-timetable.png";
  // A browser that ignores `download` would otherwise navigate the app away to
  // the image; opening in a new context keeps the app on screen either way.
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking straight away can cancel the download before the blob is read.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
