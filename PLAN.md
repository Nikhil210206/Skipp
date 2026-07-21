# Skipp — Build Plan

> Companion to [CLAUDE.md](CLAUDE.md). Tracks phased progress. Check items off as we go.
> Guiding principle: the project's viability = "can we reliably log into the Zoho portal and
> fetch HTML?" De-risk that (Phase 1) before investing in UI polish.

---

## Phase 0 — Scaffold ✅ done
- [x] `frontend/`: Next.js (TS, Tailwind, App Router) — **Next 16 + React 19 + Tailwind v4** (create-next-app@latest gave newer than the 14 in CLAUDE.md)
- [x] Add Framer Motion (installed). `@ducanh2912/next-pwa` **deferred to Phase 5** — needs Next 16 compat check; real PWA work is Phase 5 anyway.
- [x] Wire Skipp color tokens into Tailwind v4 (`@theme` in `globals.css`: accent `#7C5CFF`, bg `#0B0B0F`, etc.)
- [x] Login screen shell at `/` (animated form + disclaimer)
- [x] `backend/`: FastAPI app + `/health` route + `requirements.txt` (pins relaxed for Python 3.14 wheels)
- [x] Confirmed both run: frontend `npm run build` passes; backend `/health` → `{"status":"ok"}`
- **Exit:** ✅ login shell renders; `/health` returns OK. Commit next.

## Phase 1 — Scraper spike ⚠️ make-or-break — *in progress*
- [x] Environment CAN reach `academia.srmist.edu.in` directly (no HAR needed — inspected live)
- [x] Mapped the login flow (see write-up below). It's **Zoho IAM**, embedded via iframe.
- [x] `core/client.py` + `core/session.py`: full login implemented with typed errors
- [x] Verified end-to-end through the **lookup** step (fake netid → clean `UserNotFound`)
- [x] **Password step works** with a real account (status 201, code `SI303` "SignIn success with pre announcement redirection", returns `passwordauth.redirect_uri`)
- [x] Handle post-login announcement interstitial (`/preannouncement/block-sessions` → `.../next`)
- [ ] ⚠️ **App-session handoff incomplete:** after login we hold only IAM cookies (`iamcsr/stk/_iamtt`), no Creator app-session cookie → every app URL returns the ~8KB SPA shell. Root cause: we sign in **without service context** (`servicename`/`serviceurl`) so IAM never redirects us back into the app to mint its session cookie.
- [ ] ⏳ **Get the real attendance request via DevTools capture** (URL + method + cookies the browser actually sends). Then either (a) replay with the right service params, or (b) reproduce the browser's app-session bootstrap.
- **Exit:** logged-in session + real attendance HTML printed.
- **Fallback:** if the app session can't be reproduced headless → manual-entry mode.

### Login flow (reverse-engineered, verified)
Portal login is a Zoho IAM flow inside an iframe (`{BASE}/accounts/p/40-10002227248/signin`).
- **CSRF:** double-submit — `iamcsr` cookie value echoed in header `X-ZCSRF-TOKEN: iamcsrcoo=<v>`.
- **Password encryption: OFF** (`encryption/script` ships `encryptData.enabled = false`) → plaintext over HTTPS, no RSA.
1. `GET {prefix}/signin?...` → sets `iamcsr` (+ `zalb_*`, `stk`, `JSESSIONID`).
2. `POST {prefix}/signin/v2/lookup/{netid}` body `mode=primary&cli_time=…&orgtype=40&service_language=en` → `{lookup:{identifier:<zuid>, digest:<d>}}` (or `U401` "User does not exists").
3. `POST {prefix}/signin/v2/primary/{zuid}/password?digest={d}&cli_time=…` JSON body `{"passwordauth":{"password":"…"}}` → auth cookies.

where `prefix = /accounts/p/40-10002227248`. **Unverified w/o real login:** exact success `status_code`s, bad-password error code, and the redirect that hands off to the academia app session.

## Phase 2 — Parse + serve attendance
- [ ] `services/attendance.py`: BeautifulSoup → `Attendance` JSON (CLAUDE.md §5)
- [ ] `POST /attendance` route (creds in → JSON out; password in memory only, never logged)
- [ ] Frontend: login → backend → attendance cards
- **Exit:** real attendance on screen from real credentials.

## Phase 3 — Predictor + on-device crypto
- [ ] Bunk predictor per subject + overall (formulas in CLAUDE.md §6), color-coded green/amber/red
- [ ] Progress rings + Framer Motion enter animations
- [ ] AES-GCM non-exportable key (IndexedDB) + ciphertext (localStorage) so users don't retype passwords

## Phase 4 — Marks + timetable
- [ ] Marks parser + page + target calculator
- [ ] Timetable parser + "today" view

## Phase 5 — PWA + ship
- [ ] Manifest, icons, offline caching of last fetch, install prompt
- [ ] Deploy backend (Render) + frontend (Vercel), test on real phones

---

## Cross-cutting (from day one)
- **Security (non-negotiable):** no server-side storage of creds/scraped data; no logging secrets; HTTPS only; in-app "not affiliated with SRM" disclaimer.
- **Ethics:** only a user's own data; cache + rate-limit; don't hammer the portal. Read ratio'd (AGPL) for architecture only — write our own code.
- **Conventions:** TS strict; mobile-first at 390px; pydantic models per response; typed errors for "wrong password" / "session expired".

## Open questions (unresolved — CLAUDE.md §10)
1. Exact Zoho login sequence → resolved at Phase 1.
2. Exact HTML structure of attendance/marks/timetable pages → drives parsers.
3. Portal rate-limit / concurrent-login behavior?
4. Attendance threshold assumed **75%** unless told otherwise.
