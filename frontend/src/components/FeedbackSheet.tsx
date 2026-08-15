"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Overlay";
import { Button, Segmented } from "@/components/ui";
import { Rule } from "@/components/ui/editorial";
import { IconStar } from "@/components/Icons";
import { useSession } from "@/context/SessionContext";
import { useTheme } from "@/lib/theme";
import { haptic } from "@/lib/haptics";
import { sendFeedback, type FeedbackKind } from "@/lib/api";
import { isStandalone } from "@/components/InstallGate";
import { snoozeFeedback } from "@/lib/feedback";
import { useNoticeHold } from "@/lib/whatsNew";

/** The longest a message may be, matching the ceiling the backend enforces. */
const MAX = 2000;

/**
 * What each rating means, said in words.
 *
 * A row of stars is unambiguous about how many are lit and completely
 * ambiguous about what four of them means. One word underneath costs a line
 * and turns a number into an opinion.
 */
const WORDS = ["", "Rough", "Not great", "Fine", "Good", "Love it"];

const KINDS: { value: FeedbackKind; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "idea", label: "Idea" },
  { value: "other", label: "Other" },
];

/**
 * The one place a student writes back.
 *
 * It opens from Profile, and once a month it opens itself (see
 * `lib/feedback.ts` for when, and `prompted` for what changes). Both are the
 * same form, because a student who came looking for it and one who was asked
 * are answering the same question, and two sheets would drift apart.
 *
 * **Nothing about who they are is typed.** The name, section and registration
 * number come from the snapshot the app already holds, and the sheet says so
 * in as many words above the send button: this is the only thing in Skipp that
 * leaves the device attached to a person, so it has to be stated rather than
 * discovered.
 */
export default function FeedbackSheet({
  open,
  onClose,
  prompted = false,
}: {
  open: boolean;
  onClose: () => void;
  /** Opened by the monthly prompt rather than by the student. */
  prompted?: boolean;
}) {
  const { student } = useSession();
  const theme = useTheme();

  const [rating, setRating] = useState(0);
  const [kind, setKind] = useState<FeedbackKind>("other");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A fresh sheet each time it is opened. Without this, somebody who sent
  // something last month reopens it to a thank-you screen.
  //
  // State rather than a ref, and reset during render rather than in an effect:
  // the compiler lint rejects both reading a ref in render and setting state
  // from an effect, and this way there is no second render pass.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setRating(0);
      setKind("other");
      setMessage("");
      setSent(false);
      setError(null);
    }
  }

  const who = [student?.name, student?.section].filter(Boolean).join(" · ");

  async function submit() {
    if (rating === 0 || sending) return;
    setSending(true);
    setError(null);
    try {
      await sendFeedback({
        rating,
        kind,
        message: message.trim().slice(0, MAX),
        // Filled in from what the app already knows. See the note above.
        //
        // The PORTAL name, never `displayName`. A display name is a nickname
        // somebody chose for their own greeting, it identifies nobody, and its
        // fallback is the literal string "there", which arrived as
        // `From: there` the first time this was tested. Null is honest: the
        // backend answers it with "not identified".
        name: student?.name,
        section: student?.section,
        registrationNumber: student?.registrationNumber,
        program: student?.program,
        semester: student?.semester,
        theme,
        installed: isStandalone(),
      });
      haptic("commit");
      setSent(true);
      // Whether they were asked or came looking, they have now said their
      // piece: the next prompt is a month out either way.
      snoozeFeedback();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send that.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={sent ? "Thanks" : prompted ? "How is Skipp going?" : "Tell me something"}
      footer={
        sent ? (
          <Button full onClick={onClose}>
            Done
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            <Button full onClick={() => void submit()} disabled={rating === 0 || sending}>
              {sending ? "Sending" : "Send"}
            </Button>
            {/* Only when they did not ask for this. A sheet somebody opened
                deliberately already has a close button in its header, and a
                second way out reads as a form talking them out of it. */}
            {prompted && (
              <Button variant="quiet" onClick={onClose}>
                Not now
              </Button>
            )}
          </div>
        )
      }
    >
      {sent ? (
        <div className="py-2">
          <p className="text-body leading-relaxed text-text-2">
            Got it. I read every one of these myself, and the ones that turn
            into something usually turn up in the app within a week or two.
          </p>
          <p className="pt-4 text-callout leading-relaxed text-text-3">
            You can send another whenever you like, from Profile.
          </p>
        </div>
      ) : (
        <>
          <p className="pb-5 pt-1 text-body leading-relaxed text-text-2">
            {prompted
              ? "You have been using Skipp for a while. Worth a minute to say what is working and what is not?"
              : "Anything that is broken, missing, or just annoying. It goes straight to me."}
          </p>

          <Rule />

          <div className="py-5">
            <Stars value={rating} onChange={setRating} />
          </div>

          <Rule soft />

          <div className="pt-5">
            <p className="pb-2.5 text-callout text-text-3">What is it about</p>
            <Segmented
              label="Feedback type"
              options={KINDS}
              value={kind}
              onChange={setKind}
            />
          </div>

          <div className="pt-5">
            <label htmlFor="feedback" className="text-callout text-text-3">
              In your words {kind === "bug" ? "(what happened, and where)" : "(optional)"}
            </label>
            <textarea
              id="feedback"
              // Anything you type into is a field, and Stone cuts a field into
              // the wall rather than standing it on top of one. The marker
              // goes on the box, and here the textarea IS the box. It is inert
              // in every other theme, which is why it can just be set.
              data-field
              value={message}
              maxLength={MAX}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder={
                kind === "bug"
                  ? "The schedule showed the wrong day order on Monday"
                  : kind === "idea"
                    ? "It would help if..."
                    : "Say anything"
              }
              className="mt-2 w-full resize-none rounded-control border border-line bg-ink-2 px-3.5 py-3 text-body text-text-1 outline-none transition-colors placeholder:text-text-3 focus:border-accent"
            />
          </div>

          {/* Stated, not buried. This is the only thing in the app that leaves
              the device with a name on it, and a student should know that
              before they press send rather than after. */}
          <p className="pt-3 text-callout leading-relaxed text-text-3">
            {who
              ? `Sent as ${who}, so I can follow up. Nothing else about your account goes with it, and your password never leaves this device.`
              : "Sent with your name and section, so I can follow up. Your password never leaves this device."}
          </p>

          {error && (
            <p role="alert" className="pt-3 text-callout leading-relaxed text-risk">
              {error}
            </p>
          )}

          <div className="pb-2" />
        </>
      )}
    </Sheet>
  );
}

/**
 * Five stars.
 *
 * Real buttons in a radiogroup rather than a slider: a slider needs a drag to
 * discover and this has to work with one tap, a keyboard and a screen reader.
 * Each target is 44px, which is also what spaces the row out.
 */
function Stars({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  // Which star the pointer is over, so the row answers before it is pressed.
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Rating"
        className="flex"
        onPointerLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} out of 5, ${WORDS[n].toLowerCase()}`}
            onPointerEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            onClick={() => {
              onChange(n);
              haptic("select");
            }}
            className={`flex size-11 items-center justify-center transition-colors duration-150 ease-out ${
              n <= shown ? "text-accent" : "text-text-3"
            }`}
          >
            <IconStar size={28} filled={n <= shown} />
          </button>
        ))}
      </div>
      {/* The line is always here, holding its own height, so choosing a rating
          does not shove the rest of the form down by a line. */}
      <p className="mt-2 min-h-[1.2em] text-callout text-text-2">
        {shown ? WORDS[shown] : "Tap a star"}
      </p>
    </div>
  );
}

/**
 * The monthly prompt.
 *
 * Separate from the sheet so `AppShell` can hold the "one overlay at a time"
 * rule in one place, and so the sheet itself knows nothing about scheduling.
 */
export function FeedbackPrompt({ open }: { open: boolean }) {
  // The same launch hold every other notice takes: a Sheet is z-50 and the
  // launch overlay is z-100, so without it this rises entirely behind the
  // splash and is simply THERE when the splash lifts.
  const held = useNoticeHold(open);

  // Latched once, rather than driven straight from `open`: sending calls
  // `snoozeFeedback`, which moves the date, which makes `open` false again. Fed
  // through directly, that would tear the sheet away in the same frame somebody
  // pressed Send and they would never see the thank-you.
  //
  // Latched during RENDER, not from an effect. The compiler lint rejects a
  // synchronous setState in an effect, and this is the same derived-state shape
  // `usePresence` in ui/Overlay.tsx already uses: no cascading render, and the
  // first painted frame is already right.
  const [latched, setLatched] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  if (open && held && !latched) setLatched(true);

  const close = () => {
    setDismissed(true);
    // Dismissing counts as an answer. Coming back tomorrow because they said
    // nothing today is exactly how a prompt becomes a nuisance.
    snoozeFeedback();
  };

  return <FeedbackSheet open={latched && !dismissed} onClose={close} prompted />;
}
