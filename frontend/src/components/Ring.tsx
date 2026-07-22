"use client";

import { motion } from "framer-motion";

// A circular progress ring colored by attendance safety.
// green >= threshold, amber within 5% below, red otherwise.

function colorFor(pct: number, threshold: number): string {
  if (pct >= threshold) return "var(--color-success)";
  if (pct >= threshold - 5) return "var(--color-warning)";
  return "var(--color-danger)";
}

export default function Ring({
  percentage,
  threshold = 75,
  size = 72,
  stroke = 7,
  label,
}: {
  percentage: number;
  threshold?: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percentage));
  const offset = circumference * (1 - clamped / 100);
  const color = colorFor(percentage, threshold);

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${percentage.toFixed(0)} percent`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold" style={{ color }}>
          {percentage.toFixed(0)}%
        </span>
        {label && <span className="text-[10px] text-text-muted">{label}</span>}
      </div>
    </div>
  );
}
