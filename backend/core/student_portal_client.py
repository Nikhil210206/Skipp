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

import logging
import random
import time

log = logging.getLogger("skipp.api.sp_client")

class StudentPortalClientError(Exception):
    pass

def _get_proxies() -> list[str]:
    proxy_env = os.environ.get("SKIPP_PROXY") or os.environ.get("HTTPS_PROXY")
    if proxy_env:
        return [p.strip() for p in proxy_env.split(',') if p.strip()]
    return []

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
        proxies = _get_proxies()
        if proxies:
            proxy_url = random.choice(proxies)
                
    if proxy_url:
        handlers.append(urllib.request.ProxyHandler({'http': proxy_url, 'https': proxy_url}))
    else:
        # Crucial: pass empty dict to explicitly bypass any environment proxy when going direct
        handlers.append(urllib.request.ProxyHandler({}))
        
    return urllib.request.build_opener(*handlers), proxy_url or "DIRECT"

def init_login_session() -> StudentPortalCaptchaResponse:
    page_load_time = time.time()
    req = urllib.request.Request(LOGIN_PAGE_URL, headers={'User-Agent': UA})
    
    proxies = _get_proxies()
    # Try configured proxies first (shuffled), then fall back to DIRECT
    candidates = list(proxies)
    random.shuffle(candidates)
    candidates.append("DIRECT")
    
    res = None
    opener = None
    chosen_proxy = None
    last_err = None
    
    for candidate in candidates:
        try:
            curr_opener, curr_proxy = _get_opener(force_proxy=candidate)
            res = curr_opener.open(req, timeout=7)
            opener = curr_opener
            chosen_proxy = curr_proxy
            break
        except Exception as e:
            print(f"Student portal session init via '{candidate}' failed: {e}")
            last_err = e
            continue
            
    if res is None or opener is None:
        raise StudentPortalClientError(f"Network error connecting to student portal: {last_err}") from last_err
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
    
    if req_data.page_load_time and req_data.page_load_time > 0:
        time_elapsed_ms = max(3500, min(120000, t_now - int(req_data.page_load_time * 1000)))
    else:
        # Default realistic human elapsed time on page (e.g. 4.2 - 7.5 seconds)
        time_elapsed_ms = random.randint(4200, 7500)

    start_time_ms = t_now - time_elapsed_ms
    time_elapsed_sec = time_elapsed_ms // 1000
    typing_speed_ms = min(2500, max(800, time_elapsed_ms - random.randint(1200, 2000)))
    
    trap_payload = f"{time_elapsed_sec}{req_data.random_delim}5"
    captcha_trap_value = base64.b64encode(trap_payload.encode()).decode()
    
    payload_json = json.dumps({
        "startTime": start_time_ms,
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
        "mouseClicks": random.randint(1, 3),
        "mouseMovements": random.randint(3, 8),
        "keystrokeCount": random.randint(6, 12),
        "typingSpeedMs": typing_speed_ms,
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
        res_post = opener.open(req_post, timeout=12)
        result_html = res_post.read().decode('utf-8', errors='ignore')
        set_cookies = res_post.info().get_all('Set-Cookie')
    except Exception as e:
        if chosen_proxy and chosen_proxy != "DIRECT":
            print(f"Proxy failed on POST ({e}). Falling back to direct connection...")
            direct_opener, chosen_proxy = _get_opener(cj, force_proxy="DIRECT")
            opener = direct_opener
            try:
                res_post = opener.open(req_post, timeout=12)
                result_html = res_post.read().decode('utf-8', errors='ignore')
                set_cookies = res_post.info().get_all('Set-Cookie')
            except Exception as direct_err:
                raise StudentPortalClientError(f"Login request error: {direct_err}") from direct_err
        else:
            # Retry once after brief pause if connection reset or transient error
            try:
                time.sleep(1)
                res_post = opener.open(req_post, timeout=12)
                result_html = res_post.read().decode('utf-8', errors='ignore')
                set_cookies = res_post.info().get_all('Set-Cookie')
            except Exception as retry_err:
                raise StudentPortalClientError(f"Login request error: {retry_err}") from retry_err

    # Update CookieJar with the cookies from the POST response
    if set_cookies:
        for header in set_cookies:
            main_part = header.split(';')[0].strip()
            if '=' in main_part:
                k, v = main_part.split('=', 1)
                ck = http.cookiejar.Cookie(version=0, name=k, value=v, port=None, port_specified=False, domain='sp.srmist.edu.in', domain_specified=False, domain_initial_dot=False, path='/', path_specified=False, secure=False, expires=None, discard=True, comment=None, comment_url=None, rest={'HttpOnly': None}, rfc2109=False)
                cj.set_cookie(ck)
        
    res_lower = result_html.lower()
    
    # Extract alert text from HTML if present
    alert_text = ""
    if "alert-danger" in res_lower or "alert-icon-content" in res_lower:
        from bs4 import BeautifulSoup
        soup_err = BeautifulSoup(result_html, "html.parser")
        alert_el = soup_err.find(class_=lambda x: x and ("alert-icon-content" in x or "alert-danger" in x))
        if alert_el:
            alert_text = alert_el.get_text(strip=True).replace("Alert", "").strip()
            log.warning("Portal returned alert text: %s", alert_text)

    alert_lower = alert_text.lower()

    # 1. Bad Captcha:
    if "invalid captcha" in alert_lower or "invalid captcha" in res_lower:
        log.warning("Login failed: Invalid Captcha found in portal HTML response")
        raise StudentPortalClientError("Invalid captcha.")
        
    # 2. Account temporarily locked by SRM:
    if "temporarily locked" in alert_lower or "temporarily locked" in res_lower:
        log.warning("Login failed: Account temporarily locked by SRM portal")
        raise StudentPortalClientError("Account temporarily locked due to multiple unsuccessful attempts. Please try again after 5 minutes.")
        
    # 3. Bad username / password / credentials:
    if (
        "invalid login credentials" in alert_lower
        or "invalid credentials" in alert_lower
        or "user id or password entered is invalid" in alert_lower
        or "login attempt was unsuccessful" in alert_lower
        or "attempts remaining" in alert_lower
        or "invalid login credentials" in res_lower
        or "invalid credentials" in res_lower
        or "user id or password entered is invalid" in res_lower
        or "login attempt was unsuccessful" in res_lower
        or "attempts remaining" in res_lower
    ):
        log.warning("Login failed: Invalid username or password reported by portal: %s", alert_text or "Invalid credentials")
        raise StudentPortalClientError("Invalid username or password.")
        
    # 4. Any other alert returned by portal:
    if alert_text:
        log.warning("Login failed: Server returned alert: %s", alert_text)
        raise StudentPortalClientError(f"Login failed: {alert_text}")

    if "theGR8LoginLoader" in result_html or "thegr8loginloader" in result_html.lower():
        log.info("Login successful, following theGR8LoginLoader redirect...")
        target_url = f"{SP_BASE_URL}/srmiststudentportal/students/loginManager/youLogin.jsp"
        form_payload = b""
        form_method = "POST"
        try:
            from bs4 import BeautifulSoup
            soup_loader = BeautifulSoup(result_html, "html.parser")
            loader_form = soup_loader.find("form", id=lambda x: x and "loginloader" in str(x).lower()) or soup_loader.find("form")
            if loader_form:
                action = loader_form.get("action")
                if action:
                    if action.startswith("http"):
                        target_url = action
                    elif action.startswith("/"):
                        target_url = f"{SP_BASE_URL}{action}"
                    else:
                        target_url = f"{SP_BASE_URL}/srmiststudentportal/students/loginManager/{action}"
                form_method = (loader_form.get("method") or "POST").upper()
                inputs = {
                    inp.get("name"): inp.get("value", "")
                    for inp in loader_form.find_all("input")
                    if inp.get("name")
                }
                if inputs:
                    form_payload = urllib.parse.urlencode(inputs).encode()
        except Exception as parse_err:
            print(f"Could not parse loader form: {parse_err}")

        redirect_headers = {
            'User-Agent': UA,
            'Referer': LOGIN_PAGE_URL,
            'Origin': SP_BASE_URL
        }
        if form_method == "POST":
            redirect_headers['Content-Type'] = 'application/x-www-form-urlencoded'
            req_redirect = urllib.request.Request(
                target_url,
                data=form_payload,
                headers=redirect_headers,
                method="POST"
            )
        else:
            req_redirect = urllib.request.Request(target_url, headers=redirect_headers)

        try:
            res_redirect = opener.open(req_redirect, timeout=10)
            result_html = res_redirect.read().decode('utf-8', errors='ignore')
        except urllib.error.HTTPError as e:
            raise StudentPortalClientError(f"Login redirect failed: {e.code}") from e
        except Exception as e:
            raise StudentPortalClientError(f"Login redirect error: {e}") from e

    res_lower = result_html.lower()
    success_indicators = (
        "welcome",
        "attendance",
        "dashboard",
        "thegr8loginloader",
        "logout",
        "hrdsystem",
        "student",
        "portal",
        "srmist",
        "timetable",
        "internal",
    )
    if not any(k in res_lower for k in success_indicators):
        log.warning("Login failed: Unknown response, size %d", len(result_html))
        raise StudentPortalClientError("Failed to login, unknown response.")

    # Fetch HRDSystem.jsp to initialize dashboard session
    req_hrd = urllib.request.Request(f"{SP_BASE_URL}/srmiststudentportal/students/template/HRDSystem.jsp", headers={
        'User-Agent': UA,
        'Referer': LOGIN_PAGE_URL
    })
    hrd_html = ""
    try:
        res_hrd = opener.open(req_hrd, timeout=10)
        hrd_html = res_hrd.read().decode('utf-8', errors='ignore')
    except Exception as e:
        log.warning("HRDSystem fetch failed: %s", e)

    hrd_referer = f"{SP_BASE_URL}/srmiststudentportal/students/template/HRDSystem.jsp"
    from core.student_portal import looks_signed_out

    def _fetch_page(url: str) -> str:
        for attempt in range(2):
            post_html = ""
            try:
                req = urllib.request.Request(url, data=b"", headers={
                    'User-Agent': UA,
                    'Referer': hrd_referer,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }, method="POST")
                res = opener.open(req, timeout=12)
                post_html = res.read().decode('utf-8', errors='ignore')
                if post_html and not looks_signed_out(post_html):
                    return post_html
            except Exception as e:
                log.info("POST fetch attempt %d failed for %s: %s", attempt + 1, url, e)

            # Fallback to GET
            try:
                req_get = urllib.request.Request(url, headers={
                    'User-Agent': UA,
                    'Referer': hrd_referer,
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                })
                res_get = opener.open(req_get, timeout=12)
                get_html = res_get.read().decode('utf-8', errors='ignore')
                if get_html and not looks_signed_out(get_html):
                    return get_html
                if get_html and not post_html:
                    post_html = get_html
            except Exception as e:
                print(f"GET fetch attempt {attempt + 1} failed for {url}: {e}")

            if attempt == 0:
                time.sleep(1)

        return post_html

    att_html: Optional[str] = None
    marks_html: Optional[str] = None
    tt_html: Optional[str] = None

    # Fetch attendance, marks, and timetable sequentially to avoid dropping connections
    try:
        att_html = _fetch_page(ATTENDANCE_URL)
    except Exception as e:
        raise StudentPortalClientError(f"Failed to fetch attendance: {e}") from e

    try:
        marks_html = _fetch_page(MARKS_URL)
    except Exception as e:
        print(f"Failed to fetch marks: {e}")
        marks_html = None

    try:
        tt_html = _fetch_page(TIMETABLE_URL)
    except Exception as e:
        print(f"Failed to fetch timetable: {e}")
        tt_html = None

    # Fallback to hrd_html if tt_html is empty or doesn't have the timetable table
    if (not tt_html or "day 1" not in tt_html.lower()) and "day 1" in hrd_html.lower():
        tt_html = hrd_html
        
    return att_html, marks_html, tt_html
