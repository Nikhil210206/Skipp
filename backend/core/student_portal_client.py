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
    
    # Extract session cookie
    cookie_header = res.headers.get('Set-Cookie')
    if not cookie_header:
        raise StudentPortalClientError("Failed to get session cookie")
    cookie = cookie_header.split(';')[0]
    
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
        'Cookie': cookie,
        'Accept': 'image/png, image/jpeg, image/svg+xml, image/*',
        'Referer': LOGIN_PAGE_URL,
        'Origin': SP_BASE_URL
    })
    
    try:
        c_res = urllib.request.urlopen(req_c)
        captcha_bytes = c_res.read()
        captcha_b64 = "data:image/png;base64," + base64.b64encode(captcha_bytes).decode()
    except urllib.error.HTTPError as e:
        raise StudentPortalClientError(f"Failed to fetch captcha: {e.code}") from e

    return StudentPortalCaptchaResponse(
        session_cookie=cookie,
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
    
    form_data = {
        'username': req_data.username,
        'password': req_data.password,
        'captcha': req_data.captcha,
        req_data.domain_field: domain_value,
        req_data.captcha_field: captcha_trap_value
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
    except urllib.error.HTTPError as e:
        raise StudentPortalClientError(f"Login request failed: {e.code}") from e
        
    if "Invalid credentials" in result_html or "invalid credentials" in result_html.lower():
        raise StudentPortalClientError("Invalid username or password.")
    if "Invalid Captcha" in result_html or "invalid captcha" in result_html.lower():
        raise StudentPortalClientError("Invalid captcha.")
    if "JavaScript is required" in result_html:
        raise StudentPortalClientError("Anti-bot verification failed.")
        
    # If successful, fetch reports
    req_att = urllib.request.Request(ATTENDANCE_URL, data=b"", headers={
        'User-Agent': UA,
        'Cookie': req_data.session_cookie,
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
        'Cookie': req_data.session_cookie,
        'Referer': f"{SP_BASE_URL}/srmiststudentportal/students/template/HRDSystem.jsp"
    })
    try:
        res_marks = urllib.request.urlopen(req_marks)
        marks_html = res_marks.read().decode('utf-8', errors='ignore')
    except urllib.error.HTTPError:
        marks_html = None
        
    return att_html, marks_html
