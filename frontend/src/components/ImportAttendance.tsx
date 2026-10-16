"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui";
import { Sheet } from "@/components/ui/Overlay";
import { IconTrash } from "@/components/Icons";
import { useSession } from "@/context/SessionContext";
import {
  AuthError,
  PortalError,
  initStudentPortalLogin,
  type StudentPortalCaptchaResponse,
} from "@/lib/api";
import {
  savePortalCredentials,
  loadPortalCredentials,
  loadCredentials,
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

  const handleOpen = async () => {
    // Look for credentials that are specifically for the student portal
    let creds = portalCreds && !isRegistrationNumber(portalCreds.username) ? portalCreds : null;
    if (!creds) {
      const savedPortal = await loadPortalCredentials();
      if (savedPortal && !isRegistrationNumber(savedPortal.username)) {
        creds = savedPortal;
      }
    }
    // Only use sessionCreds if the student signed in via Student Portal
    if (!creds && loginSource === "portal" && sessionCreds && !isRegistrationNumber(sessionCreds.username)) {
      creds = sessionCreds;
    }

    if (initialLoadCaptcha) {
      setError(null);
      setUsername(creds?.username || (sessionCreds && !isRegistrationNumber(sessionCreds.username) ? sessionCreds.username : ""));
      setPassword("");
      setCaptchaSession(null);
      setCaptchaInput("");
      setOpen(true);
      void loadManualCaptcha();
      return;
    }

    if (creds) {
      setBusy(true);
      setError(null);
      try {
        await autoImportAttendance(creds);
        void savePortalCredentials(creds);
        setBusy(false);
        return;
      } catch (err) {
        setBusy(false);
        setOpen(true);
        if (err instanceof AuthError && (err.code === "wrong_password" || err.code === "user_not_found")) {
          setError(err.message || "Incorrect NetID or password. Note that your Student Portal password is often different from your Academia password.");
          setUsername(creds.username);
          setPassword("");
        } else {
          setError(err instanceof Error ? err.message : "Security check required. Please solve the captcha below.");
          setUsername(creds.username);
          void loadManualCaptcha();
        }
        return;
      }
    }

    // No portal credentials saved yet, open modal for Net ID and Password
    setError(null);
    setUsername(sessionCreds && !isRegistrationNumber(sessionCreds.username) ? sessionCreds.username : "");
    setPassword("");
    setCaptchaSession(null);
    setCaptchaInput("");
    setOpen(true);
    void loadManualCaptcha();
  };

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawUsername = username.trim();
    const cleanUsername = rawUsername.includes("@")
      ? rawUsername.split("@")[0].trim().toLowerCase()
      : rawUsername.toLowerCase();

    if (!cleanUsername || !password) return;

    if (isRegistrationNumber(cleanUsername)) {
      setError("Student Portal requires your SRM Net ID (e.g. ab1234), not your registration number.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (captchaSession) {
        if (!captchaInput.trim()) {
          setError("Please enter the 6 captcha characters shown.");
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
          pageLoadTime: captchaSession.pageLoadTime,
        });
      } else {
        const creds = { username: cleanUsername, password };
        await autoImportAttendance(creds);
      }
      const creds = { username: cleanUsername, password };
      await savePortalCredentials(creds);
      setPassword("");
      setCaptchaSession(null);
      setCaptchaInput("");
      setOpen(false);
    } catch (err) {
      const isAuthErr = err instanceof AuthError && (err.code === "wrong_password" || err.code === "user_not_found");
      setCaptchaSession(null);
      setCaptchaInput("");
      if (isAuthErr) {
        setError(
          err.message || "Incorrect NetID or password. Note that your Student Portal password is often different from your Academia password."
        );
        void loadManualCaptcha();
      } else {
        setError(err instanceof Error ? err.message : "Verification check failed. Please enter the captcha below.");
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
        title={type === "marks" ? "Get your marks" : "Get your attendance"}
      >
        <div className="flex flex-col gap-5 pb-2">
          <div className="rounded-control border border-line bg-ink-1/60 p-3 text-callout text-text-2">
            Enter your <strong>SRM Student Portal password</strong> (your NetID / email password). Note that this is often different from your Academia password.
          </div>

          <form onSubmit={run} className="flex flex-col gap-3">
            <Field
              id="username"
              label="SRM Net ID"
              suffix="@srmist.edu.in"
              value={username}
              onChange={setUsername}
              autoComplete="username"
            />
            <Field
              id="password"
              label="Password"
              value={password}
              onChange={setPassword}
              type="password"
              placeholder="Student portal password"
              autoComplete="current-password"
            />

            {/* Captcha Security Check Box */}
            {loadingCaptcha ? (
              <div className="flex flex-col gap-2 rounded-control border border-line bg-ink-1 p-3">
                <span className="text-label uppercase text-text-3">Security Check</span>
                <div className="flex items-center gap-3 py-1">
                  <div className="h-10 w-36 animate-pulse rounded-md bg-ink-2" />
                  <span className="text-callout text-text-3 animate-pulse">Loading captcha image…</span>
                </div>
              </div>
            ) : captchaError ? (
              <div className="flex flex-col gap-2 rounded-control border border-risk/40 bg-risk/10 p-3">
                <span className="text-label uppercase text-risk">Security Check</span>
                <p className="text-callout text-text-2">{captchaError}</p>
                <button
                  type="button"
                  onClick={() => void loadManualCaptcha()}
                  className="self-start text-callout font-semibold text-accent hover:underline"
                >
                  Retry loading captcha
                </button>
              </div>
            ) : captchaSession ? (
              <div className="flex flex-col gap-2 rounded-control border border-line bg-ink-1 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-label uppercase text-text-3">Security Check</span>
                  <button
                    type="button"
                    onClick={() => void loadManualCaptcha()}
                    disabled={loadingCaptcha}
                    className="text-callout text-accent hover:underline disabled:opacity-50"
                  >
                    {loadingCaptcha ? "Reloading…" : "Reload"}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <img
                    src={captchaSession.captchaBase64}
                    alt="Captcha security check"
                    className="h-10 w-auto rounded-md bg-white object-contain px-2 py-0.5 border border-line select-none"
                  />
                </div>
                <input
                  type="text"
                  value={captchaInput}
                  onChange={(e) => setCaptchaInput(e.target.value)}
                  placeholder="Enter the 6 characters shown above"
                  className="mt-1 w-full appearance-none rounded-control border border-line bg-ink-0 px-3 py-2 text-headline text-text-1 outline-none focus:border-accent placeholder:text-text-3"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  autoFocus
                  maxLength={6}
                  required
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void loadManualCaptcha()}
                disabled={loadingCaptcha}
                className="self-start text-callout text-accent hover:underline disabled:opacity-50"
              >
                Solve captcha manually
              </button>
            )}

            {error && <p className="text-callout text-risk mt-1">{error}</p>}

            <div className="mt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                full
                disabled={
                  busy ||
                  !username.trim() ||
                  !password ||
                  loadingCaptcha ||
                  (Boolean(captchaSession) && !captchaInput.trim())
                }
              >
                {busy
                  ? "Signing in…"
                  : loadingCaptcha
                  ? "Loading security check…"
                  : type === "marks"
                  ? "Import marks"
                  : "Import"}
              </Button>
            </div>
          </form>

          <p className="text-callout text-text-3 mt-2">
            Your credentials are encrypted on-device. Verification checks are handled automatically.
          </p>
        </div>
      </Sheet>
    </>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
  suffix,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  suffix?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const isPassword = type === "password";
  const effectiveType = isPassword ? (showPassword ? "text" : "password") : type;

  return (
    <label
      htmlFor={id}
      className="block cursor-text rounded-control border border-line bg-ink-1 px-4 py-3 transition-colors focus-within:border-accent"
    >
      <div className="flex items-center justify-between">
        <span className="block text-label uppercase text-text-3">{label}</span>
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="text-label uppercase text-accent hover:underline focus:outline-none"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        )}
      </div>
      {suffix ? (
        <div className="mt-1.5 flex items-baseline gap-1">
          <input
            ref={input}
            id={id}
            type={effectiveType}
            value={value}
            autoComplete={autoComplete}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            maxLength={8}
            onChange={(e) => onChange(e.target.value.toLowerCase())}
            className="min-w-0 flex-1 appearance-none bg-transparent text-headline text-text-1 outline-none placeholder:text-text-3"
          />
          <span className="shrink-0 text-headline text-text-3">{suffix}</span>
        </div>
      ) : (
        <input
          id={id}
          type={effectiveType}
          value={value}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="mt-1.5 w-full appearance-none bg-transparent text-headline text-text-1 outline-none placeholder:text-text-3"
        />
      )}
    </label>
  );
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
  const [status, setStatus] = useState<"idle" | "updating" | "updated">("idle");
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
      // Only prompt if credentials do not exist
      const saved = await loadPortalCredentials();
      if (!saved && !portalCreds && (!sessionCreds || isRegistrationNumber(sessionCreds.username))) {
        const defaultUser =
          sessionCreds && !isRegistrationNumber(sessionCreds.username) ? sessionCreds.username : "";
        setUsername(defaultUser);
        setPassword("");
        setError("Please sign in with your NetID to update attendance from the student portal.");
        setOpen(true);
        void loadManualCaptcha();
      }
    };
    window.addEventListener("skipp:request-portal-login", handleRequestLogin);
    return () => window.removeEventListener("skipp:request-portal-login", handleRequestLogin);
  }, [portalCreds, sessionCreds]);

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

    // Look for verified portal credentials
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
          setStatus("updated");
          if (updatedTimer.current) clearTimeout(updatedTimer.current);
          updatedTimer.current = setTimeout(() => setStatus("idle"), 2500);
          return;
        } else {
          // Sync failed or cooldown: remain idle without annoying the user with password prompts
          setStatus("idle");
          return;
        }
      } catch (err) {
        setStatus("idle");
        if (err instanceof AuthError && (err.code === "wrong_password" || err.code === "user_not_found")) {
          setUsername(defaultUser);
          setPassword("");
          setError(err.message || "Incorrect NetID or password. Please update your credentials.");
          setOpen(true);
        } else {
          setUsername(defaultUser);
          setError(err instanceof Error ? err.message : "Verification check required. Please solve the captcha below.");
          void loadManualCaptcha();
          setOpen(true);
        }
        return;
      } finally {
        setBusy(false);
      }
    }

    // No valid credentials found, open modal for initial setup
    setUsername(defaultUser);
    setPassword("");
    setError(null);
    setCaptchaSession(null);
    setCaptchaInput("");
    setOpen(true);
    void loadManualCaptcha();
  };

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawUsername = username.trim();
    const cleanUsername = rawUsername.includes("@")
      ? rawUsername.split("@")[0].trim().toLowerCase()
      : rawUsername.toLowerCase();

    if (!cleanUsername || !password) return;

    if (isRegistrationNumber(cleanUsername)) {
      setError("Student Portal requires your SRM Net ID (e.g. ab1234), not your registration number.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (captchaSession) {
        if (!captchaInput.trim()) {
          setError("Please enter the 6 captcha characters shown.");
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
          pageLoadTime: captchaSession.pageLoadTime,
        });
      } else {
        const creds = { username: cleanUsername, password };
        await autoImportAttendance(creds);
      }
      const creds = { username: cleanUsername, password };
      await savePortalCredentials(creds);
      setPassword("");
      setCaptchaSession(null);
      setCaptchaInput("");
      setOpen(false);
      setStatus("updated");
      if (updatedTimer.current) clearTimeout(updatedTimer.current);
      updatedTimer.current = setTimeout(() => setStatus("idle"), 2500);
    } catch (err) {
      const isAuthErr = err instanceof AuthError && (err.code === "wrong_password" || err.code === "user_not_found");
      setCaptchaSession(null);
      setCaptchaInput("");
      if (isAuthErr) {
        setError(err.message || "Incorrect NetID or password. Note that your Student Portal password is often different from your Academia password.");
        void loadManualCaptcha();
      } else {
        setError(err instanceof Error ? err.message : "Verification check failed. Please enter the captcha below.");
        void loadManualCaptcha();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-line-soft pt-3">
        <p className="min-w-0 flex-1 text-callout text-text-3">
          From the student portal
          {reportedPeriod ? ` · ${reportedPeriod}` : ""}
        </p>
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
                : "bg-risk text-ink-0 hover:bg-risk/90 active:bg-risk/80"
            }`}
          >
            {status === "updating"
              ? "Updating..."
              : status === "updated"
              ? "Updated!"
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
      
      <Sheet open={open} onClose={() => { if (!busy) setOpen(false); }} title={`Update ${type}`}>
        <div className="flex flex-col gap-5 pb-2">
          <div className="rounded-control border border-line bg-ink-1/60 p-3 text-callout text-text-2">
            Enter your <strong>SRM Student Portal password</strong> (your NetID / email password). Note that this is often different from your Academia password.
          </div>

          <form onSubmit={run} className="flex flex-col gap-3">
            <Field
              id="re-username"
              label="SRM Net ID"
              suffix="@srmist.edu.in"
              value={username}
              onChange={setUsername}
              autoComplete="username"
            />
            <Field
              id="re-password"
              label="Password"
              value={password}
              onChange={setPassword}
              type="password"
              placeholder="Student portal password"
              autoComplete="current-password"
            />

            {/* Captcha Security Check Box */}
            {loadingCaptcha ? (
              <div className="flex flex-col gap-2 rounded-control border border-line bg-ink-1 p-3">
                <span className="text-label uppercase text-text-3">Security Check</span>
                <div className="flex items-center gap-3 py-1">
                  <div className="h-10 w-36 animate-pulse rounded-md bg-ink-2" />
                  <span className="text-callout text-text-3 animate-pulse">Loading captcha image…</span>
                </div>
              </div>
            ) : captchaError ? (
              <div className="flex flex-col gap-2 rounded-control border border-risk/40 bg-risk/10 p-3">
                <span className="text-label uppercase text-risk">Security Check</span>
                <p className="text-callout text-text-2">{captchaError}</p>
                <button
                  type="button"
                  onClick={() => void loadManualCaptcha()}
                  className="self-start text-callout font-semibold text-accent hover:underline"
                >
                  Retry loading captcha
                </button>
              </div>
            ) : captchaSession ? (
              <div className="flex flex-col gap-2 rounded-control border border-line bg-ink-1 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-label uppercase text-text-3">Security Check</span>
                  <button
                    type="button"
                    onClick={() => void loadManualCaptcha()}
                    disabled={loadingCaptcha}
                    className="text-callout text-accent hover:underline disabled:opacity-50"
                  >
                    {loadingCaptcha ? "Reloading…" : "Reload"}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <img
                    src={captchaSession.captchaBase64}
                    alt="Captcha security check"
                    className="h-10 w-auto rounded-md bg-white object-contain px-2 py-0.5 border border-line select-none"
                  />
                </div>
                <input
                  type="text"
                  value={captchaInput}
                  onChange={(e) => setCaptchaInput(e.target.value)}
                  placeholder="Enter the 6 characters shown above"
                  className="mt-1 w-full appearance-none rounded-control border border-line bg-ink-0 px-3 py-2 text-headline text-text-1 outline-none focus:border-accent placeholder:text-text-3"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  autoFocus
                  maxLength={6}
                  required
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void loadManualCaptcha()}
                disabled={loadingCaptcha}
                className="self-start text-callout text-accent hover:underline disabled:opacity-50"
              >
                Solve captcha manually
              </button>
            )}

            {error && <p className="text-callout text-risk mt-1">{error}</p>}
            <div className="mt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                full
                disabled={
                  busy ||
                  !username.trim() ||
                  !password ||
                  loadingCaptcha ||
                  (Boolean(captchaSession) && !captchaInput.trim())
                }
              >
                {busy
                  ? "Signing in…"
                  : loadingCaptcha
                  ? "Loading security check…"
                  : `Update ${type}`}
              </Button>
            </div>
          </form>

          <p className="text-callout text-text-3 mt-2">
            Your credentials are encrypted on-device. Verification checks are handled automatically.
          </p>
        </div>
      </Sheet>
    </>
  );
}
