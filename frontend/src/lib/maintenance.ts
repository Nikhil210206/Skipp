/**
 * The maintenance switch. When a section is `true`, its screen stops trying to
 * show data and says plainly that it is being fixed.
 *
 * Flip a section back to `false` once the scraper reads it again. Nothing else
 * has to change: the screen's normal states take over on the next render.
 */
export const MAINTENANCE = {
  attendance: true,
  marks: true,
} as const;
