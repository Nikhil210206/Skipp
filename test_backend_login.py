import asyncio
import time
from core.student_portal_client import init_login_session, submit_login_and_fetch
from models.student_portal import StudentPortalLoginRequest

def test():
    print("Init session...")
    init_data = init_login_session()
    print("Got cookies:", init_data.session_cookie)
    
    print("Waiting 10 seconds to simulate user typing...")
    time.sleep(10)
    
    req_data = StudentPortalLoginRequest(
        username="nb6938",
        password="Password123",
        captcha="WRONGX",
        sessionCookie=init_data.session_cookie,
        random_delim=init_data.random_delim,
        domain_field=init_data.domain_field,
        captcha_field=init_data.captcha_field
    )
    
    try:
        submit_login_and_fetch(req_data)
    except Exception as e:
        print("Error:", repr(e))

test()
