with open("backend/core/student_portal_client.py", "r") as f:
    content = f.read()

old_block = """    if "welcome" not in result_html.lower() and "attendance" not in result_html.lower() and "dashboard" not in result_html.lower() and "thegr8loginloader" not in result_html.lower():
        print(f"Login failed: Unknown response, size {len(result_html)}")
        with open("unknown_response.html", "w") as f:
            f.write(result_html)
        raise StudentPortalClientError("Failed to login, unknown response.")
        
    # If successful, fetch reports"""

new_block = """    if "welcome" not in result_html.lower() and "attendance" not in result_html.lower() and "dashboard" not in result_html.lower() and "thegr8loginloader" not in result_html.lower():
        print(f"Login failed: Unknown response, size {len(result_html)}")
        with open("unknown_response.html", "w") as f:
            f.write(result_html)
        raise StudentPortalClientError("Failed to login, unknown response.")

    # Fetch HRDSystem.jsp first to initialize dashboard session
    req_hrd = urllib.request.Request(f"{SP_BASE_URL}/srmiststudentportal/students/template/HRDSystem.jsp", headers={
        'User-Agent': UA,
        'Cookie': current_cookie_str,
        'Referer': LOGIN_PAGE_URL
    })
    try:
        res_hrd = urllib.request.urlopen(req_hrd)
        hrd_cookies = res_hrd.info().get_all('Set-Cookie')
        current_cookie_str = merge_cookies(current_cookie_str, hrd_cookies)
    except urllib.error.HTTPError as e:
        print(f"HRDSystem fetch failed: {e}")
        pass
        
    # If successful, fetch reports"""

content = content.replace(old_block, new_block)

with open("backend/core/student_portal_client.py", "w") as f:
    f.write(content)
