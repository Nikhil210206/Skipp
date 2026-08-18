import type { CapacitorConfig } from "@capacitor/cli";

// Skipp's native shell. Its ONLY job is to make a real student-portal WebView
// login possible (see src/lib/studentPortal.ts): academia stopped publishing
// attendance, the portal refuses scripted logins, and a pure PWA cannot read a
// cross-origin authenticated session. Everything else stays the same web app.
//
// `server.url` loads the live deployed site rather than a bundled export, so
// there is one deployment and no static-export constraints on the Next app.
// Point it at your production origin; comment it out to load a local bundle.
const config: CapacitorConfig = {
  appId: "life.skipp.app",
  appName: "Skipp",
  webDir: "public",
  // The simulator shares the Mac's network, so it can reach a local dev server
  // at localhost. Set SKIPP_NATIVE_DEV=1 to load the dev build (with unshipped
  // changes) instead of production, for on-device testing.
  //   RELEASE  -> https://skipp.life
  //   DEV TEST -> http://localhost:3000 (needs `npm run dev` + backend on :8000)
  server:
    process.env.SKIPP_NATIVE_DEV === "1"
      ? { url: "http://localhost:3000", cleartext: true }
      : { url: "https://skipp.life", cleartext: false },
};

export default config;
