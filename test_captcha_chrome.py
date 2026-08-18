import subprocess
import re

html = subprocess.check_output(['curl', '-s', 'https://sp.srmist.edu.in/srmiststudentportal/students/loginManager/youLogin.jsp']).decode()

nonce_match = re.search(r"nonce:\s*'([^']+)'", html)
if not nonce_match:
    print("No nonce")
    exit(1)
nonce = nonce_match.group(1)

token_match = re.search(r"SCaptchaServlet\?ts=[^&]+&token=([^\"']+)", html)
token = token_match.group(1)
ts_match = re.search(r"SCaptchaServlet\?ts=([^&]+)&token=", html)
ts = ts_match.group(1)

import base64
domain_proof = base64.b64encode(f"{nonce}:sp.srmist.edu.in".encode()).decode()

print(f"curl -v -H 'X-Domain-Proof: {domain_proof}' -H 'Accept: image/png, image/jpeg, image/svg+xml, image/*' -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' 'https://sp.srmist.edu.in/srmiststudentportal/SCaptchaServlet?ts={ts}&token={token}'")
