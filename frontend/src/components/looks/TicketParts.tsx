"use client";

import { Notch } from "./shared";

/**
 * A pass: the main part, a dashed perforation, and a stub on the right, with a
 * notch bitten out of each edge where the perforation meets it.
 *
 * `dark` is the black pass (the bunk pass, the term pass). It has no outline,
 * so its notches are plain holes in the page colour.
 */
export function Pass({
  children,
  stub,
  stubWidth = 102,
  stubClassName = "",
  surfaceClassName = "bg-ink-1",
  dark = false,
  className = "",
  overlay,
}: {
  children: React.ReactNode;
  stub: React.ReactNode;
  stubWidth?: number;
  stubClassName?: string;
  /** The main part's fill, for a light pass. A short subject is tinted. */
  surfaceClassName?: string;
  dark?: boolean;
  className?: string;
  /** Anything laid over the pass itself, such as a stamp. */
  overlay?: React.ReactNode;
}) {
  const outline = dark ? null : "var(--color-text-1)";
  return (
    <div
      data-look-pass
      className={`relative flex rounded-[22px] border-2 ${
        dark
          ? "border-[var(--look-deep)] bg-[var(--look-deep)] text-[var(--look-on-deep)]"
          : `border-text-1 text-text-1 ${surfaceClassName}`
      } ${className}`}
    >
      <div className="min-w-0 flex-1 py-4 pl-[18px] pr-4">{children}</div>
      <div
        className={`relative flex shrink-0 flex-col overflow-hidden rounded-r-[20px] border-l-2 border-dashed ${
          dark ? "border-[var(--look-deep-line)]" : "border-text-1"
        } ${stubClassName}`}
        style={{ width: stubWidth }}
      >
        {stub}
      </div>
      <Notch edge="top" at={stubWidth - 1} outline={outline} />
      <Notch edge="bottom" at={stubWidth - 1} outline={outline} />
      {overlay}
    </div>
  );
}

/** A short pass with the stub on the LEFT, for a class in today's list. */
export function SidePass({
  side,
  children,
  sideWidth = 88,
}: {
  side: React.ReactNode;
  children: React.ReactNode;
  sideWidth?: number;
}) {
  return (
    <div data-look-pass className="relative flex rounded-[18px] border-2 border-text-1 bg-ink-1">
      <div
        className="shrink-0 rounded-l-[16px] border-r-2 border-dashed border-text-1 bg-ink-2 py-3 pl-3.5"
        style={{ width: sideWidth }}
      >
        {side}
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 py-3 pl-4 pr-3.5">
        {children}
      </div>
      {/* Measured from the right, so convert: the perforation sits sideWidth in
          from the left edge. */}
      <span
        aria-hidden
        className="absolute -top-[11px] box-border size-[22px] rounded-full border-2 border-text-1 bg-ink-0"
        style={{ left: sideWidth - 12, clipPath: "inset(50% 0 0 0)" }}
      />
      <span
        aria-hidden
        className="absolute -bottom-[11px] box-border size-[22px] rounded-full border-2 border-text-1 bg-ink-0"
        style={{ left: sideWidth - 12, clipPath: "inset(0 0 50% 0)" }}
      />
    </div>
  );
}
