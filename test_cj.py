with open("backend/core/student_portal_client.py", "r") as f:
    content = f.read()

import re
content = re.sub(
    r"res_post = opener\.open\(req_post\)",
    r"res_post = opener.open(req_post)\n        print('COOKIES AFTER POST:', [c for c in cj], flush=True)",
    content
)
content = re.sub(
    r"res_redirect = opener\.open\(req_redirect\)",
    r"res_redirect = opener.open(req_redirect)\n            print('COOKIES AFTER REDIRECT:', [c for c in cj], flush=True)",
    content
)

with open("backend/core/student_portal_client.py", "w") as f:
    f.write(content)
