with open("backend/core/student_portal_client.py", "r") as f:
    content = f.read()

import re

# We will remove the cj initialization from after res_post and move it to the top.
# Then change urlopen to opener.open

block_to_move = """    # Create a CookieJar opener to handle redirects and cookies automatically
    import http.cookiejar
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    
    # Load initial cookies into CookieJar
    if req_data.session_cookie:
        for part in req_data.session_cookie.split(';'):
            part = part.strip()
            if '=' in part:
                k, v = part.split('=', 1)
                ck = http.cookiejar.Cookie(version=0, name=k, value=v, port=None, port_specified=False, domain='sp.srmist.edu.in', domain_specified=False, domain_initial_dot=False, path='/', path_specified=False, secure=False, expires=None, discard=True, comment=None, comment_url=None, rest={'HttpOnly': None}, rfc2109=False)
                cj.set_cookie(ck)"""

content = content.replace(block_to_move, "")

new_top = block_to_move + """
    
    req_post = urllib.request.Request(LOGIN_SUBMIT_URL, data=encoded_data, headers={
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': SP_BASE_URL,
        'Referer': LOGIN_SUBMIT_URL
    })"""

# Replace the original req_post construction
old_req = """    req_post = urllib.request.Request(LOGIN_SUBMIT_URL, data=encoded_data, headers={
        'User-Agent': UA,
        'Cookie': req_data.session_cookie,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': SP_BASE_URL,
        'Referer': LOGIN_SUBMIT_URL
    })"""

content = content.replace(old_req, new_top)

# Replace urlopen with opener.open
content = content.replace("res_post = urllib.request.urlopen(req_post)", "res_post = opener.open(req_post)\n        print('COOKIES AFTER POST:', [c for c in cj], flush=True)")

with open("backend/core/student_portal_client.py", "w") as f:
    f.write(content)
