"use client";

import { IconArrowRight, IconChevronLeft } from "@/components/Icons";
import type { Room } from "./rooms";

/**
 * The furniture every room shares: where you are at the top, the way on at the
 * bottom, and the chapter in between.
 *
 * The furniture is fixed so the tour feels like one place, and it is DRAWN BY
 * THE ROOM: a pill in Ink and Ticket, a bordered block on a hard shadow in
 * Brutal, a bracketed box in Terminal, a pixel button in Arcade. The shape of a
 * button is part of what a look is, so the rooms would be lying if every one
 * of them had the same pill.
 *
 * The chapter is two halves, the words and the object. On a phone they stack
 * and the object floats in whatever the words leave (auto margins, never
 * `justify-center`, so a short phone scrolls instead of pushing the head up
 * under the progress bar). Past `lg` they sit side by side.
 */

export function controlStyle(room: Room, solid: boolean): React.CSSProperties {
  switch (room.control) {
    case "block":
      return {
        borderRadius: 0,
        border: `3px solid ${room.line}`,
        boxShadow: `5px 5px 0 ${room.line}`,
        background: solid ? room.accent : "#ffffff",
        color: solid ? room.onAccent : room.ink,
      };
    case "bracket":
      return {
        borderRadius: 0,
        border: `1.5px solid ${solid ? room.accent : room.line}`,
        background: solid ? room.accent : "transparent",
        color: solid ? room.onAccent : room.ink,
        fontFamily: "var(--font-geist-mono)",
      };
    case "pixel":
      return {
        borderRadius: 10,
        boxShadow: solid ? "none" : `inset 0 0 0 3px ${room.line}`,
        background: solid ? room.accent : "transparent",
        color: solid ? room.onAccent : room.ink,
        fontFamily: "var(--font-pixel-src)",
      };
    default:
      return {
        borderRadius: 999,
        boxShadow: solid ? "none" : `inset 0 0 0 2px ${room.line}`,
        background: solid ? room.accent : "transparent",
        color: solid ? room.onAccent : room.ink,
      };
  }
}

/** A press, drawn per room: the block sinks into its own shadow, the rest shrink. */
function pressClass(room: Room): string {
  return room.control === "block"
    ? "transition-[transform,box-shadow] duration-100 active:translate-x-[3px] active:translate-y-[3px] active:!shadow-[2px_2px_0_#000]"
    : "transition-transform duration-[420ms] ease-[cubic-bezier(.34,1.56,.64,1)] active:scale-[0.96] active:duration-[90ms]";
}

export function RoomButton({
  room,
  label,
  onClick,
  solid = true,
  arrow = true,
  className = "",
  disabled,
}: {
  room: Room;
  label: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  solid?: boolean;
  arrow?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  const pixel = room.control === "pixel";
  const bracket = room.control === "bracket";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-[58px] min-w-0 items-center gap-3 font-semibold tracking-[-0.01em] disabled:opacity-40 ${arrow ? "justify-between pl-6 pr-2" : "justify-center px-6"} ${pixel ? "text-[13px] tracking-normal" : "text-[17px]"} ${pressClass(room)} ${className}`}
      style={controlStyle(room, solid)}
    >
      <span className="truncate">{bracket ? `[ ${label} ]` : label}</span>
      {arrow && (
        <span
          className="grid size-[42px] shrink-0 place-items-center"
          style={{
            borderRadius: room.control === "pill" ? 999 : room.control === "pixel" ? 7 : 0,
            background: solid ? room.onAccent : "transparent",
            color: solid ? room.accent : room.ink,
          }}
        >
          <IconArrowRight size={18} />
        </span>
      )}
    </button>
  );
}

export function RoomIconButton({
  room,
  label,
  onClick,
  children,
  solid = false,
  disabled,
}: {
  room: Room;
  label: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  solid?: boolean;
  disabled?: boolean;
}) {
  const style = controlStyle(room, false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`grid size-[58px] shrink-0 place-items-center disabled:opacity-30 ${pressClass(room)}`}
      style={
        solid
          ? { ...style, background: room.ink, color: room.bg, boxShadow: room.control === "block" ? style.boxShadow : "none", border: room.control === "block" ? style.border : "none" }
          : style
      }
    >
      {children}
    </button>
  );
}

export default function RoomFrame({
  room,
  step,
  total,
  onSkip,
  head,
  object,
  onBack,
  primary,
  onNext,
  className = "",
}: {
  room: Room;
  step: number;
  total: number;
  onSkip: () => void;
  head: React.ReactNode;
  object: React.ReactNode;
  onBack: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** The chapter's one action. Without `onNext` it is also the way on. */
  primary: { label: string; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; arrow?: boolean };
  /** A separate way on, for a chapter whose primary is something to play with. */
  onNext?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}) {
  const rest = `color-mix(in srgb, ${room.ink} 18%, transparent)`;
  return (
    <section
      className={`absolute inset-0 flex flex-col transition-[background-color,color] duration-[600ms] ease-[cubic-bezier(.16,1,.3,1)] ${className}`}
      style={{ background: room.bg, color: room.ink }}
    >
      <div className="mx-auto flex w-full max-w-[1180px] shrink-0 items-center gap-4 px-6 pt-[max(14px,env(safe-area-inset-top))] lg:px-14 lg:pt-8">
        <span className="font-mono text-[12px] font-semibold tracking-[0.12em]" style={{ color: room.dim }}>
          {String(step).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
        <div className="grid flex-1 grid-cols-6 gap-1.5 lg:max-w-[260px]" aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className="h-[3px] rounded-full"
              style={{
                background: i + 1 < step ? room.ink : i + 1 === step ? room.accent : rest,
              }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="ml-auto min-h-11 shrink-0 text-[14px] underline-offset-4 hover:underline"
          style={{ color: room.dim }}
        >
          skip intro
        </button>
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-[1180px] flex-col px-6 lg:grid lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-14">
          <div className="pt-6 short:pt-3 lg:pt-0">{head}</div>
          <div className="my-auto py-6 short:py-3 lg:my-0 lg:py-10">{object}</div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1180px] shrink-0 items-center gap-2.5 px-6 pb-[max(18px,env(safe-area-inset-bottom))] pt-2 lg:justify-end lg:px-14 lg:pb-10">
        <RoomIconButton room={room} label="Back" onClick={onBack} disabled={step === 1}>
          <IconChevronLeft size={20} />
        </RoomIconButton>
        <RoomButton
          room={room}
          label={primary.label}
          onClick={primary.onClick}
          arrow={primary.arrow ?? !onNext}
          className="flex-1 lg:w-[280px] lg:flex-none"
        />
        {onNext && (
          <RoomIconButton room={room} label="Next chapter" onClick={onNext} solid>
            <IconArrowRight size={20} />
          </RoomIconButton>
        )}
      </div>
    </section>
  );
}
