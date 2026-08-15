// Line icons drawn as inline SVG so the UI stays glyph free and inherits
// currentColor. Every icon takes an optional pixel size (default 20).

type IconProps = { size?: number; className?: string };

function Svg({
  size = 20,
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconMarks(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 20V11" />
      <path d="M12 20V4" />
      <path d="M19 20v-6" />
    </Svg>
  );
}

export function IconAttendance(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v8.5h8.5" />
    </Svg>
  );
}

export function IconHome(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 10.5 12 4l8 6.5V20H4z" />
      <path d="M9.5 20v-5h5v5" />
    </Svg>
  );
}

export function IconTimetable(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <path d="M4 10h16M10 10v10" />
    </Svg>
  );
}

export function IconCalendar(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </Svg>
  );
}

export function IconChevronLeft(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M14.5 5 8 12l6.5 7" />
    </Svg>
  );
}

export function IconChevronRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9.5 5 16 12l-6.5 7" />
    </Svg>
  );
}

export function IconClose(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function IconCheck(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 12.5 10 17.5 19 7" />
    </Svg>
  );
}

export function IconArrowDown(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 5v14" />
      <path d="M6 13.5 12 19.5l6-6" />
    </Svg>
  );
}

export function IconAlert(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 4 21 19.5H3z" />
      <path d="M12 10v4.5M12 17.4v.1" />
    </Svg>
  );
}

export function IconDownload(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 4v11" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M5 19.5h14" />
    </Svg>
  );
}

/**
 * The install steps. These three stand in for controls the student is about to
 * go and find in their own browser chrome, so each is drawn as close to the
 * real thing as this line set allows: recognising the button matters more here
 * than house style does.
 */

/** iOS Safari's Share control: a box with an arrow leaving the top. */
export function IconShare(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3.5v11" />
      <path d="M8.4 7.1 12 3.5l3.6 3.6" />
      <path d="M6.5 12.5v6a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-6" />
    </Svg>
  );
}

/** Add to Home Screen: a plus inside a rounded tile. */
export function IconAddSquare(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <path d="M12 8.5v7" />
      <path d="M8.5 12h7" />
    </Svg>
  );
}

/**
 * A five pointed star, hollow or solid.
 *
 * The one icon in the set that fills, because a rating is read by how far the
 * solid ones get along the row rather than by counting outlines. It draws its
 * own `svg` rather than going through `Svg`, which hardcodes `fill="none"`,
 * and it keeps the stroke in both states so a filled star and an empty one are
 * exactly the same size and the row cannot shift as you slide across it.
 */
export function IconStar({ size = 20, className, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3.6l2.6 5.28 5.83.85-4.22 4.11.997 5.81L12 16.91l-5.21 2.74.996-5.81-4.22-4.11 5.83-.85z" />
    </svg>
  );
}

/** A speech mark, for the one place a student writes something back. */
export function IconSpeech(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M20.5 12.4a7.6 7.6 0 0 1-7.6 7.6H8.2L4 22.5v-4.4A7.6 7.6 0 0 1 3.5 12v-.4a7.6 7.6 0 0 1 7.6-7.6h1.8a7.6 7.6 0 0 1 7.6 7.6z" />
    </Svg>
  );
}

/** The Android overflow menu, three dots in a column. */
export function IconMenuDots(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 5.4v.1" />
      <path d="M12 11.95v.1" />
      <path d="M12 18.5v.1" />
    </Svg>
  );
}

/** Simplified brand marks, drawn to match the rest of the set. */
export function IconLinkedIn(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <path d="M8 10.5v6" />
      <path d="M8 7.4v.1" />
      <path d="M12 16.5v-3.4a2.1 2.1 0 0 1 4.2 0v3.4" />
      <path d="M12 10.5v6" />
    </Svg>
  );
}

export function IconInstagram(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="3.8" />
      <path d="M16.9 7.1v.1" />
    </Svg>
  );
}
