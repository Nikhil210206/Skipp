"use client";

// Sheets and full-screen panels. Both own their enter/exit timelines so a
// screen never has to think about animation, and both trap focus, close on
// Escape, and lock background scroll.
//
// Both render through a portal into <body>, and that is not optional.
// PullToRefresh writes a transform on its content wrapper as soon as a finger
// touches the screen, and a transformed ancestor becomes the containing block
// for position:fixed descendants. Rendered in place, "fixed inset-0" silently
// stops meaning "the viewport" and starts meaning "that wrapper", which is as
// tall as the whole scrolling page: the overlay grows to the page height and
// its footer lands hundreds of pixels below the fold. It only happens once a
// touch has occurred, so it is invisible on a desktop.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { DUR, EASE, prefersReducedMotion } from "@/lib/motion";
import { IconClose } from "@/components/Icons";
import { IconButton } from "./index";

/**
 * Locks the page behind an overlay.
 *
 * `overflow: hidden` on the body is ignored by iOS Safari, which happily keeps
 * scrolling the page behind a sheet. Pinning the body with `position: fixed`
 * at its current offset is what actually holds, so the scroll position has to
 * be captured and restored by hand.
 */
function useLockScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const body = document.body;
    const y = window.scrollY;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      Object.assign(body.style, prev);
      window.scrollTo(0, y);
    };
  }, [active]);
}

/**
 * Keeps focus inside the overlay while it is open and gives it back afterwards.
 *
 * A dialog that announces `aria-modal` while leaving focus on the page behind
 * it is worse than no dialog at all: a keyboard or screen reader user is told
 * they are in a modal and then tabs through content they cannot see.
 */
function useFocusTrap(open: boolean, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current;
    if (!open || !root) return;
    const previous = document.activeElement as HTMLElement | null;

    const focusable = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);

    focusable()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open, ref]);
}

/**
 * Keeps children mounted through the exit animation. State is reset during
 * render rather than in an effect, so there is no cascading re-render.
 */
function usePresence(open: boolean, exitMs: number) {
  const [exiting, setExiting] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) setExiting(true);
  }
  useEffect(() => {
    if (!exiting) return;
    const t = setTimeout(() => setExiting(false), exitMs);
    return () => clearTimeout(t);
  }, [exiting, exitMs]);
  return open || exiting;
}

function useDismissKey(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
}

// ---------- Bottom sheet -----------------------------------------

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const present = usePresence(open, 260);
  const scrim = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useLockScroll(present);
  useDismissKey(open, onClose);
  useFocusTrap(open, panel);

  useEffect(() => {
    const p = panel.current;
    const s = scrim.current;
    if (!p || !s || !present) return;
    const reduced = prefersReducedMotion();
    if (reduced) {
      gsap.set([s, p], { opacity: 1, y: 0 });
      return;
    }
    if (open) {
      gsap.killTweensOf([s, p]);
      gsap.fromTo(s, { opacity: 0 }, { opacity: 1, duration: DUR.quick, ease: EASE.out });
      gsap.fromTo(
        p,
        { yPercent: 100 },
        { yPercent: 0, duration: DUR.base, ease: EASE.emphasis },
      );
    } else {
      gsap.to(s, { opacity: 0, duration: DUR.quick, ease: EASE.in });
      gsap.to(p, { yPercent: 100, duration: DUR.quick, ease: EASE.in });
    }
  }, [open, present]);

  // Drag the grabber (or anywhere on the header) down to dismiss.
  const drag = useRef({ startY: 0, active: false });
  const onPointerDown = (e: React.PointerEvent) => {
    if (prefersReducedMotion()) return;
    // The close button lives inside the drag handle; capturing the pointer for
    // a drag would swallow its click.
    if ((e.target as HTMLElement).closest("button")) return;
    drag.current = { startY: e.clientY, active: true };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active || !panel.current) return;
    const dy = Math.max(0, e.clientY - drag.current.startY);
    gsap.set(panel.current, { y: dy });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag.current.active || !panel.current) return;
    drag.current.active = false;
    const dy = Math.max(0, e.clientY - drag.current.startY);
    if (dy > 110) {
      onClose();
      gsap.to(panel.current, { y: 0, duration: 0 , delay: 0.3 });
    } else {
      gsap.to(panel.current, { y: 0, duration: DUR.quick, ease: EASE.out });
    }
  };

  if (!present || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div
        ref={scrim}
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
      />
      <div
        ref={panel}
        className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[88vh] w-full max-w-md flex-col rounded-t-sheet border-t border-line bg-ink-1 shadow-float"
      >
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="shrink-0 cursor-grab touch-none px-5 pb-2 pt-3 active:cursor-grabbing"
        >
          <div className="mx-auto h-1 w-9 rounded-full bg-ink-3" />
          <div className="mt-4 flex items-center justify-between">
            <h2 className="text-title">{title}</h2>
            <IconButton onClick={onClose} label="Close" variant="quiet">
              <IconClose size={20} />
            </IconButton>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-line-soft px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ---------- Full-screen panel ------------------------------------

export function Panel({
  open,
  onClose,
  eyebrow,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const present = usePresence(open, 260);
  const root = useRef<HTMLDivElement>(null);
  useLockScroll(present);
  useDismissKey(open, onClose);
  useFocusTrap(open, root);

  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    const el = root.current;
    if (!el || !present) return;
    if (prefersReducedMotion()) {
      gsap.set(el, { opacity: 1, y: 0 });
      return;
    }
    if (open) {
      gsap.killTweensOf(el);
      const tl = gsap.timeline();
      tl.fromTo(
        el,
        { yPercent: 4, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: DUR.base, ease: EASE.emphasis },
      ).fromTo(
        el.querySelectorAll("[data-panel-reveal]"),
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: DUR.base, ease: EASE.out, stagger: 0.05 },
        0.06,
      );
    } else {
      gsap.to(el, { opacity: 0, yPercent: 2, duration: DUR.quick, ease: EASE.in });
    }
  }, [open, present]);

  if (!present || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex flex-col bg-ink-0"
    >
      <header
        data-panel-reveal
        className="flex shrink-0 items-start justify-between px-[var(--gutter)] pb-4 pt-[max(20px,env(safe-area-inset-top))]"
      >
        <div>
          {eyebrow && <p className="text-label uppercase text-text-3">{eyebrow}</p>}
          <h1 className="mt-1 text-title">{title}</h1>
        </div>
        <IconButton onClick={close} label="Close">
          <IconClose size={20} />
        </IconButton>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-[var(--gutter)]">{children}</div>
      {footer && (
        <div className="shrink-0 border-t border-line-soft bg-ink-0 px-[var(--gutter)] pb-[max(20px,env(safe-area-inset-bottom))] pt-4">
          {footer}
        </div>
      )}
    </div>,
    document.body,
  );
}
