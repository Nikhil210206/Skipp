import re

with open("backend/core/student_portal_client.py", "r") as f:
    content = f.read()

old_block = """    req = urllib.request.Request(LOGIN_PAGE_URL, headers={'User-Agent': UA})
    res = urllib.request.urlopen(req)"""

new_block = """    req = urllib.request.Request(LOGIN_PAGE_URL, headers={'User-Agent': UA})
    try:
        res = urllib.request.urlopen(req)
    except urllib.error.URLError as e:
        raise StudentPortalClientError(f"Network error connecting to student portal: {e}")"""

content = content.replace(old_block, new_block)

with open("backend/core/student_portal_client.py", "w") as f:
    f.write(content)
