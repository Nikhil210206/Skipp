import urllib.request
import urllib.parse
import json

with open('captcha_test3.json', 'r') as f:
    data = json.load(f)

cookie = data['cookie']
domain_value = data['domain_value']
captcha_trap_value = data['captcha_trap_value']
domain_field = data['domain_field']
captcha_field = data['captcha_field']

form_data = {
    'username': 'nb6938',
    'password': 'Password123',
    'captcha': 'WRONG',
    domain_field: domain_value,
    captcha_field: captcha_trap_value
}

encoded_data = urllib.parse.urlencode(form_data).encode()
req_post = urllib.request.Request("https://sp.srmist.edu.in/srmiststudentportal/LoginServlet", data=encoded_data, headers={
    'User-Agent': "Mozilla/5.0",
    'Cookie': cookie,
    'Content-Type': 'application/x-www-form-urlencoded',
})
try:
    res = urllib.request.urlopen(req_post)
    html = res.read().decode()
except Exception as e:
    html = e.read().decode()

with open('login_error.html', 'w') as f:
    f.write(html)
