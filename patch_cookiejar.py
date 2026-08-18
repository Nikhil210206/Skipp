import re

with open("backend/core/student_portal_client.py", "r") as f:
    content = f.read()

# Replace the manual merge_cookies and current_cookie_str logic with a CookieJar opener
old_block = """    def merge_cookies(cookie_str: str, new_headers: list[str] | None) -> str:
        cookies = {}
        if cookie_str:
            for part in cookie_str.split(';'):
                part = part.strip()
                if '=' in part:
                    k, v = part.split('=', 1)
                    cookies[k] = v
        if new_headers:
            for header in new_headers:
                main_part = header.split(';')[0].strip()
                if '=' in main_part:
                    k, v = main_part.split('=', 1)
                    cookies[k] = v
        return '; '.join([f"{k}={v}" for k, v in cookies.items()])
        
    current_cookie_str = merge_cookies(req_data.session_cookie, set_cookies)"""

new_block = """    # Create a CookieJar opener to handle redirects and cookies automatically
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
                cj.set_cookie(ck)
                
    # Update CookieJar with the cookies from the POST response
    if set_cookies:
        for header in set_cookies:
            main_part = header.split(';')[0].strip()
            if '=' in main_part:
                k, v = main_part.split('=', 1)
                ck = http.cookiejar.Cookie(version=0, name=k, value=v, port=None, port_specified=False, domain='sp.srmist.edu.in', domain_specified=False, domain_initial_dot=False, path='/', path_specified=False, secure=False, expires=None, discard=True, comment=None, comment_url=None, rest={'HttpOnly': None}, rfc2109=False)
                cj.set_cookie(ck)"""

content = content.replace(old_block, new_block)

# Replace urlopen with opener.open everywhere after this block
content = re.sub(r'urllib\.request\.urlopen\(req_redirect\)', 'opener.open(req_redirect)', content)
content = re.sub(r'urllib\.request\.urlopen\(req_hrd\)', 'opener.open(req_hrd)', content)
content = re.sub(r'urllib\.request\.urlopen\(req_att\)', 'opener.open(req_att)', content)
content = re.sub(r'urllib\.request\.urlopen\(req_marks\)', 'opener.open(req_marks)', content)

# Remove manual cookie headers and current_cookie_str references
content = re.sub(r"'Cookie': current_cookie_str,\n\s*", "", content)
content = re.sub(r"current_cookie_str = merge_cookies\(current_cookie_str, redirect_cookies\)", "", content)
content = re.sub(r"current_cookie_str = merge_cookies\(current_cookie_str, hrd_cookies\)", "", content)
content = re.sub(r"redirect_cookies = res_redirect\.info\(\)\.get_all\('Set-Cookie'\)", "", content)
content = re.sub(r"hrd_cookies = res_hrd\.info\(\)\.get_all\('Set-Cookie'\)", "", content)

with open("backend/core/student_portal_client.py", "w") as f:
    f.write(content)
