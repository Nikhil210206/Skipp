with open("backend/core/student_portal_client.py", "r") as f:
    content = f.read()

# Add logging for every request's HTML
import re

content = re.sub(
    r"res_redirect = opener\.open\(req_redirect\)\n\s*result_html = res_redirect\.read\(\)\.decode\('utf-8', errors='ignore'\)",
    r"res_redirect = opener.open(req_redirect)\n            result_html = res_redirect.read().decode('utf-8', errors='ignore')\n            with open('debug_res_redirect.html', 'w') as f:\n                f.write(result_html)",
    content
)

content = re.sub(
    r"res_hrd = opener\.open\(req_hrd\)",
    r"res_hrd = opener.open(req_hrd)\n        with open('debug_res_hrd.html', 'w') as f:\n            f.write(res_hrd.read().decode('utf-8', errors='ignore'))",
    content
)

with open("backend/core/student_portal_client.py", "w") as f:
    f.write(content)
