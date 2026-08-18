import urllib.request

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
SP_BASE_URL = "https://sp.srmist.edu.in"
req = urllib.request.Request(f"{SP_BASE_URL}/srmiststudentportal/students/loginManager/youLogin.jsp", headers={'User-Agent': UA})
res = urllib.request.urlopen(req)

cookies = res.info().get_all('Set-Cookie')
print("Cookies from youLogin.jsp:", cookies)
session_cookie_str = "; ".join([c.split(';')[0] for c in cookies]) if cookies else ""

req_cap = urllib.request.Request(f"{SP_BASE_URL}/srmiststudentportal/captchaServlet", headers={'User-Agent': UA, 'Cookie': session_cookie_str})
res_cap = urllib.request.urlopen(req_cap)
print("Cookies from captchaServlet:", res_cap.info().get_all('Set-Cookie'))
