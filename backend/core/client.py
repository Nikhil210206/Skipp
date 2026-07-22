"""httpx client wrapper + portal constants for the SRM academia (Zoho) portal.

Everything here was derived by inspecting the live login flow (Phase 1 spike),
not copied from any third-party project. See PLAN.md for the flow write-up.
"""
from __future__ import annotations

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
# redirect and never grants the app token — leaving only the SPA login shell.
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
# menu item loads this single page — a course/registration list, no attendance
# columns. Attendance lives on a sibling page, `My_Attendance`.
PAGE_TIMETABLE = "My_Time_Table_2023_24"
PAGE_ATTENDANCE = "My_Attendance"


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

# A desktop UA — the portal is fine with httpx's default too, but be explicit.
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)


def new_client() -> httpx.Client:
    """A fresh httpx client with a cookie jar, redirects on, sane timeout.

    One client == one login session. Never share across users; the cookie jar
    holds the authenticated session and must die with the request.
    """
    return httpx.Client(
        base_url=BASE_URL,
        follow_redirects=True,
        timeout=25.0,
        headers={"User-Agent": USER_AGENT},
    )
