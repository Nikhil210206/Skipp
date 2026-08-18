import re
import base64
import urllib.request
import urllib.parse

req = urllib.request.Request('https://sp.srmist.edu.in/srmiststudentportal/students/loginManager/youLogin.jsp', headers={'User-Agent': 'Mozilla/5.0'})
res = urllib.request.urlopen(req)
html = res.read().decode()
cookie = res.headers.get('Set-Cookie').split(';')[0]

nonce_match = re.search(r"nonce:\s*'([^']+)'", html)
if not nonce_match:
    print("No nonce")
    exit(1)
nonce = nonce_match.group(1)

token_match = re.search(r"SCaptchaServlet\?ts=[^&]+&token=([^\"']+)", html)
token = token_match.group(1)
ts_match = re.search(r"SCaptchaServlet\?ts=([^&]+)&token=", html)
ts = ts_match.group(1)

domain_proof = base64.b64encode(f"{nonce}:sp.srmist.edu.in".encode()).decode()

req_c = urllib.request.Request(f"https://sp.srmist.edu.in/srmiststudentportal/SCaptchaServlet?ts={ts}&token={token}", headers={
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'X-Domain-Proof': domain_proof,
    'Cookie': cookie,
    'Accept': 'image/png, image/jpeg, image/svg+xml, image/*'
})
try:
    c_res = urllib.request.urlopen(req_c)
    print("Captcha Status:", c_res.getcode())
except Exception as e:
    print("Error:", e)
