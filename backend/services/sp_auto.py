import base64
import logging
from typing import Tuple, Optional

from core.student_portal_client import (
    init_login_session,
    submit_login_and_fetch,
    StudentPortalClientError,
)
from models.student_portal import StudentPortalLoginRequest
import ddddocr

log = logging.getLogger("skipp.api.sp_auto")

# Initialize ddddocr globally so it doesn't reload the model on every request
ocr = ddddocr.DdddOcr(show_ad=False)

def auto_login_and_fetch(username: str, password: str) -> Tuple[str, Optional[str], Optional[str]]:
    """
    Attempts to login to the student portal automatically by solving the CAPTCHA.
    Limits submissions to at most 2 attempts to ensure we never hit SRM's 3-attempt account lockout.
    """
    max_captcha_fetches = 5
    max_submissions = 2
    submissions_done = 0
    last_error = None

    for fetch_attempt in range(max_captcha_fetches):
        if submissions_done >= max_submissions:
            break

        try:
            log.info(f"Auto-login captcha fetch {fetch_attempt + 1} for {username}")
            
            # 1. Initialize session and get captcha
            session_data = init_login_session()
            
            # 2. Decode the captcha image base64
            b64_str = session_data.captcha_base64.split(",", 1)[1]
            image_bytes = base64.b64decode(b64_str)
            
            # 3. Solve the captcha
            raw_captcha = ocr.classification(image_bytes)
            import re
            captcha_text = re.sub(r"[^a-zA-Z0-9]", "", raw_captcha).strip()
            
            # SRM student portal captchas are strictly 6 alphanumeric characters.
            # If OCR returned anything other than 6 characters, do not submit a guaranteed failure.
            if len(captcha_text) != 6:
                log.info(f"Fetch {fetch_attempt + 1}: OCR returned invalid length {len(captcha_text)} ({captcha_text}), refreshing captcha...")
                continue
            
            # 4. Submit login (counts toward max_submissions)
            submissions_done += 1
            log.info(f"Submitting login attempt {submissions_done}/{max_submissions} for {username} with captcha '{captcha_text}'")
            req = StudentPortalLoginRequest(
                username=username,
                password=password,
                captcha=captcha_text,
                session_cookie=session_data.session_cookie,
                domain_field=session_data.domain_field,
                captcha_field=session_data.captcha_field,
                random_delim=session_data.random_delim,
                honeypot_field=session_data.honeypot_field,
                page_load_time=session_data.page_load_time
            )
            
            return submit_login_and_fetch(req)
            
        except StudentPortalClientError as e:
            error_msg = str(e).lower()
            if "captcha" in error_msg or "unknown response" in error_msg:
                log.info(f"CAPTCHA / portal response failed on submission {submissions_done}: {e}")
                last_error = e
                continue
            else:
                # Other errors (e.g., invalid credentials, account locked) should fail immediately
                raise

    if last_error:
        raise last_error
    raise StudentPortalClientError("Failed to solve portal CAPTCHA. Please try again or sign in manually.")
