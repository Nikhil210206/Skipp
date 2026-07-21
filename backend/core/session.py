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

import re
import time
from dataclasses import dataclass
from urllib.parse import quote

import httpx

from .client import (
    BASE_URL,
    CSRF_COOKIE,
    CSRF_PARAM,
    IAM_PREFIX,
    ORG_TYPE,
    SERVICE_LANGUAGE,
    SIGNIN_PAGE,
    new_client,
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


class PortalError(LoginError):
    """Portal returned something we didn't expect (shape change / outage)."""


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
        self.client.close()

    def __enter__(self) -> "Session":
        return self

    def __exit__(self, *exc) -> None:
        self.close()


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

        return Session(client=client, zuid=zuid, password_response=pw)
    except httpx.HTTPError as e:  # network-level failure
        client.close()
        raise PortalError(f"Portal unreachable: {e}") from e
    except LoginError:
        client.close()
        raise


def _first_error_code(resp: dict) -> str | None:
    errors = resp.get("errors")
    if isinstance(errors, list) and errors:
        return errors[0].get("code")
    return None


# Matches Zoho's post-login announcement continuation, e.g.
# /accounts/p/40-10002227248/preannouncement/block-sessions/next
_ANNOUNCE_NEXT = re.compile(r'(/accounts/[^"\']*?/preannouncement/[^"\']*?/next)')


def _clear_announcements(client: httpx.Client, redirect: str, max_hops: int = 5) -> None:
    """Walk Zoho's post-login pre-announcement interstitial(s).

    After password success IAM parks you on a "pre-announcement" page whose
    only real content is a JS redirect to `.../next`. Following that chain
    finalizes the login and grants the academia (Creator) app session cookies.
    """
    url = redirect
    for _ in range(max_hops):
        resp = client.get(url, headers={"Referer": url})
        m = _ANNOUNCE_NEXT.search(resp.text)
        if not m:
            break  # no further announcement step — we've landed in the app
        url = BASE_URL + m.group(1)
