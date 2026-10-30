import {
  BOARD,
  BODY,
  BOX,
  RULE,
  TASSEL_CORD,
  TASSEL_CORD_W,
  TUFT,
} from "@/lib/logo";

/**
 * The Skipp mark: a mortarboard on the line.
 *
 * The cap and the rule take `currentColor` so the mark sits in whatever type it
 * is set beside. The tassel is the accent: it is the detail that makes a cap a
 * cap, and the one vertical against all those horizontals.
 *
 * **No data attributes on the pieces.** The rule used to carry `data-rule`
 * for the launch to animate, and `data-rule` is also the editorial hairline
 * (`ui/editorial.tsx`) that Brutal, Terminal, Clay, Stone and Ticket hide and
 * Register pencils in: so in six themes the mark lost its line, or had it
 * stretched into a pencil stroke. The launch draws its own copy now
 * (`Splash.tsx`), so nothing here needs a hook.
 */
export default function Logo({
  size = 28,
  className = "",
  /** Draws the tassel in `currentColor` too, for a single colour tile. */
  mono = false,
}: {
  size?: number;
  className?: string;
  mono?: boolean;
}) {
  const tassel = mono ? "fill-current" : "fill-accent";
  return (
    <svg
      viewBox={`0 0 ${BOX} ${BOX}`}
      width={size}
      height={size}
      aria-hidden
      className={className}
    >
      <path d={BOARD} fill="currentColor" />
      <path d={BODY} fill="currentColor" />
      <g>
        <path
          d={TASSEL_CORD}
          strokeWidth={TASSEL_CORD_W}
          strokeLinecap="round"
          fill="none"
          className={mono ? "stroke-current" : "stroke-accent"}
        />
        <rect
          x={TUFT.x}
          y={TUFT.y}
          width={TUFT.w}
          height={TUFT.h}
          rx={TUFT.r}
          className={tassel}
        />
      </g>
      <rect
        x={RULE.x}
        y={RULE.y}
        width={RULE.w}
        height={RULE.h}
        rx={RULE.r}
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * The wordmark, with the signature on the double p.
 *
 * The doubled p is the odd thing about the name, so the second one is set in
 * the accent and the pair is tracked tight enough to read as a linked couple.
 * That turns the quirk into the mark's own detail rather than a typo people
 * squint at.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-bold tracking-[-0.06em] ${className}`}>
      ski<span className="tracking-[-0.09em]">p</span>
      <span className="text-accent">p</span>
    </span>
  );
}
