# Skipp

> **know before you bunk.** Your SRM attendance, marks & timetable — minus the portal.

Skipp is a fast, installable **PWA** that logs into the SRM academia portal on your behalf,
scrapes your **attendance, marks, and timetable**, and shows it in a clean, mobile-first UI —
plus a "how many classes can I bunk?" predictor and a "what do I need in the final?" marks
calculator.

Think: a nicer, faster replacement for the official portal that installs to your home screen
like a native app.

---

## Why it exists

The official portal is slow, clunky, and not built for a phone. Skipp gives you the three
things you actually check — **attendance, marks, timetable** — in seconds, with a bunk
predictor that tells you exactly how many classes you can skip and stay above 75%.

---

## How it works

```
[ your phone ]
     │  enter SRM id + password
     ▼
[ Next.js PWA ]  ── encrypts creds on-device (AES-GCM), stores only ciphertext locally
     │  POST /login  { username, password }  (HTTPS, never stored server-side)
     ▼
[ FastAPI backend ]  ── logs into academia.srmist.edu.in, scrapes HTML → clean JSON
     │
     ▼
[ SRM academia portal ]  ── the source of truth
```

A separate Python backend is required because the portal has no API — scraping must run
server-side (browsers block the cross-origin login). React handles 100% of the UI; Python
handles login + parsing only.

### Privacy

- **Nothing is stored on our servers.** Your password lives in backend memory for the
  duration of a single request, then it's gone.
- Credentials are encrypted **on your device** with a non-exportable AES-GCM key. Clearing
  your browser data wipes everything.
- All traffic is HTTPS. Not affiliated with SRM — use at your own risk.

---

## Tech stack

| Layer      | Tech |
| ---------- | ---- |
| Frontend   | Next.js (App Router) + TypeScript |
| Styling    | Tailwind CSS |
| Animation  | Framer Motion |
| PWA        | `@ducanh2912/next-pwa` (Workbox) |
| Backend    | Python + FastAPI |
| Scraping   | httpx + BeautifulSoup4 |
| Crypto     | Web Crypto API (AES-GCM) + IndexedDB (on-device) |

---

## Repository layout

```
skipp/
├── frontend/          # Next.js PWA (UI)
└── backend/           # FastAPI scraper
    ├── main.py        # app + routes
    ├── core/          # session/login flow + httpx client
    └── services/      # HTML → JSON parsers (attendance, marks, timetable)
```

---

## Getting started

### Backend

```bash
cd backend
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
./.venv/bin/uvicorn main:app --reload      # http://127.0.0.1:8000
```

Health check: `GET http://127.0.0.1:8000/health` → `{"status":"ok"}`

### Frontend

```bash
cd frontend
npm install
npm run dev                                 # http://localhost:3000
```

---

## Status

Early development. The scraper spike is done — login, app-session handoff, and Creator-page
parsing are proven end-to-end against the live portal. Timetable/course data parses cleanly;
attendance is wired up and comes online once the semester's attendance is recorded.

Roadmap and detailed reverse-engineering notes live in [`PLAN.md`](PLAN.md).

---

## Legal

Not affiliated with, endorsed by, or connected to SRM. Skipp only ever accesses your own data
with your own credentials, and stores nothing server-side. Respect the portal — don't hammer
it; the app caches aggressively and rate-limits.
