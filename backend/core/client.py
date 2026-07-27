"""httpx client wrapper + portal constants for the SRM academia (Zoho) portal.

Everything here was derived by inspecting the live login flow (Phase 1 spike),
not copied from any third-party project. See PLAN.md for the flow write-up.
"""
from __future__ import annotations

import os
import time
from urllib.parse import quote

import httpx

BASE_URL = "https://academia.srmist.edu.in"

# Zoho IAM org prefix for SRM academia. Found in the signin page JS as
# `uriPrefix = '/accounts/p/40-10002227248'`.
IAM_PREFIX = "/accounts/p/40-10002227248"

# After password auth, IAM redirects the signin session to this service URL,
# and *that* hop is what mints the academia app-authorization cookies
# (`_iamadt_client_<zaid>` family). It MUST be registered on the signin session
# (passed to the signin GET) or IAM has nowhere to route the post-login `.../next`
# redirect and never grants the app token, leaving only the SPA login shell.
SERVICE_URL = f"{BASE_URL}/portal/academia-academic-services/redirectFromLogin"

# The signin page is embedded as an iframe pointing at this Zoho IAM endpoint.
# `serviceurl` carries the academia service context (see SERVICE_URL above).
SIGNIN_PAGE = (
    f"{IAM_PREFIX}/signin"
    "?hide_fp=true&orgtype=40&service_language=en&dcc=true"
    f"&serviceurl={quote(SERVICE_URL, safe='')}"
)

# Zoho signin params appended to lookup/password requests (from getSigninParms()).
ORG_TYPE = "40"
SERVICE_LANGUAGE = "en"

# Double-submit CSRF: value of the `iamcsr` cookie is echoed back in this header
# as `iamcsrcoo=<value>` (from signin.js: X-ZCSRF-TOKEN, csrfParam=iamcsrcoo).
CSRF_COOKIE = "iamcsr"
CSRF_PARAM = "iamcsrcoo"

# The academia app is a Zoho Creator app. Each section is a server-rendered
# "Creator page" fetched from this path (confirmed via a real browser capture,
# Phase 1). App link name: `academia-academic-services`, owner segment
# `srm_university`.
APP_PATH = "/srm_university/academia-academic-services"

# Zoho Creator mints its app session under this cookie once the browser lands on
# the app root after IAM login. Without it, every app URL returns the SPA shell.
APP_SESSION_COOKIE = "JSESSIONID"

# Page link names (from the browser capture). The "My Time Table & Attendance"
# menu item loads this single page: a course/registration list, no attendance
# columns. Attendance lives on a sibling page, `My_Attendance`.
PAGE_TIMETABLE = "My_Time_Table_2023_24"
PAGE_ATTENDANCE = "My_Attendance"
# Day-order enrichment pages. TODO: discover these from the portal menu instead
# of hard-coding, since the batch number and AY/semester vary per student.
# (This student: Batch 2, AY 2026-27 ODD.)
PAGE_UNIFIED_TIMETABLE = "Unified_Time_Table_2025_batch_2"
PAGE_ACADEMIC_PLANNER = "Academic_Planner_2026_27_ODD"


def page_url(page_name: str) -> str:
    """Path for a Creator page, e.g. page_url('My_Attendance')."""
    return f"{APP_PATH}/page/{page_name}"


# Headers a real browser sends when the SPA fetches a Creator page. The
# X-Requested-With marks it as the in-app XHR; without it the server may return
# the shell or a redirect instead of the page fragment.
APP_PAGE_HEADERS = {
    "X-Requested-With": "XMLHttpRequest",
    "Referer": f"{BASE_URL}/",
}

# A desktop UA. The portal is fine with httpx's default too, but be explicit.
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)


# Per-request ceiling. A single portal call that hangs longer than this is not
# coming back in time to be useful.
REQUEST_TIMEOUT = 25.0

# Wall-clock allowance for one whole portal round trip (login plus pages). On a
# serverless host this MUST leave room for the platform's function limit AND for
# the logout that follows it, or we get killed during the very cleanup the
# budget exists to protect:
#
#     TIME_BUDGET + _LOGOUT_GRACE (6s) + headroom  <=  maxDuration
#
# The default suits Vercel's maxDuration of 60 in vercel.json. Raise both
# together, never one alone. See Budget for why this matters at all.
TIME_BUDGET = float(os.environ.get("SKIPP_TIME_BUDGET", "45"))


class TimeBudgetExceeded(Exception):
    """The wall-clock allowance for one portal round trip ran out."""


class Budget:
    """A wall-clock allowance for one portal round trip.

    A serverless platform kills a function at a hard limit, with no chance to
    clean up. A scrape killed mid-flight never reaches `Session.close()`, so the
    Zoho session stays open; two of those trip the portal's 2-session concurrent
    block, which the student has no way to clear and no way to understand.

    So we stop ourselves first, while there is still time to log out properly.
    A budget that has run out is a clean 504, not a locked account.
    """

    def __init__(self, seconds: float | None = None) -> None:
        self._deadline: float | None = (
            None if not seconds or seconds <= 0 else time.monotonic() + seconds
        )

    def remaining(self) -> float | None:
        """Seconds left, or None when this budget is unlimited."""
        if self._deadline is None:
            return None
        return self._deadline - time.monotonic()

    def reopen(self, seconds: float) -> None:
        """Grant a fresh slice so the logout can still run after we give up.

        Without this the guard would block `close()`, the one request that most
        needs to happen when we are out of time.
        """
        if self._deadline is not None:
            self._deadline = time.monotonic() + seconds


def _guard(budget: Budget):
    """Refuse to start a request the budget cannot pay for, and cap the ones it can."""

    def hook(request: httpx.Request) -> None:
        left = budget.remaining()
        if left is None:
            return
        if left <= 0:
            raise TimeBudgetExceeded(
                "The portal took too long to answer."
            )
        # Clamp this request so it cannot outlive the budget on its own.
        t = min(REQUEST_TIMEOUT, left)
        request.extensions["timeout"] = {
            "connect": t,
            "read": t,
            "write": t,
            "pool": t,
        }

    return hook


def new_client(budget: Budget | None = None) -> httpx.Client:
    """A fresh httpx client with a cookie jar, redirects on, sane timeout.

    One client == one login session. Never share across users; the cookie jar
    holds the authenticated session and must die with the request.

    With a budget, every request (including redirect hops) is checked against
    the remaining wall clock before it is sent.
    """
    return httpx.Client(
        base_url=BASE_URL,
        follow_redirects=True,
        timeout=REQUEST_TIMEOUT,
        headers={"User-Agent": USER_AGENT},
        event_hooks={"request": [_guard(budget)]} if budget else {},
    )
