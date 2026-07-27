"use client";

import { useState } from "react";
import { useSession } from "@/context/SessionContext";
import { AuthError, PortalError, type FailureCode } from "@/lib/api";
import { Button } from "@/components/ui";

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
}: {
  onPhase: (p: SignInPhase) => void;
}) {
  const { login } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setFailure(null);
    setBusy(true);
    onPhase("working");
    try {
      await login({ username: username.trim(), password });
      // The page takes it from here: it holds the screen for the landing and
      // routes when that is finished.
      onPhase("done");
    } catch (err) {
      onPhase("idle");
      const code =
        err instanceof AuthError || err instanceof PortalError
          ? err.code
          : "portal";
      setFailure(
        explain(code, err instanceof Error ? err.message : "Sign-in failed."),
      );
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
      <Field
        id="username"
        label="SRM Net ID"
        value={username}
        onChange={setUsername}
        placeholder="ab1234"
        autoComplete="username"
      />
      <Field
        id="password"
        label="Password"
        value={password}
        onChange={setPassword}
        placeholder="••••••••"
        type="password"
        autoComplete="current-password"
      />

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
          variant="outline"
          size="lg"
          full
          disabled={busy || !username || !password}
        >
          {busy ? "Signing in" : "Continue"}
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
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div
      data-enter
      className="rounded-control border border-line bg-ink-1 px-4 py-3 transition-colors focus-within:border-text-3"
    >
      <label htmlFor={id} className="text-label uppercase text-text-3">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full bg-transparent text-headline text-text-1 outline-none placeholder:text-text-3"
      />
    </div>
  );
}
