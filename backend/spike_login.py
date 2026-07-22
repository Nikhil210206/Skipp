"""Phase 1 spike runner — finish validating the login flow with a REAL account.

Run locally:  ./.venv/bin/python spike_login.py
It prompts for your SRM net id + password (password is hidden via getpass and
is never printed, logged, or written anywhere). On success it dumps the
authenticated home page HTML to ./captures/home.html for us to find the
attendance page from. `captures/` and `*.html` are gitignored.

This file is a throwaway diagnostic, not part of the served API.
"""
from __future__ import annotations

import getpass
import os

from core.client import PAGE_ATTENDANCE, PAGE_TIMETABLE
from core.session import (
    InvalidCredentials,
    PageError,
    PageInaccessible,
    PortalError,
    UserNotFound,
    login,
)
from services.creator import PageEmptyError
from services.timetable import parse_timetable

CAPTURE_DIR = "captures"


def main() -> None:
    netid = input("SRM net id: ").strip()
    password = getpass.getpass("Password (hidden): ")

    try:
        session = login(netid, password)
    except UserNotFound as e:
        print("✗ User not found:", e)
        return
    except InvalidCredentials as e:
        print("✗ Wrong password:", e)
        return
    except PortalError as e:
        print("✗ Portal error:", e)
        return

    print(f"✓ Logged in. zuid={session.zuid}")
    cookies = list(session.client.cookies.keys())
    print("  session cookies (after handoff):", cookies)
    print(f"  app session (JSESSIONID) present: "
          f"{'YES ✓' if session.has_app_session else 'NO ✗'}")
    os.makedirs(CAPTURE_DIR, exist_ok=True)

    # Real pipeline: fetch the timetable Creator page via fetch_page() (which
    # sends the X-Requested-With XHR header) and parse it. A plain GET without
    # that header only ever returns the SPA shell.
    print(f"\n  fetching timetable page ({PAGE_TIMETABLE}) via fetch_page()…")
    try:
        raw = session.fetch_page(PAGE_TIMETABLE)
        with open(os.path.join(CAPTURE_DIR, "timetable_live.html"), "w") as f:
            f.write(raw)
        tt = parse_timetable(raw)
        s = tt.student
        print(f"    ✓ {len(raw)} bytes parsed")
        print(f"    student: {s.name} | {s.registration_number} | "
              f"{s.department} ({s.section}) | sem {s.semester}")
        print(f"    academic year: {tt.academic_year}")
        print(f"    courses ({len(tt.courses)}):")
        for c in tt.courses:
            print(f"      {c.code:12} slot={c.slot!r:12} {c.title}")
    except (PageError, PageEmptyError) as e:
        print(f"    ✗ {type(e).__name__}: {e}")

    # Attendance: expected to be admin-gated (403 -> PageInaccessible) at
    # semester start. Confirm the typed error fires cleanly.
    print(f"\n  fetching attendance page ({PAGE_ATTENDANCE}) via fetch_page()…")
    try:
        session.fetch_page(PAGE_ATTENDANCE)
        print("    ✓ attendance page is LIVE — capture it so we can write the parser!")
    except PageInaccessible as e:
        print(f"    ⏳ gated as expected: {e}")
    except (PageError, PageEmptyError) as e:
        print(f"    ✗ {type(e).__name__}: {e}")

    session.close()


if __name__ == "__main__":
    main()
