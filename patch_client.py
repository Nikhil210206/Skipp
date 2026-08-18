with open("backend/core/student_portal_client.py", "r") as f:
    content = f.read()

# Fix the redirect request to include Content-Type
old_req_redirect = """        req_redirect = urllib.request.Request(
            f"{SP_BASE_URL}/srmiststudentportal/students/loginManager/youLogin.jsp",
            data=b"",
            headers={
                'User-Agent': UA,
                'Cookie': current_cookie_str,
                'Referer': LOGIN_PAGE_URL
            }
        )"""

new_req_redirect = """        req_redirect = urllib.request.Request(
            f"{SP_BASE_URL}/srmiststudentportal/students/loginManager/youLogin.jsp",
            data=b"",
            headers={
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': UA,
                'Cookie': current_cookie_str,
                'Referer': LOGIN_PAGE_URL
            }
        )"""
content = content.replace(old_req_redirect, new_req_redirect)

# Fix req_att to be a GET request (remove data=b"")
old_req_att = """    req_att = urllib.request.Request(ATTENDANCE_URL, data=b"", headers={
        'User-Agent': UA,
        'Cookie': current_cookie_str,
        'Referer': f"{SP_BASE_URL}/srmiststudentportal/students/template/HRDSystem.jsp"
    })"""

new_req_att = """    req_att = urllib.request.Request(ATTENDANCE_URL, headers={
        'User-Agent': UA,
        'Cookie': current_cookie_str,
        'Referer': f"{SP_BASE_URL}/srmiststudentportal/students/template/HRDSystem.jsp"
    })"""
content = content.replace(old_req_att, new_req_att)

# Fix req_marks to be a GET request (remove data=b"")
old_req_marks = """    req_marks = urllib.request.Request(MARKS_URL, data=b"", headers={
        'User-Agent': UA,
        'Cookie': current_cookie_str,
        'Referer': f"{SP_BASE_URL}/srmiststudentportal/students/template/HRDSystem.jsp"
    })"""

new_req_marks = """    req_marks = urllib.request.Request(MARKS_URL, headers={
        'User-Agent': UA,
        'Cookie': current_cookie_str,
        'Referer': f"{SP_BASE_URL}/srmiststudentportal/students/template/HRDSystem.jsp"
    })"""
content = content.replace(old_req_marks, new_req_marks)

with open("backend/core/student_portal_client.py", "w") as f:
    f.write(content)
