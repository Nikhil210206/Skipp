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
import re

from core.session import (
    InvalidCredentials,
    PortalError,
    UserNotFound,
    login,
)

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
    print("  session cookies (after handoff):", list(session.client.cookies.keys()))
    os.makedirs(CAPTURE_DIR, exist_ok=True)

    # Inspect the post-login "pre-announcement" interstitial — it may need a
    # 'proceed'/'skip' action before the academia app session is granted.
    pa = (session.password_response or {}).get("passwordauth") or {}
    inter = pa.get("redirect_uri")
    if inter:
        r = session.client.get(inter, headers={"Referer": inter})
        body = r.text
        print(f"\n  interstitial {inter}\n    status={r.status_code} bytes={len(body)}")
        for label, pat in [
            ("links", r'<a[^>]+href="([^"]+)"'),
            ("forms", r'<form[^>]+action="([^"]+)"'),
            ("meta-refresh", r'http-equiv="refresh"[^>]+content="[^"]*url=([^"]+)"'),
            ("js-redirect", r'location\.(?:href|replace)\s*=?\s*[\("]([^"\')]+)'),
        ]:
            hits = re.findall(pat, body, re.I)[:6]
            if hits:
                print(f"    {label}: {hits}")
        for word in ("proceed", "skip", "continue", "announcement", "block"):
            if word in body.lower():
                print(f"    contains word: '{word}'")
        with open(os.path.join(CAPTURE_DIR, "interstitial.html"), "w") as f:
            f.write(body)
        print("    wrote captures/interstitial.html")

    # The portal is a Zoho Creator SPA. `GET /` returns only the shell (~9KB).
    # Real pages live under the app path. Probe candidate attendance URLs and
    # report which return substantial, non-shell content.
    candidates = [
        # app roots — likely to list the real page links even if the guesses miss
        "/srm_university/academia-academic-services/",
        "/49910842/academia-academic-services/",
        # attendance guesses
        "/srm_university/academia-academic-services/page/My_Attendance",
        "/srm_university/academia-academic-services/page-perma/My_Attendance",
        "/49910842/academia-academic-services/page/My_Attendance",
        "/",
    ]
    discovered: set[str] = set()
    print("\n  probing candidate pages:")
    for url in candidates:
        try:
            r = session.client.get(url)
        except Exception as e:  # noqa: BLE001
            print(f"    {url}\n      ERROR {type(e).__name__}: {e}")
            continue
        body = r.text
        keywords = [k for k in ("attendance", "Course Code", "Hours Conducted",
                                 "Attn %", "timetable") if k.lower() in body.lower()]
        looks_like_shell = len(body) < 12000
        flag = "SHELL/EMPTY" if looks_like_shell and not keywords else "★ DATA?"
        print(f"    {url}\n      status={r.status_code} bytes={len(body)} "
              f"keywords={keywords} [{flag}]")
        if keywords or not looks_like_shell:
            safe = url.strip("/").replace("/", "_") or "root"
            path = os.path.join(CAPTURE_DIR, f"{safe}.html")
            with open(path, "w") as f:
                f.write(body)
            print(f"      wrote {path}")
        # Self-discovery: pull any internal page/perma links out of every body.
        for m in re.finditer(r"(page-perma|page|perma)/([A-Za-z0-9_]+)", body):
            discovered.add(m.group(0))

    print("\n  discovered page links across all responses:")
    for d in sorted(discovered):
        print(f"    {d}")
    if not discovered:
        print("    (none — the SPA loads pages via JS; use the DevTools method)")

    print("\n  → paste the probe table + discovered links above. Any line marked "
          "★ DATA? (or with keywords) is our attendance page.")
    session.close()


if __name__ == "__main__":
    main()
