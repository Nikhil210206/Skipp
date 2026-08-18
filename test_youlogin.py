import urllib.request

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
SP_BASE_URL = "https://sp.srmist.edu.in"
req = urllib.request.Request(f"{SP_BASE_URL}/srmiststudentportal/students/loginManager/youLogin.jsp", headers={'User-Agent': UA})
res = urllib.request.urlopen(req)
print(res.read().decode('utf-8', errors='ignore'))
