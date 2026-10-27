"use client";

import { useEffect, useState, useRef } from "react";
import { Modal } from "@/components/ui/Overlay";
import { Button, IconButton } from "@/components/ui";
import { IconClose } from "@/components/Icons";
import { useSession } from "@/context/SessionContext";
import {
  AuthError,
  initStudentPortalLogin,
  type StudentPortalCaptchaResponse,
} from "@/lib/api";
import {
  isRegistrationNumber,
  loadPortalCredentials,
  savePortalCredentials,
} from "@/lib/crypto";

export default function StudentPortalPromptModal() {
  const {
    isAuthed,
    restoring,
    creds,
    portalCreds,
    portalAtt,
    loginSource,
    autoImportAttendance,
    importAttendance,
    student,
  } = useSession();

  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Captcha fallback if auto-OCR needs human verification
  const [captchaSession, setCaptchaSession] =
    useState<StudentPortalCaptchaResponse | null>(null);
  const [captchaInput, setCaptchaInput] = useState("");
  const [loadingCaptcha, setLoadingCaptcha] = useState(false);

  const reg = student?.registrationNumber ?? "";

  // Auto-open condition:
  // When user is authenticated via Academia, attendance is missing or gated,
  // and they haven't dismissed this prompt during the current browser session.
  useEffect(() => {
    if (restoring || !isAuthed) return;
    if (loginSource === "portal") return;
    if (portalAtt && portalAtt.attendance?.subjects?.length > 0) return;

    // Check if dismissed in this session
    const dismissKey = `skipp.portal_prompt_dismissed.${reg || "guest"}`;
    const dismissed = sessionStorage.getItem(dismissKey);
    if (!dismissed) {
      // Delay slightly for smooth page entrance
      const timer = window.setTimeout(() => {
        // Pre-fill Net ID if username is a Net ID
        const candidateUser =
          portalCreds?.username ||
          (creds && !isRegistrationNumber(creds.username) ? creds.username : "");
        const cleanUser = candidateUser.includes("@")
          ? candidateUser.split("@")[0].trim()
          : candidateUser.trim();
        setUsername(cleanUser);
        setOpen(true);
      }, 700);
      return () => window.clearTimeout(timer);
    }
  }, [isAuthed, restoring, loginSource, portalAtt, reg, creds, portalCreds]);

  // Global event listener to open from anywhere (e.g. attendance page banner)
  useEffect(() => {
    const handleOpen = () => {
      setError(null);
      setSuccess(false);
      setCaptchaSession(null);
      setCaptchaInput("");
      const candidateUser =
        portalCreds?.username ||
        (creds && !isRegistrationNumber(creds.username) ? creds.username : "");
      const cleanUser = candidateUser.includes("@")
        ? candidateUser.split("@")[0].trim()
        : candidateUser.trim();
      setUsername(cleanUser);
      setPassword(portalCreds?.password || "");
      setOpen(true);
    };

    window.addEventListener("skipp:open-portal-modal", handleOpen);
    return () => window.removeEventListener("skipp:open-portal-modal", handleOpen);
  }, [creds, portalCreds]);

  const handleDismiss = () => {
    const dismissKey = `skipp.portal_prompt_dismissed.${reg || "guest"}`;
    sessionStorage.setItem(dismissKey, "1");
    setOpen(false);
  };

  const loadManualCaptcha = async () => {
    setLoadingCaptcha(true);
    setError(null);
    setCaptchaInput("");
    try {
      const data = await initStudentPortalLogin();
      setCaptchaSession(data);
    } catch (e) {
      console.error("Failed to load captcha:", e);
      setError(
        e instanceof Error ? e.message : "Failed to load captcha. Tap to try again."
      );
    } finally {
      setLoadingCaptcha(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawUser = username.trim();
    const cleanUser = rawUser.includes("@")
      ? rawUser.split("@")[0].trim()
      : rawUser;

    if (!cleanUser) {
      setError("Please enter your SRM Net ID.");
      return;
    }

    if (isRegistrationNumber(cleanUser)) {
      setError(
        "Student Portal requires your SRM Net ID (e.g. ab1234), not your registration number (RA...)."
      );
      return;
    }

    if (!password) {
      setError("Please enter your Student Portal password.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      if (captchaSession) {
        if (!captchaInput.trim()) {
          setError("Please enter the 6 security characters shown below.");
          setBusy(false);
          return;
        }
        await importAttendance({
          username: cleanUser,
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
        const portalLoginCreds = { username: cleanUser, password };
        await autoImportAttendance(portalLoginCreds);
      }

      await savePortalCredentials({ username: cleanUser, password });
      setSuccess(true);

      // Close modal smoothly after brief success confirmation
      setTimeout(() => {
        const dismissKey = `skipp.portal_prompt_dismissed.${reg || "guest"}`;
        sessionStorage.setItem(dismissKey, "1");
        setOpen(false);
        setSuccess(false);
      }, 1000);
    } catch (err) {
      console.error("Portal login failed:", err);
      const isAuthErr =
        err instanceof AuthError &&
        (err.code === "wrong_password" || err.code === "user_not_found");
      
      if (isAuthErr) {
        setError(
          err.message ||
            "Incorrect NetID or password. Remember: your Student Portal password is often different from your Academia password (it is your SRM student email password)."
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Verification required. Please enter the captcha below."
        );
        void loadManualCaptcha();
      }
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={handleDismiss}
      maxWidth="max-w-md"
    >
      <div className="flex flex-col">
        {/* Header with Student Portal Badge */}
        <div className="flex items-start justify-between gap-3 pb-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-accent">
              <span className="size-1.5 rounded-full bg-accent animate-pulse" />
              SRM Student Portal · sp.srmist.edu.in
            </div>
            <h2 className="mt-2.5 text-title font-bold text-text-1">
              Connect Student Portal
            </h2>
          </div>
          <IconButton onClick={handleDismiss} label="Close" variant="quiet">
            <IconClose size={20} />
          </IconButton>
        </div>

        {/* Highlighted Portal Detail Box */}
        <div className="mt-1 rounded-xl border border-accent/25 bg-accent/[0.06] p-3.5 text-callout leading-relaxed text-text-2">
          <p className="font-semibold text-text-1">
            Why is this needed?
          </p>
          <p className="mt-1">
            Academia attendance is currently gated by university administrators.
            Sign in with your <strong className="text-text-1">Student Portal</strong> credentials
            to view your real-time attendance, margins, and internal marks.
          </p>
          <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-line-soft bg-ink-2/80 p-2 text-caption text-text-2">
            <span className="shrink-0 text-accent font-bold">ℹ️ Tip:</span>
            <span>
              Your Student Portal password is your <strong>SRM student email password</strong>,
              which is often <em>different</em> from your Academia password.
            </span>
          </div>
        </div>

        {/* Error / Success Banners */}
        {error && (
          <div className="mt-3 rounded-lg border border-risk/30 bg-risk/10 p-3 text-caption text-risk">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-3 rounded-lg border border-safe/30 bg-safe/10 p-3 text-center text-callout font-semibold text-safe">
            ✓ Connected! Loading attendance and marks...
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          {/* NetID Field */}
          <label className="block cursor-text rounded-control border border-line bg-ink-2 px-3.5 py-2.5 transition-colors focus-within:border-accent">
            <span className="block text-label uppercase text-text-3">
              SRM Net ID (Username)
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <input
                id="portal-username"
                type="text"
                value={username}
                placeholder="e.g. ab1234"
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                disabled={busy || success}
                className="min-w-0 flex-1 appearance-none bg-transparent text-headline text-text-1 outline-none placeholder:text-text-3"
              />
              <span className="shrink-0 text-callout text-text-3 select-none">
                @srmist.edu.in
              </span>
            </div>
          </label>

          {/* Password Field */}
          <label className="block cursor-text rounded-control border border-line bg-ink-2 px-3.5 py-2.5 transition-colors focus-within:border-accent">
            <div className="flex items-center justify-between">
              <span className="block text-label uppercase text-text-3">
                Student Portal Password
              </span>
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-caption text-accent hover:underline select-none"
                tabIndex={-1}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <input
              id="portal-password"
              type={showPassword ? "text" : "password"}
              value={password}
              placeholder="••••••••"
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={busy || success}
              className="mt-1 w-full appearance-none bg-transparent text-headline text-text-1 outline-none placeholder:text-text-3"
            />
          </label>

          {/* Manual Captcha Box (only shown if OCR verification needed) */}
          {captchaSession && (
            <div className="rounded-control border border-line bg-ink-2 p-3">
              <div className="flex items-center justify-between">
                <span className="text-label uppercase text-text-3">
                  Security Check
                </span>
                <button
                  type="button"
                  onClick={() => void loadManualCaptcha()}
                  disabled={loadingCaptcha || busy}
                  className="text-caption text-accent hover:underline select-none"
                >
                  {loadingCaptcha ? "Refreshing..." : "Refresh"}
                </button>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <img
                  src={captchaSession.captchaBase64}
                  alt="Captcha"
                  className="h-10 w-auto rounded-md bg-white object-contain px-2 py-0.5 select-none"
                />
                <input
                  type="text"
                  value={captchaInput}
                  onChange={(e) => setCaptchaInput(e.target.value.toUpperCase())}
                  placeholder="Enter 6 letters"
                  maxLength={6}
                  disabled={busy}
                  className="w-full appearance-none rounded-md border border-line bg-ink-1 px-3 py-2 text-headline uppercase text-text-1 tracking-wider outline-none focus:border-accent"
                />
              </div>
            </div>
          )}

          {/* Submit & Dismiss Buttons */}
          <div className="mt-2 flex flex-col gap-2">
            <Button
              type="submit"
              variant="primary"
              full
              disabled={busy || success || !username.trim() || !password}
            >
              {busy
                ? "Connecting & solving captcha..."
                : success
                ? "Connected!"
                : "Connect & View Attendance"}
            </Button>

            <Button
              type="button"
              variant="quiet"
              full
              onClick={handleDismiss}
              disabled={busy}
            >
              Maybe later
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
