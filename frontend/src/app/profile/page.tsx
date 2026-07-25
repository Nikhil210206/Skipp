"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import { useSession } from "@/context/SessionContext";
import { setTheme, useTheme, type Theme } from "@/lib/theme";
import { IconCheck, IconMoon, IconSun, IconUser } from "@/components/Icons";

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
    fetchedAt,
    refresh,
    refreshing,
    logout,
  } = useSession();

  const theme = useTheme();
  const [name, setName] = useState(displayName);
  const [saved, setSaved] = useState(false);

  const courses = timetable?.courses ?? [];
  const totalCredits = courses.reduce((sum, c) => sum + (c.credit ?? 0), 0);

  function saveName() {
    setDisplayName(name);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  const initial = (displayName.trim()[0] ?? "s").toUpperCase();

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
            className="min-w-0 flex-1 rounded-xl border border-line-strong bg-background px-4 py-3 outline-none focus:border-accent"
          />
          <button
            onClick={saveName}
            disabled={name.trim() === displayName}
            className="rounded-xl bg-accent px-4 py-3 font-semibold text-background transition-opacity disabled:opacity-40"
          >
            {saved ? (
              <span className="flex items-center gap-1.5">
                <IconCheck size={16} />
                saved
              </span>
            ) : (
              "save"
            )}
          </button>
        </div>
        <p className="mt-2 text-xs text-text-muted">
          Shown in your greeting. Stored only on this device.
        </p>
      </Card>

      {/* Appearance */}
      <Card>
        <Label>appearance</Label>
        <div className="flex gap-1 rounded-full bg-background p-1">
          <ThemeOption
            value="dark"
            current={theme}
            label="dark"
            icon={<IconMoon size={16} />}
          />
          <ThemeOption
            value="light"
            current={theme}
            label="light"
            icon={<IconSun size={16} />}
          />
        </div>
        <p className="mt-2 text-xs text-text-muted">
          Remembered on this device.
        </p>
      </Card>

      {/* Academic summary */}
      <div className="mb-3 grid grid-cols-3 gap-3">
        <Stat
          label="attendance"
          value={
            attendanceState === "ready" && attendance
              ? `${attendance.overallPercentage.toFixed(0)}%`
              : "n/a"
          }
        />
        <Stat label="courses" value={String(courses.length)} />
        <Stat label="credits" value={String(totalCredits)} />
      </div>

      {/* Student details */}
      <Card>
        <Label>student details</Label>
        <dl className="flex flex-col divide-y divide-line">
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
                className="border-b border-line pb-3 last:border-0 last:pb-0"
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
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted">
                    <IconUser size={13} />
                    <span className="truncate">{c.faculty}</span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Data freshness */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <Label>data</Label>
            <p className="-mt-1 text-sm text-text-muted">
              updated {timeAgo(fetchedAt)}
            </p>
          </div>
          <button
            onClick={() => void refresh()}
            disabled={refreshing}
            className="rounded-xl bg-surface-2 px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
          >
            {refreshing ? "refreshing…" : "refresh"}
          </button>
        </div>
      </Card>

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
        Not affiliated with SRM. Your data is never stored on our servers. It
        lives only on this device.
      </p>
    </AppShell>
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return "just now";
  const secs = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ThemeOption({
  value,
  current,
  label,
  icon,
}: {
  value: Theme;
  current: Theme;
  label: string;
  icon: React.ReactNode;
}) {
  const active = current === value;
  return (
    <button
      onClick={() => setTheme(value)}
      aria-pressed={active}
      className={`flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold lowercase transition-colors ${
        active
          ? "bg-accent text-background"
          : "text-text-muted hover:text-text-primary"
      }`}
    >
      {icon}
      {label}
    </button>
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
        {v || "not set"}
      </dd>
    </div>
  );
}
