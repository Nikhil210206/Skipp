with open("backend/core/student_portal_client.py", "r") as f:
    content = f.read()

import re

# We need to find the _get_opener function and patch it to handle comma-separated proxies, 
# and also accept a specific proxy so that the same proxy is used throughout the session.

old_get_opener = """def _get_opener(cj=None):
    handlers = []
    if cj is not None:
        handlers.append(urllib.request.HTTPCookieProcessor(cj))
    proxy_url = os.environ.get("SKIPP_PROXY") or os.environ.get("HTTPS_PROXY")
    if proxy_url:
        handlers.append(urllib.request.ProxyHandler({'http': proxy_url, 'https': proxy_url}))
    return urllib.request.build_opener(*handlers)"""

new_get_opener = """import random

def _get_opener(cj=None, force_proxy=None):
    handlers = []
    if cj is not None:
        handlers.append(urllib.request.HTTPCookieProcessor(cj))
        
    proxy_url = force_proxy
    if not proxy_url:
        proxy_env = os.environ.get("SKIPP_PROXY") or os.environ.get("HTTPS_PROXY")
        if proxy_env:
            # If multiple proxies are provided (comma separated), pick one randomly
            proxies = [p.strip() for p in proxy_env.split(',') if p.strip()]
            if proxies:
                proxy_url = random.choice(proxies)
                
    if proxy_url:
        handlers.append(urllib.request.ProxyHandler({'http': proxy_url, 'https': proxy_url}))
    return urllib.request.build_opener(*handlers), proxy_url"""

content = content.replace(old_get_opener, new_get_opener)

# In init_login_session:
old_init = """def init_login_session() -> StudentPortalCaptchaResponse:
    req = urllib.request.Request(LOGIN_PAGE_URL, headers={'User-Agent': UA})
    try:
        opener = _get_opener()
        res = opener.open(req)"""

new_init = """def init_login_session() -> StudentPortalCaptchaResponse:
    req = urllib.request.Request(LOGIN_PAGE_URL, headers={'User-Agent': UA})
    try:
        opener, chosen_proxy = _get_opener()
        res = opener.open(req)"""

content = content.replace(old_init, new_init)

# Now we need to pass the chosen_proxy back to the frontend, so it can be re-used in submit_login_and_fetch.
# In init_login_session return statement:
old_return = """    return StudentPortalCaptchaResponse(
        session_cookie=cookie_str,
        domain_field=domain_field,
        captcha_field=captcha_field,
        random_delim=random_delim,
        honeypot_field=honeypot_field,
        captcha_base64=captcha_b64
    )"""

new_return = """    # Append the proxy to the session cookie so we can reuse it
    if chosen_proxy:
        cookie_str += f"; SKIPP_PROXY_ID={chosen_proxy}"
        
    return StudentPortalCaptchaResponse(
        session_cookie=cookie_str,
        domain_field=domain_field,
        captcha_field=captcha_field,
        random_delim=random_delim,
        honeypot_field=honeypot_field,
        captcha_base64=captcha_b64
    )"""

content = content.replace(old_return, new_return)

# In submit_login_and_fetch:
old_submit = """    # Load initial cookies into CookieJar
    if req_data.session_cookie:
        for part in req_data.session_cookie.split(';'):
            part = part.strip()
            if '=' in part:"""

new_submit = """    chosen_proxy = None
    # Load initial cookies into CookieJar
    if req_data.session_cookie:
        for part in req_data.session_cookie.split(';'):
            part = part.strip()
            if '=' in part:
                k, v = part.split('=', 1)
                if k == 'SKIPP_PROXY_ID':
                    chosen_proxy = v
                    continue"""

content = content.replace(old_submit, new_submit)

# Also update the submit_login_and_fetch _get_opener call:
old_submit_opener = """    # Create a CookieJar opener to handle redirects and cookies automatically
    import http.cookiejar
    cj = http.cookiejar.CookieJar()
    opener = _get_opener(cj)"""

new_submit_opener = """    # Create a CookieJar opener to handle redirects and cookies automatically
    import http.cookiejar
    cj = http.cookiejar.CookieJar()
    # Note: we need to delay creating the opener until after we parse chosen_proxy from cookies
"""
content = content.replace(old_submit_opener, new_submit_opener)

# Delay the opener creation until just before req_post:
old_req_post = """    req_post = urllib.request.Request(LOGIN_SUBMIT_URL, data=encoded_data, headers={"""

new_req_post = """    opener, _ = _get_opener(cj, force_proxy=chosen_proxy)
    req_post = urllib.request.Request(LOGIN_SUBMIT_URL, data=encoded_data, headers={"""
    
content = content.replace(old_req_post, new_req_post)

with open("backend/core/student_portal_client.py", "w") as f:
    f.write(content)
