import asyncio
from core.student_portal_client import init_login_session, submit_login_and_fetch
from models.student_portal import StudentPortalLoginRequest

def test():
    print("Init session...")
    init_data = init_login_session()
    
    with open("captcha2.png", "wb") as f:
        import base64
        f.write(base64.b64decode(init_data.captcha_base64.split(",")[1]))
        
    print("Captcha saved to captcha2.png")
    captcha = input("Enter captcha: ")
    
    req_data = StudentPortalLoginRequest(
        username="nb6938",
        password="Password123",
        captcha=captcha,
        sessionCookie=init_data.session_cookie,
        random_delim=init_data.random_delim,
        domain_field=init_data.domain_field,
        captcha_field=init_data.captcha_field
    )
    
    try:
        res = submit_login_and_fetch(req_data)
        print("Success:", type(res))
    except Exception as e:
        print("Error:", repr(e))
        import urllib.request, urllib.parse, base64, json, time
        # RE-DO request to dump HTML
        domain_value = base64.b64encode("ni.ude.tsimrs.ps".encode()).decode()
        trap_payload = f"12{init_data.random_delim}5"
        captcha_trap_value = base64.b64encode(trap_payload.encode()).decode()
        t_now = int(time.time() * 1000)
        payload_json = json.dumps({
            "startTime": t_now - 15000,
            "deviceMemory": 8,
            "hardwareConcurrency": 8,
            "screenWidth": 1440,
            "screenHeight": 900,
            "colorDepth": 24,
            "devicePixelRatio": 2,
            "language": "en-US",
            "userLanguage": "en-US",
            "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "timezoneOffset": -330,
            "touchSupport": False,
            "webdriver": False,
            "keystrokeCount": 11,
            "mouseMovements": 42,
            "mouseClicks": 2,
            "typingSpeedMs": 1500,
            "canvasHash": "canvas-123456",
            "submitTime": t_now,
            "timeOnPageMs": 15000
        }, separators=(',', ':'))
        telemetry_payload = base64.b64encode(payload_json.encode('utf-8')).decode('utf-8')
        form_data = {
            'username': 'nb6938',
            'password': 'Password123',
            'captcha': captcha,
            init_data.domain_field: domain_value,
            init_data.captcha_field: captcha_trap_value,
            'telemetryPayload': telemetry_payload
        }
        encoded_data = urllib.parse.urlencode(form_data).encode()
        req_post = urllib.request.Request("https://sp.srmist.edu.in/srmiststudentportal/LoginServlet", data=encoded_data, headers={
            'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            'Cookie': init_data.session_cookie,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': "https://sp.srmist.edu.in",
            'Referer': "https://sp.srmist.edu.in/srmiststudentportal/students/loginManager/youLogin.jsp"
        })
        res_post = urllib.request.urlopen(req_post)
        result_html = res_post.read().decode('utf-8', errors='ignore')
        with open("dump_failed.html", "w") as f:
            f.write(result_html)
        print("Dumped to dump_failed.html")

test()
