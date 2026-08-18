import urllib.request
import urllib.parse
import json
import base64

with open('captcha_test_final.json', 'r') as f:
    data = json.load(f)

cookie = data['cookie']
domain_value = data['domain_value']
captcha_trap_value = data['captcha_trap_value']
domain_field = data['domain_field']
captcha_field = data['captcha_field']

telemetry_data = {
    "E": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "D": -330,
    "C": 1920,
    "B": 1080,
    "z": 10,
    "y": 2,
    "x": 100,
    "w": 5000,
    "v": False,
    "u": "123456789"
}
telemetry_json = json.dumps(telemetry_data)
telemetry_base64 = base64.b64encode(telemetry_json.encode()).decode()

form_data = {
    'username': 'nb6938',
    'password': 'Password123',
    'captcha': '4q3Rzx',
    domain_field: domain_value,
    captcha_field: captcha_trap_value,
    'telemetryPayload': telemetry_base64
}

encoded_data = urllib.parse.urlencode(form_data).encode()
req_post = urllib.request.Request("https://sp.srmist.edu.in/srmiststudentportal/LoginServlet", data=encoded_data, headers={
    'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    'Cookie': cookie,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Origin': 'https://sp.srmist.edu.in',
    'Referer': 'https://sp.srmist.edu.in/srmiststudentportal/students/loginManager/youLogin.jsp',
})
try:
    res = urllib.request.urlopen(req_post)
    html = res.read().decode()
    print("Success! Response size:", len(html))
except urllib.error.HTTPError as e:
    html = e.read().decode()
    print("Error HTTP:", e.code)
    
if "Invalid Captcha" in html or "invalid captcha" in html.lower():
    print("Result: Invalid Captcha")
elif "Invalid credentials" in html or "invalid credentials" in html.lower():
    print("Result: Invalid credentials")
elif "JavaScript is required" in html:
    print("Result: Javascript required")
else:
    print("Result: Login Success? title:", html[:500].replace('\n', ' '))
