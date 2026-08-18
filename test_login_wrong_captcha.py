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
nonce = re.search(r"nonce:\s*'([^']+)'", html).group(1)
domain_field = re.search(r"domainFieldName\s*=\s*'([^']+)'", html).group(1)
captcha_field = re.search(r"captchaFieldName\s*=\s*'([^']+)'", html).group(1)
random_delim = re.search(r"randomDelimiter\s*=\s*'([^']+)'", html).group(1)

domain_value = base64.b64encode(SP_BASE_URL.replace("https://", "")[::-1].encode()).decode()
captcha_trap_value = base64.b64encode(f"12{random_delim}5".encode()).decode()

form_data = {
    'username': 'nb6938',
    'password': 'Password123',
    'captcha': 'WRONG',
    domain_field: domain_value,
    captcha_field: captcha_trap_value
}
encoded_data = urllib.parse.urlencode(form_data).encode()

req_post = urllib.request.Request(LOGIN_SUBMIT_URL, data=encoded_data, headers={
    'User-Agent': UA,
    'Cookie': cookie,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Origin': SP_BASE_URL,
    'Referer': LOGIN_PAGE_URL
})

res_post = urllib.request.urlopen(req_post)
result_html = res_post.read().decode('utf-8', errors='ignore')

if "Invalid Captcha" in result_html or "invalid captcha" in result_html.lower():
    print("Result: Invalid Captcha")
elif "Invalid credentials" in result_html or "invalid credentials" in result_html.lower():
    print("Result: Invalid credentials")
else:
    print("Result: Unknown")
