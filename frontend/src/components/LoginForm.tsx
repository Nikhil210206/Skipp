"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/context/SessionContext";
import { Button } from "@/components/ui";

/**
 * Login. Verifies credentials through the backend, keeps the session in
 * memory, and routes on.
 */
export default function LoginForm() {
  const router = useRouter();
  const { login } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await login({ username: username.trim(), password });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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

      {error && (
        <p role="alert" className="text-callout text-risk">
          {error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        full
        disabled={busy || !username || !password}
        className="mt-2"
      >
        {busy ? "Signing in" : "Continue"}
      </Button>
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
    <div className="rounded-control border border-line bg-ink-1 px-4 py-3 transition-colors focus-within:border-text-3">
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
