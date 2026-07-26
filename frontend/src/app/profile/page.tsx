"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AppShell from "@/components/AppShell";
import { useSession } from "@/context/SessionContext";
import { setTheme, useTheme, type Theme } from "@/lib/theme";
import { revealIn, revealRows, useGsap } from "@/lib/motion";
import { Button, Segmented } from "@/components/ui";
import { Marginalia, Rule, SectionHead } from "@/components/ui/editorial";

/**
 * Settings as a plain document: the name is the masthead, everything else is
 * label-and-value lines under small caps headings. No cards at all.
 */
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

  const fullName = tidy(student?.name) ?? displayName;
  const courses = timetable?.courses ?? [];
  const credits = courses.reduce((sum, c) => sum + (c.credit ?? 0), 0);
  const scope = useGsap(({ self, reduced }) => {
    revealIn(self, reduced, { y: 14, stagger: 0.06 });
    revealRows(self, reduced);
  });

  function saveName() {
    setDisplayName(name);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  }

  return (
    <AppShell section="Profile">
      <div ref={scope} className="flex flex-1 flex-col">
        {/* Masthead */}
        <div data-reveal className="pb-10 pt-5">
          {/* Set as large as the longest word allows. A name is not a numeral:
              cropping it mid-word would read as breakage, not as a crop. */}
          <h1
            className="optical font-bold leading-[0.84] tracking-[-0.05em]"
            style={{ fontSize: fitName(fullName) }}
          >
            {fullName}
          </h1>
          <p className="tnum mt-3 text-callout text-text-3">
            {[student?.registrationNumber, tidy(student?.program), student?.section]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        {/* Figures */}
        <div data-reveal className="flex items-baseline gap-9 pb-9">
          <Stat value={String(courses.length)} label="Courses" />
          <Stat value={String(credits)} label="Credits" />
          <Stat value={student?.semester ?? "—"} label="Semester" />
        </div>

        {/* Preferences */}
        <section className="pb-9">
          <SectionHead>Preferences</SectionHead>
          <div className="pt-5">
            <label htmlFor="name" className="text-callout text-text-3">
              What we call you
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="min-w-0 flex-1 border-b border-line bg-transparent pb-2 text-title outline-none transition-colors focus:border-accent"
              />
              <Button
                onClick={saveName}
                variant={saved ? "quiet" : "secondary"}
                disabled={name.trim() === displayName || name.trim() === ""}
              >
                {saved ? "Saved" : "Save"}
              </Button>
            </div>
          </div>

          <div className="pt-7">
            <p className="pb-3 text-callout text-text-3">Appearance</p>
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
        </section>

        {/* Record */}
        <section className="pb-9">
          <SectionHead>Record</SectionHead>
          <dl className="pt-1">
            <Line k="Department" v={tidy(student?.department)} />
            <Line k="Batch" v={student?.batch} />
            <Line k="Mobile" v={student?.mobile} />
            <Line k="Academic year" v={timetable?.academicYear} />
          </dl>
        </section>

        {/* Courses */}
        {courses.length > 0 && (
          <section className="pb-9">
            <SectionHead aside={`${credits} credits`}>Registered</SectionHead>
            <ul className="pt-1">
              {courses.map((c, i) => (
                <li key={`${c.code}-${c.slot ?? i}`} data-row>
                  <Rule soft={i > 0} />
                  <div className="py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-body">{c.title}</span>
                      <span className="tnum shrink-0 text-callout text-text-3">
                        {c.credit != null ? `${c.credit} cr` : ""}
                      </span>
                    </div>
                    <p className="tnum mt-1 truncate text-callout text-text-3">
                      {[c.code, c.faculty?.replace(/\s*\(\d+\)\s*$/, "")]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Data */}
        <section className="pb-10">
          <SectionHead>Data</SectionHead>
          <div className="flex items-end justify-between gap-4 pt-5">
            <Marginalia>
              Updated {timeAgo(fetchedAt)}
              <br />
              {customClasses.length} added, {optionalCourses.length} marked optional
            </Marginalia>
            <Button
              variant="secondary"
              onClick={() => void refresh()}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing" : "Refresh"}
            </Button>
          </div>
        </section>

        <div data-reveal>
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
          <p className="mt-6 text-callout leading-relaxed text-text-3">
            Not affiliated with SRM. Your data is never stored on our servers. It lives
            on this device and is cleared when you sign out.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

/**
 * Picks the largest poster size at which the longest word still fits the
 * column. Roughly 0.55em per glyph in this weight, across the gutter width.
 */
function fitName(name: string): string {
  const longest = Math.max(...name.split(/\s+/).map((w) => w.length), 1);
  const vw = Math.min(165 / longest, 26);
  return `clamp(2.25rem, ${vw.toFixed(1)}vw, 7rem)`;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="tnum text-title">{value}</p>
      <p className="mt-1 text-label uppercase text-text-3">{label}</p>
    </div>
  );
}

function Line({ k, v }: { k: string; v?: string | null }) {
  if (!v) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-callout text-text-3">{k}</dt>
      <dd className="truncate text-callout">{v}</dd>
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
