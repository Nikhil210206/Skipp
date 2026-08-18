import urllib.request
req = urllib.request.Request("https://sp.srmist.edu.in/srmiststudentportal/students/loginManager/youLogin.jsp")
res = urllib.request.urlopen(req)
print("All cookies:", res.info().get_all('Set-Cookie'))
