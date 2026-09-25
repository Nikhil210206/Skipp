import urllib.request
UA = "Mozilla/5.0"
req = urllib.request.Request("https://sp.srmist.edu.in/srmiststudentportal/students/loginManager/youLogin.jsp", headers={'User-Agent': UA})
res = urllib.request.urlopen(req)
html = res.read().decode('utf-8', errors='ignore')
print("invalid login credentials" in html.lower() or "invalid credentials" in html.lower())
