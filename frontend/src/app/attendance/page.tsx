"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import Ring from "@/components/Ring";
import StatePanel, { Spinner } from "@/components/StatePanel";
import PredictModal from "@/components/PredictModal";
import NumBadge from "@/components/NumBadge";
import { useSession } from "@/context/SessionContext";
import { predict } from "@/lib/predictor";
import type { Subject } from "@/types";
import { IconAlert, IconHourglass, IconWand } from "@/components/Icons";

const THRESHOLD = 75;

export default function AttendancePage() {
  const { attendance, attendanceState, attendanceMessage } = useSession();
  const [predictOpen, setPredictOpen] = useState(false);

  const subjects = attendance?.subjects ?? [];
  const totalAttended = subjects.reduce((s, x) => s + x.attended, 0);
  const totalConducted = subjects.reduce((s, x) => s + x.conducted, 0);
  const overall = predict(totalAttended, totalConducted, THRESHOLD);

  return (
    <AppShell title="attendance">
      {attendanceState === "loading" && (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      )}

      {attendanceState === "gated" && (
        <StatePanel
          icon={<IconHourglass size={30} />}
          tone="warning"
          title="Not live yet"
          message={attendanceMessage ?? undefined}
        />
      )}

      {attendanceState === "error" && (
        <StatePanel
          icon={<IconAlert size={30} />}
          tone="danger"
          title="Couldn't load attendance"
          message={attendanceMessage ?? undefined}
        />
      )}

      {attendanceState === "ready" && attendance && (
        <>
          {/* Overall */}
          <div className="mb-3 flex items-center gap-4 rounded-2xl bg-surface p-5">
            <Ring
              percentage={overall.percentage}
              threshold={THRESHOLD}
              size={84}
              label="overall"
            />
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-text-muted">
                overall · {overall.percentage.toFixed(1)}%
              </p>
              <p
                className={`text-5xl font-extrabold leading-none ${
                  overall.isSafe ? "text-success" : "text-danger"
                }`}
              >
                {overall.isSafe ? overall.canSkip : overall.mustAttend}
              </p>
              <p
                className={`text-sm font-medium ${
                  overall.isSafe ? "text-success" : "text-danger"
                }`}
              >
                {overall.isSafe
                  ? "classes to spare"
                  : `required to reach ${THRESHOLD}%`}
              </p>
            </div>
          </div>

          {/* Predict button */}
          <button
            onClick={() => setPredictOpen(true)}
            className="mb-4 flex w-full items-center justify-between rounded-2xl bg-accent px-5 py-4 text-left"
          >
            <span>
              <span className="block font-extrabold uppercase tracking-wide text-background">
                predict
              </span>
              <span className="block text-xs text-background/70">
                plan your leaves and see the impact
              </span>
            </span>
            <span className="text-background">
              <IconWand size={24} />
            </span>
          </button>

          <ul className="flex flex-col gap-3 pb-6">
            {attendance.subjects.map((s, i) => (
              <SubjectRow key={`${s.code}-${s.slot ?? i}`} s={s} index={i} />
            ))}
          </ul>
        </>
      )}

      <PredictModal open={predictOpen} onClose={() => setPredictOpen(false)} />
    </AppShell>
  );
}

function SubjectRow({ s, index }: { s: Subject; index: number }) {
  const p = predict(s.attended, s.conducted, THRESHOLD);
  return (
    <motion.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      className="flex items-center gap-4 rounded-2xl bg-surface p-4"
    >
      <Ring percentage={s.percentage} threshold={THRESHOLD} size={52} stroke={5} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{s.title || s.code}</p>
        <p className="text-xs text-text-muted">
          {s.code}
          {s.category ? ` · ${s.category}` : ""} · {s.attended}/{s.conducted}
        </p>
      </div>
      {/* The actionable number is the hero */}
      {s.conducted === 0 ? (
        <span className="shrink-0 text-xs text-text-muted">no classes</span>
      ) : !p.isSafe ? (
        <NumBadge n={p.mustAttend} label="required" tone="text-danger" />
      ) : (
        <NumBadge
          n={p.canSkip}
          label="can skip"
          tone={p.canSkip > 0 ? "text-success" : "text-warning"}
        />
      )}
    </motion.li>
  );
}
