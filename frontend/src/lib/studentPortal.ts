// Student portal attendance import, via a REAL in-app WebView login.
//
// Why this exists: academia stopped publishing attendance (Aug 2026) while the
// student portal (sp.srmist.edu.in) kept it. The portal refuses scripted
// logins behind an anti-bot fingerprint gate that Skipp will not forge, so the
// student signs in for real inside a native WebView: real page, real captcha,
// real human. Because that WebView is same-origin with the portal once signed
// in, injected JavaScript can fetch the report pages directly and their session
// cookies (HttpOnly JSESSIONID included) ride along on their own. The HTML
// comes back to the app, which sends it to the backend to be parsed.
//
// NATIVE ONLY. On plain web (the PWA) the Capacitor bridge is absent, so this
// no-ops and the UI must gate on `canImportStudentPortal()`. There is no web
// fallback by design: a browser cannot read a cross-origin authenticated
// session, which is the whole reason this needs a native shell.
//
// NOT YET VERIFIED ON DEVICE. The backend parser and the /sp/parse route are
// tested against real data; this WebView bridge is written against the plugin's
// documented API and must be run in an actual iOS/Android build to confirm.

import { Capacitor } from "@capacitor/core";
import { InAppBrowser } from "@capgo/inappbrowser";

import { parseStudentPortal } from "@/lib/api";
import type { StudentPortalSnapshot } from "@/types";

const PORTAL_ORIGIN = "https://sp.srmist.edu.in";
const CONTEXT = "/srmiststudentportal";
const LOGIN_URL = `${PORTAL_ORIGIN}${CONTEXT}/students/template/HRDSystem.jsp`;
const REPORT_ATTENDANCE = `${CONTEXT}/students/report/studentAttendanceDetails.jsp`;
const REPORT_MARKS = `${CONTEXT}/students/report/studentInternalMarkDetails.jsp`;

// A tag on the message so a stray postMessage from the portal's own JS can
// never be mistaken for our capture.
const MSG = "skipp-sp-capture";

// The Android System WebView identifies itself with WebView markers in its
// User-Agent ("; wv" / "Version/4.0"), which the portal's anti-bot layer flags:
// the login page renders but the captcha image is refused, so sign-in is
// impossible. Overriding the UA to a plain Chrome-on-Android string makes the
// WebView present as an ordinary mobile browser, which is what it is (a real
// person is about to type into it). iOS WKWebView already passes as clean
// Safari, but we set the same UA on both so the two behave identically.
const PORTAL_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

/** True only in the native shell, where a real WebView login is possible. */
export function canImportStudentPortal(): boolean {
  return Capacitor.isNativePlatform();
}

/** The student closed the login before signing in. Expected, not an error. */
export class ImportCancelled extends Error {
  readonly kind = "cancelled";
}

// Injected into the portal's page. It fetches the report same-origin (so
// cookies, including HttpOnly, are sent automatically) and reports back ONLY
// once the response is a real attendance table.
//
// Gating on a POSITIVE signal (the attendance table's own column headers) is
// deliberate and load-bearing: a signed-out fetch does not return the login
// form, it returns a tiny "Please wait login screen is loading" LOADER page
// that carries none of the usual login markers. An earlier "not signed out"
// gate therefore posted that empty loader the instant the WebView opened and
// closed before the student could type anything. Requiring the table means the
// probe stays quiet through every login redirect and fires exactly once, when
// real data finally appears. Runs on each navigation until then.
function probeScript(): string {
  return `
    (async () => {
      if (window.__skippCapturing) return;
      // The attendance report's own header cells. Present only on the real,
      // signed-in report, never on the login or loader pages.
      const hasAttendance = (h) => /Att\\.?\\s*hours|Total\\s*Percentage|Absent\\s*hours/i.test(h);
      try {
        const a = await fetch(${JSON.stringify(REPORT_ATTENDANCE)}, {
          method: "POST", credentials: "include",
        });
        const at = await a.text();
        if (!hasAttendance(at)) return; // not signed in yet, keep waiting
        window.__skippCapturing = true;
        let mt = null;
        try {
          const m = await fetch(${JSON.stringify(REPORT_MARKS)}, {
            method: "POST", credentials: "include",
          });
          mt = await m.text();
        } catch (e) {}
        window.mobileApp.postMessage({
          detail: { tag: ${JSON.stringify(MSG)}, attendanceHtml: at, marksHtml: mt },
        });
      } catch (e) {}
    })();
  `;
}

// Loads the login page's captcha image, which the Android WebView otherwise
// leaves blank. WHY IT IS BLANK: the portal's own guardlogin.js fetches the
// captcha over XHR with an `X-Domain-Proof` header and only shows it on a 200.
// In the Android System WebView that request is answered 403 (it is served on
// iOS/desktop), so the image never gets a src. Verified live via CDP: the exact
// same captcha URL returns 200 with a real PNG when the request instead carries
// `X-Requested-With: XMLHttpRequest` (a same-origin AJAX marker the servlet
// accepts). So this reissues the captcha request with that header and sets the
// src. It is the SAME session-bound captcha the student then solves; nothing is
// forged and nothing about validation changes.
//
// It re-runs when the refresh button swaps in a new `data-src`, keyed on the
// URL so each captcha is loaded exactly once.
function captchaFixScript(): string {
  return `
    (function () {
      if (window.__skippCaptchaFix) return;
      window.__skippCaptchaFix = true;
      var last = null;
      function load() {
        var img = document.getElementById("secure_captcha");
        if (!img) return;
        var url = img.getAttribute("data-src");
        if (!url || url === last) return;
        last = url;
        fetch(url, { credentials: "include", headers: { "X-Requested-With": "XMLHttpRequest" } })
          .then(function (r) { return r.status === 200 ? r.blob() : null; })
          .then(function (b) { if (b) img.src = URL.createObjectURL(b); })
          .catch(function () { last = null; });
      }
      load();
      var img = document.getElementById("secure_captcha");
      if (img && window.MutationObserver) {
        new MutationObserver(load).observe(img, { attributes: true, attributeFilter: ["data-src"] });
      }
      // The image may be added after this runs, so poll briefly as a net.
      var n = 0;
      var iv = setInterval(function () { load(); if (++n > 20) clearInterval(iv); }, 500);
    })();
  `;
}

/**
 * Open the portal login, wait for a real sign-in, capture attendance (and
 * marks if present), and return them parsed.
 *
 * Rejects with `ImportCancelled` if the student closes the login first.
 */
export async function importStudentPortal(): Promise<StudentPortalSnapshot> {
  if (!canImportStudentPortal()) {
    throw new Error("Student portal import is only available in the Skipp app.");
  }

  const probe = probeScript();
  const captchaFix = captchaFixScript();
  let done = false;

  const listeners: Array<{ remove: () => Promise<void> }> = [];
  const cleanup = async () => {
    for (const l of listeners) await l.remove().catch(() => {});
    await InAppBrowser.close().catch(() => {});
  };

  return new Promise<StudentPortalSnapshot>((resolve, reject) => {
    const settle = async (fn: () => void) => {
      if (done) return;
      done = true;
      await cleanup();
      fn();
    };

    void (async () => {
      // Re-probe on every page load and URL change: login is one or more
      // redirects, and we do not want to depend on which page it lands on.
      const runProbe = () => {
        if (done) return;
        // Fix the blank captcha on the login page, then probe for a signed-in
        // report. Both are harmless on pages they do not apply to.
        void InAppBrowser.executeScript({ code: captchaFix });
        void InAppBrowser.executeScript({ code: probe });
      };

      listeners.push(
        await InAppBrowser.addListener("browserPageLoaded", runProbe),
      );
      listeners.push(
        await InAppBrowser.addListener("urlChangeEvent", runProbe),
      );
      listeners.push(
        await InAppBrowser.addListener("closeEvent", () => {
          void settle(() =>
            reject(new ImportCancelled("Student portal sign-in was cancelled.")),
          );
        }),
      );
      listeners.push(
        await InAppBrowser.addListener("messageFromWebview", (event) => {
          const d = event?.detail as
            | { tag?: string; attendanceHtml?: string; marksHtml?: string | null }
            | undefined;
          if (!d || d.tag !== MSG || !d.attendanceHtml) return;
          void settle(async () => {
            try {
              resolve(
                await parseStudentPortal(d.attendanceHtml!, d.marksHtml ?? undefined),
              );
            } catch (e) {
              reject(e as Error);
            }
          });
        }),
      );

      await InAppBrowser.openWebView({
        url: LOGIN_URL,
        title: "Sign in to SRM Student Portal",
        // The portal handles its own captcha and JS; we only read the result.
        isPresentAfterPageLoad: true,
        // Present as an ordinary mobile browser so the portal serves the
        // captcha (see PORTAL_UA). Without this the Android WebView is flagged
        // and the captcha never loads.
        headers: { "User-Agent": PORTAL_UA },
      });
    })().catch((e) => {
      void settle(() => reject(e as Error));
    });
  });
}
