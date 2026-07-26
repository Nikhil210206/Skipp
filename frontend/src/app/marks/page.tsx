"use client";

import AppShell from "@/components/AppShell";
import { useSession } from "@/context/SessionContext";
import { revealIn, revealRows, useGsap } from "@/lib/motion";
import { Skeleton, StateView } from "@/components/ui";
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
 * right, components indented beneath. No cards, no bars, just alignment.
 */
export default function MarksPage() {
  const { marks, marksState, marksMessage } = useSession();
  const subjects = marks?.subjects ?? [];
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

        {marksState === "ready" && (subjects.length === 0 || max === 0) && (
          <StateView
            title="Nothing graded yet"
            message={
              subjects.length > 0
                ? `We are tracking ${subjects.length} subjects. The first published assessment will show up here.`
                : "Your internal assessments will show here once results are out."
            }
          />
        )}

        {marksState === "ready" && max > 0 && (
          <>
            <div data-reveal className="pb-9 pt-4">
              <p className="text-label uppercase text-text-3">Internals so far</p>
              <Amount
                size="mega"
                className="mt-4"
                value={round(scored)}
                unit={`/ ${round(max)}`}
              />
              <TrackRule value={pct(scored, max)} className="bleed mt-7" />
              <Marginalia>
                <span className="mt-4 block tnum">
                  {pct(scored, max).toFixed(0)}% across {graded.length} graded{" "}
                  {graded.length === 1 ? "subject" : "subjects"}
                </span>
              </Marginalia>
            </div>

            <section>
              <SectionHead aside={`${subjects.length} subjects`}>Breakdown</SectionHead>
              <ul className="mt-1">
                {subjects.map((s, i) => (
                  <li key={`${s.code}-${i}`} data-row>
                    <Rule soft={i > 0} />
                    <div className="py-4">
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
