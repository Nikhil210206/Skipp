import urllib.request
import re
import base64

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
SP_BASE_URL = "https://sp.srmist.edu.in"
LOGIN_PAGE_URL = f"{SP_BASE_URL}/srmiststudentportal/students/loginManager/youLogin.jsp"

req = urllib.request.Request(LOGIN_PAGE_URL, headers={'User-Agent': UA})
res = urllib.request.urlopen(req)
html = res.read().decode('utf-8', errors='ignore')
cookie = res.headers.get('Set-Cookie').split(';')[0]
print("Initial Cookie:", cookie)

nonce = re.search(r"nonce:\s*'([^']+)'", html).group(1)
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
print("Captcha Set-Cookie:", c_res.headers.get('Set-Cookie'))
