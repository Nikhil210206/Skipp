import urllib.request
import re
import base64
import urllib.parse
import json
import time

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
SP_BASE_URL = "https://sp.srmist.edu.in"
LOGIN_PAGE_URL = f"{SP_BASE_URL}/srmiststudentportal/students/loginManager/youLogin.jsp"
LOGIN_SUBMIT_URL = f"{SP_BASE_URL}/srmiststudentportal/LoginServlet"

req = urllib.request.Request(LOGIN_PAGE_URL, headers={'User-Agent': UA})
res = urllib.request.urlopen(req)
html = res.read().decode('utf-8', errors='ignore')

cookies = []
if res.info().get_all('Set-Cookie'):
    for c in res.info().get_all('Set-Cookie'):
        cookies.append(c.split(';')[0])

nonce = re.search(r"nonce:\s*'([^']+)'", html).group(1)
domain_field = re.search(r"domainFieldName\s*=\s*'([^']+)'", html).group(1)
captcha_field = re.search(r"captchaFieldName\s*=\s*'([^']+)'", html).group(1)
random_delim = re.search(r"randomDelimiter\s*=\s*'([^']+)'", html).group(1)
token = re.search(r"SCaptchaServlet\?ts=[^&]+&token=([^\"']+)", html).group(1)
ts = re.search(r"SCaptchaServlet\?ts=([^&]+)&token=", html).group(1)

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
c_res = urllib.request.urlopen(req_c)
if c_res.info().get_all('Set-Cookie'):
    for c in c_res.info().get_all('Set-Cookie'):
        cookies.append(c.split(';')[0])

domain_value = base64.b64encode("ni.ude.tsimrs.ps".encode()).decode()
captcha_trap_value = base64.b64encode(f"12{random_delim}5".encode()).decode()

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
    'username': 'nb6938',
    'password': 'Password123',
    'captcha': 'WRONGX',
    domain_field: domain_value,
    captcha_field: captcha_trap_value,
    'telemetryPayload': telemetry_payload
}

encoded_data = urllib.parse.urlencode(form_data).encode()
req_post = urllib.request.Request(LOGIN_SUBMIT_URL, data=encoded_data, headers={
    'User-Agent': UA,
    'Cookie': "; ".join(cookies),
    'Content-Type': 'application/x-www-form-urlencoded',
    'Origin': SP_BASE_URL,
    'Referer': LOGIN_PAGE_URL
})

try:
    res_post = urllib.request.urlopen(req_post)
    html_post = res_post.read().decode()
except urllib.error.HTTPError as e:
    html_post = e.read().decode()

if "JavaScript is required" in html_post:
    print("Failed: JavaScript is required")
else:
    print("Success: NO Javascript required error!")
