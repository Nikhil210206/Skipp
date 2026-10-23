import base64
import json
import logging
import os
import random
import re
import secrets
import ssl
import time
from typing import Tuple, Dict, Optional
import httpx

from models.student_portal import StudentPortalCaptchaResponse, StudentPortalLoginRequest

log = logging.getLogger("skipp.api.sp_client")

SP_BASE_URL = "https://sp.srmist.edu.in"
BASE_URL = f"{SP_BASE_URL}/srmiststudentportal"
LOGIN_PAGE_URL = f"{BASE_URL}/students/loginManager/youLogin.jsp"
LOGIN_SUBMIT_URL = f"{BASE_URL}/LoginServlet"
ATTENDANCE_URL = f"{BASE_URL}/students/report/studentAttendanceDetails.jsp"
MARKS_URL = f"{BASE_URL}/students/report/studentInternalMarkDetails.jsp"
TIMETABLE_URL = f"{BASE_URL}/students/report/studentTimeTableDetails.jsp"
HRD_URL = f"{BASE_URL}/students/template/HRDSystem.jsp"

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"

HEADERS = {
    "User-Agent": UA,
    "Referer": LOGIN_PAGE_URL,
    "Origin": SP_BASE_URL,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

class StudentPortalClientError(Exception):
    pass

def _get_proxies() -> list[str]:
    proxy_env = os.environ.get("SKIPP_PROXY") or os.environ.get("HTTPS_PROXY")
    if proxy_env:
        return [p.strip() for p in proxy_env.split(',') if p.strip()]
    return []

def canvas_hash() -> str:
    seed = random.randint(0, 0x7FFFFFFF)
    return format(seed, "06x")

def telemetry_payload(now_ms: int, start_time_ms: int) -> dict:
    time_elapsed_ms = now_ms - start_time_ms
    return {
        "startTime": start_time_ms,
        "currentDomain": "sp.srmist.edu.in",
        "timezoneOffset": -330,
        "screenWidth": 1366,
        "screenHeight": 768,
        "colorDepth": 24,
        "devicePixelRatio": 1,
        "platform": "Win32",
        "userAgent": UA,
        "language": "en-US",
        "hardwareConcurrency": 8,
        "deviceMemory": 8,
        "touchSupport": False,
        "webdriver": False,
        "mouseClicks": random.randint(2, 6),
        "mouseMovements": random.randint(5, 20),
        "keystrokeCount": 0,
        "typingSpeedMs": 0,
        "canvasHash": canvas_hash(),
        "submitTime": now_ms,
        "timeOnPageMs": time_elapsed_ms,
    }

class PortalSession:
    def __init__(self, proxy: Optional[str] = None):
        proxy_url = proxy
        if not proxy_url:
            proxies = _get_proxies()
            if proxies:
                proxy_url = random.choice(proxies)
        
        self.proxy = proxy_url
        if proxy_url and proxy_url != "DIRECT":
            transport = httpx.AsyncHTTPTransport(retries=1, verify=False, proxy=proxy_url)
        else:
            transport = httpx.AsyncHTTPTransport(retries=1, verify=False)

        self.client = httpx.AsyncClient(
            transport=transport,
            headers=HEADERS,
            follow_redirects=True,
            timeout=30.0,
            verify=False
        )
        self.nonce: Optional[str] = None
        self.login_form_fields: Dict[str, str] = {}
        self.captcha_page: Optional[str] = None
        self.exposed_captcha_text: Optional[str] = None
        self.domain_field_name: str = "dtoken_x"
        self.captcha_field_name: str = "cptoken_x"
        self.random_delimiter: str = "0000"
        self.honeypot_field: Optional[str] = None
        self.load_ms: Optional[int] = None
        self.captcha_bytes: Optional[bytes] = None

    async def load_captcha(self) -> Dict[str, any]:
        r = await self.client.get(LOGIN_PAGE_URL)
        text = r.text
        m = (
            re.search(r"window\.SECURE_CONFIG\s*=\s*\{[^}]*?nonce\s*:\s*'([^']+)'", text)
            or re.search(r"window\.SECURE_CONFIG\s*=\s*window\.SECURE_CONFIG\s*\|\|\s*\{\};\s*window\.SECURE_CONFIG\.nonce\s*=\s*'([^']+)'", text)
            or re.search(r'id="fpNonce"\s*value="([^"]+)"', text)
            or re.search(r"nonce:\s*'([^']+)'", text)
        )
        self.nonce = m.group(1) if m else None

        df = re.search(r"""domainFieldName\s*=\s*['"]([^'"]+)['"]""", text)
        cf = re.search(r"""captchaFieldName\s*=\s*['"]([^'"]+)['"]""", text)
        self.domain_field_name = df.group(1) if df else "dtoken_x"
        self.captcha_field_name = cf.group(1) if cf else "cptoken_x"

        hp = re.search(r'id="(ph_[a-f0-9]+)"', text)
        self.honeypot_field = hp.group(1) if hp else "ph_cf19b370"

        rd = re.search(r"""randomDelimiter\s*=\s*['"]([^'"]+)['"]""", text)
        self.random_delimiter = rd.group(1) if rd else "0000"

        fields = {}
        for inp in re.finditer(r"<input[^>]*name=['\"]([^'\"]+)['\"][^>]*>", text):
            fields[inp.group(1)] = ""
        self.login_form_fields = fields

        m_cap = re.search(r"SCaptchaServlet[^'\" ]*", text)
        captcha_url = None
        if m_cap:
            seg = m_cap.group(0)
            captcha_url = BASE_URL + "/" + seg if not seg.startswith("/") else SP_BASE_URL + seg

        img_b64 = None
        if captcha_url:
            proof = base64.b64encode(f"{self.nonce}:sp.srmist.edu.in".encode()).decode()
            cr = await self.client.get(captcha_url, headers={
                "X-Domain-Proof": proof,
                "Accept": "image/png, image/jpeg, image/svg+xml, image/*",
                "Referer": LOGIN_PAGE_URL,
            })
            if cr.status_code == 200:
                img_b64 = base64.b64encode(cr.content).decode()
                self.captcha_bytes = cr.content

        self.captcha_page = text
        self.load_ms = int(time.time() * 1000)
        return {
            "captcha_image": f"data:image/png;base64,{img_b64}" if img_b64 else None,
            "nonce": self.nonce or "",
            "domain_field": self.domain_field_name,
            "captcha_field": self.captcha_field_name,
            "random_delim": self.random_delimiter,
            "honeypot_field": self.honeypot_field,
        }

    async def login(self, username: str, password: str, captcha: str) -> Dict[str, any]:
        if not self.captcha_page:
            await self.load_captcha()

        now_ms = int(time.time() * 1000)
        calc_elapsed = max(0, int((now_ms - (self.load_ms or now_ms)) / 1000))
        elapsed_sec = max(random.randint(3, 5), calc_elapsed)
        start_time_ms = now_ms - (elapsed_sec * 1000 + random.randint(150, 650))

        dtoken = base64.b64encode("sp.srmist.edu.in"[::-1].encode()).decode()
        trap_payload = str(elapsed_sec) + (self.random_delimiter or "0000") + "3"
        cptoken = base64.b64encode(trap_payload.encode()).decode()

        fp_payload = base64.b64encode(json.dumps({
            "fp": "",
            "nonce": self.nonce or "",
            "ts": now_ms
        }).encode()).decode()

        payload = base64.b64encode(json.dumps(
            telemetry_payload(now_ms, start_time_ms),
            separators=(',', ':')
        ).encode('utf-8')).decode('utf-8')

        fp_body = dict(self.login_form_fields)
        fp_body.update({
            "username": username,
            "password": password,
            "captcha": captcha.strip(),
            "fpPayload": fp_payload,
            "fpToken": "",
            "recaptchaToken": "",
            "telemetryPayload": payload,
        })
        fp_body[self.domain_field_name] = dtoken
        fp_body[self.captcha_field_name] = cptoken

        resp = await self.client.post(LOGIN_SUBMIT_URL, data=fp_body)
        body = resp.text or ""

        # Follow theGR8LoginLoader redirect if present
        if "thegr8loginloader" in body.lower():
            from bs4 import BeautifulSoup
            soup_loader = BeautifulSoup(body, "html.parser")
            loader_form = soup_loader.find("form", id=lambda x: x and "loginloader" in str(x).lower()) or soup_loader.find("form")
            if loader_form:
                action = loader_form.get("action")
                target_url = HRD_URL
                if action:
                    if action.startswith("http"):
                        target_url = action
                    elif action.startswith("/"):
                        target_url = f"{SP_BASE_URL}{action}"
                    else:
                        target_url = f"{BASE_URL}/students/loginManager/{action}"
                inputs = {
                    inp.get("name"): inp.get("value", "")
                    for inp in loader_form.find_all("input")
                    if inp.get("name")
                }
                resp = await self.client.post(target_url, data=inputs, headers={"Referer": LOGIN_PAGE_URL})
                body = resp.text or ""

        res_lower = body.lower()
        resp_path = str(resp.url.path).lower()

        # Check if login redirected to HRDSystem, logout, or attendance
        if "logout.jsp" in resp_path or "attendance" in resp_path or "hrdsystem" in resp_path or "logout.jsp" in res_lower:
            try:
                await self.client.get(HRD_URL, headers={"Referer": LOGIN_PAGE_URL})
            except Exception as e:
                log.warning("HRDSystem init failed: %s", e)
            return {"ok": True, "cookies": {c.name: c.value for c in self.client.cookies.jar}}

        # If not obvious from URL, initialize HRDSystem and check if attendance can be fetched
        try:
            await self.client.get(HRD_URL, headers={"Referer": LOGIN_PAGE_URL})
        except Exception:
            pass
        att_check = await self.get_attendance_html()
        if att_check is not None:
            return {"ok": True, "cookies": {c.name: c.value for c in self.client.cookies.jar}}

        failure_info = self.classify_failure(resp.url.path, body)
        return {
            "ok": False,
            "reason": failure_info.get("reason", "login_failed"),
            "message": failure_info.get("message", "Login failed"),
            "raw_body": body
        }

    @staticmethod
    def classify_failure(path: str, body: str) -> Dict[str, str]:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(body, "html.parser")
        alert_el = soup.find(class_=lambda c: c and ("alert-icon-content" in c or "alert-danger" in c))
        
        alert_text = ""
        if alert_el:
            alert_text = alert_el.get_text(separator=" ", strip=True)
            if alert_text.lower().startswith("alert"):
                alert_text = alert_text[5:].strip()

        blob = (alert_text + " " + body).lower()
        if "invalid captcha" in blob:
            return {
                "reason": "wrong_captcha",
                "message": alert_text or "Invalid captcha.",
            }
        if "locked" in blob:
            return {
                "reason": "account_locked",
                "message": alert_text or "Your account has been temporarily locked due to multiple unsuccessful attempts. Please try again after 5 minutes.",
            }
        if (
            "invalid login credentials" in blob
            or "invalid credentials" in blob
            or "attempts remaining" in blob
            or "user id or password" in blob
            or "unsuccessful" in blob
        ):
            return {
                "reason": "invalid_credentials",
                "message": alert_text or "Incorrect NetID or password.",
            }

        if "session" in blob and ("expire" in blob or "timeout" in blob):
            return {"reason": "session_expired", "message": "Session expired, refresh and retry."}
        return {"reason": "login_failed", "message": alert_text or "Login failed."}

    async def get_attendance_html(self) -> Optional[str]:
        headers = {
            "Referer": HRD_URL,
            "Origin": SP_BASE_URL,
            "Content-Type": "application/x-www-form-urlencoded",
        }
        # 1. POST with empty body (as servlet expects)
        try:
            r = await self.client.post(ATTENDANCE_URL, data={}, headers=headers)
            if r.status_code == 200 and r.text:
                txt_lower = r.text.lower()
                if not ("login_form" in txt_lower or "youlogin" in txt_lower or "thegr8loginloader" in txt_lower):
                    if any(marker in txt_lower for marker in ("course wise attendance", "attendance", "total percentage", "course code", "<table")):
                        return r.text
        except Exception as e:
            log.warning("Network error POST fetching attendance: %s", e)

        # 2. GET fallback with HRD_URL referer
        try:
            r = await self.client.get(ATTENDANCE_URL, headers={"Referer": HRD_URL})
            if r.status_code == 200 and r.text:
                txt_lower = r.text.lower()
                if not ("login_form" in txt_lower or "youlogin" in txt_lower or "thegr8loginloader" in txt_lower):
                    if any(marker in txt_lower for marker in ("course wise attendance", "attendance", "total percentage", "course code", "<table")):
                        return r.text
        except Exception as e:
            log.warning("Network error GET fetching attendance: %s", e)

        return None

    async def get_marks_html(self) -> Optional[str]:
        headers = {
            "Referer": HRD_URL,
            "Origin": SP_BASE_URL,
            "Content-Type": "application/x-www-form-urlencoded",
        }
        try:
            r = await self.client.post(MARKS_URL, data={}, headers=headers)
            if r.status_code == 200 and "table" in r.text.lower() and "login_form" not in r.text.lower():
                return r.text
        except Exception as e:
            log.warning("Network error POST fetching marks: %s", e)

        try:
            r = await self.client.get(MARKS_URL, headers={"Referer": HRD_URL})
            if r.status_code == 200 and "table" in r.text.lower() and "login_form" not in r.text.lower():
                return r.text
        except Exception as e:
            log.warning("Network error GET fetching marks: %s", e)
        return None

    async def get_timetable_html(self) -> Optional[str]:
        headers = {
            "Referer": HRD_URL,
            "Origin": SP_BASE_URL,
            "Content-Type": "application/x-www-form-urlencoded",
        }
        try:
            payload = {
                "iden": "10",
                "filter": "",
                "hdnFormDetails": "1",
                "csrfPreventionSalt": ""
            }
            r = await self.client.post(TIMETABLE_URL, data=payload, headers=headers)
            if r.status_code == 200 and "table" in r.text.lower() and "login_form" not in r.text.lower():
                return r.text
        except Exception as e:
            log.warning("Network error fetching timetable: %s", e)
        return None

class PortalClient:
    def __init__(self, cookies: Optional[Dict[str, str]] = None, proxy: Optional[str] = None):
        proxy_url = proxy
        if not proxy_url:
            proxies = _get_proxies()
            if proxies:
                proxy_url = random.choice(proxies)

        if proxy_url and proxy_url != "DIRECT":
            transport = httpx.AsyncHTTPTransport(retries=1, verify=False, proxy=proxy_url)
        else:
            transport = httpx.AsyncHTTPTransport(retries=1, verify=False)

        self.client = httpx.AsyncClient(
            transport=transport,
            headers=HEADERS,
            follow_redirects=True,
            timeout=30.0,
            verify=False
        )
        if cookies:
            self.client.cookies.update(cookies)

    async def keepalive(self):
        try:
            await self.client.get(HRD_URL, headers={"Referer": LOGIN_PAGE_URL})
        except httpx.HTTPError:
            pass

    async def get_attendance_html(self) -> Optional[str]:
        headers = {
            "Referer": HRD_URL,
            "Origin": SP_BASE_URL,
            "Content-Type": "application/x-www-form-urlencoded",
        }
        try:
            r = await self.client.post(ATTENDANCE_URL, data={}, headers=headers)
            if r.status_code == 200 and r.text:
                txt_lower = r.text.lower()
                if not ("login_form" in txt_lower or "youlogin" in txt_lower or "thegr8loginloader" in txt_lower):
                    if any(marker in txt_lower for marker in ("course wise attendance", "attendance", "total percentage", "course code", "<table")):
                        return r.text
        except Exception as e:
            log.warning("Network error POST fetching attendance: %s", e)

        try:
            r = await self.client.get(ATTENDANCE_URL, headers={"Referer": HRD_URL})
            if r.status_code == 200 and r.text:
                txt_lower = r.text.lower()
                if not ("login_form" in txt_lower or "youlogin" in txt_lower or "thegr8loginloader" in txt_lower):
                    if any(marker in txt_lower for marker in ("course wise attendance", "attendance", "total percentage", "course code", "<table")):
                        return r.text
        except Exception as e:
            log.warning("Network error GET fetching attendance: %s", e)

        return None

    async def get_marks_html(self) -> Optional[str]:
        headers = {
            "Referer": HRD_URL,
            "Origin": SP_BASE_URL,
            "Content-Type": "application/x-www-form-urlencoded",
        }
        try:
            r = await self.client.post(MARKS_URL, data={}, headers=headers)
            if r.status_code == 200 and "table" in r.text.lower() and "login_form" not in r.text.lower():
                return r.text
        except Exception as e:
            log.warning("Network error POST fetching marks: %s", e)

        try:
            r = await self.client.get(MARKS_URL, headers={"Referer": HRD_URL})
            if r.status_code == 200 and "table" in r.text.lower() and "login_form" not in r.text.lower():
                return r.text
        except Exception as e:
            log.warning("Network error GET fetching marks: %s", e)
        return None

    async def get_timetable_html(self) -> Optional[str]:
        headers = {
            "Referer": HRD_URL,
            "Origin": SP_BASE_URL,
            "Content-Type": "application/x-www-form-urlencoded",
        }
        try:
            payload = {
                "iden": "10",
                "filter": "",
                "hdnFormDetails": "1",
                "csrfPreventionSalt": ""
            }
            r = await self.client.post(TIMETABLE_URL, data=payload, headers=headers)
            if r.status_code == 200 and "table" in r.text.lower() and "login_form" not in r.text.lower():
                return r.text
        except Exception as e:
            log.warning("Network error fetching timetable: %s", e)
        return None

_active_portal_sessions: Dict[str, PortalSession] = {}

def _prune_portal_sessions():
    if len(_active_portal_sessions) > 50:
        keys_to_remove = list(_active_portal_sessions.keys())[:15]
        for k in keys_to_remove:
            old_sess = _active_portal_sessions.pop(k, None)
            if old_sess:
                try:
                    import asyncio
                    asyncio.create_task(old_sess.client.aclose())
                except Exception:
                    pass

async def init_login_session() -> StudentPortalCaptchaResponse:
    sid = secrets.token_hex(16)
    session = PortalSession()
    info = await session.load_captcha()
    _active_portal_sessions[sid] = session
    _prune_portal_sessions()

    cookie_parts = [f"SKIPP_SID={sid}"]
    if session.proxy:
        cookie_parts.append(f"SKIPP_PROXY_ID={session.proxy}")
    if session.nonce:
        cookie_parts.append(f"SKIPP_NONCE={session.nonce}")
    for c in session.client.cookies.jar:
        cookie_parts.append(f"{c.name}={c.value}")

    cookie_str = "; ".join(cookie_parts)
    return StudentPortalCaptchaResponse(
        session_cookie=cookie_str,
        domain_field=info["domain_field"],
        captcha_field=info["captcha_field"],
        random_delim=info["random_delim"],
        honeypot_field=info["honeypot_field"],
        nonce=info["nonce"],
        captcha_base64=info["captcha_image"],
        page_load_time=time.time()
    )

async def submit_login_and_fetch(req_data: StudentPortalLoginRequest) -> Tuple[str, Optional[str], Optional[str], str]:
    clean_username = req_data.username.strip().lower()
    if "@" in clean_username:
        clean_username = clean_username.split("@")[0].strip()

    sid = None
    if req_data.session_cookie:
        for part in req_data.session_cookie.split(';'):
            part = part.strip()
            if part.startswith('SKIPP_SID='):
                sid = part.split('=', 1)[1].strip()
                break

    session = _active_portal_sessions.pop(sid, None) if sid else None
    if not session:
        session = PortalSession()
        await session.load_captcha()

    res = await session.login(clean_username, req_data.password, req_data.captcha)
    if not res.get("ok"):
        reason = res.get("reason", "login_failed")
        msg = res.get("message", "Login failed")
        if reason == "account_locked":
            raise StudentPortalClientError("Your account has been temporarily locked due to multiple unsuccessful attempts. Please try again after 5 minutes.")
        if reason == "wrong_captcha":
            raise StudentPortalClientError("Invalid captcha.")
        if reason == "invalid_credentials":
            raise StudentPortalClientError(f"Incorrect NetID or password ({msg}). Note that your Student Portal password is your SRM student email password, often different from your Academia password.")
        raise StudentPortalClientError(msg)

    att_html = await session.get_attendance_html()
    marks_html = await session.get_marks_html()
    tt_html = await session.get_timetable_html()

    cookie_str = "; ".join(f"{c.name}={c.value}" for c in session.client.cookies.jar)
    return att_html or "", marks_html, tt_html, cookie_str

async def refresh_session_and_fetch(session_cookie: str) -> Tuple[str, Optional[str], Optional[str], str]:
    if not session_cookie or not session_cookie.strip():
        raise StudentPortalClientError("session_expired")

    cookies_dict = {}
    for part in session_cookie.split(';'):
        part = part.strip()
        if not part or part.startswith('SKIPP_'):
            continue
        if '=' in part:
            k, v = part.split('=', 1)
            cookies_dict[k] = v

    client = PortalClient(cookies=cookies_dict)
    await client.keepalive()
    att_html = await client.get_attendance_html()
    marks_html = await client.get_marks_html()
    tt_html = await client.get_timetable_html()

    if not att_html and not marks_html and not tt_html:
        raise StudentPortalClientError("session_expired")

    cookie_str = "; ".join(f"{c.name}={c.value}" for c in client.client.cookies.jar)
    return att_html or "", marks_html, tt_html, cookie_str
