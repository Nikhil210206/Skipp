"use client";

import AppShell from "@/components/AppShell";
import { useSession } from "@/context/SessionContext";
import { revealIn, useGsap } from "@/lib/motion";
import {
  Card,
  Divider,
  Label,
  Meter,
  Skeleton,
  StateView,
} from "@/components/ui";

export default function MarksPage() {
  const { marks, marksState, marksMessage } = useSession();
  const subjects = marks?.subjects ?? [];
  const scored = subjects.reduce((x, s) => x + s.scoredTotal, 0);
  const max = subjects.reduce((x, s) => x + s.maxTotal, 0);
  const graded = subjects.filter((s) => s.components.length > 0).length;

  const scope = useGsap(
    ({ self, reduced }) => revealIn(self, reduced),
    [marksState],
  );

  return (
    <AppShell
      eyebrow="Internals"
      title={max > 0 ? `${round(scored)} / ${round(max)}` : "Marks"}
    >
      <div ref={scope} className="flex flex-1 flex-col">
        {marksState === "loading" && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}

        {marksState === "gated" && (
          <StateView
            tone="watch"
            title="No marks yet"
            message={
              marksMessage ??
              "Nothing has been published for this term. Marks appear here as soon as they are."
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

        {/* Subjects exist but nothing is graded: a list of zeroes helps nobody. */}
        {marksState === "ready" && (subjects.length === 0 || max === 0) && (
          <StateView
            title="Nothing graded yet"
            message={
              subjects.length > 0
                ? `We are tracking ${subjects.length} subjects. Marks appear the moment your first assessment is published.`
                : "Your internal assessments will show here once results are out."
            }
          />
        )}

        {marksState === "ready" && subjects.length > 0 && max > 0 && (
          <>
            <section data-reveal className="pb-8">
              <div className="flex items-baseline gap-2">
                <span className="tnum text-display">{round(scored)}</span>
                <span className="text-title text-text-3">/ {round(max)}</span>
              </div>
              <p className="mt-5 tnum text-callout text-text-3">
                {pct(scored, max).toFixed(0)}% across {graded} graded{" "}
                {graded === 1 ? "subject" : "subjects"}
              </p>
              <Meter value={pct(scored, max)} className="mt-5" />
            </section>

            <Card flush className="overflow-hidden" as="section">
              <div className="px-5 pb-1 pt-4">
                <Label>By subject</Label>
              </div>
              <ul>
                {subjects.map((s, i) => (
                  <li key={`${s.code}-${i}`} data-reveal>
                    {i > 0 && <Divider inset={20} />}
                    <div className="px-5 py-4">
                      <div className="flex items-baseline gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-headline">
                            {s.title || s.code}
                          </p>
                          <p className="mt-0.5 text-callout text-text-3">
                            {s.code}
                          </p>
                        </div>
                        <p className="shrink-0 tnum text-headline">
                          {round(s.scoredTotal)}
                          <span className="text-text-3">
                            /{round(s.maxTotal)}
                          </span>
                        </p>
                      </div>

                      {s.components.length > 0 ? (
                        <ul className="mt-3.5 flex flex-col gap-2.5">
                          {s.components.map((c) => (
                            <li key={c.name}>
                              <div className="flex items-baseline justify-between gap-3">
                                <span className="truncate text-callout text-text-2">
                                  {c.name}
                                </span>
                                <span className="tnum shrink-0 text-callout text-text-3">
                                  {round(c.scored)}/{round(c.max)}
                                </span>
                              </div>
                              <Meter
                                value={pct(c.scored, c.max)}
                                className="mt-1.5"
                              />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2.5 text-callout text-text-3">
                          No components published
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}

const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
const round = (n: number) => Math.round(n * 100) / 100;
