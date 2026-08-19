with open("backend/core/student_portal_client.py", "r") as f:
    content = f.read()

import re

# In init_login_session:
old_init = """def init_login_session() -> StudentPortalCaptchaResponse:
    req = urllib.request.Request(LOGIN_PAGE_URL, headers={'User-Agent': UA})
    try:
        res = urllib.request.urlopen(req)"""

new_init = """def _get_opener(cj=None):
    handlers = []
    if cj is not None:
        handlers.append(urllib.request.HTTPCookieProcessor(cj))
    proxy_url = os.environ.get("SKIPP_PROXY") or os.environ.get("HTTPS_PROXY")
    if proxy_url:
        handlers.append(urllib.request.ProxyHandler({'http': proxy_url, 'https': proxy_url}))
    return urllib.request.build_opener(*handlers)

def init_login_session() -> StudentPortalCaptchaResponse:
    req = urllib.request.Request(LOGIN_PAGE_URL, headers={'User-Agent': UA})
    try:
        opener = _get_opener()
        res = opener.open(req)"""

content = content.replace(old_init, new_init)

# In submit_login_and_fetch:
old_opener = """    # Create a CookieJar opener to handle redirects and cookies automatically
    import http.cookiejar
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))"""

new_opener = """    # Create a CookieJar opener to handle redirects and cookies automatically
    import http.cookiejar
    cj = http.cookiejar.CookieJar()
    opener = _get_opener(cj)"""

content = content.replace(old_opener, new_opener)

with open("backend/core/student_portal_client.py", "w") as f:
    f.write(content)
