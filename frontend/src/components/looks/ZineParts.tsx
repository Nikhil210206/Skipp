"use client";

// ============================================================
// THE PRINT KIT, for Zine.
//
// Two inks on pink stock. Everything here prints in the blue
// drum unless something is wrong, and then it prints in the red
// one: a stamp, a figure, a meter's fill. Colour marks trouble,
// and the second drum IS the colour.
//
// The objects are MASKS (scripts/make-print.mjs builds them)
// painted with `currentColor`, so one file prints in either ink.
// None of these pieces is focusable, which matters: the grain is
// a mask too, and a mask clips a focus ring with everything else.
// ============================================================

import { useMemo } from "react";

const OBJECTS = {
  keys: "/print/keys.png",
  "matchbox-full": "/print/matchbox-full.png",
  "matchbox-low": "/print/matchbox-low.png",
  "matchbox-empty": "/print/matchbox-empty.png",
  wire: "/print/wire.png",
} as const;

export type PrintedObject = keyof typeof OBJECTS;

/** A printed object, in whatever colour the element is set in. */
export function Printed({
  name,
  className = "",
  style,
}: {
  name: PrintedObject;
  className?: string;
  style?: React.CSSProperties;
}) {
  const url = `url(${OBJECTS[name]})`;
  return (
    <span
      aria-hidden
      className={`block bg-current ${className}`}
      style={{
        WebkitMaskImage: url,
        maskImage: url,
        WebkitMaskSize: "100% 100%",
        maskSize: "100% 100%",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        ...style,
      }}
    />
  );
}

/**
 * A rubber stamp. Hollow for "on the line", solid for "short", so the two
 * states differ by shape and by their words, never by colour alone.
 *
 * The resting tilt is the CSS `rotate` property rather than a transform, so
 * the entrance's own transform (`data-zine-stamp`) composes with it instead of
 * replacing it.
 */
export function Stamp({
  children,
  tone = "ink",
  solid = false,
  tilt = -3,
  className = "",
}: {
  children: React.ReactNode;
  tone?: "ink" | "red";
  solid?: boolean;
  tilt?: number;
  className?: string;
}) {
  const ink = tone === "red" ? "border-risk" : "border-text-1";
  const fill = solid
    ? `${tone === "red" ? "bg-risk" : "bg-text-1"} text-ink-0`
    : tone === "red"
      ? "text-risk"
      : "text-text-1";
  return (
    <span
      data-zine-stamp
      className={`zine-print zine-grain inline-block shrink-0 whitespace-nowrap border-2 px-[7px] pb-[3px] pt-[4px] text-[0.78125rem] uppercase leading-none tracking-[0.03em] ${ink} ${fill} ${className}`}
      style={{ rotate: `${tilt}deg` }}
    >
      {children}
    </span>
  );
}

/**
 * The term against the line, drawn as a strand of barbed wire with its knot at
 * exactly 75%. The wire is inked up to your figure and only faintly printed
 * past it, so how far you are past the barb is a distance, not a number.
 * Short of the line, the strand prints in the red drum.
 */
export function WireMeter({
  value,
  short = false,
  label = "75%",
  className = "",
}: {
  value: number;
  short?: boolean;
  label?: string;
  className?: string;
}) {
  const p = Math.max(0, Math.min(100, value));
  return (
    <div
      role="img"
      aria-label={`${p.toFixed(1)} percent, against the 75 percent line`}
      className={`relative pb-3.5 ${className}`}
    >
      <div className="relative aspect-[6/1] w-full">
        <Printed name="wire" className="absolute inset-0 opacity-[0.22]" style={{ clipPath: `inset(0 0 0 ${p}%)` }} />
        <Printed
          name="wire"
          className={`absolute inset-0 ${short ? "text-risk" : ""}`}
          style={{ clipPath: `inset(0 ${100 - p}% 0 0)` }}
        />
      </div>
      <span
        aria-hidden
        className="zine-typed absolute bottom-0 left-[75%] -translate-x-1/2 whitespace-nowrap text-[10px] uppercase leading-none tracking-[0.04em]"
      >
        {label}
      </span>
    </div>
  );
}

/** A subject's meter: a track, the fill, and the barb at 75%. */
export function RowMeter({ value, short = false }: { value: number; short?: boolean }) {
  const p = Math.max(0, Math.min(100, value));
  return (
    <span aria-hidden className="relative block h-3.5 min-w-0 flex-1">
      <span className="absolute inset-x-0 top-[5.5px] h-[3px] bg-text-1/20" />
      <span
        className={`absolute left-0 top-[5px] h-1 ${short ? "bg-risk" : "bg-text-1"}`}
        style={{ width: `${p}%` }}
      />
      <span className="zine-barb absolute left-[75%] top-0 -ml-[7px] size-3.5 bg-text-1" />
    </span>
  );
}

/**
 * A figure printed in the red drum with the blue a hair off under it: what a
 * real two pass print does when the second pass does not quite land. The red
 * is the layer that moves (`data-zine-reg`); the blue never does.
 *
 * `isolate` keeps the multiply inside the figure, so the overlap darkens where
 * the two inks meet and the page behind is never part of the blend.
 */
export function Misprint({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`relative isolate inline-block shrink-0 ${className}`}>
      <span aria-hidden className="absolute left-[2px] top-[1.5px] text-text-1 opacity-90 mix-blend-multiply">
        {children}
      </span>
      <span data-zine-reg className="zine-grain relative block text-risk mix-blend-multiply">
        {children}
      </span>
    </span>
  );
}

/**
 * The cover's barcode, drawn from the registration number so every student's
 * cover carries their own. Decorative: the number is printed under it.
 */
export function Barcode({ value, className = "" }: { value: string; className?: string }) {
  const { bars, width } = useMemo(() => {
    const out: { x: number; w: number; tall: boolean }[] = [];
    let x = 0;
    const guard = () => {
      out.push({ x, w: 2, tall: true }, { x: x + 3.5, w: 1, tall: true });
      x += 6;
    };
    guard();
    for (const ch of value) {
      const c = ch.charCodeAt(0);
      for (let k = 0; k < 3; k++) {
        const w = [1, 1.5, 2.5][(c >> k) % 3];
        out.push({ x, w, tall: false });
        x += w + [1, 1.5, 2][(c + k) % 3];
      }
    }
    guard();
    return { bars: out, width: x };
  }, [value]);
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${width} 30`}
      preserveAspectRatio="none"
      className={`fill-current ${className}`}
    >
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={b.tall ? 30 : 26} />
      ))}
    </svg>
  );
}
