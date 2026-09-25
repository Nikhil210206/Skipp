import sys
import base64
import urllib.request
import urllib.parse
import time
sys.path.append('/Users/nikhil/Documents/Skipp/backend')

from core.student_portal_client import init_login_session, StudentPortalClientError, _get_opener, SP_BASE_URL, UA
from models.student_portal import StudentPortalLoginRequest

def test_bad_captcha_loop():
    for i in range(10):
        print(f"--- Attempt {i+1} ---")
        session_data = init_login_session()
        captcha_text = "abcdef"
        req_data = StudentPortalLoginRequest(
            username="ab1234",
            password="dummy_password",
            captcha=captcha_text,
            session_cookie=session_data.session_cookie,
            domain_field=session_data.domain_field,
            captcha_field=session_data.captcha_field,
            random_delim=session_data.random_delim,
            honeypot_field=session_data.honeypot_field
        )
        domain_value = base64.b64encode("ni.ude.tsimrs.ps".encode()).decode()
        trap_payload = f"12{req_data.random_delim}5"
        captcha_trap_value = base64.b64encode(trap_payload.encode()).decode()
        telemetry_payload = base64.b64encode(b"{}").decode('utf-8')
        form_data = {
            'username': req_data.username,
            'password': req_data.password,
            'captcha': req_data.captcha,
            req_data.domain_field: domain_value,
            req_data.captcha_field: captcha_trap_value,
            req_data.honeypot_field: '',
            'fpPayload': '',
            'fpToken': '',
            'telemetryPayload': telemetry_payload
        }
        encoded_data = urllib.parse.urlencode(form_data).encode()
        import http.cookiejar
        cj = http.cookiejar.CookieJar()
        for part in req_data.session_cookie.split(';'):
            part = part.strip()
            if '=' in part:
                k, v = part.split('=', 1)
                if k == 'SKIPP_PROXY_ID': continue
                ck = http.cookiejar.Cookie(version=0, name=k, value=v, port=None, port_specified=False, domain='sp.srmist.edu.in', domain_specified=False, domain_initial_dot=False, path='/', path_specified=False, secure=False, expires=None, discard=True, comment=None, comment_url=None, rest={'HttpOnly': None}, rfc2109=False)
                cj.set_cookie(ck)
                
        opener, _ = _get_opener(cj, force_proxy="DIRECT")
        
        LOGIN_SUBMIT_URL = f"{SP_BASE_URL}/srmiststudentportal/LoginServlet"
        
        req_post = urllib.request.Request(LOGIN_SUBMIT_URL, data=encoded_data, headers={
            'User-Agent': UA,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': SP_BASE_URL,
            'Referer': "https://sp.srmist.edu.in/srmiststudentportal/students/loginManager/youLogin.jsp"
        })
        res_post = opener.open(req_post, timeout=5)
        result_html = res_post.read().decode('utf-8', errors='ignore')
        
        if "temporarily locked" in result_html.lower():
            print("RESULT: Account temporarily locked")
        elif "invalid credentials" in result_html.lower() or "invalid login credentials" in result_html.lower():
            print("RESULT: Invalid credentials found in HTML")
        elif "invalid captcha" in result_html.lower():
            print("RESULT: Invalid Captcha found in HTML")
        else:
            print("RESULT: other")
            
        time.sleep(1)

test_bad_captcha_loop()
