"""httpx client wrapper + portal constants for the SRM academia (Zoho) portal.

Everything here was derived by inspecting the live login flow (Phase 1 spike),
not copied from any third-party project. See PLAN.md for the flow write-up.
"""
from __future__ import annotations

import httpx

BASE_URL = "https://academia.srmist.edu.in"

# Zoho IAM org prefix for SRM academia. Found in the signin page JS as
# `uriPrefix = '/accounts/p/40-10002227248'`.
IAM_PREFIX = "/accounts/p/40-10002227248"

# The signin page is embedded as an iframe pointing at this Zoho IAM endpoint.
SIGNIN_PAGE = (
    f"{IAM_PREFIX}/signin"
    "?hide_fp=true&orgtype=40&service_language=en&dcc=true"
)

# Zoho signin params appended to lookup/password requests (from getSigninParms()).
ORG_TYPE = "40"
SERVICE_LANGUAGE = "en"

# Double-submit CSRF: value of the `iamcsr` cookie is echoed back in this header
# as `iamcsrcoo=<value>` (from signin.js: X-ZCSRF-TOKEN, csrfParam=iamcsrcoo).
CSRF_COOKIE = "iamcsr"
CSRF_PARAM = "iamcsrcoo"

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
