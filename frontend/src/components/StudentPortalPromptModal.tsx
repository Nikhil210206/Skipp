"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Overlay";
import { Button, IconButton, Label } from "@/components/ui";
import { IconClose } from "@/components/Icons";
import { useSession } from "@/context/SessionContext";
import {
  AuthError,
  initStudentPortalLogin,
  type StudentPortalCaptchaResponse,
} from "@/lib/api";
import {
  isRegistrationNumber,
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
      setError("Enter your Net ID.");
      return;
    }

    if (isRegistrationNumber(cleanUser)) {
      setError(
        "The Student Portal signs in with your Net ID, like ab1234, not your registration number."
      );
      return;
    }

    if (!password) {
      setError("Enter your Student Portal password.");
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
            "Incorrect NetID or password. Remember: your Student Portal password is often different from your Academia password."
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "The portal wants a security check. Type the letters below."
        );
        void loadManualCaptcha();
      }
    } finally {
      setBusy(false);
    }
  };

  // No early return while closed: the Modal keeps itself mounted through its
  // own exit, so the popup fades out instead of vanishing in one frame.
  const locked = busy || success;

  return (
    <Modal open={open} onClose={handleDismiss} label="Connect the Student Portal">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 pt-2">
          <Label>sp.srmist.edu.in</Label>
          <h2 className="mt-2 text-title text-text-1">
            Your attendance and marks are on the Student Portal
          </h2>
        </div>
        <div className="-mr-2 -mt-1 shrink-0">
          <IconButton onClick={handleDismiss} label="Close" variant="quiet">
            <IconClose size={18} />
          </IconButton>
        </div>
      </div>

      <p className="mt-2 text-body text-text-2">
        SRM has switched both off on Academia for now. Sign in to the Student
        Portal once and Skipp reads your attendance and internal marks from
        there.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3" noValidate>
        <PortalField id="portal-username" label="Net ID" suffix="@srmist.edu.in">
          <input
            id="portal-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={locked}
            className={INPUT}
          />
        </PortalField>

        <div>
          <PortalField
            id="portal-password"
            label="Student Portal password"
            action={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                // 44px tall to tap, pulled back out of the row with negative
                // margins so the label line keeps its height.
                className="-my-3 -mr-2 min-h-11 px-2 text-label uppercase text-text-2 hover:text-text-1"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            }
          >
            <input
              id="portal-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={locked}
              className={INPUT}
            />
          </PortalField>
          <p className="mt-1.5 px-1 text-callout text-text-3">
            Often not the same as your Academia password.
          </p>
        </div>

        {/* Only when reading the security check automatically failed. */}
        {captchaSession && (
          <PortalField
            id="portal-captcha"
            label="Type the letters you see"
            action={
              <button
                type="button"
                onClick={() => void loadManualCaptcha()}
                disabled={loadingCaptcha || busy}
                className="-my-3 -mr-2 min-h-11 px-2 text-label uppercase text-text-2 hover:text-text-1 disabled:opacity-40"
              >
                {loadingCaptcha ? "Loading" : "New one"}
              </button>
            }
          >
            <div className="flex items-center gap-3">
              {/* On white whatever the look: the portal draws dark letters on
                  a transparent ground, unreadable on a dark card. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={captchaSession.captchaBase64}
                alt="Security check letters"
                className="h-10 w-auto shrink-0 select-none rounded-control bg-white object-contain px-2 py-0.5"
              />
              <input
                id="portal-captcha"
                type="text"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value.toUpperCase())}
                maxLength={6}
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                disabled={busy}
                className={`${INPUT} tnum uppercase tracking-[0.2em]`}
              />
            </div>
          </PortalField>
        )}

        {/* Polite, so a screen reader hears the error or the result without
            losing its place in the form. */}
        <div aria-live="polite">
          {error && <p className="px-1 text-callout text-risk">{error}</p>}
          {success && (
            <p className="px-1 text-callout text-text-2">
              Connected. Loading your attendance and marks.
            </p>
          )}
        </div>

        <div className="mt-1 flex flex-col gap-1">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            full
            disabled={locked || !username.trim() || !password}
          >
            {busy ? "Signing in" : success ? "Connected" : "Connect"}
          </Button>
          <Button type="button" variant="quiet" full onClick={handleDismiss} disabled={busy}>
            Not now
          </Button>
        </div>

        <p className="px-1 pb-1 text-center text-callout text-text-3">
          Your password is encrypted on this device and never stored on our
          servers.
        </p>
      </form>
    </Modal>
  );
}

const INPUT =
  "min-w-0 w-full flex-1 appearance-none bg-transparent text-headline text-text-1 outline-none focus:outline-none focus-visible:outline-none placeholder:text-text-3 disabled:opacity-60";

/**
 * The sign-in screen's field, on the popup's raised card: the whole box is the
 * label, so a tap anywhere in it focuses the input, and `data-field` gives it
 * each look's field treatment (Stone cuts it into the wall) and drops the
 * global focus ring for the box's own accent border.
 */
function PortalField({
  id,
  label,
  suffix,
  action,
  children,
}: {
  id: string;
  label: string;
  suffix?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      data-field
      className="block cursor-text rounded-control border border-line bg-ink-2 px-4 py-3 transition-colors focus-within:border-accent"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-label uppercase text-text-3">{label}</span>
        {action}
      </span>
      <span className="mt-1.5 flex items-baseline gap-1">
        {children}
        {suffix && <span className="shrink-0 text-headline text-text-3">{suffix}</span>}
      </span>
    </label>
  );
}
