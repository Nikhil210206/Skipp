import urllib.request
import urllib.parse
import base64
import sys

sys.path.append('/Users/nikhil/Documents/Skipp/backend')
from core.student_portal_client import init_login_session

UA = "Mozilla/5.0"
LOGIN_PAGE_URL = "https://sp.srmist.edu.in/srmiststudentportal/students/loginManager/youLogin.jsp"
LOGIN_SUBMIT_URL = "https://sp.srmist.edu.in/srmiststudentportal/students/loginManager/youLogin.jsp"

session = init_login_session()
domain_value = base64.b64encode("ni.ude.tsimrs.ps".encode()).decode()
captcha_trap_value = base64.b64encode("12_5".encode()).decode()
telemetry_payload = base64.b64encode(b"{}").decode('utf-8')

form_data = {
    'username': 'ab1234',
    'password': 'dummy_password',
    'captcha': '123456', # dummy captcha
    session.domain_field: domain_value,
    session.captcha_field: captcha_trap_value,
    session.honeypot_field: '',
    'fpPayload': '',
    'fpToken': '',
    'telemetryPayload': telemetry_payload
}

encoded_data = urllib.parse.urlencode(form_data).encode()
req_post = urllib.request.Request(LOGIN_SUBMIT_URL, data=encoded_data, headers={
    'User-Agent': UA,
    'Cookie': session.session_cookie,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Origin': "https://sp.srmist.edu.in",
    'Referer': LOGIN_PAGE_URL
})

try:
    res_post = urllib.request.urlopen(req_post)
    html = res_post.read().decode('utf-8', errors='ignore')
    
    import re
    alert_matches = re.findall(r'<div[^>]*class="[^"]*alert-danger[^"]*"[^>]*>.*?</div>', html, re.DOTALL)
    for a in alert_matches:
        print("ALERT FOUND:")
        print(a)

    print("Checking for 'invalid credentials'...", "invalid credentials" in html.lower())
    print("Checking for 'invalid captcha'...", "invalid captcha" in html.lower())
    
    with open("dump.html", "w") as f:
        f.write(html)
except Exception as e:
    print(f"Error: {e}")
