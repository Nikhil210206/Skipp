"use client";

// ============================================================
// THE HAND-DRAWN KIT, for Register and Ticket.
//
// Doodled accents, not a sketchbook: the layout stays clean and
// every number stays in a real face, while the marks a student
// would make with a pen are drawn by hand: a scribbled bar with
// an arrow at your mark, a margin note, a pencilled rule.
//
// Every wobble is SEEDED, so a mark looks the same on every
// render and never shimmers as React re-renders. And the hand
// face (Caveat) never sets a number: it has no tabular figures,
// so a note says "you're here", never "you're at 82%".
// ============================================================

import { useId } from "react";

/** A small seeded random, so a doodle is the same doodle every time. */
function rand(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296 - 0.5;
  };
}

/** Points to a smooth path (Catmull-Rom as cubic Beziers), so jitter reads as a hand, not a zigzag. */
function smooth(points: [number, number][], closed = false): string {
  const p = closed ? [points[points.length - 1], ...points, points[0], points[1]] : [points[0], ...points, points[points.length - 1]];
  let d = `M${p[1][0].toFixed(1)} ${p[1][1].toFixed(1)}`;
  for (let i = 1; i < p.length - 2; i++) {
    const [x0, y0] = p[i - 1];
    const [x1, y1] = p[i];
    const [x2, y2] = p[i + 1];
    const [x3, y3] = p[i + 2];
    const c1x = x1 + (x2 - x0) / 6;
    const c1y = y1 + (y2 - y0) / 6;
    const c2x = x2 - (x3 - x1) / 6;
    const c2y = y2 - (y3 - y1) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  return closed ? `${d} Z` : d;
}

/** A rounded box drawn by hand: corners that do not quite meet, sides that bow. */
function handBox(w: number, h: number, r: number, seed: number, amp = 1.1): string {
  const j = rand(seed);
  const pts: [number, number][] = [];
  const side = (x0: number, y0: number, x1: number, y1: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const t = i / n;
      pts.push([x0 + (x1 - x0) * t + j() * amp, y0 + (y1 - y0) * t + j() * amp]);
    }
  };
  side(r, 0, w - r, 0, 6);
  pts.push([w - r * 0.3, r * 0.3]);
  side(w, r, w, h - r, 2);
  pts.push([w - r * 0.3, h - r * 0.3]);
  side(w - r, h, r, h, 6);
  pts.push([r * 0.3, h - r * 0.3]);
  side(0, h - r, 0, r, 2);
  pts.push([r * 0.3, r * 0.3]);
  return smooth(pts, true);
}

// ---------- the sketched bar ----------------------------------------

/**
 * The term, or a subject, as one bar drawn in pen: a hand-drawn outline,
 * hatched in up to the percentage, with the 75% line drawn across it and an
 * arrow saying where you are.
 *
 * `compact` is the subject row's version: shorter, with no arrow and no label,
 * because the row's own words already say what it is. It REPLACED a line of
 * tallies, crosses and dashed rings, which was reported as hard to read: a
 * count you have to count is not an answer.
 *
 * Drawn on a 300-wide viewBox stretched to the column, with every stroke
 * `non-scaling-stroke`, so the pen keeps its weight at any width.
 */
export function HandBar({
  value,
  threshold = 75,
  tone = "ink",
  dark = false,
  note = "you're here",
  seed = 7,
  compact = false,
}: {
  value: number;
  threshold?: number;
  tone?: "ink" | "risk" | "watch";
  dark?: boolean;
  note?: string | null;
  seed?: number;
  compact?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const v = Math.max(0, Math.min(100, value));
  const W = 300;
  const H = 36;
  const fillX = (v / 100) * W;
  const lineX = (threshold / 100) * W;
  const ink = dark ? "var(--look-on-deep)" : "var(--color-text-1)";
  const fill =
    tone === "risk" ? "var(--color-risk)" : tone === "watch" ? "var(--look-watch)" : dark ? "var(--look-on-deep)" : "var(--color-text-1)";
  const j = rand(seed + 3);
  const hatch: string[] = [];
  for (let x = -30; x < fillX + 8; x += 7) {
    const a = x + j() * 1.6;
    hatch.push(`M${a.toFixed(1)} ${(H - 4).toFixed(1)} L${(a + 20 + j() * 3).toFixed(1)} 4`);
  }
  const outline = handBox(W, H, 12, seed);
  const linePath = smooth([
    [lineX + j() * 1.2, -7],
    [lineX + j() * 1.6, H / 2],
    [lineX + j() * 1.2, H + 7],
  ]);
  // The arrow's tip lands on the end of the fill. Past halfway the note hangs
  // to the LEFT of the arrow, so a long note never runs off the column; short
  // of halfway it hangs to the right, so it never runs off the other side.
  const leftward = v > 50;
  const color = dark ? "var(--look-on-deep)" : "var(--color-text-2)";

  return (
    <div className="relative" aria-hidden>
      {note && !compact && (
        <div
          className={`relative mb-1 flex h-7 items-end gap-0.5 ${leftward ? "justify-end" : ""}`}
          style={leftward ? { paddingRight: `${Math.max(0, 100 - v - 1)}%`, color } : { paddingLeft: `${Math.max(0, v - 1)}%`, color }}
        >
          {leftward && <span className="whitespace-nowrap font-hand text-note">{note}</span>}
          <svg
            width="22"
            height="22"
            viewBox="0 0 22 22"
            className="-mb-2 shrink-0 overflow-visible"
            style={leftward ? undefined : { transform: "scaleX(-1)" }}
          >
            <path d="M2 3 C 10 4, 15 9, 16 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M11.5 14.5 L 16 19 L 19 13.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {!leftward && <span className="whitespace-nowrap font-hand text-note">{note}</span>}
        </div>
      )}
      <svg viewBox={`-2 -8 ${W + 4} ${H + 16}`} preserveAspectRatio="none" className={`block w-full overflow-visible ${compact ? "h-7" : "h-12"}`}>
        <defs>
          <clipPath id={`f${id}`}>
            <rect x="0" y="0" width={Math.max(0, fillX)} height={H} />
          </clipPath>
          <clipPath id={`o${id}`}>
            <path d={outline} />
          </clipPath>
        </defs>
        <g clipPath={`url(#o${id})`}>
          <g clipPath={`url(#f${id})`} data-hand-hatch>
            {hatch.map((d, i) => (
              <path key={i} d={d} stroke={fill} strokeWidth="2.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            ))}
          </g>
        </g>
        <path d={outline} fill="none" stroke={ink} strokeWidth="2.2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <path d={linePath} fill="none" stroke={dark ? "var(--look-loud)" : "var(--color-text-1)"} strokeWidth="2.4" strokeLinecap="round" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
      </svg>
      {!compact && (
        <div className="relative h-5">
          <span
            className="absolute top-0.5 -translate-x-1/2 whitespace-nowrap font-hand text-note-sm"
            style={{ left: `${threshold}%`, color: dark ? "var(--look-deep-dim)" : "var(--color-text-3)" }}
          >
            the line
          </span>
        </div>
      )}
    </div>
  );
}

// ---------- notes and rules --------------------------------

/** A margin note in the hand. Words only, never a figure. */
export function HandNote({
  children,
  className = "",
  tilt = -3,
}: {
  children: React.ReactNode;
  className?: string;
  tilt?: number;
}) {
  return (
    <span
      className={`inline-block font-hand text-note ${className}`}
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      {children}
    </span>
  );
}

/** A wobbly pencil rule, for the places a ruler would have drawn a straight one. */
export function HandRule({ className = "", strong = false }: { className?: string; strong?: boolean }) {
  // A div around the svg, so `bleed` and absolute insets size it: an svg with
  // an automatic width falls back to 300px rather than filling its box.
  return (
    <div className={className} aria-hidden>
      <svg viewBox="0 0 300 8" preserveAspectRatio="none" className="block h-2 w-full overflow-visible">
        <path
          d="M1 4.5 C 40 2.5, 70 6, 110 4 S 190 2.6, 230 4.6 S 280 5.5, 299 3.6"
          fill="none"
          stroke={strong ? "var(--color-text-1)" : "var(--color-line)"}
          strokeWidth={strong ? 2.4 : 1.6}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
