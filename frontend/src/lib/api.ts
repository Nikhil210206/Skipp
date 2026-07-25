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

// Backend base URL. Prefer an explicit env (prod), else talk to the backend on
// the SAME host the app was opened from (port 8000), so it works on the laptop
// (localhost) AND a phone on the LAN (http://<laptop-ip>:3000) with no config.
function apiBase(): string {
  const env = process.env.NEXT_PUBLIC_API_URL;
  if (env) return env.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return "http://127.0.0.1:8000";
}

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
    res = await fetch(`${apiBase()}${path}`, {
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
      detail ?? "Too many attempts. The portal wants a CAPTCHA, try later.",
    );
  }
  if (res.status === 503) {
    throw new NotAvailableError(detail ?? "Not available on the portal yet.");
  }
  throw new PortalError(detail ?? `Something went wrong (${res.status}).`);
}

/** One login gives timetable, attendance and marks. Prefer this over the singles. */
export const fetchSnapshot = (c: Credentials) => post<Snapshot>("/refresh", c);

// Single-section endpoints (each does its own login, so use sparingly).
export const fetchTimetable = (c: Credentials) =>
  post<Timetable>("/timetable", c);
export const fetchAttendance = (c: Credentials) =>
  post<Attendance>("/attendance", c);
export const fetchMarks = (c: Credentials) => post<Marks>("/marks", c);
