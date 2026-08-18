import urllib.request
import re
import base64
import urllib.parse
import json

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
})
c_res = urllib.request.urlopen(req_c)
if c_res.info().get_all('Set-Cookie'):
    for c in c_res.info().get_all('Set-Cookie'):
        cookies.append(c.split(';')[0])

print("Captcha fetched. Please run test script to get captcha from image...")
with open("captcha_test_live.png", "wb") as f:
    f.write(c_res.read())

import sys
import time
print("Waiting 10 seconds for you to view the captcha...")
time.sleep(10)

captcha_ans = input("Enter Captcha: ")

domain_value = base64.b64encode(SP_BASE_URL.replace("https://", "")[::-1].encode()).decode()
captcha_trap_value = base64.b64encode(f"12{random_delim}5".encode()).decode()

telemetry_data = {
    "E": UA,
    "D": -330,
    "C": 1920,
    "B": 1080,
    "z": 10,
    "y": 2,
    "x": 100,
    "w": 5000,
    "v": False,
    "u": "j3x9a1"
}
telemetry_base64 = base64.b64encode(json.dumps(telemetry_data).encode()).decode()

form_data = {
    'username': 'nb6938',
    'password': 'Password123',
    'captcha': captcha_ans,
    domain_field: domain_value,
    captcha_field: captcha_trap_value,
    'telemetryPayload': telemetry_base64
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
    print("Success! Size:", len(html_post))
except urllib.error.HTTPError as e:
    html_post = e.read().decode()
    print("Error HTTP:", e.code)
    
if "Invalid Captcha" in html_post or "invalid captcha" in html_post.lower():
    print("Result: Invalid Captcha")
elif "Invalid credentials" in html_post or "invalid credentials" in html_post.lower():
    print("Result: Invalid credentials")
elif "JavaScript is required" in html_post:
    print("Result: Javascript required (Login page returned)")
else:
    print("Result: Unknown. Title:", html_post[:500].replace('\n', ' '))
