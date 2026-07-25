"use client";

import { useEffect } from "react";

// Registers the service worker in production only (a SW in dev interferes with
// Next's Fast Refresh / asset hashing). Installability itself comes from the
// manifest + icons; the SW adds offline support.
export default function PWARegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* offline support unavailable, the app still works */
      });
    }
  }, []);
  return null;
}
