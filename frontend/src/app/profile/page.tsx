"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import { useSession } from "@/context/SessionContext";

export default function ProfilePage() {
  const router = useRouter();
  const {
    student,
    timetable,
    attendance,
    attendanceState,
    displayName,
    setDisplayName,
    customClasses,
    optionalCourses,
    logout,
  } = useSession();

  const [name, setName] = useState(displayName);
  const [saved, setSaved] = useState(false);

  const courses = timetable?.courses ?? [];
  const totalCredits = courses.reduce((sum, c) => sum + (c.credit ?? 0), 0);

  function saveName() {
    setDisplayName(name);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  const initial = (displayName.trim()[0] ?? "🎓").toUpperCase();

  return (
    <AppShell title="profile">
      {/* Avatar + editable name */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5 flex flex-col items-center pt-2"
      >
        <div className="flex size-20 items-center justify-center rounded-3xl bg-accent text-4xl font-extrabold text-background">
          {initial}
        </div>
        <p className="mt-3 text-xl font-extrabold lowercase tracking-tight">
          {displayName}
        </p>
        {student?.registrationNumber && (
          <p className="text-sm text-text-muted">{student.registrationNumber}</p>
        )}
      </motion.section>

      {/* Set display name */}
      <Card>
        <Label>your name</Label>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="what should we call you?"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-background px-4 py-3 outline-none focus:border-accent"
          />
          <button
            onClick={saveName}
            disabled={name.trim() === displayName}
            className="rounded-xl bg-accent px-4 py-3 font-semibold text-background transition-opacity disabled:opacity-40"
          >
            {saved ? "saved ✓" : "save"}
          </button>
        </div>
        <p className="mt-2 text-xs text-text-muted">
          Shown in your greeting. Stored only on this device.
        </p>
      </Card>

      {/* Academic summary */}
      <div className="mb-3 grid grid-cols-3 gap-3">
        <Stat
          label="attendance"
          value={
            attendanceState === "ready" && attendance
              ? `${attendance.overallPercentage.toFixed(0)}%`
              : "—"
          }
        />
        <Stat label="courses" value={String(courses.length)} />
        <Stat label="credits" value={String(totalCredits)} />
      </div>

      {/* Student details */}
      <Card>
        <Label>student details</Label>
        <dl className="flex flex-col divide-y divide-white/5">
          <Row k="Name" v={student?.name} />
          <Row k="Registration No" v={student?.registrationNumber} />
          <Row k="Program" v={student?.program} />
          <Row k="Department" v={student?.department} />
          <Row k="Section" v={student?.section} />
          <Row k="Semester" v={student?.semester} />
          <Row k="Batch" v={student?.batch} />
          <Row k="Mobile" v={student?.mobile} />
          <Row k="Academic Year" v={timetable?.academicYear} />
        </dl>
      </Card>

      {/* Courses */}
      {courses.length > 0 && (
        <Card>
          <Label>courses ({courses.length})</Label>
          <ul className="flex flex-col gap-3">
            {courses.map((c, i) => (
              <li
                key={`${c.code}-${c.slot ?? i}`}
                className="border-b border-white/5 pb-3 last:border-0 last:pb-0"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-medium">{c.title}</p>
                  {c.slot && (
                    <span className="shrink-0 rounded-md bg-surface-2 px-2 py-0.5 text-xs text-text-muted">
                      {c.slot.replace(/-$/, "")}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-text-muted">
                  {c.code}
                  {c.credit != null ? ` · ${c.credit} cr` : ""}
                  {c.category ? ` · ${c.category}` : ""}
                </p>
                {c.faculty && (
                  <p className="mt-0.5 text-xs text-text-muted">👤 {c.faculty}</p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Your additions */}
      <Card>
        <Label>your customizations</Label>
        <div className="flex justify-between text-sm">
          <span className="text-text-muted">Custom classes</span>
          <span className="font-semibold">{customClasses.length}</span>
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-text-muted">Optional courses</span>
          <span className="font-semibold">{optionalCourses.length}</span>
        </div>
      </Card>

      {/* Log out */}
      <button
        onClick={() => {
          logout();
          router.replace("/");
        }}
        className="mb-4 w-full rounded-2xl border border-danger/30 bg-danger/[0.07] py-4 font-semibold text-danger transition-colors hover:bg-danger/10"
      >
        log out
      </button>

      <p className="mb-6 px-2 text-center text-xs text-text-muted">
        Not affiliated with SRM. Your data is never stored on our servers — it
        lives only on this device.
      </p>
    </AppShell>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 rounded-2xl bg-surface p-4">{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
      {children}
    </p>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-surface px-2 py-4">
      <span className="text-2xl font-extrabold tracking-tight text-accent">
        {value}
      </span>
      <span className="mt-0.5 text-[11px] uppercase tracking-wider text-text-muted">
        {label}
      </span>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-sm text-text-muted">{k}</dt>
      <dd className="max-w-[60%] truncate text-right text-sm font-medium">
        {v || "—"}
      </dd>
    </div>
  );
}
