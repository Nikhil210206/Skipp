// Haptics, where the platform allows them.
//
// **iOS Safari has never supported `navigator.vibrate`**, including in an
// installed PWA, so on an iPhone this is a no-op and the interface has to carry
// its own feedback through motion instead. Android Chrome does support it.
// Nothing here should ever be the only signal that something happened.

type Pattern = "tick" | "select" | "commit";

const PATTERNS: Record<Pattern, number | number[]> = {
  /** Passing a detent: the lightest thing the API can express. */
  tick: 8,
  /** Choosing something. */
  select: 14,
  /** Finishing: two beats, so it reads as a conclusion rather than a tap. */
  commit: [12, 40, 20],
};

export function haptic(kind: Pattern = "tick"): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    /* a refusal here is never worth interrupting anything for */
  }
}

/** Whether the device will actually answer. Lets the UI lean on motion instead. */
export const hasHaptics = (): boolean =>
  typeof navigator !== "undefined" && "vibrate" in navigator;
