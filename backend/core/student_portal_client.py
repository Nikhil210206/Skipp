import re
import base64
import urllib.request
import urllib.parse
import os
import ssl
from typing import Tuple, Dict, Optional

from models.student_portal import StudentPortalCaptchaResponse, StudentPortalLoginRequest

SP_BASE_URL = "https://sp.srmist.edu.in"
LOGIN_PAGE_URL = f"{SP_BASE_URL}/srmiststudentportal/students/loginManager/youLogin.jsp"
LOGIN_SUBMIT_URL = f"{SP_BASE_URL}/srmiststudentportal/LoginServlet"
ATTENDANCE_URL = f"{SP_BASE_URL}/srmiststudentportal/students/report/studentAttendanceDetails.jsp"
MARKS_URL = f"{SP_BASE_URL}/srmiststudentportal/students/report/studentInternalMarkDetails.jsp"
TIMETABLE_URL = f"{SP_BASE_URL}/srmiststudentportal/students/report/studentTimeTableDetails.jsp"

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"

class StudentPortalClientError(Exception):
    pass

import random
import time

def _get_opener(cj=None, force_proxy=None):
    handlers = []
    
    # Disable SSL verification due to portal's self-signed certificates or local network interception
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    handlers.append(urllib.request.HTTPSHandler(context=ctx))
    
    if cj is not None:
        handlers.append(urllib.request.HTTPCookieProcessor(cj))
        
    proxy_url = force_proxy
    if proxy_url == "DIRECT":
        proxy_url = None
    elif not proxy_url:
        proxy_env = os.environ.get("SKIPP_PROXY") or os.environ.get("HTTPS_PROXY")
        if proxy_env:
            # If multiple proxies are provided (comma separated), pick one randomly
            proxies = [p.strip() for p in proxy_env.split(',') if p.strip()]
            if proxies:
                proxy_url = random.choice(proxies)
                
    if proxy_url:
        handlers.append(urllib.request.ProxyHandler({'http': proxy_url, 'https': proxy_url}))
        
    return urllib.request.build_opener(*handlers), proxy_url

def init_login_session() -> StudentPortalCaptchaResponse:
    page_load_time = time.time()
    req = urllib.request.Request(LOGIN_PAGE_URL, headers={'User-Agent': UA})
    opener, chosen_proxy = _get_opener()
    try:
        res = opener.open(req, timeout=5)
    except Exception as e:
        if chosen_proxy and chosen_proxy != "DIRECT":
            print(f"Proxy {chosen_proxy} failed with {e}. Falling back to direct connection...")
            opener, chosen_proxy = _get_opener(force_proxy="DIRECT")
            try:
                res = opener.open(req, timeout=5)
            except Exception as direct_err:
                raise StudentPortalClientError(f"Network error connecting to student portal: {direct_err}") from direct_err
        else:
            raise StudentPortalClientError(f"Network error connecting to student portal: {e}") from e
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
        
        honeypot_match = re.search(r'id="(ph_[a-f0-9]+)"', html)
        if not honeypot_match:
            print("WARNING: Could not extract honeypot field name! Using default ph_cf19b370")
            honeypot_field = "ph_cf19b370"
        else:
            honeypot_field = honeypot_match.group(1)

        
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
        c_res = opener.open(req_c, timeout=5)
        if c_res.info().get_all('Set-Cookie'):
            for c in c_res.info().get_all('Set-Cookie'):
                cookies.append(c.split(';')[0])
        
        captcha_bytes = c_res.read()
        captcha_b64 = "data:image/png;base64," + base64.b64encode(captcha_bytes).decode()
    except Exception as e:
        if chosen_proxy and chosen_proxy != "DIRECT":
            print(f"Proxy failed on captcha ({e}). Falling back to direct...")
            direct_opener, chosen_proxy = _get_opener(force_proxy="DIRECT")
            opener = direct_opener
            try:
                c_res = opener.open(req_c, timeout=5)
                if c_res.info().get_all('Set-Cookie'):
                    for c in c_res.info().get_all('Set-Cookie'):
                        cookies.append(c.split(';')[0])
                captcha_bytes = c_res.read()
                captcha_b64 = "data:image/png;base64," + base64.b64encode(captcha_bytes).decode()
            except Exception as direct_err:
                raise StudentPortalClientError(f"Failed to fetch captcha: {direct_err}") from direct_err
        else:
            raise StudentPortalClientError(f"Failed to fetch captcha: {e}") from e

    cookie_str = "; ".join(cookies)

    # Append the proxy to the session cookie so we can reuse it
    if chosen_proxy:
        cookie_str += f"; SKIPP_PROXY_ID={chosen_proxy}"
        
    return StudentPortalCaptchaResponse(
        session_cookie=cookie_str,
        domain_field=domain_field,
        captcha_field=captcha_field,
        random_delim=random_delim,
        honeypot_field=honeypot_field,
        captcha_base64=captcha_b64,
        page_load_time=page_load_time
    )

def submit_login_and_fetch(req_data: StudentPortalLoginRequest) -> Tuple[str, Optional[str], Optional[str]]:
    """Submits login and returns (attendance_html, marks_html, tt_html). Raises on invalid login."""
    domain_value = base64.b64encode("ni.ude.tsimrs.ps".encode()).decode()
    
    # Calculate actual time elapsed since page load to pass anti-bot telemetry
    import time
    import json
    t_now = int(time.time() * 1000)
    
    # If the elapsed time is too short (e.g. fast proxies + OCR), the portal might block it.
    # TimeElapsed should at least be 1-2 seconds. 
    time_elapsed_ms = max(2000, t_now - int(req_data.page_load_time * 1000))
    time_elapsed_sec = time_elapsed_ms // 1000
    
    trap_payload = f"{time_elapsed_sec}{req_data.random_delim}5"
    captcha_trap_value = base64.b64encode(trap_payload.encode()).decode()
    
    payload_json = json.dumps({
        "startTime": int(req_data.page_load_time * 1000),
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
        "timeOnPageMs": time_elapsed_ms
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
    
    # Create a CookieJar opener to handle redirects and cookies automatically
    import http.cookiejar
    cj = http.cookiejar.CookieJar()
    # Note: we need to delay creating the opener until after we parse chosen_proxy from cookies

    
    chosen_proxy = None
    # Load initial cookies into CookieJar
    if req_data.session_cookie:
        for part in req_data.session_cookie.split(';'):
            part = part.strip()
            if '=' in part:
                k, v = part.split('=', 1)
                if k == 'SKIPP_PROXY_ID':
                    chosen_proxy = v
                    continue
                k, v = part.split('=', 1)
                ck = http.cookiejar.Cookie(version=0, name=k, value=v, port=None, port_specified=False, domain='sp.srmist.edu.in', domain_specified=False, domain_initial_dot=False, path='/', path_specified=False, secure=False, expires=None, discard=True, comment=None, comment_url=None, rest={'HttpOnly': None}, rfc2109=False)
                cj.set_cookie(ck)
    
    opener, chosen_proxy = _get_opener(cj, force_proxy=chosen_proxy)
    req_post = urllib.request.Request(LOGIN_SUBMIT_URL, data=encoded_data, headers={
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': SP_BASE_URL,
        'Referer': LOGIN_PAGE_URL
    })
    
    try:
        res_post = opener.open(req_post, timeout=5)
        result_html = res_post.read().decode('utf-8', errors='ignore')
        set_cookies = res_post.info().get_all('Set-Cookie')
    except Exception as e:
        if chosen_proxy and chosen_proxy != "DIRECT":
            print(f"Proxy failed on POST ({e}). Falling back to direct connection...")
            direct_opener, chosen_proxy = _get_opener(cj, force_proxy="DIRECT")
            opener = direct_opener
            try:
                res_post = opener.open(req_post, timeout=5)
                result_html = res_post.read().decode('utf-8', errors='ignore')
                set_cookies = res_post.info().get_all('Set-Cookie')
            except Exception as direct_err:
                raise StudentPortalClientError(f"Login request error: {direct_err}") from direct_err
        else:
            raise StudentPortalClientError(f"Login request error: {e}") from e
        

                
    # Update CookieJar with the cookies from the POST response
    if set_cookies:
        for header in set_cookies:
            main_part = header.split(';')[0].strip()
            if '=' in main_part:
                k, v = main_part.split('=', 1)
                ck = http.cookiejar.Cookie(version=0, name=k, value=v, port=None, port_specified=False, domain='sp.srmist.edu.in', domain_specified=False, domain_initial_dot=False, path='/', path_specified=False, secure=False, expires=None, discard=True, comment=None, comment_url=None, rest={'HttpOnly': None}, rfc2109=False)
                cj.set_cookie(ck)
        
    if "invalid credentials" in result_html.lower() or "invalid login credentials" in result_html.lower():
        print("Login failed: Invalid credentials found in HTML")
        raise StudentPortalClientError("Invalid username or password.")
    if "Invalid Captcha" in result_html or "invalid captcha" in result_html.lower():
        print("Login failed: Invalid Captcha found in HTML")
        raise StudentPortalClientError("Invalid captcha.")
    if "temporarily locked" in result_html.lower():
        print("Login failed: Account temporarily locked")
        raise StudentPortalClientError("Account temporarily locked due to multiple unsuccessful attempts. Please try again after 5 minutes.")
        
    if "alert-danger" in result_html:
        start_idx = result_html.find('alert-icon-content')
        if start_idx != -1:
            end_idx = result_html.find('</div>', start_idx)
            error_html = result_html[start_idx:end_idx]
            import re
            error_msg = re.sub(r'<[^>]+>', '', error_html).replace('alert-icon-content">', '').replace('Alert', '').strip()
            print(f"Login failed: Server returned error: {error_msg}")
            raise StudentPortalClientError(f"Login failed: {error_msg}")
    if "theGR8LoginLoader" in result_html:
        print("Login successful, following theGR8LoginLoader redirect...")
        req_redirect = urllib.request.Request(
            f"{SP_BASE_URL}/srmiststudentportal/students/loginManager/youLogin.jsp",
            headers={
                'User-Agent': UA,
                'Referer': LOGIN_PAGE_URL
            }
        )
        try:
            res_redirect = opener.open(req_redirect, timeout=7)
            result_html = res_redirect.read().decode('utf-8', errors='ignore')
        except urllib.error.HTTPError as e:
            raise StudentPortalClientError(f"Login redirect failed: {e.code}") from e
        except Exception as e:
            raise StudentPortalClientError(f"Login redirect error: {e}") from e

    if "welcome" not in result_html.lower() and "attendance" not in result_html.lower() and "dashboard" not in result_html.lower() and "thegr8loginloader" not in result_html.lower():
        print(f"Login failed: Unknown response, size {len(result_html)}")
        raise StudentPortalClientError("Failed to login, unknown response.")

    import concurrent.futures

    # Fetch HRDSystem.jsp first to initialize dashboard session
    req_hrd = urllib.request.Request(f"{SP_BASE_URL}/srmiststudentportal/students/template/HRDSystem.jsp", headers={
        'User-Agent': UA,
        'Referer': LOGIN_PAGE_URL
    })
    hrd_html = ""
    try:
        res_hrd = opener.open(req_hrd, timeout=7)
        hrd_html = res_hrd.read().decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"HRDSystem fetch failed: {e}")

    hrd_referer = f"{SP_BASE_URL}/srmiststudentportal/students/template/HRDSystem.jsp"

    def _fetch_page(url: str) -> str:
        req = urllib.request.Request(url, headers={
            'User-Agent': UA,
            'Referer': hrd_referer,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        })
        res = opener.open(req, timeout=7)
        return res.read().decode('utf-8', errors='ignore')

    att_html: Optional[str] = None
    marks_html: Optional[str] = None
    tt_html: Optional[str] = None

    # Fetch attendance, marks, and timetable concurrently for ultra-fast response (< 2s)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        f_att = executor.submit(_fetch_page, ATTENDANCE_URL)
        f_marks = executor.submit(_fetch_page, MARKS_URL)
        f_tt = executor.submit(_fetch_page, TIMETABLE_URL)

        try:
            att_html = f_att.result(timeout=8)
        except Exception as e:
            raise StudentPortalClientError(f"Failed to fetch attendance: {e}") from e

        try:
            marks_html = f_marks.result(timeout=8)
        except Exception:
            marks_html = None

        try:
            tt_html = f_tt.result(timeout=8)
        except Exception:
            tt_html = None

    # Fallback to hrd_html if tt_html is empty or doesn't have the timetable table
    if (not tt_html or "day 1" not in tt_html.lower()) and "day 1" in hrd_html.lower():
        tt_html = hrd_html
        
    return att_html, marks_html, tt_html
