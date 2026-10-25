import asyncio
import base64
import logging
import re
from typing import Tuple, Optional
import ddddocr

from core.student_portal_client import (
    PortalSession,
    StudentPortalClientError,
)

log = logging.getLogger("skipp.api.sp_auto")

ocr = ddddocr.DdddOcr(show_ad=False)

async def auto_login_and_fetch(username: str, password: str) -> Tuple[str, Optional[str], Optional[str], str]:
    """
    Attempts to login to the student portal automatically by solving the CAPTCHA.
    Limits submissions to at most 1 attempt to ensure we never risk hitting SRM's account lockout.
    """
    clean_username = username.strip().lower()
    if "@" in clean_username:
        clean_username = clean_username.split("@")[0].strip()

    max_captcha_fetches = 4
    submissions_done = 0
    last_error = None

    for fetch_attempt in range(max_captcha_fetches):
        if submissions_done >= 1:
            break

        session = PortalSession()
        try:
            log.info(f"Auto-login captcha fetch {fetch_attempt + 1} for {clean_username}")
            info = await session.load_captcha()
            if not session.captcha_bytes:
                continue

            raw_captcha = ocr.classification(session.captcha_bytes)
            captcha_text = re.sub(r"[^a-zA-Z0-9]", "", raw_captcha).strip()

            if len(captcha_text) != 6:
                log.info(f"Fetch {fetch_attempt + 1}: OCR returned invalid length {len(captcha_text)} ({captcha_text}), refreshing captcha...")
                continue

            submissions_done += 1
            log.info(f"Submitting login attempt {submissions_done}/1 for {clean_username} with captcha '{captcha_text}'")
            res = await session.login(clean_username, password, captcha_text)

            if res.get("ok"):
                att_html, marks_html, tt_html = await asyncio.gather(
                    session.get_attendance_html(),
                    session.get_marks_html(),
                    session.get_timetable_html(),
                )
                cookie_str = "; ".join(f"{c.name}={c.value}" for c in session.client.cookies.jar)
                return att_html or "", marks_html, tt_html, cookie_str

            reason = res.get("reason", "login_failed")
            msg = res.get("message", "Login failed")
            if reason == "wrong_captcha":
                last_error = StudentPortalClientError("Invalid captcha.")
                continue
            if reason == "account_locked":
                raise StudentPortalClientError("Your account has been temporarily locked due to multiple unsuccessful attempts. Please try again after 5 minutes.")
            if reason == "invalid_credentials":
                raise StudentPortalClientError(f"Incorrect NetID or password ({msg}). Note that your Student Portal password is your SRM student email password, often different from your Academia password.")
            raise StudentPortalClientError(msg)

        except StudentPortalClientError as e:
            if "captcha" in str(e).lower():
                last_error = e
                continue
            raise

    if last_error:
        raise last_error
    raise StudentPortalClientError("Failed to solve portal CAPTCHA. Please enter the captcha manually.")
