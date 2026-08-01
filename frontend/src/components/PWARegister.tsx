"use client";

import { useEffect } from "react";

/**
 * Registers the service worker in production only (a SW in dev interferes with
 * Next's Fast Refresh and asset hashing). Installability itself comes from the
 * manifest and icons; the SW adds offline support.
 *
 * It also keeps the installed app up to date, which is not optional on iOS.
 * **A home screen PWA resumed from the app switcher does not reload**: it
 * restores the previous page with the old JavaScript still in memory, so a
 * student can sit on a build from days ago and never see a fix ship. That is
 * indistinguishable from the fix not working, and it cost several rounds of
 * chasing a gesture bug that had already been fixed and deployed.
 *
 * So: ask the browser to re-check for a new worker every time the app comes to
 * the foreground, and reload once a new one takes over.
 */
export default function PWARegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    // Whether this page was already under a worker's control. On a first ever
    // install `controllerchange` fires as soon as the new worker claims the
    // page, and reloading then would be a pointless flash.
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;

    const onControllerChange = () => {
      if (reloading || !hadController) return;
      reloading = true;
      window.location.reload();
    };

    let registration: ServiceWorkerRegistration | null = null;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        // Cheap, and the only thing that gets a resumed iOS app to look.
        registration?.update().catch(() => {});
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    document.addEventListener("visibilitychange", onVisible);

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        registration = reg;
      })
      .catch(() => {
        /* offline support unavailable, the app still works */
      });

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
