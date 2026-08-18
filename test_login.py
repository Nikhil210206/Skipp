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

cookie = res.headers.get('Set-Cookie').split(';')[0]
print("Cookie:", cookie)

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
    'Cookie': cookie,
    'Accept': 'image/png, image/jpeg, image/svg+xml, image/*',
    'Referer': LOGIN_PAGE_URL,
})

c_res = urllib.request.urlopen(req_c)
print("Captcha Response Code:", c_res.getcode())
with open("captcha_test.png", "wb") as f:
    f.write(c_res.read())

print("Check captcha_test.png and enter captcha:")
with open('captcha_test.py_vars.json', 'w') as f:
    json.dump({
        'cookie': cookie,
        'domain_value': domain_proof,
        'captcha_trap_value': base64.b64encode(f"12{random_delim}5".encode()).decode(),
        'domain_field': domain_field,
        'captcha_field': captcha_field
    }, f)
