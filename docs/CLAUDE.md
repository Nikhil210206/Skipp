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
├── docs/CLAUDE.md            # this file (root CLAUDE.md imports it)
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

### DONE: The way in is a spiral notebook (2026-08-10, latest)

The whole entry deck is one spiral bound pad now: cream stock, faint rules, a
wire down the left edge, and sheets you turn. `components/entry/Notebook.tsx` is
the shell, `entry/paper.tsx` the kit it is written with, `entry/inks.ts` the pens
and `entry/pages.ts` the page count. `Welcome`, `InstallGate` and the six
onboarding chapters are all sheets in the same pad.

**Two earlier attempts were rejected and both failures are the useful part.** A
premium orb and glass deck was built and reverted wholesale on request. Then a
first notebook was rejected in detail: "the spiral is missing, only the holes are
there", plus blank space and weak animation. **The spiral was the real one.**

**The sheet is INSET from the screen, and that is the whole trick.** The first
pad drew the paper edge to edge and put the coils on top of it, which gives a
column of punched holes and no wire: a ring needs somewhere to go BEHIND the
paper and come back, and if the paper fills the screen there is no behind. So the
desk shows down the left, the sheet starts after it, and each ring is drawn in
two halves, one tiled layer under the sheet and one over it, with the punched
hole between them. Nothing else makes it read as bound rather than as
perforated.

**The page turn animates a CLONE appended to `document.body`**, hinged on the
wire, and swaps the page at 46% while the sheet is edge on. Same reasoning as the
tab transition already recorded here: React only ever has one page mounted and
these are separate components, so a sheet animated inside the tree is torn out
mid rotation the moment its owner unmounts.

**One pen per page, and the tool is part of the writing.** `inkStyle()` gives
marker, pencil, pen and fine; pencil is a grain image knocked through
`background-clip: text`, which is why it looks drawn rather than faded. Caveat is
loaded as `--font-hand`. **Numbers never take it**: it has no tabular figures, so
the attendance figure and the page number stay in Geist.

**The enormous chapter word survived the move onto paper.** It was dropped in the
rebuild and reported missing ("those bigggg words at the bottom"), which settled
that it is the deck's identity and not decoration: it sits at the foot of every
sheet, in that page's own ink, at 4.2rem stepping to 7.5rem on a laptop.

**It is fitted by measurement, and both halves of that were wrong at first:**

- **Measure the heading's OWN content box**, never the parent's `clientWidth`,
  which includes the page margins and hands the word about 70px it does not
  have. Every word measured as fitting and none was ever shrunk.
- **Measure again after `document.fonts.ready`.** A layout effect runs while
  Caveat is still a fallback face, and the fallback is narrower, so a word that
  will overflow is judged to fit. At 320 that was four of the eight sheets.
  After both: WELCOME, ON HOME, THE LINE and YOUR LOOK come down to 56 to 62px
  and the short ones keep the full size.

**The pad was shrinking under the reader.** The install offer is conditional, so
the pad is eight sheets on a phone and seven on a laptop, and `useDeckPages()`
asked the offer's own hook. But turning past that sheet SNOOZES the offer, which
switches the hook off, so the deck ran 01, 02, then back to 02 and signed off on
07 having just been an eight page pad, losing a rung off the rail on the way. The
answer latches when the sheet actually mounts, in a module scope store, for the
usual reason: the three screens mount at different moments, so a memory held by
any one of them just captures the answer after the dismissal. **It latches on
the sheet being shown, not on the first answer**, because the first client render
is the hydration one and the server always says no.

**Two faces were missing from the welcome crowd**, and they were not missing:
the crowd is composed at 360x372 and placed in percentages, and the box was
302x532, so it stretched vertically and squeezed horizontally until neighbours
buried each other. The box carries `aspect-ratio: 360 / 372` now. Measured after:
eight faces, worst overlap 8%.

**Blank sheets, and the rule that fixed them.** THE LINE had 298px of dead paper
at its foot and the install steps had about 450. Content floats on **`my-auto`,
never `justify-center`**: a flex container treats auto margins as ZERO once free
space goes negative, so tall content top aligns and scrolls, where centring
pushes its own head under the Skip control. That is the exact trap the theme
chapter hit before, and this is the escape from it rather than a rule against
centring.

**Six colour discs cannot fit one row at 320** without going under the 44px touch
floor, so the last one was cut off the sheet edge. Wrapping fixed the clipping
and left one disc under a row of five, which reads as the overflow it is. They
are a 3x2 rack at every width: **making the two rows EQUAL is what turns a wrap
into a composition.**

Verified at 320, 390, 430 and 1280: every word fits with the hand loaded, no
sheet overflows in either direction, the numbers run 01 to 08 on a phone and 01
to 07 on a laptop with the rail matching, and the console is clean.

**A note for anyone screenshotting this deck.** The DevTools MCP serves a stale
frame on the first capture after a page changes, and the frame it serves is
missing the chapter word and sometimes the whole footer. Take a second shot
before believing anything is absent: it cost a false bug report here twice.

**Then it was opened on a real iPhone, and five things only a phone shows up.**

- **Two of the crowd arrived with no features.** Every face cut its eyes and
  mouth in the PAPER colour, which is right on a plain tile, where the head is
  drawn dark. The two accent faces have a pale head on a dark tile, so paper on
  pale was invisible. **Features are cut in whatever is behind the head**, which
  is the tile on those two: the ink at 88% over cream, written out as `#462B74`
  because the cut sits inside an already flattened fill.
- **The advance was the one object that did not belong.** A filled disc with a
  geometric chevron, in the same deep purple on all eight sheets, so it clashed
  with the teal and the green as well as reading as app furniture on a page of
  handwriting. It is **circled in the page's own pen** now, `PenArrow`, one
  stroke with unequal curves that overshoots at the join, nothing filled. The
  rail's live rung takes the page ink too.
- **The install sheet has no arrow at all.** An arrow means "the next page", and
  that sheet is not asking you to read on, it is asking you to leave and install.
  `Notebook` takes an `actionLabel`, and when a sheet names its own way on the
  round control is replaced by a written button: here, "Use in browser instead".
  Chrome's real install dialog stays in the page. **On iOS this sheet correctly
  has no button of its own**, so the named one is the only way past.
- **The doodles pointed at nothing**, which is the worst of both worlds: an
  instruction's weight with none of its content. `Arrow` takes `rotate` and
  `colour`, and each one is aimed at the control on its sheet ("Skip a class",
  the advance) in that page's ink. **A rotated box is bigger than the element**,
  so a negative offset that looked fine unrotated hung 17px into the sheet's
  `overflow-hidden` and lost its tip.
- **The sign off was set at the same size as ordinary writing** while sitting on
  the emptiest sheet, so it read as small rather than as calm. 2.5rem to 3.3rem.

One thing the fixes exposed: **`min-w-0 flex-1` on the rail**. Sized to its own
content, eight rungs plus the number and both controls measured 261px against
the 232px a 320 wide phone has, and the overflow pushed the advance 2px off the
screen. Verified after at 320, 375 and 390: nothing off screen, no control under
44px, no doodle clipped, every word still fits.

### DONE: A time field that could not be filled in on a phone (2026-08-09)

Reported as a validation error that would not go away. The error was the
symptom. **The field was impossible to complete on an iPhone.**

`TimeField` asked for `HH:MM` in one box and set `inputMode="numeric"` to raise
the digits keypad. **That keypad has no colon key**, and `toMin` accepted
nothing else, so on iOS there was no sequence of taps that produced a valid
time. The student in the screenshot was stuck at "9" because the next character
they needed did not exist on their keyboard.

This is the second swing at the same field and the first one caused this one:
the note above records the time inputs once "opened the alphabet", and the fix
was `inputMode="numeric"`, which traded the alphabet for a pad with no
punctuation. **The lesson is that `inputMode` decides which characters a phone
can produce, so it has to be chosen against the format being asked for.**

**The hour and the minute are separate boxes now**, so there is no separator to
type and no format to get wrong, and `toMin` takes two strings and parses no
punctuation at all. The AM/PM control is unchanged.

Four things the rebuild needed:

- **The error is cleared by any edit.** It was only ever set in `submit()` and
  never unset, so it sat under the form contradicting the field being fixed.
  Every field reports through one `edit()` wrapper, which is what makes that
  impossible to forget on a new field.
- **The caret advances when the hour cannot grow.** Two digits is always whole,
  and so is a single 2 to 9, since the hours run 1 to 12 and only a leading 1 or
  0 can begin a longer one. Without the second case, "2 o'clock" left the caret
  in a field it had already finished with.
- **The blur padding has to read the ELEMENT, not the prop.** The hour blurs
  itself by moving the caret on from inside its own `onChange`, before React has
  re-rendered, so the `value` in that closure is still the pre-keystroke one and
  "2" silently never settled to "02". Measured: it stayed "2" until the handler
  read `e.currentTarget.value`.
- **44px in both directions.** The inputs came out 44 wide but 22 tall. The
  height is padding pulled back out as negative margin, so the target clears the
  floor and the box keeps the 65px it had, the same trick the Schedule row uses.

Verified end to end against the real account: typed with digits only, "2" then
"20" then "3" then "10" lands a class at 02:20 to 03:10 PM between Discrete
Mathematics and Machine Learning, and the test class was removed afterwards.
Seven invalid cases (hour 13, hour 0, minute 70, empty hour, end before start,
end equal to start, no title) are each refused with their own wording and none
of them saves anything. Checked at 320 and 384 and in Brutal.

**Noticed and NOT fixed:** in Brutal a placeholder is nearly indistinguishable
from a real value, so the empty Class name field reads as though it already says
"Makeup lab". That is `placeholder:text-text-3` against Brutal's cream, it
affects every field in the app, and it wants a decision rather than a patch here.

### DONE: The entry deck's black bands, and the greeting under the numeral (2026-08-09)

Two reports from real phones, both invisible on a desktop.

**The entry deck sat inside two black bands on an iPhone.** Reported as "not in
full screen". The deck is `fixed inset-0` and paints its own field, so the
instinct is that the overlay is coming up short. It is not, and no amount of
covering the viewport would have helped: **the bands are not the viewport.**

Safari's own chrome owns the status bar and the toolbar, and tints them from
`theme-color` and from the page CANVAS. The canvas is not the overlay. It is
`body`, because `globals.css` paints `--color-ink-0` there and `html` carries no
background of its own, so the canvas stayed the app's near black while the deck
was warm brown.

`EntryChapter` had only ever set the meta. `Onboarding` had the meta AND
`documentElement`, but **not `body`, which is the one that actually supplies the
canvas here**, so it was half fixed in one place and not at all in the other.
Both now paint all three, and both hand them back on the way out. Verified: on
the welcome, meta, `html` and `body` all read `#331206`, then `#1B0B3B` on the
next chapter, and after leaving the deck both inline styles are gone, `body` is
back to `#08080a` and the meta to the theme's own bar colour.

**This does not remove Safari's toolbar**, which nothing on the page can do. It
makes every surface the page controls the chapter's colour. The genuinely full
screen version is the installed PWA, which is what the install chapter is for.

**The greeting ran across the day-order numeral.** Reported from an S24 Ultra as
the layout overlapping. The numeral is an `absolute right-0` sibling of the
content column, and the greeting had no right bound at all, so it ran underneath
and, being later in the DOM, painted on top of it.

**It was the common case, not a long-name edge case.** Measured at 384px: six of
eight ordinary first names collided, by up to 82px, including the tester's own
by 59px. It had gone unnoticed because the numeral is `text-ink-2`, nearly
invisible on Ink, so on most themes the collision reads as slightly fuzzy text
rather than as a fault.

The greeting now reserves the numeral's column, and only while the numeral is on
screen, since a holiday has no day order and the line should get its width back.
Three things the fix needed that the first pass did not have:

- **`break-words`**, or a name too long for the reserved line overflows straight
  back into the numeral. Measured: `Venkateswaran` still hit it by 19px until
  this went on. It only ever engages at about 13 characters.
- **The numeral steps down to `8rem` below 360px.** At `11rem` it is 176px tall
  and about a third of the width of a 320px column, which left so little beside
  it that `break-words` split the GREETING itself into "Afterno / on,". Shrinking
  the reserve without shrinking the numeral just moves the problem.
- The reserve steps with it (`5.25rem`, then `7.5rem` past 360px).

Verified at 320, 384 and 1280: every name from 5 to 16 characters clears the
numeral, the verb never breaks mid-word, one line on desktop and two on a phone,
and no horizontal overflow anywhere.

### DONE: The welcome crowd is alive, and the face generator was half broken (2026-08-09)

Reported as the welcome screen being dull. It was not decoration missing, it
was three things, and the third turned out to be a real bug in shipped code.

**The crowd was frozen.** Eight generated faces at fixed rotations. The face
system's signature everywhere else is that it REACTS (`ProfileMark` blinks and
ducks on press), so eight motionless copies of that drawing read as wallpaper.
**It also had no entrance of its own**: the faces carried `data-in`, so
`EntryChapter` faded all eight up on the same uniform blur wave it gives a
paragraph of text. And it was **the only screen in the deck with nothing to
touch**, where chapter three skips a class and chapter four picks a theme.

Now it gathers, breathes, blinks and answers. `Welcome.tsx` owns all of it in
one `gsap.context`, reverted on unmount.

**The structure is what keeps it safe, not remembering the rule.** Three systems
write to each face, so each gets its own element:

    [data-face]   the drift only:      x, y, rotation
      [data-pop]  entrance and press:  scale, opacity, and the resting blur

Neither carries `data-in`, so the deck's generic entrance cannot touch the
crowd. Base rotation is set with `gsap.set`, never inline.

- **The gather** springs each face from `scale 0.55` on `EASE.pop`, staggered
  `from: "center"`. Measured: the middle pair lands at 349ms and the rest follow
  in symmetric pairs at 482, 616 and 766ms, every face overshooting to 1.113 and
  settling at exactly 1 and its own resting opacity.
- **The breath** is one yoyo per face, seeded from `hashSeed(seed)` and seeked
  with `drift.totalTime(phase * period * 2)` so the crowd never pulses as one.
  Near faces travel further and slower than distant ones, which is the parallax:
  measured y travel ranges from +/-2.1px on the furthest to +/-5.5px on the
  nearest, with all eight at distinct positions at any instant.
- **The blink is a timeline, and that is load bearing.** A recursive
  `gsap.delayedCall` is created inside a later callback, which is OUTSIDE the
  context's collection window, so `ctx.revert()` would not kill it and it would
  blink detached nodes for ever after the screen unmounted, which it does the
  moment Continue is pressed. Verified: after advancing, none of the 16 watched
  elements moved across 8 seconds, longer than the slowest 6.1s gap.
- **A press restarts that same timeline rather than tweening the eyes.** A
  second tween on `scaleY` with `overwrite: "auto"` would kill the loop and that
  face would never blink again. One owner per property, the standing trap.

**The resting opacity is written inline AS WELL AS by the tween**, and that is a
net rather than a duplicate. The entrance is a `fromTo` from 0, so a context
reverted mid-flight hands the element back to whatever was inline before it:
with this that is a visible face, without it the crowd is gone for good.

**Blur is the fourth depth cue and has to stay sub-pixel.** A first pass ran to
1.5px and the distant faces stopped being faces: they are also the smallest, so
the same blur eats far more of a 54px drawing than of a 124px one. It rests on
the inner span, never animated, so it rasterises once while the parent drifts on
the compositor. **Cost, measured at 4x CPU throttle against a static control on
the same page: median 16.7ms and p95 17.6ms in BOTH runs.** The animation is
free; the rare spike is ambient and present with the crowd frozen too.

**Then the console said `rotate(undefined 12 11)`, sixteen times, and that was
not new.** `faceFor` used SIGNED shifts (`h >> 2`) on a value `hashSeed` returns
as a uint32. A signed shift converts back to int32 first, so any hash with its
top bit set came out negative, and **a negative `%` stays negative in JavaScript
and indexes off the FRONT of the list**. Measured over 2000 registration
numbers:

| | broken | fixed |
| --- | --- | --- |
| tilt `undefined` (invalid SVG attribute) | 39.5% | 0 |
| no top | 58% | 25% |
| perfectly level head | 49% | 17% |
| distinct rendered characters | 488 | 566 |

So most students were bald and half were level, when the comment on `tilt` says
in as many words that a level head looks lifeless. Every shift is `>>>` now.
**This changes the character an existing registration number draws, once**: a
fair price, since the face is generated rather than chosen, nothing about it is
stored, and the property that matters, one number to one character, is untouched.
The crowd's eight seeds were re-checked against the fixed generator and are
better than before: all four tops, all three eye types, all four mouths, eight
distinct characters out of eight.

Also: the two accent faces are the only colour, `Advance` finally fires a haptic
(the welcome and the install offer were the two dead-feeling screens in a deck
where every other control answers), and `ProfileFace` now carries `data-head`
and `data-eyes` so a caller can drive it. `SideNav`, the other consumer, drives
nothing and renders exactly as before.

**A note on verifying anything on this screen.** The headless Chrome behind the
DevTools MCP reports `prefers-reduced-motion: reduce`, so every measurement
above needed `matchMedia` patched through an `initScript`. Unlike the entrance
system on the app screens, this deck has NO CSS start state (`globals.css` hides
`[data-reveal]`, `[data-word]` and `[data-draw]`, never `[data-in]`), so the
patch alone is enough here and no CSS has to be injected.

### DONE: Desktop fills the window (2026-08-09)

Reported as a lot of blank space down both sides on a laptop, the sign in screen
included. The content column was capped (`lg:max-w-5xl` in `AppShell`,
`lg:max-w-6xl` on the entry screen), so a 1440 window put ~200px of dead page on
each side of everything.

**The caps are gone past `lg`, replaced by a gutter** (`lg:px-10 xl:px-16`, and
`lg:px-12 xl:px-20` on the entry screen). **The masthead and the restore frame
had to move with it**: the masthead carried the same cap, and if the two columns
disagree the section label stops lining up with the content under it and the
skeleton sits in a different column from the screen that replaces it, so the
page jumps on arrival.

**This deliberately reverses the reasoning recorded when the desktop layout was
first built**, which capped the column on the grounds that stretching phone
composed content reads as the page zoomed rather than as more app. That is still
true of some of it, and the request was made twice with the caps in place. If it
is ever revisited, the alternative is a real two column composition per screen,
not a narrower cap: **a stash of exactly that exists** and was rejected.

**Nothing below `lg` changed.** Every edit is behind a breakpoint prefix, and the
phone was re-measured afterwards at 390: column still full width, calendar cells
still 52px, no overflow.

Two things needed a second pass once the width was free:

- **Calendar cells became a 3:1 letterbox.** At full width each is ~150px across
  while still 52px tall. They get `lg:h-[84px]`, height only, so the phone grid
  is untouched.
- **The entry greeting was lost in the wider column** and is `7rem` past `lg`.
  Sized by MEASUREMENT, not taste: all nine scripts render stacked in one grid
  cell, so one sample gives the widest of them, and at 7rem that is 506px in a
  613px column. A first attempt read 613 against 607 and looked like an overflow;
  it was the wrapper being measured rather than the words. **Measure
  `box.children`, not every span in the header.**

### DONE: A key that overwrote itself, and the sign-out loop it caused (2026-08-08, latest)

**The saved session was being destroyed by the app itself, and the symptom was
a student signed out on launch for no visible reason.** Each recovery cost a
real portal sign-in against the `SI503` daily cap, so the bug charged the
student every time it fired.

Diagnosed by measurement, not by reading: `skipp.cred` was intact and unchanged
at 101 bytes, IndexedDB held a valid non-extractable AES-GCM key, and
`crypto.subtle.decrypt` threw `OperationError`. Blob good, key good, pair
broken, so a DIFFERENT key had been written over the right one.

**`readKey()` closed half the hole and left the other half open.** Decryption
was made read-only so a transient miss could not mint a replacement, and the
comment on it says exactly that. But `getOrCreateKey()` still mints on a miss,
and `encryptJSON` calls it, and **`saveSnapshot` runs after every successful
fetch**. So one flaky IndexedDB read while caching a snapshot generated a fresh
key, `idbPut` wrote it over the good one, and the credential blob encrypted with
the old key became permanently unreadable. Nothing looked corrupt afterwards,
which is why it read as random.

**A key is now never minted over existing ciphertext.** If a blob is present and
the key cannot be read, the honest conclusion is that the READ failed, not that
this is a first run. Refusing costs nothing: the snapshot simply is not cached
that time, and every caller already treats persistence as best effort.

**`saveCredentials` clears both blobs first**, and that is what stops the guard
becoming a trap: a fresh sign-in is the one moment where replacing the key is
legitimate, and without the clear a device whose key really was lost could never
store a session again, blocked by ciphertext it could no longer read.

Verified with **6 assertions against the real module** (jiti, stubbed IndexedDB
and localStorage, no browser): the round trip, that a forced read miss during
`saveSnapshot` leaves the login intact and the blob byte-identical, that a clean
device can still mint a key, and that an orphaned blob reads as signed out and
can be signed into again. **The same test fails on the old code**, on exactly
the one assertion, which is what proves the fix rather than the intention.

**Two notes for anyone testing this by hand.** `indexedDB.deleteDatabase()` is
asynchronous and blocks while a connection is open: firing it and moving on lands
the delete AFTER the next key is minted and orphans the blob all over again, so
await `onsuccess` and check `indexedDB.databases()`. And Node 22 exposes a
read-only `crypto` global, so a test cannot assign `globalThis.crypto` (the same
trap `navigator` already has in the notify tests); it is already webcrypto, so
just use it.

### DONE: Schedule reads live, and the calendar opens (2026-08-08, latest)

**The clock was read once during render.** `nowMinutes()` sat in the component
body, so "Now" and "Next" froze at whatever minute the screen happened to mount
on and only corrected when something unrelated re-rendered: a class could sit
marked live long after it had ended. `useNowMinutes()` (`lib/useNow.ts`) ticks
**on the minute boundary**, not every 30s, because everything derived from it is
quoted in whole minutes and a mid-minute wake-up only re-renders the tree to
paint identical text. It lives in its own file so `lib/schedule.ts` stays a
plain logic module that node test scripts can import.

**The running class is marked in place and nowhere else**: a `LIVE NOW` chip, an
accent spine, and "Ends in 30 min" counting down.

**A sticky "next class" bar and a tinted panel behind the live row were both
built and removed on request.** Do not rebuild either. The bar duplicated a row
already on screen, and the tint was a second box competing with the dotted box
that now means optional. Removing the tint also removed a theme collision it had
needed a patch for: a rounded panel drawn behind a row reads as a misaligned
second box the moment Brutal turns that row into a hard bordered card. **Any new
decoration drawn behind a row will hit that same wall.**

**The optional control is a CHECKBOX and one word.** It has now been through
three shapes, and the failure of the first two is the useful part:
- "Make optional here" was a text button naming its own OUTCOME, so the row
  never said which state it was actually in. You had to read an instruction and
  invert it.
- A switch labelled "Attending" / "Optional" was rejected as confusing, and
  fairly: a switch needs a second word to say which way is which, so it makes
  you read a label to work out what the control means. **A ticked box needs no
  opposite.** Unticked simply means not optional.

**An optional class is dimmed to 25% and its SPINE BREAKS.** No box: two were
built and both were rejected, and the reason is in section 8. A box round the
row could only ever enclose the details column, leaving the times outside it, and
filled blocks are banned outright here because content is set as a page rather
than stacked in containers. The timeline already owns a device meaning "this is
your day", so the honest way to say "you are not in this one" is to break it
rather than to draw a container beside it.

The dash needs a **border**, not a background: a 1px element filled with colour
has nothing to dash.

**25%, and only the spine makes that safe.** 30% was once reported as unreadable
and was rightly raised, but the fade was carrying the whole meaning then and had
to stay legible enough to study. Now the spine says it first, so the details are
there to confirm rather than to decode, and the type is free to go further back
than it ever could before.

**The three material themes hide `[data-spine]`**, since their cards already do
the separating, so an optional class there would read as nothing more than a
faintly faded card. `[data-optional]` marks the row and each of them dashes its
own card edge instead. Clay draws no border at all normally, so it is given one
rather than restyled. **Any device built on the spine needs this same pass.**

**A day sheet on the Calendar was built and removed on request** (it listed the
day's classes, the free gaps and a styled empty state). Tapping a date does what
it always did: writes the day out above the grid. Do not rebuild it.

**On a holiday the NAME leads and "Holiday" is the supporting line.** The
category is already obvious from the coloured square; which holiday it is, is
what you tapped to find out.

**A holiday is marked with an accent dot** in the slot where a working day
carries its day order. One slot, three states: a day order, a dot, or nothing.
A tinted square behind the whole numeral was tried as a louder alternative and
removed on request; the dot is the version that stays.

Verified against a real account: all five day orders, mid-class, before the first
class, after the last, a holiday selected and unselected, 320 and 430 wide, and
the five themes.

### DONE: Holidays are visible on Calendar (2026-08-07)

Reported as "upcoming holidays needs to be added in the calendar page". A list
was already there, at the very bottom, titled "Coming up". **The real fault was
that the grid, which is the screen, could not show a holiday at all**: a holiday
has no day order, so it rendered exactly like a Sunday. Nothing above the fold
distinguished Independence Day from the weekend beside it.

**One slot, three states.** The cell already reserves a line under the numeral
for its day-order figure, and on a day off that line was empty. A working day
shows its day order, a holiday shows a **dot**, a weekend shows nothing. The
holiday's numeral also sits at `text-2`, between a working day and a weekend,
because a holiday is not a dead square: it is the one empty day worth going
looking for. Verified the dot lands on exactly the two August holidays and not
on any Sunday, and survives Brutal, Clay and Terminal at a real 4px.

**The list under the grid is scoped to the month on screen**, because that is
the question the month rail has just been used to ask. A first pass listed the
whole term there and was rejected: the section sits directly under a month you
navigated to deliberately, so answering with December is answering a question
nobody asked. The whole term lives behind **"See all days off"**, a sheet
grouped under month headings (`components/HolidaysSheet.tsx`), chronological
rather than ranked, because it is the thing you open when booking a train and a
list sorted by anything but time is a list you have to search.

**The section never disappears, not even in a month with nothing in it.** An
empty month is exactly when a student wants to know where the next break is, so
it names the next one and how far off it is. It also means the way through to
the full term cannot vanish with the list, which is what made "hide it when
empty" the wrong answer.

**The list says how long the break is, which the grid cannot.** A holiday on a
Wednesday is a day off; the same holiday on a Friday is three. `termHolidays`
in `lib/holidays.ts` walks out to both ends of the run of dayOrder-less days
around each one, so the count comes from the calendar rather than from guessing
at weekdays, which also handles two holidays landing back to back. The sheet
leads with the two numbers worth knowing: days off left, and how many of them
are long weekends.

**A run carries its dates, and that is the useful half.** "3 days off" does not
tell you WHICH three, and a run does not have to start on the holiday: Vinayakar
Chathurthi is a Monday, so the break really begins on the Saturday before it
(`Sep 12 to 14`). The month is only repeated when the range crosses one
(`Oct 31 to Nov 2`).

**`holidayName()` also renames what the portal calls things.** It writes
"Deepavali"; students say Diwali. The map is presentation only, keyed on the
cleaned lowercased name, so the planner text stays untouched wherever it is
parsed and a spelling can never affect which dates are days off. Home and
Schedule were each stripping the " - Holiday" suffix with their own inline
regex, so they now go through the same function: one name for one day, on every
screen.

**One row component, two views.** `components/HolidayRow.tsx` is shared by the
month list and the sheet, because a row that says "4 days off" in one place and
something else in the other is how two screens start disagreeing about one term.

**The update announces itself once** (`components/WhatsNewSheet.tsx`,
`lib/whatsNew.ts`), as a sheet rather than a takeover: it is a nice addition,
not a thing standing between a student and their attendance.

**It shows THEIR next long weekend, not a screenshot.** Somebody else's term is
an advert; your own four day break is a reason to open the calendar. With no
calendar from the portal it falls back to plain description rather than
inventing one, which is a real case (attendance and marks can be gated).

**Two things about it are load bearing:**

- **A brand new student must never see it.** They have never seen a Skipp
  without holidays, so "Skipp is updated" is an interruption during their first
  run announcing a change they cannot perceive. There is no record of which
  build a device last ran, so the proxy is **whether a saved session already
  exists**, and `claimIfNewDevice()` has to run on the ENTRY screen, before the
  password is submitted. A minute later a new student has credentials too and
  the two are indistinguishable. Verified both ways: a wiped device silently
  claims the flag and stays quiet through sign in, while a device with a saved
  session gets the sheet on next launch and never again.
- **It waits ~2.1s before rising.** The launch overlay is `z-100` and a Sheet is
  `z-50`, so without the hold it slides up entirely behind the splash and is
  simply THERE when the splash lifts. `riseAt` is at module scope for the usual
  reason: **AppShell remounts on every navigation**, so a timer owned by the
  component restarts on every tab tap and can be outrun indefinitely.

**Never two overlays at once.** The install gate is a full screen takeover, so a
sheet raised behind it would be dismissed unseen and marked as read. Whichever
is not shown this launch is still waiting on the next.

Three things that only showed up against the **real captured planner**, and
would all have passed against invented data:
- **Christmas read "24 days off".** It sits three weeks past the last working
  day, so its run swallowed the whole tail of the term. A run only means
  something if you have to come back from it: `resumes` checks that a working
  day follows, and those holidays now read "after the term" instead.
- **Ayutha Pooja and Vijaya Dasami are consecutive**, so both claimed the same
  four days. Only the first holiday in a run gets to announce it (`runLead`).
- **Independence Day 2026 is a Saturday.** A holiday that falls on a weekend is
  a holiday you do not get, and saying so is more use than saying nothing.

The run walk is clamped at today for a break still to come, so one already half
spent is described by what is left of it; a break already gone is measured
whole, since there is nothing left to clamp. Past holidays keep their place in
the month list, dimmed and marked "gone", rather than being dropped: a month you
have scrolled back to should still say what happened in it.

Verified with **31 assertions against the real captured planner** (jiti, no
browser and no portal sign-in), which is the only reason the three above were
caught. Invented holidays land on convenient weekdays and never sit past the end
of term.

### DONE: The install takeover, and real notifications (2026-08-03)

**The install prompt is a full screen takeover now**, `components/InstallGate.tsx`,
replacing the dismissible sheet (`InstallPrompt.tsx` is deleted). A sheet is what
you use to ask; this asks with the whole screen, because the installed app is a
different product: no browser chrome eating a fifth of the display, an instant
start from the local copy, and **on iOS it is the only context that can receive a
notification at all**.

**Placement is the part worth keeping.** It is offered to a SIGNED OUT visitor,
ahead of the onboarding deck. On iOS an installed app gets its own storage
container, so a student who plays the deck in Safari and only then installs does
the whole thing twice and spends a second sign-in against the daily cap. Offering
first means deck and sign-in happen once, inside the real app. It is still
mounted in `AppShell` for someone already signed in through a browser, and only
that path shows the "you will sign in again" caveat.

**It still never blocks**, per the earlier entry: there is no way to observe that
somebody made a shortcut, so a wall would trap anyone whose browser cannot
install. The way past is quiet, not absent.

Two layout bugs found by measuring, both invisible in a screenshot:
- **The content ran 899px against an 844px iPhone**, putting "continue in
  browser" at y=831 and off the bottom of anything shorter. The reading half
  scrolls and **the actions are pinned**, so the escape is reachable at any
  height. Verified on a 667px iPhone SE: link fully on screen, hittable, 44px.
- **The signature rule measured `height: 0`.** It is a flex child in a column
  that overflows, and a 1px box with no content has nothing to hold it open, so
  flex shrank it away while its accent tick still floated in mid air. It needs
  `shrink-0`. **Any hairline inside an overflowing flex column needs this.**

**Notifications are local, raised by the app itself** (`lib/notify.ts`,
`components/NotifyOnOpen.tsx`). No server, no push subscription, no stored
schedule. The app asks for permission once, then raises a notification when it
NOTICES something: a class within `CLASS_LEAD_MIN` (30) on open or foreground,
and what the portal recorded, from `installSnapshot`, the single door fresh data
enters by.

**A full Web Push scheduler was built and then removed on request** (backend
`core/push.py`, `/push/*` routes, an Upstash store, a per minute cron, VAPID).
Do not rebuild it without being asked. It worked and was tested, but it is a
real database of other students' class times, and the version people actually
want, attendance announced the INSTANT it changes, is worse still: it needs a
server polling the portal with every student's password, spending 24 to 48
sign-ins each per day against a hard cap (`SI503`) and a CAPTCHA (`IN108`). That
does not trade privacy for a feature, it locks students out of their own portal.

**So these arrive when Skipp is opened, not while it is closed**, and the
Profile copy says exactly that. The web cannot schedule a notification for later
on device: Notification Triggers never shipped and Safari never had it. What
this does buy is a notification that persists in the tray after a glance.

Three traps, all found by testing rather than by reading:
- **`navigator.serviceWorker.ready` never settles when no worker is
  registered.** It waits for one to activate, so it neither resolves nor
  rejects and a `try/catch` cannot save you: `await` on it hangs for ever. In
  dev the worker is registered in production only, so this hung every time.
  Use `getRegistration()`, which resolves either way. (It has to go through the
  worker at all because **mobile browsers do not support the `new
  Notification()` constructor**.)
- **Do not mark a class "announced" before the notification actually showed.**
  The first version recorded it up front, which permanently suppressed that
  class whenever nothing was raised, the ordinary case with notifications off.
  `notifyClassSoon` returns whether it showed, and only then is it recorded.
- **Permission cannot be revoked from JavaScript**, so "off" cannot mean
  revoking it. `skipp.notify` in localStorage is the real switch, and the only
  honest one: it stops us raising them.

Tags are per class per day, so opening the app five times in twenty minutes
updates one tray entry instead of stacking five. iOS refuses notifications
entirely until the app is installed, so the setting points at the install steps
rather than showing a dead switch.

Verified with **24 assertions against the real module** (jiti, stubbed
`navigator`/`localStorage`/`Notification`, no browser and no portal sign-in):
the window boundaries, the exact copy, the tags, silence while off, the
attendance wording, and that a missing service worker returns false rather than
hanging. Note Node 22 ships a read-only `navigator`, which has to be redefined
with `Object.defineProperty` to stub.

### DONE: The sign-in budget, defended in code (2026-07-30, latest)
**A CAPTCHA (`IN108`) was earned during UI work on this project, and it was the
tooling that earned it.** `apiBase()` resolves to `localhost:8000` in dev, a
local backend was up, and `SessionContext` background-refreshes on **every**
rehydrate whose cache is stale. Repeatedly reloading a signed-in dev page to
look at a logo is therefore repeatedly signing in to the real portal, silently,
with no spinner to give it away. **Reloading the authed app is not free.** Stop
the backend, or point `NEXT_PUBLIC_API_URL` at a dead host, before UI work.

That prompted four fixes, all in `SessionContext.tsx` unless noted:

1. **`STALE_MS` 15 min to 1 hour.** Faculty mark attendance a handful of times a
   day. A tighter window spends sign-ins fetching data that has not changed.
2. **`MANUAL_MIN_MS` (5 min) under pull to refresh.** `refresh()` had no guard at
   all, so ten pulls was ten real sign-ins. Worst case is now 12 an hour from a
   determined puller instead of unbounded.
3. **`COOLDOWN_MS` (30 min) after a refusal.** Every path swallowed rate limits
   with a bare `catch {}`, so a CAPTCHA'd student kept knocking on every launch
   and every foreground. **The limits only clear if we stop knocking**, so this
   is what separates a short cooldown from a lost day. `cooldownUntil` is at
   module scope deliberately: every navigation remounts the provider, and a
   fresh mount must not forget it is meant to be standing down.
4. **A rate limit no longer signs the student out.** HTTP 429 arrives as
   `AuthError`, and the rehydrate path did `if (e instanceof AuthError)
   clearCredentials()` while its own comment claimed rate limits were exempt. So
   being rate limited wiped the saved session, the student retyped their
   password, and that spent another sign-in against the limit they had just hit.
   Now gated on `isBadCredentials()`, which is `user_not_found` or
   `wrong_password` only.

**`refresh()` now resolves with a `RefreshOutcome`** (`updated` / `fresh` /
`cooldown` / `failed`) so the UI can say what actually happened.

**The pull arms, and answers on release** (`PullToRefresh.tsx`). Past the
threshold the arrow flips and the pill takes the accent, so the trigger point is
discoverable by feel; the outcome then appears in the pill ("Up to date, checked
2 min ago") and holds 1.25s before retracting. **It must never spin as though it
fetched when it did not**, or the one control meaning "go and look" stops
meaning anything. A tick is shown only for `fresh`, since a refusal is not a
success.

- **The state styling lives on an inner pill, not on the badge**, because GSAP's
  quickSetters own the badge's `y`, `scale` and `opacity`. Same standing rule:
  never let two systems write one property.
- Verified the gate arithmetic with a node script (10 cases: the 5 min floor,
  the 1 hour window, cooldown blocking both paths, and both resuming after it).
  No portal sign-in was spent doing it.

### DONE: New mark, a mortarboard on the line (2026-07-30, latest)
**A skip button was built first and rejected**: "i dont want a skipp button as a
logo, i want something creative to do with collage, studies". It was a clever
pun (Skipp is literally a skip button) but it read as a media app, which is the
wrong shelf entirely. Do not rebuild it.

**The mark is a mortarboard sitting on a rule.** The cap says college without a
word of explanation, and the rule under it is the app's own device, the same
hairline the 75% tick sits on across every screen. So it reads as "a student,
and the line they answer to".

- **The tassel is the only accent, and it does two jobs**: it is the detail that
  makes a cap a cap, and the one vertical against all those horizontals, which
  is what stops the mark reading as a flat stack.
- **The tuft has to be clearly wider than the cord.** At equal weights the two
  merge into one plain stick and the tassel stops reading as a tassel.
- **`lib/logo.ts` is the single source of truth for the geometry**, and
  `scripts/make-icons.mjs` imports it (through `jiti`, which lets a plain node
  script read the TS) and draws the PNGs with `sharp`. The icon and the mark on
  screen cannot drift, because the paths exist once. Re-run with
  `node scripts/make-icons.mjs` from `frontend/` after any change to the shape.
- **The maskable icon is now its own file.** The manifest pointed the maskable
  purpose at the rounded tile, so a platform cropping to a circle would have
  clipped an already rounded icon twice. `icon-maskable-512.png` is full bleed
  with the mark pulled further in.
- Verified legible down to **16px** by rendering the tile at 16 / 32 / 64 / 120.

**The wordmark carries its signature on the double p**: the second one is set in
the accent and the pair is tracked tight, which turns the odd thing about the
name into a deliberate detail rather than a typo people squint at. `Wordmark` in
`components/Logo.tsx`, used on the sign in and both onboarding headers, and the
launch colours its last letter to match.

**The launch plays the mark** (`Splash.tsx`): the rule draws and waits, the cap
drops onto it, and the tassel swings from the landing, pivoted where it is tied
on. Measured on a real run: cap `y` **-26 to 0** over 32 values, rule `scaleX`
**0 to 1** over 16, tassel **-24 degrees, overshooting to +6.6, settling at 0**
over 27. Total **1.79s**.

**Three traps worth keeping:**
- **A swinging SVG child needs `svgOrigin`, not `transformOrigin`.** The pivot is
  a point on the cap, not on the tassel's own box, and `transform-box: fill-box`
  would pin it to the box. `TASSEL_PIVOT` is exported for exactly this.
- **The launch cannot be screenshotted at speed.** It is over before a tool call
  lands, and GSAP is not on `window` in a bundled app so it cannot be slowed
  from an `initScript`. Either measure it from a sampler installed as an
  `initScript`, or add a temporary `tl.timeScale()` in the file, look, and take
  it out again.
- **Scope that sampler to the launch overlay.** A first attempt queried the
  document, kept matching the sign in header's static Logo after the overlay had
  gone, and `getComputedStyle().transform` of `"none"` is truthy, so it reported
  a frozen animation that was in fact running perfectly.

### DONE: The profile mark now asks to be pressed (2026-08-02)
Reported that students were not opening the profile at all, which hides the
themes, the display name, the data controls and sign out.

**It was an identicon, and an abstract pattern in a corner reads as
decoration.** It is a little generated CHARACTER now, head and shoulders with
eyes and a mouth: a face needs no explaining, it is obviously you and it is
obviously pressable. Drawn in the **accent** on a tinted tile, so it is also the
only coloured thing in an otherwise monochrome masthead.

`faceFor()` in `lib/mark.ts` picks a top (none, tuft, sweep, cap), eyes (dots,
arcs, wide), a mouth (smile, line, open, smirk), a few degrees of tilt and a
collar, **each from a different slice of the hash**, so adjacent registration
numbers do not draw near identical faces the way sequential ids otherwise
would. 400 numbers gave 282 distinct characters, and the same number always
gives the same one.

**It blinks when you press it**: the eyes squash to 0.12 and spring back with an
overshoot to 1.18 while the head ducks. That is the reason to press it twice,
and a control people press twice is a control they find. The blink needs
`transform-box: fill-box` on the eye group, since **an SVG group scales about
the viewBox origin by default** and the eyes would fly off the face rather than
close.

Features are cut in the page colour rather than drawn in a second hue, so they
survive at 36px where a thin stroke would vanish.

**An unread dot until it has been opened once** (`useSeenProfile` in
`lib/firstRun`, same `useSyncExternalStore` pattern as the intro flag). This is
the right kind of nudge because **it answers itself**: it appears once, it goes
the first time the page is opened, and it never comes back. The server snapshot
claims "seen" so it cannot flash on for somebody who has already been.

Verified: dot present on a fresh device, gone after one visit, flag persisted,
and still gone after navigating away and back.

### DONE: The profile mark is generated (2026-07-29)
`lib/mark.ts` draws a figure from the student's **registration number**, and
`ProfileMark` renders it as SVG. Every student gets a different mark, nobody
chooses anything, and nothing is stored: the same number always draws the same
figure, so it is a pure function of data already on the device.

- **Mirrored down the middle**, identicon style, because a symmetric figure
  reads as a mark at 32px where an arbitrary one reads as noise. 15 generated
  bits reflected into a 5x5 grid, with a single lit cell in the accent so each
  mark has its point of colour in its own place.
- **Seeded by the registration number, not the display name**, so renaming
  yourself does not change your mark.
- A seed that lands nearly empty gets a second pass rather than being rejected,
  which keeps the result a pure function of the number.
- **On press the cells collapse toward the centre and spring back**, staggered
  from the middle out. Measured: 1.00 to 0.30 on the way in, overshooting to
  1.12 and settling on release.
- **`transform-box: fill-box` on every cell.** An SVG element scales about the
  viewBox origin by default, which flings the cells across the tile instead of
  shrinking them where they stand.
- Verified over 400 registration numbers: 400 distinct marks, identical output
  for a repeated seed, 5 to 21 lit cells of 25.

### DONE: A finished day says so instead of fading (2026-07-29)
Reported as "why is day order 2 faded". It was not a rendering fault: day order
2 was **today**, every class on it had ended, and `Block` dimmed a past class to
60%. Confirmed it was nothing else by measuring: all five picker numbers were
byte-identical, and no course was marked optional.

**Past-dimming is gone from Schedule.** The label carries it instead:
"Today · finished" once the last class has ended. Dimming a day you navigated to
*deliberately* hides a schedule you opened in order to read, and the screen
defaults to the upcoming day order, so switching to today was the first thing
anyone would do and it looked broken.

`Now` and `Next` stay, because those are live and useful. The only thing dimmed
in the class list now is an **optional** course, and that says something about
the class rather than about the time of day.

### DONE: Swipe between tabs (2026-07-29)
`lib/useSwipeNav.ts`, attached to the AppShell root. Swiping left or right moves
along the tab bar, and past the threshold it hands over to the **same `pageOut`
the tab bar uses**, so a swipe and a tap end in an identical movement.

- **The screen follows the finger** at 45% of its travel, dropping to 16% at the
  ends of the bar where there is nowhere to go. The commit threshold (68px) is
  then discoverable by feel rather than by guessing.
- **Both touch handlers lock to an axis** on the first real movement.
  `PullToRefresh` previously engaged on any downward drift, so a sideways swipe
  that sagged would start a pull and eat the gesture. Vertical pull verified
  still working afterwards (followed the finger 10, 26, 42, 57px).
- **An open sheet or panel owns the gesture**, and so does a second finger.
- Tab order lives in `lib/tabs.ts`, shared with `BottomNav`, so the bar and the
  gesture can never disagree about which way is left.

**The trap, for the third time:** the effect ran once while `AppShell` was still
showing its restore frame, so `shell.current` was null, and a ref in the
dependency array never changes, so it never ran again. **The gesture silently
did not exist.** It takes a `ready` flag. Identical to the blank leave planner
(`useGsap` without `open`) and worth checking on any future hook that reaches
for a conditionally rendered element.

Verified with synthetic touches: swipe left commits, a 25px swipe springs back
to 0, a vertical drag leaves the page at x 0 and does not navigate, and swipe
right reverses.

### DONE: The transition ghost, and why swiping felt heavy (2026-08-02, latest)
Reported as lag, plus a precise observation worth more than any measurement I
had taken: **"the previous page stays for some time and then fades out."**

**It did, and it was a stacking bug.** The outgoing snapshot was pinned at
`z-index: 25` while `main` was static, so the page you had just LEFT painted on
top of the page you had just asked for, hung there at 45% opacity for the whole
620ms, and vanished when it was removed. Every "depth" tween I had been tuning
was happening in front of the new screen rather than behind it.

`main` is now permanently `relative z-[2] bg-ink-0` and the snapshot sits at
`z-index: 1`. **Permanently, not per transition**: doing it inside `pageIn` left
a window between the new page mounting and the tween starting, and in those four
frames the old page showed through. Measured after: **zero frames on three
different changes where the old screen could show through**.

**The swipe drag ran `document.querySelector` and `gsap.set` on every
touchmove.** A DOM query plus a full property parse per frame, while a finger is
moving. The element is resolved once per gesture now with a `quickSetter` bound
to it, which writes straight to the element and skips the parse. At 4x CPU
throttling the drag holds **17.9ms worst, 16.7ms median, zero frames over 32**.

**Two tuning attempts that made it worse, recorded so they are not repeated:**
- **Shortening the change to 0.46s.** The theory was that a shorter transition
  gives a hitch less time to be noticed. It measured worse (10 dropped frames
  against 8): the same work compressed into fewer frames drops more of them.
- **Removing the snapshot's opacity tween** to get it off the paint path. No
  measurable difference, so the fade stayed off on the simpler grounds that an
  opaque snapshot covered by an opaque screen is what iOS does anyway.

**What is left, honestly.** At 4x throttle a change still costs one or two
dropped frames, and it is the arriving page MOUNTING and running its entrance,
not the transition. No amount of tween tuning touches that; it would need the
screens themselves to render less on arrival. At 1x there is nothing to see.

### DONE: The whole app got a spring (2026-08-02)
Reported that the transitions and the animations generally did not feel fun.
Asked rather than guessed, and the answer was everything: the slide, the way
content lands, taps, and the small stuff. Character chosen: **springy and
playful**, with the leaving screen dropping back.

**`EASE.spring` (`back.out(1.7)`) and `EASE.pop` (`back.out(3)`)** are the new
vocabulary. Overshoot and settle is the difference between an app that moves and
one that enjoys being used, and they are deliberately mild: a nudge past the
target, not a cartoon.

**The transition has depth now.** The leaver scales to 0.92, dims to 0.45 and
travels only a THIRD of the distance while the new screen comes the whole way
over it on a spring. **Two things travelling different distances is what the eye
reads as depth**, and it costs nothing extra.

**Only the snapshot scales.** Scaling the arriving screen too was built and
measured, and it cost a frame or two per change: that is LIVE content, so every
step re-rasterises real text, where the leaver is a dead snapshot that rasters
once.

**Counters must NOT spring.** `back` overshoots past its target, so an
attendance percentage would visibly tick above the real number and come back.
`countTo` keeps `expo.out` for exactly that reason.

**Presses were 0.972, which is invisible.** That is why every control felt
inert. Down is now 0.94 on a fast flat curve, and the release springs past 1 and
settles: **the overshoot on the way back is the part that reads as physical.**
Haptics fire on press too (Android only, as ever).

**The blanket entrance deferral from the day before is reverted.** Holding the
whole entrance until the slide finished fixed the jank and made every arrival
feel dead, the screen gliding in and then sitting there before anything moved.
**Only `revealRows`' ScrollTrigger creation waits now**, since that is the part
that measures the document and costs the frames, while `revealIn` lands on time.

**The cost, honestly.** At 4x CPU throttling the worst frame is 42.5ms with
about one dropped frame per change, against 28.7ms and none for the old flat
translate-only slide. That is the price of the springs and the depth, and it is
a deliberate trade rather than an oversight. If it ever reads as stutter on a
real device, the first thing to try is dropping the leaver's opacity tween,
which is the only part still touching the paint path.

### DONE: The swipe was never the slow part (2026-08-01)
Reported as laggy and buggy. **Traced rather than guessed, and the transform was
innocent.** One tab change showed **56ms of forced reflow, 51ms of it inside
GSAP's `_getComputedProperty`**: that is the ARRIVING screen building its
entrance, `revealIn` plus `revealRows` plus every ScrollTrigger measuring, on
exactly the frames the slide needs. Three dropped frames on a desktop and far
worse on a phone, which reads as a stuttering swipe.

**`useGsap` now waits for the transition before it builds anything.** `pageIn`
records when the slide will end (`transitionEndsAt`, module scope because the
two screens are different React trees) and the hook holds off until then, so the
measuring happens on a still screen.

**Check the blank risk whenever an entrance is delayed.** Reveal targets start
hidden in CSS, so deferring their animation could have left every arriving
screen empty for 620ms, which would have been worse than the jank. Measured with
the real hiding CSS injected and reduced motion forced off: first content
visible at 2ms, **zero frames with targets present and nothing visible**.

The outgoing clone also carries `contain: layout paint` now. It is a dead
snapshot, so the browser should never reflow or repaint the live page on its
account.

Measured after, at **4x CPU throttling** to stand in for a phone: worst frame
28.7ms, median 16.7ms, **zero frames over 32ms**. At 1x it is 20.8ms worst.

**What this does NOT prove.** The reflow total is trace wide, so it cannot show
whether the work moved off the animating frames, only that the same work still
happens somewhere. And the lag was never reproducible here at any throttle. If
it persists on the device, the next honest step is a frame sampler running on
the phone itself rather than another fix aimed at a symptom nobody here can see.

### DONE: Screens turn over, not cut (2026-07-29)
Moving between tabs slides the screen you are leaving off one side while the
next comes in from the other, both on one tween each with identical timing, so
the two read as a single surface turning.

**The first version could not glide, structurally.** It animated the old screen
out, *then* navigated, *then* animated the new one in. Nothing was ever moving
at the same time and the mount sat in the gap, which is what felt like stutter.
React only ever has one screen mounted, so **the other one has to be a
snapshot**: `captureOutgoing()` clones `main` into a fixed, GPU-promoted layer
pinned to its bounding rect (which already includes however far a finger has
dragged it), then navigation happens in the same frame. `pageIn()` moves the
snapshot and the arriving screen together and removes the snapshot on complete.

- **Translate only, no opacity.** Transform stays on the compositor; opacity on
  a full-page element drags it back onto the paint path.
- The clone is pinned by `getBoundingClientRect()`, so a swipe continues from
  where it was released instead of restarting from zero.
- Measured across a transition: worst frame **21ms**, median 17ms, **zero**
  frames over 32ms, and no clone left in the DOM afterwards.

### DONE: The selection travels (2026-07-29)
Tapping a tab slides the selection from the tab you left to the tab you chose,
in every theme. `data-nav-pill` in `BottomNav` is one element sized to the
active tab; each theme decides what it looks like (Brutal fills it with accent,
Clay rounds it, Terminal outlines it in phosphor, the skins get a quiet chip).
The accent dot rides the same measurement, so it is one movement rather than a
dot sliding while a fill jumps.

**It had never actually travelled**, and there were three separate reasons:

1. **`BottomNav` remounts on every navigation.** Every screen renders its own
   `AppShell`, so the fresh bar had no idea where the indicator was and always
   placed it instantly. `lastPlacement` at module scope is what gives it a
   previous position to move from.
2. **React runs mount effects twice in development.** The second run saw the
   indicator already at its destination and overwrote the running tween with a
   zero-duration set. **`gsap.isTweening()` is false in the instant after
   `gsap.to()` is scheduled**, so guarding on it did not help.
3. **The guard's scope was wrong.** Keyed on the route at module scope, it
   survived a remount and left the *new* element unplaced entirely, with no
   inline styles at all. It has to be a **ref**, fresh per mount: a real
   navigation always places, a repeat run never interrupts.

**The pill sits at `z-0` with the links at `z-10`.** At `-z-10` it rendered
behind the bar's own background and was invisible, which in Brutal meant a white
icon on a white bar with the tab apparently missing.

Measured across marks to calendar: 19 distinct positions easing 26px to 384px.

### DONE: Seven themes (2026-07-29, latest)
`lib/theme.ts` holds the registry, `globals.css` holds one block per theme, and
Profile has a swatch grid. **Ink** is the original and the default.

**Tokens alone were not enough, and the reason is the design itself.** The first
attempt swapped colour, radius, shadow and border weight and every theme still
looked like a recolour, correctly called out. The app is deliberately
surface-less: **one use of `rounded-card` and two of the shadow tokens in the
whole codebase**, because the art direction is hairlines and type. Radius and
shadow tokens had nothing to act on.

So the primitives carry markers (`data-surface` on a row, `data-band` on a
section label, `data-meter` on a TrackRule) and the two material themes restyle
those in `globals.css`. The components stay single-source; the theme supplies
the structure. **A theme in this app has to add surfaces, not restyle them,
because there are almost none to begin with.**

`--border-w` joins the radius and shadow tokens, and Tailwind's `.border`
utilities are re-pointed at it by plain rules outside `@layer` (so they win, and
the 1px default leaves the existing look untouched):

| | palette | radius | shadow | border |
| --- | --- | --- | --- | --- |
| Ink, Slate, Mono, Paper, Sand | yes | | | |
| **Brutal** | yes | 0 | hard offset | 2px |
| **Clay** | yes | 18-34px | soft, with an inner highlight | |

Brutal turns every row into a bordered block on a hard offset, section labels
into filled slabs, and the meter into a chunky bordered bar. Clay turns the same
rows into soft filled cards with pill meters and rounded label chips.

**Two things broke on Schedule once rows became cards**, both worth knowing
before adding another material theme:
- **The timeline spine ran through the card**, striking a line through the class
  times. It is the hairline layout's device; a card border already separates, so
  `[data-spine]` is hidden under both material themes.
- **Every hairline is black in Brutal**, so the five day-order tracks merged
  into one continuous rule and swallowed the selection marker, which is also
  near-black. The tracks are faded to 18% and the marker is the accent at 4px.

**Terminal is the third full look**, and it was about an hour, because the
marker vocabulary already existed. The recipe, for a fourth:
1. write the idea as tokens (colour ramp, radius, shadow, `--border-w`),
2. write the rules against the existing markers,
3. sweep the six screens for the known collisions (connecting lines inside
   cards, hairlines merging when every line is one colour, `bleed` escaping a
   card, and never touching `transform` on a button),
4. add it to `THEMES` with `structural: true`.

The only question that decides the cost is whether the idea can be *said* with
the markers. If not, add the marker first, then follow the recipe.

**Type is the biggest lever and was untouched until Terminal.** `--font-sans` is
a token and `body` reads it, so a theme changes the entire feel of the app in
one line. Geist Mono was already being shipped on every page and used nowhere,
so Terminal costs no extra bytes. Its signature is not the colour: it is
monospace, `[ SUBJECTS ]` brackets on section labels via `::before`/`::after`,
segmented meters that read as characters, and `> ` prompts on buttons.

**Fifteen skins now, one per hue** (Ink, Slate, Mono, Paper, Sand plus Rose,
Ember, Gold, Fern, Teal, Azure, Indigo, Violet, and the light Bloom and
Meadow). Eighteen themes in total with the three full looks.

**Each hue tints the whole ink ramp**, not just the accent, the way Slate
already did. A set of skins differing by one small dot would have been the same
complaint as before: colour has to reach the surfaces to be a different room.

**There is deliberately no red skin.** Red is `risk`, and a red accent makes a
subject below the line indistinguishable from the furniture. Rose leans pink so
red stays free for trouble. Where an accent still crowds a state colour, **the
state moves, never the rule**: Gold darkens `watch`, Fern turns `safe` toward
teal, Rose and Ember push `risk` clear of the accent. Checked mechanically that
no theme has `accent` equal to `risk`.

**Only the three looks are tiles on Profile.** Fifteen colours listed there took
over the page for a choice most people make once. The fourth tile opens
`components/SkinPicker.tsx`: a strip of discs you flick sideways, snapping to
centre, **applying whatever reaches the middle straight away** so the app
recolours live behind the sheet and you choose by looking at the thing rather
than at a swatch. It stays a scrolling list of real buttons rather than a rotary
dial, so a keyboard and a screen reader still work through it in order.

**Under the middle and selected are two different states**, and they part company
when a full look is on: the strip has to park somewhere, so it parks on Ink, but
ringing Ink there would claim a selection that is not in force. Prominence
follows `centred`, the ring and `aria-checked` follow the applied theme, and with
Brutal on nothing is ringed at all.

**The door is a full width row under its own "Skins, colour only" rule, not a
fourth tile.** As a tile it read as a fourth theme and hid the fact that fifteen
more colours were behind it, and it was sitting under "Full looks, rebuilds the
UI" while doing the opposite. A different shape reads as a door.

**The fan is five overlapping discs, each that theme's accent alone**, which
says "a collection" at a glance. The three tone swatch is right in a full size
tile but turns to mush sliced to the 20px a stacked disc shows. The lead disc is
your current skin and is the largest, and the sub-label names it, so the
selection stays visible on Profile; with a full look on it reads just
"15 colours". **A ring cannot mark the lead**: the lead is the current skin, so
an accent border is always exactly the colour of the fill beneath it.

**The picker is two groups**, because they are two different things: **Full
looks** (Brutal, Clay, "rebuilds the UI") above a rule, then **Skins** ("colour
only"). Saying so beats letting someone discover it by trying all seven.

**Both material themes reach every screen**, through markers on the shared
pieces rather than per-screen CSS:

| marker | Brutal | Clay |
| --- | --- | --- |
| `data-surface` (rows) | bordered block on a hard offset | soft filled card |
| `data-band` (section labels) | filled accent slab | rounded chip |
| `data-meter` (TrackRule) | chunky bordered bar | pill |
| `data-nav` | 3px slab, filled active tab | floating rounded bar |
| `data-btn` | offset shadow, presses in on `:active` | soft shadow |
| `data-day` (calendar) | a real grid of boxes | rounded cells |
| `data-spine`, `data-rule` | hidden, the card does the separating | hidden |

**Buttons change `box-shadow` on `:active`, never `transform`.** `pressable()`
already owns that element's transform, and two systems writing one property is
the standing trap in this codebase.

**Screens verified in Brutal and Clay:** Home, Attendance, Marks, Schedule,
Calendar, Profile. Anything added later needs the same pass: a theme that adds
surfaces will collide with any layout that draws its own connecting lines.

**Brutal deliberately breaks the house rules.** §8 says filled blocks are
banned and the accent is ink, never fill. Brutal is loud fill on cream with
black rules. That was the point of choosing "full separate looks": a theme
replaces the art direction rather than tinting it. Ink still obeys every rule.

**Glassmorphism was considered and rejected**, on the grounds that translucency
needs something behind it and a black app has no wallpaper to reveal, so it
degrades to grey panels. Neumorphism was rejected for contrast. Bento grid is a
layout, not a theme.

**Old preferences migrate.** `dark` becomes `ink` and `light` becomes `paper`,
in both `normalizeTheme()` and the pre-paint script; anything unrecognised falls
back to Ink. Verified by compiling the real module and running the script over
dark/light/valid/junk/null.

**The status bar colour is set before paint too.** It used to be applied only by
`setTheme()`, so a Brutal user got a flash of Ink's dark bar on every launch.

### DONE: The scroll edge (2026-07-29)
Content does not stop at the masthead, it fades out under it: one gradient to
the page colour over a now-sticky masthead, extending below the bar so the
effect ends softly rather than at a visible line. `ScrollEdge` in `AppShell`,
so every screen gets it.

**A backdrop-blur version was built and removed on request.** Do not add it
back. It also cost a `backdrop-filter` on a sticky element during scroll, which
is the sort of thing that costs frames on older phones for no functional gain.

**The effect has to live on the masthead itself, not on an overlay.** The
masthead sits inside PullToRefresh's transformed wrapper, which is its own
stacking context, so any sibling overlay raised above the scrolling content
would also cover the profile mark and stop it being tappable. Same containing
block problem as the portalled overlays, different symptom.

**Balance is the whole thing.** The ramp holds `ink-0` to 30% and thins by 70%:
opaque enough behind the bar to keep the label readable, thin enough that words
are still legible on their way out rather than snapping to black. Token based,
verified in the light theme.

### DONE: Reminders (2026-07-29)
`lib/reminders.ts` (the attendance diff plus the feed builder) and a read-only
Reminders section on Home. **`lib/alerts.ts` is deleted**: it was dead code the
audit found, and this replaces it.

**Everything here is derived. There is nothing to configure and nothing to
type.** User-written reminders were built and then removed on request, along
with the sheet that held them; the class lead time was a setting and is now the
constant `CLASS_LEAD_MIN` (30). Do not rebuild either without being asked. What
is left needs no input at all, which is why the section has no controls.

**In-app only, by necessity.** The web cannot schedule a notification for later
on device (Notification Triggers never shipped, Safari never had it). The
alternatives were a server holding push tokens and schedules, which breaks §3
and the disclaimer, or handing the job to the phone's calendar. If push is ever
revisited: iOS allows it only for an installed PWA.

Four sources, merged and sorted by tone:
1. **A class starting** within `CLASS_LEAD_MIN`.
2. **What the portal just marked.** `diffAttendance()` compares each snapshot
   against the last, keyed `code::category` because **a course has separate
   Theory and Practical rows sharing one code**. A subject with no previous
   reading is not a change, or a first sign-in would have every subject announce
   itself.
3. **Attendance standing**: below the line with the number needed, or exactly on
   it where one miss drops you.
4. **The rotation.** A holiday does not advance the day order, so "tomorrow is
   the next number" is often wrong.

**`installSnapshot()` in SessionContext is the single door fresh data enters
by**, so the diff is computed exactly once, at the moment it becomes true. The
cached-rehydrate path deliberately does not diff (same data as last time) but
**does seed the baseline**: without that, the first refresh of a session had
nothing to compare against and silently reported no change however much had been
marked.

**Trap:** `nextWorkingDay()` returns **today** when today is a working day, so
the rotation note first read "Wed, Jul 29 is day order 2" about the day you are
standing in. It needs the first calendar entry strictly after today.

Verified by compiling the real module and running `diffAttendance` over six
cases (no baseline, no change, attended, missed, two held one missed, and a
theory/practical pair). No portal sign-in was spent doing it.

### DONE: Install prompt, asked not enforced (2026-07-29)
`components/InstallPrompt.tsx`, mounted in `AppShell` so it appears once the
student is signed in and looking at their own data.

Chrome hands over a real install dialog through `beforeinstallprompt`. **Safari
has no equivalent**, so iOS gets written steps instead, chosen by user agent
(with the iPadOS-reports-as-Mac case handled via `maxTouchPoints`). Dismissal
snoozes for five days rather than forever, so one stray tap does not lose it.

**It does not gate the app, and should not.** The request was to block use until
a shortcut exists. Three reasons that fails:
- **There is no way to detect that someone made a shortcut.** The only
  observable fact is whether this page is *running* standalone
  (`display-mode: standalone`, or `navigator.standalone` on iOS).
- **On iOS a home screen app gets its own storage container.** Blocking a
  student until they install means signing in again inside the installed app,
  spending a second sign-in against the `SI503` daily cap, on an account that
  has already been CAPTCHA'd for signing in too often.
- Anyone on a laptop, or a browser without standalone support, would be locked
  out of their own attendance with no way through.

If it is ever revisited, the honest version is a **reminder that gets firmer**,
never a wall.

### DONE: Schedule moves with direction, Home greets properly (2026-07-28)

**Fading out and back in still read as a swap, not a movement.** A cross-fade
has no direction, so the eye has nothing to follow. The column now **travels**:
tapping a later day order sends the classes out to the left and brings the new
ones in from the right, and the reverse going back. Measured on a 2 to 5 switch,
`x` runs 0 to -17, then enters at +19 and settles to 0 while opacity runs 3.0 to
0.26 to 4.0. One continuous curve, about 600ms including the height tween.

**Schedule defaults to the same day Home features**, via the same `focusDay()`.
It used to sit on today's day order while Home had already rolled on to
tomorrow's, because `focusDay` moves on once today's classes are over and this
screen used the raw `todayDO`. Two screens describing the same day differently
is the bug; sharing the function is the fix.

Indicators, so the screen says which day it is showing without a sentence:
- The day-order tabs carry a **filled accent dot for today** and a **hollow ring
  for the day that comes next**.
- The label reads "Today" or "Up next, Wed Jul 29".
- On today only, the running class is marked **Now** and the one after it
  **Next**, with a brighter spine. Marking "Next" on any other day order would
  be a lie, so it is scoped to the day it belongs to.

**The greeting was in the wrong slot.** It sat in the masthead, which is an 11px
small-caps label, so "make it bigger" was really "stop putting a sentence in a
caption". The date went back to the masthead and the greeting is now a
`text-hero` line opening the cover, with the verb in `text-2` and the name in
`text-1` so the person is the emphasis. It is time-aware and **deterministic**
(`Morning` / `Afternoon` / `Evening` / `Late one` / `Still up`): copy that
reshuffles every render is a novelty once and noise thereafter.

### DONE: Day-order switching, and the launch (2026-07-28)

**Switching day order is a three-part move, and all three parts matter.**

1. **The entrance was re-running.** `useGsap` had `[activeDO, classes.length]`
   as dependencies, so every tap called `ctx.revert()`, which put every row back
   to the hidden CSS start state, then replayed `revealIn` plus `revealRows`
   (whose ScrollTrigger has to measure before anything below the fold appears).
   That was the one second blank.
2. **Then it still blinked**, because the outgoing classes vanished in a single
   frame and the new ones faded up from nothing. The empty frame between the two
   is what reads as a blink however smooth each half is. Now the rows on screen
   **leave first** (170ms, 16ms stagger) and the swap is committed in the tween's
   `onComplete`. A killed tween never fires `onComplete`, so a second tap
   mid-exit simply supersedes the first.
3. **The column's height is tweened across the swap**, because day orders hold
   different numbers of classes and the section beneath would otherwise snap.

`controlDO` (what was tapped) is deliberately **ahead of** `activeDO` (what is
drawn): the numeral and the sliding rule answer on the touch frame, the classes
follow a beat later. Measured across a switch: opacity
4.0 → 0.12 → 4.0 as one curve, height easing with a **2px** maximum jump per
frame.

Original diagnosis, kept because the dependency trap is the reusable part: `useGsap` had
`[activeDO, classes.length]` as dependencies, so every day-order tap ran
`ctx.revert()`, which put every row back to the hidden CSS start state, then
replayed `revealIn` plus `revealRows` (whose ScrollTrigger has to measure before
anything below the fold appears). The screen genuinely emptied and rebuilt.

The entrance is for **arriving** at a screen; changing day order is a
**transition**. So `revealIn` runs once (`[]`), the rows are no longer
`data-row`, and a dedicated `useLayoutEffect` on `[activeDO]` animates them with
`gsap.fromTo` in the same frame. Measured across a switch: row opacity
0.00 → 0.58 → 0.89 → 1.00 over ~400ms, continuous, never blank.

Also: the selected rule now **slides** between day orders (measured against the
active button's own track, so it cannot drift), and the poster numeral uses
`RollingNumber`, so 02 to 05 rolls rather than cuts.

**`components/Splash.tsx`** is the launch. Mounted in the root layout, so it
plays on a cold start and never on a client navigation: opening from the app
switcher is a fresh document, moving between tabs is not.

- The wordmark is split **per letter**, which the entry choreography avoids
  everywhere else. Showy is the point for five letters on an `aria-hidden`
  element for under a second.
- The rule beneath carries the **75% tick in accent**, so the launch is the same
  single idea the rest of the app is built on.
- It holds for a **fixed beat and leaves**, deliberately not waiting on the
  session: a slow portal must never be able to turn the launch into a hang.
- Verified by sampling: letters ease 37.7px to 0, the rule draws scaleX 0 to 1,
  the overlay holds to ~1.45s then fades, and the component unmounts itself.

### DONE: Overlays must be portalled (2026-07-28)
**`Sheet` and `Panel` render through `createPortal` into `<body>`, and that is
not a style choice.** Reverting it breaks the leave planner on every phone.

`PullToRefresh` writes a transform on its content wrapper (`gsap.quickSetter`)
the instant a finger touches the screen. **A transformed ancestor becomes the
containing block for `position: fixed` descendants**, so an overlay rendered
inside it stops being sized to the viewport and starts being sized to that
wrapper, which is as tall as the whole scrolling page.

Measured on the attendance screen, with the transform present:

    panel height   1522px   (the full page)      viewport   693px
    footer top     1433px   (740px below the fold)

So the calendar appeared but **"See impact" was unreachable**, and the tab bar
showed through where the footer should have been. It only happens after a touch
event, which is why it is invisible on a desktop and why it survived the audit.
After the portal: panel 693px, footer at 604px, whole flow verified through to
the forecast.

**The general rule: anything `position: fixed` that lives under `AppShell` must
be portalled.** PullToRefresh wraps every screen.

### DONE: Home cover retuned, display-name override guarded (2026-07-28)
From real-device screenshots:

- **The cover reserved 62dvh and hung its content off the bottom**, so the top
  of Home was a dead band under the masthead. Now 42dvh.
- **The day-order ghost numeral was bled 36px off the right edge**, which cut
  the second digit of a two-digit string clean in half. It now sits at the edge
  and the `padStart(2, "0")` is gone: "2" reads as a day order, a "0" beside a
  sliver reads as breakage. A crop is only a crop when the shape survives it.
- **A student was greeted by another student's name.** Not a leak: display-name
  overrides are keyed `skipp.name.<reg>`, and one had genuinely been saved
  against the friend's registration number while testing. `setDisplayName` now
  refuses to store a value equal to the portal's own first name, so pressing
  Save without editing cannot mint an override that outlives the session it was
  typed in. Clearing one is empty field plus Save (which only became possible
  once the empty-disables-Save bug was fixed).

### DONE: A display face on the entry screens, and the domain in the field (2026-07-31, latest)
**`@srmist.edu.in` is printed after what you type**, in `LoginForm`'s `Field`
via a `suffix` prop. The portal wants the full email and appends the domain
itself (see the login flow notes), so showing it is honest as well as clearer:
students no longer have to guess whether to type it.

**The input is sized to its own text so the domain hugs it** and the two read as
one address. A full width input parks the suffix against the far edge, where it
reads as a separate label rather than the rest of your address. A hidden sizer
span carrying the same text at the same size is measured, and the width is
written **straight to the element in a layout effect**, not held in state: a
measurement driving one style is not worth a re-render, and `setState` in an
effect is rejected by the compiler lint. Verified the suffix tracks the typing
(input 21px, 63px, 90px as the Net ID grows) and stays inside the box.

**Bricolage Grotesque is the display face, on the entry screens only.**
`--font-display` in `@theme`, loaded in `layout.tsx`, applied as `font-display`
on the sign-in and both onboarding roots so everything on those screens
inherits it, including the Net ID you type and the domain.

**It is deliberately NOT wired to `--font-sans`.** Doing that is one line and
restyles the whole app, and the data screens do not want it: attendance
percentages, marks and the timetable rely on tabular figures lining up, and
that is Geist's job here. Entry screens are the pitch and get a voice; the app
stays neutral. Confirmed after the change that `/dashboard` (body, headings and
every `.tnum`) is still Geist.

That makes **three faces with three jobs**, and the separation is the point:
Geist for the app, Bricolage Grotesque for the way in, Space Grotesk for the
maker's signature alone.

### DONE: The sign-in cover, and why it looked empty (2026-07-31, latest)
Reported from a 6.7 inch phone as "garbage on mobile, users will think this is a
normal boring app". It was neither a missing graphic nor a taste problem, it was
**two measurable layout faults**:

- **The headline was set at `text-hero`, which is 2.375rem (38px).** In a 430px
  column with acres of space around it, 38px reads as a caption, not a cover.
  It is `text-display` (56px) now. Checked it cannot overflow: the widest word
  measures 166px against a minimum column of about 272px at a 320px viewport.
- **`justify-between` plus `mt-auto` hung the header off the top and the form
  off the bottom**, so every pixel a taller phone added became dead band. The
  header is now `flex-1` and centres its contents, so extra height goes to the
  type instead of to a void.

Also: the screen asked for a password without ever naming the product. There is
a line under the headline now saying what Skipp is.

**This is the second time this screen has been called boring, and the first time
the cause was also not decoration** (see the entry below: the headline was not
rendering at all). **Reach for the measurements before reaching for graphics.**
The rejected graphic field stays rejected.

**The straggler sweep runs twice now** (`lib/motion.ts`), and the second pass is
not optional. It fired once at 900ms, which since the new launch animation lands
**while the overlay is still up** (~1.8s): anything mid-tween at 900ms is skipped
by the `isTweening` guard and never looked at again, so an entrance created late,
or reverted by a re-render after that sweep, would stay invisible permanently.
Second sweep at 2400ms.

### DONE: The sign-in is the greeting (2026-08-01, latest)
Rebuilt to carry the same weight as the new way in. **The multilingual hello is
now the hero**, set at display scale (clamp to 4.5rem, 70px on a 430px phone)
and cycling through the seven languages. "Know before you bunk" drops to a small
caps eyebrow above it, and the product line sits underneath.

**A sign in screen has one job and one moment, and the moment is being greeted.**
Selling the product to somebody who has already opened the app is the wrong use
of the biggest type on the page.

`Greeting` now takes a `className` so its caller sets the size; it kept its own
crossfade, where every word is stacked in one grid cell and the outgoing and
incoming overlap so combined opacity never drops below one.

**The greeting is set in the ACCENT**, which is the one token that differs
across all eighteen themes, so the look somebody just chose in the deck pays off
the instant they land rather than waiting for the dashboard. Verified the colour
really does follow: Ink orange, Terminal phosphor, Rose pink, Meadow deep green.
**Continue went from `outline` to `primary`** because the greeting now owns the
accent, and two accent objects on one screen is exactly the muddle the one
action per screen rule exists to prevent.

**Nine languages, cycling on their own**: English, Tamil, Hindi, Telugu,
Malayalam, Kannada, Odia, Bengali, Marathi. The tap to change was built and then
removed on request; a greeting should welcome, not ask to be operated. The
script is named beside it so you know what you are looking at.

**The handover is transform and opacity only, and that is the fix for a real
glitch.** A clip reveal with a blur was built first and stuttered every time a
word came back around: the finished word had its `clipPath` and `filter`
cleared with `clearProps`, so the next time it left it had to animate FROM
`none`, which does not interpolate, and it snapped. **On an animation that runs
forever, every property must hold a real value at both ends of every cycle.**
Transform and opacity always do, and they stay on the compositor.

**Each word is animated whole, and that is not laziness.** Splitting a word per
character is the obvious way to make this showier and it would be wrong: Indic
scripts build a syllable from a base plus combining marks, and slicing the
string by JS characters tears those into glyphs the language does not have.

Verified over a full lap of all nine: combined opacity never leaves the range 1
to 1.56 so there is never a blank frame, **no leftover clipPath or filter is
left on any word**, and the box top and height never move (97px).

**Two things have to be sized by the widest and deepest script, not the Latin
one:**
- **Leading.** At `leading-[0.9]` the Kannada and Malayalam descenders ran into
  the label below. At 1.15 the tightest gap across all seven is 12px.
- **The type ceiling.** At `clamp(..., 6rem)` the Malayalam greeting measured
  **428px against a 409px column** and overflowed. Capped at 5.25rem, the widest
  is 380px and every script fits.

### DONE: The sign-in greets you, in seven languages (2026-07-31)
`components/Greeting.tsx` cycles "hello" above the headline through the
languages this campus actually speaks: English, Tamil, Hindi, Telugu, Malayalam,
Kannada, Bengali. Verified it runs the full set in order and loops.

**It is the one looping animation in the app, and that is a decision, not an
oversight.** The standing rule was that nothing loops beside a password field,
because motion that never stops becomes a distraction after the first visit. The
user chose to break it for the greeting specifically. It is kept slow, low
contrast, and it never moves anything the eye needs in order to type.

**The first version was rejected as rough and misaligned, and it deserved to
be.** It faded one word out, swapped the text, then faded the next in, on a
single element. **That leaves a frame with nothing on it**, and that gap is what
reads as rough however smooth each half is on its own. The rebuild:

- **Every greeting is rendered, stacked in one CSS grid cell** (`gridArea:
  "1 / 1"`). The box is therefore always as wide and as deep as the largest
  word and can never resize mid-transition. Sizing a box to its current word
  makes the cover twitch on every change, because Indic scripts are deeper than
  Latin ones.
- **Outgoing and incoming overlap**, same duration, started together. Measured
  over 361 frames across two handovers: **combined opacity never drops below 1**
  and peaks at 1.56 at the crossover. There is no instant where the greeting is
  dimmer than one full word.
- They travel 42% of their own height on a soft ease and scale 0.94 to 1, so it
  is a drift rather than a jump.
- Measured over 8s: greeting box fixed at 24px, headline fixed at one position.
- **Only the Latin greeting is in the display face.** Bricolage carries no Tamil
  or Devanagari, so the Indic scripts fall back to the system face deliberately
  rather than to a mangled substitute.
- `aria-label="Hello"` is fixed on the element, so a screen reader announces it
  once instead of chattering on every swap.

**The rule under the headline fills as the form is completed**, half per field,
in the same language as every other measurement in the app. Measured 0px, 224px,
448px as the two fields are filled.

**The progress mark is a separate element from the `[data-draw]` rule**, and has
to be: the entrance tween owns that element's `scaleX`, and this only ever sets
a `width`. Two systems writing one property is the standing trap here.

**The count is reported from the change handlers, not an effect**, since
`setState` in an effect is rejected by the compiler lint.

### DONE: Sign-in stays type only (2026-07-28)
A graphic field was built for the sign-in screen (repeated hairline tracks with
the 75% tick, the Attendance measurement device as texture) and **removed on
request**. Do not rebuild it.

The screen is the wordmark, the headline, a rule and the form. Nothing else.
What made it look plain was never the absence of graphics: the headline was not
rendering at all on a real phone (see the reduced-motion entry below). With the
type back, the type is the design.

### DONE: The reduced-motion blind spot (2026-07-28)
Bugs reported from a real phone that **no test in this project could ever have
caught**, and the reason is worth keeping.

The entrance system hides content in CSS and reveals it with GSAP. The hiding
rule sits inside `@media (prefers-reduced-motion: no-preference)`. **The headless
Chrome behind the DevTools MCP reports `reduce`**, so in every screenshot ever
taken here the content was never hidden in the first place, and a reveal that
failed to run looked identical to one that worked. On a real phone the rule
applies, and a reveal that does not run leaves the screen **blank**.

To reproduce a phone, patching `window.matchMedia` is NOT enough: that only
changes what JS sees. The CSS start state must be injected as well:

    html.js [data-reveal], html.js [data-mark], html.js [data-enter] { opacity: 0 }
    html.js [data-word] { transform: translateY(110%) }
    html.js [data-draw] { transform: scaleX(0) }

Two real failures it was hiding:
- **Plan a leave opened blank.** `PredictModal`'s `useGsap` did not list `open`
  in its deps, and its scope lives inside `Panel`, which renders nothing while
  closed. On the first run the element did not exist; nothing changed after, so
  `revealIn` never ran for the mounted panel. Verified by inline opacity: four
  `data-reveal` targets, none written to. **A `useGsap` scope inside a
  conditionally mounted overlay must depend on whatever mounts it.**
- **The sign-in headline never appeared.** The words sat frozen at the tween's
  *from* value (`translate(0px, 41.8px)`) while the mark and the fields in the
  same timeline finished. The exact GSAP interaction is **not isolated**; what
  is certain is that `useGsap`'s cleanup calls `ctx.revert()`, which strips
  GSAP's inline styles and hands the element back to the hidden CSS state.

**`revealStragglers()` in `lib/motion.ts` is the guard**: 900ms after load,
anything still hidden and not being tweened is written to its final state. It
does not use `clearProps` (the first version did, which removed the inline
transform and handed the element straight back to the CSS rule that hides it).
It turns "invisible forever" into "a beat late".

**The rule this establishes: never let visible content depend on an animation
having run.** If a reveal is decoration, its failure must be cosmetic.

Also in this pass:
- Home greets by name (`Hey, <name>`) and the date moved into the cover.
- The custom display name could be set but never cleared: an empty field
  disabled the only button that writes it, making it a one-way door. Empty is
  now a valid submission and restores the portal's name.

### DONE: Production audit, mobile layout fixed (2026-07-28)
A full audit against the deployed build. **Two layout bugs broke the chrome on
every screen of every notched phone, and neither was visible on a desktop**,
which is why they survived so long. Both are measured, not eyeballed: the
numbers below come from a simulated 59px/34px inset.

- **The masthead collapsed to zero height.** `AppShell`'s header was
  `h-14 pt-[env(safe-area-inset-top)]`, and with `box-sizing: border-box` a
  59px notch inset consumed the entire 56px box (content box 0px, label
  spilling 6px out). The inset now pads a **wrapper**, so the 56px bar sits
  below the notch. **Never put a safe-area inset on an element with a fixed
  height.**
- **The primary action sat under the tab bar.** `--nav-h` was a hand-kept 58px
  against a real nav of 65px (desktop) and 91px (home indicator), so
  `StickyAction` put "Plan a leave" 23px behind the bar. `BottomNav` now
  publishes its measured height through a `ResizeObserver`. Clearance went from
  -23px to +12px. **A constant that mirrors a computed layout will drift; make
  the layout publish it.**

Other fixes in the same pass:
- **Home split labs in two.** `mergeRuns` ran *after* the hero was sliced off,
  so a two-period lab showed period 1 as the hero and period 2 as a separate
  row below, and the countdown ran to the end of period 1. Merge first, then
  pick the hero.
- `apiBase()`'s "NEXT_PUBLIC_API_URL is not set" error was thrown **inside** the
  `try` that catches network failures, so it was replaced by the generic
  unreachable message. Resolved before the try now.
- `useLockScroll` used `overflow: hidden`, which **iOS Safari ignores**; sheets
  now pin the body with `position: fixed` and restore the offset.
- `Overlay`'s comment claimed both overlays trap focus. They did not. There is
  a real trap now, with focus restored on close.
- Custom class sheet: the day order was `useState(dayOrder)` on a component
  that never unmounts, so it kept the value from first mount; times accepted
  `25:99`; time fields opened the alphabet. All three fixed.
- `crypto.ts` base64 spread one argument per byte (`String.fromCharCode(...)`).
  Measured 28KB against a 120k-argument ceiling in Chrome, lower on Safari, so
  it was a crash waiting for a bigger snapshot. Chunked at 32KB.
- `SessionContext.refresh` is a `useCallback`. Its identity used to change with
  `refreshing`, which it sets itself, so `PullToRefresh` unregistered its own
  listeners mid-gesture.
- `timetableImage.ts` (~300 lines of canvas) is now a dynamic import.
- `RollingNumber` carried its value in `aria-label` on a generic span with all
  digits `aria-hidden`; it is real `sr-only` text now.
- Attendance's "Subjects" count described every tracked subject while listing
  only the ones above the line.

**Known and NOT fixed, needs a decision:** the backend is an open credential
proxy. Anyone with the URL can POST arbitrary credentials to `/refresh`; the
typed `user_not_found` vs `wrong_password` responses make it a Net ID oracle,
and every attempt burns the victim's `SI503` daily cap. CORS restricts browsers,
not curl. §3 anticipated this ("v2, add a Cloudflare Worker that HMAC-signs
requests"); deploying is what made it real. In-memory rate limiting is close to
useless on serverless, so the realistic options are a shared-secret header or a
KV-backed limiter.

**Dead code found, left in place:** `lib/alerts.ts` (`buildAlerts`) has no
importer, though §11 still describes it as a live Home feature. Also 16 unused
icons, `Divider`, `IndexRow`, `Meter`, `upcomingHoliday`, `projectSkip`,
`projectAttend`, and the three single-section fetchers.

### DONE: Onboarding, third build: fixed furniture, changing contents (2026-08-01, latest)
Two rebuilds were rejected first, and both failures are worth keeping because
they are opposite mistakes:

1. **A gradient-and-glass deck**: hero title, subtitle, feature cards, Next
   button, four times. "Looks generic and looks like ai vibe coded." **If every
   screen has the same silhouette it is a template**, whatever the colours do.
2. **A no-button version driven entirely by one drag.** Rejected for the right
   reason: "users will get confused if to pull or not". A gesture that is the
   only way forward puts the reader in charge of something they never asked to
   hold. **The button stays.**

What works, taken from studying the reference app's structure rather than its
look: **fixed furniture, changing contents**. Every chapter carries the same
bottom assembly (small caps eyebrow, enormous chapter word, mark and rungs left,
round advance right) and the space above it holds a completely different KIND of
object each time: a fanned stack of cards in real 3D, a numbered index of rules,
a live meter, a rack of colour pills, a closing statement. The furniture repeats
so the deck feels like one place; the contents never repeat so it never feels
like a template.

**The room colour is the attendance** in the third chapter, interpolated live
from the percentage. Measured across four presses: 87.5% olive, 82.3% amber,
77.8% amber-red, 73.7% red. The arithmetic is `predict(14, 15 + skipped, 75)`,
the app's own, so it can never quote a margin the attendance screen would
disagree with. **The interaction is a labelled button**, not a gesture.

**Two real bugs found while checking, both worth remembering:**
- **A child cannot be more opaque than its parent.** The meter's track carried
  `opacity: 0.26` on the wrapper, which dragged the fill down with it, so the
  bar read as full at every value. The alpha belongs on a sibling track, never
  on the element the fill lives inside. Same family as the GSAP-versus-CSS
  opacity trap already in this file.
- A fanned card stack overlapped across the very figures it was fanning, so the
  offset has to clear the line you are meant to read.

**The theme chapter offers both kinds**, because they are two different things:
the three that rebuild the interface as named pills, then six of the fifteen
colours as plain discs. **All eighteen at once was clumsy**, and a colour needs
no name to be judged, so the discs carry no labels and the rest are left to the
profile. Watch the two counts: an eyebrow reading "eighteen of them" over a
section reading "15 of them" is two true numbers arguing on one screen.

**The page behind has to be pinned.** The deck is a `fixed inset-0` overlay, but
the document under it still scrolls, and iOS bounces it into view at the bottom
edge, so the app's own black showed through and read as a gap in the onboarding
itself. `useLockScroll` (exported from `ui/Overlay.tsx`, which already solved
this for sheets) holds the body with `position: fixed`, since **iOS ignores
`overflow: hidden` on the body**. Verified the lock is released on the way out,
which matters more than the lock: a deck that forgets to unpin leaves the whole
app unscrollable.

**Choosing a look repaints that chapter in the look's own colours**, read from
the live CSS variables after the theme lands rather than from the swatch. A
swatch tells you the hues; it does not tell you what the app will feel like.
Verified: Brutal turns the chapter cream on black, Terminal near black on mint,
Clay lavender on navy. The pills and the round advance invert against whatever
is underneath, so a light theme never puts cream on cream.

**Six chapters now**, with `THE DEV` before the sign off: who made it, and that
it is one student rather than a company. That is not vanity, it tells a stranger
how much to trust the thing they are about to hand a password to. Links come
from `lib/creator`, so a blank URL there removes an icon instead of leaving a
dead one, and `rel` is `noopener` alone (never `noreferrer`, which makes
LinkedIn answer with a sign-up wall).

**The black band at the bottom was the `theme-color` meta, not a gap.** In a
standalone PWA **iOS paints the area around the web view from `theme-color`**,
so it kept showing the app's theme (black on Ink, cream on Sand) while the deck
was a different colour entirely. **No amount of covering the viewport fixes
that, because it is not the viewport**, which is why painting
`documentElement` and adding `min-height: 100dvh` changed nothing. The meta is
now set to the chapter colour and restored by re-applying the theme on the way
out (the only place that knows each theme's bar colour). The clue was that the
band matched the THEME rather than anything on screen.

**The theme preview had to show STRUCTURE, not hue.** Repainting the background
was not enough: Brutal, Clay and Terminal differ in how things are built, so all
three previewed as the same screen in a different colour, which is exactly what
was reported. There is a real app row in the chapter now carrying the markers
the themes hook into (`data-band`, `data-surface`, `data-meter`) and inheriting
`--font-sans`. Measured: Ink 18px radius / 1px border / no shadow, **Brutal 0px
/ 2px / hard 4px offset**, **Clay 26px / soft coloured shadow**, **Terminal Geist
Mono**. The pill captions were dropped once the preview existed, since it
demonstrates "hard shadows" better than the words do.

**A centred flex column that overflows pushes its own top out of reach.** With
the preview added, this chapter's first card slid under the Skip control and
could not be scrolled back to. Top aligned with explicit header clearance, and
the stage clips so nothing spills over the chapter word. The chapter was then
measured 37px over on the shortest viewport and trimmed by exactly that, from
padding, gaps and pill height rather than from the preview. All six now fit with
nothing spilling.

**The chapter word is fitted by measurement, not by a clamp.** "YOUR LOOK" is
nine characters and ran past the gutter into the controls in the corner. A fixed
clamp cannot know how long the next word is, so the word is measured and shrunk
only if it needs it: everything stays at 85px, "YOUR LOOK" drops to 83px.

Two traps in writing that fit: **`scrollWidth` is useless on an overflow-hidden
flex row** (it reports the clipped width, so nothing ever looked too wide), and
clearing an inline `font-size` deletes the size entirely if the clamp lives in
the style attribute. The clamp belongs in the class so the inline value is free
to be overwritten and cleared.

**Back is a permanent control, disabled on the first chapter rather than
hidden.** A button that appears and disappears makes the pair jump every time
you advance.

Verified: five chapters, the word and field changing per chapter, the meter fill
measuring 70% against a tick at 75% (it stops short, which is the whole product
idea drawn literally), a full look and a colour each applying live
(ink to terminal to rose), back actually rewinding a chapter, and the last
action landing on the sign in form.

### DONE: Investigative pass, and the fixes from it (2026-08-01)
A full sweep of both halves. Typecheck, lint, every screen walked for console
errors, tap targets measured, the pure logic exercised against edge cases, and
the backend checked for credential leakage (**nothing logs or persists them, and
the HTML dump is properly gated behind `SKIPP_DEBUG_LOGIN`**).

**Fixed:**
- **There were no error boundaries at all.** A single render throw took the whole
  app to a blank page with no way back, which matters more here than most places
  because these screens render scraped data whose shape SRM can change without
  warning. `app/error.tsx`, `app/global-error.tsx` and `app/not-found.tsx` now
  exist, in the app's own voice. **Next 16 names the retry prop
  `unstable_retry`, not `reset`** (read `node_modules/next/dist/docs`). Verified
  with a temporary throwing route: caught, styled, both actions over 44px.
  `global-error` is hand styled because the thing that failed may be what
  supplies the fonts and tokens.
- **Tap targets under the 44px floor this project sets itself**: "Make optional"
  on Schedule measured **84x18**, the masthead signature 65x27. Both now clear
  44px, with the extra height taken as negative margin so the row rhythm is
  unchanged (measured: rows still 107px).
- **`projectAttendance` double counted a repeated leave date** (verified: same
  date twice gave conducted +2) and **silently dropped rows on a key
  collision**, because two attendance rows sharing a code and lab-ness
  overwrote each other in a `Map`, so the projection landed on the wrong row.
  Dates are deduped and the map holds a list per key. Neither was reachable
  from today's UI; both were one refactor away.
- **`loadSeenAttendance` could return `null`.** `JSON.parse("null")` passes the
  truthy check on the raw string, and `diffAttendance` then threw on
  `seen[...]`, taking Home down.
- **Dead code removed**: 12 unused icons, `Card`, `Divider`, `Meter`,
  `IndexRow`, the three single-section fetchers (each did its own login, so
  keeping them invited a future caller to spend three sign-ins) and
  `projectSkip` / `projectAttend`. **`logoSvg` looked dead and is not**: it is
  imported by `scripts/make-icons.mjs`, outside `src/`.
- The temporary `?pulldebug` readout is gone.

**Rate limiting on the backend** (`_rate_check` in `main.py`), on all four
routes that spend a sign-in: 20/hour per IP and 10/hour per account. The
per-account ceiling is what protects a victim from a distributed probe; the
per-IP one closes the Net ID oracle. `x-forwarded-for` is read from the FIRST
entry, since taking the last lets a caller append their own and rotate freely.
Verified with the portal stubbed: refused at the 11th and 21st respectively, a
normal student's five sign-ins all pass, a spoofed chain does not reset the
count, and the table does not grow without bound.

**This is a floor, not the fix.** Counters live in process, and Fluid Compute
reuses instances so they do survive between requests, but they are per instance
and reset on a cold start. The open credential proxy still wants either a
shared secret in front or a KV backed limiter.

**A mistake worth recording: the first run of the limiter test hit the real
portal.** `TestClient` against the unmodified app means `_login_or_4xx` makes
real network calls, and about thirty bogus sign-ins went out before the pattern
of 429s gave it away. **Stub `_login_or_4xx` before exercising any route in
this file.**

### DONE: An installed iOS PWA does not reload (2026-08-01)
**The pull to refresh gesture was reported broken across four separate fixes,
and the behaviour never changed once.** Not after the z-index fix, which alone
should have made the indicator appear. **That pattern is not a code bug, it is a
stale bundle**, and it should have been suspected far sooner than it was.

**A home screen PWA resumed from the app switcher does not reload.** iOS
restores the previous page instance with the old JavaScript still in memory, so
a student can sit on a build from days ago. Every deploy was verified live and
correct; none of them had ever executed on the phone.

The service worker was not the culprit: it is network first with `skipWaiting`
and `clients.claim`, so it does serve fresh assets. The page simply never
re-ran.

`PWARegister.tsx` now calls `registration.update()` whenever the app comes to
the foreground and reloads on `controllerchange`, guarded so a first install
does not flash. `CACHE` in `sw.js` is bumped to `skipp-v2`, because **a byte
identical sw.js is never treated as an update**.

**The diagnostic lesson, which is the reusable part:** when a symptom survives
several genuinely different, individually verified fixes, stop fixing and ask
what would have to be true for none of them to have taken effect. "Works
everywhere I can test, unchanged on the device" is a delivery problem until
proven otherwise.

**Also live in this build:** a temporary readout behind `?pulldebug=1` that
prints what the phone itself sees (reduced motion, standalone, scrollTop,
whether the first touchmove was claimed and whether `defaultPrevented` held,
badge opacity and position). Remove it once this is confirmed closed.

### DONE: iOS decides on the first touchmove (2026-07-31)
**The gesture has to be claimed on the FIRST `touchmove`, before the axis is
locked.** Safari decides at the start of a gesture whether the page scrolls, and
once it has decided it **ignores every later `preventDefault`**. Our axis lock
returned early for the first 8px without preventing anything, which handed iOS
the gesture every single time: it started its own rubber-band, our transform
never got to draw, and the result was a blank band with no indicator.

**Chrome is forgiving about this and iOS is not**, which is why the gesture
measured perfectly in every synthetic test here and did nothing on a phone. A
synthetic `TouchEvent` in headless Chrome cannot reproduce it. **Treat "works in
the browser, dead on the phone" as this until proven otherwise.**

Only a downward drag from `scrollTop` 0 is claimed, so upward scrolling, mid
page scrolling and the horizontal swipe navigation are untouched. Verified by
reading `defaultPrevented` on the first move of four gestures: pull down at the
top is claimed, the other three are not, and the horizontal swipe still
navigates.

### DONE: The pull indicator was behind the masthead all along (2026-07-31)
**The indicator was `z-20`. AppShell's sticky header is also `z-20`.** Same
stacking context, and the header comes later in the DOM, so it painted on top.
The badge spent its entire travel (0 to about 64px) behind an opaque bar. Every
fix before this one was correct and completely invisible, which is why it kept
being reported as not working: position, opacity, ring and threshold were all
measurably right the whole time.

**Equal z-index is not equal.** Ties inside one stacking context are broken by
document order. The badge is `z-40` now, above the header (20) and the nav (30).

**`elementFromPoint` cannot check this.** The badge is `pointer-events-none`, so
hit testing skips it and reports whatever is underneath, which looks exactly
like being covered. Confirm paint order by reading the z-indexes, or by holding
the gesture open and taking a screenshot.

**The bottom bounce is the platform's again.** `overscroll-behavior-y` is
`contain`, not `none`: both stop the browser's own pull to refresh, which is the
only reason the property is here, but `none` also kills the rubber-band at the
end of the page. The hand-drawn replacement was deleted because it could not
handle the ordinary case, scrolling to the end and continuing in one motion:
that gesture begins mid page, native scrolling already owns it, and
`preventDefault` is ignored. Ours now claims only a downward drag from
`scrollTop` 0 and leaves everything else to the browser.

### DONE: Pull to refresh, third attempt, and the reduced motion trap (2026-07-31)
**The likeliest reason it kept reading as broken: `prefersReducedMotion()` was
switching off the indicator, not just the decoration.** `paint()` set opacity and
returned before touching the badge position, the scale or the progress ring, so
on any phone with Reduce Motion on the gesture had almost no visible answer. The
earlier `overscroll-behavior` fix then removed the native bounce too, taking away
the only feedback that was left.

**A control that tracks your finger is feedback, not flourish.** The badge, its
scale and the ring now move under reduced motion; only the page rubber-band and
the bottom bounce are dropped. Verified with the setting ON: badge travels 4.3,
17.2, 34.3px and opacity ramps 0.19 to 1 while the page correctly stays still.

**The bottom edge bounces, drawn by us.** `overscroll-behavior` cannot be kept at
one edge and suppressed at the other, and suppressing it at the top is what lets
pull to refresh exist at all, so the bottom is animated in the same component.
`onStart` no longer bails unless `scrollTop` is 0 (that blocked the bottom
gesture entirely); the edge is decided once per gesture into `pull`, `bounce` or
`scroll`. Measured: content follows the finger to a clamped -84px and springs
back to 0.

**It settles without crossing zero, deliberately.** An overshoot would carry the
content past its rest position and open a gap under the masthead. iOS's own
bounce decelerates back to rest rather than overshooting, so this matches it.

**Deploy note, learned the hard way:** `vercel --prod` from `frontend/` does NOT
deploy skipp-q1sf. That project has Root Directory `frontend` and is deployed
from the repo root; running it from inside the folder has no project link and
**creates a brand new project**. One was created and removed. The frontend goes
out through git.

### DONE: The pull and the marks page, second attempt (2026-07-31)
Both were reported as still broken after a first round of fixes. **The fixes
were live** (checked against the deployed build, not assumed), so they were
wrong rather than missing. Both first attempts treated a symptom.

**Pull to refresh: `overscroll-behavior-y` was set on `body`, but the scrolling
element is `html`.** So iOS rubber-banded the whole document on a downward drag,
opening a blank band far taller than our own 116px pull, with the indicator
nowhere near it. It is set on `html` as well now. **Setting it on body alone is
not enough.**

Second cause in the same gesture: `setBadge` positioned the indicator at
`pull - 40`, i.e. **40px above its own anchor**. With the anchor at the safe
area, a 59px notch keeps it hidden for most of the travel, so it only emerged
right at the end. It now travels *down* from the safe edge (`pull * 0.55`), and
opacity alone is what hides it at rest.

Verified with synthetic touches on the deployed build: badge -34 to 48px,
opacity 0.15 to 1, content following 6 to 88px. **That test only works with
`matchMedia` patched**: under the reduced motion that headless Chrome reports,
`paint()` sets opacity and returns before touching any transform, so the gesture
looks dead when it is working perfectly.

**Marks: centring was never the problem.** A screen that is most of a screen of
nothing reads as broken whatever it is aligned to. It is top aligned now and
**lists the subjects it is waiting on**, which fills the page with something
true and answers the obvious question, "waiting on what".

Two real bugs surfaced while doing it:
- **A duplicate React key.** A course with separate theory and practical
  assessments arrives as two rows sharing a code *and* a title, and
  `SubjectMarks` carries nothing to tell them apart. It also showed the same
  subject twice with no readable difference. Deduped by code.
- **The figure disagreed with the list**: `subjects.length` counted 9 rows above
  a list of 8 courses. Both come from the deduped list now.

### DONE: Three phone bugs, all invisible on a desktop (2026-07-31)
**The Net ID field was mostly untappable.** Sizing the input to its own text so
`@srmist.edu.in` would hug it (built earlier the same day) made the *tap target*
only as wide as the text: most of the field looked like an input and did
nothing. The input is full width again and the domain sits at the end of the
row. **A field you cannot tap is worse than a suffix that does not hug.**

- The whole box is now a `<label htmlFor>`, so touching anywhere in it focuses
  the input rather than only the pixels the text occupies.
- The example Net ID placeholder is gone; the label already names the field.
- **The orange box was the global `:focus-visible` rule** in `globals.css`
  drawing a ring around the input *inside* the field's own border: two nested
  rounded boxes, which is precisely what made it read as a small live target in
  a large dead one. `[data-field] :focus-visible { outline: none }` opts these
  fields out and the box border carries focus instead. **It has to be unlayered**
  like the rule it overrides, or the layered Tailwind utility loses to it and
  `focus-visible:outline-none` on the input silently does nothing. Same trap as
  the border weight tokens.

**Pull to refresh opened a blank band**, because the indicator was positioned at
`top-0` of a wrapper that starts at the very top of the viewport. On a notched
phone that is behind the status bar (59px inset on a 6.7 inch iPhone), and the
badge only travels to about 28px at the threshold, so it was never visible at
all. It is anchored at `env(safe-area-inset-top)` now. **Never position a pull
indicator against the raw top of a full height wrapper.** It also gained a ring
that fills with the pull, so the gesture is answered continuously rather than
only once it arms.

**The marks empty state had a dead band under it.** `justify-center` plus
`pb-16` centres the block inside a box 64px shorter than the screen, so it sits
above the middle and opens a gap beneath that reads as a layout fault. Padding
removed; it centres honestly.

### DONE: The 31st of every month was missing (2026-07-31)
Reported as "today July 31 shows no classes but it was day order 4". It was not
the timetable or the calendar screen: **the planner parser never had that day**.

**The portal emits malformed HTML.** It closes the second to last calendar row
and then writes the last row's cells with no opening tag at all:

    ... - </td></tr><td bgcolor='#80987d'>31</td><td>Fri</td> ...

A parser has to put orphan cells somewhere, and BeautifulSoup's `html.parser`
lifts them clean out of the table, so the row silently never exists. The
calendar came back as exactly **180 entries, 6 x 30**, which looks plausible
enough to pass unnoticed. It cost **the 31st of every 31-day month**: Jul 31,
Aug 31, Oct 31, Dec 31.

`_repair_orphan_rows()` in `services/academic_planner.py` reopens the row before
parsing. `</tr>` can only legally be followed by `<tr>`, `</tbody>` or
`</table>`, never by a bare `<td>`, so the substitution is a repair and cannot
damage well-formed markup.

Verified against the real captured planner: **184 of 184 days, none missing**,
and `2026-07-31 Fri dayOrder=4`, which is what the student said it was. Aug 31
comes back as day order 4 too; Oct 31 and Dec 31 correctly have none, being a
Saturday and out of term.

**The lesson for every other parser here: a count that looks tidy is not a
check.** 180 is exactly what a naive reader would expect from six months, and
that is precisely why nobody looked. Assert against the real date range instead,
which is how this was found.

**A cached snapshot keeps the old calendar** until it is refreshed, so fixing
the backend is not enough on its own: the student has to pull to refresh (one
sign-in) before the day appears.

### DONE: The deployed API 404'd every route, and why (2026-07-31)
**Symptom:** every route on the deployed backend answered FastAPI's own
`{"detail":"Not Found"}`, including `/health` and `/openapi.json`, while CORS
kept working perfectly. The frontend turned that bare 404 into "No account with
that Net ID", so it read as a broken login and cost a lot of time.

**Cause, measured rather than guessed:** the `vercel.json` rewrite sends every
request to the function as `/api/index/$1`, and **the app receives that prefixed
path**. A request for `/health` arrives asking for `/api/index/health` and
matches no route.

**The fix has to be middleware on the app, not a wrapper around it.**
`_StripMountPath` in `main.py` takes the mount prefix back off. An identical
wrapper was tried first in `api/index.py`, exported as `app`, and **had no
effect in production**: the runtime does not necessarily serve the object that
module exports, so a wrapper there can be silently skipped. Middleware
registered on the app provably runs, which is exactly what the surviving CORS
rejection proved. Locally there is no prefix, so it is a no-op under uvicorn.

**How it was found, after two wrong guesses.** A temporary catch-all route
returning `request.url.path` and the routing headers, deployed once, printed
`"path": "/api/index/health"` and ended the argument. Declared last so real
routes still win, and returning no credentials or portal data. **`vercel dev`
does not reproduce this**: it runs the function under plain uvicorn, answers
`/health` with 200, and would have talked you out of the real bug.

**Three signals worth recognising together next time:** FastAPI's own JSON 404
(so the app is running), CORS still enforcing the allowlist (so `main.py` is
loaded and middleware runs), and *every* path failing including `/openapi.json`
(so it is routing, not a broken route). That combination means the path is
wrong, nothing else.

Verified live: `/health` 200, `POST /refresh` 422 with field errors, preflight
200 for the real origin and 400 for a bogus one, and no diagnostic left behind.

### DONE: Deployable on Vercel, both halves (2026-07-28)
Frontend and backend both deploy to Vercel, as **two projects** off one repo
(root directories `frontend/` and `backend/`).

**The time budget is what makes serverless safe here** (`core/client.py`).
A serverless platform kills a function at a hard limit with no chance to clean
up, and a scrape killed mid-flight never reaches `Session.close()`. The Zoho
session stays open, two of those trip the portal's 2-session concurrent block,
and the student has no way to clear it or understand it. So the backend stops
itself first: `Budget` tracks a wall clock, an httpx **request event hook**
refuses a call it cannot pay for and clamps the ones it can (via
`request.extensions["timeout"]`), and `Budget.reopen()` grants a slice back so
the logout still runs on the way down. Surfaces as **504 `slow_portal`**.

- **`TIME_BUDGET + _LOGOUT_GRACE + headroom <= maxDuration`.** Defaults are 45 +
  6 against `maxDuration: 60`. Raise them together, never one alone, or the
  function dies during the very cleanup the budget exists to protect.
- **Two doors, not one.** A request the clamp cuts short raises
  `httpx.TimeoutException`, not `TimeBudgetExceeded`. `login()` converts it when
  the clock is spent, otherwise a slow first request returned 502 and skipped
  the logout entirely. Both paths go through `_abandon()`.
- **`TimeBudgetExceeded` must escape the catch-alls.** `_try_section` and
  `_enrich_with_day_orders` swallow everything by design; without an explicit
  re-raise a spent budget returned a hollow 200 with empty sections.
- Verified against a local stand-in portal that hangs: 504, gave up at the
  budget rather than the 25s ceiling, logout fired. No SRM traffic.

**Two things that would have broken any deployment:**
- **CORS rejected our own site.** The regex only matched `http://` localhost and
  LAN. Production origins are now named in `SKIPP_ALLOWED_ORIGINS` (comma
  separated), and naming them drops the LAN regex.
- **The API base guessed port 8000.** Without `NEXT_PUBLIC_API_URL` a deployed
  build called `https://<site>:8000` and every sign-in failed vaguely. It now
  throws a named error. **The build still passes without it**, so it is a
  runtime net, not a build check.

**Env:** frontend `NEXT_PUBLIC_API_URL`; backend `SKIPP_ALLOWED_ORIGINS`,
optionally `SKIPP_TIME_BUDGET`. Never set `SKIPP_DEBUG_LOGIN` in production, it
dumps portal HTML to disk.

**LIVE (2026-07-27).** Two projects under `nikhil-bs-projects-949cf06e`:
backend **`skipp`** (root `backend/`) at `https://skipp-rose.vercel.app`,
frontend **`skipp-q1sf`** (root `frontend/`) at `https://skipp-q1sf.vercel.app`.
`includeFiles` does pick up `core/`, `services/` and `models/`: `/health` and a
live portal round trip both work, so the two open questions above are answered.

**The one thing that actually broke the first deploy, and the lesson.**
`SKIPP_ALLOWED_ORIGINS` had been set, but only on **Development and Preview**,
never **Production**. So the backend booted with an empty allowlist, fell back to
the LAN regex, and answered every call from the deployed site with **HTTP 400
"Disallowed CORS origin"**. The frontend loaded perfectly and every sign-in died,
which reads as a broken app rather than a missing variable.
- **A Vercel env var is set per environment. Setting it is not the same as
  setting it for Production.** This is the failure `/health`'s `skippVarNames`
  was added to catch, and it caught it: the name was absent in production while
  the dashboard showed the variable as present.
- **Env vars apply at deploy time, so adding one changes nothing until you
  redeploy** (`vercel redeploy <url>`).
- Diagnosed from outside in one request each: `/health` showed
  `allowedOrigins: []`, and an `OPTIONS` preflight carrying the real
  `Origin` header returned 400. Neither needs a browser or credentials.

**Verified live after the fix:** preflight from `https://skipp-q1sf.vercel.app`
returns 200 with a matching `Access-Control-Allow-Origin`, an unknown origin
still gets 400, and `POST /refresh` with a bogus Net ID reaches the portal and
returns the typed `404 user_not_found`. All seven routes plus
`manifest.webmanifest` and `sw.js` serve 200.

**Preview deployments are still CORS-blocked by design.** Every preview gets a
fresh `skipp-q1sf-<hash>-…vercel.app` hostname that a fixed allowlist cannot
contain. Production is what the allowlist names. If preview testing is ever
needed, add a narrow regex for that project's hostname shape rather than
loosening the production list.

### DONE: Onboarding is the product, played (2026-07-28)
**The whole slide-deck onboarding is deleted** (`Intro.tsx`, `IntroPreviews.tsx`,
`IntroGraphics.tsx`, `playGraphic()`). Panels of copy with a Next button were
forgettable however well they were drawn, and two rounds of better artwork did
not fix that, because the problem was the format.

What replaced it: **the first thing a student does in Skipp is the thing Skipp
is for.** `components/onboarding/Onboarding.tsx` is a working bunk calculator on
a sample day. Tap a class and it comes out of your attendance: the figure rolls
down, the bar loses ground, the count in hand drops by one.

- **The numbers are rigged to teach.** 17 attended of 18 held, five classes
  listed, four to spare. So the fifth tap is the one that crosses 75%, the figure
  turns `risk`, the bar falls short of the tick, and the line reads *"Below the
  line. Attend 1 to come back."* Attendance %, margin, threshold and recovery are
  all taught without a sentence explaining any of them.
- **It uses `lib/predictor`'s `predict()`**, not its own arithmetic, so the
  opening can never quote a margin the attendance page would disagree with. If
  you change the sample constants, check the fifth tap still breaks the line.
- **`RollingNumber`** (`components/onboarding/RollingNumber.tsx`) is the signature
  detail: each digit is a column of 0-9 in a 1em clip, so only the digits that
  actually changed move. Non-digits (`.`, `%`) sit in the same 1em cells at 40%
  opacity, which is what keeps the decimal point and the unit on the digits'
  baseline. An overflow-hidden inline-block takes its **bottom margin edge** as
  its baseline, so a normally-set `%` beside it will not align.
- The action is `inert` until the first tap, so it is not a focus stop nobody can
  see, and "Sign in" is in the header throughout for anyone who does not want to
  play.
- **Fit is deliberate**: the whole decision has to be on one screen with no
  scrolling, verified at a 693px viewport. Adding a sixth class overflows it.

### DONE: The sign-in wait is staged (2026-07-28)
`components/onboarding/SyncSequence.tsx`. The portal round trip genuinely takes
several seconds (Zoho login, handoff, three Creator pages) and that was a
spinner. It is now the last movement of the opening, and `app/page.tsx` holds the
screen until it finishes rather than redirecting the moment `isAuthed` flips
(`phase !== "idle"` stands the redirect down; `LoginForm` reports the phase).

- **While waiting it ticks nothing off**, because nothing has arrived. It shows
  what is being attempted and a sweep on a hairline. No fake percentage, and a
  slow portal cannot make it lie.
- **The landing is the real snapshot**: the student's name, then courses, day
  orders, attendance and term days rolling into place. A gated section is left
  out rather than shown as a zero.

**Layout trap worth keeping from the deleted flow:** a `h-full` child of a
`flex-1` viewport does not resolve (percentage height against an indefinite
basis). If a `h-full` child looks top-aligned, check its parent is a flex
**container**, not just a flex item.

### DONE: Entry choreography (2026-07-27)
The entry screens perform with type, not decoration. `playEntrance()` in
`lib/motion.ts` is one timeline shared by the intro and the sign-in, so moving
through the intro and landing on the form reads as one sequence:

    [data-mark]  the small caps mark fades up
    [data-word]  headline words slide up out of their own clipping boxes
    [data-draw]  a rule is drawn left to right
    [data-enter] everything else arrives, staggered

- **`WordMask`** (`ui/editorial.tsx`) splits a line into words, each in its own
  clipping box. Word level, not character level: characters are showy, hurt
  screen readers, and need measurement. The trailing space sits *outside* the
  clip so lines still wrap.
- Start states are in `globals.css` under `html.js` and
  `prefers-reduced-motion: no-preference`, so nothing is hidden from a reader
  without JS or with motion turned off.
- **It runs once and stops.** No looping animation on a screen people visit to
  type a password.
- Measured live: words ease 41.8px to 0 over ~840ms, the rule draws from 420ms,
  and all values are constant after ~900ms.

**The trap, for the third time:** `data-enter` was first put on the `Button`
itself, which already owns its transform through `pressable()`. The entrance
tween and the press tween fought and the button stayed frozen at the entrance's
start state, invisible, while every sibling animated fine. The entrance now
animates a *wrapper*. **Never animate an element that another system already
animates.**

### DONE: Entry experience, first-run intro + typed sign-in errors (2026-07-27)
**There is no sign-up and there must not be one.** The app authenticates against
SRM with the student's own Net ID; it creates no account and stores nothing
server-side (§1 non-goals). A sign-up screen would either be a lie or would
reverse the project's strongest safety property. If asked again, say so.

- **`components/Intro.tsx`**: three panels on first launch only (promise, what it
  does, where the password goes), then the sign-in form. Swipeable, skippable,
  remembered in `skipp.seen-intro`.
  - The seen flag is read through **`useSyncExternalStore`**, not an effect: the
    React compiler lint rejects `setState` in an effect, and the server snapshot
    returns "seen" so a returning user never sees the intro flash.
- **Sign-in leads with the promise**, with the credential handling stated beside
  the form rather than as an opening disclaimer.
- **Typed failures.** The backend now sends `{code, message}` (`_fail()` in
  `main.py`); `lib/api.ts` carries a `FailureCode` on `AuthError`/`PortalError`,
  and `LoginForm.explain()` gives each case its own wording. **CAPTCHA and the
  daily sign-in cap are both HTTP 429 but need opposite advice** ("sign in on the
  portal once" vs "wait, your cached data still works"), which is why the code
  exists rather than matching on prose.
- Entry CTAs use the `outline` variant: the app treats the accent as ink, never
  as a filled slab.
- Verified live: a bogus Net ID returns `user_not_found` and renders
  "No account with that Net ID" with its own advice.

### DONE: Creator credit (2026-07-27)
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
Everything in §7's roadmap is built, and both halves are deployed on Vercel. What remains:
1. **Notifications are in-app only, by decision** (see the 2026-08-03 entry). The push scheduler
   that would reach a closed phone was built and removed; rebuild it only if asked. What is
   untested is a real notification on a real handset, which needs the installed PWA.
2. **Discover page names, batch and academic year from the portal menu** instead of the constants
   hard-coded in `core/client.py`, so the app works for students in other batches and terms.
3. **Interactive CAPTCHA solving** (show the HIP image, submit `hipcode` + `cdigest`). This moved
   up the list after deploying, see the note on datacenter egress in the Vercel entry.
4. Test the PWA install on real phones.

**Local dev:** backend `cd backend && ./.venv/bin/uvicorn main:app --host 0.0.0.0 --reload`
(port 8000); frontend `cd frontend && npm run dev` (port 3000). Do **not** run `npm run build`
while the dev server is running, it corrupts `.next`; use `npx tsc --noEmit` and `npx eslint src`
to check instead. chrome-devtools MCP works via the plugin server (there is deliberately no
`.mcp.json`).
