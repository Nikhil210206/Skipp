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

export function IconTrendDown(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 7.5 10.5 14l3.5-3.5L20 17" />
      <path d="M20 12.5V17h-4.5" />
    </Svg>
  );
}

export function IconTrendUp(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 16.5 10.5 10l3.5 3.5L20 7" />
      <path d="M20 11.5V7h-4.5" />
    </Svg>
  );
}

/** Used for the predict action. */
export function IconWand(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M14.5 4.5 19.5 9.5 8 21H3v-5z" />
      <path d="M12.5 6.5 17.5 11.5" />
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

export function IconBolt(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M13.5 3 5 13.5h5.5L10 21l8.5-10.5H13z" />
    </Svg>
  );
}

export function IconClock(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.3l3.4 2" />
    </Svg>
  );
}

export function IconBook(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 5.5A2 2 0 0 1 6 3.5h5v17H6a2 2 0 0 0-2 2z" />
      <path d="M20 5.5a2 2 0 0 0-2-2h-5v17h5a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

export function IconCheckCircle(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.2 12.3 11 15l5-5.5" />
    </Svg>
  );
}

export function IconHourglass(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M7 3.5h10M7 20.5h10" />
      <path d="M7.5 3.5c0 4 4.5 5 4.5 8.5S7.5 16.5 7.5 20.5" />
      <path d="M16.5 3.5c0 4-4.5 5-4.5 8.5s4.5 4.5 4.5 8.5" />
    </Svg>
  );
}

export function IconMoon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.5 8.5 0 1 0 20 14.2z" />
    </Svg>
  );
}

export function IconSun(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6" />
    </Svg>
  );
}

export function IconLocation(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 21c4-4.4 6-7.6 6-10a6 6 0 1 0-12 0c0 2.4 2 5.6 6 10z" />
      <circle cx="12" cy="11" r="2.2" />
    </Svg>
  );
}

export function IconUser(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.8 20c.9-3.4 3.7-5.2 7.2-5.2s6.3 1.8 7.2 5.2" />
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
