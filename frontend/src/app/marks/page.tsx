"use client";

import AppShell from "@/components/AppShell";
import { useSession } from "@/context/SessionContext";
import { revealIn, revealRows, useGsap } from "@/lib/motion";
import {
  forecastSubject,
  predictGpa,
  type SubjectForecast,
} from "@/lib/grades";
import { Skeleton, StateView } from "@/components/ui";
import {
  Marginalia,
  Rule,
  SectionHead,
  TrackRule,
} from "@/components/ui/editorial";

const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Marks is set like a contents page: titles on the left, figures hung on the
 * right, components indented beneath. No cards, no bars, just alignment.
 */
export default function MarksPage() {
  const { marks, marksState, marksMessage, timetable } = useSession();
  const subjects = marks?.subjects ?? [];

  // Credit and category come from the registration list, keyed by course code.
  const courseInfo = new Map(
    (timetable?.courses ?? []).map((c) => [
      c.code,
      { credit: c.credit ?? 0, practical: /practical|lab/i.test(c.category ?? "") },
    ]),
  );
  const isPractical = (code: string) => courseInfo.get(code)?.practical ?? false;

  // GPA over the grades each subject is on track for. Deduped by code, since a
  // course with separate theory and practical rows is still one credit block.
  const seen = new Set<string>();
  const gpa = predictGpa(
    subjects.flatMap((s) => {
      if (seen.has(s.code)) return [];
      const f = forecastSubject({
        scored: s.scoredTotal,
        publishedMax: s.maxTotal,
        isPractical: isPractical(s.code),
      });
      if (!f) return [];
      seen.add(s.code);
      return [{ grade: f.onTrackGrade, credit: courseInfo.get(s.code)?.credit ?? 0 }];
    }),
  );
  const scored = subjects.reduce((x, s) => x + s.scoredTotal, 0);
  const max = subjects.reduce((x, s) => x + s.maxTotal, 0);
  const graded = subjects.filter((s) => s.components.length > 0);

  const scope = useGsap(
    ({ self, reduced }) => {
      revealIn(self, reduced, { y: 16, stagger: 0.07 });
      revealRows(self, reduced);
    },
    [marksState, graded.length],
  );

  return (
    <AppShell section="Marks">
      <div ref={scope} className="flex flex-1 flex-col">
        {marksState === "loading" && (
          <div className="flex flex-col gap-4 pt-6">
            <Skeleton className="h-20 w-2/3" />
            <Skeleton className="h-px w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {marksState === "gated" && (
          <StateView
            tone="watch"
            title="No marks yet"
            message={
              marksMessage ??
              "Nothing has been published for this term. Marks appear here the moment they are."
            }
          />
        )}

        {marksState === "error" && (
          <StateView
            tone="risk"
            title="Could not load marks"
            message={marksMessage ?? "Pull down to try again."}
          />
        )}

        {/* Nothing published yet is still a moment: the count of subjects
            waiting, set at poster scale, instead of an apologetic empty box. */}
        {marksState === "ready" && (subjects.length === 0 || max === 0) && (
          // Centred, with no extra bottom padding. `pb-16` on top of
          // `justify-center` centres the block inside a box 64px shorter than
          // the screen, so it sits visibly above the middle and opens a dead
          // band underneath that reads as a layout fault.
          <div data-reveal className="flex flex-1 flex-col justify-center">
            <p className="text-label uppercase text-text-3">Awaiting results</p>
            <p className="tnum optical mt-5 text-poster">{subjects.length}</p>
            <div className="bleed mt-7 h-px bg-line" />
            <p className="mt-5 max-w-[26ch] text-body text-text-2">
              {subjects.length > 0
                ? "subjects are being tracked. The first published assessment appears here on its own."
                : "Your internal assessments will show here once results are out."}
            </p>
          </div>
        )}

        {marksState === "ready" && max > 0 && (
          <>
            {/* Set as a fraction: numerator over a full-bleed rule over the
                denominator, the way a score is written by hand. */}
            <div data-reveal className="pb-10 pt-6">
              <p className="text-label uppercase text-text-3">Internals so far</p>
              <p className="tnum optical mt-5 text-poster">{round(scored)}</p>
              <div className="bleed h-px bg-text-1/70" />
              <p className="tnum optical text-poster text-text-1/30">{round(max)}</p>
              <div className="mt-5 flex items-start justify-between gap-4">
                <Marginalia>
                  <span className="tnum block">
                    {pct(scored, max).toFixed(0)}% across {graded.length} graded{" "}
                    {graded.length === 1 ? "subject" : "subjects"}
                  </span>
                </Marginalia>
                {gpa !== null && (
                  <div className="shrink-0 text-right">
                    <span className="tnum block text-title leading-none">
                      {gpa.toFixed(2)}
                    </span>
                    <span className="mt-1.5 block text-label uppercase text-text-3">
                      GPA on track
                    </span>
                  </div>
                )}
              </div>
            </div>

            <section>
              <SectionHead aside={`${subjects.length} subjects`}>Breakdown</SectionHead>
              <ul className="mt-1">
                {subjects.map((s, i) => (
                  <li key={`${s.code}-${i}`} data-row>
                    <Rule soft={i > 0} />
                    <div data-surface className="py-4">
                      <div className="flex items-baseline gap-3">
                        <span className="min-w-0 shrink truncate text-headline">
                          {s.title || s.code}
                        </span>
                        {/* Dot leader, the way a contents page joins a title to its page number. */}
                        <span
                          aria-hidden
                          className="min-w-6 flex-1 self-center border-b border-dotted border-line"
                        />
                        <span className="tnum shrink-0 text-headline">
                          {s.components.length > 0 ? (
                            <>
                              {round(s.scoredTotal)}
                              <span className="text-text-3">/{round(s.maxTotal)}</span>
                            </>
                          ) : (
                            <span className="text-callout text-text-3">Awaiting</span>
                          )}
                        </span>
                      </div>

                      {s.components.length > 0 && (
                        <TrackRule
                          value={pct(s.scoredTotal, s.maxTotal)}
                          className="bleed mt-3.5"
                        />
                      )}

                      {s.components.length > 0 && (
                        <ul className="mt-3 flex flex-col gap-1.5 pl-0">
                          {s.components.map((c) => (
                            <li
                              key={c.name}
                              className="flex items-baseline gap-3 text-callout text-text-3"
                            >
                              <span className="min-w-0 shrink truncate">{c.name}</span>
                              <span
                                aria-hidden
                                className="min-w-4 flex-1 self-center border-b border-dotted border-line-soft"
                              />
                              <span className="tnum shrink-0">
                                {round(c.scored)}/{round(c.max)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}

                      <Forecast
                        forecast={forecastSubject({
                          scored: s.scoredTotal,
                          publishedMax: s.maxTotal,
                          isPractical: isPractical(s.code),
                        })}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

/**
 * The grade block: where this subject is heading, the ceiling it can still
 * reach, and what the exam paper has to deliver for each grade.
 *
 * Requirements are quoted on the paper the student actually sits (75 marks for
 * theory, 40 for a practical), not on the 40 mark weighting it scales down to,
 * because "you need 38 out of 75" is the sentence that helps.
 */
function Forecast({ forecast }: { forecast: SubjectForecast | null }) {
  if (!forecast) return null;
  const {
    internalOnly,
    onTrackGrade,
    bestGrade,
    remainingInternal,
    semPaper,
    targets,
  } = forecast;

  if (internalOnly) {
    return (
      <div className="mt-5 flex items-baseline justify-between gap-4">
        <p className="text-callout text-text-3">No exam · grade settled</p>
        <p className="text-title leading-none">{bestGrade}</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-start justify-between gap-4">
        <p className="tnum pt-1.5 text-callout text-text-3">
          {remainingInternal > 0
            ? `${remainingInternal} internal marks still to come`
            : "Internals complete"}
          {bestGrade !== onTrackGrade ? ` · ${bestGrade} still possible` : ""}
        </p>
        <div className="shrink-0 text-right">
          <span className="block text-title leading-none">{onTrackGrade}</span>
          <span className="mt-1.5 block text-label uppercase text-text-3">
            On track
          </span>
        </div>
      </div>

      <dl className="mt-5 flex justify-between gap-1">
        {targets.map((t) => (
          <div key={t.grade} className="min-w-0 flex-1 text-center">
            <dt className="text-label uppercase text-text-3">{t.grade}</dt>
            <dd
              className={`tnum mt-2 text-callout ${
                t.outOfReach
                  ? "text-text-3/40"
                  : t.secured
                    ? "text-text-3"
                    : "text-text-1"
              }`}
            >
              {t.outOfReach ? "\u2014" : t.secured ? "0" : t.semNeeded}
            </dd>
          </div>
        ))}
      </dl>
      {/* The requirement leans on the internals still to come, so say so
          rather than quietly assuming the student takes all of them. */}
      <p className="mt-3.5 text-callout text-text-3/80">
        Marks needed in the {semPaper} mark exam
        {remainingInternal > 0 ? ", if you take every remaining internal mark" : ""}.
        A dash is out of reach.
      </p>
    </div>
  );
}
