"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import {
  blockedUntilInstalled,
  CLASS_LEAD_MIN,
  disableNotifications,
  enableNotifications,
  notificationPermission,
  notificationsOn,
  notificationsSupported,
} from "@/lib/notify";

/**
 * The notifications control.
 *
 * The copy is doing real work here. These notifications are raised when Skipp
 * is opened, not while it is closed, and saying otherwise would be a promise
 * the web cannot keep: nothing can wake a closed page on a timer without a
 * server holding push subscriptions, which was built and then removed on
 * request. A feature that quietly overpromises is worse than one that explains
 * itself, so the second line says exactly when to expect these.
 */
type State =
  | "loading"
  | "on"
  | "off"
  | "denied"
  | "needs-install"
  | "unsupported";

function computeState(): State {
  if (!notificationsSupported()) return "unsupported";
  // iOS refuses notifications outright until the app is on the home screen, so
  // the honest answer is a pointer at the install steps, not a dead switch.
  if (blockedUntilInstalled()) return "needs-install";
  if (notificationPermission() === "denied") return "denied";
  return notificationsOn() ? "on" : "off";
}

export default function NotificationSetting() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    // Applied after an await rather than synchronously in the effect body: the
    // React compiler lint rejects the latter, and a cascading render would
    // re-run this on every pass.
    void Promise.resolve().then(() => {
      if (alive) setState(computeState());
    });
    return () => {
      alive = false;
    };
  }, []);

  async function turnOn() {
    setBusy(true);
    try {
      await enableNotifications();
    } finally {
      setBusy(false);
      setState(computeState());
    }
  }

  function turnOff() {
    disableNotifications();
    setState(computeState());
  }

  return (
    <div className="pt-7">
      <p className="pb-3 text-callout text-text-3">Notifications</p>

      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0 flex-1">
          <p className="text-body text-text-2">
            A nudge when a class is within {CLASS_LEAD_MIN} minutes, and a note
            when the portal has recorded attendance.
          </p>
          <p className="mt-2 text-callout leading-relaxed text-text-3">
            {state === "needs-install"
              ? "iPhone only allows notifications once Skipp is on your home screen. Add it, open it from the icon, then come back here."
              : state === "denied"
                ? "Blocked in your browser settings. Allow notifications for Skipp there, then reload."
                : state === "unsupported"
                  ? "This browser cannot show notifications."
                  : "These appear when you open Skipp, and stay in your notification tray afterwards. Nothing of yours is stored on our servers, so nothing can watch the portal while the app is closed."}
          </p>
        </div>

        {(state === "on" || state === "off") && (
          <Button
            onClick={state === "on" ? turnOff : turnOn}
            variant={state === "on" ? "quiet" : "secondary"}
            disabled={busy}
            className="shrink-0"
          >
            {busy ? "..." : state === "on" ? "On" : "Turn on"}
          </Button>
        )}
      </div>
    </div>
  );
}
