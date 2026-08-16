"use client";

import { useState } from "react";
import { useSession } from "@/context/SessionContext";
import { revealIn, revealRows, useGsap } from "@/lib/motion";
import { forecastSubject, type SubjectForecast } from "@/lib/grades";
import { Skeleton, StateView } from "@/components/ui";
import { IconChevronRight } from "@/components/Icons";
import {
  Amount,
  Marginalia,
  Rule,
  SectionHead,
  TrackRule,
} from "@/components/ui/editorial";

const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Marks is set like a contents page: titles on the left, figures hung on the
 * right, and nothing else until you ask for it.
 *
 * **One line per subject, and that is the whole design.** Every subject used to
 * stack six blocks: the title and score, a meter, the component list, a line
 * about the internals still to come, a six column grade table, and a two line
 * caption explaining the table. Six of those down a page is roughly forty lines
 * per course, and the caption was repeated verbatim under every one of them.
 * The information was all correct and all present at once, which is what made
 * it unreadable.
 *
 * So the list answers the question you open the page with, which is "how am I
 * doing", in one line each: title and score. The rest is the answer to a
 * question about ONE subject, so it waits until you tap that subject.
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

  // The GPA projection was removed on request. It was a projection built on
  // projections (a grade each subject is on track for, itself assuming every
  // remaining internal mark), quoted to two decimals beside a figure that is
  // simply counted. One honest number reads better than a confident guess
  // next to it.
  const scored = subjects.reduce((x, s) => x + s.scoredTotal, 0);
  const max = subjects.reduce((x, s) => x + s.maxTotal, 0);
  const graded = subjects.filter((s) => s.components.length > 0);

  // One row per course for the waiting list. A course with separate theory and
  // practical assessments arrives as two rows sharing a code AND a title, with
  // nothing in the marks data to tell them apart, so listing both showed the
  // same subject twice with no way to read the difference (and duplicated a
  // React key). The count is taken from the same deduped list, or the figure
  // would say 9 above a list of 8.
  const waiting = subjects.filter(
    (s, i) => subjects.findIndex((o) => o.code === s.code) === i,
  );

  /**
   * Which subject is open, by row key. One at a time, deliberately: the point
   * of the rebuild is that the page is short enough to take in at a glance, and
   * letting every row stand open rebuilds the wall it replaced.
   */
  const [open, setOpen] = useState<string | null>(null);

  const scope = useGsap(
    ({ self, reduced }) => {
      revealIn(self, reduced, { y: 16, stagger: 0.07 });
      revealRows(self, reduced);
    },
    [marksState, graded.length],
  );

  return (
    <>
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
          // Top aligned and carrying the actual list. Centring a short block in
          // a full height column looked like a layout fault on a tall phone:
          // the page was most of a screen of nothing whichever way it was
          // aligned. Naming the subjects it is waiting on fills the page with
          // something true and answers the obvious next question, which is
          // "waiting on what".
          <div data-reveal className="flex flex-1 flex-col pt-4">
            <p className="text-label uppercase text-text-3">Awaiting results</p>
            <p className="tnum optical mt-5 text-poster">{waiting.length}</p>
            <div className="bleed mt-7 h-px bg-line" />
            <p className="mt-5 max-w-[26ch] text-body text-text-2">
              {subjects.length > 0
                ? "subjects are being tracked. The first published assessment appears here on its own."
                : "Your internal assessments will show here once results are out."}
            </p>

            {waiting.length > 0 && (
              <ul className="mt-9">
                {waiting.map((s) => (
                  <li
                    key={s.code}
                    data-row
                    className="flex items-baseline gap-3 border-b border-line-soft py-3.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-body text-text-1">
                      {s.title || s.code}
                    </span>
                    <span className="shrink-0 text-callout text-text-3">
                      {s.code}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {marksState === "ready" && max > 0 && (
          <>
            {/* ONE poster figure, the same height as Attendance's percentage.
                It was set as a stacked fraction, numerator over a full bleed
                rule over the denominator, which is a lovely way to write a
                score by hand and is also literally twice the height of every
                other screen's poster: two `text-poster` lines where every other
                screen spends one. The denominator is the unit now, the way
                Attendance sets its "%", so the figure still reads as a score
                out of something rather than becoming a bare percentage. */}
            <div data-reveal className="pb-10 pt-6">
              <p className="text-label uppercase text-text-3">Internals so far</p>
              <Amount
                size="poster"
                className="mt-5"
                value={round(scored)}
                unit={`/${round(max)}`}
              />
              <div className="mt-5">
                <Marginalia>
                  <span className="tnum block">
                    {pct(scored, max).toFixed(0)}% across {graded.length} graded{" "}
                    {graded.length === 1 ? "subject" : "subjects"}
                  </span>
                </Marginalia>
              </div>
            </div>

            <section>
              <SectionHead aside={`${subjects.length} subjects`}>Breakdown</SectionHead>
              <ul className="mt-1">
                {subjects.map((s, i) => {
                  // A course with separate theory and practical assessments
                  // arrives as two rows sharing a code, so the index is part of
                  // the identity or opening one would open both.
                  const key = `${s.code}-${i}`;
                  const published = s.components.length > 0;
                  const forecast = published
                    ? forecastSubject({
                        scored: s.scoredTotal,
                        publishedMax: s.maxTotal,
                        isPractical: isPractical(s.code),
                      })
                    : null;
                  const isOpen = open === key;

                  return (
                    <li key={key} data-row>
                      <Rule soft={i > 0} />
                      <div data-surface>
                        <SubjectRow
                          title={s.title || s.code}
                          scored={published ? round(s.scoredTotal) : null}
                          max={round(s.maxTotal)}
                          open={isOpen}
                          // Nothing published means there is nothing behind the
                          // row, so it is a line of text rather than a control
                          // that opens onto an empty panel.
                          expandable={published}
                          panelId={`marks-${key}`}
                          onToggle={() => setOpen(isOpen ? null : key)}
                        />
                        {published && (
                          <Panel id={`marks-${key}`} open={isOpen}>
                            <Detail
                              components={s.components}
                              percent={pct(s.scoredTotal, s.maxTotal)}
                              forecast={forecast}
                            />
                          </Panel>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}
      </div>
    </>
  );
}

/**
 * One entry in the contents page: the title, and the score hung on the right.
 * Nothing else, at any width.
 *
 * The title truncates rather than wrapping, because a dot leader only reads as
 * a leader when the title and the figure share one line.
 */
function SubjectRow({
  title,
  scored,
  max,
  open,
  expandable,
  panelId,
  onToggle,
}: {
  title: string;
  /** Null while nothing has been published for this subject. */
  scored: number | null;
  max: number;
  open: boolean;
  expandable: boolean;
  panelId: string;
  onToggle: () => void;
}) {
  const line = (
    <>
      {/* **Wraps rather than truncating.** SRM course names are long, and at
          this width "Formal Language and Automata" and "Database Management
          Systems" both ran off the end as "Formal Language …", which is the one
          thing a subject line may not do: the name is what you are scanning
          for. A contents entry that runs to two lines is normal typography; a
          course you cannot identify is a bug. */}
      <span className="min-w-0 shrink text-headline">{title}</span>
      {/* Dot leader, the way a contents page joins a title to its page number.
          It grows into whatever slack the row has and collapses to nothing when
          there is none, which is the whole trick: it is decoration, and the
          title is content.

          **It must carry no minimum width.** Its basis is 0, so flexbox never
          shrinks it (shrinkage is weighted by basis), and a floor of 24px was
          therefore taken straight out of the title: in the card themes, which
          spend another 28px on padding, that squeezed the title box to 90px
          while "Mathematics" needs 103, so the word spilled over the dots. */}
      <span
        aria-hidden
        className="min-w-0 flex-1 self-center border-b border-dotted border-line"
      />
      {/* The figures are set a step below the title. The subject is what you
          are looking for; the score is what you are looking up. Smaller type
          also buys the title about twenty pixels, which is the difference
          between "Formal Language and Automata" fitting and not. */}
      {/* The grade used to be hung here as a second figure. It is gone: a
          contents page carries the score, and a projected letter beside every
          published number was a verdict competing with a fact. It is stated
          once, inside the subject it belongs to, above the table it comes
          from. */}
      <span className="tnum shrink-0 text-body">
        {scored !== null ? (
          <>
            {scored}
            <span className="text-text-3">/{max}</span>
          </>
        ) : (
          <span className="text-callout text-text-3">Awaiting</span>
        )}
      </span>
    </>
  );

  // Nothing published means there is nothing behind the row, so it stays a line
  // of text rather than becoming a control that opens onto an empty panel.
  if (!expandable) {
    return <div className="flex items-baseline gap-2.5 py-4">{line}</div>;
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={panelId}
      className="flex min-h-11 w-full items-baseline gap-2.5 py-4 text-left"
    >
      {line}
      <IconChevronRight
        size={15}
        aria-hidden
        className={`shrink-0 self-center text-text-3 transition-transform duration-200 motion-reduce:transition-none ${
          open ? "rotate-90" : ""
        }`}
      />
    </button>
  );
}

/**
 * The disclosure itself.
 *
 * Animated on `grid-template-rows` rather than a height tween, which is what
 * lets it open to its own natural height without anything having to measure the
 * content first. The inner element owns the `overflow: hidden`, so the panel is
 * genuinely zero high when closed.
 */
function Panel({
  id,
  open,
  children,
}: {
  id: string;
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      }`}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

/**
 * Everything about one subject, shown only for the subject asked about: how the
 * published marks are made up, and what the exam has to deliver for each grade.
 */
function Detail({
  components,
  percent,
  forecast,
}: {
  components: { name: string; scored: number; max: number }[];
  percent: number;
  forecast: SubjectForecast | null;
}) {
  return (
    <div className="pb-5">
      <TrackRule value={percent} className="bleed" />

      <ul className="mt-4 flex flex-col gap-1.5 pl-0">
        {components.map((c) => (
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

      {forecast && <Forecast forecast={forecast} />}
    </div>
  );
}

/**
 * What the exam has to deliver.
 *
 * Requirements are quoted on the paper the student actually sits (75 marks for
 * theory, 40 for a practical), not on the 40 mark weighting it scales down to,
 * because "you need 38 out of 75" is the sentence that helps.
 *
 * **The "on track" badge that used to sit here is gone.** The row above already
 * states the grade, and repeating it inside the thing that row opens is exactly
 * the duplication that made this page read as a wall.
 */
function Forecast({ forecast }: { forecast: SubjectForecast }) {
  const { internalOnly, onTrackGrade, bestGrade, remainingInternal, semPaper, targets } =
    forecast;

  if (internalOnly) {
    return (
      <p className="mt-5 text-body text-text-1">
        Settled at {bestGrade}
        <span className="text-text-3"> · no exam</span>
      </p>
    );
  }

  return (
    <div className="mt-6">
      {/* The grade, stated ONCE, on the subject it belongs to and directly
          above the table it comes from. It used to be hung on every collapsed
          row as well as here, which put a projected letter beside every
          published number and made the list argue with itself. */}
      <p className="text-body text-text-1">
        On track for {onTrackGrade}
        {bestGrade !== onTrackGrade ? (
          <span className="text-text-3"> · {bestGrade} still possible</span>
        ) : null}
      </p>
      <p className="tnum mt-1 text-callout text-text-3">
        {remainingInternal > 0
          ? `${remainingInternal} internal marks still to come`
          : "Internals complete"}
      </p>

      <dl className="mt-4 flex justify-between gap-1">
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
      {/* Stated once, inside the one subject being asked about, rather than
          under all six. The requirement leans on the internals still to come,
          so say so rather than quietly assuming the student takes all of them. */}
      <p className="mt-3.5 text-callout text-text-3/80">
        Marks needed in the {semPaper} mark exam
        {remainingInternal > 0 ? ", if you take every remaining internal mark" : ""}.
        A dash is out of reach.
      </p>
    </div>
  );
}
