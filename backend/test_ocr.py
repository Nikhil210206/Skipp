import ddddocr
import requests
import base64
from core.student_portal_client import init_login_session

captcha_data = init_login_session()
b64_str = captcha_data.captcha_base64.split(",")[1]
image_bytes = base64.b64decode(b64_str)

ocr = ddddocr.DdddOcr()
res = ocr.classification(image_bytes)
print(f"Solved: {res}")
