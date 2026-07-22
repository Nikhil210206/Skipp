"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import Ring from "@/components/Ring";
import { Spinner } from "@/components/StatePanel";
import { useSession } from "@/context/SessionContext";
import { useResource } from "@/hooks/useResource";
import { fetchAttendance } from "@/lib/api";

export default function DashboardPage() {
  const { student } = useSession();
  const att = useResource(fetchAttendance);

  return (
    <AppShell title="skipp">
      {/* Student card */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 rounded-2xl bg-surface p-5"
      >
        <p className="text-lg font-semibold">{student?.name ?? "—"}</p>
        <p className="mt-1 text-sm text-text-muted">
          {student?.registrationNumber}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-muted">
          {student?.department && (
            <span className="rounded-full bg-background px-2.5 py-1">
              {student.department}
            </span>
          )}
          {student?.section && (
            <span className="rounded-full bg-background px-2.5 py-1">
              Section {student.section}
            </span>
          )}
          {student?.semester && (
            <span className="rounded-full bg-background px-2.5 py-1">
              Sem {student.semester}
            </span>
          )}
        </div>
      </motion.section>

      {/* Overall attendance */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mb-4 flex items-center gap-4 rounded-2xl bg-surface p-5"
      >
        {att.status === "ready" ? (
          <>
            <Ring
              percentage={att.data.overallPercentage}
              threshold={att.data.threshold}
              size={84}
            />
            <div>
              <p className="text-sm text-text-muted">Overall attendance</p>
              <p className="text-2xl font-bold">
                {att.data.overallPercentage.toFixed(1)}%
              </p>
              <Link href="/attendance" className="text-sm text-accent">
                see the breakdown →
              </Link>
            </div>
          </>
        ) : att.status === "loading" ? (
          <div className="flex h-[84px] w-full items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <div>
            <p className="text-sm text-text-muted">Overall attendance</p>
            <p className="mt-1 text-sm text-warning">
              {att.status === "gated"
                ? "Not on the portal yet."
                : "Couldn't load attendance."}
            </p>
          </div>
        )}
      </motion.section>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { href: "/marks", label: "Marks", icon: "◆" },
          { href: "/timetable", label: "Timetable", icon: "▤" },
        ].map((l, i) => (
          <motion.div
            key={l.href}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
          >
            <Link
              href={l.href}
              className="flex h-24 flex-col items-center justify-center gap-1 rounded-2xl bg-surface transition-colors hover:bg-white/5"
            >
              <span className="text-2xl text-accent">{l.icon}</span>
              <span className="text-sm">{l.label}</span>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="h-6" />
    </AppShell>
  );
}
