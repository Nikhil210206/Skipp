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

// ---------- Controls ---------------------------------------------

type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "outline" | "secondary" | "quiet" | "danger";
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
    "inline-flex select-none items-center justify-center gap-2 rounded-control font-semibold tracking-[-0.01em] transition-[background-color,border-color,color,opacity] duration-150 ease-out disabled:opacity-35 disabled:pointer-events-none";
  // Roomier horizontally than tall: a button should read as a word with air
  // around it, not as a slab of colour.
  const sizes =
    size === "lg"
      ? "min-h-[52px] px-7 text-headline"
      : "min-h-[44px] px-5 text-body";
  const variants = {
    primary: "bg-accent text-accent-ink hover:bg-accent/90 active:bg-accent/80",
    // The accent as ink rather than fill, for actions that sit over content.
    outline:
      "border border-accent/45 bg-ink-0/70 text-accent backdrop-blur-md hover:border-accent/80 hover:bg-accent/[0.07] active:bg-accent/[0.12]",
    secondary:
      "border border-line bg-ink-1 text-text-1 hover:border-line-strong hover:bg-ink-2 active:bg-ink-3",
    quiet: "text-text-3 hover:text-text-1 active:text-text-2",
    danger:
      "border border-risk/25 text-risk hover:border-risk/50 hover:bg-risk/[0.07] active:bg-risk/[0.12]",
  }[variant];
  return (
    <button
      ref={ref}
      data-btn
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
      data-icon-btn
      className={`flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-150 ease-out disabled:opacity-25 ${
        variant === "secondary"
          ? "border border-line bg-ink-1 text-text-1 hover:border-line-strong hover:bg-ink-2"
          : "text-text-3 hover:text-text-1"
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
      data-segmented
      className="flex gap-1 rounded-full border border-line-soft bg-ink-1 p-1.5"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="tab"
            aria-selected={active}
            data-segment
            onClick={() => onChange(o.value)}
            className={`relative min-h-[38px] flex-1 rounded-full text-callout font-semibold tracking-[-0.01em] transition-colors duration-150 ease-out ${
              active
                ? "border border-line bg-ink-3 text-text-1"
                : "border border-transparent text-text-3 hover:text-text-2"
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
      data-chip
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-label uppercase ${tones}`}
    >
      {children}
    </span>
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
