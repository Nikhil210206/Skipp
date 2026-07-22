"use client";

import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import Ring from "@/components/Ring";
import StatePanel, { Spinner } from "@/components/StatePanel";
import { useResource } from "@/hooks/useResource";
import { fetchAttendance } from "@/lib/api";
import type { Subject } from "@/types";

function predictorLine(s: Subject): { text: string; tone: string } {
  if (s.conducted === 0)
    return { text: "No classes held yet", tone: "text-text-muted" };
  if (s.isSafe)
    return s.canSkip > 0
      ? { text: `Can skip ${s.canSkip} more`, tone: "text-success" }
      : { text: "Right on the line", tone: "text-warning" };
  return { text: `Attend ${s.mustAttend} to recover`, tone: "text-danger" };
}

export default function AttendancePage() {
  const att = useResource(fetchAttendance);

  return (
    <AppShell title="attendance">
      {att.status === "loading" && (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      )}

      {att.status === "gated" && (
        <StatePanel
          icon="⏳"
          tone="warning"
          title="Not live yet"
          message={att.message}
        />
      )}

      {att.status === "error" && (
        <StatePanel
          icon="⚠️"
          tone="danger"
          title="Couldn't load attendance"
          message={att.message}
        />
      )}

      {att.status === "ready" && (
        <>
          <div className="mb-4 flex items-center gap-4 rounded-2xl bg-surface p-5">
            <Ring
              percentage={att.data.overallPercentage}
              threshold={att.data.threshold}
              size={84}
              label="overall"
            />
            <div>
              <p className="text-sm text-text-muted">Overall</p>
              <p className="text-2xl font-bold">
                {att.data.overallPercentage.toFixed(1)}%
              </p>
              <p className="text-xs text-text-muted">
                target {att.data.threshold}%
              </p>
            </div>
          </div>

          <ul className="flex flex-col gap-3 pb-6">
            {att.data.subjects.map((s, i) => {
              const p = predictorLine(s);
              return (
                <motion.li
                  key={`${s.code}-${s.slot ?? i}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.3) }}
                  className="flex items-center gap-4 rounded-2xl bg-surface p-4"
                >
                  <Ring
                    percentage={s.percentage}
                    threshold={att.data.threshold}
                    size={60}
                    stroke={6}
                  />
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
                      <span className={`font-medium ${p.tone}`}>{p.text}</span>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </>
      )}
    </AppShell>
  );
}
