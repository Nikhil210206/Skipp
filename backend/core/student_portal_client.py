import re
import base64
import urllib.request
import urllib.parse
from typing import Tuple, Dict, Optional

from models.student_portal import StudentPortalCaptchaResponse, StudentPortalLoginRequest

SP_BASE_URL = "https://sp.srmist.edu.in"
LOGIN_PAGE_URL = f"{SP_BASE_URL}/srmiststudentportal/students/loginManager/youLogin.jsp"
LOGIN_SUBMIT_URL = f"{SP_BASE_URL}/srmiststudentportal/LoginServlet"
ATTENDANCE_URL = f"{SP_BASE_URL}/srmiststudentportal/students/report/studentAttendanceDetails.jsp"
MARKS_URL = f"{SP_BASE_URL}/srmiststudentportal/students/report/studentInternalMarkDetails.jsp"

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"

class StudentPortalClientError(Exception):
    pass

def init_login_session() -> StudentPortalCaptchaResponse:
    req = urllib.request.Request(LOGIN_PAGE_URL, headers={'User-Agent': UA})
    res = urllib.request.urlopen(req)
    html = res.read().decode('utf-8', errors='ignore')
    
    # Extract session cookies
    cookies = []
    if res.info().get_all('Set-Cookie'):
        for c in res.info().get_all('Set-Cookie'):
            cookies.append(c.split(';')[0])
    
    if not cookies:
        raise StudentPortalClientError("Failed to get session cookie")
    
    # Extract config values
    try:
        nonce = re.search(r"nonce:\s*'([^']+)'", html).group(1)
        domain_field = re.search(r"domainFieldName\s*=\s*'([^']+)'", html).group(1)
        captcha_field = re.search(r"captchaFieldName\s*=\s*'([^']+)'", html).group(1)
        random_delim = re.search(r"randomDelimiter\s*=\s*'([^']+)'", html).group(1)
        
        token = re.search(r"SCaptchaServlet\?ts=[^&]+&token=([^\"']+)", html).group(1)
        ts = re.search(r"SCaptchaServlet\?ts=([^&]+)&token=", html).group(1)
    except AttributeError as e:
        raise StudentPortalClientError("Failed to extract anti-bot configuration") from e

    domain_proof = base64.b64encode(f"{nonce}:sp.srmist.edu.in".encode()).decode()
    captcha_url = f"{SP_BASE_URL}/srmiststudentportal/SCaptchaServlet?ts={ts}&token={token}"
    
    req_c = urllib.request.Request(captcha_url, headers={
        'User-Agent': UA,
        'X-Domain-Proof': domain_proof,
        'Cookie': "; ".join(cookies),
        'Accept': 'image/png, image/jpeg, image/svg+xml, image/*',
        'Referer': LOGIN_PAGE_URL,
        'Origin': SP_BASE_URL
    })
    
    try:
        c_res = urllib.request.urlopen(req_c)
        if c_res.info().get_all('Set-Cookie'):
            for c in c_res.info().get_all('Set-Cookie'):
                cookies.append(c.split(';')[0])
        
        captcha_bytes = c_res.read()
        captcha_b64 = "data:image/png;base64," + base64.b64encode(captcha_bytes).decode()
    except urllib.error.HTTPError as e:
        raise StudentPortalClientError(f"Failed to fetch captcha: {e.code}") from e

    cookie_str = "; ".join(cookies)

    return StudentPortalCaptchaResponse(
        session_cookie=cookie_str,
        domain_field=domain_field,
        captcha_field=captcha_field,
        random_delim=random_delim,
        captcha_base64=captcha_b64
    )

def submit_login_and_fetch(req_data: StudentPortalLoginRequest) -> Tuple[str, Optional[str]]:
    """Submits login and returns (attendance_html, marks_html). Raises on invalid login."""
    domain_value = base64.b64encode("ni.ude.tsimrs.ps".encode()).decode()
    
    # Simulate time elapsed and interactions
    trap_payload = f"12{req_data.random_delim}5"
    captcha_trap_value = base64.b64encode(trap_payload.encode()).decode()
    
    # Generate telemetryPayload
    import time
    import json
    t_now = int(time.time() * 1000)
    payload_json = json.dumps({
        "startTime": t_now - 15000,
        "deviceMemory": 8,
        "hardwareConcurrency": 8,
        "screenWidth": 1440,
        "screenHeight": 900,
        "colorDepth": 24,
        "devicePixelRatio": 2,
        "language": "en-US",
        "userLanguage": "en-US",
        "userAgent": UA,
        "timezoneOffset": -330,
        "touchSupport": False,
        "webdriver": False,
        "keystrokeCount": 11,
        "mouseMovements": 42,
        "mouseClicks": 2,
        "typingSpeedMs": 1500,
        "canvasHash": "canvas-123456",
        "submitTime": t_now,
        "timeOnPageMs": 15000
    }, separators=(',', ':'))
    telemetry_payload = base64.b64encode(payload_json.encode('utf-8')).decode('utf-8')
    
    form_data = {
        'username': req_data.username,
        'password': req_data.password,
        'captcha': req_data.captcha,
        req_data.domain_field: domain_value,
        req_data.captcha_field: captcha_trap_value,
        'telemetryPayload': telemetry_payload
    }
    encoded_data = urllib.parse.urlencode(form_data).encode()
    
    req_post = urllib.request.Request(LOGIN_SUBMIT_URL, data=encoded_data, headers={
        'User-Agent': UA,
        'Cookie': req_data.session_cookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': SP_BASE_URL,
        'Referer': LOGIN_SUBMIT_URL
    })
    
    try:
        res_post = urllib.request.urlopen(req_post)
        result_html = res_post.read().decode('utf-8', errors='ignore')
        
        set_cookies = res_post.info().get_all('Set-Cookie')
    except urllib.error.HTTPError as e:
        raise StudentPortalClientError(f"Login request failed: {e.code}") from e
        
    def merge_cookies(cookie_str: str, new_headers: list[str] | None) -> str:
        cookies = {}
        if cookie_str:
            for part in cookie_str.split(';'):
                part = part.strip()
                if '=' in part:
                    k, v = part.split('=', 1)
                    cookies[k] = v
        if new_headers:
            for header in new_headers:
                main_part = header.split(';')[0].strip()
                if '=' in main_part:
                    k, v = main_part.split('=', 1)
                    cookies[k] = v
        return '; '.join([f"{k}={v}" for k, v in cookies.items()])
        
    current_cookie_str = merge_cookies(req_data.session_cookie, set_cookies)
        
    if "Invalid credentials" in result_html or "invalid credentials" in result_html.lower():
        print("Login failed: Invalid credentials found in HTML")
        raise StudentPortalClientError("Invalid username or password.")
    if "Invalid Captcha" in result_html or "invalid captcha" in result_html.lower():
        print("Login failed: Invalid Captcha found in HTML")
        raise StudentPortalClientError("Invalid captcha.")
    if "JavaScript is required" in result_html and "alert-danger" in result_html:
        # Avoid matching the generic <noscript> tag that is always present
        print("Login failed: Javascript required (bot blocked)")
        raise StudentPortalClientError("Anti-bot verification failed.")
    if "temporarily locked" in result_html.lower():
        print("Login failed: Account temporarily locked")
        raise StudentPortalClientError("Account temporarily locked due to multiple unsuccessful attempts. Please try again after 5 minutes.")
        
    if "theGR8LoginLoader" in result_html:
        # This is a successful login! The server wants us to POST to youLogin.jsp
        print("Login successful, following theGR8LoginLoader redirect...")
        req_redirect = urllib.request.Request(
            f"{SP_BASE_URL}/srmiststudentportal/students/loginManager/youLogin.jsp",
            data=b"",
            headers={
                'User-Agent': UA,
                'Cookie': current_cookie_str,
                'Referer': LOGIN_PAGE_URL
            }
        )
        try:
            res_redirect = urllib.request.urlopen(req_redirect)
            result_html = res_redirect.read().decode('utf-8', errors='ignore')
            redirect_cookies = res_redirect.info().get_all('Set-Cookie')
            current_cookie_str = merge_cookies(current_cookie_str, redirect_cookies)
        except urllib.error.HTTPError as e:
            raise StudentPortalClientError(f"Login redirect failed: {e.code}") from e

    if "welcome" not in result_html.lower() and "attendance" not in result_html.lower() and "dashboard" not in result_html.lower() and "thegr8loginloader" not in result_html.lower():
        print(f"Login failed: Unknown response, size {len(result_html)}")
        with open("unknown_response.html", "w") as f:
            f.write(result_html)
        raise StudentPortalClientError("Failed to login, unknown response.")
        
    # If successful, fetch reports
    req_att = urllib.request.Request(ATTENDANCE_URL, data=b"", headers={
        'User-Agent': UA,
        'Cookie': current_cookie_str,
        'Referer': f"{SP_BASE_URL}/srmiststudentportal/students/template/HRDSystem.jsp"
    })
    try:
        res_att = urllib.request.urlopen(req_att)
        att_html = res_att.read().decode('utf-8', errors='ignore')
    except urllib.error.HTTPError as e:
        raise StudentPortalClientError(f"Failed to fetch attendance: {e.code}") from e
        
    # Marks
    req_marks = urllib.request.Request(MARKS_URL, data=b"", headers={
        'User-Agent': UA,
        'Cookie': current_cookie_str,
        'Referer': f"{SP_BASE_URL}/srmiststudentportal/students/template/HRDSystem.jsp"
    })
    try:
        res_marks = urllib.request.urlopen(req_marks)
        marks_html = res_marks.read().decode('utf-8', errors='ignore')
    except urllib.error.HTTPError:
        marks_html = None
        
    return att_html, marks_html
