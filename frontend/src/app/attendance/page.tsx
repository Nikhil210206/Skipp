"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "@/components/AppShell";
import Ring from "@/components/Ring";
import StatePanel, { Spinner } from "@/components/StatePanel";
import { useSession } from "@/context/SessionContext";
import { predict, projectSkip } from "@/lib/predictor";
import type { Subject } from "@/types";

const THRESHOLDS = [75, 80, 85, 90];

export default function AttendancePage() {
  const { attendance, attendanceState, attendanceMessage } = useSession();
  const [threshold, setThreshold] = useState(75);

  const subjects = attendance?.subjects ?? [];
  const totalAttended = subjects.reduce((s, x) => s + x.attended, 0);
  const totalConducted = subjects.reduce((s, x) => s + x.conducted, 0);
  const overall = predict(totalAttended, totalConducted, threshold);

  return (
    <AppShell title="attendance">
      {attendanceState === "loading" && (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      )}

      {attendanceState === "gated" && (
        <StatePanel
          icon="⏳"
          tone="warning"
          title="Not live yet"
          message={attendanceMessage ?? undefined}
        />
      )}

      {attendanceState === "error" && (
        <StatePanel
          icon="⚠️"
          tone="danger"
          title="Couldn't load attendance"
          message={attendanceMessage ?? undefined}
        />
      )}

      {attendanceState === "ready" && attendance && (
        <>
          {/* Overall */}
          <div className="mb-4 flex items-center gap-4 rounded-2xl bg-surface p-5">
            <Ring
              percentage={overall.percentage}
              threshold={threshold}
              size={84}
              label="overall"
            />
            <div className="min-w-0">
              <p className="text-sm text-text-muted">Overall</p>
              <p className="text-2xl font-bold">
                {overall.percentage.toFixed(1)}%
              </p>
              <p
                className={`text-xs font-medium ${
                  overall.isSafe ? "text-success" : "text-danger"
                }`}
              >
                {overall.isSafe
                  ? `${overall.canSkip} classes to spare`
                  : `attend ${overall.mustAttend} to reach ${threshold}%`}
              </p>
            </div>
          </div>

          {/* Target threshold */}
          <div className="mb-4">
            <p className="mb-2 px-1 text-xs uppercase tracking-wider text-text-muted">
              target
            </p>
            <div className="flex gap-2">
              {THRESHOLDS.map((t) => (
                <button
                  key={t}
                  onClick={() => setThreshold(t)}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                    t === threshold
                      ? "bg-accent text-background"
                      : "bg-surface text-text-muted hover:text-text-primary"
                  }`}
                >
                  {t}%
                </button>
              ))}
            </div>
          </div>

          <ul className="flex flex-col gap-3 pb-6">
            {attendance.subjects.map((s, i) => (
              <SubjectRow key={`${s.code}-${s.slot ?? i}`} s={s} threshold={threshold} index={i} />
            ))}
          </ul>
        </>
      )}
    </AppShell>
  );
}

function SubjectRow({
  s,
  threshold,
  index,
}: {
  s: Subject;
  threshold: number;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const [skip, setSkip] = useState(1);
  const p = predict(s.attended, s.conducted, threshold);
  const projected = projectSkip(s.attended, s.conducted, skip);
  const projectedSafe = projected >= threshold;

  const line =
    s.conducted === 0
      ? { text: "No classes held yet", tone: "text-text-muted" }
      : p.isSafe
        ? p.canSkip > 0
          ? { text: `Can skip ${p.canSkip} more`, tone: "text-success" }
          : { text: "Right on the line", tone: "text-warning" }
        : { text: `Attend ${p.mustAttend} to recover`, tone: "text-danger" };

  return (
    <motion.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      className="rounded-2xl bg-surface p-4"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-4 text-left"
      >
        <Ring percentage={p.percentage} threshold={threshold} size={60} stroke={6} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{s.title || s.code}</p>
          <p className="text-xs text-text-muted">
            {s.code}
            {s.category ? ` · ${s.category}` : ""}
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span className="text-text-muted">
              {s.attended}/{s.conducted} classes
            </span>
            <span className={`font-medium ${line.tone}`}>{line.text}</span>
          </div>
        </div>
        <span
          className={`text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
        >
          ⌄
        </span>
      </button>

      {/* Bunk simulator */}
      <AnimatePresence initial={false}>
        {open && s.conducted > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-xl bg-background p-4">
              <p className="mb-3 text-xs uppercase tracking-wider text-text-muted">
                if i skip…
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Stepper
                    value={skip}
                    onChange={(v) => setSkip(Math.max(0, v))}
                  />
                  <span className="text-sm text-text-muted">
                    class{skip === 1 ? "" : "es"}
                  </span>
                </div>
                <div className="text-right">
                  <p
                    className={`text-2xl font-extrabold ${
                      projectedSafe ? "text-success" : "text-danger"
                    }`}
                  >
                    {projected.toFixed(1)}%
                  </p>
                  <p className="text-[11px] text-text-muted">
                    {projectedSafe ? `stays above ${threshold}%` : `drops below ${threshold}%`}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function Stepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(value - 1)}
        className="flex size-8 items-center justify-center rounded-lg bg-surface-2 text-lg font-bold text-text-primary"
      >
        −
      </button>
      <span className="w-6 text-center text-lg font-bold">{value}</span>
      <button
        onClick={() => onChange(value + 1)}
        className="flex size-8 items-center justify-center rounded-lg bg-surface-2 text-lg font-bold text-text-primary"
      >
        +
      </button>
    </div>
  );
}
