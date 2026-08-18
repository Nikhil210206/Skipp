import urllib.request
import re
import base64

req = urllib.request.Request('https://sp.srmist.edu.in/srmiststudentportal/students/loginManager/youLogin.jsp', headers={'User-Agent': 'Mozilla/5.0'})
res = urllib.request.urlopen(req)
html = res.read().decode()
cookie = res.headers.get('Set-Cookie').split(';')[0]

nonce = re.search(r"nonce:\s*'([^']+)'", html).group(1)
token = re.search(r"SCaptchaServlet\?ts=[^&]+&token=([^\"']+)", html).group(1)
ts = re.search(r"SCaptchaServlet\?ts=([^&]+)&token=", html).group(1)

domain_proof = base64.b64encode(f"{nonce}:sp.srmist.edu.in".encode()).decode()

req_c = urllib.request.Request(f"https://sp.srmist.edu.in/srmiststudentportal/SCaptchaServlet?ts={ts}&token={token}", headers={
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'X-Domain-Proof': domain_proof,
    'Cookie': cookie,
    'Accept': 'image/png, image/jpeg, image/svg+xml, image/*',
    'X-Requested-With': 'XMLHttpRequest'
})
try:
    c_res = urllib.request.urlopen(req_c)
    print("Captcha Status:", c_res.getcode())
except urllib.error.HTTPError as e:
    print("Error code:", e.code)
    print("Body:", e.read().decode())
