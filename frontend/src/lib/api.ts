// API client for the Skipp backend scraper.
// Credentials are POSTed per request (the backend is stateless) over HTTPS and
// never stored server-side. See CLAUDE.md §3.

import type {
  Credentials,
  Snapshot,
  StudentPortalSnapshot,
  StudentPortalCaptchaResponse,
  StudentPortalLoginRequest,
} from "@/types";

// Backend base URL. Prefer an explicit env (prod), else talk to the backend on
// the SAME host the app was opened from (port 8000), so it works on the laptop
// (localhost) AND a phone on the LAN (http://<laptop-ip>:3000) with no config.
function apiBase(): string {
  const env = process.env.NEXT_PUBLIC_API_URL;
  if (env) return env.replace(/\/$/, "");
  // A deployed build has no backend on :8000 of its own hostname, so guessing
  // one would turn a missing environment variable into a mystery network error
  // on every sign-in. Say what is actually wrong instead.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set. Point it at the deployed Skipp backend.",
    );
  }
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return "http://127.0.0.1:8000";
}

/**
 * Why a sign-in failed, as a value rather than as prose. CAPTCHA and the daily
 * cap are both HTTP 429 but need entirely different advice, so the UI switches
 * on this instead of reading the message.
 */
export type FailureCode =
  | "user_not_found"
  | "wrong_password"
  | "captcha"
  | "signin_limit"
  | "slow_portal"
  | "portal"
  | "unreachable";

/** A section (attendance/marks) that the portal hasn't enabled yet (HTTP 503). */
export class NotAvailableError extends Error {
  readonly kind = "not-available";
}

/** Wrong password / user not found (HTTP 401 / 404). */
export class AuthError extends Error {
  readonly kind = "auth";
  constructor(
    message: string,
    readonly code: FailureCode = "wrong_password",
  ) {
    super(message);
  }
}

/** Portal/backend problem (HTTP 5xx other than 503). */
export class PortalError extends Error {
  readonly kind = "portal";
  constructor(
    message: string,
    readonly code: FailureCode = "portal",
  ) {
    super(message);
  }
}

async function post<T>(path: string, creds: Credentials): Promise<T> {
  // Resolved outside the try: apiBase() throws its own, specific error when the
  // backend URL is unset, and the catch below would otherwise replace it with
  // the generic "cannot reach" message.
  const base = apiBase();
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(creds),
    });
  } catch {
    throw new PortalError("Can't reach Skipp. Is the backend running?", "unreachable");
  }

  if (res.ok) return res.json() as Promise<T>;

  // The backend sends {code, message}; older responses sent a bare string.
  const body = await res.json().catch(() => undefined);
  const raw = body?.detail;
  const detail: string | undefined =
    typeof raw === "string" ? raw : (raw?.message as string | undefined);
  const code: FailureCode | undefined =
    typeof raw === "object" && raw ? (raw.code as FailureCode) : undefined;

  // A 404 only means "no such student" when the backend says so in its own
  // typed body. A bare 404 is our API not being there at all: a misrouted
  // deployment answers every path with FastAPI's `{"detail":"Not Found"}`, and
  // reading that as user_not_found told students their Net ID was wrong when
  // the portal had never been asked. Never blame the credentials for a routing
  // fault.
  if (res.status === 404 && !code) {
    throw new PortalError(
      "Can't reach Skipp. The server is not answering properly.",
      "unreachable",
    );
  }
  if (res.status === 401 || res.status === 404) {
    throw new AuthError(
      detail ?? "Wrong SRM net id or password.",
      code ?? "wrong_password",
    );
  }
  if (res.status === 429) {
    throw new AuthError(
      detail ?? "The portal is rate limiting sign-ins right now.",
      code ?? "captcha",
    );
  }
  if (res.status === 503) {
    throw new NotAvailableError(detail ?? "Not available on the portal yet.");
  }
  throw new PortalError(detail ?? `Something went wrong (${res.status}).`, code ?? "portal");
}

/** One login gives timetable, attendance and marks: the only fetch there is. */
export const fetchSnapshot = (c: Credentials) => post<Snapshot>("/refresh", c);

// ---- Student portal fallback -------------------------------------------

/**
 * Initialize a login session for the student portal.
 * Fetches the session cookies, anti-bot parameters, and the base64 captcha image.
 */
export async function initStudentPortalLogin(): Promise<StudentPortalCaptchaResponse> {
  const base = apiBase();
  let res: Response;
  try {
    res = await fetch(`${base}/sp/captcha`, {
      method: "GET",
    });
  } catch {
    throw new PortalError("Can't reach Skipp. Check your connection.", "unreachable");
  }
  if (res.ok) return (await res.json()) as StudentPortalCaptchaResponse;

  const parsed = await res.json().catch(() => undefined);
  const detail: string | undefined = typeof parsed?.detail === "string" ? parsed.detail : undefined;
  throw new PortalError(detail ?? `Couldn't connect to portal (${res.status}).`, "portal");
}

/**
 * Submit the login credentials and captcha for the student portal.
 *
 * The backend simulates the anti-bot tokens and logs in natively, fetching
 * the attendance and marks HTML in the process.
 */
export async function submitStudentPortalLogin(
  req: StudentPortalLoginRequest,
): Promise<StudentPortalSnapshot> {
  const base = apiBase();
  let res: Response;
  try {
    res = await fetch(`${base}/sp/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
  } catch {
    throw new PortalError("Can't reach Skipp. Check your connection.", "unreachable");
  }
  if (res.ok) return (await res.json()) as StudentPortalSnapshot;

  const parsed = await res.json().catch(() => undefined);
  const raw = parsed?.detail;
  const detail: string | undefined =
    typeof raw === "string" ? raw : (raw?.message as string | undefined);
  const code: string | undefined = typeof raw === "object" ? raw?.code : undefined;
  
  if (res.status === 401) {
    if (code === "invalid_captcha") {
      throw new AuthError(detail ?? "Incorrect captcha. Please try again.", "captcha");
    }
    if (code === "invalid_credentials") {
      throw new AuthError(detail ?? "Wrong SRM net id or password.", "wrong_password");
    }
    if (code === "session_expired") {
      throw new AuthError(detail ?? "Sign in to the student portal again.", "wrong_password");
    }
    throw new AuthError(detail ?? "Sign-in failed.", "wrong_password");
  }
  throw new PortalError(detail ?? `Couldn't read the portal (${res.status}).`, "portal");
}

// ---- Feedback ----------------------------------------------------------

/** What a piece of feedback is about. */
export type FeedbackKind = "bug" | "idea" | "other";

/**
 * One thing a student wanted to say.
 *
 * The identity half is filled in by the app from the snapshot it already
 * holds, never typed, and the sheet tells them so before they send. Mirrors
 * `backend/models/feedback.py`.
 */
export type Feedback = {
  rating: number;
  kind: FeedbackKind;
  message: string;
  name?: string | null;
  section?: string | null;
  registrationNumber?: string | null;
  program?: string | null;
  semester?: string | null;
  theme?: string | null;
  installed?: boolean;
};

/**
 * Send it. Resolves on delivery and throws otherwise, deliberately: the whole
 * promise of a feedback box is that somebody sees it, so a failure has to
 * reach the person who just typed something rather than being swallowed.
 *
 * This is the one call in the app that carries no credentials.
 */
export async function sendFeedback(body: Feedback): Promise<void> {
  const base = apiBase();
  let res: Response;
  try {
    res = await fetch(`${base}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new PortalError("Can't reach Skipp. Check your connection.", "unreachable");
  }
  if (res.ok) return;

  const parsed = await res.json().catch(() => undefined);
  const raw = parsed?.detail;
  const detail: string | undefined =
    typeof raw === "string" ? raw : (raw?.message as string | undefined);
  throw new PortalError(detail ?? `Couldn't send that (${res.status}).`, "portal");
}

