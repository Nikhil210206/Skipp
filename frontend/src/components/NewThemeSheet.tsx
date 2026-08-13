"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Overlay";
import { Button } from "@/components/ui";
import { Rule } from "@/components/ui/editorial";
import { useSession } from "@/context/SessionContext";
import { setTheme, useTheme, type Theme } from "@/lib/theme";
import { markNoticeSeen, NOTICE, useNoticeHold } from "@/lib/whatsNew";

/** The four, as the theme itself defines them. */
const FOUR = ["#ff5f33", "#9ad628", "#2ab8ff", "#ffc21f"];

/**
 * The one-time notice that Stone exists.
 *
 * IT APPLIES THE THEME LIVE rather than describing it. Pressing "Try now"
 * switches immediately, so the app repaints behind the open sheet and the sheet
 * itself changes with it: you judge a look by looking at it, not by reading
 * about it. The skins picker already works this way, for the same reason.
 *
 * The theme they were on is remembered, so "Undo" is always available. An
 * announcement that changes something and offers no way back is a trap, and the
 * whole point of trying is that you might not like it.
 */
export default function NewThemeSheet({ open }: { open: boolean }) {
  const held = useNoticeHold(open);
  const theme = useTheme();
  const { attendanceState } = useSession();

  /**
   * Whatever they were on before they pressed Try, captured once.
   *
   * State rather than a ref, because it decides what the footer renders: the
   * compiler lint rejects reading a ref during render, and it is right to,
   * since a ref change would not repaint the buttons.
   */
  const [previous, setPrevious] = useState<Theme | null>(null);
  const applied = theme === "stone";
  const tried = previous !== null;

  const tryIt = () => {
    // Functional, so a second press can never overwrite the original with
    // "stone" and strip them of the way back.
    setPrevious((p) => p ?? theme);
    setTheme("stone");
  };
  const close = () => markNoticeSeen(NOTICE.stone);

  return (
    <Sheet
      open={open && held}
      onClose={close}
      title="A new wall"
      footer={
        <div className="flex items-center gap-3">
          {tried || applied ? (
            <>
              <Button full onClick={close}>
                Keep it
              </Button>
              {/* Only offered when there is genuinely something to go back
                  to: somebody already on Stone has nothing to undo. */}
              {previous && previous !== "stone" && (
                <Button
                  variant="quiet"
                  onClick={() => {
                    setTheme(previous);
                    close();
                  }}
                >
                  Undo
                </Button>
              )}
            </>
          ) : (
            <>
              <Button full onClick={tryIt}>
                Try now
              </Button>
              <Button variant="quiet" onClick={close}>
                Later
              </Button>
            </>
          )}
        </div>
      }
    >
      <p className="pb-5 pt-1 text-body leading-relaxed text-text-2">
        Stone: lit plaster, sharp slabs, and four colours that only turn up when
        they mean something.
      </p>

      <Rule />

      {/* The material itself, not a screenshot of it. The wall is the real
          texture the theme ships, so this is the thing rather than a picture
          of the thing. */}
      <div className="flex items-center gap-4 py-4">
        <span
          aria-hidden
          className="h-14 w-20 shrink-0 border border-line"
          style={{
            backgroundColor: "#32322e",
            backgroundImage: 'url("/textures/wall.webp")',
            backgroundSize: "220px 220px",
          }}
        />
        <span className="min-w-0 flex-1">
          <span className="flex gap-1.5" aria-hidden>
            {FOUR.map((c) => (
              <span key={c} className="h-1.5 w-6" style={{ background: c }} />
            ))}
          </span>
          <span className="mt-2 block text-callout leading-relaxed text-text-3">
            One colour per tab. A day order you can recognise without reading
            it.
          </span>
        </span>
      </div>

      <Rule soft />

      {/* Only when it is TRUE for them. The app knows, so there is no reason to
          guess: once the portal publishes, this line stops appearing on its
          own rather than going stale.

          First person singular: Skipp is one student, not a company, and the
          credit on the sign in screen says so by name. */}
      {attendanceState === "gated" && (
        <p className="pt-4 text-callout leading-relaxed text-text-3">
          Your attendance still is not published. Nothing to read, so I made the
          waiting better looking.
        </p>
      )}

      <p className="py-4 text-callout leading-relaxed text-text-3">
        Every look lives on Profile, and you can change your mind there whenever
        you like.
      </p>
    </Sheet>
  );
}
