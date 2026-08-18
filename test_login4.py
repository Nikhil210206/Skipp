import urllib.request
import urllib.parse
import sys
import json
import re

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
LOGIN_SUBMIT_URL = "https://sp.srmist.edu.in/srmiststudentportal/LoginServlet"
SP_BASE_URL = "https://sp.srmist.edu.in"
LOGIN_PAGE_URL = f"{SP_BASE_URL}/srmiststudentportal/students/loginManager/youLogin.jsp"

with open('captcha_test3.json', 'r') as f:
    data = json.load(f)

cookie = data['cookie']
domain_value = data['domain_value']
captcha_trap_value = data['captcha_trap_value']
domain_field = data['domain_field']
captcha_field = data['captcha_field']

captcha_ans = sys.argv[1]
username = "nb6938"
password = "Password123"

form_data = {
    'username': username,
    'password': password,
    'captcha': captcha_ans,
    domain_field: domain_value,
    captcha_field: captcha_trap_value
}

encoded_data = urllib.parse.urlencode(form_data).encode()

req_post = urllib.request.Request(LOGIN_SUBMIT_URL, data=encoded_data, headers={
    'User-Agent': UA,
    'Cookie': cookie,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Origin': SP_BASE_URL,
    'Referer': LOGIN_PAGE_URL
})

try:
    res_post = urllib.request.urlopen(req_post)
    result_html = res_post.read().decode('utf-8', errors='ignore')
except urllib.error.HTTPError as e:
    result_html = e.read().decode('utf-8', errors='ignore')

if "Invalid Captcha" in result_html or "invalid captcha" in result_html.lower():
    print("Failed: Invalid Captcha")
elif "Invalid credentials" in result_html or "invalid credentials" in result_html.lower():
    print("Failed: Invalid credentials")
elif "JavaScript is required" in result_html:
    print("Failed: Javascript required")
else:
    print("Success! Result len:", len(result_html))
    title_match = re.search(r"<title>(.*?)</title>", result_html)
    if title_match:
        print("Result title:", title_match.group(1))
