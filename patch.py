def merge_cookies(cookie_str, set_cookie_headers):
    cookies = {}
    if cookie_str:
        for part in cookie_str.split(';'):
            part = part.strip()
            if '=' in part:
                k, v = part.split('=', 1)
                cookies[k] = v
    if set_cookie_headers:
        for header in set_cookie_headers:
            main_part = header.split(';')[0].strip()
            if '=' in main_part:
                k, v = main_part.split('=', 1)
                cookies[k] = v
    return '; '.join([f"{k}={v}" for k, v in cookies.items()])
