"use client";

import { useRouter } from "next/navigation";
import gsap from "gsap";
import { EASE, revealIn, revealRows, useGsap } from "@/lib/motion";
import { Button } from "@/components/ui";
import { Marginalia } from "@/components/ui/editorial";
import { MAINTENANCE } from "@/lib/maintenance";

/**
 * The screen a section shows while its scraper is being fixed.
 *
 * **The figure is taped off rather than hidden.** Each screen's poster object is
 * still there, ghosted, with its digits spinning like a reel that keeps trying
 * to land and failing, and two strips of hazard tape are stuck across it. So the
 * screen still has its usual shape, and nobody can mistake the ghost for a real
 * percentage: it never settles, it is barely there, and it is behind the tape.
 *
 * Colour stays honest to the house rule: the tape is `watch`, because something
 * genuinely is wrong, and the status board only colours the rows that are down.
 */

/** One 0 to 9 column, plus a repeat of 0 so a full spin wraps seamlessly. */
const CELLS = 11;
const STEP = 100 / CELLS;

function Reel({ pattern }: { pattern: string }) {
  return (
    <span aria-hidden className="tnum inline-flex items-end">
      {pattern.split("").map((c, i) =>
        c === "0" ? (
          <span key={i} className="inline-block h-[1em] overflow-hidden leading-none">
            <span data-reel className="flex flex-col">
              {Array.from({ length: CELLS }, (_, d) => (
                <span key={d} className="h-[1em] leading-none">
                  {d % 10}
                </span>
              ))}
            </span>
          </span>
        ) : (
          <span key={i} className="inline-block h-[1em] leading-none opacity-50">
            {c}
          </span>
        ),
      )}
    </span>
  );
}

/** A strip of tape whose lettering runs along it. Two copies make the loop seamless. */
function Tape({ text, className }: { text: string; className: string }) {
  const run = Array.from({ length: 6 }, () => text).join("  ·  ");
  return (
    <div
      aria-hidden
      data-tape
      className={`pointer-events-none absolute left-[-10%] w-[120%] overflow-hidden bg-watch py-2 shadow-[0_6px_18px_rgb(0_0_0/0.35)] ${className}`}
    >
      {/* Hairline stripes at both edges, the way real barrier tape is printed. */}
      <span className="absolute inset-x-0 top-[3px] h-px bg-ink-0/40" />
      <span className="absolute inset-x-0 bottom-[3px] h-px bg-ink-0/40" />
      <div data-tape-run className="flex w-max whitespace-pre">
        {[0, 1].map((k) => (
          <span
            key={k}
            className="pr-[0.9em] text-label font-bold uppercase tracking-[0.18em] text-ink-0"
          >
            {run}  ·
          </span>
        ))}
      </div>
    </div>
  );
}

const STATUS = [
  { name: "Timetable", down: false },
  { name: "Calendar", down: false },
  { name: "Attendance", down: MAINTENANCE.attendance },
  { name: "Marks", down: MAINTENANCE.marks },
];

export default function MaintenanceView({
  section,
  pattern,
  unit,
}: {
  section: "attendance" | "marks";
  /** The poster's shape; every `0` becomes a spinning reel. */
  pattern: string;
  unit?: string;
}) {
  const router = useRouter();

  const scope = useGsap(({ self, reduced }) => {
    revealIn(self, reduced, { y: 16, stagger: 0.12 });
    revealRows(self, reduced);

    const reels = gsap.utils.toArray<HTMLElement>(self.querySelectorAll("[data-reel]"));
    const runs = gsap.utils.toArray<HTMLElement>(self.querySelectorAll("[data-tape-run]"));

    if (reduced) {
      // Parked, not spinning. Each reel rests on a different digit so the
      // ghost still reads as a figure rather than a row of zeros, which on an
      // attendance screen would read as a terrifying number.
      reels.forEach((r, i) => gsap.set(r, { yPercent: -STEP * ((i * 3 + 4) % 10) }));
      return;
    }

    // Each reel spins a few turns, tries to land on a digit, holds there for a
    // beat, then gives up and spins again. `repeatRefresh` re-rolls the landing
    // digit and the hold every lap, so the figure never repeats itself.
    reels.forEach((r, i) => {
      const tl = gsap.timeline({
        repeat: -1,
        repeatRefresh: true,
        delay: i * 0.12,
      });
      tl.fromTo(
        r,
        { yPercent: 0 },
        {
          yPercent: -STEP * 10,
          duration: 0.32 + i * 0.04,
          ease: "none",
          repeat: 2 + (i % 2),
        },
      )
        .to(r, {
          yPercent: () => -STEP * gsap.utils.random(0, 9, 1),
          duration: 0.8,
          ease: EASE.spring,
        })
        .to({}, { duration: () => gsap.utils.random(0.6, 1.6) });
    });

    // The tape lettering crawls, the two strips in opposite directions.
    runs.forEach((run, i) => {
      gsap.fromTo(
        run,
        { xPercent: i % 2 ? -50 : 0 },
        { xPercent: i % 2 ? 0 : -50, duration: 28, ease: "none", repeat: -1 },
      );
    });
  }, []);

  const what = section === "attendance" ? "attendance" : "marks";

  return (
    <div ref={scope} className="flex flex-1 flex-col pt-6">
      <p data-reveal className="flex items-center gap-2.5 text-label uppercase text-text-3">
        <span className="relative flex h-2 w-2">
          <span className="absolute inset-0 animate-ping rounded-full bg-watch opacity-60 motion-reduce:animate-none" />
          <span className="relative h-2 w-2 rounded-full bg-watch" />
        </span>
        Under maintenance
      </p>

      {/* The taped off figure. Clipped at the page edge so the tape can run
          past the column without ever giving the page a horizontal scroll. */}
      <div data-reveal className="bleed relative mt-4 overflow-hidden px-[var(--gutter)] py-10">
        <span className="flex items-baseline gap-1.5 text-text-1/[0.3]">
          <span className="text-poster optical">
            <Reel pattern={pattern} />
          </span>
          {unit && (
            <span data-unit className="text-title">
              {unit}
            </span>
          )}
        </span>
        <Tape
          text="Under maintenance"
          className="top-[22%] -rotate-[7deg]"
        />
        <Tape
          text="Back soon"
          className="top-[62%] rotate-[4deg]"
        />
      </div>

      <h2 data-reveal className="mt-6 text-hero text-text-1">
        We are fixing the pipe
      </h2>
      <p data-reveal className="mt-3 max-w-[34ch] text-body text-text-2">
        SRM changed something on their side, so Skipp cannot read your {what} right
        now. We are patching it, and it will be back here on its own once it works.
      </p>

      <ul className="mt-9 border-t border-line-soft">
        {STATUS.map((s) => (
          <li
            key={s.name}
            data-row
            className="flex items-baseline gap-3 border-b border-line-soft py-3.5"
          >
            <span className="min-w-0 flex-1 text-body text-text-1">{s.name}</span>
            <span
              className={`shrink-0 text-label uppercase ${
                s.down ? "text-watch" : "text-text-3"
              }`}
            >
              {s.down ? "Being fixed" : "Working"}
            </span>
          </li>
        ))}
      </ul>

      <div data-reveal className="mt-8 flex flex-col items-start gap-4">
        <Button variant="secondary" onClick={() => router.push("/timetable")}>
          See your schedule
        </Button>
        <Marginalia>Nothing you have saved is lost. Your data stays on this phone.</Marginalia>
      </div>
    </div>
  );
}
