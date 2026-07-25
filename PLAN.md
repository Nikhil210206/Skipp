# Skipp, Build Plan

> Companion to [CLAUDE.md](CLAUDE.md). Tracks phased progress. Check items off as we go.
> Guiding principle: the project's viability was "can we reliably log into the Zoho portal and
> fetch HTML?" That is de-risked (Phase 1 done); everything since is product work.

**Status (2026-07-25): Phases 0 to 5 built and verified live against the real portal.**
The app is feature complete for v1 and running locally. What is left is deployment and
true push notifications. See CLAUDE.md §11 for the detailed reverse-engineering notes.

---

## Phase 0, Scaffold, done
- [x] `frontend/`: Next.js (TS, Tailwind, App Router). Actually **Next 16 + React 19 + Tailwind v4**
      (create-next-app@latest gave newer than the 14 in CLAUDE.md §2).
- [x] Framer Motion installed. `@ducanh2912/next-pwa` was dropped: we hand-wrote `public/sw.js`
      instead (Phase 5), which is simpler and avoids a Next 16 compat gamble.
- [x] Skipp colour tokens in Tailwind v4 (`@theme` in `globals.css`). Final palette is
      **black + orange**, not the violet originally sketched in CLAUDE.md §7.5.
- [x] Login screen shell at `/` (animated form + disclaimer).
- [x] `backend/`: FastAPI app + `/health` + `requirements.txt` (pins relaxed for Python 3.14 wheels).
- **Exit met:** login shell renders, `/health` returns OK.

## Phase 1, Scraper spike, done (this was the make-or-break)
- [x] Mapped the login flow: **Zoho IAM**, embedded via iframe, `uriPrefix = /accounts/p/40-10002227248`.
- [x] `core/client.py` + `core/session.py`: full login with typed errors.
- [x] Password step verified with a real account (201, code `SI303`, returns `passwordauth.redirect_uri`).
- [x] Post-login announcement interstitial handled (`/preannouncement/block-sessions` then `.../next`).
- [x] **App-session handoff solved.** The blocker was signing in with no service context. Passing
      `serviceurl=<url-encoded redirectFromLogin>` on the signin GET makes IAM redirect back into
      the app and mint `_iamadt_client_<zaid>`. `JSESSIONID` alone is necessary but not sufficient.
- [x] Creator pages fetch 200 with `X-Requested-With: XMLHttpRequest` + a `Referer` header, and
      raise typed `PageInaccessible` / `PageNotFound` / `AppSessionError`.
- **Exit met:** logged-in session + real page HTML parsed. Fallback (manual entry) not needed.

### Login flow (reverse-engineered, verified live)
Zoho IAM inside an iframe (`{BASE}/accounts/p/40-10002227248/signin`).
- **CSRF:** double-submit. The `iamcsr` cookie value is echoed in header `X-ZCSRF-TOKEN: iamcsrcoo=<v>`.
- **Password encryption is OFF** (`encryption/script` ships `encryptData.enabled = false`), so
  plaintext over HTTPS, no RSA step.
- **Identifier is the full email** `<netid>@srmist.edu.in`. A bare netid gives "User does not exists".
1. `GET {prefix}/signin?...&serviceurl=<encoded redirectFromLogin>` sets `iamcsr`, `stk`.
2. `POST {prefix}/signin/v2/lookup/{urlencoded email}` gives `{lookup:{identifier:<zuid>, digest}}`.
3. `POST {prefix}/signin/v2/primary/{zuid}/password?digest=...` gives 201 / `SI303` + a redirect URI.
4. Follow the interstitial to `.../next`, which 302s to `redirectFromLogin` and mints the app cookies.

## Phase 2, Parse and serve attendance, done
- [x] `services/attendance.py`: BeautifulSoup to `Attendance` JSON. The code cell arrives as
      `21CSC302JRegular` (code + regn type), so `_course_code()` regex-extracts the clean code.
- [x] `POST /attendance` route (password in memory only, never logged).
- [x] Frontend: login, backend, attendance cards with rings.
- **Exit met:** real attendance on screen from real credentials (verified 2026-07-23).

## Phase 3, Predictor and on-device crypto, done
- [x] Bunk predictor per subject and overall (formulas in CLAUDE.md §6), colour-coded.
      `lib/predictor.ts` mirrors `services/predictor.py`, with EPS guards for float ceil/floor.
- [x] Progress rings + Framer Motion enter animations.
- [x] AES-GCM non-exportable key (IndexedDB) + ciphertext (localStorage), so no password retyping.
- [x] Beyond the original scope: the full-screen **PREDICT** leave planner
      (`components/PredictModal.tsx` + `lib/leavePredictor.ts`), which projects attendance across
      selected dates and reports the recovery classes needed.

## Phase 4, Marks and timetable, done
- [x] Marks parser + page. `My_Attendance` holds both tables, so `PAGE_MARKS = PAGE_ATTENDANCE`.
      The marks table has no title column, so `/refresh` enriches titles from the timetable by code.
- [x] Timetable parser + today view, built on SRM's **day order** system (1 to 5, rotating,
      holidays do not advance it) by fusing three Creator pages. See CLAUDE.md §11.
- [x] Calendar page (month grid, day-order superscripts, holidays).
- [~] Marks target calculator: built, then **removed on request** (2026-07-25) as not needed.

## Phase 5, PWA and polish, done apart from ship
- [x] `app/manifest.ts`, real PNG icons, hand-written `public/sw.js` (network-first, offline),
      registered in production only.
- [x] Offline caching of the last fetch, via the encrypted on-device snapshot.
- [x] Installable on localhost/HTTPS. A phone needs HTTPS (tunnel or deploy).
- [ ] **Deploy backend (Render) + frontend (Vercel), then test on real phones.**
- [ ] **True push notifications.** Today's `lib/alerts.ts` is an in-app feed only; real push
      needs a server and a push service, so it is a post-deploy job.

---

## Sign-in budget (the constraint that shapes the architecture)
Zoho enforces a daily sign-in cap (`SI503`), a concurrent-session limit, and a CAPTCHA
(`IN108`) after rapid logins. Mitigations, all shipped:
- `POST /refresh` logs in **once** and returns timetable + attendance + marks together.
- The snapshot is cached **encrypted** on-device, so reloads cost zero sign-ins.
- A background refresh only runs when the cache is older than 15 minutes.
- `Session.close()` logs out server-side so sessions do not pile up.
Never auto-retry a failed login in a loop.

## Cross-cutting (from day one)
- **Security (non-negotiable):** no server-side storage of credentials or scraped data; no logging
  secrets (log cookie *names* only); HTTPS only; in-app "not affiliated with SRM" disclaimer.
- **Ethics:** only a user's own data; cache and rate-limit; don't hammer the portal. Read ratio'd
  (AGPL) for architecture only, write our own code.
- **Conventions:** TS strict; mobile-first at 390px; pydantic models per response; typed errors.
- **UI copy and icons:** no emoji, no em dashes. Icons are inline SVG from `components/Icons.tsx`.

## Open questions
1. ~~Exact Zoho login sequence~~ resolved in Phase 1.
2. ~~HTML structure of attendance/marks/timetable~~ resolved; all three parse live.
3. Portal rate-limit and concurrent-login behaviour is partly mapped (see above). The exact
   daily sign-in ceiling is still unknown; we stay well under it by caching.
4. Page names, batch and academic year are hard-coded in `client.py`. They should eventually be
   discovered from the portal menu, since batch and AY vary per student and term.
5. Attendance threshold assumed **75%** unless told otherwise.
