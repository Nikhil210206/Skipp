"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/context/SessionContext";

/**
 * Login screen. Verifies credentials via the backend (the timetable endpoint),
 * stores the session in memory, and routes to the dashboard.
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
      setError(err instanceof Error ? err.message : "Login failed.");
      setBusy(false);
    }
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-lg shadow-black/40"
    >
      <label className="mb-2 block text-sm text-text-muted" htmlFor="username">
        SRM Net ID
      </label>
      <input
        id="username"
        type="text"
        autoComplete="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="ab1234"
        className="mb-4 w-full rounded-xl border border-white/10 bg-background px-4 py-3 text-text-primary outline-none transition-colors focus:border-accent"
      />

      <label className="mb-2 block text-sm text-text-muted" htmlFor="password">
        Password
      </label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        className="mb-4 w-full rounded-xl border border-white/10 bg-background px-4 py-3 text-text-primary outline-none transition-colors focus:border-accent"
      />

      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {error}
        </motion.p>
      )}

      <motion.button
        type="submit"
        disabled={busy || !username || !password}
        whileTap={{ scale: 0.98 }}
        className="w-full rounded-xl bg-accent py-3 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Logging in…" : "See my attendance"}
      </motion.button>
    </motion.form>
  );
}
