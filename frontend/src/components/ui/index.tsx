"use client";

// ============================================================
// SKIPP UI PRIMITIVES
// Every screen is assembled from these. If a screen needs a new
// look, the primitive changes, not the screen.
// ============================================================

import { useEffect, useRef } from "react";
import { pressable } from "@/lib/motion";

// ---------- Text -------------------------------------------------

/** Small caps label. The only uppercase in the app. */
export function Label({
  children,
  className = "",
  tone = "muted",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "muted" | "accent" | "plain";
}) {
  const c =
    tone === "accent" ? "text-accent" : tone === "plain" ? "text-text-1" : "text-text-3";
  return (
    <p className={`text-label uppercase ${c} ${className}`}>{children}</p>
  );
}

// ---------- Surfaces ---------------------------------------------

/**
 * The one card in the system. `flush` drops the padding for lists that
 * manage their own rows.
 */
export function Card({
  children,
  className = "",
  flush = false,
  as: As = "div",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  flush?: boolean;
  as?: "div" | "section" | "li";
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <As
      className={`rounded-card border border-line-soft bg-ink-1 ${
        flush ? "" : "p-5"
      } ${className}`}
      {...rest}
    >
      {children}
    </As>
  );
}

/** Full-bleed hairline used to separate rows inside a flush Card. */
export function Divider({ inset = 0 }: { inset?: number }) {
  return (
    <div className="rule" style={{ marginLeft: inset, marginRight: 0 }} role="presentation" />
  );
}

// ---------- Controls ---------------------------------------------

type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "quiet" | "danger";
  size?: "md" | "lg";
  disabled?: boolean;
  full?: boolean;
  className?: string;
  "aria-label"?: string;
};

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  size = "md",
  disabled,
  full,
  className = "",
  ...rest
}: ButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => pressable(ref.current), []);
  const base =
    "inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none";
  const sizes = size === "lg" ? "min-h-[54px] px-6 text-headline" : "min-h-[44px] px-4 text-body";
  const variants = {
    primary: "bg-accent text-accent-ink hover:brightness-105",
    secondary: "bg-ink-2 text-text-1 hover:bg-ink-3",
    quiet: "text-text-2 hover:text-text-1",
    danger: "border border-risk/30 text-risk hover:bg-risk/10",
  }[variant];
  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes} ${variants} ${full ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Icon-only button with a guaranteed 44px target. */
export function IconButton({
  children,
  onClick,
  label,
  disabled,
  variant = "secondary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  label: string;
  disabled?: boolean;
  variant?: "secondary" | "quiet";
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => pressable(ref.current), []);
  return (
    <button
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`flex size-11 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-30 ${
        variant === "secondary"
          ? "bg-ink-2 text-text-1 hover:bg-ink-3"
          : "text-text-2 hover:text-text-1"
      }`}
    >
      {children}
    </button>
  );
}

/** Segmented control. One selected option, never zero. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: React.ReactNode; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-1 rounded-full border border-line-soft bg-ink-1 p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`relative min-h-[38px] flex-1 rounded-full text-callout font-semibold transition-colors ${
              active ? "bg-ink-3 text-text-1" : "text-text-3 hover:text-text-2"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Status pill. Text carries the meaning; colour only reinforces it. */
export function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "safe" | "watch" | "risk" | "accent";
}) {
  const tones = {
    neutral: "border-line text-text-3",
    safe: "border-safe/35 text-safe",
    watch: "border-watch/40 text-watch",
    risk: "border-risk/40 text-risk",
    accent: "border-accent/40 text-accent",
  }[tone];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-label uppercase ${tones}`}
    >
      {children}
    </span>
  );
}

/** Linear progress. Replaces the ring: reads faster, stacks in lists. */
export function Meter({
  value,
  tone = "neutral",
  className = "",
}: {
  value: number;
  tone?: "neutral" | "safe" | "watch" | "risk";
  className?: string;
}) {
  const fill = {
    neutral: "bg-text-3",
    safe: "bg-safe",
    watch: "bg-watch",
    risk: "bg-risk",
  }[tone];
  return (
    <div
      className={`h-[3px] w-full overflow-hidden rounded-full bg-ink-3 ${className}`}
      role="presentation"
    >
      <div
        data-meter
        className={`h-full rounded-full ${fill}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

// ---------- States -----------------------------------------------

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="size-5 animate-spin rounded-full border-2 border-line border-t-accent"
    />
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-control bg-ink-2 ${className}`} />;
}

/** Empty, gated and error states share one shape so they feel like one app. */
export function StateView({
  title,
  message,
  tone = "neutral",
  action,
}: {
  title: string;
  message?: string;
  tone?: "neutral" | "watch" | "risk";
  action?: React.ReactNode;
}) {
  const bar = { neutral: "bg-text-3", watch: "bg-watch", risk: "bg-risk" }[tone];
  return (
    <div className="flex flex-1 flex-col items-start justify-center py-20">
      <div className={`mb-5 h-[3px] w-10 rounded-full ${bar}`} />
      <h2 className="text-title text-text-1">{title}</h2>
      {message && <p className="mt-2 max-w-[34ch] text-body text-text-3">{message}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
