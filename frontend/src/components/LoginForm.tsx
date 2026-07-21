"use client";

import { motion } from "framer-motion";
import { useState } from "react";

/**
 * Phase 0 login shell — UI only. Wiring to POST /login (the backend scraper)
 * lands in Phase 2. For now, submit is a no-op placeholder.
 */
export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Phase 2: encrypt creds on-device, POST to backend, render attendance.
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
        className="mb-6 w-full rounded-xl border border-white/10 bg-background px-4 py-3 text-text-primary outline-none transition-colors focus:border-accent"
      />

      <motion.button
        type="submit"
        whileTap={{ scale: 0.98 }}
        className="w-full rounded-xl bg-accent py-3 font-semibold text-white transition-opacity hover:opacity-90"
      >
        See my attendance
      </motion.button>
    </motion.form>
  );
}
