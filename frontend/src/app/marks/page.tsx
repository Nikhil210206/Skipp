"use client";

import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import StatePanel, { Spinner } from "@/components/StatePanel";
import { useSession } from "@/context/SessionContext";

function pct(scored: number, max: number): number {
  return max > 0 ? (scored / max) * 100 : 0;
}

export default function MarksPage() {
  const { marks, marksState, marksMessage } = useSession();

  return (
    <AppShell title="marks">
      {marksState === "loading" && (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      )}

      {marksState === "gated" && (
        <StatePanel
          icon="⏳"
          tone="warning"
          title="No marks yet"
          message={marksMessage ?? undefined}
        />
      )}

      {marksState === "error" && (
        <StatePanel
          icon="⚠️"
          tone="danger"
          title="Couldn't load marks"
          message={marksMessage ?? undefined}
        />
      )}

      {marksState === "ready" && marks && marks.subjects.length === 0 && (
        <StatePanel
          icon="◆"
          title="Nothing graded yet"
          message="Marks will show here once your internal assessments are published."
        />
      )}

      {marksState === "ready" && marks && marks.subjects.length > 0 && (
        <ul className="flex flex-col gap-3 pb-6">
          {marks.subjects.map((s, i) => (
            <motion.li
              key={s.code}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3) }}
              className="rounded-2xl bg-surface p-4"
            >
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.title || s.code}</p>
                  <p className="text-xs text-text-muted">{s.code}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-accent">
                  {s.scoredTotal}
                  <span className="text-text-muted">/{s.maxTotal}</span>
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {s.components.map((c) => (
                  <div key={c.name}>
                    <div className="mb-0.5 flex justify-between text-xs">
                      <span className="text-text-muted">{c.name}</span>
                      <span>
                        {c.scored}/{c.max}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-background">
                      <motion.div
                        className="h-full rounded-full bg-accent"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct(c.scored, c.max)}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                ))}
                {s.components.length === 0 && (
                  <p className="text-xs text-text-muted">No components yet.</p>
                )}
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
