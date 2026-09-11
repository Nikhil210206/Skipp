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

def auto_login_and_fetch(username: str, password: str) -> Tuple[str, Optional[str]]:
    """
    Attempts to login to the student portal automatically by solving the CAPTCHA.
    Retries up to 5 times if the CAPTCHA is invalid.
    """
    max_retries = 5
    last_error = None

    for attempt in range(max_retries):
        try:
            log.info(f"Auto-login attempt {attempt + 1} for {username}")
            
            # 1. Initialize session and get captcha
            session_data = init_login_session()
            
            # 2. Decode the captcha image base64
            b64_str = session_data.captcha_base64.split(",", 1)[1]
            image_bytes = base64.b64decode(b64_str)
            
            # 3. Solve the captcha
            captcha_text = ocr.classification(image_bytes)
            
            # 4. Submit login
            req = StudentPortalLoginRequest(
                username=username,
                password=password,
                captcha=captcha_text,
                session_cookie=session_data.session_cookie,
                domain_field=session_data.domain_field,
                captcha_field=session_data.captcha_field,
                random_delim=session_data.random_delim,
                honeypot_field=session_data.honeypot_field
            )
            
            return submit_login_and_fetch(req)
            
        except StudentPortalClientError as e:
            error_msg = str(e).lower()
            if "captcha" in error_msg:
                log.info(f"CAPTCHA solve failed on attempt {attempt + 1}")
                last_error = e
                continue
            else:
                # Other errors (e.g., invalid credentials) should fail immediately
                raise

    raise StudentPortalClientError(f"Failed to solve CAPTCHA after {max_retries} attempts.")
