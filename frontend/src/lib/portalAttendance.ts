// On-device store for attendance imported from the student portal via a real
// WebView login (see lib/studentPortal.ts). Kept SEPARATE from the academia
// snapshot on purpose: it has to survive academia refreshes while academia is
// still gated, and it must yield the instant academia publishes real attendance
// again. Applied in SessionContext only when academia attendance is not ready.
//
// localStorage, scoped per student, same as custom classes and optional
// markings. Attendance percentages are less sensitive than the credentials the
// encrypted snapshot holds; this never carries a password.

import type { Attendance, Marks } from "@/types";

export type PortalOverride = {
  attendance: Attendance;
  marks: Marks | null;
  // The window the portal report covers, e.g. "21/Jul/2026 To 14/Aug/2026".
  reportedPeriod: string | null;
  fetchedAt: string;
};

const key = (reg: string) => `skipp.portalatt.${reg}`;

export function loadPortalOverride(reg: string): PortalOverride | null {
  try {
    const raw = localStorage.getItem(key(reg));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PortalOverride;
    // A stored blob missing the one field everything depends on is corrupt;
    // treat it as absent rather than letting a half-object reach the UI.
    return parsed?.attendance?.subjects ? parsed : null;
  } catch {
    return null;
  }
}

export function savePortalOverride(reg: string, v: PortalOverride): void {
  try {
    localStorage.setItem(key(reg), JSON.stringify(v));
  } catch {
    /* storage full or unavailable, non-fatal */
  }
}

export function clearPortalOverride(reg: string): void {
  try {
    localStorage.removeItem(key(reg));
  } catch {
    /* non-fatal */
  }
}

/**
 * Replace the portal's SHOUTY course titles with academia's proper ones,
 * matched by code. The portal writes "COMPUTER NETWORKS"; academia has
 * "Computer Networks". Falls back to a title-cased portal name when academia
 * has no matching course (an elective it does not list, say).
 */
export function enrichTitles(
  attendance: Attendance,
  titlesByCode: Map<string, string>,
): Attendance {
  return {
    ...attendance,
    subjects: attendance.subjects.map((s) => {
      const proper = titlesByCode.get(s.code.toUpperCase());
      if (proper) return { ...s, title: proper };
      const t = s.title.trim();
      return { ...s, title: t === t.toUpperCase() ? toTitleCase(t) : t };
    }),
  };
}

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    // Keep short acronyms uppercased: "Sql" -> "SQL", "Ii" -> "II".
    .replace(/\b(sql|ii|iii|iv|vi|vii|viii|ix)\b/gi, (m) => m.toUpperCase());
}

/**
 * The same treatment for the marks half of an import.
 *
 * The student portal's marks table carries no course name at all: its
 * "Description" column names the ASSESSMENT ("CLA-1"), not the subject, so the
 * parser deliberately leaves `title` empty and expects it filled from the
 * course list. Academia's `/refresh` route already does that server side; the
 * portal login route cannot, because it never sees the timetable, so it is done
 * here from the snapshot the app is already holding.
 *
 * Applied on READ rather than at import, so a student who imported before this
 * existed gets subject names on the next launch instead of having to sign in
 * to the portal again for them.
 */
export function enrichMarkTitles(
  marks: Marks,
  titlesByCode: Map<string, string>,
): Marks {
  return {
    ...marks,
    subjects: marks.subjects.map((s) => {
      const proper = titlesByCode.get(s.code.toUpperCase());
      if (proper) return { ...s, title: proper };
      const t = s.title.trim();
      // No match (an open elective academia does not list): keep whatever the
      // portal gave, tidied. Empty stays empty, and the row falls back to
      // leading with the course code rather than printing a blank line.
      return { ...s, title: t === t.toUpperCase() ? toTitleCase(t) : t };
    }),
  };
}
