from core.student_portal_client import submit_login_and_fetch
from models.student_portal import StudentPortalLoginRequest

try:
    req = StudentPortalLoginRequest(
        username="nb6938",
        password="Password123",
        captcha="TEST",
        sessionCookie="JSESSIONID=123",
        domain_field="df",
        captcha_field="cf",
        random_delim="rd"
    )
    submit_login_and_fetch(req)
except Exception as e:
    import traceback
    traceback.print_exc()
