"use client";

import { useRef, useState } from "react";
import { useSession } from "@/context/SessionContext";
import {
  AuthError,
  PortalError,
  initStudentPortalLogin,
  type FailureCode,
} from "@/lib/api";
import { Button, Segmented } from "@/components/ui";
import type { LoginPortalMode } from "@/lib/crypto";
import type { StudentPortalCaptchaResponse } from "@/types";

type Failure = { title: string; advice: string };

/**
 * Each way a sign-in can fail needs different advice. A wrong password is the
 * user's to fix; the daily cap and the CAPTCHA are the portal's doing and there
 * is nothing to retype, so saying "check your details" would send someone in
 * circles.
 */
function explain(code: FailureCode, message: string): Failure {
  switch (code) {
    case "user_not_found":
      return {
        title: "No account with that Net ID",
        advice:
          "Use the Net ID you sign in to the SRM portal with, without the @srmist.edu.in.",
      };
    case "wrong_password":
      return {
        title: "That password did not work",
        advice: "Check it and try again. It is the same one the portal uses.",
      };
    case "captcha":
      return {
        title: "The portal wants a CAPTCHA",
        advice:
          "Too many sign-ins in a row. Open the SRM portal, sign in there once, then come back.",
      };
    case "signin_limit":
      return {
        title: "SRM's daily sign-in limit is reached",
        advice:
          "The portal caps sign-ins per account each day. It clears in a few hours; nothing is wrong with your account.",
      };
    case "slow_portal":
      return {
        title: "The portal is being slow",
        advice:
          "SRM did not answer in time, so Skipp stopped rather than leave your session hanging. Try again in a moment.",
      };
    case "unreachable":
      return {
        title: "Cannot reach Skipp",
        advice: "The app cannot talk to its server. Check your connection.",
      };
    default:
      return { title: "The portal did not respond properly", advice: message };
  }
}

/**
 * Where the sign-in has got to. The page uses this to stage the wait: the
 * portal round trip is slow enough to be worth showing, and the moment it lands
 * is worth showing too.
 */
export type SignInPhase = "idle" | "working" | "done";

/** Verifies against the portal and hands the session to the page. */
export default function LoginForm({
  onPhase,
  onFilled,
}: {
  onPhase: (p: SignInPhase) => void;
  /** How many of the two fields have something in them, 0 to 2. */
  onFilled?: (n: number) => void;
}) {
  const { login, loginPortal } = useSession();
  const [mode, setMode] = useState<LoginPortalMode>("academia");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);

  // Manual captcha state if OCR fails or is needed
  const [captchaSession, setCaptchaSession] =
    useState<StudentPortalCaptchaResponse | null>(null);
  const [captchaInput, setCaptchaInput] = useState("");
  const [loadingCaptcha, setLoadingCaptcha] = useState(false);

  const report = (u: string, p: string) =>
    onFilled?.((u.trim() ? 1 : 0) + (p ? 1 : 0));

  async function loadManualCaptcha() {
    setLoadingCaptcha(true);
    setCaptchaSession(null);
    setCaptchaInput("");
    try {
      const data = await initStudentPortalLogin();
      setCaptchaSession(data);
    } catch {
      // Ignored; user can retry
    } finally {
      setLoadingCaptcha(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;

    const form = e.currentTarget;
    const usernameInput =
      (form.elements.namedItem("username") as HTMLInputElement | null) ||
      form.querySelector<HTMLInputElement>("#username");
    const passwordInput =
      (form.elements.namedItem("password") as HTMLInputElement | null) ||
      form.querySelector<HTMLInputElement>("#password");

    const domUsername = usernameInput?.value ?? "";
    const domPassword = passwordInput?.value ?? "";

    const rawUsername = (domUsername || username).trim();
    const cleanUsername = rawUsername.includes("@")
      ? rawUsername.split("@")[0].trim()
      : rawUsername;
    const effectivePassword = domPassword || password;

    if (!cleanUsername) {
      setFailure({
        title: "Net ID required",
        advice: "Please enter your SRM Net ID or registration number.",
      });
      return;
    }
    if (!effectivePassword) {
      setFailure({
        title: "Password required",
        advice: "Please enter your password.",
      });
      return;
    }

    if (cleanUsername !== username) setUsername(cleanUsername);
    if (effectivePassword !== password) setPassword(effectivePassword);

    setFailure(null);
    setBusy(true);
    onPhase("working");

    try {
      if (mode === "portal") {
        if (captchaSession) {
          // Manual captcha submission
          await loginPortal(
            { username: cleanUsername, password: effectivePassword },
            {
              captcha: captchaInput.trim(),
              sessionCookie: captchaSession.sessionCookie,
              domainField: captchaSession.domainField,
              captchaField: captchaSession.captchaField,
              randomDelim: captchaSession.randomDelim,
              honeypotField: captchaSession.honeypotField,
            },
          );
        } else {
          // Automatic OCR login
          await loginPortal({ username: cleanUsername, password: effectivePassword });
        }
      } else {
        await login({ username: cleanUsername, password: effectivePassword });
      }
      onPhase("done");
    } catch (err) {
      onPhase("idle");
      const code =
        err instanceof AuthError || err instanceof PortalError
          ? err.code
          : "portal";

      // If in portal mode and automated captcha failed, fall back to manual captcha
      if (mode === "portal") {
        const isWrongCreds = code === "wrong_password";
        setFailure({
          title: isWrongCreds ? "Check your credentials" : "Sign-in required attention",
          advice:
            err instanceof Error
              ? err.message
              : "Verification failed. Please check your credentials or enter the captcha below.",
        });
        if (!isWrongCreds) {
          void loadManualCaptcha();
        }
      } else {
        setFailure(
          explain(code, err instanceof Error ? err.message : "Sign-in failed."),
        );
      }
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
      {/* Portal switcher: Academia vs Student Portal */}
      <div data-enter className="mb-1">
        <Segmented<LoginPortalMode>
          label="Login portal"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setFailure(null);
            setCaptchaSession(null);
            setCaptchaInput("");
          }}
          options={[
            { value: "academia", label: "Academia" },
            { value: "portal", label: "Student Portal (1st Year)" },
          ]}
        />
        {mode === "portal" && (
          <p className="mt-2 text-callout text-text-3">
            For 1st year students who only have SRM Student Portal credentials.
          </p>
        )}
      </div>

      <Field
        id="username"
        label={mode === "portal" ? "SRM Net ID or Reg No." : "SRM Net ID"}
        suffix={mode === "academia" ? "@srmist.edu.in" : undefined}
        value={username}
        placeholder={mode === "portal" ? "e.g. ra2411003010001 or net ID" : undefined}
        onChange={(v) => {
          setUsername(v);
          report(v, password);
        }}
        autoComplete="username"
      />
      <Field
        id="password"
        label="Password"
        value={password}
        onChange={(v) => {
          setPassword(v);
          report(username, v);
        }}
        placeholder="••••••••"
        type="password"
        autoComplete="current-password"
      />

      {/* Manual captcha box if activated */}
      {mode === "portal" && captchaSession && (
        <div data-enter className="flex flex-col gap-2 rounded-control border border-line bg-ink-1 p-3">
          <span className="text-label uppercase text-text-3">Security Check</span>
          <div className="flex items-center gap-3">
            <img
              src={captchaSession.captchaBase64}
              alt="Captcha"
              className="h-10 w-auto rounded-md bg-white object-contain px-2 py-0.5"
            />
            <button
              type="button"
              onClick={() => void loadManualCaptcha()}
              disabled={loadingCaptcha}
              className="text-callout text-accent hover:underline disabled:opacity-50"
            >
              {loadingCaptcha ? "Reloading..." : "Reload"}
            </button>
          </div>
          <input
            type="text"
            value={captchaInput}
            onChange={(e) => setCaptchaInput(e.target.value)}
            placeholder="Enter the characters above"
            className="mt-1 w-full appearance-none bg-transparent text-headline text-text-1 outline-none placeholder:text-text-3"
            required
          />
        </div>
      )}

      {failure && (
        <div role="alert" className="pt-1">
          <p className="text-callout font-semibold text-risk">{failure.title}</p>
          <p className="mt-1 text-callout leading-relaxed text-text-3">
            {failure.advice}
          </p>
        </div>
      )}

      {/* The entrance animates this wrapper, never the Button itself: the
          Button already owns its own transform through `pressable`, and two
          tweens on one element leave it stuck at whichever ran first. */}
      <div data-enter className="mt-3">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          full
          disabled={
            busy ||
            !username ||
            !password ||
            (mode === "portal" && Boolean(captchaSession) && !captchaInput)
          }
        >
          {busy
            ? mode === "portal"
              ? "Signing in via Portal…"
              : "Signing in…"
            : "Continue"}
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
  /** Fixed text shown after what you type, as part of the same address. */
  suffix?: string;
}) {
  const input = useRef<HTMLInputElement>(null);

  return (
    // The whole box is the label, so tapping anywhere in it focuses the input
    // rather than only the few pixels the text happens to occupy.
    <label
      htmlFor={id}
      data-field
      data-enter
      className="block cursor-text rounded-control border border-line bg-ink-1 px-4 py-3 transition-colors focus-within:border-accent"
    >
      <span className="block text-label uppercase text-text-3">{label}</span>
      {suffix ? (
        // The input takes the whole row and the domain sits at the end of it.
        // Sizing the input to its own text was tried and was a real bug on a
        // phone: it made the tap target only as wide as the text, so most of
        // the field looked like an input and did nothing when you touched it.
        // A field you cannot tap is worse than a suffix that does not hug.
        <div className="mt-1.5 flex items-baseline gap-1">
          <input
            ref={input}
            id={id}
            name={id}
            type={type}
            value={value}
            autoComplete={autoComplete}
            onChange={(e) => onChange(e.target.value)}
            onInput={(e) => onChange(e.currentTarget.value)}
            className="min-w-0 flex-1 appearance-none bg-transparent text-headline text-text-1 outline-none focus:outline-none focus-visible:outline-none placeholder:text-text-3"
          />
          <span className="shrink-0 text-headline text-text-3">{suffix}</span>
        </div>
      ) : (
        <input
          ref={input}
          id={id}
          name={id}
          type={type}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          onInput={(e) => onChange(e.currentTarget.value)}
          placeholder={placeholder}
          className="mt-1.5 w-full appearance-none bg-transparent text-headline text-text-1 outline-none focus:outline-none focus-visible:outline-none placeholder:text-text-3"
        />
      )}
    </label>
  );
}
