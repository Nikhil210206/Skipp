"use client";

import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import StatePanel from "@/components/StatePanel";
import { useSession } from "@/context/SessionContext";

export default function TimetablePage() {
  const { timetable } = useSession();

  return (
    <AppShell title="timetable">
      {!timetable || timetable.courses.length === 0 ? (
        <StatePanel
          icon="▤"
          title="No courses found"
          message="Your registered courses will appear here."
        />
      ) : (
        <>
          {timetable.academicYear && (
            <p className="mb-3 px-1 text-xs text-text-muted">
              {timetable.academicYear.replace(/-/g, " ")}
            </p>
          )}
          <ul className="flex flex-col gap-3 pb-6">
            {timetable.courses.map((c, i) => (
              <motion.li
                key={`${c.code}-${c.slot ?? i}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
                className="flex items-center gap-3 rounded-2xl bg-surface p-4"
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-sm font-bold text-accent">
                  {c.slot?.replace(/-/g, "") || "—"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.title}</p>
                  <p className="truncate text-xs text-text-muted">
                    {c.code}
                    {c.faculty ? ` · ${c.faculty}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs text-text-muted">
                  {c.room && <p>{c.room}</p>}
                  {c.credit != null && <p>{c.credit} cr</p>}
                </div>
              </motion.li>
            ))}
          </ul>
        </>
      )}
    </AppShell>
  );
}
