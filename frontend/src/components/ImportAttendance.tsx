"use client";

import { useState, useRef, useEffect } from "react";
import { Button, Segmented } from "@/components/ui";
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
    importAttendanceHtml,
    loginSource,
  } = useSession();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"paste" | "login">("paste");
  const [pastedText, setPastedText] = useState("");
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
      setPastedText("");
      setTab("login");
      setError("Portal session renewal required. Enter the captcha once to keep attendance synced.");
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
    setPastedText("");
    setTab("login");
    setUsername(creds?.username || (sessionCreds && !isRegistrationNumber(sessionCreds.username) ? sessionCreds.username : ""));
    setPassword(creds?.password || "");
    setCaptchaSession(null);
    setCaptchaInput("");
    setOpen(true);
    void loadManualCaptcha();
  };

  const handlePasteImport = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = pastedText.trim();
    if (!raw) return;

    setBusy(true);
    setError(null);
    try {
      if (type === "marks") {
        await importAttendanceHtml(undefined, raw);
      } else {
        await importAttendanceHtml(raw);
      }
      setPastedText("");
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not parse report from pasted content. Make sure you copied the Attendance Details page."
      );
    } finally {
      setBusy(false);
    }
  };

  const runLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawUsername = username.trim();
    const cleanUsername = rawUsername.includes("@")
      ? rawUsername.split("@")[0].trim()
      : rawUsername;

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
        <div className="flex flex-col gap-4 pb-2">
          <Segmented
            label="Import Method"
            value={tab}
            onChange={(v) => {
              setError(null);
              setTab(v as "paste" | "login");
            }}
            options={[
              { value: "login", label: "Sign In (Auto-Sync)" },
              { value: "paste", label: "Instant Sync (HTML)" },
            ]}
          />

          {tab === "paste" ? (
            <InstantImportForm
              type={type}
              busy={busy}
              error={error}
              pastedText={pastedText}
              setPastedText={setPastedText}
              onSubmit={handlePasteImport}
            />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="rounded-control border border-line bg-ink-1/60 p-3 text-callout text-text-2">
                Solve the captcha once to establish your session. Skipp will automatically keep your attendance synced every class in the background.
              </div>

              <form onSubmit={runLogin} className="flex flex-col gap-3">
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
                  autoComplete="off"
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
                      ? "Sign In & Get Marks"
                      : "Sign In & Auto-Sync"}
                  </Button>
                </div>
              </form>

              <p className="text-callout text-text-3 mt-1">
                SRM's portal may block cloud server logins. If credentials report incorrect, switch to the <strong>Instant Sync</strong> tab above.
              </p>
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
}

function InstantImportForm({
  type,
  busy,
  error,
  pastedText,
  setPastedText,
  onSubmit,
}: {
  type: "attendance" | "marks";
  busy: boolean;
  error: string | null;
  pastedText: string;
  setPastedText: (text: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const isMarks = type === "marks";
  const reportUrl = isMarks
    ? "https://sp.srmist.edu.in/srmiststudentportal/students/report/studentInternalMarkDetails.jsp"
    : "https://sp.srmist.edu.in/srmiststudentportal/students/report/studentAttendanceDetails.jsp";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="rounded-control border border-line bg-ink-1/60 p-3 text-callout text-text-2">
        Already signed into the Student Portal in your browser? Import directly in 5 seconds with <strong>zero captcha or password errors</strong>.
      </div>

      <div className="flex flex-col gap-3 rounded-control border border-line bg-ink-1 p-3.5">
        <div className="flex items-start gap-2.5">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-label font-semibold text-accent">
            1
          </span>
          <div className="text-callout text-text-2">
            Open the report in a new tab:
            <div className="mt-1">
              <a
                href={reportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
              >
                <span>{isMarks ? "Open Marks Report ↗" : "Open Attendance Report ↗"}</span>
              </a>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-label font-semibold text-accent">
            2
          </span>
          <p className="text-callout text-text-2">
            On that page, select all (<strong>Ctrl+A</strong> / <strong>Cmd+A</strong>) and copy (<strong>Ctrl+C</strong> / <strong>Cmd+C</strong>).
            <span className="block text-text-3 mt-0.5">Or right-click &gt; View Page Source and copy all.</span>
          </p>
        </div>

        <div className="flex items-start gap-2.5">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-label font-semibold text-accent">
            3
          </span>
          <p className="text-callout text-text-2">
            Paste into the box below and tap Import.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor={`paste-${type}`} className="text-label uppercase text-text-3">
            Pasted Report Content
          </label>
          {pastedText && (
            <button
              type="button"
              onClick={() => setPastedText("")}
              className="text-label uppercase text-text-3 hover:text-text-1"
            >
              Clear
            </button>
          )}
        </div>
        <textarea
          id={`paste-${type}`}
          value={pastedText}
          onChange={(e) => setPastedText(e.target.value)}
          onPaste={(e) => {
            const html = e.clipboardData.getData("text/html");
            if (
              html &&
              (html.includes("<table") ||
                html.includes("<tr") ||
                html.includes("attendance") ||
                html.includes("mark") ||
                html.includes("code"))
            ) {
              e.preventDefault();
              setPastedText(html);
            }
          }}
          placeholder="Paste copied content or page source here (Ctrl+V / Cmd+V)..."
          rows={4}
          className="w-full appearance-none rounded-control border border-line bg-ink-0 p-3 font-mono text-callout text-text-1 outline-none focus:border-accent placeholder:text-text-3"
          autoFocus
        />
        {pastedText ? (
          <span className="text-label text-safe">
            ✓ Content detected ({Math.round((pastedText.length / 1024) * 10) / 10 || 0.1} KB)
          </span>
        ) : null}
      </div>

      {error && <p className="text-callout text-risk">{error}</p>}

      <div className="mt-1">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          full
          disabled={busy || !pastedText.trim()}
        >
          {busy
            ? "Importing…"
            : isMarks
            ? "Import Marks Now"
            : "Import Attendance Now"}
        </Button>
      </div>
    </form>
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
            autoComplete={autoComplete || "off"}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            onChange={(e) => {
              let val = e.target.value.trim();
              if (val.includes("@")) {
                val = val.split("@")[0].trim();
              }
              onChange(val);
            }}
            className="min-w-0 flex-1 appearance-none bg-transparent text-headline text-text-1 outline-none placeholder:text-text-3"
          />
          <span className="shrink-0 text-headline text-text-3">{suffix}</span>
        </div>
      ) : (
        <input
          id={id}
          type={effectiveType}
          value={value}
          autoComplete={autoComplete || "off"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          onChange={(e) => onChange(e.target.value.replace(/[\r\n\u200b\ufeff]/g, ""))}
          placeholder={placeholder}
          className="mt-1.5 w-full appearance-none bg-transparent text-headline text-text-1 outline-none placeholder:text-text-3"
        />
      )}
    </label>
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
    importAttendanceHtml,
    clearImportedAttendance,
    refresh,
    loginSource,
  } = useSession();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "updating" | "updated" | "no_new_data">("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const isBehind = type === "attendance" && isPortalDateBehindToday(reportedPeriod);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"paste" | "login">("paste");
  const [pastedText, setPastedText] = useState("");
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
      setPastedText("");
      setTab("login");
      setError("Portal session renewal required. Enter the captcha once to keep attendance synced.");
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

  const handlePasteImport = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = pastedText.trim();
    if (!raw) return;

    setBusy(true);
    setError(null);
    try {
      if (type === "marks") {
        await importAttendanceHtml(undefined, raw);
      } else {
        await importAttendanceHtml(raw);
      }
      setPastedText("");
      setOpen(false);
      setStatus("updated");
      if (updatedTimer.current) clearTimeout(updatedTimer.current);
      updatedTimer.current = setTimeout(() => setStatus("idle"), 2500);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not parse report from pasted content. Make sure you copied the Attendance Details page."
      );
    } finally {
      setBusy(false);
    }
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
        setPastedText("");
        setTab("login");
        if (err instanceof AuthError && (err.code === "wrong_password" || err.code === "user_not_found")) {
          setPassword("");
          setError(err.message || "Incorrect NetID or password. Please update your credentials.");
          setOpen(true);
          void loadManualCaptcha();
        } else {
          setError(err instanceof Error ? err.message : "Verification check required. Enter the captcha once to sync.");
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
    setPastedText("");
    setTab("login");
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
      
      <Sheet open={open} onClose={() => { if (!busy) setOpen(false); }} title={`Update ${type}`}>
        <div className="flex flex-col gap-4 pb-2">
          <Segmented
            label="Update Method"
            value={tab}
            onChange={(v) => {
              setError(null);
              setTab(v as "paste" | "login");
            }}
            options={[
              { value: "login", label: "Sign In (Auto-Sync)" },
              { value: "paste", label: "Instant Sync (HTML)" },
            ]}
          />

          {tab === "paste" ? (
            <InstantImportForm
              type={type}
              busy={busy}
              error={error}
              pastedText={pastedText}
              setPastedText={setPastedText}
              onSubmit={handlePasteImport}
            />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="rounded-control border border-line bg-ink-1/60 p-3 text-callout text-text-2">
                Solve the captcha once to establish your session. Skipp will automatically keep your attendance synced every class in the background.
              </div>

              <form onSubmit={runLogin} className="flex flex-col gap-3">
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
                  autoComplete="off"
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
                      : type === "marks"
                      ? "Sign In & Get Marks"
                      : "Sign In & Auto-Sync"}
                  </Button>
                </div>
              </form>

              <p className="text-callout text-text-3 mt-1">
                SRM's portal may block cloud server logins. If credentials report incorrect, switch to the <strong>Instant Sync</strong> tab above.
              </p>
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
}
