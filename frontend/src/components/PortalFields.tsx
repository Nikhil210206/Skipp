"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import type { StudentPortalCaptchaResponse } from "@/lib/api";

/**
 * The Student Portal sign in, written once. The connect popup and both import
 * sheets (Attendance and Marks, first import and update) all ask for the same
 * three things, and they used to each draw them their own way: tinted boxes,
 * a pulsing skeleton, an orange "Show" and a different captcha layout per
 * screen. These are the sign-in screen's fields on a raised surface.
 */

export const PORTAL_INPUT =
  "min-w-0 w-full flex-1 appearance-none bg-transparent text-headline text-text-1 outline-none focus:outline-none focus-visible:outline-none placeholder:text-text-3 disabled:opacity-60";

/** A quiet text control in a field's label row: 44px tall to tap, pulled back
 *  out of the row with negative margins so the label line keeps its height. */
const ROW_ACTION =
  "-my-3 -mr-2 min-h-11 px-2 text-label uppercase text-text-2 hover:text-text-1 disabled:opacity-40";

/**
 * The whole box is the label, so a tap anywhere in it focuses the input, and
 * `data-field` gives it each look's field treatment (Stone cuts it into the
 * wall) and drops the global focus ring for the box's own accent border.
 */
export function PortalField({
  id,
  label,
  suffix,
  action,
  children,
}: {
  id: string;
  label: string;
  suffix?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      data-field
      className="block cursor-text rounded-control border border-line bg-ink-2 px-4 py-3 transition-colors focus-within:border-accent"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-label uppercase text-text-3">{label}</span>
        {action}
      </span>
      <span className="mt-1.5 flex items-baseline gap-1">
        {children}
        {suffix && <span className="shrink-0 text-headline text-text-3">{suffix}</span>}
      </span>
    </label>
  );
}

/** Net ID with the domain printed after it. Anything typed after an @ is
 *  dropped, since the domain is already there. */
export function NetIdField({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <PortalField id={id} label="Net ID" suffix="@srmist.edu.in">
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.split("@")[0].trim())}
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        disabled={disabled}
        className={PORTAL_INPUT}
      />
    </PortalField>
  );
}

export function PortalPasswordField({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <PortalField
        id={id}
        label="Student Portal password"
        action={
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-pressed={shown}
            className={ROW_ACTION}
          >
            {shown ? "Hide" : "Show"}
          </button>
        }
      >
        <input
          id={id}
          type={shown ? "text" : "password"}
          value={value}
          // A pasted password often carries a stray newline or zero width space.
          onChange={(e) => onChange(e.target.value.replace(/[\r\n​﻿]/g, ""))}
          autoComplete="current-password"
          disabled={disabled}
          className={PORTAL_INPUT}
        />
      </PortalField>
      <p className="mt-1.5 px-1 text-callout text-text-3">
        Often not the same as your Academia password.
      </p>
    </div>
  );
}

/**
 * The portal's security check: the image and the box to type it into, on one
 * line. While the image is on its way the box says so rather than pulsing, and
 * when it fails to arrive the failure is a line in the field with a way to ask
 * again.
 */
export function CaptchaField({
  id,
  session,
  loading,
  error,
  value,
  onChange,
  onReload,
  disabled,
}: {
  id: string;
  session: StudentPortalCaptchaResponse | null;
  loading: boolean;
  error: string | null;
  value: string;
  onChange: (v: string) => void;
  onReload: () => void;
  disabled?: boolean;
}) {
  return (
    <PortalField
      id={id}
      label="Type the letters you see"
      action={
        <button
          type="button"
          onClick={onReload}
          disabled={loading || disabled}
          className={ROW_ACTION}
        >
          {error ? "Try again" : "New one"}
        </button>
      }
    >
      {error ? (
        <span className="py-1 text-callout text-risk">{error}</span>
      ) : (
        <span className="flex w-full items-center gap-3">
          {/* On white whatever the look: the portal draws dark letters on a
              transparent ground, unreadable on a dark card. The slot keeps the
              image's size while it loads, so nothing shifts when it lands. */}
          <span className="flex h-10 w-32 shrink-0 items-center justify-center overflow-hidden rounded-control bg-white">
            {session && !loading ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.captchaBase64}
                alt="Security check letters"
                className="h-full w-auto select-none object-contain px-2 py-0.5"
              />
            ) : (
              <span className="text-callout text-black/45">Loading</span>
            )}
          </span>
          <input
            id={id}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            maxLength={6}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            disabled={disabled || loading || !session}
            className={`${PORTAL_INPUT} tnum uppercase tracking-[0.2em]`}
          />
        </span>
      )}
    </PortalField>
  );
}

/** What the student hears back, read out politely so a screen reader keeps
 *  its place in the form. */
export function PortalStatus({ error, done }: { error: string | null; done?: string | null }) {
  return (
    <div aria-live="polite">
      {error && <p className="px-1 text-callout text-risk">{error}</p>}
      {!error && done && <p className="px-1 text-callout text-text-2">{done}</p>}
    </div>
  );
}

export function PortalSubmit({ disabled, children }: { disabled: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" variant="primary" size="lg" full disabled={disabled}>
      {children}
    </Button>
  );
}

export function PortalPromise() {
  return (
    <p className="px-1 text-center text-callout text-text-3">
      Your password is encrypted on this device and never stored on our servers.
    </p>
  );
}

/** Checks shared by every portal form, before anything is sent. */
export function portalInputError(
  netId: string,
  password: string,
  isRegistrationNumber: (v: string) => boolean,
): string | null {
  if (!netId) return "Enter your Net ID.";
  if (isRegistrationNumber(netId))
    return "The Student Portal signs in with your Net ID, like ab1234, not your registration number.";
  if (!password) return "Enter your Student Portal password.";
  return null;
}
