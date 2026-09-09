import sys
from models.student_portal import StudentPortalLoginRequest
from core.student_portal_client import init_login_session, submit_login_and_fetch, StudentPortalClientError

try:
    print("Initializing session...")
    captcha_data = init_login_session()
    print("Session initialized.")
    req = StudentPortalLoginRequest(
        username="dummy_user",
        password="dummy_password",
        captcha="123456",
        session_cookie=captcha_data.session_cookie,
        domain_field=captcha_data.domain_field,
        captcha_field=captcha_data.captcha_field,
        random_delim=captcha_data.random_delim,
        honeypot_field=captcha_data.honeypot_field
    )
    print("Submitting login...")
    submit_login_and_fetch(req)
except StudentPortalClientError as e:
    print("Client Error:", e)
except Exception as e:
    print("Other Error:", e)
