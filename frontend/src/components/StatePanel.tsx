"use client";

import { motion } from "framer-motion";

// Full-height panel for loading / empty / gated / error states.

export function Spinner() {
  return (
    <div
      className="size-8 animate-spin rounded-full border-2 border-white/15 border-t-accent"
      aria-label="Loading"
    />
  );
}

export default function StatePanel({
  icon,
  title,
  message,
  tone = "muted",
}: {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  tone?: "muted" | "warning" | "danger";
}) {
  const color =
    tone === "danger"
      ? "text-danger"
      : tone === "warning"
        ? "text-warning"
        : "text-text-muted";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-16 text-center"
    >
      {icon && <div className={`text-4xl ${color}`}>{icon}</div>}
      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      {message && (
        <p className="max-w-xs text-sm text-text-muted">{message}</p>
      )}
    </motion.div>
  );
}
