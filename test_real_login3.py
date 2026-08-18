import asyncio
from core.student_portal_client import init_login_session, submit_login_and_fetch
from models.student_portal import StudentPortalLoginRequest

def test():
    print("Init session...")
    init_data = init_login_session()
    
    with open("captcha3.png", "wb") as f:
        import base64
        f.write(base64.b64decode(init_data.captcha_base64.split(",")[1]))
        
    print("Captcha saved to captcha3.png")
    captcha = input("Enter captcha: ")
    
    req_data = StudentPortalLoginRequest(
        username="nb6938",
        password="Password123",
        captcha=captcha,
        sessionCookie=init_data.session_cookie,
        random_delim=init_data.random_delim,
        domain_field=init_data.domain_field,
        captcha_field=init_data.captcha_field
    )
    
    try:
        res = submit_login_and_fetch(req_data)
        print("Success:", type(res))
    except Exception as e:
        print("Error:", repr(e))

test()
