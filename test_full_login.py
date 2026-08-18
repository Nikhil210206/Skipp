import urllib.request
import urllib.parse
import base64

SP_BASE_URL = "https://sp.srmist.edu.in"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"

req = urllib.request.Request(f"{SP_BASE_URL}/srmiststudentportal/students/loginManager/youLogin.jsp", headers={'User-Agent': UA})
res = urllib.request.urlopen(req)
cookies = res.info().get_all('Set-Cookie')
session_cookie = "; ".join([c.split(';')[0] for c in cookies]) if cookies else ""

req_cap = urllib.request.Request(f"{SP_BASE_URL}/srmiststudentportal/captchaManager/captchaServlet", headers={'User-Agent': UA, 'Cookie': session_cookie})
res_cap = urllib.request.urlopen(req_cap)
cap_data = res_cap.read()
with open("test_captcha_real.png", "wb") as f:
    f.write(cap_data)

print(session_cookie)
