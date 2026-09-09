import sys
from models.student_portal import StudentPortalLoginRequest
from core.student_portal_client import init_login_session, _get_opener, LOGIN_SUBMIT_URL, UA, SP_BASE_URL, LOGIN_PAGE_URL
import urllib.parse
import urllib.request
import base64
import time
import json
import http.cookiejar

print("Initializing session...")
captcha_data = init_login_session()
print("Session initialized.")

req_data = StudentPortalLoginRequest(
    username="dummy_user",
    password="dummy_password",
    captcha="123456",
    session_cookie=captcha_data.session_cookie,
    domain_field=captcha_data.domain_field,
    captcha_field=captcha_data.captcha_field,
    random_delim=captcha_data.random_delim,
    honeypot_field=captcha_data.honeypot_field
)

domain_value = base64.b64encode("ni.ude.tsimrs.ps".encode()).decode()
trap_payload = f"12{req_data.random_delim}5"
captcha_trap_value = base64.b64encode(trap_payload.encode()).decode()

t_now = int(time.time() * 1000)
payload_json = json.dumps({
    "startTime": t_now - 12000,
    "currentDomain": "sp.srmist.edu.in",
    "timezoneOffset": -330,
    "screenWidth": 1440,
    "screenHeight": 900,
    "colorDepth": 24,
    "devicePixelRatio": 2,
    "userAgent": UA,
    "platform": "Win32",
    "language": "en-US",
    "deviceMemory": 8,
    "hardwareConcurrency": 8,
    "touchSupport": False,
    "webdriver": False,
    "mouseClicks": 1,
    "mouseMovements": 3,
    "keystrokeCount": 2,
    "typingSpeedMs": 1500,
    "canvasHash": "58bc8d31",
    "submitTime": t_now,
    "timeOnPageMs": 12000
}, separators=(',', ':'))
telemetry_payload = base64.b64encode(payload_json.encode('utf-8')).decode('utf-8')

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

cj = http.cookiejar.CookieJar()
chosen_proxy = None
if req_data.session_cookie:
    for part in req_data.session_cookie.split(';'):
        part = part.strip()
        if '=' in part:
            k, v = part.split('=', 1)
            if k == 'SKIPP_PROXY_ID':
                chosen_proxy = v
                continue
            ck = http.cookiejar.Cookie(version=0, name=k, value=v, port=None, port_specified=False, domain='sp.srmist.edu.in', domain_specified=False, domain_initial_dot=False, path='/', path_specified=False, secure=False, expires=None, discard=True, comment=None, comment_url=None, rest={'HttpOnly': None}, rfc2109=False)
            cj.set_cookie(ck)

opener, _ = _get_opener(cj, force_proxy=chosen_proxy)
req_post = urllib.request.Request(LOGIN_SUBMIT_URL, data=encoded_data, headers={
    'User-Agent': UA,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Origin': SP_BASE_URL,
    'Referer': LOGIN_PAGE_URL
})

res_post = opener.open(req_post)
result_html = res_post.read().decode('utf-8', errors='ignore')

print("RESULT LENGTH:", len(result_html))
if "JavaScript is required" in result_html:
    print("WARNING: WAF BLOCKED IT!")
    print(result_html[:500])
else:
    print("WAF PASSED!")
