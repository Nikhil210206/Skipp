"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AppShell from "@/components/AppShell";
import { useSession } from "@/context/SessionContext";
import { setTheme, useTheme, type Theme } from "@/lib/theme";
import { revealIn, useGsap } from "@/lib/motion";
import { Button, Card, Divider, Label, Segmented } from "@/components/ui";

export default function ProfilePage() {
  const router = useRouter();
  const {
    student,
    timetable,
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
  const [seededFrom, setSeededFrom] = useState(displayName);
  const [saved, setSaved] = useState(false);
  if (displayName !== seededFrom) {
    setSeededFrom(displayName);
    setName(displayName);
  }
  const courses = timetable?.courses ?? [];
  const credits = courses.reduce((sum, c) => sum + (c.credit ?? 0), 0);

  const scope = useGsap(({ self, reduced }) => revealIn(self, reduced));

  function saveName() {
    setDisplayName(name);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  }

  return (
    <AppShell eyebrow={student?.registrationNumber ?? "Account"} title={displayName}>
      <div ref={scope} className="flex flex-1 flex-col gap-3">
        {/* Identity */}
        <Card data-reveal>
          <Label>Display name</Label>
          <div className="mt-3 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Display name"
              placeholder="What should we call you?"
              className="min-w-0 flex-1 rounded-control border border-line bg-ink-0 px-4 text-headline outline-none transition-colors focus:border-text-3"
            />
            <Button
              onClick={saveName}
              variant={saved ? "secondary" : "primary"}
              disabled={name.trim() === displayName || name.trim() === ""}
            >
              {saved ? "Saved" : "Save"}
            </Button>
          </div>
          <p className="mt-3 text-callout text-text-3">
            Shown in your greeting. Stored on this device only.
          </p>
        </Card>

        {/* Appearance */}
        <Card data-reveal>
          <Label>Appearance</Label>
          <div className="mt-3">
            <Segmented<Theme>
              label="Theme"
              value={theme}
              onChange={setTheme}
              options={[
                { value: "dark", label: "Dark" },
                { value: "light", label: "Light" },
              ]}
            />
          </div>
        </Card>

        {/* Term at a glance */}
        <Card data-reveal flush className="overflow-hidden">
          <div className="grid grid-cols-3">
            <Stat label="Courses" value={String(courses.length)} />
            <Stat label="Credits" value={String(credits)} bordered />
            <Stat label="Semester" value={student?.semester ?? "—"} bordered />
          </div>
        </Card>

        {/* Details */}
        <Card data-reveal flush className="overflow-hidden">
          <div className="px-5 pb-1 pt-4">
            <Label>Student</Label>
          </div>
          <dl>
            <Detail k="Name" v={tidy(student?.name)} />
            <Detail k="Programme" v={tidy(student?.program)} />
            <Detail k="Department" v={tidy(student?.department)} />
            <Detail k="Section" v={student?.section} />
            <Detail k="Batch" v={student?.batch} />
            <Detail k="Mobile" v={student?.mobile} />
            <Detail k="Academic year" v={timetable?.academicYear} />
          </dl>
        </Card>

        {/* Courses */}
        {courses.length > 0 && (
          <Card data-reveal flush className="overflow-hidden">
            <div className="px-5 pb-1 pt-4">
              <Label>Registered courses</Label>
            </div>
            <ul>
              {courses.map((c, i) => (
                <li key={`${c.code}-${c.slot ?? i}`}>
                  {i > 0 && <Divider inset={20} />}
                  <div className="px-5 py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-body">{c.title}</p>
                      {c.slot && (
                        <span className="tnum shrink-0 text-callout text-text-3">
                          {c.slot.replace(/-$/, "")}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 tnum text-callout text-text-3">
                      {[c.code, c.credit != null ? `${c.credit} cr` : null, c.faculty]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Data */}
        <Card data-reveal>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <Label>Data</Label>
              <p className="mt-2 text-callout text-text-3">
                Updated {timeAgo(fetchedAt)} · {customClasses.length} added,{" "}
                {optionalCourses.length} optional
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => void refresh()}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing" : "Refresh"}
            </Button>
          </div>
        </Card>

        <div data-reveal className="mt-2">
          <Button
            variant="danger"
            size="lg"
            full
            onClick={() => {
              logout();
              router.replace("/");
            }}
          >
            Sign out
          </Button>
          <p className="mt-5 text-callout leading-relaxed text-text-3">
            Not affiliated with SRM. Your data is never stored on our servers. It lives
            on this device and is cleared when you sign out or clear browsing data.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  bordered,
}: {
  label: string;
  value: string;
  bordered?: boolean;
}) {
  return (
    <div className={`px-4 py-5 text-center ${bordered ? "border-l border-line-soft" : ""}`}>
      <p className="tnum text-title">{value}</p>
      <p className="mt-1 text-label uppercase text-text-3">{label}</p>
    </div>
  );
}

function Detail({ k, v }: { k: string; v?: string | null }) {
  if (!v) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-2.5">
      <dt className="shrink-0 text-callout text-text-3">{k}</dt>
      <dd className="truncate text-callout text-text-1">{v}</dd>
    </div>
  );
}

/**
 * The portal stores everything in caps and forgets spaces before brackets.
 * Present it the way it would be written by hand.
 */
function tidy(value?: string | null): string | undefined {
  if (!value) return undefined;
  const spaced = value.replace(/\s*\(/, " (");
  if (spaced !== spaced.toUpperCase()) return spaced;
  return spaced
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\(([a-z]+)\)/gi, (_, inner) => `(${inner.toUpperCase()})`);
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
