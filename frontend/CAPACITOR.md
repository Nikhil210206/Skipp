# Skipp native shell (Capacitor)

Skipp is a PWA. The one thing a PWA cannot do is read a **cross-origin
authenticated session**, and that is exactly what pulling attendance from the
SRM student portal requires: academia stopped publishing attendance, the portal
(`sp.srmist.edu.in`) refuses scripted logins behind an anti-bot fingerprint gate
we do not forge, so the only honest way in is a **real login in a real browser**.

This native shell exists solely to make that possible. The student signs in to
the real portal inside an in-app WebView (real page, real captcha, real human),
the WebView fetches the report pages same-origin (session cookies ride along on
their own), and the HTML comes back to the app to be parsed. Everything else is
the same web app, loaded from the live site.

Nothing here forges a fingerprint, defeats a captcha, or stores a portal
password. If SRM restores attendance on academia, the import quietly stops being
offered on its own (see `attendanceSource` in `SessionContext`).

## How the pieces fit

| Piece | File | Verified? |
| --- | --- | --- |
| Config | `capacitor.config.ts` | build-time |
| WebView login + capture | `src/lib/studentPortal.ts` | **not on device yet** |
| Parse route client | `src/lib/api.ts` `parseStudentPortal` | typechecks |
| On-device override store | `src/lib/portalAttendance.ts` | typechecks |
| State merge (academia-first) | `src/context/SessionContext.tsx` | typechecks |
| UI entry point | `src/components/ImportAttendance.tsx` | typechecks |
| Backend parse route | `backend/main.py` `POST /sp/parse` | **tested, real data** |
| Backend parsers | `backend/services/sp_attendance.py`, `sp_marks.py` | **tested, real data** |

The backend half is proven against a real capture (97.78% across 7 subjects).
The WebView bridge is written against `@capgo/inappbrowser`'s documented API but
**must be run in an actual iOS/Android build to confirm** — that is the one part
this machine cannot exercise.

## Build it

```bash
cd frontend

# 1. Point the shell at your live site (already defaulted to https://skipp.life)
#    in capacitor.config.ts. It loads the deployed app, so there is no static
#    export step and one deployment serves both web and native.

# 2. Add the platforms (creates ios/ and android/ native projects).
npx cap add ios
npx cap add android

# 3. Sync the config + plugins into the native projects.
npx cap sync

# 4. Open and run.
npx cap open ios       # Xcode: pick a device/simulator, Run
npx cap open android   # Android Studio: Run
```

## What to check on device (the unverified part)

1. On the attendance screen, when academia is gated, the **"Import from student
   portal"** button appears (it is hidden on plain web).
2. Tapping it opens the real portal login in a WebView. Sign in for real.
3. After sign-in, the WebView should self-close and attendance should appear,
   tagged "From the student portal · <date range>".
4. If it does not capture: the likely culprit is the message bridge. Watch the
   `messageFromWebview` listener in `src/lib/studentPortal.ts` and confirm
   `window.mobileApp.postMessage` is defined inside the portal WebView. The
   plugin injects it; if a Content-Security-Policy on the portal blocks the
   injected fetch, that is the thing to debug first.

## Notes

- `NEXT_PUBLIC_API_URL` must be set in the deployed build so `parseStudentPortal`
  reaches the backend `/sp/parse` route.
- The import can never run on a timer or on foreground: it needs a human at the
  login. It is a deliberate button, only.
- iOS: the portal login runs in `SFSafariViewController`/`WKWebView` depending
  on plugin mode; `@capgo/inappbrowser`'s `openWebView` uses a controllable
  WKWebView, which is what makes `executeScript` + `postMessage` possible.
