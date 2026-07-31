"use client";

import { useRef, useState } from "react";
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
    case "slow_portal":
      return {
        title: "The portal is being slow",
        advice:
          "SRM did not answer in time, so we stopped rather than leave your session hanging. Try again in a moment.",
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
  const { login } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);

  // Reported from the change handlers rather than an effect: the parent draws
  // a progress rule from it, and setState in an effect is rejected by the
  // compiler lint.
  const report = (u: string, p: string) =>
    onFilled?.((u.trim() ? 1 : 0) + (p ? 1 : 0));

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
        suffix="@srmist.edu.in"
        value={username}
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
            type={type}
            value={value}
            autoComplete={autoComplete}
            onChange={(e) => onChange(e.target.value)}
            className="min-w-0 flex-1 appearance-none bg-transparent text-headline text-text-1 outline-none focus:outline-none focus-visible:outline-none placeholder:text-text-3"
          />
          <span className="shrink-0 text-headline text-text-3">{suffix}</span>
        </div>
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="mt-1.5 w-full appearance-none bg-transparent text-headline text-text-1 outline-none focus:outline-none focus-visible:outline-none placeholder:text-text-3"
        />
      )}
    </label>
  );
}
