"use client";

import { useMemo, useState } from "react";
import { useSession } from "@/context/SessionContext";
import { Panel } from "@/components/ui/Overlay";
import { Button, IconButton, Segmented } from "@/components/ui";
import { SectionHead, TrackRule } from "@/components/ui/editorial";
import RollingNumber from "@/components/onboarding/RollingNumber";
import { IconMinus, IconPlus } from "@/components/Icons";
import { PORTAL_INPUT, PortalField } from "@/components/PortalFields";
import { haptic } from "@/lib/haptics";
import {
  cheapestPlan,
  clampGrade,
  combine,
  ceilingGrades,
  fmtGpa,
  fmtNeed,
  optionFor,
  parseSemester,
  planCourse,
  requiredSgpa,
  sgpa,
  totalForPoints,
  type GradeOption,
  type MarksRow,
  type PlanCourse,
} from "@/lib/cgpa";

/**
 * The CGPA planner.
 *
 * Marks' counterpart to Attendance's leave planner, opened the same way, from
 * the one action at the foot of the screen. It does two things, and they are
 * the same question asked from opposite ends:
 *
 *   Pick grades   "If I get these, where does my CGPA land?"
 *   Hit a target  "I want an 8.5. What is the least it takes?"
 *
 * **It never predicts a grade for you.** Every course starts at the grade your
 * marks are on pace for and you move it. What the marks DO decide is which
 * grades are still possible (anything already out of reach is struck out) and
 * what each one costs in the exam, quoted on the paper you will sit. That
 * keeps the honesty that got the old GPA projection removed: the number is
 * yours, the arithmetic is ours.
 *
 * Everything it remembers (your CGPA so far, credits, the grades you set, the
 * target) stays on this device, keyed by registration number, like the custom
 * classes and the optional courses.
 */
export default function CgpaPlanner({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { student } = useSession();
  const reg = student?.registrationNumber ?? "anon";
  // Keyed by student, so a sign-in as somebody else starts from their record
  // rather than inheriting the last student's grades.
  return <Planner key={reg} reg={reg} open={open} onClose={onClose} />;
}

// ---------- On-device record ----------------------------------------

type Mode = "grades" | "target";
type Saved = {
  cgpa: string;
  credits: string;
  grades: Record<string, string>;
  target: number | null;
  mode: Mode;
};

const EMPTY: Saved = { cgpa: "", credits: "", grades: {}, target: null, mode: "grades" };
const keyFor = (reg: string) => `skipp.cgpa.${reg}`;

function load(reg: string): Saved {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(keyFor(reg));
    const parsed = raw ? (JSON.parse(raw) as Partial<Saved> | null) : null;
    return parsed ? { ...EMPTY, ...parsed } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function save(reg: string, s: Saved) {
  try {
    window.localStorage.setItem(keyFor(reg), JSON.stringify(s));
  } catch {
    /* private mode: the planner still works, it just forgets */
  }
}

/** A CGPA as typed, or null when it is not one. */
function readCgpa(s: string): number | null {
  if (!s.trim()) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 && n <= 10 ? n : null;
}

function readCredits(s: string): number | null {
  if (!s.trim()) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n <= 400 ? Math.round(n) : null;
}

// ---------- The panel -----------------------------------------------

function Planner({
  reg,
  open,
  onClose,
}: {
  reg: string;
  open: boolean;
  onClose: () => void;
}) {
  const { timetable, marks, student } = useSession();
  const [saved, setSaved] = useState<Saved>(() => load(reg));
  const update = (patch: Partial<Saved>) =>
    setSaved((prev) => {
      const next = { ...prev, ...patch };
      save(reg, next);
      return next;
    });

  const semester = parseSemester(student?.semester);
  const firstSem = semester === 1;
  const prevCgpa = firstSem ? null : readCgpa(saved.cgpa);

  // ---- Courses: the registration list carries the credits, marks carry the rest.
  const { courses, uncounted } = useMemo(() => {
    const seen = new Set<string>();
    const counted: { code: string; title: string; credit: number; practical: boolean }[] = [];
    const left: string[] = [];
    for (const c of timetable?.courses ?? []) {
      const code = c.code.toUpperCase();
      if (seen.has(code)) continue;
      seen.add(code);
      if (!c.credit || c.credit <= 0) {
        left.push(c.title || c.code);
        continue;
      }
      counted.push({
        code,
        title: c.title || c.code,
        credit: c.credit,
        practical: /practical|lab/i.test(c.category ?? ""),
      });
    }

    // Rows per course, published ones only. Theory and lab arrive as two rows
    // sharing a code, and the planner pools them into one grade.
    const rowsFor = (code: string, practical: boolean): MarksRow[] =>
      (marks?.subjects ?? [])
        .filter((s) => s.code.toUpperCase() === code && s.components.length > 0 && s.maxTotal > 0)
        .map((s) => ({ scored: s.scoredTotal, publishedMax: s.maxTotal, isPractical: practical }));

    // A course with nothing published needs SOME pace to start from. Your record
    // is the best evidence of how you score; failing that, how this term's
    // marked courses are going; failing that, an A.
    const marked = counted
      .map((c) => planCourse({ ...c, rows: rowsFor(c.code, c.practical), fallbackPace: 0 }))
      .filter((c) => c.hasMarks);
    const fallbackPace =
      prevCgpa !== null
        ? totalForPoints(prevCgpa)
        : marked.length > 0
          ? marked.reduce((n, c) => n + c.pace, 0) / marked.length
          : 75;

    return {
      courses: counted.map((c) =>
        planCourse({ ...c, rows: rowsFor(c.code, c.practical), fallbackPace }),
      ),
      uncounted: left,
    };
  }, [timetable, marks, prevCgpa]);

  const semCredits = courses.reduce((n, c) => n + c.credit, 0);
  const estimatedCredits = semester && semester > 1 ? (semester - 1) * semCredits : null;
  const typedCredits = readCredits(saved.credits);
  const prevCredits = firstSem ? 0 : (typedCredits ?? estimatedCredits ?? 0);
  const hasRecord = prevCgpa !== null && prevCredits > 0;

  // The grade each course is set to: your choice, or your pace when you have
  // not chosen. A choice is NOT held to what is still reachable: this screen is
  // for asking "what if", so an O you can no longer get still counts toward the
  // figure, and is flagged rather than refused.
  const chosen: Record<string, string> = {};
  for (const c of courses) {
    chosen[c.code] = saved.grades[c.code] ?? clampGrade(c, c.paceGrade);
  }
  const outOfReach = courses.filter((c) => !optionFor(c, chosen[c.code]).reachable).length;

  const semGpa = sgpa(courses, chosen) ?? 0;
  const projected = combine({ prevCgpa, prevCredits, semGpa, semCredits });
  const ceilingSem = sgpa(courses, ceilingGrades(courses)) ?? 0;
  const ceilingCgpa = combine({ prevCgpa, prevCredits, semGpa: ceilingSem, semCredits });
  const paceSem = sgpa(courses, {}) ?? 0;
  const paceCgpa = combine({ prevCgpa, prevCredits, semGpa: paceSem, semCredits });

  // Target defaults to the next quarter above where you are heading, which is
  // the usual shape of the question: a little more than now.
  const target =
    saved.target ?? Math.min(10, Math.ceil((paceCgpa + 0.01) * 4) / 4);
  const needSem = requiredSgpa({ target, prevCgpa, prevCredits, semCredits });
  const plan = needSem <= 10 ? cheapestPlan(courses, needSem) : null;

  const setGrade = (code: string, grade: string) => {
    haptic("tick");
    update({ grades: { ...saved.grades, [code]: grade } });
  };

  const stepTarget = (d: number) => {
    haptic("tick");
    const next = Math.round(Math.min(10, Math.max(5, target + d)) * 100) / 100;
    update({ target: next });
  };

  const applyPlan = () => {
    if (!plan) return;
    haptic("commit");
    update({ grades: { ...saved.grades, ...plan.grades }, mode: "grades" });
  };

  const empty = courses.length === 0;
  const mode = saved.mode;
  const planWorks = mode === "target" && plan?.reachable && !empty;

  return (
    <Panel
      open={open}
      onClose={onClose}
      eyebrow="Plan"
      title="Your CGPA"
      footer={
        planWorks ? (
          <Button size="lg" full onClick={applyPlan}>
            Use these grades
          </Button>
        ) : undefined
      }
    >
      {empty ? (
        <p data-panel-reveal className="pt-6 text-body text-text-2">
          No courses with credits on your registration yet. Once the portal lists
          them, every one of them shows up here.
        </p>
      ) : (
        <div className="flex flex-col pb-10">
          {/* ---- The one figure ---- */}
          <div data-panel-reveal className="pt-4">
            {mode === "grades" ? (
              <Hero
                label={hasRecord || firstSem ? "Projected CGPA" : "Semester GPA"}
                value={hasRecord || firstSem ? projected : semGpa}
                prev={hasRecord ? prevCgpa : null}
                warn={
                  outOfReach > 0
                    ? `${outOfReach === 1 ? "One grade here is" : `${outOfReach} grades here are`} out of reach on the marks in hand.`
                    : null
                }
                foot={
                  hasRecord
                    ? `SGPA ${fmtGpa(semGpa)} on ${semCredits} credits.`
                    : firstSem
                      ? `On ${semCredits} credits.`
                      : `On ${semCredits} credits. Add your record below for your CGPA.`
                }
              />
            ) : (
              <TargetHero
                target={target}
                onStep={stepTarget}
                ceiling={hasRecord || firstSem ? ceilingCgpa : ceilingSem}
                needSem={needSem}
                overall={hasRecord}
              />
            )}
          </div>

          {/* ---- Record so far ---- */}
          {!firstSem && (
            <section data-panel-reveal className="mt-9">
              <SectionHead
                aside={semester && semester > 1 ? `${semester - 1} sem${semester > 2 ? "s" : ""} done` : undefined}
              >
                Your record
              </SectionHead>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <PortalField id="cgpa-so-far" label="CGPA so far">
                  <input
                    id="cgpa-so-far"
                    inputMode="decimal"
                    autoComplete="off"
                    // Not a figure: a sample CGPA here reads as one already
                    // entered, and this one is not used until you type it.
                    placeholder="Add yours"
                    value={saved.cgpa}
                    onChange={(e) =>
                      update({ cgpa: e.target.value.replace(/[^\d.]/g, "").slice(0, 5) })
                    }
                    className={`tnum ${PORTAL_INPUT}`}
                  />
                </PortalField>
                <PortalField id="credits-so-far" label="Credits so far">
                  <input
                    id="credits-so-far"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder={estimatedCredits ? String(estimatedCredits) : "88"}
                    value={saved.credits}
                    onChange={(e) =>
                      update({ credits: e.target.value.replace(/\D/g, "").slice(0, 3) })
                    }
                    className={`tnum ${PORTAL_INPUT}`}
                  />
                </PortalField>
              </div>
              <p className="mt-2.5 text-callout text-text-3">
                {saved.cgpa.trim() && prevCgpa === null ? (
                  <span className="text-risk">A CGPA runs from 0 to 10. </span>
                ) : null}
                {typedCredits === null && estimatedCredits
                  ? `Credits are estimated from ${semester! - 1} terms like this one. Your grade sheet has the exact figure.`
                  : "Both are on your last grade sheet. They stay on this phone."}
              </p>
            </section>
          )}

          {firstSem && (
            <p data-panel-reveal className="mt-6 text-callout text-text-3">
              First semester, so this term is your whole CGPA.
            </p>
          )}

          {/* ---- Mode ---- */}
          <div data-panel-reveal className="mt-9">
            <Segmented<Mode>
              label="Planner mode"
              value={mode}
              onChange={(m) => {
                haptic("select");
                update({ mode: m });
              }}
              options={[
                { value: "grades", label: "Pick grades" },
                { value: "target", label: "Hit a target" },
              ]}
            />
          </div>

          {mode === "grades" ? (
            <section data-panel-reveal className="mt-8">
              <SectionHead
                aside={
                  Object.keys(saved.grades).length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        haptic("select");
                        update({ grades: {} });
                      }}
                      className="-my-3 -mr-2 min-h-11 px-2 text-label uppercase text-text-2 hover:text-text-1"
                    >
                      Back to pace
                    </button>
                  ) : (
                    `${semCredits} credits`
                  )
                }
              >
                This semester
              </SectionHead>
              <ul className="mt-1">
                {courses.map((c) => (
                  <CourseRow
                    key={c.code}
                    course={c}
                    grade={chosen[c.code]}
                    onPick={(g) => setGrade(c.code, g)}
                  />
                ))}
              </ul>
            </section>
          ) : (
            <TargetPlan
              courses={courses}
              plan={plan}
              needSem={needSem}
              paceSem={paceSem}
              ceilingCgpa={hasRecord || firstSem ? ceilingCgpa : ceilingSem}
            />
          )}

          <Footnote uncounted={uncounted} />
        </div>
      )}
    </Panel>
  );
}

// ---------- The figure ----------------------------------------------

function Hero({
  label,
  value,
  prev,
  warn,
  foot,
}: {
  label: string;
  value: number;
  prev: number | null;
  /** Said first, in red, when the figure leans on a grade that cannot happen. */
  warn: string | null;
  foot: React.ReactNode;
}) {
  const delta = prev !== null ? Math.round((value - prev) * 100) / 100 : null;
  return (
    <>
      <p className="text-label uppercase text-text-3">{label}</p>
      {/* Rolls rather than swaps, so moving one grade shows you exactly which
          digits that grade was worth. */}
      <p className="mt-4">
        <RollingNumber value={fmtGpa(value)} className="text-poster optical" />
      </p>
      {/* The record drawn as a rule: where you were is the tick, where this
          term takes you is the fill. A falling CGPA stops short of its own
          tick, the same device Attendance uses for the 75% line. */}
      <TrackRule value={value * 10} threshold={prev !== null ? prev * 10 : undefined} className="mt-6" />
      {warn && <p className="mt-3 text-callout text-risk">{warn}</p>}
      <p className={`tnum text-callout text-text-3 ${warn ? "mt-1" : "mt-3"}`}>
        {delta !== null && (
          <span className={delta < 0 ? "text-risk" : "text-text-1"}>
            {delta > 0
              ? `Up ${delta.toFixed(2)}`
              : delta < 0
                ? `Down ${Math.abs(delta).toFixed(2)}`
                : "Holds"}{" "}
            from {fmtGpa(prev!)}.{" "}
          </span>
        )}
        {foot}
      </p>
    </>
  );
}

function TargetHero({
  target,
  onStep,
  ceiling,
  needSem,
  overall,
}: {
  target: number;
  onStep: (d: number) => void;
  ceiling: number;
  needSem: number;
  overall: boolean;
}) {
  const out = needSem > 10 || target > ceiling + 1e-9;
  return (
    <>
      <p className="text-label uppercase text-text-3">
        {overall ? "Target CGPA" : "Target this semester"}
      </p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <RollingNumber value={target.toFixed(2)} className="text-poster optical" />
        <div className="flex shrink-0 gap-2 pb-1">
          <IconButton label="Lower the target" onClick={() => onStep(-0.1)} disabled={target <= 5}>
            <IconMinus size={18} />
          </IconButton>
          <IconButton label="Raise the target" onClick={() => onStep(0.1)} disabled={target >= 10}>
            <IconPlus size={18} />
          </IconButton>
        </div>
      </div>
      <TrackRule value={target * 10} threshold={Math.min(100, ceiling * 10)} className="mt-6" />
      <p className="tnum mt-3 text-callout text-text-3">
        {out ? (
          <span className="text-risk">
            Out of reach this term. The most it can be is {fmtGpa(ceiling)}.
          </span>
        ) : overall ? (
          <>
            This semester needs an SGPA of{" "}
            <span className="text-text-1">{fmtNeed(needSem)}</span>.
            The tick is the most still possible, {fmtGpa(ceiling)}.
          </>
        ) : (
          <>The tick is the most still possible, {fmtGpa(ceiling)}.</>
        )}
      </p>
    </>
  );
}

// ---------- Pick grades ---------------------------------------------

const LADDER = ["O", "A+", "A", "B+", "B", "C"] as const;

function CourseRow({
  course,
  grade,
  onPick,
}: {
  course: PlanCourse;
  grade: string;
  onPick: (g: string) => void;
}) {
  const option = optionFor(course, grade);
  // Nothing from C up can still be reached, and nothing has been picked.
  const stuck = grade === "F";
  return (
    <li className="border-b border-line-soft py-4">
      <div className="flex items-baseline gap-3">
        <span className="min-w-0 flex-1 text-headline text-text-1">{course.title}</span>
        <span className="tnum shrink-0 text-callout text-text-3">
          {course.credit} cr
        </span>
      </div>

      <div
        role="radiogroup"
        aria-label={`Grade for ${course.title}`}
        className="mt-3 grid grid-cols-6 gap-0.5 min-[360px]:gap-1"
      >
        {LADDER.map((g) => {
          const o = optionFor(course, g);
          const selected = grade === g;
          const pace = course.paceGrade === g;
          return (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onPick(g)}
              aria-label={`${g}${pace ? ", your pace" : ""}${o.reachable ? "" : ", out of reach"}`}
              data-segment
              // An out of reach grade stays tappable, set back a step so the
              // ladder still says where the line is. Picked, it turns red:
              // colour marks trouble, and a grade you cannot get is trouble.
              className={`relative flex min-h-11 flex-col items-center justify-center rounded-control border text-callout font-semibold transition-colors duration-150 ${
                selected
                  ? o.reachable
                    ? "border-line-strong bg-ink-3 text-text-1"
                    : "border-risk/50 bg-ink-3 text-risk"
                  : o.reachable
                    ? "border-line-soft text-text-2 hover:text-text-1"
                    : "border-line-soft/60 text-text-3/45 hover:text-text-3"
              }`}
            >
              {g}
              {/* Your pace, marked once per row, so moving off it is a
                  decision you can see rather than a default you forget. */}
              {pace && course.hasMarks && (
                <span
                  aria-hidden
                  className="absolute bottom-1 size-1 rounded-full bg-text-3"
                />
              )}
            </button>
          );
        })}
      </div>

      <p className={`tnum mt-2.5 text-callout ${stuck ? "text-risk" : "text-text-3"}`}>
        {stuck
          ? "C is out of reach on the marks in hand. Pick a grade to see what it would take."
          : requirement(course, option)}
      </p>
    </li>
  );
}

/** What a grade asks of you, in one line. */
function requirement(course: PlanCourse, o: GradeOption): React.ReactNode {
  const effort = Math.ceil(o.effort - 1e-9);
  if (!course.hasMarks) {
    return effort === 0
      ? "No marks yet. Set from how you usually score."
      : `No marks yet. About ${effort} marks above how you usually score.`;
  }
  if (o.secured) return "Already yours on the marks in hand.";
  if (!o.reachable) {
    const would =
      o.exam && o.exam.unit === "marks"
        ? `, it would take ${o.exam.need}/${o.exam.outOf} in the exam`
        : o.exam
          ? `, it would take ${o.exam.need}% across the exams`
          : "";
    return (
      <span className="text-risk">
        Out of reach: {o.shortBy} {o.shortBy === 1 ? "mark" : "marks"} short even with full
        marks from here{would}.
      </span>
    );
  }
  if (!o.exam) {
    return course.internalOnly
      ? "No exam. Rides on the internals still to come."
      : "Rides on the internals still to come.";
  }
  const pace =
    effort === 0 ? " · on your pace" : ` · ${effort} over your pace`;
  if (o.exam.need === 0) {
    return `Covered if you take every remaining internal mark${pace}`;
  }
  // A paper you need almost all of is a stretch, and saying so is the one
  // place this screen spends colour on a grade.
  const stretch = o.exam.need / o.exam.outOf >= 0.85;
  const need =
    o.exam.unit === "marks"
      ? `${o.exam.need}/${o.exam.outOf} in the exam`
      : `${o.exam.need}% across the exams`;
  return (
    <>
      <span className={stretch ? "text-watch" : "text-text-1"}>Needs {need}</span>
      {pace}
    </>
  );
}

// ---------- Hit a target --------------------------------------------

function TargetPlan({
  courses,
  plan,
  needSem,
  paceSem,
  ceilingCgpa,
}: {
  courses: PlanCourse[];
  plan: ReturnType<typeof cheapestPlan> | null;
  needSem: number;
  paceSem: number;
  ceilingCgpa: number;
}) {
  if (!plan || !plan.reachable) {
    return (
      <section data-panel-reveal className="mt-8">
        <p className="text-body text-text-2">
          Not with the marks already dropped. Bring the target down to{" "}
          <span className="tnum text-text-1">{fmtGpa(ceilingCgpa)}</span> or below
          and the cheapest way there appears here.
        </p>
      </section>
    );
  }

  const raised = plan.raised.length;
  const effort = Math.ceil(
    plan.raised.reduce((n, code) => {
      const c = courses.find((x) => x.code === code)!;
      return n + optionFor(c, plan.grades[code]).effort;
    }, 0) - 1e-9,
  );

  return (
    <section data-panel-reveal className="mt-8">
      <SectionHead aside={raised > 0 ? `${raised} to raise` : "on pace"}>
        Cheapest way there
      </SectionHead>
      <p className="mt-4 text-body text-text-2">
        {raised === 0 ? (
          <>
            Your current pace already gets you there, with an SGPA of{" "}
            <span className="tnum text-text-1">{fmtGpa(paceSem)}</span> against the{" "}
            <span className="tnum">{fmtNeed(needSem)}</span> you need.
          </>
        ) : (
          <>
            Raise {raised === 1 ? "one subject" : `${raised} subjects`}, about{" "}
            <span className="tnum text-text-1">{effort}</span> marks above your pace
            in all. Effort goes where it moves your CGPA furthest, so heavier
            courses come first.
          </>
        )}
      </p>
      <ul className="mt-4">
        {courses.map((c) => {
          const g = plan.grades[c.code];
          const up = plan.raised.includes(c.code);
          const o = optionFor(c, g);
          return (
            <li key={c.code} className="flex items-start gap-3 border-b border-line-soft py-3.5">
              <span
                className={`tnum flex min-h-11 w-11 shrink-0 items-center justify-center rounded-control border text-callout font-semibold ${
                  up ? "border-line-strong bg-ink-3 text-text-1" : "border-line-soft text-text-3"
                }`}
              >
                {g}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-body ${up ? "text-text-1" : "text-text-2"}`}>
                  {c.title}
                </span>
                <span className="tnum mt-0.5 block text-callout text-text-3">
                  {up ? requirement(c, o) : `At your pace · ${c.credit} cr`}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------- The small print -----------------------------------------

function Footnote({ uncounted }: { uncounted: string[] }) {
  return (
    <div data-panel-reveal className="mt-8 flex flex-col gap-2 text-callout text-text-3/80">
      <p>
        On SRM&rsquo;s absolute scale: O 91, A+ 81, A 71, B+ 61, B 56, C 50.
        Exam figures assume you take every remaining internal mark, and a dot
        marks the grade your marks are on pace for.
      </p>
      {uncounted.length > 0 && (
        <p>Not counted, no credits: {uncounted.join(", ")}.</p>
      )}
      <p>Truncated to two places, the way your grade sheet prints it.</p>
    </div>
  );
}
