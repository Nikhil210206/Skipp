"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Overlay";
import { Button, IconButton, Label } from "@/components/ui";
import { IconClose } from "@/components/Icons";
import { useSession } from "@/context/SessionContext";
import {
  CaptchaField,
  NetIdField,
  PortalPasswordField,
  PortalPromise,
  PortalStatus,
  portalInputError,
} from "@/components/PortalFields";
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

    const invalid = portalInputError(cleanUser, password, isRegistrationNumber);
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
        <NetIdField id="portal-username" value={username} onChange={setUsername} disabled={locked} />
        <PortalPasswordField
          id="portal-password"
          value={password}
          onChange={setPassword}
          disabled={locked}
        />

        {/* Only when reading the security check automatically failed. */}
        {(captchaSession || loadingCaptcha) && (
          <CaptchaField
            id="portal-captcha"
            session={captchaSession}
            loading={loadingCaptcha}
            error={null}
            value={captchaInput}
            onChange={setCaptchaInput}
            onReload={() => void loadManualCaptcha()}
            disabled={busy}
          />
        )}

        <PortalStatus
          error={error}
          done={success ? "Connected. Loading your attendance and marks." : null}
        />

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

        <PortalPromise />
      </form>
    </Modal>
  );
}
