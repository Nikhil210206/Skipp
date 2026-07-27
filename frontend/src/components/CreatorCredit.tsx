"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { CREATOR, creatorLinks } from "@/lib/creator";
import { DUR, EASE, prefersReducedMotion } from "@/lib/motion";
import { IconInstagram, IconLinkedIn } from "./Icons";

/**
 * The authorship line. The name is a control: tapping it reveals where to find
 * the person who built the app, so the credit stays one quiet line until
 * somebody is actually curious.
 *
 * With no links configured the name is plain text rather than a button, so the
 * credit never offers a control that does nothing.
 */
export default function CreatorCredit({
  align = "left",
  className = "",
}: {
  align?: "left" | "center";
  className?: string;
}) {
  const links = creatorLinks();
  const [open, setOpen] = useState(false);
  const tray = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = tray.current;
    if (!el || !open || prefersReducedMotion()) return;
    gsap.fromTo(
      el.querySelectorAll("a"),
      { opacity: 0, scale: 0.75 },
      {
        opacity: 1,
        scale: 1,
        duration: DUR.quick,
        ease: EASE.out,
        stagger: 0.06,
        overwrite: "auto",
      },
    );
  }, [open]);

  return (
    <div
      className={`flex flex-wrap items-center gap-x-1.5 gap-y-2 font-signature text-callout tracking-[-0.01em] text-text-3 ${
        align === "center" ? "justify-center" : ""
      } ${className}`}
    >
      <span>{CREATOR.prefix}</span>

      {links.length > 0 ? (
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="font-medium text-text-2 underline decoration-line underline-offset-4 transition-colors hover:text-text-1"
        >
          {CREATOR.name}
        </button>
      ) : (
        <span className="text-text-2">{CREATOR.name}</span>
      )}

      {/* Always mounted, widening from zero. Mounting it on open changed the
          line's width in one frame, which centred text reads as a jump. */}
      <span
        ref={tray}
        aria-hidden={!open}
        className={`inline-flex items-center gap-1.5 overflow-hidden transition-[max-width,opacity,margin] duration-300 ease-out ${
          open
            ? "ml-1 max-w-[104px] opacity-100"
            : "pointer-events-none ml-0 max-w-0 opacity-0"
        }`}
      >
        {links.map((l) => (
          <a
            key={l.kind}
            href={l.url}
            target="_blank"
            // `noreferrer` is deliberately absent: LinkedIn answers
            // referrer-less traffic with a sign-up wall instead of the profile.
            // `noopener` alone still closes the window.opener hole.
            rel="noopener"
            tabIndex={open ? 0 : -1}
            aria-label={l.kind === "linkedin" ? "LinkedIn" : "Instagram"}
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line text-text-3 transition-colors hover:border-line-strong hover:text-text-1"
          >
            {l.kind === "linkedin" ? (
              <IconLinkedIn size={15} />
            ) : (
              <IconInstagram size={15} />
            )}
          </a>
        ))}
      </span>
    </div>
  );
}
