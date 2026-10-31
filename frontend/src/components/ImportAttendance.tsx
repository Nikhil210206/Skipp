"use client";

import { useState, useRef, useEffect } from "react";
import {
  CaptchaField,
  NetIdField,
  PortalPasswordField,
  PortalPromise,
  PortalStatus,
  PortalSubmit,
  portalInputError,
} from "@/components/PortalFields";
import { Button } from "@/components/ui";
import { Sheet } from "@/components/ui/Overlay";
import { IconTrash } from "@/components/Icons";
import { useSession } from "@/context/SessionContext";
import {
  AuthError,
  initStudentPortalLogin,
  type StudentPortalCaptchaResponse,
} from "@/lib/api";
import {
  savePortalCredentials,
  loadPortalCredentials,
  isRegistrationNumber,
} from "@/lib/crypto";

export function ImportAttendanceAction({
  type = "attendance",
  label,
  variant = "outline",
  initialLoadCaptcha = false,
}: {
  type?: "attendance" | "marks";
  label?: string;
  variant?: "primary" | "outline" | "secondary" | "quiet" | "danger";
  initialLoadCaptcha?: boolean;
}) {
  const {
    creds: sessionCreds,
    portalCreds,
    autoImportAttendance,
    importAttendance,
    loginSource,
  } = useSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [captchaSession, setCaptchaSession] = useState<StudentPortalCaptchaResponse | null>(null);
  const [captchaInput, setCaptchaInput] = useState("");
  const [loadingCaptcha, setLoadingCaptcha] = useState(false);
  const [captchaError, setCaptchaError] = useState<string | null>(null);

  const loadManualCaptcha = async () => {
    setLoadingCaptcha(true);
    setCaptchaError(null);
    setCaptchaInput("");
    try {
      const data = await initStudentPortalLogin();
      setCaptchaSession(data);
    } catch (e) {
      console.error("Failed to load captcha:", e);
      setCaptchaError(
        e instanceof Error ? e.message : "Failed to load captcha. Tap to try again."
      );
    } finally {
      setLoadingCaptcha(false);
    }
  };

  useEffect(() => {
    const handleRequestLogin = async () => {
      let creds = portalCreds && !isRegistrationNumber(portalCreds.username) ? portalCreds : null;
      if (!creds) {
        const savedPortal = await loadPortalCredentials();
        if (savedPortal && !isRegistrationNumber(savedPortal.username)) {
          creds = savedPortal;
        }
      }
      if (!creds && loginSource === "portal" && sessionCreds && !isRegistrationNumber(sessionCreds.username)) {
        creds = sessionCreds;
      }

      const defaultUser =
        creds?.username ||
        (sessionCreds && !isRegistrationNumber(sessionCreds.username) ? sessionCreds.username : "");

      setUsername(defaultUser);
      setPassword(creds?.password || "");
      setError("Your portal session ran out. Type the letters once to carry on syncing.");
      setOpen(true);
      void loadManualCaptcha();
    };
    window.addEventListener("skipp:request-portal-login", handleRequestLogin);
    return () => window.removeEventListener("skipp:request-portal-login", handleRequestLogin);
  }, [portalCreds, sessionCreds, loginSource]);

  const handleOpen = async () => {
    let creds = portalCreds && !isRegistrationNumber(portalCreds.username) ? portalCreds : null;
    if (!creds) {
      const savedPortal = await loadPortalCredentials();
      if (savedPortal && !isRegistrationNumber(savedPortal.username)) {
        creds = savedPortal;
      }
    }
    if (!creds && loginSource === "portal" && sessionCreds && !isRegistrationNumber(sessionCreds.username)) {
      creds = sessionCreds;
    }

    setError(null);
    setUsername(creds?.username || (sessionCreds && !isRegistrationNumber(sessionCreds.username) ? sessionCreds.username : ""));
    setPassword(creds?.password || "");
    setCaptchaSession(null);
    setCaptchaInput("");
    setOpen(true);
    void loadManualCaptcha();
  };


  const runLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawUsername = username.trim();
    const cleanUsername = rawUsername.includes("@")
      ? rawUsername.split("@")[0].trim()
      : rawUsername;

    const invalid = portalInputError(cleanUsername, password, isRegistrationNumber);
    if (invalid) {
      setError(invalid);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (captchaSession) {
        if (!captchaInput.trim()) {
          setError("Type the letters from the security check.");
          setBusy(false);
          return;
        }
        await importAttendance({
          username: cleanUsername,
          password,
          captcha: captchaInput.trim(),
          sessionCookie: captchaSession.sessionCookie,
          domainField: captchaSession.domainField,
          captchaField: captchaSession.captchaField,
          randomDelim: captchaSession.randomDelim,
          honeypotField: captchaSession.honeypotField,
          nonce: captchaSession.nonce,
          pageLoadTime: captchaSession.pageLoadTime,
        });
      } else {
        const creds = { username: cleanUsername, password };
        await autoImportAttendance(creds);
      }
      const creds = { username: cleanUsername, password };
      await savePortalCredentials(creds);
      setPassword(password);
      setCaptchaSession(null);
      setCaptchaInput("");
      setOpen(false);
    } catch (err) {
      const isAuthErr = err instanceof AuthError && (err.code === "wrong_password" || err.code === "user_not_found");
      setCaptchaSession(null);
      setCaptchaInput("");
      if (isAuthErr) {
        setError(
          err.message || "That Net ID and password did not match on the Student Portal."
        );
        void loadManualCaptcha();
      } else {
        setError(err instanceof Error ? err.message : "The portal wants a security check. Type the letters below.");
        void loadManualCaptcha();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant={variant} onClick={handleOpen} disabled={busy}>
        {busy ? "Importing…" : label ?? "Import from student portal"}
      </Button>

      <Sheet
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title="Sign in to the Student Portal"
      >
        <PortalSignInForm
          idPrefix="portal"
          type={type}
          username={username}
          setUsername={setUsername}
          password={password}
          setPassword={setPassword}
          captchaSession={captchaSession}
          captchaInput={captchaInput}
          setCaptchaInput={setCaptchaInput}
          loadingCaptcha={loadingCaptcha}
          captchaError={captchaError}
          onReload={() => void loadManualCaptcha()}
          error={error}
          busy={busy}
          onSubmit={runLogin}
        />
      </Sheet>
    </>
  );
}

/**
 * The sheet's one job: sign in to the Student Portal. A second tab that took a
 * pasted copy of the portal's report page was removed on request.
 */
function PortalSignInForm({
  idPrefix,
  type,
  username,
  setUsername,
  password,
  setPassword,
  captchaSession,
  captchaInput,
  setCaptchaInput,
  loadingCaptcha,
  captchaError,
  onReload,
  error,
  busy,
  onSubmit,
}: {
  idPrefix: string;
  type: "attendance" | "marks";
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  captchaSession: StudentPortalCaptchaResponse | null;
  captchaInput: string;
  setCaptchaInput: (v: string) => void;
  loadingCaptcha: boolean;
  captchaError: string | null;
  onReload: () => void;
  error: string | null;
  busy: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const ready =
    !busy &&
    Boolean(username.trim()) &&
    Boolean(password) &&
    !loadingCaptcha &&
    !(captchaSession && !captchaInput.trim());
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3 pb-4">
      <p className="mb-2 text-body text-text-2">
        Skipp reads your {type === "marks" ? "marks" : "attendance"} from
        sp.srmist.edu.in. Type the letters once and it keeps up from there.
      </p>
      <NetIdField id={`${idPrefix}-netid`} value={username} onChange={setUsername} disabled={busy} />
      <PortalPasswordField
        id={`${idPrefix}-password`}
        value={password}
        onChange={setPassword}
        disabled={busy}
      />
      <CaptchaField
        id={`${idPrefix}-captcha`}
        session={captchaSession}
        loading={loadingCaptcha}
        error={captchaError}
        value={captchaInput}
        onChange={setCaptchaInput}
        onReload={onReload}
        disabled={busy}
      />
      <PortalStatus error={error} />
      <div className="mt-1">
        <PortalSubmit disabled={!ready}>
          {busy ? "Signing in" : type === "marks" ? "Get my marks" : "Get my attendance"}
        </PortalSubmit>
      </div>
      <PortalPromise />
    </form>
  );
}

function isPortalDateBehindToday(reportedPeriod: string | null | undefined): boolean {
  if (!reportedPeriod) return false;
  const match = reportedPeriod.match(/To\s+(\d{1,2})[\/\-]([a-zA-Z]{3}|\d{1,2})[\/\-](\d{4})/i);
  if (!match) return false;
  const day = parseInt(match[1], 10);
  const monthStr = match[2];
  const year = parseInt(match[3], 10);

  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  const month = isNaN(Number(monthStr))
    ? months[monthStr.toLowerCase().slice(0, 3)]
    : parseInt(monthStr, 10) - 1;

  if (month === undefined || month < 0) return false;

  const portalDate = new Date(year, month, day);
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return portalDate.getTime() < todayMidnight.getTime();
}

export function PortalSourceNote({ type = "attendance" }: { type?: "attendance" | "marks" }) {
  const {
    creds: sessionCreds,
    portalCreds,
    reportedPeriod,
    autoImportAttendance,
    importAttendance,
    clearImportedAttendance,
    refresh,
    loginSource,
  } = useSession();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "updating" | "updated" | "no_new_data">("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const isBehind = type === "attendance" && isPortalDateBehindToday(reportedPeriod);
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updatedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [captchaSession, setCaptchaSession] = useState<StudentPortalCaptchaResponse | null>(null);
  const [captchaInput, setCaptchaInput] = useState("");
  const [loadingCaptcha, setLoadingCaptcha] = useState(false);
  const [captchaError, setCaptchaError] = useState<string | null>(null);

  const loadManualCaptcha = async () => {
    setLoadingCaptcha(true);
    setCaptchaError(null);
    setCaptchaInput("");
    try {
      const data = await initStudentPortalLogin();
      setCaptchaSession(data);
    } catch (e) {
      console.error("Failed to load portal captcha:", e);
      setCaptchaError(
        e instanceof Error ? e.message : "Failed to load captcha. Tap to try again."
      );
    } finally {
      setLoadingCaptcha(false);
    }
  };

  useEffect(() => () => {
    if (disarmTimer.current) clearTimeout(disarmTimer.current);
    if (updatedTimer.current) clearTimeout(updatedTimer.current);
  }, []);

  useEffect(() => {
    const handleRequestLogin = async () => {
      let creds = portalCreds && !isRegistrationNumber(portalCreds.username) ? portalCreds : null;
      if (!creds) {
        const savedPortal = await loadPortalCredentials();
        if (savedPortal && !isRegistrationNumber(savedPortal.username)) {
          creds = savedPortal;
        }
      }
      if (!creds && loginSource === "portal" && sessionCreds && !isRegistrationNumber(sessionCreds.username)) {
        creds = sessionCreds;
      }

      const defaultUser =
        creds?.username ||
        (sessionCreds && !isRegistrationNumber(sessionCreds.username) ? sessionCreds.username : "");

      setUsername(defaultUser);
      setPassword(creds?.password || "");
      setError("Your portal session ran out. Type the letters once to carry on syncing.");
      setOpen(true);
      void loadManualCaptcha();
    };
    window.addEventListener("skipp:request-portal-login", handleRequestLogin);
    return () => window.removeEventListener("skipp:request-portal-login", handleRequestLogin);
  }, [portalCreds, sessionCreds, loginSource]);

  const handleClear = () => {
    if (disarmTimer.current) clearTimeout(disarmTimer.current);
    if (armed) {
      setArmed(false);
      clearImportedAttendance();
      return;
    }
    setArmed(true);
    disarmTimer.current = setTimeout(() => setArmed(false), 3000);
  };


  const handleUpdate = async () => {
    if (busy || status === "updating") return;

    let creds = portalCreds && !isRegistrationNumber(portalCreds.username) ? portalCreds : null;
    if (!creds) {
      const savedPortal = await loadPortalCredentials();
      if (savedPortal && !isRegistrationNumber(savedPortal.username)) {
        creds = savedPortal;
      }
    }
    if (!creds && loginSource === "portal" && sessionCreds && !isRegistrationNumber(sessionCreds.username)) {
      creds = sessionCreds;
    }

    const defaultUser =
      creds?.username ||
      (portalCreds && !isRegistrationNumber(portalCreds.username) ? portalCreds.username : "") ||
      (sessionCreds && !isRegistrationNumber(sessionCreds.username) ? sessionCreds.username : "");

    if (creds) {
      setBusy(true);
      setStatus("updating");
      setError(null);
      try {
        const outcome = await refresh(true);
        if (outcome === "updated" || outcome === "fresh") {
          const behind = type === "attendance" && isPortalDateBehindToday(reportedPeriod);
          if (behind) {
            setStatus("no_new_data");
            setNotice("Synced with portal just now · Today's attendance hasn't been posted by faculty yet.");
          } else {
            setStatus("updated");
            setNotice(null);
          }
          if (updatedTimer.current) clearTimeout(updatedTimer.current);
          updatedTimer.current = setTimeout(() => {
            setStatus("idle");
            setNotice(null);
          }, 4000);
          return;
        } else {
          setStatus("idle");
          return;
        }
      } catch (err) {
        setStatus("idle");
        setUsername(defaultUser);
        setPassword(creds?.password || "");
        if (err instanceof AuthError && (err.code === "wrong_password" || err.code === "user_not_found")) {
          setPassword("");
          setError(err.message || "That Net ID and password did not match on the Student Portal.");
          setOpen(true);
          void loadManualCaptcha();
        } else {
          setError(err instanceof Error ? err.message : "The portal wants a security check. Type the letters below.");
          void loadManualCaptcha();
          setOpen(true);
        }
        return;
      } finally {
        setBusy(false);
      }
    }

    setUsername(defaultUser);
    setPassword("");
    setError(null);
    setCaptchaSession(null);
    setCaptchaInput("");
    setOpen(true);
    void loadManualCaptcha();
  };

  const runLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawUsername = username.trim();
    const cleanUsername = rawUsername.includes("@")
      ? rawUsername.split("@")[0].trim()
      : rawUsername;

    const invalid = portalInputError(cleanUsername, password, isRegistrationNumber);
    if (invalid) {
      setError(invalid);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (captchaSession) {
        if (!captchaInput.trim()) {
          setError("Type the letters from the security check.");
          setBusy(false);
          return;
        }
        await importAttendance({
          username: cleanUsername,
          password,
          captcha: captchaInput.trim(),
          sessionCookie: captchaSession.sessionCookie,
          domainField: captchaSession.domainField,
          captchaField: captchaSession.captchaField,
          randomDelim: captchaSession.randomDelim,
          honeypotField: captchaSession.honeypotField,
          nonce: captchaSession.nonce,
          pageLoadTime: captchaSession.pageLoadTime,
        });
      } else {
        const creds = { username: cleanUsername, password };
        await autoImportAttendance(creds);
      }
      const creds = { username: cleanUsername, password };
      await savePortalCredentials(creds);
      setPassword(password);
      setCaptchaSession(null);
      setCaptchaInput("");
      setOpen(false);
      const behind = type === "attendance" && isPortalDateBehindToday(reportedPeriod);
      if (behind) {
        setStatus("no_new_data");
        setNotice("Synced with portal just now · Today's attendance hasn't been posted by faculty yet.");
      } else {
        setStatus("updated");
        setNotice(null);
      }
      if (updatedTimer.current) clearTimeout(updatedTimer.current);
      updatedTimer.current = setTimeout(() => {
        setStatus("idle");
        setNotice(null);
      }, 4000);
    } catch (err) {
      const isAuthErr = err instanceof AuthError && (err.code === "wrong_password" || err.code === "user_not_found");
      setCaptchaSession(null);
      setCaptchaInput("");
      if (isAuthErr) {
        setError(err.message || "That Net ID and password did not match on the Student Portal.");
        void loadManualCaptcha();
      } else {
        setError(err instanceof Error ? err.message : "The portal wants a security check. Type the letters below.");
        void loadManualCaptcha();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-line-soft pt-3">
        <div className="min-w-0 flex-1">
          <p className="text-callout text-text-3">
            From the student portal
            {reportedPeriod ? ` · ${reportedPeriod}` : ""}
          </p>
          {isBehind && (
            <p className="mt-1 flex items-center gap-1.5 text-caption font-medium text-amber-500">
              <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500 animate-pulse" />
              <span>Today&apos;s attendance hasn&apos;t been posted by faculty yet</span>
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <button
            type="button"
            data-btn
            data-update
            onClick={handleUpdate}
            disabled={busy || status === "updating"}
            className={`inline-flex min-h-11 select-none items-center justify-center rounded-control px-5 text-body font-semibold tracking-[-0.01em] transition-all duration-150 ease-out disabled:pointer-events-none disabled:opacity-35 ${
              status === "updated"
                ? "bg-safe text-ink-0"
                : status === "no_new_data"
                ? "bg-surface-elevated text-text-1 border border-line-strong shadow-sm"
                : "bg-risk text-ink-0 hover:bg-risk/90 active:bg-risk/80"
            }`}
          >
            {status === "updating"
              ? "Updating..."
              : status === "updated"
              ? "Updated!"
              : status === "no_new_data"
              ? "No new updates"
              : "Update"}
          </button>
          <button
            type="button"
            onClick={handleClear}
            aria-label={armed ? "Tap again to clear imported attendance" : "Clear imported attendance"}
            className={`group -m-3 inline-flex min-h-11 min-w-11 select-none items-center justify-center gap-1 p-3 text-callout transition-colors duration-150 ease-out ${
              armed ? "text-risk" : "text-text-3 hover:text-text-2"
            }`}
          >
            <IconTrash size={16} open={armed} />
            {armed && <span>Sure?</span>}
          </button>
        </div>
      </div>

      {notice && (
        <div className="mt-2.5 flex items-center gap-2 rounded-control bg-surface-elevated px-3 py-2 text-caption text-text-2 border border-line-soft transition-all duration-200">
          <svg className="h-3.5 w-3.5 shrink-0 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <span>{notice}</span>
        </div>
      )}
      
      <Sheet
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title="Sign in to the Student Portal"
      >
        <PortalSignInForm
          idPrefix="portal-update"
          type={type}
          username={username}
          setUsername={setUsername}
          password={password}
          setPassword={setPassword}
          captchaSession={captchaSession}
          captchaInput={captchaInput}
          setCaptchaInput={setCaptchaInput}
          loadingCaptcha={loadingCaptcha}
          captchaError={captchaError}
          onReload={() => void loadManualCaptcha()}
          error={error}
          busy={busy}
          onSubmit={runLogin}
        />
      </Sheet>
    </>
  );
}
