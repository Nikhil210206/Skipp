// API client for the Skipp backend scraper.
// Credentials are POSTed per request (the backend is stateless) over HTTPS and
// never stored server-side. See CLAUDE.md §3.

import type {
  Attendance,
  Credentials,
  Marks,
  Snapshot,
  Timetable,
} from "@/types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000";

/** A section (attendance/marks) that the portal hasn't enabled yet (HTTP 503). */
export class NotAvailableError extends Error {
  readonly kind = "not-available";
}

/** Wrong password / user not found (HTTP 401 / 404). */
export class AuthError extends Error {
  readonly kind = "auth";
}

/** Portal/backend problem (HTTP 5xx other than 503). */
export class PortalError extends Error {
  readonly kind = "portal";
}

async function post<T>(path: string, creds: Credentials): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(creds),
    });
  } catch {
    throw new PortalError("Can't reach Skipp. Is the backend running?");
  }

  if (res.ok) return res.json() as Promise<T>;

  const detail = await res
    .json()
    .then((b) => b?.detail as string | undefined)
    .catch(() => undefined);

  if (res.status === 401 || res.status === 404) {
    throw new AuthError(detail ?? "Wrong SRM net id or password.");
  }
  if (res.status === 429) {
    throw new AuthError(
      detail ?? "Too many attempts — the portal wants a CAPTCHA. Try later.",
    );
  }
  if (res.status === 503) {
    throw new NotAvailableError(detail ?? "Not available on the portal yet.");
  }
  throw new PortalError(detail ?? `Something went wrong (${res.status}).`);
}

/** One login → timetable + attendance + marks. Prefer this over the singles. */
export const fetchSnapshot = (c: Credentials) => post<Snapshot>("/refresh", c);

// Single-section endpoints (each does its own login — use sparingly).
export const fetchTimetable = (c: Credentials) =>
  post<Timetable>("/timetable", c);
export const fetchAttendance = (c: Credentials) =>
  post<Attendance>("/attendance", c);
export const fetchMarks = (c: Credentials) => post<Marks>("/marks", c);
