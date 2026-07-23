"""SRM academia (Zoho IAM) login flow.

Reverse-engineered from the live signin page during the Phase 1 spike:

  1. GET the signin page  -> sets the `iamcsr` CSRF cookie (+ session cookies).
  2. POST /signin/v2/lookup/<netid>  with `mode=primary` + signin params
     -> resolves the user to a `zuid` and a one-time `digest`.
  3. POST /signin/v2/primary/<zuid>/password?digest=...  with JSON body
     {"passwordauth":{"password": ...}}  -> authenticates; sets auth cookies.

Password encryption is DISABLED on this portal (encryption/script ships
`encryptData.enabled = Boolean("")` == false), so the password is sent as
plaintext over HTTPS — no client-side RSA step required.

Security: the password is only ever an argument here, held in memory for the
duration of one call. Never log it, never persist it, never write it to disk.
"""
from __future__ import annotations

import logging
import os
import re
import time
from dataclasses import dataclass
from urllib.parse import quote, urlsplit

import httpx

# Temporary Phase-2 diagnostics. Logs cookie NAMES only (never values) and dumps
# interstitial/shell HTML to gitignored captures/. Remove once login is robust.
log = logging.getLogger("skipp.session")
_DEBUG = os.environ.get("SKIPP_DEBUG_LOGIN") == "1"
_DEBUG_DIR = "captures"
_APP_TOKEN_PREFIX = "_iamadt_client_"


def _has_app_token(client: httpx.Client) -> bool:
    return any(k.startswith(_APP_TOKEN_PREFIX) for k in client.cookies.keys())


def _dump(name: str, text: str) -> None:
    if not _DEBUG:
        return
    try:
        os.makedirs(_DEBUG_DIR, exist_ok=True)
        with open(os.path.join(_DEBUG_DIR, name), "w") as f:
            f.write(text)
    except OSError:
        pass

from .client import (
    APP_PAGE_HEADERS,
    APP_SESSION_COOKIE,
    BASE_URL,
    CSRF_COOKIE,
    CSRF_PARAM,
    IAM_PREFIX,
    ORG_TYPE,
    SERVICE_LANGUAGE,
    SIGNIN_PAGE,
    new_client,
    page_url,
)

# The portal appends this domain to whatever the user types (client-side
# `LOGIN_ID + domainselect`). So the lookup identifier is the full SRM email.
DEFAULT_DOMAIN = "srmist.edu.in"


def normalize_netid(netid: str) -> str:
    """Turn a bare net id into the full email the lookup endpoint expects.

    `ab1234` -> `ab1234@srmist.edu.in`; an already-full email is left as-is.
    """
    netid = netid.strip()
    return netid if "@" in netid else f"{netid}@{DEFAULT_DOMAIN}"


class LoginError(Exception):
    """Base class for login failures — surfaced to the API as typed 4xx."""


class UserNotFound(LoginError):
    """The SRM net id does not exist (lookup step)."""


class InvalidCredentials(LoginError):
    """Wrong password (password step)."""


class CaptchaRequired(LoginError):
    """Zoho IAM is demanding a CAPTCHA (HIP), usually after repeated attempts.

    Can't be solved headlessly. The caller should back off and retry later;
    interactive CAPTCHA solving is a future enhancement.
    """


class SignInLimitReached(LoginError):
    """Zoho's per-account daily sign-in cap (code SI503).

    A hard limit that resets after ~24h — no login is possible until then. The
    on-device session persistence exists partly to avoid burning sign-ins.
    """


class PortalError(LoginError):
    """Portal returned something we didn't expect (shape change / outage)."""


class PageError(Exception):
    """Base class for Creator-page fetch failures (post-login)."""


class PageInaccessible(PageError):
    """The page exists but the SRM admin has it disabled (HTTP 403).

    Seen at semester start: `My_Attendance` returns "Page inaccessible … contact
    your administrator" until attendance is actually being recorded. Not our bug
    and not the student's — surface it as a friendly "not available yet".
    """


class PageNotFound(PageError):
    """The page name doesn't exist for this account (HTTP 404)."""


class AppSessionError(PageError):
    """A page fetch came back as the login/SPA shell, not a Creator page.

    Means the session lacks the academia app-authorization token
    (`_iamadt_client_<zaid>` family) even though IAM login succeeded — so the
    Creator app treats us as logged out and returns its login shell (HTTP 200).
    """


# Signature of the portal's login shell — its <title> when unauthenticated.
_LOGIN_SHELL_MARKER = "Academic Web Services Login"


@dataclass
class Session:
    """An authenticated portal session. Wraps the live httpx client.

    Callers use `session.client` for subsequent authed requests (attendance,
    marks, timetable) and MUST call `.close()` when done (or use as a
    context manager) so the cookie jar — and the credentials-derived session —
    is destroyed promptly.
    """

    client: httpx.Client
    zuid: str
    # Raw IAM responses — kept only for the Phase 1 spike/diagnostics.
    password_response: dict | None = None

    def close(self) -> None:
        """Log out server-side (best-effort) then drop the local cookie jar.

        Releasing the IAM session keeps us well under Zoho's 2-session concurrent
        limit, so scrapes don't pile up sessions and trip the block page.
        """
        try:
            self.client.get(
                f"{IAM_PREFIX}/logout",
                params={"serviceurl": BASE_URL},
            )
        except httpx.HTTPError:
            pass
        finally:
            self.client.close()

    def __enter__(self) -> "Session":
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    @property
    def has_app_session(self) -> bool:
        """True once the Zoho Creator app session cookie (JSESSIONID) is held."""
        return bool(self.client.cookies.get(APP_SESSION_COOKIE))

    def fetch_page(self, page_name: str) -> str:
        """Fetch a Creator page's raw HTML (the SPA fragment for one section).

        Sends the in-app XHR headers + the full authenticated cookie jar. Raises
        PageInaccessible (403, admin-disabled) or PageNotFound (404); returns the
        response text on 200. Parsing lives in `services/`.
        """
        resp = self.client.get(page_url(page_name), headers=APP_PAGE_HEADERS)
        if resp.status_code == 403:
            raise PageInaccessible(
                f"'{page_name}' is currently unavailable on the portal."
            )
        if resp.status_code == 404:
            raise PageNotFound(f"'{page_name}' does not exist for this account.")
        if resp.status_code != 200:
            raise PageError(
                f"'{page_name}' returned HTTP {resp.status_code}."
            )
        if _DEBUG:
            _dump(f"page_{page_name}.html", resp.text)
        if _LOGIN_SHELL_MARKER in resp.text:
            if _DEBUG:
                log.warning(
                    "fetch_page('%s') got login shell — app_token=%s cookies=%s",
                    page_name, _has_app_token(self.client),
                    sorted(self.client.cookies.keys()),
                )
                _dump(f"shell_{page_name}.html", resp.text)
            raise AppSessionError(
                "Got the login shell instead of a Creator page — the app "
                "session lacks the academia app-authorization token."
            )
        return resp.text


def _signin_params() -> str:
    """cli_time + org params appended to lookup/password requests."""
    return (
        f"cli_time={int(time.time() * 1000)}"
        f"&orgtype={ORG_TYPE}"
        f"&service_language={SERVICE_LANGUAGE}"
    )


def _csrf_headers(client: httpx.Client) -> dict[str, str]:
    """Build the Zoho double-submit CSRF headers from the iamcsr cookie."""
    token = client.cookies.get(CSRF_COOKIE)
    if not token:
        raise PortalError("CSRF cookie missing — signin page did not load correctly.")
    return {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "X-ZCSRF-TOKEN": f"{CSRF_PARAM}={token}",
        "Referer": f"{IAM_PREFIX}/signin",
    }


def login(netid: str, password: str) -> Session:
    """Log into the portal and return an authenticated Session.

    Raises UserNotFound / InvalidCredentials / PortalError on failure.
    """
    identifier = normalize_netid(netid)
    client = new_client()
    try:
        # 1. Prime the session: fetch signin page -> iamcsr + session cookies.
        client.get(SIGNIN_PAGE, headers={"Referer": f"{client.base_url}/"})
        headers = _csrf_headers(client)
        params = _signin_params()

        # 2. Lookup: resolve identifier -> zuid + digest. `@` must be encoded.
        lookup = client.post(
            f"{IAM_PREFIX}/signin/v2/lookup/{quote(identifier, safe='')}",
            content=f"mode=primary&{params}",
            headers=headers,
        ).json()

        if lookup.get("status_code") != 201 and "lookup" not in lookup:
            code = _first_error_code(lookup)
            if code in {"U401"}:  # observed: "User does not exists"
                raise UserNotFound(lookup.get("localized_message", "Account not found."))
            _raise_if_blocked(lookup)
            raise PortalError(f"Unexpected lookup response: {lookup!r}")

        info = lookup["lookup"]
        zuid = info["identifier"]
        digest = info["digest"]

        # 3. Password: authenticate.
        pw = client.post(
            f"{IAM_PREFIX}/signin/v2/primary/{zuid}/password?digest={digest}&{params}",
            json={"passwordauth": {"password": password}},
            headers=headers,
        ).json()

        if pw.get("status_code") != 201:
            code = _first_error_code(pw)
            _raise_if_blocked(pw)
            # Zoho uses IAM error codes for bad password / lockouts.
            if code in {"IN201", "PWE1", "INVALID_PASSWORD"} or "password" in str(
                pw.get("localized_message", "")
            ).lower():
                raise InvalidCredentials(
                    pw.get("localized_message", "Incorrect password.")
                )
            raise PortalError(f"Unexpected password response: {pw!r}")

        # 4. Complete the handoff: on success (code SI303) IAM nests a
        # redirect_uri under `passwordauth`. Following it clears Zoho's
        # post-login "pre-announcement" interstitial and lands us in the
        # academia app with a full session cookie. follow_redirects handles
        # any onward 3xx hops.
        pa = pw.get("passwordauth") or {}
        redirect = (
            pa.get("redirect_uri")
            or pw.get("redirect_url")
            or pw.get("redirect_uri")
        )
        if redirect:
            _clear_announcements(client, redirect)

        # 5. Mint the Zoho Creator app session. IAM login only grants IAM
        # cookies; the app session (JSESSIONID) is set when a browser first
        # lands on the app root. Hitting `/` here does the same so subsequent
        # Creator-page fetches return real data, not the SPA shell.
        _bootstrap_app_session(client)

        if _DEBUG:
            log.warning(
                "login done: app_token=%s jsessionid=%s cookies=%s",
                _has_app_token(client),
                bool(client.cookies.get(APP_SESSION_COOKIE)),
                sorted(client.cookies.keys()),
            )

        return Session(client=client, zuid=zuid, password_response=pw)
    except httpx.HTTPError as e:  # network-level failure
        client.close()
        raise PortalError(f"Portal unreachable: {e}") from e
    except LoginError:
        client.close()
        raise


def _bootstrap_app_session(client: httpx.Client) -> None:
    """Land on the academia app root so Zoho Creator mints the app session.

    A GET of `/` returns the SPA shell but, crucially, sets the `JSESSIONID`
    (app session) cookie in the jar — the piece IAM login alone doesn't grant.
    Best-effort: a network hiccup here shouldn't fail an otherwise-good login,
    since the first real page fetch would surface any genuine session problem.
    """
    try:
        client.get("/", headers={"Referer": f"{BASE_URL}/"})
    except httpx.HTTPError:
        pass


def _first_error_code(resp: dict) -> str | None:
    errors = resp.get("errors")
    if isinstance(errors, list) and errors:
        return errors[0].get("code")
    return None


def _is_captcha(code: str | None, resp: dict) -> bool:
    """Zoho HIP (CAPTCHA) challenge — code IN108 / a 'HIP REQUIRED' message."""
    if code == "IN108":
        return True
    blob = f"{resp.get('message', '')} {resp.get('localized_message', '')}".lower()
    return "hip" in blob or "captcha" in blob


def _is_signin_limit(code: str | None, resp: dict) -> bool:
    """Zoho daily sign-in cap — code SI503 / 'maximum sign-in threshold'."""
    if code == "SI503":
        return True
    blob = f"{resp.get('message', '')} {resp.get('localized_message', '')}".lower()
    return "sign-in threshold" in blob or "sign-in limit" in blob


def _raise_if_blocked(resp: dict) -> None:
    """Raise the typed anti-automation error for a lookup/password response."""
    code = _first_error_code(resp)
    if _is_captcha(code, resp):
        raise CaptchaRequired(
            "The portal is asking for a CAPTCHA (too many recent attempts). "
            "Wait a while and try again."
        )
    if _is_signin_limit(code, resp):
        raise SignInLimitReached(
            "You've hit the portal's daily sign-in limit. It resets after about "
            "a day — try again tomorrow."
        )


# Matches Zoho's post-login announcement continuation, e.g.
# /accounts/p/40-10002227248/preannouncement/block-sessions/next
_ANNOUNCE_NEXT = re.compile(r'(/accounts/[^"\']*?/preannouncement/[^"\']*?/next)')

# The concurrent-session block page ships this JS fn; its presence means IAM
# won't proceed until we terminate the account's other active sessions.
_CONCURRENT_BLOCK_MARKER = "terminateAllSession"
# DELETE endpoint that clears the concurrent-session block (from the page's JS).
_BLOCKSESSIONS_ENDPOINT = f"{IAM_PREFIX}/webclient/v1/announcement/pre/blocksessions"


def _clear_announcements(client: httpx.Client, redirect: str, max_hops: int = 6) -> None:
    """Walk Zoho's post-login pre-announcement interstitial(s).

    After password success IAM parks you on a "pre-announcement" page whose
    only real content is a JS redirect to `.../next`. Following that chain
    finalizes the login and grants the academia (Creator) app session cookies.

    If the account has hit Zoho's concurrent-session limit, that page is instead
    a "Maximum concurrent sessions" block whose `.../next` bounces back to
    itself. We terminate the account's other sessions (the page's own
    "Terminate All Sessions" action) once, then continue.
    """
    url = redirect
    terminated = False
    for hop in range(max_hops):
        resp = client.get(url, headers={"Referer": url})
        body = resp.text
        if _DEBUG:
            log.warning(
                "handoff hop %d: %s -> %d (app_token=%s)",
                hop, urlsplit(str(resp.url)).path, resp.status_code,
                _has_app_token(client),
            )
            _dump(f"handoff_hop{hop}.html", body)

        if _CONCURRENT_BLOCK_MARKER in body and not terminated:
            _terminate_block_sessions(client)
            terminated = True  # only ever do this once, then re-follow .../next
            m = _ANNOUNCE_NEXT.search(body)
            url = BASE_URL + m.group(1) if m else url + "/next"
            continue

        m = _ANNOUNCE_NEXT.search(body)
        if not m:
            break  # no further announcement step — we've landed in the app
        url = BASE_URL + m.group(1)


def _terminate_block_sessions(client: httpx.Client) -> None:
    """Clear the concurrent-session block (Zoho's "Terminate All Sessions").

    Sends the same DELETE the page's JS does, with the double-submit CSRF header.
    Note: this ends the account's *other* active portal sessions (phone/browser).
    We keep our own footprint small by logging out after each request (see
    Session.close), so this rarely fires in practice.
    """
    token = client.cookies.get(CSRF_COOKIE)
    headers = {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
    }
    if token:
        headers["X-ZCSRF-TOKEN"] = f"{CSRF_PARAM}={token}"
    try:
        resp = client.request("DELETE", _BLOCKSESSIONS_ENDPOINT, headers=headers)
        if _DEBUG:
            log.warning("terminate sessions -> %d", resp.status_code)
    except httpx.HTTPError as e:
        if _DEBUG:
            log.warning("terminate sessions failed: %s", e)
