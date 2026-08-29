"use client";

import { useRef } from "react";

/**
 * Text and clock inputs, shared by every sheet that asks for a class.
 *
 * These were written inside `CustomClassSheet` and are lifted here the moment a
 * second sheet needed them, per the standing rule: screens are built from
 * primitives, and a look is changed in the primitive rather than in each
 * screen. Everything hard-won about them (the whole box being a tap target,
 * the caret advancing on its own, reading the blur off the element rather than
 * the prop) is the kind of thing that only gets fixed once if it only exists
 * once.
 */

export function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div
      data-field
      className="rounded-control border border-line bg-ink-0 px-4 py-3 transition-colors focus-within:border-text-3"
    >
      <label htmlFor={id} className="text-label uppercase text-text-3">
        {label}
      </label>
      <input
        id={id}
        value={value}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="tnum mt-1.5 w-full bg-transparent text-headline text-text-1 outline-none placeholder:font-sans placeholder:text-text-3"
      />
    </div>
  );
}

/**
 * A clock reading as two boxes, `HH` and `MM`, with no separator to type.
 *
 * **The two boxes are not tidiness, they are the only version that can be
 * completed on a phone.** A single `HH:MM` box asking for `inputMode="numeric"`
 * raises the digits keypad, and that keypad has no colon key at all on iOS, so
 * there was literally no sequence of taps that produced a valid time. Whoever
 * changes this back has to answer that.
 *
 * It carries no AM/PM of its own: some callers know the half of the day from
 * context and must not ask for it twice. `CustomClassSheet` pairs it with a
 * Segmented; the Saturday sheet does not, because the batch already says.
 */
export function ClockField({
  id,
  label,
  hour,
  minute,
  onHour,
  onMinute,
}: {
  id: string;
  label: string;
  hour: string;
  minute: string;
  onHour: (v: string) => void;
  onMinute: (v: string) => void;
}) {
  const hourRef = useRef<HTMLInputElement>(null);
  const minuteRef = useRef<HTMLInputElement>(null);

  return (
    <div
      data-field
      // The whole box is a target, not just the two small boxes inside it. A
      // field that only answers on the pixels its text occupies is the fault
      // the Net ID field already had once.
      onPointerDown={(e) => {
        if (!(e.target as HTMLElement).closest("input")) {
          e.preventDefault();
          hourRef.current?.focus();
        }
      }}
      className="rounded-control border border-line bg-ink-0 px-3 py-3 transition-colors focus-within:border-text-3"
    >
      <span className="block text-label uppercase text-text-3">{label}</span>
      <div className="mt-1.5 flex items-baseline">
        <TimePart
          id={`${id}-h`}
          inputRef={hourRef}
          label={`${label}, hour`}
          value={hour}
          onChange={(v) => {
            onHour(v);
            // The caret goes on by itself as soon as the hour cannot grow any
            // further. Two digits is always whole, and so is a single 2 to 9,
            // because the hours run 1 to 12 and only a leading 1 or 0 can
            // start a longer one. Without that second case, typing the very
            // common "2 o'clock" left the caret sitting in a field it had
            // already finished with.
            if (v.length === 2 || (v.length === 1 && v >= "2")) {
              minuteRef.current?.focus();
            }
          }}
        />
        <span aria-hidden className="px-1 text-headline text-text-3">
          :
        </span>
        <TimePart
          id={`${id}-m`}
          inputRef={minuteRef}
          label={`${label}, minute`}
          value={minute}
          onChange={onMinute}
        />
      </div>
    </div>
  );
}

/**
 * One half of a clock reading. Digits only, two at most, and it selects itself
 * on focus so a correction is one tap and one keystroke rather than a backspace
 * hunt.
 */
function TimePart({
  id,
  label,
  value,
  onChange,
  inputRef,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <input
      id={id}
      ref={inputRef}
      value={value}
      aria-label={label}
      inputMode="numeric"
      autoComplete="off"
      maxLength={2}
      // Stripped rather than validated: the keypad offers digits, but a paste
      // or a hardware keyboard can still put anything in here.
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 2))}
      onFocus={(e) => e.currentTarget.select()}
      // Written back the way the rest of the app prints a time, so a field left
      // reading "9" settles to "09" rather than staying half typed.
      //
      // **Read off the element, not off `value`.** The hour blurs itself by
      // moving the caret on from inside its own `onChange`, which happens
      // before React has re-rendered, so the prop in this closure is still the
      // value from BEFORE the keystroke and the padding silently never ran.
      onBlur={(e) => {
        const v = e.currentTarget.value;
        if (v.length === 1) onChange(`0${v}`);
      }}
      // 44px in both directions. The height is padding pulled straight back out
      // as negative margin, so the target clears the floor while the box keeps
      // exactly the height it had, the same trick the Schedule row uses.
      className="tnum -my-[11px] w-11 min-w-0 bg-transparent py-[11px] text-center text-headline text-text-1 outline-none"
    />
  );
}
