# Skipp Core Architecture & Operational Guidelines

This file is automatically loaded by the AI assistant. When troubleshooting or rectifying any problem in Skipp, adhere to the verified, problem-free architecture below to prevent regressions.

---

## 1. Leave Predictor Core Mechanics (`frontend/src/lib/leavePredictor.ts`)

- **Multi-Slot Durations (`getSlotHours`)**:
  - SRM period slots vary in format. Always compute total duration correctly:
    - Lab/practical ranges: `L51-L52` (2 hours), `P37-P38-P39` (3 hours).
    - Theory ranges: `A-B` (2 hours), or single letter `A` (1 hour).
    - Unrecognized/empty formats default to 1 hour.
- **Two-Pass Course Matching (`findMatchingSubject`)**:
  - Always match in two passes:
    1. Exact code equality (`subject.code.toUpperCase() === course.code.toUpperCase()`).
    2. Normalized base code comparison (strip `Theory`, `Lab`, or category suffixes) so integrated course slots (e.g., `21CSC302J`) match their attendance entries.
- **Projection & Target Calculation**:
  - Overall formula: `(conducted - absent) / conducted * 100`.
  - Margin calculation: classes that can be missed while staying >= 75%.
  - Debarment risk warning triggered if any individual subject drops below 75%.

---

## 2. SRM Portals Architecture: Academia vs Student Portal

- **Academia (`https://academia.srmist.edu.in`)**:
  - Zoho Creator application (`academia-academic-services`).
  - Scraped via `backend/core/client.py` and `backend/core/session.py`.
  - Timetable pages (`My_Time_Table_2023_24`, `Unified_Time_Table_2025_batch_2`) return `HTTP 200`.
  - `My_Attendance` frequently returns **`HTTP 403 Forbidden`** (university admin-gates it). Skipp catches 403, sets `attendanceStatus = "gated"`, and logs out gracefully (`302`) without crashing.
- **Student Portal (`https://sp.srmist.edu.in`)**:
  - Java servlet application (`studentTimeTableDetails.jsp`, `My_Attendance.html`).
  - Attendance is updated daily and published live.
  - Requires SRM Net ID (e.g. `ab1234`), strictly rejecting registration numbers (`RA...`).
  - Auto-solved in backend `/sp/auto-login` via OCR (`ddddocr`).
  - **Password note**: Often differs from Academia password. Never state it is the email password as users may change it.

---

## 3. Student Portal Prompt Modal (`StudentPortalPromptModal.tsx`)

- A centered modal (`Modal` primitive in `frontend/src/components/ui/Overlay.tsx`) automatically appears when a student logs in via Academia and attendance is gated or missing.
- Allows typing Net ID & password directly in the popup with auto-OCR captcha solving and manual captcha fallback.
- On success, saves credentials (`savePortalCredentials`) and sets `PortalOverride` in `localStorage` under `skipp.portalatt.<reg>`.

---

## 4. Oracle Cloud Infrastructure (OCI) Proxy Architecture

### Why it exists
- SRM Student Portal (`sp.srmist.edu.in`) enforces strict **Geo-IP blocking** and Cloudflare WAF perimeter rules that drop or block requests originating outside India (e.g., Render datacenter servers in Frankfurt/Oregon).
- Direct requests from foreign servers fail with connection drops or `HTTP 403 Forbidden`.

### The Proxy Setup
- **Provider & Region**: Oracle Cloud (OCI) Always Free tier in **Hyderabad, India (`ap-hyderabad-1`)**.
- **VM Spec**: `VM.Standard.E2.1.Micro` (Ubuntu 24.04), IP: `129.225.100.142`.
- **Proxy Daemon**: `tinyproxy` listening on port `8888` with domain filtering (`srmist.edu.in`, `ipinfo.io`).
- **Render Backend Integration**: In Render dashboard, `SKIPP_PROXY` is set to `http://129.225.100.142:8888`. All outbound Student Portal calls tunnel through this Indian IP.

### Verification & Troubleshooting Runbook
- **Verify proxy from terminal**:
  ```bash
  curl -x http://129.225.100.142:8888 -s https://ipinfo.io/json
  # Must return country: "IN", city: "Hyderabad"
  ```
- **SSH into Oracle VM**:
  ```bash
  ssh -i /Users/nikhil/Downloads/ssh-key-2026-10-24.key ubuntu@129.225.100.142
  ```
- **Tinyproxy service commands**:
  ```bash
  sudo systemctl status tinyproxy
  sudo tail -f /var/log/tinyproxy/tinyproxy.log
  sudo systemctl restart tinyproxy
  ```
- **If the VM IP ever changes**:
  1. Find the new IP in the Oracle Console (or reserve it as a permanent Reserved Public IP).
  2. Update `SKIPP_PROXY = http://<NEW_IP>:8888` in Render Dashboard -> Environment.

---

## 5. PWA Service Worker Invalidation Rule (`frontend/public/sw.js`)

- Skipp uses a custom Service Worker for offline capability.
- **MANDATORY**: Whenever shipping frontend bug fixes or UI updates, **ALWAYS increment `CACHE = "skipp-vX"`** in `frontend/public/sw.js`. If forgotten, mobile devices and PWA installs will serve stale, cached JS bundles.

---

## 6. Git Commit & Privacy Guardrails

- **CRITICAL**: Never mention competitor apps (e.g., `ratiod`, `getratiod.lol`) in any git commit messages, PR descriptions, or public code comments.
- Keep all commit messages professional and focused solely on Skipp.
- Never log, store, or commit user passwords or raw credentials.
