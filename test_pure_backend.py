import urllib.request
import urllib.parse
import re
import base64

req = urllib.request.Request('https://sp.srmist.edu.in/srmiststudentportal/students/loginManager/youLogin.jsp', headers={'User-Agent': 'Mozilla/5.0'})
res = urllib.request.urlopen(req)
html = res.read().decode()
cookie = res.headers.get('Set-Cookie').split(';')[0]

domain_field = re.search(r"domainFieldName\s*=\s*'([^']+)'", html).group(1)
captcha_field = re.search(r"captchaFieldName\s*=\s*'([^']+)'", html).group(1)
random_delim = re.search(r"randomDelimiter\s*=\s*'([^']+)'", html).group(1)

domain_value = base64.b64encode("ni.ude.tsimrs.ps".encode()).decode()
trap_payload = f"12{random_delim}5"
captcha_trap_value = base64.b64encode(trap_payload.encode()).decode()

data = {
    'username': 'testuser',
    'password': 'testpassword',
    'sscc': 'abcd',
    domain_field: domain_value,
    captcha_field: captcha_trap_value
}
encoded_data = urllib.parse.urlencode(data).encode()

req_post = urllib.request.Request('https://sp.srmist.edu.in/srmiststudentportal/LoginServlet', data=encoded_data, headers={
    'User-Agent': 'Mozilla/5.0',
    'Cookie': cookie,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Origin': 'https://sp.srmist.edu.in',
    'Referer': 'https://sp.srmist.edu.in/srmiststudentportal/students/loginManager/youLogin.jsp'
})

try:
    res_post = urllib.request.urlopen(req_post)
    out = res_post.read().decode()
    with open("output.html", "w") as f:
        f.write(out)
except urllib.error.HTTPError as e:
    with open("output.html", "w") as f:
        f.write(e.read().decode())
