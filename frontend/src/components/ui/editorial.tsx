"use client";

// ============================================================
// EDITORIAL PRIMITIVES
// The page-like half of the system: full-bleed rules, hung
// indices, mastheads and one inverted block per screen.
// Cards are for grouped controls only; content uses these.
// ============================================================

/** Full-bleed hairline. Breaks the gutter so lists read as a page. */
export function Rule({ soft = false }: { soft?: boolean }) {
  return (
    <div
      role="presentation"
      className={`bleed h-px ${soft ? "bg-line-soft" : "bg-line"}`}
    />
  );
}

/**
 * Section marker: a small caps title with a rule that runs to the edge, and an
 * optional count hung on the right.
 */
export function SectionHead({
  children,
  aside,
  className = "",
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-baseline gap-4 ${className}`}>
      <span className="text-label uppercase text-text-2">{children}</span>
      <span className="h-px flex-1 bg-line" />
      {aside && <span className="tnum text-callout text-text-3">{aside}</span>}
    </div>
  );
}

/**
 * A content row with an index hung in the left margin. No card, no fill: the
 * rule above it does the separating.
 */
export function IndexRow({
  index,
  title,
  meta,
  trailing,
  dimmed = false,
  onClick,
  children,
}: {
  index?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  dimmed?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const body = (
    <>
      <div className="flex items-baseline gap-4">
        {index !== undefined && (
          <span className="tnum w-8 shrink-0 pt-1 text-label text-text-3">
            {index}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-4">
            <span
              className={`min-w-0 truncate text-headline ${
                dimmed ? "text-text-3 line-through decoration-line" : "text-text-1"
              }`}
            >
              {title}
            </span>
            {trailing && <span className="shrink-0">{trailing}</span>}
          </div>
          {meta && (
            <div className="mt-1 truncate text-callout text-text-3">{meta}</div>
          )}
          {children}
        </div>
      </div>
    </>
  );

  const cls = `w-full py-4 text-left ${dimmed ? "opacity-60" : ""}`;
  return onClick ? (
    <button onClick={onClick} className={cls}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** A figure hung against a baseline: the number dominates, the unit whispers. */
export function Amount({
  value,
  unit,
  size = "display",
  className = "",
}: {
  value: React.ReactNode;
  unit?: React.ReactNode;
  size?: "mega" | "display" | "hero";
  className?: string;
}) {
  const s =
    size === "mega" ? "text-mega" : size === "hero" ? "text-hero" : "text-display";
  return (
    <span className={`flex items-baseline gap-1.5 ${className}`}>
      <span className={`tnum ${s}`}>{value}</span>
      {unit && <span className="text-title opacity-45">{unit}</span>}
    </span>
  );
}

/**
 * A measurement drawn as a rule rather than a bar in a box: a hairline track,
 * a solid fill to the value, and a tick marking the threshold. Every row that
 * uses one shares the same tick position, so the thresholds line up down the
 * page and a subject that falls short is visible without reading a number.
 */
export function TrackRule({
  value,
  threshold,
  tone = "neutral",
  className = "",
}: {
  value: number;
  threshold?: number;
  tone?: "neutral" | "accent";
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`relative h-[2px] w-full bg-line ${className}`}>
      <div
        className={`absolute inset-y-0 left-0 ${
          tone === "accent" ? "bg-accent" : "bg-text-1"
        }`}
        style={{ width: `${pct}%` }}
      />
      {threshold !== undefined && (
        <span
          aria-hidden
          className="absolute -top-[3px] h-2 w-px bg-text-3"
          style={{ left: `${threshold}%` }}
        />
      )}
    </div>
  );
}

/** A note hung in the margin: small, quiet, never competing. */
export function Marginalia({ children }: { children: React.ReactNode }) {
  return <p className="text-callout leading-relaxed text-text-3">{children}</p>;
}

/** Sticky bottom action that sits above the tab bar without covering content. */
export function StickyAction({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="sticky z-20 mt-10"
      style={{ bottom: "calc(var(--nav-h) + 12px)" }}
    >
      {/* A short fade so list rows do not collide with the button edge. */}
      <div
        aria-hidden
        className="bleed pointer-events-none h-10 bg-gradient-to-b from-transparent to-ink-0"
      />
      <div className="bleed bleed-pad bg-ink-0 pb-1">{children}</div>
    </div>
  );
}
