"use client";

import EntryChapter, { Advance } from "./entry/EntryChapter";
import { ProfileFace } from "./ProfileMark";

/**
 * The first thing a new student ever sees, after the launch.
 *
 * Its only job is to WELCOME somebody. It shows no attendance figure, no marks
 * and no timetable, because the onboarding chapters that follow are built
 * entirely out of those: an earlier version put a 97.7% card here and it was
 * the same picture as chapter one, two screens early and with none of the
 * explanation. A welcome that previews the product is not a welcome, it is a
 * worse version of the tour.
 *
 * So the stage is PEOPLE. Every student gets a generated character from their
 * registration number, drawn in `lib/mark.ts`, and a crowd of them says who
 * this is for without a word of copy: other students, all a bit different, all
 * already here. It is the same drawing the profile uses, so the very first
 * thing anyone sees is something they will later recognise as their own.
 *
 * The room is warm, and the only warm one in the entry deck: every onboarding
 * chapter is cool, so opening here and moving to the install screen's deep
 * ocean reads as walking somewhere.
 */

const FIELD = "#331206";

/** Seeds picked so the crowd is visibly varied: different tops, eyes, mouths. */
const CROWD = [
  { seed: "RA2411003010021", size: 62, x: "1%", y: 8, rot: -8, dim: 0.5 },
  { seed: "RA2411003010144", size: 94, x: "30%", y: 0, rot: 5, dim: 0.85 },
  { seed: "RA2411003010307", size: 56, x: "76%", y: 34, rot: -4, dim: 0.45 },
  { seed: "RA2411003011574", size: 124, x: "10%", y: 112, rot: -2, dim: 1 },
  { seed: "RA2411003010492", size: 78, x: "64%", y: 134, rot: 9, dim: 0.7 },
  { seed: "RA2411003010838", size: 58, x: "0%", y: 268, rot: 6, dim: 0.42 },
  { seed: "RA2411003011002", size: 90, x: "34%", y: 274, rot: -6, dim: 0.62 },
  { seed: "RA2411003010676", size: 62, x: "74%", y: 258, rot: 3, dim: 0.5 },
];

export default function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <EntryChapter
      field={FIELD}
      eyebrow="made for srm students"
      word="WELCOME"
      actions={
        <div data-in className="flex items-center justify-between gap-4">
          <p className="min-w-0 flex-1 text-callout leading-relaxed opacity-70">
            You are one sign in away from never opening the SRM portal again.
          </p>
          <Advance onClick={onNext} label="Continue" field={FIELD} />
        </div>
      }
    >
      <Stage />
    </EntryChapter>
  );
}

/* -------------------------------------------------------------------------- */

/** A crowd of the app's own generated students, scattered at varying depth. */
function Stage() {
  return (
    <div className="flex h-full items-center justify-center overflow-hidden px-[var(--gutter)]">
      <div className="relative h-[372px] w-full max-w-[360px]">
        {CROWD.map((p) => (
          <span
            key={p.seed}
            data-in
            className="absolute"
            style={{
              left: p.x,
              top: p.y,
              transform: `rotate(${p.rot}deg)`,
              opacity: p.dim,
            }}
          >
            <ProfileFace
              seed={p.seed}
              size={p.size}
              // Painted in the room's cream rather than the theme's accent: the
              // field here is fixed, so a theme token would be the one thing on
              // screen that did not belong to it.
              tile="bg-[rgba(247,243,236,0.14)]"
              cut={FIELD}
            />
          </span>
        ))}
      </div>
    </div>
  );
}
