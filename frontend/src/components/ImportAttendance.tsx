"use client";

// The entry point for pulling attendance from the student portal when academia
// has stopped publishing it. It appears inside the attendance gated/error state
// (as the StateView action) and does two different things depending on where
// the app is running:
//
//   - In the native Skipp app: a button that opens the real portal login in an
//     in-app WebView, then imports what a real signed-in session returns.
//   - On the web PWA: no button (a browser cannot read a cross-origin login),
//     just a line telling the student the app can do it.
//
// See lib/studentPortal.ts for why the native shell is required.

import { useState } from "react";

import { Button } from "@/components/ui";
import { Sheet } from "@/components/ui/Overlay";
import { useSession } from "@/context/SessionContext";
import { ImportCancelled } from "@/lib/studentPortal";

export function ImportAttendanceAction() {
  const { canImportAttendance, importAttendance } = useSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canImportAttendance) {
    return (
      <p className="max-w-[34ch] text-callout text-text-3">
        Attendance is on the SRM student portal right now. Open Skipp on your
        phone to sign in and import it.
      </p>
    );
  }

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await importAttendance();
      setOpen(false); // success: the screen re-renders with the attendance
    } catch (e) {
      // Closing the login is a choice, not a failure, so it says nothing.
      if (e instanceof ImportCancelled) {
        setOpen(false);
      } else {
        setError(e instanceof Error ? e.message : "Import failed. Try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Import from student portal
      </Button>

      <Sheet
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title="Get your attendance"
        footer={
          <Button variant="primary" onClick={run} disabled={busy}>
            {busy ? "Opening portal…" : "Sign in to student portal"}
          </Button>
        }
      >
        <div className="flex flex-col gap-5 pb-2">
          <p className="text-body text-text-2">
            Academia has not published attendance yet, so Skipp reads it straight
            from the SRM student portal instead.
          </p>

          <ol className="flex flex-col gap-4">
            <Step n={1}>
              Tap the button below and sign in to the student portal, the real
              login with your captcha.
            </Step>
            <Step n={2}>
              That is it. Your attendance shows up right here, and refreshes
              whenever you tap import again.
            </Step>
          </ol>

          <p className="text-callout text-text-3">
            Your portal password is typed on the portal, never saved by Skipp.
          </p>

          {error && <p className="text-callout text-risk">{error}</p>}
        </div>
      </Sheet>
    </>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-[2px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-label text-text-2 tnum">
        {n}
      </span>
      <span className="text-body text-text-1">{children}</span>
    </li>
  );
}

/**
 * A quiet note shown above portal-sourced attendance: where it came from and
 * the window it covers (the portal lags a few days), with a way to re-import or
 * drop back to academia. Rendered only when `attendanceSource === "portal"`.
 */
export function PortalSourceNote() {
  const { reportedPeriod, canImportAttendance, importAttendance, clearImportedAttendance } =
    useSession();
  const [busy, setBusy] = useState(false);

  const reimport = async () => {
    setBusy(true);
    try {
      await importAttendance();
    } catch {
      /* a cancel or failure just leaves the current data in place */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 border-t border-line-soft pt-3">
      <p className="text-callout text-text-3">
        From the student portal
        {reportedPeriod ? ` · ${reportedPeriod}` : ""}
      </p>
      <div className="flex items-center gap-4">
        {canImportAttendance && (
          <button
            type="button"
            onClick={reimport}
            disabled={busy}
            className="text-callout text-text-2 underline underline-offset-4 disabled:opacity-50"
          >
            {busy ? "Updating…" : "Update"}
          </button>
        )}
        <button
          type="button"
          onClick={clearImportedAttendance}
          className="text-callout text-text-3 underline underline-offset-4"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
