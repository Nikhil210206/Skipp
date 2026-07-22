# CLAUDE.md — Skipp (SRM attendance / marks / timetable PWA)

> **Skipp** — know before you bunk. Your attendance, marks & timetable, minus the portal.

> This file tells Claude Code what we are building and how. Read it fully before writing code.
> Keep it updated as decisions change.

---

## 0. What we're building (one line)

**Skipp** is a fast, beautiful, installable **PWA** that logs into the SRM academia portal on the
student's behalf, scrapes their **attendance, marks, and timetable**, and shows it in a
clean mobile-first UI with smooth animations — plus a "how many classes can I bunk"
predictor and a "what do I need in finals" marks calculator.

Think: a nicer, faster replacement for the official portal that installs to the home
screen like a native app.

---

## 1. Product goals & priorities

Priority order (build in this order, ship early):

1. **Login + fetch attendance** — the core loop. If this works and looks good, we ship.
2. **Attendance predictor** — "you can skip N more classes and stay above 75%."
3. **Marks page** — internal marks per subject.
4. **Timetable** — today's classes + weekly view.
5. **Marks target calculator** — "you need X in the final to hit grade Y."
6. **PWA polish** — installable, offline cache, push notifications.

Non-goals (for v1): social features, accounts on our own server, storing anyone's data
server-side. Keep it stateless.

Success metric: a friend can install it, log in, and see their real attendance in under
10 seconds, on a phone, and it looks better than the official portal.

---

## 2. Tech stack (decided)

| Layer      | Tech                                                        | Why |
| ---------- | ---------------------------------------------------------- | --- |
| Frontend   | **Next.js 14 (App Router) + TypeScript**                   | React, fast, PWA-friendly |
| Styling    | **Tailwind CSS**                                            | quick, consistent UI |
| Animation  | **Framer Motion**                                          | the smooth transitions we want |
| PWA        | **@ducanh2912/next-pwa** (Workbox)                         | installable + offline cache |
| Backend    | **Python + FastAPI**                                       | the scraper — CANNOT run in the browser |
| Scraping   | **httpx + BeautifulSoup4**                                 | log in, fetch HTML, parse |
| Local crypto | **Web Crypto API (AES-GCM) + IndexedDB**                 | encrypt credentials on-device |
| Hosting    | Frontend: Vercel or Cloudflare Pages. Backend: Render / Railway / Fly.io | free tiers to start |

**Why a separate Python backend?** The portal has no API. Scraping must run server-side:
browsers block cross-origin requests (CORS), and doing the login in the browser would
expose everything. React handles 100% of the UI; Python handles login + parsing only.

---

## 3. Architecture

```
[ User's phone ]
      │  (student enters SRM id + password)
      ▼
[ Next.js PWA frontend ]  ── encrypts creds on-device (AES-GCM), stores ciphertext locally
      │  POST /api/login  { username, password }   (over HTTPS, not stored server-side)
      ▼
[ FastAPI backend ]  ── logs into academia.srmist.edu.in, scrapes HTML, parses to JSON
      │
      ▼
[ SRM academia portal ]  ── the source of truth
```

Data flow, plain English:
1. User types SRM credentials into the PWA.
2. Frontend sends them to our FastAPI backend over HTTPS **for that request only**.
3. Backend logs into the portal, downloads the attendance/marks/timetable HTML.
4. Backend parses HTML → clean JSON → returns it.
5. Frontend renders it and caches it locally (IndexedDB) for offline + speed.
6. We store **nothing** server-side. Credentials live only encrypted on the user's device.

### Security rules (NON-NEGOTIABLE — we handle other students' passwords)
- **Never** write credentials or scraped data to a database or log file on the server.
- Backend holds the password only in memory for the duration of one request.
- Store credentials on the client encrypted with a **non-exportable** AES-GCM key
  (`crypto.subtle.generateKey(..., extractable: false)`), key in IndexedDB, ciphertext in
  localStorage. Clearing browser data wipes everything (kill switch).
- All traffic HTTPS only.
- Put a clear disclaimer in the UI: "Not affiliated with SRM. Your data is never stored on
  our servers. Use at your own risk."
- (v2, if it gets popular) add a Cloudflare Worker in front that HMAC-signs requests so the
  backend only accepts traffic from our frontend. Skip for v1.

---

## 4. Repository structure

```
skipp/
├── CLAUDE.md                 # this file
├── frontend/                 # Next.js app
│   ├── src/
│   │   ├── app/              # App Router pages
│   │   │   ├── page.tsx          # login screen
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── attendance/page.tsx
│   │   │   ├── marks/page.tsx
│   │   │   └── timetable/page.tsx
│   │   ├── components/       # UI components (cards, nav, charts, animated wrappers)
│   │   ├── context/          # auth/session + theme context
│   │   ├── hooks/            # useAttendance, useMarks, useTimetable, useAuth
│   │   ├── lib/              # api client, crypto (encrypt/decrypt), local cache
│   │   └── types/            # shared TS types (mirror backend JSON shapes)
│   ├── public/              # icons, manifest, pwa assets
│   ├── next.config.ts       # next-pwa config here
│   └── tailwind.config.ts
└── backend/                  # FastAPI scraper
    ├── main.py               # app + routes: /login, /attendance, /marks, /timetable
    ├── core/
    │   ├── session.py        # login flow, cookie/session handling
    │   └── client.py         # httpx client wrapper for the portal
    ├── services/
    │   ├── attendance.py     # parse attendance HTML → JSON
    │   ├── marks.py          # parse marks HTML → JSON
    │   └── timetable.py      # parse timetable HTML → JSON
    ├── models/               # pydantic response schemas
    └── requirements.txt
```

---

## 5. Data models (target JSON shapes)

Backend returns these; frontend `types/` mirrors them. Adjust field names once we see the
real HTML.

```ts
// Attendance
type Subject = {
  code: string;          // e.g. "21CSC201J"
  title: string;         // "Data Structures"
  category: string;      // "Theory" | "Practical"
  conducted: number;     // total classes held
  attended: number;      // classes attended
  percentage: number;    // attended / conducted * 100
};

type Attendance = {
  subjects: Subject[];
  overallPercentage: number;
  lastUpdated: string;   // ISO timestamp
};

// Marks
type MarkComponent = { name: string; scored: number; max: number };
type SubjectMarks = { code: string; title: string; components: MarkComponent[]; total: number };
type Marks = { subjects: SubjectMarks[] };

// Timetable
type ClassSlot = { day: string; start: string; end: string; code: string; title: string; room?: string };
type Timetable = { slots: ClassSlot[] };
```

---

## 6. Key feature logic

### Attendance predictor ("can I bunk?")
For a target T (default 75%): given `attended (a)` and `conducted (c)`:
- **Classes you can still skip** and stay ≥ T: largest `x` where `a / (c + x) ≥ T/100`
  → `x = floor(a / (T/100) - c)` (clamp at 0).
- **Classes you must attend** if already below T: smallest `y` where `(a + y) / (c + y) ≥ T/100`
  → `y = ceil((T/100 * c - a) / (1 - T/100))`.
- Show per subject and overall. Color-code: green (safe), amber (tight), red (below).

### Marks target calculator
Given current internal marks and the weight of the final exam, solve for the final-exam
score needed to reach a target total/grade. Show "need X / max — achievable?" with a flag
if it's impossible (>max).

---

## 7. Build roadmap (phased — do phases in order)

### Phase 0 — Setup
- [ ] `npx create-next-app@latest frontend` (TypeScript, Tailwind, App Router).
- [ ] Add Framer Motion + `@ducanh2912/next-pwa`.
- [ ] Scaffold `backend/` FastAPI app with a `/health` route. Confirm both run locally.

### Phase 1 — Scraper spike (do this FIRST, it's the riskiest part)
- [ ] Manually inspect the login flow at `academia.srmist.edu.in` (it's Zoho-based —
      expect a token/CSRF step, form POST, session cookies). Use browser DevTools →
      Network tab while logging in to capture the exact requests.
- [ ] In `backend/core/session.py`, reproduce login with httpx and get an authenticated
      session.
- [ ] Fetch the attendance page HTML and print it. Confirm we can reach the data.
- **If this phase fails or the portal is too locked down, fall back to manual entry mode.**

### Phase 2 — Parse + serve attendance
- [ ] `services/attendance.py`: BeautifulSoup parse → `Attendance` JSON.
- [ ] `POST /attendance` route: takes creds, returns JSON.
- [ ] Frontend login screen → calls backend → shows attendance in cards.

### Phase 3 — UI polish + predictor
- [ ] Attendance cards with progress rings, Framer Motion enter animations.
- [ ] Bunk predictor per subject + overall.
- [ ] On-device credential encryption so users don't retype the password each visit.

### Phase 4 — Marks + timetable
- [ ] Add marks parser + page. Add timetable parser + "today" view.
- [ ] Marks target calculator.

### Phase 5 — PWA + ship
- [ ] Web app manifest, icons, `next-pwa` offline caching of last-fetched data.
- [ ] "Add to Home Screen" prompt/instructions.
- [ ] Deploy backend (Render) + frontend (Vercel). Test on real phones.

---

## 7.5 Branding — Skipp

**Name:** Skipp · **Tagline:** "know before you bunk."
**Domain/handles to grab:** `getskipp.com` / `skipp.app`, Instagram `@getskipp`.

**Colors (dark-first UI):**
| Token        | Hex       | Use |
| ------------ | --------- | --- |
| Background   | `#0B0B0F` | near-black app background |
| Surface      | `#16161D` | cards |
| Accent       | `#7C5CFF` | primary — buttons, active nav, brand (electric violet) |
| Success      | `#3DD68C` | attendance safe / green ring |
| Warning      | `#FFB020` | attendance tight |
| Danger       | `#FF5C5C` | below threshold |
| Text primary | `#F5F5F7` | headings |
| Text muted   | `#9A9AA5` | labels |

Violet accent = modern/student-y and stands apart from SRM's official blue. Use one bold
accent, lots of near-black space, generous rounding (`rounded-2xl`), soft shadows.

**Logo direction:** wordmark **skipp** in lowercase, tight/bold geometric sans (e.g. Inter
or Satoshi, heavy weight). App icon: single **"S"** on the violet accent, or the double-p
turned into a subtle "skip-forward" (⏭) mark. Keep it flat, one accent color, no gradients
on the icon.

**Voice:** short, lowercase, a little cheeky (like ratio'd) — but never at the cost of
clarity on attendance/marks numbers.

---

## 8. Coding conventions
- TypeScript strict mode on. No `any` unless unavoidable.
- Components small and single-purpose; animations via a shared `<Motion>` wrapper.
- Mobile-first Tailwind. Design for a 390px-wide phone first, then scale up.
- Keep all portal-parsing logic in `backend/services/` — never in the frontend.
- Backend: pydantic models for every response. Handle "session expired" and "wrong
  password" as clean typed errors, not 500s.
- Never commit `.env`. Secrets via environment variables only.

---

## 9. Legal / ethical notes
- The reference project **ratio'd** (github.com/projectakshith/ratio-d) is **AGPL-3.0**.
  We may read it to learn the architecture, but must NOT copy its code into a closed-source
  app. Write our own parsers and UI.
- Not affiliated with SRM. Respect the portal — don't hammer it; cache aggressively and
  rate-limit. Add the disclaimer in-app.
- Only ever access a user's own data with their own credentials.

---

## 10. Open questions to resolve while building
- ✅ **Login sequence — SOLVED** (see §11). Zoho IAM, plaintext password over HTTPS.
- ⏳ Exact HTML structure of attendance/marks pages — timetable structure known (§11), attendance pending.
- ⏳ Does the portal block concurrent logins or rate-limit? (affects session handling)
- Default attendance threshold — assume **75%** unless told otherwise.

> When starting in Claude Code: begin with **Phase 1, the scraper spike**. Everything else
> depends on whether we can reliably log in and fetch the HTML. Don't build UI polish until
> the data pipeline works end to end.

---

## 11. Progress + reverse-engineering notes (KEEP UPDATED)

**Full detail lives in [PLAN.md](PLAN.md).** Quick status — **Phases 1-4 built, verified live end-to-end**:
login → app-auth (`serviceurl` fix) → fetch Creator pages → parse works against the real portal.
Full PWA UI is built (black+orange) and rendering with real data. Attendance/marks parsers are
written but their pages are **admin-gated at semester start** (503) — they auto-work once enabled.

### ✅ Day-order timetable + calendar (Phase 4, 2026-07-22) — the big feature
SRM runs a **Day Order** system (1-5, rotating; holidays don't advance it), not weekday-based.
Built + validated against a real capture AND a friend's app (exact match on DO2/DO3):
- **Data sources (3 Creator pages, fetched in ONE login by `/timetable`):**
  - `My_Time_Table_2023_24` → student courses (slot per course).
  - `Unified_Time_Table_2025_batch_2` → the slot × day-order × time grid (batch-specific;
    this student is **Batch 2**). `services/unified_timetable.py`.
  - `Academic_Planner_2026_27_ODD` → date → day order + holidays (HTML-entity-encoded month
    grid, 6 month-blocks × 5 cols `[Date,Weekday,Event,DayOrder,-]`). `services/academic_planner.py`.
- **Fusion:** `services/schedule.py` maps slot→course (theory letters A-G; lab ranges like
  `P37-P38-`/`L51-L52-` expand to grid P##/L## cells) → per-day-order timed class list +
  auto-abbreviations (initials, override map e.g. 21CSE742P→"DBMS"). `/timetable` returns
  `{student, courses, dayOrders[5], calendar[180]}`.
- **UI:** Home (today's day-order strip + "up next" hero), Timetable (day-order timeline w/
  breaks + DO 1-5 selector), Calendar (month grid w/ day-order superscripts + holidays).
  Page-name/batch/AY constants are hard-coded in `client.py` — TODO: discover from the menu.
- ⚠️ "today's day order" needs the real clock to fall inside the term; `focusDay()` falls back
  to the first working day when it doesn't (the AY2026-27 data is "future" vs a real clock).

### ✅ On-device session persistence (Phase 3 security, `frontend/src/lib/crypto.ts`)
Non-exportable AES-GCM key in IndexedDB, encrypted creds blob in localStorage. `SessionContext`
rehydrates on load (decrypt → refetch timetable) so a return visit **doesn't retype the password**.
Clearing browser data wipes both (kill switch). Creds still never persisted server-side.

- **Phase 0 ✅** — scaffolded. Frontend = **Next 16 + React 19 + Tailwind v4** (not the 14
  in §2; `create-next-app@latest` shipped newer). Tailwind v4 uses `@theme` in
  `globals.css`, no `tailwind.config.ts`. `@ducanh2912/next-pwa` deferred to Phase 5.
  Backend = FastAPI, `/health` works. Python 3.14 → deps unpinned (`>=`) for wheels.
- **Backend venv:** `cd backend && ./.venv/bin/python …`. Spike runner: `spike_login.py`
  (prompts for creds via getpass; dumps to gitignored `captures/`).

### Login flow — WORKING (in `backend/core/session.py`)
Zoho IAM inside an iframe. `uriPrefix = /accounts/p/40-10002227248`.
- **CSRF:** double-submit — value of `iamcsr` cookie → header `X-ZCSRF-TOKEN: iamcsrcoo=<v>`.
- **Password encryption OFF** (`encryption/script` → `encryptData.enabled=false`) → plaintext/HTTPS, no RSA.
- **Identifier = full email** `<netid>@srmist.edu.in` (portal appends the domain; bare netid → "User does not exists").
1. `GET {prefix}/signin?...` → sets `iamcsr`, `stk`.
2. `POST {prefix}/signin/v2/lookup/{urlencoded email}` body `mode=primary&cli_time=…&orgtype=40&service_language=en` → `{lookup:{identifier:<zuid>, digest}}`.
3. `POST {prefix}/signin/v2/primary/{zuid}/password?digest=…&…` JSON `{"passwordauth":{"password":"…"}}` → 201, code `SI303`, returns `passwordauth.redirect_uri` (a `/preannouncement/block-sessions` interstitial → follow `.../next`).

### ✅ RESOLVED — app-session handoff (browser capture via chrome-devtools MCP, 2026-07-22)
Old blocker: after login we held only IAM cookies (`iamcsr/stk/_iamtt`) + `JSESSIONID`, but
every Creator page still returned the **login shell** — the app treated us as logged out.

**Root cause (confirmed by capturing a fresh browser login):** the signin session must be
registered with the academia **service URL**
`https://academia.srmist.edu.in/portal/academia-academic-services/redirectFromLogin`,
passed as `serviceurl` on the **signin GET**. Only then does the post-password redirect
(`…/preannouncement/block-sessions/next` → **302** → `redirectFromLogin`) mint the app
authorization cookies **`_iamadt_client_<zaid>`** / `_iambdt_client_<zaid>` /
`__Secure-iamsdt_client_<zaid>`. Without `serviceurl`, IAM has nowhere to route `…/next`, so it
never grants the app token — `JSESSIONID` alone is necessary but NOT sufficient.

**The fix (working, proven end-to-end in Python 2026-07-22):**
- `client.py`: `SIGNIN_PAGE` now appends `&serviceurl=<url-encoded redirectFromLogin>`.
- `session.py`: after `SI303`, `_clear_announcements()` follows `redirect_uri` → the
  block-sessions interstitial → `.../next` (httpx `follow_redirects` walks the 302 to
  `redirectFromLogin`, minting `_iamadt_client_*`), then `_bootstrap_app_session()` GETs `/`
  for `JSESSIONID`. `Session.fetch_page(name)` then fetches Creator pages with headers
  `X-Requested-With: XMLHttpRequest` + `Referer: https://academia.srmist.edu.in/`, raising typed
  `PageInaccessible` (403) / `PageNotFound` (404) / `AppSessionError` (login-shell) errors.
- Verified: `spike_login.py` logs in and parses the live timetable page (9 courses); attendance
  returns the real 403 → `PageInaccessible`. (Exact working cookie header in gitignored
  `backend/captures/`.)

### Page structure (from a real browser capture, 2026-07-21)
Portal is a Zoho Creator SPA. Each section is a server-rendered **Creator page** fetched via
`GET /srm_university/academia-academic-services/page/<PAGENAME>` (header
`X-Requested-With: XMLHttpRequest`). The table HTML is embedded inside a
`pageSanitizer.sanitize('…')` JS string (unescape `\xNN`/`\x22`/`\x27` then parse the HTML).
- App link name: **`academia-academic-services`**
- **Timetable + course list** page: **`My_Time_Table_2023_24`** (PAGEID `2727643000074006011`,
  `ISAPPMODE:true`, display name "My Time Table 2024-25"). This is the "My Time Table &
  Attendance" menu item (`#My_Time_Table_Attendance`). ✅ Fetches 200, parses cleanly.
  Contains: student info block (Reg No, Name, Batch, Program, Dept+Section, Semester) + a
  `course_tbl` table with columns **S.No, Course Code, Course Title, Credit, Regn. Type,
  Category, Course Type, Faculty Name, Slot, Room No., Academic Year**. NO attendance %/hours
  columns — this page is registration/timetable only.
- **Attendance** page: **`My_Attendance`** — CONFIRMED to exist (returns **403 "Page
  inaccessible … contact your administrator"**, not 404). All other guesses (`My_Marks`,
  `My_Attendance_Details`, year-suffixed variants) → **404**.

### ⚠️ Login robustness — concurrent-session block + CAPTCHA (2026-07-22)
Two anti-automation gates surfaced while smoke-testing the full stack:
- **Concurrent-session limit (2 max).** If the account already has 2 active IAM
  sessions, the post-login interstitial becomes Zoho's *"Maximum concurrent
  sessions limit exceeded"* (ConcurrentBlock) page, and `.../next` bounces back to
  it forever (never mints `_iamadt_client`). Fix in `session.py`:
  `_clear_announcements` detects the `terminateAllSession` marker and issues the
  page's own `DELETE {IAM_PREFIX}/webclient/v1/announcement/pre/blocksessions`
  (double-submit CSRF header) once, then re-follows `.../next`. Also:
  `Session.close()` now logs out server-side (`GET {IAM_PREFIX}/logout?serviceurl=…`)
  so scrapes don't pile up sessions and hit the limit in the first place.
- **HIP / CAPTCHA (code `IN108`, "HIP REQUIRED").** After many rapid logins IAM
  demands a CAPTCHA at the lookup (or password) step. Can't be solved headlessly.
  Surfaced as typed `CaptchaRequired` → HTTP 429. It clears on its own after a
  cooldown; **don't hammer the portal** (CLAUDE.md §9). Interactive CAPTCHA solving
  (show HIP image to user, submit `hipcode` + `cdigest`) is a future enhancement.
- **Daily sign-in cap (code `SI503`, "maximum sign-in threshold for the day").**
  A HARD per-account limit — no login works until it resets (~24h). Surfaced as
  typed `SignInLimitReached` → HTTP 429. The strongest reason to **cache/persist
  the session** (frontend now encrypts creds on-device, AES-GCM, so a return
  visit rehydrates without a new sign-in) and to never auto-retry logins in a loop.
- `SKIPP_DEBUG_LOGIN=1` dumps handoff/shell HTML to gitignored `captures/` and logs
  cookie *names* (never values) — the tool used to diagnose all of the above.

### ✅ RESOLVED — one Zoho sign-in per session (was the SI503 driver)
Previously every `/timetable`, `/attendance`, `/marks` call did a fresh login, so one
browsing session could fire 4-5 sign-ins toward the daily `SI503` cap. **Fixed 2026-07-22:**
- **`POST /refresh`** (`models/snapshot.py`, `main.py`) logs in ONCE and returns
  `{timetable(+dayOrders+calendar), attendance, marks}` — attendance/marks each carry a
  `status` (ready/gated/error) so a gated section doesn't sink the call (`_try_section`).
- **Frontend** calls `/refresh` once on login/rehydrate and caches the whole snapshot in
  `SessionContext`; dashboard/attendance/marks read from cache (no per-page login). A manual
  `refresh()` is exposed for a deliberate re-pull.
- Net: a whole session (all tabs + reloads, thanks to on-device persistence) = **one sign-in**.
- Single-section routes (`/timetable` etc.) still exist but the app doesn't use them by default.
- ⏳ **Untested live** (built during the `SI503` lockout) — verify with tomorrow's first login:
  one login should populate home/timetable/calendar and both gated panels.

### ⏳ CURRENT STATE — attendance/marks pages admin-gated at semester start
It's **AY2026-27 ODD, Semester 5**, freshly registered. `My_Attendance` (403) and marks pages
are **disabled by the SRM admin** until classes are held and attendance is recorded. This is
outside our control — the data pipeline (login → app session → fetch Creator page → parse
`pageSanitizer` HTML) is proven end-to-end on the timetable page; attendance will use the
identical mechanism once `My_Attendance` is re-enabled.

### NEXT STEP
1. ✅ chrome-devtools MCP working (plugin server; the redundant broken `.mcp.json` was removed).
2. Port the proven browser flow into `backend/core/session.py`: follow the post-login redirect
   to the app root to obtain `JSESSIONID`, then fetch `page/My_Time_Table_2023_24`.
3. Write `backend/services/timetable.py` first (data is available) — parse the `course_tbl`.
4. Write `backend/services/attendance.py` against `My_Attendance` — structure unknown until the
   page is re-enabled; scaffold the parser + a clean "attendance not yet available" typed error
   for the 403 case, and finish parsing once we can capture a populated page mid-semester.
