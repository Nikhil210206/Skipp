# Skipp

> **Know before you bunk.** Your SRM attendance, marks and timetable, minus the portal.

**[skipp.life](https://skipp.life)**

Skipp is an installable PWA that signs into the SRM academia portal on your behalf and turns
its attendance, marks and timetable pages into a fast, native-feeling app: a bunk predictor
that tells you exactly how many classes you can still miss, a leave planner that forecasts a
whole run of days off before you take them, and a grade forecast worked out from your own
published internals.

Not affiliated with SRM. Nothing about your account is ever stored on a server, ours or
anyone else's.

---

## What it does

- **Attendance**, with a predictor: per subject and overall, "skip 3 more and stay above
  75%" or "attend the next 2 in a row to climb back."
- **Leave planner.** Pick a day or a range on the calendar and see the exact attendance hit
  before you take it, subject by subject, with the classes you'd need afterward to recover.
- **Marks and a grade forecast**, worked out from your own published internals: what grade
  you're on track for per subject, and what the final exam needs to hold it.
- **Timetable**, by day order rather than weekday, the way SRM actually runs terms. Add
  classes the portal doesn't know about, or mark a course optional so it stops counting
  against you.
- **A 180-day academic calendar**, with holidays and day orders fused from the portal's own
  planner.
- **Installs to the home screen** on iOS and Android, full screen, no browser chrome.
- **Local notifications**: a nudge 30 and 5 minutes before a class, and a note when the
  portal records attendance, raised by the app itself when you open it. Nothing is pushed to
  a closed phone, on purpose, see [Privacy](#privacy--security).
- **A real desktop layout** past 1024px, not a phone screen stretched wide: a sidebar
  replaces the bottom tab bar and swipe gesture.
- **18 themes.** Three that rebuild the interface (a soft "Clay" look, a hard-edged
  "Brutal" one, a monospace "Terminal" one) and fifteen colour skins on top of the default.

---

## How it works

```
[ your phone ]
      │  you type your SRM Net ID + password
      ▼
[ Next.js PWA ]  ── encrypts credentials on-device (AES-GCM), only ciphertext is stored
      │  POST /refresh  { username, password }   (HTTPS, one request)
      ▼
[ FastAPI backend ]  ── signs into academia.srmist.edu.in, scrapes the HTML, parses it
      │
      ▼
[ SRM academia portal ]  ── the source of truth, every time
```

The portal has no API and blocks cross-origin requests, so the login and scrape have to run
server-side. The Python backend does exactly that and nothing else: React owns 100% of the
UI, the backend logs in, parses three portal pages into JSON, and forgets your password the
moment the request ends.

One sign-in covers the whole session. `/refresh` fetches attendance, marks and the timetable
together and the result is cached, encrypted, on your device, so reopening the app or
switching tabs never signs in again. SRM's portal enforces a CAPTCHA after rapid logins and a
hard daily sign-in cap per account; Skipp is built around staying well under both.

## Privacy & security

Skipp handles other students' SRM passwords, so this section is not boilerplate.

- **Nothing is stored on a server.** The backend holds a password in memory for the duration
  of one request and never writes it, or anything scraped with it, to a database or a log.
- **Credentials are encrypted on your device** with a non-exportable AES-GCM key
  (`extractable: false`): the key itself can never be read back out, even by Skipp. Clearing
  your browser data wipes it, a hard kill switch.
- **All traffic is HTTPS.**
- **There is no push notification server.** A version that woke a closed phone was built and
  removed on request: doing it honestly would mean storing push subscriptions for every
  student (a real database of who has class when), and reaching the "announced the instant
  it changes" version people actually want would need a server holding everyone's password
  and re-logging in dozens of times a day per student against the portal's own daily cap.
  That is not a privacy-for-features trade, it just locks students out of their own portal.
  So notifications are raised locally, by the app, when you open it.
- Only ever access your own data with your own credentials.

---

## Tech stack

| Layer | Tech |
| --- | --- |
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 (tokens in `globals.css`, no config file) |
| Animation | GSAP, one motion layer (`lib/motion.ts`), reduced-motion handled in one place |
| PWA | Hand-written `public/sw.js` (network-first cache) + local `Notification`s |
| Backend | Python + FastAPI |
| Scraping | httpx + BeautifulSoup4 |
| On-device crypto | Web Crypto API (AES-GCM) + IndexedDB |
| Analytics | Vercel Web Analytics + Speed Insights (cookieless, no personal data) |

---

## Legal

Not affiliated with, endorsed by, or connected to SRM Institute of Science and Technology.
Skipp only ever accesses a student's own data with their own credentials, stores nothing
server-side, and asks that nobody use it to hammer the portal: it caches aggressively and
rate-limits on its own.

---

Crafted by [Nikhil Balamurugan](https://www.linkedin.com/in/nikhilb21/).
