"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AppShell from "@/components/AppShell";
import { useSession } from "@/context/SessionContext";
import { setTheme, THEMES, useTheme } from "@/lib/theme";
import { revealIn, revealRows, useGsap } from "@/lib/motion";
import { Button } from "@/components/ui";
import { Marginalia, Rule, SectionHead, StickyAction } from "@/components/ui/editorial";
import CreatorCredit from "@/components/CreatorCredit";
import SkinPicker from "@/components/SkinPicker";
import { IconChevronRight } from "@/components/Icons";

const SKINS = THEMES.filter((t) => !t.structural);
const SKIN_COUNT = SKINS.length;
/** Widely spaced hues, so the fan looks like a range rather than a gradient. */
const FAN_HUES = ["ember", "gold", "fern", "azure", "violet"];

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
  const [picking, setPicking] = useState(false);
  /** The skin in use, or null while one of the full looks is on. */
  const skin = SKINS.find((t) => t.id === theme) ?? null;
  // Your colour leads the fan, with a spread of others behind it.
  const lead = skin ?? SKINS[0];
  const fan = [
    lead,
    ...FAN_HUES.flatMap((id) => {
      const t = SKINS.find((s) => s.id === id);
      return t && t.id !== lead.id ? [t] : [];
    }),
  ].slice(0, 5);
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
        {/* Masthead.
            **Deliberately NOT a `data-reveal` target.** It is this screen's
            poster object, and a poster that fades up after the page has already
            slid in reads as the name lagging behind the tap, which is exactly
            how it was reported. It is present in the first frame of the screen
            instead, so the page turns over and your name is already on it. The
            supporting figures and sections below still stage in, so the screen
            arrives in order rather than all at once. Attendance's percentage is
            excluded from the reveal for the same reason. */}
        <div className="pb-10 pt-5">
          {/* Set as large as the longest word allows. A name is not a numeral:
              cropping it mid-word would read as breakage, not as a crop. */}
          <h1
            className="optical font-bold leading-[0.95] tracking-[-0.035em]"
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
            <p className="mt-1 text-callout text-text-3/70">
              Leave it empty to go back to {tidy(student?.name)?.split(" ")[0] ?? "your portal name"}.
            </p>
            <div className="mt-2 flex gap-2">
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="min-w-0 flex-1 border-b border-line bg-transparent pb-2 text-title outline-none transition-colors focus:border-accent"
              />
              {/* An empty field is a valid submission: it is how you go back
                  to the name the portal has for you. Disabling it on empty
                  made a custom name a one-way door. */}
              <Button
                onClick={saveName}
                variant={saved ? "quiet" : "secondary"}
                disabled={name.trim() === displayName}
              >
                {saved ? "Saved" : "Save"}
              </Button>
            </div>
          </div>

          <div className="pt-7">
            <p className="pb-3 text-callout text-text-3">Appearance</p>
            <div className="flex items-center gap-3 pb-3.5">
              <span className="text-label uppercase text-text-3">Full looks</span>
              <span className="h-px flex-1 bg-line" />
              <span className="text-callout text-text-3">Rebuilds the UI</span>
            </div>
            {/* A grid rather than a segmented control: a theme is chosen by
                looking at it, not by reading its name, so each swatch is
                painted in its own palette. */}
            {/* Only the three looks are listed. Fifteen colours as tiles took
                over the page for a choice most people make once, so they live
                behind the row underneath. The two groups are genuinely
                different things: these rebuild the interface, the rest
                recolour it. */}
            <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-2.5">
              {THEMES.filter((t) => t.structural).map((t) => {
                const active = t.id === theme;
                return (
                  <button
                    key={t.id}
                    role="radio"
                    aria-checked={active}
                    onClick={() => setTheme(t.id)}
                    className={`flex items-center gap-3 rounded-control border px-3 py-3 text-left transition-colors ${
                      active
                        ? "border-accent bg-ink-2"
                        : "border-line hover:border-line-strong"
                    }`}
                  >
                    <span
                      aria-hidden
                      className="flex size-8 shrink-0 overflow-hidden rounded-full border border-line"
                    >
                      {t.swatch.map((c, i) => (
                        <span
                          key={i}
                          className="h-full flex-1"
                          style={{ background: c }}
                        />
                      ))}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-body text-text-1">
                        {t.name}
                      </span>
                      <span className="block truncate text-callout text-text-3">
                        {t.note}
                      </span>
                    </span>
                  </button>
                );
              })}

            </div>

            <div className="flex items-center gap-3 pb-3.5 pt-6">
              <span className="text-label uppercase text-text-3">Skins</span>
              <span className="h-px flex-1 bg-line" />
              <span className="text-callout text-text-3">Colour only</span>
            </div>

            {/* Deliberately NOT a fourth tile in the grid above. Four identical
                boxes read as four themes, and hid the fact that there are
                fifteen more colours behind one of them. A full width row of a
                different shape reads as a door, the fanned discs say there is
                a collection through it, and the leading one is whichever skin
                is on so the selection is still visible on this screen. */}
            <button
              onClick={() => setPicking(true)}
              aria-haspopup="dialog"
              className="group flex w-full items-center gap-3.5 rounded-control border border-line px-3 py-3 text-left transition-colors hover:border-line-strong"
            >
              <span aria-hidden className="flex shrink-0 items-center">
                {fan.map((t, i) => (
                  <span
                    key={t.id}
                    // Spread apart under a finger, so the stack reads as
                    // separate colours rather than one decorated swatch.
                    style={{ "--i": i, marginLeft: i === 0 ? 0 : -13 } as React.CSSProperties}
                    // The lead disc is your colour, and reads as yours by
                    // being the largest. A ring cannot say it: the lead IS the
                    // current skin, so an accent border is always the same
                    // colour as the fill it sits on.
                    className={`rounded-full border-2 border-ink-0 transition-transform duration-300 ease-out group-hover:[transform:translateX(calc(var(--i)*4px))] ${
                      i === 0 ? "size-9" : "size-8"
                    }`}
                  >
                    {/* Each disc is that theme's accent alone. The three tone
                        swatch is right in a full size tile, but sliced to the
                        20px a stacked disc shows it turns to mush. */}
                    <span
                      className="block size-full rounded-full"
                      style={{ background: t.swatch[2] }}
                    />
                  </span>
                ))}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body text-text-1">More skins</span>
                <span className="block truncate text-callout text-text-3">
                  {skin ? `${skin.name} · ${SKIN_COUNT} colours` : `${SKIN_COUNT} colours`}
                </span>
              </span>
              <IconChevronRight size={18} className="shrink-0 text-text-3" />
            </button>
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

        <p data-reveal className="pt-2 text-callout leading-relaxed text-text-3">
          Not affiliated with SRM. Your data is never stored on our servers. It lives
          on this device and is cleared when you sign out.
        </p>

        {/* Sign out stays reachable without scrolling to the end of a long page,
            and the credit sits under it as the last word on the screen. */}
        <StickyAction>
          <div className="flex flex-col items-center gap-3.5">
            <Button
              variant="danger"
              onClick={() => {
                logout();
                router.replace("/");
              }}
            >
              Sign out
            </Button>
            <CreatorCredit align="center" />
          </div>
        </StickyAction>
      </div>
      <SkinPicker open={picking} onClose={() => setPicking(false)} />
    </AppShell>
  );
}

/**
 * Sizes the name to its longest word so it never breaks mid-word, and stops
 * short of the column edge: a masthead that touches both gutters reads as
 * cramped rather than confident.
 *
 * Two limits, because the text is bound by the narrower of the two. On a phone
 * the viewport decides, so the vw term rules; past 448px the column stops
 * growing while the viewport does not, so the pixel cap takes over. The 0.6em
 * per glyph is measured from this face at this weight, not guessed.
 */
function fitName(name: string): string {
  const longest = Math.max(...name.split(/\s+/).map((w) => w.length), 1);
  const perGlyph = 0.6;
  const columnPx = 404; // max-w-md minus both gutters
  const vw = Math.min(88 / (perGlyph * longest) * 1.1, 19);
  const capPx = Math.min(72, (columnPx * 0.9) / (perGlyph * longest));
  return `clamp(1.9rem, ${vw.toFixed(1)}vw, ${capPx.toFixed(0)}px)`;
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
