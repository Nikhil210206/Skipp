# CLAUDE.md: Skipp (SRM attendance / marks / timetable PWA)

> **Skipp**, know before you bunk. Your attendance, marks & timetable, minus the portal.

> This file tells Claude Code what we are building and how. Read it fully before writing code.
> Keep it updated as decisions change.

---

## 0. What we're building (one line)

**Skipp** is a fast, beautiful, installable **PWA** that logs into the SRM academia portal on the
student's behalf, scrapes their **attendance, marks, and timetable**, and shows it in a
clean mobile-first UI with smooth animations, plus a "how many classes can I bunk"
predictor and a full leave planner. (A "what do I need in finals" marks calculator was built
and then **removed on request** in 2026-07-25. Do not rebuild it unless asked.)

Think: a nicer, faster replacement for the official portal that installs to the home
screen like a native app.

---

## 1. Product goals & priorities

Priority order (build in this order, ship early):

1. **Login + fetch attendance**, the core loop. If this works and looks good, we ship.
2. **Attendance predictor**, "you can skip N more classes and stay above 75%."
3. **Marks page**, internal marks per subject.
4. **Timetable**, today's classes + weekly view.
5. **Marks target calculator**, "you need X in the final to hit grade Y."
6. **PWA polish**, installable, offline cache, push notifications.

Non-goals (for v1): social features, accounts on our own server, storing anyone's data
server-side. Keep it stateless.

Success metric: a friend can install it, log in, and see their real attendance in under
10 seconds, on a phone, and it looks better than the official portal.

---

## 2. Tech stack (decided)

| Layer      | Tech                                                        | Why |
| ---------- | ---------------------------------------------------------- | --- |
| Frontend   | **Next.js 16 (App Router) + React 19 + TypeScript**        | shipped newer than the 14 planned here |
| Styling    | **Tailwind CSS v4** (`@theme` in `globals.css`, no config file) | quick, consistent UI |
| Animation  | **GSAP** (`lib/motion.ts` only)                             | one motion layer, reduced-motion handled in one place |
| PWA        | **hand-written `public/sw.js`** (network-first)             | next-pwa was dropped, this avoids a Next 16 compat gamble |
| Backend    | **Python + FastAPI**                                       | the scraper, CANNOT run in the browser |
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

### Security rules (NON-NEGOTIABLE: we handle other students' passwords)
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

Backend returns these; frontend `types/` mirrors them. **These were the initial sketch. The
shipped shapes are richer** (subjects carry `isSafe` / `canSkip` / `mustAttend`; the timetable
carries `dayOrders` and a 180-day `calendar`). The source of truth is
`frontend/src/types/index.ts` alongside `backend/models/`, so read those, not this sketch.

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

### Marks target calculator (BUILT, THEN REMOVED)
Was `components/MarksCalculator.tsx`. Removed on request 2026-07-25; the marks page now shows a
total scored/max summary instead. Kept here only so nobody rebuilds it by accident.

### Leave planner (what replaced it, see §11)
`lib/leavePredictor.ts` projects attendance across the dates a student plans to take off. Each
selected date adds its day order's class periods as conducted-but-missed (conducted +1, attended
unchanged). Key subtlety: a course has separate Theory and Practical attendance rows sharing one
code, so projections are keyed by **code + lab-ness** (`::th` / `::lab`).

---

## 7. Build roadmap (phased, do phases in order)

> **All phases below are DONE** (verified live, 2026-07-25). Kept for context. For current
> status and what is left, see PLAN.md and §11's NEXT STEP.

### Phase 0: Setup
- [ ] `npx create-next-app@latest frontend` (TypeScript, Tailwind, App Router).
- [ ] Add Framer Motion + `@ducanh2912/next-pwa`.
- [ ] Scaffold `backend/` FastAPI app with a `/health` route. Confirm both run locally.

### Phase 1: Scraper spike (do this FIRST, it's the riskiest part)
- [ ] Manually inspect the login flow at `academia.srmist.edu.in` (it's Zoho-based, 
      expect a token/CSRF step, form POST, session cookies). Use browser DevTools →
      Network tab while logging in to capture the exact requests.
- [ ] In `backend/core/session.py`, reproduce login with httpx and get an authenticated
      session.
- [ ] Fetch the attendance page HTML and print it. Confirm we can reach the data.
- **If this phase fails or the portal is too locked down, fall back to manual entry mode.**

### Phase 2: Parse + serve attendance
- [ ] `services/attendance.py`: BeautifulSoup parse → `Attendance` JSON.
- [ ] `POST /attendance` route: takes creds, returns JSON.
- [ ] Frontend login screen → calls backend → shows attendance in cards.

### Phase 3: UI polish + predictor
- [ ] Attendance cards with progress rings, Framer Motion enter animations.
- [ ] Bunk predictor per subject + overall.
- [ ] On-device credential encryption so users don't retype the password each visit.

### Phase 4: Marks + timetable
- [ ] Add marks parser + page. Add timetable parser + "today" view.
- [ ] Marks target calculator.

### Phase 5: PWA + ship
- [ ] Web app manifest, icons, `next-pwa` offline caching of last-fetched data.
- [ ] "Add to Home Screen" prompt/instructions.
- [ ] Deploy backend (Render) + frontend (Vercel). Test on real phones.

---

## 7.5 Branding: Skipp

**Name:** Skipp · **Tagline:** "know before you bunk."
**Domain/handles to grab:** `getskipp.com` / `skipp.app`, Instagram `@getskipp`.

**Colors (SHIPPED, after the 2026-07-26 redesign).** Tokens live in
`frontend/src/app/globals.css` under `@theme`. Surfaces are an ink ramp, text has
exactly three levels, and the accent is used for **one action per screen**.

| Token | Dark | Light | Use |
| ----- | ---- | ----- | --- |
| `ink-0` | `#08080a` | `#ffffff` | page |
| `ink-1` | `#0e0e11` | `#f6f6f7` | cards |
| `ink-2` | `#16161a` | `#efeff1` | inputs, secondary buttons |
| `ink-3` | `#1f1f25` | `#e5e5e9` | pressed / selected fills |
| `line` / `line-soft` | `#24242b` / `#17171c` | `#e3e3e7` / `#eeeef0` | hairlines |
| `text-1/2/3` | `#f4f4f6` / `#9d9da7` / `#6b6b75` | `#0c0c0f` / `#5d5d67` / `#8b8b95` | heading / body / meta |
| `accent` | `#f2661c` | `#d2530b` | the one action |
| `safe` `watch` `risk` | `#4fa97b` `#cf9b34` `#e2584f` | `#1f7d55` `#8a6410` `#c23b32` | states only |

**The colour rule: colour marks trouble, not health.** A safe subject gets a
neutral grey meter and the word "Safe"; only borderline and at-risk subjects get
colour. A screen full of healthy subjects is quiet, so the one problem is
impossible to miss. Never colour something just because you can.

Orange accent is warm and student-y, and stands apart from SRM's official blue. Use one bold
accent, lots of near-black space, generous rounding (`rounded-2xl`), soft shadows.

**Logo direction:** wordmark **skipp** in lowercase, tight/bold geometric sans (e.g. Inter
or Satoshi, heavy weight). App icon: single **"S"** on the orange accent. Flat, one accent
colour, no gradients on the icon.

**Voice:** short, lowercase, a little cheeky (like ratio'd), but never at the cost of
clarity on attendance/marks numbers. **No emoji and no dashes in UI copy** (see §8).

---

## 8. Coding conventions
- TypeScript strict mode on. No `any` unless unavoidable.
- Components small and single-purpose; animations via a shared `<Motion>` wrapper.
- Mobile-first Tailwind. Design for a 390px-wide phone first, then scale up.
- Keep all portal-parsing logic in `backend/services/`, never in the frontend.
- Backend: pydantic models for every response. Handle "session expired" and "wrong
  password" as clean typed errors, not 500s.
- Never commit `.env`. Secrets via environment variables only.
- **Two layers of primitives.** `components/ui/editorial.tsx` is for content:
  `Rule` (full-bleed hairline), `SectionHead`, `IndexRow`, `Feature` (the single
  solid block on a screen), `Amount`, `Marginalia`, `StickyAction`. Content is set
  as a page, not stacked in boxes. `components/ui/index.tsx` is for controls.
- **One focal point per screen, one accent per screen.** `Feature` appears at most
  once and defaults to paper (white on black) because **the accent is reserved for
  actions**. If a screen has a primary button, nothing else may be orange.
- **Every screen must have its own rhythm.** Home is a front page, Attendance is a
  figure plus a table, Marks is a contents page with dot leaders, Schedule is a
  time axis with numeral day-order tabs, Calendar is a full-bleed grid, Profile is
  a plain document. If two screens start to look alike, that is the bug.
- **Build screens from `components/ui/`, never from raw Tailwind.** The control primitives
  (`Card`, `Divider`, `Button`, `IconButton`, `Segmented`, `Chip`, `Meter`, `Label`,
  `Skeleton`, `StateView`, and `Sheet`/`Panel` in `ui/Overlay.tsx`) are the design
  system. If a screen needs a new look, change the primitive, not the screen.
- **Type comes from the scale**: `text-display` (the one figure per screen),
  `text-hero`, `text-title`, `text-headline`, `text-body`, `text-callout`,
  `text-label` (the only uppercase). Never set an arbitrary `text-[13px]`.
- **Every number carries `.tnum`** (tabular figures), so counters and percentages
  do not jitter as they animate.
- Touch targets are 44px minimum. Respect safe areas with
  `pb-[max(20px,env(safe-area-inset-bottom))]` and the matching top inset.
- **No emoji anywhere** (UI, comments, console output). Icons are inline SVG from
  `frontend/src/components/Icons.tsx`; add a new one there rather than reaching for a glyph.
- **No em or en dashes** in UI text, comments, docstrings or docs. Use a comma, colon,
  full stop or parentheses. (In `# noqa:` comments a comma would be read as another rule
  code, so use parentheses there.) Time ranges read "02:20 to 03:10".
- Style with theme tokens (`bg-surface`, `border-line`, `text-text-muted`), never raw
  `white/x` or `black/x` alphas, so both themes stay readable.

---

## 9. Legal / ethical notes
- The reference project **ratio'd** (github.com/projectakshith/ratio-d) is **AGPL-3.0**.
  We may read it to learn the architecture, but must NOT copy its code into a closed-source
  app. Write our own parsers and UI.
- Not affiliated with SRM. Respect the portal, don't hammer it; cache aggressively and
  rate-limit. Add the disclaimer in-app.
- Only ever access a user's own data with their own credentials.

---

## 10. Open questions to resolve while building
- DONE: **Login sequence, SOLVED** (see §11). Zoho IAM, plaintext password over HTTPS.
- DONE: **HTML structure of attendance/marks/timetable, SOLVED.** All three parse live; the
  attendance and marks tables share one page (`My_Attendance`).
- DONE: **Concurrent logins and rate limits, MAPPED** (see §11): a 2-session concurrent block,
  a CAPTCHA after rapid logins (`IN108`), and a hard daily sign-in cap (`SI503`). The exact
  daily ceiling is unknown; the encrypted snapshot cache keeps us well under it.
- TODO: Page names, batch and academic year are hard-coded in `core/client.py`. They vary per
  student and term, so they should eventually be discovered from the portal menu.
- Default attendance threshold: assume **75%** unless told otherwise.

> When starting in Claude Code now: the data pipeline is done and the UI is feature complete.
> Read §11 top to bottom, then check PLAN.md for what is left (deploy, real push). Before any
> live testing, remember the sign-in budget: prefer the cached snapshot, never retry logins
> in a loop.

---

## 11. Progress + reverse-engineering notes (KEEP UPDATED)

**Full detail lives in [PLAN.md](PLAN.md).** Quick status (2026-07-25): **Phases 0 to 5 built and
verified live end-to-end.** Login, app-auth (the `serviceurl` fix), Creator-page fetch and parsing
all work against the real portal. Attendance and marks went live on 2026-07-23 and parse correctly.
The full PWA UI is built (black + orange, plus a light theme) and rendering real data. What is left
is deployment and true push notifications.

Entries below are newest first. **When something breaks, read the relevant entry first**: most
oddities here (login shell, empty calendar, 429s, duplicated course codes) are already diagnosed.

### DONE: Creator credit (2026-07-27, latest)
The signature is set in **Space Grotesk** (`--font-signature`, loaded in
`layout.tsx`). It is deliberately the only place that face is used: a maker's
mark should not look like part of the interface. The rest of the app stays Geist.

"Crafted by Nikhil Balamurugan", in four places, all reading from one config in
`lib/creator.ts`. Fill or blank a URL there and the matching social icon appears
or disappears on its own; with no links at all the name renders as plain text
rather than a button, so the credit never offers a dead control.

- **Profile**: a sticky footer holding Sign out with the credit beneath it, so
  signing out is reachable without scrolling a long page to its end.
- **Sign-in screen**, under the disclaimer.
- **Hidden signature**: five deliberate taps on the masthead label swap it for
  the credit for four seconds. A slow series resets, so it is not hit by accident.
- Tapping the name reveals LinkedIn and Instagram marks (simplified, drawn to
  match `Icons.tsx`), staggered in with GSAP.
- **`rel` is `noopener`, never `noopener noreferrer`.** With the referrer
  stripped, LinkedIn answers with a sign-up authwall instead of the profile.
  `noopener` alone still closes the `window.opener` hole.
- The icon tray is **always mounted** and widens from `max-w-0`. Mounting it on
  open changed the line's width in a single frame, which a centred line reads as
  a jump; it now expands over 300ms.

Two fixes found while building it:
- **`StickyAction` stopped short of the tab bar**, leaving a strip for content to
  scroll through. It now anchors to `bottom: 0` with the bar's height as padding,
  so its backing runs behind the bar. This also fixed the attendance CTA.
- **`fitName` sized the profile name by viewport**, but the text is bound by the
  448px column, so it overshot past that width. It now takes the smaller of a vw
  term and a pixel cap derived from the column. The per-glyph constant is 0.6em,
  measured from this face at this weight rather than guessed.

### DONE: Timetable download as a full grid PNG (2026-07-27)
`lib/timetableImage.ts` draws the **whole timetable** to a canvas by hand and
saves it: day orders down the side, periods across the top, the way a timetable is
pinned to a wall. (A first pass exported only the day being viewed, which is not
what a timetable is.) Chosen over screenshotting the DOM (html2canvas) because it
needs no dependency, is independent of scroll position and viewport, and can be
laid out landscape instead of following the app's phone column.

- Columns come from every `hour` used by any day order, so a day with an extra
  late period still gets a column. Size is computed from the period count, so
  nothing ever clips.
- Labs are drawn in the accent; a footer note says so.
- Colours are read from the live theme tokens with `getComputedStyle`, so a light
  mode user gets a light picture.
- `await document.fonts.ready` before drawing, or the first export lands in a
  fallback face.
- Built from `attendingDayOrders`, so optional courses stay out of it.
- **Custom classes are included, drawn as a dotted blue box.** They carry a real
  time but no period number, so `placeCustom()` spans each one across every
  column its time actually overlaps (a 09:00 to 10:00 class covers P2 and P3),
  falling back to the nearest column if it sits outside the official day. Inside
  the box: the name the student typed (not the auto-abbreviation, which collapses
  "Samsung" to "S"), then the exact time and the room.
  - The blue is deliberately **not** a theme token. It exists only in the export,
    to mean "yours", because the accent already means "lab" there.
  - Boxes are drawn after the official cells so the outline sits above the grid.
  - **Column-snapped, not pixel-proportional.** Proportional edges were tried in
    principle and rejected: periods are unequal in length and a short class would
    produce a box too narrow to hold its own label. The exact time is printed
    inside instead, which is the honest answer.
- Staff ids stripped, and the student's name is title-cased, since the portal
  shouts it and a shared image should not.
- **Do not revoke the object URL straight after `a.click()`** (the first version
  did). Chrome can cancel the download before it has read the blob; it is revoked
  after 10s instead.
- The masthead gained an optional `action` slot for screen-level controls, which
  is where the download button lives.
- `target="_blank"` on the anchor as well as `download`: a browser that ignores
  `download` would otherwise navigate the app away to the image.
- Verified by intercepting `URL.createObjectURL`, rendering the blob back into the
  page and screenshotting it: 4828x2464 across 12 periods and 5 day orders.

### DONE: Grade prediction, corrected to SRM's real model (2026-07-27)
The first version of this shipped with a wrong model. Corrected after studying
the approach ratio'd takes (reading its AGPL source for the domain rules only,
per §9; no code or design was copied).

**The model, in `lib/grades.ts`:**
| Course | Internal | Exam |
| ------ | -------- | ---- |
| Theory | 60 | conducted out of **75**, scaled to 40 |
| Practical | 60 | conducted out of **40**, scaled to 40 |
| Internal-only | 100 | none, grade settles on publication |

**Two mistakes the first version made:**
1. It read `maxTotal` as the eventual internal total. It is the maximum
   **published so far**. Mid-term a subject shows 23/25, which is 23 of an
   eventual 60, not a 25 mark course. `remainingInternal = 60 - publishedMax`
   now carries that, so best-possible stays honest early in the term.
2. It quoted requirements out of the 40 mark weighting. A student sits a **75
   mark paper**; "you need 38 out of 75" is the sentence that helps, so
   requirements are scaled back up to the paper they actually write.

Also: internal-only courses are detected by `publishedMax > 60` and reported as
settled; `predictGpa` gives a credit-weighted GPA (O=10 down to C=5) over the
grades each subject is on track for, deduped by course code so a theory plus
practical pair is not counted twice.

**Honesty note in the UI:** when internals are outstanding, requirements assume
the student takes every remaining internal mark, and the caption says so.

Verified with a node script: mid-term 23/25 gives best possible 98 and needs 62
of 75 for an O; 41/60 theory needs 38 of 75 for a B+ with O out of reach; the
same marks as a practical need 20 of 40; an internal-only 88/100 settles at A+.
UI checked against a temporary fixture, which was then removed.


Requested feature. Note this supersedes the marks target calculator that was
built and then removed on 2026-07-25: it answers the same question, but from the
portal's own numbers rather than from user input.

- **`lib/grades.ts`** is pure and testable. `forecastGrade(scored, internalMax)`
  returns the projected grade, the best grade still reachable, and the marks
  needed in the final for each grade.
- **The final's weight is derived, not asked for**: SRM courses total 100, so
  `finalMax = 100 - internalMax`. A subject marked out of 60 internally leaves a
  40 mark final; one already out of 100 is fully internal, so its grade is
  settled and the UI says so instead of showing requirements.
- **Scale (confirmed with the user, do not change without asking):**
  O 91 / A+ 81 / A 71 / B+ 61 / B 56 / C 50, F below 50.
- Projection assumes the final goes as well as the internals have
  (`scored + finalMax * scored/internalMax`).
- EPS guards on the ceil, same reason as `predictor.ts`: floating point turns a
  clean 20 into 20.000000000000004.
- Verified with a node script over strong/mid/weak/zero internals, a fully
  internal lab, and a 50/50 split. 41/60 projects B+, needs 20 for B+, and O is
  correctly out of reach at 50 marks of a 40 mark final.
- UI verified against a temporary fixture (marks are unpublished this term), then
  the fixture was removed. **If marks look wrong when they land, check the
  `finalMax = 100 - internalMax` assumption first.**

### DONE: Optional courses made structural, dimmed not struck (2026-07-27)
Closing the category of bug rather than the instance.

- **`SessionContext` now exposes `attendingDayOrders`**: the day-order grid with
  optional courses already removed. **Anything that computes attendance takes
  this**; `timetable.dayOrders` is the raw grid and exists only for the schedule
  screen, which has to show optional classes so they can be unmarked.
  `attendingOnly()` lives in `lib/schedule.ts`.
- `projectAttendance` no longer accepts `optionalCodes` at all. It is handed the
  filtered grid, so there is no longer a way to call it wrongly. Home switched to
  `attendingDayOrders` too, which removed its manual `.filter(!isOptional)`.
  Two consumers previously had to remember the rule independently; now neither can
  forget it.
- **Optional classes are dimmed (30%), not struck through.** A strike reads as
  "cancelled"; these classes still happen, the student just does not attend them.
  The meta line names it ("DM · Optional · CLS824") and the spine fades with the
  block.

**The same trap caught us twice in one day:** `revealRows` writes an inline
`opacity: 1` on every `[data-row]`, which beat the `opacity-30` class when both
sat on the same element. The reveal now targets the `<li>` and the muted class
sits on the block inside it, so the two opacities multiply instead of fighting.
Rule: **never put a GSAP-animated property and a CSS class for that same property
on one element.** (The attendance masthead fade was the same mistake.)

### DONE: Leave planner, decision-led + optional courses excluded (2026-07-27)
- **Bug: optional courses were counted in the leave projection.** `classesByKey`
  walked every class on the day order and `projectAttendance` never received
  `optionalCourses`, so marking a class optional changed the timetable and the
  home strip but **not** the forecast. It now takes `optionalCodes` and skips
  those courses, since a class the student does not attend cannot be affected by
  taking the day off. `PredictModal` passes `optionalCourses` from the session.
  Verified live: with `21MAB302T` marked optional, a day-order-5 leave left it at
  3/3 while every other class on that day order moved.
- The forecast now leads with the **decision** in the same language as the
  attendance page: "Margin after this / 1 class still in hand" at poster scale,
  with the before/after percentages demoted to the supporting line, and each
  subject row hanging its margin/required figure on the right.

### DONE: Fixed the attendance masthead fade (2026-07-27)
Reported: scrolling down on Attendance faded the percentage and it never came
back. Measured: it returned to opacity **0.012**, darker than the 0.12 it fades
to, and compounded on each pass.

Cause: **two systems owned the same property.** The masthead was a `data-reveal`
target (so `revealIn` animated its opacity) *and* the `recedeOnScroll` scrub
target. The scrub captured whatever opacity the reveal had left behind as its
start value, so each re-run started from the faded value.

Fixes, all in `lib/motion.ts` and the attendance masthead:
- The masthead is **no longer a `data-reveal` target**. `recedeOnScroll` owns its
  opacity outright. **Never let two tweens write one property.**
- `recedeOnScroll` is now an explicit `fromTo` with `immediateRender: false` and
  `overwrite: "auto"`, so the start value is declared rather than captured.
- `invalidateOnRefresh: true`, because positions are first measured while the page
  is still settling.
- `start` moved from `"top top+=90"` to `"top top"`. The old start was already
  partly past at rest, so the figure sat at 83% opacity before any scrolling.
- Verified over repeated cycles: 1 at rest, 0.12 scrolled away, back to 1.

### DONE: Polish pass (2026-07-27)
Layout frozen, hierarchy kept. Refinement only. Two real bugs surfaced, both of
which had been invisible in every screenshot:

- **`gsap.quickTo(el, "scale", ...)` does not apply.** quickTo handles plain
  properties (opacity worked) but not the `scale` transform shorthand, so
  `pressable()` had been a no-op on **every button in the app** since it was
  written. Fixed in `lib/motion.ts` with `gsap.to(..., { overwrite: "auto" })`.
  **Do not reach for quickTo on transforms.**
- **A Tailwind `scale-*` class fights GSAP.** Tailwind v4 compiles it to the
  standalone `scale` property, which composes on top of GSAP's `transform` and
  cancels the animation. Rest states for animated transforms are set with
  `gsap.set()`, never in the markup.
- **`border-line-strong` did not exist**, so a batch of hover states silently did
  nothing. Added `--color-line-strong` to both themes.
- **Verification note:** the headless Chrome behind the DevTools MCP reports
  `prefers-reduced-motion: reduce`. Every screenshot in this project is therefore
  the reduced-motion path, which is good proof that the fallback works, but the
  animated path must be checked by navigating with an initScript that patches
  `window.matchMedia`, and by using the MCP's real `hover`/`click` (synthetic
  `dispatchEvent` does not trigger React handlers here).

Typography and rhythm:
- Poster scale cut roughly a quarter (`clamp(3.5rem, 22vw, 9rem)`), mega/display/
  hero all reduced, leading loosened. The big type was overpowering the
  information it introduces.
- `ProfileMark` replaces the circular avatar: a squircle with a ring held off it
  that collapses onto the tile on press.
- **Attendance rows now lead with the decision**: the actionable figure is the
  hero (`5 MARGIN`, `1 REQUIRED`) and the subject percentage drops to the meta
  line. The term-to-date percentage keeps its masthead, per the user's note that
  the total was already right.
- Day-order picker distributed across the column with a selection rule.
- Buttons: roomier horizontally, real hover/active states, `outline` variant for
  actions floating over content.

### DONE: Art direction pass, one poster object per screen (2026-07-26)
Direction from the user: stop optimising layout, start making moments. Magazine
cover, not dashboard. Every screen now carries **one colossal object, and they are
deliberately of different kinds** so no two screens read alike:

| Screen | The object |
| ------ | ---------- |
| Home | the live countdown |
| Attendance | the percentage |
| Schedule | the day-order numeral |
| Calendar | the month |
| Marks | the score, set as a stacked fraction (or the count awaiting) |
| Profile | the student's name |

- **`--text-poster`** in `globals.css` is `clamp(5rem, 30vw, 13rem)`. Sized in vw so
  the object always reaches for the page edges. **One per screen, never two.**
- **`.optical`** pulls display type left by 0.055em so its glyph edge, not its side
  bearing, aligns with the gutter. Without it a poster numeral looks indented
  against everything beneath it.
- **Filled blocks are banned.** An earlier pass used a solid orange band on Home and
  a solid paper block on Attendance; the user found both ugly. The accent is now
  **ink, never fill**: rules, text and outlines only. `Feature` was deleted, and the
  primary button uses `variant="outline"`.
- **`TrackRule`** replaced every bar-in-a-box. A hairline track, a fill to the value,
  and a tick at the threshold. On Attendance every row shares the tick position, so
  the ticks **align into a column down the page** and a subject that falls short is
  visible as a rule that stops before it. That device is the screen's identity.
- **Type is sized to content where content varies.** `fitName()` on Profile picks the
  largest size at which the longest word still fits (~0.55em per glyph). A numeral
  can be cropped for effect; a surname cut mid-word just reads as breakage.

### DONE: Home rebuilt as a countdown cover (2026-07-26)
Home is no longer a summary of the app; it is a cover for one moment. Three beats:
1. **The cover.** A live countdown is the hero, set against the day-order numeral
   blown up to 13rem and bled off the right edge (labelled "Day order", so it is
   information rather than ornament). `components/Countdown.tsx` writes both units
   straight to the DOM through refs, so a screen that ticks every second **never
   re-renders React**. It is always two stacked units (`16h` solid over `31m`
   ghosted) so the composition keeps its shape whether the wait is four days or
   four minutes. Only the leading unit animates; the trailing one just ticks.
2. **A full-bleed accent band** carrying attendance. This is the only orange on
   the screen.
3. **The rest of the day**, led by large tabular times with the course name as
   support, which gives the section a rhythm unlike any other screen's list.
- `buildCover()` picks the moment: the end of the class you are in
  ("In class, ends in"), the start of the next one, or the return after a
  holiday/weekend ("Classes resume in", with the holiday named underneath).
- `mergeRuns()` collapses consecutive periods of the same course, because a
  two-period lab is one class to a student and rendered as two rows it looked
  like a duplicate-key bug.
- **Do not compute the countdown during render.** `Date.now()` in a render body
  is rejected by the React compiler lint (`react-hooks/purity`). The first value
  is written in `useLayoutEffect`, before paint, so the hero is never blank.
- Verified in all four states (next class, in class, holiday, nothing scheduled)
  by mocking the clock. **CLS 0.00, LCP 297ms** despite the per-second updates:
  tabular figures plus the fixed two-line block mean nothing reflows.

### DONE: Editorial pass, one rhythm per screen (2026-07-26, later)
The first redesign was systematic but monotonous: six screens, one composition
(eyebrow, title, hero figure, rounded card list). Rebuilt again so each screen has
its own structure. Logic still untouched.
- **`components/ui/editorial.tsx`** added: the content layer (see §8). `.bleed` /
  `.bleed-pad` in `globals.css` let a block break the page gutter to full width.
  Careful: `bleed` + `w-full` fight each other, since `w-full` resolves against the
  padded content box and leaves a gap on the right. Use `block` without `w-full`.
- **`text-mega`** (6.5rem) added for the one focal figure per screen.
- **ScrollTrigger** is now registered in `lib/motion.ts`: `recedeOnScroll` (the
  masthead figure recedes as the page scrolls under it, once per screen) and
  `revealRows` (rows arrive once, on enter, never re-animating on scroll back).
- **Nav is icon-only.** The five words along the bottom edge repeated what each
  screen's masthead already said.
- **The shell is now a thin masthead** (section name + avatar, 56px). Screens
  compose their own opening below it, which is what makes the rhythms differ.
- Fixed while doing it: home showed the next class as the hero **and** as row 01 of
  the list below (the list now starts after the hero); `1 classes in a row`
  pluralisation; the sticky CTA sat behind the tab bar.
- Re-measured: LCP 369ms, **CLS 0.00**.

### DONE: Full redesign, design system + GSAP motion (2026-07-26)
The prototype UI was replaced wholesale. Logic (session, predictor, schedule, crypto,
alerts, parsers) was NOT touched; only presentation.
- **Design system** in `globals.css` (`@theme`): ink ramp, 3 text levels, one accent,
  semantic states, a 7-step type scale, `radius-control/card/sheet`, two shadows, and
  motion tokens. Screens compose `components/ui/` primitives; nothing is styled ad hoc.
- **GSAP replaces Framer Motion entirely** (framer-motion uninstalled). All motion goes
  through `lib/motion.ts`: `DUR`/`EASE` tokens, `useGsap` (scoped `gsap.context`, cleans
  up on unmount), `revealIn` (the standard staggered entrance, opt in with `data-reveal`),
  `countTo` (one counting figure per screen), `pressable`. **`prefersReducedMotion()` is
  checked in exactly one layer**: every helper settles to the final state instead of
  animating, and pull-to-refresh keeps working without the rubber-band.
- **`html.js` is set by `THEME_INIT_SCRIPT` before paint** so `[data-reveal]` can start
  hidden without ever hiding content from a no-JS reader. Do not remove it.
- **IA changes:** home is now hero (next class) + attendance status + agenda + only
  actionable alerts; the duplicate chip strip and quick-cards are gone. Attendance leads
  with the figure and a worded verdict. Marks shows a real empty state instead of a wall
  of `0/0`. Calendar gained a "Coming up" holiday list.
- **Deleted:** `Ring.tsx` (the green ring the brief banned), `NumBadge.tsx`,
  `StatePanel.tsx`. Replaced by `Meter`, plain type, and `StateView`.
- **Fixed while redesigning:** the profile name field kept the "there" fallback because it
  was seeded before the snapshot arrived (now reset during render); the portal's ALL-CAPS
  names and `Engineering(CS)` are tidied for display; faculty staff ids are stripped from
  the timetable.
- **Measured after:** LCP 361ms, **CLS 0.00** (was 0.04; fixed by replacing the restore
  spinner with a skeleton that matches the real layout). No target under 44px. No
  horizontal overflow at 320, 390, 768 or 1280.

### DONE: Light theme, SVG icon set, copy cleanup (2026-07-25)
- **Dark/light mode.** `data-theme` on `<html>`; `globals.css` redeclares the colour tokens under
  `html[data-theme="light"]`. `lib/themeScript.ts` holds `THEME_INIT_SCRIPT`, inlined in
  `layout.tsx` `<head>` so the saved theme applies **before paint** (no flash); it must stay free
  of React imports, since `layout.tsx` is a server component and importing a module that pulls in
  `useSyncExternalStore` there is a build error. `lib/theme.ts` (client) exposes `useTheme()` via
  `useSyncExternalStore` (server snapshot "dark") and `setTheme()`, which also rewrites the
  `theme-color` meta. Choice persists in `skipp.theme`. `<html suppressHydrationWarning>` covers
  the attribute the pre-paint script adds. The control lives in an "appearance" card on `/profile`.
- **New tokens** `line`, `line-strong`, `ring-track` replace every hard-coded `white/x` alpha,
  which would otherwise disappear on a white background.
- **No emoji.** All emoji and box-drawing glyphs are gone, replaced by inline SVG in
  `components/Icons.tsx` (bottom nav, alert feed, timetable rows, predict modal, pull-to-refresh,
  state panels, avatar fallback). `lib/alerts.ts` now carries a typed `kind` instead of an emoji
  string, and the dashboard maps kind to an icon component.
- **No dashes.** Em/en dashes removed from UI text, comments, docstrings and docs across frontend,
  backend and README. Watch out: in `# noqa: BLE001` comments a comma makes ruff read the following
  word as another rule code, so those use parentheses. Time ranges now read "02:20 to 03:10".
- Verified live in both themes on every page, plus a reload (theme persists, no console errors).

### DONE: Predict simplified, overall card de-cluttered (2026-07-25, later)
Three changes on request, all in response to "why would I predict a day that is already over":
- **Leave-only.** The **attending** and **od·ml** tabs are gone; every selected date is a leave.
  `projectAttendance` now takes `leaveDates: string[]` instead of `selections: Record<string,
  DayKind>`, and `DayKind` is deleted. If od/ml ever comes back, it is an attended+1 conducted+1
  variant, see git history.
- **Past days are not selectable.** `isOpen(date)` requires a working day AND `date >= today`, and
  the month strip only lists months from the current one onward (falling back to the full list if
  the whole term is in the past, which is what happens when the clock sits outside the term).
- **Attendance overall card** no longer shows "N classes to spare". It shows the ring plus
  `attended/conducted` and the subject count. The per-subject rows keep their big can-skip and
  required numbers, which is where that number is actionable.

### DONE: Day-order timetable + calendar (Phase 4, 2026-07-22): the big feature
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
  Page-name/batch/AY constants are hard-coded in `client.py`, TODO: discover from the menu.
- WARNING: "today's day order" needs the real clock to fall inside the term; `focusDay()` falls back
  to the first working day when it doesn't (the AY2026-27 data is "future" vs a real clock).

### DONE: PREDICT leave planner (2026-07-25): replaced the inline bunk simulator
Attendance page is clean again (overall ring + per-subject rings/lines at 75%, no threshold chips)
with a prominent orange **PREDICT** button → full-screen `components/PredictModal.tsx`:
month calendar (day-order dots, today ringed), **single day / date range** modes, total-days
+ confirm → a forecast view (overall before→after with a trend delta + per-subject after).
`lib/leavePredictor.ts` projects attendance: for each selected date → its day order → class
periods per subject → conducted+1. **Keyed by code + lab-ness**
(`::th`/`::lab`) because a course has separate Theory + Practical attendance rows sharing one code
(e.g. 21CSC302J), theory periods hit the theory row, lab periods the practical row. Verified live
(3 leave days: 95.2%→52.6%, CN 3/3→3/6=50%).
- Forecast shows **recovery classes** (the actionable bit): per subject below 75% → "attend N more to
  recover 75%" (mustAttend on the after-numbers), plus an overall "attend N more to get back to 75%".
- Modal + result both use pinned header/tabs/confirm (`shrink-0`) + a scrollable middle
  (`min-h-0 flex-1 overflow-y-auto`), the earlier no-scroll bug on short viewports.
- **Bunk planner+** (attendance page): adjustable target chips (75/80/85/90) recompute all numbers
  client-side (`lib/predictor.ts`, mirrors backend + EPS guards for float ceil/floor); per-subject
  expandable "if I skip N" simulator with projected % + safe/unsafe.
- **Marks target calculator** (`components/MarksCalculator.tsx` on marks page): enter internal
  scored/max + final max → needed final-exam score per grade (O/A+/A/B+/B/C), secured/not-reachable.
- **Installable PWA:** `app/manifest.ts` (standalone, theme #08080a, start_url /), real PNG icons in
  `public/` (192/512/maskable + apple-icon, generated via canvas), `public/sw.js` (network-first
  runtime cache, offline) registered in prod only (`components/PWARegister.tsx`), apple-web-app +
  theme-color meta in `layout.tsx`. Installable on localhost/HTTPS; phone needs HTTPS (tunnel/deploy).
- **Notifications = in-app alerts feed** (`lib/alerts.ts`, on Home): danger (below-target subjects
  "attend N to fix") → warning (on-the-line "don't bunk it") → next class → holiday → "all safe".
  True push deferred to post-deploy (needs a push service).
- Also: API base now derives from `window.location.hostname` so LAN/phone works with no env
  (`lib/api.ts`); backend CORS uses a LAN-origin regex + binds `0.0.0.0` for phone testing.

### DONE: Freshness: 15-min window + refresh-on-focus + pull-to-refresh (2026-07-25)
So a class/attendance update shows without manual action, while staying under the sign-in cap:
- `STALE_MS` lowered 3h → **15 min**. Cached data shows instantly; a background refresh runs only
  if older than 15 min.
- **Refresh-on-focus:** `SessionContext` listens for `visibilitychange`/`focus` and does a silent
  `refreshIfStale()` (guarded by a ref + the 15-min check) when the app is reopened/foregrounded.
- **Pull-to-refresh:** `components/PullToRefresh.tsx` wraps the header+content in `AppShell`
  (onRefresh = `refresh()`). Touch-drag from the very top rubber-bands the content (spring) and
  reveals an orange indicator; arrow flips ↓→↑ past the 70px threshold; release parks at 54px with
  a spinner, then snaps back. `overscroll-behavior-y: none` on body disables the browser's own P2R.
  Verified live via synthetic touch events (gesture fires `/refresh`, animation renders).

### DONE: Encrypted snapshot cache: instant, login-free reloads (2026-07-25)
The big fix for the daily sign-in cap (`SI503`/429). The last `/refresh` snapshot is now cached
**encrypted** on-device (same non-exportable AES-GCM key, `skipp.snap` in localStorage;
`crypto.ts` `saveSnapshot`/`loadSnapshot`/`clearSnapshot`). On rehydrate, `SessionContext` shows
the cached snapshot **instantly, no login, no spinner**, and only background-refreshes when it's
older than `STALE_MS` (3h). So reloads/HMR within a session cost **zero Zoho sign-ins**; a failed
background refresh silently keeps the cache. Cache is written on login/refresh/background-refresh,
cleared on logout. Profile page gained a "data · updated Xh ago · refresh" control (manual
`refresh()`). VERIFIED live: a reload fires zero `/refresh` calls, so zero Zoho sign-ins.

### DONE: Profile page (2026-07-24)
Orange avatar button (first initial) in every page header (top-right, hidden on `/profile`) → the
`/profile` page. Contains: editable **display name** (custom, on-device `skipp.name.<reg>`, overrides
the "sup!" greeting), academic summary (attendance %, course count, total credits), full student
details (name, reg no, program, dept, section, sem, batch, mobile, AY), the course list (code/title/
credit/category/faculty/slot), customization counts (custom classes, optional courses), disclaimer,
and the **log out** button (moved out of the header). `SessionContext` gained `displayName` /
`setDisplayName`. Note: `AppShell`'s `greeting` prop is now a boolean (Home), not a name string.
VERIFIED live: the page renders with real student data and the theme control now lives here too.

### DONE: Optional classes + nav reorder (2026-07-24)
Students can mark any official course **optional** (electives they don't attend): dimmed +
strikethrough + grey "optional" badge in the timetable (toggle "mark optional"/"make required"),
excluded from Home's up-next/strip and the day-overview count. Per-course (by code, so all its
periods dim). Stored on-device (`skipp.optional.<reg>` in localStorage), managed in `SessionContext`
(`optionalCourses`/`toggleOptional`); `daySchedule()` takes `optionalCodes` and sets
`ScheduleItem.isOptional`. Bottom nav reordered to **marks · attnd · home · time · cal** (Home centered).

### DONE: Custom classes (user-added, on-device only, 2026-07-23)
Users can add extra classes the portal doesn't list (makeup/extra classes) to any day order.
Frontend-only, the backend stores nothing. `CustomClass` persisted in localStorage keyed by
reg number (`lib/customClasses.ts`), managed in `SessionContext` (`addCustomClass`/`removeCustomClass`).
`lib/schedule.ts` `daySchedule()` merges official `ClassPeriod`s + custom into a sorted
`ScheduleItem[]` (shared display type; official + custom both map to it). Timetable page has a
"+ custom class" bottom sheet (`components/CustomClassSheet.tsx`, day order + name + start/end +
room); custom rows show an amber "custom" badge + remove button; they also flow into the Home
strip/up-next. Typechecks + builds; **not yet clicked live** (built during SI503 lockout).

### DONE: On-device session persistence (Phase 3 security, `frontend/src/lib/crypto.ts`)
Non-exportable AES-GCM key in IndexedDB, encrypted creds blob in localStorage. `SessionContext`
rehydrates on load (decrypt → refetch timetable) so a return visit **doesn't retype the password**.
Clearing browser data wipes both (kill switch). Creds still never persisted server-side.

- **Phase 0 **, scaffolded. Frontend = **Next 16 + React 19 + Tailwind v4** (not the 14
  in §2; `create-next-app@latest` shipped newer). Tailwind v4 uses `@theme` in
  `globals.css`, no `tailwind.config.ts`. `@ducanh2912/next-pwa` deferred to Phase 5.
  Backend = FastAPI, `/health` works. Python 3.14 → deps unpinned (`>=`) for wheels.
- **Backend venv:** `cd backend && ./.venv/bin/python …`. Spike runner: `spike_login.py`
  (prompts for creds via getpass; dumps to gitignored `captures/`).

### Login flow: WORKING (in `backend/core/session.py`)
Zoho IAM inside an iframe. `uriPrefix = /accounts/p/40-10002227248`.
- **CSRF:** double-submit, value of `iamcsr` cookie → header `X-ZCSRF-TOKEN: iamcsrcoo=<v>`.
- **Password encryption OFF** (`encryption/script` → `encryptData.enabled=false`) → plaintext/HTTPS, no RSA.
- **Identifier = full email** `<netid>@srmist.edu.in` (portal appends the domain; bare netid → "User does not exists").
1. `GET {prefix}/signin?...` → sets `iamcsr`, `stk`.
2. `POST {prefix}/signin/v2/lookup/{urlencoded email}` body `mode=primary&cli_time=…&orgtype=40&service_language=en` → `{lookup:{identifier:<zuid>, digest}}`.
3. `POST {prefix}/signin/v2/primary/{zuid}/password?digest=…&…` JSON `{"passwordauth":{"password":"…"}}` → 201, code `SI303`, returns `passwordauth.redirect_uri` (a `/preannouncement/block-sessions` interstitial → follow `.../next`).

### RESOLVED: app-session handoff (browser capture via chrome-devtools MCP, 2026-07-22)
Old blocker: after login we held only IAM cookies (`iamcsr/stk/_iamtt`) + `JSESSIONID`, but
every Creator page still returned the **login shell**, the app treated us as logged out.

**Root cause (confirmed by capturing a fresh browser login):** the signin session must be
registered with the academia **service URL**
`https://academia.srmist.edu.in/portal/academia-academic-services/redirectFromLogin`,
passed as `serviceurl` on the **signin GET**. Only then does the post-password redirect
(`…/preannouncement/block-sessions/next` → **302** → `redirectFromLogin`) mint the app
authorization cookies **`_iamadt_client_<zaid>`** / `_iambdt_client_<zaid>` /
`__Secure-iamsdt_client_<zaid>`. Without `serviceurl`, IAM has nowhere to route `…/next`, so it
never grants the app token, `JSESSIONID` alone is necessary but NOT sufficient.

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
  Attendance" menu item (`#My_Time_Table_Attendance`). Fetches 200, parses cleanly.
  Contains: student info block (Reg No, Name, Batch, Program, Dept+Section, Semester) + a
  `course_tbl` table with columns **S.No, Course Code, Course Title, Credit, Regn. Type,
  Category, Course Type, Faculty Name, Slot, Room No., Academic Year**. NO attendance %/hours
  columns, this page is registration/timetable only.
- **Attendance** page: **`My_Attendance`**, CONFIRMED to exist (returns **403 "Page
  inaccessible … contact your administrator"**, not 404). All other guesses (`My_Marks`,
  `My_Attendance_Details`, year-suffixed variants) → **404**.

### WARNING: Login robustness: concurrent-session block + CAPTCHA (2026-07-22)
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
  A HARD per-account limit, no login works until it resets (~24h). Surfaced as
  typed `SignInLimitReached` → HTTP 429. The strongest reason to **cache/persist
  the session** (frontend now encrypts creds on-device, AES-GCM, so a return
  visit rehydrates without a new sign-in) and to never auto-retry logins in a loop.
- `SKIPP_DEBUG_LOGIN=1` dumps handoff/shell HTML to gitignored `captures/` and logs
  cookie *names* (never values), the tool used to diagnose all of the above.

### RESOLVED: one Zoho sign-in per session (was the SI503 driver)
Previously every `/timetable`, `/attendance`, `/marks` call did a fresh login, so one
browsing session could fire 4-5 sign-ins toward the daily `SI503` cap. **Fixed 2026-07-22:**
- **`POST /refresh`** (`models/snapshot.py`, `main.py`) logs in ONCE and returns
  `{timetable(+dayOrders+calendar), attendance, marks}`, attendance/marks each carry a
  `status` (ready/gated/error) so a gated section doesn't sink the call (`_try_section`).
- **Frontend** calls `/refresh` once on login/rehydrate and caches the whole snapshot in
  `SessionContext`; dashboard/attendance/marks read from cache (no per-page login). A manual
  `refresh()` is exposed for a deliberate re-pull.
- Net: a whole session (all tabs + reloads, thanks to on-device persistence) = **one sign-in**.
- Single-section routes (`/timetable` etc.) still exist but the app doesn't use them by default.
- VERIFIED live (2026-07-23): one login populates home, timetable, calendar, attendance and marks.

### LIVE, verified end-to-end (2026-07-23): attendance and marks enabled
`My_Attendance` went live once classes started. Full app verified in-browser against real data:
- **`My_Attendance` holds BOTH tables:** an **attendance** table (`Course Code | Course Title |
  Category | Faculty | Slot | Room No | Hours Conducted | Hours Absent | Attn %`) AND a **marks**
  table (`Course Code | Course Type | Test Performance`(nested)). So marks parse the same page
  (`PAGE_MARKS = PAGE_ATTENDANCE`).
- **Fixes made against the real HTML (were blind before):**
  - Attendance code cell is `21CSC302JRegular` (code+regn-type) → `_course_code()` regex-extracts
    the clean code (`services/attendance.py`).
  - Marks table has NO title column (col 2 is Course Type) → parser sets `title=""`, and `/refresh`
    enriches titles from the timetable courses by code (`main.py`).
  - **Planner was silently empty live**: `parse_planner` needs HTML-entity-*unescaped* input, but
    the route passed raw encoded HTML → now `academic_planner.parse_planner` unescapes internally.
- **Verified live:** attendance 92.9% + bunk predictor; marks (titles correct, 0 components, no
  tests yet 2 days in); calendar (today Jul 23 = DO3, superscripts + holidays); home day-order +
  "next: Independence Day"; one-login `/refresh` caches all; session rehydrate on reload; **custom
  classes** (add → merge/sort → CUSTOM badge → remove, persisted on-device).
- `SKIPP_DEBUG_LOGIN=1` also dumps each fetched Creator page to `captures/page_<name>.html`.

### NEXT STEP
Everything in §7's roadmap is built. What remains:
1. **Deploy.** Backend to Render/Railway/Fly, frontend to Vercel. A phone needs HTTPS for the
   PWA install and for Web Crypto (on plain-http LAN, credential persistence is disabled).
2. **True push notifications.** `lib/alerts.ts` is an in-app feed only; real push needs a server
   and a push service. Post-deploy work.
3. **Discover page names, batch and academic year from the portal menu** instead of the constants
   hard-coded in `core/client.py`, so the app works for students in other batches and terms.
4. Optional: interactive CAPTCHA solving (show the HIP image, submit `hipcode` + `cdigest`).

**Local dev:** backend `cd backend && ./.venv/bin/uvicorn main:app --host 0.0.0.0 --reload`
(port 8000); frontend `cd frontend && npm run dev` (port 3000). Do **not** run `npm run build`
while the dev server is running, it corrupts `.next`; use `npx tsc --noEmit` and `npx eslint src`
to check instead. chrome-devtools MCP works via the plugin server (there is deliberately no
`.mcp.json`).
