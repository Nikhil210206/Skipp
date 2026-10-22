"""Student portal (sp.srmist.edu.in) support, WebView model.

WHY THIS FILE NO LONGER LOGS IN
-------------------------------
The student portal guards its login with an anti-bot gate: a POST without the
browser fingerprint its JavaScript generates is refused outright with
"JavaScript is required to log into this application securely." Getting a
SCRIPTED login past that means forging that fingerprint (a fake canvas hash,
invented mouse/keystroke counts, a spoofed `navigator.webdriver`). Skipp does
not do that: it is bot-detection evasion, it is brittle (it broke the day it was
tried, 2026-08-17), and it risks the student's own account.

The durable, honest path is a REAL login. Skipp is wrapped with Capacitor, and
the student signs in to the real portal inside an in-app WebView: real page,
real JavaScript, a real human solving the real captcha. Because that WebView is
same-origin with sp.srmist.edu.in once signed in, JavaScript injected into it can
fetch the report pages directly, and the session cookies (including the HttpOnly
JSESSIONID) ride along on their own. The WebView hands the resulting HTML back to
the app, which posts it here to be parsed.

So the backend never sees a password for this source and never signs in. It
receives HTML that a real authenticated session produced and turns it into the
same JSON shape academia gives. The parsers live in `services/sp_attendance.py`
and `services/sp_marks.py`, both written and verified against a real capture.

The report paths are exported for the WebView to fetch. They are POSTed with an
empty body: the servlet reads the student off the session, so there is nothing
to pass and nothing that could be pointed at another student's record.
"""
from __future__ import annotations

BASE_URL = "https://sp.srmist.edu.in"
CONTEXT = "/srmiststudentportal"

#: Where a signed-in student portal WebView fetches each report from.
REPORT_ATTENDANCE = f"{CONTEXT}/students/report/studentAttendanceDetails.jsp"
REPORT_MARKS = f"{CONTEXT}/students/report/studentInternalMarkDetails.jsp"
REPORT_PROFILE = f"{CONTEXT}/students/report/studentProfile.jsp"

#: Positive markers that prove a page is an authenticated report.
REPORT_CONTENT_MARKERS = (
    "course wise attendance",
    "total percentage",
    "max. hours",
    "max hours",
    "att. hours",
    "att hours",
    "internal mark",
    "test performance",
    "timetable details",
    "day order",
    "course code",
)

#: Markers of a signed-out response (login form or loader).
LOGIN_MARKERS = (
    "SCaptchaServlet",
    'name="password"',
    "LoginServlet",
    "login screen is loading",
)


class StudentPortalError(Exception):
    """Base class for student portal failures, surfaced to the API as typed 4xx."""


class SessionExpired(StudentPortalError):
    """The HTML we were handed is the login page, not a signed-in report."""


def looks_signed_out(html: str) -> bool:
    """True when this HTML is the login screen rather than a report."""
    if not html or len(html.strip()) < 30:
        return True
    lower = html.lower()
    # Positive signals: if the page contains report tables or headers, it's NOT signed out!
    if any(marker in lower for marker in REPORT_CONTENT_MARKERS):
        return False
    # If it has login form elements or the loader, it is signed out
    if any(marker.lower() in lower for marker in LOGIN_MARKERS):
        return True
    if "youlogin" in lower and "password" in lower:
        return True
    # If it has table structures and no login markers, treat as potential report
    if "<table" in lower or "<tr" in lower or "attendance" in lower:
        return False
    return False

