"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sheet } from "@/components/ui/Overlay";
import { setTheme, THEMES, useTheme, type Theme } from "@/lib/theme";

const SKINS = THEMES.filter((t) => !t.structural);

/**
 * The colour picker: a strip of discs you flick sideways, snapping to centre.
 *
 * Whatever reaches the middle is applied straight away, so the app recolours
 * live behind the sheet and you choose by looking at the thing rather than at a
 * swatch. It stays a scrolling list of real buttons rather than a rotary dial,
 * so a keyboard and a screen reader can still work through it in order.
 */
export default function SkinPicker({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  const strip = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const [centred, setCentred] = useState<Theme>(
    SKINS.some((s) => s.id === theme) ? theme : SKINS[0].id,
  );

  // Bring the current skin under the finger when the sheet opens, without
  // animating from wherever the strip happened to be left.
  useEffect(() => {
    if (!open) return;
    const el = strip.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>('[data-skin][aria-checked="true"]');
    const target = active ?? el.querySelector<HTMLElement>("[data-skin]");
    if (target) {
      el.scrollLeft =
        target.offsetLeft - el.clientWidth / 2 + target.offsetWidth / 2;
    }
  }, [open]);

  /** Apply whatever is nearest the middle, once it changes. */
  const onScroll = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const el = strip.current;
      if (!el) return;
      const mid = el.scrollLeft + el.clientWidth / 2;
      let best: Theme | null = null;
      let bestDistance = Infinity;
      el.querySelectorAll<HTMLElement>("[data-skin]").forEach((node) => {
        const centre = node.offsetLeft + node.offsetWidth / 2;
        const d = Math.abs(centre - mid);
        if (d < bestDistance) {
          bestDistance = d;
          best = node.dataset.skin as Theme;
        }
      });
      if (best && best !== centred) {
        setCentred(best);
        setTheme(best);
      }
    });
  }, [centred]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const current = SKINS.find((s) => s.id === centred) ?? SKINS[0];

  return (
    <Sheet open={open} onClose={onClose} title="Colours">
      <div className="pb-2 pt-1">
        <div
          ref={strip}
          onScroll={onScroll}
          role="radiogroup"
          aria-label="Colour"
          className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto"
          // Half the strip either side, so the first and last can reach the
          // middle like any other.
          style={{ paddingInline: "calc(50% - 34px)" }}
        >
          {SKINS.map((s) => {
            // Two different states. Under the middle is where the strip is
            // parked; selected is what the app is actually wearing. They part
            // company when a full look is on, and a ring on Ink then would be
            // claiming a selection that is not in force.
            const middle = s.id === centred;
            const on = s.id === theme;
            return (
              <button
                key={s.id}
                data-skin={s.id}
                role="radio"
                aria-checked={on}
                aria-label={s.name}
                onClick={() => {
                  setCentred(s.id);
                  setTheme(s.id);
                  strip.current?.querySelector<HTMLElement>(
                    `[data-skin="${s.id}"]`,
                  )?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
                }}
                className="shrink-0 snap-center"
              >
                <span
                  aria-hidden
                  className={`flex size-[68px] overflow-hidden rounded-full border transition-all duration-200 ${
                    middle ? "opacity-100" : "scale-[0.78] opacity-45"
                  } ${on ? "border-accent" : "border-line"}`}
                >
                  {s.swatch.map((c, i) => (
                    <span key={i} className="h-full flex-1" style={{ background: c }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        {/* The name follows the strip rather than sitting on every disc, so the
            colours stay the thing you are reading. */}
        <div className="pt-5 text-center">
          <p className="text-title">{current.name}</p>
          <p className="mt-1 text-callout text-text-3">{current.note}</p>
        </div>

        <p className="pt-6 text-center text-callout leading-relaxed text-text-3">
          The app changes as you spin. {SKINS.length} colours.
        </p>
      </div>
    </Sheet>
  );
}
